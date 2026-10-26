# T-095: Page logic and Slovak error texts for the phone login

- **Phase:** 1
- **Depends on:** T-090
- **Size:** M

## Goal
Pure, Node-tested logic for the login panel and the phone section, plus Slovak messages for the new codes: proposal "Prihlásenie telefónom (SMS)" › "Stránka" (last bullet).

## Scope
- New `static/js/logic-phone.js` (listed in `static/index.html` among the logic scripts with `?v=__ASSET_VERSION__`), `static/js/logic-errors.js`
- Tests in `tests/js/logic.test.mjs`

## Acceptance criteria
- [x] `isProtected(party)` (has `phone_hint`), `needsLogin(party, verifiedIds)`, `canEditParty(party, verifiedIds, isAdmin)`.
- [x] `phoneHintText(party)` → `"…456"`; a light client-side phone check/format for display that accepts the same inputs as the server examples in T-090 (the server still decides).
- [x] Login panel state as a pure reducer: steps `phone` → `code` → `done`, busy flag, error code kept from the server, code input accepts exactly 6 digits.
- [x] `resendSecondsLeft(sentAt, now)` counts down from 60 to 0; „Poslať znova“ allowed at 0.
- [x] `logic-errors.js` maps `login_required` (with `party_name`) to „Ivan a Eva si chránia zápis telefónom. Zmeniť ho môžu iba oni.“ (name from params), and gives informal Slovak texts with „ “ quotes for `phone_mismatch`, `bad_sms_code`, `sms_unavailable`, `rate_limited` with `retry_after`, and `invalid` with `field: phone`.
- [x] Node tests for every function and each new error code; `node --test tests/js/` passes.

## Notes for developer
- No DOM in `logic-*.js`; the test loads logic scripts from the `<script>` tags in `index.html`.
- Phone never comes from the server; only `phone_hint`.

---
## Dev log
- Added `static/js/logic-phone.js` (listed after `logic-form.js` in `static/index.html`): `isProtected`, `needsLogin`, `canEditParty`, `phoneHintText`, `normalizePhoneInput`/`formatPhoneDisplay`, `loginInitial`/`loginReduce` (+ `canSendLoginCode`, `canVerifyLoginCode`), `cleanLoginCode`/`isLoginCode`, `resendSecondsLeft`/`canResend`.
- `static/js/logic-errors.js`: `login_required`, `phone_mismatch`, `bad_sms_code`, `sms_unavailable`, `invalid` with `field: phone`; `phone` added to field names. `rate_limited` with `retry_after` already existed (tested).
- Tests: 6 new in `tests/js/logic.test.mjs`. Run: `node --test tests/js/` -> 339 pass; `uv run pytest -q` passes.
- `verifiedIds` is the `verified` array of `GET /api/session`.

## Review round 1

Tests run by reviewer: `node --test tests/js/` 339 pass, `uv run pytest -q` 672 pass. `logic-phone.js` is listed in `index.html` with `?v=__ASSET_VERSION__`. It has no DOM code and matches the server's `normalize_phone`. The reducer, countdown and access helpers are correct and tested.

**Blocker**
1. `static/js/logic-errors.js:87` and `:90`: two UI strings use the word „partia“, which the proposal forbids (Jazyky, organizer's decision of 24. 10. 2026: „UI nikdy nepoužíva slovo „partia““).
   - `login_required` without a name shows „Táto partia si chráni zápis telefónom…“. This happens whenever `params` has no `party_name` and the party is not in `state`, for example after it was deleted.
   - `phone_mismatch` always shows „…s číslom tejto partie…“, so every user who mistypes their number sees the word.
   - Fix: reword both without the word. For example, the fallback could be „Tento zápis je chránený telefónom. Zmeniť ho môže iba ten, kto overil číslo.“ and `phone_mismatch` could be „Toto číslo nesedí s uloženým číslom. Skús to znova.“
   - Add a test that both texts (fallback and mismatch) do not match `/parti/i`.

**Suggestion**
- `logic-errors.js:99`, `invalid` with `field: phone`: „Napíš ho aj s predvoľbou, napríklad „0905 123 456““ is contradictory, because `0905` is not a country prefix. Something like „Napíš ho napríklad ako „0905 123 456“ alebo „+421 905 123 456“.“ reads better.
- `FIELD_NAMES.phone` is never reached, because the `field: phone` branch returns earlier. It is harmless, so keep it or drop it.

Verdict: CHANGES REQUESTED

## Review round 2

Tests run by reviewer: `node --test tests/js/` 339 pass, 0 fail (no backend change in the fix, pytest not re-run).

- Round-1 blocker fixed: the `login_required` fallback and `phone_mismatch` texts no longer use „partia“ (`static/js/logic-errors.js:85-92`). `tests/js/logic.test.mjs:4038-4039` asserts both do not match `/parti/i`. No other „parti“ left in `logic-errors.js` or `logic-phone.js`.
- Suggestion taken: the `invalid` + `field: phone` text now gives both example formats.
- No new issues in the fix diff.

Verdict: APPROVED

## Test report

## Dev log (round 1 fixes)
- Blocker fixed: `login_required` fallback is now „Tento zápis je chránený telefónom. Zmeniť ho môže iba ten, kto overil číslo.“; `phone_mismatch` is „Toto číslo nesedí s uloženým číslom. Skús to znova.“ Test added that both do not match `/parti/i`.
- Suggestion taken: `invalid` + `field: phone` text reworded to „Napíš ho napríklad ako „0905 123 456“ alebo „+421 905 123 456“.“ `FIELD_NAMES.phone` kept (harmless).
- `node --test tests/js/`: all pass (see count below).
- Result: 339 pass, 0 fail (node at ~/.nvm/versions/node/v24.1.0/bin/node, not on PATH in this shell).

## Test report (tester, T-095)

Commands (Node is not on the shell PATH, so it is put on PATH first: `export PATH="$HOME/.nvm/versions/node/v24.1.0/bin:$PATH"`):
- `node --test tests/js/` → 339 pass, 0 fail.
- `uv run pytest -q` → 689 pass, 0 fail (with Node on PATH). Without Node on PATH, 3 tests in `tests/test_map_layout.py` fail with "Node is required"; this is environmental, not a code bug.
- Probe scripts (outside the repo, `/tmp/tester-probe/`): loaded every `logic-*.js` listed in `index.html` into a Node vm context and ran the new functions with edge inputs. The same phone inputs went through the server's `normalize_phone` (`uv run python -I`).

| Criterion | Result | Evidence |
| --- | --- | --- |
| `isProtected`, `needsLogin`, `canEditParty` | pass | `needsLogin` true only for protected and not verified; `canEditParty` true for admin and for unprotected or verified parties; `null` party → false |
| `phoneHintText` → `"…456"`, light phone check | pass | `phoneHintText({phone_hint:"456"})` = `…456`, no hint = `""`; `normalizePhoneInput` matches `normalize_phone` on all 14 probe inputs (`0905 123 456`, `0905-123-456`, `00421…`, `+421 905 123 456`, `0905.123(456)` → `+421905123456`; `""`, `abc`, `+12`, `0`, `00`, `+0421…`, 16 and 17 digits → null) |
| Login reducer phone → code → done, busy, error kept, 6 digits | pass | send ignored while busy; `sent` moves to code; `code` input cleans to 6 digits (`12ab34` → `1234`); verify blocked with fewer than 6 digits; `failed` keeps `{code, params}` (e.g. `rate_limited` + `retry_after`); `back` keeps phone; `verified` → done |
| `resendSecondsLeft` 60 → 0, „Poslať znova“ at 0 | pass | `(0,0)`=60, `(0,1000)`=59, `(0,59000)`=1, `(0,60000)`=0, `(0,90000)`=0; `canResend` requires step code, not busy and 0 seconds left |
| Slovak texts for new codes | pass | `login_required` with `party_name` → „Ivan a Eva si chránia zápis telefónom. Zmeniť ho môžu iba oni.“; fallback has no „partia“; `phone_mismatch`, `bad_sms_code`, `sms_unavailable` informal; `invalid` + `field: phone` gives the example with „ “ quotes; `rate_limited` shows the wait from `retry_after`. Texts contain no „parti“ |
| Node tests for every function and each code | pass | 6 new tests cover all functions above and each new code; `isVerifiedParty` is only used via `needsLogin` |

Other checks: `logic-phone.js` has no DOM or `document` use; it is listed in `index.html` after `logic-form.js` with `?v=__ASSET_VERSION__`; no `innerHTML` added. Manual checks are not needed for this task (pure logic); the phone login UI is not built yet, so `tests/manual.md` has no new items.

Extra scenarios: a reducer call with an invalid phone cannot send; a `sent` action with an out-of-order `at` (earlier than `sentAt`) gives 60 seconds (clamped, harmless); `+421 905 123 45` is accepted by both client and server (11 digits after `+`, matching the T-090 rule of 7–14 digits; a spec question, not a T-095 defect).

Result: all 5 criteria pass, no regressions in `tasks/done/` (full pytest green). Task moved to `tasks/done/`. Nothing committed.
