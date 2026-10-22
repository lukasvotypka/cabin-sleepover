# T-001: Project skeleton, config, Pydantic models and `validate.py` rules

- **Phase:** 1
- **Depends on:** none
- **Size:** M

## Goal
Lay the Python foundation. That means dependencies, both config files exactly as in the proposal, the Pydantic models, and every write rule as pure functions in `app/validate.py`, all with tests. Proposal sections: „Výstupy a podklady“, „Dáta v YAML“, „Rozloženie chaty“, „Bezpečnosť a limity“ (input limits), „HTTP API“ (error codes).

## Scope
- `pyproject.toml` (Python 3.12, runtime deps: fastapi, pydantic v2, pyyaml, uvicorn, itsdangerous; dev deps: pytest, httpx, pytest-asyncio or anyio)
- `.gitignore` (`data/`, `.env`, `.venv/`, `__pycache__/`), `.env.example` (`GROUP_CODE`, `ADMIN_CODE`, `SECRET_KEY` with placeholder values)
- `config/chata.yaml`: copy of the YAML in „Rozloženie chaty“, including the full `map.scene` block (7 rects)
- `config/app.yaml`: copy of the YAML in „config/app.yaml“
- `app/__init__.py`, `app/models.py`, `app/validate.py`
- `tests/conftest.py`, `tests/test_models.py`, `tests/test_validate.py`

## Acceptance criteria
- [x] `pip install -e '.[dev]'` (or `uv sync`) works on Python 3.12, and `pytest` runs green.
- [x] `config/chata.yaml` matches the proposal: 6 rooms, 12 beds, 20 slots, of which 2 are tight (`chodba-gauc-2`, `kuchynka-pec-2`), nights `2026-10-29`, `2026-10-30`, `2026-10-31`. All dates are quoted strings.
- [x] `map.scene` in `config/chata.yaml` has the rects from the proposal: `title: [176, 10, 196, 44]`, `nights: [176, 60, 196, 44]`, `notice: [176, 112, 196, 66]`, `status: [278, 322, 94, 88]`, `locked: [16, 190, 62, 56]`, `letter: [128, 336, 44, 44]`, `key: [184, 336, 44, 44]`.
- [x] Models in `app/models.py`:
  - [x] the layout and event (`Event`, `Room`, `Bed`, with `kind` limited to `bed2`, `bunk`, `mats`, `sofa`, `sofa1`, `stove`, `bed1`, `cot`, and `rect` as 4 ints)
  - [x] the map (`viewbox`, `paths`, `doors`, `windows`, and `scene` with the 7 named rects, each 4 ints). A missing scene rect fails loading with a message that names it. Tested.
  - [x] `AppConfig`
  - [x] `Party`
  - [x] the data file / `State` (`version`, `updated_at`, `signup_open`, `parties`, `sleeping`)
  - [x] request models for `assign` (`{night, slots[], party_id}`), `assign-stay` (`{slots[], party_id}`), `clear`, `move`, party create/update and `admin/signup`
  - [x] an `assign` or `assign-stay` request with empty `slots`, or with the same slot twice, is rejected as `invalid`. Tested.
- [x] Loading `chata.yaml` fails with a precise message on duplicate slot IDs, duplicate bed or room IDs, a `tight` slot that is not among the bed's slots, an unknown `kind`, or a night that is not an arrive day. Tests cover each case.
- [x] Party input limits (proposal „Vstupy“):
  - [x] name: trimmed, non-empty, max 60 characters
  - [x] `arrival_time`: max 60 characters
  - [x] `note`: max 300 characters
  - [x] `adults`, `kids`, `kids_in_parents_bed`: integers 0–20
  - [x] `kids_in_parents_bed ≤ kids`
  - [x] unknown fields are rejected
  - [x] tests cover each limit at the boundary and one past it
- [x] `Party.color` must match `#RRGGBB`. `id` must match `p-` plus 6 characters.
- [x] `app/validate.py` holds pure functions only (no I/O, no FastAPI imports). Each takes the state and layout and returns or raises a rule error carrying `code`, a Slovak `message` and an HTTP status.
- [x] `validate.py` covers presence and needed slots:
  - [x] presence: `arrive ≤ night < leave`
  - [x] needed slots: `adults + kids − kids_in_parents_bed`
- [x] `assign` rules (all or nothing over `slots[]`, proposal „Endpointy“):
  - [x] `unknown_slot` 404 if any slot is unknown
  - [x] `unknown_party` 404
  - [x] a night outside the event is `invalid` 422
  - [x] `not_present` 409
  - [x] `slot_taken` 409 if **any** listed slot is taken, with a message that names the occupying party and the day, e.g. „Toto miesto má v sobotu už Riso a Ben.“
  - [x] one bad slot rejects the whole request, so the function returns either all slots to write or an error, never a partial list
  - [x] no refusal when the party ends up with more slots than it needs (Q4)
- [x] `assign-stay` rules (Q13):
  - [x] for each night of the party's stay, either all listed slots are free and the night is written, or the whole night goes into `skipped`
  - [x] if every night is skipped, the result is `slot_taken` 409
  - [x] tests cover a night with one of two slots taken (whole night skipped, other nights written) and every night skipped
- [x] `clear` rules: unknown slot or night is an error.
- [x] `move` rules, all or nothing:
  - [x] `nights` is non-empty and every night is valid
  - [x] the party holds `from_slot` in every listed night
  - [x] `to_slot` is free in every listed night
  - [x] any single failure rejects the whole move
- [x] Party rules:
  - [x] `duplicate_name` 409, case-insensitive and ignoring the party's own name on rename
  - [x] `arrive` must be in `arrive_days` and `leave` in `leave_days`, with `arrive < leave` (`invalid` 422)
  - [x] stay shortening returns the list of `{night, slot}` that fall outside the new stay (the future `freed`)
- [x] Signup rule: when `signup_open` is false, a write without admin returns `signup_closed` 403, and the same write with admin passes.
- [x] `tests/test_validate.py` has at least one passing and one failing case for each rule above. That covers taken slot, multi-slot `assign` where one of two slots is taken (whole request rejected), presence, move (including a partial conflict in one of several nights), stay shortening and duplicate name.

## Notes for developer
- Rules live **only** in `validate.py`. Input shape and limits belong in the models. The server always re-checks, and the page will only pre-check.
- Dates stay ISO strings everywhere (`"2026-10-29"`). String comparison is enough for presence. Never let PyYAML turn them into `date` objects. Always use `yaml.safe_load`.
- Slovak day names for messages: the nights are Thursday, Friday and Saturday. The locative forms are „vo štvrtok“ (note *vo*), „v piatok“ and „v sobotu“. Derive them from the date, not from a hardcoded list of the three nights.
- The 12-color palette is **not** part of this task. It is used in T-004.
- `layout` (with `map.scene`) is sent to the page as-is in `/api/state`. Keep the YAML key names, because the page reads them directly.
- Scene rects are the organizer's decision (Q9, Q11). Copy them exactly from the proposal.
- Organizer decisions from `tasks/QUESTIONS.md`:
  - `assign` takes `slots[]` and is all or nothing (Q3); `assign-stay` takes `slots[]` and is all or nothing per night (Q13)
  - the server never refuses extra slots, and the page only shows an amber note (Q4)
  - `assign-stay` with every night taken is `slot_taken`, and `clear` on a free slot is a no-op (Q5)
  - `kids_in_parents_bed ≤ kids` (Q10)
- Open decision „Môže sa kamarát zapísať na noc, keď nie je na chate?“: default **no**, so `not_present`.
- Open decision „Skutočné rozloženie postelí“: default is the layout from the preview. Keep everything data-driven and put no geometry in code.
- `CLAUDE.md` asks to be updated once real build and test commands exist. Record the commands in the Dev log and leave `CLAUDE.md` to the organizer.

---
## Dev log

### Instructions applied mid-task (from the coordinator, they override the task text)
1. **uv only.** Python 3.12 via uv (`.python-version` = `3.12`), deps added with `uv add`, dev deps with `uv add --dev` (PEP 735 `[dependency-groups]`), `uv.lock` is kept in the repo (not git-ignored), everything runs through `uv run`. An earlier `python3.12 -m venv` attempt failed and was deleted before anything was installed. No pip, no requirements.txt. The first acceptance item says `pip install -e '.[dev]'` (or `uv sync`); the uv path was verified (fresh `.venv` removed, `uv sync`, `uv run pytest`).
2. **Language rules (final version, after a short-lived “everything English” message that was withdrawn).** Code, identifiers, comments, docstrings, config/startup errors, tests and `.env.example` are English. The UI stays Slovak, and so does the organizer’s data: `config/chata.yaml` is a verbatim copy of the proposal again (Slovak event, room and bed names, Slovak YAML comments). **The server sends no Slovak text.** `RuleError` now carries `code`, a short static English `message` (developer text only) and `params`; there are no Slovak strings in `app/`. I removed `day_phrase` (the Slovak weekday forms „v sobotu“ / „vo štvrtok“ are now the page’s job, derived from `params.night`). The earlier English user-facing messages (“This spot is already taken on Saturday by …”) were replaced by params.

### `params` produced by `validate.py` (the contract for T-004 and the page)
- `slot_taken`: `{night, slot, party_id, party_name, own}` (holder of the slot; `own` is true when the holder is the requesting party; `party_id`/`party_name` are `None` for a dangling id). For `assign-stay` with every night taken: the first conflict plus `skipped` (all stay nights).
- `not_present`: `{night, party_id, party_name}`.
- `unknown_slot`: `{slot}`. `unknown_party`: `{party_id}`. `signup_closed`: `{}`.
- `duplicate_name`: `{field: "name", party_id, party_name}` of the existing party.
- `invalid`: always has `reason` and usually `field`. Reasons: `night_outside_event` (`night`), `empty_list` (`field` = `slots` or `nights`), `duplicate_slot`, `same_slot` (`slot`), `not_holding` (`night`, `slot`, `party_id`, `party_name`; party does not hold `from_slot` on that night), `arrive_not_allowed` (`arrive`), `leave_not_allowed` (`leave`), `leave_not_after_arrive`, `no_event_nights` (`party_id`, `party_name`).
- `bad_code`, `forbidden`, `rate_limited` are not produced here (T-003); `ERROR_STATUS` already lists them.
- Pydantic `ValidationError`s from request models are not converted here. T-004 must turn them into `invalid` 422 with `params.field` taken from the error location and an English `message`.

### What was done
- Project skeleton: `pyproject.toml` (setuptools backend, package `app`, pytest config with `asyncio_mode = "auto"`), `.python-version`, `uv.lock`, `.gitignore`, `.env.example`, `app/__init__.py`.
- `config/chata.yaml`: verbatim copy of the proposal YAML (6 rooms, 12 beds, 20 slots, 2 tight, all dates quoted, 7 scene rects, Slovak names). `config/app.yaml`: copy of the proposal.
- `app/models.py`: `Event`, `SceneRects`, `MapLayout`, `Bed`, `Room`, `Layout` (with `slot_ids`, `slot_order`, `tight_slots`), `Limits`/`AppConfig`, `PartyInput`/`PartyCreate`/`PartyUpdate`/`Party`, `State`, request models `AssignRequest`, `AssignStayRequest`, `ClearRequest`, `MoveRequest`, `SignupRequest`, plus loaders `load_layout`, `parse_layout`, `load_app_config`, `ConfigError`. Config errors come out as a multi-line message with the exact path, e.g. `map.scene.key: Field required` or `rooms[0].beds[0].kind: … (got: 'hammock')`.
- `app/validate.py`: `RuleError(code, message, params, status)` and `ERROR_STATUS`, `is_present`, `needed_slots`, `party_nights`, `find_party`, `occupant`, `check_signup_open`, `check_assign`, `check_assign_stay` (returns `StayPlan(slots, nights, skipped)`), `check_clear` (returns holder id, or `None` for a free slot = no-op), `check_move`, `check_party_name`, `check_stay`, `stay_shortening` (returns `[{night, slot}]`), `check_party_create`, `check_party_update` (returns the freed list), `check_party_delete` (returns all of the party’s `{night, slot}` entries). Imports only `dataclasses`, `typing` and `app.models`; a test enforces this.
- Tests: `tests/conftest.py`, `tests/test_models.py`, `tests/test_validate.py`.

### Commands
```
uv python pin 3.12
uv add fastapi pydantic pyyaml uvicorn itsdangerous
uv add --dev pytest pytest-asyncio httpx
uv sync                 # install everything from uv.lock
uv run pytest           # whole suite
uv run pytest tests/test_validate.py -q
```
Result of the first pass: `155 passed` (83 in test_models.py, 72 in test_validate.py); see the final count after review fixes below, no skips. Resolved versions: Python 3.12.11, pydantic 2.14.1, fastapi 0.159.0, pytest 9.1.1, pytest-asyncio 1.4.0.

### Decisions and deviations (for the reviewer)
- **Acceptance wording vs. the new error contract:** the criteria that say “Slovak `message`” (rule error) and “a message that names the occupying party and the day, e.g. „Toto miesto má v sobotu už Riso a Ben.“” are ticked as met in the new form: `message` is English, and `params` name the occupying party (`party_name`, `party_id`) and the night (`night`); the page builds the Slovak sentence. Tests assert `params`, not text. The task file’s criteria text was left as written.
- **Codes the task did not name:** a `move` where the party does not hold `from_slot` on a night, `from_slot == to_slot`, and an `assign-stay` for a party with no event nights are all `invalid` 422. The proposal has no better code (409 codes are limited to `slot_taken`, `not_present`, `duplicate_name`).
- **A slot the same party already holds counts as taken** in `assign`, `assign-stay` (that night is skipped) and `move` (`params.own` is true). This follows the literal rule “free or skipped”. Option for later if the page wants idempotent taps.
- **Check order in `assign`:** list shape (`invalid`), night (`invalid`), party (`unknown_party`), slots (`unknown_slot`), presence (`not_present`), then `slot_taken`. The first taken slot in request order is reported in `params`.
- **Empty/duplicate `slots` are rejected twice:** in the request models (pydantic error that T-004 must map to `invalid` 422, see above) and defensively in `validate.py`. Request models use plain bounded strings for `night` and `party_id`, so a nonexistent party gives `unknown_party` 404 from `validate.py` rather than a 422 from the model.
- **Party `id` pattern** is `p-` plus 6 characters from `[A-Za-z0-9]`. T-004 must generate ids in that alphabet. `color` accepts upper and lower case hex.
- **Counts are strict ints** (a JSON string like `"2"` or `true` is rejected). Party text fields (`name`, `arrival_time`, `note`) are trimmed.
- **Extra helpers beyond the list:** `check_party_delete` (T-004 will need the freed list), `check_party_create`/`check_party_update` wrappers for T-004. `ERROR_STATUS` lives in `validate.py` so T-003 can reuse it for the error handler.
- **Layout models forbid unknown keys** (typos like `slotz` fail loudly). A room or bed name is any non-empty string up to 120 chars.
- **Not done here (belongs to T-002):** startup cross-check of the data file against `chata.yaml` (unknown slot, party or night), uniqueness of party ids and names inside a stored `State`, file creation. `State` only checks shape.
- `CLAUDE.md` is not updated (task note). The commands above are the ones to record there.

### Answers to Review round 1
- **Blocker 1 (unbounded request lists, quadratic `_duplicates`): fixed.**
  - `app/models.py`: new constants `MAX_SLOTS_PER_REQUEST = 32` and `MAX_NIGHTS_PER_REQUEST = 10`. `slots` in `AssignRequest` and `AssignStayRequest` and `MoveRequest.nights` now have `max_length` (the layout has 20 slots and the event 3 nights, so these are far above real use; the models do not know the layout, so the bounds are constants).
  - `_duplicates` is linear (a `set` for seen items and a `set` for reported ones, a list only for ordered output).
  - Tests: `test_slots_list_has_an_upper_bound` and `test_nights_list_has_an_upper_bound` (boundary and one past it), `test_huge_lists_are_rejected_fast` (300 000 items rejected in under 2 s), `test_duplicate_detection_is_linear` (200 000 items with many repeats under 1 s). The model layer rejects with a pydantic `ValidationError`, which T-004 maps to `invalid` 422 (see the contract above).
- **Suggestion: duplicate nights in a move: fixed.** Rejected in the model (`NightList` reuses the same unique check as `SlotList`, now named `_check_unique`) and defensively in `check_move` as `invalid` with `params {reason: "duplicate_night", field: "nights"}`. Tests: `test_move_rejects_duplicate_nights`, `test_move_duplicate_nights_invalid`.
- **Suggestion: strengthen the “no Slovak text” test: fixed.** `test_rule_error_texts_are_english_ascii_for_every_call` scans `app/validate.py` with `ast` and checks that every string literal given to `RuleError(...)` or `_invalid(...)` (messages, `reason` values, and params keys) is ASCII. `test_every_error_code_used_in_validate_is_known` checks the codes. `test_runtime_messages_are_ascii_for_all_rule_errors` triggers nine rule errors at runtime. The same AST scan can be pointed at `app/main.py` later.
- **Suggestion: control characters: fixed, with one deliberate difference.** `name` and `arrival_time` reject categories `Cc`, `Zl` and `Zp` (newlines, tabs, NUL, U+2028/9, etc.) after trimming, so a trailing newline is trimmed, not rejected. `note` rejects control characters **except tab, `\n` and `\r`**, because a note typed in a textarea may legitimately be multi-line (this follows the reviewer’s wording “but not in `note`”; the coordinator’s message asked for note as well, so say if you want newlines rejected there too, it is a one-line change). Tests: `test_single_line_fields_reject_control_characters` (8 characters x 2 fields), `test_trailing_newline_is_trimmed_not_rejected`, `test_note_allows_line_breaks_but_not_other_control_characters`.
- **Suggestion: NFC normalisation: fixed.** The party text fields (`name`, `arrival_time`, `note`) are normalised to NFC in the model, so stored names are consistent. `check_party_name` also compares `NFC(name).casefold()` for both sides, because a hand-edited data file may hold NFD names. `unicodedata` and `collections` were added to the purity whitelist in the import test (no I/O). Tests: `test_text_is_normalised_to_nfc`, `test_duplicate_name_ignores_unicode_composition`.
- **Nit: `keep` type hint: fixed** (`Callable[[str], bool] | None`).
- **Nit: comment that `Layout` is read-only after load: fixed** (one-line comment above the cached properties).
- **Nit: Slovak vs. translated comments in config files: not changed.** `config/chata.yaml` is organizer-owned and stays verbatim from the proposal. `config/app.yaml` comments are English; the organizer can pick one rule later, this has no effect on behaviour.

Result after the fixes: `uv run pytest` gives `183 passed` (no skips).

## Review round 1
Reviewer, 21. 10. 2026. I read every file in scope against proposal.md („Dáta v YAML“, „Rozloženie chaty“, „Odpoveď“, „Endpointy“, „Chybové kódy“, „Vstupy“), QUESTIONS.md (Q3, Q4, Q5, Q10, Q13) and the latest organizer decisions (English server messages with `params`, uv only).

**Test run (mine):** `uv sync --locked` is up to date. `uv run pytest -q` gives `155 passed in 0.09s`. `config/chata.yaml` is byte-identical to the proposal YAML block (checked with `diff`). `config/app.yaml` matches except that the `# fáza 2` comments are translated to `# phase 2`. No Slovak strings in `app/` (grep for non-ASCII shows only typographic quotes and math symbols in English text).

**Acceptance criteria:** all met in substance, and under the new error contract. The pip criterion is judged against uv and passes. The criteria about a „Slovak message“ and „a message naming the party and day“ are correctly met through `params` (`night`, `party_id`, `party_name`), as proposal „Odpoveď“ now requires. Presence (`arrive ≤ n < leave`), needed slots, all-or-nothing `assign`, per-night `assign-stay` with every night skipped giving `slot_taken`, `clear` returning `None` for the no-op, all-or-nothing `move` with a partial conflict, stay shortening, case-insensitive duplicate name with rename, signup lock with and without admin are all implemented and tested with passing and failing cases. `validate.py` is pure, and a test enforces its imports.

**Scope additions:** reasonable, not scope creep.
- `invalid` with `params.reason` (`night_outside_event`, `empty_list`, `duplicate_slot`, `same_slot`, `not_holding`, `arrive_not_allowed`, `leave_not_allowed`, `leave_not_after_arrive`, `no_event_nights`) is needed. Without Slovak text from the server, the page can only say something specific if it gets a machine-readable reason, so this is what the proposal's `params` are for. T-004 and T-006 must treat the reason list as a contract, and the Dev log documents it well.
- `check_party_delete`, `check_party_create` and `check_party_update` are thin compositions of the rules already required. They keep T-004 from rebuilding rule order in `main.py`, so they actually protect the rule that rules live only in `validate.py`. `own` in the `slot_taken` params is cheap and useful for the page. `ERROR_STATUS` in `validate.py` is fine.
- Choosing `invalid` 422 for `not_holding` and `same_slot` is defensible, because the proposal has no better code.

### Blocker
1. **Request lists have no size limit, and the duplicate check is quadratic, so one request can freeze the single-process server.** `app/models.py:252` (`SlotList = Annotated[list[SlotRef], Field(min_length=1), ...]`) has no `max_length`, and `app/models.py:275` (`MoveRequest.nights`) has none either. `_duplicates` (`app/models.py:73-80`) runs `item not in dupes` on a list, which is O(n·d). Measured here: 32 000 paired slot ids take 0.59 s inside `AssignRequest(...)`, growing about 4× per doubling. So a ~2.5 MB body with 256 000 ids blocks for roughly 35–40 s, and larger bodies block for minutes. FastAPI validates the body synchronously on the event loop of the one uvicorn worker, so every other user's poll and write hangs, and the 30 writes/min limit does not help, because one request is enough. Proposal „Vstupy: Pydantic modely s limitmi“ and the single-process requirement make this a spec and robustness issue. **Fix:** give `slots` a `max_length` (for example 20, the number of slots in a bed is far below it; or a named constant such as 32) and `MoveRequest.nights` a `max_length` (for example 10, or the night count). Make `_duplicates` linear by keeping a `set` for the dupes as well (keep a list only for ordered output). Add a test that an over-long `slots` / `nights` list is rejected by the model.

### Suggestion
- `MoveRequest.nights` and `check_move` accept the same night twice (`[FRI, FRI]` returns `[FRI, FRI]`). T-004 would then move twice and write two audit entries. Reject duplicates in the model, as for `slots` (reuse `_check_slots` under a generic name), or dedupe in `check_move`.
- `test_no_slovak_text_in_rule_messages` checks one message only. A stronger guard is an AST scan of `app/validate.py` (and later `app/main.py`) for string literals passed to `RuleError` / `_invalid`, asserting ASCII, or parametrising over every error path already in the tests.
- Party `name` (and `arrival_time`) accept control characters and embedded newlines (`"Ivan\nEva"`). They are harmless in the DOM via `textContent`, but they break the WhatsApp summary lines and the map label. Consider rejecting `\x00-\x1f` in `name` and `arrival_time` (but not in `note`, where newlines may be fine).
- `check_party_name` compares with `casefold()` only. Names typed on different devices can differ in Unicode composition (NFC vs NFD „ä“). If you add `unicodedata.normalize("NFC", …)`, add `unicodedata` to the purity whitelist in the test, since it does no I/O.

### Nit
- `_party_entries(..., keep=None)` in `app/validate.py:237`: `keep` has no type hint (`Callable[[str], bool] | None`).
- `config/app.yaml` translated the `# fáza 2` comments, but `config/chata.yaml` kept its Slovak comments. Either is fine. Pick one rule for organizer-owned config files.
- `Layout` uses `cached_property` on a mutable Pydantic model. That is fine as long as the layout is treated as read-only after load, and a one-line comment saying so would help T-002 and T-003.

Verdict: CHANGES REQUESTED

## Review round 2
Reviewer, 22. 10. 2026. I checked the round-1 blocker first, then did a fresh pass over `app/models.py`, `app/validate.py`, `tests/test_models.py` and `tests/test_validate.py`.

**Test run (mine):** `uv run pytest -q` gives `183 passed in 0.17s`.

**Round-1 blocker 1 (unbounded request lists, quadratic duplicate check): fixed.**
- `SlotList` (`app/models.py:287-289`) has `max_length=MAX_SLOTS_PER_REQUEST` (32), and the new `NightList` (`app/models.py:290-292`, used by `MoveRequest.nights`) has `max_length=MAX_NIGHTS_PER_REQUEST` (10). Both are far above real use (the largest bed has 3 slots, the event has 3 nights).
- `_duplicates` (`app/models.py:97-107`) is linear now, using a `set` for seen items and a `set` for reported ones.
- Tests cover the bound at the limit and one past it for both lists (`test_slots_list_has_an_upper_bound`, `test_nights_list_has_an_upper_bound`). They also check that a 300 000-item body is rejected quickly and that duplicate detection stays linear on 200 000 items. Requests can no longer stall the single worker.

**Round-1 suggestions and nits:** all were handled or answered with a reason.
- **Duplicate nights in a move:** rejected in the model (`NightList` with `_check_unique`) and also in `check_move` (`invalid`, `reason: duplicate_night`).
- **No Slovak text from the server:** an AST scan now asserts that every literal passed to `RuleError` / `_invalid` is ASCII. Nine rule errors are also checked at runtime.
- **Control characters:** `name` and `arrival_time` reject `Cc`/`Zl`/`Zp`. `note` keeps tab and line breaks, which the coordinator has accepted.
- **NFC:** text fields are normalised to NFC, and `check_party_name` compares NFC + casefold on both sides. The purity whitelist now allows only `unicodedata` and `collections` in addition to the original modules. Neither does I/O.
- **Nits:** the `keep` type hint and the read-only comment on `Layout` are done. The config-comment language nit is left to the organizer, which is fine.

**Fresh pass:** the rule logic is unchanged apart from `duplicate_night` and `_name_key`. Check order, `params` and error codes still match the Dev log contract and proposal „Odpoveď“ / „Chybové kódy“. No new scope creep.

### Blocker
None.

### Suggestion
- `name` still accepts Unicode format characters (category `Cf`). A name made only of a zero-width space (`"\u200b"`) passes `min_length=1` and becomes an invisible party in the list, the map label and the WhatsApp text. A bidi override (`"\u202e…"`) can flip how a name displays. The risk is low among friends. If you want to close it, reject names whose visible content is empty after removing `Cf` characters, or reject `U+202A–202E` / `U+2066–2069`. This can be a follow-up and does not need to block T-001.

### Nit
- In `PartyInput.name` / `arrival_time` / `note`, the `max_length` check runs before `_normalize_nfc`. NFC can lengthen a handful of rare code points (composition exclusions), so a stored value could slightly exceed the limit. It makes no practical difference here. Running NFC first (a `BeforeValidator`) would make the limit exact.
- `test_huge_lists_are_rejected_fast` and `test_duplicate_detection_is_linear` use wall-clock limits (2 s / 1 s). They are generous enough, but they could flake on a very slow CI machine. The `max_length` tests alone already guarantee the bound.

Verdict: APPROVED

## Test report
(tester appends)

Tester, 22. 10. 2026. Verified independently, not from the Dev log. No HTTP app exists yet, so I tested the models, `validate.py` rules and config loading directly with throw-away scripts in `/tmp/t001/` (outside the repo). I added no tests and changed no application code.

### Commands and results
- `uv sync --locked`: up to date, Python 3.12.11.
- `uv run pytest -q`: `183 passed in 0.14s`, no skips or warnings.
- Fresh-install check: copied the repo to `/tmp`, removed `.venv`, ran `uv sync`, `uv run python --version` (3.12.11), `uv run pytest -q`: `183 passed`.
- `uv run python /tmp/t001/probe.py` (config and model probes) and `uv run python /tmp/t001/probe2.py` (every `validate.py` rule on hand-built states): all results as expected (below).
- The Node tests do not exist yet (page logic comes in T-005 and later). Not applicable.
- Config check: the YAML block of „Rozloženie chaty“ in `proposal.md` is byte-identical to `config/chata.yaml`. `config/app.yaml` differs from the proposal block only in the translated comments (`# phase 2`), which is harmless.

### Acceptance criteria
| Criterion | Result |
| --- | --- |
| `uv sync` works on Python 3.12 and pytest is green (the `pip` wording judged as uv) | PASS |
| `chata.yaml`: 6 rooms, 12 beds, 20 slots, 2 tight (`chodba-gauc-2`, `kuchynka-pec-2`), nights 29/30/31 Oct, dates quoted strings | PASS (counts printed by `load_layout`; an unquoted date or `date` object is rejected) |
| `map.scene` has the 7 rects with the exact values | PASS (printed and compared) |
| Models for layout, map, `AppConfig`, `Party`, `State`, request models | PASS |
| `kind` limited to the 8 values, `rect` is 4 ints | PASS (`hammock` and a 3-item rect rejected) |
| Missing scene rect fails loading naming it | PASS (`map.scene.key: Field required`, same for `title`) |
| `assign` / `assign-stay` empty or duplicate `slots` rejected (also empty `move.nights`) | PASS (model rejects; `validate.py` also returns `invalid`) |
| Layout load errors: duplicate slot, bed, room IDs, tight slot not in bed, unknown kind, night not an arrive day | PASS (each gives a precise path and message) |
| Party limits: name trimmed, non-empty, max 60; arrival_time 60; note 300; counts 0-20 ints; `kids_in_parents_bed <= kids`; unknown fields rejected; boundary and one past | PASS (60/61, 300/301, 0/20/21/-1, 1.5, `"2"` and `True` rejected, `kids_in_parents_bed == kids` accepted) |
| `Party.color` `#RRGGBB`, `id` `p-` + 6 chars | PASS (`#ABC`, `AABBCC`, `#GGGGGG`, 5 and 7 char ids rejected) |
| `validate.py` pure (no I/O, no FastAPI); rule errors carry `code`, English message, status, params | PASS (imports are `unicodedata`, `collections.abc`, `dataclasses`, `typing`, `app.models`; state not mutated by a check) |
| Presence `arrive <= night < leave`, needed slots = adults + kids - in-parents-bed | PASS (4 for 2+3-1; present on the arrive night, not on the leave night) |
| `assign`: `unknown_slot` 404, `unknown_party` 404, night outside event `invalid` 422, `not_present` 409 (late arrival and already left), `slot_taken` 409 with party and night in `params`, all-or-nothing (one of two taken rejects the request), extra slots not refused | PASS |
| `assign-stay`: per-night all-or-nothing, one of two taken skips that night only, every night skipped is `slot_taken` 409 | PASS |
| `clear`: unknown slot or night is an error, free slot is a no-op (`None`) | PASS |
| `move`: empty nights, invalid night, not holding, conflict in one of three nights rejects the whole move, subset without conflict passes | PASS |
| Party rules: `duplicate_name` case-insensitive, trimmed, own name ignored on rename; `arrive`/`leave` allowed days and `arrive < leave`; stay shortening lists `{night, slot}` | PASS |
| Signup: closed without admin gives `signup_closed` 403, with admin passes, open passes | PASS |
| `tests/test_validate.py` has passing and failing cases for each rule | PASS (72 tests, plus the model tests) |

The criteria that say „Slovak message“ and the example sentence „Toto miesto má v sobotu už Riso a Ben.“ are judged against the latest decision (English `message`, Slovak text built by the page from `code` and `params`). `slot_taken` carries `night`, `slot`, `party_id`, `party_name` and `own`. PASS.

### Extra scenarios tried
- Layout loaded with a `datetime.date` in `event.nights`: rejected. A data file with an unquoted timestamp (`updated_at: 2026-10-01T10:00:00`, which PyYAML parses as `datetime`): `State` rejects it, a quoted one loads.
- Unknown extra field on a party: rejected. `"  Ivo  "` is trimmed to `"Ivo"`. `SignupRequest(open="yes")` is rejected (strict bool).
- Unknown slot hidden in a mixed list (`["valid", "zzz"]`) rejects the whole `assign` as `unknown_slot`.
- Check order is as documented: night `invalid` before `unknown_party`, `unknown_slot` before `not_present`, `not_present` before `slot_taken`.
- Scan of `app/` for non-ASCII outside typographic punctuation: no Slovak text in code.

### Observations (not failures, for later tasks)
- A party that taps a slot it already holds gets `slot_taken` with `params.own = true` (assign, assign-stay skips that night, move). This is a documented decision. T-004 and T-006 should treat `own: true` as a no-op or a clear action in the page, not as an error shown to the user.
- `State` checks shape only. Unknown slots, parties and nights in a stored file, and duplicate party IDs or names, are T-002's startup check.
- `tests/manualne.md` does not exist yet and nothing from T-001 needs a manual check (T-008 owns the file).

### Failures
None. Regressions: `tasks/done/` is empty, so there is nothing to regress.

Verdict: PASS, moved to `done/`.
