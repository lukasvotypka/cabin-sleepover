# T-139: Smooth edges instead of pixelated ones

- **Phase:** 1
- **Depends on:** T-138
- **Size:** S
- **UX:** no (the organizer's instruction is concrete: „Uprav aby boli všetky línie hladšie a nie pixelované“, 27. 10. 2026)

## Goal
All lines and edges on the map look smooth, not pixelated: the 3D world, the svg on top of it (tap shapes, boards, icons, signs, text) and the canvas scaling.

## Scope
- `static/js/app-iso.js`: `antialias: true`, pixel ratio = `min(devicePixelRatio, 2)` (was 1), linear texture filtering instead of `NearestFilter` where it causes jagged lines (grass, letters on the dolls), soft shadow edges kept.
- `static/index.html` CSS: drop `image-rendering: pixelated` from the map canvas and the scene svg (keep it only on the boot splash canvas, which is a separate pixel picture).
- svg scene: `shape-rendering` from `crispEdges` to `geometricPrecision` (or auto) for the scene, so polygons, board edges and text are antialiased.
- Update CLAUDE.md (it says the svg uses `crispEdges`) and tests that assert the old values.

## Acceptance criteria
- [ ] Phone 390x844 (DPR 3) and desktop: no stair-stepped edges on walls, roofs, beds, dolls, trees, boards and polygons (zoomed crops in the screenshots).
- [ ] Svg and 3D still aligned (T-135 probe ≤ 1 px).
- [ ] Phone render cost measured before/after and reported; if it more than doubles, cap the pixel ratio lower (e.g. 1.5) and say so.
- [ ] Tests updated; all green.

---
## Dev log
- `app-iso.js`: `antialias: true`; pixel ratio `min(devicePixelRatio, ISO_PIXEL_RATIO_MAX)` with the max at 1.5 (see cost below); grass texture `LinearFilter`. `app-iso-people.js`: letter textures `LinearFilter`. `app-scene.js`: scene svg `shape-rendering="geometricPrecision"`. `index.html`: `image-rendering: pixelated` removed from `.iso-canvas` and `#scene svg` (kept on boot canvas and body backdrop). `CLAUDE.md` updated; `tests/js/logic.test.mjs` updated (old pixelated assertion replaced, new asserts for geometricPrecision and no pixelated).
- Verification: headless Chrome (SwiftShader, software GL, so costs are pessimistic), own server on port 8139, script `/tmp/cabin-t139/shot.mjs`. Crops in `/tmp/cabin-t139/`: `before-{phone,desk}-{overview,zoom-cabin,zoom-board,zoom-yard}.png` and `c15-phone-*` / `after-desk-*` (after; `after-phone-*` is the ratio 2 variant). Phone DPR 3 at 390x844, desktop DPR 1 at 1280x800.
- T-135 alignment probe: 0 px at rest and zoomed, before and after (phone and desktop).
- Render cost per frame (SwiftShader, ms): phone before 14.6, ratio 2 + MSAA 72.1 (4.9x), ratio 1.5 + MSAA 48.4 (3.3x); desktop before 30.4, after 54.1 (1.8x). Phone is still above 2x even at 1.5 in software; real GPUs are not fill-bound like this, and the world renders only on change or at the 8 fps tick. Cap set to 1.5 as the task says; lower it if the organizer sees slowness on the phone.
- Tests: `node --test tests/js/` green (also updated the app-iso source-string test); `uv run pytest -q` 741 passed.
- Note: other svgs (HUD, sheet, adventure, slides, sound icons) still use `crispEdges`; they were outside this task's scope.

### Fixes for review round 1

- Blocker (CLAUDE.md:106 pixel ratio): fixed, now says `min(devicePixelRatio, 1.5)` with `ISO_PIXEL_RATIO_MAX` and the reason.
- Suggestion (extra ratio 1 measurement): skipped on the orchestrator's instruction.
- Suggestion (stale crispEdges assertion): fixed, removed it from the "map is zoomed" test; the next line already asserts `app-scene.js` uses `geometricPrecision`.
- Tests: `node --test tests/js/`

## Review round 1

Checked: diff of `app-iso.js`, `app-iso-people.js`, `app-scene.js`, `index.html`, `CLAUDE.md`, `tests/js/logic.test.mjs`; crops in `/tmp/cabin-t139/` (before vs c15 phone cabin crop: tree, wall and bed edges clearly antialiased, grass flecks smooth). No `NearestFilter` left in `static/js/`; `image-rendering: pixelated` kept only on the boot canvas and body backdrop. All `static/js/*.js` are listed with `?v=__ASSET_VERSION__`. Tests run by me: `node --test tests/js/` 423 pass, `uv run pytest -q` 741 passed.

Render cost: phone 3.3x at cap 1.5 is measured in SwiftShader, which is pure fill-rate bound and charges MSAA in software; on a real tile-based phone GPU, 4x MSAA is almost free and the pixel count at 1.5 vs 1 is 2.25x. The world renders only on change or at the 8 fps tick, so frame cost is not continuous. The criterion's own fix ("cap lower, e.g. 1.5, and say so") was applied and reported. Accepted; the organizer's phone is the real check.

**Blocker**
- `CLAUDE.md:106`: says the 3D layer uses "a pixel ratio of `min(devicePixelRatio, 2)`", but the code (`app-iso.js:14`, `ISO_PIXEL_RATIO_MAX = 1.5`) caps it at 1.5. CLAUDE.md is what every agent reads, so a later task would "restore" 2 and reintroduce the cost the dev log measured. Fix: write `min(devicePixelRatio, 1.5)` (`ISO_PIXEL_RATIO_MAX`, lowered from 2 for phone render cost).

**Suggestion**
- Measure ratio 1 + `antialias: true` once too, so the organizer can tell whether MSAA or the pixel count is the cost if the phone feels slow (one number in the dev log, no code change).
- `tests/js/logic.test.mjs:2026` still asserts `shape-rendering": "crispEdges"` on the concatenated sources; it passes only because other svgs (HUD, sheet) still use it. Harmless, but the assertion no longer describes the map; consider dropping it.

Verdict: CHANGES REQUESTED

## Review round 2

Round-1 blocker is not fixed: the working tree has no change since round 1, and the Dev log has no reply to it. The task file was still in `tasks/in-progress/`, not `tasks/review/`. No tests were re-run because no code changed.

**Blocker**
- `CLAUDE.md:106` still says the 3D layer uses "a pixel ratio of `min(devicePixelRatio, 2)`", while `static/js/app-iso.js:14,388` caps it with `ISO_PIXEL_RATIO_MAX = 1.5`. Fix: write `min(devicePixelRatio, 1.5)` (`ISO_PIXEL_RATIO_MAX` in `app-iso.js`, lowered from 2 for phone render cost), and add a Dev log line for the fix.

Verdict: CHANGES REQUESTED (round 2 failed)

## Test report
Tester (T-139, run on the working tree after T-138, uncommitted changes listed in `git status`):

Board note: when the tester started, this file was in `tasks/in-progress/`, then it was in `tasks/review/` (last reviewer verdict in round 2: CHANGES REQUESTED for the CLAUDE.md:106 pixel ratio). The working tree now has `min(devicePixelRatio, 1.5)` in CLAUDE.md:106, so the round-2 blocker looks fixed, but the reviewer has not re-checked it. The tester did not move the file, since it is not in `testing/` and the reviewer has not approved. Verdict below is the tester's; the move is for the orchestrator.

Commands run:
- `node --test tests/js/` → 423 pass, 0 fail.
- `uv run pytest -q` → 741 passed in 14.56 s.
- Temporary server: `uv run python -c "...create_app(data_dir='/tmp/cabin-t139-test/data')..."` on 127.0.0.1:8151 (test secrets, temp data dir), stopped after the run.
- Headless Chrome (`--headless=new`, SwiftShader), driver `/tmp/cabin-t139-test/scripts/run.mjs` (rest, slider, bed tap, zoom to 3x, pan, wheel) and `crops.mjs` (zoomed frames of cabin, board and yard, opened houses at 1.6x).
- Phone 390x844 DPR 3 and desktop 1280x800 DPR 1.

Computed state (phone, desktop): `shape-rendering` on the scene svg is `geometricPrecision`; `image-rendering` on svg and canvas is `auto` (not pixelated); `antialias: true`; pixel ratio 1.5 on phone (DPR 3) and 1 on desktop (DPR 1); canvas backing store 585x1266 on phone. No page errors.

Acceptance criteria:

| Criterion | Result | Evidence |
| --- | --- | --- |
| Phone 390x844 DPR 3 and desktop: no stair-stepped edges on walls, roofs, beds, dolls, trees, boards, polygons | PASS | Crops at full resolution: `phone-crop-roof-rest.png`, `phone-crop-trees-rest.png`, `phone-crop-house-dolls.png`, `phone-crop-board-signs.png`, `phone-crop-board-table.png`, `desk-crop-roofs-trees.png`. Text, bed outlines, roof edges and tree outlines are antialiased. The pixel sun and moon icons on the table are still blocky by design (pixel art, rectangles on whole pixels). |
| Svg and 3D aligned (T-135 probe ≤ 1 px) | PASS | Probe at rest: 0 px on phone and desktop. Zoomed 3x on the cabin: 0 px on phone; zoomed on desktop: 0 px. |
| Phone render cost measured before/after; if more than doubles, cap at 1.5 and say so | PASS (with caveat) | Tester, SwiftShader, ms per frame: phone ratio 1 with MSAA 35.5, ratio 1.5 with MSAA 51.6 to 54.2, ratio 2 with MSAA 75 to 80. Developer's before (no MSAA, ratio 1) was 14.6 ms, so the current 1.5 is about 3.5x that in software. The cap of 1.5 is applied and reported. Real-GPU cost is a manual check (added to `tests/manual.md`, section 16). |
| Tests updated, all green | PASS | 423 node tests, 741 pytest tests. |

Regression and extra scenarios:
- Phone: rest view shows the board block, the three houses and the closed roofs with „voľné: N“ signs. Dark night render after the slider drag at the same viewport: the world lights up as before.
- Slider: drag on the time knob (real pointer events) changes the time (visibly night after the drag on phone). Desktop slider drag also worked visually (`desk-slider-before.png` taken before the drag).
- Bed tap: a real pointer tap on an on-screen bed opened the bed dialog on phone (`phone-bedtap.png`, `dlg: true`) and on desktop (`desk-bedtap.png`, `dlg: true`). A first try on phone hit an off-screen bed and was discarded.
- Zoom and pan: a real mouse drag changes the view on phone (`PAN changed: true`), a wheel changes the zoom (`WHEEL changed: true`).
- Houses open at 1.6x the rest zoom (`phone-house-open.png`, roofs gone, walls down, rooms and beds visible).
- Served CSS: `image-rendering: pixelated` is not on the map canvas or the scene svg (checked in the file and in computed style); it stays on the boot canvas and body backdrop (`index.html:89,103`).
- Grep: no `NearestFilter` left in `static/js/`; no `ISO_PIXEL_RATIO` (old name) left in code or docs.

Not verified (needs a device): iPhone Safari and Android Chrome smoothness, real-GPU render cost, touch alignment. Added as manual section 16 in `tests/manual.md` (3 items).

Notes for the organizer (not failures of this task's criteria):
- Other svgs still use `crispEdges` by the developer's scope decision: `static/js/app-adventure.js:57,155` (Pred cestou yard), `app-slides.js:396` (slide pictures), `app-hud.js:32` (HUD icon), `app-sheet.js:260,284` (figure icons), `app-sound.js:58` (sound icon). The organizer's words were „všetky línie“; if the yard and slides are meant too, that is a follow-up task.
- Render cost is high on phones in software rendering; the cap is 1.5 as specified. Lowering to 1 gives back about 1/3 of the frame cost in SwiftShader.

Verdict (tester): PASS on all four criteria. Not moved: the file is in `review/`, not `testing/`, and the reviewer's round-2 verdict (CHANGES REQUESTED) has not been re-checked. Recommend: reviewer re-check of CLAUDE.md:106 and a Dev log line, then `testing/` → `done/`.

Screenshots (all in `/tmp/cabin-t139-test/shots/`): `phone-rest.png`, `phone-house-open.png`, `phone-bedtap.png`, `phone-zoom-cabin.png`, `phone-zoom-board.png`, `phone-zoom-yard.png`, `phone-crop-*.png`, `desk-rest.png`, `desk-house-open.png`, `desk-crop-*.png`.

## Review re-check

Round 2 ran before the fix landed (orchestrator ordering), so this re-check covers the round-1/2 blocker and the fix diff only.

- Blocker `CLAUDE.md:106`: fixed. It now says `min(devicePixelRatio, 1.5)` (`ISO_PIXEL_RATIO_MAX`, lowered from 2 for phone render cost), which matches `static/js/app-iso.js:14,388`. The Dev log has a reply line for it.
- Suggestion (stale `crispEdges` assertion, `tests/js/logic.test.mjs:2026`): done. It is replaced by an assertion for `geometricPrecision` in `app-scene.js` and a negative assertion for `image-rendering: pixelated` on the scene svg and canvas.
- Tests run by me: `node --test tests/js/` passed with 0 failures, `uv run pytest -q` 741 passed.

No blockers.

Verdict: APPROVED
