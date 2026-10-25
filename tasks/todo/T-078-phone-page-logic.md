# T-078: Page logic and Slovak error texts for the phone login

- **Phase:** 1
- **Depends on:** T-073
- **Size:** M

## Goal
Pure, Node-tested logic for the login panel and the phone section, plus Slovak messages for the new codes: proposal "Prihlásenie telefónom (SMS)" › "Stránka" (last bullet).

## Scope
- New `static/js/logic-phone.js` (listed in `static/index.html` among the logic scripts with `?v=__ASSET_VERSION__`), `static/js/logic-errors.js`
- Tests in `tests/js/logic.test.mjs`

## Acceptance criteria
- [ ] `isProtected(party)` (has `phone_hint`), `needsLogin(party, verifiedIds)`, `canEditParty(party, verifiedIds, isAdmin)`.
- [ ] `phoneHintText(party)` → `"…456"`; a light client-side phone check/format for display that accepts the same inputs as the server examples in T-073 (the server still decides).
- [ ] Login panel state as a pure reducer: steps `phone` → `code` → `done`, busy flag, error code kept from the server, code input accepts exactly 6 digits.
- [ ] `resendSecondsLeft(sentAt, now)` counts down from 60 to 0; „Poslať znova“ allowed at 0.
- [ ] `logic-errors.js` maps `login_required` (with `party_name`) to „Ivan a Eva si chránia zápis telefónom. Zmeniť ho môžu iba oni.“ (name from params), and gives informal Slovak texts with „ “ quotes for `phone_mismatch`, `bad_sms_code`, `sms_unavailable`, `rate_limited` with `retry_after`, and `invalid` with `field: phone`.
- [ ] Node tests for every function and each new error code; `node --test tests/js/` passes.

## Notes for developer
- No DOM in `logic-*.js`; the test loads logic scripts from the `<script>` tags in `index.html`.
- Phone never comes from the server; only `phone_hint`.

---
## Dev log

## Review round 1

## Review round 2

## Test report
