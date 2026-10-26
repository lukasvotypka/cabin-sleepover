# T-094: `phone/start`, `phone/verify` and `DELETE /api/parties/{id}/phone`

- **Phase:** 1
- **Depends on:** T-093
- **Size:** M

## Goal
Add, change and remove a party's number, saved only after a correct SMS code: proposal "Prihlásenie telefónom (SMS)" › "Telefónne číslo" and the three `phone` rows in "HTTP API" › "Endpointy".

## Scope
- `app/main.py` (three endpoints), `app/validate.py` (set/remove helpers if needed)
- Tests in `tests/test_api_phone.py`

## Acceptance criteria
- [x] All three call `check_party_access` first (unprotected party: anyone with the group code, per Q22 default; protected: verified device or admin) → `403 login_required` otherwise.
- [x] `phone/start {phone}`: normalizes (`422 invalid`, `field: phone`), sends an SMS to the new number, stores nothing.
- [x] `phone/verify {phone, code}`: wrong code `401 bad_sms_code`, nothing stored; right code → under the lock sets `phone` and `phone_set_at`, bumps `version`, backup, one audit document (action `phone_set`) containing only `phone_hint`, SSE `event: state`; response sets `party_auth` with this party verified at the same timestamp as `phone_set_at`.
- [x] Changing the number invalidates the other devices' older entries for that party (test: device A verified, device B changes number, A gets `login_required`).
- [x] `DELETE /api/parties/{id}/phone`: removes `phone` and `phone_set_at`, version bump, backup, audit `phone_remove` with `phone_hint`; works with the admin cookie for a party the admin never verified; on a party without phone it is a no-op `200`.
- [x] `sms_enabled = false` → `phone/start` and `phone/verify` return `503 sms_unavailable`; `DELETE` still works.
- [x] SMS limits and code-attempt limit apply as in T-092; the full number appears nowhere in `audit.yaml` or the log (test greps both).
- [x] `uv run pytest` passes.

## Notes for developer
- `SmsLimits` (T-091) only returns wait seconds; the endpoint raises `429 rate_limited` with `params.retry_after` from them (same as T-092).
- Defaults in `tasks/QUESTIONS.md`: Q22, Q23 (no signup-lock check), Q25.
- Open decision "Prihlásenie telefónom": number saved only after SMS; a changed number cancels old verifications.

---
## Dev log

- Added `POST /api/parties/{id}/phone/start`, `POST .../phone/verify`, `DELETE .../phone` in `app/main.py` (before the write endpoints). All check `check_party_access` first (unknown party 404, protected and unverified 403 `login_required`).
- verify: code check outside the lock, then the write (action `phone_set`, audit only `phone_hint`, audit source `form` since `AUDIT_SOURCES` has no new value) re-checks access; `phone_set_at` = cookie time, so the cookie entry equals it; other devices' older entries drop out via `is_verified`. DELETE with no phone is `tx.skip()` (no version bump).
- start/delete use the write limit like login/start; verify uses only the SMS attempt limit. No change needed in `validate.py`.
- Tests: appended to `tests/test_api_phone.py` (SSE state frame, other-device invalidation, admin, SMS off, limits, audit/log grep).
- `uv run pytest` -> 717 passed.

## Review round 1

Scope checked: `app/main.py` (three phone endpoints), `tests/test_api_phone.py`. Ran `uv run pytest tests/test_api_phone.py` (45 passed) and `uv run pytest` (717 passed).

All acceptance criteria are met: `check_party_access` runs first on all three (and is re-checked inside the lock in verify and delete); start normalizes and stores nothing; verify checks the code outside the lock, then writes `phone` + `phone_set_at` under the lock with version, backup, one `phone_set` audit doc holding only `phone_hint`, and SSE state; the cookie entry equals `phone_set_at` exactly (both derived from the same ISO string), so `is_verified` cancels older devices; DELETE is admin-capable, audits `phone_remove`, and is a true no-op (`tx.skip()`) without a phone; SMS off gives 503 for start/verify only; limits mirror T-092; audit and log greps for the full number are in place. No signup-lock check, per Q23. Rules stay in `validate.py`; no Slovak text from the server.

No blockers.

- **Suggestion**: `phone_start`/`phone_verify` call `check_access` before `sms_client()`, so with SMS off a protected, unverified caller gets `403 login_required` instead of `503 sms_unavailable`. Harmless (either way nothing happens), but calling `sms_client()` first like `login_*` would be more consistent.
- **Nit**: in `test_unprotected_party_gets_a_number_after_the_code` the assertion `"phone" not in ... or "phone_hint" in ...` is close to vacuous; the following `NEW_PHONE not in resp.text` is the real check.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (round 1 of testing), run on the working tree with T-096/T-097 page files in progress (not part of this check):

**Commands and results**
- `PATH=/opt/homebrew/bin:$PATH uv run pytest -q` → 717 passed (full suite, once).
- `node --test tests/js/` → 340 pass, 0 fail.
- Independent probe (`/tmp/t094-probe/probe.py`, in-process ASGI against a temp data dir, env test secrets, no ports used).
- Phone-specific tests read: `tests/test_api_phone.py` (SSE state, other-device cancel, admin delete, SMS-off, limits, audit/log grep).

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| `check_party_access` first, `403 login_required` for protected unverified | pass | probe: start, verify, delete on protected party without verification → 403 `login_required`; admin delete → 200 |
| `phone/start` normalizes (`422 invalid`, `field: phone`), stores nothing | pass | probe: `abc` → 422 `invalid`; tests `test_start_sends_sms_on_a_match_and_changes_nothing` |
| `phone/verify` wrong code → `401 bad_sms_code`, nothing stored; right code sets phone and phone_set_at, audit `phone_set` with hint only, SSE state, cookie at phone_set_at | pass | tests `test_unprotected_party_gets_a_number_after_the_code` (401, state, audit, backup, version, `NEW_PHONE not in resp.text`, cookie equals phone_set_at) |
| Changing number cancels other device | pass | test `test_changing_the_number_cancels_other_devices` |
| DELETE removes phone, audit `phone_remove` with hint, admin works, no-phone is no-op 200 | pass | probe: admin DELETE → 200, audit `phone_remove` `phone_hint: '456'`, stored phone None; second DELETE 200 with version unchanged |
| `sms_enabled=false` → 503 `sms_unavailable` for start/verify, DELETE works | pass | probe: start and verify → 503; DELETE → 200 |
| SMS and code-attempt limits; full number absent from audit and log | pass | test `test_limits_and_no_full_number_in_audit_or_log`; probe grep: full number not in audit |
| `uv run pytest` passes | pass | 717 passed |

Extra probes: unknown party on start and delete → 404 `unknown_party`; unprotected party with SMS off reaches the SMS step (503, not 403); no-phone DELETE on unprotected party leaves `cabin-data.yaml` unchanged.

**Failures:** none.

**Regressions:** all tests in `tests/` for `tasks/done/` tasks pass as part of the 717.

**Manual:** real SMS delivery, number-change across two phones, limits on a phone, and the audit/log check on the deploy are not automatable. Added section 9 "Phone login and SMS (T-094)" to `tests/manual.md`.

**Notes (not blocking):** the reviewer's suggestion about check order is accepted as-is: `check_access` runs before `sms_client()`, so protected and unverified callers get 403 even with SMS off, which is consistent with the access rule.

Verdict: PASS, moved to `tasks/done/`.
