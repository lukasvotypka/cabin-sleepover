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
- [ ] When `state.info` is not `null`, a wooden board with a backpack is drawn in `map.scene.briefing`; below it `briefingCount` as „6/9“. While my party is not `briefingDone`, a „!“ blinks above it (no blink with reduced motion). With `info: null` there is no board, no offer and no requests.
- [ ] The board is a focusable `role="button"` with a Slovak `aria-label`, hit area ≥ 44 px; it opens the adventure.
- [ ] Once per page load, while my party is not done, the offer „Pred cestou · Čo si zbaliť, voda, jedlo a program ›“ appears above the bottom HUD, after the splash and intro; it opens the adventure and has a close button. Closing hides it until the next load.
- [ ] Without a chosen party, board and offer open „Kto si?“ first and the adventure after a party is picked.
- [ ] Opening a station sends `POST /api/briefing {party_id, step}` (relative path, `X-Client-Id`, `X-Party-Id`) unless the step is already in `state.briefing[myParty]`; opening the quick list sends `list`. Without a chosen party nothing is sent. The returned `state` is applied like other writes (not older than shown); an error shows the Slovak text from `logic-errors.js` and never blocks the view.
- [ ] Board count and „!“ update live from SSE states.
- [ ] `tests/test_map_layout.py` checks still pass; `node --test tests/js/` and `uv run pytest` pass; `tests/manual.md` has the new items.

## Notes for developer
- Open decision "Pred cestou, kto to vidí": default everyone sees the count.
- Offer when no party is chosen yet: see `tasks/QUESTIONS.md` Q17 (default: show it only once a party is chosen, so it does not compete with the automatic „Kto si?“).
- The offer must not overlap the „Nová verzia“ sign or toasts; stack it like the existing HUD extras (T-045).

---
## Dev log

## Review round 1

## Review round 2

## Test report
