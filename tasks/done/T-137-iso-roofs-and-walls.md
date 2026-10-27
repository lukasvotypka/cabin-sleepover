# T-137: Roofs and taller walls that open up

- **Phase:** 1
- **Depends on:** T-136
- **Size:** M
- **UX:** yes

## Goal
More 3D feeling (item 1): houses get full-height walls and real 3D roofs in their `houses[].roof` colours with chimneys on them, and still let people see the beds.

## Scope
- `app-iso.js` (+ pure helpers in `logic-iso.js`): gable roofs per house from its outline, tall walls all round, chimney on the roof.
- Opening rule (ux-designer decides, e.g.): at the rest/zoomed view roofs and front walls lift away or turn see-through with a short animation, or a tap on a house toggles it; whatever is chosen, beds must stay tappable and visible when the person wants to pick a place. Reduced motion: no animation, instant state.

## Acceptance criteria
- [x] Each house shows a roof in its configured colours when closed; the closed/open rule from the Design works on phone and desktop.
- [x] With the house open, all beds and figures of it are visible and tappable as before.
- [x] No hardcoded geometry; everything derived from `config/cabin.yaml`.
- [x] Tests updated/added; all green.

## Design
Part of the shared T-135..T-138 look (see T-135 Design). Each house is a **closed little house at the rest view** and **opens like a dollhouse** when you go in.

**Rule (default; the organizer may pick B, see below):**
1. Rest view (fitted, also after „Celá mapa“ and at the end of the intro): every house is **closed**: walls all round at `wallH`, gable roof, chimney with smoke, lit windows at night. On the ridge of each closed roof sits a small svg sign for the chosen night: „voľné: 3“ or „plno“ (same pixel sign style as room labels; tells you where to go without opening). Room labels and bed tags of a closed house are hidden.
2. **Tap (or click) anywhere on a closed house** (roof, wall, or a bed's tap region under it) → that house opens and the view zooms to it (fit the house with 16 px margin, max 2.5×, the existing view easing). This tap never assigns; the next tap on a bed works as today. So the signup costs one extra tap, which also makes the beds big enough for thumbs.
3. **Pinch or wheel to ≥ 1.6× the rest zoom** → all houses open. Back to ≤ 1.15× (or „Celá mapa“) → all close.
4. Keyboard focus on a bed of a closed house opens it (no zoom). Move mode, „Kto si?“ with a walk (T-138) and a pending write open the house concerned. Screen-reader labels unchanged.

**Opening animation** (on the 8 fps tick, `steps()`-like, no smooth tween): roof lifts 6, 14, 26 map units and is gone (3 frames, ~375 ms); then the front (south and east) walls and inner walls sink to `lowWall` in 2 frames. The back (north and west) walls stay tall. Closing runs it backwards. Reduced motion: instant swap, no frames.

**Look:**
- Gable roof per house over the bounding box of its rooms (if the rooms do not fill the box, one gable per room at the same ridge height); ridge along the longer side; overhang 4 units; ridge height `wallH + 0.35 × shorter side`. Colours from `houses[].roof`: `face` on the sunny slope, `dark` on the other, `ridge` as a 2-unit cap. Shingle rows: a 1-unit darker stripe every 6 units (canvas texture with `NearestFilter` or vertex colours), no smooth shading.
- Gable ends and the tall walls in the existing wall wood colour; window holes keep their glow at night.
- Chimney stands from the ground up through the roof at `houses[].chimney`, 6 units above the ridge; smoke as now. It stays when the roof is gone.
- Desktop hover on a closed house: the roof brightens one step (`face` mixed 12 % white), cursor pointer.
- Closed houses cast their roof shadow (T-136 shadow map rebuilt only on open/close, not per frame).

**Not in scope:** walking into a house, separate floors, transparency or x-ray roofs (blending looks muddy and costs phones), roof tiles per tile mesh, changing `cabin.yaml` beyond what exists.

**Option B (one-line trade-off):** houses open by default and a new icon sign „Strechy“ in the icon grid closes all for a look; zero extra taps, but most people would never see the roofs. Recommendation: the default rule above.

Design criteria:
- [x] (design) On the rest view every closed roof shows „voľné: N“ or „plno“ for the chosen night, matching the free slots of that house.
- [x] (design) A tap on a closed house (including on a bed under it) opens and zooms to it and never assigns a place.

---
## Dev log
Done (option A). Closed houses at rest: tall walls all round, gable roof from `isoRoofs` (rooms' outline plus 4 overhang, ridge on the longer side, ridge = wallH + 0.35 x shorter side, one gable per room if the rooms do not fill the box), shingle rows and ridge cap by vertex colours in `houses[].roof`, chimney through the roof. Ridge sign „voľné: N“ / „plno“ per house; room labels, bed tags, figures and bed tap areas of a closed house are not drawn (the bed buttons stay for keyboard and screen readers). Tap on a closed house (`.house-hit`) opens it and eases the view to it (16 px margin, max 2.5x rest zoom; instant with reduced motion). Zoom to 1.6x rest opens all, back to 1.15x or „Celá mapa“ closes all (only on a change of zoom, not on a pan, not during the intro or the zoom to a house). Move mode opens all; Tab focus on a bed of a closed house opens it without zoom. Opening runs on the 8 fps tick: roof +6, +14, +26, gone, front walls at 55 %, open (6 steps); reduced motion jumps. The svg side (beds, labels) switches at step 4 (roof gone). Hover on a closed roof brightens it (emissive). The shadow map is redrawn only on a step. Open state = the old T-136 look exactly (same walls), so bed tops are not newly shadowed.
Files: static/js/logic-iso-roof.js (new, pure), static/js/app-iso-roof.js (new, meshes and steps), static/js/app-houses.js (new, state, zoom rule, taps, signs), app-iso.js (house meshes, posts, chimney, tick), app-beds.js, app-draw.js, app-zoom.js (hooks), logic-iso.js (headroom 44 -> 84 for the roofs), index.html (scripts, cursor), tests/js/logic.test.mjs (7 tests).
Tests: `node --test tests/js/` 418 pass; `uv run pytest -q` 741 pass. Headless Chrome (own server on 8397, drivers in /tmp/cabin-t137): phone 390x844, desktop 1280x800, reduced motion; closed, tap opens + zooms, bed tap opens the sheet, „Celá mapa“ closes, wheel to 2.2x opens all, wheel out closes all; day and night; no console errors. Screenshots /tmp/cabin-t137/shots/.
Deviations: chimney ends 6 above the roof half way up its slope (not above the ridge: it stands on the north edge, a ridge-high tower looked wrong); scene headroom raised to 84 because ridges reach 80; the mid sink of the front walls is a y-scale of the closed mesh (55 %), not a separate model; hover is a roof emissive step, not a 12 % white mix. The tap on a house sets housesOpen[id]; panning after it does not open the rest, a new zoom change does.
Follow-ups: CLAUDE.md still says "no roofs so rooms show" in the Isometric 3D paragraph (not edited by me); T-138 should open the target house for a walk (`openHouse(id, false)`).

## Review round 1
Tests run by the reviewer: `node --test tests/js/` 418 pass, `uv run pytest -q` 741 pass. All new scripts are listed in `index.html` with `?v=__ASSET_VERSION__`, logic before app, in a working order. Screenshots match the Design (closed houses with ridge signs at rest, dollhouse open after a tap or zoom).

**Blocker**
1. `CLAUDE.md` line 107 (Isometric 3D paragraph) still says "orthographic camera, no roofs so rooms show". That is now false and will mislead every later agent. Fix: update it to describe closed houses (tall walls, gable roof in `houses[].roof`, ridge sign „voľné: N“/„plno“), the opening rule (a tap opens and zooms, 1.6x opens all, 1.15x or „Celá mapa“ closes all, move mode and Tab focus open), the step animation on the 8 fps tick, the instant swap with reduced motion, and the new files `logic-iso-roof.js`, `app-iso-roof.js` and `app-houses.js`. (While you are there, "orthographic" is already stale since T-135's slight perspective.)
2. `static/js/app-beds.js:186`: the closed-house bed button's label is `bedLabel(...) + ". Ťuknutím otvoríš."`. The Design says "Screen-reader labels unchanged", and the added text is also wrong. Activating that button (VoiceOver double tap sends a click, or Enter) runs `onBedTap(room, bed)`, which is the normal bed action, not "open". Also, a VoiceOver swipe does not set `app.navKeyAt`, so the house stays closed. A screen-reader user hears "Ťuknutím otvoríš", double-taps, and gets the assign sheet or an assignment. Fix: use the unchanged `bedLabel(st, room, bed, night)`.

**Suggestion**
- Design rule 4 says "a pending write open[s] the house concerned". It is not done. In practice a write starts from an open house (or from „Kto si?“, deferred to T-138), so this is not a blocker. Consider calling `openHouse(id, false)` when an optimistic write targets a bed in a closed house, so the semi-transparent figure is visible.
- `isoHouseList` in `logic-iso-roof.js` duplicates the inline house grouping in `isoBuild` (`app-iso.js` around line 447). Use `isoHouseList(layout)` there so the two cannot drift apart.

Verdict: CHANGES REQUESTED

### Dev log, round 1 fixes
- Blocker 1 fixed: CLAUDE.md Isometric 3D paragraph now describes slight perspective, closed houses, ridge signs, the opening rule, step animation, reduced motion and the three new files.
- Blocker 2 fixed: closed-house bed button label is the plain `bedLabel(...)` again (app-beds.js).
- Suggestion 1 fixed: `runWrite` (app-actions.js) calls new `openHousesOfSlots(ops)` (app-houses.js), which opens, without zoom, any closed house holding a pending slot.
- Suggestion 2 fixed: `isoBuild` uses `isoHouseList(layout)` (app-iso.js).
- Tests: `node --test tests/js/` and `uv run pytest -q` green (see numbers below the run). Not re-checked in a browser.

## Review round 2
Tests run by the reviewer: `node --test tests/js/` 418 pass, `uv run pytest -q` 741 pass. Every `static/js/*.js` is in `index.html` with `?v=__ASSET_VERSION__`.

Round-1 items:
- Blocker 1 (CLAUDE.md): fixed. The Isometric 3D paragraph now describes the closed houses, the opening rule, the steps, reduced motion and the new files.
- Suggestion 1 (pending write opens the house): done. `openHousesOfSlots(ops)` in `runWrite` matches the `{night, slot, party_id}` ops shape and uses `openHouse(id, false)`, so there is no zoom.
- Suggestion 2 (`isoHouseList` in `isoBuild`): done. It does the same as the old inline grouping.
- Blocker 2: my round-1 finding was wrong, and the fix it asked for caused a regression. `bedLabel(...) + ". Ťuknutím otvoríš."` was already the label on every bed at HEAD (`git show HEAD:static/js/app-beds.js`, line 219). It is accurate because `onBedTap` opens the bed sheet (or moves in move mode). The closed-house button reused that same label, which is what "labels unchanged" means.

**Blocker**
1. `static/js/app-beds.js:226`: the fix also removed `". Ťuknutím otvoríš."` from the normal open-house bed button. The Design says "Screen-reader labels unchanged", but every bed's label now differs from HEAD, and screen-reader users lose the hint that activating the bed opens its options. Expected fix: restore the HEAD label `bedLabel(st, room, bed, night) + ". Ťuknutím otvoríš."` on both line 226 and the closed-house button at line 186. That gives one label for both, exactly as at HEAD. This is a one-line revert on each line, and nothing else needs to change.

Verdict: CHANGES REQUESTED

## Test report

Tester (T-137, Haiku 5.5, on the working tree at 107b19b + uncommitted round-2 fixes). Result: **FAIL**, back to in-progress.

Commands run:
- `node --test tests/js/`: 418 pass, 0 fail.
- `uv run pytest -q`: 741 passed.
- Temporary server `create_app(data_dir='/tmp/cabin-t137-test/data')` on 127.0.0.1:8431 with test secrets. `/api/health` ok (1.21.1). `/static/js/app-houses.js` 200; `/data/...` and `/config/...` 404.
- Headless Chrome over CDP, driver `/tmp/cabin-t137-test/drv/t137.mjs` (`phone`, `desktop`, `reduced`, `daynight`), results in `/tmp/cabin-t137-test/drv/results-*.json`. Alignment probe `/tmp/cabin-t137-test/drv/align-open.mjs` (adapted from `/tmp/cabin-t135-test/r2/probe.mjs`). Screenshots in `/tmp/cabin-t137-test/shots/`.

Acceptance criteria:

| Criterion | Result | Evidence |
| --- | --- | --- |
| Roof in the configured colours when closed; closed/open rule on phone and desktop | PASS | 3 houses closed at rest, roofs visible on both (screenshots `phone-1-rest.png`, `desktop-1-rest.png`) |
| Open house: beds and figures visible and tappable as before | PASS | one bed tap opens the sheet on phone and desktop; alignment probe with houses open: 0.002 px worst |
| No hardcoded geometry | PASS | Node test "no hardcoded geometry" green; not audited by reading the code |
| Tests updated/added, all green | PASS | 418 Node and 741 pytest |
| Design: ridge sign „voľné: N“ / „plno“ matches free places | PASS | DOM signs vs free slots counted from `/api/state` for the night: 3 of 3 on phone and desktop |
| Design: tap on a closed house opens and zooms, never assigns | PASS | zoom 1 → 2.47 (phone), 1 → 2.5 (desktop); `version` and `sleeping` unchanged; no sheet |

Task rules checked in the browser:

| Rule | Phone 390×844 | Desktop 1280×800 |
| --- | --- | --- |
| Closed at rest with ridge signs | PASS | PASS |
| Tap opens and zooms, no assignment | PASS | PASS |
| Second house tap opens only that house, no sheet, no write | PASS | PASS |
| Bed tap when open opens the sheet | PASS | PASS |
| Zoom ≥ 1.6× opens all (3.02× / 3.05×) | PASS | PASS |
| Zoom out to ≤ 1.15× closes all | PASS (1.11×) | PASS |
| „Celá mapa“ closes all | PASS | PASS |
| Move mode opens all houses | **FAIL** (bug 2) | PASS |
| Keyboard Tab on a bed of a closed house opens its house, no zoom | PASS (first Tab, 1 press) | PASS |
| Reduced motion: instant, no intermediate step | PASS (open at 40 ms, final steps) | not run |
| Day and night (noon, 22:00), no errors | PASS | not run |
| Alignment with houses open (3.0×, all open; and one house open) | PASS (0.002 px) | PASS (0.002 px) |
| No console errors in any run | PASS | PASS |

Bugs:

1. **Screen-reader label regression (already raised in round 2, confirmed).** `static/js/app-beds.js:186` and `:226` now use `bedLabel(st, room, bed, night)` with no `". Ťuknutím otvoríš."`. At HEAD (`git show HEAD:static/js/app-beds.js`, line 219) the label had that hint. Steps: read the two lines. Expected: the HEAD label on both lines (the Design says „Screen-reader labels unchanged“). Actual: the hint is missing on every bed. Found by code reading, not tested with VoiceOver.

2. **Move mode does not open the closed houses on the phone.** Steps: 390×844; a party of mine is set as „Si“ (`setMyParty`) and gets a place in `main` for 2026-10-29 (`POST /api/assign`); tap `main` to open it, tap its bed, tap „Presunúť“ in the sheet. Expected: move mode opens all houses (Design rule 4, Dev log), 0 closed. Actual: `app.move` is set, but `konica` and `kitchen` stay closed (steps 0) after 1.5 s and stay closed. The same flow on desktop works (all open). Cause: `startMove()` (`static/js/app-actions.js:172`) calls `renderMoveBar()` but not `housesSync()`. `housesSync()` runs only in `render()` (`app-draw.js:113`), so the houses update only on a later redraw. Fix: call `housesSync()` in `startMove()` (and resync when move mode ends).

Extra scenarios: tap on a closed house while another one is open (the zoomed-in view makes the second house off-screen, so I first returned to the rest view), tap on a visible closed house at rest, Escape closes the sheet, Celá mapa after a tap, zoom in again after Celá mapa, server state checked after each tap, no `/data` or `/config` over HTTP.

Not tested (needs a human or a real device): iPhone Safari and Android Chrome touch and pinch, VoiceOver and TalkBack, desktop hover on a closed roof, dark mode look, a server restart with existing data, the zoom band 1.15× to 1.6× in the middle of a pinch. Added to `tests/manual.md` as section 19 (T-137).

Board: the file was in `review/` when testing started, then moved to `in-progress/` during the run. I did not move it again: it has failures, so it stays in `in-progress/` for the developer. Test server on 8431 stopped.

## Review re-check
Re-check after the test failure. The task file is still in `in-progress/` and the Dev log has no fix entry. The working tree does not have either fix (files last changed before the test report):
- `static/js/app-beds.js:186` and `:226` still use `bedLabel(st, room, bed, night)` without `". Ťuknutím otvoríš."` (HEAD line 219 has it). Not fixed.
- `startMove()` in `static/js/app-actions.js:172` still does not call `housesSync()`. The only caller outside `app-houses.js` is `render()` (`app-draw.js:113`). Not fixed. Fix: call `housesSync()` after `renderMoveBar()` in `startMove()`, and in `cancelMove()` and `moveTo()` when move mode ends. Simpler: call it once inside `renderMoveBar()`.
No tests run, because no code changed.

Verdict: CHANGES REQUESTED

### Dev log (fix round 2)
- Bed hint: both bed buttons in `static/js/app-beds.js` (closed-house branch and normal branch) again use `bedLabel(st, room, bed, night) + ". Ťuknutím otvoríš."`, as at HEAD. Reviewer's round-1 request was wrong (see Review round 2): fixed.
- Test bug 2 (move mode on phone): `renderMoveBar()` in `static/js/app-actions.js` now ends with `housesSync()`. It runs on start (`startMove`), cancel, a finished move and when signup locks, so all houses open on move start and return to their zoom/tap state when it ends. Fixed.
- Test: new Node source test in `tests/js/logic.test.mjs` ("bed buttons keep the tap hint and move mode syncs the houses").
- Commands: `node --test tests/js/` 419 pass; `uv run pytest -q` 741 pass.
- Not verified in a browser on a phone.


## Test report, re-test after round-2 fixes

Tester (T-137, re-test). Result: **PASS** on the checks below. Not moved: the file is in `in-progress/`, and the README flow needs a reviewer re-check (`in-progress → review → testing`) before `done/`. Next step for the orchestrator: move to `review/` for the short re-check, then `testing/`, or `done/` if the organizer accepts this report directly.

Commands run:
- `node --test tests/js/`: 419 pass, 0 fail.
- `uv run pytest -q`: 741 passed.
- Temporary server `create_app(data_dir='/tmp/cabin-t137-test/r3/data')` on 127.0.0.1:8452 (own port, not 8000/8010/8146), test secrets only. `/api/health` ok (1.21.1). `/data/cabin-data.yaml` 404, `/config/cabin.yaml` 404, `/static/js/app-houses.js` 200. Server log: no traceback, no 500. Server stopped afterwards.
- Driver `/tmp/cabin-t137-test/r3/drv/t137-r3.mjs all` (copy of the earlier driver on 8452): FAILS []; `errors` [] for phone, desktop, reduced and day/night.
- Alignment probe `/tmp/cabin-t137-test/r3/drv/align-r3.mjs`: worst 0.001 px on phone and desktop, rest and one house open.
- Label probe `/tmp/cabin-t137-test/r3/drv/label-probe.mjs` (phone 390×844): all 12 bed `aria-label`s end with „. Ťuknutím otvoríš.“, closed and open. The source matches HEAD: `git show HEAD:static/js/app-beds.js` line 219 and now `app-beds.js` lines 186 and 226 both use `bedLabel(...) + ". Ťuknutím otvoríš."`.

Acceptance criteria:

| Criterion | Result | Evidence |
| --- | --- | --- |
| Roof in configured colours when closed; closed/open rule on phone and desktop | PASS | 3 houses closed at rest on both; screenshots `phone-1-rest.png`, `desktop-1-rest.png` |
| Open house: beds and figures visible and tappable as before | PASS | bed tap opens the sheet on both; alignment 0.001 px |
| No hardcoded geometry | PASS | Node test green; not audited by reading |
| Tests updated/added, all green | PASS | 419 Node, 741 pytest |
| Design: ridge sign „voľné: N“ / „plno“ matches free places | PASS | phone `voľné: 6 / 2 / 12` = free counts from state; desktop `6 / 2 / 11` (one place taken by the move test) |
| Design: tap on a closed house opens and zooms, never assigns | PASS | rel 1 → 2.47 (phone), 1 → 2.5 (desktop); no sheet, `houseTapNoWrite` true |

Round-2 fixes:

| Item | Result | Evidence |
| --- | --- | --- |
| Bed labels match HEAD with „. Ťuknutím otvoríš.“ | PASS | label probe 12/12 closed and 12/12 open; source as HEAD |
| Move mode opens all houses on phone 390×844 | PASS | before move: `main` open, `konica` and `kitchen` closed; after „Presunúť“: `hits []`, steps 6/6/6, `move: true` (was FAIL in the previous run) |
| Move mode opens all houses on desktop 1280×800 | PASS | `all: true`, steps 6/6/6 |
| Move mode end | PASS | phone: houses closed again except `main`, which the tap opened (rel 1.93); desktop: stays all open because zoom is ≥ 1.6× (rule 3) |

Regression (short, driver scenarios): house tap then bed tap opens the sheet (phone and desktop); second house tap opens only that house, no write; zoom to 3.05× opens all, zoom out to 1.12× closes all; „Celá mapa“ closes all; Tab on a bed of a closed house opens it without zoom; reduced motion: open state is reached at 40 ms with no intermediate step (`konica:6` after the tap, final steps as expected); day and night (noon and 22:00) without errors. No new failures.

Not tested here (needs a human or a real device): iPhone Safari and Android Chrome touch and pinch, VoiceOver and TalkBack (the label fix is checked in the DOM, not spoken), desktop hover on a closed roof, dark mode look, server restart with existing data. These are in `tests/manual.md` section 19.

## Review re-check (after fix round 2)
Tests run by the reviewer: `node --test tests/js/` 419 pass, `uv run pytest -q` 741 pass.
- Bed label: both buttons in `static/js/app-beds.js` (lines 186 and 226) use `bedLabel(st, room, bed, night) + ". Ťuknutím otvoríš."`, the same as HEAD. Fixed.
- Move mode: `renderMoveBar()` in `static/js/app-actions.js` ends with `housesSync()`, so start, cancel, a finished move and the lock path all resync the houses. `housesSync` returns early without WebGL or state, and `isoSetHouses` is idempotent, so the second call from `render()` does no harm and cannot loop (it only reaches `renderBeds`, not `renderMoveBar`). Fixed.
- New Node source test covers both. The tester's re-test passed on this code.
No blockers.

Verdict: APPROVED
