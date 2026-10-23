# T-026: Noticeboard shows the 4-step flow instead of three loose tips

- **Phase:** 1 (organizer request, 23. 10. 2026)
- **Depends on:** T-023, T-024 (in `done/`), **T-025** (in `in-progress/`). T-025 changes the same files (`static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md`). Do not start T-026 until T-025 is in `done/` and committed, and never run the two in parallel. The code areas do not overlap (T-025 is zoom and pan, T-026 is the noticeboard).
- **Size:** S

## Goal
The noticeboard „Návod“ on the map (proposal „Mapa a scéna“, bullet „Nástenka s návodom“) today shows three loose tips. The organizer finds them confusing, mainly „Presunúť sa dá cez posteľ.“. Replace them with the order a friend actually goes through: add a party, pick your party, take sleeping places, check every night.

Organizer's words: „Uprav návod – nedáva až tak zmysel, hlavne ten presun postele sa z toho nedá pochopiť. Radšej tam napíš flow – pridať rodinu, vybrať rodinu, vybrať miesta na spanie – skontrolovať na dni.“

## Current behaviour (read before changing)
- `<script id="logic">`: `NOTICE_LINES = ["Ťukni na posteľ a zapíš sa.", "Voľné miesto bliká.", "Presunúť sa dá cez posteľ."]`. `hiddenSummary` copies it into `instructions`, which the hidden screen-reader summary prints as `"Návod: " + instructions.join(" ")`.
- `<script id="app">`, `drawNotice(parent, r)`: paper board on `map.scene.notice`, two red nails, heading „Návod“ at baseline `r[1] + 20`, then per line a red 3×3 bullet at `r[1] + 32 + i*12` and the text (7.5, monospace) at baseline `r[1] + 36 + i*12`, `maxWidth: r[2] - 32`. Button label `"Návod: " + NOTICE_LINES.join(" ") + " Ťuknutím ho zbalíš."`. Collapsed, it draws the „?“ box (`noticeIconRect`, top-right 44×44, unchanged by this task).
- `config/chata.yaml`: `notice: [176, 112, 196, 66]` (y 112 to 178). The party table `parties: [176, 112, 148, 82]` (y 112 to 194) takes its place when the noticeboard is collapsed. The rooms and windows below start at y 196.
- With the heading and 12-unit spacing, a 4th line would sit at baseline `r[1] + 72`, below the 66-unit board.

## Decided values (product-owner defaults, the organizer may change them after trying it)
1. **The four lines, exactly (informal Slovak, the numbers are part of the text):**
   1. `1. Pridaj svoju partiu.`
   2. `2. Vyber, za ktorú partiu si.`
   3. `3. Ťukni na posteľ a zapíš sa.`
   4. `4. Skontroluj všetky tri noci.`

   Reasons: the app's word is „partia“ („Pridať partiu“, „Nová partia“, „Kto si?“ with „Vyber partiu, za ktorú sa zapisuješ.“, the status sign „Kto si? Ťukni sem“). The organizer said „rodina“ informally; „partia“ is kept for consistency (open choice, see below). Line 3 reuses the existing line and matches the sheet button „Zapísať nás sem“. Line 4 points at the night signposts right above the board (and the party table that appears there after the first bed tap). No nested quotes, every line at most 30 characters, so it fits `maxWidth` (164 units at 7.5 monospace, about 36 characters) without squeezing.
2. **„Voľné miesto bliká.“ and „Presunúť sa dá cez posteľ.“ are dropped.** Moving stays reachable as before from the bed sheet („Presunúť“); this task does not change the move feature or its texts.
3. **The red bullet squares are dropped**, because the numbers now mark the lines. The two red nails and the heading „Návod“ stay.
4. **Layout: the board grows to the party table's height.** `config/chata.yaml` changes only `notice: [176, 112, 196, 66]` → `notice: [176, 112, 196, 82]` (bottom y 194, the same bottom as `parties`, which T-023 already proved clear of the rooms, windows and doors at y 196). x, y and width do not change, so `noticeIconRect` stays `[328, 112, 44, 44]` and the signpost hit area (`nightsHit`, which only looks at the notice's top edge) does not change. The font size (7.5) and the 12-unit line spacing stay.
5. **Row positions come from a pure function, not from numbers in `drawNotice`.** Add `noticeLayout(rect, count)` to `<script id="logic">` next to `noticeIconRect`, in the style of `signpostLayout`: it returns the heading baseline and one text baseline per line, all absolute scene units derived from `rect[1]` (heading `top + 20`, lines `top + 36 + i*12`, the same rhythm as today) and the text x (`rect[0] + 12`, since the bullet column is gone) and `maxWidth` (`rect[2] - 24`). `drawNotice` reads every y from it. If `count` lines do not fit, the function does not shrink the font; the Node test below catches it.
6. **No server, model or API change.** The text is page-only (`NOTICE_LINES`), as today.

## Scope
- `static/index.html`: `NOTICE_LINES`, new `noticeLayout` (exported for the Node tests like the other logic functions), `drawNotice` (use `noticeLayout`, drop the bullets; the button label keeps the form `"Návod: " + NOTICE_LINES.join(" ") + " Ťuknutím ho zbalíš."`). The hidden summary needs no code change beyond what follows from `NOTICE_LINES`.
- `config/chata.yaml`: only the `notice` height (66 → 82). Keep the Slovak comment.
- `proposal.md`: line ~202 („Nástenka s návodom: 3 krátke riadky …“) → 4 numbered steps with the exact lines above; the `chata.yaml` example (line ~271) `notice: [176, 112, 196, 82]`.
- `tests/js/logic.test.mjs`: the scene constant (line ~446) to the new notice height; the `hiddenSummary` instructions assertion (line ~1096) to the four lines; new tests below. The Slovak-text guard (`add(L.NOTICE_LINES)`, line ~2370) stays and must pass.
- `tests/manualne.md`: one new item (below). No existing item quotes the old lines.

## Acceptance criteria
- [x] `NOTICE_LINES` is exactly the four lines in decided value 1 (typographic characters as written, no straight quotes).
- [x] The expanded noticeboard shows „Návod“ and the four numbered lines, with no red bullet squares, all inside the board, with no squeezed (`textLength`) line on a 380-unit-wide scene in Chrome or Safari.
- [x] `config/chata.yaml` and the `proposal.md` example both have `notice: [176, 112, 196, 82]`; nothing else in `chata.yaml` changes. The server starts and `/api/state` carries the new rect.
- [x] The collapsed „?“ box, the party table and the signposts look and behave exactly as before (the „?“ box is still `[328, 112, 44, 44]`, the table still appears only when the board is collapsed, Q12 collapse rule unchanged).
- [x] The hidden screen-reader summary reads `Návod: 1. Pridaj svoju partiu. 2. Vyber, za ktorú partiu si. 3. Ťukni na posteľ a zapíš sa. 4. Skontroluj všetky tri noci.` and the noticeboard button's label is that text plus „ Ťuknutím ho zbalíš.“
- [x] Node tests (`node --test tests/js/`), all passing:
  - `hiddenSummary(...).instructions` equals the four lines.
  - `noticeLayout(scene.notice, NOTICE_LINES.length)` on the real rect: the heading is above the first line, the lines are in order with 12 units between them, the first line's cap top (baseline − 6) is below the heading baseline, and the last baseline + 3 (descenders of „ý“, „p“) is at most the board bottom (`rect[1] + rect[3]`). The same check fails for a 66-high rect with 4 lines (proves the test would catch the old size).
  - Overlap guard: the expanded notice rect does not overlap any room rect, door, window, or any `map.scene` rect except `parties` (replaced by design) and itself, and it stays clear of the signposts with their 6-unit posts (the existing `scene: title board, signposts …` test keeps passing with the new rect).
  - The existing `noticeIconRect`, `nightsHit` (`[176, 40, 196, 72]`) and bed-hit-area tests pass unchanged.
  - Source guard like the T-024 one: the `drawNotice` body contains `noticeLayout(` and no `r[1] + <number>` row offsets except the 6-unit nails, and no `innerHTML`.
- [x] `uv run pytest` still passes (the YAML change must not break the layout validation at startup).
- [x] `tests/manualne.md` has a new item **Noticeboard flow (T-026)**: on a phone, clear `localStorage` (or use a private tab) and open the link: the noticeboard shows the four numbered steps, all readable, none squeezed or cut, nothing overlapping the rooms below or the signposts above. Follow the steps (add a party, pick it in „Kto si?“, tap a bed and take places, check the three signposts): the steps match what the screen offers. The first bed tap collapses it to „?“ and the party table appears; „?“ brings the four steps back. VoiceOver/TalkBack reads the four steps.

## Notes for developer
- Read the T-023 and T-024 dev logs for how `parties`, `noticeIconRect` and the overlap tests are built; reuse the test helpers (`overlap`, `realLayout`, `scene`, `doors`, the windows list) instead of new ones.
- Keep the layout data-driven: no new geometry constants in `drawNotice`; everything is relative to the `notice` rect from `/api/state`.
- All four strings live in `<script id="logic">` only; `drawNotice`, the hidden summary and the button label read `NOTICE_LINES`. Put text in with `textContent` via `addText`, never `innerHTML`.
- Do not touch the move feature, the bed sheet, the „Kto si?“ panel or any zoom/pan code (T-025).
- If 30 characters still get squeezed on a real device font, report it in the dev log instead of shortening the organizer-facing text on your own.

## Open choices for the organizer (defaults used)
- **„partia“ vs „rodina“:** the organizer wrote „rodina“; the board uses „partia“ to match the rest of the app. Switching to „rodina“ would mean renaming it everywhere (buttons, panels, error texts), which is a separate task.
- **Exact wording of the four lines** (decided value 1), including whether step 4 should say „Skontroluj všetky tri noci.“ or name the signposts.
- **Dropping „Voľné miesto bliká.“** (the blinking free spot is no longer explained on the board).
- **Board height 82** (the board now reaches as low as the party table, 2 units above the rooms).

---
## Dev log

Done (developer, 23. 10. 2026):
- `static/index.html`: `NOTICE_LINES` is the four numbered lines. New pure `noticeLayout(rect, count)` next to `noticeIconRect` (`{x: rect[0]+12, maxWidth: rect[2]-24, heading: top+20, lines: top+36+i*12}`). `drawNotice` reads every row from it, bullets dropped, nails/heading kept; button label unchanged in form. Hidden summary follows `NOTICE_LINES` without code change.
- `config/chata.yaml` and `proposal.md` (example and the "Nástenka s návodom" bullet): `notice: [176, 112, 196, 82]`.
- `tests/test_models.py`: the hard-coded scene rect in `test_scene_rects_match_proposal` (line 29) changed 66 to 82. This file was not listed in Scope, but the test compares against the proposal and would fail otherwise.
- `tests/js/logic.test.mjs`: scene constant to 82, `hiddenSummary` assertion to `FOUR_LINES`, new tests (NOTICE_LINES exact, `noticeLayout` on the real rect, 66-high rect fails for 4 lines, overlap guard vs rooms/doors/windows/scene boards/signposts with posts, `drawNotice` source guard).
- `tests/manualne.md`: new item "Noticeboard flow (T-026)" in section 6.

Tests:
- `node --test tests/js/`: 199 pass, 0 fail.
- `uv run pytest -q`: 384 passed.
- Headless Chrome (Playwright with the installed Google Chrome, 380x800 viewport, own server on port 8137 with a temp data dir): page loads, the board shows "Návod" and the four lines, no bullets, text widths at most 136 of 172 units, last line bbox bottom 186 within board bottom 194, no `textLength` on the notice lines (only the existing room names, date, status texts), aria-label and hidden summary read the expected text. Only console error: `GET /favicon.ico` 404 (pre-existing, no favicon in the project). No page errors.

Not verified: the collapsed "?" state and party table were not clicked through in the browser (code untouched, unit tests pass); real-phone checks are in the new manual item.

Follow-ups: none. T-027 was not touched.

## Review round 1

Reviewer, 23. 10. 2026. Scope: `static/index.html` (NOTICE_LINES, `noticeLayout`, `drawNotice`), `config/chata.yaml`, `proposal.md`, `tests/js/logic.test.mjs`, `tests/manualne.md`, `tests/test_models.py`. The `tasks/todo/T-009-admin.md` diff in the working tree belongs to T-027 planning, not to this task, so do not stage it with T-026.

Checks run by the reviewer:
- `node --test tests/js/`: 199 pass, 0 fail.
- `uv run pytest -q`: 384 passed.
- Syntax parse of both inline scripts (`node:vm` `Script` on `<script id="logic">` and `<script id="app">`): both parse, 0 failures.
- Own server on port 8139 with a temp data dir: starts, `/api/state` carries `layout.map.scene.notice = [176, 112, 196, 82]`.
- Headless Chrome, 380x800: the expanded board shows „Návod“ and the four lines, text widths 104 to 135 (maxWidth 172), last line bbox bottom 186 (board bottom 194), no `textLength` on any notice line, only the 2 red nails (no 3x3 bullets), aria-label exactly as required. One tap collapses it to the „?“ box with hit rect `[328, 112, 44, 44]` and label „Návod. Ťuknutím ho rozbalíš.“, and the party table appears. No page errors.

Acceptance criteria: all met. `NOTICE_LINES` matches decided value 1 character for character. `noticeLayout` is pure, in `<script id="logic">`, uses the decided offsets (heading `top + 20`, lines `top + 36 + i*12`, x `rect[0] + 12`, maxWidth `rect[2] - 24`), and `drawNotice` reads every row from it. Only the nails keep `r[1] + 6`. Text goes in through `addText` → `textContent`. The collapsed branch, `noticeIconRect`, `nightsHit` and the party table are unchanged. The hidden summary follows `NOTICE_LINES` with no code change. In `chata.yaml` only the height changed and the Slovak comment is kept. The proposal bullet and example are updated. The `tests/test_models.py` change (66 → 82) falls outside the listed scope, but it is required because that test compares against the proposal, and the dev log says so.

**Blocker:** none.

**Suggestion:** none.

**Nit:**
- `tests/js/logic.test.mjs:809` repeats the windows literal (`windowsHere`) instead of a shared helper. The T-023 test at line 836 does the same, and the module-level `windows` at line 2481 is declared later in the file, so this matches what is already there. Leave it.
- `tests/js/logic.test.mjs:798` `30 * 4.5 <= lay.maxWidth` is only a rough width estimate. The real "not squeezed" check is the manual item plus the browser check above, which is fine for this size of task.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2

## Test report

Tester, 23. 10. 2026. Working tree checked with `git status` and `git diff` (T-026 files: `static/index.html`, `config/chata.yaml`, `proposal.md`, `tests/test_models.py`, `tests/js/logic.test.mjs`, `tests/manualne.md`). `tasks/todo/T-009-admin.md` and `tasks/todo/T-027-english-names.md` were not touched. Nothing committed or pushed. No repo test was added; the existing Node tests cover the geometry and the browser run below covers the rendering.

Commands and results:
- `uv run pytest -q`: 384 passed (2.52 s).
- `node --test tests/js/`: 199 pass, 0 fail. The 7 notice tests (`--test-name-pattern`) pass as well.
- Own server on port 8137, test secrets, temp data dir `/tmp/t026-tester/data`: `/api/health` ok, `/api/state` returns `layout.map.scene.notice = [176, 112, 196, 82]`.
- Headless system Google Chrome via playwright-core (kept in `/tmp/t026-tester`, outside the repo), script `/tmp/t026-tester/check.mjs`: 380x800 mobile at DPR 2 and 1280x800 desktop. 38 checks, 38 passed, 0 failed. Screenshots: `/tmp/t026-tester/m380-1-expanded.png`, `m380-2-collapsed.png`, `d1280-1-expanded.png`. Read them and the layout matches the text above.

Acceptance criteria:

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `NOTICE_LINES` is exactly the four lines | PASS | Node `NOTICE_LINES is exactly the four numbered steps`; the rendered board text matches at both widths |
| 2 | Expanded board shows „Návod“ and the four numbered lines, no red bullets, inside the board, no `textLength` | PASS (Chrome) | Browser: text boxes inside 196x82 board, last line bottom within 194, widest line within 172, no `textLength`/`lengthAdjust`, only the 2 nails (3x3) at y 118. Safari not checked (manual item) |
| 3 | `chata.yaml` and `proposal.md` example have `notice: [176, 112, 196, 82]`, nothing else in `chata.yaml` changes | PASS | `git diff config/chata.yaml` changes only the notice line; `proposal.md` lines 202 and 271 updated; server `/api/state` carries the new rect |
| 4 | „?“ box, party table and signposts unchanged; table only when collapsed | PASS | Browser: „?“ hit rect `[328,112,44,44]`; table group `parties` appears on collapse and is within `[176,112,148,82]`; gone after „?“; first bed tap collapses and shows the table |
| 5 | Hidden summary reads the four steps; button label is the four steps + „ Ťuknutím ho zbalíš.“ | PASS | Browser: `#srSummary` paragraph equals `Návod: 1. Pridaj svoju partiu. 2. Vyber, za ktorú partiu si. 3. Ťukni na posteľ a zapíš sa. 4. Skontroluj všetky tri noci.`; `aria-label` exact |
| 6 | Node tests pass (flow list, `noticeLayout` on real rect, 66-high rect fails, overlap guard, `drawNotice` source guard, old tests unchanged) | PASS | `node --test tests/js/`: 199 pass, 0 fail |
| 7 | `uv run pytest` still passes | PASS | 384 passed |
| 8 | `tests/manualne.md` has the item „Noticeboard flow (T-026)“ | PASS | Present in section 6 with phone, step-by-step, „?“ and VoiceOver/TalkBack parts. Needs a human (see below) |

Extra scenarios tried (browser, both widths):
- Tap on the board collapses it, `localStorage` `chata.noticeCollapsed` is `"1"`; tap on „?“ expands it and removes the key. Tested in both directions.
- Board is a focusable `role="button"` with `tabindex="0"`.
- Overlap: no scene shape drawn above the board and no text overlaps the notice text (strict intersection). 11 background meadow tufts lie under the opaque paper board. They are hidden by it, as before, and the board now covers a few tufts down to y 194 instead of 178. Not visible in the screenshots.
- Console: the only error is `401` on the first `GET /api/state`, which the page sends before the group code is entered (expected, it is the join screen). No page errors.
- Readability: at 380 px the scene is about 1 CSS px per unit, so the 7.5-unit lines are about 7.5 px on a 1x screen. Readable in the 2x screenshot; the real-phone judgement is in the manual item (the developer flagged the same).

Not checkable here (in `tests/manualne.md`, item „Noticeboard flow (T-026)“): iPhone Safari and Android Chrome rendering at real font sizes, VoiceOver/TalkBack reading the steps, and the full walk through the steps with two devices.

Failures: none. No bug report.

Verdict: PASS. Moved to `tasks/done/`.
