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
- [x] Light layer is one `<g aria-hidden="true" pointer-events="none">` created in `ensureScene()` **between `walk` and `boards`**, so signposts and the party table are above it. It holds: orange dusk rect and navy `#16224A` dark rect (both `mix-blend-mode: multiply`, dark masked lighter over room floors), lamp group (room floors, window glow, door light pools), 7 fireflies on the grass, as in the prototype.
- [x] All rectangles come from `app.state.layout` (`layout.rooms`, `layout.map.windows`, `layout.map.doors`); no room/window/door coordinates in code. Missing `windows`/`doors` lists are tolerated.
- [x] Boards stay readable: they darken only lightly at night (a separate, weaker tint over the `boards` layer; the full night tint must not cover them).
- [x] Each frame only sets `opacity` attributes from T-110's light function; the bird's opacity follows it (no bird at night). No elements are created per frame.
- [x] Clock board: fixed at the top of the screen in the wooden style, pixel sun (day) or moon (night), `clockLabel` text (e.g. „Pi 03:00“) via `textContent`, a strip of 16 three-hour cells from the first day 12:00 to the day after the last night 12:00, the current cell framed. Visible only during the animation; fades out about 0.9 s after it ends. Not shown at rest.
- [x] Only a user tap animates: the signposts in the scene and the HUD quest/status row with `action: "night"` („Ťukni sem“). Page load, „Kto si?“ pick, party create (`defaultNightFor`), the bed sheet's night headers and SSE/poll updates switch without animation (`selectNight` default stays instant).
- [x] On tap the signpost highlight, HUD and open panel refresh switch to the new night at once (`app.night`); the bed figures keep showing the old night until `swapHour` is passed (at once when < 12 h).
- [x] A `render()` triggered during the animation (SSE state, optimistic write) draws beds for the night still shown, not `app.night`, until the swap.
- [x] A tap during the animation retargets smoothly from the current hour (no jump); tapping the night already targeted does nothing extra. A tap on the night already shown at rest does not animate.
- [x] With `prefers-reduced-motion: reduce` nothing animates, no clock board, the night switches at once as before, and fireflies do not blink (CSS).
- [x] A rebuilt scene (`ensureScene` after a layout change) rebuilds the light layer and repaints at the current hour.
- [x] Node source checks in `tests/js/logic.test.mjs`: `index.html` lists `app-daynight.js` with `?v=__ASSET_VERSION__`; `app-daynight.js` contains no `innerHTML`; the light layer is created after `walk` and before `boards` in `ensureScene`. `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Open decision "Deň a noc pri prepnutí noci" defaults: swap in the last night passed, boards dim only lightly, about 2.2 s per night, fireflies yes, no sounds (owl, rooster), clock only during the animation.
- Keep the shown-night state separate from `app.night` (e.g. `app.shownNight`); the hidden screen-reader summary and panels use `app.night`.
- `cancelWalks()` in `selectNight` stays. Do not touch the intro zoom (`app-zoom.js`).
- Check `mix-blend-mode` on SVG rects in iPhone Safari; if it fails there, plain opacity is the fallback.
- The prototype's `showScene` uses `innerHTML` for captured markup; do not copy that. The clock icon is built with SVG rects.

---
## Dev log

- New `static/js/app-daynight.js` (all names `dn*`): `dnBuild` makes the light layer (dusk and dark multiply rects, dark masked lighter over `layout.rooms`, lamp group from rooms/`map.windows`/`map.doors`, 7 fireflies scaled to the viewbox) between `walk` and `boards`, plus a weaker board tint (rects over `map.scene` entries except meadow) between `boards` and `tip`. `dnPaint` sets only opacities from `lightAt` (bird too). Clock board built with SVG rects and `textContent`, strip of 3 h cells. `dnStart` (tap, retarget from the current hour, swap via `swapHour`), `dnStep` (rAF), `dnStop` (instant switch ends a running animation), `dnSync` (rest hour follows `app.night`, called from `render()`).
- `selectNight(night, opts)`: `opts.animate` only from signpost tap (`app-draw.js`) and HUD `action: "night"` (`app-hud.js`). `app.shownNight` (new in `app-core.js`) and `drawnNight()` make `drawBed`, `drawMeadow` and `showTip` (`app-beds.js`) draw the old night until the swap.
- `index.html`: script tag after `app-draw.js`, `#clock` element and CSS, firefly keyframes; reduced motion: no fireflies blinking, clock hidden, `dnStart` returns false so the switch is instant.
- Test: source check added to `tests/js/logic.test.mjs`. `node --test tests/js/` 360 pass, `uv run pytest -q` 739 pass.
- NOT verified in a browser (no iPhone Safari `mix-blend-mode` check, no visual run); the tester/organizer should look at it on a phone. Plain opacity is the fallback if blend fails.

## Review round 1

Tests: `node --test tests/js/` 360 pass, `uv run pytest -q` 739 pass. All `static/js/*.js` are listed in `index.html` with `?v=__ASSET_VERSION__`; no `innerHTML`; text via `textContent`. Night/shown-night split, retarget, swap, reduced motion and rebuild logic read correctly.

**Blocker**
- `static/js/app-scene.js:135` / `static/js/app-daynight.js` (`fx.bird = svg.querySelector(".bird")` in `dnBuild`): `dnBuild` runs before `drawBird(app.layers.sky, layout)` (line 137), so the query always returns `null` and `dnPaint` never touches the bird. Result: the bird keeps flying through the dark night during every time-lapse, so the criterion "the bird's opacity follows it (no bird at night)" is not met. Fix: call `dnBuild(...)` after `drawBird(...)` in `ensureScene` (insertion uses `insertBefore(boards/tip)`, so the order of the call does not change the layer order), or look the bird up after it is drawn. Adjust the source check if it depends on the call position.

**Suggestion**
- `dnBuild` board shade: one rect for each `map.scene` entry except `meadow`, including `locked` (only drawn when signup is locked), `key` (admin only) and the gaps between the three signposts inside `nights`. Where no board is drawn, the extra tint lands on grass that is already darkened, so faint darker squares show during the night part of the time-lapse. Skip the entries that are not drawn (`locked` unless locked, `key` unless admin) or tint per drawn board.
- Clock strip: `nights.length * 8 + 1` = 25 cells x 8 px + icon + text is about 360 px wide; with `white-space: nowrap` and centring it clips on 360 px phones. Consider 4 px cells or a `max-width` check on a narrow viewport. (The prototype's 16 cells only reached Sat 12:00, so 24/25 is right for the range.)

Verdict: CHANGES REQUESTED

## Dev log (fix round 1)

- Blocker fixed: `dnBuild` now runs after `drawBird` in `ensureScene` (`app-scene.js`), so the bird is found; source check asserts the order.
- Suggestion 1 fixed: board shade skips `meadow`, `locked`, `key` and the `nights` rect, and instead tints one rect per signpost (`signpostLayout`), so no tint on bare grass.
- Suggestion 2 fixed: clock strip cells 4 px wide with 1 px gap (about 125 px for 25 cells).
- Tests: `node --test tests/js/` and `uv run pytest -q` (739) pass.

## Review round 2

Tests: `node --test tests/js/` 360 pass, `uv run pytest -q` 739 pass.

- Round-1 blocker fixed: `dnBuild` is now called after `drawBird` in `ensureScene` (`app-scene.js:137`), so `svg.querySelector(".bird")` finds the bird. `birdFly` animates only `transform`/`visibility`, not opacity, so the `opacity` attribute set in `dnPaint` takes effect. The source check asserts the order.
- Suggestion 1 done: the board shade skips `meadow`/`locked`/`key` and tints one rect per signpost via `signpostLayout(..., 4).boards`, the same gap `app-draw.js` uses.
- Suggestion 2 done: 4 px cells with a 1 px gap.

No new blockers in the fix diff.

Verdict: APPROVED

## Test report

### Tester (T-111) — FAIL

**Commands and results**
- `node --test tests/js/` → 360 pass, 0 fail.
- `uv run pytest -q` → 739 passed.
- Server: temporary `data/` in `/tmp/t111/data`, `GROUP_CODE`/`ADMIN_CODE`/`SECRET_KEY` as test values, port 8123 (stopped afterwards). `GET /api/health` 200 (version 1.17.0).
- Headless Chrome (`/Applications/Google Chrome.app`) driven by `playwright-core` 1.64.1 from `/tmp/t111` (scripts in `/tmp/t111/script`, not in the repo). Per-frame sampler reads `dn`, `app.shownNight`, `drawnNight()`, opacities and clock state.

**Acceptance criteria**

| # | Criterion | Result | Note |
|---|-----------|--------|------|
| 1 | One `g[aria-hidden][pointer-events=none]` light layer between walk and boards, dusk/dark multiply rects, lamp group, 7 fireflies | Pass | 5 light groups, 11 blend rects, 7 `.dn-ff`. Order checked in source (`dnBuild` before `boards`), Node source check passes |
| 2 | Rects from `app.state.layout` | Pass (source) | `dnBuild` reads `layout.rooms`, `map.windows`, `map.doors` with `|| []` |
| 3 | Boards only lightly darkened | Pass (code) | board shade opacity = dark × 0.25 (max ≈ 0.195); not inspected visually |
| 4 | Per-frame only opacity; bird follows light | Pass | bird opacity 1 at noon, 0 at 21:15–04:30 during the tap |
| 5 | Clock board: top, wooden, sun/moon, `textContent` label, 16→25 cell strip, current cell framed, fades ~0.9 s after | **Fail** | Labels, icon, cell count (25 for 3 nights), current cell and fade (about 0.9 s) pass. But the strip is hidden under the „Úlohy“ HUD button on phones, see bug 1 |
| 6 | Only user taps animate (signpost, HUD „Ťukni sem“); load, „Kto si?“, create, SSE switch instantly | Pass | `restTapAnim`, `instantDuringAnim` (selectNight without opts: instant, no clock), HUD path animates |
| 7 | Tap updates `app.night`, highlight, HUD and panel at once; beds keep old night until swap | Pass | `drawn` stayed 29 until hour 24 (swap at midnight of last night passed), then 30; `shown` null from there |
| 8 | `render()` during animation draws the still-shown night | Pass | `render()` at mid-animation: `drawn` = 29 while `app.night` = 31 |
| 9 | Retarget from current hour, no jump; same target does nothing | Pass | max per-frame hour step 0.56 h, no jump > 1.5 h in 270 samples (36 → 35.6 → 60); repeated tap on the same target did not restart |
| 10 | Tap on night already shown at rest does not animate | Pass | `anim` false, clock off |
| 11 | Reduced motion: no animation, no clock, instant switch, no firefly blink | Pass | `anim` false, clock `display: none`, `.dn-ff` `animation-name: none`, night switched at once |
| 12 | Rebuilt scene rebuilds light layer and repaints at current hour | Pass | `app.layoutKey = null; render()` mid-animation: 5 light groups (no duplicates), dark attr equals `lightAt(dn.hour)` |
| 13 | Node source checks; `node --test` and `pytest` pass | Pass | see commands above |

**Extra scenarios**
- Real mouse click on the 31 signpost (1280 px): animation starts, clock on, target 60 h.
- Keyboard Enter on a focused signpost (`role=button`) starts the time-lapse toward noon of 29.
- Retarget mid-way (30 → 29 → 31 within 0.5 s), then final state at noon of 31 with no figures stuck.
- Instant `selectNight` during a running animation: `anim` null, `shown` null, clock off, dark 0 at once.
- Console errors and page errors: none at load, during tap, retarget, HUD path, reduced motion, 360 px mobile run.
- 360 px phone: clock box 35–325 px, fits the viewport.
- Screenshot at 360 px mid-animation (`/tmp/t111/mobile-mid.png`) shows the clock covering the start of the HUD area.

**Bug 1 (medium): clock strip hidden under the „Úlohy“ HUD button on phones**
- Steps: open the map on a 360 px or 390 px wide phone (or the same width in Chrome device mode), tap the night signpost for 30. 10. (or 31. 10.) and look at the top of the screen during the first 2–3 s.
- Expected: the clock board with the whole 3-hour strip and the framed current cell is visible.
- Actual: `#clock` (`z-index: 5`) is centred and 290 px wide (35–325 px at 360 px, 50–340 px at 390 px), the strip is at 186–310 px (201–325 px at 390). The „Úlohy“ `.quest` button is at 230–348 px (260–378 px at 390), above the clock. So the right part of the strip is covered, including the current cell for the nights from 31. 10. on (cell 16+ at x ≈ 281 px at 390 px).
- Reproduce: measure `#clock`, `#clockStrip` and `.quest` with `getBoundingClientRect()` after tapping a night at 360 or 390 px.
- Suggested fix for the developer: keep the strip clear of the HUD row, for example by putting the clock board under the HUD row, or on a narrow viewport moving it to a second line or the bottom, or making it narrower (the icon and label without the strip, or the strip on its own row). Do not hide the framed current cell.

**Manual items added** to `tests/manual.md` section 11 (iOS and Android animation look, iOS mix-blend fallback, clock vs. HUD placement on a real phone, figures and retarget feel, reduced motion setting, two devices).

**Not verified**: visual look of the boards' tint and the light layer in a real phone, iOS Safari `mix-blend-mode` (manual list), the figure walk timing against the swap (only the swap hour checked).

Verdict: FAIL (bug 1). Task moved back to `tasks/in-progress/`.

## Dev log (fix for tester's bug 1)

- Clock board covered by the „Úlohy“ button on phones: in `static/index.html`, a `@media (max-width: 480px)` rule moves `#clock` to the top left (10 px), lets it wrap and puts the strip on its own row, with `max-width: calc(100vw - 190px)`. Desktop layout unchanged.
- Verified with the tester's scripts (adapted to own port 8795, headless Chrome, stopped afterwards): 360 px: clock 10–180 px, strip 21–165 px, `.quest` starts at 230 px; 390 px: clock 10–210, strip 21–195, `.quest` 260–378. No overlap, whole strip including the framed cell visible.
- Tests: `node --test tests/js/` and `uv run pytest -q` pass.

## Review re-check

Scope: the `@media (max-width: 480px)` `#clock` rule in `static/index.html` (fix for tester's bug 1). Tests: `node --test tests/js/` 360 pass, `uv run pytest -q` 739 pass.

- Bug 1 fixed. With `box-sizing: border-box`, the clock's right edge is at most `100vw - 180px`. The „Úlohy“ button's far-left point, its `::before`/`::after` caps (`right 12px + 150px + 8px`), is at `100vw - 170px`, and further right when `.quest.closed`. So the board stays clear of the button at any narrow width. Icon + „Pi 03:00“ (about 155 px) and the 125 px strip on its own row both fit in the 170 px available at 360 px. The framed cell stays visible. Desktop is unchanged, and the reduced-motion rule still hides the clock.
- Nit: the narrow rule ignores `env(safe-area-inset-left/right)`. This does not matter in portrait.

No blockers.

Verdict: APPROVED

### Tester re-test (T-111, after clock-board fix) — PASS

**Commands and results**
- `node --test tests/js/` → 360 pass, 0 fail.
- `uv run pytest -q` → 739 passed.
- Temporary server on 127.0.0.1:8123 with `data/` in `/tmp/t111/data3` and test secrets (stopped afterwards). `GET /api/health` 200, version 1.17.0.
- Browser scenario set re-run in headless Chrome (`/tmp/t111/script/run3.mjs`, copy of `run.mjs` with a fresh test cookie and `VW` viewport env): `VW=360` and `VW=390`. Both: no console or page errors, no HTTP ≥ 400.
- Clock probe (`/tmp/t111/script/probe4.mjs`): tap on the 31. 10. signpost at 360 and 390 px, samples at 0.3 s, 1.2 s, 2.0 s.

**Acceptance criteria**

| # | Criterion | Result | Note |
|---|-----------|--------|------|
| 1 | Light layer: one `g[aria-hidden][pointer-events=none]` between walk and boards, dusk/dark multiply rects, lamp group, 7 fireflies | Pass | 5 light groups, 11 blend rects, 7 `.dn-ff` at both widths |
| 2 | Rects come from `app.state.layout` | Pass | source check, `dnBuild` reads rooms, windows, doors with fallback lists |
| 3 | Boards only lightly darkened | Pass (code) | board shade max ≈ 0.195; visual check still manual |
| 4 | Per-frame only opacity; bird follows light | Pass | `dark` and `bird` opacity sampled per frame; bird 0 at night |
| 5 | Clock board: top, wooden, sun/moon, `textContent` label, 25-cell strip (3 nights), current cell framed, fades about 0.9 s after | Pass | 360 px: clock 10–180, strip 21–165, all 25 cells hit-testable, `.quest` at 230–348, no overlap. 390 px: clock 10–210, strip 21–195, `.quest` at 260–378, no overlap. Fade after end confirmed (`clockAfter` false). Screenshot `/tmp/t111/probe4-mid-360.png` shows the clock clear of the „Úlohy“ button |
| 6 | Only user taps animate (signpost, HUD „Ťukni sem“); load, „Kto si?“, create, SSE switch instantly | Pass | `restTapAnim` no animation at rest tap; HUD `action: night` animates; `instantDuringAnim` switches at once |
| 7 | Tap updates `app.night` and highlight at once; beds keep old night until swap | Pass | `drawn` stays on the old night until the swap hour, then switches |
| 8 | `render()` during animation draws the still-shown night | Pass | drawn night stays old while `app.night` is new |
| 9 | Retarget from the current hour, no jump; same target does nothing extra | Pass | retarget samples continuous, same-target repeat does not restart |
| 10 | Tap on the night already shown at rest does not animate | Pass | `anim` false, clock off |
| 11 | Reduced motion: no animation, no clock, instant switch, no firefly blink | Pass | `clockDisplay` none, `ffAnim` none, `anim` false, night switched at once, 0 errors |
| 12 | Rebuilt scene rebuilds the light layer and repaints at the current hour | Pass | not in the 360/390 set; the rebuild step is only in the desktop script `run2.mjs`, not re-run this time (passed in the previous test round) |
| 13 | Node source checks; `node --test` and `pytest` pass | Pass | 360/360 and 739 passed |

**Regressions**: `tasks/done/` tasks are covered by the 739 pytest tests and the 360 Node tests, both green. Browser run shows no console errors at either width.

**Extra scenarios**
- 360 and 390 px full set (load, signpost tap, retarget, same-target tap, rest tap, HUD path, instant switch during animation, reduced motion, 360 clock box) with no errors.
- Clock-vs-HUD probe at 0.3 s, 1.2 s and 2.0 s: no overlap with `.quest` and every strip cell hit-testable at both widths. No horizontal scroll (`scrollWidth` = viewport width).

**Still manual** (already in `tests/manual.md` section 11): board tint look on a real phone, iOS Safari `mix-blend-mode` (fallback is plain opacity), clock placement on a real phone, figure walk feel, reduced-motion setting on a device.

Verdict: PASS. Task moved to `tasks/done/`.
