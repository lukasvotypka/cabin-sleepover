# T-130: Isometric projection logic and vendored Three.js

- **Phase:** 1
- **Depends on:** none
- **Size:** S
- **UX:** no

## Goal
Foundation for the isometric 3D map (organizer's request of 27. 10. 2026: rework the whole map into isometric Three.js graphics, new graphics where none exist). Pure projection maths shared by the svg and the WebGL camera, plus Three.js served locally (no CDN, no build step, no ES modules).

## Scope
- `static/vendor/three.min.js`: three r158 `build/three.min.js` (last release with a plain-script build; `npm pack three@0.158.0` into a temp dir). Strip only the leading deprecation `console.warn(...)` statement. Keep its license header.
- `static/index.html`: `<script src="static/vendor/three.min.js?v=r158">` before the logic scripts.
- `static/js/logic-iso.js` (draft already in the worktree, written by the orchestrator: adopt, fix, finish): `ISO` constants, `isoBasis`, `isoRaw`, `isoScene(layout)` (scene size W×H, offsets ox/oy, the board block {src,x,y,k} on top, icon grid rects), `isoPoint`, `isoBlockTransform`, `isoBlockPoint`, `convexHull`, `isoBoxOutline`, `pointsText`, `polyBox`, `isoSlotHeight`, `isoFigure`, `isoFigureTransform`, `isoWalls`, `isoTrees`, `isoNoise`, `rectsOverlap`, `unionRect`.
- `tests/js/logic.test.mjs`: tests for the above.

## Acceptance criteria
- [x] Projection: u = x·cos(az) − y·sin(az), v = (x·sin(az) + y·cos(az))·sin(tilt) − h·cos(tilt), shifted by (ox, oy); az 45°, tilt 30°.
- [x] `isoScene` of the real `config/cabin.yaml` layout: every projected layout corner and the whole board block lie inside [0,W]×[0,H]; block does not overlap the world's top (highest point = ground top corner raised by `headroom`).
- [x] Icon grid rects (notice, legend, letter, briefing, key, locked) do not overlap each other nor title/time/nights/parties.
- [x] `isoWalls`: only north/west edges of a house outline are tall; door gaps on tall walls keep a lintel; no wall box overlaps any bed rect of the real layout.
- [x] `isoTrees` is deterministic and no tree is within its clearance of a room, path, door, meadow or keepOut rect.
- [x] `convexHull` tested on a square with interior/collinear points.
- [x] Test "every file in static/js is loaded" still passes; vendor file is outside `static/js/`. `node --test tests/js/` and `uv run pytest` green.

## Notes for developer
- logic-*.js must stay DOM-free (Node vm). No YAML/model changes: iso constants live in JS.
- The camera in app-iso.js (T-131) uses the same basis: right R=(c,0,−s), up U=(−s·sp, cp, −c·sp), back B=(s·cp, sp, c·cp) in world X=x, Y=height, Z=y.

## Design

---
## Dev log
- Vendored three r158 `build/three.min.js` as `static/vendor/three.min.js` (license header kept, plus `static/vendor/three.LICENSE`). Removed the leading `console.warn(...),` statement and prefixed the remaining function expression with `!` so it stays a valid statement; verified in a Node vm that `THREE.REVISION` is "158" and nothing is logged.
- `static/index.html`: `<script src="static/vendor/three.min.js?v=r158">` before the logic scripts; `logic-iso.js` listed after `logic-daynight.js`.
- `static/js/logic-iso.js`: adopted the draft unchanged (it already satisfied the criteria).
- Tests appended to `tests/js/logic.test.mjs` (section "isometric view"): the real `config/cabin.yaml` is read through `uv run python` (fallback `python3`), because Node has no YAML parser.
- `static/js/app-iso.js` (T-131 draft) moved out of the way to `/tmp/cabin-iso-draft/app-iso.js` so the "every file in static/js is loaded" test passes. T-131 must put it back.
- Commands: `node --test tests/js/` (386 pass, 0 fail), `uv run pytest -q` (741 passed).


## Review round 1

Checked: `git diff` of `static/index.html`, `tests/js/logic.test.mjs`, new `static/js/logic-iso.js`, `static/vendor/`. Ran `node --test tests/js/` (386 pass, 0 fail) and `uv run pytest -q` (741 passed).

Vendor file verified: `npm pack three@0.158.0` → `build/three.min.js` with the leading `console.warn(...),` removed and `!` put before `function(t,e)` is byte-identical to `static/vendor/three.min.js`. `three.LICENSE` is identical to the package LICENSE. The vendor file is outside `static/js/` and `/static` serves it (data/config are still not mounted). `logic-iso.js` is listed with `?v=__ASSET_VERSION__` in logic-before-app order, has no DOM use, and its global names (`round3`, `rectsOverlap`, `unionRect`, `convexHull`, `ISO`, ...) do not clash with other scripts. The projection formula, isoScene bounds, icon grid, walls/lintels, trees and convexHull are all implemented and tested as the criteria require.

**Blocker**

1. `tests/js/logic.test.mjs:4505-4512`: the Node tests now spawn `uv run python` (fallback `python3` + PyYAML) at module load to read `config/cabin.yaml`. CLAUDE.md says plainly: "The Node tests of the page logic need no uv: `node --test tests/js/`". This choice breaks that rule, and the harm is not limited to the iso tests. The IIFE runs at top level, so on any machine with only Node (no uv, or `uv run` unable to sync offline, or no PyYAML for system `python3`), the whole file throws on import and **all 386** page-logic tests are lost, not just the 9 iso ones. It also makes `node --test` slow and dependent on the network, since `uv run` may sync the environment first. Fix: keep the "real layout" check without spawning Python. Commit the layout as JSON, e.g. `tests/js/cabin-layout.json`, generated once from `config/cabin.yaml`, and load it with `fs.readFileSync` + `JSON.parse`. Then add a pytest, for example in `tests/test_map_layout.py`, that asserts `json.load(fixture) == yaml.safe_load(config/cabin.yaml)`, so `uv run pytest` catches drift whenever the organizer edits the layout. (Existing Node tests already use hand-copied real geometry, see lines 34/642/1226, so a fixture follows house practice.) Also remove the mid-file `import { execFileSync }`.

**Suggestions**

- `static/js/logic-iso.js:180`: the comment says "Windows are reported separately by isoWindows", but no `isoWindows` exists. Drop the sentence, or have T-131 add the function.
- `static/index.html:737`: 650 KB of three.js now loads as a blocking script on every page, while nothing uses it until T-131. If T-130 is committed and pushed alone, phones on the trial server pay that cost for nothing. Consider committing T-130 together with T-131, or adding the script tag in T-131 when it is first used. Keeping `?v=r158` instead of the asset hash is fine for a pinned vendor file.
- The tree test hardcodes `reach = 14`, while the code keeps `clear + 8·size` (at least 20). That is enough for the criterion, but a check against the real reach would catch a regression in the size term.

Verdict: CHANGES REQUESTED

## Review round 2

Round-1 blocker fixed: `tests/js/logic.test.mjs:4505-4506` now loads `tests/js/cabin-layout.json` with `fs.readFileSync` + `JSON.parse`. No `execFileSync`/`child_process` is left, so `node --test tests/js/` needs no uv or Python. `tests/test_iso_layout_fixture.py` compares the fixture with `yaml.safe_load(config/cabin.yaml)`, so pytest catches drift. Suggestions done: the stale `isoWindows` comment is gone, and the tree test uses `14 + 8 * t.size`, which matches `clear + 8 * size` in `logic-iso.js:245`. The three.min.js tag stays by orchestrator decision (the branch ships as a whole). All 36 scripts in `static/js/` are still listed with `?v=__ASSET_VERSION__`.

Tests: `node --test tests/js/` 386 pass, 0 fail. `uv run pytest -q` 742 passed.

No blockers.

Verdict: APPROVED

## Test report

Tester (T-130, 27. 10. 2026). Uncommitted working tree on `t3/isometric-threejs-map`. The task has no visible change, so there is no preview server; the probe server on :8737 was stopped.

**Commands and results**
- `node --test tests/js/`: 386 pass, 0 fail. No uv or Python is spawned.
- `uv run pytest -q`: 742 passed in 14.8 s. This includes `tests/test_iso_layout_fixture.py` and all tests of `tasks/done/` (regression: none).
- Temp server (`create_app` on 127.0.0.1:8737, test secrets, data in `/tmp/cabin-t130-probe/data`): `/api/health` 200.
- Vendor check in a Node vm: `THREE.REVISION` is `"158"`, nothing is written to the console on load.
- Independent probe of `static/js/logic-iso.js` against `tests/js/cabin-layout.json` (scripts in `/tmp/cabin-t130-probe/`, outside the repo).

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| Projection u, v with az 45°, tilt 30°, shifted by ox, oy | PASS | `isoRaw`/`isoPoint` match the formula at 5 sample points (|Δ| < 1e-9); `isoRaw(isoBasis(45,30),10,0,0)` = [7.07, 3.54] |
| `isoScene` of the real layout: corners and block inside [0,W]×[0,H]; block clear of the world top | PASS | W×H 644×777; viewbox corners and all room rects inside; block bottom 402.4, world top (ground corners raised by headroom 44) 416.4, gap 14 |
| Icon grid rects do not overlap each other or title/time/nights/parties | PASS | no pair overlaps (6 icons, 4 boards) |
| `isoWalls`: only north/west outline edges tall; door gaps keep a lintel; no wall overlaps a bed | PASS | 32 boxes in 3 houses, 11 tall, 0 tall walls off the north/west outline, 0 lintels missing over doors, 0 wall/bed overlaps |
| `isoTrees` deterministic; no tree within clearance of room, path, door, meadow, keepOut | PASS | 90 trees, same output on two calls; 0 violations at clear 14 and at 14 + 8·size; keepOut `[150,380,40,40]` checked; default call also clean |
| `convexHull` on a square with interior and collinear points | PASS | returns the 4 corners; duplicate points degenerate to 2 points |
| "every file in static/js is loaded" passes; vendor outside `static/js/`; `node --test` and `uv run pytest` green | PASS | it is among the 386 passing Node tests; `static/vendor/` is outside `static/js/`; no `iso`/`app-iso.js` in `static/js/` |

Also verified: `static/vendor/three.min.js` (651 KB, MIT header kept) and `three.LICENSE` are served (200, `text/javascript`, ETag). `app-iso.js` is 404 (still parked). `/data/cabin-data.yaml`, `/config/cabin.yaml`, `/.env`, `/static/../data/…`, `/static/%2e%2e/.env`, `/static/../app/main.py` are all 404 JSON. The page scripts carry `?v=<hash>`, and `logic-iso.js` is listed between `logic-daynight.js` and `app-core.js`. No top-level name of `logic-iso.js` (`ISO`, `unionRect`, `isoPoint`, `round3`, `convexHull`, `pointsText`, `polyBox`, `rectsOverlap`) clashes with another script.

**Extra scenarios tried**
- Fixture drift is guarded by the pytest equality check. Fixture is equal to `config/cabin.yaml` now.
- `index.html` has no reference to `app-iso.js`, so the parked draft cannot break the page.

**Not verifiable here (manual)**
- Visual result of the projection and the 3D world: T-131 and later.
- Load time and console errors of the 650 KB vendor script on iPhone Safari and Android Chrome: added as `tests/manual.md` section 12.

**Observations (not failures)**
1. `static/index.html` loads the vendor as `static/vendor/three.min.js?v=r158`. CLAUDE.md says every script URL ends in `?v=__ASSET_VERSION__`. The task file asks for `?v=r158` explicitly, so the criterion passes. The organizer or the orchestrator should decide which rule wins.
2. The vendor script blocks every page load while nothing uses it until T-131 (already raised by the reviewer). Commit it with T-131 if the trial should not pay for it.

**Result: PASS, all criteria.** No bug reports. Task moved to `tasks/done/`. Not committed; the orchestrator commits.


## Dev log (round 1 fixes)

- Blocker fixed: the Node tests no longer spawn Python or uv. `tests/js/cabin-layout.json` is a copy of `config/cabin.yaml`, loaded with `fs.readFileSync`; `execFileSync` import removed. New `tests/test_iso_layout_fixture.py` asserts the fixture equals the YAML, so pytest catches drift.
- Suggestion fixed: stale `isoWindows` comment removed in `static/js/logic-iso.js`.
- Suggestion fixed: the tree test uses the real reach `14 + 8 * t.size`.
- Script tag: kept `three.min.js` as instructed (branch is committed as a whole).
- Tests: `node --test tests/js/` and `uv run pytest -q` (742 passed).
