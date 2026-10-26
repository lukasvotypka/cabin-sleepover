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
- [x] `#clock`, its CSS and the clock-board code are gone; `grep -n "swapHour\|clockStrip\|id=\"clock\"" static tests/js` finds nothing.
- [x] Wooden top bar outside the SVG, fixed, always visible, on the same row left of „Úlohy“ (both closed and open quest log), height ≥ 44 px, respects `env(safe-area-inset-*)`; does not overlap „Úlohy“ at 360 px width. Hidden while `#moveBar` shows, like „Úlohy“. The fitted scene starts below the bar (`app-zoom.js`).
- [x] Bar content: strip from `sliderRange` min to max with dark sections from `sliderDark`, day abbreviations from `sliderDays`, a knob with the pixel sun or moon (`darkness(h) > 0.5`, reuse the existing `DN_SUN`/`DN_MOON` rects) and the time text `clockLabel(h)` beside it, set via `textContent`.
- [x] Knob is `role="slider"`, focusable, with `aria-label`, `aria-valuemin`/`max`/`now` (hours) and `aria-valuetext` from `sliderValueText`; keys via `sliderKey` (arrows 1 h, Page Up/Down 6 h, Home/End).
- [x] Dragging the knob (pointer events, `touch-action: none`, does not pan the map) moves the time continuously and the light follows; on release the time stays where it is, also at night. Tap on the strip runs the time-lapse to that hour (`xToHour`). Dragging or a key during a time-lapse stops it at the current hour.
- [x] The shown night is always `nightAt(hour)`: whenever it changes (drag, key, time-lapse, tap) `app.night` changes at once with signpost highlight, bottom HUD and open panel refresh, without another time-lapse. A time-lapse over two nights (Št → So) swaps twice (at 30 and 54); going back works in reverse; Sunday morning (54–84) stays So → Ne with no swap.
- [x] Signpost and „Ťukni sem“ taps run the time-lapse to `noonOf` that night (`durationMs`, `ease`, smooth retarget as in T-111). Page load sets the time to noon of the chosen night. „Kto si?“, party create, bed sheet night headers and SSE/poll updates switch without a time-lapse.
- [x] Swap effect uses `figureSwap(sleeping[old], sleeping[new])`: `leave` figures shift briefly out of the bed and fade out (~0.5 s), `arrive` figures fade in (~0.5 s), `stay` figures are not redrawn or faded. A `render()` during the effect (SSE, optimistic write) does not leave stale or duplicated figures.
- [x] `prefers-reduced-motion: reduce`: no time-lapse (a tap sets the time at once), figures swap without fade or shift, fireflies still; dragging still works.
- [x] T-113 behaviour kept: at rest at a day hour the light layer is `display: none`; at a night hour it renders.
- [x] Node source checks: `app-daynight.js` has no `innerHTML`; `index.html` contains `role="slider"` (or `app-daynight.js` sets it) and no `id="clock"`. `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
- Open decision "Deň a noc pri prepnutí noci" defaults: time stays where released (also at night); time set to noon of the chosen night after page load; people get up by fading in place, not walking to the door; boards dim lightly; about 2.2 s per night; fireflies yes, no sounds.
- Instant switches (Kto si?, bed sheet, create): default is to keep the current hour if `nightAt(hour)` already equals the new night, otherwise jump to its noon (not in the proposal; open question for the organizer).
- Meadow figures of my party follow `app.night` and switch at once, without the fade (not in the proposal; default, open question for the organizer).
- `app.shownNight` from T-111 is no longer needed: beds always draw `app.night`. Remove it and `drawnNight()` or keep them as a thin alias, but do not keep two sources of truth.
- The `#moveBar:not([hidden]) ~ …` CSS selector needs the bar after `#moveBar` in the DOM (or use another hide rule).
- Do not touch the intro zoom beyond the fit-top change; check the intro still starts at the top of the scene below the bar.

---
## Dev log

Replaced the clock board with a fixed top time slider (`#timebar`, inside `#hud`, so it hides/inerts with the HUD; `#moveBar:not([hidden]) ~ .hud .timebar` hides it like „Úlohy“). `app-daynight.js`: bar build/paint, pointer drag on the knob (capture on the track, `touch-action: none`, grab offset), tap on strip = `dnGoTo`, keys via `sliderKey`, `dnSetHour` (sets time, changes `app.night` at `nightAt`, starts the swap, `render()`), `dnGoTo` time-lapse (retarget from current hour), `dnSync` (any other night change puts the time on noon unless the hour is already in that night), swap effect (`dnStartSwap`/`dnSlotFx`; `drawBed` draws a `dn-out` ghost of the old figure and a `dn-in` fade for arrivals, animation-delay continues the effect on a redraw during it; a timer ends it after 0.5 s). `selectNight(night, {animate})` runs the time-lapse to noon; otherwise changes at once. Removed `app.shownNight`, `drawnNight`, `swapHour` and its tests, `#clock` markup and CSS. `questBottom()` (app-hud.js) now includes the bar bottom so the fitted scene starts below it.
Files: static/index.html, static/js/app-daynight.js, app-beds.js, app-core.js, app-hud.js, app-scene.js, logic-daynight.js, tests/js/logic.test.mjs.
Tests: `node --test tests/js/` 365 pass; `uv run pytest -q` 739 passed.
Headless Chrome (own port 8791, scripts `/tmp/t115/s/run.mjs`, touch drag via CDP) at 360 and 390 px: no console errors; bar 8..184 px (360) vs open „Úlohy“ from 198 px, no overlap; drag across 06:00 changes night 10-29 -> 10-30 with `dn-out`/`dn-in` figures and ghosts gone 0.5 s later; knob drag did not change `app.view` (no map pan); keys PageUp/End/Home work; tap on strip runs the time-lapse (to hour 60); signpost tap goes to noon of that night; time stays at 40 (night) after release with the light layer rendered, `display: none` at day hours; reduced motion: tap sets time at once, no swap effect.
Deviations/open: `dn.hour` at the end of a time-lapse is exact only to ~1e-6 on drag/keys (float mapping), harmless. Instant switches keep the hour if it is already inside the chosen night, else noon (task default). Docs (proposal/CLAUDE.md/manual) are T-116.

## Review round 1

Tests run by reviewer: `node --test tests/js/` 365 pass; `uv run pytest -q` 739 passed. The grep for `swapHour|clockStrip|id="clock"` in `static` and `tests/js` finds nothing. All 35 scripts are listed with `?v=__ASSET_VERSION__`.

Checked against the criteria:
- Night always follows the time. `dnSetHour` is the only place the time-lapse, drag and keys change `app.night`, so a two-night time-lapse swaps once at each 06:00 crossing, in either direction. Direct `app.night =` assignments (login, „Kto si?“, create, sheet) go through `render()` → `dnSync`, which cancels a running time-lapse and moves to noon unless the hour is already in that night. SSE renders during a time-lapse return early in `dnSync` because the hour and the night stay in sync.
- Swap: a slot that changes occupant gets both the `dn-out` ghost and the `dn-in` fade. A redraw during the effect continues it through the negative `animation-delay`, and the timer's `renderBeds()` removes the ghosts, so nothing is left stale or duplicated. With reduced motion `dnStartSwap` returns early, the time-lapse jumps, and the fireflies stay still.
- Slider: the knob is in `#hud` outside the SVG, so dragging does not pan the map. The SVG keydown handler is on the svg only, so arrow keys on the knob are not taken by the map. The ARIA attributes are set, labels use `textContent`, there is no `innerHTML`, and the knob is 44×38 inside a 44 px bar.
- `questBottom()` includes the bar, and the `#moveBar:not([hidden]) ~ .hud .timebar` rule matches the DOM order.

No blockers.

**Suggestion**
- `app-daynight.js` `dnBuild`: when the hour is not in `app.night`, it resets `dn.hour` without `dnCancelAnim()`. This only matters if the scene SVG is rebuilt during a time-lapse after an outside night change. `dnSync` covers the normal path, so it is not a bug today. Adding `dnCancelAnim()` there would make it robust.
- `.timebar { right: calc(176px + …) }` hardcodes the width of „Úlohy“. This is fine for now, but if the quest header gets wider the bar will overlap it.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (T-115, run 1 of the test report; date 2026-10-26)

**Commands run**
- `node --test tests/js/` → 365 tests, 365 pass, 0 fail.
- `uv run pytest -q` → 739 passed.
- `grep -n "swapHour\|clockStrip\|id=\"clock\"" -r static tests/js` → no matches. `innerHTML` in `app-daynight.js` and `logic-daynight.js` → 0.
- Headless Chrome (playwright-core from `/tmp/t111/node_modules`, Google Chrome app binary), own server on `127.0.0.1:8797` with temp data `/tmp/t115-tester/data` (not the real `data/`, port 8797 stopped afterwards). Scripts in `/tmp/t115-tester/`: `run.mjs` (developer's script, port and paths changed), `check.mjs`, `extra.mjs`, `shot.mjs`.
- Test data: Jana (Thu A1, Fri A2, Sat A2 cleared) and Peter (Fri A1, Sat A1), so Thu→Fri changes 3 figures and Fri→Sat changes 1.

**Results (360 and 390 px, touch via CDP, `isMobile`/`hasTouch`)**
- Touch drag of the knob across 06:00 forward and back: time follows the finger, night switches at 30.2 and back at 29.7, `app.view` unchanged (no map pan), time stays where released (26 h, Thu) and at night (40 h).
- Time-lapse Thu → Sat (tap on the Sat signpost): night changes at 30.2 (3 figure changes) and at 54.2 (1 change). Backwards Sat → Thu: changes at 53.9 and 29.7. Tap on strip end Thu → Sun 12:00 (83 h): changes only at 30 and 54, no change at 78 (Sunday morning stays Sat night).
- Keys: Home 12, PageDown clamped at 12, ArrowRight 13. ARIA: role slider, min 12, max 84, now, valuetext "štvrtok 13:00, noc Št → Pi", label "Čas".
- A key during a time-lapse stops it at the current hour (14.7 h, no further movement after 1.2 s).
- Swap effect: 3 elements (`dn-in`/`dn-out`) at 0 and 150 ms, 0 at 1.05 s. Repeated 06:00 crossings followed by `render()` left no leftovers and no duplicate bed entries.
- Bar geometry at 360: bar 8–184 px (44 px high) closed and open quest log (quest from 198 px open, 230 px closed): no overlap. At 390: bar 8–214 px, quest from 228/260 px. Screenshot at 360 checked by eye: bar top left, Úlohy right, map fitted below the bar.
- Move mode (`startMove`): `#moveBar` shown, `.timebar` `display: none`; after exit back to `flex`.
- Reduced motion (390, `reducedMotion: reduce`): tap sets 60 h at once, no time-lapse, no `dn-in`/`dn-out`, drag works, the night change Thu → Fri gives no swap elements.
- Light layer: `display: none` at day hours, rendered at night (T-113).
- Console and page errors: none in any run.

**Acceptance criteria**

| # | Criterion | Result |
| --- | --- | --- |
| 1 | `#clock`, CSS, clock code gone (grep empty) | pass |
| 2 | Fixed bar top left of Úlohy, ≥44 px, safe-area, no overlap at 360, hidden in move mode, scene below bar | pass (safe-area via CSS read; notch on device = manual) |
| 3 | Strip, dark sections, day names, sun/moon knob, time text via `textContent` | pass (screenshot; `textContent` by grep) |
| 4 | `role=slider`, aria attributes, keys | pass |
| 5 | Touch drag continuous, no map pan, release stays, tap runs time-lapse, drag/key stops it | pass (tap-to-hour checked with strip tap; signpost tap per developer run) |
| 6 | `app.night` = `nightAt(hour)` always, 2 swaps forward/back, Sunday no swap | pass |
| 7 | Signpost tap → noon, page load noon, Kto si/SSE switch without time-lapse | partly: signpost and load checked (developer run and mine, start 12 h). Kto si? and SSE switch not run; manual item added |
| 8 | Swap via `figureSwap`, 0.5 s out/in, stay not redrawn, redraw-safe | pass for timing and cleanup. "stay not redrawn" not verified by DOM identity: visual on device in manual |
| 9 | Reduced motion: no lapse, no fade or shift, drag works | pass. Fireflies still: not checked |
| 10 | T-113 light layer `display: none` at rest by day | pass |
| 11 | Source checks, `role=slider`, no `id="clock"`, no `innerHTML`, Node and pytest pass | pass |

**Extra scenarios**
- Two-night lapse with an actual figure change at 54 h (Sat cleared), both directions, 390 and 360.
- Drag/key during a time-lapse stops it.
- Repeated crossings with `render()`.
- Notch, iPhone Safari and Android Chrome touch: manual.

**Observation (not a failure)**
- In one run the automatic „Kto si?“ panel opened about 4.5 s after load, although the party was remembered in `localStorage`, and its backdrop covered the bar, so the knob could not be dragged until it was closed. Probes after 5–6 s did not reproduce it. Timing-related, no fix requested. Developer may want to confirm that the automatic „Kto si?“ on load is intended for a remembered party.

**Manual checklist**
- Added section 11 items for the top slider (bar position with notch, finger drag, strip tap, figures at 06:00, move mode, two devices) to `tests/manual.md`. The older section 11 items about the clock board are outdated and are left for T-116 (docs).

**Verdict:** all criteria pass, no regressions (Node 365, pytest 739). No failures, so no bug report.
