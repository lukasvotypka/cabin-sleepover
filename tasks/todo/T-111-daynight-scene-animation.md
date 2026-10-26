# T-111: Day–night light layer, clock board and animation

- **Phase:** 1
- **Depends on:** T-110
- **Size:** M

## Goal
Show time passing in the scene when a friend taps another night (proposal "Stránka: jedna scéna a interakcie" → "Deň a noc pri prepnutí noci"). Behaviour and look follow the approved prototype `design/day-night/index.html` (`buildOverlay`, `paint`, `drawIcon`, `drawStrip`, `goTo`, `#clock` CSS) and `design/day-night/README.md` ("What changes in the scene", "Fit into the code"). No server change.

## Scope
- `static/js/app-daynight.js` (new): light layer, clock board, `requestAnimationFrame` loop
- `static/js/app-scene.js`: `ensureScene()` adds the light layer; `selectNight(night, opts)` gains `opts.animate`
- `static/js/app-draw.js`: signpost tap passes `{animate: true}`; beds draw the night currently shown
- `static/js/app-hud.js`: `runQuestAction` passes `{animate: true}` for `action === "night"`
- `static/index.html`: `<script src="static/js/app-daynight.js?v=__ASSET_VERSION__">` after `app-scene.js`/`app-draw.js` and before `app-start.js`; `#clock` element (`aria-hidden="true"`) and its CSS
- `tests/js/logic.test.mjs`: source checks below

## Acceptance criteria
- [ ] Light layer is one `<g aria-hidden="true" pointer-events="none">` created in `ensureScene()` **between `walk` and `boards`**, so signposts and the party table are above it. It holds: orange dusk rect and navy `#16224A` dark rect (both `mix-blend-mode: multiply`, dark masked lighter over room floors), lamp group (room floors, window glow, door light pools), 7 fireflies on the grass, as in the prototype.
- [ ] All rectangles come from `app.state.layout` (`layout.rooms`, `layout.map.windows`, `layout.map.doors`); no room/window/door coordinates in code. Missing `windows`/`doors` lists are tolerated.
- [ ] Boards stay readable: they darken only lightly at night (a separate, weaker tint over the `boards` layer; the full night tint must not cover them).
- [ ] Each frame only sets `opacity` attributes from T-110's light function; the bird's opacity follows it (no bird at night). No elements are created per frame.
- [ ] Clock board: fixed at the top of the screen in the wooden style, pixel sun (day) or moon (night), `clockLabel` text (e.g. „Pi 03:00“) via `textContent`, a strip of 16 three-hour cells from the first day 12:00 to the day after the last night 12:00, the current cell framed. Visible only during the animation; fades out about 0.9 s after it ends. Not shown at rest.
- [ ] Only a user tap animates: the signposts in the scene and the HUD quest/status row with `action: "night"` („Ťukni sem“). Page load, „Kto si?“ pick, party create (`defaultNightFor`), the bed sheet's night headers and SSE/poll updates switch without animation (`selectNight` default stays instant).
- [ ] On tap the signpost highlight, HUD and open panel refresh switch to the new night at once (`app.night`); the bed figures keep showing the old night until `swapHour` is passed (at once when < 12 h).
- [ ] A `render()` triggered during the animation (SSE state, optimistic write) draws beds for the night still shown, not `app.night`, until the swap.
- [ ] A tap during the animation retargets smoothly from the current hour (no jump); tapping the night already targeted does nothing extra. A tap on the night already shown at rest does not animate.
- [ ] With `prefers-reduced-motion: reduce` nothing animates, no clock board, the night switches at once as before, and fireflies do not blink (CSS).
- [ ] A rebuilt scene (`ensureScene` after a layout change) rebuilds the light layer and repaints at the current hour.
- [ ] Node source checks in `tests/js/logic.test.mjs`: `index.html` lists `app-daynight.js` with `?v=__ASSET_VERSION__`; `app-daynight.js` contains no `innerHTML`; the light layer is created after `walk` and before `boards` in `ensureScene`. `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Open decision "Deň a noc pri prepnutí noci" defaults: swap in the last night passed, boards dim only lightly, about 2.2 s per night, fireflies yes, no sounds (owl, rooster), clock only during the animation.
- Keep the shown-night state separate from `app.night` (e.g. `app.shownNight`); the hidden screen-reader summary and panels use `app.night`.
- `cancelWalks()` in `selectNight` stays. Do not touch the intro zoom (`app-zoom.js`).
- Check `mix-blend-mode` on SVG rects in iPhone Safari; if it fails there, plain opacity is the fallback.
- The prototype's `showScene` uses `innerHTML` for captured markup; do not copy that. The clock icon is built with SVG rects.

---
## Dev log

## Review round 1

## Review round 2

## Test report
