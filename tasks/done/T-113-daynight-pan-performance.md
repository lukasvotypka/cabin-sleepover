# T-113: Day–night layer costs nothing at rest (map pan/zoom fps)

- **Phase:** 1
- **Depends on:** T-111
- **Size:** S

## Goal
Organizer report of 26. 10. 2026: since T-111, moving the map on the phone has poor fps. The day–night light layer
(`static/js/app-daynight.js`) stays in the SVG at rest (noon) with only `opacity="0"`: two 4380 × 4496 rects with
`mix-blend-mode: multiply`, one of them masked by `#dnMask`, the board shade rects with multiply, and seven fireflies
whose CSS animation runs forever. Panning and zooming change the `viewBox`, so the whole SVG repaints on every frame,
and WebKit (iPhone Safari) still pays for the blend isolation and the mask of invisible elements. Measured in headless
Chrome with 8× CPU throttle: p90 frame time 24 ms with the layer, 21 ms with it removed; on iOS the gap is larger.
Proposal section „Deň a noc pri prepnutí noci“.

## Scope
- `static/js/app-daynight.js`
- `tests/js/logic.test.mjs` (source checks only, if useful)

## Acceptance criteria
- [x] Every light element whose computed opacity is 0 (dusk, dark, lamp, fireflies, board shade) has `display="none"`
      (or the attribute/style equivalent), and both wrapper groups (the light layer and the board-shade group) are
      `display: none` when all their children are hidden. At rest at noon nothing from the light layer is rendered.
- [x] The blend style (`mix-blend-mode: multiply`) and the `mask` reference are not present on any rendered element
      at rest; it is fine to keep them on the hidden elements.
- [x] Fireflies do not animate while hidden (`display: none` stops the CSS animation).
- [x] During a time-lapse the look is unchanged from T-111 (same opacities, same order), and the layer is hidden
      again when the clock comes back to rest at noon, including after a retarget and after `dnStop()`.
- [x] `dnBuild` after a scene rebuild leaves the layer hidden at noon and visible at a night hour (mid-animation).
- [x] Toggle `display` only when the visible state changes (no attribute writes per frame beyond what T-111 does).
- [x] `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
- A small helper like `dnVis(node, opacity)` that sets `opacity` and switches `display` when crossing 0 keeps
  `dnPaint` readable. Use a threshold (e.g. `< 0.002`) so a rounded `0.000` counts as hidden.
- Do not change the light curves or the T-111 behaviour; this is a performance-only fix.
- The bird is not part of this: it already animates by design; keep its opacity handling as is.
- Check with your own headless Chrome on a free port (not 8000, 8010, 8766, 8768); `/tmp/dn-perf/perf.mjs` is a pan
  probe (edit the port) and `/tmp/t111/script/` has the T-111 browser scenarios.

---
## Dev log

Added `dnVis`/`dnWrap` in `static/js/app-daynight.js`: opacity always written as before, `display="none"` toggled only on crossing 0.002; both wrapper groups hide when all children hidden; everything hidden at build. Source test added to `tests/js/logic.test.mjs`. `node --test tests/js/` 361 pass, `uv run pytest -q` 739 pass. Verified by reading logic only; no browser run (fps not measured, mid-animation rebuild covered by fresh `fx.vis` repaint in dnBuild).

## Review round 1

Checked `static/js/app-daynight.js` diff, `dnStop`/`dnSync`/`dnStep` paths and `lightAt` in `logic-daynight.js`.

- All five light nodes plus both wrapper groups get `display="none"` at build; `dnVis`/`dnWrap` only touch `display` when the visible state flips (cached in `fx.vis`), so per-frame writes stay at T-111's opacity writes. Opacity values and node order are unchanged.
- `lightAt(12)` returns exactly 0 for dark/dusk/lamp/fireflies, so at rest at noon nothing from the layer is rendered; blend/mask exist only on hidden nodes; fireflies are under a `display:none` group, so their animation stops.
- End of time-lapse, retarget and `dnStop()` all end in `dnPaint(noon)` (directly or via `dnSync`), which hides the layer again. `dnBuild` creates a fresh `fx.vis = {}` and calls `dnPaint(dn.hour)`, so a rebuild mid-animation shows the layer at the current hour and hides it at noon.
- Scripts still listed with `?v=__ASSET_VERSION__`.
- Tests run by reviewer: `node --test tests/js/` 361 pass, `uv run pytest -q` 739 pass.

Suggestion: the new Node test only greps source strings; a small DOM-stub test of `dnVis` crossing 0.002 would guard the toggle logic better. Not required.

No blockers; round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2

## Test report

Tester run on 26. 10. 2026. Own server: `GROUP_CODE`/`ADMIN_CODE`/`SECRET_KEY` test values, `data_dir=/tmp/t113/data`, `127.0.0.1:8555` (stopped afterwards). Scripts in `/tmp/t113/` (not in the repo). Chrome headless with Playwright from `/tmp/t111/node_modules`.

**Commands and results**
- `uv run pytest -q`: 739 passed.
- `node --test tests/js/`: 361 pass, 0 fail.
- `/tmp/t113/probe.mjs` (rest, time-lapse, retarget, dnStop, rebuild): no page errors.
- `/tmp/t113/run3.mjs` (T-111 scenarios, port and cookie adapted, `VW=390`): no page errors, console or HTTP errors; tap 29→30, retarget, HUD action, instant switch during animation, reduced motion and 360 px clock all behave as in T-111.
- `/tmp/t113/rebuild.mjs`: `ensureScene()` forced mid-animation at a night hour (layer visible, dark 0.78), after the end the layer is hidden again.
- `/tmp/t113/perf2.mjs` (pan probe from `/tmp/dn-perf/perf.mjs`, 8x CPU, 120 frames per run, alternating, two rounds): current (layer hidden) median 16.6–18.1 ms, p90 19.2–24.3 ms; layer forcibly shown median 16.6–19.5 ms, p90 20.6–23.1 ms. No measurable difference in headless Chrome.

**Acceptance criteria**

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Hidden light elements and both wrappers `display: none` at rest (noon) | PASS |
| 2 | No blend or mask on a rendered element at rest | PASS (11 blend elements and 1 mask attached, 0 rendered) |
| 3 | Fireflies do not animate while hidden | FAIL (see bug 1) |
| 4 | Time-lapse unchanged, layer hidden again at noon after retarget and after `dnStop()` | PASS (end, retarget and dnStop all hidden; opacity writes unchanged in the diff; look checked by the T-111 run, not pixel-compared) |
| 5 | `dnBuild` mid-animation at a night hour: visible; at noon: hidden | PASS |
| 6 | `display` toggled only on visible change | PASS (32 display mutations over a 254-frame time-lapse) |
| 7 | `node --test tests/js/` and `uv run pytest -q` pass | PASS |

**Bug 1 (criterion 3): fireflies keep their CSS animation when only the group is hidden**
- Steps: open the app on a phone-sized viewport (or headless Chrome, 390 px), wait for the intro, at rest run `document.querySelector('.dn-ff').getAnimations()` and `dn.fx.fireflies.getAttribute('display')`. Wait 700 ms and read the animation again.
- Expected (per criterion): `display="none"` on the group stops the firefly animations, so no animation is running.
- Actual: group `display="none"`, but each `.dn-ff` still has a `dnFirefly` animation with `playState: "running"` and `currentTime` advancing (4933 → 5633 ms). Setting `display="none"` on a `.dn-ff` element itself does cancel it (0 animations). So Chrome only cancels the animation when the element itself is hidden, not its ancestor.
- Suggested fix: also set `display="none"` on each `.dn-ff` element (or pause them with `animation-play-state`) when the group is hidden. Alternatively the organizer may decide the criterion is not needed, since the pan probe showed no measurable cost (see below).
- Safari behaviour is not checked here; add to manual checks if the fix is not done.

**Performance goal (not an acceptance criterion, noted for the developer)**
- The organizer's gain (p90 24 ms → 21 ms) is not reproduced in headless Chrome at 8x throttle: current and forced give the same median (about 17 ms) and p90 within noise (19–24 ms). An iOS-only gain can only be confirmed on a device. Added a manual item to `tests/manual.md` section 11 (T-113 pan fps on iPhone Safari and Android Chrome).

**Probe notes (no bug)**
- One sampled frame in the time-lapse showed an opacity/display mismatch. Cause: `dnVis` tests the raw value (<0.002) while the attribute is rounded with `toFixed(3)`, so 0.00195 is hidden but reads as "0.002". Not a bug.

**Decision:** criterion 3 fails, so the task goes back to `in-progress` with bug 1.

## Dev log (fix after test report)

Bug 1 (fireflies animate under a hidden group): fixed. `dnVis` for the `fireflies` key now also sets/removes `display="none"` on each `.dn-ff` child, and `dnBuild` hides them at build. Chrome cancels the CSS animation only when the element itself is hidden. File: `static/js/app-daynight.js`. Verified in headless Chrome 390 px on port 8555 with `/tmp/t113/probe.mjs` (`ffRunningAnims: 0` at rest, no errors) and `/tmp/t113/rebuild.mjs` (mid-animation rebuild visible, hidden at the end). `node --test tests/js/` and `uv run pytest -q` pass. Safari not checked (manual item exists).

## Review re-check

Re-checked only the bug 1 fix in `static/js/app-daynight.js`.

- `dnBuild` now sets `display="none"` on each `.dn-ff` child at build, and `dnVis` toggles it on the children only for the `fireflies` key and only when the visible state flips (same `fx.vis` cache), so there are still no extra per-frame writes. At rest the fireflies themselves are hidden, which cancels their CSS animation in Chrome (as the tester showed); the rest of the T-113 behaviour is unchanged.
- Tests run by reviewer: `node --test tests/js/` 361 pass, 0 fail; `uv run pytest -q` 739 passed.

No blockers.

Verdict: APPROVED

### Re-test after the fireflies fix (26. 10. 2026, tester)

Own server on `127.0.0.1:8561` with a temporary data dir `/tmp/t113/data4` (stopped afterwards). Scripts in `/tmp/t113/r4/` (copies of `/tmp/t113/` with the port changed). Only `.dn-ff` animations were counted.

**Commands and results**
- `uv run pytest -q`: 739 passed.
- `node --test tests/js/`: 361 pass, 0 fail.
- `probe.mjs` (rest, time-lapse 254 frames, retarget, dnStop, rebuild): `errors []`, 0 node or layer mismatches, 60 display writes. At rest and after every end state: `ffRunningAnims: 0` over the 7 `.dn-ff`, blend attached 11 / rendered 0, mask attached 1 / rendered 0.
- `ff.mjs`: group hidden at rest, and again after 700 ms, no animation on the first three `.dn-ff` (was running before the fix).
- `ctrl.mjs` (control, not a product check): forcibly removing `display` from the group and all `.dn-ff` gives 7 running `.dn-ff` animations; hiding them again gives 0. So the probe measures something real.
- `rebuild.mjs`: rebuild mid-animation at a night hour (dark 0.78) shows the layer, after the end it is hidden with 0 errors.
- `run3.mjs` (T-111 scenarios at 390 px, 360 px clock, reduced motion, HUD action, retarget): no page, console, or HTTP errors.

**Acceptance criteria**

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Hidden light elements and both wrappers `display: none` at rest (noon) | PASS |
| 2 | No blend or mask on a rendered element at rest | PASS |
| 3 | Fireflies do not animate while hidden | PASS (fixed; 0 running `.dn-ff` animations at rest and after time-lapse, 7 when forced visible) |
| 4 | Time-lapse unchanged, layer hidden again at noon after retarget and `dnStop()` | PASS |
| 5 | `dnBuild` mid-animation at a night hour visible, at noon hidden | PASS |
| 6 | `display` toggled only on visible change | PASS |
| 7 | `node --test tests/js/` and `uv run pytest -q` pass | PASS |

Not verified here: the fps gain on a phone (manual item in `tests/manual.md` section 11), and Safari's handling of hidden fireflies (same manual item).

**Decision:** all criteria pass, no regressions in the earlier T-111 scenarios. Moved to `tasks/done/`.
