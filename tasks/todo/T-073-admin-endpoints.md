# T-073: Admin endpoints: delete party, signup lock, export

- **Phase:** 2 (split from T-009; the organizer started admin work on 25. 10. 2026)
- **Depends on:** T-004, T-027
- **Size:** S

## Goal
The server side of the admin tools: delete a party, lock or unlock signup, download the data file. Proposal sections: „HTTP API“ (Endpointy, the three admin rows), „Bezpečnosť a limity“.

## Scope
- `app/main.py` (and `app/store.py` only if a delete helper is missing), `tests/test_api_admin.py`

## Acceptance criteria
- [ ] All three endpoints need the admin cookie: no group cookie → `401 bad_code`, group cookie only → `403 forbidden`. The two writes count toward the write limit (`Limited`).
- [ ] `DELETE /api/parties/{id}` removes the party, frees every slot it holds on every night, and drops its `briefing`, food note and `seen` entry if those exist; unknown ID → `404 unknown_party`. Runs in the store transaction: version bump, backup, audit with source `admin` and the party as the "before" value.
- [ ] `POST /api/admin/signup {"open": bool}` sets `signup_open` in the same transaction (version, backup, audit source `admin`); a non-bool body → `422 invalid`. The live stream sends the new state (it is a normal commit).
- [ ] `GET /api/admin/export` returns the current `cabin-data.yaml` bytes, `Content-Type: application/x-yaml; charset=utf-8`, `Content-Disposition: attachment; filename="cabin-data-<version>.yaml"`, `Cache-Control: no-store`. Read only: no version bump, no audit.
- [ ] Signup lock check: tests exist (add them if missing) that with `signup_open: false` assign, assign-stay, clear, move, places, create and edit party return `403 signup_closed` for the group cookie and succeed with the admin cookie. Briefing and food notes stay open (they are not signup).
- [ ] After a delete, creating a new party gets the freed palette color again (first unused).
- [ ] `uv run pytest` passes.

## Notes for developer
- Open decision „Uzávierka zápisu“: default is manual only through this endpoint, no deadline.
- The admin code sets both cookies (`/api/join`), so admin requests carry the group cookie too.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
