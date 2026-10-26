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
- [x] `isProtected`, `needsLogin`, `canEditParty` take the verify flag (`state.phone_verify`) as an extra last argument; only an explicit `false` turns protection off, so `undefined` keeps today's behaviour.
- [x] `phoneSectionInfo(party, smsEnabled, verifiedIds, verifyOn)`: with `verifyOn === false` it is visible even without `sms_enabled`, reports a contact mode (e.g. `mode: "contact"`), `canLogout: false`, text with the hint when a number exists; with verification on the result is unchanged.
- [x] `phoneVerifyToggleLabel(on)` next to `signupToggleLabel`: „Vypnúť overovanie cez SMS“ when on or missing, „Zapnúť overovanie cez SMS“ when `false`.
- [x] Slovak contact-mode texts in `PHONE_TEXTS` (tykanie, „ “ quotes): the number serves the organizer as a contact and no SMS is sent; a remove question without the "anyone can change it" protection sentence.
- [x] Node tests: the three functions with `false`, `true` and `undefined`; `phoneSectionInfo` contact mode with and without `sms_enabled` and with and without a number; both labels. `node --test tests/js/` passes.

## Notes for developer
- No DOM in `logic-*.js`. No new script file, so `index.html` stays unchanged.
- Existing callers keep working until T-103 passes the flag.

---
## Dev log
Added the `verifyOn` last argument to `isProtected`/`needsLogin`/`canEditParty`, contact mode (`mode: "contact"`) in `phoneSectionInfo` (plus `mode: "verify"` otherwise), contact texts in `PHONE_TEXTS`, `phoneVerifyToggleLabel`. Files: `static/js/logic-phone.js`, `static/js/logic-errors.js`, `tests/js/logic.test.mjs`. Run: `node --test tests/js/` -> 352 pass. Callers unchanged (T-103 passes the flag).

## Review round 1
Checked the diff of `static/js/logic-phone.js`, `static/js/logic-errors.js` and `tests/js/logic.test.mjs` against the proposal section "Vypínateľné overovanie". `node --test tests/js/`: 352 pass. `uv run pytest -q`: 739 pass (this includes the in-progress T-101 changes). No new script, so `index.html` is unchanged, and every `static/js/*.js` is listed with `?v=__ASSET_VERSION__`.

- All acceptance criteria are met. Only an explicit `false` disables protection. Contact mode is visible without `sms_enabled`, with `canLogout: false` and hint text. Verify mode is unchanged, apart from the additive `mode: "verify"`. The toggle labels match the proposal. The contact texts use tykanie and do not include the "každý" sentence. Existing callers keep their behaviour, because `undefined` keeps protection on.

**Suggestion**
- `logic-phone.js` `phoneSectionInfo`: the `phone_hint` presence check now duplicates the body of `isProtected`. A small `hasPhoneHint(party)` helper used by both would keep one definition.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

## Test report (tester)

Commands (Node and uv are not on the default PATH in the agent shell; prefix `PATH=/Users/luigi/.nvm/versions/node/v24.1.0/bin:/opt/homebrew/bin:$PATH`):
- `node --test tests/js/` -> 352 pass, 0 fail.
- `uv run pytest -q` -> 739 passed (includes the in-review T-101 changes, not part of this task's scope).
- Independent check `node /tmp/t102-check/check.mjs <repo>` (loads `logic-errors.js` + `logic-phone.js` via `vm`, outside the repo) -> 26 probes, 0 fail.

| # | Criterion | Result |
| --- | --- | --- |
| 1 | `isProtected`, `needsLogin`, `canEditParty` take `verifyOn` as last arg; only explicit `false` disables; `undefined` keeps protection | PASS |
| 2 | `phoneSectionInfo(party, smsEnabled, verifiedIds, verifyOn)`: `false` gives visible contact mode without `sms_enabled`, `canLogout: false`, hint text when a number exists; verify mode unchanged | PASS |
| 3 | `phoneVerifyToggleLabel(on)`: „Vypnúť…“ when true/missing, „Zapnúť…“ when `false` | PASS |
| 4 | Slovak contact texts in `PHONE_TEXTS` (tykanie, no SMS sent, remove question without the „každý“ sentence) | PASS |
| 5 | Node tests cover the three functions with false/true/undefined, contact mode with and without sms/number, both labels; suite passes | PASS |

Extra probes: `null` as the flag keeps protection on (only `false` disables); admin bypasses protection with `verifyOn` false and true; verified device sees no logout in contact mode; missing party gives `visible: false`; signup label unchanged; `index.html` unchanged by this task.

Manual checks: none needed for this task (pure logic). The visible result (section and toggle text on the phone) belongs to T-103 and `tests/manual.md`.

Failures: none.

Verdict: PASS, moved to `tasks/done/`.
