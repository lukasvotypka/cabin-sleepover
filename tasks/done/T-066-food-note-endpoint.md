# T-066: `Party.food_note` and `POST /api/food`

- **Phase:** 1
- **Depends on:** none (shares `app/models.py` with T-065, so do not run them at the same time)
- **Size:** M

## Goal
Let each party store one free text „Čo kto donesie“ through the normal write path. See proposal "Pred cestou" › "Obsah podľa organizátora a „Čo kto donesie“" (last bullet) and the `POST /api/food` row in "HTTP API" › "Endpointy".

## Scope
- `app/models.py` (`Party.food_note`, `FoodRequest`), `app/validate.py` (`check_food`, `set_food_note`), `app/main.py` (endpoint)
- Tests in `tests/test_api_write.py`, `tests/test_validate.py`, `tests/test_store.py`

## Acceptance criteria
- [x] `Party.food_note: str` optional, stored in `cabin-data.yaml` only when set; old data files load unchanged; it is not part of the party form input, and `PUT /api/parties/{id}` keeps it (test).
- [x] `POST /api/food {party_id, text}` (group cookie, write rate limit, `X-Client-Id`): trims the text; a non-empty text sets `food_note`, an empty one removes the field. Under the lock: version bump, backup, one audit document with action `food` (party, before, after), SSE `event: state`.
- [x] Text longer than 120 characters after trimming → `422 invalid` with `params.reason` `too_long` (and `max: 120`), decided in `validate.py`, not by a Pydantic length error. Unknown party → `404 unknown_party`. Both return `state` and write nothing.
- [x] Works while `signup_open` is `false` without the admin cookie (no `check_signup_open`).
- [x] Startup refuses a stored `food_note` that is empty or longer than 120 characters (precise message with the path).
- [x] Tests: set, change, clear with `""` and with spaces only, too long (121 chars) vs. exactly 120, unknown party, locked signup allowed, no cookie → `401 bad_code`, audit content, unchanged text behaviour per Q21. `uv run pytest` passes.

## Notes for developer
- Follow the shape of `/api/briefing` and `/api/places`; the rule lives in `validate.py`.
- Text rules besides length are open (`tasks/QUESTIONS.md` Q21). Default: NFC and no control characters or line breaks, like the party name (existing `invalid` reason); the same text as stored is a no-op `200` via `tx.skip()` (no version bump, backup or audit).
- Open decision „Čo kto donesie“: default one text per party, anyone with the group code may edit it, everyone sees it.
- T-009 (phase 2 party delete) removes the party with its `food_note`; nothing extra needed.

---
## Dev log
- Added `Party.food_note` (1-120 chars, omitted from dumps when unset via a wrap serializer), `FoodRequest`, `check_food`/`set_food_note` in validate.py (reasons `too_long` with `max`, `control_chars`; NFC + trim per Q21 default; same text = `tx.skip()`), and `POST /api/food` (no `check_signup_open`).
- Files: app/models.py, app/validate.py, app/main.py, tests/test_api_write.py, tests/test_validate.py, tests/test_store.py.
- `PATH=/opt/homebrew/bin:$PATH uv run pytest` -> 603 passed.
- Follow-up: page must map `invalid` + reason `too_long`/`control_chars` for field `text` (T-068).

## Review round 1
Ran `uv run pytest -k food` (20 passed) and the full suite (603 passed).

All acceptance criteria are met. `POST /api/food` follows the `/api/briefing` shape: group cookie, `Limited`, lock, then `check_food` in `validate.py`, then `set_food_note`, then `tx.skip()` for a no-op or an audit with `party/before/after`. It does not call `check_signup_open`. The 120-character limit and the control-character rule live in `validate.py` and return stable reasons, and `FoodRequest.text` has no Pydantic length cap. `Party.food_note` is left out of dumps when unset through the wrap serializer, and old files load unchanged. `PartyCreate` rejects `food_note` (extra field gives 422), and `PUT` keeps it. Startup refuses an empty note or one of 121 characters, and the message names the file path and `parties[0].food_note`. The no-cookie 401 case is covered by the `WRITES` parametrization. The SSE `event: state` comes from the generic store commit hook. The server sends no Slovak text.

- **Suggestion:** Startup checks only the length of a stored `food_note`. A hand-edited note with a line break or leading spaces would still load. A model-level `AfterValidator(_reject_control_chars)` would close this gap, but the AC does not require it.
- **Suggestion:** The page needs to map `invalid` with reason `control_chars` (field `text`) as well as `too_long`. This is already noted as a follow-up for T-068.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester (server only, 2026-10-25, no browser, temp data in `/tmp/t066`, test secrets, port 8011/8012, both servers stopped).

Commands and results:
- `PATH=/opt/homebrew/bin:$PATH uv run pytest -q`: 603 passed (includes the tests already in `done/`, so no regressions).
- `node --test tests/js/`: 318 pass, 0 fail.
- Live probes with `curl` against a temp server (`POST /api/food`, `X-Client-Id` sent):
  - `"  chlieb a syr  "` → 200, stored trimmed; the same text again → 200, version unchanged (no-op).
  - `"   "` and `""` → 200, field removed (absent from `/api/state` and from `cabin-data.yaml`); version bumped for the spaces-only clear, unchanged for the empty no-op.
  - 120 chars → 200; 121 chars → 422 `invalid`, params `{reason: too_long, field: text, max: 120}`, state returned; 2 spaces + 120 + space → 200 (length measured after trim).
  - `a\nb`, `a\tb` → 422 `invalid`, reason `control_chars`. NFD `e`+combining caron → stored as NFC `ě`.
  - Unknown party → 404 `unknown_party`. Int or missing `text`, and an extra field → 422 `invalid`.
  - No cookie or bogus cookie → 401 `bad_code`.
  - Signup locked (`signup_open: false` in the file): group-cookie `food` → 200; `assign` → 403 `signup_closed` (control).
  - Audit: one `action: food` document per committed write with `party`, `before`, `after`, `source: map`, `client_id`. No document for the no-ops.
  - SSE `/api/events`: a `food` write from another client produced an `event: state` on an open stream.
  - `GET /data/cabin-data.yaml`, `/data/audit.yaml`, `/config/cabin.yaml` and the traversal path → 404.
  - Restart with existing data: the note survives and is served after restart.
  - Startup with `food_note: ""` → refused: `…/cabin-data.yaml: invalid file / parties[0].food_note: String should have at least 1 character`. With 121 chars → refused, same format with `at most 120`. Absent → starts.
- Observed gap, not in the AC (matches the reviewer's suggestion): startup accepts a hand-edited stored `food_note` containing a line break (`"a\nb"`), so the model does not enforce the control-character rule that the write path applies. Low severity. Nothing else failed.

Acceptance criteria:

| # | Criterion | Result |
|---|---|---|
| 1 | `Party.food_note` optional, stored only when set, old files load, not in the form, PUT keeps it | pass |
| 2 | `POST /api/food`: group cookie, rate limit, trim, set/clear, version bump, backup, audit `food`, SSE | pass |
| 3 | >120 after trim → 422 `invalid` `too_long` with `max: 120`; unknown party → 404; no writes on error | pass |
| 4 | Works with signup locked without admin cookie | pass |
| 5 | Startup refuses empty or >120 stored note, message with path | pass |
| 6 | Tests listed in the AC exist and pass | pass |

Verdict: PASS. Moved to `done/`.
