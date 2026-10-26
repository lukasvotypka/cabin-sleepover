# T-074: Page: admin role, entering the admin code later

- **Phase:** 2 (split from T-009)
- **Depends on:** T-073
- **Size:** S

## Goal
The page must know when it is the organizer, and the organizer must be able to enter the admin code on a phone that already has the group cookie (today the code screen only shows without a cookie). Proposal section „Informácie v scéne“ (Admin).

## Scope
- `static/js/app-core.js`, `static/js/app-summary.js` (code screen), the „Kto si?“ / who panel file, `static/js/logic-errors.js`, a pure helper in a `logic-*.js`, `tests/js/logic.test.mjs`

## Acceptance criteria
- [x] A small link „Mám admin kód“ at the bottom of the „Kto si?“ panel opens the existing code input (same `POST /api/join`); on success with role `admin` the role is stored (`KEYS.role`) and the panel shows „Si organizátor“; a group code there keeps the role `group`.
- [x] A pure function `isAdmin(role)` (or equivalent) is the only place the page decides admin, tested in Node.
- [x] Any `403 forbidden` response resets the stored role to `group` (the 12 h admin cookie expired) and calls one hook `onAdminLost()` that later tasks use to hide admin UI.
- [x] `logic-errors.js` has Slovak texts for `forbidden` („Na toto treba admin kód.“) and `signup_closed` if missing.
- [x] Remove the comment „Nothing uses it yet“ in `app-core.js`. No `innerHTML`. `node --test tests/js/` passes.

---
## Dev log
Added `isAdmin(role)` and `roleAfterResponse(role, status, error)` (logic-errors.js); `forbidden` text now „Na toto treba admin kód.“ (`signup_closed` already existed). `request()` in app-core.js resets role to `group` on 403 `forbidden` via `setRole()`, which calls hook `onAdminLost()` (it calls `renderAdminUi()` if a later task defines it). „Kto si?“ panel (app-sheet.js) has „Mám admin kód“ (opens the code screen with `showCodeScreen(true)`, which shows a „Späť“ button) or „Si organizátor“; after a successful join the panel reopens. Removed the „Nothing uses it yet“ comment. Not verified in a real browser. Two existing source-regex tests updated for the new `showCodeScreen(voluntary)` signature.
Files: static/js/logic-errors.js, app-core.js, app-summary.js, app-sheet.js, static/index.html, tests/js/logic.test.mjs.
Tests: `node --test tests/js/` (336 pass), `uv run pytest -q` (631 pass).

## Review round 1
Tests run by reviewer: `node --test tests/js/` 336 pass; `uv run pytest -q` 631 pass (3 `test_map_layout` failures appeared only when `node` was not on PATH, they pass with it).

All acceptance criteria are met. `isAdmin()` is the only admin check (grep finds no other `"admin"` comparison). `roleAfterResponse()` runs in `request()` on every JSON response and resets the role only on 403 `forbidden`, not on `signup_closed`. `setRole()` calls `onAdminLost()` only on an admin to non-admin change. The join path uses `setRole()`. All text goes in via `textContent`, there is no `innerHTML`, the link button has a 44 px min-height, and the script list is unchanged.

**Blockers:** none.

**Suggestions**
- `static/js/app-summary.js` „Späť“ handler: focus is lost when the code screen closes. Move it back to the map or reopen „Kto si?“ (`app.askWho = true` + render) so keyboard and screen-reader users land somewhere sensible.
- `app-sheet.js` `fillAdminLine()` runs only when the panel is built. If `onAdminLost()` fires while „Kto si?“ is open, the panel keeps showing „Si organizátor“ until it is reopened. T-075/T-076 can fill this in through `renderAdminUi`.
- `isAdmin`/`roleAfterResponse` live in `logic-errors.js`. That works, but a later admin `logic-*.js` might be a better home.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
Tester (2026-10-25), branch feature/admin, uncommitted working tree.

Commands and results:
- `uv run pytest -q` → 631 passed (12 s).
- `node --test tests/js/` → 336 pass, 0 fail.
- Temp server on 127.0.0.1:8011, data in /tmp/t074/data (secrets are test values, server stopped afterwards). Probes with httpx (scripts in /tmp/t074, not in the repo):
  - `GET /` → 200, `codeBack` button present with `hidden`, `logic-errors.js?v=<hash>` ok.
  - `POST /api/join` group code → 200 `role: group`, only `cabin_group` cookie. Admin code → 200 `role: admin`, `cabin_group` + `cabin_admin` (12 h). Wrong code → 401 `bad_code`.
  - Admin endpoint with group cookie only (`/api/admin/signup`) → 403 `forbidden`. Without any cookie → 401 `bad_code`.
  - Admin closes signup → group `POST /api/assign` → 403 `signup_closed` (not `forbidden`, so `roleAfterResponse` keeps `admin`). Admin reopens → 200.
  - Every server error code (`bad_code`, `forbidden`, `signup_closed`, `slot_taken`, `not_present`, `duplicate_name`, `unknown_slot`, `unknown_party`, `invalid`, `rate_limited`) has an entry in `ERROR_TEXTS`.
- `innerHTML` is not used in the touched files (app-core.js, app-sheet.js, app-summary.js). The „Nothing uses it yet“ comment is gone.

Acceptance criteria:

| # | Criterion | Result |
| --- | --- | --- |
| 1 | „Mám admin kód“ link opens the code input; admin join stores role, panel shows „Si organizátor“; group keeps `group` | PASS for the API role/cookie side and the code path (`showCodeScreen(true)`, `setRole`). Panel text and link tap need a phone: see manual.md (T-074 item). |
| 2 | `isAdmin(role)` is the only admin check, tested in Node | PASS (`isAdmin` tests in logic.test.mjs; grep shows no other `"admin"` comparison). |
| 3 | 403 `forbidden` resets role to `group` and calls `onAdminLost()` | PASS for `roleAfterResponse` (Node) and the 403 response from the server. The `setRole` → `onAdminLost` call is checked by code reading only (fires on an admin→group change). |
| 4 | Slovak texts for `forbidden` and `signup_closed` | PASS („Na toto treba admin kód.“; `signup_closed` text present). |
| 5 | Comment removed, no `innerHTML`, `node --test` passes | PASS. |

Extra scenarios: wrong code, group vs admin cookie flags (HttpOnly, Secure, SameSite=Lax, Max-Age 2592000 / 43200), admin endpoint without cookie, admin endpoint with group cookie, `signup_closed` for group and admin, reopen after close.

Regressions: full pytest and Node suites pass (631 and 336), including tasks in `done/`.

Not verifiable here (no browser): the tap on „Mám admin kód“, the „Späť“ focus and the „Si organizátor“ line on a real phone. Added as a checklist item in `tests/manual.md` (section 8, before „Decisions“). No application code was changed.

Non-blocking observation (from review round 1, still open): the admin line is built only when the „Kto si?“ panel is opened, so an `onAdminLost()` while the panel is open keeps the old text until reopened. This does not break a criterion.

Verdict: PASS. Moved to done.
