# T-075: `party_auth` cookie, `GET /api/session`, login and logout endpoints

- **Phase:** 1
- **Depends on:** T-073, T-074
- **Size:** M

## Goal
Let a device prove a protected party by SMS: proposal "Prihlásenie telefónom (SMS)" › "Overenie cez SMS" and "Cookie partií", and the rows `/api/session`, `login/start`, `login/verify`, `/api/logout` in "HTTP API" › "Endpointy".

## Scope
- `app/main.py` (cookie signer for `party_auth`, a `verified_parties(request, state)` helper, four endpoints), `app/models.py` (request models)
- Tests in new `tests/test_api_phone.py`

## Acceptance criteria
- [ ] `party_auth` cookie: itsdangerous-signed with `SECRET_KEY` (own salt), `HttpOnly`, `Secure`, `SameSite=Lax`, max 30 days; holds `{party_id: verified_at}` for several parties. Tampered or expired cookie = no verified parties (test).
- [ ] `GET /api/session` (group cookie) → `{ok, verified: [...], sms_enabled}` with `verified` per Q24 default; an entry older than `phone_set_at` is not listed (test).
- [ ] `POST /api/parties/{id}/login/start {phone}`: unknown party `404 unknown_party`; bad phone `422 invalid` (`field: phone`); party without phone or other number `403 phone_mismatch` and no SMS sent (fake client records no call); match (`secrets.compare_digest` on normalized numbers) → SMS sent, `200`.
- [ ] `POST /api/parties/{id}/login/verify {phone, code}`: wrong code `401 bad_sms_code`, cookie unchanged; right code → `200` and the cookie gains the party (existing entries kept).
- [ ] `POST /api/logout {party_id}` removes only that party from the cookie.
- [ ] `sms_enabled = false` → `login/start` and `login/verify` return `503 sms_unavailable`; client error → `503 sms_unavailable`.
- [ ] SMS limits from T-074 enforced (6th code attempt → `429 rate_limited` with `retry_after`; second SMS within 60 s → 429); verify not counted in the 30 writes/min (tests).
- [ ] Error bodies follow the API conventions (English `message`, `state` included); no endpoint bumps `version` or writes audit. No cookie → `401 bad_code` for all four.
- [ ] `uv run pytest` passes.

## Notes for developer
- Defaults in `tasks/QUESTIONS.md`: Q23 (no signup-lock check), Q24 (`verified`), Q25 (mismatch counts as a code attempt; which calls count toward 30 writes).
- Use the injected `FakeSmsClient`; never the real API.

---
## Dev log

## Review round 1

## Review round 2

## Test report
