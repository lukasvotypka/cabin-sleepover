# T-075: Page: „Zápis je zatvorený“ sign and view-only map

- **Phase:** 2 (split from T-009)
- **Depends on:** T-073, T-074
- **Size:** M

## Goal
When `signup_open` is false everyone sees that signup is closed and non-admins can only look. Proposal section „Informácie v scéne“ (Zamknutý zápis).

## Scope
- `static/js/app-scene.js` or `app-draw.js` (sign), `static/js/app-sheet.js` (bed sheet), `static/js/app-form.js`, the HUD status panel, a pure `canWrite(state, role)` in a `logic-*.js`, `tests/js/logic.test.mjs`, `tests/manual.md`

## Acceptance criteria
- [ ] Pure `canWrite(state, role)`: true when `signup_open` or admin; Node tests for all four cases.
- [ ] With signup closed, a pixel sign „Zápis je zatvorený“ is drawn in `map.scene.locked` (position from config, not code) for everyone, admin included, and the screen-reader summary says it.
- [ ] Non-admins: the bed sheet shows occupancy only, no write buttons; the party form opens read-only with the note „Zápis je zatvorený, zmeny už nejdú uložiť.“; the HUD buttons that change places („… nás viac nebude“ and similar) are hidden; move mode cannot start. Briefing and food notes still work.
- [ ] Admin: everything works as with open signup.
- [ ] Opening or closing signup elsewhere applies live (SSE state) without reload.
- [ ] `tests/manual.md`: „Keď je zápis zamknutý, je vidieť ceduľu „Zápis je zatvorený“ a postele sa dajú len prezerať.“ `node --test tests/js/` passes.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
