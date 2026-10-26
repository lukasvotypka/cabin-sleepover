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
- [x] `PUT /api/parties/{id}/phone {phone}` with `phone_verify` true → `403 forbidden`, nothing written (checked under the lock).
- [x] With `phone_verify` false: any device with the group cookie (no `party_auth`) sets the number of any party; unknown party `404 unknown_party`; bad number `422 invalid` with `params.field = "phone"` (same `normalize_phone`); counts toward the write limit.
- [x] A changed number: `phone` + `phone_set_at` (now) saved, `version` bump, backup, one audit document (action `phone_set`) holding only `phone_hint`, SSE `event: state`; response `state` has `phone_hint` and no full number.
- [x] The same number again: `200`, no write (`version` and `phone_set_at` unchanged).
- [x] The response does not set or change the `party_auth` cookie (Q27 default).
- [x] No signup-lock check (as Q23).
- [x] Switch-on test: number set in contact mode → admin turns verification on → a device without `party_auth` gets `403 login_required`; a device whose entry predates the contact-mode change also gets it; a device that logs in via `login/verify` afterwards may write.
- [x] The full number appears in neither `audit.yaml`, the log nor any response body (grep test).
- [x] `uv run pytest` passes.

## Notes for developer
- Reuse the `phone_set` audit shape of `phone/verify`; source `form`, or `admin` with the admin cookie (`audit_source`).
- `DELETE …/phone` needs no change: T-100 makes it open to everyone in contact mode.
- Open decision "Vypínateľné overovanie": anyone may change the number in contact mode, so a wrong number may end up protected after switching on; the admin fixes it.

---
## Dev log

- Added `PhoneContactRequest` (`app/models.py`) and `PUT /api/parties/{id}/phone` (`app/main.py`): under the lock, `forbidden` while `phone_verify` is on, then 404/422, same number = `tx.skip()`, else saves `phone` + `phone_set_at` and audits `phone_set` with `phone_hint` only. No cookie change, no signup-lock check, `Limited` counts it.
- Tests: `tests/test_api_phone.py` (5 new, incl. switch-on and stale-entry case, grep of audit and log).
- `uv run pytest tests/test_api_phone.py` 55 passed; `uv run pytest` 739 passed.

## Review round 1

Checked `app/main.py` (`phone_contact`), `app/models.py` (`PhoneContactRequest`), `tests/test_api_phone.py` (5 new tests). Ran `uv run pytest tests/test_api_phone.py` (55 passed) and `uv run pytest` (739 passed).

- All criteria met: `forbidden` is checked inside `store.write` before any change. Then come 404, then `normalize_phone` (422 `invalid`, `field=phone`). The same number calls `tx.skip()`. A changed number stores `phone` and `phone_set_at` and writes an audit entry with `phone_hint` only. Writes are rate-limited through `Limited`, no cookie is set and the signup lock is not checked. The stale-entry case works because `is_verified` compares against the new `phone_set_at`.
- Tests cover the version/backup/audit triple, SSE `state`, no full number in the response, audit or log, the idempotent repeat, the limit, the signup lock and the switch-on flow with a fresh device, a stale device and a re-login.

**Blocker:** none.

**Nit:** `PhoneContactRequest` import in `app/main.py` breaks the alphabetical order of the import list.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester: T-101 (26. 10. 2026)

Commands (uv is in `~/.local/bin`, add it to PATH):
- `uv run pytest -q` → 739 passed (full suite, includes all `tasks/done/` regressions)
- `uv run pytest -q tests/test_api_phone.py` → 55 passed
- `node --test tests/js/` → 352 pass, 0 fail (T-102 is being tested in parallel, not judged here)

Live check on a temporary server (`SMS_FAKE=1`, temp `data/`, port 8877, stopped and removed afterwards):

| # | Criterion | Result |
| --- | --- | --- |
| 1 | `PUT …/phone` with verify on → `403 forbidden`, no version bump | pass |
| 2 | Verify off, group device without `party_auth`: sets number → 200; same number in another format → 200 with no write; `abc`, `+4219`, missing field → 422 `invalid` with `params.field = "phone"`; unknown party → 404 `unknown_party`; no cookie → 401 `bad_code` | pass |
| 3 | Change saved, version bumped, `phone_hint` `456` in state, no full number in body; audit has one `phone_set` with `phone_hint` only | pass |
| 4 | Same number again → no version change | pass |
| 5 | No `Set-Cookie` on the PUT response | pass |
| 6 | Signup closed → contact PUT still 200 | pass |
| 7 | Switch-on: device without `party_auth` → 403 `login_required`; device that logged in before the number change → 403 `login_required`; device that logs in via `login/start` + `login/verify` after the change → PUT party 200; contact PUT while on → 403 `forbidden` | pass |
| 8 | Full number absent from `audit.yaml`, server log and responses (grep); present only in `cabin-data.yaml` and backups, as designed | pass |
| 9 | `uv run pytest` passes | pass |

Extra scenarios: wrong SMS code → 401 `bad_sms_code`; SMS start within 60 s → 429 `rate_limited`. The test suite covers the write limit, the SSE `state` frame and the version/backup/audit triple.

Non-blocking: the reviewer's import-order nit is still present in `app/main.py` (`PhoneContactRequest` sits before `LoginVerifyRequest`).

Verdict: all criteria pass, no regressions. Moved to `tasks/done/`.
