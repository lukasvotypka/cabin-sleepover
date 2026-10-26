# T-100: `phone_verify` in state, access rule and admin switch

- **Phase:** 1
- **Depends on:** none (T-090..T-094, T-073 are done)
- **Size:** M

## Goal
Make SMS verification switchable without a restart: proposal "Prihlásenie telefónom (SMS)" › "Vypínateľné overovanie (prepínač v admin paneli)", bullets "Stav", "Prepínač" and the access part of "Vypnuté = číslo je len kontakt".

## Scope
- `app/models.py` (`State.phone_verify`, `PhoneVerifyRequest`)
- `app/validate.py` (`is_protected`, `check_party_access` honor the flag)
- `app/main.py` (`state_payload`, `guard_party`/`check_access` pass the flag, `POST /api/admin/phone-verify`)
- Tests in `tests/test_validate.py`, `tests/test_api_admin.py`, `tests/test_api_phone.py`, `tests/test_models.py`

## Acceptance criteria
- [x] `State.phone_verify: bool = True`; a data file without the key loads as `True` and the server starts (test). It is saved like `signup_open`.
- [x] Every `state` (`/api/state`, SSE `event: state`, ok and error responses) contains `phone_verify` as a bool (test on `/api/state` and one error response).
- [x] `validate.py`: a party with a phone is protected only when `phone_verify` is true; `check_party_access` lets anyone through when it is false. Pure-function tests for both values (admin, verified, unverified caller).
- [x] Endpoint test: party with a phone, `phone_verify` false, a device without `party_auth` succeeds on `assign`, `PUT /api/parties/{id}`, `food` and `DELETE /api/parties/{id}/phone`; with `phone_verify` true the same calls return `403 login_required` (existing tests keep passing).
- [x] `POST /api/admin/phone-verify {on}` (`on` strict bool, extra fields → `422 invalid`): without cookie `401 bad_code`, group cookie `403 forbidden`; counts toward the write limit; under the lock: `version` bump, backup, one audit document with action `phone_verify`, source `admin`, `before`/`after`; SSE `event: state` follows (test).
- [x] `on: true` while `sms_enabled` is false → `503 sms_unavailable`, nothing written (`version` and audit unchanged). `on: false` works without SMS. `on: true` works with the fake SMS client.
- [x] No full number in the response, `audit.yaml` or log for the switch (grep test, as in T-094).
- [x] `uv run pytest` passes.

## Notes for developer
- Model the endpoint on `POST /api/admin/signup` (same dependencies, always writes).
- Keep the rule in `validate.py`; handlers only pass `state.phone_verify`. `verified_parties` and `GET /api/session` stay as they are (Q24).
- `phone_hint` stays in `state` in both modes (the form shows „Telefón končí na …“); the page derives "protected" from `phone_hint` plus `phone_verify`.
- SMS endpoints in contact mode: unchanged, see `tasks/QUESTIONS.md` Q26 (default).
- Open decision "Vypínateľné overovanie": missing `phone_verify` = on; switching on only with Twilio or `SMS_FAKE`.

---
## Dev log
- Added `State.phone_verify` (default True), `PhoneVerifyRequest`, `phone_verify` in `state_payload`, `is_protected`/`check_party_access` take `phone_verify` (default True; handlers pass `state.phone_verify`), `POST /api/admin/phone-verify` (503 `sms_unavailable` before the write when turning on without SMS).
- Files: app/models.py, app/validate.py, app/main.py; tests in test_validate, test_models, test_api_admin, test_api_phone; STATE_KEYS / key order updated in test_api_access.py and test_store.py.
- PUT /api/parties/{id}/phone (contact mode) is not in this task, so the endpoint test covers assign, PUT party, food and DELETE phone.
- Run: `uv run pytest` -> 734 passed.

## Review round 1
Tests: task files 321 passed; full suite 734 passed (the 3 `test_map_layout.py` tests need `node` on PATH, they pass once it is there).

Checked: `State.phone_verify` default True and saved after `signup_open` (key order test); `phone_verify` in `state_payload`, so it is in `/api/state`, SSE and error states; the rule stays in `validate.py` (`is_protected`/`check_party_access`), and both call sites in `main.py` (`guard_party`, `check_access`) pass `state.phone_verify`; the endpoint copies `/api/admin/signup` (AdminOnly + Limited, strict bool, extra fields → 422); the `sms_unavailable` check runs before the write, so nothing is written (tested with a snapshot); audit has action, source, before and after; SSE frame and the "no full number" grep are tested. As agreed, `PUT .../phone` from the criterion belongs to T-101.

- **Suggestion:** `tests/test_validate.py::test_phone_verify_off_unprotects_parties_with_a_phone` does not check a verified caller with `phone_verify=False`. It passes trivially, but one line would cover all three cases the criterion lists.
- **Suggestion:** the `phone_verify` default parameters in `is_protected`/`check_party_access` let a future call site leave the flag out by mistake and still compile. Making it a required keyword would be safer. Not required.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2

## Test report

Tester (round T-100 test run):

Commands (uv is at /opt/homebrew/bin, so PATH needed it):
- `uv run pytest -q` -> 734 passed (includes all of tasks/done)
- `node --test tests/js/` -> 349 pass, 0 fail
- Added one line to `tests/test_validate.py::test_phone_verify_off_unprotects_parties_with_a_phone`: a verified caller with the flag off passes. Pytest still 734 passed.
- Live probe: temp server on 127.0.0.1:8123, temp data dir `/tmp/t100/data`, `SMS_FAKE=1`, then restarted without SMS. Scripts in `/tmp/t100/probe/`. Probe was run in three passes; the first run had two probe bugs (a group-cookie device used for the "no cookie" case, and an SSE listener that stopped at the pre-switch frame), both fixed and re-run, not app bugs.

Criteria:

| Criterion | Result | Evidence |
| --- | --- | --- |
| `phone_verify` default True, saved like `signup_open`, missing key loads as True | PASS | Missing key removed from YAML: server starts, state `phone_verify` True. Persists across restart (False stays False). |
| Every state carries `phone_verify` bool (state, SSE, error) | PASS | `/api/state`, `login_required` error response, SSE state frame. |
| `is_protected` / `check_party_access` honor the flag | PASS | Unit test plus the verified-caller line added. |
| Endpoint: flag off lets no-cookie device through; flag on gives 403 `login_required` | PASS | Flag on: B `assign`, `PUT party`, `food`, `DELETE phone` all 403 `login_required`. Flag off: all four 200. |
| `POST /api/admin/phone-verify`: no cookie 401 `bad_code`, group 403 `forbidden`, strict bool, extra field 422 | PASS | Cookieless 401, group 403, `"yes"`/`1`/`null`/missing/extra-field bodies all 422 `invalid`. |
| Write path: version bump, audit `phone_verify` admin before/after, SSE | PASS | Version 3→4 with audit `before: true, after: false`; SSE `event: state` with `phone_verify: false` received. Backup and write-limit count not re-probed, covered by `tests/test_api_admin.py` and `test_api_phone.py`. |
| `on:true` without SMS → 503, nothing written; `on:false` works; `on:true` with fake works | PASS | Restart without SMS: 503 `sms_unavailable`, version and audit count unchanged; `on:false` 200. With `SMS_FAKE=1`: `on:true` 200. |
| No full number in response, audit or log | PASS | grep of both server logs and `audit.yaml` for the number: 0 matches; switch response has no number. |
| `uv run pytest` passes | PASS | 734 passed. |

Extra scenarios: cookieless request without `X-Client-Id`; the flag is persisted across restart; missing key defaults to on; SSE frame after switch; both directions of the switch with the party unprotected then re-protected.

Manual items: none new for this task. The switch UI is T-103, which will need a manual item for it.

Failures: none.

Verdict: PASS, moved to done.
