# T-142: Lighter geometry and automatic quality

- **Phase:** 1
- **Depends on:** T-141
- **Size:** M
- **UX:** no (organizer's go-ahead of 27. 10. 2026)

## Goal
Keep 30 fps on weaker phones. Profiling (27. 10., software GL worst case, 42.8 ms per frame): the one big static mesh (31k of 35k triangles, mostly voxel trees) costs about half, soft shadow sampling about a third, pixel ratio 1.5 vs 1 about a third.

## Scope
- `IsoBoxes` / tree builders: drop faces hidden between touching boxes (crowns, stacked logs, tiers), merge coplanar neighbours where cheap; target ≥ 40 % fewer triangles in the static mesh with the same look (before/after screenshots).
- Automatic quality in `app-iso.js` (pure decision in `logic-iso.js` with Node tests): if the measured frame time (meter samples, or GPU timer when available) stays above the 30 fps budget for ~2 s while animating, step down: pixel ratio 1.5 → 1.25 → 1, then soft shadows → hard (`PCFShadowMap`); step back up only after a long good stretch (hysteresis, no flapping). The meter shows the current level.
- Update CLAUDE.md and tests.

## Acceptance criteria
- [x] Static mesh triangles reduced ≥ 40 %; screenshots before/after look the same.
- [x] Frame time in headless Chrome (metal and swiftshader) measured before/after and reported.
- [x] Forced slow frames (test hook) make the quality step down and later up, without flapping; Node tests of the decision.
- [ ] Svg/3D alignment unchanged (T-135 probe; not re-run, camera code untouched); tests green (they are).

---
## Dev log

Round 0 (developer):
- Geometry (`static/js/app-iso.js`): `IsoBoxes.box()` now queues boxes; `flush()` (run by `geometry()`) builds the faces and drops those another box covers (grid lookup, closed shell stays). New `face()`; leaf crowns build only outside cell faces, merged greedily by colour; pine trunk ends inside the first tier; pine thin light slabs replaced by a lit top face (`topColor`). Static mesh 31420 -> 18198 triangles (-42 %); scene total 34418 -> 20716. Before/after screenshots look the same (phone 390x844, house open, ?fps=1); one deliberate change: the 1-unit dark ring around pine tier tops is now lit too.
- Automatic quality: pure `isoQualityStep` / `ISO_QUALITY` in `logic-iso.js` (levels 1.5, 1.25, 1 px, then hard shadows; 2 s over 40 ms down, 20 s good up with the wait doubling per step down, max 8x; pauses > 400 ms reset). `isoQualityFrame/Apply` in `app-iso.js`, level kept across rebuilds; meter shows `q0..q3 [hard]`. Test hook `isoQualityExtraMs`. Browser check: extra 40 ms stepped 0 -> 2 -> 3 (hard, PCFShadowMap) in ~6 s, then back to 0 in steps (with upAfter lowered to 3 s for the test), no flapping.
- Tests: 5 new Node tests in `tests/js/logic.test.mjs`, one existing source check updated. CLAUDE.md updated.
- Measured (headless Chrome, 390x844 dpr3, median ms of render+readPixels, auto quality locked at q0): metal (Apple M2): 1.1 -> 1.1 ms (too fast to resolve, floor-bound); swiftshader: 39.7-47.5 -> 31.8 ms (-20..-30 %). With the auto quality active, swiftshader steps itself down to px 1 and hard shadows. Files and logs in /tmp/cabin-t142/ (before-*.png, after-*.png, before/after-*.txt).
- Commands: `node --test tests/js/` (431 pass), `uv run pytest -q` (741 pass).
- T-135 alignment: no camera/projection code touched; static meshes only. Not re-probed by script.
- Follow-up: GPU-bound frame time on a real weak phone is unmeasured here.

## Review round 1

Checked: `git diff` of app-iso.js, logic-iso.js, app-fps.js, tests, CLAUDE.md; before/after screenshots in /tmp/cabin-t142/ (look the same, 34k -> 21k tris). `node --test tests/js/` 431 pass, `uv run pytest -q` 741 pass. No new scripts, so index.html needs no change.

- Face culling (`IsoBoxes.flush`): the cover rule is conservative and correct (one box must cover the whole face, either straddling its plane or touching it from outside); it works only within one builder, so the moving parts (roofs, open/closed fronts, the swaying tree) are separate meshes and cannot leave holes. `glass.flush()` before the `pos.length` check is right; no other caller reads `pos` before `geometry()`. The crown's greedy merge maps (l, u, v) correctly for all five faces, and the AO bands depend on absolute height, so merged side faces shade the same.
- Automatic quality: pure, tested, fed only when animating. The tick always sets `dirty` every 33 ms, so draw intervals really measure frame speed and not idle time. Gaps over 400 ms reset both streaks, and the climb waits get longer (40, 80, 160 s), so it does not flap. A shadow type change sets `needsUpdate` on the materials, which three r158 needs to recompile.
- Alignment criterion: there are no camera or projection changes, and `setSize(..., false)` keeps the CSS size, so alignment cannot shift. The tester can tick it off with the T-135 probe.

**Blockers:** none.

**Suggestions**
- CLAUDE.md says the climb comes "after 20 s of good frames". Because the wait doubles on the first step down, the first climb really takes 40 s (the test checks this). Change the wording to "40 s, doubling after each step down, up to 160 s", or double only from the second step down.
- The `hidden` argument of `IsoBoxes.box()` has no caller (pine passes `null`). Drop it or use it.
- On a dpr-1 device, levels 0 to 2 are the same picture, so the step to hard shadows comes only after about 6 s. This is acceptable, but `isoQualityStep` could skip levels whose `px` is at or above the device's ratio.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

**Tester (27. 10. 2026), round 1.** Environment: temp servers on 127.0.0.1:8421 (HEAD via `git archive`) and 8422 (working tree), temp data, both stopped afterwards. Scripts and logs in /tmp/cabin-t142-test/. Chrome 156, phone 390x844 dpr 3 (triangle and quality runs), metal = default ANGLE, swiftshader = `--use-angle=swiftshader`.

Commands and results:
- `node --test tests/js/` → 431 pass, 0 fail.
- `uv run pytest -q` → 741 passed.
- Triangles (`iso3.scene` traverse, every mesh, rest view): static mesh (largest mesh) HEAD 31420 → after 18198 (-42.1 %). Whole scene (62 meshes) 37870 → 23612 (-37.7 %). Per-frame `renderer.info` at house open: 35354 → 21440 tris.
- Look: `phone-before-house-open.png` and `phone-after-house-open.png` (metal, house opened by a real tap) look the same to me: roofs, walls, trees, beds, labels, HUD. Pixel diff not possible here (no PIL or ImageMagick), so this is a visual check only.
- Quality, forced slow frames (`isoQualityExtraMs = 40`) on swiftshader and metal: levels 0 → 1 → 2 → 3 (px 1, hard shadows) at 8 to 12 s, no flapping, no down-step during climbing. `phone-quality-low.png` shows `q3 hard` in the meter.
- Recovery after the hook is removed (metal, clean 30 fps frames): level 3 → 2 at 283 s, 2 → 1 at 443 s (the test ran to 500 s). `upAfter` stays at 160 s after the three step-downs (`isoQuality.upAfter` = 160000 read in page). Real-frame sample on swiftshader at level 3 without hook: p50 33.3 ms, but 8.5 % of frames over 40 ms, which resets the good streak; no climb in 200 s on that loaded machine (load average 11).
- T-135 alignment probe (`/tmp/cabin-t135-test/r2/t135-r2.mjs`, copied with port 8422 and output in /tmp/cabin-t142-test/shots/): phone and desktop, worst svg/3D mismatch at every step 0 to 0.001 px over 72 points (rest, slider drag, zoom in and out, pan). The probe's last step (tap a bed) crashes: no `[data-bed]` at rest because closed houses hide their beds (T-137, app-houses.js unchanged by T-142). This is a stale step in the probe, not a T-142 fault, and it runs after the alignment numbers.
- No console or page errors in any run.

Acceptance criteria:
| Criterion | Result |
| Static mesh triangles -40 % or more, same look | pass (-42.1 %, look checked) |
| Frame time before/after on metal and swiftshader | pass, carried from the developer's numbers; tester did not re-time (metal floor-bound, swiftshader 39.7-47.5 → 31.8 ms) |
| Forced slow frames step down and up, no flapping; Node tests | pass (down and up on both GPUs; Node tests 431 pass) |
| Alignment unchanged (T-135 probe), tests green | pass (0 to 0.001 px) |

Notes, not failures (non-blocking):
1. The climb is slower than CLAUDE.md says. CLAUDE.md says "climbs back only after 20 s of good frames". Code: the first climb waits 40 s, and after three step-downs every climb waits 160 s (`upAfter` only grows on a step down and is never reset on a climb). Full recovery from q3 on clean frames takes at least 480 s. Please correct the wording or reset `upAfter` after a climb.
2. One frame over 40 ms resets the good streak. On a busy machine (8.5 % frames over budget) the page never climbs back. This matches the design but is worth knowing for phones.
3. The T-135 probe's bed-tap step is stale since T-137 (see above).

Bug reports: none blocking.

Verdict: PASS. Moved to `tasks/done/`. Manual items added to `tests/manual.md` (automatic quality on a real phone, look after lighter geometry).
