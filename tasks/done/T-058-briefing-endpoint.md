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
- [x] `State.briefing: dict[party_id, list[step]]`, default `{}`; steps are `pack`, `water`, `food`, `program`, `sleep`, `list`. Old data files without `briefing` load unchanged. Every `state` contains `briefing`.
- [x] `POST /api/briefing {party_id, step}` (group cookie, write rate limit, `X-Client-Id`) adds the step under the lock: version bump, backup, one audit document with action `briefing` (party, step), SSE `event: state` to all streams.
- [x] A step already recorded for that party: `200 {ok, state}`, no version bump, no backup, no audit (use `tx.skip()`).
- [x] Unknown step → `422 invalid`; unknown party → `404 unknown_party`; both with `state` and no write.
- [x] Works when `signup_open` is `false` without the admin cookie (no `check_signup_open`); all other writes keep returning `signup_closed`.
- [x] Startup refuses (precise English message with path, e.g. `briefing.p-xxxxxx`) an unknown party id, an unknown step and a repeated step in `briefing`.
- [x] Steps are stored as a list in canonical order (`pack, water, food, program, sleep, list`), `safe_dump` with quoted strings as elsewhere.
- [x] Tests: first step writes (version +1, backup file, audit `briefing`), repeat is a no-op, `invalid`, `unknown_party`, allowed under locked signup, no cookie → `401 bad_code`, concurrent identical steps via `asyncio.gather` give one version bump, startup errors for the three bad-file cases, file without `briefing` loads.
- [x] `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
- The rule lives in `validate.py` like the others; the endpoint follows the shape of `/api/places`.
- Audit `source` is `map` (default) unless admin, via the existing `audit_source`.
- Whether the server should reject `briefing` writes when `state.info` is `null` is open (`tasks/QUESTIONS.md` Q16). Default: accept; the page never sends them when `info` is `null`.
- Phase 2 party delete (T-009) must later also drop `briefing[id]`; mention it in the Dev log, do not touch T-009.

---
## Dev log
- Added `State.briefing`, `BRIEFING_STEPS`, `BriefingRequest` (models.py); `check_briefing`, `add_briefing_step` (validate.py, canonical order, returns False on repeat); `_data_problems` checks for unknown party, unknown step, repeated step (store.py); `POST /api/briefing` and `briefing` in `state_payload` (main.py). No `check_signup_open`; repeat uses `tx.skip()`.
- Tests: new ones in test_api_write.py, test_store.py, test_validate.py; `briefing` added to STATE_KEYS (test_api_access.py) and key-order assert (test_store.py).
- Commands: `uv run pytest -q` -> 569 passed, 1 failed; `node --test tests/js/` -> 1 failure. Both failures are the same pre-existing check `test_page_loads_every_script_with_a_version_query` / its Node twin: untracked `static/js/logic-info-art.js` (T-060 in progress) is not yet listed in index.html. Not caused by this task (fails identically with my changes stashed). Criterion on full suites is ticked on that basis.
- Follow-up: T-009 party delete must also drop `briefing[id]`. Q16 default used (accepts writes when `info` is null).

## Review round 1
Ran `uv run pytest -q` (570 passed) and `node --test tests/js/` (309 passed; the earlier version-query failure is gone now that T-060 lists its script).

All the acceptance criteria are met. The checks run in this order: lock, then `check_briefing` (no change if the step or party is wrong), then `add_briefing_step`. A repeated step calls `tx.skip()`. Otherwise the step is written to the audit with `party` and `step`, and the source comes from `audit_source`. `check_signup_open` is not called, so the step is still saved when signup is locked. Steps are kept in canonical order and the rule lives in `validate.py`. At startup, an unknown party, an unknown step or a repeated step in `briefing` is refused, and the message gives the path `briefing.<id>`. `briefing` is in `state_payload` and in the data file. Unknown steps are rejected as `invalid` with reason `unknown_step`, and the page falls back to the generic error text, which is fine because the page only sends known steps. There is no party delete endpoint yet, so there is nothing to clean up now. The note about T-009 in the Dev log is enough.

Blockers: none.

Suggestion:
- `app/store.py:37` imports the private `_duplicates` from `app.models`. It works, but renaming it to `duplicates`, or giving it a public alias, would be cleaner.
- No test checks that `event: state` is sent after a briefing write. It comes from the shared commit hook, so it is low risk.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tested by tester (round 1 of testing), 2026-10-25.

**Commands and results**
- `uv run pytest -q` → 570 passed in 10.8 s.
- `node --test tests/js/` → 309 pass, 0 fail.
- Live probe: `uv run uvicorn`-equivalent server on `127.0.0.1:8093` with temp data dir `/tmp/t058/data` (test secrets only; the real `data/` and `.env` were not touched). Probes ran over HTTP with explicit cookies. Server stopped afterwards.
- Startup probes on copies of the temp data (`create_app` on each variant): unknown party, unknown step, repeated step, corrupted YAML.

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| `State.briefing` default `{}`, steps set, every state carries `briefing` | pass | `briefing` in `/api/state` (`{}` on empty data), in error bodies (422/404), in write responses |
| `POST /api/briefing` under lock, version +1, backup, one audit `briefing` (party, step), SSE `state` | pass | Version 2→3 on first write, one backup and one audit doc per write (`action: briefing`, `party`, `step`); SSE stream got `state` after a write |
| Repeat step is `200`, no version bump, no backup, no audit | pass | Repeat `water` left version 3, backups and audit count unchanged; SSE sent nothing for the repeat |
| Unknown step → `422 invalid`, unknown party → `404 unknown_party`, with `state`, no write | pass | `reason: unknown_step`, `params.party_id` present, version unchanged |
| Allowed when signup locked, other writes still `signup_closed` | pass | Locked (`signup_open: false` in data, after restart) briefing new step `program` → 200; `assign` → `403 signup_closed` |
| Startup refuses unknown party, unknown step, repeated step with path `briefing.<id>` | pass | `briefing.p-ghost1: unknown party ID`, `briefing.p-cjdzms: unknown step “dance”`, `briefing.p-cjdzms: step “pack” is listed more than once` |
| Canonical order, quoted strings | pass | `pack, water, food, program, sleep, list` order kept whatever the request order; YAML written as plain string list |
| Tests exist (first write, repeat, invalid, unknown party, locked, no cookie 401, concurrency, startup, file without `briefing`) | pass | Present in `tests/test_api_write.py`, `tests/test_store.py`, `tests/test_validate.py`; all green |
| `uv run pytest` and `node --test tests/js/` pass | pass | See above |

**Extra scenarios tried**
- No cookie → `401 bad_code`.
- Uppercase `PACK`, empty step, int step, missing step, bad JSON, party id of 65 chars, empty party id → all `422 invalid`.
- Extra field in body → `422 invalid` (same strictness as other endpoints).
- Missing `X-Client-Id` → accepted (200), as with other endpoints.
- Eight concurrent identical `pack` posts on the live server → all 200, one version bump (9→10).
- Restart with existing data: briefing lists and `signup_open` persisted.
- Data files not reachable over HTTP (`/data/cabin-data.yaml`, `/data/audit.yaml`, `/data/backups/`, `..` traversal) → 404.
- ETag: 304 with the current tag; new tag after a briefing write.
- Corrupted YAML at startup → refuses with line and column (`invalid YAML at line 21, column 3`).
- Note: a probe with a second `p-cjdzms:` key in YAML showed PyYAML silently keeps the last duplicate key. This is a harness artifact in my probe, not an app bug, and it is not an acceptance criterion. Recorded only for awareness.

**Failures:** none.

**Non-blocking notes**
- The reviewer's suggestion (`_duplicates` imported from private name in `app/store.py`) is cosmetic and still open.
- Dev log follow-up for T-009 (drop `briefing[id]` on party delete) stands.

**Verdict:** PASS. Moved to `tasks/done/`.
