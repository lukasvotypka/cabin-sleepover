# T-011: The map fills the whole browser viewport

- **Phase:** 1 (organizer request, 22. 10. 2026, after trying it on an iPhone)
- **Depends on:** T-010
- **Size:** S

## Goal
Today the 380×412 scene sits at the top and the rest of a tall phone screen is the plain dark page background (see the organizer's iPhone screenshot: about half the screen is empty). The map must fill the whole browser viewport on any screen size and orientation, with no empty page background around it.

## Scope
- `static/index.html`
- `tests/js/logic.test.mjs`
- `tests/manualne.md`

## Acceptance criteria
- [x] The scene SVG covers the full viewport (`100vw` × the dynamic viewport height, e.g. `100dvh` with a fallback), with no page scroll at 1× and no dark band anywhere.
- [x] Nothing in the scene is cropped or distorted: the 380×412 scene keeps its aspect ratio and fits the viewport (contain), and the extra space on the long side is filled with the scene's grass (drawn in the SVG, e.g. by extending the base `viewBox` to the viewport's aspect ratio around the scene, not by a CSS background colour alone). The scene is centered in the extra space.
- [x] Works on a tall phone (portrait, e.g. 390×750), a phone in landscape, and a wide desktop window; recomputes on resize and orientation change.
- [x] iPhone: the grass also goes behind the status bar and the Safari toolbar area (`viewport-fit=cover`, matching `theme-color`/page background); interactive elements (boards, beds, „Celá mapa“, toasts, move bar) stay inside the safe area (`env(safe-area-inset-*)`).
- [x] Zoom from T-010 still works: 1× is the full extended view; zoom and pan are clamped to the extended bounds; „Celá mapa“ returns to the full extended view; zoom state survives a resize sensibly (at least it stays valid and clamped).
- [x] Hit areas, the bed sheet, panels, the code screen, move mode, polling and the hidden summary keep working; panels still open over the map.
- [x] Since the one-finger page scroll at 1× no longer has anything to scroll, decide `touch-action` accordingly (one-finger drag may simply do nothing at 1×, or pan if the extended view is larger than the screen); document the choice in the Dev log.
- [x] The fit math (base view for a given viewport size, centered scene, clamp bounds) is pure functions in the logic script with Node tests. `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md`: full-screen check on iPhone Safari (portrait and landscape), WhatsApp in-app browser and Android Chrome.

## Notes for developer
- Keep geometry data-driven from `/api/state`; only the visible window changes.
- A portrait-specific layout (moving boards below the house to use the height better) is **not** in scope; if you think it is worth it, say so in the Dev log.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

**Round 1 (developer)**

What changed
- `#scene` is now `position: fixed` and fills the viewport (`100%` x `100vh`, then `100dvh`). The svg is `100% x 100%`. `body` has `overflow: hidden`, `overscroll-behavior: none` and the grass colour as background (so the area under the iPhone status bar is grass); `<meta name="theme-color" content="#79B35A">` and `viewport-fit=cover` added.
- Logic script: new `fitBounds(vw, vh, W, H, insets)` returns the "bounds", the whole viewport in scene units (scene contained, centered in the part free of safe-area insets, grass around it); bad numbers fall back to the scene. New `refitView(view, oldBounds, newBounds)`: whole stays whole, a zoomed view keeps its factor and center and is clamped. The T-010 functions (`wholeView`, `viewZoom`, `isZoomed`, `clampView`, `zoomView`, `panView`, `dragView`, `pinchView`, `revealRect`) now take `bounds` instead of `(W, H)`: 1x is the whole extended bounds, zoom (max 4x of the extended view) and pan are clamped to it. `scenePoint` and `viewBoxText` unchanged.
- App script: `setupZoom` measures `#scene`, calls `fitBounds` with the safe-area insets (read from a hidden `.inset-probe` whose padding is `env(safe-area-inset-*)`), and refits on a `ResizeObserver` on `#scene` plus `window` `resize` (covers rotation and the Safari toolbar). A redraw of the layout keeps the zoom as before. The grass outside the scene is a new `ground` svg layer under `base`: one rectangle over the bounds with a `<pattern>` (96 px tile with tufts, same look as the code screen), updated on every refit by `drawGround`. The scene's own grass is drawn over it.
- CSS: safe-area insets added to `.zoom-reset`, `#toast`, `.movebar`, `.sheet`, `.code-screen`. `.boot` is now a fixed centered full-screen box (it no longer sits on the grass body background). `.movebar` is `position: fixed` at the top (it was `sticky` in the page flow, which has gone). A mouse press focuses the svg (`tabindex=-1`), and the UA focus ring then drew a grey frame around the whole screen: `#scene svg:focus:not(:focus-visible) { outline: none; }` (keyboard focus ring unchanged).
- Files: `static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md`.

Decision on `touch-action`
- `#scene svg { touch-action: none; }` always (the `.zoomed` class and its CSS are gone). The page has nothing to scroll, and at 1x the view equals the screen, so one finger at 1x does nothing (a tap still opens a bed). Zoomed in, one finger pans (pointer events) and two fingers pinch. The `touchstart`/`touchmove` two-finger guard stays.

Tests
- `node --test tests/js/` : 108 pass (existing zoom tests ported to the bounds API, plus new `fit:` tests: tall phone, landscape phone, wide desktop, safe-area insets, bad input, zoom/pan/drag/pinch/reveal clamped to extended bounds, refit on rotation, and a source check of the page wiring).
- `uv run pytest -q` : 379 pass.

Browser check (headless Chrome 155 via CDP, own uvicorn on 127.0.0.1:8123 with a temp data dir `/tmp/t011/data` and test secrets; ports 8000 and 8010 untouched; server and Chrome killed afterwards)
- 390x750 mobile: svg 390x750, viewBox `0 -159.385 380 730.769` (scene full width, grass above and below), no scroll (scrollHeight 750). 750x390 mobile: viewBox `-206.154 0 792.308 412`. 1280x800 desktop: viewBox `-139.6 0 659.2 412`. Screenshots show no dark band and a centered whole scene in all three.
- Wheel zoom works (button „Celá mapa“ appears), dragging stops at the extended bounds (grass beyond the scene reachable), rotating while zoomed gives a valid clamped view, „Celá mapa“ restores the full extended view, a bed click opens the sheet over the map (landscape checked), the „Kto si?“ panel opens over the map, no console errors.
- Safe area emulated with `Emulation.setSafeAreaInsetsOverride` (top 47, bottom 34): the probe reads `47px`/`34px` and `.zoom-reset` moves up to `bottom: 42px`. On a tall phone the scene is full width so the insets do not change the fit (the unit tests cover the case where they do).
- Not run: a real iPhone, the move bar over a real party (only its CSS was changed), pinch on a real touch screen.

Notes and follow-ups (not done, out of scope)
- The fixed move bar now overlays the top of the map instead of pushing it down. On a tall phone it sits on the grass; on a landscape phone it covers the upper part of the scene while moving (the user can pan or zoom). A cheap fix would be to treat the bar's height as an extra top inset while move mode is on. Say if you want it.
- A portrait-specific layout (boards moved under the house) would use the tall grass bands better; I think it is worth a separate task, since on a 390x750 phone about 45% of the height is empty grass.
- After rotating away and back while zoomed, the center can drift (a clamped view stays clamped); the view is always valid.
- `CLAUDE.md` shows as modified in `git status`: not by me.

**Round 2 (developer): answers to review round 1**

- Blocker (move bar hides beds in landscape): **fixed.** `readInsets()` now uses the bar's `offsetHeight` as the top inset while `#moveBar` is shown and that height is larger than the safe-area top inset (the bar's height already includes the safe-area padding, so it is a maximum, not a sum). `refit` runs when the bar shows or hides (`renderMoveBar` calls `app.refit()` after it has set the text, which can wrap) and a `ResizeObserver` also watches the bar (it wraps differently after a resize). `refit` also keeps the previous bounds when the host has zero size (hidden behind the code screen) instead of falling back to the scene. A zoomed view survives showing and hiding the bar through `refitView`.
- Suggestion, code screen centering: **fixed.** `.code-screen` is a plain flex box with `justify-content: center`, and `.board` has `margin: auto`, so a tall board scrolls from its top. Checked at 750x250: board top 16 px, scrollTop 0, scrollHeight 344 against 250.
- Suggestion, `.sheet` max-height: **fixed.** `max-height: 88vh; max-height: calc(88dvh - env(safe-area-inset-top, 0px));` (220 px at a height of 250).
- Suggestion, overscroll: **fixed.** `overscroll-behavior: none` moved from `body` to `html`; `overscroll-behavior: contain` added on `.sheet` and `.code-screen`.
- Suggestion, small targets in landscape: **done as a manual item** (`tests/manualne.md`), together with a move-mode-in-landscape item and a panels item (code screen with keyboard, long sheet).
- Suggestion, insets re-read only on size change: agreed, no change (they are also re-read now when the bar changes, because that goes through `refit`).

Tests
- New Node tests: `fit: an extra top inset the size of the move bar keeps the whole scene below it, in every orientation` (750x390, 667x375, 1280x800, 390x750; the scene shrinks in landscape; showing and hiding the bar keeps a zoomed view) and `page: the move bar's height is a top inset ... ` (source checks of the wiring and the new CSS). `node --test tests/js/`: 110 pass. `uv run pytest -q`: 379 pass.

Browser check (headless Chrome, my own uvicorn on 127.0.0.1:8123, temp data dir, test secrets; both processes killed; ports 8000 and 8010 untouched)
- Landscape 750x390, party placed in „Konica, podkrovie“, then „Presunúť“: bar 100 px tall, viewBox goes from `-206.154 0 792.308 412` to `-342.759 -142.069 1065.517 554.069`, the first bed's top moves from 36 px to 127 px (below the bar) and the hit test at its center lands in the svg. The screenshot shows the whole scene, signposts and the attic bed under the bar. „Zrušiť“ restores the original viewBox exactly.
- Code screen at 750x390 (centered) and 750x250 (not cut off, scrolls). Sheet at 750x250 is 220 px high (88dvh) with `overscroll-behavior: contain`.
- Not run on a real device (iPhone toolbar, Android WebView with keyboard).

## Review round 1
(reviewer appends)

Checked: `git diff` of `static/index.html`, `tests/js/logic.test.mjs` and `tests/manualne.md` (the `CLAUDE.md` change is not part of this task), and the surrounding app code (`ensureScene`, `setupZoom`, move mode, panels). Ran `node --test tests/js/` (108 pass) and `uv run pytest -q` (379 pass).

What is good: `fitBounds` / `refitView` are pure, correct, and well tested (tall phone, landscape, desktop, insets, bad input, clamped zoom/pan/pinch/reveal, rotation). The T-010 functions were ported cleanly to `bounds`. `refit` is cheap and returns early when nothing changed, so it needs no debounce (ResizeObserver already runs at most once per frame, and the second call from `resize` does nothing). There are no listener leaks: `zoomCleanup` removes `resize` and disconnects the observer on every redraw, and the probe is created only once. Because the scene is shown before `setupZoom`, the first measurement is real. `touch-action: none` applies only to `#scene svg`. `#panelRoot`, `.sheet` and `.code-screen` are siblings of the map, not inside it, and no document-level `touchmove`/`preventDefault` exists, so panels still scroll. There is no `innerHTML`, the ground layer is `aria-hidden`, and keyboard focus rings stay. I agree with the `touch-action` choice.

### Blocker

1. **The move bar hides move targets in landscape (and partly on desktop).** `static/index.html` line 127, `.movebar { position: fixed; top: 0; ... }`. The bar is about 97 px tall: padding, a text row, a 44 px button row and the border. In landscape the scene is fitted to the full height, so at 1x `bounds.y = 0` and the scene starts at the top of the screen. On an iPhone in landscape, with about 340 px visible, the scale is about 0.83 px per unit, so the bar covers scene y < ~117. That hides both beds of „Konica, podkrovie“ (y 44–78) and the night signposts. On a 360 px Android landscape screen it also covers the top of the mats (y 132). At 1x nothing can pan, and zooming in still clamps `view.y >= 0`. So the user can reach those beds only by zooming to about 3x and panning, which nobody will discover. Scenario: in landscape I tap my bed, choose „Presunúť“, and want to move to „Manželská posteľ“ in the attic. It sits under the bar and tapping there hits the bar. The AC requires that move mode keep working and that interactive elements stay clear. With T-010 the sticky bar pushed the map down, so this is a regression. Expected fix: do what you proposed. While `app.move` is set, add the bar's measured height (`offsetHeight`, which already includes the safe-area top padding) to the top inset passed to `fitBounds`, and refit when the bar shows or hides (call it from `renderMoveBar`, or observe the bar). At 1x the whole scene then sits below the bar in every orientation, and a zoomed view is kept by `refitView`. On a tall phone this changes nothing visible, because the scene is width-limited. Add a Node test for the case: an extra top inset the size of the bar keeps the scene's top edge below it in landscape. Add a line to the manual checklist: move mode in landscape, all beds tappable.

### Suggestions

- `.code-screen` (line 63): `align-items: center` with `overflow-y: auto` has a known bug. When the board is taller than the screen, the overflow above the top cannot be scrolled to, so the heading and the top of the board are cut off. This happens on a landscape phone with the keyboard open, in a WebView that resizes the layout viewport (the WhatsApp in-app browser on Android). Use `margin: auto` on `.board`, or `align-items: safe center`, so a tall board scrolls from its top.
- `.sheet` `max-height: 88vh` (line 94): now that the page never scrolls, the iOS toolbar never collapses, and `vh` is the *large* viewport. A long party form can then reach under the status bar or Dynamic Island area, which `viewport-fit=cover` now opens to the page. Consider `max-height: 88vh; max-height: calc(88dvh - env(safe-area-inset-top, 0px));`.
- `overscroll-behavior: none` on `body` does not reach the viewport (only the root element's value does). Put it on `html`. Add `overscroll-behavior: contain` to `.sheet` and `.code-screen`, so a fling at the end of a panel's scroll does not rubber-band the page on iOS.
- In landscape the 1x scene is now smaller than before: about 0.8–0.95 px/unit, where T-010 used about 1.47. A cot is about 17×30 px, under the 44 px target. This follows from "contain" and zoom mitigates it, but say so in the manual checklist so it gets tried on a real phone.
- The insets are re-read only when the size changes. That is fine in practice, because rotation always changes the size.

### Nits

- The developer's portrait-layout idea (boards under the house) is worth a separate task. I agree it is out of scope here.
- The center drift after rotating away and back while zoomed is acceptable as documented.

Verdict: CHANGES REQUESTED

## Review round 2
(reviewer appends)

Checked: the round-2 `git diff` of `static/index.html`, `tests/js/logic.test.mjs` and `tests/manualne.md` (I ignored the `CLAUDE.md` change), plus the surrounding code (`render`, `renderMoveBar`, `startMove`/`cancelMove`/`moveTo`, `showCodeScreen`, `setupZoom`/`refit`). Ran `node --test tests/js/`: 110 pass. Ran `uv run pytest -q`: 379 pass.

Round-1 blocker:
- **Move bar hides beds in landscape: fixed.** `readInsets()` uses `max(safe-area top, bar.offsetHeight)` while the bar is shown. That is correct, because the bar's top padding already contains the safe-area inset, so a sum would count it twice. `renderMoveBar()` calls `app.refit()` after the text is set. That covers start, cancel and completion of a move (`moveTo` clears `app.move` before `runWrite`), the switch between „Táto noc“ and „Všetky noci“, and `showCodeScreen`. A `ResizeObserver` on the bar covers re-wrapping after a resize. When the bar shows or hides, the view goes through `refitView`: whole stays whole and zoomed keeps its factor. The Node test covers 750x390, 667x375, 1280x800 and 390x750 with a 97 px bar, the shrink in landscape, and a zoomed view that survives both transitions. The manual item was added.

Round-1 suggestions: all addressed. `.board { margin: auto }` replaces `align-items: center`, so a tall board scrolls from its top. `.sheet` uses `calc(88dvh - env(safe-area-inset-top))` with an `88vh` fallback. `overscroll-behavior: none` is now on `html`, with `contain` on `.sheet` and `.code-screen`. The checklist has items for landscape targets and for panels and the keyboard.

Regression pass:
- `render()` now calls `refit` on every render through `renderMoveBar`, including the 30 s poll. It is cheap: one `getBoundingClientRect` and an early return when the bounds are unchanged. It cannot loop, because `refit` never changes the bar's or the host's size.
- When the code screen opens, `renderMoveBar` refits while the scene is still visible. After that the hidden host has zero size, and `refit` keeps the previous bounds instead of falling back to the bare scene. When the scene returns, the observer refits it.
- When the layout is redrawn, `refit(true)` keeps the view (`refitView` with equal bounds is the identity). A new scene size resets the bounds and the view. `zoomCleanup` still removes the `resize` listener and disconnects the observer, which now also watches the bar, so nothing leaks.
- Zoom, pan, pinch, keyboard zoom, „Celá mapa“, bed taps and drag suppression are not touched by round 2. `touch-action` is unchanged. Panels and the toast are unaffected. `textContent` is still used for the party name in the bar.

### Blocker
None.

### Suggestions
- In portrait the scene now jumps down by about 48 px when move mode starts on a 390x750 phone (the scene is re-centered in 750 − 97 px), and jumps back when the move ends. My round-1 remark that this "changes nothing visible" on a tall phone was wrong. The jump is harmless, because the sheet has just closed and the user then taps a target. If it feels jumpy on a real phone, apply the bar inset only when the bar would actually overlap the scene, that is, when the scene's top on screen without the bar is less than the bar's height. This is optional.
- On a wide desktop window the bar is at most 560 px wide but is treated as a full-width top inset, so the scene shrinks a little more than it needs to. This is acceptable.

### Nits
- `.board` has its comment in the middle of the declaration list. It is harmless.

Verdict: APPROVED

## Test report
(tester appends)

**Tester, 22. 10. 2026**

Commands and results
- `node --test tests/js/` : 110 pass, 0 fail.
- `uv run pytest -q` : 379 pass (no regressions in the backend or earlier tasks).
- Browser: headless Chrome 155 driven over CDP (own scripts in `/tmp/t011t/js`, not in the repo), my own uvicorn on 127.0.0.1:8247 with a temp data dir `/tmp/t011t/data`, test secrets, 9 seeded parties. Ports 8000 and 8010 untouched; my uvicorn and Chrome processes killed afterwards. Touch emulation (touch events, mobile metrics) at 390x750, 750x390, 750x250, 667x375, 320x480; mouse (no touch) at 1280x800. Safe-area insets emulated with `Emulation.setSafeAreaInsetsOverride` (47/0/34/0 portrait, 0/47/21/47 landscape, 24/0/0/0).

Acceptance criteria
| # | Criterion | Result |
| --- | --- | --- |
| 1 | Scene svg fills the viewport, no page scroll, no dark band | PASS. svg rect equals viewport, scrollWidth/Height equal viewport in every size, `elementFromPoint` at all four corners and four edge midpoints is the svg, html/body background is the grass colour also under `prefers-color-scheme: dark`. |
| 2 | Not cropped or distorted, contained, extra space is SVG grass, scene centered | PASS. Base viewBox has the viewport aspect (e.g. `0 -159.385 380 730.769` at 390x750, `-206.154 0 792.308 412` at 750x390, `-428 0 1236 412` at 750x250), scene fully inside and centered. Screenshots checked at 390x750, 750x390, 750x250, 1280x800. |
| 3 | Tall phone, landscape phone, wide desktop; recomputes on resize and rotation | PASS. Resizing 1000x500, 500x1000, 1280x800, 390x750 in sequence: svg and scroll size always equal to the viewport. |
| 4 | iPhone: viewport-fit=cover, theme-color, interactive elements inside the safe area | PASS (emulated). Probe reads the insets; with insets the scene is centered in the free area (e.g. y 170 to 593 in 47..716); toast and „Celá mapa“ (44 px high) stay inside the insets in portrait and landscape. A real iPhone is in `tests/manualne.md`. |
| 5 | Zoom/pan clamped to extended bounds, „Celá mapa“, zoom survives resize | PASS. Pinch (touch) and wheel (desktop) zoom; panning to all four corners stays within the bounds and reaches the edges (touch and mouse); rotation while zoomed gives a valid view with the reset button still shown; back and „Celá mapa“ restores exactly the full extended viewBox; page not zoomed (`visualViewport.scale` 1); key `0` resets. |
| 6 | Hit areas, sheet, panels, code screen, move mode, polling, hidden summary | PASS. Bed tap at 1x and while zoomed opens the sheet over the map and the zoom is kept after closing; code screen and wrong code (Slovak error text) work; polling (waited a 30 s poll with a changed server state while zoomed) updated the content and kept the view exactly; visibilitychange keeps the view; `.sr-only` summary present. |
| 7 | `touch-action` decided and documented | PASS. `touch-action: none` on the svg; documented in the Dev log. One-finger drag at 1x does nothing, a tap still works; panels scroll (sheet touch drag moved `scrollTop`, page stayed at 0,0). |
| 8 | Fit math pure with Node tests | PASS. 110 Node tests, including the `fit:` ones. |
| 9 | `tests/manualne.md` items | PASS. Full-screen, move mode in landscape, small targets, panels and keyboard items present. |

Extra scenarios tried (all pass)
- Move mode at 750x390, 667x375, 750x250, 750x390 with insets, 390x750, 1280x800: bar is shown, the view refits (e.g. `-206.154 0 792.308 412` to `-342.759 -142.069 1065.517 554.069`), no scene button (attic beds, signposts) lies under the bar and all are inside the viewport, „Zrušiť“ restores the previous viewBox exactly, moving into „Konica, podkrovie“ completes (server state checked) and restores the view.
- „Kto si?“ list and party form taller than the screen at 750x250, 750x390 with insets, 390x750, 320x480: scroll to the last button, last button above the bottom inset, sheet top below the top inset, page scroll stays 0,0.
- Code screen at the same sizes: board top visible (not cut off), button reachable by scrolling at 750x250.
- Landscape move bar is the same 100 px on a 250 px high window, which leaves the scene at about 0.43 px per unit (tiny but fully reachable, zoom works). Very short windows are an extreme case, so this is an observation, not a failure.

Failures: none. (Two harness mistakes of mine, a re-used state and a tap on the auto-opened „Kto si?“ panel, were not app bugs.)

Verdict: PASS, moved to `tasks/done/`. Not verifiable here and listed in `tests/manualne.md`: real iPhone Safari toolbar and notch, WhatsApp in-app browser, Android Chrome with the keyboard, real multi-touch pinch.
