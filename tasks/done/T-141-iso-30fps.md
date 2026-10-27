# T-141: Smooth 30 fps animation and a fuller fps meter

- **Phase:** 1
- **Depends on:** T-140
- **Size:** M
- **UX:** no (organizer's concrete request of 27. 10. 2026: „Can i have 30fps?“ → go ahead)

## Goal
Everything that moves in the 3D world updates at ~30 fps instead of the 8 fps pixel tick (profiling on 27. 10.: a full frame is 2 ms on an M2, JS logic < 0.05 ms, so 8 fps was a design choice, not a limit). Animation durations stay the same, motion becomes smooth.

## Scope
- `logic-iso.js` / `logic-iso-people.js` / `app-iso*.js`: split the update rate (new ~33 ms) from animation timing: every animation length now in ms (pop, shake, fade, hop, walk, roof lift, flicker, blink, smoke, leaves, fireflies, tree sway), interpolated smoothly where it was stepped (keep the campfire flicker and ring blink as on/off rhythms at their old speeds).
- Sun shadow steps (T-140): smaller step (e.g. 2° az / 1° elev) so the shadow follows smoothly during the time-lapse, still no redraw while time stands still; measure the shadow redraw count.
- Reduced motion unchanged (no animation, one render per change); hidden tab still renders nothing.
- fps meter (`app-fps.js`): add GPU frame time when `EXT_disjoint_timer_query_webgl2` is available (else „gpu ?“), draw calls and triangles of the last frame.
- Update CLAUDE.md (8 fps tick wording) and tests.

## Acceptance criteria
- [x] With the meter on, the scene runs at ~30 fps while something moves (headless Chrome with real GPU `--use-angle=metal`), 0 renders at rest with reduced motion.
- [x] Each animation keeps its previous duration (Node tests on the ms-based timing functions).
- [x] Shadows move smoothly in the time-lapse; no shadow redraw while time stands still.
- [x] Tests updated; all green.

---
## Dev log
- `ISO_TICK_MS` 125 -> 33 (update tolerates 4 ms early, so 2 frames of 60 Hz make one update); new `ISO_STEP_MS` 125 keeps the old rhythms (campfire flicker, ring blink 4 x 125 ms) and the animation lengths. Frame cap also 33 ms with the same tolerance. Time step per update capped at 250 ms.
- Smooth, same durations: smoke (continuous rise/size/fade over 3 s), leaf drift, firefly drift (per 500 ms hop), pop 375 ms, shake 250 ms (cos), 06:00 fade 375 ms (0.25..1, opacity cache now in eighths: `isoQuarter` -> `isoOpacityStep`), waiter hop 250 ms arc every 4 s, lifted figure bob 250 ms, walk (steady pace, bob 250 ms period, no whole-unit rounding), bed climb at 4 units/80 ms, roof/wall opening 6 steps x 125 ms as a float (`isoOpenFrame`, `isoStepToward(step, target, delta)`), tree rustle without the 90 ms quantizing.
- Sun shadow step 6/2 deg -> 2/1 deg; still no redraw when time stands still.
- fps meter: GPU frame time via `EXT_disjoint_timer_query_webgl2` (else „gpu ?“), draw calls and triangles (`app-fps.js`, `fpsText` takes a third argument).
- CLAUDE.md wording updated. Files: `static/js/logic-iso.js`, `logic-iso-people.js`, `logic-iso-roof.js`, `app-iso.js`, `app-iso-people.js`, `app-iso-roof.js`, `app-fps.js`, `tests/js/logic.test.mjs`, `CLAUDE.md`.
- Tests: `node --test tests/js/` 426 pass; `uv run pytest -q` 741 pass.
- Real GPU (headless Chrome, metal, phone 390x844, driver /tmp/cabin-t141b/drive.mjs): at rest with motion allowed 30 renders/s, 0 shadow redraws; during a time-lapse 29 renders/s and 26 shadow redraws in 3 s; time standing still 0 shadow redraws; reduced motion at rest 0 renders. Meter: "3D 29 fps · cpu 0.7 ms (max 1.5) · gpu 0.8 ms · 43 calls · 36k tris · px 1.5". Screenshots in /tmp/cabin-t141b/ (rest.png, timelapse.png).
- Note: with motion allowed the scene renders 30/s continuously (smoke always moves), as it did at 8/s before.

## Review round 1

Tests run by the reviewer: `node --test tests/js/` 426 pass, `uv run pytest -q` 741 pass. All 43 scripts in `static/js/` are listed in `index.html` with `?v=__ASSET_VERSION__` (no new scripts).

Checked: every old step animation is now a function of elapsed ms with the same length (pop 375 ms, shake 250 ms, 06:00 fade 375 ms with the same 0.25/0.5/0.75/1 values at the old step points, waiter hop 250 ms every 4 s, lift bob 250 ms, roof/wall opening 6 x 125 ms via fractional `isoStepToward`, walk run unchanged); flicker and ring blink keep their 125 ms / 500 ms rhythm on `ISO_STEP_MS`; leaf and firefly drift are continuous across hop boundaries (tested); the per-update `dt` cap stays at 250 ms as before; the -4 ms tolerance gives a true 30 fps on 60/90/120 Hz displays. Sun threshold 2°/1° still skips redraws when time stands still, and reduced motion / hidden tab paths are untouched. GPU timer query is meter-only, guarded when the extension is missing, bounded at 6 pending queries, and drops disjoint results. Screenshot `/tmp/cabin-t141b/rest.png` shows the meter line as specified.

No blockers.

**Suggestion**
- Battery: with motion allowed the scene now renders 30/s for as long as the tab is visible (was 8/s), since smoke and leaves never stop. The organizer asked for 30 fps and a frame is ~1-2 ms GPU/CPU, so this is acceptable, but on a phone left open on the page it is ~3.75x the GPU wake-ups. A cheap follow-up if anyone notices warm phones: drop the idle ambient life (smoke, leaves, fireflies only, nothing else changing) back to ~10-15 fps, and keep 30 fps while a pop, walk, house opening, shake or time-lapse runs.
- House opening now sets `shadowMap.needsUpdate` on every update (~23 shadow redraws per opening instead of 6), because each fractional step changes `h.shown`. Short and fine on the measured hardware; just noting it.

**Nit**
- `static/js/app-actions.js:72` comment still says „one hop per tick with a bob“; the walk is now a steady pace. `hop || smp.bob` also switches from bob to the (initially tiny) climb height abruptly at the start of the climb; barely visible.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (27. 10. 2026, Claude Haiku 5.5). Result: **PASS**, no bugs. Moved to `done/`.

**Commands run**
- `node --test tests/js/` → 426 pass, 0 fail.
- `uv run pytest -q` → 741 passed.
- Own server: `GROUP_CODE=testgroup ADMIN_CODE=testadmin SECRET_KEY=<test 40-char> SMS_FAKE=1 uv run python -c "...create_app(data_dir='/tmp/cabin-t141-test/data')..." ` on 127.0.0.1:8161 (stopped afterwards). `/api/health` ok, `/` serves 43 `?v=528456db91ff` scripts and `?v=r158` for three.js.
- Node duration check (`/tmp/cabin-t141-test/node/durations.cjs`, loads the `logic-iso*.js` files into a vm): values below.
- Headless Chrome, GPU metal, phone 390x844 DPR 2, `?fps=1` (`/tmp/cabin-t141-driver/drive.mjs`, `probe2.mjs`, `probe3.mjs`). No page exceptions in any run.

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| ~30 fps while moving, meter on | PASS | At rest motion allowed: 90 renders in 3 s (30/s), meter „3D 30 fps · cpu 0.5 ms · gpu 0.7 ms · 31 calls · 36k tris“. Time-lapse: 88 renders in 3 s (29.3/s). House opening: 29.2/s. |
| 0 renders at rest with reduced motion | PASS | 0 renders in 3 s, meter „3D 0 fps … gpu ?“ (gpu ? shown because no timed render completed in that run; not investigated). |
| Durations unchanged | PASS | Node: pop 375 ms (scale 0.4 → 1.15 → 1), fade 375 ms (0.25 at 0 → 1 at 375), shake 250 ms, waiter hop 250 ms every 4 s, lift bob 250 ms, walk 1600 ms (`walkMs` same as HEAD), smoke 3 s, flicker steps 125 ms (0,1,0.85,1.1 at 0/125/250/375). House open measured in browser: 732 ms from step 0 to 6 (6 × 125 ms), close 759 ms. |
| Shadows smooth in time-lapse, no redraw at rest | PASS | Time-lapse: 27 sun-shadow redraws in 3 s. After the lapse with time still: 0 in 3 s, and 0 at rest from the first sample. |
| Tests updated, all green | PASS | 426 Node, 741 pytest. |

**Extra scenarios**
- Hidden tab (simulated: `document.hidden` overridden to true and `visibilitychange` dispatched; not a real tab switch): 0 renders in 3 s. After showing again: 30.7 renders/s.
- Real touch (CDP `Input.dispatchTouchEvent`) on „Manželská posteľ“ in konica (house opened first): sheet opens with the bed name, „Ľahnúť si sem“, keyboard focus moved to the night heading (activeElement: night-head). Regression OK.
- House opening: 23 shadow-map updates in 0.75 s (roof shadow, counted outside `shadowDraws`, as the reviewer noted). Not a failure, but it is more than the sun shadow count.
- Alignment: from the screenshots, the opened house, its roof and tags line up. Not pixel-measured.
- Not checked: the single reduced-motion render of a time jump (my counter started after the jump); a real pinch/zoom alignment.

**Screenshots** (in `/tmp/cabin-t141-test/`): `phone-rest-fps.png` (meter 30 fps, rest), `phone-timelapse-fps.png` (during a lapse), `phone-house-open.png` (konica open, roof gone), `phone-after-bed-tap.png` (after the touch, sheet open).

**Manual / device (added to `tests/manual.md`, section 20):** 30 fps and heat on iPhone Safari and Android Chrome; animation lengths by eye; reduced motion and hidden tab on a real device.

**Doc fixes (tests/manual.md, small):** the T-137 item said „0.4 s … 8 fps tick“ (now 0.75 s, 30 fps) and the T-140 item cited the old sun thresholds 6°/2° (now 2°/1°). Both updated.

**Battery note** (reviewer's suggestion, unchanged): the scene renders 30/s for as long as the tab is visible, since smoke and leaves always move. GPU cost is about 0.8 ms per frame here, so not a blocker. Watch for warm phones on the device check.

**Bugs:** none.

**Trial link:** `https://lukass-laptop-1.tail3bf463.ts.net:8443/` (after commit and restart by the orchestrator). My own test server is stopped.
