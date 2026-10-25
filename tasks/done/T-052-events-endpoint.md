# T-052: `GET /api/events`, broadcast on commit, presence by connection, shutdown

- **Phase:** 1
- **Depends on:** T-051
- **Size:** M

## Goal
Expose the hub from T-051 as `GET /api/events`, broadcast every committed write, make "online" follow open connections, and make sure open streams never block a server stop. See proposal "Zmeny naživo (`/api/events`)", "HTTP API" (endpoint table), "Dáta v YAML" (`data/seen.yaml`).

## Scope
- `app/main.py` (route, hub in `Runtime`, lifespan, presence), `app/store.py` (after-commit hook), `app/seen.py` (presence by connection), `Dockerfile` (only if the shutdown fix needs a uvicorn flag)
- New `tests/test_api_events.py`; `tests/test_seen.py` as needed

## Acceptance criteria
- [x] `GET /api/events?party=<id>&client=<id>` without a valid group cookie returns `401 bad_code` JSON (no stream). `client` and `party` get the same trimming, length cap and validation as `X-Client-Id` / `X-Party-Id`; an unknown or malformed party opens the stream without presence (no error).
- [x] With the cookie: `200`, `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, no compression; first event is `state` with exactly the shape of `/api/state`'s `state` (incl. `presence`, already listing the connecting party as online).
- [x] Over the caps: `429 rate_limited` JSON. Opening streams never touches the 30 writes/min limiter.
- [x] The broadcast is called from the store commit path, after the atomic write (one hook in `Store`, not per endpoint). Every write endpoint therefore broadcasts; a skipped write (e.g. `clear` on a free slot) does not.
- [x] Presence: `online` = parties with ≥1 open stream ∪ parties seen in the last 75 s (polling fallback). `last_seen` is updated on connect, on every ping and on disconnect; `seen.yaml` persistence keeps the T-049 throttle. A `presence` event (no version bump, no backup, no audit) goes out when the online set changes, including when a polling party ages out of the 75 s window (checked at least every ping interval). The `/api/state` ETag stays correct with the new online set.
- [x] `GET /api/state` (ETag/304) is otherwise unchanged; existing tests pass unchanged.
- [x] Shutdown: a uvicorn process started like the Dockerfile `CMD` (and like the trial command in CLAUDE.md) with two open streams exits within 5 s of SIGTERM, and the streams end. App shutdown (lifespan) also closes the hub.
- [x] `tests/test_api_events.py`: hub/generator-level tests for broadcast after a real write through the app (ASGI client for the write, hub read directly), presence on connect/disconnect and window expiry (injected clock); and one integration test that starts uvicorn on a free port in a background thread or subprocess (never 8000/8010), reads the initial `state` with a streaming httpx client, does a write and receives the broadcast `state`, gets `401` without cookie and `429` over the cap, and checks the SIGTERM criterion. `uv run pytest` passes.

## Notes for developer
- httpx `ASGITransport` buffers the whole response, so an endless stream cannot be read through it. Test the generator directly; use real uvicorn only for the integration test, with a short timeout on every read.
- **Pitfall (uvicorn 0.54):** on SIGTERM uvicorn first waits for open requests and only then runs lifespan shutdown, so closing the hub in lifespan alone never happens while a stream is open. Options: `--timeout-graceful-shutdown` (then tasks are cancelled and `finally` runs), or hooking the exit signal. Pick one, explain it in the Dev log, and list any command-line change for the orchestrator (Dockerfile `CMD`, CLAUDE.md trial command). See `tasks/QUESTIONS.md` Q15.
- Starlette's `StreamingResponse` cancels the generator on client disconnect; cleanup must sit in `finally`.
- `require_group` is sync and runs in the thread pool, while stream presence runs on the event loop: keep `SeenTracker`'s `threading.Lock` (the default) and say so in a docstring.
- Do not read `cabin-data.yaml` from disk once per connection per ping; reuse the state from the commit or cache party ids by `version`.
- English only on the server. CLAUDE.md is orchestrator-owned: note needed changes in the Dev log.

---
## Dev log

- `GET /api/events` in `app/main.py`: `require_group` (401 JSON without cookie), `party`/`client` query params go through `clean_id` (trim, 64-char cap, same as `X-Client-Id`; `require_group` uses it for `X-Party-Id` too). Unknown party gives a stream without presence. Hub refusal gives `429 rate_limited` (does not touch the write limiter). Records last seen on connect and on every ping frame; a `BackgroundTask` releases the connection if the stream never started.
- Broadcast: one `Store.after_commit` hook (called from `_commit` after the atomic write and audit append, errors logged, never raised). The hook refreshes `rt.known_ids` and publishes the state payload. Skipped writes never reach `_commit`.
- Presence: `SeenTracker.connected` (set to `hub.online_parties`) makes `online` = open streams + 75 s window, so `/api/state` and its ETag follow it. Hub `on_online_change` callback (never raises) records last seen of the party that connected or disconnected, then `Runtime.refresh_presence()` sends a `presence` event if the online set changed. A lifespan task checks every `PING_SECONDS` (aging out of the window); `require_group` schedules a check via `call_soon_threadsafe` when a polling party is seen. `SeenTracker` keeps its `threading.Lock` (docstring added). `require_group` now uses cached `rt.known_ids` instead of reading the data file.
- Shutdown (Q15): chose `--timeout-graceful-shutdown 3` (uvicorn cancels the streams after 3 s, `finally` runs, then lifespan closes the hub). Dockerfile `CMD` updated, with a comment. **For the orchestrator:** the CLAUDE.md trial command needs `timeout_graceful_shutdown=3` in `uvicorn.run(...)`, e.g. `uvicorn.run(create_app(data_dir='/tmp/cabin-try/data'), host='127.0.0.1', port=8010, workers=1, timeout_graceful_shutdown=3)`; README/compose docs are T-054.
- Note: after a disconnect the party stays online for the 75 s window (last seen is set to now), as the criteria define it.
- Tests: new `tests/test_api_events.py` (hub-level broadcast/presence/window with fake clock, ETag, plus a real uvicorn subprocess on a free port: headers, state, broadcast, 401, 429, malformed party, SIGTERM with two streams exits within 5 s).
- Commands: `PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH" uv run pytest` -> 534 passed.

## Review round 1

Tests run by the reviewer: `uv run pytest tests/test_api_events.py` 8 passed; `uv run pytest` 534 passed. Route, 401/429, headers, initial `state` with presence, the single `Store.after_commit` hook (after atomic write + audit, errors swallowed), skip-no-broadcast, `clean_id` for `party`/`client`, cached `known_ids`, lifespan watcher + `hub.close()`, release via `BackgroundTask`, and the SIGTERM test all look correct.

**Blocker**

1. Stream presence lags by 75 s after a disconnect (`app/seen.py:157`, `app/main.py` `on_online_change` and the connect/ping `seen.record` calls in `events()`; asserted as intended in `tests/test_api_events.py::test_presence_on_connect_and_disconnect`). All stream activity (connect, every ping, disconnect) writes the same `seen` time that the 75 s window reads, so a party that closes its tab still shows online for up to 75 s (plus up to one 20 s watcher tick). That defeats the purpose of SSE presence: the organizer's complaint was precisely that online status lags. Scenario: phone opens the map, closes it; the other phone still shows the party's chip for ~95 s. Expected fix: keep a separate per-party "polled at" time that only plain (non-stream) requests update, i.e. `require_group` with `X-Party-Id` (GET `/api/state` polling and the other requests). `online` = has an open stream OR polled within 75 s. `last_seen` (for „pred X min“) is still updated by connect, ping and disconnect, and keeps the T-049 persistence throttle. The page boots with one GET `/api/state` before opening the stream, so right after boot a party is "polled"; that is acceptable. Change the test so that a party that only streamed (no plain request) goes offline right on disconnect, with a `presence` event broadcast without advancing the clock, and keep a test showing a polled party still ages out after 75 s.

**Suggestion**

- `events()` sets `conn.presence = None` directly to drop the self-triggered presence frame. It works, but it reaches into the hub's internals; a small hub method or comment in `events.py` would keep that contract in one place.

**Nit**

- `Dockerfile`: the sentence "Do not publish the port on 0.0.0.0, anyone could then fake X-Forwarded-For." was moved to the end of the `--timeout-graceful-shutdown` comment; it belongs with the proxy-headers paragraph.

**For the orchestrator (not a blocker):** the CLAUDE.md trial-server command needs `timeout_graceful_shutdown=3` in `uvicorn.run(...)` (see Dev log), otherwise a restart hangs while a phone has a stream open.

Verdict: CHANGES REQUESTED

## Dev log (fixes for review round 1)

- Blocker: fixed. `SeenTracker` has a separate `polled` time, set only by `record(..., polled=True)` (the default, used by `require_group`). Stream connect, ping and disconnect call `record(..., polled=False)`: they update `seen` (last seen, persistence throttle unchanged) but not `polled`. `online` = open stream or polled within 75 s. A party that only streamed goes offline on disconnect with a `presence` event, no clock advance. `test_presence_on_connect_and_disconnect` changed accordingly; `test_polling_party_enters_and_ages_out` still covers the 75 s aging.
- Suggestion: fixed, new `EventHub.drop_pending_presence(conn)` used by `events()`.
- Nit: fixed, the X-Forwarded-For sentence is back in the proxy-headers paragraph of the Dockerfile.
- Commands: `PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH" uv run pytest` -> 534 passed.

## Review round 2

Tests run by the reviewer: `uv run pytest` 534 passed (incl. `tests/test_api_events.py`).

- Round-1 blocker fixed: `SeenTracker.polled` is set only by `record(..., polled=True)` (default, `require_group`); stream connect, ping and disconnect in `app/main.py` use `polled=False`, so they move `last_seen` (T-049 throttle unchanged) but not the 75 s window. `presence()` gives `online` = open stream or polled within 75 s. `test_presence_on_connect_and_disconnect` now checks offline right after disconnect with a `presence` frame and no clock advance; `test_polling_party_enters_and_ages_out` still covers the 75 s aging.
- Suggestion done (`EventHub.drop_pending_presence`), Dockerfile comment nit done.
- Fresh pass over the fix diff: no new issues. `self.connected()` is called outside the `threading.Lock`, which is right (it reads hub state on the loop and needs no lock).

**For the orchestrator (not a blocker):** the CLAUDE.md trial-server command still needs `timeout_graceful_shutdown=3` in `uvicorn.run(...)`.

Verdict: APPROVED

## Test report

Tester: Haiku 5.5, 2026-10-25. Temporary `data/` only (`/tmp/t052/`), own ports 8765 and 8766, real `data/` and port 8010 not touched. Repo files not changed except `tests/manual.md` (new items, see below).

**Commands and results**
- `PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH" uv run pytest -q` → 534 passed (includes `tests/test_api_events.py`, all earlier tasks in `done/`).
- `node --test tests/js/` → 287 passed, 0 failed.
- HTTP probe script (`/tmp/t052/probe.py`, server with `uvicorn.run(..., timeout_graceful_shutdown=3)`) → 38 of 38 passed.
- Shutdown probe (`/tmp/t052/sigterm.py`, copy of the repo without `data/` and `.env`, started as `uv run uvicorn app.main:app --host 127.0.0.1 --port 8766 --workers 1 --timeout-graceful-shutdown 3`, two open streams, SIGTERM) → server logged "Cancel 1 running task(s), timeout graceful shutdown exceeded", "Application shutdown complete", process exited after 3.2 s; both client streams were cut by the server (incomplete chunked read).

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| `/api/events` without valid cookie → 401 `bad_code` JSON, no stream | PASS | no cookie, garbage cookie, tampered signed cookie all 401 JSON |
| Cookie → 200, `text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, no compression | PASS | headers checked with `Accept-Encoding: gzip`, no `Content-Encoding` |
| Over-long / malformed / whitespace `party` and `client` accepted, no error | PASS | 200 for all four variants (presence-less for unknown party: suite test) |
| First event `state`, same keys as `/api/state` `state`, connecting party in `presence.online` | PASS | key sets equal, party listed online |
| Over caps → 429 `rate_limited` JSON; streams do not use the write limiter | PASS | 5th stream of one client → 429; a write right after still 200 |
| Broadcast from the one commit hook after the write | PASS | observer stream got `state` with version +1 and the new bed; 409 `slot_taken` sent nothing new |
| Skipped write (clear on a free slot) does not broadcast or bump version | PASS | version unchanged; next frame is the next real commit |
| Presence: online = streams ∪ polled within 75 s; `presence` event on change | PASS | stream-only party went offline at once on disconnect (`presence` frame, no clock wait); polling-only party aged out after 89 s via `presence` frame |
| ETag follows the online set | PASS | 304 when unchanged; suite `test_etag_follows_the_online_set` |
| `/api/state` ETag/304 otherwise unchanged; existing tests pass | PASS | 534 passed |
| Shutdown with open streams exits within 5 s, streams end; lifespan closes hub | PASS | 3.2 s exit, streams cut, shutdown complete logged |
| `tests/test_api_events.py` exists and covers hub, presence, window, integration; `uv run pytest` passes | PASS | 534 passed |

**Extra scenarios tried**
- Tampered and garbage group cookie on `/api/events`: 401.
- Four ids-edge variants on the query string (over-long party 301 chars, `p-<script>` with empty client, client 301 chars, whitespace): all 200, no 500.
- Data files over HTTP (`/data/cabin-data.yaml`, `/cabin-data.yaml`, `/data/audit.yaml`, traversal via `/static/../..`): none served.
- Writes after a stream refusal still work.

**Not verified here (manual)**
- Browser EventSource behaviour, iPhone Safari and Android Chrome background/return, real two-device latency, `docker compose restart` with phones connected, and proxy buffering behind Caddy. Added to `tests/manual.md` section 3 as two new items ("Live stream (T-052)" and "Restart with open streams (T-052)").

**Failures:** none.

**For the orchestrator:** the CLAUDE.md trial-server command still needs `timeout_graceful_shutdown=3` in `uvicorn.run(...)` (already noted by the developer); without it a trial restart with an open phone stream may hang.

**Verdict:** PASS, moved to `tasks/done/`.

## Orchestrator note (from T-051 review)
- The presence callback passed to the hub must not raise (catch and log inside it): an exception there would replace the stream's normal end or its cancellation (`app/events.py` cleanup).
- Pings come 20 s after the last frame of a connection, not on a strict 20 s rhythm.
- A connection registered with `connect()` whose stream never starts must be released with `hub.release(conn)`.
