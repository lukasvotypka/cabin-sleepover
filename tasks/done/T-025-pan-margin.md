# T-025: Let the map be dragged a bit past its edges (pan margin)

- **Phase:** 1 (organizer request, 23. 10. 2026)
- **Depends on:** T-010, T-011, T-019 (all in `done/`). Build order: T-024 (in `testing/`) changes the same files (`static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md`). Do not start T-025 until T-024 has left `testing/` and is committed, and never run the two in parallel. The code areas do not overlap.
- **Size:** M (small code change, but several existing zoom tests encode the old hard edge and must be updated on purpose)

## Goal
Today the pan stops hard at the edge of the fitted bounds (the viewport in scene units, T-011). At 1x and below, the map cannot be dragged at all (T-019: always centered). The organizer wants to move around the map a little beyond the cabin, the way a game map has some ground around it. The pan range gets a margin (offset) of grass beyond the bounds at every zoom level, so an edge bed can be pulled towards the middle of the screen and the map can be nudged at 1x. The default view, the splash and the zoom range stay as they are.

Organizer's words: „Sprav aby sa dalo po mape pohybovať aj trochu mimo domov – aby bol grid s offsetom.“

## Current behaviour (read before changing)
- `<script id="logic">`: `ZOOM_MAX = 4`, `ZOOM_MIN = 0.6`, `ZOOM_KEY_STEP = 1.25`. `fitBounds` gives the bounds and `wholeView(bounds)` is 1x. `clampWidth` is the only place the zoom range is computed.
- `clampView(view, bounds)`: zoomed in, `x ∈ [bounds.x, bounds.x + bounds.w − w]` (same for y). At 1x and below, the view is centered (T-019). `zoomView`, `panView`, `dragView`, `pinchView`, `revealRect` and `refitView` all end in `clampView`.
- `groundRect(bounds)`: the patterned grass covers the centered 0.6x view plus 2 units on each side.
- `<script id="app">`, `setupZoom`: `pointermove` pans only `if (isZoomed(...))`. `applyView` shows „Celá mapa“ only when `isZoomed`. `focusin` reveals a Tab-focused bed only when `isZoomed`. `revealFocused` runs after `+`, `-` and `0`. The CSS comment above `#scene svg` says one finger "does nothing at 1x".

## Decided values (product-owner defaults, the organizer may change them after trying it)
1. **Margin `PAN_MARGIN = 0.25`, a fraction of the current view's own width and height.** It is a named constant next to `ZOOM_MIN` with the comment `// the view may pan this fraction of its own size past the bounds`. Because it scales with the view, it is the same distance on screen at every zoom: you can drag at most a quarter of the screen width (and a quarter of its height) of extra grass past the bounds edge. On a 390 px phone that is about 97 px. A fixed number of scene units was not chosen, because 40 units would be almost nothing at 0.6x (40 of 633) and almost half the screen at 4x (40 of 95).
2. **No `config/chata.yaml` key.** The margin is a property of the viewer, not of the cabin layout, so it is not data. No model or server change.
3. **The margin applies at every zoom level, 0.6x to 4x.** The pan range is a band around the centered position:
   `slack = max(0, (bounds.w − w) / 2) + PAN_MARGIN · w`, `x ∈ [cx − w/2 − slack, cx − w/2 + slack]`, where `cx` is the bounds center, and the same for y with `h` and `bounds.h`.
   Zoomed in this equals `[bounds.x − PAN_MARGIN·w, bounds.x + bounds.w − w + PAN_MARGIN·w]`. At 1x it is the centered position `± PAN_MARGIN·w`, and below 1x the centered position `± PAN_MARGIN·w`. The range is continuous at 1x, so there is no jump when you cross it. This replaces T-019's "below 1x always centered".
4. **One-finger and mouse drag pans at every zoom level**, also at 1x and 0.6x. The existing tap tolerance (`LONG_PRESS_SLOP`, about 10 px) still decides between a tap and a drag, so a tap on a bed still opens the sheet and a drag never does.
5. **„Celá mapa“** shows when the map is not at its home position: zoomed in (as today), or panned away from the center at any zoom (more than 0.5 scene units on either axis). It stays hidden at 1x centered and at any centered view below 1x (T-019 kept). Its click still gives exactly `wholeView(bounds)` (1x, centered). Its label and look do not change.
6. **No spring-back and no inertia.** The map stays where you let go. No animated pan, so `prefers-reduced-motion` is unaffected.
7. **Keyboard:** `+` / `-` still zoom around the view center (with the new clamp), and `0` still resets to the home view. **No arrow-key panning** is added (arrows are not used for the map today, and a new key binding is out of scope). Tab reveal keeps working (see criteria).
8. **Resize, rotation, move bar:** `refitView` keeps today's rules. A view at exactly 1x becomes the whole new bounds, so a view panned at 1x re-centers on a rotation or when „Presunúť“ shows or hides its bar. A zoomed-in or zoomed-out view keeps its factor and its center as far as the new clamp allows. This is accepted and noted in the manual checklist.

## Scope
- `static/index.html`:
  - `<script id="logic">`: new constant `PAN_MARGIN`. New pure functions `panRange(w, bounds)` and `isOffCenter(view, bounds)` and `resetShown(view, bounds)` (below). `clampView` takes its x/y limits from `panRange` only. `groundRect` covers the farthest reach. `zoomView`, `panView`, `dragView`, `pinchView`, `revealRect` and `refitView` keep their code and pick the margin up through `clampView`. Update the comments that say "stays inside the bounds" or "centered below 1x".
  - `<script id="app">`, `setupZoom` and `applyView`: drop the `isZoomed` gate on the drag in `pointermove`. `applyView` sets `app.zoomReset.hidden = !resetShown(app.view, app.bounds)`. In `focusin` replace `!isZoomed(...)` with `!resetShown(...)`, and give `revealFocused` the same guard, so a home view never shifts on focus (see criteria). Update the CSS comment above `#scene svg` (one finger pans at every zoom).
- `tests/js/logic.test.mjs`: new tests, plus the existing zoom/fit assertions that encode the old hard edge, updated on purpose (listed below).
- `tests/manualne.md`: section 6 zoom items.

Out of scope: `config/chata.yaml`, `proposal.md`, the server, `ZOOM_MIN`, `ZOOM_MAX`, `ZOOM_KEY_STEP`, `fitBounds`, `wholeView`, `isZoomed` (keeps meaning "zoomed in"), the initial view, the splash (T-022), bed and signpost hit areas, figure positions, the meadow (T-016) and walk (T-017) layers, arrow-key panning, inertia, spring-back, the „Celá mapa“ text.

## Pure functions (in `<script id="logic">`, no DOM, no `app`)
```js
// The allowed range of a view's x and y for a view of width w (height w * bounds.h / bounds.w):
// [xMin, xMax, yMin, yMax]. The band around the centered position is max(0, (bounds size − view size) / 2)
// plus PAN_MARGIN of the view size on each side. The only place the pan range is computed.
function panRange(w, bounds)

// The view's center is more than 0.5 scene units away from the bounds' center on x or y.
function isOffCenter(view, bounds)

// „Celá mapa“ has something to do: the view is zoomed in or panned off center.
function resetShown(view, bounds)
```
`clampView` keeps its signature and its bad-input fallback (`wholeView(bounds)`). It computes `w` with `clampWidth`, `h` from the aspect ratio, and then clamps `view.x` and `view.y` into `panRange(w, bounds)`. There are no separate branches for zoomed in and zoomed out.

## Acceptance criteria
- [x] `PAN_MARGIN = 0.25` is a named constant in the logic script, exported to the Node tests like `ZOOM_MIN`. `panRange` is the only place the pan limits are computed: `clampView` uses it, and no other `bounds.x + bounds.w − w`-style pan limit remains in the logic script.
- [x] Zoom range unchanged: wheel, trackpad pinch, touch pinch, Safari `gesturechange` and `-` stop at exactly 0.6x, and zooming in stops at 4x. The margin never changes `view.w`.
- [x] The view can be panned past the bounds edge by exactly `PAN_MARGIN · view.w` horizontally and `PAN_MARGIN · view.h` vertically at every zoom (4x, 2x, 1x, 0.6x), and no further. At 1x and below the view can leave the centered position by the same amount.
- [x] The map is never lost: on each axis, the overlap of the view and the bounds is at least `(1 − PAN_MARGIN) · min(view size, bounds size)` at every allowed zoom and position.
- [x] Drag: a one-finger or mouse drag beyond the tap tolerance pans at every zoom level, including 1x and 0.6x, and never counts as a tap or long press. A tap without movement still opens the bed sheet, a long press still shows the names, and the click right after a drag is still swallowed (`blockClick`).
- [x] Pinch: two fingers zoom and pan at once at every zoom level. The scene point under the fingers stays under them until the pan range runs out, now also at 1x and below 1x.
- [x] Wheel, trackpad pinch and Safari gesture zoom around the pointer as before. Near the edge the point under the pointer stays fixed for longer, because the clamp now allows the margin.
- [x] Keyboard: `+` and `-` zoom around the view center with the new clamp. `0` returns to exactly `wholeView(bounds)` from any zoom and any pan. A bed reached with Tab is revealed (`revealRect`, margin 6) when the view is zoomed in or off center. At the home view (1x centered, or any centered view below 1x) focus never shifts the map, even for a bed at the scene edge, because everything is visible there.
- [x] „Celá mapa“: hidden at 1x centered and at a centered view below 1x. Shown when zoomed in, and when panned off center at 1x or below. A click returns to exactly `wholeView(bounds)` and the button hides.
- [x] Default view and splash unchanged: a fresh load, the code screen → map, and the end of the splash (T-022) all show exactly `wholeView(bounds)`, with no off-center start and no „Celá mapa“.
- [x] `refitView`: a view at exactly 1x (centered or panned) becomes `wholeView(newBounds)`. A zoomed-in or zoomed-out view keeps its zoom factor and its center as far as `panRange` on the new bounds allows. A bad view still falls back to the whole new bounds.
- [x] Ground: `groundRect(bounds)` covers the farthest the view can reach, which is the 0.6x view shifted by its full pan range, plus 2 units on each side, centered on the bounds. With the real fixtures (tall phone, landscape phone, desktop) the whole screen is patterned grass at every corner of the pan range at 0.6x, 1x and 4x, with no plain band and no seam.
- [x] Zoom state still survives polling, writes and night switches (the view, including its pan offset, is kept through a redraw).
- [x] No geometry change: the existing bed hit-area, signpost hit-area and figure-position tests pass with their exact values. `crispEdges` stays, only the `viewBox` changes, there is no CSS transform and no animation.
- [x] Node tests (new), on `SB = {x: 0, y: 0, w: 380, h: 412}` and the existing `BOX` (380 px wide, one px per unit):
  - `PAN_MARGIN === 0.25`.
  - `panRange` reference values: 4x (`w 95`) → `[-23.75, 308.75, -25.75, 334.75]`; 2x (`w 190`) → `[-47.5, 237.5, -51.5, 257.5]`; 1x (`w 380`) → `[-95, 95, -103, 103]`; 0.6x (`w 380/0.6`) → `[-285, 31.667, -309, 34.333]` (to 3 decimals).
  - Continuity at 1x: `panRange(380 − 1e-6, SB)` and `panRange(380 + 1e-6, SB)` differ from `panRange(380, SB)` by less than 1e-3.
  - `panView` of the 2x view `{x: 95, y: 103, w: 190, h: 206}` by `(999, 999)` gives `{x: 237.5, y: 257.5, w: 190, h: 206}`, and by `(-999, -999)` gives `{x: -47.5, y: -51.5, w: 190, h: 206}`.
  - `dragView(wholeView(SB), SB, BOX, 80, 80)` gives `{x: -80, y: -80, w: 380, h: 412}`. With `(5000, 5000)` it gives `{x: -95, y: -103, w: 380, h: 412}`.
  - At 0.6x, `panView` by `(999, 999)` gives `x 31.667, y 34.333`, and by `(-999, -999)` gives `x -285, y -309`. The width stays `380 / 0.6`.
  - The overlap invariant above, checked over a grid of zooms (0.6, 0.8, 1, 1.5, 2, 4) and the four pan corners, on `SB` and on the tall-phone, landscape and desktop `fitBounds` fixtures.
  - `isOffCenter` and `resetShown`: whole view → both false. A centered 0.6x view → both false. Whole view panned by 1 unit → both true. Panned by 0.4 units → false. A centered 2x view → `isOffCenter` false, `resetShown` true.
  - `groundRect(SB)` → `[-287, -311, 954, 1034]`. For each `fitBounds` fixture, the rect contains the 0.6x view at all four pan corners plus 2 units.
  - A source guard: in `<script id="app">` the `pointermove` drag calls `dragView` without an `isZoomed` gate, and `applyView` uses `resetShown`.
  - The existing non-finite input tests still pass, and bad input never gives a view wider than `bounds.w / ZOOM_MIN` or outside `panRange`.
- [x] Existing tests updated on purpose, and only the assertions that encode the old hard edge or "centered below 1x". Name each one in the Dev log with its old and new value. The expected ones are in these tests: `zoom: clampView keeps the aspect ratio, 0.6x to 4x, and stays inside the scene` (`tooFar`, `tooWide`, `right`); `zoom: zoomView is clamped at 0.6x and at about 4x` (the zoomed-out end is no longer centered after zooming at a corner); `zoom: panView and dragView move the window and never leave the scene` (the `±999` values, "at 1x there is nowhere to go", "below 1x the view stays centered"); the `pinchView` "past the limit stops at 0.6x, centered" line; `zoom: revealRect pans the least that shows the rectangle` ("never leaves the scene" → may go up to the margin); the `fit:` extended-bounds test ("panning stops at the bounds", "nowhere to go at 1x", the 0.6x centered check, "revealRect keeps a bed inside the bounds"); the two `fit: a resize keeps …` tests (the zoomed-out view zoomed at a corner is no longer centered, so check its factor and that it lies in `panRange` of the new bounds); `fit: groundRect covers …` (new exact values). Assertions on zoom factor, width, aspect ratio and the 1x-stays-whole refit stay as they are.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md` section 6:
  - New item **Pan past the edges (T-025):** on iPhone Safari, Android Chrome (also in the WhatsApp in-app browser) and desktop (mouse drag), at 1x, 0.6x and 4x, drag the map as far as it goes in each direction. It stops when about a quarter of the screen is grass past the map's edge, never further, and never snaps back. At 4x an edge bed (e.g. in „Konica, podkrovie“) and a corner bed can be dragged towards the middle of the screen and tapped there. A short tap still opens the sheet, and a drag does not. „Celá mapa“ appears as soon as the map is off center and brings back the whole, centered map. The grass has tufts everywhere, with no plain band. At 1x after panning, rotate the phone or start „Presunúť“: the map re-centers (accepted).
  - Reword the T-019 item: below 1x the map can be dragged a little (a quarter of the screen) and is centered again with „Celá mapa“ or `0`. It no longer says "cannot be dragged away".
  - Reword the touch pinch/pan item: one finger drags the map at every zoom, not only when zoomed in.
  - Reword the „Celá mapa“ item: it appears when zoomed in or when the map is panned off center.

## Notes for developer
- Keep `isZoomed` meaning "zoomed in". It is still used by `refitView` (via `isZoomedOut` too), and changing it would move the default view.
- `fitBounds` and the bounds stay the 1x reference. Do not fold the margin into the bounds, or the initial view, `wholeView` and the splash end would change.
- `revealRect` needs no code change. With the margin it can now pan an edge bed a few units past the scene edge to give it its 6-unit margin. That is why the app must not call it on the home view (`!resetShown`), or Tab or `0` at 1x would nudge the map off center and show „Celá mapa“.
- After `0`, `revealFocused` runs today. With the guard it does nothing, because the view is home. That is intended: `0` must give exactly the whole view.
- `zoomView` with a bad point already uses the view center, so `+`/`-` behave as before.
- The meadow (T-016), the walk (T-017) and the splash (T-022) use scene coordinates and not the view, so they need no change. Check this by reading the code, not by editing it.
- If on a real phone the 0.25 margin feels too large or too small, do not tune it. Note it in the Dev log for the organizer.

---
## Dev log
Done as specified, with the decided values (`PAN_MARGIN = 0.25`, no YAML key, margin at every zoom).

**Code (`static/index.html`)**
- Logic script: new `PAN_MARGIN` (next to `ZOOM_MIN`), new pure `panRange(w, bounds)`, `isOffCenter(view, bounds)` and `resetShown(view, bounds)`. `clampView` now clamps x/y into `panRange` only (no zoomed-in/zoomed-out branches). `groundRect` is built from `panRange` at 0.6x (farthest reach plus 2 units). `refitView`, `zoomView`, `panView`, `dragView`, `pinchView`, `revealRect` are unchanged and pick the margin up through `clampView`. Comments updated.
- App script: `pointermove` calls `dragView` without the `isZoomed` gate; `applyView` uses `resetShown`; `focusin` uses `!resetShown`; `revealFocused` returns early when `!resetShown` (so `0` gives exactly `wholeView`, and a home view never shifts on focus). CSS comment above `#scene svg` updated, and one stale comment ("One finger at 1x still scrolls the page") removed.
- Meadow, walk and splash use scene coordinates (checked by reading, no `app.view` use there); not touched.

**Tests (`tests/js/logic.test.mjs`)**, new: `PAN_MARGIN`/`panRange` reference values, continuity at 1x and a source guard for a second pan-limit expression; map-never-lost overlap grid (0.6, 0.8, 1, 1.5, 2, 4 on SB and tall/landscape/desktop fixtures, four pan corners); `isOffCenter`/`resetShown`; source guard for the ungated drag, `resetShown` in `applyView` and the `focusin`/`revealFocused` guards; 1x-panned view refits to whole; pinch at 1x and 0.6x pans.
Existing tests changed on purpose (old -> new):
- `clampView ...` (renamed "...pan range"): `tooFar.x` 0 -> -23.75, `tooFar.y` 309 -> 334.75; `tooWide` x/y centered (-126.667/-137.333) -> kept 30/30 (inside range); `right.x` 190 -> 237.5.
- `zoomView is clamped...`: the 0.6x view zoomed at a corner is no longer centered; now checks the factor, width and that it lies in `panRange`.
- `panView and dragView ...` (renamed): `±999` on the 2x view `{190,206}` -> `{237.5,257.5}`, `{0,0}` -> `{-47.5,-51.5}`; 1x drag by 80 `{0,0}` -> `{-80,-80}` (and 5000 -> `{-95,-103}`); below 1x "stays centered" -> pans to `31.667/34.333` and `-285/-309`, width unchanged.
- `revealRect ...`: edge bed `x 285 -> 291`, `y 309 -> 313` (now margin 6 past the rect, inside the pan range).
- `fit: zoom 1x is the whole extended bounds ...`: pan stops at `B.x - 0.25*w` / `B.x + B.w + 0.25*w` (was at the bounds); 0.6x check is "inside `panRange`" (was centered); pinch+drag corner at `B.x - 0.25*w`; 1x drag moves by the drag (was still); `revealRect` check against the pan range.
- Two `fit: a resize keeps ...` tests: zoomed-in and zoomed-out views keep their factor and lie in `panRange` of the new bounds (zoomed-out no longer centered).
- `fit: groundRect ...`: `groundRect(SB)` `[-128.667, -139.333, 637.333, 690.667]` -> `[-287, -311, 954, 1034]`; fixtures now check all four pan corners at 0.6x.
- The pinch "past the limit stops at 0.6x, centered" line still passes unchanged (the pinch midpoint is the view center there), so I left it.

**Commands and results**
- `node --test tests/js/` -> 192 pass, 0 fail.
- `uv run pytest -q` -> 384 passed.

**Files:** `/Users/luigi/workspace/chrapa-poll/static/index.html`, `/Users/luigi/workspace/chrapa-poll/tests/js/logic.test.mjs`, `/Users/luigi/workspace/chrapa-poll/tests/manualne.md` (section 6: new "Pan past the edges (T-025)" item, and the T-019, touch pan and „Celá mapa“ items reworded).

**Notes:** Criteria are ticked on the basis of the Node tests and source guards; the on-screen feel (touch drag, tap vs drag, focus reveal, no plain band) is not tested in a browser and is in the manual checklist. The 0.25 margin was not tuned; if it feels wrong on a real phone, that is for the organizer to decide.


## Dev log, round 2 (fixes for review round 1)

- **Blocker (fixed).** `static/index.html` ~line 2457: put `function holdTwoFingers(e) {` back on its own line after the comment (the newline was lost when the stale comment was removed). Both inline scripts now parse.
- **Node test for syntax (added).** `tests/js/logic.test.mjs`: `page: every inline script parses (a syntax error would kill the whole page)` takes every inline `<script>` of `static/index.html` (without `src`), requires the `logic` and `app` ones to exist, and compiles each with `new vm.Script`. Checked that it works: with the lost newline put back temporarily it fails, with the fix it passes.
- **Suggestion (done).** New test `zoom: bad input never gives a view wider than the zoom range or outside panRange`: for NaN, undefined, +-Infinity, "x", null, -1, 0 and +-1e9 through `clampView`, `zoomView`, `panView`, `dragView`, `pinchView` and `revealRect`, the result is finite, `w <= bounds.w / ZOOM_MIN` and `x`/`y` lie in `panRange(w, bounds)`.
- **Nit (disagree, left as is).** The source guards match the existing guard style in this file; I keep them, they only fail when the drag gate or the `resetShown` calls are really changed.
- **Browser check.** Own server on port 8123 (temp data dir `/tmp/t025/data`, test codes), headless Google Chrome via Playwright (viewport 390x780, mouse): code screen visible -> entered the group code -> map (viewBox `0 -174 380 760`, „Celá mapa“ hidden) -> after dismissing the first panel backdrop, a 60x40 px drag moves the map at 1x (`-58.462 -212.974 380 760`) and „Celá mapa“ appears -> a huge drag stops exactly at the margin (`-95 -364`, which is `-0.25*380` and `-174 - 0.25*760`) -> clicking „Celá mapa“ restores `0 -174 380 760` and hides the button. No page errors. Console: one 401 from `/api/state` before login (expected) and a 404 for `/favicon.ico` (existing, not part of this task). Server stopped afterwards.
- **Commands.** `node --test tests/js/` -> 194 pass, 0 fail. `uv run pytest -q` -> 384 passed.
- **Files.** `/Users/luigi/workspace/chrapa-poll/static/index.html`, `/Users/luigi/workspace/chrapa-poll/tests/js/logic.test.mjs`.

## Review round 1
(reviewer appends)

Reviewer ran: `node --test tests/js/` → 192 pass, 0 fail. `uv run pytest -q` → 384 passed. Extracted both `<script>` blocks from `static/index.html` and ran `node --check` on each. The logic script parses. **The app script does not** (HEAD's app script parses fine).

The logic part is correct and matches the spec. `panRange` follows the formula and the reference values check out (4x/2x/1x/0.6x, continuous at 1x). `clampView` has no branches left and takes its limits only from `panRange`. `groundRect(SB)` = `[-287, -311, 954, 1034]`. `isOffCenter`/`resetShown` follow the 0.5-unit rule, and `isZoomed` keeps its meaning. `refitView` is unchanged, and the 1x-panned → whole test was added. The ungated `pointermove` drag keeps the `LONG_PRESS_SLOP` tap/drag split, `endPress` and `blockClick`. The `focusin`/`revealFocused` guards follow the notes, so `0` gives exactly `wholeView`. Meadow, walk and splash do not read `app.view`. The updated tests are the ones listed, each with its old value in a comment, and the manual checklist items are in place.

**Blocker**

1. `static/index.html:2457-2458`: a newline was lost when the stale comment was removed. The function declaration is now inside the `//` comment:
   ```
   // pinch (one finger still) as a scroll and cancel the pointers.    function holdTwoFingers(e) {
     if (e.touches.length >= 2 && e.cancelable) e.preventDefault();
   }
   ```
   The `if` line and the `}` are now loose code, and the `}` closes `setupZoom` early. `node --check` on the extracted app script fails with `SyntaxError: Unexpected token 'function'` (at `function drawGround`). The browser rejects the whole `<script id="app">`, so on a fresh load nothing runs: no code screen, no map, no polling, no writes. The page is dead on every device. The Node suite did not catch this because it only evaluates the logic script and regex-matches the app source.
   Expected fix:
   - Put `function holdTwoFingers(e) {` back on its own line after the comment.
   - Add a Node test that parses the app script, e.g. `new Function(appSource)` or `new vm.Script(appSource)` on the `<script id="app">` content, ideally for every inline script. This makes a broken app script fail `node --test tests/js/`. The criterion "`node --test tests/js/` passes" means little while the page can be unparseable.
   - Re-check the code screen → map → drag flow on a test port (not 8000/8010).

**Suggestion**

- Criterion "bad input never gives a view … outside `panRange`" is covered only indirectly, through the existing fallback-to-whole tests. A short assertion would make it explicit: for the existing non-finite inputs, `clampView` gives `w ≤ bounds.w / ZOOM_MIN` and `x`/`y` inside `panRange(w, bounds)`.

**Nit**

- The new test `zoom: the page drags at every zoom…` pins exact source strings such as `node === svg || !resetShown(...)`. This is consistent with the existing source guards, but it is brittle to harmless reformatting.

Verdict: CHANGES REQUESTED

## Review round 2
(reviewer appends)

Reviewer ran: `node --test tests/js/` → 194 pass, 0 fail. `uv run pytest -q` → 384 passed. Extracted every inline `<script>` from `static/index.html` and ran `node --check` on each. Both `logic` and `app` parse.

**Round-1 blocker: fixed.**
- `static/index.html:2457-2461`: `function holdTwoFingers(e) {` is back on its own line after the comment. The `touchstart`/`touchmove` listeners (2462-2463) reference it, and `setupZoom` closes where it should. The diff against HEAD in this area is now only the removed stale sentence.
- New test `page: every inline script parses …` (`tests/js/logic.test.mjs:1560`): it requires that both the `logic` and `app` scripts exist and compiles each with `vm.Script`. I checked that it works: I put the round-1 lost newline back in an in-memory copy of the page (the file was not touched), and the same check fails on `id="app"` with `Unexpected token 'function'`. The current page passes.

**Round-1 suggestion: done.** `zoom: bad input never gives a view wider than the zoom range or outside panRange` (`tests/js/logic.test.mjs:1535`) covers NaN, undefined, ±Infinity, a string, null, -1, 0 and ±1e9 through `clampView`, `zoomView`, `panView`, `dragView`, `pinchView` and `revealRect`. For each, it checks that the result is finite, `w ≤ bounds.w / ZOOM_MIN`, and that x/y lie in `panRange`. This covers the last bullet of the Node-test criterion directly.

**Fresh pass over the changed code.** No other changes to `static/index.html` since round 1. The logic (`panRange`, `isOffCenter`, `resetShown`, branch-free `clampView`, `groundRect`) and the app changes (ungated drag with the `LONG_PRESS_SLOP` split kept, `applyView`/`focusin`/`revealFocused` on `resetShown`) are as approved in round 1. The `manualne.md` section 6 items are in place. The Dev log reports a headless browser check on port 8123 (code screen → map → drag at 1x → stops at the margin → „Celá mapa“ restores the whole view). That matches the expected values (`-0.25·380 = -95`, `-174 - 0.25·760 = -364`).

**Blocker:** none.

**Suggestion:** none new.

**Nit**
- The round-1 nit about brittle exact-string source guards stays declined by the developer. That is acceptable, because it matches the file's existing guard style.

Round 2 passed, no blockers.

Verdict: APPROVED

## Test report
(tester appends)

**Tester, round 1 (23. 10. 2026). Verdict: PASS, all acceptance criteria met, no regressions. Moved to `done/`. Nothing committed.**

### Automated suite (run on the working tree, not committed)
- `uv run pytest -q` → 384 passed.
- `node --test tests/js/` → 194 pass, 0 fail.
- Pure-function reference values re-derived independently (own script, reads `<script id="logic">` via `vm`, no repo file written): `PAN_MARGIN` 0.25; `panRange` at 4x `[-23.75, 308.75, -25.75, 334.75]`, 2x `[-47.5, 237.5, -51.5, 257.5]`, 1x `[-95, 95, -103, 103]`, 0.6x `[-285, 31.667, -309, 34.333]`; `groundRect(SB)` `[-287, -311, 954, 1034]`; `dragView` by 80 → `-80,-80`, by 5000 → `-95,-103`; `isOffCenter`/`resetShown`: whole false/false, 1 unit true/true, 0.4 units false/false; `clampView(null)` and NaN x → whole view. All match the task.
- Source check: the only pan-limit expression in the logic script is in `panRange` (lines 982–984). `isZoomed` keeps its meaning.

### Browser checks (headless installed Google Chrome via playwright-core, scratch dir `/tmp/t025-tester`, outside the repo)
- Own server: `create_app(data_dir='/tmp/t025-tester/data')` on `127.0.0.1:8131` with test secrets (`GROUP_CODE=tgroup-123`, `ADMIN_CODE=tadmin-456`, a test `SECRET_KEY`). The real `data/` and `.env` were not touched. Port 8000 and 8010 were not used. Both servers are stopped.
- Viewports: phone 390x780 (mouse, and touch via CDP real touch events), desktop 1280x800 (mouse), landscape phone 780x390 (mouse). A HEAD copy (`git archive HEAD`) was served on 8132 once to compare the pinch drift.
- Scripts: `main.mjs` (35 checks), `main2.mjs` (41 checks, bed tap/drag mouse and touch, touch pinch, Tab, wheel, rotation, 34 s poll), `main3.mjs` (16 checks, desktop and landscape margins), `main4.mjs` (night switch, a write and a poll), `longpress.mjs`, `swallow.mjs`, `shots.mjs` (screenshots). Final runs: main.mjs 35/35 pass, main2.mjs 41/41 pass (two runs), main3.mjs 16/16 pass, main4.mjs all true, longpress.mjs and swallow.mjs as in the table below.
- Test-harness mistakes fixed during the run (not app bugs): a sheet left open covered the map, the bed moved after a drag so a stale position was used, a bed focused by mouse was revealed by `+` (expected design, `revealFocused`), a 30 px pinch and a clamped pinch drift (see observation O1), a drag started on the „Celá mapa“ button (a button, not the map), and the width check of a drifted 0.6x pinch used the 633 px pan range instead of its own width.

### Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `PAN_MARGIN = 0.25` named, exported; `panRange` is the only pan-limit computation | PASS | Node tests; grep; pure-function values above |
| 2 | Zoom range unchanged (0.6x to 4x), margin never changes `view.w` | PASS | Browser: `-` x6 → w 633.333; `+` x7 → w 95; wheel in/out → 95 and 633.333; touch pinch at 1x min w 112.6. Safari `gesturechange` not reachable in headless Chromium: manual item "Wheel and trackpad zoom" in `tests/manualne.md` |
| 3 | Pan past edge by exactly `0.25·w` / `0.25·h` at 4x, 2x, 1x, 0.6x; no further | PASS | Browser mouse, 390 px: 1x y → -364 / 16, x → -95 / 95; 0.6x y → -744 / -110.667, x → -285 / 31.667; 4x x → 308.75 / -23.75, y → -221.5 / 443.5. Touch 1x and 0.6x the same. Desktop 1280x800 and landscape 780x390 at 1x: stops at exactly the margins. 2x: Node (`panView` ±999) |
| 4 | Map never lost: overlap ≥ `(1−0.25)·min(view, bounds)` | PASS | Node grid (zooms 0.6, 0.8, 1, 1.5, 2, 4 × 4 corners × SB and fixtures); browser corners consistent |
| 5 | Drag pans at every zoom, never a tap; tap still opens, long press still shows names, click after drag swallowed | PASS | Mouse 1x and 0.6x: drag from a bed pans and opens nothing; 5 px wiggle still taps; drag that starts and ends on the bed opens nothing. Touch 1x: tap opens; 4 px wiggle taps; drag from bed pans, no sheet. Touch long press shows „Testovacia“ in the tip; drag then hold shows no tip |
| 6 | Pinch zooms and pans at every zoom, including 1x and below | PASS (with O1) | Touch pinch at 1x zooms in (380 → 112.6); touch pinch at 0.6x pans right and stays inside `panRange` of its width. 2x parallel pinch pans with the fingers (142.6 from 92.7). Zoom drift at the 0.6x limit: see O1 |
| 7 | Wheel, trackpad and Safari zoom around the pointer | PASS for wheel, manual for the rest | Wheel at corner (30,40): scene point 29.23,-135.03 stays fixed while zooming in; stops at 4x and 0.6x exactly. Trackpad pinch and Safari gesture events: manual |
| 8 | Keys: `+`/`-` around center, `0` exact whole view from any zoom and pan, Tab reveals off-center or zoomed beds, no shift at home | PASS | `+` from home → center 190,206 kept. `0` from 0.6x panned and from 4x panned → exact `0 -174 380 760`. Tab across beds at home: view unchanged. Tab to the kitchen bed at 4x (off screen) → revealed (center y 665 on 780). Tab after `0` at home: unchanged |
| 9 | „Celá mapa“: hidden at 1x centered and at a centered view below 1x; shown zoomed in or off center; click gives exact whole and hides | PASS | Hidden at fresh load, after `0`, and at centered 0.6x. Shown after pans at 1x, 0.6x, 4x, after wheel-out at a corner. Click → exact `0 -174 380 760`, button hidden |
| 10 | Default view and splash unchanged: fresh load, code screen → map, splash end all show exact whole, no „Celá mapa“ | PASS | Fresh load and join flow (including the 2.6 s splash wait) → exact whole view, button hidden |
| 11 | `refitView`: 1x view becomes whole new bounds; zoomed view keeps factor and center within `panRange` | PASS | Rotation 390x780 → 780x390 at 1x after a pan → re-centers exactly on new whole view `-222 0 824 412` (accepted, as specified). Zoomed resize: Node (factor and `panRange` checks) |
| 12 | Ground covers the 0.6x view at every pan corner, plus 2 units; no plain band | PASS (visual) | Node `groundRect` values and fixture checks. Screenshots: phone 0.6x bottom-right corner and 4x corner, desktop 1x right margin: grass with tufts everywhere, no band. Seam on real devices: manual item in `tests/manualne.md` section 6 |
| 13 | Zoom and pan survive polling, writes and night switches | PASS | 2x panned view unchanged after a 34 s wait; after a party write (fetch, HTTP 200) plus the poll, unchanged; tapping a night signpost (a tap, not a drag) leaves the view unchanged and selects the night |
| 14 | No geometry change: existing hit-area, signpost and figure tests pass exactly; `crispEdges`, no CSS transform, no animation | PASS | Node suite unchanged for those tests and green; `touch-action: none` still on the svg; diff only in the logic/app scripts and tests |
| 15 | New Node tests exist and cover the listed points | PASS | Names present: `PAN_MARGIN`/`panRange`, continuity at 1x, `panView`/`dragView` values, 0.6x, overlap grid, `isOffCenter`/`resetShown`, `groundRect`, source guards, bad input, inline-script parse. Values checked independently (above) |
| 16 | Existing tests changed on purpose, each old→new value named in Dev log | PASS (reviewed, not re-derived) | Suite green; the Dev log names each changed test. I did not recheck every old value, only that the changed assertions now match the spec numbers |
| 17 | `node --test tests/js/` and `uv run pytest -q` pass | PASS | 194 pass / 384 passed |
| 18 | `tests/manualne.md` section 6 updated (new pan item, T-019 reworded, touch pan and „Celá mapa“ reworded) | PASS | `git diff -- tests/manualne.md`: all four items present and worded as specified |

### Regressions
- `tasks/done/` (T-001 to T-024): the full pytest and Node suites are green (384 and 194). The T-022 splash, T-023 table and T-024 signposts were checked on the page: the splash ends at the whole view and the signposts and bed tap work.

### Extra scenarios tried
- Duplicate party name from a re-run: `POST /api/parties` returned 409 `duplicate_name` on the second run (expected, the earlier test party was still in the temp data).
- Assign to an occupied slot: 409 `slot_taken` (expected).
- Browser console: only the expected 401 (`/api/state` before login), 404 (`/favicon.ico`, pre-existing) and 409 (the duplicate seed). No page errors in any script.

### Observations (not failures of T-025)
- **O1, pinch zoom drift at the zoom limits (pre-existing, not a regression).** A two-finger pinch that only moves in parallel (150 px apart, both fingers 100 px left) changes the width at 0.6x from 633.33 to 591.11. The same happens on HEAD (`git archive HEAD` on port 8132, also 633.33 → 591.11). The cause is in `pinchView`: each pointer event uses the previous midpoint and distance, so the per-event ratios only cancel while the zoom is inside the range, and a clamp at 0.6x breaks the cancellation. It is already listed in `tests/manualne.md` (the "Two-finger pan feel at the zoom limits (T-010 tester note)" item). No change needed for T-025. Non-blocking.
- **O2, „Celá mapa“ sits over the bottom-right map corner** (105x44 px at 390 px portrait). A drag that starts on it does not pan the map, because it is a button. This is expected and the position is unchanged by T-025. Note for the organizer only.
- **O3, Tab and key zoom after a mouse focus.** A mouse press on a bed focuses it. A later `+` then reveals that bed (`revealFocused`) and so does not keep the view center. This is the existing, intended reveal after key zoom, not a T-025 change.

### Needs a human or a real device (already in `tests/manualne.md`, nothing added)
Touch feel on iPhone Safari and Android Chrome (also WhatsApp in-app browser), tap vs drag on a real screen, the 0.25 margin feel, the Safari trackpad gesture, seams in the grass on real devices, rotation while panned, and "Presunúť" in landscape.

No application code, config or repo test was changed by the tester. No tests were added to the repo.

### Decision
All acceptance criteria pass, no regressions. `tasks/testing/T-025-pan-margin.md` moved to `tasks/done/`. Not committed.
