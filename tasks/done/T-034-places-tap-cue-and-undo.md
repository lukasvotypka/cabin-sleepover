# T-034: Tap cue on the status board and undo for „nás viac nebude“

- **Phase:** 1
- **Depends on:** T-033
- **Size:** M

## Goal
Organizer's feedback of 24. 10. 2026 after trying T-033 on the phone: (1) the red status board does not look tappable, (2) once a night is set to „… nás viac nebude“ there is no visible way back. Page-only change; the server already removes the override when `POST /api/places` sends the full count. See `proposal.md` → "Informácie v scéne" → Tabuľka s partiou a stavom.

## Scope
`static/js/logic-model.js`, `static/js/app-draw.js`, `static/js/app-actions.js`, `static/js/app-beds.js` (meadow tap), `static/index.html` (CSS only), `proposal.md` (one sentence), `tests/js/logic.test.mjs`, `tests/manual.md`.

## Acceptance criteria
- [x] **Red board as a button.** The "missing" board shows two lines: `<DAY_SHORT>: chýba(jú) N` (correct plural via the existing helpers, e.g. „Št: chýbajú 2“, „So: chýba 1“) and „Ťukni sem ›“. It gets a raised look (lighter top/left edge, darker bottom/right, like a pressed-out key) and a „›“ chevron at the right. The exclamation sign blinks gently (reuse the `blink` keyframes or a slower variant); no blinking under `prefers-reduced-motion: reduce`. Tap behaviour from T-033 is unchanged (select night, then panel). aria-label keeps the full sentence.
- [x] **Meadow tap.** The waiting figures of my party on the meadow are one `role="button"` (≥ 44 px hit area on screen, grown into free grass) that opens the same T-033 panel for the selected night. aria-label e.g. „2 z vás ešte nemajú posteľ. Ťuknutím otvoríš možnosti.“ (singular address, T-020 guard must stay untouched).
- [x] **Override visible.** New status kind `"fewer"` in `myPartyStatus`, checked after `missing` and `extra`: when my party has an override (`party.places[app.night]`) on the **selected** night and nothing is missing anywhere. `myPartyStatus` gets the selected night as a parameter. The board is green with the check mark, text „Št: len 1 z 3 ›“ (placed override vs full `neededSlots`), same raised button look, no blinking.
- [x] **Undo panel.** Tapping the `"fewer"` board opens a panel titled with the capitalized day name: text „Vo štvrtok potrebuješ len 1 miesto z 3.“ (correct plurals: 1 miesto, 2–4 miesta, 5+ miest), primary `.btn` „Vo štvrtok prídeme všetci“ which posts `/api/places` with the full count through the existing write/rollback path and closes the panel, secondary `.btn secondary` „Nechať tak“ (closes). After undo the night shows as missing again (red) until the beds are filled.
- [x] All texts built in pure functions in `logic-model.js` (e.g. `placesUndoInfo(state, party, night)`, `statusBoardLines(status)`), set via `textContent`. Node tests cover: board lines for missing (1, 2, 5) and fewer, `myPartyStatus` order (missing > extra > fewer > ok) and that `fewer` only applies to the selected night, undo panel texts for each weekday locative and plural, null when no override.
- [x] `tests/manual.md`: lines for the blinking cue, reduced motion, meadow tap and undo on a phone.
- [x] `uv run pytest` and `node --test tests/js/` pass. No new script file.

## Notes for developer
- Status board is 94 × 88 scene units (two rows of 44); keep text at the existing sizes and check that „Ťukni sem ›“ fits on one line at 380 px wide.
- Do not add the undo to the party form (it was offered as optional; left out to keep this task small).
- Reuse `dayLocative`, `capitalize`, `pluralPlaces`, `missingVerb`, `DAY_SHORT` and `openPlacesPanel`'s write path.

---
## Dev log
- Logic (`logic-model.js`): `myPartyStatus(state, party, night)` with new kind `fewer`; new `dayShort`, `statusBoardLines`, `placesUndoInfo`. `logic-beds.js`: `meadowButtonLabel`.
- Page: `app-draw.js` (raised red/green boards, chevron, blinking `.alert-sign`), `app-actions.js` (`openPlacesUndoPanel`, reuses `sendPlaces`), `app-beds.js` (meadow is one button), `index.html` (CSS: slower blink, reduced-motion off). Also `proposal.md`, `tests/manual.md`, `tests/js/logic.test.mjs` (new tests; one old meadow source test updated).
- Deviation: the meadow hit area is only about 32 units tall (y 396 to the scene bottom 428), because the letter and key icons occupy the grass above; it is not 44. Widening needs a layout change (note for reviewer/organizer).
- Tests: `uv run pytest` 460 passed; `node --test tests/js/` 223 passed (node at /opt/homebrew/bin).
- Not verified visually in a browser (text fit of „Ťukni sem ›“ in the board).

## Review round 1
Ran `uv run pytest` (460 passed) and `node --test tests/js/` (223 passed). Scope matches the task; all scripts in `static/js/` are listed in `index.html` with `?v=__ASSET_VERSION__`, no new script file.

Checked: `myPartyStatus(state, party, night)` order missing > extra > fewer > ok, `fewer` only for the selected night (via `placesUndoInfo`, which reuses `neededOnNight`/`neededSlots`/`isPresent`); undo posts `{night, places: full}` through `sendPlaces` (existing write/rollback path, closes panel); texts built in pure functions and set via `textContent` (`htmlEl`, `addText`); blink on `.alert-sign` only, disabled under `prefers-reduced-motion`; green board has no blink; aria-labels keep the full sentence; T-020 guard untouched.

- **Blocker:** none.
- **Manual phone check (accepted by orchestrator):** meadow hit area in `static/js/app-beds.js` drawMeadow is `[112, 396, 124, 32]` scene units: 124 wide (>= 44), 32 tall, its top edge touches but does not overlap the letter/key icons (`[128|184, 352, 44, 44]`, ending at y 396). Verify on a phone that the figures are easy to hit (line already in `tests/manual.md`).
- **Suggestion:** `meadowLabel` in `static/js/logic-beds.js` is now used only by tests (the meadow is a button with `meadowButtonLabel`); either drop it later or keep it for the screen-reader summary.
- **Suggestion:** the new texts (`meadowButtonLabel`, `statusBoardLines`, `placesUndoInfo`) could be added to the T-020 singular-address guard list in a later task; they read correctly now.
- **Suggestion:** fit of „Ťukni sem ›“ (and „Št: len 1 z 3 ›“) at 380 px is not verified visually; `maxWidth` protects against overflow, but check in the manual pass.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2

## Test report
Tester (round 1, 24. 10. 2026)

Commands (PATH needed `/opt/homebrew/bin`):
- `uv run pytest -q` → 460 passed.
- `node --test tests/js/` → 223 tests, 223 pass, 0 fail.
- Live probe, temp server on 127.0.0.1:8077, temp data dir (`/tmp/t034.*`), stopped afterwards: `/api/health` ok; `GET /data/cabin-data.yaml` and `/static/../data/cabin-data.yaml` → 404; `GET /` serves `?v=` hashed script URLs. Party with 3 needed places: `POST /api/places` with 1 → ok; 0 → 422 `invalid` (`places_out_of_range`); 3 (full) → ok and `places` on the party is `{}` (override removed). Server log has no errors.

Acceptance criteria:

| Criterion | Result | Note |
| --- | --- | --- |
| Red board as a button (two lines, raised look, chevron, blink, reduced motion, aria-label) | PASS (code) | Blink `.alert-sign` 2.4 s, disabled under reduced motion. Look, text fit at 380 px and chevron need a phone (manual.md). |
| Meadow tap, `role="button"`, ≥ 44 px hit area on screen, singular aria-label | FAIL | Hit rect is `[112, 396, 124, 32]` scene units (cabin.yaml meadow `[112, 397, 124, 14]`). Scene is 380×428 and fills the phone width, so on screen it is about 32 px tall, below 44. Width is fine. The developer disclosed this, but the criterion is still unmet. |
| Override visible: kind `fewer`, order missing > extra > fewer > ok, selected night only, green board „Št: len 1 z 3 ›“ | PASS | Node tests and code. |
| Undo panel: title, line with plurals, `Vo štvrtok prídeme všetci` posts full count and closes, `Nechať tak` closes | PASS (code + API) | Full-count POST removes the override on the server, so the night is missing again. Panel click path not run in a browser. |
| Texts in pure functions, textContent, Node tests cover listed cases | PASS | `statusBoardLines`, `myPartyStatus`, `placesUndoInfo`, `meadowButtonLabel` tested. |
| `tests/manual.md` lines for blink, reduced motion, meadow tap, undo | PASS | Three T-034 lines present. |
| pytest and node pass, no new script file | PASS | No new script file in `static/js/`. |

Extra scenarios: places 0 and full-count probes above; asset version and data-directory exposure checked. Not run: browser rendering, touch hit tests, the „Ťukni sem ›“ fit, the blink look.

Bug report (1)
- Steps: open the page at about 380 px wide with my party having people without a bed on the selected night. Measure the meadow button, or read `drawMeadow` in `static/js/app-beds.js` (`hitRect`, `m[1] - 1` to `viewbox[1]`).
- Expected: the meadow button hit area is at least 44 px tall on screen (and wide), per the criterion „≥ 44 px hit area on screen“.
- Actual: the hit area is 124 × 32 scene units, about 124 × 32 px on a phone at default fit. The height is below 44.
- Suggested direction (developer decides): take the touch area higher, overlapping the letter and key icons' area with the hit rect in a layer above them or with icons not blocking taps, or move the meadow hit area into a larger free region. The organizer may instead accept 32 px as a deliberate deviation, but that needs a decision from the organizer, not from the developer or reviewer.

Verdict: FAIL (1 criterion). Moved to `tasks/in-progress/`.

## Dev log (fix after test report)
- Meadow hit rect is now 44 scene units tall: `meadowHitRect(meadow)` in `logic-beds.js` returns `[x, top-1, w, 44]` (top stays at the meadow top, y 396 in the real config, so no overlap with the letter/key icons); `drawMeadow` in `app-beds.js` uses it. It extends past the scene bottom (428) into the grass the view bounds show on taller phones; at exactly the scene aspect the lower part is off-screen (accepted).
- Clipping check: the svg viewBox is set from `fitBounds` (the whole viewport), `#scene svg` fills the screen, no clipPath on the meadow, so nothing clips the rect.
- Test: new `meadowHitRect` Node test. `node --test tests/js/` 224 pass, `uv run pytest -q` 460 pass.

## Review re-check
Reviewer, 24. 10. 2026 (after the test report, meadow hit area only).

- Fix verified: `meadowHitRect` (`static/js/logic-beds.js:181-186`) returns `[x, top - 1, w, 44]`, and `drawMeadow` (`static/js/app-beds.js:95`) uses it after the figures, so the whole group is the button. The real config gives `[112, 396, 124, 44]`. It starts below the letter and key icons (which end at y 396), is left of the status board (x 278+), and only covers the path and grass below. Nothing else can be tapped there.
- On screen: `fitBounds` (`static/js/logic-view.js`) scales by `min(vw/380, vh/428)` and gives the extra viewport to the view box. On a portrait phone (~380 × 700+) that means about 1 px per unit with grass below y 428, so the full 44 × 124 px is visible and tappable. When the screen is height-limited (landscape or desktop), the scale is above 1, so even the visible 32 units come out at more than 44 px. The criterion is met.
- No regressions: the change touches only the new pure function, its single call site and a new Node test. No new script file was added.
- Tests (run by me): `node --test tests/js/` 224 pass, 0 fail; `uv run pytest -q` 460 passed.

No blockers.

Verdict: APPROVED

Tester (round 2, 24. 10. 2026, after the meadow hit-area fix)

Commands (PATH needed `/opt/homebrew/bin`):
- `uv run pytest -q` → 460 passed. No `app/` or `config/` change since round 1, so no new server probe was needed.
- `node --test tests/js/` → 224 pass, 0 fail (includes the new `meadowHitRect` test).
- Code check: `meadowHitRect(meadow)` = `[x, top-1, w, 44]`; real config `[112, 396, 124, 44]`. `drawMeadow` adds the hit rect after the figures, inside the one `role="button"` group. `#scene` is the full screen and `fitBounds(r.width, r.height, …)` gives the view box the whole viewport (`app-zoom.js`), so the part below scene y 428 is on screen on a phone. On a 380 px wide portrait phone the scale is 1 px per unit, so the hit area is 124 × 44 px.

Acceptance criteria:

| Criterion | Result | Note |
| --- | --- | --- |
| Red board as a button (two lines, raised look, chevron, blink, reduced motion, aria-label) | PASS (code) | Unchanged since round 1. Look and text fit at 380 px still need a phone (manual.md). |
| Meadow tap, `role="button"`, ≥ 44 px hit area on screen, singular aria-label | PASS | Fixed: 124 × 44 units, about 124 × 44 px on a portrait phone. Tap on a real device still in manual.md. |
| Override visible: kind `fewer`, order missing > extra > fewer > ok, selected night only | PASS | Node tests. |
| Undo panel: title, plurals, full-count POST, `Nechať tak` closes | PASS (code + API) | Unchanged since round 1. Panel click path not run in a browser. |
| Texts in pure functions, textContent, Node tests | PASS | |
| `tests/manual.md` lines for blink, reduced motion, meadow tap, undo | PASS | Line 144 covers the meadow tap. |
| pytest and node pass, no new script file | PASS | |

Regressions: none seen (`tasks/done/` covered by the two suites).

Not verified here (need a phone, in `tests/manual.md`): the blink look, the fit of „Ťukni sem ›“ and „Št: len 1 z 3 ›“ on the board, and the actual tap on the meadow.

Verdict: PASS. Moved to `tasks/done/`.
