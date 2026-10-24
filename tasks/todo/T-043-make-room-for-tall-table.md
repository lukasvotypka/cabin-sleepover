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
- [ ] Shift Δ = 56 (default). Moved down by Δ: the rects of rooms `left`, `hallway`, `right`, `kitchen` and all their beds; every door except the konica door `[80, 172, 20, 6]`; both windows; paths `[240, 332, …]`, `[60, 412, …]`, `[96, 296, …]`; scene `letter`, `key`, `status`, `meadow`. The vertical path `[84, 174, 12, 176]` keeps its top and becomes `[84, 174, 12, 232]`.
- [ ] Unchanged: konica rooms and beds, `houses`, `title`, `nights`, `locked`, `legend`.
- [ ] `parties: [176, 112, 196, 136]` (full width under the signposts), `notice: [24, 316, 44, 44]` (the „?“ icon, left under the „Kto je kto“ icon), `viewbox: [380, 496]`.
- [ ] `map.scene.days` is removed from `cabin.yaml` and `SceneRects`; `drawDays`, `daySignLines`, `daySignLabel`, `DAY_SIGN_CHARS` and their Node tests are gone. `grep -rn "daySign\|drawDays\|DAY_SIGN_CHARS\|scene.days" static app tests` prints nothing. `dayVisitRows` and `foodCount` stay (summary, „Kto je kto“).
- [ ] All tests in `tests/test_map_layout.py` pass, including the roof/chimney/smoke check against the new `parties` rect and `test_meadow_hit_area_stays_clear_of_other_scene_boards` (meadow hit area ends at y 496 = viewbox height). `test_models.py` matches the new viewbox and scene rects.
- [ ] No layout numbers in `static/` (the existing `412` check passes; also no `492`/`496` in `static/`).
- [ ] `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
- The numbers are the defaults in proposal „Otvorené rozhodnutia“ (Miesto pre vyššiu tabuľku, Ikona „?“). If a layout test fails with Δ = 56, report it rather than inventing a new layout.
- Until T-044 the existing `drawPartyTable` draws in the larger rect (more rows fit; the paper board fills the whole rect). That is expected for this task.
- Day visitors are missing from the scene between this task and T-044 (still in „Kto je kto“ and the summary).
- `SceneRects` forbids extra keys, so `days` must go from `cabin.yaml` in the same change. `tests/conftest.py` reads the real `cabin.yaml`; layouts built by hand in tests need the same keys.
- Grass tufts are placed by viewbox height, so the grass pattern changes; that is fine.

---
## Dev log

## Review round 1

## Review round 2

## Test report
