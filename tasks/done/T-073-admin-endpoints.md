# T-073: Admin endpoints: delete party, signup lock, export

- **Phase:** 2 (split from T-009; the organizer started admin work on 25. 10. 2026)
- **Depends on:** T-004, T-027
- **Size:** S

## Goal
The server side of the admin tools: delete a party, lock or unlock signup, download the data file. Proposal sections: „HTTP API“ (Endpointy, the three admin rows), „Bezpečnosť a limity“.

## Scope
- `app/main.py` (and `app/store.py` only if a delete helper is missing), `tests/test_api_admin.py`

## Acceptance criteria
- [x] All three endpoints need the admin cookie: no group cookie → `401 bad_code`, group cookie only → `403 forbidden`. The two writes count toward the write limit (`Limited`).
- [x] `DELETE /api/parties/{id}` removes the party, frees every slot it holds on every night, and drops its `briefing`, food note and `seen` entry if those exist; unknown ID → `404 unknown_party`. Runs in the store transaction: version bump, backup, audit with source `admin` and the party as the "before" value.
- [x] `POST /api/admin/signup {"open": bool}` sets `signup_open` in the same transaction (version, backup, audit source `admin`); a non-bool body → `422 invalid`. The live stream sends the new state (it is a normal commit).
- [x] `GET /api/admin/export` returns the current `cabin-data.yaml` bytes, `Content-Type: application/x-yaml; charset=utf-8`, `Content-Disposition: attachment; filename="cabin-data-<version>.yaml"`, `Cache-Control: no-store`. Read only: no version bump, no audit.
- [x] Signup lock check: tests exist (add them if missing) that with `signup_open: false` assign, assign-stay, clear, move, places, create and edit party return `403 signup_closed` for the group cookie and succeed with the admin cookie. Briefing and food notes stay open (they are not signup).
- [x] After a delete, creating a new party gets the freed palette color again (first unused).
- [x] `uv run pytest` passes.

## Notes for developer
- Open decision „Uzávierka zápisu“: default is manual only through this endpoint, no deadline.
- The admin code sets both cookies (`/api/join`), so admin requests carry the group cookie too.

---
## Dev log
- Added `DELETE /api/parties/{id}`, `POST /api/admin/signup`, `GET /api/admin/export` in `app/main.py` (admin check runs before the write limit; the two writes are `Limited`). Delete runs in one store transaction (frees slots, drops briefing; food note is on the party), then `SeenTracker.forget` (new, `app/seen.py`) drops the seen entry in memory and file. `SignupRequest` already existed in models.
- Lock tests: existing matrix in `tests/test_api_write.py` covers assign, assign-stay, clear, move, create, edit; places lock test already existed there too; new tests add places with admin plus briefing/food staying open.
- New `tests/test_api_admin.py` (10 tests).
- Run: `uv run pytest` (630 passed), `node --test tests/js/` (no failures).
- Note: `tests/test_api_write.py` has a `lock_signup` helper comment saying the endpoint is a later phase; could switch to the endpoint, left as is.

## Review round 1
Tests run by the reviewer: `uv run pytest tests/test_api_admin.py` 10 passed; `uv run pytest` 630 passed.

All criteria are met. Admin is checked before the write limit (`require_admin` → `require_group`, then `Limited`), and the 401/403 tests cover all three endpoints with no state change. Delete runs inside `store.write`, so `unknown_party` from `find_party` aborts without a write. It frees every slot through `release_slot`, drops `briefing`, and audits the full party as "before" with source `admin`. It calls `seen.forget` after the commit hook has refreshed `known_ids`, so `seen.yaml` is rewritten without the party. `SignupRequest.open` is strict, so `"yes"`, `1`, `{}` and extra keys all return `422 invalid` (tested). Export reads the atomically replaced file without the lock, sends the required headers and writes nothing (tested). The lock matrix already exists in `tests/test_api_write.py` (assign, assign-stay, clear, move, create, edit). The new test covers places for group and admin, and shows that briefing and food stay open. The test for a freed palette color passes.

- **Blocker:** none.
- **Suggestion:** the `lock_signup` helper in `tests/test_api_write.py` (line 26) has a comment saying the endpoint "is a later phase". That comment is now stale. Change the comment or switch the helper to `POST /api/admin/signup`.

Verdict: APPROVED (round 2 skipped, no blockers)


## Review round 2
(reviewer appends)

## Test report
Tester (T-073), run on branch feature/admin, working tree as of this test.

Commands and results:
- `uv run pytest -q` → 631 passed (630 from the developer plus 1 test the tester added, see below).
- `uv run pytest -q tests/test_api_admin.py` → 11 passed.
- `node --test tests/js/` → 333 pass, 0 fail.
- Temporary server `uv run uvicorn`-equivalent on 127.0.0.1:8011, data in a temp dir, test secrets. Probed with httpx/curl (cookies taken from Set-Cookie). Restarted it once on the same data dir.

Tester addition (small gap, in `tests/test_api_admin.py`): `test_signup_toggle_reaches_open_streams` checks that `POST /api/admin/signup` pushes the new state to an open stream (the criterion says the stream sends it; the existing event tests only cover generic writes).

Acceptance criteria:

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Admin cookie needed: no cookie 401 bad_code, group cookie 403 forbidden, counted by write limit | PASS (live: all 3 endpoints 401/403; tampered admin cookie 403; limit test passes) |
| 2 | DELETE frees slots on all nights, drops briefing, seen entry; unknown 404; version+backup+audit (source admin, party before) | PASS (live: 2 slots freed across nights, briefing gone, seen.yaml entry removed, backup +1, audit party-delete/admin with before; second delete 404 unknown_party) |
| 3 | POST signup sets signup_open with version/backup/audit; non-bool 422 invalid; stream gets state | PASS (live: `"open":"false"`, missing body, bad JSON, extra keys → 422 invalid; audit signup/admin before/after; stream test) |
| 4 | Export: YAML bytes, content-type, attachment filename with version, no-store, read-only | PASS (live: 200, `application/x-yaml; charset=utf-8`, `cabin-data-<version>.yaml`, `no-store`; version and backups unchanged by export) |
| 5 | Signup lock matrix (assign, assign-stay, clear, move, places, create, edit → 403 signup_closed for group; admin succeeds; briefing/food open) | PASS (live: places and create → 403 signup_closed for group; briefing and food 200; admin places 200; existing matrix in test_api_write.py) |
| 6 | After delete, new party gets freed palette color | PASS (live: new party got the color of the deleted party; test passes) |
| 7 | `uv run pytest` passes | PASS (631 passed) |

Extra scenarios tried:
- Concurrent deletes of the same party (2 threads): exactly one 200, one 404.
- Delete with a seen entry: seen.yaml rewritten without the party.
- Restart on existing data after delete and lock: parties, signup_open false and export version 16 all persisted.
- Export version equals state version after a sequence of writes.
- Static/data reachability: `/data/cabin-data.yaml`, `/static/../data/cabin-data.yaml` → 404.
- Delete with invalid id `x` → 422 invalid; signup with string `"false"` → 422.

Observation (not a T-073 failure, for the developer to consider): `DELETE /api/parties/..%2Fetc` returns 404 with no JSON `code` (Starlette's default not-found for a path that matches no route). Same as any unknown route, so it is outside this task's criteria.

Needs a human or device: nothing new for T-073. The admin UI is not part of this task. The export download in a real browser (filename and save dialog) can be checked later with the admin panel.

Verdict: PASS. Moved to done.
