# T-093: Enforce `login_required` on all party writes

- **Phase:** 1
- **Depends on:** T-092
- **Size:** S

## Goal
Protected parties can be changed only from a verified device or with the admin cookie: proposal "Prihlásenie telefónom (SMS)" › "Čo je chránené".

## Scope
- `app/main.py` (call `check_party_access` under the lock in each write)
- Tests in `tests/test_api_phone.py`

## Acceptance criteria
- [ ] Under the lock, before any change, `check_party_access` runs for: `PUT /api/parties/{id}`; `assign` and `assign-stay` (body `party_id`); `clear` (current occupant of the slot); `move` (body `party_id`); `places`; `food`; `briefing`.
- [ ] For a protected party without a valid `party_auth` entry each of these returns `403 login_required` with `params.party_id` and `params.party_name` and `state`, and writes nothing (version, file and audit unchanged) — one parametrized test over all seven endpoints.
- [ ] The same requests succeed with a valid `party_auth` entry, and with the admin cookie but no entry.
- [ ] An entry older than `phone_set_at` is rejected (test).
- [ ] Unprotected parties behave exactly as before (existing tests stay green); `clear` on a free slot is still a no-op `200`.
- [ ] `uv run pytest` passes.

## Notes for developer
- Order of checks: keep existing `signup_closed` first, then `unknown_party`/`unknown_slot`, then `login_required`, then the slot rules.
- Phone endpoints (T-094) do their own access check.

---
## Dev log

## Review round 1

## Review round 2

## Test report
