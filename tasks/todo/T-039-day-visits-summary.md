# T-039: Day visits in „Prehľad na poslanie“ and the screen-reader summary

- **Phase:** 1
- **Depends on:** T-037
- **Size:** M

## Goal
The WhatsApp text and the hidden screen-reader summary list day visitors per day and a per-day food count (organizer's decision of 24. 10. 2026; proposal "Informácie v scéne" → Prehľad na poslanie, and the acceptance item that the summary and the hidden summary give the same data as the map). Look: mockup `/tmp/day-mock/index.html`, tab „Prehľad“.

## Scope
- `static/js/logic-summary.js`, `static/js/app-draw.js` (`renderSummary` only)
- `tests/js/logic.test.mjs`

## Acceptance criteria
- [ ] Pure `dayVisitRows(state)` → one row per event day (`eventDays`) that has at least one day-only party, in day order: `{day, label, parties: [{id, name, color, people}], food}`. Parties in `state.parties` order; `people` = `adults + kids`; `label` from `dayLabel`.
- [ ] Pure `foodCount(state, day)` with this rule (write it in a comment above the function): **sum of `adults + kids` of every overnight party with `arrive ≤ day ≤ leave`, plus `adults + kids` of every day-only party that has `day` in `day_visits`.** Kids in the parents' bed count; `places` overrides are ignored.
- [ ] `peopleText`-style plural helper: „1 človek“, „2 ľudia“ (2–4), „5 ľudí“ (0 and 5+).
- [ ] `summaryText`: when `dayVisitRows` is non-empty, after the nights and before „Chýbajú miesta:“ it adds a blank line, „Cez deň (bez spania):“, then per row `"<label>: <name> (<people>), <name> (<people>)"` and the line `"   → spolu <N ľudí> na jedlo"`. Without day-only parties the text is byte-identical to today (test against the current output).
- [ ] Day-only parties never appear in room lines or in „Chýbajú miesta“.
- [ ] `hiddenSummary` gains `dayVisits`: one line per row, e.g. „Piatok 30. 10. cez deň: Jakub (1 človek), spolu 12 ľudí na jedlo“; `renderSummary` puts them into `#srSummary` via `textContent` (nothing when empty).
- [ ] Node tests: `foodCount` boundaries (arrival day counts, leave day counts, day before arrival does not, day visitor counts only on their days, kids in the parents' bed count, `places` ignored); `dayVisitRows` with non-consecutive days (Pi + Ne) and two visitors on one day; exact `summaryText` for a fixture like the mockup; unchanged text without visitors; plurals 1/2/5.
- [ ] `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- The food rule is an analyst default and is listed in `proposal.md` → „Otvorené rozhodnutia“. Keep it in one function so the organizer can change it in one place.
- Days without day visitors get no „Cez deň“ line and no food count (also an open decision default).
- Reuse `dayLabel`/`eventDays` from T-037; do not duplicate date formatting.

---
## Dev log

## Review round 1

## Review round 2

## Test report
