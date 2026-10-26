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
- [x] Under the lock, before any change, `check_party_access` runs for: `PUT /api/parties/{id}`; `assign` and `assign-stay` (body `party_id`); `clear` (current occupant of the slot); `move` (body `party_id`); `places`; `food`; `briefing`.
- [x] For a protected party without a valid `party_auth` entry each of these returns `403 login_required` with `params.party_id` and `params.party_name` and `state`, and writes nothing (version, file and audit unchanged) — one parametrized test over all seven endpoints.
- [x] The same requests succeed with a valid `party_auth` entry, and with the admin cookie but no entry.
- [x] An entry older than `phone_set_at` is rejected (test).
- [x] Unprotected parties behave exactly as before (existing tests stay green); `clear` on a free slot is still a no-op `200`.
- [x] `uv run pytest` passes.

## Notes for developer
- Order of checks: keep existing `signup_closed` first, then `unknown_party`/`unknown_slot`, then `login_required`, then the slot rules.
- Phone endpoints (T-094) do their own access check.

---
## Dev log
- `app/main.py`: new `guard_party()` (find_party + `check_party_access`, called under the lock after `check_signup_open`, before the rule checks) in update, assign, assign-stay, move, places, food, briefing; `clear` guards the current occupant after `check_clear` (free slot stays a no-op). Order: signup_closed, unknown_party, login_required, then slot rules; for `clear` the unknown night/slot check comes first because the occupant is needed.
- Tests: `tests/test_api_phone.py` (parametrized over all endpoints: 403 with params and nothing written, then success after login; admin without login; stale entry; other party's login; unprotected/free-slot/unknown_party).
- Changed existing `test_party_forms_reject_a_phone_and_keep_the_stored_one` (`tests/test_api_access.py`) to use `admin_client` for the PUTs, since editing a protected party now needs login or admin.
- `POST /api/parties` (create) is unchanged, no party exists yet.
- `uv run pytest`: 708 passed.

## Review round 1
Checked `app/main.py` diff, `check_party_access` in `app/validate.py`, the new tests in `tests/test_api_phone.py` and the adjusted test in `tests/test_api_access.py`.

- `guard_party` runs inside `rt.store.write(...)` (under the lock) in all seven write paths, after `check_signup_open` and before the slot rules; `find_party` gives `unknown_party` first. `clear` guards the current occupant only when the slot is taken, so a free slot stays a no-op 200.
- `assign`/`assign-stay`/`move` only touch free target slots and `PUT` only frees the party's own slots, so guarding the body `party_id` is enough; no other party can be affected.
- Tests: parametrized 403 `login_required` with `params` {party_id, party_name}, `state` present, and `snapshot` (version, backups, audit) unchanged over all 8 requests; success after login; admin without login; stale entry (`phone_set_at` newer than the login); another party's login; unprotected party, free-slot clear and `unknown_party` unchanged.
- `uv run pytest tests/test_api_phone.py`: 36 passed. `uv run pytest`: 708 passed.

No blockers.

**Nit:** `app/main.py` clear handler: `if holder is not None: guard_party(...)` followed by `if holder is None: tx.skip() else: ...` could be one branch (guard in the `else`).

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester (T-093), commands run from the repo root (`export PATH=$HOME/.local/bin:/opt/homebrew/bin:$PATH` needed for uv/node):
- `uv run pytest -q`: 708 passed before my additions, 710 passed after (full suite, includes all `tasks/done/` regressions).
- `uv run pytest -q tests/test_api_phone.py`: 38 passed.
- `node --test tests/js/`: 340 passed, 0 failed.

Criteria (verified by running the suite and by reading the guard calls in `app/main.py`):

| # | Criterion | Result |
|---|---|---|
| 1 | `check_party_access` under the lock for update, assign, assign-stay, clear (occupant), move, places, food, briefing | PASS (`guard_party` at all 8 handlers, inside `store.write`; clear guards only the taken slot) |
| 2 | Protected party without entry → 403 `login_required`, params party_id/party_name, `state`, nothing written (parametrized) | PASS (`test_protected_party_writes_need_login`, 8 cases, snapshot of version/backups/audit unchanged) |
| 3 | Valid entry succeeds; admin cookie without entry succeeds | PASS (`test_protected_party_writes_need_login` second half, `test_admin_needs_no_login`) |
| 4 | Entry older than `phone_set_at` rejected | PASS (`test_login_older_than_the_number_is_rejected`) |
| 5 | Unprotected parties unchanged; clear on free slot still 200 no-op | PASS (`test_unprotected_party_and_free_slot_behave_as_before`) |
| 6 | `uv run pytest` passes | PASS (710 passed) |

Extra scenarios added by the tester (small gap fill, in `tests/test_api_phone.py`, appended at the end):
- `test_login_required_comes_before_the_slot_rules`: a protected party without login asks for a slot held by another party; the answer is `login_required`, not `slot_taken`. Passes, matches the order in the Notes.
- `test_tampered_party_cookie_does_not_pass_the_write_check`: a garbage `party_auth` cookie on `/api/food` gives `login_required` and changes nothing. Passes.

Also checked: another party's login does not unlock a protected party; `phone` and `phone_set_at` are coupled by the model (`app/models.py`), so a protected party is always verifiable.

Not run: a live uvicorn process (the same app is exercised through httpx ASGI transport in the tests, with a temporary data dir). Note for the reviewer: the existing `test_party_forms_reject_a_phone_and_keep_the_stored_one` in `tests/test_api_access.py` now uses `admin_client`, which is required by the new rule and is accepted.

No failures found. Outcome: PASS, moved to `tasks/done/`. Not committed.

## Test report — manual items
None for T-093 itself. `tests/manual.md` has no phone-login items yet; the SMS flow on a real phone (iPhone Safari, Android Chrome, WhatsApp browser) should be added there with T-094/T-096.
