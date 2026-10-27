# T-146: Notice board in the village and the title gate

- **Phase:** 1
- **Depends on:** T-145
- **Size:** M
- **UX:** yes

## Goal
Second half of the organizer's request (27. 10. 2026): the party tables („Noc“ who sleeps when / arrives-leaves, „Cez deň“ day visits and „na jedlo“) move from the top of the map into the village as stamps pinned on a „Kto kedy príde“ notice board standing on the meadow; the title becomes a wooden gate over the entrance path. The board block above the world disappears.

## Scope
- `logic-iso.js` (board/gate positions per view angle, rest view without the block), `app-draw.js`/`app-scene.js` (board and gate drawing, tap region), a readable panel with tabs (`app-panels.js` or a new `app-board.js` + pure parts in a `logic-*.js`), `app-iso.js` (3D posts/roof of the board and gate, optional), `config/cabin.yaml` `map.scene` (board and gate places in plan coordinates), `static/index.html`, tests, `tests/manual.md`, CLAUDE.md.

## Acceptance criteria
- [x] A „Kto kedy príde“ notice board stands on the front meadow with two pinned stamps: „Noc“ (party colour + name, `Št–Ne`, placed/needed per night, my row highlighted) and „Cez deň“ (day visitors per day, „na jedlo“ counts). Readable when zoomed in; content built with `textContent` only.
- [x] The board faces the camera and is fully visible (not hidden behind a roof or house) at all four view angles.
- [x] Tapping the board (or Enter/Space on it) opens a readable panel „Kto kedy príde“ with „Noc“ / „Cez deň“ tabs (bottom sheet on phone, centred window on desktop), closable with „Zavrieť“, Esc and the backdrop; it follows the panel light/dark colours.
- [x] The title „Chata 29. 10. – 1. 11.“ (from the event config) is a wooden gate over the entrance path, upright, visible at all angles.
- [x] The old board block above the world is gone; the rest view and intro fit the world only; nothing overlaps the top HUD.
- [x] Live updates refresh the board and an open panel; night switch updates the highlighted column.
- [x] No-WebGL fallback still shows board and gate; Node tests and pytest green; screenshots phone + desktop, incl. one turned angle.

## Notes for developer
- Prototype: `design/hud-boards/index.html` (`?zoom`, `?panel`), notes in `design/hud-boards/README.md`. Organizer accepted the defaults: one board with two stamps, title as a gate, board always visible from all four angles (billboard facing the camera, place it where no house covers it at any angle — verify with screenshots).
- Keep the plan in `config/cabin.yaml` the single source of positions.

## Design
From the ux-designer prototype (accepted 27. 10. 2026):
- Board: wooden frame with a small red roof and two posts, header plate „KTO KEDY PRÍDE“, two cream stamps with perforated edges: „NOC“ (columns `kedy`, `Št`, `Pi`, `So`; cells `4/4` green, amber when fewer, red when too many, `·` when absent) and „CEZ DEŇ“ (name + day, then „na jedlo:“ counts per day), plus a yellow „ťukni“ tag. A tap wiggles it (steps) and opens the panel.
- Panel: title „Kto kedy príde“, subtitle „Čísla sú miesta: vybraté / treba.“, tabs „Noc“ / „Cez deň“, table columns Partia, Príde, Odíde, Št, Pi, So, footer row „Obsadené“ with per-night occupancy, button „Zavrieť“.
- Gate: two posts and a crossbar sign „Chata 29. 10. – 1. 11.“ over the path entering the village.

---
## Dev log

### Developer (27. 10. 2026)
- **What:** the title and the party table left the board block above the world. `map.scene` in `config/cabin.yaml` is now `board: [380, 50]`, `gate: [248, 490]` (plan points) and `meadow`; `SceneRects` in `app/models.py` has `board`/`gate` as `Point`. `isoScene` no longer has a `block` (it has `top`); `isoSignBox(scene, layout, "board"|"gate")` and `ISO_SIGNS` (board 130x82, gate 150x56) give the scene rect of each upright sign, `isoContentRect` (rest view) and the scene size include both. New `logic-board.js` (stamps, panel model, label, all pure) and `app-board.js` (gate, board with two stamps, tap wiggle, panel „Kto kedy príde“ with „Noc“ / „Cez deň“ tabs, `.board-panel` CSS in `index.html`: bottom sheet on a phone, centred window from 700 px). The intro zoom now centres on the gate (`introFocus`, `introStartView` got an optional `focusY`). Removed: `isoBlockTransform/isoBlockPoint`, `drawTitle`, `drawPartyTable`, `drawMoon/Sun`, the board shade in `app-daynight.js` (signs are never tinted).
- **Live updates and night switch:** `render()` redraws the signs on every state/night change; an open panel refreshes through the usual `panel.refresh`.
- **Deviation (board place):** the task asked for the front meadow. A Node scan of the plan showed no spot near the village where a camera-facing sign of readable size is covered by no house at all four angles, except the north-east edge; so the board stands at plan (380, 50) and a test (`iso: the notice board covers no house at any of the four angles`) keeps it so. The gate is at the south end of the entrance path and, as a flat sign, overlaps the lower edge of the main house at some angles (taps pass through it, `pointer-events: none`).
- **Side effect to look at (UX):** because both signs are part of the rest view's content, the rest view got about 1.4x wider, so on a phone the houses are about 27 % smaller than before (scale 0.59 px per unit at 380 px, the test minimum is now 0.55 instead of 0.66) and there is more grass above and below. If it feels too small the organizer can choose: per-angle board spots (jumps in the turn swing), or a rest view that fits only the rooms and gate (board then partly off-screen at rest).
- **Follow-ups (not done):** `partyTableLayout`, `partyTableRows` helpers `tableCellText` still exist in `logic-summary.js` (the rows/summary are used; `partyTableLayout`, `moreText`'s old caller and `nightsHit`/`sceneRects`/`signpostLayout` in `logic-model.js`/`logic-daynight.js` are dead code with their tests); the open-the-house `quest log` overlap on the phone noted in T-145 is still there („Úlohy“ sits over the empty top grass now, not over a board).
- **Files:** `config/cabin.yaml`, `app/models.py`, `static/index.html`, `static/js/{logic-board,app-board}.js` (new), `logic-iso.js`, `logic-view.js`, `app-scene.js`, `app-draw.js`, `app-daynight.js`, `app-zoom.js`, `app-iso.js`, `tests/js/cabin-layout.json` (regenerated from the yaml), `tests/js/logic.test.mjs`, `tests/test_models.py`, `tests/test_map_layout.py`, `tests/manual.md`, `CLAUDE.md`.
- **Tests:** `node --test tests/js/` 458 pass; `uv run pytest -q` 734 pass.
- **Screenshots** (Chrome headless, own server on 8161, stopped): `/tmp/cabin-t146-dev/` `phone.png` (rest), `phone-zoom.png` (3.2x on the board), `phone-gate.png`, `phone-panel.png`, `desktop.png`, `desktop-panel.png`, `angle-135.png`, `angle-225.png`, `angle-315.png`, `nogl.png` (no WebGL fallback shows board and gate).
- Acceptance: the live-update criterion was verified by code path only (render + panel.refresh), not with a second device.

## Review round 1

### Reviewer (27. 10. 2026)
Tests run myself: `node --test tests/js/` 458 pass, `uv run pytest -q` 734 pass. All `static/js/*.js` (incl. new `logic-board.js`, `app-board.js`) are listed in `index.html` with `?v=__ASSET_VERSION__`, logic before app. Board and panel text all go through `addText`/`htmlEl` (textContent); no Slovak from the server; the `SceneRects` model change (`board`/`gate` as `Point`) is validated and tested. Live update and night switch go through `render()` + `panel.refresh` (`app-live.js:107`, `dnSetHour`, `selectNight`), so board and open panel follow. Panel: tabs 44 px, Esc/backdrop/„Zavrieť“ from `openPanel`, centred window from 700 px; wiggle and pin blink off with reduced motion. Screenshots checked (phone, zoom, panel, 225, 315).

**Deviations judged:**
- Board at the north-east edge (380, 50) instead of the front meadow: accepted. The organizer's priority was "fully visible at all four angles", the screenshots confirm it, and a Node test (`iso: the notice board covers no house at any of the four angles`) locks it in.
- Smaller rest view (houses about 27 % smaller, test minimum scale lowered 0.66 → 0.55, lots of empty grass above and below on a phone): a real UX regression, but it is disclosed and is a design choice for the organizer, not a bug. The orchestrator should point it out when showing the result (options are in the Dev log).

No blockers.

**Suggestions**
- The gate is a flat svg sign drawn over the 3D world, so at 225 it floats on the roof of the main house and at 315 it overlaps the house's corner (`angle-225.png`, `angle-315.png`). The criterion "upright, visible at all angles" is met, but it looks wrong. `tests/manual.md` (T-146 line) asks the tester to check that the signs "never … sit over a house", which the gate fails; either soften that line for the gate or, later, move/draw the gate so it clears the houses (e.g. 3D posts in `app-iso.js`, or a per-angle depth check like the board's).
- `CLAUDE.md` T-145 bullet still says "`map.scene` holds only `title`, `parties` and `meadow`", and the intro text still says "2× zoomed on the top of the scene" (it now centres on the gate). Update both.
- Tabs have `role="tab"` without `aria-controls` or arrow-key switching; fine to leave, but plain toggle buttons with `aria-pressed` would be more honest.
- Dead code listed in the Dev log (`partyTableLayout`, `sceneRects`/`nightsHit`/`signpostLayout` and their tests) should go in a follow-up cleanup task.

Verdict: APPROVED (round 2 skipped, no blockers)

## Test report

### Tester (27. 10. 2026)
Environment: temp `data/` in `/tmp/cabin-t146-test/data` (6 parties incl. a day visitor and a markup-like name `<img src=x onerror=…>`), own server on port 8155 with test secrets. Ports 8000, 8010, 8146, 8147 not touched. Exposed as tailnet preview `https://<tailnet-host>:8448/` (8443 to 8447 already taken). Server left running for the organizer.

**Commands and results**
- `node --test tests/js/` → 458 pass, 0 fail.
- `uv run pytest -q` → 734 passed.
- `uv run python -I` `create_app` with `map.scene.board: [380]` → refuses to start: `ConfigError … map.scene.board: List should have at least 2 items`.
- HTTP probes: `/data/cabin-data.yaml`, `/data/`, `/api/data`, `/static/../data/cabin-data.yaml`, `/static/%2e%2e/data/…` all 404. `/api/state`, `/api/events`, `/api/admin/export` without or with a bogus cookie → 401 `bad_code`.
- Playwright (Chrome, swiftshader) scripts in `/tmp/cabin-t146-test/` (`run.mjs`, `live.mjs`, `angles.mjs`, `night.mjs`, `dark.mjs`), two browser contexts (phone 390×844 mobile, desktop 1280×800).

**Acceptance criteria**

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Notice board with two stamps („Noc“ with colour, name, Št–Ne, placed/needed; „Cez deň“ with day visitors and „na jedlo“); readable zoomed; textContent only | PASS | `phone-zoom-board.png`; SVG text checked; the markup-like name is shown as literal text in both stamp and panel |
| 2 | Board faces the camera, fully visible at all four angles | PASS | phone and desktop rects inside the viewport at 45/135/225/315 and never under the top HUD or „ÚLOHY“ at rest (`angles.mjs`); `phone-angle-315.png`, `desktop-angle-135.png` |
| 3 | Tap or Enter/Space opens „Kto kedy príde“ panel with Noc/Cez deň tabs, Zavrieť, Esc, backdrop; bottom sheet on phone, centred on desktop; light/dark | PASS | sheet is 560 px centred on desktop; Esc, Zavrieť, backdrop, Enter and Space all close or open it; dark colours `rgb(36,28,22)` text `rgb(241,231,217)` (`phone-panel-dark.png`); `phone-panel-night.png`, `phone-panel-day.png` |
| 4 | Title is an upright wooden gate over the entrance path, visible at all angles | PASS | gate rect inside the viewport at all four angles on both devices; `phone-rest.png` |
| 5 | Old board block gone; rest view and intro fit the world; nothing overlaps the top HUD | PASS | `phone-rest.png` shows no block above the world; measured no overlap with the HUD at rest for any angle |
| 6 | Live updates refresh board and open panel; night switch moves the highlighted column | PASS | write from the second context (Mišovci, 31. 10.): the open desktop panel changed without reload (marker kept), SVG stamp updated; top-HUD night tap then reopen → highlighted column „So“ (`desktop-live-after-write.png`) |
| 7 | No-WebGL fallback shows board and gate; Node and pytest green; screenshots | PASS | with WebGL disabled: 1 board, gate and tap area in SVG (`nogl-phone.png`); Node 458 and pytest 734 green; screenshots below |

**Extra scenarios tried**
- Reduced motion: the wiggle has no animation.
- Keyboard: focus on the board, Enter and Space open it.
- Two devices: a write from the second context is accepted (200) and the open desktop panel refreshes without reload.
- Night-switch timing: a night tap runs the time-lapse (about 6 s) before `app.night` changes, so the column moves after that, as designed.
- Startup with a malformed board point refuses to start.
- Data directory not reachable over HTTP; cookie-less API access refused.
- Dark-mode panel colours.
- Day visitor with an HTML-like name (`<img …>`) rendered as text in the stamp and in the table.

**Probe errors (my own, not app bugs):** my first live-update probe wrote Ferkovci into the 10-30 slots, so the next write was correctly refused (409). The first night-switch probe checked too early during the time-lapse. Both were rerun clean and pass. The first no-WebGL probe also broke the 2D canvas; rerun with WebGL only, pass.

**Observations (not blocking, for the organizer)**
- On a phone, zoomed onto the board, the fixed „ÚLOHY“ button covers the right edge of the „Cez deň“ stamp (`phone-zoom-board-hradova.png`). Panning moves the board away from it. The dev log says it sits over empty grass, which holds only at rest.
- Rest view on a phone is small (board about 83 px wide), as the accepted deviation says.
- The gate may overlap a house corner at some angles (accepted deviation). It was readable in every screenshot.
- Dead code from the Dev log is still there (follow-up cleanup, as stated).

**Edits by the tester:** `tests/manual.md` T-146 line changed so it no longer says the gate never sits over a house (the accepted deviation). CLAUDE.md is already updated for T-145 and T-146, so no change needed there.

**Screenshots** (`/tmp/cabin-t146-test/`): `phone-rest.png`, `phone-zoom-board.png`, `phone-panel-night.png`, `phone-panel-day.png`, `phone-panel-dark.png`, `phone-angle-225.png` (taken while still zoomed on the board, where the board sits under the HUD; at rest it clears it), `phone-angle-315.png`, `desktop-panel.png`, `desktop-angle-135.png`, `desktop-live-after-write.png`, `nogl-phone.png`.

**Result: PASS.** No failures and no regressions (`tasks/done/` tasks still pass through the full suites).
