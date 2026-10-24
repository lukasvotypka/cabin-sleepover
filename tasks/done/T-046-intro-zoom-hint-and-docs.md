# T-046: One-time intro zoom hint, and docs for the new scene

- **Phase:** 1
- **Depends on:** T-044, T-045
- **Size:** M

## Goal
Organizer's decision of 24. 10. 2026 (scene redesign, item 4): when the splash is gone and the map shows, a slow one-time zoom tells the user the map can be moved. Default (proposal „Otvorené rozhodnutia“, Úvodné priblíženie): start 2× zoomed on the top part of the scene (title, signposts, table) and ease out over 2.8 s to the fitted view. Then update CLAUDE.md and the proposal's scene description for T-042 to T-046.

## Scope
- `static/js/logic-view.js` (pure helpers), `static/js/app-zoom.js`, `static/js/app-boot.js` (start after the fall), `static/js/logic-model.js` (constants)
- `tests/js/logic.test.mjs`, `tests/manual.md`
- `CLAUDE.md` („Frontend behaviour worth knowing“ and the `cabin.yaml` viewBox line), `proposal.md` („Informácie v scéne“: Nástenka, Tabuľka partií, Tabuľka s partiou a stavom; „Vzhľad“ table sentence)

## Acceptance criteria
- [x] Pure `introStartView(bounds, W, H)` → a view at zoom 2 (`viewZoom` = 2), horizontally centred on the scene, top edge at the scene top, valid for `clampView`. Pure `introViewAt(from, to, t)` → eased (ease-in-out) interpolation, `t` clamped to [0, 1], exactly `from` at 0 and `to` at 1. Constants `INTRO_ZOOM_MS = 2800`, `INTRO_ZOOM_START = 2`.
- [x] Node tests: start view zoom and position for a 375×667 and a 1280×800 viewport; `introViewAt` at 0, 0.5 (between), 1, and out-of-range `t`.
- [x] The animation runs once per page load, right after the splash finishes (after the fall, or after the reduced-motion hide), driven by `requestAnimationFrame` through `setView`. Polls and re-renders do not restart it; a re-render during it keeps it running or ends it at the fitted view, never jumps back.
- [x] Any `pointerdown`, `touchstart`, `wheel` or key press on the map, a resize, opening a panel or the move mode stops it at once at the current view (no snap), so the touch that stopped it acts on what is under the finger. Focus is not moved by the animation.
- [x] Under `prefers-reduced-motion` it does not run; the map shows the fitted view. „Celá mapa“ stays hidden while it runs.
- [x] CLAUDE.md: the scene paragraph says the „?“ opens „Návod“ as a centred window, the party table has „Noc“ and „Cez deň“ parts with „spolu na jedlo“, „Si: …“ and the status are a fixed bottom HUD outside the SVG, plus the one-time intro zoom; viewBox 380×496. Proposal bullets say the same in Slovak, citing the organizer's decision of 24. 10. 2026. Nothing else in either file changes.
- [x] `uv run pytest` and `node --test tests/js/` pass. `tests/manual.md` gets one item: the intro reads as „the map can move“, stops on first touch, absent with reduced motion.

## Notes for developer
- Reuse `setView`, `clampView`, `wholeView` from the zoom code; do not add a second view model.
- The end view is `wholeView(app.bounds)` with the HUD inset from T-045, read when the animation starts.
- Do not edit the „Otvorené rozhodnutia“ list; the analyst already added the defaults.

---
## Dev log

Intro zoom (T-046):
- `logic-model.js`: `INTRO_ZOOM_MS = 2800`, `INTRO_ZOOM_START = 2`. `logic-view.js`: pure `introStartView(bounds, W, H)` (zoom 2, centred on the scene, y = 0, passed through `clampView`) and `introViewAt(from, to, t)` (cubic ease-in-out, `t` clamped, exact ends).
- `app-zoom.js`: `holdIntroZoom` (called at the start of the splash fall: puts the map on the start view under the splash so nothing jumps when the splash is gone; skipped with reduced motion or move mode), `startIntroZoom` (called from the new `finishSplash()` in `app-boot.js`, after `hideBoot()` and `openWhoIfAsked()`), `introFrame` (rAF through `setView`; both ends are recomputed each frame from `app.bounds`, so polls, re-renders and a HUD height change cannot jump it back), `stopIntroZoom` (capture listeners for `pointerdown`, `touchstart`, `wheel`, `keydown` on `#scene`, window `resize`, plus a call in `startMove`; panels do not stop it, see the change request below). A stop while running keeps the current view (no snap); a stop while still held under the splash returns to the fitted view. `applyView` keeps „Celá mapa“ hidden while the intro is held or running. State is `app.introZoom` (`idle|held|running|done`), `app.introRaf`, `app.introZoomAt`; once per page load.

Cleanup of T-045 leftovers:
- `static/index.html`: removed the `#scene svg .alert-sign` blink rule and its reduced-motion override (the HUD uses `.hud-bang`). `wrapText` is kept (used by `tests/js/logic.test.mjs`, otherwise unused in the app).
- `app-hud.js`: `keepFocus` in `renderHud` now falls back to `#hudWho`, so focus lands on „Si: …“ when the status sign turns into the non-interactive ok label.
- `proposal.md`: removed `status:` from the cabin.yaml example; rewrote the Návod, Tabuľka partií and (former status board) HUD bullets, added the „Úvodné priblíženie“ bullet and updated the Vzhľad table sentence. `CLAUDE.md`: scene paragraph and viewBox 380×496 (was 492). „Otvorené rozhodnutia“ untouched. The proposal example's `viewbox: [380, 412]` and its old `notice`/`parties` rects are left as the preview example.
- `tests/manual.md`: T-034 items 154 and 156 now say the HUD sign; the T-041 board items (157, 158) are reworded to the „Cez deň“ part of the party table; new item for the intro zoom.

Tests: `tests/js/logic.test.mjs` has four new tests (constants, start view for 375x667 and 1280x800 viewports, `introViewAt` at 0, 0.5, 1 and out-of-range, source wiring); one old regex for `zoomReset.hidden` updated.
Commands: `PATH=/opt/homebrew/bin:$PATH uv run pytest -q` (501 passed), `node --test tests/js/` (269 pass).
Visual check with headless Chrome against my own server (port 8061, /tmp/t046/shot.mjs): view zoom 2 at the splash end, easing out (w 190 -> 236 -> 362 -> 380 over 2.8 s), fitted view at the end with „Celá mapa“ hidden; a synthetic `pointerdown` mid-run stopped it at the current view (w 248, „Celá mapa“ shown); with emulated reduced motion the fitted view shows from the start. Screenshots looked right, no page errors.

## Change request (coordinator, after first hand-off)
The intro must also be seen by visitors who have not picked a party yet: opening a panel (incl. the automatic „Kto si?“ after the splash) no longer stops it; only direct actions on the map, a resize or the move mode do.
- Removed `stopIntroZoom()` from `openPanel` (`app-panels.js`) and the `app.panel` skip in `holdIntroZoom` (`app-zoom.js`). Opening a panel does not refit: the panel root is outside the scene host, and `introFrame` recomputes both ends from `app.bounds` every frame anyway, so even a refit cannot make it jump.
- Node test: the old `openPanel` wiring assertion is now `openPanel` must not mention the intro; `startMove` still stops it.
- Headless Chrome (`/tmp/t046/shot.mjs`, a stale party id in `localStorage` so `askWho` is set; own server on port 8061): „Kto si?“ opens at the end of the fall and the view width goes 190 -> 235.6 -> 249.3 -> 372.4 -> 380 (zoom 2x -> 1x) with the panel open, state `running` until the end, no page errors. The screenshot shows the map behind the semi-transparent backdrop.
- Wording updated in CLAUDE.md, proposal.md („Úvodné priblíženie“) and the intro item in `tests/manual.md`.
- Tests again: `uv run pytest -q` 501 passed, `node --test tests/js/` 269 pass.

## Review round 1

Ran: `node --test tests/js/` 269 pass, `uv run pytest -q` 501 passed. All `static/js/*.js` are listed in `index.html` with `?v=__ASSET_VERSION__`.

Checked against the criteria and the coordinator's change request:
- Once per page load: `app.introZoom` goes `idle → held → running → done` and never returns to `idle`; `startFall` runs only from `revealWhenReady` behind `app.introDone`, so polls, writes and `render()` cannot restart it. No re-render path calls `setView(wholeView…)`; `refit` during `running` is overwritten next frame by `introFrame`, which reads both ends from the current `app.bounds`, so a HUD height change cannot make it jump back.
- 2× start under the splash: `holdIntroZoom()` runs at the top of `startFall`, before the fall reveals the map, and also on the no-fall path (boot hidden / no canvas).
- Stops: capture listeners on `#scene` for `pointerdown`, `touchstart`, `wheel`, `keydown` run before the svg handlers, so the first tap or wheel works on the current view (no snap while `running`); `resize` and `startMove` stop it too. Panels do not stop it, as the change request asks. Focus is never moved. „Celá mapa“ stays hidden via `introActive()` in `applyView` and comes back after a mid-run stop.
- Reduced motion: `holdIntroZoom` marks it `done` without touching the view.
- Pure helpers and tests match the criteria (zoom 2, centred, `y = 0`, `clampView`-stable for 375×667 and 1280×800; ease-in-out with exact ends and clamped/NaN `t`).
- Docs: CLAUDE.md scene paragraph and viewBox 380×496 (matches `config/cabin.yaml`) are accurate. The proposal bullets (Návod, Tabuľka partií, Spodná lišta, Úvodné priblíženie, Vzhľad sentence) match the code and cite the 24. 10. 2026 decision. „Otvorené rozhodnutia“ is untouched. Removing `status:` from the proposal's cabin.yaml example goes a little past the listed sections, but it is accurate (the key is gone from the config).

**Blockers:** none.

**Suggestion:**
- `static/js/app-summary.js:57` `showCodeScreen()` calls `hideBoot()`, which cancels the fall's `endTimer`. If a 401 arrives during the 1.5 s fall, `finishSplash()` never runs and `app.introZoom` stays `held`. After the code is entered, `app.introDone` is already true, so there is no new fall. The map stays at 2× with „Celá mapa“ hidden until the first touch, and that touch then snaps to the fitted view under the finger. This is very unlikely (the cookie would have to expire during the fall). A `stopIntroZoom()` call in `showCodeScreen` would close it.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester run, 24. 10. 2026. Result: **FAIL (one minor doc point)**, plus one tester fix (401 path). Details below.

Commands and results:
- `uv run pytest -q` (repo root, PATH with /opt/homebrew/bin): 501 passed. Python code unchanged by T-046, so not rerun after the fix.
- `node --test tests/js/` before the tester fix: 269 pass. After the tester fix and the new test: 270 pass, 0 fail.
- Own server on port 8077 (`GROUP_CODE`/`ADMIN_CODE`/`SECRET_KEY` test values, data in `/tmp/t046-test/data`), killed afterwards. Headless Chrome over CDP, 380×760 @2x, sampling the viewBox, `app.introZoom`, „Celá mapa“ and focus every ~90 ms. Scripts and frames in `/tmp/t046-test/` (outside the repo). Frames looked at: `returning-03284.png` (early ease-out, title, signposts and table visible), `returning-04347.png` (mid-run), `returning-06799.png` (fitted view, „Celá mapa“ hidden).

Acceptance criteria:

| Criterion | Result | Evidence |
| --- | --- | --- |
| Pure `introStartView` / `introViewAt`, constants 2800 / 2 | PASS | Node tests; start view under the splash is `x=95 y=0 w=190 h=380` (zoom 2, centred, top at 0) |
| Node tests for 375×667 and 1280×800, `introViewAt` at 0, 0.5, 1, out of range | PASS | `tests/js/logic.test.mjs` intro tests pass |
| Runs once per page load after the splash; polls and re-renders do not restart it | PASS | returning run: held 1.5 s (fall), running 3.1 s → 5.9 s (2.8 s), done. `rerender` run (`render`, `poll`, real write during the run): no jump, monotonic, fitted at the end. `poll` run (real write and poll after done): `done` stays, no second run |
| Touch, wheel, key, resize stop it at once without snap; focus not moved | PASS | touch at w=218.1 stays 218.1 (no snap), wheel and key act on the map as their own zoom, resize keeps w=226.6; focus stays on BODY during the run |
| Opening a panel does not stop it (change request) | PASS | new visitor run: „Kto si?“ opens at the start of `running`, view keeps easing 190 → 380 behind it. The original checkbox text still says a panel stops it, which the change request overrides; the task text should be corrected |
| Reduced motion: no run, fitted view at once, „Celá mapa“ hidden | PASS | `reduced` run: done at 0.9 s, w=380 from the start, rzHidden=true |
| „Celá mapa“ hidden while it runs | PASS | rzHidden=true in held and running samples |
| CLAUDE.md: „?“ → „Návod“ window, Noc/Cez deň with „spolu na jedlo“, HUD outside SVG, intro, viewBox 380×496 | PASS | `git diff CLAUDE.md`; `config/cabin.yaml` viewbox is `[380, 496]` |
| Proposal bullets (Návod, Tabuľka partií, Spodná lišta, Úvodné priblíženie, Vzhľad), citing 24. 10. 2026 | PASS | `git diff proposal.md` |
| "Nothing else in either file changes" | **FAIL (minor)** | `proposal.md` also drops the line `status: [278, 322, 94, 88]   # „Si: …“, aktualizácia, upozornenie` from the cabin.yaml example (outside the listed sections). The removal matches the config (it has no `status:` key), so it is accurate, but it is a change the criterion does not allow |
| `uv run pytest` and `node --test tests/js/` pass | PASS | 501 passed; 270 pass after the tester fix |
| `tests/manual.md` has the intro item | PASS | one item (line 162), tester added one sentence on toolbar `resize` |

Bug report 1 (the one failure, minor, doc only):
- Steps: `git diff proposal.md`, look for the removed `status:` line in the cabin.yaml example.
- Expected: only the listed sections change (criterion „Nothing else in either file changes“).
- Actual: the line is removed. Either restore it (then the example names a key that `config/cabin.yaml` no longer has), or the organizer waives the removal. Developer and organizer to decide; the tester does not decide.

Extra scenarios and tester fix:
- Found: a 401 during the 1.5 s fall (`showCodeScreen()` runs, `hideBoot()` cancels the fall's end timer, so `finishSplash()` never runs) leaves `app.introZoom` at `held`. Reproduced: the map stayed at 2× (`w=190`, „Celá mapa“ hidden, code screen up) until a touch, and that touch then snapped it to the fitted view. Reachable only when the group cookie becomes invalid during the fall (a poll or `visibilitychange` lands in that window), so rare, but real.
- Fix (cheap, applied by the tester on the orchestrator's request): one line `stopIntroZoom();` in `showCodeScreen()` in `static/js/app-summary.js` after `hideBoot();`, and a Node test `intro zoom: the code screen (a 401) ends the intro…` in `tests/js/logic.test.mjs`. After the fix the same run goes `held → done` at once, `w=380`, code screen up, focus on the code input, no later intro after the code is entered.
- Other probes: a new visitor through the real code screen (no cookie, 401 at load, code entered, `hideCodeScreen` → `showBoot` → fall → „Kto si?“ opens with the intro) runs once, fitted at the end. A stale `cabin.myParty` id also opens „Kto si?“ at the end of the fall. No console errors or exceptions in any run.
- Not verified by the tester: a real iPhone Safari or Android Chrome, the move-mode stop (`startMove`, Node wiring test only), desktop 1280×800 screenshots (Node start-view test only), and whether iOS fires `resize` when the toolbar collapses. That last point is a risk: a `resize` would end the intro early on a phone. Added to `tests/manual.md`.

Decision: the task goes back to `in-progress` for the one doc point (bug report 1). The tester fix in `app-summary.js` and the test are in the working tree for the developer to review.

## Orchestrator note
The tester's only failure (removal of the `status:` line from the proposal example) is waived: the orchestrator asked for that cleanup because `map.scene.status` no longer exists (T-045). Moved to done.
