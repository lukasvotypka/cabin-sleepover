# T-134: Day and night in 3D, living details, docs

- **Phase:** 1
- **Depends on:** T-133
- **Size:** S
- **UX:** yes

## Goal
The day–night slider lights the 3D world instead of the flat svg tint, and the world moves a little: chimney smoke, campfire flicker, falling leaves, fireflies at night, the tree sway on tap.

## Scope
- `app-daynight.js`: `dnBuild` drops the svg dusk/dark/darkRooms/lamp/firefly overlays; `dnPaint` calls `isoLight(lightAt(h))` (sky/ground light, sun → dusk orange → moon blue, room lamps and window glow by `lamp`, campfire brighter at night, fireflies by `fireflies`); board shade, `night` class, crickets and bird opacity stay.
- `app-iso.js`: animation parts (already drafted); `prefers-reduced-motion` → no animation loop, renders only on change.
- Remove now-dead svg CSS (smoke, leaves, svg tree) and functions; update `CLAUDE.md` "Frontend behaviour" + "Planned architecture" (Three.js vendored exception to no-framework rule, iso projection), `tests/manual.md` (3D map checks on iPhone Safari and Android Chrome).

- Cleanup from T-131..T-133 reviews: delete dead code now unused (`drawFurniture`, `bedHit`/`BED_HIT_GROW`, `meadowHitRect`, old svg tree/roof/smoke drawing and their tests if no longer called); `aria-hidden="true"` on the `.bed-hits` group; stop putting the old `rustle` class on the tree tap polygon; stale comments saying icons come from `map.scene.<key>`.
- CLAUDE.md: note that `static/vendor/three.min.js?v=r158` is the one script outside `static/js/` and is pinned by its own version instead of `__ASSET_VERSION__`.

## Acceptance criteria
- [x] Time-lapse dusk → night → dawn visibly changes the 3D light; rooms glow at night; figures and boards stay readable.
- [x] With reduced motion nothing animates and the scene is still correct after slider changes.
- [x] Hidden tab: no rendering work.
- [x] Tests updated; all green.
- [x] (design) At 23:00 on a phone no flat svg rectangle shows over the 3D world (the patches in `/tmp/cabin-t133/phone-night.png` are gone), the grass is dark blue but not black, and every room and window glows warm.

## Design
Nothing new to tap and no new text. The slider, signposts and time-lapse work as before; only the world reacts. It looks the same on phone and desktop.

**Light curves.** `isoLight(l)` takes `lightAt(h)`. Add `d` (raw darkness 0..1) to `lightAt` with a Node test. `k = l.dusk / .55`. Blend colours linearly in JS. The light changes per slider step, so no tween is needed.
- Hemisphere sky `#FFF4DC` → dusk `#F2B07A` (by k) → night `#3A4A7A` (by d). Ground `#5A6A30` → `#1A2030`. Intensity 0.9 → 0.45.
- Sun (the existing directional light) `#FFFFFF` → dusk `#FF9A4A` → moon `#8FA8E0`. Intensity 0.9 → 0.3 at d=1. **Keep its position**: shadows just fade, and the shadow map is never re-rendered for light changes.
- Target at 23:00: grass reads around `#2A3550`, and pines and roofs stay distinguishable from the ground.

**Lamps (by `l.lamp`).** Cheap, with no extra lights in the rooms.
- Room glow: one quad per room just under wall-top height, covering the room's inner rect. `MeshBasicMaterial` `#FFC76A`, `AdditiveBlending`, opacity `0.22·lamp`, `depthWrite:false`.
- Windows: the glass material gets emissive `#FFD27A` × lamp. Each window also gets a ground spill quad (additive `#FFD27A`, 0.15·lamp, 6 units deep, outside).
- Doors: a spill quad 10 units in front of each door, 0.18·lamp.

**Campfire.** It burns day and night.
- Flames: 3 small `MeshBasic` boxes (`#FFE08A` core, `#FFB43A`, `#E8741E`). They cycle 3 height frames every 160 ms (steps).
- The only `PointLight` in the scene: `#FF8A3A`, distance 70, intensity `(0.3 + 1.3·lamp) × flicker`, flicker from the fixed table `[1, .85, 1.1, .9]`. Add an additive ground ring of radius 18 at 0.3·lamp.

**Life.** All moving parts have `castShadow=false`. They move in discrete steps on a shared 125 ms tick, which marks the scene dirty at 8 fps; pan and zoom keep the full rate.
- Smoke: per chimney, 3 cubes (3 → 5 units, `#C9C2B6`; the moon tints them at night). Each rises 18 units in 6 jumps over 3 s, fading 0.6 → 0, staggered by 1 s.
- Leaves: 6 flat 1.5-unit boxes in the leaf colours fall from leaf trees near the cabins. Each fall takes 4–6 s and jumps ±2 units sideways every 400 ms. The leaf vanishes on the ground and restarts. Hidden when d > 0.6.
- Fireflies: 12 `#F6F2A0` 1-unit cubes, 3–8 units high, at forest and meadow edges, away from the boards. Each blinks on 0.6 s and off 1.2 s with an offset, and hops 1 unit every 500 ms. Opacity is `l.fireflies`; at 0 they are `visible=false`.
- Tree sway on tap: quantize the existing sway to 90 ms steps.

**Readability.** The svg figures, names, „z-z-z“, slot marks and HUD get no tint: people lie in lamp-lit rooms. `boardShade` stays at `dark·0.25`. The board block is never covered by fireflies or smoke (no puff rises above `worldTop`).

**Reduced motion.** No loop, no smoke, no leaves, no sway. The flames show their middle frame and the fireflies sit still at `l.fireflies`. Each slider change sets the light and renders once.

**Hidden tab.** Drive the tick from the rAF timestamp only, with no `setInterval`. On return, restart the cycles where they are; do not catch up.

**Do not:** move the sun or moon, add sky or stars, add per-room `PointLight`s, add fog or post-processing, use smooth tweens on flames, smoke, leaves or fireflies, tint the svg figures, or change the slider UI.

---
## Dev log
- `logic-daynight.js`: `lightAt` returns `d`. `logic-iso.js`: `isoMix`, `isoLightParams` (sky, ground, glow, hemi, sun, smoke), tick constants and pure cycles `isoFlameFrame`, `isoFlicker`, `isoSmoke`, `isoLeaf`, `isoFirefly`.
- `app-iso.js`: `isoBuildLife` (room glow quads, window and door spill quads, glass emissive, animated flames, the one PointLight, ground ring, smoke, leaves, fireflies), `isoLight(l)`, `isoMove`, on-demand rAF loop (`isoWake`/`isoLoop`, 125 ms tick from the frame time, clock advanced by at most 250 ms per tick so a pause does not catch up, sleeps while hidden or when idle with reduced motion), tree sway in 90 ms steps.
- `app-daynight.js`: `dnBuild` keeps only the board shade and slider; `dnPaint` calls `isoLight`. Removed the svg dusk/dark/lamp/firefly layer, `dnFitArea` (and its call in `app-zoom.js`).
- Cleanup: removed `drawFurniture` (+ helpers), `drawTree`, `drawRoof`, `drawChimney`, `drawHouses`, `bedHit`, `BED_HIT_GROW`, `meadowHitRect`, smoke colours, dead CSS (smoke, leaves, svg tree, firefly) and their tests (incl. the meadow check in `tests/test_map_layout.py`); `.bed-hits` is `aria-hidden`; `rustleTree()` no longer takes or classes the tap polygon; stale `map.scene.<key>` comments fixed.
- Docs: `CLAUDE.md` (Three.js exception and `?v=r158`, isometric map and light/life), `tests/manual.md` section 16.
- Tests: `node --test tests/js/` 404 pass; `uv run pytest -q` 741 pass.
- Browser (headless Chrome, swiftshader, 390x844, own server :8234, data in /tmp/cabin-t134/data): screenshots `/tmp/cabin-t134/phone-12.png`, `phone-19.png`, `phone-23.png`, `phone-30_6.png`, `reduced-23.png`, crops `crop23.png`, `crop_dusk.png`, `crop_dawn.png`. Measured: about 7 renders/s while animating, 0 renders hidden, clock frozen while hidden, 0 renders with reduced motion at rest.
- Deviations: night glow of rooms 0.4 (design 0.22), window and door spill 0.25 (design 0.15 and 0.18) because 0.22 did not read as warm on a phone; the ground got a small blue emissive (`glow`, `#1B2A48` x d) because blue light alone leaves green grass black (design asks for about `#2A3550`). 19:00 is already fully dark (sunset 16:40), so dusk orange is seen around 16:40 (`crop_dusk.png`).
- Left alone: `roofRows`/`roofRect`/`chimneyRect`/`ROOF_*` in `logic-beds.js` are pure and still tested (Python `ROOF_CHECK`); now unused by the page, can be removed in a follow-up.

## Review round 1
Ran `node --test tests/js/` (404 pass) and `uv run pytest -q` (741 pass). I also re-ran the dev's `shot.js` against the current code on my own port 8237, using a copy of the data. The dev's screenshots in `/tmp/cabin-t134/` were taken at 03:45, before the last edits to `app-iso.js`/`logic-iso.js` at 03:46. In those screenshots the 23:00 grass is `#2A3924`, which is green. With the current code it is `#344851`: dark blue and not black, close to the `#2A3550` target. Rooms and windows glow warm, and the boards and figures stay readable. Measured: 7 renders/s while animating, 0 renders and a frozen clock while hidden, and 0 renders at rest with reduced motion.

**Meadow check removal (pytest 742 → 741): justified.** `meadowHitRect` had been dead since T-133, because the page draws the meadow tap area with `isoMeadowHit` (app-beds.js:161). The removed test only covered that dead function. `isoMeadowHit` is covered by the Node test "iso meadow: the tap polygon covers the waiting figures and misses every bed polygon".

No blockers. Everything else checks out:
- The light curves follow the design, and the sun keeps its position.
- The tick runs from rAF only. A pause is capped at 2 ticks, so there is no catch-up, and `visibilitychange` resets `tickAt`.
- The loop sleeps when idle under reduced motion. Flames show the middle frame and fireflies sit still.
- Smoke is culled above `worldTop`. Moving parts are basic materials with no shadows.
- A context restore rebuilds the world, and `isoLastLight` carries the light over to it.
- The dead code and CSS are removed, and no callers are left (grep).
- `.bed-hits` is `aria-hidden`.
- CLAUDE.md notes the vendored Three.js and `?v=r158`.
- Every `static/js/*.js` is listed in index.html with `?v=__ASSET_VERSION__`.

**Suggestion**
- Without WebGL (flat fallback), night now has no tint except the 0.25 board shade, because the svg dark layer is gone. That is acceptable for a fallback, but a single cheap svg tint in `drawBase` mode, used only when `!isoActive()`, would keep the time-lapse meaningful there.
- Follow-up: remove `roofRows`/`roofRect`/`chimneyRect`/`ROOF_*` and the Python `ROOF_CHECK` (as the dev noted).
- The room glow is 0.4 and the spill 0.25, instead of the design's 0.22/0.15/0.18. The dev states this deviation and it looks right on the phone screenshot. Flag it to the UX designer only if the organizer finds it too bright.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester: Haiku 5.5 (tester), 27. 10. 2026. Working tree as left by T-133 commit plus the uncommitted T-134 changes. No application code or tests were changed by the tester.

**Automated suite (run once):**
- `uv run pytest -q` → 741 passed (14.5 s). Matches the dev and reviewer count.
- `node --test tests/js/` → 404 pass, 0 fail (includes `lightAt` `d`, `isoLightParams`, `isoMix`, flame, smoke, leaf and firefly cycles).

**Browser checks** (headless Google Chrome 156 over CDP, swiftshader, own server on 127.0.0.1:8251, temp data in `/tmp/cabin-t134-test/data`, server stopped afterwards; 8010 untouched). Screenshots in `/tmp/cabin-t134-test/shots/`.

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Time-lapse dusk → night → dawn changes the 3D light; rooms glow at night; figures and boards readable | PASS | Tap on „Pi → So“ signpost: hour runs 12 → 36 in about 2.5 s (phone and desktop). 16:40: sky `978586`, d 0.50. 23:00: sky `3a4a7a`, sun `8fa8e0` 0.3, room glow 0.4, windows 0.25, campfire 1.76, fireflies visible (6). Dawn 06:30: d 0.70. Screenshots show lit rooms, readable figures and boards. |
| 2 | Reduced motion: nothing animates; scene correct after slider changes | PASS | `prefersReducedMotion()` true. 0 renders in 2.5 s at rest. Flame heights constant. No smoke or leaves visible. Signpost tap jumps to 36 with 1 render. `dnSetHour(23)` gives 1 render, then 0 at rest. Light correct (d 1, sky `3a4a7a`). |
| 3 | Hidden tab does no rendering | PASS | `visibilityState` hidden after activating another target. 0 renders and frozen clock over 4 s, and 0 renders on a light change while hidden. On return: visible, light correct at once, 15 renders in 2 s (about 7.5/s, as designed). |
| 4 | Tests updated, all green | PASS | 741 pytest, 404 Node. |
| 5 | (design) 23:00 phone: no flat svg rectangle over the world, grass dark blue not black, rooms and windows warm | PASS (visual) | `phone-night-2300.png`: no rectangle, grass dark blue-teal, rooms warm. Pixel values not measured. |
| – | Scope: dead code removed, `.bed-hits` aria-hidden, `rustle` class gone, no stale `map.scene.<key>` comments, `dnFitArea` gone, CLAUDE.md notes the vendored Three.js and `?v=r158` | PASS | grep over `static/js` and `index.html`. The `.yard-*` CSS and `app-slides.js`/`app-adventure.js` are the live „Pred cestou“ view, not the dead svg smoke. |

**Regression (full map, phone 390x844 and desktop 1280x800):**
- Bed tap (3D world on): opens the bed sheet. PASS.
- Board taps: signpost time-lapse PASS. „?“ Návod on a settled map opens the window (`probe-notice.png`). The first attempt missed because it fired during the 2.8 s intro zoom, when the target was still moving; not a bug.
- Slider knob drag 45 px: hour 12 → 18.7, light follows. PASS.
- Pan (phone drag): bed moved −78 px, the element at its new centre is the `bed-hits` polygon, and a tap there opens the sheet. PASS.
- Wheel zoom (desktop): bed moved, hit test returns `bed-hits`, tap opens the sheet. PASS.

**Fallback without WebGL** (Chrome with `--disable-webgl --disable-3d-apis`): PASS as functional. `isoActive()` false. Flat svg map draws all 20 beds. Signpost time-lapse and slider change the clock, the bed tap opens the sheet, no page exceptions. The flat map at 23:00 shows no night tint except the board shade (0.195 on the boards). The world looks like noon. Non-blocking, see notes.

**Extra scenarios tried:** intro zoom interrupted by a tap; reduced motion with the slider moved in both directions; tab hidden during a light change; the no-WebGL page with the bed sheet open.

**Notes (non-blocking, for the developer and organizer, not failures):**
1. No-WebGL fallback at 23:00 has no visible night (`nogl-night-23.png`). The reviewer suggested a cheap svg tint in the flat-only mode. Decide whether it is wanted.
2. Every page load without WebGL logs three-js `console.error` lines ("WebGL context could not be created", about 13 per load). Harmless, but noisy. Consider skipping the renderer when `isoAvailable()` is false.
3. Dusk at 16:40 reads grey-olive, not clearly orange (sky `978586`, sun `c7aeac`). The design's orange is diluted by darkness 0.5. Worth a look on the phone.
4. Slider label floors to quarter-hours: 16:40 shows „16:30“ (`logic-daynight.js` line 33/123). Probably intended.

**Manual items** (already in `tests/manual.md` section 16, nothing added): time-lapse, moving details, smoothness and phone heat, reduced motion on iOS and Android, hidden tab on devices. Not run here: iPhone Safari, Android Chrome, real GPU and battery behaviour.

**Verdict: PASS.** No failures and no regressions found. Moved to `tasks/done/`.

Link for the organizer: the T-134 changes are not committed yet, so the trial server at https://lukass-laptop-1.tail3bf463.ts.net:8443/ does not show them. The orchestrator should commit and restart it (or a preview port is needed for the uncommitted change).
