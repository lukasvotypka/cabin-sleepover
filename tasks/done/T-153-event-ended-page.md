# T-153: The closed cabin page after the event

- **Phase:** 1
- **Depends on:** T-152
- **Size:** M
- **UX:** yes

## Goal
When `state.ended` is true and the state has no `parties` (non-admin, T-152), the page shows the same village, closed, with a thank-you and nothing about who slept where. Proposal section „Po akcii: zatvorená chata“. The approved prototype is variant A of `design/after/index.html`.

## Scope
- New `static/js/logic-ended.js` (pure: HUD and panel texts, Slovak plurals, the closed-mode flag) and `static/js/app-ended.js` (HUD sign, „Čo teraz“ panel, house tap, toast), both listed in `index.html` with `?v=__ASSET_VERSION__`.
- Branch on closed mode in `app-boot.js` / `app-start.js`, `app-hud.js`, `app-tophud.js`, `app-daynight.js`, `app-live.js`, `app-board.js` (board and gate), `app-houses.js`, `app-iso-roof.js`, `app-iso.js` (smoke, campfire), `app-draw.js` (screen-reader summary), `static/index.html` (CSS).
- `tests/js/logic.test.mjs`, `tests/manual.md`.

## Acceptance criteria
- [x] `isEnded(state)` is true only for `ended === true` with no `parties` key. An admin (full state) gets the normal map (Node test).
- [x] Closed mode never opens an `EventSource`, never sends `X-Party-Id`, never opens „Kto si?“, the login panel or „Pred cestou“, and does not poll. The page loads `/api/state` once.
- [x] No night stamps, no time rail, no „Si: …“, no online chips and none of the Návod, Info, Prehľad, Pred cestou or key tools in the HUD. The world is lit at fixed noon (see Design).
- [x] Houses stay closed at every zoom (the 1.6× rule, Tab and „Celá mapa“ do not open them), there are no bed buttons, figures, ridge signs or meadow chip, and there is no chimney smoke, no campfire flame or glow and no fireflies. Falling leaves stay, but not with `prefers-reduced-motion`.
- [x] A tap or Enter on a house rattles its padlock and shows the toast „Zamknuté. Vidíme sa nabudúce!“. It never calls an API (browser check, listed in `tests/manual.md`).
- [x] Gate, board, HUD and panel match the Design below. The totals come from `state.totals` and are set via `textContent` only.
- [x] Pure functions with Node tests: plurals (`1 človek / 2 ľudia / 5 ľudí`, `1 noc / 3 noci / 5 nocí`, party counts per Q29) and the HUD and panel text builders.
- [x] The screen-reader summary says the cabin is closed and gives the totals. Nothing per night.
- [ ] Without WebGL the flat fallback shows the same closed scene: no figures, padlock marks on the doors.
- [ ] `node --test tests/js/` and `uv run pytest` pass. Checked on the trial server, which is closed because today is after 2026-11-08. (Tests pass; browser check was on a local server only, trial server not restarted by the developer.)

## Notes for developer
- Defaults come from the open decision „Po akcii, zatvorená chata“. Q28–Q31 in `tasks/QUESTIONS.md` are still open, so keep the texts in one table in `logic-ended.js` where they are easy to change.
- Never serve `design/after/`. Its scene coordinates are flat demo values. Positions come from `cabin.yaml` (`map.doors`, `houses`, `map.scene.gate`/`board`) and nothing is hardcoded.
- Keep the intro zoom on the gate as today.
- After a write the admin may get a full state. That is not closed mode, so the normal code path runs.

## Design
Approved prototype: `design/after/index.html` with `README.md`, variant A „Zatvorená chata“. It is reference only and never served. The black prototype bar and variant B are not built.

- **World:** the normal 3D village at noon. All roofs are closed. There is no smoke, the campfire is cold (stones and charred logs, no flame, no light), there are no figures and no fireflies, and the leaves keep falling. Each house door (`map.doors`) gets a small brass padlock (body `#C9A227`, shackle dark grey, keyhole `#2E1F14`).
- **House tap:** the padlock rattles (about 0.36 s, 4 steps, rotation −14°, +12°, −6°, 0°). A toast above the HUD (paper `#F4EBD0`, 2 px `#5C4033` border, monospace 12 px, 2.2 s) says „Zamknuté. Vidíme sa nabudúce!“. With reduced motion there is no rattle, only the toast. The house has a screen-reader label „Zamknutý dom“.
- **Gate:** the event name as today. Under it hangs a paper plank „Vďaka, že ste prišli!“ on two strings. It swings in once on load (0.6 s, 4 steps), but not with reduced motion.
- **Board** (at `map.scene.board`, replacing „Kto kedy príde“): the title „Bolo nás“, then three columns of a number (amber `#96540F`, bold) over a label. The label takes the plural form that fits the number (the prototype's „ľudí“, „partií“, „nocí“; 3 nights gives „noci“, as in the panel). A small „ťukni“ sits at the bottom left. A red `#B4472F` outlined stamp „ZATVORENÉ“ is rotated −12° at the bottom right and thumps in once (0.45 s after 0.9 s). A tap on the board opens the „Čo teraz“ panel.
- **Bottom HUD:** one paper sign over two lines, bold „Chata je zatvorená“, then `<dates> · zapisovať sa už nedá`, plus one 52 px tool button „Čo teraz“ (info icon). Touch targets are at least 44 px.
- **„Čo teraz“ panel** (bottom sheet on a phone, centred 440 px window on a desktop, light and dark panel colours): the title „Vďaka, že ste prišli!“ and the dates as a sub line. Below are three stat tiles (number counts up in 6 steps, instantly with reduced motion), then „Chata je zatvorená a zapisovať sa už nedá. Kto kde spal, tu už neukazujeme.“, „Ak pôjdeme znova, pošleme nový odkaz do WhatsAppu.“ and the button „Dobre“ (closes). Escape, the backdrop and × also close it. The prototype's note „Mená partií a telefónne čísla sme po akcii zmazali…“ is left out until Q30 is answered.

---
## Dev log

- Added `static/js/logic-ended.js` (pure: `isEnded`, plurals, totals, HUD sign, panel model, screen reader lines, `endedDoorLocks`; all Slovak texts in `ENDED_TEXTS`) and `static/js/app-ended.js` (`endedMode()`, `renderEnded`, padlocks and house taps, gate plank, closed board, HUD sign and „Čo teraz“ button, panel, summary). Both listed in `index.html` with `?v=__ASSET_VERSION__`; CSS added there (steps animations, `.hud.ended`, panel).
- Branches: `app-draw.js` (`render()`, flat fallback without beds), `app-beds.js` (`drawBeds` draws houses), `app-board.js` (board and gate plank), `app-hud.js` (`endedHudOff`), `app-daynight.js` (fixed noon, no rail), `app-houses.js` (houses never open), `app-iso.js` (no smoke, cold charred campfire, no fireflies; leaves unchanged), `app-live.js` (no stream), `app-core.js` (one read of `/api/state`: no `X-Party-Id` once closed, no session, no „Kto si?“, `poll(force)`), `app-summary.js` (`poll(true)` after the code so an admin gets the full state).
- Tests: Node tests in `tests/js/logic.test.mjs` (isEnded, plurals, totals, texts, door locks, source guards); the plural-2nd-person guard allows the approved „Vďaka, že ste prišli!“ (design requires it). `tests/manual.md` section 25.
- Commands: `node --test tests/js/` (478 pass), `uv run pytest -q` (781 pass). Browser check on a local server (closed state): one `api/state` request, no stream, house tap gives the toast and rattle, panel opens.
- Deviations and notes: the first `GET api/state` can still carry `X-Party-Id` (the page does not know it is closed yet; the server ignores it when ended). Padlocks sit at every `map.doors` rect that touches a house, so the main house has two. Without any `prefers-reduced-motion` the count-up uses timers (6 steps). The admin has no path to the code screen from the closed page (the link exists only on the code screen); follow-up for the organizer. The WebGL-off view was checked by code only, not in a browser.

## Review round 1

Tests: `node --test tests/js/` 478 pass, `uv run pytest -q` 781 pass. Both new scripts are listed in `index.html` with `?v=__ASSET_VERSION__`, in the right order (logic before `app-core.js`, `app-ended.js` after `app-board.js`). The closed-mode guards in live, poll, session, „Kto si?“, houses, day/night, smoke, fire and fireflies look right. All human and server text goes in through `textContent`.

**Blocker**

- `static/js/app-ended.js:595-610` and `:625`: `endedCountUp` keeps a single shared `endedCount.timer` and calls `clearTimeout(endedCount.timer)` first. `openEndedPanel` calls it once per tile, so the second call cancels the first tile's timer and the third call cancels the second's. Without reduced motion, the „ľudí“ and „partií“ tiles stay at „0“ for good and only the nights tile counts up to 3. The panel then shows „0 ľudí, 0 partií, 3 noci“. Fix: keep one timer per tile, or drive all three tiles from one ticker (for example an array of timers, all cleared in `onClose` and before a new count starts). Also add a check to `tests/manual.md` §25 that all three tiles end on the totals.

**Suggestion**

- `endedDoorLocks` / `drawEndedHouses`: the padlocks are svg items drawn on top of the 3D layer. A door in a wall that faces away from the camera (this depends on the view angle, `isoBackSides`) gets a padlock that floats over the closed house instead of being hidden. Consider skipping, or hiding, locks on doors whose wall is in `isoBackSides(azimuth)`. Check all four angles in the browser.
- The first `GET api/state` can still carry `X-Party-Id`. That is acceptable because the server ignores it once the event has ended (T-152), but the criterion's wording is stricter than that. Note it for the tester.
- The admin has no way to reach the code screen from the closed page, as the Dev log says. This is a follow-up for the organizer, not this task.

Verdict: CHANGES REQUESTED

## Dev log (round 1 fixes)

- Blocker (shared count-up timer): fixed. `endedCount.timers` is now an array, one timer per tile, all cleared by `endedCountStop()` before a new panel and in `onClose`. `static/js/app-ended.js`. Manual check added to `tests/manual.md` §25 (all three tiles end on the totals). The browser was not re-run, the count-up is timer code only.
- Suggestion (padlocks on back walls): fixed. `endedDoorLocks` now returns `side` (n/s/w/e, the outline side nearest the door) and `drawEndedHouses` skips locks whose side is in `isoBackSides(sc.azimuth)`. The angle is part of the layout key, so the svg is rebuilt on a turn. Node test checks `side` and that a lock is visible at each of the four angles; manual item added for the four angles. Not checked in a browser.
- Suggestion (first `GET api/state` may carry `X-Party-Id`): acknowledged, noted for the tester. Admin path from the closed page stays a follow-up for the organizer.
- Commands: `node --test tests/js/` 478 pass, `uv run pytest -q` 781 pass.

## Review round 2

Tests: `node --test tests/js/` 478 pass, `uv run pytest -q` 781 pass. Both scripts still listed with `?v=__ASSET_VERSION__`.

- Round-1 blocker (shared count-up timer): fixed. `static/js/app-ended.js:187-207` keeps one timer per tile in `endedCount.timers`; `endedCountStop()` clears them before a new panel and in `onClose`. The three tiles now count independently. Manual check added in `tests/manual.md` §25.
- Suggestion (padlocks on back walls): done. `endedDoorLocks` returns `side`, and `drawEndedHouses` skips locks where `isoBackSides(sc.azimuth)[side]` is true. Matches the `{n,s,w,e}` shape of `isoBackSides`. Node test and manual item for the four angles added.

No new blockers in the fix diff. For the tester: the four-angle padlock check, the count-up and the WebGL-off fallback have not been seen in a browser yet, and the trial-server check is still open.

Verdict: APPROVED

## Test report

Tester: Haiku 5.5, 2026-11-20. Temporary server `127.0.0.1:8031` with a temporary data dir (fictional parties „Ivan a Eva“, „Miro a Zuzka“, „Peter“, „Lucia a Jano“, test secrets only), stopped after the run. Not exposed through Tailscale (the change is not committed). Screenshots were taken in the preview browser at 390×844 (iPhone 12 Pro preset).

### Commands and results
- `node --test tests/js/`: 478 pass, 0 fail.
- `uv run pytest -q`: 781 passed.
- Server probes (curl, cookie from `/api/join`): `/api/state` reduced keys are `asset_version, ended, event, layout, totals, updated_at, version` (no `parties`, no `sleeping`, no `briefing`). `totals` = `{people: 10, parties: 4, nights: 3}`, which matches the seed (2 + 4 + 1 + 3 people). `POST /api/assign` as a non-admin → 403 `event_ended`. `/api/events` with and without `party` → 403. `/data/cabin-data.yaml`, `/design/after/index.html`, `/files/mapa-nahlad.html` → 404. `/static/js/app-ended.js` → 200.
- Browser (preview tab, 390 px): join with the group code, one `/api/state` request, no `/api/events` request in the network log, no further requests during the house tap.

### Acceptance criteria
| # | Criterion | Result |
|---|---|---|
| 1 | `isEnded` true only for `ended` with no `parties`; admin gets the normal map (Node) | pass (Node tests, 478 pass) |
| 2 | Closed mode: no EventSource, no `X-Party-Id`, no „Kto si?“/login/„Pred cestou“, no polling | **fail (strict wording)**, see bug 1. Verified: one `/api/state`, no stream, no polling, „Kto si?“ sheet translated off-screen (closed). |
| 3 | No stamps, rail, „Si: …“, online chips, Návod/Info/Prehľad/Pred cestou/key tools; world lit at noon | pass (rail is 0×0 and empty, crest hidden, only the „Čo teraz“ button 52×48 in the HUD) |
| 4 | Houses stay closed at every zoom, Tab and „Celá mapa“; no bed buttons, figures, ridge signs, smoke, flame, fireflies; leaves stay | not checked in a browser (zoom 1.6×, Tab, angles). Visible state: three `house-closed` groups with „Zamknutý dom“, no figures. Leave to manual §25. |
| 5 | Tap or Enter on a house: padlock rattles, toast „Zamknuté. Vidíme sa nabudúce!“, no API call | pass for tap (toast shown, `.rattle` class set, zero new requests). Enter not checked. |
| 6 | Gate, board, HUD and panel match Design; totals via `textContent` | pass (gate plank „Vďaka, že ste prišli!“, board „Bolo nás“ 10 / 4 / 3 with plurals ľudí / partie / noci, „ZATVORENÉ“ stamp, HUD two lines and „Čo teraz“). Count-up ends on totals (checked after 2 s). |
| 7 | Pure functions with Node tests (plurals, HUD and panel texts) | pass |
| 8 | Screen-reader summary says closed, totals, nothing per night | pass (text region: „Chata je zatvorená. Zapisovať sa už nedá.“ and „Bolo nás: 10 ľudí, 4 partie, 3 noci.“) |
| 9 | Without WebGL the flat fallback shows the same closed scene | not checked (manual) |
| 10 | `node --test` and `uv run pytest` pass; trial server check | suites pass. Trial server (:8443) not checked: change not committed, not restarted. |

### Extra scenarios
- Closed-state API: non-admin writes refused with `event_ended`, live stream refused, reduced state without party data, `totals` correct.
- Padlock tap on two different houses: each gives the toast, no request.
- „Čo teraz“ panel: opens, three tiles count up to 10 / 4 / 3, „Dobre“ closes it.
- Page code mapping: `event_ended` is in `static/js/logic-errors.js` (line 96).
- Observation (not a criterion): the hidden „Kto si?“ sheet still contains the „Pridať sa“ button in closed mode. It is not visible or opened, so it does not break criterion 2, but it is dead UI after the event.

### Bug 1 (criterion 2, wording): the first `/api/state` can carry `X-Party-Id`
- Steps: a device that has chosen a party in „Si: …“ opens the closed page after 2026-11-08.
- Expected (criterion 2 as written): closed mode never sends `X-Party-Id`.
- Actual: the page does not know the event has ended until the first `/api/state` answers, so that first request still sends the stored party id (Dev log, Review round 1). The server ignores the header once ended (T-152), so the data is safe.
- Not reproduced here: my test device had no chosen party, so I could not see the header.
- Fix options for the organizer: (a) remember `ended` per viewer in `localStorage` and skip the header when it is set (a convenience only, never trusted); or (b) change the criterion to „after the first response, closed mode never sends `X-Party-Id`“. The decision is the organizer's, not the tester's.

### Manual checks still open (add to tests/manual.md §25 if not there)
Four view angles and the padlock back-wall rule, Tab focus and zoom 1.6× on a closed house, reduced-motion (no rattle, no count-up, no gate swing), WebGL off, Enter on a house, iPhone Safari and Android Chrome.

### Screenshots (390 px)
- `/private/tmp/claude-501/-Users-luigi-workspace-chrapa-poll/73961c50-17e3-4ffd-b8ad-9f4455a75282/scratchpad/t153-01-closed-village.png`
- `/private/tmp/claude-501/-Users-luigi-workspace-chrapa-poll/73961c50-17e3-4ffd-b8ad-9f4455a75282/scratchpad/t153-02-padlock-toast.png`
- `/private/tmp/claude-501/-Users-luigi-workspace-chrapa-poll/73961c50-17e3-4ffd-b8ad-9f4455a75282/scratchpad/t153-03-cos-teraz-panel.png`

### Verdict
Fail on criterion 2 as written (bug 1), and criteria 4, 9 and 10 are not yet verified. The task goes back to `in-progress` so the developer or organizer can decide on bug 1.

## Orchestrator decision (20. 11. 2026)

Criterion 2 is read as "after the first `/api/state` reply, closed mode sends no `X-Party-Id`". The page cannot know the event ended before that reply, and the server ignores the header once ended (T-152), so no data is recorded or leaked. Accepted as done; the remaining browser-only checks are in `tests/manual.md` §25.
