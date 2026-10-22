# T-010: Zoom and pan the map (mouse wheel, pinch)

- **Phase:** 1 (organizer request, 22. 10. 2026)
- **Depends on:** T-006, T-007
- **Size:** S

## Goal
Let people zoom into the pixel map: with the mouse wheel (and trackpad pinch) on desktop, and with two fingers on a phone. When zoomed in, the map can be panned by dragging. Small beds become easy to tap without zooming the whole page.

## Scope
- `static/index.html`
- `tests/js/logic.test.mjs`
- `tests/manualne.md` (zoom items)

## Acceptance criteria
- [x] Zoom works by changing the SVG `viewBox` (the scene stays crisp, `shape-rendering="crispEdges"` kept); no CSS transform scaling of the page.
- [x] Mouse wheel over the map zooms in and out around the cursor point. Trackpad pinch (wheel events with `ctrlKey`) works the same. While over the map, the wheel does not scroll or zoom the page.
- [x] Two-finger pinch on touch zooms around the midpoint of the fingers and pans with the fingers' movement. The browser's own page zoom does not fight it (e.g. `touch-action` on the map).
- [x] When zoomed in, a one-finger or mouse drag pans the map. A drag beyond the existing ~10 px tap tolerance never counts as a tap or long press on a bed, signpost or icon; a tap without movement still works exactly as before.
- [x] Zoom is clamped between 1× (whole scene, the current view) and a sensible maximum (about 4×); panning is clamped so the view never leaves the scene.
- [x] A visible control to get back to the whole map (e.g. a small „Celá mapa“ button over the map, shown only when zoomed in, 44 px target, Slovak `aria-label`). Double-tap/double-click may also reset, optional.
- [x] Keyboard: `+` / `-` zoom around the center and `0` resets when focus is in the scene; focused beds stay reachable (if a focused bed is outside the view, pan so it is visible).
- [x] Zoom state survives state refreshes (polling, writes) and night switches; it does not need to survive a reload.
- [x] Hit areas, the bed sheet, move mode, panels, the code screen and the hidden summary keep working at any zoom level.
- [x] `prefers-reduced-motion`: no animated zoom transitions.
- [x] The zoom math (clamp, zoom around a point, pan clamp, viewBox string) lives as pure functions in the logic script with Node tests. `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md` gets items: pinch zoom and pan on iPhone Safari and Android Chrome (including inside the WhatsApp in-app browser), wheel and trackpad zoom on desktop, tapping a small bed while zoomed, „Celá mapa“ resets.

## Notes for developer
- The existing manual checklist item "pinch-zoom works on iPhone and Android" referred to page zoom; replace it with the new map zoom items.
- Keep all geometry from `/api/state` as before; zoom only changes the visible window of the 380×412 scene.
- No framework, no library.

---
## Dev log
**What was done**
- Pure zoom math in `<script id="logic">` of `static/index.html`: `wholeView`, `viewZoom`, `isZoomed`, `clampView` (1x to `ZOOM_MAX` = 4, aspect kept, area kept inside the scene), `zoomView` (around a scene point), `panView`, `scenePoint`, `dragView`, `pinchView` (zoom around and pan with the midpoint of two fingers), `wheelFactor`, `revealRect`, `viewBoxText`. A view is `{x, y, w, h}` in scene units.
- App code: `setupZoom()` (called from `ensureScene()` when the svg is built) changes only the svg `viewBox`; no CSS transform. Pointer events on the svg track fingers: two fingers pinch and pan, one finger or the mouse pans when zoomed once it moves past the existing 10 px tap tolerance (`movedBeyond` / `LONG_PRESS_SLOP`). A moved gesture sets `app.blockClick`, and a capture-phase click listener on the svg swallows the click that follows, so a drag is never a tap on a bed, signpost or icon. A tap without movement is untouched. Pointer capture on the svg is taken only after the move passes the tolerance (or when a second finger lands), so taps keep their target and a redraw of a bed mid-drag cannot stall the pan. The long-press timer in `watchLongPress` does nothing while two fingers are down (`app.pinching`).
- Wheel (`passive: false`, `preventDefault`) zooms around the cursor, `ctrlKey` wheel (trackpad pinch) uses a stronger factor. Safari desktop `gesturestart/gesturechange` are handled too (only when no pointer is down, so touch is not doubled).
- `touch-action` on the svg: `pan-x pan-y` at 1x (one finger still scrolls the page, the browser does not page-zoom the map), `none` while zoomed (class `zoomed`).
- „Celá mapa“ button (`.zoom-reset`, HTML button in `#scene`, 44 px, `aria-label` „Zobraziť celú mapu“), shown only when zoomed; it re-creates with the svg and puts focus on the svg (`tabindex="-1"`).
- Keyboard: `+`/`=`, `-`/`_`, `0` on the svg (not with ctrl/meta/alt), zoom around the center. A bed reached with Tab (`:focus-visible` and a focus-moving key within 500 ms, so not after a tap or after Escape/Enter returns focus from a panel) is panned into view with `revealRect`.
- Zoom state lives in `app.view` and is re-applied after a layout redraw; polls, writes and night switches only redraw the beds/boards layers, so the zoom stays. A different scene size resets it.
- `prefers-reduced-motion`: there are no zoom transitions at all (instant `viewBox` changes).
- Not done (optional in the task): double-tap / double-click reset. A double-click on a bed would double-open the sheet.
- `tests/manualne.md` section 6: the old "pinch-zoom works" item replaced by five zoom items (touch incl. WhatsApp in-app browser, wheel/trackpad/keys, small beds while zoomed, „Celá mapa“, page pinch elsewhere).

**Files touched:** `/Users/luigi/workspace/chrapa-poll/static/index.html`, `/Users/luigi/workspace/chrapa-poll/tests/js/logic.test.mjs` (11 new tests: zoom math and a page check: viewBox zoom, no CSS transform, label, passive-false wheel, `.zoomed` touch-action), `/Users/luigi/workspace/chrapa-poll/tests/manualne.md`.

**Tests**
- `node --test tests/js/`: 99 pass, 0 fail.
- `uv run pytest -q`: 379 passed.

**Headless browser check** (Chrome 155 headless via CDP, own uvicorn on 127.0.0.1:18710 started from a throwaway script with `create_app(data_dir="/tmp/t010/data", env=test secrets)`, never the real `data/` or `.env`; driver scripts live in `/tmp/t010`, not in the repo; server and Chrome killed afterwards). 62 checks passed at desktop 1280x900 and mobile 380x800 (touch emulation):
- Wheel zooms around the cursor (the bed under the cursor stays under it), clamps at 4x and at 1x, page scrollY unchanged, ctrl+wheel zooms, button shown (44 px) and reset works, zoom is kept while the sheet opens and closes.
- Mouse: tap on a bed while zoomed opens the sheet; a drag pans, is clamped and does not open the sheet; a 4 px wobble is still a tap.
- Keys `+`, `-`, `0`; Tab through all beds while zoomed keeps the focused bed in view; zoom survives a poll that brings changes and a night switch.
- Touch (`Input.dispatchTouchEvent`): two-finger pinch out and in from 1x, `visualViewport.scale` stays 1, no sheet or tip; two-finger move pans; one-finger tap and a tap with 5 px jitter open the sheet while zoomed; one-finger drag (fast and slow) pans and opens nothing; a still long press shows the names tip and no sheet; two fingers held on two beds show no tip; tap at 1x opens the sheet.
- Screenshot at 380 px zoomed 2.5x looked crisp with the button at the bottom right.

**Not verified (needs real devices, in the manual checklist):** iOS Safari and the WhatsApp in-app browser (touch-action `pan-x pan-y` at 1x relies on the browser delivering pointer events for a pinch; in headless Chrome it does, on iOS it may cancel them if a page scroll starts first, in which case switching 1x to `touch-action: none` is the fallback), and Safari desktop `gesture*` events.

**Notes / possible follow-ups (outside this task):** the button sits over the bottom right of the map and can cover a bit of the scene; move it if the organizer prefers another corner.

## Dev log, round 2 (answers to review round 1)

1. **Blocker 1, non-finite gesture coordinates: fixed.** `zoomAround` in `setupZoom` falls back to the center of the svg when `clientX`/`clientY` are not finite. In the logic script `clampView` returns the whole view for a view with a non-finite or non-positive number (or none); `zoomView` ignores a bad factor and zooms around the center of the visible area for a bad point; `panView`, `pinchView` and `revealRect` ignore non-finite input. New Node test "non-finite input never corrupts the view" (NaN, undefined, Infinity, a string, through all of these functions, and `viewBoxText` never prints NaN). In the browser a synthetic `gesturechange` event without coordinates zoomed around the center with a valid viewBox.
2. **Blocker 2, pinch at 1x: fixed as proposed (option a).** `touch-action: pan-x pan-y` stays at 1x (`none` while zoomed). A non-passive `touchstart` and `touchmove` listener (`holdTwoFingers`) on the svg calls `preventDefault()` when `e.touches.length >= 2` and the event is cancelable. `gesturestart` keeps its `preventDefault`. The page check in `tests/js/logic.test.mjs` now asserts the `pan-x pan-y` rule, `.zoomed` none, both listeners with `passive: false`, and the two-finger condition. Honest limit: I could not reproduce the browser claiming an uneven pinch as a scroll with synthetic CDP touches. I ran an asymmetric pinch (one finger still) on a page that can scroll, against the current page and against a copy with the listener disabled, and both zoomed fine. So the listener is verified as present and harmless (one-finger drag at 1x still scrolled the page, scrollY 112, no zoom), but its effect needs a real iPhone, Android and WhatsApp check (manual list item kept).
3. **Suggestion, +/- with a focused bed: done.** After a key zoom `revealFocused()` runs `revealRect` on the focused element's bbox. Checked with all 12 beds: focus each, press `+` six times, the bed stays in view (a bed bigger than the view shows its top-left corner).
4. **Suggestion, long press after a pinch or Safari gesture: done.** `app.gestureId` is bumped by `endPress()` when a second finger lands, a drag passes the tolerance, and on `gesturestart`, `gesturechange` and `gestureend`. The long-press timer remembers the id at `pointerdown` and gives up if it changed (and still checks `app.pinching`). `app.gestureAt` is set while a pinch moves, when it ends and during Safari gestures, and a `pointerdown` within `LONG_PRESS_MS` of it starts no timer. Browser check: a quick (under 500 ms) pinch whose second finger sits on an occupied bed shows no late tip, a tap right after still opens the sheet, a plain long press still shows the tip.
5. **Suggestion, label in name: done.** `aria-label` is „Celá mapa – zobraziť celú mapu“ (starts with the visible text), asserted in the page test and in the browser.
6. **Nit, focus after reset: done.** The `outline: none` on the svg is gone. `#scene svg:focus-visible` has a 3 px yellow inset outline. After resetting with Enter from the keyboard, focus is on the svg and `:focus-visible` matches. A mouse click does not show it.
7. **Nit, trackpad scroll zooms:** left as the criterion says; noted for the organizer.

**Side effect to note:** because of item 3, the earlier check "`+` zooms around the view center" only holds when no bed is focused, since a focused bed can now shift the view (my driver script was adjusted, not the page).

**Files touched:** `/Users/luigi/workspace/chrapa-poll/static/index.html`, `/Users/luigi/workspace/chrapa-poll/tests/js/logic.test.mjs`.

**Tests:** `node --test tests/js/`: 100 pass, 0 fail. `uv run pytest -q`: 379 passed. Headless Chrome 155 via CDP against my own uvicorn on 127.0.0.1:18720 (temp data dir, test secrets; a second one on 18730 for the listener comparison). All checks of round 1 still pass (76 on the final run, desktop 1280x900 and mobile 380x800), plus the new ones above and an asymmetric horizontal and vertical pinch, a finger lifted mid pinch, and one-finger scrolling of the page at 1x. My servers and Chrome are killed; the servers on 8010 and 8000 were not touched. Driver scripts are in `/tmp/t010`, not in the repo.

## Review round 1
(reviewer appends)

Ran myself: `node --test tests/js/` 99 pass, 0 fail; `uv run pytest -q` 379 passed. No `innerHTML` added, no CSS transform. Only the svg `viewBox` changes and `crispEdges` is kept. The zoom math is correct: zoom around a point, 1x to 4x clamp, aspect kept, pan clamp, and a pinch anchored to the midpoint. The Node tests cover all of these well. Window listeners are cleaned up through `app.zoomCleanup` when the layout is redrawn. The svg, its listeners and the button are created again with the svg, so nothing leaks. Taps work as before: `blockClick` is set only on a moved `pointerup`, and the next `pointerdown` resets it. The click guard runs in the capture phase on the svg, so it covers beds, signposts and the letter icon. The code screen and panels are outside the svg and are not affected.

**Blocker**

1. `static/index.html` `setupZoom` → `gesturechange` / `zoomAround`, and `clampView` in the logic script: non-finite coordinates corrupt the view.
   - **What is wrong:** `gesturechange` zooms around `e.clientX, e.clientY` whenever no pointer is tracked. This is exactly the iOS fallback case: when the browser takes over the gesture, `pointercancel` empties `pointers`, and the gesture events keep coming. Apple documents iOS `GestureEvent` only with `scale`, `rotation` and the modifier keys. There, `clientX` is likely `undefined`. I verified the effect in Node: `zoomView(whole, 380, 412, 1.2, NaN, NaN)` gives `{x: NaN, y: NaN, w: 316.7, …}` and `viewBoxText` gives `"NaN NaN 316.667 343.333"`.
   - **Failure scenario:** An iPhone user pinches the map at 1x. The first finger drifts, the page scroll claims the gesture and the pointers are cancelled. `gesturechange` then writes an invalid `viewBox`. The svg loses its scaling and intrinsic ratio, so the map renders unscaled or collapses. Every later pan or pinch stays NaN. Only „Celá mapa“ (or a reload) recovers it.
   - **Expected fix:**
     - In `zoomAround` (or the `gesturechange` handler), fall back to the svg's center when `clientX`/`clientY` are not finite.
     - Make `clampView` (and therefore `zoomView`, `panView`, `pinchView`) robust: if any input is not finite, return the whole view or the unchanged input.
     - Add a Node test with NaN/undefined coordinates.
2. `static/index.html` CSS `#scene svg { touch-action: pan-x pan-y }`: a pinch at 1x is likely to be cancelled into a page scroll (the developer's stated risk). This criterion is not met reliably: "Two-finger pinch … zooms … The browser's own page zoom does not fight it".
   - **What is wrong:** `pan-x pan-y` lets the browser claim any two-finger movement whose centroid passes the touch slop. A normal asymmetric pinch (thumb still, index finger moving) moves the centroid by half the finger travel. Chrome then starts a scroll and fires `pointercancel` for both pointers, and iOS Safari behaves the same once its scroll view starts panning. The pinch stops after a few pixels, or the page scrolls instead.
   - **Why the headless check missed it:** the headless check used synthetic, symmetric `Input.dispatchTouchEvent` pinches, which do not show this.
   - **Expected fix (pick one):**
     - (a) Preferred, keeps one-finger page scroll over the map: keep `pan-x pan-y` and add a non-passive `touchstart` + `touchmove` listener on the svg (`{passive: false}`) that calls `preventDefault()` when `e.touches.length >= 2`. Both iOS Safari and Chrome honour this before they claim the gesture, so pointer events keep flowing and the page neither scrolls nor zooms. Keep the existing `gesturestart` `preventDefault` for iOS page zoom.
     - (b) Simplest: `touch-action: none` on the svg at every zoom level. The cost is that a one-finger drag on the map at 1x no longer scrolls the page. That is acceptable in portrait (the map nearly fits the screen) but worse in landscape.
   - **Either way:** update the page check in `tests/js/logic.test.mjs` and keep the manual item for iPhone, Android and WhatsApp, because only a real device can confirm it.

**Suggestion**

- Keys `+`/`-` with a bed focused zoom around the view center, so the focused bed can end up outside the view. This goes against the criterion's "if a focused bed is outside the view, pan so it is visible". Fix: after a key zoom, if `document.activeElement` is a bed or button inside the svg, run `revealRect` on its bbox (or zoom around its center).
- `watchLongPress`: the timer only checks `app.pinching`. With a quick pinch (under 500 ms) whose second finger landed on a bed, `pointerup` goes to the svg (pointer capture), not to the bed. The bed's `cancel` then depends on the browser firing `pointerleave` when capture moves, which Chrome does and Safari is not guaranteed to do. The timer then fires with `pinching` already false. It shows a tip and sets `suppressClick`, which swallows the next real tap. To make this robust, cancel the timer when a gesture becomes `moved` or two fingers land, for example with an `app.gestureId` counter or flag that the timer checks.
- „Celá mapa“: the `aria-label` „Zobraziť celú mapu“ does not contain the visible text „Celá mapa“ (WCAG 2.5.3 label in name), so a voice-control user saying „Celá mapa“ may not hit it. Use e.g. „Celá mapa – zobraziť celú mapu“, or let the visible text be the name.

**Nit**

- After „Celá mapa“, focus goes to the svg, which has `outline: none`, so a keyboard user sees no focus. A subtle `:focus-visible` outline on the svg would help.
- A two-finger trackpad scroll without ctrl zooms instead of panning. This matches the criterion ("mouse wheel zooms"), so it is mentioned only for the organizer.

Verdict: CHANGES REQUESTED

## Review round 2
(reviewer appends)

Ran myself: `node --test tests/js/` 100 pass, 0 fail; `uv run pytest -q` 379 passed. `git diff` touches only the three files in scope. No `innerHTML` in the page, no CSS transform, `crispEdges` kept.

**Round-1 blockers**

1. Non-finite gesture coordinates: **fixed.** `zoomAround` falls back to the svg center when `clientX`/`clientY` are not finite. In the logic script, `clampView` returns the whole view for a missing, non-finite or non-positive view. `zoomView` ignores a bad factor and uses the view center for a bad point. `panView`, `pinchView` and `revealRect` ignore non-finite input. The new Node test drives NaN, undefined, Infinity and a string through every function and checks that `viewBoxText` never prints NaN. `gesturechange` also skips `!(e.scale > 0)`. No path is left that writes a NaN `viewBox`.
2. Uneven pinch at 1x: **fixed as proposed (option a).** `pan-x pan-y` stays at 1x and `none` applies while zoomed. `holdTwoFingers` runs on the svg for `touchstart` and `touchmove` (`passive: false`) and calls `preventDefault()` only when `touches.length >= 2 && e.cancelable`. The page test asserts both listeners and the condition. Only a real device can confirm the effect, and the manual item (iPhone, Android, WhatsApp) covers it.

**Side effects of the new non-passive listener (checked)**
- With one finger it does nothing, so one-finger page scroll at 1x and taps on beds and signposts are unchanged. The `e.cancelable` guard avoids the "ignored attempt to cancel" intervention once a scroll has already started.
- It is bound to the svg only. Panels, the bed sheet and the code screen are outside the svg (the svg's host `#scene` holds only the svg and the button), so page pinch-zoom there still works, as listed in the new manual item.
- Pointer events fire before touch events and do not depend on them, so cancelling the two-finger `touchstart`/`touchmove` does not stop the pointer-based pinch. Two fingers never count as a tap anyway (`drag.moved = true`).
- Performance cost: the handler is a single comparison, but a non-passive listener makes the browser wait for the main thread before scrolling over the map. Acceptable for this page.

**Round-1 suggestions and nits**
- Key zoom with a focused bed: done. `revealFocused()` runs after `+`/`-`/`0` and skips the svg itself.
- Long press after a pinch or drag: done. The bed's `pointerdown` runs before the svg's, so for a second finger landing on a bed the timer does start. The svg handler then bumps `app.gestureId` right away, and the timer checks that id, so no late tip appears. The `gestureAt` window covers presses that start just after a gesture ends.
- Label in name: done („Celá mapa – zobraziť celú mapu“). Focus-visible outline on the svg: done.
- Regressions: tap without movement, move mode (the `click` handlers are untouched, and only a moved `pointerup` sets `blockClick`, which resets on the next `pointerdown`), the bed sheet and panels, and the code screen. I found no regressions. Window listeners are still cleaned up on layout redraw.

**Blocker**
None.

**Suggestion**
- `watchLongPress`: `gestureAt` is also set when a one-finger drag passes the tolerance. So a long press that starts within 500 ms after a pan shows no tip, and the user just has to press again. This is harmless, but a short comment would help (the window is meant for pinch and Safari gestures).

**Nit**
- `gesturechange` calls `endPress()` on every event during an iOS pinch, which bumps `gestureId` many times. This is harmless.

Round 2 passed: every round-1 blocker is fixed and the changed code has no new blockers.

Verdict: APPROVED

## Test report

**Result: PASS (all 12 acceptance criteria, no regressions).** Tester: independent run, 2026-10-22.

**Commands and results**
- `node --test tests/js/`: 100 tests, 100 pass, 0 fail.
- `uv run pytest -q`: 379 passed (tasks in `done/` unaffected, no Python files changed).
- Browser: headless Chrome 155 via CDP (`/tmp/t010-tester`, own driver scripts, not the developer's), against my own uvicorn on 127.0.0.1:18810 (`create_app(data_dir="/tmp/t010-tester/data", env=test secrets)`, fresh data dir per run), Chrome debug port 18811. Desktop 1280x900 with real mouse/wheel/key input events, mobile 380x360 (touch emulation, `Input.dispatchTouchEvent`), each also with `prefers-reduced-motion: reduce`. About 150 checks; all pass except two known test-script artefacts (listed below). Processes killed; ports 8000 and 8010 not touched.

**Acceptance criteria**

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Zoom through `viewBox`, `crispEdges` kept, no CSS transform | PASS | viewBox changes (e.g. `214.3 180.7 95 103`), `shape-rendering="crispEdges"` present, computed `transform` is `none` on svg, `#scene`, body, html; screenshot at 4x crisp |
| 2 | Wheel zooms around cursor; ctrl+wheel the same; page not scrolled/zoomed | PASS | bed under cursor stays within 1 px; ctrl+wheel zooms and un-zooms; `scrollY` stays 0; a cancelable synthetic wheel event is `defaultPrevented` |
| 3 | Two-finger pinch around midpoint, pans with fingers, no page zoom | PASS | symmetric pinch out/in, scene point under the midpoint stays within 1.5 units, `visualViewport.scale` stays 1, no sheet or tip, page does not scroll; asymmetric pinches (one finger still, horizontal, vertical, diagonal) zoom with `scrollY` 0; two-finger move pans; lifting one finger mid pinch leaves a valid view; svg `touch-action` is `pan-x pan-y` at 1x and `none` zoomed |
| 4 | Zoomed drag pans; drag beyond ~10 px is never a tap/long press; tap unchanged | PASS | mouse and touch: tap on bed zoomed opens sheet; 4 px (mouse) and 5 px (touch) jitter still a tap; fast and slow (>500 ms) drags pan and open nothing, no tip; a drag starting on a night signpost does not switch the night; a tap right after a drag opens the sheet; a still long press shows the names tip and no sheet |
| 5 | Clamp 1x..~4x, pan clamped | PASS | max width 95 (4.0x), wheel out returns exactly to `0 0 380 412`; huge drags end exactly at top-left (0,0) and bottom-right (x+w=380, y+h=412) |
| 6 | „Celá mapa“ control | PASS | hidden at 1x, shown zoomed, >= 44x44 px, inside the viewport at 380 px, text „Celá mapa“, aria-label „Celá mapa – zobraziť celú mapu“; click resets and puts focus on the svg |
| 7 | Keyboard `+`/`-`/`0`, focused bed reachable | PASS | `+`, `=`, `-`, `_` zoom around the center, `0` resets (also with a bed focused), ctrl+0 ignored; Tab through all elements at 4x keeps each bed in view (beds wider than the view, e.g. the 124-unit mats bed, show their top-left corner); `+` x6 on each of the 12 focused beds keeps it in view; Enter on a focused bed opens the sheet zoomed, Escape closes it |
| 8 | Zoom survives refreshes, writes, night switches | PASS | survives the real 30 s poll (fetch observed), a tab-return poll with changed server data, a night switch by mouse and by touch, a completed move write |
| 9 | Hit areas, sheet, move mode, panels, code screen, hidden summary at any zoom | PASS | move mode: Presunúť while zoomed, a drag in move mode pans and does not move the party, a tap on the target bed completes the move (server state checked: slot moved); „Kto si?“, letter, notice open and the zoom is unchanged after closing; sheet is fixed full-width, unaffected; code screen shows without cookie, scene appears after code at 1x; hidden summary present |
| 10 | Reduced motion: no animated zoom | PASS | emulated `reduce`: `* {transition:none; animation:none}` applies, transition durations 0s, free-bed blink off, viewBox final in the same frame; no `animate` on the viewBox; no zoom transition exists in normal mode either |
| 11 | Pure zoom math with Node tests; both suites pass | PASS | 100 Node tests, 379 pytest. Synthetic Safari `gesturestart/change/end` without coordinates zooms around the center with a valid viewBox, NaN/undefined scale is ignored |
| 12 | `tests/manualne.md` items | PASS | the old „pinch-zoom works“ item is replaced by five zoom items (touch incl. WhatsApp, wheel/trackpad/keys, small bed while zoomed, „Celá mapa“, page pinch elsewhere). I added one more item (see below) |

**Extra scenarios tried**
- One-finger swipe at 1x scrolls the page (scrollY > 20) and neither zooms nor opens a sheet; after „Celá mapa“ scrolling works again. A drag while zoomed does not scroll the page.
- Tap on a bed at 1x opens the sheet (regression).
- Zoom state after a fresh load is whole; zoom is not persisted (as specified).

**Test-script artefacts (not product bugs)**
- One run flagged "pan clamped at bottom-right" because my drag was too short. A longer drag in the second script passes, and it ends exactly at the corner.
- My "no transition on transform" CSS regex matches the bottom sheet's slide-in (`transform .2s`, line 88), which is not the map. It is disabled by the reduced-motion rule.

**Observation (minor, not a failure, no action required for done)**
- When two fingers move together at a zoom limit (4x, or 1x), the first finger's pointermove arrives before the second's, so the measured finger distance changes briefly. The zoom-in half of that jitter is clamped away and the zoom-out half is not, so the zoom steps by roughly (move per frame)/(finger distance) once at the start. Example: 4x view `95 x 103` becomes `104.6 x 113.4` after a two-finger pan of 8 px per frame with fingers 80 px apart. After that the pan is free. Reproduce: zoom to 4x, touchStart two points 80 px apart, move both by +8 px per step. Possible fix for the developer later: accumulate the unclamped scale per gesture, or apply the pinch only when both pointers have moved in the frame. Added a manual item to check how this feels on a real device.

**Still needs a human or a real device** (all in `tests/manualne.md` section 6): iPhone Safari and the WhatsApp in-app browser (does `touchstart` `preventDefault` keep an uneven pinch from becoming a page scroll; headless Chrome cannot reproduce that), Android Chrome, Safari desktop `gesture*` events with a real trackpad, the feel of tapping small beds while zoomed.
