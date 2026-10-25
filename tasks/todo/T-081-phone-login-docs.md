# T-081: Phone login docs, env and manual checklist

- **Phase:** 1
- **Depends on:** T-077
- **Size:** S

## Goal
Document and wire the Twilio settings for development, the trial server and Docker: proposal "Prihlásenie telefónom (SMS)" › "Overenie cez SMS (Twilio Verify)" and CLAUDE.md "Secrets".

## Scope
- `README.md`, `.env.example`, `compose.yaml`, `tests/manual.md`

## Acceptance criteria
- [ ] `.env.example` lists `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` (empty), `SMS_FAKE` and `SMS_FAKE_CODE` with an English comment (fake only for development and the trial server).
- [ ] `compose.yaml` passes the three Twilio variables as optional (`${VAR:-}`, compose still starts without them) and never sets `SMS_FAKE`; `docker compose config` succeeds without them.
- [ ] README (English): how protection works, Twilio Verify service setup, what happens without the variables (`sms_enabled` false, 503), how to remove a lost phone (admin cookie or editing `cabin-data.yaml` with the service stopped), and that the phone is never in state, SSE, audit or logs.
- [ ] `tests/manual.md` gains steps: add phone with fake code, login on a second device, `login_required` on a third, change number invalidates old device, remove phone, real SMS once on production after the organizer asks.
- [ ] No secret values committed.

## Notes for developer
- Production deploy is not part of this task.

---
## Dev log

## Review round 1

## Review round 2

## Test report
