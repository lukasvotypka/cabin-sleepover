# T-068: „Čo kto donesie“ on the Ohnisko slide, quick list and summary

- **Phase:** 1
- **Depends on:** T-066, T-067
- **Size:** M

## Goal
Show every party's `food_note` and let my party save its own. See proposal "Pred cestou" › "Obsah podľa organizátora a „Čo kto donesie“" (bullet „Čo kto donesie“).

## Scope
- `static/js/logic-info.js` (pure list), `static/js/logic-summary.js` (summary line), `static/js/logic-errors.js` (`too_long`), `static/js/app-slides.js` (`slFood`), `static/js/app-quick.js` (`qkFood`)
- `tests/js/logic.test.mjs`

## Acceptance criteria
- [x] Pure `foodNotes(state)` returns `[{id, name, color, text}]` for parties with a `food_note`, in party order; tested.
- [x] Ohnisko slide has a part „Čo kto donesie“: one row per entry (colored square, name, text, all via `textContent`); for my party a text field (prefilled, `maxlength` 120) and „Uložiť“ sending `POST /api/food {party_id, text}`; without a chosen party a „Vyber, kto si“ button that opens „Kto si?“ instead of the field.
- [x] Saving applies the returned `state`; on error the field keeps the text and the Slovak message comes from `logic-errors.js` (`invalid` + `reason` `too_long` has its own Slovak text; tested).
- [x] The slide redraws on a new state when the notes change (`slideSignature` for `food` includes them) but not while the user is typing in the field (text not lost).
- [x] Quick list „Jedlo“ card shows the same list (no field).
- [x] „Prehľad na poslanie“ has a line „Čo kto donesie: …“ only when some text exists (format per Q21); tested with none, one and several notes.
- [x] Touch targets ≥ 44 px; field has a label for screen readers. `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Follow how `app-briefing.js` sends its request (relative path, `X-Client-Id`, `X-Party-Id`); reuse the existing request helper.
- Open decision „Čo kto donesie“: default one text per party, editable by anyone with the group code, visible to all.

---
## Dev log

- Added `foodNotes` (logic-info.js, also in the `food` slideSignature), the summary line „Čo kto donesie: A – text; B – text“ after the warnings (logic-summary.js), Slovak `too_long` / `control_chars` texts (logic-errors.js), `foodNotesList`/`slFoodEditor` on the Ohnisko slide (app-slides.js), the list in the quick „Jedlo“ card (app-quick.js), CSS in index.html. The slide is not redrawn while the food field has focus (app-adventure.js).
- Tests added to tests/js/logic.test.mjs. Commands: `node --test tests/js/` (322 pass), `uv run pytest -q` (pass).
- Not verified in a browser (no UI run); the DOM parts are untested by automation.

## Review round 1

Ran `node --test tests/js/` (322 pass) and `uv run pytest -q` (603 passed). All scripts in `index.html` carry `?v=__ASSET_VERSION__`. `foodNotes`, the summary line (format and position per Q21), the `too_long`/`control_chars` texts, `textContent`-only rendering, the label and 44 px targets are all fine.

**Blocker 1. „Vyber, kto si“ never turns into the field** (`static/js/app-slides.js:244`, `static/js/logic-info.js` `slideSignature`). After the user picks a party in „Kto si?“, the `after` callback calls `advOnState()`. That only redraws when `slideSignature("food", …)` changes, and the food signature does not depend on `partyId`, so it stays the same and the slide keeps showing „Vyber, kto si“. Scenario: a new visitor opens Ohnisko, taps „Vyber, kto si“, picks a party, and is back on the same slide with the same button and no field until some unrelated state change comes in. Fix: put the chosen party in the food signature (e.g. `partyId` or `!!partyById(state, partyId)` plus its `food_note`), or force a redraw in the callback. Add a Node test that the food signature changes when `partyId` goes from none to a party.

**Blocker 2. A redraw skipped while the field has focus is never done later** (`static/js/app-adventure.js:250`). When the field has focus, `advOnState` returns early and leaves `adv.slideSig` unchanged, and nothing runs it again on blur. Scenario on iPhone Safari (the main target): tapping „Uložiť“ does not move focus off the input (Safari does not focus buttons on tap), so the returned state is applied but skipped, and the own note does not show in the „Čo kto donesie“ list above. Another party's note that arrives while someone is typing also stays hidden until some later state change. Fix: add a `blur` listener on `#foodNoteInput` that calls `advOnState()` (with the panel/adv-open guard it already has), and/or call `input.blur()` after a successful save.

**Suggestion.** Enter in the field does nothing. Wrapping the field in a `<form>` (submit → same handler, `preventDefault`) would let the phone keyboard's „Hotovo/Odoslať“ save.

Verdict: CHANGES REQUESTED

## Dev log (round 1 fixes)

- Blocker 1: fixed. The food `slideSignature` now includes `!!partyById(state, partyId)`, so choosing a party redraws the slide into the field. Test added.
- Blocker 2: fixed. After a successful save the input is blurred and `advOnState()` runs; a `blur` listener on the field also calls `advOnState()` (after 250 ms so it does not swallow a tap on „Uložiť“), so held-back redraws happen.
- Suggestion: taken. The field and button are in a `<form class="food-form">`; submit (keyboard Enter or „Uložiť“) does the save with `preventDefault`.
- `node --test tests/js/` and `uv run pytest -q` run below.

## Review round 2

Ran `node --test tests/js/` (323 pass) and `uv run pytest -q` (603 passed).

- Blocker 1 fixed: the food `slideSignature` includes `!!partyById(state, partyId)`, so choosing a party in „Kto si?“ redraws the slide into the field; Node test `slideSignature food changes when a party gets chosen` covers it.
- Blocker 2 fixed: a successful save blurs the input and calls `advOnState()`. A delayed `blur` listener also runs any redraw that was held back. The `<form>` submit handles Enter and „Uložiť“ with `preventDefault`.

**Suggestion.** The signature only stores whether a party is chosen, not which one. If someone switches from party A to B while the Ohnisko slide is open, the field still says „Čo donesie A“ and saves to A until something else redraws the slide. Putting `partyId` itself in the signature would fix that. Rare, not blocking.

Verdict: APPROVED

## Test report

## Test report

Result: **PASS** (orchestrator, 25. 10. 2026, T3 preview at 390 px against an own server on port 8131).

- Orchestrator fix of the round-2 suggestion: the food `slideSignature` now carries the chosen party id (not only whether one is chosen), so switching parties redraws the field for the new party; Node test „slideSignature food changes when another party gets chosen“ added.
- Suites: `node --test tests/js/` 324 pass, `uv run pytest -q` 603 passed.
- Ohnisko: field labelled „Čo donesie Ivan a Eva“, `maxlength` 120; typing „donesieme pizza pec“ and „Uložiť“ sends one `POST /api/food` (200), the server stores `food_note`, the slide list shows „Ivan a Eva: donesieme pizza pec“, `summaryText` has „Čo kto donesie: Ivan a Eva – donesieme pizza pec“.
