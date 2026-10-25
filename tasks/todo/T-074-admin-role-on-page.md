# T-074: Page: admin role, entering the admin code later

- **Phase:** 2 (split from T-009)
- **Depends on:** T-073
- **Size:** S

## Goal
The page must know when it is the organizer, and the organizer must be able to enter the admin code on a phone that already has the group cookie (today the code screen only shows without a cookie). Proposal section „Informácie v scéne“ (Admin).

## Scope
- `static/js/app-core.js`, `static/js/app-summary.js` (code screen), the „Kto si?“ / who panel file, `static/js/logic-errors.js`, a pure helper in a `logic-*.js`, `tests/js/logic.test.mjs`

## Acceptance criteria
- [ ] A small link „Mám admin kód“ at the bottom of the „Kto si?“ panel opens the existing code input (same `POST /api/join`); on success with role `admin` the role is stored (`KEYS.role`) and the panel shows „Si organizátor“; a group code there keeps the role `group`.
- [ ] A pure function `isAdmin(role)` (or equivalent) is the only place the page decides admin, tested in Node.
- [ ] Any `403 forbidden` response resets the stored role to `group` (the 12 h admin cookie expired) and calls one hook `onAdminLost()` that later tasks use to hide admin UI.
- [ ] `logic-errors.js` has Slovak texts for `forbidden` („Na toto treba admin kód.“) and `signup_closed` if missing.
- [ ] Remove the comment „Nothing uses it yet“ in `app-core.js`. No `innerHTML`. `node --test tests/js/` passes.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
