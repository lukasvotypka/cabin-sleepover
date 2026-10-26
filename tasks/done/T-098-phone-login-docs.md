# T-098: Phone login docs, env and manual checklist

- **Phase:** 1
- **Depends on:** T-094
- **Size:** S

## Goal
Document and wire the Twilio settings for development, the trial server and Docker: proposal "Prihlásenie telefónom (SMS)" › "Overenie cez SMS (Twilio Verify)" and CLAUDE.md "Secrets".

## Scope
- `README.md`, `.env.example`, `compose.yaml`, `tests/manual.md`

## Acceptance criteria
- [x] `.env.example` lists `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` (empty), `SMS_FAKE` and `SMS_FAKE_CODE` with an English comment (fake only for development and the trial server).
- [ ] `compose.yaml` passes the three Twilio variables as optional (`${VAR:-}`, compose still starts without them) and never sets `SMS_FAKE`; `docker compose config` succeeds without them.
- [x] README (English): how protection works, Twilio Verify service setup, what happens without the variables (`sms_enabled` false, 503), how to remove a lost phone (admin cookie or editing `cabin-data.yaml` with the service stopped), and that the phone is never in state, SSE, audit or logs.
- [x] `tests/manual.md` gains steps: add phone with fake code, login on a second device, `login_required` on a third, change number invalidates old device, remove phone, real SMS once on production after the organizer asks.
- [x] No secret values committed.

## Notes for developer
- Production deploy is not part of this task.

---
## Dev log
- Edited `.env.example`, `compose.yaml`, `README.md` (new "Phone login (SMS)" subsection in section 5, variables in section 2), `tests/manual.md` (5 steps in section 9).
- compose: three Twilio vars as `${VAR:-}`, `SMS_FAKE` not passed. `docker compose config` NOT run (docker not installed here), so that criterion stays unticked for the tester.
- README mentions removing the number via the party form „Odstrániť“ (T-097 adds it).
- Docs only, no tests.

## Review round 1
Scope checked: `.env.example`, `compose.yaml`, `README.md`, `tests/manual.md` (T-097's `static/` changes ignored).

- Checked the docs against the code: `load_settings`/`build_sms_client` in `app/main.py` (all three Twilio vars needed or warn, `SMS_FAKE` 1/true/yes/on, `SMS_FAKE_CODE` defaults to `123456`), `sms_enabled` = client present, `phone_remove` goes through `check_access` (admin bypass), audit carries only `phone_hint`, `state_payload` drops `phone`/`phone_set_at`. The README statements match.
- compose: the three Twilio vars use `${VAR:-}`, `SMS_FAKE` is not passed. `compose.yaml` parses as YAML with the expected environment keys. `docker compose config` could not be run (no docker here either), so the tester has to check that criterion where docker exists. The `${VAR:-}` syntax is standard compose interpolation.
- The manual steps cover every required case. The quoted message text matches `login_required` in `logic-errors.js`, and „Pridať telefón“/„Odstrániť“ match the T-097 page code.
- No secret values committed. `.env.example` values are empty, and `123456` is the documented fake code.
- `uv run pytest`: 728 passed.

No blockers.

Suggestion: the README says the page hides "add a number". Quoting the real label „Pridať telefón“ would make it easier to find.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
- Tester (T-098), run from the repo root with `uv` at `/opt/homebrew/bin/uv` (not on the default PATH here).

**Commands and results**
- `uv run pytest -q`: 728 passed.
- `node --test tests/js/`: 349 pass, 0 fail (includes the T-097 logic tests that are in `review/`; this task touches no JS).
- `/Applications/Docker.app/Contents/Resources/bin/docker compose version`: v2.33.1. The daemon is NOT running (`docker info` cannot connect), but `compose config` does not need it.
- `env -i PATH=/usr/bin:/bin GROUP_CODE=dummy-group ADMIN_CODE=dummy-admin SECRET_KEY=<40 chars> docker compose config`: exit 0. Output has `TWILIO_ACCOUNT_SID: ""`, `TWILIO_AUTH_TOKEN: ""`, `TWILIO_VERIFY_SERVICE_SID: ""`, and no `SMS_FAKE`.
- Same with `TWILIO_*` and `SMS_FAKE=1` in the shell: the Twilio values are passed through, `SMS_FAKE` is still absent (count 0).
- Without `GROUP_CODE` (with `ADMIN_CODE` and `SECRET_KEY` set): exit 1, "required variable GROUP_CODE is missing". This is the existing `:?` rule for the three required secrets, not a Twilio issue. The criterion's wording "compose still starts without them" refers to the Twilio variables only.
- Privacy probe (in-process httpx against `create_app` with a temp data dir, `SMS_FAKE=1`, no port used): create a party, `phone/start` and `phone/verify` with a test number, then `DELETE .../phone`. Results: full number absent from `/api/state`, absent from `audit.yaml`, absent from the captured log output; `phone_hint` (last three digits) present in state and audit; the number is stored in `cabin-data.yaml` only. The log shows `FAKE SMS for ***456: code 123456` only. This backs the README privacy paragraph.
- Secret scan of README, `.env.example`, `compose.yaml`, `tests/manual.md` for Twilio-shaped SIDs (`AC`/`VA` + 32 hex) and long hex strings: none. `.env` and `data/` are not tracked.

**Acceptance criteria**

| # | Criterion | Result |
|---|---|---|
| 1 | `.env.example` lists the three Twilio vars (empty), `SMS_FAKE`, `SMS_FAKE_CODE`, with English comment | PASS |
| 2 | `compose.yaml` passes the three Twilio vars as `${VAR:-}`, never sets `SMS_FAKE`, `docker compose config` succeeds without them | PASS (config run with dummy required secrets; daemon not needed) |
| 3 | README (English): protection, Twilio Verify setup, no-variable behaviour (`sms_enabled` false, 503), lost phone removal, phone never in state/SSE/audit/logs | PASS (endpoints and codes checked against `app/main.py`; privacy checked by probe; SSE not probed, see notes) |
| 4 | `tests/manual.md` steps: fake-code add, second device login, `login_required` on third, change number, remove phone, real SMS once | PASS (5 items present) |
| 5 | No secret values committed | PASS |

**Extra checks**
- README endpoint and code names match the code: `GET /api/session` returns `sms_enabled`, `sms_unavailable` maps to 503, `DELETE /api/parties/{id}/phone`, `phone_hint` in audit.
- `.env.example` values are all empty except `SMS_FAKE_CODE=123456`, which is the documented fake code.

**Notes (not failures)**
- The SSE part of the privacy claim was not probed directly. The state and audit checks use the same serializer (`state_payload`), so the risk is low. Worth a look during the manual "no number in logs" item.
- Compose config checked only with `docker compose config`; no build or up was run, per instructions.

**Result: PASS, no bugs found.** Moved to `tasks/done/`.
