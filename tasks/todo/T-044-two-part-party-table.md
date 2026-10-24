# T-044: Party table with „Noc“ and „Cez deň“ parts and „spolu na jedlo“

- **Phase:** 1
- **Depends on:** T-043
- **Size:** M

## Goal
Organizer's decision of 24. 10. 2026 (scene redesign, item 1, variant B): one long table under the signposts. Top part: pixel moon, „Noc“, a column per night, same cells as today. A divider. Bottom part: pixel sun, „Cez deň“, a column per event day, a row per day-only party, and a last row „spolu na jedlo“ (rule of T-039, `foodCount`). The whole table is one button that opens „Kto je kto“. Look: mockup `/tmp/day-mock2/index.html`, tab B.

## Scope
- `static/js/logic-summary.js` (rows and layout), `static/js/app-draw.js` (`drawPartyTable`), `static/js/app-core.js` (colours only if needed)
- `tests/js/logic.test.mjs`, `tests/manual.md`

## Acceptance criteria
- [ ] Pure `dayColumnLabel(iso)` → „Št 29“, „Pi 30“, „So 31“, „Ne 1“ (`DAY_SHORT` + day of month); "" for a bad date.
- [ ] Pure `dayTableRows(state, myPartyId)` → one row per day-only party in `state.parties` order: `{id, label, color, mine, cells}` with one cell per `eventDays` day, the cell text = `adults + kids` on its `day_visits` days, else "".
- [ ] Pure `foodRow(state)` → one `foodCount(state, day)` per event day (0 included, shown as „0“).
- [ ] Pure `partyTableLayout(rect, nightRows, dayRows, nightCount, dayCount)` replaces the old one: fixed row height, returns the drawn height (≤ `rect[3]`, grows with the rows) and for each part the rows to draw, the `more` count, the column x positions and widths. Overflow rule (proposal „Otvorené rozhodnutia“, Tabuľka partií, keď sa nezmestí): the day part gets at least `min(dayRows, 2)` lines, the night part the rest; a part that does not fit draws `lines − 1` rows plus a `moreText` line. The night columns are the rightmost three of the day columns, as in the mockup.
- [ ] Node tests for the layout with the real `map.scene.parties`: 8 overnight + 2 day-only parties fit with no "+N"; 0 parties and 0 day-only parties give header, divider, day header and food row only; 15 overnight + 4 day-only show "+N" in both parts and stay inside the rect; height grows with the rows. Node tests for `dayColumnLabel`, `dayTableRows` (empty, two parties, mine flag), `foodRow`.
- [ ] `drawPartyTable` draws the board only as tall as the layout height: moon and sun drawn from `rect`s (no emoji or ☀ characters in SVG), „Noc“ and „Cez deň“ headers, selected night column header and my party row yellow as today, `under` and `over` cells as today, day cells on a yellow chip, a divider line, „spolu na jedlo“ row in bold. All text through `addText`/`textContent`; fixed scene colours, unchanged in dark mode.
- [ ] The table is drawn always, also with no day-only party (default in „Otvorené rozhodnutia“, Tabuľka partií, časť „Cez deň“). One `role="button"` with `aria-label` „Kto kde spí po nociach, kto príde cez deň a koľko vás je na jedlo. Ťuknutím otvoríš „Kto je kto“.“, hit area = the drawn board, opens „Kto je kto“ (`openLegend("parties")`).
- [ ] `uv run pytest` and `node --test tests/js/` pass. `tests/manual.md` gets one item for the look of the table on a 380 px phone (moon, sun, food row, "+N").

## Notes for developer
- `nightTally`, `tableCellText`, `partyTableRows`, `moreText` stay; only the layout function changes signature, so update its caller and old tests together.
- Name widths follow the mockup: about 106 units in the night part, 78 in the day part; cut long names with `maxWidth` / `ellipsize`.
- Food per day: keep the T-039 rule in `foodCount` only; do not reimplement it.

---
## Dev log

## Review round 1

## Review round 2

## Test report
