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
- [ ] `State.phone_verify: bool = True`; a data file without the key loads as `True` and the server starts (test). It is saved like `signup_open`.
- [ ] Every `state` (`/api/state`, SSE `event: state`, ok and error responses) contains `phone_verify` as a bool (test on `/api/state` and one error response).
- [ ] `validate.py`: a party with a phone is protected only when `phone_verify` is true; `check_party_access` lets anyone through when it is false. Pure-function tests for both values (admin, verified, unverified caller).
- [ ] Endpoint test: party with a phone, `phone_verify` false, a device without `party_auth` succeeds on `assign`, `PUT /api/parties/{id}`, `food` and `DELETE /api/parties/{id}/phone`; with `phone_verify` true the same calls return `403 login_required` (existing tests keep passing).
- [ ] `POST /api/admin/phone-verify {on}` (`on` strict bool, extra fields → `422 invalid`): without cookie `401 bad_code`, group cookie `403 forbidden`; counts toward the write limit; under the lock: `version` bump, backup, one audit document with action `phone_verify`, source `admin`, `before`/`after`; SSE `event: state` follows (test).
- [ ] `on: true` while `sms_enabled` is false → `503 sms_unavailable`, nothing written (`version` and audit unchanged). `on: false` works without SMS. `on: true` works with the fake SMS client.
- [ ] No full number in the response, `audit.yaml` or log for the switch (grep test, as in T-094).
- [ ] `uv run pytest` passes.

## Notes for developer
- Model the endpoint on `POST /api/admin/signup` (same dependencies, always writes).
- Keep the rule in `validate.py`; handlers only pass `state.phone_verify`. `verified_parties` and `GET /api/session` stay as they are (Q24).
- `phone_hint` stays in `state` in both modes (the form shows „Telefón končí na …“); the page derives "protected" from `phone_hint` plus `phone_verify`.
- SMS endpoints in contact mode: unchanged, see `tasks/QUESTIONS.md` Q26 (default).
- Open decision "Vypínateľné overovanie": missing `phone_verify` = on; switching on only with Twilio or `SMS_FAKE`.

---
## Dev log

## Review round 1

## Review round 2

## Test report
