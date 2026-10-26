# T-096: „Kto si?“ lock and the „Prihlás sa“ panel

- **Phase:** 1
- **Depends on:** T-092, T-095
- **Size:** M

## Goal
Choose a protected party only after SMS verification: proposal "Prihlásenie telefónom (SMS)" › "Stránka" (first two bullets).

## Scope
- `static/js/app-panels.js` (who panel), a new or existing `app-*.js` for the login panel (listed in `index.html` with `?v=__ASSET_VERSION__`), `static/js/app-start.js` / `app-boot.js` (load `/api/session`), `static/index.html` (CSS)

## Acceptance criteria
- [ ] The page loads `GET /api/session` after `/api/state` and keeps `verified` and `sms_enabled`; it reloads it after login, logout and phone changes.
- [ ] „Kto si?“ shows a small lock at each protected party; tapping a verified or unprotected party works as before.
- [ ] Tapping a protected, unverified party opens „Prihlás sa“: „Zadaj svoje telefónne číslo (končí na …456)“, „Poslať kód“, then a 6-digit field with `inputmode="numeric"` and `autocomplete="one-time-code"` and „Overiť“; „Poslať znova“ appears after 60 s. Success selects the party as *moja partia*.
- [ ] Server errors show the Slovak text from `logic-errors.js`; the party name goes in via `textContent` only (no new `innerHTML` with human text — source check in `tests/js/logic.test.mjs`).
- [ ] A protected unverified party stored in `localStorage` → after load „Kto si?“ opens with the login panel and „Si: …“ shows the empty state.
- [ ] Touch targets at least 44 px; works at 380 px width.
- [ ] `node --test tests/js/` and `uv run pytest` pass; manual check with `SMS_FAKE=1` noted in the Dev log.

## Notes for developer
- Use relative API paths and the existing request helper (it sends `X-Client-Id`).
- Panels follow the light/dark colors of "Vzhľad".

---
## Dev log

## Review round 1

## Review round 2

## Test report
