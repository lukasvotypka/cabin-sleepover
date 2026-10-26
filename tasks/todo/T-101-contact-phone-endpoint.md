# T-101: `PUT /api/parties/{id}/phone`: number as contact only

- **Phase:** 1
- **Depends on:** T-100
- **Size:** S

## Goal
Save a party's number without SMS while verification is off, and make such numbers protected once it is switched on: proposal "Vypínateľné overovanie (prepínač v admin paneli)", bullets "Vypnuté = číslo je len kontakt" and "Zapnuté".

## Scope
- `app/models.py` (request body `{phone}`), `app/main.py` (endpoint)
- Tests in `tests/test_api_phone.py`

## Acceptance criteria
- [ ] `PUT /api/parties/{id}/phone {phone}` with `phone_verify` true → `403 forbidden`, nothing written (checked under the lock).
- [ ] With `phone_verify` false: any device with the group cookie (no `party_auth`) sets the number of any party; unknown party `404 unknown_party`; bad number `422 invalid` with `params.field = "phone"` (same `normalize_phone`); counts toward the write limit.
- [ ] A changed number: `phone` + `phone_set_at` (now) saved, `version` bump, backup, one audit document (action `phone_set`) holding only `phone_hint`, SSE `event: state`; response `state` has `phone_hint` and no full number.
- [ ] The same number again: `200`, no write (`version` and `phone_set_at` unchanged).
- [ ] The response does not set or change the `party_auth` cookie (Q27 default).
- [ ] No signup-lock check (as Q23).
- [ ] Switch-on test: number set in contact mode → admin turns verification on → a device without `party_auth` gets `403 login_required`; a device whose entry predates the contact-mode change also gets it; a device that logs in via `login/verify` afterwards may write.
- [ ] The full number appears in neither `audit.yaml`, the log nor any response body (grep test).
- [ ] `uv run pytest` passes.

## Notes for developer
- Reuse the `phone_set` audit shape of `phone/verify`; source `form`, or `admin` with the admin cookie (`audit_source`).
- `DELETE …/phone` needs no change: T-100 makes it open to everyone in contact mode.
- Open decision "Vypínateľné overovanie": anyone may change the number in contact mode, so a wrong number may end up protected after switching on; the admin fixes it.

---
## Dev log

## Review round 1

## Review round 2

## Test report
