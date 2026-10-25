# T-074: `app/sms.py` Twilio Verify client, fake client and SMS limits

- **Phase:** 1
- **Depends on:** none
- **Size:** M

## Goal
A swappable SMS verification client and the in-memory SMS limits: proposal "Prihlásenie telefónom (SMS)" › "Overenie cez SMS (Twilio Verify)". No endpoints yet.

## Scope
- New `app/sms.py`; `app/ratelimit.py` (reuse `SlidingWindowLimiter`); `app/main.py` (`load_settings`, runtime wiring only); `config/app.yaml`; `pyproject.toml`/`uv.lock` (`uv add httpx` as a runtime dep)
- Tests in new `tests/test_sms.py`, `tests/test_ratelimit.py`

## Acceptance criteria
- [ ] `SmsClient` protocol with async `start(phone)` and `check(phone, code) -> bool`; failures raise `SmsUnavailable` (maps to `503 sms_unavailable`, registered with the other codes).
- [ ] `TwilioVerifyClient` calls the Verify v2 REST API over `httpx` with basic auth (`Channel=sms`, `Locale=sk`; check returns true only for status `approved`, false for a wrong/expired code incl. Twilio 404). Tested with `httpx.MockTransport` only, never the real API: request URL, form fields, auth header, approved/pending/404/500/timeout.
- [ ] `FakeSmsClient` accepts only `SMS_FAKE_CODE` (default `123456`) and logs the code with a masked phone.
- [ ] Settings: all three `TWILIO_*` set → Twilio client, `sms_enabled = true`; `SMS_FAKE=1` → fake client, `sms_enabled = true`; otherwise no client, `sms_enabled = false`. `create_app` accepts an injected client for tests.
- [ ] No log line or exception message contains a full phone number or the auth token (test with `caplog`).
- [ ] `config/app.yaml` gets the SMS limits (1 per 60 s and 5 per hour per party, 10 per hour per IP, 5 code attempts per 10 min per party); exceeding one yields `rate_limited` with `params.retry_after` in seconds (unit tests with a fake clock).
- [ ] `uv run pytest` passes.

## Notes for developer
- No Twilio SDK. Timeout about 10 s; Twilio details go only to the log.
- Key names in `app.yaml` are yours; keep them under `limits:`.
- Open decision "Prihlásenie telefónom": default limits as above, `SMS_FAKE` only for the trial server and development.

---
## Dev log

## Review round 1

## Review round 2

## Test report
