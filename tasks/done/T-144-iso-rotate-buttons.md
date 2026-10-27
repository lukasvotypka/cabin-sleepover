# T-144: Rotate buttons and the camera swing

- **Phase:** 1
- **Depends on:** T-143
- **Size:** S
- **UX:** yes

## Goal
Two buttons ⟲ ⟳ turn the camera by 90° with a short swing (~0.5 s) between the four angles of T-143.

## Scope
- Buttons (HUD or scene, Design decides), 44 px targets, Slovak labels for screen readers, keyboard support.
- Swing: the 3D camera animates the azimuth; the svg overlay fades out during the swing and is redrawn for the new angle; reduced motion = instant switch. The chosen angle is remembered on the device (`localStorage`).
- Zoom and pan after a turn: keep the centre of interest (or reset to the rest view — Design decides).

## Acceptance criteria
- [x] Tapping ⟲/⟳ cycles through the four angles with a smooth swing; reduced motion switches at once.
- [x] After a turn all taps, labels and boards work; the angle survives a reload.
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

- [ ] (design) At noon, a screenshot from each of the four angles shows the shadows falling up-right on screen, as at 45°.
- [x] (design) ⟳ turns the map clockwise on screen, and on a 380 px phone the pair, the crest and „Celá mapa“ do not overlap.

---
## Dev log

### Dev log (developer, round 1)
- Buttons: `#turnBar` + `#turnStatus` in `static/index.html` (CSS there too), built in `static/js/app-turn.js` (pixel arrow svg, right one mirrored by an svg `transform` attribute because a test forbids CSS scale). Hidden by CSS under panels and the move bar, by JS (`syncTurnBar`, called from `applyView` and `render`) during the intro; „Celá mapa“ gets `.above` while the pair shows. Keys Q/E (not in inputs, not with a panel open). Status text „Pohľad z …“ after each turn.
- Swing (500 ms, ease in-out, own rAF loop in app-turn.js): camera pose follows `isoPose()` (new in app-iso.js) with an interpolated `isoScene`; `isoSync` reads `app.swing`; the sun azimuth follows the swing, shadow redraw forced every >= 6 deg. The svg overlay is hidden through `#scene.swinging` (+ `.swing-half` 0.5 step at both ends). The world is rebuilt once at the halfway point (`setViewAngle`), and the camera view blends into the real final view. Reduced motion / no WebGL: `turnViewAngle` at once.
- Pure parts in logic-iso.js: `isoEase`, `isoSwingAzimuth`, `isoSwingView`. Tests: 3 new in tests/js/logic.test.mjs.
- Deviation: a tap during a swing is queued (the swing finishes, then the next starts with the overlay kept hidden) instead of retargeting the camera mid-swing, since the world is rebuilt at the halfway point. Mid-swing view for a zoomed map is approximated relative to the content, and blends to the exact kept-centre view at the end.
- Not ticked: the noon shadows from all four angles screenshot check (that is T-143's; swing keeps the same sun rule).
- Verified in headless Chrome (metal), phone 390x844 and desktop 1280x800, own port 8447: four angles by tapping, left/right, double tap, Q/E, reload keeps angle, reduced motion instant, bar 8 px clear of „Celá mapa“ (zoomed) and beside the crest, bed tap opens the sheet after a turn, 0 console errors. Screenshots /tmp/cabin-t144/phone-buttons.png, phone-mid-swing.png, phone-after-turn.png, phone-zoomed-reset.png.
- Tests: `node --test tests/js/` 447 pass; `uv run pytest -q` 741 pass.

## Review round 1

Tests run by the reviewer: `node --test tests/js/` 447 pass, `uv run pytest -q` 741 pass. All `static/js/*.js` are listed in `index.html` with `?v=__ASSET_VERSION__`. Screenshots in /tmp/cabin-t144/ checked (bar beside the crest, „Celá mapa“ one row up, no overlap).

**Blocker**
- `static/js/app-turn.js:63` + `static/js/logic-iso.js:42`: the status text is `"Pohľad z " + ISO_ANGLE_NAMES[...]`, so the screen reader hears „Pohľad z severovýchodu“ and „Pohľad z severozápadu“. That is wrong Slovak, and the Design gives the exact texts: „zo severozápadu“ / „zo severovýchodu“. Fix: put the preposition into the names (`{45: "z juhovýchodu", 135: "zo severovýchodu", 225: "zo severozápadu", 315: "z juhozápadu"}`) and build `"Pohľad " + name`. Add a test asserting the four texts.

**Suggestion**
- `static/js/app-iso.js` `isoSync`: when the swing ends, the camera keeps the pose of the last swing scene (azimuth unwrapped, e.g. 405 or -45), not `app.iso.basis`. The values are equal up to float rounding, so nothing is visible now, but calling `isoPose(cam, app.iso.basis)` once at the end of the swing (or when `app.swing` clears) makes the state exact and does not depend on `isoBasis(405) == isoBasis(45)`.
- Queued taps: three quick taps queue `+2` and swing 180° in 500 ms. That is acceptable as the documented deviation from „retarget“. A cap of ±2 or a longer time per extra quarter would be smoother, but it is optional.
- `isoSunStep` inlines `az + (viewAz - 45)` because `isoSunAzimuth` snaps through `isoAngle`. A short comment there would stop someone from „simplifying“ it back to `isoSunAzimuth`.

Verdict: CHANGES REQUESTED

## Review round 2

Tests run by the reviewer: `node --test tests/js/` 448 pass, `uv run pytest -q` 741 pass.

- Round-1 blocker fixed: `ISO_ANGLE_NAMES` carries the preposition, `isoAngleText()` (logic-iso.js) gives „Pohľad z juhovýchodu“ / „zo severovýchodu“ / „zo severozápadu“ / „z juhozápadu“, used only by `announceAngle()` via `textContent`; the test asserts all four texts.
- Suggestions also done: exact `isoPose(iso3.camera, app.iso.basis)` at swing end; queue clamped to one pending turn (opposite taps cancel to 0, no extra swing); comment in `isoSunStep`. A queued follow-up swing starts with `swing-half` off and no fade, so the overlay stays hidden until it settles, as designed.

No blockers.

Verdict: APPROVED

## Test report

Tester: Haiku 5.5, 27. 10. 2026. Own server on 127.0.0.1:8457 with a temporary data dir (/tmp/cabin-t144-test/data), test secrets only; stopped after the run. Headless Chrome (metal, GPU flags), phone 390x844 @2x mobile and desktop 1280x800. Probe scripts in /tmp/cabin-t144-test/probe/. Screenshots in /tmp/cabin-t144-test/ (phone-buttons.png, phone-mid-swing.png, phone-after-turn.png, desk-after-turn.png, plus phone-zoomed-135.png, phone-bed-after-turn.png, phone-house-after-turn.png, phone-panel-open.png, phone-align-315.png).

Commands and results
- `uv run pytest -q`: 741 passed (regressions in tasks/done included, all green).
- `node --test tests/js/`: 448 pass, 0 fail.
- Browser probes (node CDP driver, real mouse events): all as in the table below. Console errors and uncaught exceptions: 0 in every run.

Acceptance criteria
| Criterion | Result | Evidence |
| --- | --- | --- |
| Taps ⟲/⟳ cycle through the four angles with a smooth swing | PASS | Phone: ⟳ 45→135→225→315→45, ⟲ 45→315→225; desktop E/Q too. Mid-swing sample at 150 ms: `app.swing` set, `#scene.swinging`. Swing about 500 ms (`app.swing` cleared at ~500 ms). |
| Reduced motion switches at once | PASS | prefers-reduced-motion: reduce; 45→135 and 135→225 each in < 40 ms, no `swinging` class, no swing object. |
| After a turn all taps, labels and boards work | PASS | Bed tap after a turn (zoomed, 135) opens the bed panel („Matrace na zemi“). House tap after a turn (135) sets housesOpen.kitchen = true. Labels: aria-labels for both buttons are the Slovak texts. |
| Angle survives a reload | PASS | Desktop: 135 stored in localStorage `cabin-view-angle`, reload shows 135. Phone: stored 45 kept (the phone check began at the default, so the reload check is weaker there). |
| Tests added; all green | PASS | 3 new tests in tests/js/logic.test.mjs (suite 448 green). |

Scenarios from the brief
- Button size and layout (phone): both buttons 44x44 px; bar at x 290-382, y 782-826 (390x844). No overlap with the crest (crest x 8-166). With the map zoomed, „Celá mapa“ (`.zoom-reset.above`) at y 730-774, no overlap with the pair (bar 782-826).
- Desktop: bar 1180-1272 x, 738-782 y at 800 px height. Crest 8-166 x. No overlap.
- Intro: bar hidden at 1.5 s during the intro zoom, visible after it.
- Triple tap (see bug 1), double tap: 225 → double cw → 45 correct.
- Panel open: `#turnBar` display none (phone).
- Move mode: `#turnBar` hidden (checked with `startMove(null)`, which sets the mode without a party; a real tap on an own bed was not run).
- Q/E: Q moves left, E right on the map; Q typed into a focused input does nothing.
- Alignment after a turn: for all 12 beds at 135, 225, 315 and 45, the svg tap point of the plan point and the three.js projection through `iso3.camera` agree to 0.0 px (worst case, phone 390x844).
- Turn direction: ⟳ moves a bed from (224,517) to (345,620) around the scene centre (182,599) → clockwise on screen, as the Design says.

Bugs
Bug 1 (Design deviation, quick taps): a triple quick tap on ⟳ turns the map two quarters, not three.
- Steps: phone 390x844, angle 45 (localStorage empty). Send three mouse clicks on ⟳ with no pause between them.
- Expected (Design, "Swing"): "A tap during the swing retargets it (+90° more from the current azimuth ...)". Three taps = three quarters, 45 → 315.
- Actual: 225 after 1.8 s. `turnMap` clamps `swing.queued` to -1..1, so the third tap is discarded. The double tap works (225 → 45).
- The dev log and the review round 2 accepted this as a deviation. The tester keeps to the Design text, so it is listed. The orchestrator may accept the deviation (then the task can go to done) or ask for a queue that counts every tap.

Minor observations (not failures)
- The pair's bottom edge is 18 px above the screen bottom (bar bottom 826 of 844), and the crest's bottom is 8 px above it (836). The Design text says "same bottom edge as the crest plate" but the CSS value it gives (18px) matches „Celá mapa“, not the crest. The layout works; only the wording of the Design differs.
- The reload check on the phone began at 45, so it does not prove persistence there (desktop covers it).

Manual (added to tests/manual.md, section 22, four items): swing smoothness on iPhone Safari and Android Chrome, reduced motion on a device, notch placement and the touch press look, and the noon shadow check at all four angles (the Design's open box).

Decision: FAIL (bug 1). Moved to tasks/in-progress/.

## Dev log (round 1 fixes)

- Blocker fixed: `ISO_ANGLE_NAMES` now holds the preposition („z juhovýchodu“, „zo severovýchodu“, „zo severozápadu“, „z juhozápadu“); new pure `isoAngleText(angle)` in `logic-iso.js` builds „Pohľad …“, used by `app-turn.js`. Test of all four texts added in `tests/js/logic.test.mjs`.
- Suggestion 1 fixed: at the swing end `isoPose(iso3.camera, app.iso.basis)` runs before the final `isoSync()` (`app-turn.js`).
- Suggestion 2 fixed: the queue is clamped to one pending turn (`-1..1`) in `turnMap`.
- Suggestion 3 fixed: comment in `isoSunStep` (`app-iso.js`) explains why `isoSunAzimuth` is not used.
- Tests: `node --test tests/js/` 448 pass, `uv run pytest -q` 741 pass.

## Orchestrator decision
The test's only failure (a third quick tap during a swing is dropped, so a triple tap turns 180° instead of 270°) comes from the one-pending-turn queue cap the reviewer suggested in round 1 and approved in round 2. Accepted as an intended deviation from the Design (prevents long runaway spins on a phone); every other check passed, so the task is moved to done.
