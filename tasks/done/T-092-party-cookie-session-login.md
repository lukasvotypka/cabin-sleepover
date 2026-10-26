# T-092: `party_auth` cookie, `GET /api/session`, login and logout endpoints

- **Phase:** 1
- **Depends on:** T-090, T-091
- **Size:** M

## Goal
Let a device prove a protected party by SMS: proposal "Prihlásenie telefónom (SMS)" › "Overenie cez SMS" and "Cookie partií", and the rows `/api/session`, `login/start`, `login/verify`, `/api/logout` in "HTTP API" › "Endpointy".

## Scope
- `app/main.py` (cookie signer for `party_auth`, a `verified_parties(request, state)` helper, four endpoints), `app/models.py` (request models)
- Tests in new `tests/test_api_phone.py`

## Acceptance criteria
- [x] `party_auth` cookie: itsdangerous-signed with `SECRET_KEY` (own salt), `HttpOnly`, `Secure`, `SameSite=Lax`, max 30 days; holds `{party_id: verified_at}` for several parties. Tampered or expired cookie = no verified parties (test).
- [x] `GET /api/session` (group cookie) → `{ok, verified: [...], sms_enabled}` with `verified` per Q24 default; an entry older than `phone_set_at` is not listed (test).
- [x] `POST /api/parties/{id}/login/start {phone}`: unknown party `404 unknown_party`; bad phone `422 invalid` (`field: phone`); party without phone or other number `403 phone_mismatch` and no SMS sent (fake client records no call); match (`secrets.compare_digest` on normalized numbers) → SMS sent, `200`.
- [x] `POST /api/parties/{id}/login/verify {phone, code}`: wrong code `401 bad_sms_code`, cookie unchanged; right code → `200` and the cookie gains the party (existing entries kept).
- [x] `POST /api/logout {party_id}` removes only that party from the cookie.
- [x] `sms_enabled = false` → `login/start` and `login/verify` return `503 sms_unavailable`; client error → `503 sms_unavailable`.
- [x] SMS limits from T-091 enforced (6th code attempt → `429 rate_limited` with `retry_after`; second SMS within 60 s → 429); verify not counted in the 30 writes/min (tests).
- [x] Error bodies follow the API conventions (English `message`, `state` included); no endpoint bumps `version` or writes audit. No cookie → `401 bad_code` for all four.
- [x] `uv run pytest` passes.

## Notes for developer
- Defaults in `tasks/QUESTIONS.md`: Q23 (no signup-lock check), Q24 (`verified`), Q25 (mismatch counts as a code attempt; which calls count toward 30 writes).
- Use the injected `FakeSmsClient`; never the real API.

---
## Dev log

- Added `PartyAuthSigner` (salt `chrapa-poll/party_auth`, entries expire after 30 days), `verified_parties(request, state)` and the four endpoints in `app/main.py`; request models in `app/models.py`; `phone_mismatch` 403 and `bad_sms_code` 401 in `ERROR_STATUS` (`app/validate.py`). Tests in `tests/test_api_phone.py` (17).
- Q23-Q25 defaults used: no signup-lock check; `verified` = existing, protected, not older than `phone_set_at`; a `login/start` mismatch costs a code attempt; `login/start` and `logout` count toward 30 writes, `login/verify` does not (but has the 5 attempts / 10 min limit; a mismatch on verify counts too).
- Order in `login/start`: sms off 503, unknown party 404, bad phone 422, mismatch 403, send limits 429, send.
- Not covered here: other write endpoints still do not enforce access (T-093).
- Run: `uv run pytest tests/test_api_phone.py` then `uv run pytest` -> 689 passed.

## Review round 1

Tests: `uv run pytest tests/test_api_phone.py` 17 passed; full `uv run pytest` 689 passed (3 map-layout tests fail only when `node` is not on PATH; with Node they pass, so the environment caused it, not this task).

Checked: the `party_auth` signer has its own salt, checks each entry's age (30 days plus clock skew) and drops tampered or malformed tokens. The cookie flags match the group cookie. `verified_parties` follows Q24 through `is_verified`, so stale, deleted and unprotected parties drop out and the cookie stays small. Phone numbers are normalized before matching, so a malformed number gives `invalid` for every party, and matching uses `compare_digest`. A mismatch costs a code attempt (Q25). The `login/start` order matches the Dev log. In `verify`, the attempt is counted before the phone and code checks. A wrong code sends no `Set-Cookie`. The 503 comes from `SmsUnavailable` (a `RuleError`). Write-limit membership follows Q25. Nothing goes through `store.write`, so there is no version bump, backup or audit. The new codes are in `ERROR_STATUS` and `logic-errors.js`. No Slovak text comes from the server.

- **Blocker:** none.
- **Suggestion:** `app/main.py` `login_start` returns `{"ok": true}` without `state`, while the API convention (and `verify`/`logout`) return `{ok, state}`. This does no harm because the page does not need it, but `ok_response(rt, state)` would keep responses uniform.
- **Suggestion:** after logout, when the last party is removed, `delete_cookie` is used. Consider a test that checks for that `Set-Cookie` deletion header.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2

## Test report

Tester: claude-haiku-5-5, run on the current working tree (T-095 static/js changes present, not tested here).
Note: `uv` and `node` are in `/opt/homebrew/bin`, not on the default PATH of the agent shell; run with `PATH=/opt/homebrew/bin:$PATH`.

### Commands and results

- `uv run pytest` → 689 passed (includes the 17 tests of `tests/test_api_phone.py`).
- `node --test tests/js/` → 339 pass, 0 fail.
- Probes (not committed, temp data dir, in-process app via httpx ASGI transport, fake SMS client that records calls; scripts in `/tmp/t092-probe/`):
  - no group cookie on the four endpoints → 401 `bad_code` each.
  - `GET /api/session` fresh → `{ok, verified: [], sms_enabled: true}`.
  - `login/start`: unknown party 404 `unknown_party`; `"12"` 422 `invalid` with `params.field = "phone"`; party without phone 403 `phone_mismatch`; wrong number 403 `phone_mismatch` with no SMS sent (`started` list empty); match 200 with one SMS sent.
  - second `login/start` for the same party within 60 s → 429 `rate_limited`, `retry_after` 60 (in the body and `Retry-After` header); after 61 s → 200.
  - `login/verify`: wrong code 401 `bad_sms_code` with no `Set-Cookie`; right code 200 with `party_auth` set; second party added, both listed; logout of one party keeps the other; logout of the last party deletes the cookie (`Max-Age=0`).
  - cookie flags: `HttpOnly`, `Secure`, `SameSite=lax`, `Max-Age=2592000`, `Path=/`.
  - tampered last character, tampered payload, garbage string, empty value → `verified: []`.
  - party cookie 31 days old (fresh group cookie) → `verified: []`.
  - code attempts: 6th attempt on one party within the 10 min window → 429 `rate_limited`, `retry_after` 480 (counting the mismatch on `login/start` as an attempt, per Q25).
  - `sms_enabled=false`: `login/start` and `login/verify` → 503 `sms_unavailable`; `sms_enabled` false in `/api/session`.
  - client raises a failure: `login/start` and `login/verify` → 503 `sms_unavailable` with `state`.
  - `version` stays 1 across all phone calls; `data/audit.yaml` keeps only the one party-create document; no backup or write beyond the setup.

### Acceptance criteria

| # | Criterion | Result |
| --- | --- | --- |
| 1 | `party_auth` signed with `SECRET_KEY` (own salt), HttpOnly/Secure/SameSite=Lax, max 30 days, several parties; tampered or expired = none | PASS |
| 2 | `GET /api/session` → `{ok, verified, sms_enabled}`; entry older than `phone_set_at` not listed | PASS (the stale case is covered by the test suite; I did not probe it by hand) |
| 3 | `login/start`: 404 unknown, 422 invalid (`field: phone`), 403 `phone_mismatch` with no SMS, match → SMS + 200 | PASS |
| 4 | `login/verify`: wrong code 401 `bad_sms_code`, cookie unchanged; right code 200, cookie gains party, existing kept | PASS |
| 5 | `POST /api/logout {party_id}` removes only that party | PASS |
| 6 | `sms_enabled=false` and client error → 503 `sms_unavailable` | PASS |
| 7 | SMS limits: 6th code attempt 429 with `retry_after`; second SMS within 60 s 429; verify not in the 30 writes/min | PASS (the write-limit part is covered by the test suite; not probed by hand) |
| 8 | Error bodies: English `message`, `state` included; no `version` bump or audit; no cookie → 401 `bad_code` for all four | PASS with a note (see below) |
| 9 | `uv run pytest` passes | PASS (689) |

### Notes (non-blocking)

- `bad_code` responses carry no `state`. This is the existing, deliberate rule in `app/main.py` (`with_state`), so it is not a deviation for T-092. All other errors from the four endpoints include `state`.
- Success body of `POST /api/parties/{id}/login/start` is `{"ok": true}` without `state`, while the API convention is `{ok, state}` for success. This matches the reviewer's round-1 suggestion, which was not applied. Not a criterion failure, but it is a small deviation from the convention and could be fixed with `ok_response`.

### Extra scenarios tried
Listed above under the probes. No failures found.

### Bugs
None.

### Manual checks
None required for T-092. Real SMS delivery through the provider has not been tested and needs a manual check on a real phone (to be added to `tests/manual.md` with the phone-login tasks).

Verdict: PASS, moved to `done/`.
