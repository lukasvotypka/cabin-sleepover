# T-009: Admin: signup lock, export, delete party, key icon and admin panel

- **Phase:** 2 (blocked: organizer decision 22. 10. 2026 moved admin out of phase 1; do not start until the organizer confirms)
- **Depends on:** T-007, T-027 (file and ID names: `data/cabin-data.yaml`, `tests/manual.md`)
- **Size:** M

## Goal
Give the organizer the admin tools: lock and unlock signup, download the data file, and delete a party, through endpoints and a panel behind a key icon in the scene. The locked-signup sign and view-only map belong here too. Proposal sections: „HTTP API“ (Endpointy, admin rows), „Informácie v scéne“ (Zamknutý zápis, Admin), „Bezpečnosť a limity“.

## Scope
- `app/main.py`, `tests/test_api_admin.py`
- `static/index.html`, `tests/js/logic.test.mjs`
- `README.md`, `tests/manual.md` (the admin items)

## Acceptance criteria
- [ ] Admin endpoints need the admin cookie (`403 forbidden` otherwise), count toward the write limit, and run through the store transaction (version, backup, audit with source `admin`):
  - [ ] `DELETE /api/parties/{id}` deletes the party and frees all its slots; an unknown ID returns `404 unknown_party`
  - [ ] `POST /api/admin/signup {open}` sets `signup_open`
  - [ ] `GET /api/admin/export` downloads the current `cabin-data.yaml` as an attachment
- [ ] Signup lock: with `signup_open: false`, assign, assign-stay, clear, move, create party and edit party return `403 signup_closed`; the same requests with the admin cookie succeed (skip if T-004 already did this, but check the tests exist).
- [ ] Page:
  - [ ] when `signup_open` is false, the sign „Zápis je zatvorený“ is drawn in `map.scene.locked` (Q11), and for non-admins the bed sheet shows occupancy only, with no write buttons, and the party form explains why it cannot be saved
  - [ ] the key icon in `map.scene.key`, shown only with the admin role (Q6), with `role="button"`, `tabindex="0"`, a Slovak `aria-label` and a 44-unit hit area, opens a panel with „Zamknúť zápis“ / „Otvoriť zápis“, „Stiahnuť dáta“ and „Zmazať partiu“ (choose, confirm, delete)
  - [ ] a `forbidden` response hides the key icon and the panel
  - [ ] all texts are Slovak via the `errorText` table; no `innerHTML`
- [ ] README explains locking signup with the admin code. `tests/manual.md` gets: the admin code works, the „Zápis je zatvorený“ sign appears when signup is locked.

## Notes for developer
- Open decision „Uzávierka zápisu“: default is manual only, through `/api/admin/signup`. No automatic deadline.
- Palette reuse after a delete: the freed color is the first unused one again (see T-004).

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
