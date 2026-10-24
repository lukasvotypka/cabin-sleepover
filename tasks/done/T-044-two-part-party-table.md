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
- [x] Pure `dayColumnLabel(iso)` → „Št 29“, „Pi 30“, „So 31“, „Ne 1“ (`DAY_SHORT` + day of month); "" for a bad date.
- [x] Pure `dayTableRows(state, myPartyId)` → one row per day-only party in `state.parties` order: `{id, label, color, mine, cells}` with one cell per `eventDays` day, the cell text = `adults + kids` on its `day_visits` days, else "".
- [x] Pure `foodRow(state)` → one `foodCount(state, day)` per event day (0 included, shown as „0“).
- [x] Pure `partyTableLayout(rect, nightRows, dayRows, nightCount, dayCount)` replaces the old one: fixed row height, returns the drawn height (≤ `rect[3]`, grows with the rows) and for each part the rows to draw, the `more` count, the column x positions and widths. Overflow rule (proposal „Otvorené rozhodnutia“, Tabuľka partií, keď sa nezmestí): the day part gets at least `min(dayRows, 2)` lines, the night part the rest; a part that does not fit draws `lines − 1` rows plus a `moreText` line. The night columns are the rightmost three of the day columns, as in the mockup.
- [x] Node tests for the layout with the real `map.scene.parties`: 8 overnight + 2 day-only parties fit with no "+N"; 0 parties and 0 day-only parties give header, divider, day header and food row only; 15 overnight + 4 day-only show "+N" in both parts and stay inside the rect; height grows with the rows. Node tests for `dayColumnLabel`, `dayTableRows` (empty, two parties, mine flag), `foodRow`.
- [x] `drawPartyTable` draws the board only as tall as the layout height: moon and sun drawn from `rect`s (no emoji or ☀ characters in SVG), „Noc“ and „Cez deň“ headers, selected night column header and my party row yellow as today, `under` and `over` cells as today, day cells on a yellow chip, a divider line, „spolu na jedlo“ row in bold. All text through `addText`/`textContent`; fixed scene colours, unchanged in dark mode.
- [x] The table is drawn always, also with no day-only party (default in „Otvorené rozhodnutia“, Tabuľka partií, časť „Cez deň“). One `role="button"` with `aria-label` „Kto kde spí po nociach, kto príde cez deň a koľko vás je na jedlo. Ťuknutím otvoríš „Kto je kto“.“, hit area = the drawn board, opens „Kto je kto“ (`openLegend("parties")`).
- [x] `uv run pytest` and `node --test tests/js/` pass. `tests/manual.md` gets one item for the look of the table on a 380 px phone (moon, sun, food row, "+N").

## Notes for developer
- `nightTally`, `tableCellText`, `partyTableRows`, `moreText` stay; only the layout function changes signature, so update its caller and old tests together.
- Name widths follow the mockup: about 106 units in the night part, 78 in the day part; cut long names with `maxWidth` / `ellipsize`.
- Food per day: keep the T-039 rule in `foodCount` only; do not reimplement it.

---
## Dev log
- Logic (`static/js/logic-summary.js`): added `dayColumnLabel`, `dayTableRows`, `foodRow` (uses `foodCount`); `partyTableLayout(rect, nightRows, dayRows, nightCount, dayCount)` replaced. Fixed row 8.5, head 10; returns `height`, `night`/`day` parts `{headY, y0, rows, more, lines, nameW, colX}`, `dividerY`, `ruleY`, `foodY`. Capacity for 136 high rect is 11 lines. Overflow: day part keeps `min(dayRows, 2)` lines.
- Drawing (`static/js/app-draw.js`): `drawPartyTable` rewritten after mockup B, plus `drawMoon`/`drawSun` from rects; new colours in `COLORS` (`static/js/app-core.js`).
- Tests: `tests/js/logic.test.mjs` (layout 8+2, 0+0, 15+4, growth, min day lines, dayColumnLabel, dayTableRows, foodRow, drawPartyTable source check); old layout tests and caller updated. Real rect `[176,112,196,136]` is a constant in the test, because the `scene` fixture there is older (`parties: [176,112,148,82]`).
- `tests/manual.md`: one new item.
- Commands: `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` (262 pass), `uv run pytest` (502 pass).
- Two drawing criteria stay unticked: written to the spec and covered by source-shape tests only.
- Not verified in a browser: the look of the drawing (only `node --check` and source-shape tests); please check on the trial server. With 0 overnight parties the night part shows only its header (no „Zatiaľ tu nikto nie je.“), as the task says.
- Follow-up outside scope: the stale `scene` fixture in the tests still has the old `parties` rect.

## Review round 1
Ran `node --test tests/js/` (262 pass) and `uv run pytest` (502 pass). All `static/js/*.js` are listed in `index.html` with `?v=__ASSET_VERSION__` (no new script).

Geometry checked against mockup B (`/tmp/day-mock2/index.html`): head 10, row 8.5, divider at night end + 2, sun header at + 5, rule at day end + 1, food row at + 3, names at `nameX + 10`, baselines `rowH/2 + size·0.35`. All match. `height = 42.5 + lines·8.5`, which is exactly 136 at 11 lines.

Rendered `drawPartyTable` (the real logic and app scripts) in headless Chrome with the scene monospace font in four cases: 8+2, 0+0, 15+4 with long names, and 8+0 with long names. I compared each text's `getBBox` with its column (harness `/tmp/t044-review/harness.html`):
- Night headers „Št → Pi“ are 25.2 wide in 28 columns (285/313/341). Cells like „1/2!“ and „11/2“ are 15.6 wide inside the 24-wide chips.
- Day headers „Št 29“ … „Ne 1“ are 14–18 wide inside their columns (257/285/313/341). The day chips' 2-digit numbers are 7.8 wide, under the 10 maxWidth.
- „spolu na jedlo“ spans 182.0–236.8, before the first day column at 257.
- Ellipsized names are at most 243.8, with a day limit of 257 and a night limit of 285. „+7 ďalších“ and „+3 ďalšie“ fit.
- No text got `textLength` squeezing.
- 15+4 ends at y 248, the rect bottom, with the food text bottom at 244.6. The 0+0 board is 42.5 tall.
- The screenshot matches the mockup look: moon and sun from rects, yellow selected night header and my row, red and amber chips, yellow day chips, bold food row.

No blockers.

- **Suggestion:** with nobody signed up (0+0) the board is 42.5 units tall. That is about 42.5 px on a 380 px phone, just under the 44 px target height, though it is 196 wide. It is acceptable, but a minimum height (or keeping a „Zatiaľ tu nikto nie je.“ line in the night part when there are no overnight parties) would fix it and also tell people why the night part is empty.
- **Suggestion:** in my own day-only row, the `dayBand` chips sit on the `selected` yellow row background, so the chip outline is barely visible. The number stays readable (`dayInk`), so this is cosmetic.
- **Suggestion (follow-up, outside scope):** the `scene` fixture in `tests/js/logic.test.mjs` still has the old `parties` rect, so the layout tests use the `REAL_PARTIES_RECT` constant instead.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

**Tester:** T-044, 24. 10. 2026. **Result: PASS** (all 8 criteria; no regressions). Moved to `tasks/done/`.

### Automated suite (run once)
- `uv run pytest -q` → 502 passed (4.00 s).
- `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` → 262 pass, 0 fail, 0 skipped.
- Regressions: `tasks/done/` work is covered by these suites (both green).

### Visual check (installed Google Chrome in `--headless=new`, driven over CDP, real page, temp servers)
Temp servers on 8030, 8031 and 8032 with temp `data/` dirs under `/tmp/t044-test/`, all stopped afterwards. Mobile emulation 380 px wide, DPR 2, group cookie from the real `/api/join`, loading intro waited out.
- **8030 "seeded":** 8 overnight parties (2 of them 4 people, 6 with long names, one 60-char name) placed on nights 29 and 30; 3 day-only parties incl. two on Pi 30 (5 people each) and one with a long name, one on three days.
- **8031 "empty":** no parties.
- **8032 "overflow":** 15 overnight (no beds) + 4 day-only (3 on Pi 30, 1 on So 31); one night cell over-placed (4/3) to show the „over“ cell.
- Extra: seeded with my party = Pinkovci (day row) and = Hrubí (night row), seeded in dark colour scheme.
- Screenshots: `/tmp/t044-test/{seeded,empty,overflow,overflow-over,seeded-dark,seeded-mine-day,seeded-mine-night}-table.png`, plus `seeded-tapped.png`, `empty-tapped.png`.

### Pure functions on the live API states (`/tmp/t044-test/logic-check.cjs`, real `logic-*.js` in a vm)
- `dayColumnLabel`: „Št 29“, „Pi 30“, „So 31“, „Ne 1“; bad date and "" → "".
- `dayTableRows` (seeded): 3 rows in state order, cells "5" on their visit days only, "" elsewhere; mine flag false with no my-party.
- `foodRow`: seeded 20 / 35 / 25 / 11; empty 0 / 0 / 0 / 0; overflow 45 / 51 / 47 / 0. I checked by hand against the T-039 rule (union of the presence on the night before and the night of, plus day visitors): all four match. The rule itself is not changed by T-044.
- `partyTableLayout(rect=[176,112,196,136], …)`: seeded 8+3 → height 136, bottom 248 = rect bottom, no „+N“. Empty → height 42.5, only header, divider, day header and food row. Overflow 15+4 → night 8 rows + „+7 ďalších“, day 1 row + „+3 ďalšie“ (day part gets 2 lines), height 136, bottom 248.

### Acceptance criteria
| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `dayColumnLabel` | pass | vm run above |
| 2 | `dayTableRows` | pass | vm run; screenshot cells 5 on visit days |
| 3 | `foodRow` (0 shown as „0“) | pass | 20/35/25/11, empty 0/0/0/0; hand-checked against the T-039 rule |
| 4 | `partyTableLayout` (fixed row, height ≤ rect, min(dayRows,2) day lines, rightmost 3 day columns for night) | pass | layout values above; night columns sit under Št 29–Ne 1 with the day columns in the same grid |
| 5 | Node tests for layout, label, rows, food | pass | 262/262 |
| 6 | `drawPartyTable` drawing (moon/sun from rects, headers, yellow selected night and my row, under/over cells, day chips, divider, bold food row, fixed colours) | pass | screenshots: moon and sun drawn, no emoji; yellow „Št → Pi“ header; yellow „Hrubí“ and „Pinkovci“ rows when set as my party; red „0/3!“ under chips; outlined amber „4/3“ over cell; day cells on yellow chips; divider and bold „spolu na jedlo“. Board bounding box 136 px (seeded/overflow) and 42.5 px (empty) = layout height. Dark colour scheme: scene and table identical to light. Text ellipsized, nothing overlaps. |
| 7 | Table always drawn; one `role="button"`, exact `aria-label`, hit area = drawn board, opens „Kto je kto“ | pass | seeded and empty: `role=button`, `tabindex=0`, label text equal to the criterion string as read back from the DOM; mouse click at the centre opens „Kto je kto“ with the party list (`seeded-tapped.png`, empty too) |
| 8 | pytest and node pass; manual item for the 380 px table | pass | 502 / 262 pass; `tests/manual.md` line 155 has the item (moon, sun, food row, „+N“, tap and Enter/Space, dark mode) |

### Reviewer's suggestion: empty-state height below 44 px
Measured on the page at 380 px (1 SVG unit = 1 CSS px): the empty board is **42.5 px tall** and 196 px wide (`getBoundingClientRect`). That is 1.5 px under the 44 px touch target of CLAUDE.md, and it is the state a first visitor sees before anyone signs up. It is not an acceptance criterion of T-044, so I did not fail the task for it. Not fixed (application code is out of scope for the tester). Decision for the orchestrator or organizer: add a minimum height of 44 px to the empty layout (the extra space needs no content), or keep the 42.5 px board with a „Zatiaľ tu nikto nie je.“ line in the night part as the reviewer also suggested. The second reviewer note (day chips on the yellow selected row) is visible but readable in the screenshots: cosmetic only.

### Extra scenarios
- Long names (60 chars, and „Dlhé Rodinné Meno…“) are cut with „…“ in both parts and do not reach the next column.
- Over-placed cell („4/3“) and under-placed cells („0/3!“) both render with their own style.
- No console errors and no uncaught exceptions on any page load (`page errors: []`).
- Tab order: the board is focusable (`tabindex=0`).

### Failures
None.

### Not verifiable here (manual, already in `tests/manual.md`)
- Look on a real 380 px iPhone Safari and Android Chrome, light and dark (line 155). Nothing added: the existing item covers this.
- Tap with a real finger and Enter/Space with a keyboard on a phone.
