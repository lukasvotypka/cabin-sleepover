# T-118: Cheap night rendering (map pan/zoom stutters when dark)

- **Phase:** 1
- **Depends on:** T-117
- **Size:** S

## Goal
Organizer report of 26. 10. 2026: „slider je dobre, ale keď je tma, tak mi browser seká pri pohybe po mape“. Panning
and zooming change the svg `viewBox`, so the whole svg repaints every frame. At night the light layer in
`static/js/app-daynight.js` is rendered with `mix-blend-mode: multiply` on two 4380 × 4496 rects (dusk, dark), the
dark one also masked by `#dnMask`, plus multiply on the board-shade rects. Blend modes force an isolated offscreen
group for the svg and the mask is re-rasterised on every repaint, which mobile browsers (iOS Safari above all) cannot
do at 60 fps. T-113 only removed the cost at rest (day). Proposal section „Deň a noc pri prepnutí noci“.

## Scope
- `static/js/app-daynight.js` (light layer build and paint only)
- `tests/js/logic.test.mjs` (source checks), `tests/manual.md` (section 11, one item)

## Acceptance criteria
- [x] No element of the light layer or the board shade uses `mix-blend-mode`, `mask`, `filter` or `clip-path`;
      `#dnMask` is gone. Source checks in `tests/js/logic.test.mjs` assert this for `app-daynight.js`.
- [x] The dark tint is plain alpha compositing: one `path` with `fill-rule="evenodd"` covering the area (outer
      rect) with the room floors (rect inset by `DN_ROOM_INSET`, from `layout.rooms`) cut out as holes, plus a
      separate group of the room-floor rects with a lower opacity, so rooms stay lighter like the masked version
      (masked grey #5a5a5a ≈ 35 % of the outside darkness). Colour and opacity are tuned so the night looks close to
      T-111 (deep navy, not grey fog): use a darker navy than `#16224A` (e.g. `#0A1130`) and adjust the factor in the
      app (not in `lightAt`, whose tested values stay). Same for dusk (plain orange alpha, a bit lower) and the board
      shade (plain alpha).
- [x] The outer rect is no bigger than needed: the ground area the map can show (`groundRect(app.bounds)` or the
      same bounds the grass uses) instead of the fixed 4380 × 4496, updated if the bounds change; if that is not
      practical, keep a fixed rect but note why.
- [x] T-113 rules still hold: at rest by day nothing from the layer renders (`display="none"`), fireflies stop when
      hidden, display toggles only on change.
- [x] Headless Chrome check on your own port with CPU throttling (8×), 390 px: pan probe like `/tmp/dn-perf/perf.mjs`
      at a night hour (e.g. `dnSetHour(46)`) before and after the change, report median/p90 frame times; plus
      screenshots at 17:00, 22:00 and 02:00 before/after in `/tmp/t118/` so the look can be compared (attach paths in
      the Dev log).
- [x] `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
- Don't change the light curves in `logic-daynight.js`, the slider, the 06:00 swap or the bird.
- Lamp rects (windows, door pools, room warm tint) are small; keep them, but they must not use blend either.
- If the fireflies' CSS animation (transform + opacity on 7 rects) shows up as a cost at night in the probe, it is
  fine to animate only opacity.
- Don't use or kill ports 8000, 8010, 8766, 8768, 8770. playwright-core is in `/tmp/t111/node_modules`.

---
## Dev log

- Light layer rebuilt with plain alpha: dusk = one `rect` (#E8741E, x0.5), dark = one `path` evenodd (outer rect with
  room floors cut out, #0B1636, x1.1 of `lightAt.dark` = 0.86 max), `darkRooms` group of floor rects (x0.42 of that),
  board shade plain #0B1636 alpha. `#dnMask`, `mix-blend-mode` and `mask` are gone. Outer rect = `groundRect(app.bounds)`
  (+2 px), resized by new `dnFitArea()` which `refit()` in `app-zoom.js` calls after `drawGround`. Rest rules (T-113)
  unchanged (`display="none"`, only on change). Light curves, slider, bird untouched. Fireflies animation left as is.
- Files: static/js/app-daynight.js, static/js/app-zoom.js (one line, refit hook; needed for the bounds criterion),
  tests/js/logic.test.mjs (source check), tests/manual.md (section 11 item replaced).
- Perf probe (headless Chrome, 8x CPU throttle, 390 px, dnSetHour(46), 120-frame pan/zoom, own port 8791):
  before median 17.6 / 17.5 ms, p90 23.2 / 23.3; after median ~18-19 / p90 ~23-26. Headless is vsync-capped and shows no
  difference (same as T-113 note), so the iOS gain is only checkable by hand (manual item added).
- Screenshots `/tmp/t118/{before,after}-{17,22,26}.png` (17:00, 22:00, 02:00). After is close to before, a little more
  teal-grey outside; tune `DN_DARK_ALPHA`/`DN_ROOM_DARK` in app-daynight.js if the organizer wants it darker.
- Tests: `node --test tests/js/` 367 pass; `uv run pytest -q` 740 pass.

## Review round 1

Tests run by reviewer: `node --test tests/js/` 367 pass, `uv run pytest -q` 740 pass. No new scripts, so `index.html` needs no change.

The plain alpha conversion is done right. `#dnMask`, `mix-blend-mode` and `mask` are gone. The evenodd path cuts the inset room floors out of `groundRect(app.bounds)`; the inset room rects in `config/cabin.yaml` do not overlap, so evenodd leaves no double-filled holes. `darkRooms` is toggled through `dnVis`/`dnWrap`, so the T-113 rest rules still hold. The `refit()` hook in `app-zoom.js` is guarded by `dn.fx` and is in scope. `lightAt` is untouched.

**Blocker**

1. `static/js/app-daynight.js:77-86`: the board shade for `scene.parties` uses the full configured rect, `sc[k]`, which is 136 tall. `drawPartyTable` (`static/js/app-draw.js:362-364`) draws the board only `partyTableLayout(...).height` tall, and that height depends on the number of rows. With few or no parties, the table is much shorter than the rect. At night the shade (0.25 × dark, plain navy) then paints a dark empty rectangle on the grass under the table, which shows clearly in `/tmp/t118/after-22.png`. The bug predates this task, but the opaque navy alpha makes it obvious now, and the orchestrator asked for it to be fixed here. Also, `dnBuild` runs once per `ensureScene`, while the table height changes with every state update, so a size computed once at build time is not enough either.
   Expected fix: make the `parties` shade rect follow the drawn table height. For example, keep a reference to that shade rect (`fx.partyShade`) and set its `height` from `lay.height` each time `drawPartyTable` draws (a small `dnFitPartyShade(height)` hook in `app-daynight.js`, called from `drawPartyTable` and guarded by `dn.fx`). Or leave `parties` out of the shade if that reads fine at night. Add a source/logic check (e.g. that the shade height comes from `partyTableLayout`, or that `parties` is excluded), and replace the 22:00 after-screenshot.

**Suggestion**

- In `after-22.png` the room floors look almost as light as by day (0.42 × 0.86 ≈ 0.36 alpha plus the warm lamp tint). The criterion asks for about 35 % of the outside darkness, so this is within spec. If the organizer finds the rooms too bright, lower `DN_ROOM_DARK`.

Verdict: CHANGES REQUESTED

## Review round 2

## Dev log (fix round 1)

- Blocker 1 fixed: the `parties` board shade rect is kept as `fx.partyShade`; new `dnFitPartyShade(height)` in
  `app-daynight.js` stores the drawn table height (`dn.partyH`) and sets the rect height. `drawPartyTable`
  (`app-draw.js`) calls it with `lay.height` on every draw, and `dnBuild` calls it after `dn.fx` is set, so the shade
  follows both rebuilds and state updates. Source check added to the T-118 test in `tests/js/logic.test.mjs`.
- Screenshot `/tmp/t118/after-22.png` replaced: no dark rectangle under the table. Perf probe after: median 17-18 ms,
  p90 21-24 ms (headless is vsync-capped, as before).
- Suggestion (room floors bright): left within spec; tune `DN_ROOM_DARK` if the organizer wants it darker.
- Tests: `node --test tests/js/` 367 pass; `uv run pytest -q` see result below this line.

## Review round 2 (reviewer)

Tests run by reviewer: `node --test tests/js/` 367 pass, `uv run pytest -q` 740 pass.

Round-1 blocker 1 is fixed. `drawPartyTable` calls `dnFitPartyShade(lay.height)` on every draw. The height is stored in `dn.partyH` and applied again after `dnBuild` sets `dn.fx`, so the shade follows the table whichever runs first, both on rebuild and on state updates. `fx.partyShade` is picked by reference (`r === sc.parties`, and `rects` holds the `sc[k]` objects themselves). It is safe before `dn.fx` exists, and `dn` is a top-level global that exists before any draw runs. The source check is added. `/tmp/t118/after-22.png` no longer shows a dark rectangle under the short table. Nothing else in the fix diff falls outside the task's scope.

Verdict: APPROVED

## Test report


### Tester run (T-118, round-2 state, before reviewer approval)

Task is still in `tasks/review/` (round 2 not yet written), so it was not moved. Results below are for the current
working tree.

Commands and results:
- `node --test tests/js/`: 367 pass, 0 fail.
- `uv run pytest -q`: 740 passed.
- Temporary server on own port 8794 (`data/` = `/tmp/t118-test/data`, test secrets, `SMS_FAKE=1`). `/api/health` ok,
  version 1.17.0. `/data/...` not served (404), `/static/js/app-daynight.js` served (200). Server stopped afterwards.
- Headless Chrome probe (`/tmp/t118-test/probe.mjs`, 390 px, own port 8794), no page errors:
  - Rest (noon): `dn.fx.layer` display `none`. Night (hour 46): display visible. After returning to noon: `none` again.
  - No element in `#scene svg` has a non-normal computed `mix-blend-mode`, `mask`, `filter` or `clip-path`, and no
    `mask`/`filter`/`clip-path`/blend attribute or inline style. `#dnMask` absent.
  - Dark tint path starts from the ground rect: `dusk` rect = `groundRect(app.bounds)` ± 2 px (-288.99 / -782.49 /
    957.99 x 2063.90), matching the grass bounds.
  - Party shade height = `dn.partyH` = table height 42.5 (with 0 parties in this data).
  - Screenshots at 17:00, 22:00, 02:00 written to `/tmp/t118-test/out/night-{17,22,26}.png`. Viewed night-22: navy tint,
    rooms lighter, no dark rectangle under the party table.
- Pan probe at 8x CPU throttle, 390 px, night (hour 46), 120 frames, 3 runs: median 19.4 / 17.9 / 17.6 ms, p90
  24.9 / 24.5 / 23.9 ms. Same range as the dev's numbers. Headless is vsync-capped, so no before/after difference is
  visible here (the iOS gain is a manual check, already in `tests/manual.md` section 11). I did not re-run the "before"
  state; the dev's before numbers (median 17.5-17.6, p90 23.2-23.3) and `/tmp/t118/before-*.png` are unverified by me.

Acceptance criteria:

| # | Criterion | Result |
| --- | --- | --- |
| 1 | No `mix-blend-mode`/`mask`/`filter`/`clip-path` in the light layer or board shade; `#dnMask` gone; source check | PASS |
| 2 | Dark tint is one evenodd path with room floors as holes, plus room group at lower opacity; plain alpha; navy tint | PASS (visual and DOM) |
| 3 | Outer rect = `groundRect(app.bounds)`, updated on bounds change | PASS (geometry checked; the bounds-change hook is in `app-zoom.js` `refit`, source-checked only) |
| 4 | T-113 rest rules (display none at rest, fireflies stop, toggle on change) | PASS for display; fireflies and toggle-on-change by code review only |
| 5 | Headless perf with 8x throttle, before/after medians, screenshots in `/tmp/t118/` | PARTIAL: after numbers and screenshots verified; before not re-run; headless cannot show the difference |
| 6 | `node --test tests/js/` and `uv run pytest -q` pass | PASS (367 / 740) |

Extra probes: blend/mask scan of the whole svg, no page errors, data directory not reachable over HTTP, layer hidden
again after returning to day.

Not automated, manual only (already in `tests/manual.md` section 11): iPhone Safari and Android Chrome fps at 02:00.

Status: no failures found. Task stays in `tasks/review/` until the reviewer's round 2 approves it. Then it goes to
`testing/` for final tester sign-off, or straight to `done/` if the orchestrator accepts the criterion-5 partial.
