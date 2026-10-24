# T-041: Day visits board in the scene

- **Phase:** 1
- **Depends on:** T-039, T-040
- **Size:** M

## Goal
A small board on the grass lists the day visitors per day, so the map still shows everything (organizer's decision of 24. 10. 2026; proposal "Informácie v scéne": positions come from `map.scene` in `config/cabin.yaml`, nothing hardcoded). Look: the „Cez deň (návšteva)“ sign in mockup `/tmp/day-mock/index.html`, tab „Tabuľa“.

## Scope
- `config/cabin.yaml` (`map.scene.days`, `map.viewbox`), `app/models.py` (`SceneRects.days`), `tests/test_models.py`, `tests/test_map_layout.py` (only if needed)
- `static/js/logic-summary.js` (sign lines), `static/js/app-draw.js` (`drawDays`, called from `drawBoards`)
- `tests/js/logic.test.mjs`

## Acceptance criteria
- [ ] `map.scene.days` is a required `Rect`. The current grass is full (boards, roofs, chimney smoke, paths), so the default grows the scene downward: `viewbox: [380, 488]` and `days: [16, 432, 220, 48]`, under the bottom path and left of the status board. `test_models.py` is updated for the new viewbox; all three tests in `tests/test_map_layout.py` pass unchanged (no overlap with rooms, boards, roofs, smoke).
- [ ] Pure `daySignLines(state, maxChars)` → `[]` when there is no day-only party, else the heading „Cez deň“ and one line per `dayVisitRows` row, `"<label>  <name> (<people>), …"`, cut with `ellipsize` to `maxChars`.
- [ ] Pure `daySignLabel(state)` → screen-reader text, e.g. „Cez deň prídu: piatok 30. 10. Jakub, 1 človek; sobota 31. 10. Katka a Peťo, 2 ľudia“.
- [ ] `drawDays` draws the board only when `daySignLines` is not empty: paper face and wooden edge in the fixed scene colors (like the party table, unchanged in dark mode), monospace text set via `textContent`, a few-pixel sun drawn from `rect`s next to the heading (no ☀ character in SVG).
- [ ] The board is `role="button"`, `tabindex="0"`, `aria-label` = `daySignLabel`, hit area = the whole rect (≥ 44 units tall), and tap or Enter/Space opens „Kto je kto“ (same handler as the legend icon).
- [ ] Node tests: `daySignLines` (empty, one day, two visitors on one day, long names ellipsized), `daySignLabel` plurals.
- [ ] `uv run pytest` and `node --test tests/js/` pass. No hardcoded `412`/`428`/`488` in `static/` (the layout test already checks `412`).

## Notes for developer
- Zoom, pan and fit read `map.viewbox`, so a taller scene needs no code change; check on a 380 px wide phone that the board is reachable by scrolling/panning and the status board and meadow still fit.
- The position and the "hidden when empty" behaviour are analyst defaults listed in `proposal.md` → „Otvorené rozhodnutia“; the organizer may move the rect in `cabin.yaml` only.
- `tests/conftest.py` reads the real `config/cabin.yaml`; any test that builds a layout by hand needs the new `days` key.

---
## Dev log

## Review round 1

## Review round 2

## Test report
