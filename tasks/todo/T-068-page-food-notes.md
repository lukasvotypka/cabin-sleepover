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
- [ ] Pure `foodNotes(state)` returns `[{id, name, color, text}]` for parties with a `food_note`, in party order; tested.
- [ ] Ohnisko slide has a part „Čo kto donesie“: one row per entry (colored square, name, text, all via `textContent`); for my party a text field (prefilled, `maxlength` 120) and „Uložiť“ sending `POST /api/food {party_id, text}`; without a chosen party a „Vyber, kto si“ button that opens „Kto si?“ instead of the field.
- [ ] Saving applies the returned `state`; on error the field keeps the text and the Slovak message comes from `logic-errors.js` (`invalid` + `reason` `too_long` has its own Slovak text; tested).
- [ ] The slide redraws on a new state when the notes change (`slideSignature` for `food` includes them) but not while the user is typing in the field (text not lost).
- [ ] Quick list „Jedlo“ card shows the same list (no field).
- [ ] „Prehľad na poslanie“ has a line „Čo kto donesie: …“ only when some text exists (format per Q21); tested with none, one and several notes.
- [ ] Touch targets ≥ 44 px; field has a label for screen readers. `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Follow how `app-briefing.js` sends its request (relative path, `X-Client-Id`, `X-Party-Id`); reuse the existing request helper.
- Open decision „Čo kto donesie“: default one text per party, editable by anyone with the group code, visible to all.

---
## Dev log

## Review round 1

## Review round 2

## Test report
