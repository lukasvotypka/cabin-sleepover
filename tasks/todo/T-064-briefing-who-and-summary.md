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
- [ ] With `state.info` not `null`, each party row in „Kto je kto“ has the line „Pred cestou: ✓ prejdené“, „Pred cestou: 2 z 5“ or „Pred cestou: ešte nie“ (`briefingStatusText`), updated live.
- [ ] `summaryText` ends with „Pred cestou ešte neprešli: A, B“ (`notBriefedNames`) when such parties exist; no line when all are done, when there are no parties, or when `info` is `null`.
- [ ] Party names via `textContent` only.
- [ ] Node tests: summary with two parties not done, all done, `info: null`; existing summary tests unchanged. `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Open decision "Pred cestou, kto to vidí": default everyone, not only the organizer.
- Touches different files than T-060 … T-063 and may run in parallel with them.

---
## Dev log

## Review round 1

## Review round 2

## Test report
