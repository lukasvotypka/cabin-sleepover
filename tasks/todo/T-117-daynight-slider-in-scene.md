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
- [ ] The HTML top bar (`#timebar`, `.timebar`) is gone; „Úlohy“ and the scene top inset behave as before T-115.
- [ ] The slider is drawn in the SVG inside `layout.map.scene.time` (no hardcoded geometry), in the boards layer
      above the light layer, so it stays readable at night and pans/zooms with the map.
- [ ] Look: wooden rail (pixel style like the boards) with dark sections for night hours (`sliderDark`), and a knob
      with the pixel sun or moon by `darkness(h) > .5`. Next to the knob a small paper tag with `clockLabel`
      („Pi 22:00“, text via `textContent`); near the right end the tag flips to the left of the knob so it never
      leaves the rect.
- [ ] Mapping is piecewise and aligned with the signposts (`signpostLayout(scene.nights, n, gap)`): the x-range of
      signpost *i* maps to night *i*'s hours — night 0 from the first noon to 06:00 next day, middle nights 06:00 →
      06:00, the last night from 06:00 to the last noon (end of `sliderRange`). The gaps between signposts map to the
      06:00 boundary. So the knob always stands above the selected night's signpost. New pure functions
      (e.g. `sliderSegments(nightsRect, nights, gap)`, `hourToSceneX`, `sceneXToHour`) with Node tests: segment
      ends, round trip, a gap maps to 06:00, clamping outside the rect.
- [ ] Touch: the knob's grab area is at least 44 × 44 scene units centred on the knob and wins over the title board
      and the top of the signposts (drawn after them / on top). A tap on the rail (hit area from the rail grown up
      into the title gap, not into the signposts beyond the knob area) runs the time-lapse to that hour (`dnGoTo`).
      Dragging converts pointer coordinates with `getScreenCTM().inverse()`, so it is right at any zoom; it never
      pans the map and ends on pointerup/pointercancel (pointer capture).
- [ ] All T-115 behaviour is kept: time stays where released, 06:00 swaps, Sunday clamp, signpost/„Ťukni sem“
      taps run to noon, instant switches, reduced motion, move mode (the slider may stay visible in the scene but is
      not draggable while the move bar shows — or hide it; note what you chose).
- [ ] Accessibility: the slider group is `role="slider"`, `tabindex="0"`, `aria-valuemin/max/now`,
      `aria-valuetext` from `sliderValueText`, arrows ±1 h, Page Up/Down ±6 h, Home/End; keys never pan the map.
      Keyboard focus survives the redraw (`keepFocus` with a `data-key`).
- [ ] Redraw cost: dragging updates only the knob/tag/attributes and the light; it does not rebuild all boards each
      frame (a night change at 06:00 may redraw boards once, as `selectNight` does).
- [ ] Headless Chrome check at 360 and 390 px: no console errors, knob drag across 06:00 changes the night,
      no map pan while dragging, tag stays inside the rect at both ends.
- [ ] `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
- The scene is fitted at about 1 scene unit per CSS px on a 380 px phone, so 44 units ≈ 44 px.
- Keep the `dn` prefix for new globals in app code; pure functions go into `logic-daynight.js`.
- Remove the now-unused HTML-bar helpers (`dnPct`, `dnBuildBar`, `dnBarPaint`, `dnBarEvents` or whatever replaces
  them) rather than leaving dead code.
- Don't use or kill ports 8000, 8010, 8766, 8768, 8770. playwright-core is in `/tmp/t111/node_modules`; the T-115
  scripts are in `/tmp/t115/s/` and `/tmp/t115-tester/`.

---
## Dev log

## Review round 1

## Review round 2
