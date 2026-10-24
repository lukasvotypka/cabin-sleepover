# T-043: Make room for the tall party table and drop the „Cez deň“ board

- **Phase:** 1
- **Depends on:** T-042
- **Size:** M

## Goal
Organizer's decision of 24. 10. 2026 (scene redesign, item 1, variant B): the party table under the signposts becomes one long table, so the main house and everything below it move down, data-driven in `config/cabin.yaml` (proposal "Rozloženie chaty"). The separate day-visitors board of T-041 is removed; T-044 brings the day visitors into the table. Look: mockup `/tmp/day-mock2/index.html`, tab B.

## Scope
- `config/cabin.yaml`, `app/models.py` (`SceneRects`), `tests/test_models.py`, `tests/test_map_layout.py` (only if needed)
- `static/js/app-draw.js` (remove `drawDays`), `static/js/logic-summary.js` (remove `daySignLines`, `daySignLabel`), `static/js/app-core.js` (remove `DAY_SIGN_CHARS`), `tests/js/logic.test.mjs`

## Acceptance criteria
- [x] Shift Δ = 56 (default). Moved down by Δ: the rects of rooms `left`, `hallway`, `right`, `kitchen` and all their beds; every door except the konica door `[80, 172, 20, 6]`; both windows; paths `[240, 332, …]`, `[60, 412, …]`, `[96, 296, …]`; scene `letter`, `key`, `status`, `meadow`. The vertical path `[84, 174, 12, 176]` keeps its top and becomes `[84, 174, 12, 232]`.
- [x] Unchanged: konica rooms and beds, `houses`, `title`, `nights`, `locked`, `legend`.
- [x] `parties: [176, 112, 196, 136]` (full width under the signposts), `notice: [24, 316, 44, 44]` (the „?“ icon, left under the „Kto je kto“ icon), `viewbox: [380, 496]`.
- [x] `map.scene.days` is removed from `cabin.yaml` and `SceneRects`; `drawDays`, `daySignLines`, `daySignLabel`, `DAY_SIGN_CHARS` and their Node tests are gone. `grep -rn "daySign\|drawDays\|DAY_SIGN_CHARS\|scene.days" static app tests` prints nothing. `dayVisitRows` and `foodCount` stay (summary, „Kto je kto“).
- [x] All tests in `tests/test_map_layout.py` pass, including the roof/chimney/smoke check against the new `parties` rect and `test_meadow_hit_area_stays_clear_of_other_scene_boards` (meadow hit area ends at y 496 = viewbox height). `test_models.py` matches the new viewbox and scene rects.
- [x] No layout numbers in `static/` (the existing `412` check passes; also no `492`/`496` in `static/`).
- [x] `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
- The numbers are the defaults in proposal „Otvorené rozhodnutia“ (Miesto pre vyššiu tabuľku, Ikona „?“). If a layout test fails with Δ = 56, report it rather than inventing a new layout.
- Until T-044 the existing `drawPartyTable` draws in the larger rect (more rows fit; the paper board fills the whole rect). That is expected for this task.
- Day visitors are missing from the scene between this task and T-044 (still in „Kto je kto“ and the summary).
- `SceneRects` forbids extra keys, so `days` must go from `cabin.yaml` in the same change. `tests/conftest.py` reads the real `cabin.yaml`; layouts built by hand in tests need the same keys.
- Grass tufts are placed by viewbox height, so the grass pattern changes; that is fine.

---
## Dev log

- `config/cabin.yaml`: viewbox `[380, 496]`; rooms `left`, `hallway`, `right`, `kitchen` and their beds, doors (except the konica door), windows, paths, scene `letter`, `key`, `status`, `meadow` moved down by 56; vertical path is now `[84, 174, 12, 232]`; `parties: [176, 112, 196, 136]`, `notice: [24, 316, 44, 44]`; `scene.days` removed.
- `app/models.py`: dropped `days` from `SceneRects`.
- Removed `drawDays` (`static/js/app-draw.js`), `daySignLines` and `daySignLabel` (`static/js/logic-summary.js`), `DAY_SIGN_CHARS` (`static/js/app-core.js`) and their 3 Node tests (`tests/js/logic.test.mjs`). `dayVisitRows` and `foodCount` kept.
- `tests/test_models.py`: new viewbox and scene rects. `tests/test_map_layout.py` needed no change.
- Commands: `uv run pytest` gives 502 passed (layout, roof/chimney and meadow checks pass with delta 56, no new layout needed). `node --test tests/js/` gives 252 passed. The grep for `daySign|drawDays|DAY_SIGN_CHARS|scene.days` in `static app tests` prints nothing, and there is no `492`/`496`/`412` in `static/`.
- Not checked visually in a browser. Docs (proposal, README) still mention the day board; left for T-046.

## Review round 1

Checked the diff for `config/cabin.yaml`, `app/models.py`, `tests/test_models.py`, `static/js/app-core.js`, `app-draw.js`, `logic-summary.js` and `tests/js/logic.test.mjs` against the acceptance criteria. Ran `uv run pytest` (502 passed) and `node --test tests/js/` (252 passed).

- Shift by hand: every listed rect moved by exactly +56 (rooms `left`/`hallway`/`right`/`kitchen` and their 8 beds, 4 doors with konica door `[80, 172, 20, 6]` untouched, both windows, the 3 paths, `letter`, `key`, `status`, `meadow`). The vertical path is now `[84, 174, 12, 232]` and still ends at the kitchen top (406). Konica, `houses`, `title`, `nights`, `locked` and `legend` are unchanged. `parties`, `notice` and `viewbox` match the spec.
- Scene check: the main roof is now `[114, 252, 262, 16]` and the chimney `[164, 248, 6, 10]`. The smoke column `[164, 220, 11, 28]` ends at x 175, one unit left of `parties` (x 176), the same margin as before. The table ends at y 248, 4 above the roof. The tree (x 0-8, y 142-184) and the bird (outside the SVG) do not depend on the layout. Grass tufts, the bed-label popup, the zoom/pan setup and the ground all read `viewbox`, so nothing in code is tied to the old height. `notice` (y 316-360) sits 8 below `legend` and clear of the vertical path (x 84). The bottom stack (`status` 482, path 484, meadow hit area) fits inside 496.
- Removal: the grep prints nothing, there is no `412`/`492`/`496` in `static/`, and `dayVisitRows`, `foodCount`, `ellipsize`, `DAY_NAMES` and `peopleCountText` are still used elsewhere, so no dead helpers are left. Every `static/js/*.js` is listed in `index.html` with `?v=__ASSET_VERSION__`.

No blockers.

Suggestion: the smoke runs within 1 unit of the left edge of the taller table along its full height (y 220-248). It is not a defect, but the organizer may want to look at it on the phone.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester: claude-haiku-5-5 (tester), date 2026-10-24.

### Automated suite (once, full)
- `uv run pytest -q` gives 502 passed in 3.98 s (same count as the developer's run).
- `node --test tests/js/` gives 252 pass, 0 fail.
- `grep -rn "daySign\|drawDays\|DAY_SIGN_CHARS\|scene.days" static app tests` prints nothing (exit 1).
- `grep -rn "492\|496\|412" static` finds only a hash constant in `logic-boot.js` (`1274126177`), not a layout number.
- `dayVisitRows` and `foodCount` are still in `static/js/logic-summary.js` and `tests/js/logic.test.mjs`.

### Layout diff against HEAD
- Script (`/tmp/t043-test/check_shift.py`, comparing `git show HEAD:config/cabin.yaml` with the working tree) shows every listed rect at exactly +56 (rooms left, hallway, right, kitchen and their beds; the 4 doors other than the konica door; both windows; paths `[240,332]`, `[60,412]`, `[96,296]`; scene `letter`, `key`, `status`, `meadow`). The vertical path is `[84,174,12,232]`.
- Konica rooms and beds, `houses`, `title`, `nights`, `locked` and `legend` have no diff.
- `parties` is `[176,112,196,136]`, `notice` is `[24,316,44,44]`, `viewbox` is `[380,496]`, and `scene.days` is gone.

### Browser checks (temporary server on 127.0.0.1:8030, temp data dir, test secrets, preview tab at 380 px wide, reuseExistingTab=false)
- Joined with the group code, created one party (2 adults) through „Pridať sa“.
- Bed tap, assign and unassign (each via the sheet's „Zapísať sem“ and „Uvoľniť“, checked against `/api/state`): left-double, hallway-sofa, right-bunk-1, kitchen-stove, konica-upper-double, konica-lower-mats. Every house was covered and the server state matched each step.
- Meadow tap opens the places panel („Štvrtok“, 1 place missing). „?“ (notice) opens „Návod“ with the four steps. „Kto je kto“ (legend) lists the party with its day chips.
- Wheel zoom-in, then a touch-style drag downward: the visible map range reaches y ≈ 812 in map units, so the new bottom (meadow at y 453-467, status at y 394-482, viewBox bottom 496) is reachable.
- `document.documentElement.scrollWidth` is 380 at 380 px, both before and after zoom: no horizontal overflow.
- Text „Cez deň“ is absent from the page. The scene icons `notice`, `legend`, `parties`, `status`, `letter` and `meadow` do not overlap each other by their bounding boxes.
- Cleanup: the 8030 server is killed (port closed), `/tmp/t043-test/data` is removed, and the preview tab is closed.

### Acceptance criteria
| # | Criterion | Result |
|---|---|---|
| 1 | Shift Δ=56 for listed rooms, beds, doors, windows, paths, scene rects; vertical path `[84,174,12,232]` | PASS (script diff) |
| 2 | Konica rooms and beds, `houses`, `title`, `nights`, `locked`, `legend` unchanged | PASS (script diff) |
| 3 | `parties`, `notice`, `viewbox` match the spec | PASS |
| 4 | `days` removed from cabin.yaml and `SceneRects`; day board code and tests gone; grep empty; `dayVisitRows`, `foodCount` kept | PASS |
| 5 | `tests/test_map_layout.py` passes (roof, chimney, meadow hit area ends at 496); `test_models.py` matches | PASS (502 passed) |
| 6 | No layout numbers in `static/` (`412`, `492`, `496`) | PASS |
| 7 | `uv run pytest` and `node --test tests/js/` pass | PASS (502 / 252) |
| 8 (browser, 380 px) | Beds tappable in every house, assign and unassign | PASS (6 beds, 5 houses), taps dispatched by JS (see below) |
| 9 (browser) | Meadow tap, „Kto je kto“ and „?“ icons open their panels | PASS |
| 10 (browser) | Zoom and pan reach the new bottom | PASS |
| 11 (browser) | No horizontal overflow at 380 px | PASS (scrollWidth 380) |

### Not verified
- Screenshots: `preview_snapshot` (with and without `save`) and `preview_click` timed out in the preview tab at 15 s, even after making the tab visible. So the visual result (overlap, roof and chimney against the table, the smoke column, grass) was NOT seen by eye. The geometry checks above and the pytest layout tests are the only evidence.
- Taps were dispatched as DOM `click` events through JavaScript, not as real pointer or touch input. So touch hit-testing, the long-press path and the drag-versus-tap distinction on a real device were not exercised.
- The key icon (`key`) is not in the DOM for a non-admin. That matches phase 1 but its position could not be checked.
- iPhone Safari and Android Chrome: see the new item in `tests/manual.md` (T-043 phone check).

### Observations (not failures)
- The old manual item for the „Cez deň“ board (T-041, `tests/manual.md`) describes a board this task removes. It is stale. T-046 (docs) should drop it or update it. I did not edit it.
- At 380×800 freeform, the default view shows a band of ground below y 496. This is the fit to the taller viewport, not a layout error, but the organizer may want to see it on a phone.

### Decision
All 11 criteria pass (7 automated, 4 browser; the screenshot part is unverified as noted). No regressions: `tasks/done/` tests are part of the 502 passed. Task moved to `tasks/done/`.
