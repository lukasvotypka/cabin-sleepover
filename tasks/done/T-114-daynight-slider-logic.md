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
- [x] `sliderRange(nights)` → `{min: 12, max: 12 + 24 * nights.length}` (12 and 84 for three nights).
- [x] `nightAt(h, nights)`: index `floor((h − 6) / 24)` clamped to `0 … nights.length − 1`. Tested: 12 and 29.99 → `2026-10-29`; 30 and 53.99 → `2026-10-30`; 54, 78, 84 → `2026-10-31` (last-night clamp: Sunday morning stays So → Ne); hours below 12 → first night.
- [x] `hourToX(h, nights, width)` and `xToHour(x, nights, width)` map the range linearly onto `0 … width`, clamp outside values, and are inverse of each other (round-trip test within 1e-9).
- [x] `sliderKey(key, h, nights)` returns the new hour: `ArrowRight`/`ArrowUp` +1, `ArrowLeft`/`ArrowDown` −1, `PageUp` +6, `PageDown` −6, `Home` min, `End` max, clamped to the range; any other key returns `null`.
- [x] `sliderValueText(h, nights)` → full lowercase Slovak day name, `HH:MM` (15-min floor as in `clockLabel`), `, noc ` and the label of `nightAt`: 27 → `"piatok 03:00, noc Št → Pi"`, 12 → `"štvrtok 12:00, noc Št → Pi"`, 80 → `"nedeľa 08:00, noc So → Ne"`. Day names come from `DAY_NAMES`, the night label from `nightInfo()` in `logic-model.js` (no new hardcoded lists).
- [x] `sliderDays(nights)` → day segments clipped to the range for the abbreviations: `[{label:"Št",from:12,to:24},{label:"Pi",from:24,to:48},{label:"So",from:48,to:72},{label:"Ne",from:72,to:84}]`.
- [x] `sliderDark(nights)` → dark night sections `{from: SUNSET + 24i, to: SUNRISE + 24(i+1)}` for each night (first one 16.67 → 30.67), from the existing constants.
- [x] `figureSwap(oldSlots, newSlots)` takes two `slot → party_id` maps (one night of `sleeping`, either may be `undefined`) and returns `{stay, leave, arrive}` arrays of slot ids: `stay` = same party in the slot both nights, `leave` = slot taken in old and empty or another party in new, `arrive` = slot taken in new and empty or another party in old. A slot with a party change is in both `leave` and `arrive`. Tested with stay, leave only, arrive only, changed party, both empty, `undefined` maps. Output is sorted for stable tests.
- [x] `swapHour` stays in this task (its only caller, `app-daynight.js`, is rewritten in T-115, which deletes it and its tests); its comment says it is replaced by `nightAt`/`figureSwap`. No change to any `app-*.js` file.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
- Plain script, no DOM; all new top-level names must not clash with other `static/js/*.js` (`grep` before naming; use a `dn` prefix if in doubt).
- Open decision "Deň a noc pri prepnutí noci" defaults: time stays where released (also at night); people get up by fading in place, not walking to the door.

---
## Dev log
Added sliderRange, nightAt, hourToX, xToHour, sliderKey, sliderValueText, sliderDays, sliderDark, figureSwap (plus helper clampHour) to static/js/logic-daynight.js; swapHour kept with updated comment. Tests added to tests/js/logic.test.mjs (figureSwap output goes through JSON round trip because of the vm cross-realm arrays). Run: `node --test tests/js/` (all pass), `uv run pytest -q` (739 passed).

## Review round 1
Criteria example corrected by the reviewer (orchestrator decision): 27 → „piatok 03:00, noc Št → Pi“ (nights change at 06:00; proposal fixed accordingly). The developer's deviation is confirmed.

Checked: all criteria met. `nightAt` clamps both ends; `sliderValueText` uses `DAY_NAMES`/`parseIso`/`addDays`/`nightInfo` (no new lists), 15-min floor gives exact minutes; `sliderDays` uses `dayShort`; `sliderDark` reuses `SUNSET`/`SUNRISE`; `figureSwap` handles `undefined` maps and puts changed slots in both `leave` and `arrive`. No new top-level name clashes with other `static/js/*.js`; no `app-*.js` touched; `logic-daynight.js` already listed with `?v=__ASSET_VERSION__`. Tests: `node --test tests/js/` 364 pass, `uv run pytest -q` 739 passed.

No blockers.

Suggestion: `clampHour` is a generic top-level name; fine today (no clash), a `dn` prefix would be safer if more scripts grow.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Deviation: the spec example "27 → noc Pi → So" contradicts the nightAt criterion (27 belongs to 2026-10-29, Št → Pi); I followed nightAt, so 27 gives "piatok 03:00, noc Št → Pi" (test asserts that). Reviewer please confirm.

Tester (T-114), orchestrator-run tester pass:

Commands and results:
- `node --test tests/js/` → 364 pass, 0 fail.
- `uv run pytest -q` → 739 passed.
- Independent probe (`/tmp/t114probe/probe.mjs`, vm context loading `logic-model.js` + `logic-daynight.js`, no test file reused):
  - `sliderRange` → `{min:12,max:84}`.
  - `nightAt` at 12, 29.99 → 10-29; 30, 53.99 → 10-30; 54, 78, 84 → 10-31; -5 → first night.
  - `sliderValueText`: 12 → "štvrtok 12:00, noc Št → Pi"; 27 → "piatok 03:00, noc Št → Pi"; 80 → "nedeľa 08:00, noc So → Ne".
  - `sliderDays` → Št 12–24, Pi 24–48, So 48–72, Ne 72–84.
  - `sliderDark` → 16.67–30.67, 40.67–54.67, 64.67–78.67.
  - `hourToX`/`xToHour` clamp outside values; round trip over 0…380 px, max error 5.7e-14.
  - `sliderKey`: all six keys, Home/End, clamping at PageUp/PageDown near the ends, unknown keys → null.
  - `figureSwap`: stay/leave/arrive with changed party in both lists; `undefined` maps on either side; empty maps.
- Name clash check: each new top-level name is defined only in `logic-daynight.js`. `swapHour` is kept (still called by `app-daynight.js`, removed in T-115). No `app-*.js` change in the diff.
- Regressions: `tasks/done/` has 92 tasks; full pytest and Node suites pass.

Acceptance criteria:

| Criterion | Result |
| --- | --- |
| sliderRange | pass |
| nightAt (incl. clamps, below 12) | pass |
| hourToX / xToHour, clamp, round trip | pass |
| sliderKey keys and null | pass |
| sliderValueText examples (27 → Št → Pi per nightAt, see deviation) | pass |
| sliderDays | pass |
| sliderDark | pass |
| figureSwap cases | pass |
| swapHour kept, comment updated, no app-*.js change | pass |
| node and pytest pass | pass |

Deviation: the 27 example reads "piatok 03:00, noc Št → Pi" as the criterion text now states, and the code matches it.

Manual: nothing for this pure-logic task; the slider UI is checked in T-115.

Verdict: PASS. Moved to tasks/done/.
