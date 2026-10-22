# T-008: Deploy files, English README and manual checklist

- **Phase:** 1
- **Depends on:** T-004
- **Size:** S

## Goal
Let the organizer install and run the app on a clean server **in Docker** behind Caddy with HTTPS, back it up and fix data by hand. Add the manual checklist for what automated tests cannot cover. Proposal sections: „Výstupy a podklady“ (`deploy/`, `README.md`), „Bezpečnosť a limity“, „Akceptačné kritériá a testovanie“ (Fáza 1, Ručný kontrolný zoznam).

**Change request (organizer, 22. 10. 2026): deploy as a Docker image instead of a systemd unit.** Round 1 built a systemd unit; replace it. The README, Caddyfile, checklist and frontend follow-ups from round 1 stay and only need their deploy parts adapted.

## Scope
- `Dockerfile`, `.dockerignore`, `compose.yaml` (repo root)
- `deploy/Caddyfile` (example); remove `deploy/chata.service`
- `README.md` (English)
- `tests/manualne.md`

## Acceptance criteria
- [x] `Dockerfile`:
  - [x] based on an official Python 3.12 slim image; uv copied from the official `ghcr.io/astral-sh/uv` image; dependencies installed with `uv sync --frozen --no-dev` (layer-cached: lock files before app code)
  - [x] runs as a non-root user
  - [x] runtime does not need uv to write anything: start the venv's uvicorn directly, e.g. `uvicorn app.main:app --host 0.0.0.0 --port 8010 --workers 1 --proxy-headers --forwarded-allow-ips=*` (inside the container `0.0.0.0` is required; `*` is safe only because the port is published on host loopback, explain in a comment)
  - [x] the image contains no `.env`, no `data/`, no `files/`, no `tests/`, no `tasks/`, no `.git` (`.dockerignore`)
  - [x] a `HEALTHCHECK` on `/api/health` without extra packages (e.g. Python `urllib`)
- [x] `compose.yaml` (one service):
  - [x] publishes only `127.0.0.1:8010:8010`
  - [x] no `env_file: .env`: `.env` is for local development only (organizer, 22. 10. 2026). The container gets `GROUP_CODE`, `ADMIN_CODE`, `SECRET_KEY` as plain environment variables via `environment:` with required interpolation (e.g. `GROUP_CODE: ${GROUP_CODE:?set GROUP_CODE}`), supplied by whoever deploys it (exported in the shell, the hosting platform, a secrets manager)
  - [x] bind-mounts `./data` read-write and `./config` read-only, so editing `config/chata.yaml` needs only a restart, not a rebuild
  - [x] `restart: unless-stopped`, `read_only: true` root filesystem with a `tmpfs` for `/tmp`
  - [x] the container user can write the mounted `./data` (document the `chown` with the UID, or choose the UID so it works)
- [x] It really works here: `docker compose up --build` with test secrets passed as environment variables (no `.env`) and a temp data dir, `/api/health` answers, `/` serves the page, a join and a write succeed, `data/` gets the file, `/data/...` and `/.env` give 404, a restart keeps the data, a corrupted data file makes the container exit with the English error visible in `docker compose logs`. Clean up containers, images and temp files afterwards.
- [x] The Caddyfile example serves HTTPS for a (sub)domain with `reverse_proxy 127.0.0.1:8010` and overwrites `X-Forwarded-For`. A short comment shows the nginx equivalent (proposal allows Caddy or nginx).
- [x] README in English (casual, friendly) covers:
  - [x] installation with uv on Python 3.12 (`uv sync --frozen --no-dev`; uv itself installed by the official installer, which also fetches Python 3.12)
  - [x] filling in `.env` from `.env.example`, including how to generate `SECRET_KEY`
  - [x] a local run (`uv run uvicorn ... --env-file .env`) and running the tests (`uv run pytest`, `node --test tests/js/`)
  - [x] deployment with Docker (`docker compose up -d --build`) and Caddy; updating = `git pull` + rebuild; `--workers 1` and the proxy-headers reason explained
  - [x] where the data lives and that `data/` is never served
  - [x] backup by copying `data/`
  - [x] restoring from `data/backups/`
  - [x] fixing data by hand only while the service is stopped, then a restart that runs the startup check
  - [x] editing `config/chata.yaml` and restarting when the map does not match reality
  - [x] reading `audit.yaml` to trace a change
- [x] README lists the open decisions from `proposal.md` with the defaults used. It also points to `tasks/QUESTIONS.md`.
- [x] `tests/manualne.md` is a checklist with one item for each phase-1 acceptance criterion that needs a human, among them:
  - [x] a clean-server deploy following the README
  - [x] HTTPS works
  - [x] the group code works
  - [x] two devices tap the same free slot at once (one wins, the other sees who has it and the map is correct again)
  - [x] a change appears on a second device within 30 s
  - [x] a couple fills a double bed with one tap, and two people taking overlapping places at once never leaves half a booking
  - [x] the amber note appears when a party holds more places than it needs
  - [x] pinch-zoom works on iPhone and Android
  - [x] move for one night and for all nights
  - [x] stay shortening with the advance warning
  - [x] restart keeps the data
  - [x] a corrupted YAML prevents start with a clear message
  - [x] the audit entry and backup are created
  - [x] iPhone Safari, Android Chrome and desktop, each in light and dark mode
  - [x] reduced motion stops the blinking
  - [x] the date, the night signposts with occupancy, the noticeboard and my-party warning are drawn in the scene from `/api/state`
  - [x] every visible text (scene, panels, error messages) is Slovak and informal, and no English server `message` ever shows up on the page
  - [x] signposts, signs and icons are easy to hit on a phone (44 px, see `tasks/QUESTIONS.md` Q9)
  - [x] a screen reader (VoiceOver, TalkBack) reads the bed labels and the hidden summary
  - [x] „Prehľad na poslanie“ and the hidden summary match the map
  - [x] `/data/…` and `/.env` are not reachable

## Notes for developer
- `--workers 1` is a correctness requirement (the lock and the rate limits live in process memory). Say so in the README.
- `--proxy-headers` with trusted forwarded IPs is required, or every client looks like the proxy (in Docker: the bridge gateway) and one person's wrong codes lock everyone out of joining. In Docker the requests arrive from the bridge gateway, not `127.0.0.1`, hence `--forwarded-allow-ips=*` together with publishing only on `127.0.0.1`.
- `uvicorn --env-file` needs `python-dotenv`. Either list it as a dependency or tell the reader to export the variables. Do not add a dotenv loader to the app.
- Open decision „Umiestnenie na serveri“: the default is `127.0.0.1:8010` at the root of its own (sub)domain. Mention that a sub-path works because the page uses relative API paths.
- Phase 2 and `ANTHROPIC_API_KEY` are out of scope. Do not document them as available.
- Use uv everywhere (see `CLAUDE.md`, "Python tooling: uv only"). No pip or requirements.txt in the README or the Dockerfile. The local (non-Docker) run in the README still uses uv.
- The app needs `Europe/Bratislava`; the `tzdata` PyPI package is already a dependency, so the slim image needs no system tzdata. Check it.
- From T-002 testing, add to `tests/manualne.md`: `data/` is writable by the service user on the real host; a backup restore drill (stop service, copy backup, start, check); a corrupt data file stops the service with the English error visible in `journalctl`; the server has tz data for `Europe/Bratislava`.
- `tests/manualne.md` already exists (created during T-003 testing). Extend it, do not overwrite it.
- From T-003 testing: uvicorn trusts `X-Forwarded-For` from loopback, so the per-IP join limit follows that header. The Caddy config must set (overwrite) `X-Forwarded-For` with the real client IP, and uvicorn must stay bound to `127.0.0.1`.
- From T-003 review: do not add a root handler via a uvicorn `--log-config`, or app log lines print twice.

---
## Dev log

**Done (developer, round 1).**

- `deploy/chata.service`: own user `chata`, `WorkingDirectory=/opt/chrapa-poll`, `EnvironmentFile=/opt/chrapa-poll/.env`, the exact `ExecStart` from the task with uv by absolute path (`/home/chata/.local/bin/uv`), `Restart=on-failure`, `ProtectSystem=strict` + `ReadWritePaths=/opt/chrapa-poll/data` (+ `ProtectHome=read-only`, `PrivateTmp`, `NoNewPrivileges`).
- `deploy/Caddyfile`: HTTPS site with `reverse_proxy 127.0.0.1:8010`, `header_up X-Forwarded-For {remote_host}` (overwrite), sub-path example and the nginx equivalent in comments.
- `README.md` (English): install with uv, `.env` and `SECRET_KEY`, local run with `--env-file`, tests, systemd + Caddy deploy (`--workers 1` and the proxy-headers reason explained), data layout, backup, restore, hand fix with the service stopped, editing `chata.yaml`, reading `audit.yaml`, open decisions with defaults, pointer to `tasks/QUESTIONS.md`. No admin, no phase 2.
- `tests/manualne.md`: rewritten (not duplicated) from the tester sections of T-003..T-007 plus the T-008 items into 8 themed sections and a short "Decisions to confirm". Admin items left out. The old "textarea uses 14 px" item became "no zoom on focus" since it is fixed now.
- Frontend follow-ups (`static/index.html`): (1) `.pform input/select/textarea/.summary-text` now `font-size: 16px` and `.summary-text` was 14 px, now 16 px (the code field was already 20 px). (2) An empty name now gives `{code: "invalid", params: {field: "name", reason: "name_empty"}}` from `checkPartyPayload`, and `errorText` maps reasons through a new `REASON_TEXTS` table (`leave_not_after_arrive`, `name_empty`) to „Napíš meno partie.“. A too long name still gets „Skontroluj pole „meno“.“. The server never sends `name_empty` (the pre-check catches an empty or whitespace-only name first), so server texts are unchanged.
- Tests (`tests/js/logic.test.mjs`): new "an empty party name gets its own Slovak text..." and "form inputs and the summary textarea are at least 16 px".

**Checked while writing the unit.** On a temp copy of the project with everything read-only except `data/` (emulating `ProtectSystem=strict`), `uv run --frozen uvicorn ...` fails by default: `uv run` tries to rebuild the editable project (writes `chrapa_poll.egg-info`) and to lock a cache dir. With `UV_NO_SYNC=1` and a writable `UV_CACHE_DIR` it starts, serves `/api/health` and creates `data/`. So the unit sets `UV_NO_SYNC=1`, `UV_CACHE_DIR=/tmp/uv-cache` (private `/tmp`) and `UV_PYTHON_DOWNLOADS=never`, and the README says to run `uv sync --frozen --no-dev` after every code update. The ExecStart line stays exactly as in the criterion. The temp copy and the test uvicorn (port 18011) were removed and killed. I could not run systemd itself on this Mac, so the unit is untested under real systemd (the manual checklist covers the clean-server deploy).

**Facts the README relies on (read from code).** The app creates a fresh data file only when it is missing; an existing empty file stops the start ("delete it to start with a fresh one"), the README says so. Backups are named `chata-data-<UTC>-v<old version>.yaml`, so audit `version: N` matches backup `vN-1`. `data/` must exist before the first start under the unit (systemd cannot bind-mount a missing `ReadWritePaths`), the README creates it. `dotenv` (a transitive dependency of `dotenv>=0.9.9` in `pyproject.toml`) pulls in `python-dotenv`, so `--env-file` works with no change to dependencies.

**Commands and results.**
- `uv run pytest -q`: 379 passed.
- `node --test tests/js/`: 88 passed, 0 failed.

**Follow-ups / notes (not done, outside scope).**
- `pyproject.toml` lists the PyPI package `dotenv` rather than `python-dotenv` directly; it works through the transitive dependency, but a direct `python-dotenv` dependency would be cleaner.
- `.env.example` suggests `python -c ...` for `SECRET_KEY`; the README uses `uv run python -c ...`.

**Acceptance criteria.** Ticked below where verified by reading, test or the read-only uvicorn run. The clean-server deploy under real systemd and Caddy is not run here (manual checklist, section 1).

## Change request (orchestrator, round 2 of development)
Organizer asked for Docker instead of systemd. Criteria above were rewritten for Docker; the systemd parts of the round-1 dev log are superseded. Remove `deploy/chata.service` and the `UV_*` workaround; adapt README section 4 and the checklist's deploy items to Docker.

**Round 2 (developer): Docker instead of systemd.** The round-1 entry above describing `deploy/chata.service` and the `UV_*` variables is superseded: the unit is deleted and the `UV_*` workaround is gone (the runtime image has no uv and starts the venv's uvicorn directly).

- `Dockerfile`: two stages on `python:3.12-slim`. Build stage copies uv from `ghcr.io/astral-sh/uv`, copies `pyproject.toml`, `uv.lock` and `.python-version` first and runs `uv sync --frozen --no-dev --no-install-project` (cached layer; the app is not installed as a package, it runs from `/app`). Runtime stage has no uv, user `chata` (UID 1000), `PYTHONDONTWRITEBYTECODE=1` (bytecode is compiled at build time), copies only `app/`, `static/`, `config/`, `HEALTHCHECK` with `urllib` on `/api/health`, and `CMD uvicorn app.main:app --host 0.0.0.0 --port 8010 --workers 1 --proxy-headers --forwarded-allow-ips=*` with a comment explaining why `*` is safe only with the loopback-only port.
- `.dockerignore`: `.env*`, `data/`, `files/`, `tests/`, `tasks/`, `.git/`, `.venv/`, docs and deploy files.
- `compose.yaml`: one service, `127.0.0.1:8010:8010`, `env_file: .env`, `./data` rw and `./config` ro, `restart: unless-stopped`, `read_only: true`, `tmpfs: /tmp`, `no-new-privileges`, and `user: "${CHATA_UID:-1000}:${CHATA_GID:-1000}"` so the mounted `./data` is writable (README: `mkdir data && chown 1000:1000 data`, or set `CHATA_UID`/`CHATA_GID`).
- `deploy/Caddyfile`: only the comment changed (still `reverse_proxy 127.0.0.1:8010`, overwrites `X-Forwarded-For`, nginx equivalent in comments). `deploy/chata.service` removed.
- `README.md`: section 4 is now "Deploy with Docker and Caddy" (clone, `.env`, `data/` and its owner, `docker compose up -d --build`, update = `git pull` + rebuild, `--workers 1` and the proxy-headers/`*` reason, never publish `8010:8010`). Backup, restore, hand fix, layout edit now use `docker compose stop/start/restart/logs`. Section 1 says it is for development. Also documented: a plain `docker compose restart` does not re-read `.env` (use `up -d`), and a broken data file makes the container restart in a loop until fixed.
- `tests/manualne.md`: deploy, secrets, corrupt file, restart, timezone, restore, code-change and log items now speak Docker. The non-Docker items are unchanged.
- Round-1 frontend follow-ups, tests and checklist content are unchanged.

**It really works here (Docker 28.0.1 / Compose 2.33.1, Docker Desktop started for the test).** Ran on a temp copy of the project (temp `.env` with test secrets, temp empty `data/`, project name `chata-t008-test`, image `chata-t008-test`) with a temporary `compose.override.yaml` mapping the host port to `127.0.0.1:18010`. The committed `compose.yaml` was checked separately with `docker compose -f compose.yaml config`: it publishes `127.0.0.1:8010`. Results:
- `docker compose up -d --build` builds (image 234 MB) and the container becomes `healthy`.
- `GET /api/health` gives `{"ok":true}`, `GET /` gives 200 `text/html`.
- Join with the test group code gives 200 and the `chata_group` cookie, a wrong code gives 401. `POST /api/parties` and `POST /api/assign` succeed; `data/` got `chata-data.yaml`, `audit.yaml` (one document per write) and `backups/` (one per write).
- 404 for `/data/chata-data.yaml`, `/data/audit.yaml`, `/.env`, `/config/app.yaml`, `/files/mapa-nahlad.html` and `/static/../.env`.
- Inside the container: uid 1000 (non-root), writing to `/app` and `/app/config` fails (read-only), `/app/data` and `/tmp` are writable, `Europe/Bratislava` loads, `/app` holds only `.venv`, `app`, `config`, `static` (no `.env`, tests, tasks, files, uv).
- The per-IP join limit follows `X-Forwarded-For` behind the published port: 11 wrong codes as 9.9.9.9 gave 429 for 9.9.9.9 and 200 for 8.8.8.8 (the logs show the real IPs).
- `docker compose restart` keeps the data (version and sleeping places unchanged, the cookie still works).
- A corrupted `data/chata-data.yaml` makes the container exit with code 1 and `docker compose logs` shows `StartupError: /app/data/chata-data.yaml: invalid YAML at line 3, column 8: ...` in English (with `restart: unless-stopped` Docker keeps retrying, as documented). After restoring a valid file it started again.
- Cleanup done: containers, network, image and the temp directory removed, no `chata-t008` container, image or network left. The base images (`python:3.12-slim`, the uv image) stay in the local Docker cache. Docker Desktop was started by me and is still running. I did not touch the real `data/`, `.env` or the user's uvicorn on port 8010.

Side findings: the app writes `chata-data.yaml` with mode 0600, so a backup copied by root must be `chown`ed to the container UID (the README says so). `uv run`'s read-only problems from round 1 no longer exist.

**Commands.** `uv run pytest -q`: 379 passed. `node --test tests/js/`: 88 passed. Not verified here: behind real Caddy with HTTPS (manual checklist section 1).

## Change request 2 (organizer, 22. 10. 2026)
`.env` makes no sense in Docker; it is for local development. Remove `env_file: .env` from `compose.yaml` and pass the secrets as environment variables (`environment:` with `${VAR:?...}`). README: section 1 (local dev) keeps `.env` + `--env-file`; section 4 (Docker) explains passing the variables without `.env` and how to rotate them (`docker compose up -d` recreates the container). Adapt the compose header comment, the `CHATA_UID` comment, the checklist and the README notes about `.env` and restart. Note in the README that `docker compose` itself would auto-read a `.env` next to `compose.yaml` for interpolation, so on the server there should be none. Re-run the Docker check with the secrets passed as env vars.

**Round 3 (developer): no `.env` in Docker (change request 2).**

- `compose.yaml`: `env_file: .env` removed. `GROUP_CODE`, `ADMIN_CODE`, `SECRET_KEY` come from `environment:` with `${VAR:?set VAR (...)}`, so compose refuses to run without them. Header and `CHATA_UID` comments rewritten (the UID variables now go "next to the secrets").
- `README.md`: section 2 and 3 say `.env` is for local development only (unchanged `--env-file .env` run). Section 4 step 2 explains supplying the variables without `.env` (export, platform secrets, or a root-only file outside the project such as `/etc/chata/secrets.env` passed with `docker compose --env-file`), warns that compose auto-reads a `.env` next to `compose.yaml` for interpolation so none should be on the server, and step 4 explains rotating (`docker compose up -d`, a plain `restart` does not pick up new values).
- `tests/manualne.md`: clean-server, secrets and code-change items adapted (secrets via the environment, no `.env` on the server or in the image).
- `Dockerfile`, `.dockerignore` unchanged (the `.dockerignore` still keeps any stray `.env` out of the image).

**Docker re-check, secrets passed as environment variables, no `.env` anywhere** (temp copy without `.env`, empty temp `data/`, project `chata-t008-test`, temporary override mapping to `127.0.0.1:18010`):
- With no variables, `docker compose config` fails with `required variable GROUP_CODE is missing a value: set GROUP_CODE (...)`.
- With the three variables exported: build and start OK, `healthy`; `/api/health` OK; `/` 200; `printenv`-style inspect shows the three variables set; `/app` has no `.env`.
- Join 200 (wrong code 401), party create and assign succeed, `data/` got the data file, `audit.yaml` and `backups/`; `/data/...`, `/.env`, `/config/app.yaml`, `/static/../.env` all 404.
- `docker compose restart` keeps the data and the cookie works.
- Rotation: after changing `GROUP_CODE` in the shell, a plain `restart` still accepted the old code (200); after `docker compose up -d` the old code gave 401, the new one 200 and the old cookie 401. This is what the README says.
- Corrupt data file: exit code 1, English `StartupError` in `docker compose logs`.
- `docker compose ps` and `logs` work even without the variables set. `--env-file /tmp/.../secrets.env` (file outside the project) works for `up`/`down`, and I confirmed with `docker compose config` that `--env-file` replaces a project `.env` for interpolation (so the README statement is true).
- Cleaned up: containers, network, image, the temp project and the temp secrets file are removed; no `chata-t008` leftovers. Real `data/`, `.env` and the user's uvicorn untouched. Docker Desktop is still running.

**Commands.** `uv run pytest -q`: 379 passed. `node --test tests/js/`: 88 passed.

## Review round 1
(reviewer appends)

**Reviewer, round 1 (22. 10. 2026), against the current criteria (Docker, no `.env` in Docker).** Earlier reviews were cancelled after the organizer's two change requests, so this is the first full round.

**Verified myself:**
- `uv run pytest -q`: 379 passed. `node --test tests/js/`: 88 passed, 0 failed.
- `docker compose config` on a copy without `.env` and without the variables fails with `required variable GROUP_CODE is missing a value: set GROUP_CODE (...)`. With them it publishes `host_ip: 127.0.0.1` only, `user: 1000:1000`, `read_only: true`, `./config` read-only, no `env_file`.
- Built and ran the stack on a temp copy (project `t008rev`, override to `127.0.0.1:18077`, secrets exported in the shell, empty temp `data/`): `healthy`; `/api/health` OK; `/` 200; join 200, wrong code 401; `POST /api/parties` OK; `data/` got `chata-data.yaml` (0600), `audit.yaml`, `backups/…-v000000.yaml`; timestamps in `+02:00` (Europe/Bratislava works without system tzdata needed by the app). 404 for `/data/chata-data.yaml`, `/.env`, `/config/app.yaml`, `/files/…`, `/Dockerfile`, `/compose.yaml`, `/static/../.env` (`--path-as-is`). Inside: uid 1000, `/app` and `/app/config` read-only, `/app/data` writable, no uv, `/app` holds only `.venv`, `app`, `config`, `data`, `static`. Restart kept the data. A corrupt data file gives exit code 1 and the English `StartupError … invalid YAML at line 3, column 8` in `docker compose logs`, with restart looping as the README says. 11 wrong codes with `X-Forwarded-For: 9.9.9.9` gave 429 while `8.8.8.8` still joined, and the log shows the real IP. `stop`, `start`, `restart`, `ps` work without the secret variables. Everything removed afterwards (container, network, image, temp dir, cookie jar); real `data/` and `.env` untouched.
- `--forwarded-allow-ips=*` is acceptable here: uvicorn with `*` takes the leftmost `X-Forwarded-For` entry, so it is only safe if the proxy overwrites the header. The Caddyfile does (`header_up X-Forwarded-For {remote_host}`) and the nginx comment uses `$remote_addr`, not `$proxy_add_x_forwarded_for`. The port is published on host loopback only, and both the Dockerfile and compose comments warn against `8010:8010`.
- README facts checked against the code: secret checks (missing, `SECRET_KEY` < 32, equal codes) in `load_settings`; changing a code or `SECRET_KEY` logs people out (cookie salt includes a hash of the code); the store re-reads the file on every request; backup name `chata-data-<UTC>-v%06d.yaml` with the old version; audit fields and the `mapa`/`formular` sources; the test for `/data/...` and `/.env` 404 exists (`tests/test_api_access.py`); `/docs` and `/openapi.json` are disabled; cookie path `/` (sub-path works). Open decisions table matches „Otvorené rozhodnutia“, no admin or phase-2 features documented as available, `tasks/QUESTIONS.md` linked.
- Frontend follow-ups: inputs, selects, textarea and `.summary-text` are 16 px; `name_empty` is a page-only reason mapped through `REASON_TEXTS` to „Napíš meno partie.“, still via `textContent` paths, with tests. The server sends no new text.
- `tests/manualne.md` has an item for each listed criterion plus the T-002 items (writable `data/`, restore drill, corrupt file in the logs, timezone). It was extended, not replaced.

**Blockers:** none.

**Suggestions:**
1. `.dockerignore` patterns such as `__pycache__/`, `*.pyc`, `.DS_Store` match only the context root. I rebuilt with an `app/__pycache__/junk.pyc` and a `static/.DS_Store`: both ended up in the image. Nothing secret leaks, but use `**/__pycache__/`, `**/*.pyc`, `**/.DS_Store` (and maybe `**/.env`) so the image stays clean when built from a working copy.
2. `Dockerfile:5` uses `ghcr.io/astral-sh/uv:latest`. Pin a version (for example `uv:0.9`) so a rebuild after `git pull` does not change the build tool silently.
3. Older Docker Engines on Linux (before 28.0) let hosts on the same L2 segment reach ports published on `127.0.0.1`. With `--forwarded-allow-ips=*` such a host could fake `X-Forwarded-For` and get around the wrong-code limit (it still needs the code for a cookie). A single README line, "use Docker Engine 28 or newer", would cover it.
4. Out of scope, for a follow-up: `app/main.py:97` startup error still says "load .env via systemd EnvironmentFile=", which no longer exists. And the orchestrator's edit to `proposal.md` (Fáza 1 criterion) still says „vyplní `.env`“ for the Docker deploy, which contradicts change request 2 (secrets as environment variables).
5. README step 2 lists `restart` among the commands that need the variables. `stop`, `start` and `restart` work without them, only `up`, `down`, `config` (and `--build`) need them. That is harmless but could be stated more precisely.

**Nits:**
- README section 1 comments `uv sync --frozen --no-dev` as "production", but production is now the Docker image. "runtime dependencies only" alone would be clearer.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2
(reviewer appends)

## Test report
**Tester, 22. 10. 2026. Result: PASS (no failures).**

**Automated.** `uv run pytest -q`: 379 passed. `node --test tests/js/`: 88 passed, 0 failed. No tests added.

**Docker (real run, Docker 28.0.1, Compose 2.33.1).** Temp copy of the project in `/tmp/t008.*` (no `.env`, no `data/`, with planted `app/__pycache__/junk.pyc` and `static/.DS_Store`), project `chata-t008-test`, image `chata-t008-test`, `compose.override.yaml` mapping the host port to `127.0.0.1:18010`, secrets only as shell env vars, empty temp `data/` created with `mkdir -p data` as the README says.
- `docker compose up` with no variables: refused with `required variable ADMIN_CODE is missing a value: set ADMIN_CODE (...)`.
- `up -d --build`: built (image 234 MB), container `healthy`. `/api/health` `{"ok":true}`, `/` 200 `text/html`. Join 200 with the cookie, wrong code 401. `POST /api/parties` and `/api/assign` succeed. `data/` got `chata-data.yaml` (0600), `audit.yaml` and `backups/` (one file per write).
- 404 for `/data/chata-data.yaml`, `/data/audit.yaml`, `/.env`, `/config/app.yaml`, `/files/mapa-nahlad.html`, `/Dockerfile`, `/compose.yaml`, `/static/../.env` (`--path-as-is`), `/app/data/chata-data.yaml`, `/static/.DS_Store`.
- Image contents: `/app` holds only `.venv`, `app`, `config`, `static`. No `__pycache__`, `*.pyc` or `.DS_Store` under `/app` outside `.venv` (the planted junk files did NOT get in: `**/` patterns work; `.venv` has 418 build-time `.pyc` files, intended). No uv binary in the runtime image, no `.env`. `Config.User` = `chata`, runtime uid 1000, `HEALTHCHECK` uses Python `urllib`. uv is pinned: `ghcr.io/astral-sh/uv:0.13.5`.
- Inside the container: `/app` and `/app/config` read-only, `/app/data` and `/tmp` writable, `Europe/Bratislava` loads, the three variables set via the environment.
- Rate limit follows `X-Forwarded-For`: 11th wrong code as 9.9.9.9 gave 429, 8.8.8.8 still joined 200.
- `docker compose restart` keeps the data (version 2 and the booked slot unchanged).
- Rotation as the README says: after exporting a new `GROUP_CODE`, a plain `restart` still accepts the old code (200); after `up -d` the old code gives 401, the new 200 and the old cookie 401.
- `ps`, `stop`, `start` work with no variables set. `--env-file /tmp/secrets.env` (outside the project, shell vars unset) works for `up -d`.
- Corrupt `data/chata-data.yaml`: container in `Restarting (1)`, `docker compose logs` shows `app.store.StartupError: /app/data/chata-data.yaml: invalid YAML at line 3, column 6: ...` (English). After restoring the file it came back `healthy`.
- Cleanup: containers, network, image, temp dir and temp files removed, no `t008` leftovers. Real `data/`, `.env` and the user's processes untouched (nothing was listening on 8010 here).

**Headless browser (preview browser against the container, viewport 380 px).** All `.pform` controls (`pf-name`, `pf-adults`, `pf-kids`, `pf-kids_in_parents_bed`, both selects, `pf-arrival_time`, `pf-note` textarea) compute to `font-size: 16px`. The code input is 20 px. The summary textarea (`.summary-text`, „Prehľad na poslanie“) is 16 px. Submitting a whitespace-only name shows „Napíš meno partie.“ under the name field. A wrong group code shows „Kód nesedí, skús ho zadať znova.“.

| Acceptance criterion | Result |
| --- | --- |
| Dockerfile: python 3.12 slim, uv from official image (pinned), `uv sync --frozen --no-dev`, lock files before code | pass |
| non-root user, venv uvicorn started directly, `--workers 1 --proxy-headers --forwarded-allow-ips=*` with explanatory comment | pass |
| image has no `.env`, `data/`, `files/`, `tests/`, `tasks/`, `.git`, no `__pycache__`/`.DS_Store` | pass |
| `HEALTHCHECK` on `/api/health` via urllib | pass (`healthy`) |
| compose: only `127.0.0.1:8010:8010`, no `env_file`, `${VAR:?...}` for the three secrets, `./data` rw, `./config` ro, `restart`, `read_only` + tmpfs, data writable | pass (the committed port mapping checked in the file; the run used the override) |
| real run: health, `/`, join, write, data file, 404s, restart keeps data, corrupt file visible in logs, cleanup | pass |
| Caddyfile: HTTPS site, `reverse_proxy 127.0.0.1:8010`, overwrites `X-Forwarded-For`, nginx comment | pass (read; real Caddy is a manual item) |
| README (English) covers all listed topics, open decisions and `tasks/QUESTIONS.md` | pass |
| `tests/manualne.md` has an item for each listed criterion plus the T-002 items | pass (55 items) |
| Frontend follow-ups: inputs and textarea >= 16 px, „Napíš meno partie.“ | pass |
| Regressions (T-001..T-007 tests) | pass (379 + 88 tests) |

**Newcomer notes on the README (not failures, small wording issues for a later pass).**
1. Section 4 step 2 suggests a root-only (`chmod 600`, owned by root) `/etc/chata/secrets.env` and then plain `docker compose --env-file /etc/chata/secrets.env ...`. A normal user in the `docker` group cannot read that file, so the commands need `sudo` (or the file must be owned by the deploying user). The README does not say it.
2. `sudo chown 1000:1000 data` is the right thing on Linux. Docker Desktop on macOS is not a target, so no issue there. Nothing wrong, just confirming that the first `up` worked with a self-created `data/`.
3. The container's primary group is 999 while compose runs it as `1000:1000`. Harmless, files in `data/` are owned by 1000:1000 as documented.

