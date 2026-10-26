# T-102: Page logic for the switch and contact mode

- **Phase:** 1
- **Depends on:** T-100
- **Size:** S

## Goal
Pure page logic for "protected only while verification is on", the contact-mode „Telefón“ section and the admin button label: proposal "Vypínateľné overovanie (prepínač v admin paneli)" and "Prihlásenie telefónom" › "Stránka" (logic in `logic-*.js`, tested in Node).

## Scope
- `static/js/logic-phone.js`, `static/js/logic-errors.js`
- `tests/js/logic.test.mjs`

## Acceptance criteria
- [ ] `isProtected`, `needsLogin`, `canEditParty` take the verify flag (`state.phone_verify`) as an extra last argument; only an explicit `false` turns protection off, so `undefined` keeps today's behaviour.
- [ ] `phoneSectionInfo(party, smsEnabled, verifiedIds, verifyOn)`: with `verifyOn === false` it is visible even without `sms_enabled`, reports a contact mode (e.g. `mode: "contact"`), `canLogout: false`, text with the hint when a number exists; with verification on the result is unchanged.
- [ ] `phoneVerifyToggleLabel(on)` next to `signupToggleLabel`: „Vypnúť overovanie cez SMS“ when on or missing, „Zapnúť overovanie cez SMS“ when `false`.
- [ ] Slovak contact-mode texts in `PHONE_TEXTS` (tykanie, „ “ quotes): the number serves the organizer as a contact and no SMS is sent; a remove question without the "anyone can change it" protection sentence.
- [ ] Node tests: the three functions with `false`, `true` and `undefined`; `phoneSectionInfo` contact mode with and without `sms_enabled` and with and without a number; both labels. `node --test tests/js/` passes.

## Notes for developer
- No DOM in `logic-*.js`. No new script file, so `index.html` stays unchanged.
- Existing callers keep working until T-103 passes the flag.

---
## Dev log

## Review round 1

## Review round 2

## Test report
