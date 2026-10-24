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
- [x] `legendRows` adds `dayOnly`. For a day-only row `stay` is its days joined by „, “ (e.g. „Pi 30. 10., Ne 1. 11.“), followed by „ · “ + `arrival_time` when that is not empty. Overnight rows are unchanged.
- [x] Legend panel: a day-only row has class `day-only` (dashed border via CSS in both light and dark mode), the meta line `"<people> · ☀ cez deň"`, a line with its days, and **no** per-night places line. All text via `textContent`.
- [x] `partyTableRows` and `partyTableSummary` leave out day-only parties, so the scene table and its screen-reader lines list only overnight parties.
- [x] The legend matches the per-night line to its party by `id`, not by array index (the two lists now differ in length).
- [x] Node tests: `legendRows` for both kinds (with and without `arrival_time`), `partyTableRows`/`partyTableSummary` without day-only parties, and the „+N ďalšie“ count of the table not counting them.
- [x] `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- The ☀ marker is only in the HTML panel (Alegreya Sans). Do not put ☀ into SVG scene text.
- „Kto si?“ keeps listing every party, day-only ones included (they can be „moja partia“).

---
## Dev log
- `logic-summary.js`: `legendRows` adds `dayOnly` and, for day-only parties, `stay` = sorted days („Pi 30. 10., Ne 1. 11.“) plus „ · “ + `arrival_time` when set (new `dayOnlyStayText`). New `overnightParties(state)`; `partyTableRows` and `partyTableSummary` use it, so day-only parties are out of the scene table, its „+N ďalšie“ count (computed from `rows.length` in `drawPartyTable`) and its screen-reader lines.
- `app-sheet.js` legend: row class `day-only`, meta `"<people> · ☀ cez deň"`, a days line, no per-night line; the per-night row is looked up by party `id`, not by index.
- `index.html`: CSS only, `.legend-row.day-only { border-style: dashed; }` (border color is `var(--line)`, so it follows light and dark mode).
- Tester's T-039 observation: the hidden list „Kto kde spí po nociach“ was built from `partyTableSummary`, so day-only parties showed „nie je tu“. Now they are left out of it (they already appear with their days under „Návštevy cez deň“ from T-039). Tested.
- Existing `legendRows` test updated for the new `dayOnly: false` field; 5 new tests appended to `tests/js/logic.test.mjs`.
- Commands: `node --test tests/js/` (251 pass), `uv run pytest` (501 pass).
- Not verified visually in a browser.

## Review round 1
Ran `node --test tests/js/` (251 pass) and `uv run pytest` (501 pass). All 19 scripts in `static/js/` are listed with `?v=__ASSET_VERSION__`.

Each acceptance criterion is met. `legendRows` adds `dayOnly`, and the day-only `stay` is the sorted `dayLabel`s joined by „, “ plus „ · “ + `arrival_time`. The legend sets the `day-only` class, the meta line `people · ☀ cez deň` and the days line, and leaves out the nights line. Every value goes in via `htmlEl` with text, so `textContent`. The per-night row is looked up by `id`. `partyTableRows` and `partyTableSummary` share the new `overnightParties` filter, so `drawPartyTable`'s `rows.length` (and with it „+N ďalšie“) and the hidden „Kto kde spí po nociach“ list both drop day-only parties. The dashed border uses `var(--line)`, so it follows light and dark mode. ☀ appears only in the HTML panel and never in SVG text. „Kto si?“ is untouched. All required tests are present.

- **Blocker:** none.
- **Suggestion:** `static/js/app-draw.js:158` (outside this task's scope): when only day-only parties exist, the hidden list „Kto kde spí po nociach“ shows „Zatiaľ tu nikto nie je.“ and „Návštevy cez deň“ below it lists visitors, so the two lines contradict each other slightly. A later task could pick a neutral text (e.g. „Zatiaľ tu nikto nespí.“) for that case.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

**Result: PASS** (all criteria pass, no regressions). Tester: T-040 run on the current working tree (uncommitted).

### Commands
- `node --test tests/js/` → 251 pass, 0 fail.
- `uv run pytest -q` → 501 passed.
- Temp server: `GROUP_CODE=grp-test-040 ADMIN_CODE=adm-test-040-xyz SECRET_KEY=<40 x> uv run python -c "...create_app(data_dir='<tmp>/data')..."` on 127.0.0.1:8020, temp data dir, still running (see Cleanup).
- Created via API: „Overnight Test“ (2 adults, 1 kid, Št 29. 10. – So 31. 10.), „Denná Návšteva“ (day_visits So 31. 10. + Ne 1. 11., arrival_time „po obede“), „Iba Deň Bez Času“ (day_visits Pi 30. 10., no arrival time).
- `node` probe in a temp dir: loaded the `logic-*.js` files into a vm and ran `legendRows`, `partyTableRows`, `partyTableSummary` on the live `/api/state`. Output as expected (see below).
- Browser: t3-code preview tab, iPhone 12 Pro preset (390 px wide), joined with the group code, opened „Kto je kto“.

### Acceptance criteria
| Criterion | Result | Evidence |
| --- | --- | --- |
| `legendRows` adds `dayOnly`; day-only `stay` = days + „ · “ + arrival_time; overnight unchanged | PASS | Probe: „Denná Návšteva“ `dayOnly:true`, stay „So 31. 10., Ne 1. 11. · po obede“; „Iba Deň Bez Času“ stay „Pi 30. 10.“; overnight stay „Št 29. 10. – So 31. 10.“. Node test at logic.test.mjs:3026, 3039 |
| Legend: day-only row class `day-only`, dashed border light and dark, meta „<people> · ☀ cez deň“, days line, no per-night line | PASS | DOM at 390 px: both day-only rows `class="legend-row day-only"`, meta „1 dospelý · ☀ cez deň“ / „1 dospelý, 1 dieťa · ☀ cez deň“, days line, no „→“ line. Computed border `dashed` (light). Dark mode: `dashed rgb(71,56,43)` = `--line` #47382B; overnight row stays `solid`. Text via `htmlEl`/textContent |
| `partyTableRows` and `partyTableSummary` leave out day-only parties | PASS | Probe: table = [„Overnight Test“] only; summary = one line. Scene table in the page shows only „Overnight Test“ (0/3!, 0/3!, –). Hidden „Kto kde spí po nociach“ lists only Overnight Test |
| Legend matches night line by `id` | PASS | Code: `nightRows[r.id]` map (app-sheet.js). Visible result correct for 3 rows vs 1 table row (no misalignment: the overnight row shows its own nights line, day-only rows show none) |
| Node tests for both kinds (with/without arrival_time), table and summary without day-only, „+N ďalšie“ count | PASS | Tests present and passing: logic.test.mjs:3026, 3039, 3046, 3056, 3067. The „+N“ count is `rows.length` of `partyTableRows` (checked in code; the table has one row so no „+N“ shown on the page) |
| `node --test tests/js/` and `uv run pytest` pass | PASS | 251 / 501 |

### Extra scenarios
- Day-only party with and without `arrival_time` (both stay texts checked live).
- Two day-only parties plus one overnight: legend has 3 rows, table 1 row, no index mismatch.
- Light and dark mode computed style of the dashed border.
- Page overflow at 390 px: `document.documentElement.scrollWidth > innerWidth` is false with the panel open. Legend rows are 350 px wide, 89 px tall (over 44 px touch target).
- ☀ appears only in `static/js/app-sheet.js` (the HTML panel), not in SVG scene text.
- Node probe of `partyTableSummary` with only day-only parties is not run (reviewer's round-1 note: the hidden list says „Zatiaľ tu nikto nie je.“ when only day-only parties exist; this is outside T-040 scope and is not a failure here).

### Not verified (manual)
- Visual look of the dashed border and the ☀ glyph in Alegreya Sans: the preview's snapshot/screenshot timed out (3 attempts), so visual check was done via computed styles only. Added to `tests/manual.md` as „„Kto je kto“ with day-only parties (T-040)“ for iPhone Safari and Android Chrome.

### Cleanup
- The temp server on 127.0.0.1:8020 and its temp dir are still running/present. I tried to stop the server with `pkill`, but the command was declined, so I left it running. Stop it with the PID of the python process listening on 8020 (temp data only).
- `tests/manual.md` got one new checklist item (the only file I changed).
