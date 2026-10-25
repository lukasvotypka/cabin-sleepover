# T-049: Record "last seen" per party and send presence in the state

- **Phase:** 1
- **Depends on:** none (all earlier phase 1 tasks are done)
- **Size:** M

## Goal
Organizer's decision of 25. 10. 2026: every party's "last seen" time and who is online are visible to everyone. The existing requests (polling `/api/state`, writes) are the hook; no SSE/WebSocket. See proposal "Dáta v YAML" (`data/seen.yaml`) and "HTTP API" (header `X-Party-Id`, `state.presence`, `GET /api/state` ETag).

## Scope
- New `app/seen.py` (in-memory map, throttled persistence, load at startup), `app/main.py` (record in the group-auth path, `presence` in `state_payload`, ETag), reuse `_atomic_write` from `app/store.py` (make it importable if needed)
- New `tests/test_seen.py`; `README.md` (one line on `data/seen.yaml`)

## Acceptance criteria
- [x] Any request that passes the group cookie check and carries `X-Party-Id` naming an existing party records that party's last seen time (server clock, ISO string with offset). This includes `GET /api/state` answered with `304` and write requests (also rejected ones). Missing header, malformed value or unknown party id: nothing recorded, no error, response unchanged. Requests without a valid group cookie never record.
- [x] Every `state` the server returns (200 of `/api/state`, write success and error bodies) contains `presence: {"server_time": iso, "last_seen": {party_id: iso}, "online": [party_id, …]}`. `online` = parties seen within the last 75 s at response time; `last_seen` and `online` list only parties that exist in the state. A party never seen is absent from `last_seen`. The recording request's own party is already included.
- [x] Recording never changes `version` or `updated_at`, never creates a file in `data/backups/`, never appends to `data/audit.yaml`, and does not count towards the write rate limit.
- [x] `data/seen.yaml` (`{party_id: "iso"}`, quoted strings, `safe_dump(allow_unicode=True, sort_keys=False)`) is written atomically, and for a given party at most once per 60 s (memory always holds the newest time). Unknown party ids are not written.
- [x] Startup: a missing, empty, unparsable or wrongly shaped `seen.yaml` does not stop the server; it starts with empty seen data and logs an English warning. Unknown party ids in the file are dropped.
- [x] ETag of `/api/state` changes when `version` changes (as today) **and** when the presence data the page uses changes: the `online` set, or any party's `last_seen` floored to the minute. With no `X-Party-Id` traffic and no one aging out of the window, repeated polls still get `304`. The chosen scheme is explained in the `state_etag` docstring.
- [x] `tests/test_seen.py` (clock injected, no sleeping) covers: recording via header on 200 and on 304; unknown/malformed party id ignored; no cookie = no record; no version bump, no backup, no audit entry; throttled file writes (second request within 60 s does not rewrite the file, one after 60 s does); online window (74 s online, 76 s not); `server_time` present; ETag changes when a new party comes online and when it drops out, and stays equal (304) when nothing relevant changed; corrupt and missing `seen.yaml` at startup; unknown id in file dropped.
- [x] `uv run pytest` and `node --test tests/js/` pass (existing ETag tests unchanged).

## Notes for developer
- Defaults (proposal „Otvorené rozhodnutia“, Naposledy videná a online): header `X-Party-Id`, 75 s window, 60 s persistence throttle. Module constants in `app/seen.py` are enough; no new `app.yaml` keys.
- Why the ETag floors to the minute: memory holds second-precision times, so a full-precision ETag would change on every poll. The `online` set in the ETag keeps "online" correct within one poll; the page uses the server's `online` list as is (T-050) instead of recomputing it from stale data after a 304.
- Record before computing the ETag and the payload, so the caller's own party is in them.
- A party deleted later (phase 2) or missing from the state must not appear in `presence`; filter at response time.
- Keep the seen file writes off the state lock's critical path for writes, but never write `seen.yaml` and `cabin-data.yaml` with the same temp name. No Slovak text anywhere on the server.
- CLAUDE.md still says "ETag by version"; mention the change in the Dev log so the orchestrator can update it.

---
## Dev log

- Added `app/seen.py` (`SeenTracker`: memory map in epoch seconds, `data/seen.yaml` via `_atomic_write`, 60 s per-party persistence throttle, 75 s online window, tolerant load that drops unknown ids and warns). Recording happens in `require_group` (so 304s, rejected writes and every write endpoint are covered, no cookie = no record, no rate-limit use).
- `app/main.py`: `Runtime.seen`, `presence` in `state_payload`, `state_etag(state, config_hash, presence=None)` adds a digest of the online set and last_seen floored to the minute (explained in its docstring); `/api/state` passes presence. Clock is the injected `clock`.
- README: one row for `data/seen.yaml`. Tests: new `tests/test_seen.py` (12 tests); `STATE_KEYS` in `tests/test_api_access.py` now includes `presence`.
- Commands: `uv run pytest` (all pass), `node --test tests/js/` (pass).
- For the orchestrator: CLAUDE.md still says "ETag by version"; update it to mention presence.
- `_atomic_write` is imported as a private name from `app.store` (not renamed).

## Review round 1

Ran `uv run pytest` (513 passed) and `node --test tests/js/` (284 passed). All acceptance criteria are met: recording happens in `require_group` (so it covers 304s, rejected writes and every write endpoint, and needs a valid cookie), `presence` goes through `state_payload` (success and error bodies), it is filtered to existing parties at response time, the 75 s / 60 s constants are in `app/seen.py`, the file goes through `_atomic_write` (its own `.seen.yaml.*` temp prefix), the loader tolerates bad files, and the ETag scheme is explained in the docstring. No Slovak text, no version/audit/backup side effects, and no use of the write limiter.

**Blockers:** none.

**Suggestions:**
- `app/main.py:272` `require_group` is a sync `def`, so FastAPI runs it in the threadpool. `SeenTracker.record` changes `self.seen` there, while `presence()` (event loop) and `_persist` (another worker thread) iterate over it. When a party is recorded for the first time (a new key), an iteration running at the same moment can raise `RuntimeError: dictionary changed size during iteration`, giving a 500, possibly after a write has already committed. This is unlikely (only first-ever records add keys), but a `threading.Lock` in `SeenTracker`, or iterating over `dict(self.seen)` snapshots, would close it.
- `require_group` now calls `rt.store.read()`, which re-reads and re-validates `cabin-data.yaml` from disk on every authenticated request, on top of the read the endpoint already does. That is fine at this scale, but a cheaper set of party ids (for example cached by `version`) would avoid doubling the file I/O.
- `tests/test_seen.py::test_startup_with_bad_files` takes `caplog` but never checks that a warning was logged. The criterion says it "logs an English warning", so add an assertion.
- `to_iso` writes UTC (`+00:00`) while `now_iso` writes local time with its offset. Both are valid ISO with an offset, but using one style would be more consistent.

For the orchestrator: CLAUDE.md "ETag by version" needs updating (as noted in the Dev log).

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

## Orchestrator fix after review round 1
Added a `threading.Lock` in `SeenTracker` around `record` and `presence` (review suggestion: sync dependencies run in the thread pool, so the dicts could be read while another thread adds a key). Full pytest suite re-run: green.
Tester (main session, 25. 10. 2026). Verdict: **PASS**.

Commands (PATH needed `/opt/homebrew/bin` and `~/.local/bin`, `uv` and `node` were not on the default PATH):
- `uv run pytest -q` → 513 passed (before and after adding the assertion below).
- `uv run pytest -q tests/test_seen.py` → 12 passed.
- `node --test tests/js/` → 284 pass, 0 fail.
- Live server on `127.0.0.1:8011` with a temporary `data/` (`/tmp/t049/data`), `uv run python -I /tmp/t049/probe.py`: 34 of 34 checks passed (cookie gating, header ignore cases, presence shape and ISO offsets, 304 recording, ETag on new online party and on dropout, no version/backup/audit change, throttled file, 60 concurrent polls with no 5xx, `data/` not served over HTTP, online window at 80 s).
- Restart checks: existing `seen.yaml` restored; unknown id dropped and bad time dropped with warnings; corrupt YAML, wrong shape, empty and missing file all start with `200` and empty seen data; corrupt `cabin-data.yaml` still refuses to start (`StartupError`).
- Concurrent assign to the same slot is covered by the existing `tests/test_api_write.py` gather tests (green).

Acceptance criteria:

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Header records on 200, 304, rejected writes; ignored for missing/malformed/unknown; no cookie = no record | PASS |
| 2 | `presence` in every returned state (200, write success and error); `online` 75 s window; only existing parties | PASS |
| 3 | Recording: no version/updated_at change, no backup, no audit, no write-limiter use | PASS |
| 4 | `data/seen.yaml` quoted, atomic (no temp leftover), 60 s per-party throttle, unknown ids not written | PASS |
| 5 | Startup tolerant of bad files, unknown ids dropped, English warning | PASS (see note) |
| 6 | ETag changes on version change and on presence change, 304 when nothing relevant changed | PASS |
| 7 | `tests/test_seen.py` covers the listed cases | PASS (one gap closed, see below) |
| 8 | `uv run pytest` and `node --test tests/js/` pass, existing ETag tests unchanged | PASS |

Note on criterion 5: the code logs a warning for unparsable and wrong-shaped files (and for unknown ids), but a missing or empty file starts silently. I read the criterion as meaning the warning applies to bad content, since a missing file is normal on first start. Organizer may want a warning there too; it is a one-line change.

Change by the tester (allowed, small gap): `tests/test_seen.py::test_startup_with_bad_files` took `caplog` but asserted nothing. It now asserts a `chrapa.seen` WARNING for each bad-content case and that an empty file starts with empty seen data. Still 12 tests in the file, all green.

Extra scenarios: tampered group cookie with header (401, no record); malformed header values including 500 chars and `%00`; rejected write (`invalid`) body carries `presence`; path traversal and direct names (`/data/seen.yaml`, `/static/%2e%2e/data/seen.yaml`, `/data/cabin-data.yaml`, `/data/audit.yaml`) all `404`.

Notes for the orchestrator:
- CLAUDE.md still says "ETag by version" and the scope of the task changed (presence and ETag); update it, as the developer noted.
- Nothing in T-049 needs a manual check; the visible part (presence in the page) is T-050.
