# T-147: The perspective camera follows the pan („see around the corner“)

- **Phase:** 1
- **Depends on:** T-146
- **Size:** M
- **UX:** no (the organizer chose the behaviour: option A of 27. 10. 2026)

## Goal
Today the slight perspective (`ISO.persp` 0.12, T-135) is centred on the middle of the plan and fixed; panning only shifts the frustum crop (`isoSync`), so a house looks the same wherever it is on screen. The organizer wants the camera to travel with the pan: the eye stays above the plan point under the screen centre, so a house near the screen edge shows its side wall and you "see slightly around the corner" as you move through the village. A bit stronger perspective (default 0.2) makes it noticeable.

## Scope
- `static/js/logic-iso.js` (basis centre = a given plan point instead of the plan middle; `isoScene` / `isoPoint` / `isoUnpoint` take it), `static/js/app-iso.js` (`isoSync`: camera position and look-at follow the view centre), `static/js/app-zoom.js`, `app-scene.js`, `app-draw.js`, `app-houses.js`, `app-board.js`, `app-iso-people.js` and whatever draws svg at projected points, tests, CLAUDE.md, `tests/manual.md`.

## Acceptance criteria
- [x] While panning (drag, inertia, intro, „Celá mapa“, ease to an opened house, turn swing) the perspective centre is the plan point under the screen centre: objects near the screen edges show their outward sides, the one in the middle is seen as at the rest view. Zoom does not change the strength.
- [x] The svg layer (bed tap areas, house hit polygons, ridge signs, room labels, bed tags, notice board, gate, no-WebGL fallback drawing) stays aligned with the 3D within ~1 screen px during the pan, not only after it; taps work right after a pan at all four angles.
- [x] Strength: default `ISO.persp` 0.2; `?persp=<0..0.35>` in the page address overrides it for that device for tuning (remembered in localStorage like `?fps`, `?persp=` with no value or out of range clears it). Shadows, roofs, people and the board look right at 0 and 0.35.
- [x] Performance: panning on the Mac metal headless run stays at 30 fps; report fps-meter cpu ms before/after for a pan (phone 390×844). The svg update per pan frame must be cheap (no full rebuild of the svg DOM each frame; move/transform existing nodes or reproject points only).
- [x] The rest view, intro, phone rest view, turn and the T-145 HUD insets still fit as before.
- [x] Node tests for the moving centre (`isoPoint`/`isoUnpoint` round trip with a centre, a point at the centre is unchanged by the strength, edge points reveal sides); all suites green; screenshots.

## Notes for developer
- The projection must stay one pure function shared by svg and WebGL (see CLAUDE.md "Isometric 3D map").
- Possible approach: keep the 3D world static, move the perspective camera's eye/target to the view centre each sync; for the svg, reproject the anchor points of the overlay items in place on each `applyView` (cache their plan coordinates). If a full reprojection per frame is too slow on the swiftshader run, reproject at most once per animation frame.
- Keep `prefers-reduced-motion` behaviour (no extra animation; the effect is geometry, so it is fine).

## Design
(not needed)

---
## Dev log

### Round 1 (developer)
- Pure: `logic-iso.js` gets `isoSetCentre`, `scene.ref` (fixed plan-middle frame), `isoAnchorMake`/`isoAnchorTransform`, `perspSetting`; `ISO.persp` 0.2; `isoUnpoint` 16 rounds; `isoTurnView`/`isoContentRect` use `ref`.
- App: new `static/js/app-anchor.js` (listed in `index.html`; anchors + `?persp=` init, `KEYS.persp`), `isoSync` centres the scene on the view centre and moves the camera each sync, then `isoAnchorsUpdate()` sets a `transform` on anchored svg nodes (about 100 setAttribute per pan frame, no rebuild). Anchored: bed groups, bed/house/tree/meadow tap polygons, room signs, bed tags, ridge signs, gate, board (`app-beds.js`, `app-houses.js`, `app-board.js`). Intro focus, house ease and the world-top checks use `scene.ref`. The `isoBedHits` cache is dropped (recomputed per `drawBeds`) so anchors match the centre it was drawn at.
- Deviations: the anchors are an approximation (translate + depth scale per item); measured error up to about 1.4 scene units at a 110-unit pan from the centre (about 0.8 px at the phone rest view), so the test tolerance is 1.6. Without WebGL the centre is not moved (the flat fallback is consistent with itself). Signs keep their size (no depth scale), as before.
- Perf (headless Chrome, swiftshader, 390x844): fps meter during and after pans `30 fps, cpu 0.1-0.2 ms (max 0.6)`, 14-19 calls; 90 programmatic pan frames averaged 27.6 ms incl. software render (headless). No before figure taken (the render cpu was already ~0.1 ms at rest).
- Tests: `node --test tests/js/` 464 pass; `uv run pytest -q` 734 pass.
- Screenshots in /tmp/cabin-t147-dev/: phone-rest, phone-pan-left, phone-pan-right, phone-persp035-pan-right, desktop (.png). Preview server was on port 8231.
- Open: the T-145 HUD insets and the rest view were not changed by this task.

## Review round 1

Tests run by the reviewer: `node --test tests/js/` 464 pass, `uv run pytest -q` 734 pass. Every `static/js/*.js` (including the new `app-anchor.js`) is listed in `index.html` with `?v=__ASSET_VERSION__`. The pure part is good: `isoSetCentre`/`scene.ref`, the frame users (`isoTurnView`, `isoContentRect`, `introFocus`, `houseBox`, `underBoards`, smoke) moved to `ref`, `perspSetting`, and the 0.2 default. The screenshots show the effect at 0.2 and 0.35.

**Blocker**

1. `static/js/app-anchor.js:26` `isoAnchorPoly` (used for the house hits at `app-houses.js:139`, bed tap regions at `app-beds.js:79`, the tree at `:98` and the meadow at `:175`). The approximation of one translate plus one depth scale per polygon (anchored on the ground under the screen centroid) does not stay within the AC's ~1 screen px. The developer measured one small bed at h 7. I measured the real items with the shipped pure functions (`isoHouseSilhouette`, `isoHitRegions`, anchored exactly as `isoAnchorPoly` does, worst vertex distance to the true projection after `isoSetCentre`, persp 0.2):
   - house hit polygons: about 3.5 scene units at a 50-unit pan from the drawing centre, about 7 at 100 (twice that at `?persp=0.35`). Example: the „main“ house, room „left“, 50-unit pan to the right. The front corner truly moves −1.87 units, but the transform moves it −0.29. The near corners shift more than the anchor, which is the parallax across a 250-unit-wide house.
   - bed furniture and figure tap regions: about 2–2.8 units at a 100-unit pan, 3.3–4.1 at 150.
   - The drift does not go away when the pan ends. Nothing redraws until the next `drawBeds`, so it is not only "during the pan".
   
   Failure scenario: zoom in to 2–2.5x (houses open), pan to a room near the scene edge, and tap the edge of a figure. At about 1.1–1.5 px per unit the svg hit is 4–6 px away from the 3D doll, so the tap can land on the neighbouring slot or on nothing. On a desktop, with more px per unit, it is worse. A closed house at the edge of the screen has its tap outline several px off as well. This breaks "taps work right after a pan" and "within ~1 screen px".
   
   Expected fix: keep the anchor transform for the signs (ridge signs, room signs, bed tags, board, gate). Their translate is exact because they hang on a real plan point. For the polygons, reproject exactly. Recompute `isoHouseSilhouette` / `isoHitRegions` / tree and meadow polys at the current centre and set their `points`, at most once per animation frame, or at least on every sync where the centre moved. These are a few dozen polygons, about the same number of `setAttribute` calls as now. Then tighten the Node test to the real worst case: a house silhouette and a figure region at a 150-unit pan, in all four angles, with a tolerance of about 1 unit.

**Suggestions**

- Perf AC: it asks for the Mac metal headless run with before/after cpu ms, and only swiftshader without a before figure was given. Pure camera moves plus about 100 `setAttribute` calls are clearly cheap, so this is not blocking. Please add the metal numbers when you re-run for the fix.
- `showTip` (`app-beds.js` about line 293) positions the 2.5 s name tip at the current centre and does not anchor it, so it drifts a little if you pan while it shows. You could anchor it like a sign.
- The test "a point at the edge shows its sides" only checks `notEqual`. Assert the sign instead: the lean is positive on one side and negative on the other, and at the centre it equals the rest lean.
- The task file still has the last AC box unchecked, although the tests exist.

**Judgement of the stated deviations**

- Anchor approximation (~0.8 px): not accepted as measured. It holds only for small items near the drawing centre (see Blocker 1). Signs: fine.
- No-WebGL fallback keeps a fixed centre: accepted. There is no 3D layer to line up with, and the flat fallback stays consistent with itself.
- Perf only on swiftshader: accepted for now (see the suggestion).

Verdict: CHANGES REQUESTED

### Round 2 (developer, answers to review round 1)
- Blocker 1 (fixed): tap polygons (bed hit regions, house silhouettes, tree, meadow) are no longer anchored by transform. `app-anchor.js` has `isoPolyGroup(layer, nodes, fn)`: `fn()` projects the polygons again at the current centre and `isoAnchorsUpdate()` sets their `points` exactly on each sync where the centre moved (isoSync runs once per view change, so at most once per frame; about a few dozen polygons, no DOM rebuild). Signs (ridge, room signs, bed tags, board, gate) and bed groups keep the transform anchor (exact translate for signs). `isoAnchorPoly` removed. Changed: `app-anchor.js`, `app-beds.js`, `app-houses.js`.
- Tests: the old anchor tolerance test is replaced by a sign-shift test (exact) and a test at a 150-unit pan in all four angles (same count of regions, moved, every bed centre lies in its own region). The edge test now asserts opposite signs (west leans less, east more, by more than 0.2 around the rest lean). The source-regex test in `houses open` follows the new filter expression. `node --test tests/js/` 465 pass; `uv run pytest -q` 734 pass.
- Perf (Mac, headless Chrome with `--use-angle=metal`, phone 390x844, 90 programmatic pan frames): after (persp 0.2): `30 fps, cpu 0.4-0.5 ms (max 0.8), gpu 0.6-0.9 ms, 14 calls`, 16.5 ms/frame incl. raf; before (persp 0, no camera follow, no svg update): `30 fps, cpu 0.6-0.7 ms (max 1.1), gpu 0.7-0.8 ms`, 16.5 ms/frame. No measurable cost.
- Suggestions: AC box ticked; edge test asserts the sign. `showTip` anchoring not done (2.5 s tip, small drift only if panning while it shows); left as follow-up.

## Review round 2

Tests run by the reviewer: `node --test tests/js/` 465 pass, `uv run pytest -q` 734 pass. `app-anchor.js` is still listed in `index.html` with `?v=__ASSET_VERSION__`.

**Round 1 blocker 1: fixed.** `isoAnchorPoly` is gone. The bed hit regions (`app-beds.js` `drawBedHits`), the tree hit, the meadow hit and the house silhouettes (`app-houses.js` `drawHouseHits`) are registered with `isoPolyGroup`. `isoAnchorsUpdate()` (called from `isoSync` once per view change, and skipped when the centre key has not changed) projects them again with the same pure functions at `app.iso`'s current centre and sets `points`. That is the exact projection the 3D uses, so the parallax error is gone during and after the pan. There is no DOM rebuild, only one `setAttribute` per polygon. Signs keep their exact translate anchor. `houseBox` now uses `app.iso.ref`, so the house ease target does not depend on the current centre. The open/closed filter in `drawBedHits` is evaluated again on each update. Any change of `isoHouseSvgOpen` redraws through `onHouseVisualChange` → `renderBeds`, or through `render()` when `housesQuiet` is set, so the node order cannot go stale, and the length guard covers the rest. The new Node tests cover an exact sign shift, the polygons re-projected at a 150-unit pan in all four angles, and opposite lean signs at the edges.

Perf: the metal headless numbers were added (cpu 0.4–0.5 ms after vs 0.6–0.7 ms before, 30 fps).

**Suggestion** (carried over, not blocking): anchor the 2.5 s `showTip` name tip like a sign.

Verdict: APPROVED

## Test report

Tester: Haiku 5.5, 27. 10. 2026. Own temp server on `127.0.0.1:8311` with `data/` in `/tmp/cabin-t147-test/data` (test secrets only), stopped afterwards. No tailscale serve started. Headless Chrome with `--use-angle=metal`. Probe scripts and JSON in `/tmp/cabin-t147-test/` (`run.mjs`, `taps.mjs`, `houses.mjs`, `perf.mjs`, `taps-desk.mjs`, `results.json`, `taps.json`, `houses.json`, `perf.json`, `taps-desk.json`).

### Commands and results
- `uv run pytest -q`: 734 passed (no regressions; `tests/` covers the API, store, events, pwa, etc.).
- `node --test tests/js/`: 465 pass, 0 fail.
- Served page: `static/js/app-anchor.js?v=<hash>` is listed in `index.html`. `/data/cabin-data.yaml` and `/config/cabin.yaml` return 404. `/api/health` returns ok with version 1.21.1.

### Acceptance criteria
| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Perspective centre follows the pan; edge objects show sides, centre unchanged | pass | Phone 390x844 at 2.2x, left edge (fx 0.02) and right edge (fx 0.98), screenshots `shots/phone-default-a45-fx0.02.png`, `shots/phone-default-a45-fx0.98.png`. Zoom-independent strength is covered by the Node edge test (opposite lean signs). |
| 2 | svg layer aligned within about 1 px during the pan; taps right after a pan at all four angles | pass | Ground bed centres: 3D projection vs svg `isoPoint` at 2.2x, 3 pans x 4 angles x 3 persp settings: worst 0.002 px. Real clicks on figure areas, phone (8 of 8 correct at 4 angles, both edges) and desktop 1280x800 (18 of 18 correct at 4 angles, pans 0.02/0.5/0.98). Closed-house taps at rest zoom, both edges, 4 angles, persp default and 0.35: 16 of 16 hit the right house and ease the view. |
| 3 | Default 0.2, `?persp=` override per device, clear, out of range | pass | `ISO.persp`: default 0.2; `?persp=0.35` 0.35 and stored; reload without param keeps 0.35; `?persp=` clears (0.2, `cabin.persp` removed); `?persp=0` gives 0; `?persp=0.9` falls back to 0.2 and stores nothing; `?persp=0.2` clears the stored value. Shadows, roofs, people and board look right at 0 and 0.35 (screenshots `shots/phone-persp0-*.png`, `shots/phone-persp035-*.png`). |
| 4 | Performance: 30 fps on pan (Mac metal); fps-meter cpu before/after; svg update cheap | pass | Metal headless, phone, 90 programmatic pan frames: 16.4 ms/frame incl. raf (30 fps), meter `cpu 0.5 ms (max 0.8) · gpu 1.0 ms · 7 calls`. With `?persp=0` the same: 16.5 ms/frame, `cpu 0.5 ms (max 0.7) · gpu 0.7 ms`. Before-after figure is not a true before (the dev measured the same way); the cost is equal within noise. The svg update is `setAttribute` on the anchored and polygon nodes, no DOM rebuild. |
| 5 | Rest view, intro, phone rest, turn and HUD insets fit as before | pass | Phone rest screenshot is clean (HUD at top and bottom, fitted scene). Intro without reduced motion: width 341 (held) → 345 → 388 → 509 → 614 → 647 → 649 (done) over about 7 s. Turn to 135/225/315 keeps the scene and taps. |
| 6 | Node tests for the moving centre; suites green; screenshots | pass | Node tests cover `isoSetCentre`, `perspSetting` and the sign/edge tests (see `tests/js/logic.test.mjs` around line 5640). Both suites green. Screenshots saved (see below). |

Manual items (not tested by the tester): the look of the side walls on iPhone Safari and Android Chrome, real touch taps at the screen edge, and the fps meter on a real phone. These are on `tests/manual.md` in the section "Perspective follows the pan (T-147)".

### Extra scenarios
- Taps at the edge after a pan at zoom 2.2, all four angles, persp default, 0 and 0.35 (bed figures, phone and desktop).
- Closed houses tapped at rest zoom from both edges: the house opens and the view eases (16 of 16).
- Persistence and clearing of `?persp=` (see row 3).
- `console` and `Runtime.exceptionThrown` during all runs: none.
- Probe artefacts (not app bugs), recorded for transparency: three first-pass desktop probes at pan 0.5 landed on the bottom HUD (`DIV.bothud-in`, `BUTTON.tool`), or on a nearer bunk (`right-bunk-1` in front of `konica-lower-mats` at 225°). The real clicks on the top-most figure area at the same spots all hit the right bed (see taps-desk).

### Failures
None found. No bug reports.

### Screenshots (`/tmp/cabin-t147-test/shots/`)
- Phone left edge, zoom 2.2, 45°: `phone-default-a45-fx0.02.png`
- Phone right edge, zoom 2.2, 45°: `phone-default-a45-fx0.98.png`
- `?persp=0.35`, right edge: `phone-persp035-a45-fx0.98.png`
- Turned angle 135°, zoom 1.8, right edge (houses open, bed tags align): `phone-edge-135-zoom18.png`
- Desktop 1280x800, left edge: `desk-default-a45-fx0.02.png`

### Decision
All six criteria pass, suites green, no regression in `done/`. Task moved to `done/`.
