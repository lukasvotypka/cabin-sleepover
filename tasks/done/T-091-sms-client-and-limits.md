# T-091: `app/sms.py` Twilio Verify client, fake client and SMS limits

- **Phase:** 1
- **Depends on:** none
- **Size:** M

## Goal
A swappable SMS verification client and the in-memory SMS limits: proposal "Prihlásenie telefónom (SMS)" › "Overenie cez SMS (Twilio Verify)". No endpoints yet.

## Scope
- New `app/sms.py`; `app/ratelimit.py` (reuse `SlidingWindowLimiter`); `app/main.py` (`load_settings`, runtime wiring only); `config/app.yaml`; `pyproject.toml`/`uv.lock` (`uv add httpx` as a runtime dep)
- Tests in new `tests/test_sms.py`, `tests/test_ratelimit.py`

## Acceptance criteria
- [x] `SmsClient` protocol with async `start(phone)` and `check(phone, code) -> bool`; failures raise `SmsUnavailable` (maps to `503 sms_unavailable`, registered with the other codes).
- [x] `TwilioVerifyClient` calls the Verify v2 REST API over `httpx` with basic auth (`Channel=sms`, `Locale=sk`; check returns true only for status `approved`, false for a wrong/expired code incl. Twilio 404). Tested with `httpx.MockTransport` only, never the real API: request URL, form fields, auth header, approved/pending/404/500/timeout.
- [x] `FakeSmsClient` accepts only `SMS_FAKE_CODE` (default `123456`) and logs the code with a masked phone.
- [x] Settings: all three `TWILIO_*` set → Twilio client, `sms_enabled = true`; `SMS_FAKE=1` → fake client, `sms_enabled = true`; otherwise no client, `sms_enabled = false`. `create_app` accepts an injected client for tests.
- [x] No log line or exception message contains a full phone number or the auth token (test with `caplog`).
- [x] `config/app.yaml` gets the SMS limits (1 per 60 s and 5 per hour per party, 10 per hour per IP, 5 code attempts per 10 min per party); exceeding one yields `rate_limited` with `params.retry_after` in seconds (unit tests with a fake clock).
- [x] `uv run pytest` passes.

## Notes for developer
- No Twilio SDK. Timeout about 10 s; Twilio details go only to the log.
- Key names in `app.yaml` are yours; keep them under `limits:`.
- Open decision "Prihlásenie telefónom": default limits as above, `SMS_FAKE` only for the trial server and development.

---
## Dev log
- New `app/sms.py` (`SmsClient` protocol, `SmsUnavailable` as a `RuleError` with code `sms_unavailable`, `TwilioVerifyClient` over httpx, `FakeSmsClient`, `mask_phone`). `sms_unavailable` 503 added to `ERROR_STATUS` in `app/validate.py`.
- `app/ratelimit.py`: `SmsLimits` (`send(party_id, ip)` and `attempt(party_id)` return 0 or retry seconds; endpoints, a later task, raise `rate_limited` with `params.retry_after`). Config keys under `limits:` in `config/app.yaml` (`sms_*`), with defaults in `Limits` in `app/models.py`.
- `app/main.py`: `Settings` gets `twilio`, `sms_fake`, `sms_fake_code`; `build_sms_client`; `Runtime.sms`, `sms_limits`, `sms_enabled`; `create_app(sms_client=...)`. Partial Twilio variables = off, with a warning naming the missing ones.
- `httpx` moved to runtime deps (`uv add httpx`; pyproject.toml, uv.lock).
- Tests: `tests/test_sms.py` (new), `tests/test_ratelimit.py`. Run: `uv run pytest tests/test_sms.py tests/test_ratelimit.py`, then `uv run pytest` -> 665 passed.
- Follow-up: the Slovak text for `sms_unavailable` belongs in `logic-errors.js` (a later task). The suite also contains T-090's in-progress changes in the shared checkout.

## Review round 1

Tests: `uv run pytest tests/test_sms.py tests/test_ratelimit.py` 29 passed; full `uv run pytest` 665 passed (with Node on PATH). Only T-091 parts judged (the T-090 parts of `app/main.py`, `app/models.py` and `app/validate.py` are out of scope).

**Blocker**

1. `app/sms.py` `_twilio_error()` (used by `start()` and `check()` warnings): it logs Twilio's `message` verbatim, and Twilio echoes the parameter value in it. Example: a 400 `60200` on `Verifications` comes back as `{"code": 60200, "message": "Invalid parameter `To`: +421905123456"}`, so the warning line holds the full number. That breaks the criterion "No log line ... contains a full phone number". The current tests miss it because their 500 body is `"boom"`. Fix: redact before logging. Either log only Twilio's numeric `code` and the HTTP status, or replace `phone` and `phone[1:]` in the message with `mask_phone(phone)` (pass `phone` into `_twilio_error`). Add a `caplog` test whose 400/500 body message contains `PHONE` and assert that neither `PHONE` nor `905123456` shows up in the log.

**Suggestion**

- `check()` treats every 400 as a wrong code. That is fine for now. A comment noting that Twilio's 429/60202 ("max check attempts") falls under `SmsUnavailable` would help the endpoint task decide how to map it.
- `Settings` is a plain dataclass, so its repr now includes the Twilio auth token, as it already did `secret_key`. Consider `field(repr=False)` for `twilio` (and the existing secrets) so an accidental `log.debug(settings)` cannot leak them.
- `SmsLimits` returns seconds and does not raise. The criterion's "`rate_limited` with `params.retry_after`" is left to the endpoint task. That is acceptable since there are no endpoints yet, but make sure the T-092+ task file says so.

Verdict: CHANGES REQUESTED

## Dev log, fixes for review round 1
- Blocker fixed: `_twilio_error(response, phone)` in `app/sms.py` replaces the phone (with and without `+`) by `mask_phone(phone)` in Twilio's message before logging. New caplog test `test_twilio_message_echoing_the_phone_is_redacted` (400 and 500) in `tests/test_sms.py`.
- Suggestion 1 done: comment in `check()` that Twilio 429/60202 falls under `SmsUnavailable`; the endpoint task decides the mapping.
- Suggestion 2 done: `Settings` secrets (`group_code`, `admin_code`, `secret_key`, `twilio`) use `field(repr=False)` in `app/main.py`.
- Suggestion 3: `SmsLimits` returns seconds only; the endpoint tasks (T-092+) must raise `rate_limited` with `params.retry_after`. Needs a note in those task files (not mine to edit).
- Tests: `uv run pytest` -> 667 passed.

## Review round 2

Tests: `uv run pytest tests/test_sms.py tests/test_ratelimit.py` 31 passed; full `uv run pytest` 667 passed.

Round-1 blocker: fixed. `_twilio_error(response, phone)` in `app/sms.py` masks the phone, with and without `+`, in Twilio's message before logging. `test_twilio_message_echoing_the_phone_is_redacted` (400 and 500) checks that neither `PHONE` nor `905123456` reaches the log. Suggestions 1 and 2 are also done (`check()` comment; `field(repr=False)` on the `Settings` secrets).

**Suggestion**
- `_twilio_error` cuts the message to 200 characters before it masks the phone. If a number sat right at the cut, a partial number could survive. Masking before truncating would close that. It is unlikely with Twilio's short messages, so this is not a blocker.
- Suggestion 3 from round 1 still applies: the endpoint task files (T-092+) must say that they raise `rate_limited` with `params.retry_after` from `SmsLimits`.

Verdict: APPROVED

## Test report

Tester (round 1 of testing), 2026-10-25. Verdict: FAIL (one low-severity defect in `TwilioVerifyClient.check`). Only T-091 criteria judged; T-090 changes in the shared checkout not judged.

### Commands run
- `uv run pytest -q` (PATH includes `/opt/homebrew/bin`; `uv` is not on the default shell PATH) → **667 passed** in 12.2 s (full suite, includes tests/test_sms.py and tests/test_ratelimit.py, and all tests in tasks/done).
- `node --test tests/js/` → 333 pass, 0 fail (no regressions in page logic).
- Probe script `/tmp/t074probe/probe.py` (outside the repo, temporary `data/` dirs, fake clock, `httpx.MockTransport`, no real Twilio, no real phone): limits, settings matrix, fake client, Twilio edge cases, log scan, 503/429 mapping through the app's `RuleError` handler.
- Manual items added to `tests/manual.md` (real Twilio Verify send, section 8 end).

### Acceptance criteria
| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `SmsClient` protocol, async `start`/`check`; failures raise `SmsUnavailable` → `503 sms_unavailable` | FAIL | Protocol and 503 mapping pass (probe: `/probe503` → 503 `sms_unavailable`). Failure case not covered: `check` on a 200 with a non-object JSON body (see bug 1). |
| 2 | `TwilioVerifyClient` over httpx, basic auth, `Channel=sms`, `Locale=sk`, approved/pending/404/500/timeout | PASS | Tests pass; probe: approved → True, 400 malformed → False, 429 → SmsUnavailable, connect error → SmsUnavailable, 500 text body → SmsUnavailable. |
| 3 | `FakeSmsClient` accepts only `SMS_FAKE_CODE` (default `123456`), logs code with masked phone | PASS | Probe: `123456` True, `123457`, empty, `123456 ` (trailing space) and full-width digits all False. Log: `FAKE SMS for ***456: code 123456`. |
| 4 | Settings: 3× `TWILIO_*` → Twilio; `SMS_FAKE=1` → fake; else off; `create_app` injectable | PASS | Probe matrix: none/`SMS_FAKE=0`/`SMS_FAKE=false` off; `SMS_FAKE=1` fake (code 123456 or `SMS_FAKE_CODE`); full Twilio → Twilio; partial Twilio → off with warning naming the missing variable; partial Twilio + fake → fake. Injected client used. |
| 5 | No log line or exception message holds a full phone or the auth token | PASS | Probe: Twilio messages echoing `+421905123456`, `421905123456` masked (`***456`); token never in log, and not in `repr(Settings)`. Caveat in note 2. |
| 6 | Limits in `config/app.yaml` (1/60 s and 5/h per party, 10/h per IP, 5 attempts/10 min per party); exceeding gives `rate_limited` with `params.retry_after` (fake clock tests) | PASS with caveat | Probe: interval wait 50 s, party-hour block 3300 s, IP cap block at 11th send (2990 s), rejected sends consume no quota, attempts 5 allowed then 600 s. `rate_limited` 429 with `params.retry_after` verified through the app's handler (`/probe429` → 429 `{retry_after: 42}`). `SmsLimits` itself returns seconds; the endpoints (T-092, T-094) are where `rate_limited` is raised, as the task notes say. |
| 7 | `uv run pytest` passes | PASS | 667 passed. |

### Extra scenarios
- Limit windows boundary: at exactly the window edge the hit is released (`+60 s` allowed), and an IP-blocked send does not use up the party's hourly quota.
- Partial Twilio config with `SMS_FAKE=1` falls back to the fake client.
- `Settings` repr contains no token.
- Twilio 400 with the phone written with spaces (`+421 905 123 456`) is not masked (note 2). Not a failing criterion, since our `To` is always E.164 from validation and Twilio echoes that form.

### Bug report 1 (low severity, blocks the criterion "failures raise SmsUnavailable")
- Steps: `TwilioVerifyClient("AC1", TOKEN, "VA1", transport=httpx.MockTransport(lambda r: httpx.Response(200, json=[1]))).check("+421905123456", "123456")`.
- Expected: `SmsUnavailable` (503 `sms_unavailable`) like the other failure cases.
- Actual: `AttributeError: 'list' object has no attribute 'get'` (an unhandled 500 in the app). `response.json().get(...)` is only guarded for `ValueError`. Fix: also catch `AttributeError` (or check `isinstance(body, dict)`) around the status read, and add a test with a list body next to the non-JSON case in `tests/test_sms.py`.

### Note 2 (informational)
- `_twilio_error` truncates to 200 characters before masking (already noted by the reviewer). Masking before truncation would be safer.

### Manual (not automated)
- Real Twilio Verify send/check with a real phone and a real service: added to `tests/manual.md` (section 8 end, "Real SMS through Twilio Verify (T-091)").

### Result
Fail, so the task goes back to `in-progress` with bug 1. After the fix, re-run `uv run pytest tests/test_sms.py` and the list-body probe.

## Dev log, fixes for test report 1
- Bug 1 fixed: `check()` in `app/sms.py` now catches `(ValueError, AttributeError)` around reading the 200 body, so a non-object JSON body raises `SmsUnavailable`. Test `test_check_200_with_non_object_json_is_unavailable` (list, string, null, number).
- Note 2 fixed: `_twilio_error` masks the phone before truncating to 200 chars. Test `test_phone_at_the_truncation_edge_is_masked`.
- Tests: `uv run pytest` -> 672 passed.

## Review re-check

Re-check after test report 1, covering only the fix diff. Tests: `uv run pytest tests/test_sms.py` 23 passed; full `uv run pytest` 672 passed.

- Bug 1: fixed. `check()` in `app/sms.py` (lines 88-92) catches `(ValueError, AttributeError)` around the 200 body, logs with the masked phone and raises `SmsUnavailable` from None. `test_check_200_with_non_object_json_is_unavailable` covers list, string, null and number bodies.
- Note 2: fixed. `_twilio_error` now masks first and truncates to 200 characters afterwards (line 100).

**Suggestion**
- `test_phone_at_the_truncation_edge_is_masked` would also have passed on the old code. With `"x" * 195 + PHONE`, the old truncation kept only `+4219`, so `905123456` was never in the log either way. Asserting that the raw number's prefix (e.g. `"+42190"`) is absent, or using `"x" * 190`, would make the test catch a regression. Not a blocker.

Verdict: APPROVED

### Test report, round 2 (tester, 2026-10-25)

Re-test after the dev fix for test report 1 (non-object JSON body). Only T-091 criteria judged. T-095 (in progress, `static/js`) and the T-090 changes in the shared checkout are not judged.

**Commands run** (`PATH=/opt/homebrew/bin:$PATH`)
- `uv run pytest -q` → 672 passed in 11.8 s (includes all of `tasks/done/`, so no regressions).
- `node --test tests/js/` → exit 0 (T-095 in progress touches `tests/js/logic.test.mjs`; not judged).
- Probe scripts `/tmp/t074probe/probe.py` and `probe2.py` (outside the repo, `httpx.MockTransport`, fake clock, no real Twilio, no real phone, no `data/`).

**Acceptance criteria**

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `SmsClient` protocol; failures raise `SmsUnavailable` → 503 `sms_unavailable` | PASS | Bug 1 fixed: check 200 with `[1]`, `"x"`, `null`, `5`, `[{"status":"approved"}]` and text `boom` all raise `SmsUnavailable`. Start/check 500 with list, `boom`, `null` bodies, timeout, connect error and 429 all raise `SmsUnavailable`. `ERROR_STATUS["sms_unavailable"] == 503`. |
| 2 | `TwilioVerifyClient` over httpx, basic auth, `Channel=sms`, `Locale=sk`, approved/pending/404/500/timeout | PASS | Request shape tests pass; approved → True, canceled → False, 404 → False, 400 → False, 201 start OK, 500 and timeout → `SmsUnavailable`. |
| 3 | `FakeSmsClient` accepts only `SMS_FAKE_CODE` (default `123456`), logs masked phone | PASS | `123456` True; `123457`, empty, custom-code mismatch False. Log: `FAKE SMS for ***456: code 123456`, no full phone. |
| 4 | Settings matrix; `create_app` injectable | PASS | none → None; `SMS_FAKE=0` → None; `SMS_FAKE=1` → Fake (default and `SMS_FAKE_CODE`); all three Twilio → Twilio; partial Twilio → None with warning naming `TWILIO_AUTH_TOKEN`; partial Twilio + fake → Fake. |
| 5 | No log line or exception message holds a full phone or the auth token | PASS, with caveat | With Twilio messages echoing `+421905123456`, `421905123456` (also near the 200-char cut), the log has `***456` only; token absent from log and from `repr(Settings)`. Caveat: a spaced echo `+421 905 123 456` is not masked (see note A). Our `To` is always E.164, so Twilio does not echo that form. |
| 6 | Limits in `config/app.yaml`; exceeding gives `rate_limited` with `params.retry_after` | PASS, with caveat | Limits: 1/60 s (t=59 blocked, t=60 allowed); 5/h per party (6th at t=300 → 3300 s); 10/h per IP (11th → 3590 s); rejected sends consume no quota (7th at t=300 still 3300; t=3600 allowed again); code attempts 5 allowed, 6th → 600 s. `rate_limited` maps to 429 in `ERROR_STATUS`. `SmsLimits` returns seconds; the endpoint tasks raise `rate_limited` (see note B). |
| 7 | `uv run pytest` passes | PASS | 672 passed. |

**Extra scenarios**
- Non-object JSON on 500 and 400 error statuses (list, null), `message: null`, phone with spaces, phone at the truncation edge, `repr(Settings)` with secrets.
- Sliding window edges: t=59 vs t=60 for the interval, t=3600 release of the first party-hour hit.

**Notes (not failures)**
- A. `_twilio_error` masks only the E.164 form and the form without `+`. A spaced echo would leak in a log line. Low risk because `To` is sent as E.164. A digits-only comparison would close it.
- B. The criterion says `rate_limited` with `params.retry_after`. `SmsLimits` gives seconds; the raise belongs to the endpoint tasks (T-092+). Same as round 1.
- C. Cosmetic: a 200 with non-object JSON logs "returned a body that is not JSON". The message is slightly off.

**Manual** (already in `tests/manual.md` line 149): real Twilio send, check and wrong-token 503 with a real phone.

**Result: PASS.** All seven criteria pass; no regressions. Task moved to `tasks/done/`. Notes A to C are for the organizer and the endpoint tasks, not blocking.
