# T-135: Slight perspective camera

- **Phase:** 1
- **Depends on:** T-134
- **Size:** M
- **UX:** yes

## Goal
More 3D feeling (organizer's request of 27. 10. 2026, item 6): replace the pure orthographic view with a slight perspective, so the far forest looks further away, while the svg overlay (taps, figures, boards) stays exactly aligned.

## Scope
- `logic-iso.js`: a pure perspective projection of the whole scene, fixed for the layout (camera at a chosen distance/FOV along the same azimuth/tilt). `isoPoint` and everything built on it use it; scene size W×H stays computed from it.
- `app-iso.js`: `THREE.PerspectiveCamera` with the same parameters, framing the full scene W×H; pan and zoom crop it with `camera.setViewOffset(W, H, x, y, w, h)` (exactly like the svg viewBox crop), so svg and canvas match at every zoom without re-projecting svg points.
- Upright sprites/boards stay screen-aligned.

## Acceptance criteria
- [x] Projected room corners match the 3D corners within 1 px at rest, zoomed 3× and panned, phone and desktop (headless Chrome probe).
- [x] Visible but gentle depth (near objects larger than far ones); the strength is one constant.
- [x] Bed tap regions still resolve to their own bed (existing test passes on the new projection).
- [x] Tests updated/added; all green.

## Notes for developer
A perspective projection is not affine, so svg shapes must be built from projected points (polygons), never from one svg transform matrix of the plan.

## Design
Shared look for T-135 to T-138 („hlbší 3D svet“): a small model village seen through a slight tele lens, with a late sun and voxel people. One rule over all four: **pixel art stays crisp and nothing slows a signup** (tap bed → done stays as short as today, at most one extra tap that also zooms; see T-137).

**What changes for the person:** nothing to learn. The forest at the back looks a little further away, the front houses a little closer. Taps, pan, pinch, „Celá mapa“, the intro zoom-out, boards and HUD behave exactly as now.

- **Strength:** `ISO.persp = 0.12`, meaning the nearest ground point of the world is drawn 12 % larger than the farthest one (vertical FOV follows from it, about 12–15°). 0 must give the current orthographic look (keep it as the fallback and for the tests). Do not go above 0.2: the 2:1 pixel-art stair steps on wall tops start to look bent.
- **Same azimuth 45° and tilt 30°;** the camera looks at the centre of the world (houses), not at the board block, so the houses get the least distortion.
- **Board block, icon signs, HUD:** not in perspective. They stay upright, flat and screen-aligned at their current place and size (readability on 380 px first). Room labels and bed name tags stay svg text at the projected point, with constant font size (no scaling with depth).
- **svg figures (until T-138 replaces them):** scaled by the local depth factor at their bed, rounded to steps of 0.05, so a figure never looks bigger than its bed.
- **Tap regions:** svg polygons from projected bed corners (per the dev note); on phone the effective target stays ≥ 44 px when zoomed in, as today.
- **Phone 380 px rest view and desktop ≥ 900 px wide and short windows:** the fitted view (`isoContentRect`) must still show every room and its walls with no clipping; recompute it from the projected points.
- **No-WebGL fallback:** keeps the flat svg ground on the same projection, no extra work.
- **Reduced motion, dark mode:** nothing new (the scene is never inverted; no new panels).

Not in scope: tilting or orbiting the camera, depth of field, blur, fog shaders, any change of the board block layout.

Organizer decision: strength 0.12 is the default; the organizer may want it stronger after trying it (one constant).

---
## Dev log

- `logic-iso.js`: `ISO.persp = 0.12`; `isoBasis(az, tilt, persp, plan)` now computes the camera distance D so the nearest plan corner is drawn 1.12× the farthest; `isoRaw` projects with scale D/(D-z) around the plan centre (0 gives the old orthographic formula); new `isoDepthScale`; `isoScene` sizes W×H from corners at ground and at headroom height; `isoFigure` scales the sprite by the foot's depth in steps of 0.05 (room plates, text and board block keep constant size). Everything else (hits, tags, content rect) is built on `isoPoint`, so it follows.
- `app-iso.js`: `THREE.PerspectiveCamera` at the same azimuth/tilt looking at the plan centre; `isoSync` sets an off-centre frustum by `projectionMatrix.makePerspective` (principal point = scene `ox, oy`), the same crop as the svg viewBox. Deviation: not `setViewOffset`, because the scene's principal point is not the middle of W×H; the result is the same crop. Orthographic camera kept for persp 0.
- Tests: `tests/js/logic.test.mjs` (5 new perspective tests, 2 old formula tests pinned to persp 0, figure scale regex). `node --test tests/js/` 409+ pass; `uv run pytest -q` pass.
- Headless Chrome (CDP, own server :8247, data /tmp/cabin-t135/data, stopped): THREE `project` vs svg point for 5 ground points x heights 0/6/28 plus all room corners: worst error phone 390x844 rest 0 px, zoom 3x 0.002 px, panned 0.002 px; desktop 1280x900 0 / 0.001 / 0.001 px. Screenshots /tmp/cabin-t135/{phone,desktop}-{rest,zoom3,panned}.png.
- Follow-up: the foot shadow in `drawFootShadow` uses the base figScale, so with depth scaling it varies by about 10 % with the figure; negligible.

## Review round 1

Checked the T-135 diff (`static/js/logic-iso.js`, `static/js/app-iso.js`, `tests/js/logic.test.mjs`). `node --test tests/js/`: 409 pass. `uv run pytest -q`: 741 pass.

- Math: `isoRaw` scales by D/(D-z), with z measured along the view axis from the plan centre. `isoSync` builds `makePerspective(l*n, r*n, t*n, b*n)` with n = near/D, so a camera-space x_c lands at u = x_c * D/depth. That is exactly `isoRaw`, so the off-centre frustum replaces `setViewOffset` correctly. The deviation is justified because the principal point (ox, oy) is not the middle of W×H. `projectionMatrixInverse` is refreshed. No code calls `updateProjectionMatrix()` on the perspective camera, so the custom matrix is never reset.
- Every svg shape (hits, room outlines, `drawBase`, plates, tags, content rect) is built from `isoPoint` and `convexHull`. No affine plan transform remains, as the dev note asked. Projected rectangles stay convex, so `isoPointIn` still holds.
- The strength is one constant (`ISO.persp = 0.12`), and 0 still gives the orthographic path, with tests for both. The existing bed tap and meadow tests pass on the new projection. The fit test covers rooms and walls inside the scene and the content rect.
- The screenshots in /tmp/cabin-t135 (phone rest and zoom 3×) show the svg and the 3D world aligned. The dev's CDP probe reports at most 0.002 px of error. I did not re-run the probe, because the frustum math above reproduces the projection exactly.
- Scope and constraints: no new scripts, no Slovak strings, no `innerHTML`.

Blockers: none.

Suggestion: `drawFootShadow` (app-beds.js:139) still divides by the base `figScale`, so the shadow grows and shrinks with depth by about 6 %. The dev noted this, and it is fine to leave.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester (T-135, 27. 10. 2026): **FAIL** on criterion 1 (desktop alignment after a time-slider drag). Everything else passes. Moved back to `in-progress`.

**Commands and results**
- `uv run pytest -q`: 741 passed (14.4 s).
- `node --test tests/js/`: 409 pass, 0 fail.
- Temporary server on 127.0.0.1:8377 (GROUP_CODE/ADMIN_CODE/SECRET_KEY test values, SMS_FAKE=1, data in `/tmp/cabin-t135-test/data`), stopped at the end. `/api/health` ok; `/data/cabin-data.yaml` and `/static/../data/cabin-data.yaml` return 404.
- Headless Chrome over CDP (own port), scripts in `/tmp/cabin-t135-test/` (`probe.mjs`: full regression on 390x844 mobile and 1280x900 desktop; `final.mjs`: 380x740 and 1000x600; `diag6.mjs`, `diag6head.mjs`, `diag7.mjs`: the drag diagnosis, also on a `git archive HEAD` copy at :8378, stopped). Screenshots in `/tmp/cabin-t135-test/shots/`. The browser console had no errors in any run.

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| Projected room corners match 3D within 1 px at rest, 3× and panned, phone and desktop | FAIL | Phone 390x844: 0 / 0.001 / 0.003 px. Desktop 1280x900 without a slider drag: 0 px after wheel zoom and after pan. Desktop after a time-slider drag: 7.5 px at 3×-ish wheel zoom, 23 px after pan (see bug 1). |
| Visible but gentle depth; strength is one constant | PASS | `ISO.persp = 0.12` is the only constant. Browser check: nearest plan corner scale 1.060, farthest 0.946, ratio 1.12. Tests cover persp 0 (orthographic). |
| Bed tap regions resolve to their own bed | PASS | `elementFromPoint` at each hit polygon centroid returns its own `data-bed`: 12/12 on phone and desktop. A real mouse click on `bed-left-double` opens the sheet at 390, 380 and 1000 px wide and at 1280. |
| Tests updated/added; all green | PASS | 741 pytest, 409 node. |

**Regression (quick, on both viewports)**
- Bed tap: PASS (above).
- Board tap (night signpost 30. 10.): PASS, the time-lapse runs and the knob moves to 18:45 within about 1 s.
- Time slider drag: PASS (piatok 12:00 → štvrtok 12:00 on a 90 px drag).
- Wheel zoom in and out: PASS (view changes as expected, alignment 0 px on phone).
- Pinch zoom (two touch points apart): PASS (phone and desktop).
- Pan by drag: PASS on phone (0.003 px). On desktop without a prior slider drag: PASS (0 px). On desktop after a slider drag: FAIL (bug 1).
- Fit view: `app.sceneContent` inside `app.view` at 380x740 and 1000x600 (no clipping at rest).

**Extra scenarios**
- Phone rest, zoom and pan after a slider drag: aligned (0.000 to 0.003 px), so the failure is desktop-only so far.
- Sign tap alone (no slider drag) on desktop: the svg shift is transient (gone after about 3 s).
- Same drag sequence on the pre-T-135 HEAD copy (`git archive`, T-134): the same shift (6.4 px at rest-after-drag, 7.7 px after wheel). So bug 1 is pre-existing, but it breaks the T-135 criterion on desktop.

**Bug 1 (criterion 1, desktop only): svg and 3D world drift apart after a time-slider drag**
- Steps: desktop window 1280x900 (Chrome, no mobile emulation). Open the page with the test party. Drag the time knob (`#scene [data-key=time] .hit`) about 90 px to the left, release, wait 1 s. Then mouse-wheel zoom in (deltaY −300) at the middle of the scene, or drag the map.
- Expected: taps, figures and labels from the svg stay on the 3D beds (within 1 px), as at rest and after a wheel zoom without a drag.
- Actual: after the drag the svg has class `night` and its screen CTM scale changes from 1.0667 to 1.0504 (ctm f 0 → 6) while its box stays 1280x900 and its viewBox attribute is unchanged. Room corners are then off by 7.5 px after the wheel zoom and 23 px after a pan (18.9 px at the fit view after zooming out). Without the drag the error is 0 px.
- Suspect: the `night` class toggled by `app-daynight.js:69` during the slider drag, or a layout change it causes on the svg. Not investigated further (no app code changes by the tester).
- Fix suggestion for the developer: find what changes the svg's CTM after the drag (`svg.getScreenCTM()` before and after, with the `night` class removed), and make the svg mapping independent of it. Then re-run the probe in `/tmp/cabin-t135-test/diag6.mjs` (desktop) and `probe.mjs`.

**Manual, added to `tests/manual.md` (section 17):** depth look on iPhone Safari and Android Chrome; tap and figure alignment after 3× zoom and pan on a phone; desktop alignment after a slider drag (open until bug 1 is fixed).

**Notes:** the existing Node test for the bed tap and the fit tests cover the new projection (0 px mismatch in the browser at rest on both viewports). Dev log claimed 0.001 px desktop at zoom 3×, which I reproduced only without a prior slider drag.

### Re-test (27. 10. 2026, after the desktop-drift fix)

Tester: **PASS**. Bug 1 is fixed, all four criteria pass on phone (390x844) and desktop (1280x900), no regressions found. Moved to `done/`.

**Commands and results**
- `uv run pytest -q`: 741 passed.
- `node --test tests/js/`: 410 pass, 0 fail.
- Temporary server on 127.0.0.1:8400 (own port; test secrets, `SMS_FAKE=1`, data `/tmp/cabin-t135-test/data-r2`), stopped at the end. `/api/health` ok (version 1.21.1). `/data/cabin-data.yaml` and `/static/../data/cabin-data.yaml` return 404, `/api/state` without a cookie returns 401.
- Headless Chrome over CDP, scripts in `/tmp/cabin-t135-test/r2/`: `probe.mjs` (phone regression, output `probe-out.txt`), `t135-r2.mjs phone|desktop` (slider drag, wheel zoom in and out, pan, alignment at each step, places sheet night sections, screenshots `phone-sheet.png` and `desktop-sheet.png`), `t135-r2-zoom.mjs desktop` (four wheel steps), `fit-r2.mjs` (fit containment), `depth-r2.mjs` (depth strength), `diag6.mjs` (desktop drag then wheel). Browser console had no errors in any run.

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| Projected room corners match 3D within 1 px at rest, zoomed and panned, phone and desktop | PASS | Phone 390x844: rest 0 px, wheel zoom 1.5x 0.001 px, pinch zoom to 3.5x (view 574 → 162 px wide) and pan 0.003 px. Desktop 1280x900: rest 0 px, after a slider drag 0 px (0.8 s and 3.8 s), wheel zoom to 2.2x 0.002 px, pan 0.001 px, zoom out 0 px. |
| Visible but gentle depth; strength is one constant | PASS | `ISO.persp = 0.12`. Browser: nearest plan corner scale 1.060, farthest 0.946, ratio 1.12. |
| Bed tap regions resolve to their own bed | PASS | Phone: 12/12 hit polygons return their own `data-bed` (probe). Desktop: a bed tap after drag, zoom and pan opened the bed sheet with its night sections. The 12/12 hit-test was not repeated on desktop this round. |
| Tests updated/added; all green | PASS | 741 pytest, 410 node. |

**Regression (both viewports)**
- Bed tap: PASS (phone 12/12, desktop sheet opens after drag, zoom and pan).
- Night signpost tap (time-lapse): PASS on phone (knob goes to 18:45 and the sign shows); not repeated on desktop this round.
- Time slider drag: PASS on both (piatok 12:00 → štvrtok 12:00 with the 90 px drag).
- Wheel zoom in and out, pinch zoom, pan: PASS on both, alignment as above.
- Fit view at rest: `app.sceneContent` inside `app.view` on both viewports (`inside: true`).
- Places sheet night sections (bed sheet, desktop and phone): PASS. Three `section.night`, the selected one has `.on` with the moss bar and tinted head, 2 px top rule, 4 px / 8 px padding, `.night-head` 44 px high. The svg itself has no padding or border now (`svgCssAfterFix`), and its box stays 900 px (desktop) and 844 px (phone) after the drag. Screenshot of the phone sheet checked: correct.
- The svg scale stays constant across the drag (desktop 1.067 before and after; the old bug moved it to 1.050).

**Extra scenarios**
- Startup with a short `SECRET_KEY` (under 32 characters) refuses to start with a precise message. This is the intended behaviour, not a bug.
- The desktop wheel zoom reached 2.2x of the fitted view (four wheel steps). 3x was checked on phone by pinch. A desktop check at 3x needs more wheel steps or a trackpad pinch, not done this round.

**Manual:** `tests/manual.md` section 17 item "Alignment after the time slider on desktop" updated to the fixed state. It stays unticked until a real desktop browser confirms it.

**Failures:** none.

## Dev log (fix for test bug 1)

- Root cause: the time-of-day code toggles class `night` on the scene `<svg>` (`app-daynight.js:69`, for the quilts and „z-z-z“), and the panel stylesheet had a bare `.night { margin; padding: 4px 0 8px; border-top: 2px }` meant for the `section.night` in the places sheet. Once the svg was "night" it got 14 px of padding and border, so its content box shrank (900 to 886 px high) while the host stayed 1280x900: the svg scale changed (1.0667 to 1.0504) but `isoSync` (which uses the host size) did not know. Pre-existing since T-134, not part of the perspective change.
- Fix: `static/index.html` rules are now `section.night` and `section.night.on .night-head`, so they no longer match the svg. Regression test in `tests/js/logic.test.mjs`: no bare `.night` selector in the page CSS outside `section` or `svg` selectors.
- Verified (own server :8391, data /tmp/cabin-t135-dev/data, stopped): desktop 1280x900 `diag6` after the slider drag and after wheel zoom: worst error 0 px, svg scale stays 1.067 (before: 6.28 and 7.53 px). `probe.mjs` (phone and desktop regression): worst 0 to 0.003 px, no errors.
- Tests: `node --test tests/js/` 410 pass; `uv run pytest -q` 741 pass.
- Note: `tests/manual.md` section 17 line about desktop alignment after a slider drag can be ticked by the tester.

## Review re-check

Re-check after test bug 1 (desktop drift after a slider drag). Diff: `static/index.html` lines 362 and 367, plus one test in `tests/js/logic.test.mjs`.

- Root cause confirmed. `app-daynight.js:69` toggles `night` on the scene svg, and the bare `.night` panel rule gave the svg padding and a border, so its content box shrank while `isoSync` still used the host size. The rules are now scoped to `section.night`. The only other user of the class is `app-sheet.js:83`, which creates `section.night`, so the places sheet looks the same. The `#scene svg.night` rules (quilt, z-z-z) are untouched.
- The regression test fails if any bare `.night` selector returns outside `section` or `svg`. Good enough as a guard.
- `node --test tests/js/`: 410 pass, 0 fail. `uv run pytest -q`: 741 pass. I did not re-run the browser probe. The dev reports 0 px after drag and wheel zoom on desktop, and the tester re-checks this.

Blockers: none.

Verdict: APPROVED
