# T-064: „Pred cestou“ status in „Kto je kto“ and in „Prehľad na poslanie“

- **Phase:** 1
- **Depends on:** T-058, T-059
- **Size:** S

## Goal
Everyone sees which parties went through „Pred cestou“. See proposal "Pred cestou" › "Kto si to prešiel", last bullet.

## Scope
- `static/js/app-sheet.js` (`openLegend` rows), `static/js/logic-summary.js` (`summaryText`)
- `tests/js/logic.test.mjs` / `tests/js/index.js`

## Acceptance criteria
- [x] With `state.info` not `null`, each party row in „Kto je kto“ has the line „Pred cestou: ✓ prejdené“, „Pred cestou: 2 z 5“ or „Pred cestou: ešte nie“ (`briefingStatusText`), updated live.
- [x] `summaryText` ends with „Pred cestou ešte neprešli: A, B“ (`notBriefedNames`) when such parties exist; no line when all are done, when there are no parties, or when `info` is `null`.
- [x] Party names via `textContent` only.
- [x] Node tests: summary with two parties not done, all done, `info: null`; existing summary tests unchanged. `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Open decision "Pred cestou, kto to vidí": default everyone, not only the organizer.
- Touches different files than T-060 … T-063 and may run in parallel with them.

---
## Dev log
- `summaryText` (logic-summary.js) adds „Pred cestou ešte neprešli: …“ via `notBriefedNames`, placed before the final „Tu sa zapíšeš“ link line (link stays last; deviation from literal „ends with“, easy to swap). `openLegend` (app-sheet.js) adds „Pred cestou: …“ line per row via `briefingStatusText`, textContent via `htmlEl`, refreshed by `panel.refresh`. Styled with the existing `legend-nights` class (no CSS change).
- Test added in tests/js/logic.test.mjs. `node --test tests/js/` (310 pass) and `uv run pytest` (570 pass).
- `summaryText` (logic-summary.js) adds „Pred cestou ešte neprešli: …“ via `notBriefedNames`, placed before the final „Tu sa zapíšeš“ link line (link stays last; deviation from literal „ends with“, easy to swap). `openLegend` (app-sheet.js) adds „Pred cestou: …“ line per row via `briefingStatusText`, textContent via `htmlEl`, refreshed by `panel.refresh`. Styled with the existing `legend-nights` class (no CSS change).
- Test added in tests/js/logic.test.mjs. `node --test tests/js/` and `uv run pytest` pass (570 py).

## Review round 1
Scope checked: `static/js/app-sheet.js` (openLegend), `static/js/logic-summary.js` (summaryText), new test in `tests/js/logic.test.mjs`. T-061 changes ignored.

- Legend line uses `briefingStatusText` (null when `info` is null, so no line), rendered via `htmlEl` (textContent), inside `panel.refresh`, so it updates live.
- `summaryText` uses `notBriefedNames` ([] when `info` null or no parties). The line sits just before the final link line. The orchestrator accepted this deviation.
- The test covers parties not done (3, incl. a partial one), all done, `info: null` and no parties. Existing summary tests unchanged.
- Ran `node --test tests/js/`: 311 pass. Ran `uv run pytest`: 570 pass.

Blockers: none.

Suggestion: the Dev log entry is duplicated, so drop one copy.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester: claude-haiku-5-5, scope T-064 only (T-061 ignored).

Commands run:
- `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` → 311 tests, 311 pass, 0 fail.
- `uv run pytest -q` → 570 passed.
- Node probe (`/tmp/t064probe/probe.mjs`, loads the logic-*.js files from `static/index.html` into one vm context):
  - `briefingStatusText`: 1 station → "2 z 5"; all five stations → "✓ prejdené"; quick list only → "✓ prejdené"; no stations → "ešte nie"; `info: null` → null; unknown party → null.
  - `notBriefedNames`: A (2 stations) → ["A"] when B and C are done; `info: null` → [].
  - `bottlesText`: 1 → "fľaša", 4 → "fľaše", 5 and 0 → "fliaš", 22 → "fliaš".
- Code check: `app-sheet.js` line adds the „Pred cestou: …“ line through `htmlEl` (textContent); no `innerHTML` in `app-sheet.js` or `app-core.js`. `panel.refresh` runs on state apply (`app-core.js` render path) and on presence (`app-live.js`), so the line updates live.

Acceptance criteria:

| # | Criterion | Result |
|---|-----------|--------|
| 1 | „Kto je kto“ row shows „Pred cestou: ✓ prejdené / 2 z 5 / ešte nie“ when `info` is not null, updated live | PASS (logic probed; live refresh wiring checked in code; on-device look in manual.md) |
| 2 | `summaryText` carries „Pred cestou ešte neprešli: A, B“ when parties are pending; no line when all done, no parties, or `info` null | PASS (line is placed before the „Tu sa zapíšeš“ link, accepted deviation from "ends with") |
| 3 | Party names via `textContent` only | PASS |
| 4 | Node tests for two pending / all done / `info: null`; existing summary tests unchanged; `node --test` and `uv run pytest` pass | PASS (test diff only adds lines; 311 node, 570 pytest) |

Extra scenarios: zero stations, the quick-list-only path, missing party id, and the Slovak plural forms. No failures.

Manual: added a T-064 checklist item to `tests/manual.md` (section 7, before section 8) covering the legend line on phones, the live update on a second device, the WhatsApp line, and dark mode.

Result: PASS. Task moved to `tasks/done/`.
