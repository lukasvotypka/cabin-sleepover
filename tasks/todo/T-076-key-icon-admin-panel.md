# T-076: Page: key icon and admin panel

- **Phase:** 2 (split from T-009)
- **Depends on:** T-073, T-074
- **Size:** M

## Goal
The organizer's tools on the page: a key icon in the scene opens a panel to lock or unlock signup, download the data and delete a party. Proposal section „Informácie v scéne“ (Admin).

## Scope
- new `static/js/app-admin.js` (listed in `index.html` with `?v=__ASSET_VERSION__`, before `app-start.js`), the scene draw file for the icon, `static/index.html`, `static/js/logic-errors.js`, `tests/js/logic.test.mjs` if any pure logic is added, `README.md`, `tests/manual.md`

## Acceptance criteria
- [ ] A pixel key icon in `map.scene.key`, drawn only when `isAdmin`, `role="button"`, `tabindex="0"`, `aria-label="Admin nástroje"`, hit area at least 44 units; it opens a panel „Admin“ (existing panel helper).
- [ ] The panel has:
  - [ ] „Zamknúť zápis“ / „Otvoriť zápis“ by the current `signup_open`, calling `POST /api/admin/signup` and applying the returned state
  - [ ] „Stiahnuť dáta“: downloads `api/admin/export` (relative path, plain link or fetch + blob, works on iPhone Safari)
  - [ ] „Zmazať partiu“: choose a party from a list (color square + name via `textContent`), then a confirm step „Naozaj zmazať „<meno>“? Uvoľnia sa všetky jej miesta.“, then `DELETE /api/parties/{id}`; if the deleted party is my „Si: …“, the page forgets it and opens „Kto si?“
- [ ] `onAdminLost()` (T-074) removes the icon and closes the panel; errors show Slovak text from `errorText`. No `innerHTML`.
- [ ] README: how to log in as organizer and lock signup. `tests/manual.md`: admin code shows the key; lock, export and delete work.
- [ ] `node --test tests/js/` and `uv run pytest` pass.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
