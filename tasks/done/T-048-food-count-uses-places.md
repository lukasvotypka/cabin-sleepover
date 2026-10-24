# T-048: Food count follows the reduced per-night count („… nás viac nebude“)

- **Phase:** 1
- **Depends on:** none
- **Size:** S

## Goal
The „spolu na jedlo“ number ignores `places`, so a party of 3 that tapped „Vo štvrtok nás viac nebude“ (Št: „len 1 z 3“) still counts 3 people for food on Thursday. The organizer reported this as a bug (24. 10. 2026): 1 of 3 plus another party of 2 should be 3, not 5. Change the rule in `foodCount` (proposal "Otvorené rozhodnutia" → „Denné návštevy, počet „na jedlo“ (T-039)“) so a reduced night count lowers the food count.

## Scope
- `static/js/logic-summary.js` (`foodCount` and its rule comment only)
- `tests/js/logic.test.mjs`
- `proposal.md` (the T-039 food line in „Otvorené rozhodnutia“: record the organizer's decision of 24. 10. 2026)

## Acceptance criteria
- [x] New rule, written in the comment above `foodCount`: for an overnight party with `arrive ≤ D ≤ leave`, people on day D = `adults + kids − missing(D)`, where `missing(n) = neededSlots(party) − neededOnNight(party, n)` for night n. The day D touches the nights `D − 1` (morning) and `D` (evening) that lie inside the stay (`arrive ≤ n < leave`). Use the night with the **smaller** `missing`, i.e. the more people. On the arrival day only night D counts, and on the leave day only night D − 1 counts. Day-only parties are unchanged (`adults + kids` on their `day_visits`).
- [x] Kids in the parents' bed still count, because only the reduction (`missing`) is subtracted from the full headcount, never the slots.
- [x] The result is never below 0. A party without `places` counts exactly as before.
- [x] `foodRow`, the scene row, `dayVisitRows`, `summaryText` and `hiddenSummary` pick up the change through `foodCount` with no other edits.
- [x] Node tests: the organizer's case (party of 3 at „1 z 3“ on Thursday night plus a party of 2 → Thursday 3); arrival day uses only the first night; leave day uses only the last night; a day between a reduced night and a full night counts the full party; two reduced nights in a row use the larger count; a party of 2 adults + 1 kid in the parents' bed reduced from 2 to 1 slots counts 2 people; no `places` gives the old numbers (keep the existing T-039 boundary tests, but replace the „`places` ignored“ test with this rule).
- [x] `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Use the existing `neededSlots` and `neededOnNight` from `logic-model.js` (loaded before `logic-summary.js`). Do not read `party.places` directly.
- Night ids are dates; compute D − 1 the same way the existing code steps between days (see `eventDays`/`dayLabel` helpers). Do not add new date formatting.
- Keep the whole rule inside `foodCount` so it can still be changed in one place.
- In `proposal.md`, tick the T-039 food decision as decided by the organizer on 24. 10. 2026 and describe the new rule in Slovak. Change only that line.

---
## Dev log
Rewrote `foodCount` (rule in its comment) in `static/js/logic-summary.js`; replaced the „places ignored“ test with six rule tests in `tests/js/logic.test.mjs`; recorded the decision (ticked) in `proposal.md`. Ran `node --test tests/js/` (276 pass) and `uv run pytest` (501 pass).

## Review round 1
Ran `node --test tests/js/` (276 pass) and `uv run pytest` (501 pass).

- `foodCount` matches the rule: uses `isPresent`, `neededSlots`, `neededOnNight` and `addDays` from `logic-model.js`, never reads `places` directly. `neededOnNight` clamps to `[1, full]`, so `missing` is never negative and a party without `places` gives `missing = 0` (old numbers). Arrival day sees only night D and leave day only night D − 1 because of `isPresent`. Smaller `missing` wins. `Math.max(0, …)` is in place. Kids in the parents' bed still count.
- The rule stays inside `foodCount` and its comment. Callers are unchanged. All scripts are listed with `?v=__ASSET_VERSION__`.
- Tests cover every case the criteria list, and the old „places ignored“ test was replaced. The proposal change touches only the T-039 food line, is ticked, is in Slovak, and is dated 24. 10. 2026.

No blockers.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

### Test report (tester, 24. 10. 2026)

Commands (node and uv from absolute paths, `/Users/luigi/.nvm/versions/node/v24.1.0/bin/node` and `/opt/homebrew/bin/uv`):
- `node --test tests/js/` → 276 pass, 0 fail.
- `uv run pytest -q` → 501 passed.
- Independent probe script `/tmp/t048probe/probe.mjs` (outside the repo) loads `logic-model.js` and `logic-summary.js` into a vm context and calls `foodCount` directly on 23 cases. All pass after correcting two of my own wrong expectations (the probe, not the app, was wrong).

| Criterion | Result |
| --- | --- |
| New rule in the comment above `foodCount`, smaller `missing` wins, D−1 and D inside the stay | PASS (code and probes) |
| Kids in parents' bed still counted, only `missing` subtracted | PASS (2 adults + 1 kid, 2→1 slots gives 2; no places gives 3) |
| Never below 0; no `places` gives old numbers; `places` 0/null ignored; above-full clamped | PASS |
| Callers (`foodRow`, scene row, `dayVisitRows`, `summaryText`, `hiddenSummary`) unchanged, go through `foodCount` | PASS (diff shows only `foodCount` and its comment in `logic-summary.js`) |
| Node tests: organizer case, arrival day, leave day, day between, two reduced nights, kid case, no places | PASS (7 `foodCount` tests in `tests/js/logic.test.mjs`, all in the 276 passing) |
| `node --test tests/js/` and `uv run pytest` pass | PASS |
| proposal.md: only the T-039 food line changed, ticked, Slovak, dated 24. 10. 2026 | PASS (diff is one line) |

Extra probes: day-only parties ignore `places`; day visit on/off day; before arrival and after leave give 0; month boundary (Oct 31 reduced night, Nov 1 and Nov 2 days); empty parties list gives 0.

Regressions: the full suites above cover `tasks/done/`. No failures.

Manual items: none beyond the existing checklist. The food row on a real phone is only visual, and `tests/manual.md` already covers the summary page.

Verdict: PASS. Moved to `tasks/done/`. Nothing committed.
