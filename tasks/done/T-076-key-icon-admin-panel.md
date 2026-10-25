# T-076: Page: key icon and admin panel

- **Phase:** 2 (split from T-009)
- **Depends on:** T-073, T-074
- **Size:** M

## Goal
The organizer's tools on the page: a key icon in the scene opens a panel to lock or unlock signup, download the data and delete a party. Proposal section „Informácie v scéne“ (Admin).

## Scope
- new `static/js/app-admin.js` (listed in `index.html` with `?v=__ASSET_VERSION__`, before `app-start.js`), the scene draw file for the icon, `static/index.html`, `static/js/logic-errors.js`, `tests/js/logic.test.mjs` if any pure logic is added, `README.md`, `tests/manual.md`

## Acceptance criteria
- [x] A pixel key icon in `map.scene.key`, drawn only when `isAdmin`, `role="button"`, `tabindex="0"`, `aria-label="Admin nástroje"`, hit area at least 44 units; it opens a panel „Admin“ (existing panel helper).
- [x] The panel has:
  - [x] „Zamknúť zápis“ / „Otvoriť zápis“ by the current `signup_open`, calling `POST /api/admin/signup` and applying the returned state
  - [x] „Stiahnuť dáta“: downloads `api/admin/export` (relative path, plain link or fetch + blob, works on iPhone Safari)
  - [x] „Zmazať partiu“: choose a party from a list (color square + name via `textContent`), then a confirm step „Naozaj zmazať „<meno>“? Uvoľnia sa všetky jej miesta.“, then `DELETE /api/parties/{id}`; if the deleted party is my „Si: …“, the page forgets it and opens „Kto si?“
- [x] `onAdminLost()` (T-074) removes the icon and closes the panel; errors show Slovak text from `errorText`. No `innerHTML`.
- [x] README: how to log in as organizer and lock signup. `tests/manual.md`: admin code shows the key; lock, export and delete work.
- [x] `node --test tests/js/` and `uv run pytest` pass.

---
## Dev log
Added `static/js/app-admin.js` (`drawKey`, `renderAdminUi`, `openAdmin`: main / pick / confirm views inside one panel, refreshed on new state). The key is drawn in `drawBoards` (`app-draw.js`) only for `isAdmin(app.role)`. `setRole` now also redraws when the role becomes admin; `onAdminLost` -> `renderAdminUi` closes the admin panel and removes the key. Export is a plain `<a href="api/admin/export" download>`. Deleting my own party is handled by the existing `applyState` (forgets it, opens „Kto si?“). Pure texts `signupToggleLabel` and `deleteConfirmText` in `logic-errors.js`. CSS in `index.html`; README and `tests/manual.md` updated. Not verified in a real browser (no device); the export link depends on the browser honoring `download`.
Files: static/js/app-admin.js, app-draw.js, app-core.js, logic-errors.js, static/index.html, tests/js/logic.test.mjs, README.md, tests/manual.md.
Tests: `node --test tests/js/` (338 pass), `uv run pytest` (631 pass).

## Review round 1
Tests run by the reviewer: `node --test tests/js/` 338 pass, `uv run pytest` 631 pass. `app-admin.js` is listed in `index.html` with `?v=__ASSET_VERSION__` before `app-live.js`/`app-start.js`. No `innerHTML`; names go in through `htmlEl(..., text)`. Endpoint bodies match (`SignupRequest.open`, `DELETE /api/parties/{id}`, `GET api/admin/export` with `Content-Disposition: attachment`). `scene.key` is required by the model, so `drawKey` always has a rect. A 403 sets the role to group, `onAdminLost` -> `renderAdminUi` closes the panel. Deleting my own party goes through `applyState` -> `forgetMyParty` + `openWho`.

**Blocker**
- `static/index.html:172`: the confirm button „Zmazať“ (`btn danger`, filled, `app-admin.js:71`) keeps the filled `.btn` background `var(--forest)` and only changes the text to rust. In light mode that is `#8E3424` text on `#4A2C1A`, contrast about 1.6:1, so the most important button in the delete flow is nearly unreadable on a phone. `--rust` is also not defined in either theme, so the fallback `#8E3424` is used in dark mode as well, where the outlined „Zmazať partiu“ shows `#8E3424` on `--surface` `#241C16` (about 2:1). Expected fix: define `--rust` in both themes, e.g. light `#8E3424` and a lighter dark-mode value with at least 4.5:1 on `--surface`. Give the filled danger button `background: var(--rust); border-color: var(--rust); color: var(--surface)` (check the dark-mode pair as well), and keep the outlined variant as rust text on a transparent background.

**Suggestion**
- `app-admin.js:49`: if the admin cookie has expired, „Stiahnuť dáta“ goes to a plain 403 JSON page and leaves the app, and nothing calls `onAdminLost`. A fetch + blob with `errorText` on failure would avoid that. Not required, since the criterion allows a plain link.
- `app-admin.js:46`: the lock toggle is not disabled while its request is in flight. A double tap sends the same `open` twice. That is harmless (idempotent), but the button does not show that anything is happening.

Verdict: CHANGES REQUESTED


## Dev log (fixes after round 1)
- Blocker fixed: `--rust` defined in both themes (light `#8E3424`, dark `#F08C70`) in `static/index.html`; filled danger button is now `background: var(--rust); color: var(--surface)` (about 8:1 light), outlined variant is rust text on transparent.
- Suggestion 1 fixed: „Stiahnuť dáta“ is a button using `downloadExport()` in `static/js/app-admin.js` (fetch + blob + temporary link, filename from `Content-Disposition`). On failure it applies `roleAfterResponse` (a 403 drops the admin role, so `onAdminLost` hides the key and panel) and shows the Slovak `errorText`.
- Suggestion 2 fixed: the lock button is disabled while its request runs; the panel is redrawn when it finishes.
- Tests: `node --test tests/js/` and `uv run pytest` (631) pass. Not checked in a real browser.

## Review round 2
Tests run by the reviewer: `node --test tests/js/` 338 pass, `uv run pytest` 631 pass.

- Round-1 blocker fixed: `--rust` is defined in both themes (`static/index.html:36`, `:45`). Filled `.btn.danger` is now `--surface` on `--rust`: light `#FBF6EC` on `#8E3424` and dark `#241C16` on `#F08C70`, both about 7:1. The outlined variant is rust on transparent, about 7:1 in dark and about 7.5:1 in light.
- Suggestion 1 done: `downloadExport()` uses fetch + blob, sends `X-Client-Id`, takes the filename from `Content-Disposition`, and on failure goes through `roleAfterResponse` / `setRole` (a 403 leads to `onAdminLost`) plus `errorText`. All the helpers it uses exist (`app-core.js`, `app-panels.js`, `app-summary.js`, `logic-errors.js`).
- Suggestion 2 done: the lock button is disabled while its request runs, and the panel is redrawn afterwards if it is still open.
- Still no `innerHTML`. The script is still listed with `?v=__ASSET_VERSION__`.

No blockers.

Verdict: APPROVED

## Test report

Tester: T-076 round 1. Result: **PASS**, no bugs found.

### Commands and results
- `uv run pytest -q` (repo root): 631 passed.
- `node --test tests/js/`: 338 pass, 0 fail.
- Probe script (outside the repo, `/tmp/t076probe/probe.py`, run as `PYTHONPATH=<repo> uv run python ...`): creates the app in-process via `httpx.ASGITransport` with a temporary `data_dir`, test secrets and no `.env`. Result 35 of 36 checks passed. The one "failure" was a flaw in my probe: the httpx cookie jar kept the admin cookie from an earlier join and sent it on a "no cookie" request. A clean client (`/tmp/t076probe/nocookie.py`) returns 401 `bad_code` for `GET /api/admin/export` and `POST /api/admin/signup` without a cookie, which is the correct behaviour.
- No repo files were changed by the tester.

### Acceptance criteria
| Criterion | Result | How verified |
| --- | --- | --- |
| Key icon in `map.scene.key`, drawn only for admin, `role=button`, `tabindex=0`, `aria-label="Admin nástroje"`, hit area ≥ 44 | PASS | Code: `drawKey` + `hitRect(g, r)` with r = 44×44 from `config/cabin.yaml`, `makeButton`; `drawBoards` calls it only if `isAdmin(app.role)`. Key rect does not overlap letter [128..172], meadow [453..] or briefing [296..352]. Visual check still manual. |
| Panel „Admin“ via existing `openPanel` | PASS | Code (`openPanel("Admin", …, {returnKey:"key"})`). Rendering needs a browser (manual). |
| „Zamknúť zápis“ / „Otvoriť zápis“ by `signup_open`, `POST /api/admin/signup` | PASS | `signupToggleLabel` tested in Node; server: admin lock → 200 `signup_open:false`, unlock → `true`; re-lock idempotent. |
| „Stiahnuť dáta“ downloads export (relative path, fetch + blob) | PASS (server) | `GET /api/admin/export` with admin cookie → 200, `Content-Disposition: attachment; filename="cabin-data-<version>.yaml"`, `no-store`, valid YAML. Group cookie → 403 forbidden. Client download on iPhone Safari is manual. |
| „Zmazať partiu“ list, confirm text, `DELETE /api/parties/{id}` | PASS (server + text) | `deleteConfirmText` tested in Node (exact text). Delete as admin → 200, party gone, its beds freed, other party kept, audit `party-delete` written. Group → 403. Unknown id → 404 `unknown_party`. Malformed id → 4xx. Own-party handling (`applyState` → `forgetMyParty` → „Kto si?“) read in code; UI needs manual check. |
| `onAdminLost()` removes icon and closes panel; errors via `errorText`; no `innerHTML` | PASS | `onAdminLost` → `renderAdminUi` → `closePanel()` if admin panel, `render()` removes key. `grep innerHTML static/js/app-admin.js` = 0. `forbidden`, `signup_closed`, `unknown_party` have Slovak texts (Node). |
| README and `tests/manual.md` | PASS | README section "Organizer tools" present; manual.md item "Admin key and panel (T-076)" present. |
| `node --test tests/js/` and `uv run pytest` pass | PASS | See commands above. |

### Extra scenarios tried (server)
- `index.html` lists `app-admin.js?v=__ASSET_VERSION__` between `app-sound.js` and `app-live.js`, before `app-start.js`; `GET /static/js/app-admin.js` → 200.
- `/data/cabin-data.yaml` and `/static/../data/cabin-data.yaml` → not served.
- Forged admin cookie (group cookie plus a made-up admin value) → 403.
- Group cookie only: signup lock and export and delete → 403 `forbidden`.
- Group write while locked → 403 `signup_closed`; admin write while locked → 200.
- `{"open": "yes"}` and `{}` on signup → 422 `invalid`.
- Export and delete audited; `GET /api/state` and `/` contain neither the admin code nor the secret.

### Not verifiable here (manual, already in `tests/manual.md`)
Key visible only after the admin code, VoiceOver label, the lock toggle flipping on a second device, the export file saved on iPhone Safari and Android Chrome, delete flow and the „Kto si?“ redirect on the deleting device, the key and open panel closing after the admin cookie expires, filled „Zmazať“ contrast in both themes (values checked in CSS: about 7:1).

### Bugs
None found. Minor non-blocking observation: `downloadExport` does not catch a `res.blob()` rejection on the success branch (a broken body would leave no toast). Very unlikely; not a reason to send back.

Verdict: all criteria pass, no regressions. Moved to `tasks/done/`.
