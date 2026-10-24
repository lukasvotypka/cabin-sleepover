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
- [x] `map.scene.days` is a required `Rect`. The current grass is full (boards, roofs, chimney smoke, paths), so the default grows the scene downward: `viewbox: [380, 492]` and `days: [16, 440, 220, 48]`, under the bottom path and left of the status board. `test_models.py` is updated for the new viewbox; all three tests in `tests/test_map_layout.py` pass unchanged (no overlap with rooms, boards, roofs, smoke).
- [x] Pure `daySignLines(state, maxChars)` → `[]` when there is no day-only party, else the heading „Cez deň“ and one line per `dayVisitRows` row, `"<label>  <name> (<people>), …"`, cut with `ellipsize` to `maxChars`.
- [x] Pure `daySignLabel(state)` → screen-reader text, e.g. „Cez deň prídu: piatok 30. 10. Jakub, 1 človek; sobota 31. 10. Katka a Peťo, 2 ľudia“.
- [x] `drawDays` draws the board only when `daySignLines` is not empty: paper face and wooden edge in the fixed scene colors (like the party table, unchanged in dark mode), monospace text set via `textContent`, a few-pixel sun drawn from `rect`s next to the heading (no ☀ character in SVG).
- [x] The board is `role="button"`, `tabindex="0"`, `aria-label` = `daySignLabel`, hit area = the whole rect (≥ 44 units tall), and tap or Enter/Space opens „Kto je kto“ (same handler as the legend icon).
- [x] Node tests: `daySignLines` (empty, one day, two visitors on one day, long names ellipsized), `daySignLabel` plurals.
- [x] `uv run pytest` and `node --test tests/js/` pass. No hardcoded `412`/`428`/`488` in `static/` (the layout test already checks `412`).

## Notes for developer
- Zoom, pan and fit read `map.viewbox`, so a taller scene needs no code change; check on a 380 px wide phone that the board is reachable by scrolling/panning and the status board and meadow still fit.
- The position and the "hidden when empty" behaviour are analyst defaults listed in `proposal.md` → „Otvorené rozhodnutia“; the organizer may move the rect in `cabin.yaml` only.
- `tests/conftest.py` reads the real `config/cabin.yaml`; any test that builds a layout by hand needs the new `days` key.

---
## Dev log

- Config and model: `SceneRects.days` (required `Rect`), `map.viewbox: [380, 488]`, `map.scene.days: [16, 432, 220, 48]`; `tests/test_models.py` updated (viewbox and `SCENE`). `tests/test_map_layout.py` unchanged and passing.
- Logic (`static/js/logic-summary.js`): `daySignLines(state, maxChars)`, `daySignLabel(state)`, plus `partyTableEmptyText(state)` for the small fix. Label detail: several parties on one day are joined with "; " (same as days), e.g. „sobota 31. 10. Katka a Peťo, 2 ľudia; Lenka, 5 ľudí“.
- Page: `drawDays` in `static/js/app-draw.js`, called from `drawBoards` (paper face, wooden edge, sun from `rect`s, monospace text via `addText`/`textContent`, whole rect is the hit area, `makeButton` with key `days` opens `openLegend("days")`). Up to 4 day rows fit in 48 units (6.5 px text, 7.5 pitch). `DAY_SIGN_CHARS = 46` in `app-core.js`.
- Small fix: the hidden list „Kto kde spí po nociach“ says „Zatiaľ tu nikto nespí.“ when parties exist but none sleeps (tested in `partyTableEmptyText`). Left alone: the same „Zatiaľ tu nikto nie je.“ in the party table on the map and in `openLegend` (out of scope; the table draws nothing different for day-only parties, follow-up if wanted).
- Tests: `node --test tests/js/` (255 pass), `uv run pytest` (502 pass). New Node tests: `daySignLines` (empty, one day, two on a day, ellipsize), `daySignLabel`, `partyTableEmptyText`.
- Not done: I did not look at the board in a browser or on a 380 px phone (no rendering done here); the tester should check the look, the reach by scroll/pan and that the status board still fits.

## Review round 1

Tests run by the reviewer: `node --test tests/js/` 255 pass, `uv run pytest` 502 pass. No new scripts, so nothing to add in `index.html`. No `412`/`428`/`488` in `static/`. Logic, labels, `textContent`, `role="button"` via `makeButton`, the „Kto je kto“ handler and the Node tests all match the criteria.

**Blocker**

1. `config/cabin.yaml:22` (`days: [16, 432, 220, 48]`) vs. `static/js/logic-beds.js:184` (`meadowHitRect`). The meadow button's hit rect is `[meadow.x, meadow.y - 1, meadow.w, 44]` = `[112, 396, 124, 44]`, so y 396..440. It was built to reach past the old scene bottom (428). The new board covers x 16..236 and y 432..480, so the two overlap at x 112..236, y 432..440. `drawDays` is in the `boards` layer, which sits above the `beds` layer where the meadow is drawn (`app-scene.js:115-120`). Scenario: a day-only party exists and my party has people waiting on the meadow. Taps on the bottom 8 units of the meadow target now open „Kto je kto“ instead of the places panel, and the meadow target shrinks to 36 units, under the 44 px rule. `test_scene_boards_stay_clear_of_rooms_and_each_other` misses this because it compares the `meadow` rect (14 tall), not its hit rect. Fix: keep the board clear of the meadow hit rect, e.g. `days: [16, 440, 220, 48]` with `viewbox: [380, 492]` (or `[16, 440, 220, 44]` with 488; then re-check that 4 rows still fit). Update `test_models.py` to match, and add a check in `tests/test_map_layout.py` (now needed, so in scope) that `meadowHitRect(scene.meadow)` does not overlap any other `scene` rect, using the page logic as the other checks do. Also fix the `meadowHitRect` comment, since the hit area no longer necessarily reaches "past the scene bottom".

**Suggestion**

- `drawBase` places the 70 grass tufts with `(i * 97) % (H - 8)`, so the taller viewbox moves every tuft on the whole map, not just the new strip. This is harmless (rooms, paths and boards are drawn over them), but the tester should expect the grass pattern to look different.
- CLAUDE.md and the proposal still say viewBox 380×428. Ask the orchestrator to update them, since the agents read those values.

**Nit**

- `DAY_SIGN_CHARS` in `app-core.js` sits between the two `*_HIT_GROW` constants. Put it next to them or after them.

Verdict: CHANGES REQUESTED

## Dev log, round 1 fixes

- Blocker: fixed. `days` moved to `[16, 440, 220, 48]` and `viewbox` to `[380, 492]` in `config/cabin.yaml`, so the board starts at the end of the meadow hit rect (y 396..440). Height stays 48, so 4 rows still fit. `tests/test_models.py` updated. New `test_meadow_hit_area_stays_clear_of_other_scene_boards` in `tests/test_map_layout.py` runs `meadowHitRect` in Node and checks it against every other `scene` rect and the viewbox. Comment of `meadowHitRect` in `static/js/logic-beds.js` reworded.
- Suggestion (grass tufts move): noted, nothing to change; the tester should expect a different grass pattern.
- Suggestion (CLAUDE.md / proposal): `CLAUDE.md` line 74 now says 380×492; `proposal.md` "Otvorené rozhodnutia" T-041 item updated to the new numbers. The proposal's 380 × 412 example (lines 257, 267) describes the approved preview, so it is left alone.
- Nit: `DAY_SIGN_CHARS` moved after `NIGHTS_HIT_GROW` in `app-core.js`.
- Tests: `uv run pytest` (503 pass), `node --test tests/js/` (255 pass).

## Review round 2

Tests run by the reviewer: `uv run pytest` 503 pass, `node --test tests/js/` 255 pass. No `412`/`428`/`488`/`492` in `static/`.

Round-1 blocker: fixed. `days: [16, 440, 220, 48]` and `viewbox: [380, 492]` in `config/cabin.yaml`. The meadow hit rect `[112, 396, 124, 44]` ends at y 440, so it touches the board's top edge without overlapping it (strict `<` in the overlap check). The new `test_meadow_hit_area_stays_clear_of_other_scene_boards` runs the real `meadowHitRect` through Node and checks it against every other `scene` rect and the viewbox bottom. With the old `days` y of 432 it would have failed, so it catches the regression. `test_models.py`, the `meadowHitRect` comment, CLAUDE.md (380×492) and the proposal's open-decision item now match. The nit is done as well.

No new blockers in the fix diff.

Verdict: APPROVED

## Test report

Tester (round 1), commands and results:
- `uv run pytest -q`: 503 passed.
- `node --test tests/js/`: 255 pass, 0 fail.
- Temporary server `uvicorn` on 127.0.0.1:8031 with temp data dir and test secrets (stopped, temp dir removed). `/api/health` 200. `/data/cabin-data.yaml`, `/data/audit.yaml`, `/config/cabin.yaml`, `/files/mapa-nahlad.html`, `/app/main.py`, `/static/../data/...` all 404.
- `grep` for `412|428|488|492` in `static/`: only a hash constant in `logic-boot.js`, no layout numbers.
- Browser (t3-code preview, iPhone SE preset 375×667, DOM and JS checks only): preview screenshots and snapshots timed out (`preview_snapshot`, `device_screenshot`), so no visual check was possible.

Seeded through the API: Jakub (1 adult, Št 29. + Pi 30.), Katka a Peťo (2 adults, So 31.), Lenka Mikulášová-Hronská z Vysokých Tatier so svojou dcérou (3+2, Pi 30. + So 31., 60-char name), and the overnight Rodina Novákova (2+2, my party, no beds, waits on the meadow).

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `days` required Rect, viewbox [380,492], days [16,440,220,48], layout tests pass | pass | `config/cabin.yaml`; in-page `viewBox` 0,-91.9,380,675.9 (fit); pytest green |
| 2 | `daySignLines` [] or heading + one line per row, ellipsized | pass | Node tests; in-page board lines cut at 46 chars with „…“ |
| 3 | `daySignLabel` screen-reader text with plurals | pass | aria-label in page: „Cez deň prídu: štvrtok 29. 10. Jakub, 1 človek; piatok 30. 10. …; sobota 31. 10. Katka a Peťo, 2 ľudia; …“ |
| 4 | `drawDays` only when lines non-empty; paper/wood fixed colours; monospace via textContent; sun from rects, no ☀ in SVG | pass (DOM); look = manual | zero visitors: no `data-key=days`; with visitors: rects #F4EBD0 / #5C4033 / #D4A870 / sun rects #C98A1C, #FFD54A; font ui-monospace…; no emoji in SVG texts |
| 5 | role=button, tabindex 0, aria-label, hit = whole rect ≥44 units, tap/Enter/Space opens „Kto je kto“ | pass | role/tabindex/label verified; hit rect 220×48 (≈47 CSS px at 375 px); click opens „Kto je kto“ with day-only rows; keydown Enter and Space both open it |
| 6 | Node tests for daySignLines and daySignLabel | pass | `tests/js/logic.test.mjs` lines ~2979–3014 |
| 7 | pytest and node green, no hardcoded 412/428/488 in static | pass | see above |

Placement and overlap (in-page `elementFromPoint` at the real scale 0.987 px/unit): board y 440–488 starts exactly where the meadow hit rect ends (396–440); point (150, 439.5) hits `meadow`, (150, 440.5) hits `days`. The status board (x 278–372, y 382–426) and the bottom path (y 412–424) are clear of the board (x 16–236, y 440–488). Kitchen stove and letter/legend icons are above y 404. Nothing overlaps.

Extra scenarios:
- zero day-only parties (fresh data): no board, no `days` button, all map buttons present, fit view shows the full scene.
- one to three day-only parties, one day with two visitors, one long name (60 chars): all rows shown, long rows ellipsized; the Lenka row is repeated under each of her days, correct.
- my party (overnight, waiting on the meadow): meadow button present, no overlap with the board (see above).
- keyboard: Enter and Space open „Kto je kto“.
- pan reach: `panRange` uses the full `viewbox` bounds, so the board at y 440–488 is inside the pan range; checked by reading code, not by dragging.

Not verified (no screenshots possible): the look (sun, paper, wood, text legibility at 6.5 units ≈ 6.4 CSS px, same size as other scene text), the zero-visitor look (taller empty grass strip), iPhone Safari and Android Chrome, VoiceOver/TalkBack. Added to `tests/manual.md` as two T-041 items.

Observation, not a T-041 failure: the meadow hit rect is 44 units tall (pre-existing `MEADOW_HIT_H`), about 43.4 CSS px at 375 px fit, just under 44 px. Not in T-041 criteria.

Verdict: all criteria pass in the automated and DOM checks. Visual checks remain in `tests/manual.md`. Moved to `done/`.
