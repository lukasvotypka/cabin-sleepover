# T-003: FastAPI app: startup, join and cookies, rate limits, `GET /api/state` with ETag

- **Phase:** 1
- **Depends on:** T-002
- **Size:** M

## Goal
Build the FastAPI app around the store. It loads the config and secrets at startup, serves the page, checks the group code and sets signed cookies, limits code attempts, and returns the full state with `ETag`, all in the shared response envelope. Proposal sections: „HTTP API“ (Odpoveď, Endpointy, Kódy a cookies, Chybové kódy), „Bezpečnosť a limity“, „Architektúra“.

## Scope
- `app/main.py` (an app factory such as `create_app(config_dir, data_dir)` plus a module-level `app` for uvicorn)
- `app/ratelimit.py`
- `static/index.html`: a placeholder only (`<!DOCTYPE html>`, `lang="sk"`, a title), replaced in T-005
- `tests/test_api_access.py`, `tests/test_ratelimit.py`

## Acceptance criteria
- [x] Startup reads `GROUP_CODE`, `ADMIN_CODE` and `SECRET_KEY` from the environment and loads both config files. It runs the T-002 startup check. A missing variable or a failed check stops startup with a clear message.
- [x] `GET /` returns `static/index.html`. `GET /api/health` returns `{"ok": true}` without a cookie.
- [x] Nothing outside `static/` is reachable over HTTP. A test asserts 404 for `/data/chata-data.yaml`, `/config/app.yaml`, `/files/mapa-nahlad.html`, `/.env` and a path-traversal attempt such as `/static/../data/chata-data.yaml`.
- [x] `POST /api/join {code}`:
  - [x] codes are compared with `secrets.compare_digest`
  - [x] the group code sets the group cookie and returns `{"ok": true, "role": "group"}`
  - [x] the admin code sets the group cookie and the admin cookie and returns `role: "admin"`
  - [x] a wrong code returns `401 bad_code` (tests assert the `code`, not the message text)
- [x] Cookies:
  - [x] signed with `itsdangerous` using `SECRET_KEY`
  - [x] `HttpOnly`, `Secure`, `SameSite=Lax`
  - [x] the group cookie lasts 30 days and the admin cookie 12 hours (both the cookie `Max-Age` and the signature age check)
  - [x] a tampered or expired cookie is rejected
  - [x] tests cover each of these
- [x] `GET /api/state` needs the group cookie. Without one, or with a bad one, it returns `401 bad_code` and no `state`.
- [x] `GET /api/state` returns `{"ok": true, "state": {...}}`, where `state` contains `version`, `updated_at`, `signup_open`, `event`, `layout` (from `chata.yaml`), `parties` and `sleeping`.
- [x] `GET /api/state` sends an `ETag` derived from `version`. A request with a matching `If-None-Match` gets `304` with an empty body.
- [x] A reusable dependency for "admin required" returns `403 forbidden` when the admin cookie is missing (used by T-004).
- [x] Error envelope everywhere: `{"ok": false, "error": {"code", "message", "params"}, "state": {...}}` (proposal „Odpoveď“).
  - [x] `code` is the stable identifier
  - [x] `message` is a short English note for developers and logs (e.g. `"Slot already taken"`)
  - [x] `params` is an object with the values the page needs for its Slovak text (empty `{}` when there are none)
  - [x] the server sends **no Slovak text** in any response
  - [x] `state` is left out only when the caller is not authorized (`bad_code`, and `rate_limited` on join)
  - [x] one shared helper builds this envelope, so T-004 uses the same one
- [x] FastAPI's default 422 body is replaced. Request validation errors return `422 invalid` in the envelope, with `params.field` set to the name of the first failing field (e.g. `"name"`). Tested by asserting `code` and `params.field`.
- [x] Tests check `code` and `params`, never the `message` text.
- [x] All code, identifiers, comments, log lines and startup errors are in English.
- [x] `app/ratelimit.py`: in-memory sliding windows with an injectable clock.
  - [x] code attempts: 10 per minute per IP, counting every attempt; the 11th returns `429 rate_limited`
  - [x] writes: `writes_per_client_minute` from `config/app.yaml` (30), keyed by the `X-Client-Id` header, falling back to IP when the header is missing; exposed as a helper or dependency for T-004
  - [x] unit tests cover the limit, the window rolling over, and separate keys
- [x] The tests use `httpx.AsyncClient` with `ASGITransport`, `base_url="https://test"`, a `tmp_path` data dir and test secrets.

## Notes for developer
- `ASGITransport` does not run lifespan events. Make the startup work callable from the factory, or run it explicitly in the test fixture, so the tests cover it.
- `Secure` cookies are only stored and sent over HTTPS, which is why the test client uses an `https://` base URL. For local development, Chrome and Firefox treat `http://localhost` as secure. Do not add a switch to turn `Secure` off.
- Behind the proxy, every request comes from `127.0.0.1`. The per-IP join limit only works when uvicorn runs with `--proxy-headers --forwarded-allow-ips=127.0.0.1` (T-008). Read the client IP from `request.client.host` so uvicorn's proxy handling applies.
- The join limit (10/min/IP) is in the proposal's security section, not in `app.yaml`. Keep `app.yaml` exactly as the proposal shows it.
- The ETag must change on every write and nowhere else. Use the `version` only, quoted, e.g. `"27"`.
- Defaults from `tasks/QUESTIONS.md` Q6: a missing cookie is `401 bad_code` without state, and the admin code sets both cookies.
- Open decision „Umiestnenie na serveri“: default is `127.0.0.1:8010` at the root of a (sub)domain.
- Phase 2 is out of scope. Do not read `ANTHROPIC_API_KEY` and do not add `/api/ai/*`.
- From T-002 review: run `uv add tzdata` so the `Europe/Bratislava` zone loads even on a server without system time-zone files (the store loads it at import).
- From T-002 review: a hand-restored older backup lowers `version`, so the `ETag` must not let a client keep stale data. Base the ETag on `version` plus something that changes on restore (e.g. `updated_at`), or document in T-008 that a restore must bump `version`.

---
## Dev log
**What was done**
- `app/ratelimit.py`: `SlidingWindowLimiter(limit, window=60, clock)` with `allow(key)` and `retry_after(key)`. Rejected hits are not recorded. Idle keys are swept every 256 calls so rotating `X-Client-Id` values cannot grow memory without bound.
- `app/main.py`:
  - `create_app(config_dir, data_dir, static_dir, env, clock, monotonic)` does all startup eagerly: `load_settings` (names every missing variable, refuses `GROUP_CODE == ADMIN_CODE`), `load_layout`, `load_app_config`, a check that `static/index.html` exists, then `Store(...)` (T-002 startup check, raises `StartupError`). Tests therefore cover startup without lifespan.
  - Module-level `app` for `uvicorn app.main:app` is built on first access through a module `__getattr__` (PEP 562). Importing `app.main` in tests needs no secrets. A startup failure is logged as `CRITICAL startup failed: ...` and uvicorn exits (verified by hand: missing env gives the `ConfigError` message).
  - `POST /api/join`: the 10/min/IP limit counts every attempt (also successful ones), codes compared with `secrets.compare_digest` on UTF-8 bytes (both comparisons always run), admin code sets both cookies and returns `role: "admin"`. An empty or wrong code is `401 bad_code`; the code is never logged.
  - Cookies: `CookieSigner` uses `itsdangerous.URLSafeSerializer` with one salt per role and an `issued` timestamp in the signed payload. The age is checked against 30 days (group) or 12 h (admin), and a cookie more than 60 s from the future is rejected. `Max-Age`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` are set on the cookie. I did not use `TimedSerializer`, because its clock cannot be injected for the expiry tests.
  - Reusable pieces for T-004: `require_group`, `require_admin`, `enforce_write_limit` (depends on `require_group`; key `id:<X-Client-Id>` or `ip:<host>`; `429 rate_limited` with `params.retry_after` and a `Retry-After` header), `ok_response(rt, state, **extra)`, `error_response`, `error_body`, `state_payload`, `ApiError` (a `RuleError` with `with_state` and `headers`), `get_runtime(request)`. One exception handler turns every `RuleError`/`ApiError` into the envelope. `state` is left out for `bad_code` and for `rate_limited` on join only.
  - `RequestValidationError` becomes `422 invalid` with `params.field` = the first failing top-level field (nothing when the body is not JSON). `state` is included only when the caller has a valid group cookie.
  - `GET /api/state` (group cookie): `state` has `version`, `updated_at`, `signup_open`, `event`, `layout`, `parties`, `sleeping`. `ETag` is `"<version>-<8 hex of sha1(updated_at)>"`, so a hand-restored older backup cannot match a stale client (T-002 review note). `If-None-Match` supports lists, `W/` and `*`; a match gives `304` with an empty body. `Cache-Control: no-cache` on state and index.
  - `GET /` serves `static/index.html`, `GET /api/health` is open, and only `static/` is mounted (at `/static`). No OpenAPI or docs routes.
- `static/index.html`: placeholder (`<!DOCTYPE html>`, `lang="sk"`, title).
- `tests/conftest.py`: added fixtures `clock` (FakeClock), `make_app`, `app`, `make_client`, `client`, `group_client`, `admin_client`.
- `tests/test_ratelimit.py` (limit, rollover, rejected hits not counted, separate keys, retry_after, pruning), `tests/test_api_access.py` (startup failures, page, unreachable paths incl. traversal, join, cookie attributes, signature, tampering, expiry, role separation, state content, ETag/304 and restored-backup ETag, envelope, 422 field, limits over HTTP using temporary test routes mounted on the app).
- `uv add tzdata` (T-002 review note), which updated `pyproject.toml` and `uv.lock`.

**Commands**
- `uv run pytest` gives 295 passed (all T-001 to T-003 tests).
- `uv run pytest tests/test_api_access.py tests/test_ratelimit.py` runs the new ones.
- Manual check: `GROUP_CODE=g ADMIN_CODE=a SECRET_KEY=... uv run uvicorn app.main:app --port 8011` served `/api/health` and `/api/join` with the expected `Set-Cookie`. Without the variables uvicorn stops with the `ConfigError` message.

**Deviations and follow-ups**
- ETag is `version` plus a hash of `updated_at`, not the bare version (the task note allowed this, T-002 review asked for it).
- Secrets are read only from the process environment. `.env` is not parsed by the app (no `python-dotenv` dependency). For T-008: load it through systemd `EnvironmentFile=` or `uvicorn --env-file .env` (needs `python-dotenv`, so `uv add python-dotenv` if wanted). Not decided here.
- T-008 must also document `--proxy-headers --forwarded-allow-ips=127.0.0.1` for the per-IP join limit.
- 404 and 405 for unknown paths keep FastAPI's default `{"detail": ...}` body (no Slovak text, not an API error code), and an unexpected exception is a plain 500. The page's generic fallback covers both.
- `JoinRequest` lives in `app/main.py` (not `models.py`) because it is HTTP-layer only.

**Fixes after review round 1** (answers to each finding)
- **Blocker, ETag ignores `layout`/`event`: fixed.** `create_app` computes `config_digest(layout_json)` once (sha1 of the canonical JSON, 8 hex) and keeps it in `Runtime.config_hash`. `state_etag(state, config_hash)` now returns `"<version>-<hash of updated_at>-<config hash>"`. It still changes on every write and at runtime on nothing else. Test `test_etag_changes_when_chata_yaml_changes`: two apps on one data dir, the second with a copied `config/` where a room name is edited. The old ETag gives 304 on the first app and 200 with a new ETag and the new room name on the second. Also a unit test that a different `config_hash` gives a different ETag.
- **Join limit counts only failed attempts: done.** `SlidingWindowLimiter` got `blocked(key)` (counts nothing) and `hit(key)`. `allow()` is now built from the two. Join checks `blocked` first, compares, and calls `hit` only on a wrong code. There is no await between the two calls, so concurrent requests cannot slip through. The 11th request after 10 failures still gets `429 rate_limited` (right code too, while blocked). Tests: 25 successful joins from one IP pass; failures interleaved with successes still add up to a block. The old "successful joins count" test was replaced.
- **Trim the code: done.** `body.code.strip()` before comparing, and `load_settings` now strips the env values it stores (not only for the missing check). Tests for leading and trailing space, newline and tab. Whitespace-only is a plain `bad_code`.
- **Cookies tied to the current code: done.** The itsdangerous salt is `chrapa-poll/cookie/<role>/<sha256(code)[:16]>`, so the hash is not stored in the cookie. `CookieSigner(secret_key, codes, clock)`. Test: with the same `SECRET_KEY`, a new `GROUP_CODE` revokes both cookies (the admin cookie needs the group cookie anyway), and a new `ADMIN_CODE` revokes only the admin cookie.
- **`SECRET_KEY` at least 32 characters: done** (after stripping). The message points to the generator in `.env.example`. Tests for 1, 31, 31-plus-padding (refused) and 32 (accepted). The test env key is 35 characters.
- **`Cache-Control: private, no-cache` on `/api/state`: done** (also on the 304). Test added.
- **App log lines under uvicorn: fixed.** `configure_logging()` puts a stream handler and INFO level on the `chrapa` logger (covers `chrapa.app` and `chrapa.store`). It is called only from the module-level `__getattr__`, so `create_app` and the tests keep their logging. Idempotent. I did not touch propagation. Checked by a unit test, and a caplog test that the wrong-code and join lines are emitted and contain no code. I did not re-run real uvicorn for this; the handler is a plain `StreamHandler` on a logger uvicorn does not configure.
- **Nit, HEAD: done** for `/` and `/api/health` (`api_route` with GET and HEAD), with a test.
- **Nit, startup message mentioning `.env`: done.** It now says to set the variables in the environment or load `.env` via systemd `EnvironmentFile=` or `uvicorn --env-file`.
- **Nit, `/static/../...` test: agreed, left as is.** The encoded variants do the real traversal check.
- **Flaky test found and fixed while doing this.** `test_cookies_are_signed` tampered with the last base64 character of the signature, which carries unused bits, so about 1 in 16 runs it left the cookie valid. A `tamper()` helper now changes the first signature character. 15 consecutive full runs pass.
- Test fixture note: `test_module_level_app_reports_a_startup_problem` clears the `chrapa` handler that `configure_logging` adds.

**Commands (round 1 fixes):** `uv run pytest` gives 313 passed.

## Review round 1
Reviewed `app/main.py`, `app/ratelimit.py`, `static/index.html`, `tests/conftest.py`, `tests/test_api_access.py`, `tests/test_ratelimit.py`, plus the parts of `app/store.py` and `app/validate.py` this task uses. I ran `uv run pytest` myself: **295 passed**. I also probed the app by hand: a scripted restart with an edited `chata.yaml`, and a short real `uvicorn` run.

Most of the task is solid. Cookies are signed with one salt per role, `issued` sits inside the signed payload, and the age and future-skew checks use the injectable clock. `compare_digest` runs on UTF-8 bytes and both comparisons always run (bytes are needed: `compare_digest` raises on non-ASCII `str`). The join limit counts every attempt, keyed on `request.client.host`, so uvicorn's proxy-header handling applies (uvicorn 0.54 takes the rightmost untrusted `X-Forwarded-For` entry, so a spoofed header cannot dodge the limit). The write limit is keyed `id:`/`ip:`, the client ID is capped at 64 chars, and idle keys are pruned. The envelope comes from one helper, and `state` is left out exactly for `bad_code` and the join `rate_limited`. The 422 handler sets `params.field`. Only `/static` is mounted, and there are no docs or OpenAPI routes.

The Dev log decisions:
- **Lazy module-level `app` (PEP 562 `__getattr__`)**: OK. uvicorn resolves it with `getattr`, other names raise `AttributeError` as PEP 562 requires, and `load_settings` runs first, so a missing secret fails before `data/` is touched.
- **Secrets only from the process env**: OK. This matches T-008 ("Do not add a dotenv loader to the app"; systemd `EnvironmentFile=` loads `.env`).
- **`GROUP_CODE != ADMIN_CODE`**: a good, cheap guard against a config that would make every group member an admin.
- **FastAPI default bodies for 404/405/500**: acceptable. The page only calls routes that exist, so a 404 or 405 means a page bug or a wrong sub-path. Its fetch wrapper has to handle non-JSON bodies anyway, because Caddy returns a 502 with no JSON when the service is down. The generic Slovak fallback plus a state refetch covers all of these. Neither body contains Slovak text or internals (verified: `{"detail":"Not Found"}`). No envelope needed.

### Blocker

1. **`app/main.py:151-154` (`state_etag`) and `:357-366` (`get_state`): the ETag ignores `layout`/`event`, so after the organizer edits `chata.yaml` and restarts, clients keep the old map.** `state` contains `layout` and `event` from `chata.yaml`, which is loaded only at startup. The ETag covers only `version` and `updated_at`, and neither changes on restart. Reproduced: GET state (`ETag "0-cf423992"`), rename a room in `chata.yaml`, build a new app on the same data dir, then GET with `If-None-Match: "0-cf423992"`. The result is **304**, but the fresh body has the new room name. In practice, the open decision „Skutočné rozloženie postelí…“ expects the organizer to send layout corrections. After the restart, every open tab polls, gets 304 and keeps the old geometry and names. A browser reload does not help either: with `Cache-Control: no-cache` the browser revalidates, gets 304 and serves its cached old JSON. This lasts until someone happens to write. **Fix:** compute a short digest of the served config once in `create_app`, e.g. `sha1(json.dumps(layout_json, sort_keys=True))[:8]`, and mix it into the ETag (e.g. `"<version>-<updated_at hash>-<layout hash>"`, or one hash over both). The ETag still changes on every write and on nothing else at runtime. **Test:** two apps on the same `tmp_path` data dir with different `config_dir` layouts (copy `config/` and change a room `name`). The old ETag must get `200` from the second app.

### Suggestions

- **App log lines are silently dropped under uvicorn.** uvicorn configures only its own loggers, so `chrapa.*` INFO lines (`wrong code attempt from …`, `join as …`, the store's `creating a fresh …`) never appear. I verified this with a real `uvicorn` run: only the access log showed. Only WARNING and above reach stderr, through Python's last-resort handler. Either call `logging.basicConfig(level=logging.INFO, format=...)` in the module-level `__getattr__` path (not in `create_app`, so tests are not affected), or have T-008 pass a `--log-config`. Without one of these, the audit-adjacent logs promised in the Dev log do not exist in production.
- **Changing `GROUP_CODE` does not revoke existing group cookies.** Only rotating `SECRET_KEY` does. If the code leaks into the wrong chat, the organizer will naturally change `GROUP_CODE` and expect everyone holding the leaked code to lose access. Either derive the per-role salt from the code (e.g. include `sha256(code)[:16]` in the salt, so a new code invalidates that role's cookies), or have T-008 document that revoking access needs a new `SECRET_KEY`.
- **Trailing whitespace in the code.** Mobile keyboards often add a trailing space after autocomplete or paste, and `"group-test-code "` is rejected (and the test locks that in). Either strip the code on the server before comparing (and strip the env values in `load_settings`, which currently strips them only for the "missing" check), or make sure T-005 trims the input. Each failed attempt also counts toward the 10/min limit.
- **Shared IPs and the join limit.** Successful joins count too, so 11 friends behind one NAT (the cabin Wi-Fi, carrier CGNAT) joining within a minute would see `rate_limited`. This matches the AC ("counting every attempt"), so it is not a blocker. Mention it in `tests/manualne.md` or T-008, or count only failed attempts if the organizer prefers.
- **`SECRET_KEY` strength.** Any non-blank value is accepted, e.g. `SECRET_KEY=x`. Consider refusing to start when it is shorter than about 32 chars, with a message pointing to the `.env.example` generator line.
- **`Cache-Control` on `/api/state`.** `no-cache` still allows shared caches to store the response. `private, no-cache` states the intent better for group-only data behind a proxy.

### Nits

- `HEAD /` and `HEAD /api/health` return 405 (FastAPI `@app.get` does not answer HEAD). Some uptime monitors use HEAD. You can add `@app.api_route(..., methods=["GET", "HEAD"])` for those two routes, or have T-008 note that health checks use GET.
- The startup error says "set them in the environment or in .env". The app itself never reads `.env`, so a local `uv run uvicorn app.main:app` with a filled `.env` gets advice that seems wrong. Consider "…or load .env via systemd EnvironmentFile= / `uvicorn --env-file`".
- `test_nothing_outside_static_is_reachable` with `/static/../data/...`: httpx normalizes `..` on the client side, so that case really requests `/data/...`. The encoded variants are what actually test traversal. Fine as is, just less than it looks.

Verdict: CHANGES REQUESTED

## Review round 2
I checked the round-1 blocker first and then went over the changed code again (`app/main.py`, `app/ratelimit.py`, `tests/test_api_access.py`, `tests/test_ratelimit.py`). I ran `uv run pytest` 5 times in a row and got **313 passed** each time, so the flaky cookie test is fixed. I also ran real `uvicorn app.main:app` on a copy of `app/`, `config/` and `static/` in a temp dir, so the repo `data/` was not touched.

### Round-1 blocker: fixed
- **ETag ignored `layout`/`event`.** `create_app` now computes `config_digest(layout_json)` once (`main.py:168-170`, `:319`), and `state_etag` returns `"<version>-<updated_at hash>-<config hash>"` (`:173-180`). `layout_json` contains `event`, so both parts of `state` that come from `chata.yaml` are covered. Nothing else changes the ETag at runtime. `test_etag_changes_when_chata_yaml_changes` reproduces my round-1 scenario (one data dir, an edited room name, the old ETag gives 200 with the new name and a new ETag), and there is a unit test for a different `config_hash`.

### Suggestions applied in round 2, checked
- **The join limit counts only failed attempts.** `blocked()` then `hit()` (`ratelimit.py:46-66`, `main.py:359-375`). There is no `await` between the check and the count, so concurrent requests on the single event loop cannot slip past. `allow()` keeps its old behaviour for the write limit. The tests cover 25 successful joins from one IP and failures that still add up when successes come in between.
  **Note for the tester and the organizer:** this deliberately departs from the AC wording "counting every attempt". The proposal says "10 pokusov o kód za minútu na IP adresu", and counting only wrong codes is the usual reading for brute-force protection. It also lets friends on the cabin Wi-Fi all join. I accept it, so test it as "10 wrong codes per minute per IP, the 11th attempt is `429 rate_limited`, even with the right code".
- **The code is trimmed** on input and in `load_settings`. Checked with real uvicorn: `" g1 "` sets the group cookie.
- **Cookies are tied to the codes.** The salt is `chrapa-poll/cookie/<role>/<sha256(code)[:16]>`, and the code hash is never put into the cookie. A new `GROUP_CODE` revokes both cookies (admin access needs the group cookie), and a new `ADMIN_CODE` revokes only the admin cookie. Both are tested.
- **`SECRET_KEY` must be at least 32 chars after stripping.** Tested at 1, 31, 31 with padding, and 32.
- **`Cache-Control: private, no-cache`** is set on 200 and 304.
- **App logging under uvicorn.** `configure_logging()` runs only on the `__getattr__` path. Checked in a real uvicorn run, where these lines now appear: `INFO chrapa.store: creating a fresh …`, `INFO chrapa.app: wrong code attempt from 127.0.0.1`, `INFO chrapa.app: join as group from 127.0.0.1`. No code shows up in the logs. A missing variable gives `CRITICAL chrapa.app: startup failed: missing environment variable(s): GROUP_CODE, ADMIN_CODE (…)` and uvicorn exits.
- **HEAD** on `/` and `/api/health` returns 200 (checked with `curl -I`).
- **Flaky test.** `tamper()` now changes the first signature character, which always changes the decoded bytes. The fix is correct.

### Blockers
None.

### Nits
- `load_settings` says it "names every problem at once", but a short `SECRET_KEY` and `GROUP_CODE == ADMIN_CODE` are reported only after the missing variables are fixed. Startup still stops with a precise message, so this is cosmetic.
- `configure_logging` puts a handler on `chrapa` and leaves propagation on. If T-008 ever gives uvicorn a `--log-config` with a root handler, every line would print twice. Mention it in T-008, or set `propagate = False` there.
- `test_module_level_app_reports_a_startup_problem` clears the `chrapa` handlers but leaves the logger level at INFO for later tests. This is harmless.

Round 2 approved. The task goes to testing.

Verdict: APPROVED

## Test report
Tester run on 2026-10-22. The real app was started with `uvicorn` from a temporary copy of `app/`, `config/` and `static/` (own `data/`, test secrets, never the repo `data/` or a `.env`). The repo has no `data/` directory before or after the run.

### Commands and results
- `uv run pytest -q`: 313 passed (three runs in a row, no flakiness). `uv run pytest -q tests/test_api_access.py tests/test_ratelimit.py`: 86 passed. This includes all T-001 and T-002 tests (no regression). There are no Node tests yet (the page logic arrives in T-005).
- Live server: `PYTHONPATH=<tmp>/site python -m uvicorn app.main:app --host 127.0.0.1 --port 8031` with `GROUP_CODE`, `ADMIN_CODE`, `SECRET_KEY` set in the environment. Requests with `curl` and `httpx`.
- In-process probe (`httpx.ASGITransport`, injected clock, temporary routes using `require_admin` and `enforce_write_limit`) for the parts that have no HTTP route until T-004.

### Acceptance criteria
| # | Criterion | Result |
| --- | --- | --- |
| 1 | Startup reads the three secrets, loads both configs, runs the T-002 check, stops with a clear message | PASS. Missing or empty variables are named; whitespace-only `GROUP_CODE`, `SECRET_KEY` shorter than 32 and `GROUP_CODE == ADMIN_CODE` are refused. Missing or broken `app.yaml`, duplicate slot ID in `chata.yaml`, missing `static/index.html`, a corrupt or unreadable data file, unquoted dates and an unsafe YAML tag all exit 1 with a precise `CRITICAL chrapa.app: startup failed: ...` line. A missing data file and an empty file are created. |
| 2 | `GET /` serves the page, `GET /api/health` gives `{"ok": true}` without cookie | PASS (also `HEAD`) |
| 3 | Nothing outside `static/` reachable | PASS. 404 for `/data/chata-data.yaml`, `/config/app.yaml`, `/files/mapa-nahlad.html`, `/.env`, `/app/main.py`, `/docs`, `/openapi.json`, `/redoc`, and for raw, `%2e%2e`, `%2f`, double-encoded and `....//` traversal sent with `nc` and `curl --path-as-is`. `/static/index.html` serves the same placeholder (harmless). |
| 4 | `POST /api/join` with `compare_digest` | PASS (code reads both comparisons on UTF-8 bytes; a non-ASCII wrong code gives 401, not 500) |
| 4a | Group code sets the group cookie, `role: "group"` | PASS |
| 4b | Admin code sets both cookies, `role: "admin"` | PASS |
| 4c | Wrong code gives `401 bad_code` | PASS (empty, whitespace-only, different case, extra char, inner space) |
| 5 | Cookies signed, `HttpOnly`, `Secure`, `SameSite=Lax`, 30 d / 12 h (`Max-Age` and signature age), tampered or expired rejected | PASS. Live `Set-Cookie`: `Max-Age=2592000` and `Max-Age=43200`, `HttpOnly`, `Secure`, `SameSite=lax`, `Path=/`. Forged cookies against the live server: 29 d 23 h accepted, 30 d + 60 s and 31 d rejected, +30 s future accepted (skew), +300 s future rejected, wrong secret, wrong salt, admin token in the group slot, boolean or missing `issued`, garbage and empty values all 401. In-process: admin cookie valid at 11 h 59 min, 403 at 12 h 5 s while the group cookie is still valid; group cookie 401 after 30 d. |
| 6 | `GET /api/state` needs the group cookie, otherwise `401 bad_code`, no `state` | PASS (no cookie, bad cookie, admin cookie only, also with `If-None-Match`) |
| 7 | State content | PASS: `version`, `updated_at`, `signup_open`, `event`, `layout`, `parties`, `sleeping` |
| 8 | `ETag` from `version`, matching `If-None-Match` gives empty `304` | PASS. Also `W/"..."`, a list, and `*` give 304; a different tag gives 200. The ETag changed after a write made by another process (`"0-..."` to `"1-..."`), the old tag then gave 200 and the new one 304. After an unchanged restart the old tag still gives 304. After editing a room name in `chata.yaml` and restarting on the same data, the old tag gives 200 with the new name and a new ETag. `Cache-Control: private, no-cache` is on the 200 and 304. |
| 9 | Reusable admin dependency gives `403 forbidden` | PASS (in-process; group cookie only gives 403 with `state`, no cookie gives 401 without `state`) |
| 10 | Error envelope everywhere, no Slovak text, `state` left out only for `bad_code` and join `rate_limited`, one shared helper | PASS. Every error body checked is ASCII (`{code, message, params}`); `forbidden`, `rate_limited` on writes and `invalid` with a valid cookie include `state`. 404 and 405 from FastAPI keep `{"detail": ...}` (accepted by review, English only). |
| 11 | 422 replaced with `invalid` and `params.field` | PASS: `{}` gives `field: "code"`, `null` and `123` give `field: "code"`; a non-JSON, binary, list-root or form body gives 422 `invalid` with `params: {}` |
| 12 | Tests assert `code` and `params`, not message; English only | PASS (reviewed and run) |
| 13 | Rate limiter with injectable clock; code attempts: **only wrong codes count, 10 per minute per IP, the 11th is `429 rate_limited`, even with the right code** (changed rule) | PASS. Live: 25 correct joins from one IP all 200; 9 wrong then a correct join (200), the 10th wrong is still 401, the 11th gets 429 with `Retry-After: 60` and `params.retry_after`; the right group code, the admin code, an empty code are all 429 while blocked; a body that fails validation is 422, and an existing cookie still reads `/api/state` (200). The block ended after the minute passed. 40 concurrent wrong codes gave exactly 10 x 401 and 30 x 429. A different IP (via `X-Forwarded-For`, trusted from loopback by uvicorn's default) has its own counter. |
| 13b | Write limit `writes_per_client_minute` (30) keyed by `X-Client-Id`, IP fallback | PASS (in-process, injected clock): 30 allowed then 429 with `Retry-After` and `params.retry_after`, a second client ID and the IP key are separate, the window rolls after 61 s, no cookie gives 401, a 100-character non-ASCII client ID is accepted |
| 14 | Tests use `httpx.AsyncClient` with `ASGITransport`, `https://test`, `tmp_path`, test secrets | PASS |

Also verified from the review round-1 requests: the code is trimmed (`"  code\n\t"` joins), changing `GROUP_CODE` and restarting revokes old group cookies and the old code (401), the new code joins, existing data survives the restart (`version`, `signup_open` kept); `ADMIN_CODE` changes are covered by unit tests. App log lines appear under uvicorn and contain no code.

### Extra scenarios tried
- Restart with valid existing data (a party and a booked slot): starts. Unknown slot, unknown party, unknown night, negative version, list-root file, unquoted dates, unsafe `!!python/object` tag, corrupt YAML, unreadable file: each refuses to start with the path and the reason (for example `sleeping.2026-10-29.nosuch-slot: unknown slot (not in chata.yaml)`).
- Redirect: `GET /static` gives 307 to `/static/`; `GET /static/` is 404 (no directory listing).
- 405 for `PUT /api/state`, `GET /api/join`, `DELETE /`.

### Failures
None.

### Notes (not failures)
- `tests/manualne.md` did not exist, so I created it with the T-003 manual items (Caddy, real client IP behind the proxy, cookie behaviour on iPhone Safari, Android Chrome and the WhatsApp in-app browser, journald logs, `EnvironmentFile=`, 404 through Caddy). T-008 must extend it, not overwrite it.
- uvicorn trusts `X-Forwarded-For` from loopback by default (`--forwarded-allow-ips=127.0.0.1`), so the per-IP limit follows that header. T-008 must make Caddy overwrite the header and keep uvicorn bound to `127.0.0.1` only, otherwise a client could dodge the limit.
- Verdict: PASS, task moved to `done/`.
