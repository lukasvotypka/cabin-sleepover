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
- [ ] `isDayOnly(party)`: true when `day_visits` is a non-empty array and `arrive` is null/missing.
- [ ] `isPresent(party, night)` is false for a day-only party on every night (no comparison with `null`/`undefined`). As a result `neededOnNight`, `missingPlaces`, `extraPlaces` are 0, `nightTally(...).kind` is `"absent"`, `waitingFigures` is empty, the signpost chip says „nie si tu“, `placesPanelInfo`/`fewerPlacesAction` return `null`. Node tests for each.
- [ ] `defaultNightFor(dayOnlyParty, nights)` returns `nights[0]`.
- [ ] `myPartyStatus` for a day-only party holding no beds: `kind: "ok"`, text „Prídeš len cez deň“ (no red or amber board). Node test.
- [ ] `eventDays(event)` returns every day from `arrive_days[0]` to the last `leave_days` (4 ISO days now); `dayLabel(iso)` returns e.g. „Pi 30. 10.“, „Ne 1. 11.“. Node tests.
- [ ] `freedByStay(state, partyId, null, null)` returns all of the party's slots (switching to day-only frees everything). Node test.
- [ ] Bed panel (`app-sheet.js`): when my party is day-only, the assign buttons stay disabled and the note is „Prídeš len cez deň, posteľ nepotrebuješ.“ (from a pure function in `logic-beds.js`) instead of „Vo štvrtok nie si na chate.“. The „Upraviť príchod a odchod“ button stays.
- [ ] `logic-errors.js`: `REASON_TEXTS` gets
  - `stay_mode_mixed`: „Vyber buď príchod a odchod, alebo dni návštevy, nie oboje.“
  - `day_visits_empty`: „Vyber aspoň jeden deň, keď prídeš.“
  - `stay_incomplete`: „Vyber príchod aj odchod.“
  - `duplicate_day`: „Každý deň vyber len raz.“
  - `day_outside_event`: „Tento deň nie je v termíne chaty.“
  - `day_only_kids_in_bed`: „Keď prídeš len cez deň, deti v rodičovskej posteli nechaj na 0.“
  - `FIELD_NAMES.day_visits` = „dni návštevy“.
- [ ] `not_present` for a day-only party (found via `params.party_id` in `state`): „„Jakub“ prichádza len cez deň a posteľ nepotrebuje.“ Overnight parties keep today's text. Node tests for every new text through `errorText`.
- [ ] `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- `null <= "2026-10-29"` is `true` in JS: guard explicitly in `isPresent`, do not rely on coercion.
- Party table, „Kto je kto“, summary and the scene sign are changed in T-039 … T-041; keep their current behaviour here (day-only rows simply show „–“ for now).
- All Slovak text lives in `logic-*.js` tables/functions and goes to the DOM via `textContent`.

---
## Dev log

## Review round 1

## Review round 2

## Test report
