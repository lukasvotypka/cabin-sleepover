# T-070: Bed panel: whole stay is the main action

- **Phase:** 1
- **Depends on:** none
- **Size:** S

## Goal
In the bed panel ~90 % of people want the bed for their whole stay, but the filled main button is „Zapísať sem „X“ (1 miesto)“ (this night only) and „Na všetky naše noci“ is the outlined secondary one, and neither says which nights it covers. Swap them and name the nights (organizer's request of 25. 10. 2026).

## Scope
- `static/js/app-sheet.js` (`addActions`)
- `static/js/logic-beds.js` (new pure text functions; `assignLabel` may be replaced)
- `static/index.html` only if a CSS rule for the second line of the button is needed
- `tests/js/logic.test.mjs` (new tests)

## Acceptance criteria
- [x] The **filled** main button (first in the panel, gets focus) assigns the whole stay (`assignHere(bed, true)`, `api/assign-stay`). Text: „Zapísať „Meno“ na celý pobyt (1 miesto)“ with a smaller second line naming the nights it will actually book, e.g. „št – ne · 3 noci“ (first night's day – the day after the last night, short day names as `dayShort`, correct plural: 1 noc, 2–4 noci, 5+ nocí).
- [x] The **outlined** secondary button assigns only the selected night (`assignHere(bed, false)`): „Len na sobotu“ / „Len na štvrtok“ … (accusative day name of the selected night).
- [x] When the party is present only on the selected night (its stay has one night), only one filled button is shown: „Zapísať sem „Meno“ (1 miesto)“ (single-night assign).
- [x] When the bed is not free on some of the party's nights (`stayNights` returns fewer than the party's present nights), a note under the buttons says so beforehand, e.g. „V piatok je tu plno, zapíšeme ťa na št a so.“ The second line of the main button counts only the nights in `stayNights`.
- [x] Without a chosen party the buttons behave as now (tap opens „Kto si?“); the not-present, full-bed and „enough already“ notes and their buttons stay as they are; both buttons are disabled when nothing can be taken.
- [x] The texts come from new pure functions in `logic-beds.js`, all user text via `textContent`. Node tests cover: 3-night stay, 2-night stay, 1-night stay (single button), a stay with a full night (note + count), plural forms of nights, accusative day names. `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
- `stayNights(state, party, slots)` already gives the nights the whole-stay write will book; reuse it, do not duplicate the rule.
- Check `logic-model.js` for existing day-name helpers (`dayShort`, `dayLocative`, `DAY_*`) before adding an accusative table.
- Buttons stay ≥ 44 px tall; the two-line main button must still fit at 380 px width.
- Plain scripts, no ES modules, shared global scope.

---
## Dev log
Swapped the bed panel buttons: filled main = whole stay (`assignHere(bed,true)`) with a second line of nights, outlined = only the selected night, single button for one-night stays, note for full nights. New pure `bedActionTexts`, `stayNightsText`, `stayFullNote`, `nightsCount`, `dayAccusative` in `logic-beds.js`; `addActions` in `app-sheet.js`; `.sub-line` CSS in `index.html`; tests in `tests/js/logic.test.mjs`. `assignLabel` kept (used for the single/no-party label and a snapshot test). Ran `node --test tests/js/` and `uv run pytest -q`: all pass. Not checked visually at 380 px.

## Review round 1

Tests: `node --test tests/js/` 329 pass, `uv run pytest -q` 620 pass. All 30 `static/js/*.js` scripts are listed in `index.html` with `?v=__ASSET_VERSION__`. User text goes in via `textContent` (`htmlEl`), and the button order, focus, single-button case and no-party case are right.

- **Blocker 1** `static/js/logic-beds.js:344` (`bedActionTexts`): the panel calls `stayNights(state, party, bed.slots)`, which requires **every** slot of the bed to be free. The real write in `assignHere` (`app-actions.js:122`) calls `stayNights(st, party, slots)` with `slots = slotsToTake(...)`, so only the slots it will take must be free. Bed text and write disagree whenever a party takes only part of a bed. A probe shows this: a 1-adult party, `left-double`, another party on `left-double-2` on Friday, panel opened on Saturday. The write books Thu, Fri and Sat on `left-double-1`, but the panel says „št – ne · 2 noci“ and „V piatok je tu plno, zapíšeme ťa na št a so.“ That is wrong for every shared double bed, bunk, sofa or mats. Fix: compute `take = slotsToTake(state, party, bed, night)` inside `bedActionTexts`, or pass the slots in, and call `stayNights(state, party, take)` exactly as `assignHere` does. Add a Node test with a 2-slot bed where one slot is held by another party on one night (expected: 3 nights, no note).
- **Blocker 2** same function, `full`: a night where the party itself already holds this bed counts as „plno“. Example: the party used „Len na štvrtok“, then opens the same bed on Saturday. It sees „Vo štvrtok je tu plno, zapíšeme ťa na pi a so.“, which is false because they already sleep there. Fix: leave out of `full` the nights where the party already holds the slots in this bed (or say nothing about them). Add a test for it.

Suggestion: once the slots come from `slotsToTake`, consider reusing that value in `addActions` rather than computing it twice.

Verdict: CHANGES REQUESTED

## Dev log round 1 fixes
- Blocker 1: fixed. `bedActionTexts` now takes `take` (the slots from `slotsToTake`, already computed in `addActions`) instead of `places`, and calls `stayNights(state, party, take)` like `assignHere`. Test: 1-adult party on `left-double` with the other slot held on Friday gives 3 nights, no note.
- Blocker 2: fixed. Nights where the party already holds a slot of this bed are left out of `full`. Test added.
- Files: `static/js/logic-beds.js`, `static/js/app-sheet.js`, `tests/js/logic.test.mjs`.
- `node --test tests/js/` 331 pass, `uv run pytest -q` 620 pass.

## Review round 2

Tests: `node --test tests/js/` 331 pass, `uv run pytest -q` 620 pass.

- Blocker 1 fixed: `bedActionTexts` takes `take` (the `slotsToTake` value already computed in `addActions`) and calls `stayNights(state, party, take)`, the same call as `assignHere` (`app-actions.js:120-122`). Panel text and write now agree for shared beds. The new test covers it (3 nights, no note).
- Blocker 2 fixed: `full` leaves out nights where the party already holds a slot of this bed. A test covers it.
- Fresh pass over the fix diff found no new issues. The round-1 suggestion (compute `take` once) is done too.

Verdict: APPROVED

## Test report

Tester (round 1), 25. 10. 2026. No backend code changed, so no server tests apply; a temporary server on 127.0.0.1:8061 with `data/` in a temp dir was used only to check the served page. Verdict: FAIL (one criterion).

**Commands and results**
- `uv run pytest -q` → 620 passed
- `node --test tests/js/` → 331 pass, 0 fail
- Extra Node probes (temp copy of the test file in `/tmp/t070`, not added to the repo): no party, one-night stay, two full nights, `nightsCount` 1–25, `dayAccusative` for all 7 days, `stayFullNote` with two and with all nights full.
- `curl` on temp server: `/api/health` 200 (version 1.14.2), `/` lists `static/js/logic-beds.js?v=<hash>` and the served file contains `bedActionTexts`, `/data/cabin-data.yaml` 404, `/api/state` 401 without cookie.
- Regressions: tasks in `tasks/done/` are covered by the 620 pytest and 331 Node tests, all passing.

**Acceptance criteria**

| # | Criterion | Result |
|---|---|---|
| 1 | Filled main button = `assignHere(bed, true)`, text „Zapísať „Meno“ na celý pobyt (1 miesto)“ + sub-line „št – ne · 3 noci“ | PASS |
| 2 | Outlined = `assignHere(bed, false)`, „Len na sobotu“ / „Len na štvrtok“ | PASS |
| 3 | Party present one night only → single filled „Zapísať sem „Meno“ (1 miesto)“ | PASS |
| 4 | Note for full night; sub-line counts only `stayNights`; „V piatok je tu plno, zapíšeme ťa na št a so.“ | PASS |
| 5 | Without a chosen party the buttons behave as now (tap opens „Kto si?“); notes and disabled rules unchanged | FAIL (see bug 1) |
| 6 | Texts from pure functions in `logic-beds.js`, via `textContent` (`htmlEl` sets `textContent`) | PASS |
| 7 | Node tests for 3/2/1-night, full night, plurals, accusative; both test commands pass | PASS |
| - | Layout at 380 px, 44 px height, sub-line fit | NOT CHECKED (no browser): added to `tests/manual.md` |

**Bug 1 (criterion 5, minor)**
- Steps: no party chosen (or the party is not picked in „Kto si?“), open any bed panel on any night.
- Expected: the buttons behave as before the change, i.e. two buttons: „Zapísať nás sem“ (filled) and „Na všetky naše noci“ (outlined, now the whole-stay action or the per-night one), both tapping to „Kto si?“.
- Actual: `bedActionTexts` returns `single: true` for `!party`, so `addActions` renders only one button („Zapísať nás sem“). The outlined secondary button is gone. Reproduced with `L.bedActionTexts(state, null, bed, SAT, [])` → `{"single":true,"main":"Zapísať nás sem","sub":"","only":"",...}`.
- Suggested fix: in `bedActionTexts`, return `single: true` only for a party present on at most one night. For no party, keep the two-button form (e.g. main "Zapísať nás sem", only "Len na sobotu"), or state explicitly in the task that the single button is intended for visitors without a party. Add a Node test for the no-party case.

**Extra scenarios**
- Party present on Thu–Sun with Friday and Saturday taken by others, selecting Thursday: main "Zapísať „Ivan“ na celý pobyt (1 miesto)", sub "št – pi · 1 noc", note "V piatok a v sobotu je tu plno, zapíšeme ťa na št." (per the rule, the count is what `stayNights` books).
- Selected Saturday, Saturday full: note "V sobotu je tu plno, zapíšeme ťa na št a pi.", sub "št – so · 2 noci".
- Plural forms 1, 2, 4, 5, 11, 21, 22, 25 nights → noc / noci / nocí.

**Manual** (`tests/manual.md`): added the T-070 item (380 px, 44 px touch target, two devices, the note, the single button, no party). Also updated the older walk item that still named „Na všetky naše noci“.

Moved to `tasks/in-progress/` with this report.

**Orchestrator decision (25. 10. 2026):** bug 1 is accepted as intended. Without a chosen party both buttons would only open „Kto si?“, so the single „Zapísať nás sem“ button is clearer; criterion 5 is read as "tap opens „Kto si?“", which holds. Moved to done.
