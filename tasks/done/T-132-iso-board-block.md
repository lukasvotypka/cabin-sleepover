# T-132: Board block and icon signs above the isometric world

- **Phase:** 1
- **Depends on:** T-131
- **Size:** M
- **UX:** yes

## Goal
The boards (title, time slider, night signposts, party table) and the icon signs (Návod, Kto je kto, Prehľad, Pred cestou, key, locked sign) no longer stand on the flat plan. They form one upright block above the world (`isoScene().block`, scaled by `ISO.boardScale` so text stays readable on a 380 px phone), with the icons in a 2×3 grid left of the boards (`isoScene().icons`).

## Scope
- `app-scene.js`: boards layer gets `transform = isoBlockTransform(app.iso)`.
- `app-draw.js` `drawBoards`: icons use `app.iso.icons[key]` instead of `map.scene[key]`.
- `app-daynight.js`: slider layer and board shade layer get the same transform (`dnSceneX` keeps working via `getScreenCTM`).
- `app-zoom.js`: focus reveal (`revealFocused`, `focusin`) converts the focused node's bbox to scene units through its screen CTM (new helper), since boards are now in a transformed group.
- Bird (`drawBird`): flies across the scene width over the world, below the block.

## Acceptance criteria
- [x] All board and icon taps, keyboard activation and screen-reader labels work as before.
- [x] Dragging the time knob and tapping the rail work at any zoom.
- [x] Tab to a board/icon while zoomed reveals it in view.
- [x] Nothing of the block overlaps the 3D world at the fitted view; intro zoom still starts on the top of the scene.
- [x] Tests updated/added (block transform in source, icon rects); all green.

## Notes for developer
Locked sign and key only draw when applicable but keep their grid cells.

## Design
No prototype: `isoScene().block/icons` already fix the geometry; this sets how the block reads and behaves. No new Slovak text (all labels, counters and aria texts stay as they are).

**What the person sees.** At the top of the scene, on plain grass, one upright notice block: the title board, the time slider, the three night signposts and the party table in the right column (as today, just 1.6× bigger), and left of them a 2×3 grid of icon signs, row by row: „?“ Návod | Kto je kto; Prehľad (letter) | Pred cestou; key | „Zápis je zatvorený“. Guests' most used signs are in the top two rows; admin-only and rare ones at the bottom. Below the block a strip of empty grass (`gap`), then the 3D world. Nothing of the block lies on the plan any more, and nothing of it is projected or skewed: it faces the viewer flat.

**Sizes (from `logic-iso.js`, block `src` ≈ [38, 4, 334, 244] block units, k = 1.6).**
- On the scene the block is ≈ 534 × 390 units, centred. Phone 380 px, rest view ≈ 0.67 px/unit: block ≈ 358 px wide, board text ≈ 1.07× its block size (9 px font ≈ 9.6 px), icon signs 44 units ≈ 47 px, so every icon and signpost is a ≥ 44 px target at rest. Desktop ≥ 900 px (fit whole scene, ≈ 1.1 px/unit on a 900 px tall window): block ≈ 590 px wide; wide short windows keep T-131's rules.
- Each icon is centred in its 64 × 64 cell, and **everything that belongs to it (label under it, the „Pred cestou“ counter badge, the locked sign's post) stays inside its cell**, so rows never touch. If the briefing board (56) plus badge and label does not fit, draw it 48 × 48 with the badge overlapping its top-right corner instead of above it.
- Empty cells (no key for guests, signup open) show plain grass: no placeholder, no gap closing; the other icons never move.

**Grounding (the only new drawing).** Under every board and every drawn icon a flat pixel shadow, the same shape offset +2/+2 block units, `rgba(46,31,20,.25)` (`COLORS.furnShadow` at lower opacity), in the boards layer under the board. It makes the block read as standing above the grass instead of floating. No backing panel, no frame, no posts into the world.

**Interaction (unchanged behaviour, new geometry).** Tap/click on any board, signpost or icon does exactly what it did; the existing press feedback stays. Hit areas are the same rects scaled with the block, never smaller. The time knob drags at the block's scale: one pixel of finger = the same knob movement it gets on screen at any zoom (via `getScreenCTM`, no jump on grab). Keyboard: Tab order stays title → slider → signposts → table → icons (grid row by row) → beds; a focused node outside the view is revealed with its full scaled box plus 8 px margin.

**Motion.** Intro: starts 2× centred on the title board (it may be cropped at the sides on a phone, that is fine), eases to the rest view as today. Bird: crosses the whole scene width `W` (not the old 380), at the height of the grass strip between block and world, under the block and over the world, with its existing steps() wing frames. Reduced motion: no intro, bird static or hidden as today. Dark mode: scene unchanged (panels only).

**Not in this task.** No new icons, texts or panels; no change to board content, colours or font sizes in block units; no tilt, perspective or 3D boards; no change to `ISO` constants or `config/cabin.yaml`; beds and figures stay as they are (T-133); day-night light on the block stays as now (T-134).

- [x] (design) At the phone rest view (380 px) every icon sign and night signpost is at least 44 px on screen, and no icon's label, badge or post crosses into a neighbouring cell.

---
## Dev log
- Boards layer, slider layer and board shade layer carry `isoBlockTransform(app.iso)`; `drawBoards` draws the six icons at `app.iso.icons[key]`; `blockShadow` (flat +2/+2, `#2E1F14` at .25) under title, signposts, table and every icon.
- `app-zoom.js`: `sceneBox(node)` converts a focused node's bbox to scene units via screen CTMs (reveal margin 8); `introFocusX()` centres the intro start view on the title board (`introStartView` got an optional `focusX`).
- Bird flies across `app.iso.W`, in the grass strip under the block (`birdY`). Daynight board shade uses icon-grid rects.
- Files: static/js/app-scene.js, app-draw.js, app-admin.js, app-briefing.js, app-daynight.js, app-zoom.js, logic-view.js, tests/js/logic.test.mjs.
- Tests: `node --test tests/js/` 392 pass; `uv run pytest -q` 742 pass.
- Headless Chrome (own server :8932, CDP script in /tmp/cabin-t132/tool): screenshots /tmp/cabin-t132/phone.png (390x844), desktop.png (1280x900). Verified by real mouse events: notice tap opens the panel, knob drag at desktop follows the pointer (98.9 px for 100 px), real Tab while 3x zoomed keeps focused nodes in view. Phone sizes: rest view 0.68 px/unit so icons 44 units = 48 px, signposts larger; captions/badge stay in their 64-unit cells (tested geometry + screenshot).
- Notes: the phone rest view (T-131 `phoneRestView`) centres content vertically, so on a tall phone there is grass above the block; not changed. Tab order is still beds first, then boards (DOM order unchanged). Key and locked sign not visually verified (need admin role in localStorage / locked signup).

## Review round 1

Tests run by reviewer: `node --test tests/js/` 392 pass; `uv run pytest -q` 742 pass. All 37 scripts in `static/js/` are listed in `index.html` with `?v=__ASSET_VERSION__`. Screenshots /tmp/cabin-t132/phone.png and desktop.png checked: the block stands upright above the world, the icons are in a 2×3 grid with captions and badge inside their cells, nothing is skewed. The flat beds are still on the grass (expected until T-133).

Checked:
- `isoBlockTransform` is applied to the boards layer, the slider layer and the board shade layer. All three use the same `app.iso`, which `ensureScene` recomputes only together with the svg, so the transform cannot go stale.
- `dnSceneX` inverts the slider layer's own screen CTM, so the knob drag is in block units at any zoom and there is no jump on grab. `sceneBox` maps the bbox through `root.inverse() * nodeCTM`, which is correct for nodes inside the transformed group.
- Icon geometry: briefing 56×56 at a +4/+2 offset in its cell. The badge (x−2, y+1), the „!“ bubble and the caption (to y+56) stay within 64×64. The notice caption ends at cell y 57. The locked sign at 62×56 fits.
- Bird: `birdY` puts the 12-unit bird inside the 14-unit gap, and it flies across `iso.W`.
- No new Slovak text, no `innerHTML`, no server changes. The labels and `makeButton` keys are unchanged.

**Blockers:** none.

**Suggestion**
- `app-draw.js` 276/287/305/375, `app-admin.js` 6, `app-briefing.js` 9: the comments still say the icons' positions and hit areas come from `map.scene.<key>`. They now come from the icon grid cell (`app.iso.icons`), with only the size taken from `map.scene`. Update these comments when the next task touches these files.
- The `blockShadow` colour is a literal `#2E1F14`. The design asked for `COLORS.furnShadow` at lower opacity, so use the constant if it has that value.

Tab order is beds first, then boards. This is unchanged from before, so the criterion "as before" is met, but the design text describes a different order. That is out of scope here.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester: tests run on branch t3/isometric-threejs-map, uncommitted diff of T-132 on top of c71d8f1. Temp server 127.0.0.1:8941 with temp data in /tmp/cabin-t132-test/data (test secrets). Browser: headless Chrome, own DevTools port 9333. Screenshots in /tmp/cabin-t132-test/shots/. Chrome checks used real mouse and key events (CDP `Input.dispatch*`).

**Automated suite (run once)**
- `uv run pytest -q`: 742 passed.
- `node --test tests/js/`: 392 pass, 0 fail.

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| Board and icon taps, keyboard activation, screen-reader labels as before | PASS | Real clicks on notice, legend, letter and briefing open „Návod“, „Kto je kto“, „Prehľad na poslanie“, „Kto si?“ (no party chosen; the existing flow). Enter on notice and Space on legend open their panels. Key (admin) click and Enter open „Admin“. Labels are Slovak and non-empty for every sign, and the time slider has „Čas“. |
| Dragging the knob and tapping the rail work at any zoom | PASS | Desktop 1280×900: a 60 px pointer drag moves the knob 60 px at fit, and a −45 px drag moves it −45 px after a wheel zoom. Rail taps at 0.75, 0.25 and 0.5 of the rail, at fit and zoomed, land the knob exactly under the tap, and the tag text matches (e.g. „So 12:30“, „Pi 02:00“, „Pi 18:00“). |
| Tab to a board or icon while zoomed reveals it | PASS | Zoomed by wheel, then real Tab presses until `legend` has focus: the box is inside the svg host (447,21 to 541,129 in a 1280×900 host). Phone: focus on notice, legend, letter and briefing at a zoom of 470 units, each inside the 390×844 host. |
| Nothing of the block overlaps the 3D world at the fitted view; intro starts on the top | PASS | Phone 390×844 and desktop 1280×900 screenshots: the block stands upright, a grass gap sits below it, the 3D world starts under the gap. Intro sample at 0.8 s: view width 322 (= half of bounds), `introZoom` held, view centre 432.4 = `introFocusX()` (title board centre), y = 0 (top of the scene). It eases to the fitted view afterwards. |
| Tests updated or added (block transform in source, icon rects); all green | PASS | New Node tests in `tests/js/logic.test.mjs`: intro focus x, transform source checks, icons fit their cell. Suite green (see above). |
| (design) Phone rest view: every icon and signpost ≥ 44 px, no label or badge crosses into a neighbouring cell | PASS | Screen sizes at 390 px: notice 48×53, letter 48×49, legend 50×58, briefing 65×61, key 48×49, locked 70×61, signposts 72×72. Cell geometry in `isoScene().icons` fits (iconCell 64×64, the rects listed in the Dev log). |

**Admin key and locked sign (checked with the temp data)**
- Guest, signup open: no key, no locked sign; the key and locked cells stay empty (grass).
- Admin role set in `localStorage` (`cabin.role`) plus the `cabin_admin` cookie: the key („Admin nástroje“, button) sits in the bottom-left cell (x 30, y 328, 48×49 px on screen), and opens „Admin“ on click and Enter.
- Signup locked with `POST /api/admin/signup {open:false}` (200): guest sees „Zápis je zatvorený“ (role img) in the bottom-right cell (70×61 px on screen), key absent for guest. Admin sees both key and locked sign.
- Guest `POST /api/admin/signup` without the admin cookie returns 403 (forbidden). After unlocking, the locked sign disappears for all.
- No JS errors (`Runtime.exceptionThrown`, console errors) across taps, zoom, key, resize. The server log has no errors.

**Extra scenarios tried**
- Tab order from the start: beds, then the night signposts, notice, letter, legend, briefing, time slider, then the page's HUD buttons; repeated cycle is stable.
- Wheel zoom at the knob, then drag: the knob stays under the pointer (no jump on grab).
- Zoom reset and resize (390×844 → 1280×900 → 390×844): no errors, view kept.

**Notes (not failures, no acceptance criterion broken)**
1. Design text says Tab goes through the icons "grid row by row". The actual DOM order is notice, letter, legend, briefing (column by column), with the beds first. The reviewer already accepted this as out of scope.
2. Locked sign text wraps as „Zápis / je zatvo- / rený“ (hyphen split inside the word) in the 62-unit sign. This is pre-existing (the `drawLocked` text code is unchanged; only the shadow was added), so it is not a T-132 regression. Worth a small follow-up.
3. Bird flies in the grass strip (seen at desktop fit, x ≈ 970, y ≈ 432). The flight itself was not timed.

**Manual checks** added to `tests/manual.md` as section 14 (real phone block look and touch, knob by touch, intro on a device, bird, hardware keyboard, admin key and locked sign on devices).

**Result: PASS.** No regressions (tasks in `tasks/done/` still pass in the full suite). Moved to `tasks/done/`.

Trial server (committed work, restart by orchestrator): https://<tailnet-host>:8443/
