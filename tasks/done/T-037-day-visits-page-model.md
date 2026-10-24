# T-037: Day visits: page model logic and error texts

- **Phase:** 1
- **Depends on:** T-036
- **Size:** M

## Goal
Make the page logic understand day-only parties (see T-036 Goal, organizer's decision of 24. 10. 2026): never present on a night, need 0 places, no warnings, no meadow figures, no bed. Add the Slovak texts for the new server reasons. Proposal sections: "Informácie v scéne" (Tabuľka s partiou a stavom), "Ťuknutie na posteľ", "HTTP API" → Odpoveď (codes mapped to Slovak only in `logic-errors.js`).

## Scope
- `static/js/logic-model.js`, `static/js/logic-beds.js`, `static/js/logic-summary.js` (only `freedByStay`), `static/js/logic-errors.js`
- `static/js/app-sheet.js` (bed panel note for a day-only party)
- `tests/js/logic.test.mjs`

## Acceptance criteria
- [x] `isDayOnly(party)`: true when `day_visits` is a non-empty array and `arrive` is null/missing.
- [x] `isPresent(party, night)` is false for a day-only party on every night (no comparison with `null`/`undefined`). As a result `neededOnNight`, `missingPlaces`, `extraPlaces` are 0, `nightTally(...).kind` is `"absent"`, `waitingFigures` is empty, the signpost chip says „nie si tu“, `placesPanelInfo`/`fewerPlacesAction` return `null`. Node tests for each.
- [x] `defaultNightFor(dayOnlyParty, nights)` returns `nights[0]`.
- [x] `myPartyStatus` for a day-only party holding no beds: `kind: "ok"`, text „Prídeš len cez deň“ (no red or amber board). Node test.
- [x] `eventDays(event)` returns every day from `arrive_days[0]` to the last `leave_days` (4 ISO days now); `dayLabel(iso)` returns e.g. „Pi 30. 10.“, „Ne 1. 11.“. Node tests.
- [x] `freedByStay(state, partyId, null, null)` returns all of the party's slots (switching to day-only frees everything). Node test.
- [x] Bed panel (`app-sheet.js`): when my party is day-only, the assign buttons stay disabled and the note is „Prídeš len cez deň, posteľ nepotrebuješ.“ (from a pure function in `logic-beds.js`) instead of „Vo štvrtok nie si na chate.“. The „Upraviť príchod a odchod“ button stays.
- [x] `logic-errors.js`: `REASON_TEXTS` gets
  - `stay_mode_mixed`: „Vyber buď príchod a odchod, alebo dni návštevy, nie oboje.“
  - `day_visits_empty`: „Vyber aspoň jeden deň, keď prídeš.“
  - `stay_incomplete`: „Vyber príchod aj odchod.“
  - `duplicate_day`: „Každý deň vyber len raz.“
  - `day_outside_event`: „Tento deň nie je v termíne chaty.“
  - `day_only_kids_in_bed`: „Keď prídeš len cez deň, deti v rodičovskej posteli nechaj na 0.“
  - `FIELD_NAMES.day_visits` = „dni návštevy“.
- [x] `not_present` for a day-only party (found via `params.party_id` in `state`): „„Jakub“ prichádza len cez deň a posteľ nepotrebuje.“ Overnight parties keep today's text. Node tests for every new text through `errorText`.
- [x] `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- `null <= "2026-10-29"` is `true` in JS: guard explicitly in `isPresent`, do not rely on coercion.
- Party table, „Kto je kto“, summary and the scene sign are changed in T-039 … T-041; keep their current behaviour here (day-only rows simply show „–“ for now).
- All Slovak text lives in `logic-*.js` tables/functions and goes to the DOM via `textContent`.

---
## Dev log
- `logic-model.js`: `isDayOnly`, guarded `isPresent` (false without arrive or leave), `eventDays`, `dayLabel`, `defaultNightFor` (falls to `nights[0]` as arrive is null), `myPartyStatus` returns ok „Prídeš len cez deň“ for a day-only party (after the missing and extra checks, so a stray held bed still shows amber).
- `logic-summary.js`: `freedByStay` with null arrive/leave frees all slots.
- `logic-beds.js`: `notPresentNote(party, night)`; `app-sheet.js` uses it for the bed panel note (edit button unchanged).
- `logic-errors.js`: six new `REASON_TEXTS`, `FIELD_NAMES.day_visits`, day-only variant of `not_present` (party found via `params.party_id`).
- Tests: new block at the end of `tests/js/logic.test.mjs`.
- Run: `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` (233 pass), `uv run pytest` (501 pass).
- Follow-up: none; `notPresentText` is kept (still used by `notPresentNote` and tests).

## Review round 1
Ran `node --test tests/js/` (233 pass) and `uv run pytest` (501 pass). Each criterion checked against the diff and tests:
`isDayOnly`, the explicit null guard in `isPresent`, `defaultNightFor`, `myPartyStatus` „Prídeš len cez deň“, `eventDays`/`dayLabel`,
`freedByStay(…, null, null)`, `notPresentNote` used in `app-sheet.js` (assign buttons still disabled via `!present`, edit button kept),
six reason texts + `FIELD_NAMES.day_visits`, and the day-only `not_present` variant. Reason codes match `app/validate.py` (L283–309),
and the server's `not_present` params carry `party_id` (L168, L412), so the lookup works. Slovak stays in `logic-*.js` and reaches the DOM via `textContent`. No new scripts, so all 19 `static/js` files are still listed with `?v=__ASSET_VERSION__`.

**Blocker:** none.

**Suggestion**
- `logic-form.js:117` `stayText` renders a day-only party as „null – null“ in `partyTableSummary` (screen-reader lines) until T-040 removes day-only parties from the table. This is out of scope here and T-040 covers it, so it is only something to keep in mind if T-040 slips.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester: 24. 10. 2026. Verdict: **PASS**, all criteria met, no regressions.

Commands and results:
- `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` → 233 pass, 0 fail.
- `uv run pytest -q` → 501 passed.
- `node --check` on the five changed JS files (`logic-model.js`, `logic-beds.js`, `logic-summary.js`, `logic-errors.js`, `app-sheet.js`) → syntax ok. No `innerHTML` in the diff.
- Temporary server (`create_app(data_dir='/tmp/t037-probe/data')`, port 8123, test secrets, health `1.4.1`) with an independent probe: `/tmp/t037-probe/api_probe.py` (real API calls) and `/tmp/t037-probe/check.mjs` (the logic files loaded into a vm context, run on the real API state and responses) → 12 of 12 checks PASS. The server was stopped and the probe data removed afterwards.

| Criterion | Result | Evidence |
| --- | --- | --- |
| `isDayOnly` | PASS | Node tests; probe on API state (day-only true, overnight and `day_visits: []` false) |
| `isPresent` / never present, zero needs, absent tally, „nie si tu“, empty figures, null panels | PASS | Node tests; probe for the 3 event nights and 2 out-of-range nights; `isPresent` with null arrive or leave is false |
| `defaultNightFor` → `nights[0]` | PASS | Node test; probe |
| `myPartyStatus` → ok „Prídeš len cez deň“ | PASS | Probe returns `{kind:"ok", night:null, count:0, text:"Prídeš len cez deň"}` |
| `eventDays` (4 days) and `dayLabel` | PASS | Probe: 2026-10-29 to 2026-11-01; „Št 29. 10.“, „Pi 30. 10.“, „So 31. 10.“, „Ne 1. 11.“; `dayLabel("2026-02-30")` is "" |
| `freedByStay(…, null, null)` frees all | PASS | Probe with a simulated `sleeping` (two nights, one slot held per night): both freed, in night order |
| Bed panel note and disabled assign buttons | PASS in code, device check open | `app-sheet.js` `addActions`: `take` is empty when not present, so both assign and stay buttons are disabled; note comes from `notPresentNote`; the edit button is kept. Not run in a DOM, so a manual item was added (see below) |
| `REASON_TEXTS` (six codes) and `FIELD_NAMES.day_visits` | PASS | The server returned all six reasons as real 422 responses (`stay_mode_mixed`, `day_visits_empty`, `stay_incomplete` for both missing fields, `duplicate_day`, `day_outside_event`, `day_only_kids_in_bed`). Each `errorText` gives the exact Slovak string from the task |
| `not_present` day-only variant | PASS | Real 409 from `/api/assign` for the day-only party gives „„Jakub“ prichádza len cez deň a posteľ nepotrebuje.“; overnight text unchanged (Node test) |
| `node --test` and `pytest` pass | PASS | See commands above |

Extra scenarios tried (API and logic):
- Boundary days: 2026-10-29 (first arrive day) and 2026-11-01 (last leave day) accepted; 2026-10-28 → `day_outside_event`; 2026-02-30 → `invalid` (no `reason`, generic Slovak fallback).
- Mixed, empty, arrive-only and leave-only `day_visits` each return the expected reason.
- Duplicate name in different case („jakub“) → `duplicate_name` 409.
- `POST /api/assign-stay` for the day-only party → 422 `invalid` with `reason: no_event_nights`. Not in the T-037 list, so the page shows the generic Slovak fallback „Niečo v zadaní nesedí, skontroluj ho.“ (no English). The UI keeps that button disabled, so it is not reachable from the page.
- Unknown code (`bogus_code`) → generic Slovak fallback „Niečo sa nepodarilo, skús to znova.“.
- `PUT` turning an overnight party into a day-only party → 200.

Observation, not a criterion (non-blocking): the „Kto je kto“ legend row for a day-only party shows „null – null“ as its stay part. `stayText` in `logic-form.js` does not handle a null arrive or leave, and `legendRows` passes it to `app-sheet.js` (line 229). The Notes say day-only rows „simply show „–“ for now“. The party table already shows „–“, and the screen-reader summary says „nie je tu“. Users cannot reach the legend with a day-only party until T-038 adds the form, and T-040 covers the legend. Suggest T-040 (or the developer, if it is cheap) makes `stayText` return „–“ for a day-only party.

Tests added: none. The criteria are covered by the Node tests in `tests/js/logic.test.mjs`.
Manual: added one item to `tests/manual.md`, section 4, „Day-only party, bed panel (T-037)“ (the device check of the bed panel note and the disabled buttons).

