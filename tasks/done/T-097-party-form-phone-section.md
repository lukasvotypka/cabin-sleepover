# T-097: Party form „Telefón“ section and `login_required` on the map

- **Phase:** 1
- **Depends on:** T-094, T-096
- **Size:** M

## Goal
Add, change and remove the number from the party form, and do not offer actions on other protected parties: proposal "Prihlásenie telefónom (SMS)" › "Stránka" (bullets 3 and 4) and "Telefónne číslo" (offer after create).

## Scope
- `static/js/app-form.js`, `static/js/app-sheet.js` / `app-actions.js`, `static/index.html` (markup/CSS)

## Acceptance criteria
- [x] With `sms_enabled` the form shows „Telefón“: without number „Pridať telefón (na prihlásenie)“; with number „Telefón končí na …456“ plus „Zmeniť“ and „Odstrániť“. Without `sms_enabled` the section is absent.
- [x] Add/change runs `phone/start` → code field (same widget and texts as the login panel) → `phone/verify`; „Odstrániť“ asks for confirmation and calls `DELETE …/phone`. State and session refresh after each.
- [x] Right after creating a party the page offers adding a phone (skippable).
- [x] The form, bed sheet and move actions are not offered for a protected party this device has not verified (unless admin); its beds still open read-only info.
- [x] A `login_required` response rolls back the optimistic change and shows „<name> si chránia zápis telefónom. Zmeniť ho môžu iba oni.“ via `textContent`.
- [x] Node source checks for the new section (labels present, no `innerHTML` with human text); `node --test tests/js/` and `uv run pytest` pass; manual check with `SMS_FAKE=1` noted in the Dev log.

## Notes for developer
- Added by the orchestrator after the T-096 review: no task had a logout. In the „Telefón“ section of a verified protected party add „Odhlásiť toto zariadenie“ → `POST /api/logout {party_id}`, then `loadSession()` (from `app-login.js`) and clear *moja partia* if it was this one. Also call `loadSession()` after phone add/change/remove. Add a Node or source test for it.
- Reuse `logic-phone.js` (T-095); keep pure parts there.

---
## Dev log
- `logic-phone.js`: `phoneSectionInfo`, `PHONE_TEXTS`. `app-login.js`: `openLogin(party, {phone: "add"|"change", after, back})` reuses the login widget for `phone/start` + `phone/verify`. `app-form.js`: guard (protected unverified party is not opened, toast with the login_required text), `phoneSection` (add / change / remove with confirm / „Odhlásiť toto zariadenie“ -> `POST /api/logout`, `loadSession()`, `forgetMyParty()` if it was mine), `showPhoneOffer` after creating a party. `app-sheet.js`: other protected unverified party's slot shows the login_required note instead of Uvoľniť. `index.html`: small CSS. `login_required` rollback + toast already goes through `runWrite`/`errorText` (T-096). Signup closed: the form disables the phone buttons like all others (read-only); admin bypasses the guards.
- Tests: `tests/js/logic.test.mjs` (two new tests). `node --test tests/js/` 349 pass; `uv run pytest -q` 728 pass.
- Manual (SMS_FAKE=1, code 123456 in the server log, not run by me): create party -> offer „Pridať telefón“ -> number -> code -> form shows „Telefón končí na …456“; „Zmeniť“; „Odstrániť“ asks first; „Odhlásiť toto zariadenie“ drops *moja partia*; second device sees a lock, other party's bed sheet shows no Uvoľniť; with signup closed the form is read-only.

## Review round 1
Checked the T-097 diff only (`app-form.js`, `app-login.js`, `app-sheet.js`, `logic-phone.js`, `index.html` CSS, `tests/js/logic.test.mjs`). Ran it myself: `node --test tests/js/` 349 pass, `uv run pytest -q` 728 pass. Every `static/js/*.js` is listed in `index.html` with `?v=__ASSET_VERSION__` (no new scripts).

All acceptance criteria are met. The section is hidden without `sms_enabled` (`phoneSectionInfo` returns `visible: false`). Add and change reuse the login widget through `apiPath = "phone"`, and „Odstrániť“ asks first, then calls `DELETE …/phone` through `write`, which applies the state. `loadSession()` runs after add, change, remove and logout. The phone offer after create can be skipped. The form guard and the bed sheet guard both use `canEditParty` with an admin bypass. „Presunúť“ appears only for *moja partia*, so it is covered by the sheet guard and by `checkStoredLogin`. A `login_required` rejection still goes through `runWrite`/`errorText`. All text goes in via `textContent`, and the new strings are informal Slovak with „ “. The server's `check_access` matches the client gating.

No blockers.

- **Suggestion:** „Pridať telefón“, „Zmeniť“ and „Odstrániť“ in the form call `closePanel()`, and the form reopens from fresh state, so unsaved edits to the other fields are lost without warning. Either warn when the form is dirty or show the section only when nothing is changed.
- **Suggestion:** when signup is closed, „Odhlásiť toto zariadenie“ is disabled along with the other form buttons. Logout is not a write to the data, so it could stay enabled.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2

## Test report

Tester (round 1), checked against the working tree (uncommitted T-097 diff, HEAD 863cb74).

**Commands and results**
- `uv run pytest -q` → 728 passed (from `/opt/homebrew/bin/uv`; plain `uv` is not on the shell PATH).
- `node --test tests/js/` → 349 pass, 0 fail (includes the two T-097 source tests).
- Temp server: `GROUP_CODE=grp-test-97 ADMIN_CODE=adm-test-97 SECRET_KEY=… SMS_FAKE=1`, data in `/tmp/t097/data`, port 8031 (port 8021 was already used by another process, not touched; ports 8000/8010 not used). Stopped after the test.
- Headless Google Chrome via `playwright-core` (temp dir `/tmp/t097/browser`, `flows.mjs`), viewport 380×760, mobile + touch, two contexts: device A (creator, verified) and device B (group code only). Final run: all checks PASS, no page errors.
- httpx probes (`/tmp/t097/probe.py`) against the same server.

**Acceptance criteria**

| # | Criterion | Result |
| --- | --- | --- |
| 1 | „Telefón“ section: without number „Pridať telefón (na prihlásenie)“; with number „Telefón končí na …222“ + „Zmeniť“, „Odstrániť“; absent without `sms_enabled` | PASS (browser; absence without `sms_enabled` covered by the `phoneSectionInfo` Node test, not run in a browser) |
| 2 | Add/change: `phone/start` → code → `phone/verify`; „Odstrániť“ asks, calls `DELETE …/phone`; state and session refresh | PASS (browser: add 222, change to 444, remove after confirm; the form reopens with fresh data) |
| 3 | Offer to add a phone right after create, skippable | PASS (browser: offer shown after create; „Teraz nie“ is in code, not clicked) |
| 4 | Form, bed sheet and move not offered for an unverified protected party (unless admin) | PASS for the sheet (device B and device A after logout: no „Uvoľniť“, login_required sentence shown). Admin bypass: PASS at API level (admin `clear` 200). The form guard is code-reviewed only (the form is reachable only via „Upraviť“ for *moja partia*, which an unverified device cannot select). |
| 5 | `login_required` rolls back and shows „<name> si chránia zápis telefónom. Zmeniť ho môžu iba oni.“ | PARTIAL: the server returns 403 `login_required` for clear, move, phone start, phone delete on an unverified device (PASS). The UI rollback itself was not reproduced in the browser (it needs a stale verified session); it goes through the T-096 `runWrite`/`errorText` path. |
| 6 | Node source checks; `node --test` and `uv run pytest` pass; manual check with `SMS_FAKE=1` noted | PASS (checks and both suites pass; the manual SMS run was done here with the headless browser, see above) |

**Extra scenarios**
- 380 px: buttons 47 px tall (≥ 44), `scrollWidth` 380, no horizontal overflow in the form.
- Remove asks first; the „Naozaj odstrániť…“ text is shown before any DELETE.
- Logout („Odhlásiť toto zariadenie“): toast „Toto zariadenie je odhlásené.“, the button disappears, the party's bed sheet on that device loses „Uvoľniť“.
- Unverified device B on a protected party: `clear`, `move`, `phone/start`, `DELETE phone` → 403 `login_required`; anonymous `/api/state` and `/api/logout` → 401 `bad_code`.
- Observations (not T-097 blockers):
  - `POST /api/logout` with an unknown `party_id` returns 200 `ok` (not `unknown_party` 404). Harmless, but worth a look.
  - One run (out of about 8) saved the party name as „Test Beta2“ although the script typed „Test Beta“; the DOM value was already wrong before the save. Not reproduced in 3 isolated attempts. Watch for it in manual testing (name field after a previous remove/Escape).
  - `PUT /api/parties/{id}` with a partial body returned 422 (not a login check), so the guard for PUT was not exercised.

**Bugs found:** none confirmed. No code changed by the tester. Added nothing to `tests/`.

**Manual:** added the T-097 item to `tests/manual.md` section 9 (phone section, logout, offer, 44 px and layout on real phones). The T-098 items already cover add, change and remove on a second device.

Verdict: all criteria pass (5 partly by server check, see above). No regressions in `tasks/done/` (full pytest suite green).
