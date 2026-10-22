# T-007: Panels over the map: party form, „Prehľad na poslanie“, hidden screen-reader summary

- **Phase:** 1
- **Depends on:** T-006
- **Size:** M

## Goal
Finish the one-page app. Add the party form (add and edit, warning before a stay is shortened), the letter icon with the WhatsApp summary panel, and the visually hidden text summary that replaces a list view for screen readers. Proposal sections: „Informácie v scéne“ (Prehľad na poslanie), „Formulár partie“, „Mapa“ (hidden summary), „Prvé otvorenie“ (Pridať partiu), „HTTP API“ (parties), „Vzhľad“.

## Scope
- `static/index.html`
- `tests/js/logic.test.mjs` (extend it)

## Acceptance criteria
- [ ] New pure functions in the logic block, with Node tests:
  - [ ] **summary text**: the name and date, then for each night the rooms (in layout order) with the party names, then warnings for parties with missing places, then the page link; tested against an expected string for a sample state
  - [ ] **hidden summary content** for the selected night: the date, the instructions, and each room with its beds and names (or „voľné“)
  - [ ] **slots freed by a changed stay**: tested for leave moved from Sunday to Saturday and for arrive moved from Thursday to Friday
- [ ] A test builds the summary text and the hidden summary for the same sample state. Both list exactly the same party per bed and night as the slot data the map draws from (proposal acceptance criterion).
- [ ] **Party form** (panel), opened from „Kto si?“ → **Pridať partiu**, from the status board for *moja partia*, and from the sheet's „not present“ hint:
  - [ ] fields: meno, dospelí, deti, deti spiace s rodičmi, príchod (select from `event.arrive_days`), odchod (select from `event.leave_days`), čas príchodu, poznámka
  - [ ] `maxlength` and min / max match the server limits (60 / 60 / 300, counts 0–20)
- [ ] Creating a party calls `POST api/parties` and sets the new party as *moja partia*. `duplicate_name` and `invalid` errors show next to the form as Slovak text from the T-005 `errorText` table. For `invalid`, the text is shown next to the field named in `params.field`.
- [ ] Editing calls `PUT api/parties/{id}`.
- [ ] Before a save that shortens the stay, the form lists which places will be freed, with night and bed name, and asks for confirmation. After saving, it reports the server's `freed`.
- [ ] **Letter icon** in `map.scene.letter` (Q11) opens a panel with the summary text in a read-only `textarea` and a **Kopírovať** button. The button uses `navigator.clipboard`, falls back to selecting the text, and confirms in Slovak. The text contains the page link and never a code.
- [ ] **Hidden summary:** a visually hidden region (not `display:none`) that screen readers reach. It holds the hidden summary content for the selected night and updates with every new state and night switch. The SVG scene is labelled so a screen reader is pointed to it.
- [ ] The letter icon has `role="button"`, `tabindex="0"`, a Slovak `aria-label` and a hit area of at least 44 units.
- [ ] Panels use the Vzhľad colors and Alegreya fonts in light and dark mode. Buttons are at least 44 px. Escape closes a panel and focus returns to where it came from.
- [ ] The server's English `message` is never shown. Every error goes through `errorText`, and new cases are added to that one table.
- [ ] UI text is Slovak and informal with „ “ quotes. Code, comments and tests are in English. Human text goes in only through `textContent`, `value` or `setAttribute`, and there is still no `innerHTML`.
- [ ] `node --test tests/js/` passes.

## Notes for developer
- The summary text format is defined by the proposal („Informácie v scéne“ → Prehľad na poslanie), not by any old page. Keep it plain and readable in WhatsApp.
- The summary link is the page URL (`location.origin + location.pathname`). Pass it into the pure function, so the function stays DOM-free and testable.
- `navigator.clipboard` needs HTTPS, which production has. Keep the fallback for local testing.
- Visually hidden means the usual clip / 1 px pattern. Do not use `display:none` or `visibility:hidden`, which hide it from screen readers too.
- The admin key icon, admin panel and signup lock are moved to T-009 (phase 2, not built now).
- Organizer decision `tasks/QUESTIONS.md` Q10: shrinking the party size frees nothing automatically, so only stay shortening shows a warning.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
