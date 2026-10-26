# T-114: Day–night slider and 06:00 night logic

- **Phase:** 1
- **Depends on:** T-110, T-113
- **Size:** S

## Goal
Pure functions for the new time slider and the 06:00 night boundary (proposal "Deň a noc pri prepnutí noci": „Posuvník času“, „Ktorá noc patrí k času“, „Postavičky o 6:00“). Replaces `swapHour` (figures swapped at midnight of the last night passed) from T-110. No server change.

## Scope
- `static/js/logic-daynight.js`
- `tests/js/logic.test.mjs` (replace the `swapHour` tests, add new ones)

## Acceptance criteria
Hours are counted as in T-110 (00:00 of the first night's start day); `nights` = `state.event.nights` (3 nights in tests: 2026-10-29..31).
- [ ] `sliderRange(nights)` → `{min: 12, max: 12 + 24 * nights.length}` (12 and 84 for three nights).
- [ ] `nightAt(h, nights)`: index `floor((h − 6) / 24)` clamped to `0 … nights.length − 1`. Tested: 12 and 29.99 → `2026-10-29`; 30 and 53.99 → `2026-10-30`; 54, 78, 84 → `2026-10-31` (last-night clamp: Sunday morning stays So → Ne); hours below 12 → first night.
- [ ] `hourToX(h, nights, width)` and `xToHour(x, nights, width)` map the range linearly onto `0 … width`, clamp outside values, and are inverse of each other (round-trip test within 1e-9).
- [ ] `sliderKey(key, h, nights)` returns the new hour: `ArrowRight`/`ArrowUp` +1, `ArrowLeft`/`ArrowDown` −1, `PageUp` +6, `PageDown` −6, `Home` min, `End` max, clamped to the range; any other key returns `null`.
- [ ] `sliderValueText(h, nights)` → full lowercase Slovak day name, `HH:MM` (15-min floor as in `clockLabel`), `, noc ` and the label of `nightAt`: 27 → `"piatok 03:00, noc Pi → So"`, 12 → `"štvrtok 12:00, noc Št → Pi"`, 80 → `"nedeľa 08:00, noc So → Ne"`. Day names come from `DAY_NAMES`, the night label from `nightInfo()` in `logic-model.js` (no new hardcoded lists).
- [ ] `sliderDays(nights)` → day segments clipped to the range for the abbreviations: `[{label:"Št",from:12,to:24},{label:"Pi",from:24,to:48},{label:"So",from:48,to:72},{label:"Ne",from:72,to:84}]`.
- [ ] `sliderDark(nights)` → dark night sections `{from: SUNSET + 24i, to: SUNRISE + 24(i+1)}` for each night (first one 16.67 → 30.67), from the existing constants.
- [ ] `figureSwap(oldSlots, newSlots)` takes two `slot → party_id` maps (one night of `sleeping`, either may be `undefined`) and returns `{stay, leave, arrive}` arrays of slot ids: `stay` = same party in the slot both nights, `leave` = slot taken in old and empty or another party in new, `arrive` = slot taken in new and empty or another party in old. A slot with a party change is in both `leave` and `arrive`. Tested with stay, leave only, arrive only, changed party, both empty, `undefined` maps. Output is sorted for stable tests.
- [ ] `swapHour` stays in this task (its only caller, `app-daynight.js`, is rewritten in T-115, which deletes it and its tests); its comment says it is replaced by `nightAt`/`figureSwap`. No change to any `app-*.js` file.
- [ ] `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
- Plain script, no DOM; all new top-level names must not clash with other `static/js/*.js` (`grep` before naming; use a `dn` prefix if in doubt).
- Open decision "Deň a noc pri prepnutí noci" defaults: time stays where released (also at night); people get up by fading in place, not walking to the door.

---
## Dev log

## Review round 1

## Review round 2

## Test report
