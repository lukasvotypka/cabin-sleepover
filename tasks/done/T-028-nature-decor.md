# T-028: Unobtrusive nature decor (falling-leaf tree, occasional bird)

- **Phase:** 1
- **Depends on:** none
- **Size:** S

## Goal
Add a quiet, decorative touch to the pixel-art scene: a tree that sheds leaves and a bird that occasionally flies over the map. Purely cosmetic, organizer-requested (23. 10. 2026), not derived from `proposal.md`. Must not interfere with the map's interactive elements or its "Vzhľad" palette.

## Scope
- `static/index.html` only: the tree and its falling leaves are extra static SVG markup + CSS keyframes drawn directly inside the existing `#scene` SVG (not data-driven from `config/cabin.yaml` — this is pure decor, unlike the room/bed layout). The bird is a separate small SVG/CSS element layered **above** the whole scene (`pointer-events: none`), so it never covers or intercepts taps on beds, panels or boards.
- No changes to `app/`, `config/cabin.yaml`, or any Python/test files.

## Acceptance criteria
- [ ] Tree sits in the grass area **outside the room/bed grid** (outside every rect in `layout.map.scene` and outside all room rects), so it never overlaps a bed, board, panel or tap target, at any zoom/pan position used by the existing layout.
- [ ] Tree sheds leaves on a loop: a handful of individual leaves detach from the canopy and drift down with a slight horizontal sway, fading out before/as they reach the grass. Very sparse — roughly one leaf every 4–6 s (randomized per-leaf delay, not a burst).
- [ ] Bird crosses over the scene roughly every 25–30 s, flies in from one side to the other (simple pixel silhouette, a few frames of wing motion via CSS steps or two alternating shapes), and is fully `pointer-events: none` so it can never block interaction with anything beneath it.
- [ ] Both animations respect `prefers-reduced-motion`: reduced-motion disables the leaf-fall and the bird entirely (tree and scene render static, no motion), matching how the rest of the scene already guards motion (see `#scene svg .free` / the `prefers-reduced-motion` block near it).
- [ ] Colors are fixed scene colors consistent with the already-established autumn palette in `proposal.md` "Vzhľad" (grass `#8E9B48`, tufts `#76823A`, fallen-leaf colors `#B5532A`, `#D69A2E`, `#8E3424`) — reuse these leaf colors for the falling leaves; do not invert in dark mode, same as the rest of the scene. Bird is a simple dark pixel silhouette.
- [ ] No `innerHTML` used for anything (not applicable here since there's no user-provided text, but keep the existing code style: no inline `onclick`, matches surrounding SVG markup conventions).
- [ ] `node --test tests/js/` and `uv run pytest` still pass unchanged (this task touches no logic they cover, just markup/CSS).
- [ ] Manually confirm in a local run: tree and leaves visible in the grass away from any bed/board, bird periodically crosses the full viewport without blocking taps, and with `prefers-reduced-motion: reduce` (e.g. via devtools emulation) everything is static.

## Notes for developer
- Keep it genuinely "unobtrusive" per the organizer: sparse frequency (not a constant shower of leaves), small bird, no sound, no layout shift, no effect on scene geometry/zoom math (`sceneRects`, `growRect`, viewport fit) — those functions must stay untouched since they derive hit-areas and obstacles from `map.scene`/rooms only.
- Reuse existing CSS patterns in `static/index.html` for scene elements (`shape-rendering: crispEdges`, fixed colors not using the light/dark `--` vars, `@media (prefers-reduced-motion: reduce)` guard already used for `.free`).
- Pick a tree position in scene-unit grass space that is outside `layout.map.viewbox`'s room/bed area and outside every `sceneRects` board, so it survives future layout tweaks without manual rechecking each time — reviewer should verify this against the current `config/cabin.yaml` geometry.
- The bird should be an SVG/CSS element living outside the pannable/zoomable `#scene` transform (or absolutely positioned over the whole viewport) so it visibly "flies over" everything at a flat, viewport-relative speed regardless of map zoom/pan.

---
## Dev log
Developer, 23. 10. 2026. Changes in `static/index.html` only.
- Tree (`drawTree`, called at the end of `drawBase`): fixed at x 0-8 in scene units, a strip no room, board or path reaches (leftmost room starts at x 10). Three canopy tiers, trunk, 5 leaves with staggered `animation-delay` (0/5/10/16/21 s in a 26 s loop, so roughly one leaf every 5 s). Leaf colors reuse `COLORS.leafOchre/leafRust/leafRed`.
- Fixed in this round: the `leafDrop` keyframes used unitless `translate(1, 4)`, which is invalid in CSS and would drop the whole transform; now `px`. Added `transform-box: fill-box; transform-origin: center` so leaves rotate around their own center, not the SVG origin.
- Bird: `#bird` is a `position: fixed` div after `#scene`, `pointer-events: none`, `aria-hidden`, two alternating pixel frames (`birdFlap`), `birdFly` crosses the viewport in ~6 s of a 28 s loop.
- Reduced motion: covered by the existing global `* { animation: none !important }` rule; leaves stay at opacity 0 and the bird stays off-screen at `left: -40px`.
- Checked: `node --test tests/js/` 202 pass, `uv run pytest` 384 pass. Own server on port 8177 with temp data (stopped): tree visible left of the house, all 5 leaf animations running, bird x went -40 -> 1 -> 330 -> 663 -> 993 -> -40 within ~6 s, `pointer-events: none`. Reduced-motion emulation was not run in a browser (rule inspected only).

## Review round 1
Reviewer, 23. 10. 2026. Scope: `static/index.html` only. The `CLAUDE.md` change in the working tree is the orchestrator's own text and not part of this task, so it is not reviewed here and should not go into the T-028 commit.

Checks run:
- `node --test tests/js/`: 202 pass. `uv run pytest`: 384 pass.
- Ran my own server on port 8291 with temp data and drove headless Chromium (380×760, DPR 2) over CDP:
  - The tree's bounding box in scene units is x 0–10, y 142–184. That is outside every room rect (leftmost x 10) and every `map.scene` rect (leftmost `locked` x 16, `legend` x 24), and away from paths and doors.
  - All 5 `.shedleaf` rects run `leafDrop` with delays 0/5/10/16/21 s.
  - The bird crossed the 380 px viewport in about 6 s, then stayed parked at `left: -40px`.
  - `elementFromPoint` under the bird returns the scene, not the bird, so `pointer-events: none` works.
- Emulated `prefers-reduced-motion: reduce`: every leaf has `animation-name: none` with opacity 0, and the bird has `animation-name: none` at x −40, off-screen. The tree renders static.
- `#scene` is `position: fixed` with no z-index, so the bird (z 1) paints over the map. Panels (z 20/21), boot (15), code screen (30) and the movebar (10) all stay above it.
- No `innerHTML`, no inline handlers, no user text, no server-side changes. `sceneRects`, `growRect` and the zoom math are untouched. Colors reuse `COLORS.leafOchre/leafRust/leafRed/woodDark` and `#2E1F14` (= `COLORS.ink`). Nothing is inverted in dark mode.

**Blocker**
- None.

**Suggestion**
- `static/index.html` `drawTree`: the tree is very small and cramped. It is 8 scene units wide, so about 8 CSS px on a phone. It sits at the very left edge of the screen, 2 units from the „Konica, dole“ wall, and reads more as a stack of three colored blocks than a tree. The organizer may barely notice it. If they find it too small on the phone, use a wider free spot instead, for example a larger crown in the grass left of the kitchen and legend, or above the house at y < 26. Not required: the acceptance criterion (outside all rooms and boards) is met.
- `drawTree`: the bottom canopy tier ends at y 162 and the trunk starts at y 164. In the zoomed render this shows as a 2-unit grass gap, so the crown floats above the trunk. Start the trunk at y 162, or extend the red tier to 164.
- `leafDrop` keyframes: the `rotate(...)` turns the 3×3 leaves into anti-aliased tilted squares, which goes against the crisp pixel-art look (`shape-rendering: crispEdges` does not prevent it under a CSS transform). Translate-only steps, e.g. `animation-timing-function: steps(...)`, would keep the pixel style.
- `.bird` / `birdFly`: this animates `left`, which forces layout on every frame for the whole crossing. `transform: translateX(...)` (e.g. from `-40px` to `calc(100vw + 40px)`) gives the same motion on the compositor and is cheaper on phones.

**Nit**
- The CSS comment says the decor is "covered by the global reduced-motion rule above", and the JS comment says "the global rule near `.free` above". The global `* { animation: none !important }` rule is actually below, at the end of the `<style>` block. The rule near `.free` only covers `.free`.
- The `drawTree` comment claims the strip stays clear "however cabin.yaml is edited". That holds only while no room or board starts at x < 10. Reword it to "with the current cabin.yaml".
- The leaf at x 7 drifts by +1 px, so it briefly overlaps the room wall at x 10 by 1 unit. Cosmetic only, since it has `pointer-events: none` and sits under the beds layer.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2

## Test report
Tester, 23. 10. 2026. Scope: `static/index.html` (tree, leaves, bird), checked against the acceptance criteria above. Run on my own server at `127.0.0.1:8377` with a temp data dir (`/tmp/t028-test/data`) and test secrets, driven through headless Google Chrome over CDP at 380×760, DPR 2. Server and Chrome stopped afterwards. No `data/`, `.env` or application code touched.

Commands and results:
- `node --test tests/js/`: 202 pass, 0 fail.
- `uv run pytest -q`: 384 passed.
- Browser check (script outside the repo in `/tmp/t028-test/check.mjs`): 18/18 pass. Covers the join with the test group code, tree structure and palette, a screen-space overlap test of the tree box against all 271 rects, role=button and data-key elements of the scene, bird CSS and layering, bird position sampled at 12 times over its loop, tap hit-testing on the bird and on 21 bed centres, leaf overlap sampled over one loop, leaf density, dark mode fills, reduced-motion emulation, and console errors (none).
- Screenshots (default and reduced motion) inspected visually.

Acceptance criteria:

| Criterion | Result | Evidence |
| --- | --- | --- |
| Tree outside the room/bed grid, every board and tap target | PASS | Tree box at x 0–8 (canopy) and y 142–184 in scene units. The screen-space overlap test found 0 hits among 271 scene elements. The leftmost room starts at x 10 and the leftmost board at x 16 in `config/cabin.yaml`. The check is in scene units, so it holds at any zoom and pan. |
| Leaves on a loop, about one every 4–6 s, drift with sway, fade out | PASS | 5 `.shedleaf` with `leafDrop` 26 s, delays 0/5/10/16/21 s (gaps 5–6 s). Paused sampling shows at most 1 leaf visible at a time. Opacity fades 14→17 %. |
| Bird crosses about every 25–30 s, left to right, two wing frames, pointer-events none | PASS | `birdFly` 28 s infinite, `birdFlap` 0.5 s on two frames. Sampled: at 0 s fully left (right −12 px), at 1–5 s crossing, at 6.0 s right of the viewport (left 408 px), then parked at −40 px. `pointer-events: none`, `aria-hidden`, outside `#scene`. |
| Both respect reduced motion | PASS | With `prefers-reduced-motion: reduce` emulated: leaves `animation-name: none`, opacity 0. Bird `animation-name: none`, left −40 px, off-screen. No running animations. |
| Colours from the autumn palette, not inverted in dark mode | PASS | Fills are only `#B5532A`, `#D69A2E`, `#8E3424` (leaves and canopy) and `#5C4033` (trunk). The bird is `#2E1F14`. Under emulated dark mode the computed fills are the same. |
| No `innerHTML`, no inline handlers | PASS | `git diff` adds no `innerHTML`, no `on*=` attributes and no user text. |
| `node --test tests/js/` and `uv run pytest` still pass | PASS | 202 and 384 pass (see above). |
| Manual confirmation in a local run | PASS, with a note | Tree, leaves and bird seen in the headless run. The bird crosses the full width and does not block taps. The tree is only about 8×42 CSS px at the left screen edge in the default view. It is visible in the grass beside the house, but small. The leaves are 3 px squares. See the note below. |

Note for the organizer (not a failure): on a 380 px phone at the default fit view, the tree is flush with the left screen edge and only about 8 px wide, next to the „Konica, dole“ wall. The falling leaves are hard to notice at that size. The criteria are met, so I did not send the task back. The size is a design call, and I added a manual item to `tests/manual.md` (section 6) to decide it on a real phone.

Extra scenarios tried: bird position sampled at 0, 1, 2, 3, 4, 5, 6, 6.16, 6.5, 10, 20 and 27 s, with tap hit-testing on the bird's centre at each sample; bed hit-testing while the bird flies; dark mode; leaf overlap sampled at 15 time points across one loop; reduced motion with leaf and bird state read after load (the bird position was not sampled under reduced motion beyond its static off-screen position). A cosmetic edge case from the reviewer remains: a leaf at x 7 drifts up to about 1 unit right, into the wall at x 10. It has `pointer-events: none` and is drawn under the beds, so it does not affect taps.

Files changed by the tester: `tests/manual.md` (new T-028 item in section 6). No application code changed. The task file moves to `done/`.

Decision: all criteria pass, no regressions, so `tasks/testing/` → `tasks/done/`.
