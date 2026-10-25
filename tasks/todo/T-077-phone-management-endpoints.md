# T-077: `phone/start`, `phone/verify` and `DELETE /api/parties/{id}/phone`

- **Phase:** 1
- **Depends on:** T-076
- **Size:** M

## Goal
Add, change and remove a party's number, saved only after a correct SMS code: proposal "Prihlásenie telefónom (SMS)" › "Telefónne číslo" and the three `phone` rows in "HTTP API" › "Endpointy".

## Scope
- `app/main.py` (three endpoints), `app/validate.py` (set/remove helpers if needed)
- Tests in `tests/test_api_phone.py`

## Acceptance criteria
- [ ] All three call `check_party_access` first (unprotected party: anyone with the group code, per Q22 default; protected: verified device or admin) → `403 login_required` otherwise.
- [ ] `phone/start {phone}`: normalizes (`422 invalid`, `field: phone`), sends an SMS to the new number, stores nothing.
- [ ] `phone/verify {phone, code}`: wrong code `401 bad_sms_code`, nothing stored; right code → under the lock sets `phone` and `phone_set_at`, bumps `version`, backup, one audit document (action `phone_set`) containing only `phone_hint`, SSE `event: state`; response sets `party_auth` with this party verified at the same timestamp as `phone_set_at`.
- [ ] Changing the number invalidates the other devices' older entries for that party (test: device A verified, device B changes number, A gets `login_required`).
- [ ] `DELETE /api/parties/{id}/phone`: removes `phone` and `phone_set_at`, version bump, backup, audit `phone_remove` with `phone_hint`; works with the admin cookie for a party the admin never verified; on a party without phone it is a no-op `200`.
- [ ] `sms_enabled = false` → `phone/start` and `phone/verify` return `503 sms_unavailable`; `DELETE` still works.
- [ ] SMS limits and code-attempt limit apply as in T-075; the full number appears nowhere in `audit.yaml` or the log (test greps both).
- [ ] `uv run pytest` passes.

## Notes for developer
- Defaults in `tasks/QUESTIONS.md`: Q22, Q23 (no signup-lock check), Q25.
- Open decision "Prihlásenie telefónom": number saved only after SMS; a changed number cancels old verifications.

---
## Dev log

## Review round 1

## Review round 2

## Test report
