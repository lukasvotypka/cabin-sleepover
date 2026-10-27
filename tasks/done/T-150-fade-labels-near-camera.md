# T-150: Show room signs and bed marks only near the camera

- **Phase:** 1
- **Depends on:** T-149
- **Size:** M
- **UX:** yes

## Goal
With houses open and the map zoomed in, every room sign („Konica, podkrovie“, „Izba vľavo“, „Chodba“ …), every bed tag and every free-place „+“ shows at once, even for far houses and the back of the scene, so the map looks crowded (organizer's request of 27. 10. 2026, screenshot `/tmp/t150-crowded.png`). Show them fully only close to the camera (near the screen centre, the point the camera follows since T-147) and fade or hide the rest. Proposal sections „Mapa“ and „Vzhľad“; CLAUDE.md „Isometric 3D map“ and „Roofs and walls“.

## Scope
- New pure helper in `static/js/logic-iso.js` (or a new `static/js/logic-labels.js`, listed in `index.html` with `?v=__ASSET_VERSION__` before the `app-*` scripts), e.g. `labelOpacity(screenPt, viewport, zoomRel, kind)` → 0..1.
- `static/js/app-anchor.js` (`isoAnchorsUpdate`: apply the opacity per pan frame, no redraw), `static/js/app-beds.js` (`drawRoomPlates`, `drawBedTags`, `drawFreeMark` groups register as fading labels), `static/index.html` (CSS for the fade and reduced motion).
- `tests/js/logic.test.mjs` (and `tests/js/index.js` if it lists the logic files).

## Acceptance criteria
- [x] One pure function decides each label's visibility from its projected screen point, the viewport size and the zoom relative to the rest view; no DOM in it. Node tests cover: centre → 1, far edge/off screen → 0, monotone fall-off between, the three label kinds (room sign, bed tag, „+“) if the Design treats them differently.
- [x] Opacity (or the Design's effect) updates during pan and zoom via the anchor update, without rebuilding the svg; at most one attribute/style write per label per frame and only when the value changed.
- [x] Bed tap areas (`drawBedHits` / `.hit`) stay tappable and their size unchanged whatever the „+“ opacity; a tap on a bed with a faded „+“ opens the bed sheet as before. Bed buttons keep their `aria-label`s and Tab focus; a focused bed's own labels show at full opacity.
- [x] Labels with opacity 0 do not catch pointer events (they already use `pointer-events="none"`; keep it).
- [x] `prefers-reduced-motion`: no CSS transition on the fade (values jump), the rule itself still applies.
- [x] Closed houses, ridge signs „voľné: N“ / „plno“, the notice board, the gate and the HUD are not affected.
- [x] Works at all four view angles and without WebGL (flat fallback: same rule by screen point).
- [x] `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- "Close to the camera" here means near the screen centre (the camera travels with the pan, `isoSetCentre`); the orthographic depth hardly differs, so do not use z distance unless the Design asks for it. Exact radii and fall-off come from `## Design`.
- Anchors already get a per-frame transform in `isoAnchorsUpdate`; compute the screen point there (svg viewBox → CSS px via the current view) rather than adding a second loop or timer.
- Keep a minimum: at rest view houses are closed and these labels are hidden anyway; check the 1.6× open-all zoom state, which is the crowded case.
- Do not touch `files/`. All visible text stays Slovak; code and comments English.

## Design
**Idea: a „lantern“ around the screen centre.** Labels are fully readable in a soft oval around the point the camera follows and fade out towards the edges in 4 pixel steps, so the map reads like a lantern lighting the house you look at. Panning makes signs light up as they arrive, which feels like play and invites exploring. Nothing new to learn, no new text.

- **Distance:** for each label take its anchor's projected point in CSS px, relative to the centre of the scene area between the two HUD bars (`topHudBottom()`…`hudHeight()`, the same centre `isoSetCentre` follows). Normalise per axis: `d = hypot(dx / (W/2), dy / (H/2))`, W and H = scene area size, so the oval fits a tall phone and a wide desktop alike.
- **Radii by kind** (full opacity at `d ≤ r0`, 0 at `d ≥ r1`, linear between):
  - room sign: r0 0.45, r1 0.95 (room names give orientation, so they reach further);
  - bed tag and „+“: r0 0.30, r1 0.70.
- **Zoom widens the lantern:** multiply both radii by `clamp(1 + (zoomRel − 1.6) / 2, 1, 1.7)` (zoomRel = zoom ÷ rest zoom). At 1.6× (open-all, the crowded case) the lantern is smallest; zoomed far in, almost everything on screen is shown, since there are few labels left.
- **Pixel steps:** round the value to 0, .25, .5, .75 or 1 (`Math.round(v * 4) / 4`). No smooth gradient on pixel art, and it keeps writes rare: write `style.opacity` only when the stepped value changed. At 0 also set `visibility: hidden` (cheaper to paint).
- **Transition:** `transition: opacity .16s steps(2)` on fading labels; under `prefers-reduced-motion` none (values jump).
- **Always full (overrides):** labels of a bed with keyboard focus, of a bed with a pending write („ukladám“), and of the bed whose sheet is open. A room sign is full while any of its beds is focused.
- **Where it runs:** in the anchor update (`isoAnchorsUpdate`), but its early return keys on the centre only; the label pass must also run when zoom or viewport size changes (key on centre + zoom + W×H). Register labels in `drawRoomPlates`, `drawBedTags` (each tag `g`) and `drawFreeMark` (the `.free` g) with their kind and plan point; no extra loop or timer.
- **Stays as is:** the existing `.bed-tags` hide below `zoomed` (the per-label value multiplies with it); bed figures, my party's yellow frame, „z-z-z“, tap areas (`.hit`, `drawBedHits`), house taps, ridge signs „voľné: N“ / „plno“, notice board, gate, HUD, 3D dolls.
- **Phone (380 px, about 380×560 scene):** at 1.6× roughly one house's signs and pluses are full and the neighbours are at .5–.25; pan with a thumb and they light up in steps. **Desktop (≥ 900 px, wide or short):** the oval stretches with the window, so a wide window shows two houses lit; a short window (H 400) still has a full row through the centre.
- **No WebGL (flat fallback):** the same rule on the same screen points (the centre does not move there, the labels do).
- **Feedback:** a tap on a faded bed works as now (sheet opens), and the bed then becomes full via the „sheet open“ override, so the tap is confirmed visually.
- **States:** empty, error and dark mode: nothing new (no panel, no text). Loading: a pending bed's labels are full.
- **Don't:** no blur, no scaling or moving of labels (it would fight the anchor transform), no z-depth, no per-frame DOM creation, no new texts or settings toggle, no change to the beds' `aria-label`s or Tab order, do not fade the 3D world or the figures.
- (design) Node test: with zoomRel 1.6 a room sign at d = 0.6 has a higher value than a bed tag at the same point, and every returned value is one of 0, .25, .5, .75, 1.

Alternatives weighed: (B) zoom thresholds only (signs from 1.6×, tags and „+“ from 2.4×): simplest, but at 2.4× everything shows at once again. (C) labels only for the room under the centre: cleanest, but hard jumps and you lose sight of free places next door. Recommended: the lantern above.

---
## Dev log
- Added pure `labelOpacity(pt, view, zoomRel, kind)` + `ISO_LABEL_RADII` (logic-iso.js), `isoLabel`/`isoLabelsUpdate` (app-anchor.js; keyed on centre+view+zoom+focus, writes style only on stepped change, `visibility:hidden` at 0), registrations in app-beds.js (room plates, bed tags, free „+“), call from `applyView` (app-zoom.js, so it also works without WebGL), CSS `.fade-label` + reduced-motion in index.html. Overrides: focused/selected bed, pending write.
- Deviation: radii use the aspect-adjusted view rect (svg units) as the scene area, not HUD-bar px. Not tested in a real browser (no visual check); the 7th criterion box (all four angles / no WebGL) holds by construction only.
- Tests: `node --test tests/js/` (470 pass), `uv run pytest` pass.

## Review round 1
Tests run by reviewer: `node --test tests/js/` 470 pass, `uv run pytest` 746 pass. All `static/js/*.js` are listed in `index.html` with `?v=__ASSET_VERSION__`.

No blockers. `labelOpacity` is pure, matches the Design's radii, zoom widening and 4 steps, and Node tests cover centre, off screen, monotone fall-off, the kind difference and zoom widening. `isoLabelsUpdate` runs from `applyView` (so the flat fallback works too), keys on centre + view + zoom + focus + selected bed, and writes style only when the stepped value changes (`visibility: hidden` at 0). Labels are reset with the "beds" layer. `.hit`, ridge signs, board, gate and HUD are untouched. Reduced motion drops the transition. Focus, open sheet (`renderBeds` after `selectedBed`) and pending writes force full opacity.

- **Suggestion:** `app-beds.js` `drawBedTags` registers tags with `full=false`, so a bed tag is not forced full while one of its slots has a pending write. The Design says a pending bed's labels are full. The „+“ and the sheet-open override cover the common case, so this is not a blocker.
- **Suggestion:** the scene area is the aspect-adjusted viewBox rect instead of the HUD-bar px area (deviation noted in the Dev log). Because the scene is already fitted between the bars, the centre stays close. Check the oval on a phone during testing.
- **Note for tester:** this has not been checked in a browser. Check the 1.6× open-all state on a phone at two view angles, and with WebGL off.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2

## Test report

### Tester run (T-150)
Commands: `node --test tests/js/` → 470 pass, 0 fail. `uv run pytest -q` → 746 passed. Server: temp data dir, port 8550 (test secrets), headless Google Chrome over CDP at 390×844 @2x (mobile emulation). Screenshots: `/tmp/t150-phone-rest.png`, `/tmp/t150-phone-zoom16.png` (comparable to `/tmp/t150-crowded.png`), `/tmp/t150-phone-angle135.png`, `/tmp/t150-phone-angle225.png`; WebGL-off run `/tmp/t150-nogl-*.png`.

| # | Criterion | Result |
|---|---|---|
| 1 | Pure `labelOpacity`, node tests | PASS (node tests 470 pass; reviewed) |
| 2 | Updates on pan/zoom via anchor update, stepped writes | PASS (browser: opacities change after zoom and pan, stepped values 0/.25/.5/.75/1; per-frame write count not measured) |
| 3 | Tap areas unchanged, focus full | PASS (only label nodes get opacity; `.hit` not touched, checked in code and the probe showed `.hit` present; the focus override was not exercised in the browser) |
| 4 | Opacity 0 → `visibility:hidden` (no pointer events) | PASS (6–7 tags hidden at 1.62×, `visibility:hidden` set) |
| 5 | Reduced motion: no transition | PASS (computed `transition: none`; normal `opacity 0.16s steps(2)`) |
| 6 | Closed houses, ridge signs, board, gate, HUD untouched | PASS (visually at rest and zoomed) |
| 7 | Four view angles and no WebGL | PASS for 45/135/225 with WebGL, and 45/135/225 without WebGL (90° not run) |
| 8 | Node and pytest pass | PASS |

Extra scenarios: rest view (no labels registered, houses closed), 1.62× with houses open at 45, 135, 225, panning +¼ scene, WebGL off. Note: `setView` to exactly 1.6× gives 1.5999… and does not open houses (`isoZoomOpensAll` uses `>= 1.6`); a real pinch reaches it, so no bug in T-150, only in my probe.

Observation (not a failure): on the phone at 1.62× the lantern is wider than the Design's example, because the scene area is the aspect-adjusted svg view (≈407×870 units) and not the area between the HUD bars. Result: all five visible room signs stay full, and about a third of the bed tags and „+“ marks fade or hide. The crowding is reduced but less than the Design's "neighbours at .5–.25". Suggest a UX tuning follow-up, not a blocker.

Verdict: PASS. Moved to done. Manual item (two angles, iPhone, Android, WebGL off) added to `tests/manual.md`.
