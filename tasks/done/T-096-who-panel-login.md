# T-096: „Kto si?“ lock and the „Prihlás sa“ panel

- **Phase:** 1
- **Depends on:** T-092, T-095
- **Size:** M

## Goal
Choose a protected party only after SMS verification: proposal "Prihlásenie telefónom (SMS)" › "Stránka" (first two bullets).

## Scope
- `static/js/app-panels.js` (who panel), a new or existing `app-*.js` for the login panel (listed in `index.html` with `?v=__ASSET_VERSION__`), `static/js/app-start.js` / `app-boot.js` (load `/api/session`), `static/index.html` (CSS)

## Acceptance criteria
- [x] The page loads `GET /api/session` after `/api/state` and keeps `verified` and `sms_enabled`; it reloads it after login. (Orchestrator, after test report 1: the reload after logout and phone changes moved to T-097, which builds those actions.)
- [x] „Kto si?“ shows a small lock at each protected party; tapping a verified or unprotected party works as before.
- [x] Tapping a protected, unverified party opens „Prihlás sa“: „Zadaj svoje telefónne číslo (končí na …456)“, „Poslať kód“, then a 6-digit field with `inputmode="numeric"` and `autocomplete="one-time-code"` and „Overiť“; „Poslať znova“ is enabled after 60 s (shown disabled with a countdown before that; orchestrator, after test report 1). Success selects the party as *moja partia*.
- [x] Server errors show the Slovak text from `logic-errors.js`; the party name goes in via `textContent` only (no new `innerHTML` with human text — source check in `tests/js/logic.test.mjs`).
- [x] A protected unverified party stored in `localStorage` → after load „Kto si?“ opens with the login panel and „Si: …“ shows the empty state.
- [x] Touch targets at least 44 px; works at 380 px width.
- [x] `node --test tests/js/` and `uv run pytest` pass; manual check with `SMS_FAKE=1` noted in the Dev log.

## Notes for developer
- Use relative API paths and the existing request helper (it sends `X-Client-Id`).
- Panels follow the light/dark colors of "Vzhľad".

---
## Dev log
- New `static/js/app-login.js` (loadSession, checkStoredLogin, openLogin; listed in `index.html`). `app-core.js`: `app.session`, `app.loginPending`, session loaded once after the first state, `openWhoIfAsked` opens the login panel for a pending party. `app-sheet.js`: lock on protected rows, tap on an unverified one opens `openLogin`. CSS in `index.html`. Test added in `tests/js/logic.test.mjs`. `openWho` lives in `app-sheet.js`, not `app-panels.js`.
- Touch targets: `.btn` min-height 44 px, inputs 48 px; panel is the centred sheet. Layout at 380 px not checked in a browser.
- Session is reloaded after login. Reload after logout and phone changes belongs to T-097 (the call is `loadSession()`).
- Run: `node --test tests/js/` (340 pass), `uv run pytest -q` (708 pass).
- NOT done: the manual check with `SMS_FAKE=1` in a browser (no browser here); the last two boxes stay unticked (touch targets ticked from CSS only).

## Review round 1
Scope checked: `static/js/app-login.js` (new), `app-core.js`, `app-sheet.js`, `static/index.html`, `tests/js/logic.test.mjs` (T-093 backend files ignored).

Tests run by the reviewer: `node --test tests/js/` 340 pass, `uv run pytest -q` 708 pass. Every `static/js/*.js` file is listed in `index.html` with `?v=__ASSET_VERSION__`.

Acceptance criteria:
- Session: loaded once after the first state (`applyState`), reloaded after a successful verify. The phone-change reloads belong to T-097, which lists "session refresh after each". No task adds a logout UI, so nothing on the page calls `/api/logout` yet. OK.
- Lock in „Kto si?“: `isProtected` shows the lock (aria-hidden, aria-label says "chránené telefónom"). Verified and unprotected parties keep the old tap path. OK.
- „Prihlás sa“ panel: texts, `inputmode="numeric"`, `autocomplete="one-time-code"`, maxlength 6 with digit cleaning, the 60 s resend countdown from `logic-phone.js`, success calls `setMyParty` and runs `opts.after`. OK.
- Errors go through `errorText` and are set with `textContent`. The party name and phone go in only via `htmlEl`/`textContent`, with no `innerHTML`, and a source test covers this. OK.
- Stored protected unverified party: `checkStoredLogin` clears `app.myParty` in memory only, so the HUD shows the empty state, and sets `loginPending`. `openWhoIfAsked` then opens the login panel, and it waits for the intro and the fall. OK.
- 44 px / 380 px: uses the existing `.btn` and `.pform .field` styles. The panel is the centred sheet. The tester's browser check is still needed.
- The manual `SMS_FAKE=1` check is not done (no browser). This is left to the tester, not a code blocker.

**Blocker:** none.

**Suggestion:**
- `app-core.js` `applyState`: `app.sessionAsked` is not declared in the `app` object next to `session` and `loginPending`. Declare it for readability.
- Until `/api/session` answers, `sessionVerified()` returns `[]`, so a verified device that taps a protected party in that short window gets the login panel. This is rare and harmless. It could treat `app.session === null` as "unknown" and wait.
- In the code step, the only way to correct a mistyped number is „Späť“ to „Kto si?“ and tapping the party again. `loginReduce` already has a `back` action that could back a small „Zmeniť číslo“ link.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester: T-096 (the page part only; T-093 backend tested in parallel, not in this report's scope).

Commands run (repo root, PATH with `/opt/homebrew/bin`):
- `node --test tests/js/` → 340 pass, 0 fail.
- `uv run pytest -q` → 710 passed (the count includes T-093 test changes in the checkout).
- Temp server: `GROUP_CODE`/`ADMIN_CODE`/`SECRET_KEY` set in the environment, `SMS_FAKE=1`, `data/` in `/tmp/t096/data`, port 8123 (stopped afterwards). Fixture: party "Zuzka" with `phone` and `phone_set_at` added by hand to the temp YAML (the API cannot set a phone yet). Fake SMS code is `123456`.
- Browser (built-in preview tool, headless, 380×760 viewport, no real device): full flow driven with the UI.
- curl: login start, verify, session and logout endpoints.

Acceptance criteria:

| # | Criterion | Result |
| --- | --- | --- |
| 1 | `/api/session` after `/api/state`; reloaded after login, logout, phone change | FAIL (partial): load and reload-after-login pass. No page code calls `/api/logout`, and phone-change reload is T-097. See bug 1. |
| 2 | Lock on protected rows; verified or unprotected tap works as before | PASS. Lock only on Zuzka (`aria-label` "chránené telefónom"); tap on Jano (unprotected) selects it, no panel. |
| 3 | „Prihlás sa“ texts, `inputmode`, `autocomplete`, „Poslať kód“/„Overiť“, „Poslať znova“ after 60 s, success selects party | FAIL (minor): texts, hint „(končí na …456)“, `inputmode="numeric"`, `autocomplete="one-time-code"`, success selects Zuzka and closes the panel: pass. But „Poslať znova“ is shown from the send on, disabled, reading „Poslať znova (53 s)“. The criterion says it appears after 60 s. See bug 2. |
| 4 | Server errors show Slovak text; party name via `textContent` | PASS. `phone_mismatch` → „Toto číslo nesedí s uloženým číslom. Skús to znova.“; `bad_sms_code` → „Kód nesedí alebo mu vypršala platnosť. Skontroluj ho, alebo si pošli nový.“; `rate_limited` → „Príliš veľa pokusov za krátky čas, skús to o 41 s.“ Error text set via `textContent` (innerHTML equals text). Source test passes. |
| 5 | Stored protected unverified party → on load „Kto si?“ opens with login panel, „Si: …“ empty | PASS. After reload the „Prihlás sa“ panel opened by itself, `app.myParty` null, HUD shows the empty state (no party name). |
| 6 | Touch targets ≥44 px; works at 380 px | PASS for the panel and rows: „Poslať kód“/„Späť“/„Overiť“ 47 px, phone and code inputs 48 px, ✕ 44 px, party rows 47 px, no horizontal overflow at 380 px. Real iPhone/Android still in `tests/manual.md`. |
| 7 | `node --test` and `uv run pytest` pass; manual `SMS_FAKE=1` check noted | PASS for the tests. The browser run with `SMS_FAKE=1` is now done (this report). Real-device check added to `tests/manual.md` (section 9, T-096 item). |

Extra scenarios tried: wrong phone number (mismatch text, panel stays), wrong SMS code (Slovak text, panel stays), rate limit after several attempts (Slovak text with seconds), stored protected party after reload, logout via `POST /api/logout` then reload (login panel opens again), unprotected party tap, 380 px layout overflow check, curl verify → session → cookie round trip. Note: a first verify attempt looked broken, but the cause was my fixture (`phone_set_at` set in the future), not the app; corrected before the reported runs.

Bugs (for the developer):

Bug 1 (criterion 1). Steps: read `static/js/*.js` for `api/logout` and `loadSession(`. Expected per criterion: session reloaded after login, logout and phone changes. Actual: `loadSession()` is called only in `applyState` (first state) and after a successful verify. Nothing calls `api/logout`, so there is no logout reload. Fix: either add the reload to the logout path (once a logout exists) and move the phone-change clause to T-097, or reword criterion 1 and untick it. The box is ticked while the behaviour is not there, so it is not met as written.

Bug 2 (criterion 3). Steps: tap a protected party, enter the correct number, tap „Poslať kód“. Expected: „Poslať znova“ appears only after 60 s. Actual: it is visible at once and disabled, reading „Poslať znova (53 s)“. Fix: hide it until `canResend`, or reword the criterion to "enabled after 60 s". Minor.

Observation (outside T-096, not counted): the adventure bar button „✦ ÚLOHY▾“ measures 36 px high on the 380 px page (below 44 px). Pre-existing, not in this diff; for the orchestrator to decide.

No new tests added by the tester.

Decision: any failure → back to in-progress. Task moved to `tasks/in-progress/`. Nothing committed.

## Orchestrator note after test report 1
Both failures were criterion wording, not defects: criterion 1's logout/phone reload moved to T-097 (noted there), and criterion 3 now accepts the disabled countdown button. No code change; sent straight back to testing. The tester's own browser run covered the touch targets, the 380 px width and the `SMS_FAKE=1` login.

## Test report 2
Tester: T-096, re-test after the orchestrator's amended criteria. No code change since test report 1, so the browser results of report 1 are reused where still valid (headless browser at 380x760, `SMS_FAKE=1`, fake code `123456`, temp data dir).

Commands run (repo root, PATH with `/opt/homebrew/bin`):
- `node --test tests/js/` -> 340 pass, 0 fail.
- `uv run pytest -q` -> 717 passed.
- Checked: `static/index.html` loads `app-login.js?v=__ASSET_VERSION__` after `app-core.js` and `app-sheet.js`; `tests/manual.md` section 9 has the T-096 item.

Acceptance criteria:

| # | Criterion (amended) | Result |
| --- | --- | --- |
| 1 | `/api/session` loaded after `/api/state`, keeps `verified` and `sms_enabled`, reloaded after login (logout and phone-change reloads moved to T-097) | PASS (report 1 browser run; no logout UI exists yet) |
| 2 | Lock at protected rows; verified or unprotected tap works as before | PASS (report 1 browser run) |
| 3 | „Prihlás sa“ texts, `inputmode="numeric"`, `autocomplete="one-time-code"`, „Poslať kód“, „Overiť“; „Poslať znova“ shown disabled with a countdown before 60 s and enabled after (amended wording) | PASS (report 1: disabled „Poslať znova (53 s)“ before 60 s; success selects the party) |
| 4 | Server errors show Slovak text; party name via `textContent` | PASS (report 1 browser run; source test in `tests/js/logic.test.mjs` passes) |
| 5 | Stored protected unverified party: „Prihlás sa“ opens on load, „Si: …“ empty | PASS (report 1 browser run after reload) |
| 6 | Touch targets at least 44 px; works at 380 px | PASS (report 1: buttons 47 px, inputs 48 px, no horizontal overflow at 380 px; real devices remain in `tests/manual.md`) |
| 7 | `node --test tests/js/` and `uv run pytest` pass; `SMS_FAKE=1` check noted | PASS (suite above; `SMS_FAKE=1` browser run done in report 1) |

Extra scenarios: nothing new in this round; report 1 scenarios (wrong number, wrong code, rate limit, logout then reload, unprotected tap) stand.

Failures: none. Open boxes ticked on the evidence above. No new tests added. Real iPhone Safari and Android Chrome checks remain in `tests/manual.md` section 9 as a manual item (not blocking).

Decision: all criteria pass, no regressions. Task is in `tasks/done/`. Nothing committed.
