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
- [x] Pure `dayVisitRows(state)` → one row per event day (`eventDays`) that has at least one day-only party, in day order: `{day, label, parties: [{id, name, color, people}], food}`. Parties in `state.parties` order; `people` = `adults + kids`; `label` from `dayLabel`.
- [x] Pure `foodCount(state, day)` with this rule (write it in a comment above the function): **sum of `adults + kids` of every overnight party with `arrive ≤ day ≤ leave`, plus `adults + kids` of every day-only party that has `day` in `day_visits`.** Kids in the parents' bed count; `places` overrides are ignored.
- [x] `peopleText`-style plural helper: „1 človek“, „2 ľudia“ (2–4), „5 ľudí“ (0 and 5+).
- [x] `summaryText`: when `dayVisitRows` is non-empty, after the nights and before „Chýbajú miesta:“ it adds a blank line, „Cez deň (bez spania):“, then per row `"<label>: <name> (<people>), <name> (<people>)"` and the line `"   → spolu <N ľudí> na jedlo"`. Without day-only parties the text is byte-identical to today (test against the current output).
- [x] Day-only parties never appear in room lines or in „Chýbajú miesta“.
- [x] `hiddenSummary` gains `dayVisits`: one line per row, e.g. „Piatok 30. 10. cez deň: Jakub (1 človek), spolu 12 ľudí na jedlo“; `renderSummary` puts them into `#srSummary` via `textContent` (nothing when empty).
- [x] Node tests: `foodCount` boundaries (arrival day counts, leave day counts, day before arrival does not, day visitor counts only on their days, kids in the parents' bed count, `places` ignored); `dayVisitRows` with non-consecutive days (Pi + Ne) and two visitors on one day; exact `summaryText` for a fixture like the mockup; unchanged text without visitors; plurals 1/2/5.
- [x] `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- The food rule is an analyst default and is listed in `proposal.md` → „Otvorené rozhodnutia“. Keep it in one function so the organizer can change it in one place.
- Days without day visitors get no „Cez deň“ line and no food count (also an open decision default).
- Reuse `dayLabel`/`eventDays` from T-037; do not duplicate date formatting.

---
## Dev log
- `logic-summary.js`: added `peopleCountText` (1 človek / 2 ľudia / 5 ľudí), `foodCount` (rule in a comment above it), `dayVisitRows`; `summaryText` adds the „Cez deň (bez spania):“ block after the nights and before „Chýbajú miesta:“ (only when rows exist, so the text without visitors is unchanged, covered by the existing exact-text test); `hiddenSummary` gains `dayVisits` (uses `dayLabel`, `dayOptionText`, `eventDays`; no new date formatting).
- `app-draw.js` `renderSummary`: when `dayVisits` is non-empty adds a „Návštevy cez deň“ heading and a list via `textContent` (nothing when empty).
- Tests: `tests/js/logic.test.mjs` (section „day visits in the summaries (T-039)“): plurals, `foodCount` boundaries, `dayVisitRows` (Pi + Ne, two visitors on one day), exact day-visit block, unchanged text, hidden lines, day-only parties absent from rooms.
- Commands: `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` (246 pass), `uv run pytest -q` (501 pass).
- Note: the mockup's sample text differs slightly (counts of „(1)“ and a „Voľné miesta“ line); I followed the task's acceptance criteria. Day-only parties are never in `missingPlaces` warnings as `isPresent` is false for them.

## Review round 1
Ran `node --test tests/js/` (246 pass) and `uv run pytest -q` (501 pass).

All acceptance criteria are met. `dayVisitRows`, `foodCount` (with the rule in a comment, kept in one place) and `peopleCountText` are pure and live in `logic-summary.js`. They reuse `eventDays`, `dayLabel`, `dayOptionText` and `isDayOnly`, so dates are not formatted a second time. `logic-form.js` loads before `logic-summary.js`. The „Cez deň“ block goes after the nights and before „Chýbajú miesta:“ and is added only when rows exist. The existing exact-text test (logic.test.mjs:1203) still passes, which shows the text without visitors is byte-identical. Day-only parties stay out of the room lines and the warnings because `isPresent` is false for them. `renderSummary` adds the lines with `htmlEl` (`textContent`) and adds nothing when the list is empty. No new scripts, and every script in `index.html` still has `?v=__ASSET_VERSION__`. The tests cover every listed boundary.

- **Blocker:** none.
- **Nit:** `tests/js/logic.test.mjs` "summaryText is unchanged without day-only parties" adds a party with `arrive: null` and `day_visits: []`, which the server would never store. It is harmless as an extra guard.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (T-039), 2026-10-24.

**Commands and results**
- `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` → 246 pass, 0 fail.
- `uv run pytest -q` → 501 passed (no regressions in the `tasks/done/` tests).
- Own server: `uv run python -c "... create_app(data_dir='<temp>/data') ... port=8123"` with test secrets (temp data dir, removed port afterwards). `/api/health` → `{"ok":true,"version":"1.4.1"}`. Server log: no errors.
- Data created through the API: „Jakub“ day-only on 2026-10-30 (1 person); „Eva“ day-only on 2026-10-30 and 2026-11-01 (2 people); „Rodina“ overnight 2026-10-29 → 2026-11-01 (3 people).
- Page logic run in Node (vm, the real `static/js/logic-*.js`) against the live `/api/state`: `foodCount` 10-28=0, 10-29=3, 10-30=6, 10-31=3, 11-01=5, 11-02=0. `dayVisitRows`: Pi 30. 10. (Jakub:1, Eva:2, food 6), Ne 1. 11. (Eva:2, food 5).

**Acceptance criteria**

| Criterion | Result |
| --- | --- |
| `dayVisitRows` one row per day with day-only parties, day order, shape `{day,label,parties,food}`, `people = adults+kids` | pass |
| `foodCount` rule in a comment; arrival and leave day count, day before/after does not, day visitor only on their days | pass (live state and boundaries above) |
| Plural helper 1 človek / 2–4 ľudia / 0 and 5+ ľudí | pass (0, 1, 2, 4, 5, 11 checked) |
| `summaryText` block „Cez deň (bez spania):“ after nights, before „Chýbajú miesta:“, exact line format and „→ spolu N ľudí na jedlo“ | pass (exact output compared with the rule) |
| Day-only parties absent from room lines and „Chýbajú miesta“ | pass (Jakub and Eva absent in the summary and in the sheet) |
| `hiddenSummary.dayVisits` line format and `renderSummary` via `textContent`, nothing when empty | pass (format matches the example; the heading „Návštevy cez deň“ and the two lines appear in `#srSummary`) |
| Node tests (foodCount boundaries, Pi+Ne, two visitors, exact text, unchanged text, plurals) and `node --test` and `uv run pytest` pass | pass (246 and 501) |

**Browser (t3-code preview, 380 px)**
- The first preview tab stopped responding (snapshot and evaluate timed out), a fresh tab worked. Screenshots time out in this environment, so no image was taken.
- Joined with the group code through the form, opened „Prehľad na poslanie“. Viewport `innerWidth` 380, `scrollWidth` 380 (no horizontal overflow). The sheet textarea equals the Node output line by line, including „Cez deň (bez spania):“ and „→ spolu 6 ľudí na jedlo“ and „Chýbajú miesta:“ after it.
- Not verified here: how it looks (needs a visual check), VoiceOver/TalkBack reading, iPhone Safari, Android Chrome. Added as a checklist item in `tests/manual.md` (section 7, „Day visits in the summary (T-039)“).

**Extra scenarios**
- Food count outside the stay (10-28 and 11-02) is 0; the leave day (11-01) counts.
- Plural helper for 0, 1, 2, 4, 5, 11, 21, 22 (`0 ľudí`, `1 človek`, `2 ľudia`, `4 ľudia`, `5 ľudí`, `11 ľudí`).

**Observations (not failures)**
- The hidden „Kto kde spí po nociach“ list (outside the criteria) shows day-only parties as „Jakub: Št → Pi nie je tu“. It is neither a room line nor „Chýbajú miesta“, so the criteria pass. The organizer may want those lines hidden.
- The plural helper uses `2 ≤ n ≤ 4` on the whole number, so 22 gives „ľudí“. Slovak may prefer „ľudia“ for compound numbers ending in 2–4. Food counts cannot reach 22 with 13–18 people, so there is no practical effect.

**Verdict:** all criteria pass, no regressions. Moved to `tasks/done/`.
