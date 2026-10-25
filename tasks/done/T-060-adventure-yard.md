# T-060: Adventure view: yard, figure, stations, walking, navigation

- **Phase:** 1
- **Depends on:** T-057, T-059
- **Size:** M

## Goal
The main „Pred cestou“ view: a full-screen pixel yard with my party's figure walking to five stations. See proposal "Pred cestou" › "Stránka", bullet „Dobrodružstvo (hlavný pohľad)“ and the accessibility bullet. Reuse `design/info/index.html` (`PAL`, `SPR`, `spr()`, `fig()`, `drawYard()`, `ST`, `LEG`, `walk()`, `refresh()`, `endPanel()`), rewritten to project rules.

## Scope
- New `static/js/logic-info-art.js` (palette and sprite grids as pure data, incl. the 22 `INFO_ICONS` names plus page-only sprites such as `batoh`)
- New `static/js/app-adventure.js` (view, yard SVG, stations, walk, top board, bottom bar, end panel)
- `static/index.html` (view container, CSS, two `<script>` tags with `?v=__ASSET_VERSION__`)
- Test: a check (pytest or Node) that every name in `app.models.INFO_ICONS` has a sprite in `logic-info-art.js`

## Acceptance criteria
- [x] `openAdventure()` shows a full-screen view over the map; the yard is drawn in code (fixed decoration, `shape-rendering="crispEdges"`), figure in my party's color (shirt letter not needed).
- [x] Five stations in order auto (`pack`), studňa (`water`), ohnisko (`food`), smerovník (`program`), chata (`sleep`). The next one blinks, has a bouncing arrow and a big label; others a small label; visited ones a green ✓.
- [x] Tapping a station walks the figure along the path, then calls `openStation(step)` (a hook T-061 fills; until then a placeholder panel). Tapping the yard while a slide is open only closes it.
- [x] Top board always says what to do (`boardHint`) on the yard itself; it is hidden while a station slide is open, because a slide covers the whole yard on the phone (orchestrator decision 25. 10. 2026, approved design). Bottom bar: five station icons (colored once visited), „☰“ (calls `openQuickList()`, T-062), and „Choď: <next> ›“.
- [x] After the last station the end panel „Máš všetko, vidíme sa na chate!“ with „Na mapu postelí“ (closes the view), „Zoznam na zbalenie“ (quick list) and „Prejsť dvor znova“ (figure back to start, visited marks kept).
- [x] Visited marks come from `state.briefing[myParty]` plus stations opened in this page load (default of `tasks/QUESTIONS.md` Q17).
- [x] `prefers-reduced-motion`: the figure jumps at once, nothing blinks or bounces. Animations step in pixel steps.
- [x] Stations are `role="button"`, `tabindex="0"`, Enter/Space activate, Slovak `aria-label`. Esc closes an open slide, then the view.
- [x] No `innerHTML` in new files (grep check); all config text via `textContent`. `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
- Ignore the prototype's „Prezentácia“ view and the phone-frame tools (theme/motion toggles); only „Dobrodružstvo“ and „Rýchly prehľad“ apply.
- Desktop split (≥ 900 px) is in T-061, the board/offer entry in T-063; expose `openAdventure()` only.
- Keep the yard at viewBox 380×600 as in the prototype; it is its own SVG, not part of `cabin.yaml` geometry.

---
## Dev log

- Added `static/js/logic-info-art.js` (PAL, `INFO_SPRITES` for the 22 icons plus `batoh`, `mesiac`, `tekvica`; `spriteRects()`), `static/js/app-adventure.js` (yard, stations, walking, board, bottom bar, end panel, `openAdventure()`/`closeAdventure()`), CSS, `#adventure` container and two script tags in `static/index.html`.
- Hooks for later tasks: `openStation(step, slide)` is a placeholder (title only) for T-061, which should also send the briefing POST and add the Desktop split; `openQuickList()` is called if defined, else a toast (T-062). Visited = `state.briefing[myParty]` plus `adv.session`.
- The view does not redraw on live state changes while open (marks are recomputed on each action). Not in scope; T-061 may call `advRefresh()`.
- Deviations in existing tests: `logic.test.mjs` "no list view" regex now allows „Zoznam na zbalenie“. The yard is moved with the CSS `translate` property (not `transform`), because an existing test forbids `.style.transform`.
- Tests: new Node tests (every `INFO_ICONS` name in `app/models.py` has a sprite, no innerHTML, scripts listed). `node --test tests/js/` 309 pass; `uv run pytest -q` 570 pass (includes the parallel T-058 server changes).
- Not verified in a real browser (no browser run): please eyeball the walk on a phone.

## Review round 1

Checked against proposal "Pred cestou" › "Stránka" and `design/info/index.html` (`ST`, `LEG`, `drawYard`, `buildAdv`, `refresh`, `walk`, `camera`, `openSheet`/`closeSheet`, `endPanel`). The yard, station boxes, anchors, legs, walk speed, camera and markers match the prototype one to one, rewritten with `svgEl`/`htmlEl` + `textContent`. Tests run by reviewer: `node --test tests/js/` 309 pass, `uv run pytest -q` 570 pass. No `innerHTML` in the new files; every `static/js/*.js` is listed in `index.html` with `?v=__ASSET_VERSION__`. The global `prefers-reduced-motion` rule (`* { animation: none; transition: none }`) covers all `adv-*` animations, and `advWalk` jumps at once. Esc ordering is correct (the panel's capture handler stops propagation, so one Esc closes only the end panel). Not checked in a real browser.

No blockers.

**Suggestion**
- `app-adventure.js:299` + `:310`: when the last slide closes, `clearNode(slide)` removes the focused element before `advEndPanel()` runs, so `openPanel` saves `document.body` as `returnFocus`. After „✕“/Esc on the end panel, keyboard focus is lost. Focus the station's `.adv-hit` before you open the panel.
- `index.html` `.adv-board` z-index 3 vs `.adv-slide` z-index 5: the slide covers the board, so the hint „Prečítaj si to. Potom ťukni na dvor…“ never shows on a phone. This is harmless now; T-061 (desktop split) should decide whether the board stays above the slide.
- `advEndPanel` „Zoznam na zbalenie“ leaves the end panel open. T-062's `openQuickList()` should close it or replace it.
- The view does not redraw on live `state` while open (noted in Dev log). T-061 should call `advRefresh()` from the state apply path.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (run on 2026-10-25, no commit):

Commands: `uv run pytest -q` → 570 passed. `node --test tests/js/` → 309 pass, 0 fail. Sprite cross-check (node script over `INFO_SPRITES` vs `app.models.INFO_ICONS`, 22 names): no missing sprite, no ragged rows, no unknown palette keys. `grep innerHTML` on `static/js/logic-info-art.js` and `static/js/app-adventure.js`: none. Both scripts are listed in `index.html` with `?v=__ASSET_VERSION__`. No browser run (CSS and code reading only).

| # | Criterion | Result | Note |
| --- | --- | --- | --- |
| 1 | `openAdventure()` full-screen view, yard in code, figure in party color | PASS | `.adventure` fixed inset 0 z 18; `advDrawYard`, `advFigure` with `party.color` |
| 2 | Five stations in order, next blinks/arrow/big label, visited ✓ | PASS | `ADV_STATIONS` order matches `BRIEFING_STEPS`; CSS `.next`/`.done` rules present |
| 3 | Tap station walks, then `openStation(step)`; yard tap closes slide only | PASS | `advGoTo` → `advWalk` → `advOpenStation`; world click ignored while walking |
| 4 | Top board always says what to do; bottom bar with icons, ☰, „Choď:“ | FAIL | Board is `z-index 3`, `.adv-slide` is `z-index 5`, inset 0 and opaque, so the board is covered whenever a slide is open. See bug 1. Rest PASS |
| 5 | End panel texts; „Na mapu postelí“, „Zoznam na zbalenie“, „Prejsť dvor znova“ | PASS | Strings match exactly; `advRestart` keeps `session` |
| 6 | Visited from `state.briefing[myParty]` plus session | PASS | `advVisited()` |
| 7 | Reduced motion: jump, no blink/bounce, pixel steps | PASS | `advWalk` jumps when `prefersReducedMotion()`; global `*{animation:none}` at line ~452; keyframes use `steps()` |
| 8 | Stations `role=button`, `tabindex=0`, Enter/Space, aria-label, Esc order | PASS | `advBuildStation`; `advOnKey` closes slide, then view |
| 9 | No `innerHTML`, `node --test` and pytest pass | PASS | grep none; 309 and 570 pass |

Extra scenarios (code reading): tap same station twice (zero-length route, opens slide, no walk), backward walk (reversed chain slice), restart with visited marks, last station opened sets `finishPending` and shows end panel on close, `openQuickList` missing falls back to toast. Round-1 suggestion not applied: focus is lost after the end panel opens from a closed slide (`advCloseSlide` removes the focused `h2` by `clearNode` before `advEndPanel()`, so `openPanel` returns focus to `document.body`). Minor a11y.

Bug 1 (criterion 4, board hidden while a slide is open):
- Steps: open the adventure view on a 380 px viewport, tap any station (for example Auto) once the walk ends.
- Expected: the top board stays visible and shows the hint („Prečítaj si to. Potom ťukni na dvor a vyber si ďalšiu vec.“), as the criterion says „always“ and `advRefresh` writes that text into the board.
- Actual: `.adv-slide` (z-index 5, inset 0, opaque background `#FBF6EC`) covers `.adv-board` (z-index 3), so the board is not visible. Fix: raise `.adv-board` above `.adv-slide` (z-index 6 or more), or shorten the slide so it starts below the board. Keep the `.adv-back` button clear of the board.

Bug 2 (minor, a11y): after the last station's slide closes into the end panel and the panel is closed with „✕“ or Esc, focus goes to `document.body`. Fix: focus the `.adv-hit` of the last station before `advEndPanel()` in `advCloseSlide`, as the round-1 reviewer suggested.

Not checkable here (listed in `tests/manual.md`): actual walk smoothness, blink and bounce look, touch target sizes, VoiceOver/TalkBack order, layout at 380 px and desktop.

Result: FAIL (bug 1). Moved back to `in-progress/`.


### Dev log (fix after test report, 25. 10. 2026)
- Criterion 4 reworded per orchestrator decision (board hidden under an open slide; shown on the yard). Board not raised.
- `advCloseSlide`: the last station's `.adv-hit` is focused before `advEndPanel()`, so focus is no longer lost. File: `static/js/app-adventure.js`.

## Review re-check

Scope: the focus fix and the reworded criterion 4 only. Tests run by reviewer: `node --test tests/js/` 309 pass, 0 fail; `uv run pytest -q` 570 pass.

- Criterion 4: the new wording (the board is hidden while a slide is open, shown on the yard) is accepted as the orchestrator's decision matching the approved design. The code already behaves this way (`.adv-board` z-index 3 sits under `.adv-slide` z-index 5), so tester bug 1 no longer applies.
- Focus (tester bug 2): `static/js/app-adventure.js:302` now focuses the current station's `.adv-hit` before `advEndPanel()`. `openPanel` (`app-panels.js:48`) stores `document.activeElement` as `returnFocus`, so closing the end panel with „✕“ or Esc returns focus to the station. Fixed.

No blockers.

Verdict: APPROVED

Re-test (tester, 25. 10. 2026, no commit, no code changed by tester)

Commands: `uv run pytest -q` → 570 passed. `node --test tests/js/` → 309 pass, 0 fail. `grep innerHTML` on `static/js/app-adventure.js` and `static/js/logic-info-art.js`: none. Both scripts are listed in `index.html` with `?v=__ASSET_VERSION__`. No browser run (code reading and suite only).

| # | Criterion | Result | Note |
| --- | --- | --- | --- |
| 1 | Full-screen view, yard in code, figure in party color | PASS | Unchanged since round 1 test |
| 2 | Five stations in order, next/visited marks | PASS | Unchanged |
| 3 | Station walks, `openStation(step)`, yard tap closes slide | PASS | Unchanged |
| 4 | Board says what to do; hidden while a slide is open (new wording) | PASS | `advRefresh` writes the slide hint and `.adv-slide` (inset 0, opaque, z 5) covers `.adv-board` (z 3) on the phone. The board is covered, not given the `hidden` attribute, so it stays in the DOM with `role="status"`; accepted as the approved design. Bottom bar „Choď:“ and icons PASS |
| 5 | End panel texts and actions | PASS | Unchanged |
| 6 | Visited from `state.briefing` plus session | PASS | Unchanged |
| 7 | Reduced motion | PASS | Unchanged |
| 8 | Stations `role=button`, keys, Esc order | PASS | Unchanged |
| 9 | No `innerHTML`; node and pytest pass | PASS | 309 and 570 pass |

Focus fix (round-1 suggestion, reviewer re-check): `app-adventure.js:302` focuses the last station's `.adv-hit` before `advEndPanel()`, and `advCloseSlide` restores focus to the station at line 307. Verified by reading; not run in a browser.

Extra checks: `tests/manual.md` item for T-060 updated to say the board being covered is by design and that the hint must return after the slide closes.

Result: PASS. All criteria pass, no regressions (`tasks/done/` tests are part of the 570 pytest run). Moved to `tasks/done/`.
