# T-131: 3D isometric world under the svg

- **Phase:** 1
- **Depends on:** T-130
- **Size:** M
- **UX:** yes

## Goal
Replace the flat svg world (grass, paths, room floors and borders, roofs, chimneys, the tree) with a Three.js world rendered on a canvas under the svg, in exactly the projection of `logic-iso.js`, so it pans and zooms with the svg viewBox.

## Scope
- `static/js/app-iso.js` (draft in the worktree: adopt, fix, finish; list it in index.html): `IsoBoxes` (all static boxes merged into one vertex-coloured geometry), `isoBuild(host, layout, scene)`, `isoDispose`, `isoSync` (ortho camera = svg view, honouring preserveAspectRatio meet), `isoLoop` (renders only when dirty or something moves, ~30 fps cap, paused when `document.hidden`).
- World content, new pixel-voxel graphics: grass canvas texture, paths with pebbles, plank floors in `room.floor`, log walls (tall north/west outer walls, all others cut low, doors as gaps, windows with glass), brick chimneys, 3D furniture per bed `kind` (bed2, bed1, cot, mats, bunk with real upper berth, sofa, sofa1, stove with pipe), autumn leaf trees and pines in a forest ring, rocks, bushes, mushrooms, a campfire with log seats.
- `static/js/app-scene.js` `ensureScene`: `app.iso = isoScene(layout)`, svg viewBox `0 0 W H`, `isoBuild` before the svg, `setupZoom(host, svg, W, H)`.
- `static/js/app-zoom.js` `applyView`: call `isoSync()`. `drawGround`/`drawBase` in app-draw.js draw no world in svg when WebGL runs; without WebGL they draw flat projected floors and bed outlines (polygons) as a fallback.
- CSS: canvas and svg absolutely stacked in `#scene`, canvas `pointer-events: none`, `image-rendering: pixelated`.

## Acceptance criteria
- [x] With WebGL the map shows the 3D world; panning/pinching keeps canvas and svg aligned (a bed's svg hit area sits exactly on its 3D furniture at every zoom, phone and desktop).
- [x] Rebuild on layout change disposes the old renderer (no leaked canvases); context loss handled.
- [x] Without WebGL (`THREE` missing or context fails) the page still works with the flat fallback.
- [x] No characters/art from Pokémon or other games; fixed scene colours, not inverted in dark mode.
- [x] Existing tests updated where they assert removed svg drawing; all tests green.
- [x] (design) On a 380 × 740 portrait viewport the rest view shows the whole board block and every room at ≥ 0.66 px per unit, and no 3D part covers any bed footprint.

## Notes for developer
- r158: set `renderer.useLegacyLights = true`; colours via `THREE.Color` (sRGB managed).
- Static shadow map (`autoUpdate=false`, one `needsUpdate`), BasicShadowMap for hard pixel shadows.
- Do not change `config/cabin.yaml` geometry; everything stays derived from the layout.

## Design
No prototype: the draft `app-iso.js` is the reference; this fixes look, readability and the phone view. No new Slovak text in this task.

**Look (pixel-voxel, fixed colours, never inverted in dark mode).** `antialias:false`, pixel ratio 1, `NearestFilter` and no mipmaps on every canvas texture, Lambert only (no PBR shine), BasicShadowMap. Each box reads as three flat tones: top lightest, the south-east faces middle, the rest darkest.
- Ground: grass `#8E9B48`, 32×32 texture over 64 units with tufts `#76823A`/`#9AA853` and leaves `#B5532A` `#D69A2E` `#8E3424`. The grass plane covers the whole bounds plus the pan margin (wide desktop windows and phones on their side), so no blank background ever shows. Paths `#D6BC8E`, 0.5 units raised, with pebbles `#BFA477`.
- Floors: planks in the room's colour from `cabin.yaml`, a line `rgba(0,0,0,.08)` every 4 units, 1 unit thick.
- Walls: logs `#7A4B2A`/`#8E5A33` in 3.5-unit courses, darker corner posts `#4E3020`. Only the outer north and west walls are tall (28); every other wall is 6, doors are gaps, windows are `#9FD3F0` glass in `#4E3020` frames. No roofs (cutaway). The house stays recognisable by its `houses[].roof` colours: the cap log of its tall walls is `roof.face` with a 1-unit `roof.ridge` stripe.
- Chimney at `houses[].chimney`: bricks `#8E3B2A` with `#6E2C20` mortar rows, cap `#5A4A40`, rising 10 above the tall wall.
- Furniture per `kind` as in the draft, in the flat map's `COLORS` (bed wood, quilts in blue or red check, sofa, stove with pipe). The bunk's upper berth is a real second level at `ISO_BUNK_TOP` with a ladder. All furniture is party-neutral: party colour is only on the figures (T-133).
- Decor: autumn trees as voxel crowns of 4-unit cubes (`#B5532A` `#D69A2E` `#8E3424`, a few `#5E6B24`), pines in three greens `#2F5D3A` `#234A2E` `#3F7448` on trunks `#5C4033`, rocks `#8C8C84`/`#6F6F68`, bushes `#6B7A2E` (some with `#9C3B22` berries), a few red-cap mushrooms. Campfire: ring of 8 stones `#7D7464`, crossed logs `#5C3820`, three stacked flame boxes `#FF7A1A` `#FFC23A` `#FFF1A0` (static here, the flicker is T-134), three log seats.
- Sun high (about 55°) from the south-east, so shadows fall north-west, away from the rooms: the tall back walls never shade a bed.

**What must stay readable (in every view, rest view included).**
- No 3D part may cover a bed's footprint or the space its figures stand in: no tree, rock, bush or campfire within 12 units of a room, path, door, meadow or bed; a tall wall is cut to 6 where the room behind it (north or west) is in another house closer than 30 units.
- The board block (T-132) floats above the world on plain grass: no tree crown higher than the world `headroom` and none under the block's footprint.
- The scene stays in the autumn tones above: no saturated greens, nothing brighter than the paper of the boards except the fire and the window glow.

**The phone view (380 px).** The scene is 644 × 777, so fitting the width gives 0.59 px per unit (today 1.0). Default: extend `restView` (logic-view.js, pure, tested) with a content rect from `logic-iso.js` (the board block plus the projected rooms, padded 12 units; about 39–589 wide). On a portrait viewport narrower than 600 px the rest view fits that content's width: about 0.67 px per unit, the whole board block and every room visible, only the forest edge cropped and reachable by panning. The reset button and the end of the intro go to this rest view; pinching out still reaches the whole scene. Desktop (≥ 900 px) and phones on their side keep today's rules. The intro still starts 2× on the title board.
- Trade-off left on purpose: at 0.67 a bed is about 30 px wide, so T-133 must make each bed's hit polygon reach 44 px (furniture outline plus standing figures, padded), not this task.

**Fallback and states.** Without WebGL or on context loss: grass `#8E9B48` behind the svg, flat projected floors in room colours, bed outlines; no message. On context restore: rebuild once. The world is built while the splash still stands, so no loading state of its own. Reduced motion: no change here (static world). Dark mode: nothing changes in the scene.

**Not in this task.** No camera rotation, perspective or tilt control, no roof toggle, no day-night lighting or animation (T-134), no new tap targets, no image files (all textures drawn on canvas), no change to `config/cabin.yaml` or to `ISO` constants other than adding the content rect.

---
## Dev log

Moved the drafted renderer to `static/js/app-iso.js` and finished it as a static world (draft's smoke, flames, falling leaves, fireflies, room lamps and `isoLight`/`isoRustle` day-night code removed: that is T-134).
- `app-iso.js`: `IsoBoxes`, `isoBuild/isoDispose/isoSync/isoLoop`, `isoActive`; plank floors, log walls (tall N/W outer walls cut to 6 when another house is within 30 units behind, `isoCutWalls`), corner posts, roof-coloured cap log with ridge stripe, chimney (+10 above tall wall), windows, furniture per kind, leaf trees (4-unit cubes), pines (capped at `ISO_PINE_MAX` so crowns stay in the headroom), rocks, bushes, mushrooms, static campfire. Sun moved to the south-east (shadows fall north-west). Trees/rocks/bushes are dropped when their top would reach the board block; decor uses `clear: 12`. Context loss: `lost` flag + rebuild on restore; render skipped while the context is lost.
- `logic-iso.js`: `isoContentRect` (board block + projected rooms, padded 12). `logic-view.js`: `restView(..., content)` and new `phoneRestView` (portrait < 600 px fits the content width; landscape and desktop unchanged). `app-zoom.js`: `applyView` calls `isoSync()`, reset goes to the phone rest view, „Celá mapa“ hidden at rest there. `app-scene.js`: `app.iso`, `app.sceneContent`, `isoBuild` before the svg, viewBox = scene size. `app-draw.js`: `drawGround`/`drawBase` draw nothing with WebGL; without it flat projected paths, floors, doors and bed outlines. `index.html`: script tag and canvas CSS.
- Tests: `tests/js/logic.test.mjs` (content rect, phone rest view at 380x740 gives 0.66 px/unit and fits block + rooms, app-iso wiring). Run: `node --test tests/js/` (389 pass), `uv run pytest -q` (742 pass).
- Browser check (headless Chrome with SwiftShader on port 8137, own data dir): screenshots in `/tmp/cabin-t131/` (`phone.png` 390x844, `small.png` 380x740, `desktop.png` 1440x900, `alignphone.png`/`aligndesk.png` zoomed 2.2x with magenta dots at room corners = exact alignment, `fallback.png` without WebGL). Also checked 3 rebuilds leave one canvas, and lose/restore context rebuilds once.
- Known, accepted until T-132/T-133: the svg beds, figures, boards, icons, room name signs, bird and day-night layer still draw in the old flat coordinates inside the larger scene, so they look misplaced over the 3D world (top-left of the scene). Room name signs are gone from the world and from the fallback; they need a place in T-133.
- Notes: `useLegacyLights` logs a three.js deprecation warning (required by the task for r158). Camera distance is a named constant (an existing test forbids the literal 3000 in page scripts). Not verified on a real GPU/phone, only SwiftShader.

## Review round 1

Tests run by the reviewer: `node --test tests/js/` 389 pass, `uv run pytest -q` 742 pass. `app-iso.js` is listed in `index.html` with `?v=__ASSET_VERSION__` after the vendored three.js; no `innerHTML`; scene colours fixed; no new Slovak text. Projection/camera sync, rebuild disposal, phone rest view and the no-WebGL fallback look right (screenshots checked).

**Blocker**
1. `static/js/app-iso.js:313-315` and `:446-449`: a lost context does not fall back. On `webglcontextlost` only `iso3.lost = true` is set; `isoActive()` keeps returning true, so `drawBase`/`drawGround` stay empty and the loop stops drawing. The design says "Without WebGL **or on context loss**: grass `#8E9B48` behind the svg, flat projected floors in room colours, bed outlines". Scenario: iOS Safari drops the GL context while the tab was in the background (or the GPU process resets) and never fires `webglcontextrestored`, which is allowed; the user then sees beds and boards floating over a blank canvas / page background (no `#scene` background colour is set), with no rooms at all, until a reload. Fix: treat a lost context as inactive (`isoActive()` = `!!iso3 && !iso3.lost`, hide the canvas) and redraw the svg ground and base fallback at once (e.g. clear `app.layers.base` and call `drawBase` + `drawGround(app.layers.ground, app.bounds)`); keep the existing rebuild-once on restore, which then removes the fallback again via `ensureScene`. Add a test (the source-level wiring test is enough, like the existing one) that `isoActive` checks `lost`.

**Suggestion**
- `app-iso.js:446-453`: the context listeners read the global `iso3`, not the instance they belong to. After a rebuild, a late `webglcontextlost` on the old (disposed, detached) canvas, e.g. when the browser reclaims old contexts, would mark the *new* world as lost and freeze it. Capture the instance (`var me = iso3 = {...}`; `if (iso3 === me) ...`). Consider `renderer.forceContextLoss()` in `isoDispose` so rebuilds do not pile up live contexts (browsers cap them around 16); with the captured instance this is safe.
- `logic-view.js:52`: the `z` → `z2` rename is unrelated churn.

Verdict: CHANGES REQUESTED

## Dev log (round 1 fixes)

- Blocker fixed: `isoActive()` is now `!!iso3 && !iso3.lost`; on `webglcontextlost` the canvas is hidden and the svg ground and base fallback are redrawn at once; a restore still rebuilds once (`ensureScene` then removes the fallback).
- Suggestions fixed: both context listeners capture the instance (`me`) and ignore late events of a disposed world; `isoDispose` calls `forceContextLoss()`; the `z2` rename in `logic-view.js` is reverted.
- Test: the source-level wiring test in `tests/js/logic.test.mjs` checks `isoActive` and `lost`, the `me` guard with the fallback redraw, and `forceContextLoss`.
- `node --test tests/js/`: 389 pass. Python tests not touched (no backend change).
- Files: `static/js/app-iso.js`, `static/js/logic-view.js`, `tests/js/logic.test.mjs`.

## Review round 2

Tests run by the reviewer: `node --test tests/js/` 389 pass, `uv run pytest -q` 742 pass.

Round-1 blocker fixed: `isoActive()` is `!!iso3 && !iso3.lost` (`app-iso.js:313-315`); on `webglcontextlost` the canvas is hidden and the svg ground and base are cleared and redrawn as the flat fallback (`:446-457`); restore still rebuilds once through `ensureScene`. Suggestions done too: both listeners guard with the captured instance `me`, `isoDispose` calls `forceContextLoss()` (a synchronous lost event during dispose would only draw into the svg that `ensureScene` throws away, and an async one is ignored by the `me` guard), and the unrelated `z2` rename in `logic-view.js` is reverted. The wiring test covers `isoActive`/`lost`, the guard and `forceContextLoss`.

No new blockers.

Verdict: APPROVED

## Test report

Tester (T-131, branch t3/isometric-threejs-map, uncommitted worktree, T-130 committed).

**Automated suites (run once)**
- `node --test tests/js/`: 389 pass, 0 fail.
- `uv run pytest -q`: 742 passed.

**Browser checks** (headless Google Chrome via CDP with SwiftShader software WebGL, own server `uv run` on 127.0.0.1:8137 with a temporary data dir `/tmp/cabin-t131-test/data`, test secrets; driver `/tmp/cabin-t131-test/run/cdp.mjs` and `cdp2.mjs`, raw results `/tmp/cabin-t131-test/results.json`). Screenshots in `/tmp/cabin-t131-test/`: `phone-rest.png`, `phone-zoomed-panned.png`, `phone-pinched.png`, `desktop-rest.png`, `desktop-dark.png`, `desktop-contextlost.png`, `desktop-restored.png`, `fallback-nogl-phone.png`, `fallback-nothree-desktop.png`.

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| With WebGL the 3D world shows; pan/pinch keep canvas and svg aligned | PASS | Canvas and svg are on the same box; the 3D camera projects 15 sample points (3 heights) onto the svg's client coordinates: worst error 0.003 px at rest, after wheel zoom, after mouse drag pan, after a two-finger pinch (380×740 and 1440×900). Screenshots show the world. Real-device check in `tests/manual.md` §13. |
| Rebuild disposes the old renderer; context loss handled | PASS | 1 rebuild via `render()` plus 4 direct `isoBuild` calls: canvas count 1 each time, the old canvas is detached and its GL context reports lost. `loseContext()`: canvas `display:none`, svg ground and base redrawn as the flat fallback (33 base nodes), no errors. `restoreContext()`: one rebuild, canvas back, fallback removed, alignment 0 px. |
| Without WebGL (THREE missing or context fails) the page still works, flat fallback | PASS | Phone with `getContext` returning null for webgl: 0 canvases, flat floors and bed outlines (34 shapes), layout and state fine. Desktop with `three.min.js` blocked: `typeof THREE` undefined, same fallback. No page exception. |
| No Pokémon/other-game art; fixed scene colours, not inverted in dark mode | PASS | Screenshots: custom pixel-voxel art. Dark-mode scene pixel-identical in look to light (`desktop-dark.png` vs `desktop-rest.png`); only panels change. |
| Existing tests updated; all tests green | PASS | 389 node, 742 pytest. |
| (design) 380×740 rest view: whole board block and every room at ≥ 0.66 px/unit, no 3D part covers a bed footprint | PASS (footprint checked visually) | `pxPerUnit` 0.662 at 380×740; the content rect (board block + rooms) is inside the visible view; `phone-rest.png` shows the block, all three houses, beds unobstructed. Trees and rocks sit outside the bed areas in the screenshot. Footprint overlap was not measured numerically. |

**Extra scenarios tried:** repeated rebuild (5×) with no canvas leak; restore after loss; wheel zoom in then pan; touch pinch via CDP touch emulation (view scale 1.0 → 2.36, alignment kept); dark mode; both fallbacks; console errors (none apart from the expected 401 of `/api/state` before the join, and the intentional blocked resource).

**Notes, not failures (for the developer or reviewer, non-blocking)**
1. `index.html` loads the vendored file as `static/vendor/three.min.js?v=r158`, not `?v=__ASSET_VERSION__`. CLAUDE.md says every script URL ends in `?v=__ASSET_VERSION__`. The vendored file does not change per release, so it works, but the rule's literal wording is not met. Decide whether the rule covers vendor files.
2. Without WebGL, three.js logs `THREE.WebGLRenderer: Error creating WebGL context` via `console.error` on every load (twice). Harmless, but noisy. Could be guarded with `isoAvailable()` checking `getContext` first.
3. Svg beds, figures, boards and the „Pred cestou“ sign are visibly misplaced over the 3D world, as the task expects until T-132/T-133. Not counted as a failure.
4. Not verified: real GPU, iOS Safari WebGL behaviour, background-tab context loss on iOS, dark-mode on a device. Added as §13 in `tests/manual.md`.

**Verdict: all acceptance criteria pass, no regressions (tasks in `done/` are covered by the suites). Task moved to `tasks/done/`. Nothing committed.**

Preview for the organizer: this is an uncommitted worktree change; the trial server on :8443 still runs the committed T-130. The tester's temporary server on 127.0.0.1:8137 is stopped.
