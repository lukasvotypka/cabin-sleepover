# T-046: One-time intro zoom hint, and docs for the new scene

- **Phase:** 1
- **Depends on:** T-044, T-045
- **Size:** M

## Goal
Organizer's decision of 24. 10. 2026 (scene redesign, item 4): when the splash is gone and the map shows, a slow one-time zoom tells the user the map can be moved. Default (proposal „Otvorené rozhodnutia“, Úvodné priblíženie): start 2× zoomed on the top part of the scene (title, signposts, table) and ease out over 2.8 s to the fitted view. Then update CLAUDE.md and the proposal's scene description for T-042 to T-046.

## Scope
- `static/js/logic-view.js` (pure helpers), `static/js/app-zoom.js`, `static/js/app-boot.js` (start after the fall), `static/js/logic-model.js` (constants)
- `tests/js/logic.test.mjs`, `tests/manual.md`
- `CLAUDE.md` („Frontend behaviour worth knowing“ and the `cabin.yaml` viewBox line), `proposal.md` („Informácie v scéne“: Nástenka, Tabuľka partií, Tabuľka s partiou a stavom; „Vzhľad“ table sentence)

## Acceptance criteria
- [ ] Pure `introStartView(bounds, W, H)` → a view at zoom 2 (`viewZoom` = 2), horizontally centred on the scene, top edge at the scene top, valid for `clampView`. Pure `introViewAt(from, to, t)` → eased (ease-in-out) interpolation, `t` clamped to [0, 1], exactly `from` at 0 and `to` at 1. Constants `INTRO_ZOOM_MS = 2800`, `INTRO_ZOOM_START = 2`.
- [ ] Node tests: start view zoom and position for a 375×667 and a 1280×800 viewport; `introViewAt` at 0, 0.5 (between), 1, and out-of-range `t`.
- [ ] The animation runs once per page load, right after the splash finishes (after the fall, or after the reduced-motion hide), driven by `requestAnimationFrame` through `setView`. Polls and re-renders do not restart it; a re-render during it keeps it running or ends it at the fitted view, never jumps back.
- [ ] Any `pointerdown`, `touchstart`, `wheel` or key press on the map, a resize, opening a panel or the move mode stops it at once at the current view (no snap), so the touch that stopped it acts on what is under the finger. Focus is not moved by the animation.
- [ ] Under `prefers-reduced-motion` it does not run; the map shows the fitted view. „Celá mapa“ stays hidden while it runs.
- [ ] CLAUDE.md: the scene paragraph says the „?“ opens „Návod“ as a centred window, the party table has „Noc“ and „Cez deň“ parts with „spolu na jedlo“, „Si: …“ and the status are a fixed bottom HUD outside the SVG, plus the one-time intro zoom; viewBox 380×496. Proposal bullets say the same in Slovak, citing the organizer's decision of 24. 10. 2026. Nothing else in either file changes.
- [ ] `uv run pytest` and `node --test tests/js/` pass. `tests/manual.md` gets one item: the intro reads as „the map can move“, stops on first touch, absent with reduced motion.

## Notes for developer
- Reuse `setView`, `clampView`, `wholeView` from the zoom code; do not add a second view model.
- The end view is `wholeView(app.bounds)` with the HUD inset from T-045, read when the animation starts.
- Do not edit the „Otvorené rozhodnutia“ list; the analyst already added the defaults.

---
## Dev log

## Review round 1

## Review round 2

## Test report
