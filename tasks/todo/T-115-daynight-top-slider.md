# T-115: Top time slider and figure swap at 06:00

- **Phase:** 1
- **Depends on:** T-114
- **Size:** M

## Goal
Replace the transient clock board with a fixed top time slider, select the night from the time (06:00 boundaries), and swap the bed figures with a short get-up/fade at each 06:00 crossing (proposal "Deň a noc pri prepnutí noci": „Posuvník času“, „Ktorá noc patrí k času“, „Postavičky o 6:00“, tap and reduced-motion bullets). No server change.

## Scope
- `static/js/app-daynight.js` (slider, drag/keys/tap, time-lapse driven by `nightAt`, swap effect; old clock board code removed)
- `static/js/app-scene.js` (`selectNight`), `static/js/app-beds.js` / `static/js/app-draw.js` (drop `app.shownNight`/`drawnNight` if no longer needed; swap effect hooks)
- `static/js/app-zoom.js` (scene fit below the bar)
- `static/js/logic-daynight.js`, `tests/js/logic.test.mjs` (delete `swapHour` and its tests; source checks)
- `static/index.html` (bar markup and CSS; `#clock` element and CSS removed)

## Acceptance criteria
- [ ] `#clock`, its CSS and the clock-board code are gone; `grep -n "swapHour\|clockStrip\|id=\"clock\"" static tests/js` finds nothing.
- [ ] Wooden top bar outside the SVG, fixed, always visible, on the same row left of „Úlohy“ (both closed and open quest log), height ≥ 44 px, respects `env(safe-area-inset-*)`; does not overlap „Úlohy“ at 360 px width. Hidden while `#moveBar` shows, like „Úlohy“. The fitted scene starts below the bar (`app-zoom.js`).
- [ ] Bar content: strip from `sliderRange` min to max with dark sections from `sliderDark`, day abbreviations from `sliderDays`, a knob with the pixel sun or moon (`darkness(h) > 0.5`, reuse the existing `DN_SUN`/`DN_MOON` rects) and the time text `clockLabel(h)` beside it, set via `textContent`.
- [ ] Knob is `role="slider"`, focusable, with `aria-label`, `aria-valuemin`/`max`/`now` (hours) and `aria-valuetext` from `sliderValueText`; keys via `sliderKey` (arrows 1 h, Page Up/Down 6 h, Home/End).
- [ ] Dragging the knob (pointer events, `touch-action: none`, does not pan the map) moves the time continuously and the light follows; on release the time stays where it is, also at night. Tap on the strip runs the time-lapse to that hour (`xToHour`). Dragging or a key during a time-lapse stops it at the current hour.
- [ ] The shown night is always `nightAt(hour)`: whenever it changes (drag, key, time-lapse, tap) `app.night` changes at once with signpost highlight, bottom HUD and open panel refresh, without another time-lapse. A time-lapse over two nights (Št → So) swaps twice (at 30 and 54); going back works in reverse; Sunday morning (54–84) stays So → Ne with no swap.
- [ ] Signpost and „Ťukni sem“ taps run the time-lapse to `noonOf` that night (`durationMs`, `ease`, smooth retarget as in T-111). Page load sets the time to noon of the chosen night. „Kto si?“, party create, bed sheet night headers and SSE/poll updates switch without a time-lapse.
- [ ] Swap effect uses `figureSwap(sleeping[old], sleeping[new])`: `leave` figures shift briefly out of the bed and fade out (~0.5 s), `arrive` figures fade in (~0.5 s), `stay` figures are not redrawn or faded. A `render()` during the effect (SSE, optimistic write) does not leave stale or duplicated figures.
- [ ] `prefers-reduced-motion: reduce`: no time-lapse (a tap sets the time at once), figures swap without fade or shift, fireflies still; dragging still works.
- [ ] T-113 behaviour kept: at rest at a day hour the light layer is `display: none`; at a night hour it renders.
- [ ] Node source checks: `app-daynight.js` has no `innerHTML`; `index.html` contains `role="slider"` (or `app-daynight.js` sets it) and no `id="clock"`. `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
- Open decision "Deň a noc pri prepnutí noci" defaults: time stays where released (also at night); time set to noon of the chosen night after page load; people get up by fading in place, not walking to the door; boards dim lightly; about 2.2 s per night; fireflies yes, no sounds.
- Instant switches (Kto si?, bed sheet, create): default is to keep the current hour if `nightAt(hour)` already equals the new night, otherwise jump to its noon (not in the proposal; open question for the organizer).
- Meadow figures of my party follow `app.night` and switch at once, without the fade (not in the proposal; default, open question for the organizer).
- `app.shownNight` from T-111 is no longer needed: beds always draw `app.night`. Remove it and `drawnNight()` or keep them as a thin alias, but do not keep two sources of truth.
- The `#moveBar:not([hidden]) ~ …` CSS selector needs the bar after `#moveBar` in the DOM (or use another hide rule).
- Do not touch the intro zoom beyond the fit-top change; check the intro still starts at the top of the scene below the bar.

---
## Dev log

## Review round 1

## Review round 2

## Test report
