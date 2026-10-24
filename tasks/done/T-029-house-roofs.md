# T-029: Roofs and chimneys on the three houses (with smoke)

- **Phase:** 1
- **Depends on:** none
- **Size:** M

## Goal
Draw a roof on each of the three houses of the pixel map and a chimney with gently rising grey smoke on each roof. Cosmetic, organizer-requested (24. 10. 2026), not derived from `proposal.md`. The roofs must never hide a bed, a room label or a tap target, and the layout stays data-driven (`config/cabin.yaml`).

## Scope
- `config/cabin.yaml`: add a `houses` list that groups rooms into houses (Konica = `konica-upper` + `konica-lower`; main house = `left` + `hallway` + `right`; kitchen = `kitchen`), each with its roof colors. Make room for the main house and kitchen roofs by shifting the southern part of the map down by 16 (see "Layout change").
- `static/index.html`: draw the roofs and chimneys in `drawBase` (next to `drawTree`) and the smoke animation in CSS. A pure function for a house's outline (union rect of its rooms) goes in the page-logic section so Node can test it.
- `app/models.py` / validation of the layout, if the layout is validated by Pydantic: accept and check the new `houses` list (every room id exists, every room is in exactly one house).
- Tests: `tests/test_map_layout.py` (new data), a Node test for the outline function, `tests/manual.md` (one checklist item).

## Layout change
The organizer chose option 3 of the proposal discussed on 24. 10. 2026: a trapezoid ("saddle roof seen at an angle") roof drawn above the top wall of each house. A mockup generator is in `/tmp/roof-mock/gen.py` (outside the repo, may be gone); the spec below is what counts.

- Roof shape: a stepped (pixel) trapezoid, **16 px high** (8 rows of 2 px), sitting directly on the top edge of the house. Bottom row = house width plus **4 px overhang on each side**. Each row up is inset more, to **16 px per side** at the top row. Alternating row shades, vertical shingle joints every 8 px (offset on alternate rows), 2 px darker side edges, a lighter 2 px ridge cap.
- Colors (fixed scene colors, not inverted in dark mode, put them in the `COLORS` table / the `houses` data): Konica rust `#B5532A` (dark `#8E3424`, ridge `#D69A2E`); main house dark red `#8E3424` (dark `#5A1F14`, ridge `#B5532A`); kitchen ochre `#D69A2E` (dark `#A8741C`, ridge `#F0C76A`).
- **Konica:** the roof fits in the free strip above it (y 10–26), nothing moves.
- **Main house and kitchen:** the main house has the noticeboard directly above it (ends at y 194, house starts at 196), so everything **from y 196 down moves 16 px down** and the `viewbox` height grows from 412 to 428: the three rooms of the main house with their beds, doors and windows; the kitchen with its stove; the paths (the vertical path from Konica gets 16 px longer, the bottom path and the stub paths shift); the `status`, `letter`, `key` and `meadow` scene rects. **Stay where they are:** Konica, the tree, `title`, `nights`, `notice`, `parties`, `locked` and `legend`. Re-check every rect against its neighbours after the shift.
- **Kitchen entrance (organizer decision):** the kitchen roof may simply cover the entrance at the top wall. Keep the door in the data and let the vertical path end at the roof edge. No gap in the roof.
- **Chimneys on all three roofs:** a small brick chimney (about 6×10 px, dark brick with a lighter top) standing on the roof near one end, drawn above the roof. Smoke: 3 grey pixel puffs per chimney (2–3 px squares, `#C9C9C9` / `#A9A9A9`) that rise about 24 px, drift slightly sideways and fade out, staggered with `animation-delay`, one loop of about 8–9 s. Same technique as `.shedleaf` (CSS keyframes, `transform-box: fill-box`, `px` units in translate), but grey and upward. Gentle and sparse. Different delays per chimney so they do not puff in sync.
- Everything is `aria-hidden`, `pointer-events: none`, `shape-rendering: crispEdges`.

## Acceptance criteria
- [x] `config/cabin.yaml` has the `houses` list and the shifted coordinates, `viewbox` height 428, and the layout still validates (startup check, `test_map_layout`). No hardcoded geometry for roofs in code: they are derived from `houses` and the room rects.
- [x] The three roofs are visible with the shape and colors above, each above its house, none overlapping a room label, bed, board, the tree or another roof.
- [x] After the shift nothing overlaps: boards, status/letter/key/meadow, paths, doors and windows line up with their rooms (reviewer compares old and new geometry).
- [x] Zoom, pan, fit-to-screen and the pan margin still work with the taller map (the functions read the viewbox from the layout; no hardcoded 412 left anywhere, `grep` for it).
- [x] Each roof has a chimney, each chimney has three smoke puffs that rise and fade on staggered delays; no sync between chimneys.
- [x] `prefers-reduced-motion: reduce` stops the smoke and everything stays static (puffs invisible).
- [x] Beds are still tappable everywhere, including those next to the roofs; roofs and smoke never intercept taps.
- [x] No `innerHTML` for anything, no changes to the write path or to the validation of bookings.
- [x] Tests: `uv run pytest` and `node --test tests/js/` pass, including the new outline test and updated layout tests.
- [x] Manually confirmed in a local run on a phone-width window (380 px) and desktop: roofs, chimneys, smoke, and the kitchen entrance covered by the roof; reduced motion emulated.

## Notes for developer
- The existing data in production uses slot ids, not coordinates, so moving rects does not touch bookings.
- Do not restart or deploy the trial server or production; run your own server on a free port other than 8000 and 8010.
- Keep the roof drawing and the chimney in separate small functions, like `drawTree`.

---
## Dev log
Implemented roofs and chimneys with smoke on the three houses.

**Data (`config/cabin.yaml`):** `viewbox` is now `[380, 428]`. Everything from y 196 down moved +16: rooms `left`, `hallway`, `right`, `kitchen` with their beds, doors, windows, the paths (`[240,332,16,96]`, `[60,412,196,12]`, `[96,296,24,12]`; the vertical path from Konica `[84,174,12,176]` is 16 longer), and the scene rects `status`, `letter`, `key`, `meadow`. Konica, tree, `title`, `nights`, `notice`, `parties`, `locked`, `legend` did not move. New top-level `houses` list (`id`, `rooms`, `roof: {face, dark, ridge}`, `chimney` = x of the chimney's left edge: konica 132, main 164, kitchen 90). The chimney x are my choice so that chimney and its smoke column stay clear of the noticeboard, Konica-lower and the legend (a test checks this).

**Model (`app/models.py`):** new `RoofColors`, `House`, `Layout.houses` (required, min 1). Validation: duplicate house id, unknown room, room in two houses, room in no house, chimney x outside the house width. `CHIMNEY_WIDTH = 6` is duplicated from the page (`CHIMNEY_W`), commented.

**Page (`static/index.html`):** pure functions in the logic script: `houseOutline(house, rooms)`, `roofRows(outline)`, `roofRect`, `chimneyRect` (roof constants next to them). In the app script: `drawRoof`, `drawChimney`, `drawHouses` (called from `drawBase` before `drawTree`), brick and smoke colors in `COLORS`, roof colors from `houses`. CSS `.smokepuff` / `@keyframes smokeRise` (8.7 s loop, puffs hidden at opacity 0 until their delay, 3 puffs per chimney 2.9 s apart, chimney number shifts the delays by 2.3 s each), `.roofs` has `pointer-events: none`, `aria-hidden`. The existing global reduced-motion rule (`animation: none !important`) stops the smoke, the puffs stay at opacity 0. `ensureScene` layout key now includes `houses`, so a changed `houses` redraws. No `innerHTML`.

**Roof shape:** 8 rows of 2 px, bottom row = house width + 4 px each side, insets 0,2,4,6,10,12,14,16 (rounded to even), alternating face/dark rows, 1 px shingle joints every 8 px (offset on alternate rows), 2 px dark side edges, ridge cap on the top row.

**Decisions to note:** (1) The Konica smoke rises above y 0 (outside the 380x428 viewbox, into the pan margin/ground); it fades out there. (2) The kitchen roof covers the door and the end of the vertical path (path kept 176 long, hidden under the roof, as the organizer decided; no gap). (3) Fixtures in `tests/js/logic.test.mjs` keep the old 380x412 numbers on purpose: they are self-contained test inputs, not the real layout (the grep for 412 in `static/` and `config/` is clean, `test_nothing_hardcodes_the_old_viewbox_height` guards the page).

**Tests:** `tests/test_models.py` (updated viewbox and `SCENE`, 6 new tests on `houses`), `tests/test_map_layout.py` (Node check: roofs, chimneys and smoke columns clear of rooms, scene boards, furniture, doors, windows, tree and other roofs, chimney on the ridge, roof shape; boards inside viewbox and not overlapping rooms/each other; no 412 in the page), `tests/js/logic.test.mjs` (outline, roof rows, roof/chimney rects), `tests/manual.md` (one item). I mutated the chimney x once to confirm the layout test fails on an overlap.

**Run:**
- `uv run pytest` -> 393 passed
- `node --test tests/js/` -> 206 pass, 0 fail

**Manual run (own server on port 8123, data in /tmp/t029, already stopped; headless Chrome via CDP):** 380 px mobile (viewBox `0 -166 380 760`), 1000 px desktop: all three roofs, chimneys, smoke puffs at different opacities (staggered), kitchen roof covers the entrance, nothing overlaps. With `prefers-reduced-motion: reduce` emulated: `animation-name: none`, all 9 puffs at opacity 0. Tap-through not tried by a real tap; the roof group has `pointer-events: none` (inherited by its rects) and the roof rects do not overlap any bed (test). Real-phone check is the new manual.md item.


## Review round 1
Reviewer (opus), 24. 10. 2026.

**Verified myself:** `uv run pytest` -> 393 passed; `node --test tests/js/` -> 206 pass, 0 fail. I ran my own server on port 8131 (temp data, stopped and removed afterwards). `/api/state` serves `layout.houses` and viewbox `[380, 428]`. In headless Chrome at 380 px and 1000 px, all three roofs, the chimneys and the smoke render as specified (561 roof rects, 9 puffs, staggered: the delays mod 8.7 s are c0 0/2.9/5.8, c1 2.3/5.2/8.1, c2 4.6/7.5/1.7, so no chimney puffs in sync with another). `elementFromPoint` 3 px below the top of every bed hits that bed (12/12). With `prefers-reduced-motion: reduce` emulated, all 9 puffs have `animation-name: none` and opacity 0, and the roofs stay.

**Geometry, old vs new (checked by hand):** every rect from y 196 down moved by exactly +16: the left, hallway, right and kitchen rooms with all their beds, the doors (218/264 x 256, 238 x 332, 80 x 350), the windows (y 212), the paths (hallway path 332..428 ends at the viewbox bottom, bottom path 412..424 sits under the kitchen at 412, stub 296..308), and status (338..426 inside 428), letter, key and meadow (397..411, above the bottom path). Konica, tree, title, nights, notice/parties, locked and legend did not move. Roofs: Konica 6..166 x 10..26 (title starts at x 176), main 114..376 x 196..212 (notice ends at y 194, locked ends at x 78, vertical path at x 84..96), kitchen 6..114 x 334..350 (left room starts at x 118). The main chimney (163..171 with its cap) and its smoke (up to x 174) stay left of the notice/parties board at x 176. The vertical path ends under the kitchen roof as decided. No hardcoded old coordinates or `412` left in `static/index.html` (grep).

**Constraints:** no `innerHTML`, the roofs are in the `aria-hidden` base layer below the beds with `pointer-events: none`, scene colors are fixed, there are no write-path or booking-validation changes, the code is in English, and roof geometry is derived from `houses` + room rects only.

### Blocker
None.

### Suggestion
1. `app/models.py:236-238`: the chimney check (`left <= chimney <= right - 6`) is looser than what the page draws. The chimney spans y outline−20..outline−10, so its foot rests on roof row 4 (inset 10 → x ≥ left + 6) and the ridge row is 16 px narrower per side. A config value such as `chimney: 118` for the main house passes startup validation but draws a chimney floating beside the slope. Only `test_roofs_and_chimneys_clear_of_everything` catches it, against the repo config, and not at startup for an organizer-edited file. Either check against the ridge span (`left − 4 + 16 ≤ x ≤ right + 4 − 16 − 6`) or say in the comment that the model check is only a coarse bound.
2. The Dev log lists "duplicate house id" as validated, but no test covers it (`tests/test_models.py`). Add a two-line test.
3. Konica smoke above y 0 (Dev log decision 1): at the desktop fit view (`viewBox -77.5 0 535 428`) the top of the map is y 0, so the Konica puffs are clipped almost at once and that chimney looks smokeless. At 380 px the pan margin shows them. List this for the organizer, or let the tester note it in the manual check.
4. README line 189 explains editing `cabin.yaml`. Add one sentence: every room must belong to exactly one entry of `houses`, otherwise the app refuses to start. CLAUDE.md (lines 9 and 74) and `proposal.md` still say 380×412; the orchestrator may want to update CLAUDE.md line 74 (agents do not edit it).
5. `.gitignore` gained `DEPLOY_PROD.md`. That is outside this task's scope (probably unrelated parallel work), so do not stage it with the T-029 commit unless it is intended.

### Nit
- `static/index.html` (comment above `drawRoof`): it says the roof "is drawn over the top wall of its house", but the roof sits above the top edge and the wall and windows stay visible. Reword.
- `tests/test_map_layout.py`: `boards = {k: v for k, v in ...items()}` is just `dict(...)`.
- About 560 roof rects (one per shingle joint) is fine for the static base layer. If it ever matters, a `<pattern>` would cut it down.

Verdict: APPROVED. Round 2 skipped, no blockers.

## Review round 2
(reviewer appends)

## Test report
Tester (haiku), 24. 10. 2026. Scope: `config/cabin.yaml`, `app/models.py`, `static/index.html` (roofs, chimneys, smoke), tests and `tests/manual.md`, checked against the acceptance criteria above. Own server on `127.0.0.1:8137` with a temp data dir (`/tmp/t029-test/data`) and test secrets, plus headless Google Chrome driven over CDP at 380×760, 1000×800, reduced motion and dark scheme. Server and Chrome stopped afterwards. Not touched: the trial server (8010), production, `data/`, `.env`. The shell needs `/opt/homebrew/bin` on PATH for `uv` and `node`.

**Commands and results**
- `uv run pytest`: 393 passed before my change. After adding `test_duplicate_house_id` (see below): **394 passed**.
- `node --test tests/js/`: **206 pass, 0 fail**.
- Without `node` on PATH, `uv run pytest` fails `test_furniture_clear_of_labels_windows_and_doors` and `test_roofs_and_chimneys_clear_of_everything` with "Node is required". Environment only, not a code bug.
- Geometry, old (`git show HEAD:config/cabin.yaml`) vs new, script over 39 rects: every room, bed, door, window, path and scene rect from y 196 down is +16 with the same size, the vertical path is +16 in height only, and Konica, tree-side boards, title, nights, notice, parties, locked and legend are unchanged. Room ids, bed slots and `tight` are unchanged. Viewbox `[380, 428]`.
- Startup with `houses` checks (own config copies, refused with a precise `ConfigError`): missing `houses`, empty list, duplicate house id, unknown room, room in two houses, room in no house, bad roof colour, missing `roof`, extra key, chimney left of the house (x 100) and past its right bound (x 367). Valid config starts. Corrupted YAML is refused with the parser message.
- Server (test secrets, `/api/state` with the group cookie): `layout.houses` served, viewbox 428. `/data/cabin-data.yaml`, `/data/backups/`, `/config/cabin.yaml`, `/.env`, `/static/../data/...` (raw, encoded and `%2e%2e` variants) all 404. No content leaked.
- Bookings: created two parties, assigned `left-double-1` and `left-double-2` on 29. 10. (200). A second party on `left-double-1` got `409 slot_taken`. After a restart, `sleeping`, `parties` and `version` (3) were identical and the layout had the three houses.
- Browser (headless Chrome, real layout and CSS): all 12 beds hit their own `g.bed` at top-edge, centre, bottom and corner samples in the 380, 1000, reduced-motion and dark runs (no bad hit, none off-screen). `.roofs` has `pointer-events: none` and `aria-hidden="true"`, 561 roof rects, 9 `.smokepuff`. Smoke delays are all distinct (chimney 0: 0/2.9/5.8 s, chimney 1: 2.3/5.2/8.1 s, chimney 2: 4.6/7.5/10.4 s). Normal motion: `animation-name: smokeRise`. Reduced motion: `animation-name: none` and opacity 0 on all 9 puffs. Screenshots checked at 380 px and 1000 px: three roofs on their houses, brick chimneys, the kitchen roof over the entrance, zoomed frames show a grey puff rising from the kitchen and main chimneys.
- Pan and zoom at 380 px: 4 wheel steps in, drag range from y 43 to 338 (up) and to -251 (down) matches `panRange` (view width 170.7 units, about 2.2x), so the full 428 map is reachable. "Celá mapa" resets to `0 -166 380 760`.
- `grep 412`: `static/` has no viewbox 412. The one hit is `config/cabin.yaml` line 9, the bottom path's y coordinate `[60, 412, 196, 12]`, which is a real coordinate and not the height.
- No `innerHTML` in the T-029 diff. `app/validate.py`, `app/store.py` and the write path are unchanged.

**Acceptance criteria**

| # | Criterion | Result |
| --- | --- | --- |
| 1 | `houses` in cabin.yaml, shifted coordinates, viewbox 428, validates, roofs derived from data | PASS |
| 2 | Three roofs with shape and colours, each above its house, no overlap with labels, beds, boards, tree or another roof | PASS |
| 3 | After the shift nothing overlaps; doors and windows line up with their rooms | PASS |
| 4 | Zoom, pan, fit and pan margin work with the taller map; no 412 left | PASS |
| 5 | Each roof has a chimney, three puffs rise and fade, staggered, no sync | PASS (see note 1 for Konica on desktop) |
| 6 | Reduced motion stops the smoke, puffs invisible, roofs static | PASS |
| 7 | Beds tappable everywhere, roofs and smoke never intercept taps | PASS (hit test via `elementFromPoint`; no real finger) |
| 8 | No `innerHTML`, no write-path or booking-validation change | PASS |
| 9 | `uv run pytest` and `node --test tests/js/` pass, new outline test and layout tests | PASS |
| 10 | Local run at 380 px and desktop, roofs, chimneys, smoke, kitchen entrance, reduced motion | PASS (headless Chrome emulation; real phone is in `tests/manual.md`) |

**Extra scenarios tried:** invalid `houses` configs (above), corrupted YAML, restart with existing bookings, double booking, path traversal and direct access to `data/` and `config/`, pan extremes after zoom, dark scheme.

**Changes by the tester**
- `tests/test_models.py`: added `test_duplicate_house_id` (the gap from review round 1, suggestion 2). It passes.
- `tests/manual.md`: added a decision item "Konica smoke (T-029)" (note 1).

**Notes (not failures)**
1. Desktop fit view: the map's top edge is y 0, so the Konica puffs are cut off almost at once (the chimney itself shows). At 380 px and when panned up they show. Open for the organizer (added to `tests/manual.md`).
2. Review round 1 suggestion 1 is still open: the startup check accepts a chimney anywhere within the house bounds, so `chimney: 118` for the main house starts fine and draws beside the slope. The task does not require a stricter check, and only `test_roofs_and_chimneys_clear_of_everything` catches it for the repo config.
3. `.gitignore` has `DEPLOY_PROD.md`, which is unrelated to T-029. Do not stage it with the T-029 commit.

**Failures:** none. All acceptance criteria pass and there are no regressions in `tasks/done/` (full suite and Node tests pass).

**Decision:** PASS, moved to `tasks/done/`.
