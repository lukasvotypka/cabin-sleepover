# T-051: Event hub for live updates (SSE)

- **Phase:** 1
- **Depends on:** none (T-049 and T-050 are done)
- **Size:** M

## Goal
Organizer's decision of 25. 10. 2026: replace the 30 s polling with Server-Sent Events. This task builds the in-memory hub and the per-connection event generator in a new module, tested without HTTP. See proposal "Zmeny naživo (`/api/events`)", "Architektúra" (Čítanie, Jeden proces je podmienka).

## Scope
- New `app/events.py` (hub, connection, SSE frame formatting, event generator)
- New `tests/test_events.py`

## Acceptance criteria
- [x] `app/events.py` has a hub class that registers connections `(client_id, party_id | None)` and offers sync `publish_state(payload)` and `publish_presence(presence)` (callable from the event loop inside the store commit), an async per-connection generator yielding SSE text frames, and `close()` that ends every generator and refuses new connections.
- [x] Frames: the first frame of a connection is `retry: 3000` followed by `event: state` with the full state JSON the caller passes in; later `event: state`, `event: presence` and `event: ping` (`data: {"server_time": iso}`) every 20 s. Data is one line of `json.dumps(..., ensure_ascii=False, separators=(",", ":"))`, each frame ends with a blank line. No SSE comments.
- [x] Coalescing: each connection holds at most one pending state and one pending presence (latest wins) plus an `asyncio.Event`; no unbounded queue. A test publishes 100 states to a connection that does not read, then reads: it gets exactly one `state` frame, the last one.
- [x] Cleanup runs in `finally`: after the generator ends (close, cancellation, or `aclose()`), the connection is gone from the hub and its counts drop.
- [x] Caps: at most 4 open connections per client id and 200 in total (module constants). Over a cap, registering raises an error the HTTP layer maps to `429 rate_limited`; a closed hub also refuses.
- [x] Presence callbacks: the hub reports "party online by connection" (the set of party ids with ≥1 open connection) and notifies a callback when that set changes (first connection of a party opens, last one closes). Connections without a party do not count.
- [x] Clock and ping interval are injectable, so tests never sleep 20 s.
- [x] `tests/test_events.py` covers: first frame (retry + state), broadcast reaches all connections, coalescing, ping with `server_time`, caps per client and total, presence set and callback on first open / last close (two connections of one party: closing one keeps it online), `close()` ends all generators and refuses new ones, cleanup after cancellation. `uv run pytest` passes.

## Notes for developer
- Defaults from proposal „Otvorené rozhodnutia“ (Zmeny naživo cez SSE): ping 20 s, retry 3000 ms, caps 4 / 200. Module constants, no new `app.yaml` keys.
- Everything here runs on the event loop only (no threads). Build the state JSON once per broadcast, not per connection.
- No Slovak text on the server; error messages and logs in English.
- Wiring into FastAPI, the store and `app/seen.py` is T-052. Keep this module free of FastAPI imports if practical.

---
## Dev log
- Added `app/events.py` (`EventHub`, `Connection`, `HubRefused`, constants) and `tests/test_events.py` (9 tests).
- API for T-052: `hub.connect(client_id, party_id)` registers synchronously (raises `HubRefused` -> map to 429 before the response starts); `hub.stream(conn, initial_state)` is the generator (first yield is `retry: 3000` plus the state frame in one string). `finally` releases the connection. If a generator is never started, call `hub.release(conn)` (idempotent). `on_online_change(set)` is a constructor callback; `online_parties()` gives the set.
- Ping interval and clock are constructor args. Pending state/presence are stored pre-serialized (serialized once per broadcast).
- Run: `uv run pytest tests/test_events.py`, then `uv run pytest` -> 526 passed. Node tests not touched.

## Review round 1
Ran `uv run pytest tests/test_events.py` (9 passed) and `uv run pytest` (526 passed).

All acceptance criteria are met: hub with sync `publish_state`/`publish_presence`, per-connection coalescing (one pending state and one pending presence, pre-serialized once per broadcast), first frame `retry: 3000` + `state`, compact `ensure_ascii=False` JSON on one line, ping with injected clock/interval, caps 4/200 as module constants raising `HubRefused`, presence set + callback only on first-open/last-close, `close()` ends generators and refuses new connections, release in `finally` (idempotent). No FastAPI imports, English only.

Blockers: none.

Suggestion:
- `app/events.py:132`: the ping timer restarts after every wake, so under steady traffic pings come 20 s after the last frame rather than every 20 s. This is fine for keepalive and for the page's 45 s staleness check, but T-052/T-053 should not assume a strict 20 s cadence.
- `app/events.py:104-106`: if `on_online_change` raises inside `release()` (called from the generator's `finally`), the exception replaces a normal end or a cancellation. T-052 should keep the callback non-raising, or wrap it and log.
- T-052 must call `hub.release(conn)` when the response never starts the generator (documented in the Dev log). Without that, a slot under the caps is leaked.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester (25. 10. 2026):

Commands and results:
- `uv run pytest` -> 526 passed (4.5 s), same as the Dev log.
- `uv run pytest tests/test_events.py` -> 9 passed.
- `node --test tests/js/` -> 287 passed, 0 failed (unchanged by this task).
- Ad hoc probe script (temporary, `/tmp/t051/probe.py`, no HTTP, no `data/`):
  - First frame is exactly `retry: 3000\n\nevent: state\ndata: {...}\n\n`, non-ASCII kept (`č`), quotes and newlines escaped in the one-line JSON.
  - Timer ping is `event: ping` with `data: {"server_time": ...}` and a blank-line terminator.
  - A 3-line state payload is still one `data:` line in the frame.
  - `aclose()` leaves `total == 0`, `client_count == 0`, no online parties.
  - Per client cap: the 5th connection of one client raises `HubRefused` ("too many open connections for this client"). Total cap: 200 connections accepted, the 201st refused. Releasing one frees a slot, and a second `release()` is a no-op.
  - `close()` ends a waiting generator with `StopAsyncIteration` (no hang), and the hub ends with 0 connections.
  - 50 presence publishes to a non-reading connection yield one `presence` frame (the last one).
  - One broadcast to 10 connections serializes the state once (`dumps` called 1 time).

Acceptance criteria:

| Criterion | Result |
| --- | --- |
| Hub class: connect `(client_id, party_id)`, sync `publish_state`/`publish_presence`, async per-connection generator, `close()` | pass |
| Frames: `retry: 3000` + state first, later state/presence/ping (`server_time`), compact one-line JSON, blank-line terminator, no SSE comments | pass |
| Coalescing: at most one pending state and presence, 100 publishes give exactly one last `state` frame | pass |
| Cleanup in `finally` on close, cancel and `aclose()`; counts drop | pass |
| Caps 4 per client, 200 total; over cap raises for the HTTP layer; closed hub refuses | pass |
| Presence set and callback on first open / last close; connections without party do not count | pass |
| Clock and ping interval injectable | pass |
| `tests/test_events.py` covers the listed cases; `uv run pytest` passes | pass |

Extra observations (not failures, no bug report needed for this task):
- If `on_online_change` raises inside `connect()`, the exception propagates after the connection was already added to the hub (the connection is leaked until someone calls `release`). The reviewer's note already covers keeping the callback non-raising in T-052; T-052 should wrap the callback or make sure a failed `connect()` still gets released.
- Ping cadence restarts after each wake (reviewer noted this). Not a criterion violation.

Manual checks: none for this task (backend module, no device or deployment step).

Verdict: all criteria pass, no regressions in `tasks/done/` (full pytest and Node suites green). Moved to `tasks/done/`.
