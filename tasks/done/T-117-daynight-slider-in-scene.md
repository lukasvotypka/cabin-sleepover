# T-117: Time slider in the scene between the title and the signposts

- **Phase:** 1
- **Depends on:** T-115, T-116
- **Size:** M

## Goal
Organizer's decision of 26. 10. 2026 (with a screenshot): the time slider moves from the fixed HTML bar at the top
(T-115) into the SVG scene, between the event title board and the three night signposts. Proposal section
„Deň a noc pri prepnutí noci“, bullet „Posuvník času“, and the `map.scene` example in „Rozloženie chaty“.

## Scope
- `config/cabin.yaml`: `title: [176, 4, 196, 28]`, new `time: [176, 34, 196, 12]`, `nights: [176, 48, 196, 58]`
  (with an English comment like the other scene entries). Check nothing else in `map.scene` collides.
- `app/models.py`: `SceneRects.time: Rect` as an optional field with that default (like `briefing`), plus a
  pytest that a cabin.yaml without `time` still loads.
- `static/js/logic-daynight.js`: piecewise hour ↔ x mapping aligned with the signposts (pure, Node-tested).
- `static/js/app-daynight.js`, `static/js/app-draw.js` (or wherever boards are drawn), `static/index.html`,
  `static/js/app-hud.js`: draw the slider in the boards layer; remove the HTML `#timebar` and its CSS and its
  inset handling (`questBottom` etc. go back to the pre-T-115 behaviour for the top inset).
- `tests/js/logic.test.mjs`, `tests/manual.md` (section 11: replace the top-bar items), `CLAUDE.md` bullet.

## Acceptance criteria
- [x] The HTML top bar (`#timebar`, `.timebar`) is gone; „Úlohy“ and the scene top inset behave as before T-115.
- [x] The slider is drawn in the SVG inside `layout.map.scene.time` (no hardcoded geometry), in the boards layer
      above the light layer, so it stays readable at night and pans/zooms with the map.
- [x] Look: wooden rail (pixel style like the boards) with dark sections for night hours (`sliderDark`), and a knob
      with the pixel sun or moon by `darkness(h) > .5`. Next to the knob a small paper tag with `clockLabel`
      („Pi 22:00“, text via `textContent`); near the right end the tag flips to the left of the knob so it never
      leaves the rect.
- [x] Mapping is piecewise and aligned with the signposts (`signpostLayout(scene.nights, n, gap)`): the x-range of
      signpost *i* maps to night *i*'s hours — night 0 from the first noon to 06:00 next day, middle nights 06:00 →
      06:00, the last night from 06:00 to the last noon (end of `sliderRange`). The gaps between signposts map to the
      06:00 boundary. So the knob always stands above the selected night's signpost. New pure functions
      (e.g. `sliderSegments(nightsRect, nights, gap)`, `hourToSceneX`, `sceneXToHour`) with Node tests: segment
      ends, round trip, a gap maps to 06:00, clamping outside the rect.
- [x] Touch: the knob's grab area is at least 44 × 44 scene units centred on the knob and wins over the title board
      and the top of the signposts (drawn after them / on top). A tap on the rail (hit area from the rail grown up
      into the title gap, not into the signposts beyond the knob area) runs the time-lapse to that hour (`dnGoTo`).
      Dragging converts pointer coordinates with `getScreenCTM().inverse()`, so it is right at any zoom; it never
      pans the map and ends on pointerup/pointercancel (pointer capture).
- [x] All T-115 behaviour is kept: time stays where released, 06:00 swaps, Sunday clamp, signpost/„Ťukni sem“
      taps run to noon, instant switches, reduced motion, move mode (the slider may stay visible in the scene but is
      not draggable while the move bar shows — or hide it; note what you chose).
- [x] Accessibility: the slider group is `role="slider"`, `tabindex="0"`, `aria-valuemin/max/now`,
      `aria-valuetext` from `sliderValueText`, arrows ±1 h, Page Up/Down ±6 h, Home/End; keys never pan the map.
      Keyboard focus survives the redraw (`keepFocus` with a `data-key`).
- [x] Redraw cost: dragging updates only the knob/tag/attributes and the light; it does not rebuild all boards each
      frame (a night change at 06:00 may redraw boards once, as `selectNight` does).
- [x] Headless Chrome check at 360 and 390 px: no console errors, knob drag across 06:00 changes the night,
      no map pan while dragging, tag stays inside the rect at both ends.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
- The scene is fitted at about 1 scene unit per CSS px on a 380 px phone, so 44 units ≈ 44 px.
- Keep the `dn` prefix for new globals in app code; pure functions go into `logic-daynight.js`.
- Remove the now-unused HTML-bar helpers (`dnPct`, `dnBuildBar`, `dnBarPaint`, `dnBarEvents` or whatever replaces
  them) rather than leaving dead code.
- Don't use or kill ports 8000, 8010, 8766, 8768, 8770. playwright-core is in `/tmp/t111/node_modules`; the T-115
  scripts are in `/tmp/t115/s/` and `/tmp/t115-tester/`.

---
## Dev log

- Config/model: `map.scene` title `[176, 4, 196, 28]`, new `time [176, 34, 196, 12]`, nights `[176, 48, 196, 58]` in `config/cabin.yaml`; `SceneRects.time` optional with that default (`app/models.py`); tests in `tests/test_models.py` (SCENE fixture updated, default test added).
- Logic: `sliderSegments`, `hourToSceneX`, `sceneXToHour` in `static/js/logic-daynight.js` replace `hourToX`/`xToHour`; Node tests in `tests/js/logic.test.mjs` (segment ends, round trip, gap = 06:00, clamping) plus an updated static wiring test.
- App: `static/js/app-daynight.js` draws the slider (rail with `sliderDark` sections, knob with pixel sun/moon, paper tag that flips left near the right end). Removed `#timebar`, its CSS, `dnPct/dnBuildBar/dnBarPaint/dnBarEvents`, and the timebar part of `questBottom()` (`app-hud.js`). `static/index.html` has a small CSS block for `.dn-slider`.
- Deviation: the slider is in its own persistent layer `.dn-slider` just above the board tint (inserted before the `tip` layer), not inside the `boards` layer. Reason: `drawBoards` clears `boards` on every render, which would replace the knob under a finger or the keyboard focus. It is still above the light layer and the tint, so it stays readable at night, and it pans/zooms with the scene. Dragging only moves the knob/tag transforms and the light.
- Move mode: the slider is hidden (display none) while `app.move` is set (done in `dnSync`).
- Docs: `tests/manual.md` section 11, `CLAUDE.md` bullet.
- Tests: `node --test tests/js/` (366 pass), `uv run pytest -q` (740 pass).
- Headless Chrome (own server on :8791, touch via CDP, 360 and 390 px): no console errors; touch drag across 06:00 changes the night; view unchanged by drag; tag inside the rail at Home/End; keys (Home/End/PageUp/arrows) work and focus stays on the slider; tap on rail runs the time-lapse. Scripts in `/tmp/t117/`.
- Follow-up: the `proposal.md` example already has the new rects; nothing else outside scope found.


## Review round 1

Tests run by the reviewer: `node --test tests/js/` 366 pass, `uv run pytest -q` 740 pass.

Checked: `map.scene` rects do not collide (title 4–32, time 34–46, nights 48–106, parties from 112); `SceneRects.time`
is optional with the default, and there is a test for it. `sliderSegments`/`hourToSceneX`/`sceneXToHour` are correct
(06:00 belongs to the next signpost, gaps map to the boundary, values are clamped) and Node-tested. The slider layer
sits after the boards and the tint, before `tip`, so it stays readable at night, and the knob's 44 × 44 grab area wins
over the title and the signposts. `getScreenCTM().inverse()` and pointer capture are used. `stopPropagation` on
pointerdown keeps the svg pan handler (bubble phase, pointer events only) out. Keys call `stopPropagation`, and
`data-key="time"` keeps focus. The layer persists across `drawBoards`, so a drag only moves transforms. Labels go in
via `textContent`. The slider is hidden in move mode. `#timebar`, its CSS and `dnPct/dnBuildBar/dnBarPaint/dnBarEvents`
are gone. `questBottom()` is exactly the pre-T-115 version. The geometry comes from config only. The deviation (own
persistent layer instead of inside `boards`) is justified and meets the intent.

**Blockers:** none.

**Suggestions**
- `static/js/app-daynight.js:10-12`: `DN_SUN`, `DN_MOON` and `DN_ICON_COLORS` are now unused, because the knob uses
  `drawSun`/`drawMoon`. The task asks to remove dead helpers, so delete them in a later touch.
- `static/js/logic-daynight.js:129` `sliderDays` is now used only by its test (no day labels on the scene rail).
  Remove it or use it.
- `dnSliderEvents`: a swipe that starts on the rail (not on the knob) blocks the map pan and then runs `dnGoTo` on
  release. Ignoring the tap when the pointer moved beyond the tap slop would make it friendlier.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester: T-117, 26. 10. 2026. Own server on `127.0.0.1:8795` with `data/` in `/tmp/t117-tester/data` (test secrets, `SMS_FAKE=1`), stopped afterwards. Ports 8000, 8010, 8766, 8768 and 8770 were not touched. Browser scripts in `/tmp/t117-tester/` (`probe.mjs`, `left4.mjs`, `rm2.mjs`, `final.mjs`), playwright-core from `/tmp/t111/node_modules`, system Google Chrome, headless, `isMobile` with touch via CDP `Input.dispatchTouchEvent`, 360 and 390 px.

### Commands and results
- `node --test tests/js/`: 366 pass, 0 fail.
- `uv run pytest -q`: 740 passed (includes the `tasks/done/` regression tests).
- Headless Chrome, 360 and 390 px: console errors and page errors: none in every run.

### Acceptance criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `#timebar` / `.timebar` gone, „Úlohy“ and top inset as before T-115 | pass | No such element at 360 or 390 px. „Úlohy“ button sits at the top in the screenshot. |
| Slider drawn in SVG from `layout.map.scene.time`, above light, pans/zooms with map | pass (with the deviation the developer logged and the reviewer accepted) | Rail rect in the `.dn-slider` layer, which is a persistent layer above the tint and below `tip`, not inside `boards`. Rail width follows the config. Zoomed drag does not change `viewBox`. |
| Look: rail, dark night sections, knob sun/moon, tag flips inside the rail | pass (visual only partly checked) | Tag stays inside the rail at Home and End at both widths (`tagIn` true at every step). Screenshot of a zoomed view only. A human should look at the fit view. |
| Piecewise mapping aligned with signposts, pure, Node-tested | pass | Segments from the live config: night 0 h 12–30, night 1 h 30–54, night 2 h 54–84. Gap = 06:00. Node suite passes. Drag and tap results match the formula (tap at 0.75 of the rail gives 60.54 h, tap at 0.3 of the zoomed rail gives 28.89 h, which is the computed `sceneXToHour`). |
| Touch: 44 × 44 grab area, tap on rail runs `dnGoTo`, `getScreenCTM` drag, no map pan | pass | Hit box 41.7 px at 360 and 45.2 px at 390 in fit view (= 44 units). 85.6 px and 92.8 px when zoomed in, which is still correct. Drags at 2× zoom right and left: view unchanged by the drag. A drag on the map away from the knob still pans. |
| T-115 behaviour kept: stays where released, 06:00 swap, Sunday clamp, signpost/„Ťukni sem“ to noon, instant switches, reduced motion, move mode hides slider | pass | Night 29→30→31 on crossing 06:00 both ways. Max is 84 (End) and PageUp clamps at 84. Reduced motion: tap result is immediate (`t100` = final). Normal motion: animation takes about 3 s, then lands on the same hour. Move mode (`app.move` set, `dnSync`): layer `display=none`, drag does nothing. After clearing: visible again. Signpost and „Ťukni sem“ tap not run in this session. |
| Accessibility: `role=slider`, `tabindex=0`, aria min/max/now/text; arrows ±1, PageUp/Down ±6, Home/End; keys never pan; focus survives redraw | pass | `aria-valuemin=12`, `aria-valuemax=84`, `aria-valuenow=12`, `aria-valuetext="štvrtok 12:00, noc Št → Pi"`. Keys: ArrowRight 12→13, ArrowLeft back to 12, PageUp 12→18, PageDown 18→12, End 84, Home 12, ArrowUp 13. View unchanged by keys. Focus stays on the slider (`role=slider`) after drags and keys. |
| Redraw cost: drag updates only knob/tag/light | pass | Counting `drawBoards` calls during 30 touch moves that cross two 06:00 boundaries: 2 calls (one per night change). |
| Headless Chrome 360 and 390 px: no console errors, drag across 06:00 changes the night, no pan during drag, tag inside rect at both ends | pass | Checked in all runs above. |
| `node --test tests/js/` and `uv run pytest -q` pass | pass | 366 and 740. |

### Extra scenarios
- Drag right past 06:00 and back left, zoomed in, at 360 and 390 px.
- Dragging a knob beyond the screen edge while zoomed: the knob can move off-screen, and touches outside the viewport are not delivered, so the user has to pan to reach it. This is a usability note, not a failing criterion.
- Keyboard at the range limits (Home, End, PageUp at 84).
- Stuck-in-gap behaviour (pointer in the 4-unit gap at 06:00 holds the knob at 06:00 until the pointer passes into the previous signpost). This is spec-conform. My first run looked stuck because of a bug in my script, not in the app.

### Manual items
Real devices (iPhone Safari, Android Chrome, VoiceOver/TalkBack, the knob's look at fit view, real-device touch drag) are already in `tests/manual.md` section 11. No change needed.

### Failures
None.

### Decision
All criteria pass, no regressions. Task moved to `tasks/done/`.
