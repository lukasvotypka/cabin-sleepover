# T-058: Store `briefing` and add `POST /api/briefing`

- **Phase:** 1
- **Depends on:** T-057
- **Size:** M

## Goal
Record which parties went through „Pred cestou“, through the normal write path so everyone sees it live. See proposal "Pred cestou", subsection "Kto si to prešiel", and the `POST /api/briefing` row in "HTTP API" › "Endpointy".

## Scope
- `app/models.py` (`State.briefing`, `BriefingRequest`, step set), `app/validate.py` (`check_briefing`), `app/store.py` (startup check in `_data_problems`), `app/main.py` (endpoint, `briefing` in `state_payload`)
- New tests in `tests/test_api_write.py` (or new `tests/test_briefing.py`), `tests/test_store.py`, `tests/test_validate.py`

## Acceptance criteria
- [ ] `State.briefing: dict[party_id, list[step]]`, default `{}`; steps are `pack`, `water`, `food`, `program`, `sleep`, `list`. Old data files without `briefing` load unchanged. Every `state` contains `briefing`.
- [ ] `POST /api/briefing {party_id, step}` (group cookie, write rate limit, `X-Client-Id`) adds the step under the lock: version bump, backup, one audit document with action `briefing` (party, step), SSE `event: state` to all streams.
- [ ] A step already recorded for that party: `200 {ok, state}`, no version bump, no backup, no audit (use `tx.skip()`).
- [ ] Unknown step → `422 invalid`; unknown party → `404 unknown_party`; both with `state` and no write.
- [ ] Works when `signup_open` is `false` without the admin cookie (no `check_signup_open`); all other writes keep returning `signup_closed`.
- [ ] Startup refuses (precise English message with path, e.g. `briefing.p-xxxxxx`) an unknown party id, an unknown step and a repeated step in `briefing`.
- [ ] Steps are stored as a list in canonical order (`pack, water, food, program, sleep, list`), `safe_dump` with quoted strings as elsewhere.
- [ ] Tests: first step writes (version +1, backup file, audit `briefing`), repeat is a no-op, `invalid`, `unknown_party`, allowed under locked signup, no cookie → `401 bad_code`, concurrent identical steps via `asyncio.gather` give one version bump, startup errors for the three bad-file cases, file without `briefing` loads.
- [ ] `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
- The rule lives in `validate.py` like the others; the endpoint follows the shape of `/api/places`.
- Audit `source` is `map` (default) unless admin, via the existing `audit_source`.
- Whether the server should reject `briefing` writes when `state.info` is `null` is open (`tasks/QUESTIONS.md` Q16). Default: accept; the page never sends them when `info` is `null`.
- Phase 2 party delete (T-009) must later also drop `briefing[id]`; mention it in the Dev log, do not touch T-009.

---
## Dev log

## Review round 1

## Review round 2

## Test report
