# T-047: Party table: day columns aligned under night columns

- **Phase:** 1
- **Depends on:** T-044
- **Size:** S

## Goal
Organizer's decision of 24. 10. 2026 (approved mockup, `/tmp/day-mock2/index.html`, variant B): in the two-part party table the „Cez deň“ columns (Št 29, Pi 30, So 31, Ne 1) sit under the „Noc“ columns, so every day column is at the same x as its night column: Št 29 above/below Št → Pi, Pi 30 with Pi → So, So 31 with So → Ne. The fourth column (Ne 1) has no night, so it stays empty in the „Noc“ part (a deliberate gap because nobody sleeps on Sunday night).

## Scope
- `static/js/logic-summary.js` (`partyTableLayout`), `static/js/app-draw.js` (`drawPartyTable`), `tests/js/logic.test.mjs`, `tests/manual.md` (only if an item mentions the old column positions)

## Acceptance criteria
- [x] Both parts use the same four column x positions (column width 28, right-aligned in the board, `colX` for the day part = the night part's columns shifted so that night i and day i share a column). Night columns use the first three, the fourth is empty in the „Noc“ part.
- [x] The blue „Noc“ header band spans the full width including the empty fourth column (default; do not stop it at „So“).
- [x] Night labels stay „Št → Pi“, „Pi → So“, „So → Ne“ (fit the 28-unit column, as now). Name width, row height, overflow rows and „spolu na jedlo“ placement are unchanged (it still ends before the first column).
- [x] Generalised for events with a different number of nights/days: the columns are laid out by `days.length` (the larger count), night column i is under day column i.
- [x] Node tests: layout test checks that `colX` of night i equals `colX` of day i, and that the empty fourth night column has no cell drawn.
- [x] Looked at in a headless Chrome screenshot (technique in /tmp/t044-test, /tmp/t045-test) with 8 overnight parties and 3 day-only ones.
- [x] `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
- uv and node are in /opt/homebrew/bin.
- Open decision (default used): header band across the full width.

## Dev log

- `partyTableLayout` (`static/js/logic-summary.js`) now builds one right-aligned grid of `max(nightCount, dayCount)` columns (width 28). The day part uses all of it, the night part uses the first `nightCount` (`night.colX` is shorter, so no header or cell is drawn in the empty fourth column). Both parts have the same `nameW` (78), so night names are now as narrow as day names. Row height, overflow rows and the food row are unchanged.
- `drawPartyTable` in `static/js/app-draw.js` needed no change: it already indexes `colX[i]`, and the header bands already span `innerW` (the blue „Noc“ band covers the empty fourth column).
- Tests in `tests/js/logic.test.mjs`: replaced the old "rightmost columns" test with one checking night `colX` equals day `colX` for the first three and that the fourth night column is empty, plus a grid test for more nights than days and equal counts; `assertTableInside` now checks the right edge on the day part.
- `tests/manual.md`: no item mentions the old column positions, so unchanged.
- Screenshot (headless Chrome, 8 overnight + 3 day-only, `/tmp/t045-test/h47-full.png`): Št 29 / Pi 30 / So 31 sit under Št → Pi / Pi → So / So → Ne, Ne 1 has no night column, the blue band spans the full width, and the table has no errors on the page.
- Commands: `node --test tests/js/` (271 pass), `uv run pytest` (501 pass).

## Review round 1

Checked `git diff` of `static/js/logic-summary.js` and `tests/js/logic.test.mjs`, `drawPartyTable` in `static/js/app-draw.js` (unchanged, lines 294-368), and the screenshot `/tmp/t045-test/h47-full.png`. Ran `node --test tests/js/` (271 pass) and `uv run pytest` (501 pass). All scripts in `static/js/` are listed in `index.html` with `?v=__ASSET_VERSION__`; no new script was added.

- `partyTableLayout` builds one right-aligned grid of `max(nightCount, dayCount)` columns. Night i and day i share x, and the night part's `colX` is cut to `nightCount`. `drawPartyTable` draws night headers and cells only per night (`nights.forEach`, `row.cells` per night), so nothing is drawn in the empty fourth column. The „Noc“ band spans `innerW`. The food row and „spolu na jedlo“ use `day.colX` and `day.nameW`, as before.
- The screenshot matches: Št 29 / Pi 30 / So 31 sit under Št → Pi / Pi → So / So → Ne, Ne 1 has no night column, and the blue band runs the full width.
- Tests cover alignment, the empty fourth column (`night.colX.length === 3`), more nights than days, and equal counts.

**Blocker:** none.

**Suggestion**
- The night name width went from 106 to 78, so night names are cut sooner (e.g. „Novákovci z B…“). The alignment rule forces this because night column 0 now sits at day column 0. That conflicts with the AC wording "name width ... unchanged", but the Goal's layout makes it unavoidable, and the Dev log says so openly. Worth telling the organizer.
- `assertTableInside` now checks the right edge only on the day part. If a future test passes more nights than days, the helper would fail even though the layout is correct. You could check `max(night, day)` columns instead. This does not matter for current callers.

Verdict: APPROVED (round 2 skipped, no blockers)

## Test report

Tester: 24. 10. 2026. Scope: layout logic, rendered table in headless Chrome, edge inputs. No application code changed.

**Commands and results**
- `uv run pytest -q`: 498 passed, 3 failed in `tests/test_map_layout.py` (`Node is required`). Cause: pytest could not find `node` on PATH (`/opt/homebrew/bin` is not on the default PATH here, environment only). With `PATH=/opt/homebrew/bin:$PATH uv run pytest -q`: **501 passed**.
- `node --test tests/js/` (with homebrew on PATH): **271 pass, 0 fail**.
- Headless Chrome, own servers on ports 8031/8032/8033 with temp data in `/tmp/t47-test/{a,c,empty}/data`, killed afterwards. Screenshots: `/tmp/t47-test/a-table.png` (8 overnight + 3 day-only), `/tmp/t47-test/empty-table.png` (no parties), `/tmp/t47-test/c-table.png` (15 overnight + 4 day-only, long names), `/tmp/t47-test/wide2-table.png` (14 W, 14 m, 20 W names). Page errors: none in any run.
- Node probe of `partyTableLayout` (HEAD vs working tree) for 8+3, 0+0, 3 nights/0 days, 0 nights/4 days, and a 40-unit rect.

**Acceptance criteria**

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Same four column x in both parts; night i shares x with day i; night part uses first three | PASS | Probe: night x [257, 285, 313] = day x first three of [257, 285, 313, 341]; Node tests at `tests/js/logic.test.mjs:1079` and `:1090`; screenshots |
| 2 | Blue „Noc“ band spans full width incl. empty fourth column | PASS | `a-table.png`, `c-table.png`: band runs to the right edge over Ne 1 |
| 3 | Night labels „Št → Pi“ etc. unchanged; row height, overflow rows, „spolu na jedlo“ placement unchanged | PASS, with note | Labels and food row unchanged on screen; +7 / +3 overflow lines unchanged in layout. Night name width is 78 (was 106 at HEAD); see note 1 below |
| 4 | Generalised by `max(nights, days)`; night i under day i | PASS | Tests at `:1090` (5 nights / 3 days, equal counts); probe 3n/0d and 0n/4d behave as expected |
| 5 | Node tests: colX alignment and empty fourth night column | PASS | Test `:1079` asserts `night.colX.length === 3` and `night.colX` equals `day.colX.slice(0, 3)`. No Node test drives `drawPartyTable` itself; the empty cell is verified only on screen (note 4) |
| 6 | Screenshot with 8 overnight + 3 day-only | PASS | `a-table.png`: Št 29 under Št → Pi, Pi 30 under Pi → So, So 31 under So → Ne; Deň B on Pi 30, So 31, Ne 1 as expected; food totals 20 / 26 / 24 / 12 match a hand count |
| 7 | `uv run pytest` and `node --test tests/js/` pass | PASS | 501 pass (with PATH, see above); 271 pass |

**Extra scenarios tried**
- Empty event (no parties): header bands, aligned day labels, zero food totals, no errors (`empty-table.png`).
- 15 overnight + 4 day-only with long names (`c-table.png`): night names cut at 14 characters with „…“ and clear of the Št column; day part shows one row and „+3 ďalšie“ (the existing overflow rule keeps `min(dayRows, 2)` lines).
- Wide glyphs: 14 × „W“ and 14 × „m“ night names fit before the first column; a 20 × „W“ day-only name is clipped to 14 characters plus „…“ and stays inside its column.
- Layout edge inputs: no parties, 3 nights / 0 days, 0 nights / 4 days, and a 40-unit rect. The 40-unit rect returns height 60, which is the same at HEAD, so it is pre-existing and not caused by T-047.
- Regression: `tasks/done/` tests are part of the full pytest and Node runs above, and all pass.

**Notes for the organizer (not failures)**
1. Criterion 3 says the name width is unchanged, but the night name area went from 106 to 78. The Goal requires it: night column 0 must sit at day column 0, which is four columns from the right. Names are actually cut by `ellipsize(name, 14)` (`logic-summary.js` lines 119 and 140), not by width, so on screen nothing changed. The 14-character cut is also the same in both parts. I passed this criterion with the note because the user accepted the 78 width.
2. With the 14-character cut, the eight synthetic „Skupina číslo…“ rows in the 15-party case look identical, so only the colour swatch tells them apart. Real names would differ. Whether to allow longer names or width-based cutting is an organizer decision.
3. The „Pi → So“ and „So → Ne“ headers have only about 3 units between them. They are readable but close. Added to the manual checklist.
4. The empty fourth night column is checked by the layout test (`colX` length) and by the screenshot. No Node test drives `drawPartyTable`. That is a small gap and I did not add a test for it.

**Manual (added to `tests/manual.md`):** one new item „Party table day columns (T-047)“ before „Party table (T-023)“: iPhone Safari and Android Chrome, light and dark mode, column alignment, empty fourth night column, and 14-character truncation.

**Bugs:** none.

**Verdict:** PASS. Moved to `tasks/done/`.
