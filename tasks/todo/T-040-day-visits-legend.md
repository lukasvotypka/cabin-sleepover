# T-040: Day visits in „Kto je kto“ and the party table

- **Phase:** 1
- **Depends on:** T-037, T-039
- **Size:** S

## Goal
Show day-only parties in „Kto je kto“ with a dashed border, a „☀ cez deň“ marker and their days instead of a night range, and keep them out of the per-night party table in the scene (organizer's decision of 24. 10. 2026; proposal "Informácie v scéne" → Kto je kto, Tabuľka partií). Look: mockup `/tmp/day-mock/index.html`, tab „Tabuľa“.

## Scope
- `static/js/logic-summary.js` (`legendRows`, `partyTableRows`, `partyTableSummary`), `static/js/app-sheet.js` (legend panel), `static/index.html` (CSS only)
- `tests/js/logic.test.mjs`

## Acceptance criteria
- [ ] `legendRows` adds `dayOnly`. For a day-only row `stay` is its days joined by „, “ (e.g. „Pi 30. 10., Ne 1. 11.“), followed by „ · “ + `arrival_time` when that is not empty. Overnight rows are unchanged.
- [ ] Legend panel: a day-only row has class `day-only` (dashed border via CSS in both light and dark mode), the meta line `"<people> · ☀ cez deň"`, a line with its days, and **no** per-night places line. All text via `textContent`.
- [ ] `partyTableRows` and `partyTableSummary` leave out day-only parties, so the scene table and its screen-reader lines list only overnight parties.
- [ ] The legend matches the per-night line to its party by `id`, not by array index (the two lists now differ in length).
- [ ] Node tests: `legendRows` for both kinds (with and without `arrival_time`), `partyTableRows`/`partyTableSummary` without day-only parties, and the „+N ďalšie“ count of the table not counting them.
- [ ] `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- The ☀ marker is only in the HTML panel (Alegreya Sans). Do not put ☀ into SVG scene text.
- „Kto si?“ keeps listing every party, day-only ones included (they can be „moja partia“).

---
## Dev log

## Review round 1

## Review round 2

## Test report
