# T-103: Admin toggle, „Kto si?“ and form in contact mode, docs

- **Phase:** 1
- **Depends on:** T-101, T-102
- **Size:** M

## Goal
Wire the switch into the page: admin button, no lock and no login while verification is off, contact number field in the party form. Proposal "Vypínateľné overovanie (prepínač v admin paneli)".

## Scope
- `static/js/app-admin.js`, `app-login.js`, `app-sheet.js`, `app-form.js` (and `app-core.js` if the load-time login check lives there)
- `README.md` (section "Phone login (SMS)"), `tests/manual.md`

## Acceptance criteria
- [ ] Admin panel: button `data-key="admin-phone-verify"` labelled by `phoneVerifyToggleLabel(app.state.phone_verify)`; a tap sends `POST api/admin/phone-verify {on: !current}`, re-renders from the returned state; errors via `errorText` (`503` shows the `sms_unavailable` text).
- [ ] Every call of `isProtected`/`needsLogin`/`canEditParty`/`phoneSectionInfo` in `app-*.js` passes `app.state.phone_verify` (grep shows none without it).
- [ ] Verification off: „Kto si?“ shows no lock and picks a party with a phone directly; the load-time login panel (`loginPending`) does not open; the bed sheet offers the normal actions for such a party.
- [ ] Verification off, form of an existing party: „Telefón“ section visible even without `sms_enabled`, a number input (`type="tel"`, `autocomplete="tel"`), save → `PUT api/parties/{id}/phone`, „Odstrániť“ → `DELETE`, contact text from `PHONE_TEXTS`; no SMS step, no „Odhlásiť“, no SMS offer after creating a party.
- [ ] Verification on: behaviour as before (no change in what is shown).
- [ ] A live `state` with a changed `phone_verify` is used by the next render of the map, sheet and panels (no reload needed).
- [ ] Party names and hints only via `textContent`.
- [ ] README: a short paragraph on the switch (`phone_verify` in data and state, the admin endpoint, contact mode, privacy unchanged). `tests/manual.md`: two-device items for off (no locks, number saved without SMS, other phone sees it live), on (that party now asks for login), and on without Twilio (SMS error shown).
- [ ] `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- `errorRole` treats `403 forbidden` as a lost admin cookie. Call `PUT …/phone` only while `phone_verify` is false; see Q27 for the race default.
- Defaults in `tasks/QUESTIONS.md` Q27 (button always shown, contact field only in the edit form, login panel only on the next load).

---
## Dev log

## Review round 1

## Review round 2

## Test report
