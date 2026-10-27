# T-138: People as 3D block figures

- **Phase:** 1
- **Depends on:** T-137
- **Size:** L
- **UX:** yes

## Goal
More 3D feeling (item 5): people become small 3D block figures in their party colour (kids smaller), sitting in bed by day and lying under the quilt at night, with the shirt letter, instead of flat svg sprites.

## Scope
- `app-iso.js`: figure meshes per occupied slot (shared geometry, per-party materials, shirt letter as a small canvas texture), my party marked (e.g. yellow ring under the bed), free „+“ marks as small 3D signs or kept in svg (Design decides), z-z-z kept in svg at projected points.
- Keep behaviour: pending (semi-transparent), 06:00 swap fade, meadow waiters, the walk from the meadow to the bed (animated in 3D), tight places, bunk berths.
- svg keeps only tap regions, labels, focus rings and tips; screen-reader labels unchanged.
- No-WebGL fallback keeps the svg sprites.

## Acceptance criteria
- [x] All occupied slots show a 3D figure at the right berth, with the right colour and letter; kids smaller.
- [x] Day: sitting; night (`lightAt` sleep): lying under the quilt; swap fade at 06:00.
- [x] Pending, walk, meadow and move mode work as before; taps unchanged.
- [x] Rendering stays on demand (no extra continuous frames when nothing moves).
- [x] Tests updated/added; all green.

## Notes for developer
If this grows past one review cycle, split the walk/meadow part into a follow-up and say so in the dev log.

## Design
Part of the shared T-135..T-138 look (see T-135 Design): people are tiny **voxel dolls** in their party colour. Own design, no figures from other games.

**Figure (map units, ×`ISO.figScale`; kid = adult × 0.72):**
- Adult standing: legs 4×3×4 in the party colour darkened 30 %, body 5×3×5 party colour, head 4×4×4 skin `#F1C7A0` with a 1-unit hair cap `#4A2E1E` (no other face detail except two 1×1 dark eyes `#2A1A12` on the front). Shirt letter: white pixel letter on the chest, canvas texture 8×8 per (letter, colour), `NearestFilter`, cached.
- Figures always turn to face the camera (rotation fixed toward the south-east), whatever the bed's orientation, so the letter is visible.
- **Day (sitting):** body upright at the head end of the berth, legs hidden under the bed's quilt. **Night (`lightAt` sleep):** lying, only the head on the pillow; a quilt block (party colour mixed 35 % white, 1.5 units thick) over the berth; the letter moves to the quilt top. Kids in the parents' bed lie between the adults, smaller.
- Bunk: lower berth figures sit lower (no head clipping through the upper berth: lower-berth sitters are scaled to 0.85 if needed). Tight places and stove/sofa1 keep the `pos()` placement, only in 3D.
- **My party:** a 1-unit yellow `#FFD23F` square ring on the bed top around my figure, blinking in 2 steps (on 500 ms / dim 500 ms) on the shared tick; reduced motion: steady.
- **Free place „+“:** stays in svg at the projected point (crisp, cheap, already the tap affordance). z-z-z stays in svg.

**States and feel (all on the 8 fps tick, stepped, no smooth tweens):**
- Tap a free bed → figure pops in 3 frames (scale 0.4, 1.15, 1), pending at 50 % opacity until the server answers. Rejection: 2-frame shake (±1 unit) then gone, the Slovak reason toast as today.
- 06:00 swap: old figures fade out and new ones in, 4 opacity steps each.
- Meadow waiters stand on the meadow; every ~4 s one random waiter hops 1 unit (2 frames), only while the life tick runs anyway.
- Walk meadow → bed: the figure hops along a straight path to the house door and then to the bed, 1 hop per frame with a 1-unit bob, max 1.6 s; the house opens first (T-137). Reduced motion: appears in the bed at once.
- Move mode: the picked figure lifts 3 units and bobs; dropped = pop in.
- Rendering stays on demand: nothing animates when no figure is pending, walking, swapping or mine-blinking; with reduced motion nothing animates at all.

**Speed:** shared geometries (6 boxes), one material per party colour (≤ 12) plus cached letter textures; figures do not cast shadow-map shadows (static map); standing meadow figures get a 4×4 dark blob under the feet.

**Not in scope:** walking around freely, faces/emotions, clothes beyond colour and letter, names above heads, sounds. No-WebGL fallback keeps today's svg sprites.

If the walk/meadow part does not fit one review cycle, split it as the dev note says; the figure look, day/night pose, pending, pop and swap come first.

---
## Dev log

Everything in one cycle, including the walk and the meadow (no split needed).

**What changed**
- New `static/js/logic-iso-people.js` (pure): doll layout per pose (`isoFigureLayout`: stand / sit / lie), colours, `isoSitScale` (0.85 under a bunk berth when needed), pop / fade / shake / lift / waiter-hop steps, walk path through the house door (`isoWalkDoor`, `isoWalkPoints`, `isoWalkSample`).
- New `static/js/app-iso-people.js`: builds the dolls in the 3D world on every `drawBeds` (`isoPeopleBegin/Add/End`), shared box and plane geometry, materials cached per colour and quarter opacity, cached 8x8 letter textures (`NearestFilter`), sit and lie groups toggled by `lightAt(h).sleep` (`isoPeoplePose` from `isoLight`), yellow blinking frame for my party, pop in (new key), shake then gone (pending figure rejected), 06:00 fade (ghost of the old night out, arrivals in, 4 steps), meadow waiters with a blob and an occasional hop, move-mode lift and bob, 3D walkers (`isoWalkerAdd/Set/Remove`). Everything steps on the shared tick (`isoPeopleTick` from `isoLoop`); no new loop.
- `app-beds.js`: with 3D active the svg no longer draws sprites, quilts, shadows, frames or the meadow figures; it keeps tap areas, free marks, z-z-z, chip, labels. Without 3D (or after context loss, which now redraws the beds) the old svg sprites are drawn unchanged.
- `app-actions.js`: walk uses 3D walkers (1.6 s, one hop per tick, bob, through the door of the target house, hop up onto the bed), svg walk kept for the fallback; move mode redraws beds on start and cancel so the picked figure lifts.
- `static/index.html`: the two new scripts; `app-iso.js`: tick and pose hooks, redraw on context loss.

**Deviations**
- Body is 5x4x4 (design: 5x3x5) so the 3x5 pixel letter fits on the chest; total doll height 11 units instead of 10.
- Lying dolls are not yawed (head north, like the bed), only the letter on the quilt is turned to the camera.
- Meadow figures hop only while the life tick runs (not with reduced motion), as designed.
- No CLAUDE.md update (the people paragraph in the iso section still describes svg figures); suggest a docs follow-up.

**Tests**
- `node --test tests/js/` : 423 pass (4 new for the dolls, 2 old walk assertions updated for `walk.ms`/`hop`).
- `uv run pytest -q` : 741 pass.
- Headless Chrome (own server on 8398, driver in /tmp/cabin-t138): phone 390x844, desktop 1280x800, reduced motion. Checked day sitting, night lying, kids, bunk berths, mine ring, pending 50 % and rejection shake, walk path samples (door then bed, ends opaque in bed, meadow figure gone), move-mode lift, 06:00 swap fade (ghost 0.75 then gone), reduced motion (no pop, no walk, steady). No console errors. Screenshots in /tmp/cabin-t138/shots/.

## Review round 1

Tests run by the reviewer: `node --test tests/js/` 423 pass, `uv run pytest -q` 741 pass. Both new scripts are listed in `index.html` with `?v=__ASSET_VERSION__` in the right order (logic before app, `app-iso-people.js` after `app-iso.js`). Screenshots checked (day sitting, night lying with quilt and letter, bunk berths, my-party ring). Code matches the Design: shared box/plane geometry, materials cached per colour and quarter opacity, cached 8x8 `NearestFilter` letter textures, pose toggled from `isoLight`, pop / shake / fade / hop / lift all stepped on the existing tick in `isoLoop` (no new loop, no timers; the loop already runs while motion is allowed, so no extra frames; reduced motion leaves the ring steady and skips pop, shake, walk and swap). svg keeps tap regions, labels, free marks, z-z-z and the fallback sprites; screen-reader labels unchanged; letters come from `PIXEL_FONT` via canvas, no `innerHTML`. Context loss redraws the svg sprites. Code itself is fine.

**Blocker**
1. `CLAUDE.md`, „Isometric 3D map“ paragraph: still says the svg draws „beds' tap areas, figures, boards and icons at projected points“. Since T-138 the figures (sit/lie dolls, my-party ring, meadow waiters, walkers) are 3D in `app-iso-people.js` with the pure part in `logic-iso-people.js`, and the svg sprites are only the no-WebGL fallback. CLAUDE.md is the guide every agent reads, so leaving it wrong will mislead the next task (the orchestrator assigned this update to T-138). Fix: update that paragraph (and the moving-parts sentence, which should mention the dolls' pop / shake / 06:00 fade / hop / lift on the same 8 fps tick) and name the two new files. Docs only; no code change needed.

**Suggestion**
- `app-iso-people.js:51,131-140`: `P.ringMat` is shared and never follows the figure's opacity, so a pending figure of my party shows a full-strength ring around a 50 % doll. Optional: pick the ring material by `entry.opacity` like the body.
- `app-iso-people.js:143` and `:184`: `isoPeopleApply` runs twice for every new entry (in `isoPeopleMake` and again in `isoPeopleBuild`); harmless.

Verdict: CHANGES REQUESTED

### Dev log, round 1 fixes

- Blocker (CLAUDE.md): fixed. The „Isometric 3D map“ paragraph no longer says the svg draws figures; a new „People (T-138)“ sentence names `app-iso-people.js` and `logic-iso-people.js`, the dolls' pop / shake / 06:00 fade / hop / lift on the shared 8 fps tick, and the svg sprites as fallback only.
- Suggestion (ring opacity): fixed. Each "mine" entry has its own cloned `ringMat` (`app-iso-people.js`); `isoPeopleApply` and `isoPeopleTick` set it to the blink value times the entry's opacity, so a pending figure's ring is half strength.
- Double `isoPeopleApply` on new entries: left as is (harmless).
- Tests: `node --test tests/js/` passes (no logic change); `node --check` on the file ok. No browser check done.

## Review round 2

Tests run by the reviewer: `node --test tests/js/` 423 pass, `uv run pytest -q` 741 pass. Both scripts still listed in `index.html` with `?v=__ASSET_VERSION__`.

Round-1 blocker:
1. CLAUDE.md „Isometric 3D map“ paragraph: fixed. The svg no longer claims to draw figures, and the new „People (T-138)“ sentence names `app-iso-people.js` / `logic-iso-people.js`, the dolls' pop / shake / 06:00 fade / hop / lift on the shared 8 fps tick, no motion with reduced motion, and svg sprites as fallback only.

Round-1 suggestion (ring opacity): done. Each mine entry clones `ringMat` (`app-iso-people.js:132`), and `isoPeopleApply` (:157) and `isoPeopleTick` (:208) scale the blink value by the entry's opacity, so a pending ring is at half strength and a fading one fades with the doll.

**Suggestion**
- `app-iso-people.js:132,178`: the cloned ring material is never `dispose()`d when entries are rebuilt on each `drawBeds`, so a few material objects pile up per redraw (only my party's entries). This is small, but disposing `e.ringMat` when an entry is dropped (and not moved to `dying`) would keep it clean.

No blockers.

Verdict: APPROVED

## Test report

### Tester run (haiku tester, 27. 10. 2026)

**Commands and results**
- `node --test tests/js/` : 423 pass, 0 fail.
- `uv run pytest -q` : 741 passed.
- Headless Chrome (`/Applications/Google Chrome.app`, `--headless=new`, CDP on port 9431) against a temporary server on `127.0.0.1:8431` with `data/` in `/tmp/cabin-t138-test/data` (seeded with six parties; the temp data was changed for the night-swap and walk checks). Driver scripts in `/tmp/cabin-t138-test/drv/`, screenshots in `/tmp/cabin-t138-test/shots/`. Server and Chrome stopped afterwards.
- `GET /` serves both new scripts with `?v=9d7aa5e83df6` (no `__ASSET_VERSION__` left), `app-iso-people.js` and `logic-iso-people.js` return 200, `/data/cabin-data.yaml` returns 404.

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| All occupied slots show a 3D figure at the right berth, with the right colour and letter; kids smaller | PASS | 15 figures on night 29 (adults, kids, bunk, sofa, stove, mats); each colour equals its party colour, letter equals the first letter of the name; kid height / adult height = 0.72 |
| Day sitting; night (`lightAt` sleep) lying under the quilt; swap fade at 06:00 | PASS | noon: `sit` visible, `lie` hidden; 23:30: the reverse; 05:55 no swap, 06:12 swap: leaving ghosts 0.75 then gone, arriving figures 0.25 → 1 |
| Pending, walk, meadow and move mode work as before; taps unchanged | PASS | pending opacity 0.5; a real tap on „Posteľ pod oknom“ then „Ľahnúť si sem“ writes the place and the figure ends opaque (pending false); walk from meadow (174,461) through the door to the bed in about 1.3 s, ends opaque, meadow figure removed; waiter hops 1 unit (seen in an 11 s window); move mode lifts the figure +3 and bobs |
| Rendering stays on demand | PASS (note) | reduced motion: `iso3.raf` 0 and `dirty` false after 9 s idle. Normal mode with a waiter or my party ring keeps the 8 fps tick running, which is the designed blink |
| Tests updated / added; all green | PASS | 423 Node, 741 pytest |

**Extra scenarios**
- Phone 390×844 and desktop 1280×800: day, night, pending, rejection, swap, walk, move, tap, no-WebGL, reduced motion, all run. Screenshots: `phone-crop-day.png`, `phone-crop-night.png`, `desk-crop-day.png`, `desk-crop-night.png`, `nowebgl-day.png`, `nowebgl-night.png`.
- Pending ring: pending mine figure ring 0.5 at blink, 0.17 dimmed (half strength, as designed).
- Rejection: pending figure removed after 2 frames of shake (x offset +1, then −1; 250 ms).
- Alignment: each figure's feet projected to the screen lie within 2–10 px of its bed's svg tap centre (up to 24 px for the wide mats row), and the nearest label names the same bed and room.
- Reduced motion: no pop-in (pop −1), ring steady across 1.5 s, no shake ghost on rejection, no swap fade, no walker (the figure appears in the bed at once), no frames.
- No-WebGL (`getContext('webgl')` forced to null): `iso3` is null, flat ground drawn, svg sprites and tap areas present, tap-able buttons 22.
- Leak test (desktop): 50 × `renderBeds()` with a pending mine figure toggled each round (plus 10 × `render()`), two rounds, then 50 night changes (with the swap), then 5 s idle. Scene object count 333 → 344 after the first pending figure (ring and figure added once), then 344 unchanged for both rounds, after the night changes and after 5 s idle. `renderer.info.memory.geometries` 42 unchanged, `textures` 8 unchanged, `renderer.info.programs` 8 → 9 once (the letter material compiled), then unchanged. `people.group` children equal `entries` (15), `dying` 0 after each round. The people material cache went 26 → 33 → 79 and then stayed at 79 (bounded by colour × opacity and letter × ink × opacity). The JS heap went 16 → 29 → 24 → 28 MB with GC noise, no steady growth.
- Bed taps: the bed-sheet flow still opens on a tap of a free bed; the place button writes it.
- Console: no page errors on phone or desktop. In the no-WebGL run Three.js logs `THREE.WebGLRenderer: Error creating WebGL context.` twice (see observations).

**Observations (not failures)**
1. Low: with no WebGL, Three.js logs `console.error` twice at startup. The app works; a silent skip (no `console.error`) would be cleaner. Decide whether to keep.
2. Low (reviewer's suggestion, still open): `entry.ringMat` is cloned on each redraw for my party and never disposed. It is not a GPU leak (the count of geometries, textures and programs stays flat) and JS collects it, but disposing dropped entries would be tidier.
3. Design question: at the rest zoom the houses are closed, so the figures inside them are not drawn at all (`drawBed` gates on `roomClosed`). That is consistent with the T-137 roofs, but it means no figure, ring or walk target is visible until a house opens. Check against the design intent on a device.
4. Figures are small on a 390 px screen at the rest zoom (about 8 units tall at about 0.66 px per unit): the letter is legible only zoomed in. Checked in the manual list.

**Manual checks added** (`tests/manual.md`, section 15): 3D figures on a real GPU, my party ring, pending / rejection / 06:00 on a phone, walk and meadow in 3D, move-mode lift, no-WebGL device, battery and heat.

**Verdict:** all acceptance criteria pass, no regressions in `tasks/done/` (the full Node and pytest suites pass). Moved to `tasks/done/`. Not committed (the orchestrator commits).

Trial link for the change on the phone: https://<tailnet-host>:8443/ (after the orchestrator's restart).
