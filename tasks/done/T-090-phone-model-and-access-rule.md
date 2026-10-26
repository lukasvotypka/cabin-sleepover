# T-090: Phone on `Party`, phone normalization and `check_party_access`

- **Phase:** 1
- **Depends on:** none
- **Size:** M

## Goal
Data and pure rules for the phone login: proposal "Prihlásenie telefónom (SMS)" › "Čo je chránené" and "Telefónne číslo". No endpoints yet.

## Scope
- `app/models.py` (`Party.phone`, `Party.phone_set_at`), `app/validate.py` (`normalize_phone`, `phone_hint`, `is_protected`, `is_verified`, `check_party_access`), `app/main.py` (`state_payload` only)
- Tests in `tests/test_validate.py`, `tests/test_models.py`, `tests/test_store.py`, `tests/test_api_access.py`

## Acceptance criteria
- [x] `Party.phone` (E.164 string) and `Party.phone_set_at` (ISO string, quoted in YAML) are optional, written to `cabin-data.yaml` only when set; old files load unchanged.
- [x] Startup refuses (precise message with path) a stored `phone` that is not normalized E.164, and `phone` without `phone_set_at` or vice versa.
- [x] `normalize_phone(raw) -> str` per Q25 default: `"0905 123 456"`, `"0905-123-456"`, `"00421905123456"`, `"+421 905 123 456"` → `"+421905123456"`; `""`, `"abc"`, `"+12"`, too long → `RuleError` `invalid` with `params.field = "phone"`.
- [x] `phone_hint(party)` = last 3 digits, or `None` without phone.
- [x] `check_party_access(party, verified: Mapping[str, float], is_admin)` raises `login_required` (403) with `params.party_id` and `params.party_name` when the party has a phone, the admin flag is false and `verified` has no entry for it at or after `phone_set_at`; passes for unprotected parties and for admin. Error code `login_required` → 403 registered with the other codes.
- [x] `/api/state` and SSE `event: state` never contain `phone` or `phone_set_at`; a protected party carries `phone_hint`, an unprotected one has no `phone_hint` key (API test that greps the raw response body for the full number).
- [x] `POST`/`PUT /api/parties` with a `phone` field → `422 invalid` (extra field); `PUT` keeps stored `phone` and `phone_set_at` (test).
- [x] `uv run pytest` passes.

## Notes for developer
- Keep the rule only in `validate.py`; endpoints call it later (T-092 to T-094).
- Compare verification time against `phone_set_at` with `>=`; T-094 sets both from the same timestamp.
- Open decision "Prihlásenie telefónom": default home `0` = `+421`, state shows only 3 digits. Format details: `tasks/QUESTIONS.md` Q25.
- T-009 (phase 2 export) would expose the phone in the YAML download; not in scope here.

---
## Dev log
- Added `Party.phone`/`phone_set_at` (E.164 pattern, both-or-neither, omitted when unset) in `app/models.py`; `login_required` 403, `normalize_phone`, `phone_hint`, `is_protected`, `is_verified`, `check_party_access` in `app/validate.py`; `public_party()` in `app/main.py` strips phone fields and adds `phone_hint` (used by `state_payload`, which also feeds SSE, and by the `party` in create/update responses).
- Tests: `tests/test_validate.py`, `test_models.py`, `test_store.py`, `test_api_access.py`. `re` allowed in the validate import-purity test.
- Run: `uv run pytest` -> 644 passed.
- Q25 default format used; `phone_hint` shows last 3 digits. PUT keeps phone since it only copies `PartyInput` fields.

## Review round 1
Scope checked: `public_party`/`state_payload` in `app/main.py` (the SMS settings/runtime lines there are T-091), `Party.phone`/`phone_set_at` in `app/models.py`, phone section of `app/validate.py`, tests in the four test files.

Tests: task files 414 passed; full `uv run pytest` 665 passed (includes T-091 work in progress).

All acceptance criteria met: the model regex and pair validator work and startup errors include the path and `parties[0]`. Normalization matches Q25. `check_party_access` uses `>=` and returns the right params, and `login_required` maps to 403. `state_payload` is shared by `/api/state`, the SSE initial frame and the commit hook, so the phone never goes out. The create/update responses use `public_party` too. `extra=forbid` rejects `phone` in the forms, and PUT keeps the stored values.

**Blockers:** none.

**Suggestions**
- `app/models.py` `_check_iso_datetime` accepts naive timestamps. A hand-edited `phone_set_at` without an offset would be read as host-local time in `is_verified` (UTC in Docker). T-094 writes `now_iso()` with an offset, so this is fine in practice. A future task could require an offset for `phone_set_at`.
- The E.164 pattern appears twice (`app/models.py` Party field and `app/validate.py` `_PHONE_RE`). It could be one shared constant in `models.py`.
- `logic-errors.js` has no `login_required` entry yet. That is expected for T-092 to T-094; until then the generic fallback applies.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (round 1, 2026-10-25). Environment: `export PATH=/opt/homebrew/bin:$PATH` (uv and node live in Homebrew, not on the default PATH).

Commands and results:
- `uv run pytest -q` → 665 passed (includes T-091 work in progress, which is outside this task's scope).
- `node --test tests/js/` → 333 pass, 0 fail.
- Independent probe `/tmp/t073probe/probe.py` (outside the repo, temp data dirs only) → 43 of 45 checks passed. The 2 "fails" were a bug in my probe (wrong epoch constant for `2026-10-25T10:00:00+02:00`, which is 1792915200); the code is correct, rechecked: exact time passes, `set_at - 1` fails, `set_at + 500` passes.
- `/tmp/t073probe/audit.py` → confirms the audit leak below.

Acceptance criteria:

| Criterion | Result | Evidence |
| --- | --- | --- |
| `phone`/`phone_set_at` optional, written only when set, old files load | pass | create via API writes no phone keys; restart with existing data works; YAML `phone_set_at` is quoted |
| Startup refuses non-E.164 phone, phone without `phone_set_at` and vice versa, message with path | pass | 5 bad files refused, message starts with the `cabin-data.yaml` path |
| `normalize_phone` examples and rejects | pass | all 4 listed forms give `+421905123456`; rejected `""`, `"abc"`, `"+12"`, 16-digit, 17-digit, `"0"`, `"00"`, `"+0421..."` as `invalid` with `params.field="phone"` |
| `phone_hint` | pass | `"456"`; `None` without phone |
| `check_party_access` (login_required 403 with params, pass for unprotected/admin, `>=` boundary) | pass | params `{party_id, party_name}`; boundary checked exactly; `login_required` → 403 in `ERROR_STATUS` |
| `/api/state` and SSE never carry phone; `phone_hint` only when protected | pass | raw body grep for full number and `905123456` negative; SSE uses `state_payload` (same function, read in code) |
| POST/PUT with `phone` → 422 `invalid`; PUT keeps phone | pass | both 422; PUT rename keeps phone and phone_set_at in YAML |
| `uv run pytest` passes | pass | 665 passed |

Spec rule failing (cited by the Goal, section "Telefónne číslo" of `proposal.md`: „Číslo **nikdy** nejde do ... auditu ... v plnom tvare. Audit zapíše iba `phone_hint`.")

**Bug 1: full phone number is written to `data/audit.yaml`.**
- Steps: start the app on a temp data dir, create a party, set `phone: "+421905123456"` and `phone_set_at` in `cabin-data.yaml` (no endpoint yet), restart, `PUT /api/parties/{id}` with a new name (any valid body).
- Expected: `audit.yaml` contains `phone_hint: '456'` at most, never the full number or the last 9 digits.
- Actual: the audit entry's `before` and `after` are `party.model_dump()`, which includes `phone: '+421905123456'` and `phone_set_at`. The same happens for `POST /api/parties` once a phone exists on the party (create_party `after=party.model_dump()`). Probe result: `audit contains full number: True`.
- Where: `app/main.py` `create_party` and `update_party` pass `model_dump()` to `tx.audit`. Fix idea: dump with `exclude={"phone", "phone_set_at"}` and add `phone_hint`, the same way `public_party` does. Add a test that greps `audit.yaml` for the full number after a PUT on a protected party.

Not a failure, notes for the developer:
- `phone_set_at` accepts a naive timestamp without an offset (`2026-10-25T10:00:00`). A hand-edited file would then be compared in host-local time. The reviewer raised this too. Consider requiring an offset (T-094 writes offsets, so it is not urgent).

Verdict: all listed criteria pass, no regressions, but Bug 1 violates a rule that the task's Goal cites. Moved back to `in-progress`.

## Dev log (fix for test Bug 1)
- Fixed: `create_party` and `update_party` in `app/main.py` now audit `public_party(party)` (no `phone`/`phone_set_at`, only `phone_hint`) for `before` and `after`. Test added to `test_party_forms_reject_a_phone_and_keep_the_stored_one` in `tests/test_api_access.py`: `audit.yaml` has no full number or `phone_set_at`, and has `phone_hint: '456'`.
- Run: `uv run pytest` -> 667 passed.
- Naive `phone_set_at` note: not changed (T-094 writes offsets); left as a follow-up.

## Review re-check
Scope: tester Bug 1 fix only (`create_party`/`update_party` audit in `app/main.py`, new assertions in `tests/test_api_access.py`).

- Bug 1 fixed: both handlers now pass `public_party(party)` as `before`/`after` to `tx.audit`, so the audit gets `phone_hint` and never `phone` or `phone_set_at`. The other `tx.audit` calls in `app/main.py` and `app/store.py` record only ids, slots, steps or notes, never a party dump, so nothing else leaks the number.
- Test: `test_party_forms_reject_a_phone_and_keep_the_stored_one` reads `audit.yaml` and checks that the full number, the last 9 digits and `phone_set_at` are absent and that `phone_hint: '456'` is present.
- Tests: task files 414 passed, full `uv run pytest` 667 passed.

**Blockers:** none. The naive-`phone_set_at` suggestion is still open as a follow-up and does not block.

Verdict: APPROVED

Tester (round 2, 2026-10-25, re-test after Bug 1 fix). Environment: `export PATH=/opt/homebrew/bin:$PATH`. Only T-090 criteria were checked; T-091 work in the same checkout was not tested.

Commands and results:
- `uv run pytest -q` → 667 passed (full suite, includes T-091 work in progress).
- `node --test tests/js/` → 333 pass, 0 fail.
- `/tmp/t073probe/audit.py` (temp data dir, protected party, PUT rename) → `audit contains full number: False`, `contains 905123456: False`, audit has `phone_hint: '456'` only, no `phone_set_at`. Bug 1 is fixed. The full number still sits in `data/backups/` (a copy of the server-side data file, not the audit). That is expected and not a leak over HTTP.
- `/tmp/t073probe/probe.py` → 43 of 45 checks passed. Both "fails" are the known probe error (wrong epoch constant). Rechecked directly against `check_party_access`: exact `phone_set_at` passes, `set_at - 1` gives `login_required`, `set_at + 500` passes, admin passes.

Acceptance criteria:

| Criterion | Result | Evidence |
| --- | --- | --- |
| `phone`/`phone_set_at` optional, written only when set, old files load | pass | unprotected create writes no phone keys; restart with existing data works; `phone_set_at` quoted in YAML |
| Startup refuses bad phone, phone without `phone_set_at` and vice versa, message with path | pass | 5 bad files refused, message starts with the `cabin-data.yaml` path |
| `normalize_phone` examples and rejects | pass | 4 listed forms give `+421905123456`; `""`, `"abc"`, `"+12"`, too long, `"0"`, `"00"`, `"+0421…"` → `invalid`, `params.field="phone"` |
| `phone_hint` | pass | `"456"`; `None` without phone |
| `check_party_access` (login_required 403 with params, passes for unprotected and admin, `>=` boundary) | pass | params `{party_id, party_name}`; boundary checked exactly; `login_required` → 403 |
| `/api/state` and SSE never carry phone; `phone_hint` only when protected | pass | raw body has no full number after restart; unprotected party has no `phone_hint` key; SSE uses `state_payload` |
| POST/PUT with `phone` → 422 `invalid`; PUT keeps phone | pass | both 422; PUT rename keeps `phone` and `phone_set_at` |
| Audit never holds the full number (Goal, proposal "Telefónne číslo") | pass | Bug 1 from round 1 verified fixed (see above) |
| `uv run pytest` passes | pass | 667 passed |

Failures: none.

Not a failure, still open from round 1: `phone_set_at` accepts a naive timestamp without an offset. A hand-edited file would be compared in host-local time. Follow-up, not a criterion of this task.

Manual checks: none needed for T-090 (backend only).

Verdict: all criteria pass, no regressions. Moved to `done/`.
