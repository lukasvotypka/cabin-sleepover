# T-080: Party form „Telefón“ section and `login_required` on the map

- **Phase:** 1
- **Depends on:** T-077, T-079
- **Size:** M

## Goal
Add, change and remove the number from the party form, and do not offer actions on other protected parties: proposal "Prihlásenie telefónom (SMS)" › "Stránka" (bullets 3 and 4) and "Telefónne číslo" (offer after create).

## Scope
- `static/js/app-form.js`, `static/js/app-sheet.js` / `app-actions.js`, `static/index.html` (markup/CSS)

## Acceptance criteria
- [ ] With `sms_enabled` the form shows „Telefón“: without number „Pridať telefón (na prihlásenie)“; with number „Telefón končí na …456“ plus „Zmeniť“ and „Odstrániť“. Without `sms_enabled` the section is absent.
- [ ] Add/change runs `phone/start` → code field (same widget and texts as the login panel) → `phone/verify`; „Odstrániť“ asks for confirmation and calls `DELETE …/phone`. State and session refresh after each.
- [ ] Right after creating a party the page offers adding a phone (skippable).
- [ ] The form, bed sheet and move actions are not offered for a protected party this device has not verified (unless admin); its beds still open read-only info.
- [ ] A `login_required` response rolls back the optimistic change and shows „<name> si chránia zápis telefónom. Zmeniť ho môžu iba oni.“ via `textContent`.
- [ ] Node source checks for the new section (labels present, no `innerHTML` with human text); `node --test tests/js/` and `uv run pytest` pass; manual check with `SMS_FAKE=1` noted in the Dev log.

## Notes for developer
- Reuse `logic-phone.js` (T-078); keep pure parts there.

---
## Dev log

## Review round 1

## Review round 2

## Test report
