# T-019: Zoom the map out a bit below the fitted view

- **Phase:** 1 (organizer request, 23. 10. 2026)
- **Depends on:** T-010, T-011, T-016, T-020, T-017 (T-016, T-020 and T-017 only for build order: they change the same files, `static/index.html` and `tests/js/logic.test.mjs`; the code areas do not overlap)
- **Size:** S

## Goal
Today the map cannot be zoomed out past the fitted view (1x = `wholeView(app.bounds)`, the scene contained in the viewport, T-011). The organizer wants to zoom out a little further, so the whole cabin is smaller and floats in the middle of the screen with grass around it. Wheel, pinch, trackpad, Safari gesture and keys all get the same new lower limit. The default view, the hit areas and the geometry stay the same. Proposal sections: "Mapa", "Vzhľad".

Organizer's words: „sprav možnosť odzoomovať aj trochu ďalej“.

## Current behaviour (read before changing)
- The constants are in `<script id="logic">`: `ZOOM_MAX = 4` and `ZOOM_KEY_STEP = 1.25`. There is no `ZOOM_MIN`. The lower limit is the fitted view and is not a fixed number. `fitBounds(vw, vh, W, H, insets)` returns the bounds, which are the whole viewport in scene units with the 380×412 scene contained and centered. 1x is `wholeView(bounds)`, and `viewZoom = bounds.w / view.w`.
- The lower limit is written out three times as `Math.min(bounds.w, …)`: in `clampView`, `zoomView` and `pinchView`. Pan clamping in `clampView` keeps the view inside the bounds (`x ∈ [bounds.x, bounds.x + bounds.w − w]`). If the view were wider than the bounds, that range would be empty and the view would stick to one side.
- `isZoomed(view, bounds)` is `view.w < bounds.w − 0.001`. It decides whether „Celá mapa“ is shown (`applyView`), whether a one-finger or mouse drag pans (`pointermove`), and whether a Tab focus reveals the bed (`focusin`).
- `refitView(view, oldBounds, newBounds)` returns the whole new bounds for any view that is not zoomed in. It runs on every bounds change: resize, rotation, Safari toolbar, and the move bar showing or hiding.
- `drawGround(g, bounds)` draws the patterned grass rect over `bounds ± 2` only. Outside it you see the page background (`html`/`body` `#8E9B48`, the autumn palette grass of T-012, equal to `COLORS.grass`) without the tuft pattern.
- There is no double-tap or double-click reset. It was optional in T-010 and was left out because a double-click on a bed would open the sheet twice.

## Scope
- `static/index.html`:
  - `<script id="logic">`: new constant `ZOOM_MIN`, one shared width clamp, `clampView`, `zoomView`, `pinchView` and `refitView` changed as below, plus a new pure function `groundRect(bounds)`.
  - `<script id="app">`: `drawGround` uses `groundRect`. Every other use of `isZoomed` stays as it is (see the criteria).
- `tests/js/logic.test.mjs`: new tests, plus the existing assertions that pin the lower limit at 1x, updated deliberately (listed below).
- `tests/manualne.md`: zoom items in section 6.

Out of scope: the default or initial view, `fitBounds`, `ZOOM_MAX`, bed geometry, hit areas, `config/chata.yaml`, a double-tap reset, the „Celá mapa“ label, a border or frame around the scene, and the server.

## Decided values (product owner default, the organizer may change them)
- `ZOOM_MIN = 0.6`, which is 0.6x of the fitted view. On a 390 px phone in portrait, the 380-unit scene is about 234 px wide at the limit, with grass margins around it. The value is a single named constant next to `ZOOM_MAX`, with the comment `// the map zooms out to this fraction of the fitted view`.
- Below 1x the view is always **centered** on the bounds, and panning does nothing. The scene cannot be pushed into a corner or lost off-screen.
- „Celá mapa“ stays **only for zoomed in**. Below 1x the whole map is already visible. To return to 1x the user pinches or wheels back in, or presses `0` or `+`. No double-tap reset is added.
- The backdrop when zoomed out is the same patterned grass as the ground layer (T-011). The scene keeps its fixed colours. There is no frame and no dark band.

## Acceptance criteria
- [x] `ZOOM_MIN = 0.6` is a named constant in the logic script and is exported to the Node tests like `ZOOM_MAX`. One helper (e.g. `clampWidth(w, bounds)`, which returns `w` limited to `[bounds.w / ZOOM_MAX, bounds.w / ZOOM_MIN]`) is the only place the zoom range is computed. `clampView`, `zoomView` and `pinchView` all use it, and no `Math.min(bounds.w, …)` lower-limit expression remains.
- [x] The wheel, a trackpad pinch (ctrl+wheel), a two-finger touch pinch, Safari `gesturechange` and the `-` key all stop at exactly 0.6x (`view.w === bounds.w / ZOOM_MIN`, within float tolerance). Zooming in still stops at 4x.
- [x] Pan clamp: when `view.w >= bounds.w` (at 1x or below), `clampView` returns the view centered on the bounds: `x = bounds.x + (bounds.w − w) / 2`, and the same for `y`. At 1x this equals today's result, so all existing 1x results are unchanged. When zoomed in, the clamp is unchanged.
- [x] A drag below 1x does not move the map (the `isZoomed` gate in `pointermove` stays), and a tap on a bed still opens the sheet. A two-finger pinch below 1x zooms but stays centered. The point under the fingers or cursor does not stay fixed below 1x. This is accepted and noted in the Dev log.
- [x] `refitView` keeps a zoomed-out factor through resize, rotation and the move bar showing or hiding: the view is the new bounds scaled by the same factor and centered. A view at exactly 1x stays whole, and zoomed-in behaviour is unchanged. A bad view still falls back to the whole new bounds.
- [x] Default view: a fresh load, the code screen → map, and „Celá mapa“ all give exactly `wholeView(bounds)` (1x) as today. Key `0` resets to 1x, also from below 1x.
- [x] „Celá mapa“ is hidden at 1x and below 1x, and shown only when zoomed in (`isZoomed` unchanged). The Tab-reveal in `focusin` does nothing below 1x, because everything is visible.
- [x] Backdrop: new pure `groundRect(bounds)` returns the rect that the view covers at `ZOOM_MIN`, centered on the bounds, plus 2 units on each side (`[x, y, w, h]`). `drawGround` sets the `.ground` rect from it. At 0.6x, on a tall phone, a landscape phone and a desktop window, the whole screen is patterned grass: no plain-colour band, no dark band, and no seam at the old bounds edge. The scene itself is not inverted or recoloured in dark mode.
- [x] No hit-area or geometry change: the existing bed hit-area and figure-position tests pass unchanged with their exact values. `drawBase`, beds, boards, meadow (T-016) and walk (T-017) layers are not touched.
- [x] `crispEdges` stays, only the `viewBox` changes, and no CSS transform is added. There is no animated zoom transition, so `prefers-reduced-motion` is unaffected.
- [x] Node tests (new):
  - `clampView` with a view wider than the bounds, e.g. `{x: 30, y: 30, w: 900, h: 900}` on the 380×412 bounds, returns `w = 380 / 0.6`, the bounds aspect ratio, and a centered `x`/`y`. A huge `x`/`y` offset still gives the centered result. The view can never be off-centre below 1x.
  - `zoomView` out from whole, repeated 20 times at a corner point, ends at exactly `bounds.w / ZOOM_MIN` and centered. Zooming back in from there passes 1x and reaches 4x.
  - `pinchView` that pinches in past the limit stops at 0.6x, centered.
  - `panView` and `dragView` at 0.6x return the same centered view.
  - `refitView` from portrait to landscape bounds at 0.6x keeps 0.6x and is centered on the new bounds. At 1x it stays whole.
  - `groundRect` covers the 0.6x view of the extended bounds (tall phone, landscape, desktop from the existing `fit:` fixtures) and contains `wholeView(bounds)`.
  - The non-finite input test still passes. Bad input never gives a view wider than `bounds.w / ZOOM_MIN`.
- [x] Existing tests updated on purpose, and only these (named in the Dev log): `clampView … 1x to 4x` (`tooWide` now gives the 0.6x centered view), `zoomView is clamped at 1x and at about 4x` (the lower limit is now 0.6x, and the "zooming out at 1x changes nothing" line becomes "stops at 0.6x, centered"), the `pinchView` "pinching in past 1x stops at the whole scene" line, and `fit: … 4x of the extended view is the limit, 1x the other`. The "at 1x there is nowhere to go" drag and pan assertions stay as they are.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md` section 6: the „Pinch zoom and pan“ and „Wheel and trackpad zoom“ items say "between 0.6x of the whole map and about 4x". New item: **Zoom out below the whole map (T-019).** On iPhone Safari, Android Chrome (also in WhatsApp) and desktop (wheel, trackpad, `-`), the map shrinks to about 0.6x and stops there. It stays centered and cannot be dragged away. The space around it is grass with tufts, with no plain band or seam. „Celá mapa“ does not appear. `0` or pinching back in returns to the normal view. Taps on beds still work. Rotate the phone, or start and cancel „Presunúť“, while zoomed out: the map stays zoomed out and centered.

## Notes for developer
- Keep `isZoomed` meaning "zoomed in" (`view.w < bounds.w − 0.001`). If you need "not exactly 1x" (for `refitView`), add a separate small helper, not a changed `isZoomed`.
- `fitBounds` and the bounds stay the 1x reference. Do not fold `ZOOM_MIN` into the bounds, or the default view would change.
- `svg` `preserveAspectRatio` stays at its default. The view keeps the bounds' aspect ratio at every zoom, so the svg still fills the screen.
- The T-010 tester's note about zoom drift at the limits (two fingers moving together) now applies at 0.6x instead of 1x. Leave it as it is.
- Beds are smaller than 44 px at 0.6x. This is accepted, because the zoomed-out view is an overview.
- Do not touch the meadow (`drawMeadow`, T-016) or walk (T-017) code. If either task is not yet in `done/`, wait.

---
## Dev log
Done by the developer agent, 23. 10. 2026.

**What changed**
- `static/index.html`, logic script: new `ZOOM_MIN = 0.6` next to `ZOOM_MAX`; new `clampWidth(w, bounds)` (the only place the zoom range is computed) used by `clampView`, `zoomView` and `pinchView`; no `Math.min(bounds.w, …)` expression is left. `clampView` returns the view centered on the bounds when `w >= bounds.w` (at 1x this equals the old result), the zoomed-in clamp is unchanged. New `isZoomedOut(view, bounds)` (`view.w > bounds.w + 0.001`), a separate helper; `isZoomed` is untouched. `refitView` keeps a zoomed-out factor (scaled to the new bounds and centered by `clampView`), 1x stays whole, zoomed-in behaviour and the bad-view fallback are unchanged. New pure `groundRect(bounds)` returns `[x, y, w, h]` of the 0.6x view centered on the bounds plus 2 units on each side.
- `static/index.html`, app script: `drawGround` sets the `.ground` rect from `groundRect`. Nothing else changed (`isZoomed` gates in `applyView`, `pointermove` and `focusin` stay, `drawBase`, beds, meadow and walk are not touched).
- `tests/js/logic.test.mjs`: new tests and the deliberate updates below. `tests/manualne.md` section 6: the two zoom items now say "between 0.6x of the whole map and about 4x", plus the new item "Zoom out below the whole map (T-019)".

**Existing tests updated on purpose (only these)**
1. `zoom: clampView … 1x to 4x` (renamed to 0.6x to 4x): `tooWide` now gives the 0.6x centered view; added `ZOOM_MIN` assertion.
2. `zoom: zoomView is clamped at 0.6x and at about 4x` (was "at 1x"): lower limit is 0.6x, and the "zooming out at 1x changes nothing" line is now "stops at 0.6x, centered"; zooming back in passes 1x and reaches 4x.
3. `zoom: a pinch zooms …`: the "pinching in past 1x stops at the whole scene" assertion now expects 0.6x, centered.
4. `fit: zoom 1x is the whole extended bounds …`: "4x of the extended view is the limit, 1x the other" now ends at 0.6x, centered.
Also extended (not changed in meaning): the `panView and dragView` test got two lines for the centered 0.6x view. The "at 1x there is nowhere to go" assertions are unchanged.

**New tests:** `clampWidth is the one place …` (also scans the logic source for a leftover `Math.min(bounds.w,`), `a resize keeps a zoomed-out view zoomed out and centered; whole stays whole`, `groundRect covers what the view shows at 0.6x and contains the whole view` (tall phone, landscape phone, desktop, scene-sized bounds, plus a source check that `drawGround` uses it), `bad input never gives a view wider than the 0.6x limit`.

**Tests**
- `cd /Users/luigi/workspace/chrapa-poll && node --test tests/js/` : 165 pass, 0 fail.
- `uv run pytest -q` : 383 passed.

**Headless Chrome check (CDP driven, own server on port 8137 with a temp data dir, Chrome on port 9333; both stopped afterwards; scripts were in `/tmp/t019`, not part of the repo)**
- 380x800 touch emulation: wheel out stops at 0.6000x and is centered (also with the cursor in a corner); ctrl+wheel out stops at 0.6x; wheel in stops at 4x; `„Celá mapa“` hidden at 1x and 0.6x, shown at 4x; key `0` resets to the exact 1x view from 4x and from 0.6x; key `-` stops at 0.6x, centered; two-finger touch pinch in stops at 0.6x, centered, also off-centre; one-finger drag below 1x does not change the viewBox; pinch out stops at 4x; synthetic Safari `gesturechange` stops at 0.6x, centered.
- Tap on a bed at 0.6x opens the sheet; „Zapísať nás sem“ at 0.6x starts the walk (a figure in the walk layer), the walk ends after about 3 s, the bed shows the party, the view stays 0.6x through the write and the poll. The meadow figures are drawn (screenshot).
- Rotation 380x800 → 800x380 → back, move bar shown and cancelled in portrait and in landscape 750x390 (bounds change there: 792 → 1066 units wide): the zoom stays 0.6x of the new bounds, centered, and returns to exactly the previous view after cancel. At 1x the view stays 1x with and without the bar.
- `.ground` rect (client rect) covers the whole viewport at 0.6x on 380x800, 800x380, 750x390 with the move bar, 1280x800 and 900x900 after a resize; screenshots show patterned grass everywhere, no plain band, no seam.
- Desktop 1280x800 (mouse, no touch): wheel stops at 0.6x centered, ctrl+wheel in stops at 4x and out at 0.6x, a mouse drag below 1x does not pan, a click on a bed at 0.6x opens the sheet.

**Notes and follow-ups**
- Below 1x the point under the fingers or cursor does not stay fixed (the view is always centered). Accepted per the task.
- The T-010 tester's note about zoom drift when two fingers move together now applies at 0.6x; left as is. The manual item „Two-finger pan feel at the zoom limits“ still says "at the whole map"; I did not edit it (not in the task scope), the tester may read it as 0.6x.
- The ground rect at 0.6x is 633x687 units on the scene-sized bounds, so it is drawn larger than before; no performance issue seen (pattern fill).

## Review round 1
(reviewer appends)

Reviewer, 23. 10. 2026. Scope: `static/index.html` (logic: `ZOOM_MIN`, `isZoomedOut`, `clampWidth`, `clampView`, `groundRect`, `refitView`, `zoomView`, `pinchView`; app: `drawGround`), `tests/js/logic.test.mjs`, `tests/manualne.md`.

**Tests run by the reviewer**
- `node --test tests/js/`: 165 pass, 0 fail. `uv run pytest -q`: 383 passed.
- Cross-check of the deliberately changed assertions: the HEAD test file run against the new page fails in exactly 4 tests (`clampView … 1x to 4x`, `zoomView is clamped at 1x and at about 4x`, `a pinch zooms …`, `fit: zoom 1x is the whole extended bounds …`). These are the four the task lists, and nothing else breaks. The new test file run against the HEAD page fails in 7 tests (the 4 updated ones plus `clampWidth …`, `a resize keeps a zoomed-out view …`, `groundRect …`), so the new tests really pin the new behaviour. The four updates are justified: each one only replaces the old "stops at 1x" expectation with "stops at 0.6x, centered". The "at 1x there is nowhere to go" drag and pan assertions are unchanged.

**Headless Chrome (own servers on 8171 = working tree and 8172 = HEAD page, Chrome CDP on 9371, temp data dirs; all stopped afterwards)**
- No regression at 1x: at 390x844, 844x390, 380x800, 1280x800 and 900x900 the initial viewBox and the full-page screenshot are byte-identical between HEAD and the working tree, and „Celá mapa“ is hidden in both.
- Zoomed in, no regression: the same sequence (wheel in, ctrl+wheel, one-finger or mouse drag, wheel out to 1.x, touch pinch, rotation while zoomed) gives identical viewBoxes on HEAD and the working tree at 390x844 touch and 1280x800 mouse.
- Lower limit, at 390x844, 844x390 and 1280x800: the wheel (cursor in a corner), ctrl+wheel, key `-` (x6), a synthetic Safari `gesturechange` and an off-centre two-finger touch pinch all stop at exactly 0.6000x, centered on the bounds. ctrl+wheel, key `+` and a touch pinch-out stop at exactly 4x. Key `0` gives the exact 1x viewBox from 0.6x and from 4x. `+` x2 from 0.6x gives 0.9375x, as expected.
- „Celá mapa“ is hidden at 1x and at 0.6x and shown at 4x. A one-finger drag (touch) and a mouse drag below 1x leave the viewBox unchanged.
- Taps: a tap or click on a bed at 0.6x opens its sheet and does not move the view. At 390x844 the double bed is 37x28 px, accepted per the notes.
- Resize: at 0.6x, a rotation from 390x844 to 844x390 and back keeps 0.6x of the new bounds, centered. A move bar shown while at 0.6x gives 0.6x of the bar-reduced bounds, and hiding it restores exactly the previous view. At 1x the view stays whole through the bar. The real flow (bed sheet → „Presunúť“ → „Zrušiť“) at 0.6x in portrait and in landscape returns to the same 0.6x centered view.
- Grass: the `.ground` client rect covers the viewport. I decoded the screenshots at 0.6x at 390x844, 844x390 (also after rotation), 1280x800, 320x568, 600x1200, 1200x300, 1920x1080 and in dark mode. Every pixel outside the scene is grass, a tuft or an anti-aliased blend of the two, with no plain band and no seam at the old bounds edge. At 1920x1080 some 60 px windows have no tuft, but the screenshot shows that this is just the regular sparse tile at that scale, not a band. Dark mode does not recolour the scene.
- Meadow and walk at 0.6x (portrait and landscape): the meadow figures are drawn. „Zapísať nás sem“ starts the walk, the walk layer empties after about 3 s, the bed shows the party, and the view stays 0.6x centered through the write and the poll.

**Code**
- `clampWidth` is the only place the range is computed, and no `Math.min(bounds.w, …)` is left. The `w >= bounds.w` centered branch gives exactly the old result at 1x, and it is continuous with the zoomed-in clamp: as `w → bounds.w` the allowed x range shrinks to `bounds.x`, so zooming out through 1x does not make the map jump.
- `isZoomed` is unchanged. `isZoomedOut` is a separate helper, used only by `refitView`, as the notes asked. `drawBase`, beds, boards, meadow and walk are untouched. Only the `viewBox` and the ground rect change: no CSS transform and no animation.
- There is no new Slovak UI text, so tykanie is not affected. The new `tests/manualne.md` text is English, with the Slovak labels in „ “.

**Blockers:** none.

**Suggestions**
- `tests/manualne.md` „Two-finger pan feel at the zoom limits“ still says "at 4x and at the whole map". The lower limit is now 0.6x, so the item should say "at 4x and at 0.6x". The developer flagged this as out of scope. It is a one-word edit that the orchestrator or a follow-up can make.
- Composition with the move bar in landscape: at 0.6x of the bar-reduced bounds, the scene is only about 160 px wide on an 844x390 screen. This follows the spec ("keeps the factor"). It is worth one look on a real phone during manual testing.

**Nits**
- The two new `panView`/`dragView` lines at 0.6x and the "bad input never gives a view wider than the 0.6x limit" test also pass on the HEAD page, so on their own they do not pin the new behaviour. The `clampView`, `zoomView` and `refitView` tests do pin it, so this is fine.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2
(reviewer appends)

## Test report
(tester appends)
Tester, 23. 10. 2026. Verdict: **PASS**. No bugs found. No application code changed.

**Automated suites (run from the repo root)**
- `node --test tests/js/`: 165 pass, 0 fail, 0 skipped.
- `uv run pytest -q`: 383 passed in 2.59 s.
- Regressions: the Node suite covers every page-logic task in `tasks/done/` (T-010, T-011, T-012 to T-018, T-020, T-021); pytest covers the backend (T-001 to T-004, T-008). Both green.
- Static checks: `Math.min(bounds.w,` now appears only in `clampWidth` as the upper bound `Math.min(bounds.w / ZOOM_MIN, …)`, so no lower-limit expression is left. `clampWidth` is used by `clampView`, `zoomView` and `pinchView`. The diff adds no CSS `transform`. `crispEdges` is unchanged.

**Browser checks (own headless Google Chrome on port 9411, own server on port 8191 with a temp data dir `/tmp/t019-tester/data`, both stopped afterwards; scripts in `/tmp/t019-tester`, not in the repo)**
- Mobile emulation 390x844 with touch: the „Kto si?“ panel is closed first, then:
  - wheel out at a corner, 40 steps: stops at w = 633.333 (0.6x of the 380-unit whole view), centered on the bounds, aspect kept, further wheels change nothing;
  - one-finger drag at 0.6x: view unchanged;
  - tap on a bed at 0.6x opens its sheet (`.sheet[role=dialog]`), view unchanged;
  - key `0` from 1x and from 0.6x gives the exact 1x view;
  - two-finger pinch out stops at 4x (w = 95); off-centre two-finger pinch in stops at 0.6x, centered;
  - key `+` then `-` x10 from 0.6x: `-` stops at 0.6x, centered;
  - synthetic Safari `gesturestart`/`gesturechange` scale 0.5 steps: stops at 0.6x, centered; scale 20: stops at 4x;
  - no page exceptions or console errors.
- Desktop 1280x800 with mouse: wheel out at a corner stops at 0.6x, centered; ctrl+wheel in stops at 4x, ctrl+wheel out stops at 0.6x, centered; mouse drag at 0.6x does not pan; click on a bed at 0.6x opens the sheet and does not move the view; key `0` gives the exact 1x view; no console errors.
- „Celá mapa“: hidden at 1x and at 0.6x, shown at 4x; clicking it at 4x gives exactly the 1x view.
- Tab through the beds at 0.6x: view unchanged.
- Rotation at 0.6x: 390x844 to 844x390 keeps 0.6x of the new bounds, centered (fresh 1x of the landscape size as reference); rotating back gives exactly the first 0.6x view.
- Resize at 0.6x: 1280x800 to 900x900 keeps 0.6x, centered (w = fresh 1x w / 0.6).
- Move bar (test party created through the API, own bed tapped, „Presunúť“ pressed): at 0.6x the view keeps its width, at 1x with the bar the whole view is 380 units wide (0.6x = 380/0.6), the 0.6x view with the bar is centered on the same bounds as the 1x view, wheel out with the bar stops at 0.6x, and „Zrušiť“ returns exactly to the 0.6x view from before the bar.
- Grass: `.ground` client rect covers the viewport at 0.6x on 390x844 (also after rotation) and on 1280x800 / 900x900. Screenshots decoded in Python: all edge pixels at 0.6x are grass `#8E9B48` with tufts, no plain band, no seam. Dark mode (`prefers-color-scheme: dark`) leaves the scene colours unchanged (checked visually).

**Acceptance criteria**

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `ZOOM_MIN = 0.6` named and exported; one `clampWidth`; no `Math.min(bounds.w, …)` lower limit | PASS | Node tests `clampWidth …`, `ZOOM_MIN`; grep |
| 2 | Wheel, ctrl+wheel, touch pinch, Safari gesturechange and `-` stop at 0.6x; zoom in stops at 4x | PASS | Browser, mobile and desktop |
| 3 | `clampView` centers when `w >= bounds.w`; 1x unchanged; zoomed-in clamp unchanged | PASS | Node tests; browser centering at 0.6x and with the bar |
| 4 | Drag below 1x does not pan; tap on a bed opens the sheet; pinch below 1x centered | PASS | Browser (touch and mouse) |
| 5 | `refitView` keeps factor through resize, rotation and the move bar; 1x stays whole | PASS | Browser rotation, resize, move bar; Node tests |
| 6 | Default view, code screen to map, „Celá mapa“ and key `0` give exact 1x | PASS | Browser |
| 7 | „Celá mapa“ hidden at 1x and 0.6x, shown at 4x; Tab reveal does nothing below 1x | PASS | Browser |
| 8 | `groundRect` covers the 0.6x view; no plain band or seam; scene not recoloured in dark mode | PASS | Rects, pixel decode of screenshots, dark screenshot |
| 9 | No hit-area or geometry change; existing bed and figure tests unchanged | PASS | Node suite; diff does not touch those layers |
| 10 | `crispEdges` stays, only `viewBox` changes, no transform, no animation | PASS | grep and diff |
| 11 | New Node tests exist and pass; `node --test tests/js/` and `uv run pytest -q` pass | PASS | 165 pass, 383 passed |
| 12 | `tests/manualne.md` section 6 wording and new T-019 item | PASS | diff; see the fixes below |

**Extra scenarios tried**
- First visit: the „Kto si?“ panel opens over the map after joining; with it open, the map ignores wheel and taps (expected, it is a modal). Closed by Escape, the map works.
- Zoom in past 4x and out past 0.6x with repeated steps: both clamp, no drift over 40 steps.
- Bad or edge input (NaN, Infinity, zero, negative) is covered by the new Node test `bad input never gives a view wider than the 0.6x limit`.
- Two-finger pinch with one finger starting outside the viewport: not tested (my harness error, fixed in the script).
- Concurrency and server behaviour: unchanged by this task (no server code touched).

**Manual checklist (`tests/manualne.md`)**
- Fixed: the item „Two-finger pan feel at the zoom limits (T-010 tester note)“ now says "at 4x and at 0.6x of the whole map (the lower limit, T-019)". This was the reviewer's suggestion.
- Added one sentence to the item „Zoom out below the whole map (T-019)“: in landscape with „Presunúť“ at 0.6x the scene is small (about 160 px wide on 844x390); check it is still usable on a real phone. This needs a real device.
- Still needs a human on real devices: iPhone Safari and Android Chrome (also in WhatsApp) for the pinch and gesture feel, and the look of the grass on a real screen.

**Observations, not failures**
- Keyboard focus on the map (after a key press on the focused svg) shows the existing 3 px amber ring from `#scene svg:focus-visible`, at every zoom. This is the designed keyboard focus indicator, not a T-019 change. Mouse and touch focus show no ring.

**Outcome:** all 12 criteria pass, no regressions. Moved to `tasks/done/`. Not committed.
