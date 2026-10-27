# T-133: Beds, people and meadow in the isometric view

- **Phase:** 1
- **Depends on:** T-132
- **Size:** M
- **UX:** yes

## Goal
Beds stay svg buttons, now as projected shapes over their 3D furniture; people become upright pixel sprites (the existing `drawFigure`) standing in their bed at `isoFigure`, like old isometric RPGs.

## Scope
- `app-beds.js` `drawBed`: hit area = `isoBoxOutline(bedHit(...), 0, top+12)` polygon; no flat furniture (3D draws it; flat only in the no-WebGL fallback); each slot in an outer `<g transform=isoFigureTransform(...)>` with the existing inner class groups (`pending`, `dn-in`, `dn-out`, zzz) so CSS animations do not override the placement; selected and focus ring as polygons; bunk top berth at `ISO_BUNK_TOP`.
- Bed tags, room name plates (upright, on the room's north wall), long-press tip (`showTip`, clamped to scene W) at projected points.
- Meadow figures projected at height 0; meadow hit polygon.
- `app-actions.js` walk: from/to projected each frame, height eased to the slot's `isoSlotHeight`.
- Big tree tap: transparent `.tree-hit` polygon over the feature tree calls `rustleTree` + `isoRustle`.

## Acceptance criteria
- [x] Every bed (20 slots) can be tapped, long-pressed, focused with Tab and moved in move mode; labels unchanged.
- [x] Figures stand on the right bed and berth (bunk top/bottom distinct), my party's yellow frame, free „+“ marks, pending opacity, night z-z-z and 06:00 swap fade all still work.
- [x] Walk from the meadow to the bed animates along the projected path.
- [ ] Touch targets of beds at the fitted phone view are no smaller than before the rework, or the gap is reported in the dev log.
- [x] Tests updated/added; all green.

## Notes for developer
From the T-131 design: at the phone rest view (~0.67 px/unit) a bed is ~30 px wide. Make each bed's tap area cover the furniture plus its standing figures, padded up to 44 screen px at the rest view (without stealing taps from neighbouring beds).

## Design
No prototype: the 3D furniture (T-131) and `isoFigure` fix the geometry; this sets how people and beds read. No new Slovak text (bed labels, titles, tip and meadow label stay as they are).

**People on the furniture.** Every figure is the existing front-facing `drawFigure` sprite at `figScale`, upright, feet on the slot's top surface (`isoSlotHeight`), never skewed or rotated. Under each feet point a flat pixel shadow 8 × 2 units, `rgba(46,31,20,.35)`, at the same height, so the sprite reads as standing on the quilt, not floating over it.
- „In bed“ = tucked in, the way old top-down RPGs show a sleeper: the same upright sprite with a quilt strip over its lower body (10 × 6 units from the shirt's waist down, the bed's quilt colour from `COLORS`; mats `mat`, stove `stoveBlanket`, sofa its cushion; 1-unit darker top edge). The strip is drawn always, inside the slot group, and shown only under the svg `night` class, like z-z-z. By day people stand on their bed; at night they are tucked in and breathe z-z-z. Meadow figures never get a quilt.
- Free place: the existing „+“ (amber when tight) upright at the same feet point, with the same shadow. My party's yellow frame stays the 12 × 14 rect around the sprite inside the slot transform.
- Depth: beds are drawn back to front by the projected depth (`isoPoint` v) of their centre, and within a bed slots by their feet v, so nearer people overlap farther ones and a nearer bed's hit area wins where two touch.

**Bunk top vs bottom.** Top berth figure (slot 0) stands at `ISO_BUNK_TOP` = 23, about 16 px higher on screen at 1×, with its shadow on the upper slab. The bottom figure is drawn first, then an svg strip of the upper berth's front rail (projected `isoBoxOutline` of the rail, 2 units high at 21–23, bed wood colour) over it, then the top figure: the bottom sleeper reads as under the top berth even though the svg lies over the WebGL slab. Both berths keep their own „+“.

**Bed button.** Hit polygon = convex hull of the furniture outline (floor to top + 12) and the slot sprites, transparent. At the phone rest view (~0.67 px/unit, 44 px ≈ 66 units) grow it around the bed centre toward 66 × 66 units, but never past the halfway line toward another bed's outline or into the room wall; the smallest resulting size goes into the dev log (acceptance item 4). Selected and focus ring: the hull polygon, `COLORS.picked`, 2 px, as today. Tap feedback unchanged.

**Room name plates.** The existing wooden sign, upright and flat to the viewer (never skewed along the wall), scaled by `figScale`, its bottom edge at the projected midpoint of the room's north wall at the wall's top (low wall 6, tall 28), so it hangs on the back wall and never over a bed or figure. If two plates overlap, the farther one moves up by the overlap.

**Bed tags** (only while `zoomed`, as today): flat chips centred under the projected front (lowest) corner of the furniture at floor height, plus 2 units; tags of mats under each mat's own front corner.

**Long-press tip.** Above the bed's projected box (`polyBox` top − 4), clamped to 2 … W − 2; below the box if it would leave the scene top. Text and 2.5 s unchanged.

**Meadow.** Waiting figures at height 0 on the meadow cells, depth-sorted, with shadows; the „+n“ chip upright beside them. Hit polygon = projected meadow rect (0 … 16 high) padded to 66 units like a bed.

**Walk.** From and to projected each frame; positions rounded to whole scene units (pixel art, no sub-pixel drift). Height does not glide: it stays 0 on the floor and rises to the slot height in steps of 4 units over the last 4 frames (a hop onto the bed; the bunk top is a climb up the ladder, same steps). Reduced motion: no walk, as today. Dark mode: scene unchanged.

**Not in this task.** No lying or side-view sprites, no new sprite frames or facings, no party colour on furniture, no new labels or texts, no change to `ISO`, `ISO_BED_TOP` or `config/cabin.yaml`, no day-night lighting changes (T-134).

- [x] (design) At night every figure in a bed shows its quilt strip and z-z-z; the bunk's bottom figure is visibly under the top berth's rail.

---
## Dev log

Done in the pure logic first (`logic-iso.js`, new section "beds, people and the meadow"): tap polygons (`isoBedShape`, `isoBedHits`, `isoMeadowHit`, `isoGrowHit`), depth sort (`isoBedsBackToFront`, `isoSlotOrder`), bunk rail (`isoBunkRail`), quilt colour (`isoQuiltKey`), plate overlap (`isoPlateShifts`), bed tags (`isoBedTags`), walk (`isoWalkHeight`, `isoWalkFigure`).
- `app-beds.js`: beds are drawn back to front as polygons (hit, selected and focus ring), each slot in an outer `<g transform=isoFigureTransform>` with the old inner classes inside; foot shadow, quilt strip (hidden by CSS unless `svg.night`), bunk: bottom berth, rail polygons, top berth at `ISO_BUNK_TOP`. Room name plates upright on the north wall (`drawRoomPlates`, `roomWallTop` follows the 3D wall cuts), bed tags under the front corner, tip above the projected box clamped to the scene width, meadow figures at height 0 with shadows and a hit polygon, `.tree-hit` polygon over the big tree.
- `app-iso.js`: the big tree is now built on its own pivot (it was only a keep-out before) and `isoRustle()` sways it for 0.7 s (not with reduced motion). `app-draw.js`: `drawRoomSign` draws upright at (0, 0) (`roomSignSize`). `app-actions.js`: the walk is projected each frame, rounded, height hops in steps of 4 at the end. `logic-beds.js` `walkers()` now also returns `h`. `index.html`: `.quilt` CSS.
- Tests: new "iso beds / plates / walk / meadow" tests in `tests/js/logic.test.mjs`, two old assertions updated (`walkers` has `h`, the walk uses `isoWalkFigure`). `tests/manual.md` section 15.
- Commands: `node --test tests/js/` (403 pass), `uv run pytest -q` (see below). Screenshots in `/tmp/cabin-t133/` (phone-day/night, z-day, z-night, z2-*, bunk3, bunk3n, meadow, hits, desktop-webgl, desktop-nowebgl), made with headless Chrome on port 8233 and parties placed in both bunk berths, a kid, my party, free and tight slots, one waiting kid on the meadow.

Deviations and notes:
- Smallest tap polygon at the rest view (0.67 px/unit): the two cots, 40 x 35 units = about 27 x 24 px; the single bed 47 x 44 about 31 x 29 px; the rest are 33 px or more. This is below 44 px (acceptance item 4 gap): the beds are crowded, and growth stops at half the gap to a neighbour whose shape does not already overlap. Beds whose sprites already overlap in projection share the area, the nearer bed (drawn later) wins. The old flat view gave about 55 x 50 px for a cot. Zooming once fixes it; the ux-designer may want to lift the cot spacing in `cabin.yaml` or raise the rest zoom.
- Quilt strip is 10 x 4 (kid 8 x 3) from y 8, not 6 high, so the shirt letter stays readable; the 1-unit darker edge is a 30 % ink line.
- Growth is searched in eighths of the 66-unit target and also kept inside the room (south and east walls are low, so 8 units of overhang are allowed).
- `drawFurniture` (flat furniture, ~90 lines) is no longer called; the no-WebGL fallback uses the flat bed boxes of `drawBase`. It can be deleted in a cleanup task.
- Room plates were not drawn at all before (`drawRoomSign` had no caller after T-131); they are now drawn upright on the north wall.
- Night scene shows grass patches at the top left in headless swiftshader (day-night layer, T-134 scope), not touched.


## Review round 1

Checked: `git diff` of the 9 files in scope, screenshots in `/tmp/cabin-t133/` (z-day, phone-day, hits, bunk3n, desktop-nowebgl). `node --test tests/js/` 403 pass, `uv run pytest -q` 742 pass. All scripts in `static/js/` are listed in `index.html` with `?v=__ASSET_VERSION__`; no new script. All new `COLORS` keys exist; no `innerHTML`, no new Slovak text, no geometry outside `cabin.yaml`.

**Blockers:** none.

- Room name plates (orchestrator's question, z-day.png): **not a blocker**. `drawRoomPlates` runs first in the beds layer with `pointer-events="none"`, so every bed hit polygon, figure, „+“ mark and bed tag draws over it and no tap is stolen (hits.png confirms). What they can cover is the WebGL furniture and floor under the svg: in iso the north wall of „Konica, dole“ sits over the front strip of „Konica, podkrovie“, so its plate lies over that room's floor and touches the „manželská“ tag. That is what the design asked for (north wall top, scaled by `figScale`). At the phone rest view (phone-day.png) the plates are small and read well. At 2x+ zoom they look heavy. See Suggestion 1.
- Acceptance item 4: the gap is reported in the Dev log (cots about 27 x 24 px, single bed about 31 x 29 px, before about 55 x 50). The criterion allows this. It is a real touch regression, though. See Suggestion 2.

**Suggestions**
1. Plates: cap their scale (e.g. `min(figScale, 1)`, or a fixed size in scene units), or anchor them at the wall's west end instead of the middle, so that when zoomed in they cover less of the room behind. Leave it to ux-designer.
2. Cot and single-bed tap targets: make a follow-up (ux-designer): raise the rest zoom on phones, or let the hit areas of beds whose shapes overlap grow anyway, with the nearer bed winning.
3. Dead code once the flat view is gone: `drawFurniture` (only the fallback path is left, and it is not called), `bedHit`, `BED_HIT_GROW`, `meadowHitRect` (each now has only its definition). Delete them in a cleanup task.
4. `rustleTree(e.currentTarget)` adds the `rustle` sway class to the transparent `.tree-hit` polygon. It is harmless, but in iso mode only `isoRustle` and the sound matter.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (T-133, round 1 of testing), 27. 10. 2026. Temporary server 127.0.0.1:8251 with data in `/tmp/cabin-t133-test/data` (test group code only), headless Chrome via the local Playwright install, screenshots and scripts in `/tmp/cabin-t133-test/`. Seeded: Aneta 2+1, Boris 2+0 (both bunk-1 berths, then top moved), Cyril 3+0 (hallway sofa and left cot 1, one waiting), Dana 4+1 (kid in parents' bed), Ema 1+1 (night 29 only), Frida 2+3 (meadow waiters), Gabi (from 30 Oct, both bunk-2 berths on 30). Night 29: 16 of 20 slots taken, 4 free (2 tight).

**Commands and results**
- `node --test tests/js/` → 403 pass, 0 fail.
- `uv run pytest -q` → 742 passed.
- Server: `GROUP_CODE=… ADMIN_CODE=… SECRET_KEY=… SMS_FAKE=1 uv run python -c "…create_app(data_dir='/tmp/cabin-t133-test/data')…port=8251"`, `/api/health` 200, version 1.21.1.
- Browser scripts (phone 380×740, hasTouch, DPR 2 where needed): routing and tap owner per bed, Tab order, Enter on a bed, long press via CDP touch, move mode, walk from meadow (sampled every 80 ms), 06:00 swap (`dnSetHour` 29.5 → 30.5), night quilts and z-z-z, free marks, tree tap, reduced motion context, desktop 1440×900, no-WebGL (`--disable-webgl`).

**Bug 1 (blocks criterion 1): a bed's own centre and its figure can open the neighbour's sheet and tip.**
- Steps: open the page on a 380 px phone at the rest view, as Boris (`cabin.myParty`). Tap the centre of „Poschodová posteľ 1“ (bunk top and bottom, about screen 211, 561). Long-press the same point for 0.7 s. Tap the standing figure of Cyril on „Rozkladacie lehátko 1“ (about 119, 534).
- Expected: the sheet of the bed under the finger opens („Poschodová posteľ 1“, „Rozkladacie lehátko 1“), and the long-press tip names that bed's people.
- Actual: the sheet of „Poschodová posteľ 2“ opens, the long press shows no tip (bunk 2 is empty that night), and „Rozkladacie lehátko 2“ opens for the cot-1 figure.
- Measured with a grid over each bed's hit polygon (share of its own polygon where `elementFromPoint` returns that bed): left cot 1 34 % (74 samples lost to cot 2), bunk 1 47 % (122 lost to bunk 2), double bed (left) 54 %, window bed 65 %, hallway sofa 91 %, bunk 2 79 %, all other beds 100 %.
- Cause (as far as read): `isoBedHits` keeps the base shape of beds whose shapes already overlap in projection (the bed drawn later wins), and `isoBedShape` includes the sprites of the bed. The Design says „without stealing taps from neighbouring beds“. Possible fix: give each figure its own tap area (its sprite rect) with the bed's furniture as the fallback, or clip a bed's hit polygon by the other bed's figures and furniture.

**Acceptance criteria**

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Every bed (20 slots) tappable, long-pressed, focused with Tab, moved in move mode; labels unchanged | FAIL | 12 bed buttons, all reachable with Tab and open their sheet (Enter works). Move mode works (Boris moved from bunk-1 top to a free double bed, bar and write as expected). Labels: `bedLabel` unchanged. Fails on bug 1: taps and long-press on bunk 1 and cot 1 reach the neighbour. |
| 2 | Figures on the right bed and berth, bunk top/bottom distinct, my party's yellow frame, free „+“, pending opacity, night z-z-z and 06:00 fade | PASS (pending opacity not observed) | Titles per bed match the state. Bunk order in the DOM: bottom sleeper, rail polygons, top sleeper (top at y 630, bottom at y 652). Frame `#FFD54A` 2 px around my party. Free marks 4 = 20 − 16 taken. At night 16 quilts and 16 z-z-z shown, 0 by day. 06:00 (29.5 → 30.5): ghosts `dn-out` for 16 slots of the leaving parties, `dn-in` for the arriving ones, cleared after 0.5 s; figure staying in konica-upper-double did not fade. Pending opacity: the write is local and instant, so I could not see the state in a screenshot; the class path is unchanged. |
| 3 | Walk from the meadow to the bed animates along the projected path | PASS | 16 samples of `translate` over the walk (Frida, meadow → bunk 2, Frida's shown positions move along the projected path, rounded to whole units). Walk onto bunk-1 top (40 samples): flat along the floor, then steps of about 3–4 units in the last ~0.5 s (hop), final figure at the berth. Reduced motion: placed at once, no walk layer. |
| 4 | Touch targets at the fitted phone view no smaller than before, or the gap reported in the dev log | PASS by the reported-gap clause (regression) | Measured hit boxes at 380 px: cot 1 26×23 px, cot 2 37×36, single 35×34, left double 35×28, bunk 1 34×35, bunk 2 42×42, right sofa 33×30, mats 70×44, stove 44×44. Dev log reports the gap (cots about 27×24). The effective target of cot 1 and bunk 1 is smaller still (bug 1). |
| 5 | Tests updated or added, all green | PASS | `node --test tests/js/` 403 pass; `uv run pytest -q` 742 passed. |

**Other checks**
- Long press: the tip works on cot 2 („Ema“), right sofa („Dana“), konica single („Ema“). Clamp: code reviewed (`max(2, min(W − w − 2, …))`), not reachable at the rest view.
- Tab: all 12 bed buttons reached in one pass; the 20 slots are listed in the sheet rows (16 occupied slots have their own buttons, free ones show „voľné“; the sheet is unchanged by T-133).
- Tree tap: `.tree-hit` click sways the pivot (rotation z −0.018 after 160 ms). Reduced motion: `isoRustle` returns early.
- Meadow: hit polygon 65×44 px; tap opens the places panel.
- Desktop 1440×900 and no-WebGL: beds are polygons and taps open sheets, no on-page error text. The no-WebGL run logs THREE errors to the console only (T-130/T-131 scope).
- Night grass patches at top left: T-134 scope, not judged.
- Visible but minor: the room plate „Konica, dole“ covers the „manželská“ bed tag at zoom (the dev's suggestion 1). The final figure position is fractional (345.66) while the walk ends on whole units: a snap of about 0.3 scene units on landing, not visible.
- The 401 lines in the server log are the page's `/api/state` before the group code is entered (expected).

**Manual (added to `tests/manual.md` section 15, five items):** tap where the bed is (bug 1), long press tip, move by thumb, 06:00 fade on devices (with reduced motion), walk onto the bunk top. Earlier items already cover beds by thumb and night quilts.

**Decision:** criterion 1 fails (bug 1), so the task goes back to `in-progress` with this report. Re-test needed after the fix: taps and long press on bunk 1 top/bottom centre and cot 1 figure, Tab order, move mode, and the hit numbers above.

Link for the organizer: the trial server is not restarted (not committed); this round's test data is only in `/tmp/cabin-t133-test/`.

## Dev log (fix for the Test report, bug 1)

- Cause: each bed's one hit polygon was a grown hull; where two hulls overlapped, the bed drawn later won, also over the other bed's own furniture and figures.
- Fix: `logic-iso.js` new `isoHitRegions` (draw order: all grown pads, then every bed's furniture, then every figure sprite rect back to front) and `isoHitAt` (topmost region at a point). `app-beds.js`: `drawBedHits` draws these as transparent polygons in one `.bed-hits` group over all beds (click -> `onBedTap`, `watchLongPress`, the figure hover `<title>`). The bed groups stay the focusable `role="button"` elements (Tab order, labels, focus ring unchanged) but are `pointer-events="none"`. `index.html`: user-select CSS for `.bed-hits`.
- Test: new "a bed's own furniture and figures always hit that bed" in `tests/js/logic.test.mjs` (furniture centre, figure feet and body of all 20 slots in the real layout resolve to their bed).
- Browser (headless Chrome, own server on port 8261, copy of the tester's data, phone 380x740 touch, rest view): `elementFromPoint` at bunk 1 (211,561) = right-bunk-1, at cot-1 figure (119,534) = left-cot-1; every furniture and figure polygon's centre is owned by its bed (0 lost); long press at bunk 1 shows the tip with „Boris“. Sheet text check by tap was ambiguous (page text lists several beds), the owner checks are the evidence.
- Commands: `node --test tests/js/` (404 pass), `uv run pytest -q` (all pass).
- Note: the tap polygons of a bed no longer sit inside its `g.bed`, so a script using `elementFromPoint(...).closest("g.bed")` must read `data-bed` on the hit polygon instead.

## Review re-check

Re-check after the Test report (bug 1), 27. 10. 2026. Scope: `isoHitRegions`/`isoHitAt` (`logic-iso.js`), `drawBedHits` and the `pointer-events="none"` bed groups (`app-beds.js`), the `.bed-hits` CSS (`index.html`), the new Node test.

- `node --test tests/js/` 404 pass; `uv run pytest -q` 742 passed. Every `static/js/*.js` is listed in `index.html` with `?v=__ASSET_VERSION__`.
- Bug 1 fixed: regions are drawn as pads, then all furniture, then all figure sprites back to front, so a bed's own body wins over a neighbour's padding. I measured it in Node (0.5-unit grid over each bed's own furniture and figure polygons, `isoHitAt` on the real layout): 10 beds own 100 %, left-cot-1 93 % (rest is under cot 2's standing sprite), right-bunk-1 95 % (under bunk 2's sprite), right-bunk-2 98 %. Before the fix: 34 % and 47 %. What is left is where a nearer figure is drawn over the bed, so the tap goes to the person you can see. That matches what is shown.
- Click, `suppressClick` after a long press, `watchLongPress` and the figure hover `<title>` moved onto the hit polygons and work as before. Keyboard: the bed `g` keeps `makeButton` (role, label, Tab, Enter, focus ring). `pointer-events="none"` does not affect focus. Move mode goes through `onBedTap`, so it is unchanged. Nothing else looks up `g.bed` from a pointer target.

**Blockers:** none.

**Suggestions**
1. `drawBeds` caches `app.isoHits` by `layoutKey`, but `isoHitRegions` calls `isoBedHits` again on every redraw. Cache the regions under the same key. It is cheap with 12 beds, so this is not needed.
2. Mark the `.bed-hits` group `aria-hidden="true"`. The bed buttons already carry the labels, and the figure `<title>`s in it could be read as extra graphics.

Verdict: APPROVED

### Round 2 (after the tap-stealing fix), tester, 27. 10. 2026

Server restarted on 127.0.0.1:8251 from the current worktree (`isoHitRegions`, `.bed-hits` layer), data `/tmp/cabin-t133-test/data`, phone 380×740, touch, DPR 2, headless Chrome. Scripts and screenshots in `/tmp/cabin-t133-test/r2/`.

**Commands and results**
- `node --test tests/js/` → 404 pass, 0 fail.
- `uv run pytest -q` (run as `.venv/bin/python -m pytest -q`) → 742 passed.
- Real touch taps (CDP `Input.dispatchTouchEvent`) on the centroid of each bed's furniture and figure polygon (24 taps): every tap opened the sheet of the bed it hit (titles match the bed names, all 12 beds). `elementFromPoint` under each point is that bed's `data-bed`.
- Repro: bunk 1 centre, long press 0.8 s → tip „Frida, Boris“ on „Poschodová posteľ 1“ (no sheet). Cot-1 figure (`left-cot-1`), real tap → sheet „Rozkladacie lehátko 1“; long press → tip „Cyril“.
- Ownership grid over the furniture and figure polygons (1 unit grid, `isPointInFill` + `elementFromPoint`): 100 % for 9 beds; `left-cot-1` 94 % (49 points under the standing sprite of cot 2), `right-bunk-1` 96 % (42 under bunk 2's sprite), `right-bunk-2` 99 % (12 under the right sofa). These are the neighbour's standing figure drawn over this bed's floor, so the tap goes to the person on screen. Before the fix: 34 % and 47 %.
- Tab: all 12 bed groups reached in one pass. Enter on „Poschodová posteľ 2“ opens its sheet.
- Night at 23:00: 17 `.quilt` and 17 `.zzz` = 17 occupied slots on 29. 10. (state `sleeping`). Screenshot `phone-night.png` shows figures with quilts and z-z-z, no regressions visible.
- Browser errors: only the 401 before the group code is entered, and the WebGL driver and three.js deprecation warnings (T-130/T-131 scope). No page errors.

**Acceptance criteria (round 2)**

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Every bed tappable, long-pressed, focused with Tab, moved in move mode; labels unchanged | PASS | Taps on all 12 beds open their own sheet; long-press tips correct; Tab 12/12; Enter works. Move mode was not re-run (its path `onBedTap` → `moveTo` is unchanged by the fix; passed in round 1). |
| 2 | Figures on the right bed and berth, yellow frame, free „+“, pending opacity, night z-z-z, 06:00 fade | PASS | Night quilts and z-z-z 17/17. Drawing code unchanged by the fix; round 1 results stand. |
| 3 | Walk from the meadow to the bed animates along the projected path | PASS (round 1, not re-run) | Walk code not touched by the fix. |
| 4 | Touch targets no smaller than before, or gap reported | PASS (gap reported in dev log, unchanged) | Growth pads unchanged by the fix; not re-measured. |
| 5 | Tests updated/added, all green | PASS | 404 Node, 742 pytest. |

**Cleanup:** server on 8251 stopped; `tailscale serve --https=8445 off` done (no :8445 link now). Trial server on 8010 and :8443 not touched. Changes are uncommitted, so there is no preview link for them.

**Decision:** all criteria pass, no regressions found. Task moved to `tasks/done/`. Not committed (the orchestrator commits).
