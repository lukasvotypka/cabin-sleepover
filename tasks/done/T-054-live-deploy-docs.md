# T-054: Live updates: proxy config, README, manual checklist

- **Phase:** 1
- **Depends on:** T-052, T-053
- **Size:** S

## Goal
Make the SSE stream work behind the production proxies and document it. See proposal "Bezpečnosť a limity" (HTTPS), "Zmeny naživo", "Akceptačné kritériá" (change visible in about a second).

## Scope
- `deploy/Caddyfile`, `compose.yaml` (`stop_grace_period` only if needed), `README.md`, `tests/manual.md`

## Acceptance criteria
- [x] `deploy/Caddyfile`: a comment that Caddy flushes `text/event-stream` at once and that `encode` (compression) must not apply to `/api/events` if someone adds it; the nginx example gets a `location /api/events` with `proxy_buffering off;` and `proxy_read_timeout 1h;` (plus the same headers as `/`). The sub-path example stays valid.
- [x] `README.md` (English): a short "Live updates" part: `/api/events`, polling fallback, one worker is required, proxy notes, Tailscale serve works as is, how shutdown is handled (the T-052 choice), and that `docker compose stop` does not hang.
- [x] `tests/manual.md`: "within 30 s" and "after the next poll" wording replaced by the live behaviour where it changed; new checks: two phones, a change shows within about 1 s; lock and unlock phone B (it reconnects and shows changes made meanwhile); airplane mode on/off (age text shows, then the online row returns); restart the trial server (pages reconnect by themselves); online chip appears within about 1 s of opening and disappears within about 1 s of closing the tab; production proxy check (`curl -N` with the cookie shows `event: state` at once and `event: ping` every 20 s).
- [x] The Dev log lists, for the orchestrator, the CLAUDE.md edits needed: "Frontend behaviour" polling line → SSE with fallback; API conventions line on `ETag`/presence and the new `/api/events`; "Planned architecture" gets `app/events.py` and the hub in process memory; the trial-server command if T-052 changed how uvicorn must start.

## Notes for developer
- Docs only plus proxy examples; no app code. No Slovak in README or comments (Slovak only when quoting UI text).
- Do not touch production or run `docker compose` against it.

---
## Dev log
Docs only, no app code, no tests needed (nothing run against production). Verified event names (`state`, `presence`, `ping`, 20 s) against `app/events.py`.
- `deploy/Caddyfile`: Caddy flush comment plus the `encode` exclusion example; nginx `location /api/events` (`proxy_buffering off;`, `proxy_read_timeout 1h;`, same headers). Sub-path example untouched.
- `README.md`: new "Live updates" part before section 5.
- `tests/manual.md`: fixed the joined line (T-053 item and the restart item were on one line, now split); "within 30 s" item rewritten as live with polling fallback; shortened-stay, all-nights and zoom items no longer say "next poll" / "30 s refresh"; T-050 line now says about a second and about 50 s (was 90 s); restart item reworded for trial server; added online-chip-live and production `curl -N` checks; lock/unlock phone B merged into the T-052 item. Two phones / airplane mode were already covered by T-052/T-053 items, not duplicated.
- `compose.yaml` untouched: the Dockerfile `--timeout-graceful-shutdown 3` already makes stop fast.

CLAUDE.md edits needed (orchestrator):
1. Frontend behaviour: polling line -> "Live updates over SSE (`/api/events`, EventSource) with fallback polling of `/api/state` every 30 s; on tab return and after every write the state is refreshed".
2. API conventions: add `GET /api/events` (group cookie, `state`/`presence`/`ping` frames, 20 s ping); note `ETag` still serves the fallback poll and presence comes from open streams.
3. Planned architecture: add `app/events.py` (event hub in process memory, another reason for one worker).
4. Trial-server command: `timeout_graceful_shutdown=3` (already done by orchestrator); uvicorn CLI flag `--timeout-graceful-shutdown 3` is in the Dockerfile.

## Review round 1

Tests: `uv run pytest` 535 passed, `node --test tests/js/` 294 passed (docs-only change, run as a sanity check). Event names, 20 s ping, `--timeout-graceful-shutdown 3` in the Dockerfile and `hub.close()` in the lifespan checked against the code; README and Caddyfile match them. The nginx block and the `encode` exclusion example are correct, and the sub-path example still works.

**Blocker**
- `tests/manual.md:46` ("Restart with open streams (T-052)"): the old text was left glued after the new text: `... without a reload. (T-052):** with two phones connected, run \`docker compose restart\`: the restart finishes within about 5 s (not hung), the phones reconnect by themselves after the server is up and show the current state.` This repeats the item and leaves a stray `**`, which breaks the bold markup for the rest of the line. Fix: delete everything after `without a reload.` on that line.

**Suggestion**
- README "Shutdown": uvicorn waits for open requests *before* the lifespan shutdown (see the Dockerfile comment), so streams end because of the 3 s timeout, and `hub.close()` runs only after that. The README wording suggests the lifespan closes them first. Something like "uvicorn cancels open streams after 3 s (`--timeout-graceful-shutdown 3`), then the lifespan closes the hub" would be more exact.

Verdict: CHANGES REQUESTED

## Review round 2

## Test report

## Orchestrator fix after review round 1
Blocker fixed: the duplicated tail of the "Restart with open streams" line in `tests/manual.md` is removed. Suggestion applied: the README "Shutdown" bullet now gives the real order (uvicorn waits up to 3 s, cancels the streams, then the lifespan closes the hub).

Tester (Haiku 5.5), 25. 10. 2026. Docs-only task, no tests added.

**Commands and results**
- `uv run pytest -q`: 535 passed.
- `node --test tests/js/`: 294 pass, 0 fail (matches the reviewer's count).
- `nginx -t` on a temp copy: the nginx example in `deploy/Caddyfile` (the `server` block with `location /` and `location /api/events`, comment markers stripped, a self-signed cert in a temp dir, `http {}` wrapper with temp paths) reports `syntax is ok` and `test is successful`. Temp dir removed.
- `caddy adapt`: not run, Caddy is not installed locally. The Caddyfile is reviewed by hand only.

**Acceptance criteria**

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Caddyfile: flush and `encode` comment, nginx `location /api/events` with `proxy_buffering off;`, `proxy_read_timeout 1h;`, same headers; sub-path example still valid | pass (nginx validated; Caddy by review only) |
| 2 | README "Live updates": endpoint, polling fallback, one worker, proxy notes, Tailscale serve, shutdown order, `compose stop` does not hang | pass (names, 20 s ping, `--timeout-graceful-shutdown 3` in Dockerfile, `hub.close()` after it in the lifespan, `text/event-stream`, 30 s poll `POLL_MS`, `/data` and `/.env` 404 test exist) |
| 3 | `tests/manual.md`: live wording, new checks (two phones ~1 s, lock/unlock B, airplane mode, restart, online chip, production `curl -N`) | pass (checked by reading the file; markup fixed: the reviewer's stray `**` is gone, all bold markers paired) |
| 4 | Dev log lists CLAUDE.md edits (polling line, API conventions, `app/events.py`, trial-server flag) | pass (4 items present; CLAUDE.md diff already contains the edits) |

**Extra checks**
- Event names `state`, `presence`, `ping` and the 20 s ping against `app/events.py`: match.
- Stream response headers in `app/main.py`: `text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`. The app already asks nginx not to buffer, so the nginx `proxy_buffering off` is a second safety net. Not a defect; the README could mention it.
- No Slovak in README (only quoted UI text), no `docker compose` or production contact.

**Not verifiable here (already in `tests/manual.md`)**
- Caddy flushing the stream in production, `docker compose stop/restart` timing (about 5 s), the production `curl -N` check, two-phone live timing (about 1 s), lock/unlock and airplane mode on real phones.

**Verdict:** all criteria pass, no regressions. Moved to `tasks/done/`. Not committed.
