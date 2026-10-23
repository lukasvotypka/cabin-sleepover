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
- [ ] `ZOOM_MIN = 0.6` is a named constant in the logic script and is exported to the Node tests like `ZOOM_MAX`. One helper (e.g. `clampWidth(w, bounds)`, which returns `w` limited to `[bounds.w / ZOOM_MAX, bounds.w / ZOOM_MIN]`) is the only place the zoom range is computed. `clampView`, `zoomView` and `pinchView` all use it, and no `Math.min(bounds.w, …)` lower-limit expression remains.
- [ ] The wheel, a trackpad pinch (ctrl+wheel), a two-finger touch pinch, Safari `gesturechange` and the `-` key all stop at exactly 0.6x (`view.w === bounds.w / ZOOM_MIN`, within float tolerance). Zooming in still stops at 4x.
- [ ] Pan clamp: when `view.w >= bounds.w` (at 1x or below), `clampView` returns the view centered on the bounds: `x = bounds.x + (bounds.w − w) / 2`, and the same for `y`. At 1x this equals today's result, so all existing 1x results are unchanged. When zoomed in, the clamp is unchanged.
- [ ] A drag below 1x does not move the map (the `isZoomed` gate in `pointermove` stays), and a tap on a bed still opens the sheet. A two-finger pinch below 1x zooms but stays centered. The point under the fingers or cursor does not stay fixed below 1x. This is accepted and noted in the Dev log.
- [ ] `refitView` keeps a zoomed-out factor through resize, rotation and the move bar showing or hiding: the view is the new bounds scaled by the same factor and centered. A view at exactly 1x stays whole, and zoomed-in behaviour is unchanged. A bad view still falls back to the whole new bounds.
- [ ] Default view: a fresh load, the code screen → map, and „Celá mapa“ all give exactly `wholeView(bounds)` (1x) as today. Key `0` resets to 1x, also from below 1x.
- [ ] „Celá mapa“ is hidden at 1x and below 1x, and shown only when zoomed in (`isZoomed` unchanged). The Tab-reveal in `focusin` does nothing below 1x, because everything is visible.
- [ ] Backdrop: new pure `groundRect(bounds)` returns the rect that the view covers at `ZOOM_MIN`, centered on the bounds, plus 2 units on each side (`[x, y, w, h]`). `drawGround` sets the `.ground` rect from it. At 0.6x, on a tall phone, a landscape phone and a desktop window, the whole screen is patterned grass: no plain-colour band, no dark band, and no seam at the old bounds edge. The scene itself is not inverted or recoloured in dark mode.
- [ ] No hit-area or geometry change: the existing bed hit-area and figure-position tests pass unchanged with their exact values. `drawBase`, beds, boards, meadow (T-016) and walk (T-017) layers are not touched.
- [ ] `crispEdges` stays, only the `viewBox` changes, and no CSS transform is added. There is no animated zoom transition, so `prefers-reduced-motion` is unaffected.
- [ ] Node tests (new):
  - `clampView` with a view wider than the bounds, e.g. `{x: 30, y: 30, w: 900, h: 900}` on the 380×412 bounds, returns `w = 380 / 0.6`, the bounds aspect ratio, and a centered `x`/`y`. A huge `x`/`y` offset still gives the centered result. The view can never be off-centre below 1x.
  - `zoomView` out from whole, repeated 20 times at a corner point, ends at exactly `bounds.w / ZOOM_MIN` and centered. Zooming back in from there passes 1x and reaches 4x.
  - `pinchView` that pinches in past the limit stops at 0.6x, centered.
  - `panView` and `dragView` at 0.6x return the same centered view.
  - `refitView` from portrait to landscape bounds at 0.6x keeps 0.6x and is centered on the new bounds. At 1x it stays whole.
  - `groundRect` covers the 0.6x view of the extended bounds (tall phone, landscape, desktop from the existing `fit:` fixtures) and contains `wholeView(bounds)`.
  - The non-finite input test still passes. Bad input never gives a view wider than `bounds.w / ZOOM_MIN`.
- [ ] Existing tests updated on purpose, and only these (named in the Dev log): `clampView … 1x to 4x` (`tooWide` now gives the 0.6x centered view), `zoomView is clamped at 1x and at about 4x` (the lower limit is now 0.6x, and the "zooming out at 1x changes nothing" line becomes "stops at 0.6x, centered"), the `pinchView` "pinching in past 1x stops at the whole scene" line, and `fit: … 4x of the extended view is the limit, 1x the other`. The "at 1x there is nowhere to go" drag and pan assertions stay as they are.
- [ ] `node --test tests/js/` and `uv run pytest -q` pass.
- [ ] `tests/manualne.md` section 6: the „Pinch zoom and pan“ and „Wheel and trackpad zoom“ items say "between 0.6x of the whole map and about 4x". New item: **Zoom out below the whole map (T-019).** On iPhone Safari, Android Chrome (also in WhatsApp) and desktop (wheel, trackpad, `-`), the map shrinks to about 0.6x and stops there. It stays centered and cannot be dragged away. The space around it is grass with tufts, with no plain band or seam. „Celá mapa“ does not appear. `0` or pinching back in returns to the normal view. Taps on beds still work. Rotate the phone, or start and cancel „Presunúť“, while zoomed out: the map stays zoomed out and centered.

## Notes for developer
- Keep `isZoomed` meaning "zoomed in" (`view.w < bounds.w − 0.001`). If you need "not exactly 1x" (for `refitView`), add a separate small helper, not a changed `isZoomed`.
- `fitBounds` and the bounds stay the 1x reference. Do not fold `ZOOM_MIN` into the bounds, or the default view would change.
- `svg` `preserveAspectRatio` stays at its default. The view keeps the bounds' aspect ratio at every zoom, so the svg still fills the screen.
- The T-010 tester's note about zoom drift at the limits (two fingers moving together) now applies at 0.6x instead of 1x. Leave it as it is.
- Beds are smaller than 44 px at 0.6x. This is accepted, because the zoomed-out view is an overview.
- Do not touch the meadow (`drawMeadow`, T-016) or walk (T-017) code. If either task is not yet in `done/`, wait.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
