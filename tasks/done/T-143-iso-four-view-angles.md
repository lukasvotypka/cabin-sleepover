# T-143: Four camera angles (core)

- **Phase:** 1
- **Depends on:** T-142
- **Size:** M
- **UX:** yes

## Goal
Organizer's decision of 27. 10. 2026 (option A): the map can be seen from four sides (camera azimuth 45°, 135°, 225°, 315°: from the south-east, south-west, north-west, north-east). This task makes everything correct for any of the four angles; T-144 adds the buttons and the swing.

## Scope
- `logic-iso.js` (+ roof/people logic): the projection, `isoScene`, perspective, back-to-front order, hit regions and figure placement take the view angle as a parameter (default 45°); `app.view` angle state.
- Walls and houses: which walls are "back" (tall) and which sink when a house opens follows the angle; roofs and ridge signs, room plates and bed tags placed for the angle.
- Sun path (T-140) relative to the view so shadows stay visible, or keep the world sun and accept hidden shadows from some sides (Design decides).
- Rebuild of the angle-dependent 3D parts and a full svg redraw on an angle change (no per-frame re-projection).
- Follow-up from T-142 testing: automatic quality climbs back too slowly (first climb 40 s, then 160 s per level, `upAfter` never reset after a climb; one frame over 40 ms resets the good streak). Reset the wait after a successful climb, tolerate a few slow frames (e.g. ≥ 90 % good frames over the window), and make CLAUDE.md match.
- Tests: the existing 45° tests stay; add checks for the other three angles (all rooms fit, no wall over a bed, hit regions resolve to their bed, alignment).

## Acceptance criteria
- [x] For each of the four angles (set via a test hook): 3D and svg aligned (T-135 probe ≤ 1 px), every bed tap resolves to its bed, closed/open houses correct, boards readable.
- [x] Default view unchanged (45°).
- [x] Tests added; all green.

## Design
One design for T-143 (angles correct) and T-144 (buttons, swing). The map is a turntable you can turn by quarters. It stays a quick tool: the default view (45°, from the south-east) is unchanged, and nobody has to turn the map to sign up.

**Sun relative to the view (decision).** `sunAt(h).az` keeps its meaning „degrees from the camera axis“, so the light direction used is `az + (viewAz − 45)`. That gives the T-136/T-140 look from every side: the morning shadows fall to the screen's left, at noon they fall up and to the right, and in the evening to the right. The moon spot turns with the view too. Trade-off: the compass sun is „wrong“ from three sides, but the cabin has no visible north, and a world-fixed sun would hide the shadows behind the objects from two of the four sides, which is exactly the problem T-140 solved.

**Board block.** It stays an upright billboard facing the screen, above the world, and is never rotated. `isoScene(layout, {azimuth})` recomputes its place, because the highest point of the world changes with the angle (gap 14 as now). The icon grid stays left of the boards. Each angle has its own rest view (block + all rooms), which `isoRestView` computes for that angle.

**Walls, roofs, labels (T-143).** The „back“ walls (tall when a house is open) are the two sides facing away from the camera at that angle, and the front two sink. Roof slope colours: `face` on the slope toward the sun direction actually used. Ridge signs „voľné: N“/„plno“, room plates and bed tags stay screen-upright at their projected points. Back-to-front order and the hit regions come from the same projection, with no per-angle special cases in the app code.

**Buttons (T-144).** A pair of pixel buttons at the bottom right of the screen, in the crest's row (same bottom edge as the crest plate: `bottom: calc(18px + safe-area)`, `right: 8px + safe-area`). Each is 44×44 with a 4 px gap, so the pair is 92 px wide and fits beside the crest (`max-width: calc(100% − 140px)`) on a 380 px phone. The style matches „Celá mapa“: `#F4EBD0` background, 3 px `#5C4033` border, 3 px hard shadow, fixed colours (scene UI, not dark-moded). The icon is an inline 16×16 pixel arrow svg (`crispEdges`, `#2E1F14`), with the other button using the same svg mirrored. Do not use the Unicode ⟲ ⟳ glyphs, which iOS monospace renders unevenly. „Celá mapa“ moves up one row, when shown, to `bottom: calc(18px + 44px + 8px + safe-area)`, right-aligned above the pair. The buttons are hidden in move mode, under open panels (backdrop) and during the intro zoom; they appear when the intro ends. Desktop: same place; `title` = aria-label; keys `Q` (left) and `E` (right) when the focus is on the map, not in an input.
- Texts: aria-label/title „Otočiť mapu doľava“ and „Otočiť mapu doprava“. After a turn, the sr-only status says „Pohľad z juhovýchodu“ / „… z juhozápadu“ / „… zo severozápadu“ / „… zo severovýchodu“. No visible toast.
- Direction: ⟳ (right) turns the **map clockwise on screen** (the camera goes SE→NE→NW→SW, azimuth +90°), and ⟲ goes the other way. If the azimuth sign convention in the code differs, this on-screen rule wins.
- Press feedback: the button shifts 2 px down and right and its shadow drops to 1 px for 120 ms (`steps(1)`). Never disabled.

**Swing.** 500 ms, ease-in-out, on the shared rAF tick (the camera is 3D with smooth edges since T-139, so a smooth camera move is fine; do not use steps() here). Sequence: the svg overlay fades out in 2 steps (0.5, then 0) over the first 120 ms. The camera azimuth turns. The sun turns with it, using the T-140 quantized shadow redraw (≥ 6°), so the shadows tick like a sundial. The angle-dependent 3D parts (front/back walls, roof slope colours) swap once, at the halfway point, when the motion hides the swap. At the end the svg redraws once for the new angle and fades in in 2 steps over 120 ms. A tap during the swing retargets it (+90° more from the current azimuth, the 500 ms restart from there), and the svg stays hidden until the camera settles. Reduced motion: instant switch, one redraw, no fade.

**Zoom and pan after a turn.** If the view was at the rest view (or the phone rest), it lands on the new angle's rest view. Otherwise it keeps the centre of interest: the plan point under the screen centre stays under the screen centre, the zoom ratio to the rest zoom stays the same, and the view is clamped to the new bounds. Open houses stay open, and a running time-lapse continues. A bed selected in move mode cannot happen (buttons hidden there).

**Memory.** The angle is stored with the existing storage helper (`app-core.js`) under `cabin-view-angle` (45/135/225/315). Anything else falls back to 45. The intro zoom runs at the stored angle.

**Not in scope:** free rotation by dragging or two-finger twist, tilt changes, a compass rose or north arrow, turning the board block, per-angle content in `cabin.yaml`, a different rest zoom per angle beyond what the fit gives.

- [x] (design) At noon, a screenshot from each of the four angles shows the shadows falling up-right on screen, as at 45°.
- [ ] (design) ⟳ turns the map clockwise on screen, and on a 380 px phone the pair, the crest and „Celá mapa“ do not overlap.

---
## Dev log

**Developer, round 1.**

What changed:
- `logic-iso.js`: `isoScene(layout, {azimuth})` (partial opts merged over `ISO`, scene carries `azimuth`), `ISO_ANGLES`, `isoAngle`, `isoTurnAngle`, `isoSunAzimuth`, `isoBackSides(azimuth)`, `isoUnpoint`, `isoTurnView`. `isoWalls` marks each piece with its `side` and makes outline walls tall on the back sides only; bed tap bounds and the bunk rail follow the camera side. Quality follow-up: `isoQualityStep` now works on a stretch (a step up needs `upAfter` ms with at least 90 % of the frames within budget), a plain step down no longer doubles the wait, a step down within 20 s of a climb (failed climb) doubles it (max 8x), and a climb that holds resets it to 20 s. CLAUDE.md updated for both.
- `logic-iso-roof.js` + `app-iso-roof.js`: `isoSunSlope(azimuth)` picks the bright slope (same on screen from every side).
- `app-iso.js`: sun azimuth (initial and `isoSunStep`) turns with the view; walls, posts, wall cutting (probe on the outer side via `w.side`) and the chimney (on the back wall, N or S) follow `isoBackSides`.
- `app-beds.js`: room plates hang on the far wall (north, or south from the north-side views).
- `app-core.js` (`KEYS.angle` = `cabin-view-angle`, `app.viewAngle`), `app-scene.js` (angle in the layout key and in `isoScene`), new `app-turn.js` (`setViewAngle(angle)` = the test hook; `turnViewAngle(steps)`; rebuild, keeps view, open houses stay open), listed in `index.html`.
- Tests (`tests/js/logic.test.mjs`): angle helpers, clockwise direction, back sides, sun and roof slopes, all-rooms-fit per angle, tall walls per angle and no wall over a bed, hit regions per angle, bunk rail, `isoUnpoint`, `isoTurnView`, wiring; quality tests rewritten for the new rule.

Commands: `node --test tests/js/` (443 pass), `uv run pytest -q` (741 pass).

Browser check (headless Chrome, `--use-angle=metal`, phone 390x844, own server on :8431 with temp data, driver `/tmp/cabin-t143/drive.mjs`, hook `setViewAngle(a)`): for 45/135/225/315, closed and with all houses opened: 3D vs svg alignment probe worst 0 px over 72 points; all 12 bed furniture centres resolve to their own bed via `elementFromPoint`; no console errors. Turning while zoomed 2x on the plan point (250, 300) kept that point under the screen centre, the 2.0x zoom relative to rest and `housesAll` at every angle; angle is stored (`cabin-view-angle`). Screenshots (houses open): `/tmp/cabin-t143/phone-angle-45.png`, `-135`, `-225`, `-315` (closed ones `phone-closed-*.png`). Shadows fall up-right on screen at all four angles; back walls and ridge colours look right.

Notes and deviations:
- The task text says 135 = south-west, the Design says the camera goes SE -> NE -> NW -> SW (+90 turns the map clockwise on screen). Implemented the Design: 45 SE, 135 NE, 225 NW, 315 SW (names in `ISO_ANGLE_NAMES` for T-144's sr-only status).
- The angle change here is a full rebuild (no swing, no fade); T-144 adds the swing. A running time-lapse is not specially kept (not tested).
- The chimney stays on the back wall, so it is now on the south wall from the north-side views. Furniture (headboards at the north end, lying dolls head north) is not turned, per scope.

## Review round 1

**Reviewer, round 1.** Ran `node --test tests/js/` (443 pass) and `uv run pytest -q` (741 pass). Read the full diff of `logic-iso.js`, `logic-iso-roof.js`, `app-iso.js`, `app-iso-roof.js`, `app-beds.js`, `app-scene.js`, `app-core.js`, the new `app-turn.js` and CLAUDE.md; looked at the 45/135/225 screenshots in `/tmp/cabin-t143/`.

- Angle is one parameter end to end: `isoScene(layout, {azimuth})` (opts now merged over `ISO`, so the default is still 45), `isoBackSides` drives walls (`side` + `outer` on all four edges, tall only on back sides), posts, wall cutting probe (outer side per `w.side`), chimney, room plates, hit-region growth and the bunk rail. Back-to-front order (`isoSlotOrder`) already uses projected y, so it follows the angle with no special case. No per-angle branches in app code beyond `isoBackSides` lookups.
- Sun turns with the view in both the initial light and `isoSunStep` (`isoSunAzimuth`), and `isoSunSlope` picks the bright roof slope from the same turned noon sun, as the Design decided. Screenshots show shadows up-right from every side.
- Angle change rebuilds through the `ensureScene` layout key (angle included), one full redraw, no per-frame re-projection. `setViewAngle` stores `cabin-view-angle`, `isoAngle` falls back to 45 for anything else. `isoTurnView` keeps the centre plan point and relative zoom, rest view lands on rest.
- `app-turn.js` is listed in `index.html` with `?v=__ASSET_VERSION__`, after the scripts it uses.
- Quality follow-up: window-based climb with >= 90 % good frames, probation resets the wait after a held climb, failed climb doubles (max 8x); CLAUDE.md matches.
- Default view: at 45 the back sides are n/w, so walls, posts, rail, hit bounds and chimney reduce to the old code; 45 tests unchanged and green.

No blockers.

**Suggestion**
- CLAUDE.md still describes the world only as "seen from the south-east"; one clause on the four angles (`app.viewAngle`, `cabin-view-angle`, `isoBackSides`) would help, or leave it to T-144 when the buttons land.
- `ISO_ANGLE_NAMES` holds Slovak words in `logic-iso.js`; fine as page text, but T-144 should build the full sr-only sentence from it in the app layer.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

**Tester, T-143 (round 1).** Independent run, not the Dev log. Own server `127.0.0.1:8452` with temp data (`/tmp/cabin-t143-test/data`, test secrets), headless Chrome `--headless=new --use-angle=metal --enable-gpu --ignore-gpu-blocklist`, 390x844 DPR 2. Scripts and screenshots in `/tmp/cabin-t143-test/`.

Commands and results:
- `uv run pytest -q`: 741 passed.
- `node --test tests/js/`: 443 pass, 0 fail.
- `node` check of `isoQualityStep` (`/tmp/cabin-t143-test/node/quality.mjs`): steady 60 fps from level 3 climbs at 20 s, 40 s, 60 s (the wait is reset after each held climb); 9 of 10 frames within budget climbs after 20 s; 8 of 10 does not climb; 50 ms frames step down after 2 s; a step down 2 s after a climb makes the next wait 40 s; alternating 70/16 ms frames never step down. Pass. CLAUDE.md describes the rule (quality and angle paragraphs).
- Default 45°: `isoScene(tests/js/cabin-layout.json)` on HEAD (`git archive HEAD`) and in the working tree differ only by the new key `azimuth: 45`; `isoHouseList` identical. Pass.
- Browser, `/tmp/cabin-t143-test/drive.mjs` (run2): 0 console errors, 0 exceptions at every step.

Acceptance criteria:

| Criterion | Result | Evidence |
| --- | --- | --- |
| Four angles: 3D and svg aligned (≤ 1 px) | PASS | worst 0 px over 72 points at 45, 135, 225, 315, closed and with all houses open |
| Four angles: every bed tap resolves to its bed | PASS | open houses: 12/12 beds resolve to their own `data-bed` at every angle (closed houses hide their beds, so no bed element there, by design of T-137) |
| Four angles: closed houses correct | FAIL | the kitchen roof at 135 does not open the kitchen, see bug 1. Other closed house hits resolve correctly at 45, 225, 315 |
| Four angles: open houses correct | PASS | after opening all, no `.house-hit` remains at any angle; house-hit bbox centres at closed rest resolve to their own house at 45, 225, 315 |
| Four angles: boards readable | PASS (visual) | `phone-angle-{45,135,225,315}.png` (houses open): title, slider, signposts, party table and icon grid readable at all four |
| Default view unchanged (45°) | PASS | see above; `phone-angle-45.png` looks as before |
| Tests added; all green | PASS | 741 pytest, 443 node |

Extra scenarios:
- Zoomed 2x on plan point (250,300), four quarter turns plus one more: the same plan point stays at the screen centre and the zoom stays 2.0x every time. Pass.
- Map at rest, two turns: lands exactly on the new rest view (dx, dy, dw = 0). Pass.
- Angle 225 set, page reloaded: angle 225, azimuth 225, alignment 0 px, beds 12/12. Pass. Stored value `90` falls back to 45. Pass.
- Quality follow-up logic: see above. Pass.
- Visual check of the sun at all four angles: shadows fall up and to the right on screen in the four screenshots. Pass.

Bug 1 (FAIL, closed houses at 135):
- Steps: phone 390x844, group code, open the page, `setViewAngle(135)`, all houses closed (rest view). Tap CSS point (160, 521), the visible roof of „Letná kuchynka“ (sign „voľné: 2“ just above it, `/tmp/cabin-t143-test/phone-closed-135.png`, screenshot point (320, 1042)).
- Expected: the kitchen opens (its own `data-house="kitchen"`).
- Actual: `document.elementFromPoint` returns the `data-house="main"` hit polygon (Izba vľavo), which opens the wrong house. Of the kitchen's hit polygon sample points, 484 resolve to the kitchen and 328 to `main` (CSS x 125–188, y 518–552, the kitchen's lower/visible roof band). The kitchen's bbox centre resolves to `main`.
- Likely cause: the `main` hit polygon at 135 reaches above its visible roof edge, and it is drawn after the kitchen's, so it wins. The check of bed taps alone (the developer's check) does not catch it. Please check the hit polygon growth per angle (`isoHitRegion`-style code) and add a test that the kitchen's roof centre at 135 resolves to the kitchen.
- Also seen, lower impact, same kind of check: at 225 about 10 of 547 `main` sample points resolve to `konica`, and at 315 about 21 resolve to `kitchen`. Check whether those are visible overlaps (front house occludes) or the same bug.

Observation (not a failure): at 225 the „Letná kuchynka“ label runs to the right edge of the 390 px screen (`phone-angle-225.png`). It still reads, but check it on a real phone.

Manual, added to `tests/manual.md`: the four angles on a real iPhone and Android, the kitchen tap at 135, and the quality climb now 20 s.

Decision: FAIL (one closed-house hit region at 135). Moved to `tasks/in-progress/`.

## Dev log (fix after test report)

Cause: the closed-house tap polygon was one convex hull of the whole outline box up to the ridge height (`houseBox().poly`), much bigger than the visible roof and walls, and the houses were ordered by the projected centre only. At 135 the hull of `main` reached over the kitchen's roof band and, drawn later, won.

Fix:
- `logic-iso-roof.js`: `isoHouseSilhouette(scene, rooms, outline)` = one convex polygon per room (walls to the eaves) plus one per roof (eaves corners with the overhang and the two ridge ends), so the tap area is the visible house at the current angle. `isoPlanDepth` and `isoHouseOrder(scene, list)` order the houses back to front along the view axis (a house wholly nearer wins; overlapping depth spans fall back to the footprint centre).
- `app-houses.js` `drawHouseHits`: draws those polygons (all with the same `data-house`, same click and hover handlers) in that order. `houseBox().poly` stays for the zoom-to-house view.
- Test (`tests/js/logic.test.mjs`): "at every angle a visible point of a closed house resolves to that house". For 45, 135, 225, 315 it samples the roof surfaces and wall tops of every house in 3D, drops the points another house hides (ray toward the camera against walls and roofs), projects the rest and requires that the topmost polygon in draw order is that house (also covers the 225 `konica` and 315 `kitchen` overlaps). With the old hull this test fails (already at 45); with the fix it passes.
- Checked the lower-impact overlaps from the report: they were the same cause (oversized hull), gone with the tight silhouettes.

Browser (headless Chrome, `--use-angle=metal`, 390x844, own server :8462 with temp data, driver `/tmp/cabin-t143-fix/drive.mjs`): `setViewAngle(135)`, tap CSS (160, 521) -> `kitchen` (was `main`). At 45, 135, 225, 315 the centre of every closed house's polygons resolves to its own house. No console errors. At 225 the kitchen sign „voľné: 2“ is fully on screen (`/tmp/cabin-t143-fix/closed-225.png`, right edge of the sign about 725 of 780 px).

Commands: `node --test tests/js/` (444 pass), `uv run pytest -q` (741 pass).

## Review re-check

**Reviewer, re-check after test report.** Read the fix diff (`logic-iso-roof.js` `isoHouseSilhouette`, `isoPlanDepth`, `isoHouseOrder`; `app-houses.js` `drawHouseHits`) and the new test. Ran `node --test tests/js/` (444 pass) and `uv run pytest -q` (741 pass). All `static/js/*.js` are listed in `index.html` with `?v=__ASSET_VERSION__`.

- Bug 1 addressed at the cause: the tap area is now the visible silhouette (one convex polygon per room up to the eaves and one per roof with its ridge ends) instead of the hull of the whole outline box up to the ridge, so `main` no longer reaches over the kitchen's roof band at 135. Houses are drawn back to front by depth along the view axis (wholly-nearer first, centre depth as tie-break), derived from `scene.azimuth` with no per-angle branches.
- Each polygon carries the same `data-house` and the same click/hover handlers; `houseBox().poly` is kept only for the zoom-to-house view. Pure logic lives in `logic-*.js` and is Node-tested.
- The new test samples visible roof and wall-top points of every house at all four angles, removes points occluded by another house, and requires the topmost polygon in draw order to be that house; this covers the 135 kitchen case and the 225/315 overlaps from the report.

**Suggestion**
- The test uses `persp: 0` and a fixed 30° ray elevation; the live scene's perspective is covered only by the developer's browser check. Fine for now; the tester's re-run of the (160, 521) tap at 135 will confirm.

Verdict: APPROVED

## Test report (round 2, after the closed-house tap fix)

**Tester, T-143 (round 2).** Own server `127.0.0.1:8471` with temp data (`/tmp/cabin-t143-test/data-r2`, test secrets), stopped after the run. Headless Chrome `--headless=new --use-angle=metal --enable-gpu --ignore-gpu-blocklist`, 390x844 DPR 2, mobile emulation. Taps are real CDP mouse clicks. Driver `/tmp/cabin-t143-test/r2-drive.mjs`, output `/tmp/cabin-t143-test/r2/run.json`, screenshots in `/tmp/cabin-t143-test/r2/`.

Commands and results:
- `uv run pytest -q`: 741 passed.
- `node --test tests/js/`: 444 pass, 0 fail.
- Driver: 0 console errors, 0 exceptions.

| Criterion | Result | Evidence |
| --- | --- | --- |
| Repro: 135°, real tap at CSS (160, 521) on the kitchen roof | PASS | opens `kitchen` only (was `main`) |
| Closed-house taps, all four angles (45, 135, 225, 315), 3 houses each (12 taps) | PASS | a real tap in each house's visible silhouette opens exactly that house, 12/12 |
| 3D and svg aligned (T-135 probe) | PASS | worst 0 px over 72 points at all four angles, closed and with all houses open |
| Bed taps with houses open, all four angles | PASS | 12/12 beds resolve to their own `data-bed` at every angle |
| Open houses correct | PASS | all open, no `.house-hit` blocks the beds, 12/12 |
| Boards readable | PASS (visual) | `r2/phone-angle-{45,135,225,315}.png` (houses open), `r2/phone-closed-135.png` (closed, kitchen sign „voľné: 2“ visible on its roof) |
| Reload keeps angle | PASS | set 225, reload: `viewAngle` 225, stored `225`, azimuth 225, alignment 0 px, beds 12/12 with houses open |
| Default view 45° | PASS | alignment 0 px, beds 12/12 at 45 |

Notes:
- After a reload with houses closed, the bed probe reports `null` for all 12 beds. This is by design (closed houses hide their beds, T-137), not a bug. The same beds resolve correctly with the houses open.
- Not checked here: real iPhone and Android Chrome (already in `tests/manual.md`).

Decision: PASS, no regressions. Moved to `tasks/done/`.
