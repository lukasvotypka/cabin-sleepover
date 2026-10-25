# T-072: Bed panel: places count in the sub-line, no split „(1 miesto)“

- **Phase:** 1
- **Depends on:** T-071
- **Size:** S

## Goal
On the iPhone 13 mini (375 px) the main button „Zapísať „Frantisek“ na celý pobyt (1 miesto)“ wraps as „… (1“ / „miesto)“. Move the count to the sub-line so the main text is shorter, and never split the count (organizer's request of 25. 10. 2026).

## Scope
- `static/js/logic-beds.js` (`bedActionTexts`, maybe `stayNightsText`)
- `tests/js/logic.test.mjs`

## Acceptance criteria
- [x] Two-button case: main is „Zapísať „X“ na celý pobyt“ / „Zapísať „X“ na voľné noci“ with no count; sub-line is the nights text plus the count, e.g. „št – ne · 3 noci · 1 miesto“, „št, so · 2 noci · 2 miesta“. With 0 places the count part is left out.
- [x] Single-button case (one-night stay, or only the selected night bookable): text stays „Zapísať sem „X“ (1 miesto)“, but the space inside the count is a non-breaking space (U+00A0), so „(1 miesto)“ never splits. Same for the no-party „Zapísať nás sem“ label if it carries a count (`assignLabel`).
- [x] The aria-label of the main button still reads main + sub (unchanged code path in `app-sheet.js`).
- [x] Node tests updated for both cases (assert the U+00A0). `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
- Only texts change; no layout or rule change. Check other callers of `assignLabel`/`pluralPlaces` before changing them; prefer adding the non-breaking space at the place the count is put in parentheses.

---
## Dev log
Moved the places count into the sub-line of the two-button case (`stayNightsText + " · N miesto"`); single-button text and `assignLabel` now use a non-breaking space inside the count. Files: `static/js/logic-beds.js`, `tests/js/logic.test.mjs` (asserts U+00A0). `node --test tests/js/` 333 pass; `uv run pytest -q` 620 pass.

## Review round 1
All four criteria met. Two-button `main` has no count and `sub` is the nights text + ` · N\u00a0miesto/miesta`, left out when `places` is 0 (`logic-beds.js:358`). Single-button and no-party texts now go through `assignLabel`, which puts U+00A0 inside the parentheses (`logic-beds.js:300`). The output is the same as before apart from the NBSP. `assignLabel` has no other callers, and `pluralPlaces` is not changed for its other callers (summary, warnings). The aria-label path in `app-sheet.js:76` is unchanged. Text still goes in via `textContent`/`button()`. Tests: `node --test tests/js/` 333 pass, `uv run pytest -q` 620 pass.

- **Suggestion:** no test covers the two-button case with 0 places (the count is left out) or a plural sub-line („2 miesta“). The code handles both, so this is not required.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester: Haiku 5.5, 2026-10-25. Working tree (uncommitted changes in `logic-beds.js` and `tests/js/logic.test.mjs`).

Commands and results:
- `uv run pytest -q`: 620 passed.
- `node --test tests/js/`: 333 pass, 0 fail.
- Probe (temp copy of the Node test file in a temp dir, deleted afterwards): two-button case with 0 places gives main „Zapísať „Ivan“ na celý pobyt“ and sub „št – ne · 3 noci“ (no count). Counts 0 to 5 across the single-button, two-button and no-party labels: „(1 miesto)“, „(2 miesta)“, „(5 miest)“ and „· 1 miesto“ all use U+00A0 and no ASCII space inside the count.
- Temp server on port 8877 with a temp `data/` (stopped and removed afterwards): `/api/health` 200, `/` references `logic-beds.js?v=…`, the served `logic-beds.js` contains the NBSP code, `/data/cabin-data.yaml` and `/static/../data/…` return 404.

| # | Acceptance criterion | Result |
|---|---|---|
| 1 | Two-button: main without count, sub = nights text + count; 0 places leaves the count out | PASS |
| 2 | Single-button and no-party labels use U+00A0 inside the count | PASS |
| 3 | aria-label of the main button is main + sub (`app-sheet.js:76`, unchanged) | PASS |
| 4 | Node tests updated (U+00A0 asserted); `node --test` and `pytest` pass | PASS |

Extra scenarios: plural forms („2 miesta“, „5 miest“) in the sub-line and labels; party name with a space; no regression in `tests/js` (all done tasks' tests still pass).

Needs a device (added to `tests/manual.md`, T-072 item): the iPhone 13 mini (375 px) wrap of the main text and the sub-line, VoiceOver or TalkBack reading.

No failures. Task moved to `done/`.
