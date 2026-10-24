# T-031: Custom party color

- **Phase:** 1
- **Depends on:** none (T-001 … T-030 are done)
- **Size:** M

## Goal
Organizer request of 24. 10. 2026: a party may choose its own color when created and change it when edited, from the 12-color palette ("Vzhľad") or any color via `<input type="color">`. Without a choice the server still assigns `next_party_color` as today ("Dáta v YAML", "HTTP API" `POST/PUT /api/parties`). Existing parties keep their colors.

## Scope
- `app/models.py`: `PartyCreate` and `PartyUpdate` get `color: HexColor | None = None`; update the "Only the server picks them" comment.
- `app/validate.py`: pure `check_party_color(color)`, called from `check_party_create` / `check_party_update`.
- `app/main.py`: `create_party`, `update_party`.
- `static/js/logic-form.js`, `static/js/app-form.js`, `static/js/logic-errors.js`, `static/index.html` (CSS only if needed).
- `proposal.md`: lines on server-assigned color in "Dáta v YAML" and "Vzhľad" (note the organizer decision of 24. 10. 2026).
- Tests: `tests/test_validate.py`, `tests/test_models.py`, `tests/test_api_write.py`, `tests/js/logic.test.mjs`.

## Acceptance criteria
- [x] Format: `color` must match `^#[0-9A-Fa-f]{6}$`. `"#abc"`, `"red"`, `"#GGGGGG"`, `123` → 422 `invalid` with `params.field == "color"`.
- [x] Brightness: WCAG relative luminance `L` of the color must satisfy `0.06 ≤ L ≤ 0.36` (constants `COLOR_MIN_LUMINANCE`, `COLOR_MAX_LUMINANCE` in `validate.py`). `L > 0.36` → 422 `invalid`, `params = {reason: "color_too_light", field: "color", color}`; `L < 0.06` → `reason: "color_too_dark"`. Tests: `#FFFFFF`, `#E8D2A6` too light; `#000000`, `#222222` too dark; all 12 `PARTY_PALETTE` colors pass.
- [x] Stored color is upper-case (`#2f7d6d` is saved as `#2F7D6D`).
- [x] `POST /api/parties` with a valid `color` stores it; without `color` (or `null`) the party gets `next_party_color` exactly as before (existing tests still pass).
- [x] `PUT /api/parties/{id}` with `color` overrides it; without `color` (or `null`) the stored color stays unchanged. The brightness check runs only when the sent color differs (case-insensitive) from the stored one.
- [x] Two parties may have the same color (no conflict error).
- [x] `signup_closed` applies to color changes like any party edit; group cookie is enough (no admin).
- [x] Audit: `party-create` `after.color` is the chosen color; a color-only `party-update` has differing `before.color` / `after.color`.
- [x] Party form (Slovak, tykanie): field „Farba“ with 12 palette swatches (focusable buttons, `aria-pressed`, screen-reader label, ≥ 44 px targets) and „Vlastná farba“ (`<input type="color">`). On create a „Vyberie sa sama“ option is selected by default and the payload has no `color`; on edit the current color is preselected.
- [x] `logic-form.js`: pure `colorProblem(hex)` → `null | "color_format" | "color_too_light" | "color_too_dark"` with the same thresholds; the form pre-checks and shows the Slovak text next to the field. `partyToForm` / `partyPayload` carry `color` (omitted on create when „Vyberie sa sama“).
- [x] `logic-errors.js`: `FIELD_NAMES.color = "farba"`; `REASON_TEXTS.color_too_light` = „Táto farba je príliš svetlá, postavičku by na posteli nebolo vidno. Vyber tmavšiu.“, `color_too_dark` = „Táto farba je príliš tmavá, postavičku by na posteli nebolo vidno. Vyber svetlejšiu.“; `errorField` maps the error to the color field.
- [x] Node tests: `colorProblem` (palette passes, the four colors above fail, bad format), payload with/without color, `errorText` for both reasons.
- [x] `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
- Thresholds 0.06 / 0.36 are an analyst default: the palette spans L ≈ 0.126–0.295, the room floors ≈ 0.41–0.68. The organizer may tune them; keep the Python and JS constants equal (comment that they mirror each other).
- `Party(**body.model_dump(), color=...)` would raise a duplicate keyword: exclude `color` from the dump. In `update_party` the `setattr` loop must not write `color=None`.
- The shirt letter already picks dark/light ink via `shirtInk(color)`, so custom colors need no change there.
- Do not touch phase 2 (`llm.py`, `/api/ai/*`, the `propose_signup` schema). `CLAUDE.md` still says "The server assigns the color"; leave it, the orchestrator updates it.
- All values from people still via `textContent`; the color goes into SVG `fill` only after it passed `colorProblem`/server validation.

---
## Dev log

Implemented custom party color (create and edit).

- Backend: `PartyCreate` / `PartyUpdate` got `color: HexColor | None = None` (`app/models.py`); `validate.py` has `COLOR_MIN_LUMINANCE = 0.06`, `COLOR_MAX_LUMINANCE = 0.36`, `relative_luminance`, `check_party_color`, called from `check_party_create` and (only when the color differs case-insensitively from the stored one) `check_party_update`; `app/main.py` stores the color upper-case, falls back to `next_party_color`, and keeps the old color when `color` is missing/null. The bad-format 422 comes from the existing Pydantic error mapping (`params.field == "color"`).
- Page: `logic-form.js` (`PARTY_PALETTE`, luminance constants mirroring Python, `colorProblem`, `color` in `defaultPartyForm` / `partyToForm` / `partyPayload` (key omitted when empty), `checkPartyPayload(p, event, currentColor)`, `FORM_FIELDS`), `logic-errors.js` (`FIELD_NAMES.color`, two `REASON_TEXTS`), `app-form.js` (field „Farba“: „Vyberie sa sama“ on create only, 12 swatch buttons with `aria-pressed` and `aria-label`, „Vlastná farba“ `<input type="color">`), CSS in `static/index.html` (48 px targets).
- `proposal.md`: updated the line in „Dáta v YAML“/API section and the palette line in „Vzhľad“.
- Tests: added in `tests/test_validate.py`, `tests/test_models.py`, `tests/test_api_write.py`, `tests/js/logic.test.mjs`. In `test_models.py::test_unknown_party_fields_rejected` the unknown field used was `color`, now `id`.
- Commands: `uv run pytest` (433 passed), `node --test tests/js/` (211 passed).
- Not verified in a real browser (no DOM test harness); the swatch UI is covered only by the script parse test. Reviewer/tester should open the form on a phone.
- Note: swatches have screen-reader labels „Farba 1“ ... „Farba 12“ (no color names).

## Review round 1

Tests run by reviewer: `uv run pytest` 433 passed, `node --test tests/js/` 211 passed (with node on PATH; without it the two `test_map_layout.py` Node-backed tests fail for environment reasons only).

Checked: `HexColor` (strict + pattern) gives 422 `invalid` with `params.field == "color"` for `#abc`/`red`/`#GGGGGG`/`123`/`""`; luminance rule only in `validate.py` (`check_party_color`), called before any mutation under the lock; update skips the check for an unchanged color (case-insensitive); stored upper-case; `None`/missing keeps `next_party_color` on create and the old color on update (`setattr` loop excludes `color`); duplicate colors allowed; `signup_closed` and audit covered by API tests. JS `relLuminance` uses the same formula as Python and the constants mirror each other (tested). Swatches are `type="button"` with `aria-pressed`, 48 px, all text via `htmlEl`/`textContent`; color reaches `style.background` only from the fixed palette. Scripts in `static/js/` are all listed with `?v=__ASSET_VERSION__`. No llm.py touched. proposal.md notes the decision of 24. 10. 2026.

No blockers.

**Suggestion**
- `static/js/app-form.js` `colorField()`: the group `#pf-color` has no `aria-describedby="pf-color-err"` (other fields get it in `field()`), so when `showError` focuses the group a screen reader announces „Farba“ but not the error text. Add the attribute.
- Swatch labels „Farba 1“ … „Farba 12“ say nothing about the color; Slovak color names (e.g. „zelenomodrá“, „oranžová“) would help screen-reader users. Not required by the AC.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester: Haiku 5.5, 24. 10. 2026. Nothing in `app/` or `static/` was changed. Added manual checklist items to `tests/manual.md` (section 7, section 8, and a decision item).

### Commands and results

- `uv run pytest -q` (repo root, node v24.1.0 on PATH): **433 passed** in 3.14 s. Includes `tests/test_map_layout.py` (needs node).
- `node --test tests/js/` (node v24.1.0): **211 pass, 0 fail**.
- Temporary server on `127.0.0.1:8031` with `data/` in `/tmp/cabin-t031/data` and test secrets (the real `data/` and `.env` were not touched). Probed with httpx: create, update, auth, audit, lock, restart, startup with a bad YAML.
- Headless Google Chrome (own profile in `/tmp`, CDP on port 9333) against 8031, mobile viewport 390×844, real mouse events. Script `/tmp/cabin-t031/cdp/swatch.mjs`.
- Node cross-check of the page's `colorProblem` / `errorText` / `partyPayload` (loaded from `static/js/` in a `vm` sandbox) against the Python thresholds: 3256 colors (all 256 grays and 3000 random), **0 mismatches**.

### Acceptance criteria

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Format `^#[0-9A-Fa-f]{6}$`: `#abc`, `red`, `#GGGGGG`, `123` → 422 `invalid`, `params.field == "color"` | Pass (also `""`, trailing space, `["#FFFFFF"]`, `true`) |
| 2 | Luminance 0.06 ≤ L ≤ 0.36: `#FFFFFF`, `#E8D2A6` too light; `#000000`, `#222222` too dark; 12 palette colors pass | Pass (`params.reason`, `field`, `color` as specified) |
| 3 | Stored color upper-case | Pass (`#3e6fb0` → `#3E6FB0`, also in audit) |
| 4 | POST with valid color stores it; without or `null` → `next_party_color` | Pass |
| 5 | PUT with color overrides; without or `null` keeps stored color; check only when color differs (case-insensitive) | Pass (see scenario "unchanged color") |
| 6 | Two parties may share a color | Pass |
| 7 | `signup_closed` applies to color edits; group cookie enough | Pass (group create, color edit and plain edit → 403 `signup_closed`; admin edit → 200) |
| 8 | Audit: `party-create` `after.color` is the chosen color; color-only `party-update` has differing before/after color | Pass |
| 9 | Party form: „Farba“, 12 swatches (buttons, `aria-pressed`, label, ≥44 px), „Vlastná farba“ `<input type="color">`; „Vyberie sa sama“ default on create with no `color` in payload; edit preselects current color | Pass in headless Chrome (13 buttons, 48×48 px, auto 137×48 px; default pressed; POST body has no `color`; edit preselects `#8A6A4A`; tap on swatch sends `color` in PUT). Native picker UI not driven: manual |
| 10 | `colorProblem(hex)` pure, same thresholds; form pre-check shows Slovak text next to field | Pass (cross-check; too-light custom shows „Táto farba je príliš svetlá …“ under „Farba“, 0 requests sent) |
| 11 | `partyToForm` / `partyPayload` carry `color`, omitted on create when „Vyberie sa sama“ | Pass |
| 12 | `logic-errors.js`: `FIELD_NAMES.color = "farba"`, two exact REASON_TEXTS, `errorField` → `color` | Pass (texts compared character by character with the AC) |
| 13 | Node tests for colorProblem, payload, errorText | Pass (`logic.test.mjs` lines 690–723) |
| 14 | `uv run pytest` and `node --test tests/js/` pass | Pass (433 / 211) |
| 15 | `proposal.md` lines updated with the 24. 10. 2026 decision | Pass |
| – | Existing parties keep colors; `llm.py` untouched | Pass (colors survive restart; `git status` shows no `llm.py` change) |

### Extra scenarios tried

- Failed PUT (too light, too dark, bad format) changes nothing: color, name and `version` unchanged.
- Hand-written YAML color `#000000` on a party: rename with the same color → 200; change to `#000001` → 422 `color_too_dark`. The unchanged-color rule works as specified.
- Boundaries: gray `#A1A1A1` (L 0.3564) accepted, `#A2A2A2` (L 0.3613) too light; `#454545` (L 0.0595) too dark, `#464646` (L 0.0612) accepted. Python and JS agree.
- Rate limit: the 31st write within a minute from one `X-Client-Id` → 429 `rate_limited`; a fresh client ID works.
- Restart with existing data: version, colors and `signup_open` persist; `ETag` header present (`27-…`; 304 not re-tested here).
- Startup with YAML `parties[0].color: '#abc'` → refuses: `parties[0].color: String should match pattern '^#[0-9A-Fa-f]{6}$'`.
- Served paths: `/data/cabin-data.yaml`, `/data/audit.yaml`, `/config/cabin.yaml`, `/config/app.yaml`, `/.env`, `/files/mapa-nahlad.html`, `/static/../app/main.py`, `/static/%2e%2e/config/cabin.yaml` all 404. `GET /` has `?v=<hash>` on scripts, no `__ASSET_VERSION__` left.
- Browser console: no exceptions. Only one 401 before the group code is entered, which is expected.

### Not verified (manual, added to `tests/manual.md`)

- The native `<input type="color">` picker on iPhone Safari and Android Chrome (cannot be opened in headless Chrome).
- VoiceOver and TalkBack readout of the swatches and of the error after save.
- Visual check of the swatch wrap in dark mode and on a real 380 px device.

### Observations (not failures, no blocker)

- The reviewer's suggestion is still open: the `#pf-color` group has no `aria-describedby="pf-color-err"`, unlike the other fields (`app-form.js` line 31 pattern). The AC does not require it. Listed in `tests/manual.md`.
- Only the format is checked when the server loads YAML, so a hand-edited too-light color loads without complaint. This matches the spec (the luminance rule is a write rule).

### Verdict

All 15 acceptance criteria pass, no regressions (433 pytest and 211 Node tests, including all `done/` tasks). No bug reports. Task moved to `done/`.
