# T-021: Stove chimney overlaps the room name in the kitchen

- **Phase:** 1
- **Depends on:** none
- **Size:** S

## Goal
In „Letná kuchynka“ the dark grey chimney square that `furn()` draws for bed kind `stove` sticks up over the room name and covers the letters „ch“ (bug report from the organizer with a screenshot). Fix it so that no furniture of any room covers a room name, window or door.

## Scope
- `static/index.html`: the stove drawing in `drawFurniture` and small pure helpers in the logic block.
- `tests/js/logic.test.mjs`, new `tests/test_map_layout.py`: regression tests.
- No change to bed rects, bed hit areas or `config/chata.yaml`.

## Acceptance criteria
- [x] The stove chimney no longer overlaps the room name „Letná kuchynka“ (checked in a headless Chrome screenshot at 380 px and zoomed in).
- [x] The fix is general: no room-specific coordinates in code, the chimney position derives from the bed rect.
- [x] A test checks that, for every room in `config/chata.yaml`, the furniture bounds of every bed do not overlap the room name band, the windows or the doors, and stay inside the room floor.
- [x] Bed rects and hit areas are unchanged, existing hit-area tests pass unchanged.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
Other rooms (sofas, bunks, mats, beds) checked in screenshots too. Slovak UI texts are not touched.

---
## Dev log
Cause: `drawFurniture` drew the stove pipe at `[x+w-12, y-6, 8, 8]`, i.e. 6 units above the stove rect. The kitchen name sits at y 341..352 (baseline 16 below the room top), so the pipe (y 346..354) covered „ch“.

Fix (small, general, no config change):
- New pure helper `stovePipeRect(bed)` in the logic block: `[x+w-2, y+4, 8, 8]`. The pipe now sticks out sideways on the right of the stove, never upward, and derives from the bed rect. `drawFurniture` uses it.
- New pure helpers `furnitureBounds(bed)` (bed rect plus the mats spaced beyond it and the stove pipe) and `roomLabelBand(room)` (`[x+7, y+7, w-14, 11]`, text baseline at y+16 for 11 px type). They exist for the regression tests.
- Bed rects, `bedHit`, `figurePositions` untouched; existing hit-area tests pass unchanged.

Tests added:
- `tests/js/logic.test.mjs`: furniture clear of the name band; furniture inside the room floor and clear of windows and doors; stove pipe does not rise above the stove, bounds of stove and mats.
- `tests/test_map_layout.py`: runs the same checks in Node against the real `config/chata.yaml` (the logic block is extracted from `static/index.html`), so a later layout edit that makes furniture collide is caught.

Commands and results:
- `node --test tests/js/` -> 161 pass, 0 fail.
- `uv run pytest -q` -> 383 passed.
- Headless Chrome (CDP, own server on port 8321, data in /tmp/t021, both stopped afterwards): screenshots of the kitchen at 380 px (3x) and zoomed (8x), plus the top rooms, the three right rooms and the whole map. Pipe now sits to the right of the stove, the name „Letná kuchynka“ is fully readable; sofas, bunks, mats and beds in the other rooms are clear of names, windows and doors.

Observation, not changed: the descender of „y“ in „kuchynka“ touches the top frame of the stove (stove top y=352, descender ends about 352.3). Only a layout change (stove a few units lower in `config/chata.yaml`) would remove it, so I left it to the organizer.

### Fixes after review round 1

- Blocker (furnitureBounds did not contain the pipe): fixed. `furnitureBounds(bed)` in `static/index.html` is now the real union (min x/y, max x2/y2, all four sides) of `bed.rect`, every mat (`[x+i*46, y, 32, h]`, as drawn by `drawFurniture`) and `stovePipeRect(bed)` for a stove. Other kinds draw only inside `bed.rect`, so they are covered by the rect itself. Existing expectations (`[22,352,62,28]` stove, `[24,132,124,26]` mats) are unchanged.
- Proof that the general tests now catch the bug: in a scratch copy at `/tmp/t021-mut` (outside the working tree, deleted afterwards) I put the old pipe back (`[r[0]+r[2]-12, r[1]-6, 8, 8]`). Results there: `node --test tests/js/` -> 159 pass, 2 fail: the generic test "furniture and the stove pipe stay out of the room name band" (`kuchynka-pec overlaps the name of kuchynka`) and the hand-written pipe test. `tests/test_map_layout.py` -> failed with `kuchynka-pec overlaps the name of kuchynka`. In the working tree (fixed code): `node --test tests/js/` -> 161 pass, 0 fail; `uv run pytest -q` -> 383 passed.
- Suggestion 3 (Node stderr): done. `tests/test_map_layout.py` now uses `check=False` and `assert done.returncode == 0, ...` with Node's stdout and stderr in the message.
- Suggestion 1 (the "y" graze): not changed. `config/chata.yaml` is untouched. For the organizer: moving the stove 3 units down (`rect: [22, 355, 56, 28]`) would remove it. The label band assumes about 2 units of descent, while the 11 px font drops about 2.5, which is why the test tolerates the touch.
- Suggestion 2 (selection/focus ring over room names): not touched, follow-up for the product owner.
- Nit (duplicated `windows` fixture in the JS test): left as is, the Python test reads the real file.

## Review round 1
(reviewer appends)

Checked: diff of `static/index.html`, `tests/js/logic.test.mjs` and the new `tests/test_map_layout.py`. Ran `node --test tests/js/`: 161 pass, 0 fail. Ran `uv run pytest -q`: 383 passed. Ran `tests/test_map_layout.py` alone: 1 passed. Checked visually in headless Chrome against my own server on port 8337 (data in /tmp/t021rev, server and Chrome stopped afterwards). Two parties were on the stove and one party was waiting. The views were 380 px wide at DPR 1 and 3, the kitchen zoomed 6x, the kitchen name zoomed 12x, and the top and bottom halves of the map.

Visual result: the pipe now sits at the right of the stove (x 76..84, y 356..364). „Letná kuchynka“ reads in full at every scale. The pipe stays clear of the kitchen wall (inner edge x 106), the top door [80,334,20,4], the windows and the other rooms. It is 8 units from the right stove figure (x 58..68), so it is also clear of the shirt letters. Walking figures move in a straight line, so they pass the pipe only for a moment, the same way they pass walls. That is not a collision. `bedHit`, `figurePositions` and the bed rects did not change, and the existing hit-area tests are untouched. The fix derives from the bed rect and has no room-specific coordinates.

### Blocker

1. **`static/index.html` lines 643-649, `furnitureBounds`: the bounds do not contain the pipe, so the general regression guard does not catch the bug from the report.** The stove branch only extends `x2`. The top, left and bottom of the result always come from `bed.rect`, and the result is not a union with `stovePipeRect(bed)`. Failure scenario: I put the old geometry back into a copy of the repo outside the working tree (`stovePipeRect` → `[x+w-12, y-6, 8, 8]`, which is exactly the organizer's bug). Then:
   - `tests/test_map_layout.py` **passes**, so the check against the real `config/chata.yaml` does not see the chimney in the name.
   - Both generic JS tests ("furniture and the stove pipe stay out of the room name band" and "furniture stays inside its room floor…") **pass**.
   - Only the hand-written assertion `pipe[1] >= stove.rect[1]` fails.

   So acceptance criterion 3 ("the furniture bounds of every bed do not overlap the room name band…") is only met in name. The helper's comment says "the box that the furniture of a bed really covers", and that is not true. Expected fix: make `furnitureBounds` the real union of everything `drawFurniture` draws. For a stove that means the union of `bed.rect` and `stovePipeRect(bed)` on all four sides (min x/y, max x2/y2); keep the mats rule. Then add a check that fails on the old geometry. For example, a JS test with a stub whose pipe rises above the rect should see `furnitureBounds` reach into `roomLabelBand`. Or simply state in the Dev log that the mutation above now makes the generic tests fail.

### Suggestion

1. **The "y" graze (stove top y 352, the descender ends at about 352.3, see `kitchen-label-zoom`).** At DPR 3 the tail of "y" sits on the grey frame of the stove by about one device pixel. At the normal 1x and 3x views it looks like the letter rests on the stove. It does not cover anything, and the word reads without trouble. You only notice it at about 6x zoom or more. It is older than this task: the stove rect has not changed. Removing it needs a config change, which is out of scope here. If the organizer wants it gone, a follow-up could move the stove down 3 units in `config/chata.yaml` (`rect: [22, 355, 56, 28]` still fits the floor, which ends at y 392). The band in `roomLabelBand` assumes a 2-unit descent, while monospace fonts at 11 px drop about 2.5 to 2.6 units. That is why the test allows the touch. Document this tolerance in the helper's comment, or widen the band to 12 once the layout moves.
2. **The selection ring and focus ring cover the room names (this bug is older than the task, and it is out of scope).** The ring is drawn at `bed.rect` ± 3 with stroke 2 (`static/index.html:2442-2443`). On the stove its top edge runs along y 348..350, right through the bottom of „Letná kuchynka“: with the ring forced on, the screenshot shows the letters cut off at the baseline. Its right edge also runs through the middle of the new pipe. The same thing should happen to the "p" of „Konica, podkrovie“ above the double bed. The ring is visible while the bed panel is open (`app.selectedBed`) and on keyboard focus. I suggest the product owner adds a follow-up task (for example, draw the ring inside the label band's limits, or lower the ring opacity behind the text). It does not block this task.
3. **`tests/test_map_layout.py`: Node is checked with `assert node`, not `pytest.skip`.** In this local setup with no CI that is consistent. Node is already required for `node --test tests/js/`, and `tests/` is kept out of the Docker image, so pytest never runs in the container. Failing loudly is better than silently dropping the guard, so keep it. One small improvement: `check=True` raises `CalledProcessError` without Node's stderr. Use `check=False` and `assert done.returncode == 0, done.stderr` so that a broken logic block shows a readable error.

### Nit

1. `tests/js/logic.test.mjs` hardcodes `windows` again next to the hardcoded `realLayout` fixture. That is acceptable because the Python test reads the real file, but the two copies can drift apart.

Verdict: CHANGES REQUESTED

## Review round 2
(reviewer appends)

Checked: the current diff of `static/index.html`, `tests/js/logic.test.mjs` and `tests/test_map_layout.py`, plus `drawFurniture` (around `static/index.html:2344`) and the room name drawing (`addText(g, r[0] + 7, r[1] + 16, …, 11, …)` at line 2104).

Round 1 blocker, fixed and verified independently:
- `furnitureBounds` (`static/index.html:643-657`) is now a real min/max union of `bed.rect`, every mat and `stovePipeRect(bed)` on all four sides.
- Mutation check in my own scratch copy at `/tmp/t021-rev2-*`, outside the working tree, now deleted. I copied `static/`, `tests/js`, `tests/test_map_layout.py` and `config/chata.yaml`, then restored the old pipe `[r[0] + r[2] - 12, r[1] - 6, 8, 8]`. Results:
  - `node --test tests/js/`: 161 tests, 159 pass, 2 fail. The failures are the generic "furniture and the stove pipe stay out of the room name band" (`kuchynka-pec overlaps the name of kuchynka`) and the hand-written pipe test. I confirmed that the JS test reads the scratch `static/index.html`.
  - `pytest tests/test_map_layout.py` against the scratch copy: 1 failed, with `kuchynka-pec overlaps the name of kuchynka`.
  
  So the general guard now catches the organizer's bug against the real `config/chata.yaml`.
- Mats bounds match `drawFurniture`: both use `[x + i*46, y, 32, h]` for each slot. Bed, bunk, sofa and cot kinds draw only inside `bed.rect`. The stove body is `bed.rect` and the pipe is `stovePipeRect(bed)`, which `drawFurniture` now uses directly, so the drawing and the bounds share one source.
- Round 1 suggestion 3 is done: the Python test uses `check=False` and puts Node's stdout and stderr in the assertion message.

Working tree runs: `node --test tests/js/` gives 161 pass, 0 fail. `uv run pytest -q` gives 383 passed. `tests/test_map_layout.py` alone gives 1 passed.

Final pass: there are no room-specific coordinates, and bed rects, `bedHit` and `figurePositions` are unchanged. No Slovak text is added and no `innerHTML` is used. `var pipe` inside the `switch` is fine because `var` is function-scoped. The scope stays within the task. No blockers.

### Suggestion
1. The open items from round 1 (the „y“ descender touching the stove, and the selection or focus ring over room names) still stand as follow-ups for the product owner or organizer. They are not part of this task.

Verdict: APPROVED

## Test report

Tester run, working tree at the commit `3bfa33c` plus the uncommitted T-021 changes. Nothing committed, no application code changed.

### Automated suites

| Command | Result |
| --- | --- |
| `node --test tests/js/` | 161 pass, 0 fail (includes the 3 new T-021 tests) |
| `uv run pytest -q` | 383 passed |
| `uv run pytest -q tests/test_map_layout.py` | 1 passed |

### Acceptance criteria (checked by me, not from the Dev log)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Stove chimney does not overlap „Letná kuchynka“ (headless Chrome, 380 px and zoomed) | PASS | Chrome 380 px, DPR 3, and zoomed crops (2x clip, plus the page's own wheel zoom to viewBox 24.8 18.3 235 495). The pipe is at the right of the stove (DOM box 76,356,8,8). The whole name reads. Only the „y“ tail touches the stove top, the known follow-up. |
| 2 | Fix is general, no room-specific coordinates, pipe derives from bed rect | PASS | `stovePipeRect(bed)` = `[x+w-2, y+4, 8, 8]`. A grep of the added lines in `static/index.html` finds no „kuchyn“, „kitchen“ or „letn“. `config/` and `app/` are unchanged. |
| 3 | Test: every bed's furniture bounds stay out of the name band, windows, doors and floor, for every room in `config/chata.yaml` | PASS | `node --test` 3 tests pass. `tests/test_map_layout.py` runs them on the real config. |
| 4 | Bed rects and hit areas unchanged, existing hit-area tests unchanged | PASS | `git diff` of `tests/js/logic.test.mjs` has only added lines (0 removed). `bedHit`, `figurePositions` and the bed rects are not in the diff. |
| 5 | `node --test tests/js/` and `uv run pytest -q` pass | PASS | Table above. |

### Mutation check (the guards catch the bug)

In a scratch copy at `/tmp/t021-tester/mut` (outside the working tree) I restored the old pipe `[x+w-12, y-6, 8, 8]`:
- `node --test tests/js/`: 159 pass, 2 fail: „furniture and the stove pipe stay out of the room name band“ and „the stove pipe sticks out sideways“.
- `tests/test_map_layout.py`: fails with `kuchynka-pec overlaps the name of kuchynka`.

### Visual and DOM check (headless Chrome, my own server on port 8461, temp data in /tmp/t021-tester/data, both stopped afterwards)

- Test data: 3 parties and 5 bookings on 3 nights, so the map shows occupied and free beds.
- The DOM was read from the rendered SVG: 43 furniture rects in 12 bed groups, mapped to map units with `getScreenCTM`. Room names were read from the rendered `text` elements.
- Result against windows, doors and floors: no furniture overlaps a window, a door, or leaves its room floor.
- Result against room names with the text's full box (font ascent + descent, 13 units tall): two overlaps, both analysed on screenshots:
  - Stove vs „Letná kuchynka“: box overlap of 1 unit at the descent. In the ink this is the „y“ tail only, the known follow-up.
  - Bed1 „Manželská“/„Jednomiestna posteľ“ (`konica-hore-jedno`, rect `[118,44,24,34]`) vs „Konica, podkrovie“: box overlap of 1 unit at the top of the bed. No ink overlaps, because the only descender in that name is the „p“ at about x 70, far from x 118. The bed rect is not part of this task, and the test uses the 11-unit band, which passes. Recorded as an observation, not a failure.
- Screenshots viewed: whole map 380 px, kitchen, „Konica, podkrovie“, „Konica, dole“, „Izba vľavo“, „Chodbička“, „Izba vpravo“, and the kitchen after the app's own wheel zoom. Furniture, mats, sofa, cots and bunks are all clear of names, windows and doors.

### Extra scenarios

- `POST /api/join` with the correct code gives 200 and the page loads the map, so the cookie path works. Not further tested here (covered by the API tests).
- Reduced motion was on during the screenshots, so the intro and blink did not affect the captures.
- Touch and real-device checks (iPhone Safari, Android Chrome, sharpness of the „y“ tail at 1x) are not done by the tester. They are covered by the existing item "Room labels" in `tests/manualne.md` section 5 („Letná kuchynka“ touches the stove pipe. Look at both on a phone.). No new item needed.

### Observations (not failures, not part of this task)

1. The „y“ tail of „kuchynka“ touches the stove top. Known follow-up. Fix needs a config change (`rect: [22, 355, 56, 28]`), out of scope.
2. The selection and focus ring (`rect.ring`, bed rect ±3) cuts through the room names. Known follow-up.
3. The label band in the helper (11 units) is shorter than the rendered text box (13 units), so the bed1 box overlap in „Konica, podkrovie“ is not caught. No ink overlap, so no bug today. If the organizer moves a label or a bed, the helper band should be widened to 13 units.

### Verdict

All 5 acceptance criteria pass. No regressions (the full suites include the tests of all tasks in `tasks/done/`). No bug report. Task moved to `tasks/done/`.
