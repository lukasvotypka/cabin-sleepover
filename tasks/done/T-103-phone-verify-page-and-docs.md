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
- [x] Admin panel: button `data-key="admin-phone-verify"` labelled by `phoneVerifyToggleLabel(app.state.phone_verify)`; a tap sends `POST api/admin/phone-verify {on: !current}`, re-renders from the returned state; errors via `errorText` (`503` shows the `sms_unavailable` text).
- [x] Every call of `isProtected`/`needsLogin`/`canEditParty`/`phoneSectionInfo` in `app-*.js` passes `app.state.phone_verify` (grep shows none without it).
- [x] Verification off: „Kto si?“ shows no lock and picks a party with a phone directly; the load-time login panel (`loginPending`) does not open; the bed sheet offers the normal actions for such a party.
- [x] Verification off, form of an existing party: „Telefón“ section visible even without `sms_enabled`, a number input (`type="tel"`, `autocomplete="tel"`), save → `PUT api/parties/{id}/phone`, „Odstrániť“ → `DELETE`, contact text from `PHONE_TEXTS`; no SMS step, no „Odhlásiť“, no SMS offer after creating a party.
- [x] Verification on: behaviour as before (no change in what is shown).
- [x] A live `state` with a changed `phone_verify` is used by the next render of the map, sheet and panels (no reload needed).
- [x] Party names and hints only via `textContent`.
- [x] README: a short paragraph on the switch (`phone_verify` in data and state, the admin endpoint, contact mode, privacy unchanged). `tests/manual.md`: two-device items for off (no locks, number saved without SMS, other phone sees it live), on (that party now asks for login), and on without Twilio (SMS error shown).
- [x] `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- `errorRole` treats `403 forbidden` as a lost admin cookie. Call `PUT …/phone` only while `phone_verify` is false; see Q27 for the race default.
- Defaults in `tasks/QUESTIONS.md` Q27 (button always shown, contact field only in the edit form, login panel only on the next load).

---
## Dev log
Admin button `admin-phone-verify` (app-admin.js); all `isProtected`/`needsLogin`/`canEditParty`/`phoneSectionInfo` calls pass `phone_verify` (app-form, app-login, app-sheet; „Kto si?“ lock and `checkStoredLogin` use it, so contact mode shows no lock and no load-time login); contact number section `contactPhone` in app-form.js (PUT/DELETE, no SMS, no SMS offer after create); README paragraph, manual.md section 10; tests updated and one added in tests/js/logic.test.mjs. Live state is read from `app.state` at each render. Not tested in a browser (two-device items are in manual.md).
Commands: `node --test tests/js/` (pass), `uv run pytest` (739 passed).

## Review round 1

Checked the diff of app-admin/app-form/app-login/app-sheet, README and manual.md, the phoneSectionInfo contract in logic-phone.js, and that every script in static/js/ is in index.html with `?v=__ASSET_VERSION__`. Ran `node --test tests/js/` (353 pass) and `uv run pytest` (739 passed).

All acceptance criteria are met. The admin button sends `{on: phone_verify === false}` and shows errors through `errorText`, so a 503 gets the `sms_unavailable` text. A grep finds no `isProtected`/`needsLogin`/`canEditParty`/`phoneSectionInfo` call without `phone_verify`. `checkStoredLogin` uses the flag, so `loginPending` is never set while verification is off. Contact mode PUTs and DELETEs with no SMS step, no logout and no offer after create. Verify mode is unchanged. All text goes in via `htmlEl`, which uses `textContent`.

**Blockers:** none.

**Suggestions:**
- app-form.js `contactPhone`: the tel input sits inside the party `<form>`, so pressing Enter in it submits the whole party form, and the typed number is not saved. Consider handling Enter with a keydown that calls the save button.
- app-form.js `contactPhone`, remove confirm: the „Naozaj odstrániť…“ question is added to `box` after `row`, so it shows below the Áno/Nie buttons, and the input stays visible. Put the question before the row, or hide the input.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester: T-103 (haiku). Result: **FAIL**, one bug (Enter in the contact number field). Everything else in the criteria passes.

**Commands run**
- `export PATH=/opt/homebrew/bin:$PATH; node --test tests/js/` → 353 pass, 0 fail.
- `uv run pytest -q` → 739 passed.
- Temp servers (own temp `data/`, `GROUP_CODE`/`ADMIN_CODE`/`SECRET_KEY` test values): port 8767 with `SMS_FAKE=1` (main run), port 8768 without any SMS variable (for `sms_unavailable`). Ports 8000, 8010 (trial) and 8765 (another session) were not touched.
- Headless Chromium (Playwright 1.49.1, cached `chromium-1234`) at 380×760, mobile emulation, scripts in `/tmp/t103-pw/`.
- Code checks: `grep` for `isProtected|needsLogin|canEditParty|phoneSectionInfo` calls → every call passes `phone_verify`. `tests/manual.md` section 10 and the README paragraph are present.

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| Admin button `admin-phone-verify`, label toggles, POST `{on}` and re-render | PASS | Label „Vypnúť…“ ↔ „Zapnúť…“, state `phone_verify` flips true/false (API). |
| `phone_verify` passed to all helper calls | PASS | grep, no call without it. |
| Off: „Kto si?“ no lock, direct pick, no login panel | PASS | Off: 0 `.lock` in panel; pick Telefonna → HUD „Telefonna“, no „Prihlás sa“. |
| Off, edit form: Telefón section, `tel` input, save/remove, contact text, no SMS | PASS | Save → `phone_hint` 666 (PUT). Odstrániť → Áno → hint gone, toast „Telefón je odstránený.“ (DELETE). Nie keeps the form. No „Odhlásiť“. |
| On: unchanged | PASS | On: Telefonna shows 🔒, pick → „Prihlás sa“ panel (phone + „Poslať kód“). Edit form has no contact input. |
| Live state used without reload | PASS | Device D with „Kto si?“ open: after switching ON the lock appeared (1) without reload. Switching OFF removed it. |
| `textContent` only | PASS (by code) | `htmlEl`/`textContent` in the new code; no `innerHTML` added. |
| README and manual.md | PASS | Present. |
| `node --test` and `uv run pytest` pass | PASS | 353 and 739. |
| 503 without Twilio shows Slovak text | PASS | Port 8768: switch ON → 503 `sms_unavailable`, page text „SMS sa teraz nedá poslať. Skús to o chvíľu, alebo napíš organizátorovi.“, button stays „Zapnúť…“. |
| Enter in contact number saves the number | **FAIL** | See bug 1. |

**Bug 1 (blocks the task): Enter in the contact number field does not save the number**
- Steps (380 px): switch verification OFF in admin. Group device: „Kto si?“ → Telefonna → „Si“ crest → „Upraviť“. In „Telefón“ type `0908 777 888` into the number field, press Enter.
- Expected: the number is saved (`PUT api/parties/{id}/phone`), `phone_hint` = 888, or the field is saved and nothing else is submitted.
- Actual: the browser's implicit form submission fires the party form's submit button („Uložiť“), so a `PUT api/parties/{id}` runs (state version +1) and the form closes. The phone number is not saved: `phone_hint` stays absent (reproduced twice, the second time on an empty number: version 11 → 13, hint absent). Cause: the contact `<input>` sits inside the party `<form>` and has no Enter handling (`contactPhone` in `static/js/app-form.js`).
- Fix suggestion: stop Enter in the contact input (keydown Enter → `preventDefault()` and click the „Zmeniť/Uložiť číslo“ button), or render the contact section outside the party `<form>`.

**Minor observation (not a criterion, reviewer's suggestion 2 still open):** after „Odstrániť“, the „Naozaj odstrániť telefón?“ question is appended after the Áno/Nie row, below it, and the number input and the hint stay visible. Screenshot in `/tmp/t103-pw/remove-ask.png`.

**Extra scenarios tried**
- Admin toggle off → on → off, state read via `GET /api/state` after each step (version bumps 15→16→17→19).
- Save via button, remove with confirmation, save again after remove (phone_hint 666).
- Verify off, group device C: party with a number is not locked; ON after save: device E sees 🔒 and login panel.
- Server without Twilio/SMS: `POST /api/admin/phone-verify {on:true}` → 503 `sms_unavailable`; state unchanged.
- Admin error paths and two-device live update covered above. Not done: concurrent writes to the phone, iPhone Safari, Android Chrome, real Twilio (manual items in `tests/manual.md` section 10).

**Not testable here:** real Twilio SMS, iPhone/Android behaviour, the two-device checks in `tests/manual.md`.

**Decision:** bug 1 is a failure, so the task goes back to `tasks/in-progress/`.

## Dev log (fix after test report)
- Bug 1 fixed: keydown Enter in the contact number input calls `preventDefault()` and clicks the save button (app-form.js `contactPhone`), so the party form is not submitted.
- Layout note fixed: on „Odstrániť“ the confirm question is inserted before the Áno/Nie row and the number input is hidden.
- Files: static/js/app-form.js. `node --test tests/js/` passes. Not re-run in a browser.

## Review re-check
Scope: the fix in `static/js/app-form.js` `contactPhone` after the test report. Ran `node --test tests/js/` (353 pass, 0 fail) and `uv run pytest -q` (739 passed).

- Bug 1 is fixed. A keydown listener on the contact input checks for `Enter`, calls `preventDefault()` (which stops the browser from submitting the surrounding party form) and runs `save.click()`, so the `PUT …/phone` runs.
- The layout note is fixed. On „Odstrániť“ the question is inserted before the Áno/Nie row with `insertBefore`, and the input is hidden.
- The fix adds no new text from people and no `innerHTML`.

**Blockers:** none.

Verdict: APPROVED

## Test report (round 2, after fix)

Tester: T-103 (haiku). Result: **PASS**. Moved to `tasks/done/`.

**Commands run**
- `export PATH=/opt/homebrew/bin:$PATH; node --test tests/js/` → 353 pass, 0 fail.
- `uv run pytest -q` → 739 passed.
- Own temp server on 127.0.0.1:8767 with temp `data/` (`/tmp/t103-test/data`), `SMS_FAKE=1`, test secrets. Stopped after the run. Ports 8000 and 8010 not touched.
- Headless Chromium 380 px, scripts in `/tmp/t103-pw/` (`s17.mjs` setup, `s18.mjs` the checks).

**Fix checks**

| Criterion | Result | Evidence |
| --- | --- | --- |
| Enter in the contact number saves the number | PASS | Enter after `0908 777 888` sends only `PUT /api/parties/{id}/phone` (no `PUT /api/parties/{id}`), URL unchanged, `phone_hint` = 888, form stays open. |
| Remove confirm layout | PASS | After „Odstrániť“: label, hint, number input `[hidden]`, error `[hidden]`, „Naozaj odstrániť telefón?“ note, then the Áno/Nie row. Input not visible while asking. Screenshot `/tmp/t103-pw/s18-remove-ask.png` shows the question above the buttons. |
| Nie keeps the number | PASS | `phone_hint` 888 kept, input visible again. |
| Áno removes the number | PASS | `DELETE /api/parties/{id}/phone`, `phone_hint` gone. |
| Other criteria from round 1 | PASS (unchanged code, not re-run) | Round 1 browser run covered them; the fix touches only `contactPhone` in `app-form.js`. Admin switch, off/on behaviour and 503 text were checked in the round-1 test run. |

**Extra scenarios**
- Enter on an empty contact field: sends `PUT .../phone`, server answers invalid, page shows „Telefónne číslo nesedí. …“, the stored number stays (888). No party-form PUT. Not a criterion; it is the expected path through the save button.
- Verify off, party without phone: picking it in „Kto si?“ shows no login panel.
- No page errors (`pageerror`) on either device.

**Not testable here:** iPhone Safari and Android Chrome Enter key behaviour (the Return key on mobile keyboards sends the same keydown, but this is for a real device); the two-device items in `tests/manual.md` section 10.
