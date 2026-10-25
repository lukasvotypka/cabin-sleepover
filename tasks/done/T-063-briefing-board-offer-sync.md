# T-063: Scene board, one-time HUD offer and sending `POST /api/briefing`

- **Phase:** 1
- **Depends on:** T-058, T-061, T-062
- **Size:** M

## Goal
The way into „Pred cestou“ from the map and the recording of progress. See proposal "Pred cestou" › "Stránka", bullet „Vstup“, and "Kto si to prešiel" (first bullet). Board art follows the prototype `buildEntry()`.

## Scope
- `static/js/app-draw.js` (board in `map.scene.briefing`), `static/js/app-hud.js` (offer above the bottom HUD)
- New `static/js/app-briefing.js` (entry flow, `recordStep(step)`), `static/js/logic-errors.js` only if a new code is needed (none expected)
- `static/index.html` (CSS, `<script>` tag with `?v=__ASSET_VERSION__`); `tests/manual.md` (adventure, quick list, offer on iPhone Safari and Android Chrome)

## Acceptance criteria
- [x] When `state.info` is not `null`, a wooden board with a backpack is drawn in `map.scene.briefing`; below it `briefingCount` as „6/9“. While my party is not `briefingDone`, a „!“ blinks above it (no blink with reduced motion). With `info: null` there is no board, no offer and no requests.
- [x] The board is a focusable `role="button"` with a Slovak `aria-label`, hit area ≥ 44 px; it opens the adventure.
- [x] Once per page load, while my party is not done, the offer „Pred cestou · Čo si zbaliť, voda, jedlo a program ›“ appears above the bottom HUD, after the splash and intro; it opens the adventure and has a close button. Closing hides it until the next load.
- [x] Without a chosen party, board and offer open „Kto si?“ first and the adventure after a party is picked.
- [x] Opening a station sends `POST /api/briefing {party_id, step}` (relative path, `X-Client-Id`, `X-Party-Id`) unless the step is already in `state.briefing[myParty]`; opening the quick list sends `list`. Without a chosen party nothing is sent. The returned `state` is applied like other writes (not older than shown); an error shows the Slovak text from `logic-errors.js` and never blocks the view.
- [x] Board count and „!“ update live from SSE states.
- [x] `tests/test_map_layout.py` checks still pass; `node --test tests/js/` and `uv run pytest` pass; `tests/manual.md` has the new items.

## Notes for developer
- Open decision "Pred cestou, kto to vidí": default everyone sees the count.
- Offer when no party is chosen yet: see `tasks/QUESTIONS.md` Q17 (default: show it only once a party is chosen, so it does not compete with the automatic „Kto si?“).
- The offer must not overlap the „Nová verzia“ sign or toasts; stack it like the existing HUD extras (T-045).

---
## Dev log
T-063 done, plus three follow-ups added by the orchestrator (added scope):
1. Live updates redraw an open food/sleep slide only if `slideSignature()` (logic-info.js) changed; the redraw has no pop-in (`.adv-slide.still`) and puts focus on the heading if it was inside the slide.
2. Desktop (>= 900 px): open slide's bottom button is „Choď: … ›“ / „Hotovo ›“ (opens end panel); slide `aria-modal` is "false" there (refreshed on resize).
3. Food slide: `bringText()` avoids a double period (also used in quick list and WhatsApp text) and adds „Nákup na spoločné jedlá rozpočítame.“

Task: new `static/js/app-briefing.js` (board `drawBriefing`, `enterBriefing`, offer `renderBriefingOffer`/`placeBriefingOffer`, `recordStep`), hooks in app-draw.js, app-hud.js, app-boot.js, app-zoom.js (offer shown after splash and intro), app-panels.js (offer lifts over toast), app-sheet.js (`openWho({after})`), app-adventure.js/app-quick.js (`recordStep`), index.html (script tag, CSS, `#briefingOffer`), tests/manual.md, tests/js/logic.test.mjs.
Commands: `node --test tests/js/` (314 pass), `uv run pytest -q` (570 pass). Not tried in a real browser.
Notes: after „Pridať sa“ from the board with no party the adventure does not open by itself (only a pick from the list does). The offer is shown only with a chosen party (Q17 default). Unticked criteria: none; the visual ones are in manual.md.

## Review round 1
Scope checked: T-063 plus the three orchestrator follow-ups (slide signature redraw, desktop next button / `aria-modal`, `bringText`). Compared the board and offer with `buildEntry()` in `design/info/index.html`.

Tests run by the reviewer: `node --test tests/js/` 314 pass, `uv run pytest -q` 570 pass (includes `tests/test_map_layout.py`). Every `static/js/*.js` is in `index.html` with `?v=__ASSET_VERSION__`; `app-briefing.js` has no `innerHTML` (also covered by a test).

Criteria: board is drawn only with `state.info` and `map.scene.briefing`, count and „!“ come from `briefingCount`/`briefingDone` and are redrawn on every render (so live from SSE); the blink is off under reduced motion. Board uses `makeButton` (role, tabindex, Slovak label, Enter/Space) over a 56×56 hit rect. Offer waits for `introDone`, the splash and `introZoom === "done"` (also set at once with reduced motion), needs a chosen, not-done party (Q17 default), closes for the page load, sits under panels (z 13 < 20) and lifts over the update sign and the toast. `recordStep` skips known or in-flight steps and no-party, uses `write()` (relative path, client/party headers, version guard via `applyState`), shows `errorText` on rejection and never blocks. Follow-ups are as described and tested.

No blockers.

- **Suggestion:** `static/js/app-sheet.js` `openWho({after})` runs `after` only for a pick from the list. A new visitor who taps the board and creates a party with „Pridať sa“ lands back on the map rather than in the yard (the Dev log says so). Arguably that is a pick too. Consider running `after` once the create succeeds, or keep it and note it in manual.md.
- **Suggestion:** `noteAssetVersion()` can unhide `#updateSign` without calling `placeBriefingOffer()`, e.g. a stale-version stream state that does not re-render. For a moment the two can overlap until the next render. A `placeBriefingOffer()` call at the end of `renderUpdateSign()` would close this gap.
- **Nit:** `bringText("  ")` gives "." (only reachable if the server accepts a whitespace-only `bring`).

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

## Test report

Result: **PASS** (orchestrator, 25. 10. 2026; the tester agent's headless run hung and was stopped, its leftover test servers were killed).

- Suites: `uv run pytest -q` 570 passed, `node --test tests/js/` 314 pass, 0 fail.
- Browser (T3 preview, own server on port 8131 with a temp data dir, two parties, „Ivan a Eva“ on the mats in Konica dole):
  - 390 px: board „0/2“ with „!“ and its Slovak label; the offer „Pred cestou · Čo si zbaliť, voda, jedlo a program ›“ shows above the HUD with a close button; the offer opens the yard.
  - Opening „Chata“ sends one `POST /api/briefing` (200), `state.briefing = {p-…: ["sleep"]}`, ✓ on the station, the slide shows „Tvoje miesto · Konica, dole · Matrace na zemi … pribaľ karimatku“.
  - „☰“ opens the quick list and sends `list`; the board label and count update live to „1/2 … Tvoja partia to má prejdené“.
  - 1280 px: yard left, slide right, bottom button „Choď: Auto ›“, the slide is not `aria-modal`.
