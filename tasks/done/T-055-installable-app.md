# T-055: Installable home-screen app and the "new version" sign

- **Phase:** 1
- **Depends on:** T-053, T-054
- **Size:** M

## Goal
Organizer request of 25. 10. 2026: the page can be added to the home screen as an app (PWA), and an open page learns through the live stream that the server runs newer page code and shows a sign to reload. The proposal has no section on this yet; the decisions below are the source. Related: "Zmeny naživo (`/api/events`)", "Spodná lišta (HUD)" in "Informácie v scéne", "Vzhľad".

## Scope
- `app/main.py` (`/sw.js` route, `asset_version` in the state payload and the ETag), `static/sw.js` (new)
- `static/manifest.webmanifest`, `static/icons/icon-maskable-512.png` (new), `static/index.html` (meta tags, sign element, SW registration)
- `static/js/logic-live.js` (pure version logic), `static/js/app-live.js` and/or `app-hud.js` (sign rendering, tap)
- `tests/test_pwa.py` (new), `tests/js/logic.test.mjs`, `tests/manual.md`

## Acceptance criteria
- [x] `index.html` has `<meta name="asset-version" content="__ASSET_VERSION__">`; `GET /` returns it filled with the same hash as the script `?v=` (PageRenderer, no second hashing code).
- [x] `state_payload` has `asset_version` (the current PageRenderer hash) in every state: `/api/state`, write responses, error responses with state, and every SSE `event: state` frame (initial and after writes).
- [x] `state_etag` includes the asset version: after an edit of a file in `static/js/` (no restart), `GET /api/state` with the old `If-None-Match` returns 200 with the new `asset_version`, not 304.
- [x] `GET /sw.js` (no cookie needed) returns 200, `Content-Type` JavaScript, `Cache-Control: no-cache`. `static/sw.js` has `install`/`activate` handlers only (`skipWaiting`, `clients.claim`), **no `fetch` listener** and no Cache API use. The page registers it with a relative path (`navigator.serviceWorker.register("sw.js")`), guarded by feature check; a registration failure is ignored silently.
- [x] Manifest: `id` (resolves to the same URL as `start_url`), Slovak `description` with typographic quotes if any, existing fields kept, a third icon `icons/icon-maskable-512.png` 512×512 with `"purpose": "maskable"`; the art stays inside the central 80 % circle (pixel art, nearest-neighbour scaling, no blur).
- [x] `index.html` head: `apple-mobile-web-app-capable` content `yes`, `apple-mobile-web-app-status-bar-style` content `black-translucent`, `apple-mobile-web-app-title` content `Chata`. In standalone mode on iOS nothing of the HUD, panels or the sign sits under the status bar (safe-area insets already exist, check they cover the top).
- [x] Pure function in `logic-live.js`, e.g. `updateSign(shownVersion, serverVersion, pendingWrites)` → `null` or `{ text, canReload }`. `null` when either version is missing/empty or `shownVersion` is still the literal `__ASSET_VERSION__`, or the two are equal. Any difference counts as newer (hashes have no order). Text „Nová verzia – ťukni pre obnovenie“; while `pendingWrites > 0` text „Ukladám, chvíľu počkaj“ and `canReload: false`.
- [x] The page checks every received state payload (SSE `state`, fallback poll, write responses), independent of whether that state is applied by its data `version`. Once shown, the sign stays until reload (it does not hide if a later payload matches again).
- [x] Sign: fixed HTML element just above the bottom HUD (visible during pan/zoom, not inside the SVG), styled like the scene's wooden signs with the "Vzhľad" fonts, `role="button"`, focusable, Enter/Space work, at least 44 px tall, `aria-live="polite"`, text via `textContent`. Tap with `canReload` → `location.reload()`; otherwise nothing. Nothing ever reloads by itself.
- [x] Node tests for `updateSign` (equal, different, missing, placeholder, pending); pytest in `tests/test_pwa.py`: manifest fields and maskable icon file exists with size 512×512 (read the PNG header, no Pillow), `/sw.js` headers and no `fetch` listener in its source, `asset_version` in `/api/state` equals the meta value from `GET /`, the ETag case above, and `asset_version` in the initial SSE frame.
- [x] `tests/manual.md`: install on iPhone Safari (Share → „Pridať na plochu“) and Android Chrome (install / add to home screen); opens standalone, grass under the status bar; note that the iOS home-screen app has storage separate from Safari, so it may ask for the group code and „Kto si?“ once; resume from background reconnects; after a trial-server restart with a changed `static/js` file the sign appears within seconds and a tap loads the new code; an open party form is not lost before the tap.
- [x] `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
- Decisions to list for the organizer (defaults chosen by the orchestrator, 25. 10. 2026): minimal SW only for installability, caching nothing; no install hint in the UI; no offline mode; tap during a pending save does not reload (the sign says to wait), and an open form or move gives no extra warning, because tapping is the user's choice.
- The SW must never touch `/`, `/api/*` or `/api/events`: with no `fetch` listener it cannot, so the `?v=` no-stale rule and SSE stay as they are. Do not add one "to be safe".
- Call `page.render()` for the version (it caches by mtime/size); do not hash files per request yourself. `create_app` must pass the renderer to wherever `state_payload` runs (including the hub publish on commit).
- In development the hash changes on file edits without restart; open streams learn it with the next `state` frame (next write) or after reconnect. That is enough; do not add the version to `ping`.
- Make the maskable icon with a one-off script (e.g. `uv run --with pillow python …`), do not add Pillow to `pyproject.toml` and do not commit the script. No art from games.
- `/sw.js` is the only new root route; keep `data/`, `config/`, `files/`, `.env` unserved.
- Dev log: list for the orchestrator the CLAUDE.md lines to add (SW, `asset_version` in state and ETag, the sign) and that `proposal.md` needs a short note under "Zmeny naživo" and "Otvorené rozhodnutia".

---
## Dev log
- Server: `PageRenderer.version()` (same hash as `?v=`), `Runtime.asset_version` callable, `asset_version` in `state_payload` (so in `/api/state`, writes, errors, SSE), `state_etag(..., asset_version)` used by `GET /api/state`, `GET /sw.js` route (no-cache). New `static/sw.js` (install/activate only, no fetch, no cache).
- Page: meta tags in `index.html`, `#updateSign` element and CSS, `updateSign()` in `logic-live.js`, `noteAssetVersion`/`renderUpdateSign` in `app-live.js` (called from SSE state, poll and write responses; `writesInFlight` counted in `write()` in `app-core.js`), SW registration at the end of `app-start.js`. Manifest got `id`, `description`, maskable icon (made with a one-off Pillow script from `icon-512.png`, art scaled to 288 px in the centre, edges replicated, nearest neighbour; the outer ring is outside the safe circle).
- Tests: `tests/test_pwa.py` (new), `tests/js/logic.test.mjs` (updateSign), `STATE_KEYS` in `tests/test_api_access.py`, two entries in `tests/manual.md`.
- Commands: `uv run pytest` (543 passed), `node --test tests/js/` (296 passed).
- Not verified on a real device (iOS standalone safe area, install flow): covered by the manual checks. Top safe-area inset already exists on body padding and the quest log.
- For the orchestrator, CLAUDE.md lines to add: the minimal `static/sw.js` (served at `/sw.js`, no fetch handler, caches nothing); `asset_version` (PageRenderer hash) in every state payload and in the `/api/state` ETag; the fixed „Nová verzia“ sign above the HUD (`app-live.js`, `updateSign` in `logic-live.js`) that never reloads by itself. `proposal.md` needs a short note under „Zmeny naživo“ and „Otvorené rozhodnutia“ (defaults: caching nothing, no install hint, no offline mode, tap during a save does not reload, no warning for an open form).


## Review round 1
Tests run by the reviewer: `uv run pytest` 543 passed, `node --test tests/js/` 296 passed. All scripts in `static/js/` are listed in `index.html` with `?v=__ASSET_VERSION__`.

No blockers. Every acceptance criterion is met. Details:
- `PageRenderer.version()` reuses `render()`, so there is no second hashing code. `rt.asset_version = page.version` is set before any payload is built, so `/api/state`, writes, errors and hub frames all carry the hash. The ETag includes the hash, and a test covers the edit-without-restart case.
- `/sw.js` has no cookie, `text/javascript`, `no-cache`, only install/activate, no fetch and no caches. Registration uses a relative path, has a feature check, and ignores failures silently.
- Manifest `id` "../" resolves to the same URL as `start_url`. The maskable icon is 512×512 pixel art with the house inside the safe circle.
- `updateSign` covers equal, different, missing, placeholder and pending, with tests. The sticky `updateSeen` latch is checked on SSE, poll and write responses, whatever the data `version`. The sign is fixed, `role="button"`, focusable, Enter/Space work, min 44 px, `textContent`, and reload happens only on tap when no write is in flight.
- `writesInFlight` is declared in `app-live.js` but used in `app-core.js`. That works because it is only read at call time, after all scripts have loaded.

**Suggestion**
- The sign (`bottom: hud-h + 10px`, left) and `#toast` (`bottom: 12px + hud-h`, z 40) sit in the same band, so a toast can cover the sign for a few seconds. „Celá mapa“ may also sit beside it. Add this to the manual check, or later lift the sign above the toast when both are shown.
- The maskable icon's replicated edge rows make visible stripes in the outer ring. They are cropped by most masks, so this is only cosmetic.
- `PageRenderer.version()` stats all JS files on every state payload, including each SSE publish. That is fine at this size.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Commands (tester, 25. 10. 2026; `uv` is at `/opt/homebrew/bin`, not on the default PATH of the agent shell):
- `uv run pytest -q` → 543 passed
- `node --test tests/js/` → 296 passed, 0 failed
- Probe against a temporary server on port 8077 (copy of `static/` and `config/` in a temp dir, temp `data/`, test secrets, port freed afterwards). Not the trial server, not `data/`.
- Node check of `updateSign` on edge inputs (null, empty, placeholder, equal, different, pending).
- Decoded the maskable PNG header (512×512, colour type 2) and viewed it.

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Meta `asset-version` in `index.html`, `GET /` fills it with the `?v=` hash | pass | meta and every `?v=` both `7754802b05ad` |
| 2 | `asset_version` in state, writes, errors, SSE state frames | pass | `/api/state`, `POST /api/parties`, `POST /api/assign` (200, 409, 422 error) and the SSE `state` frame after a write all match the meta |
| 3 | ETag includes the asset version; edit without restart gives 200 with the new version | pass | after editing `static/js/app-core.js` the old `If-None-Match` gave 200, new `asset_version` `e41d8c090f09`, meta on `/` equal; unchanged tag gives 304 |
| 4 | `/sw.js` 200, JS type, `no-cache`, install/activate only, no fetch, no cache, relative register | pass | `text/javascript`, `no-cache`, no `fetch` listener, no cookie needed; `app-start.js` registers `"sw.js"` inside a feature check with a silent catch |
| 5 | Manifest `id`, Slovak description, maskable 512 icon | pass (note) | `id` `../` equals `start_url`; maskable icon 512×512 with purpose maskable, served 200 image/png. The house and flag sit in the central circle; the ground runs to the edges as full-bleed background (reviewer's cosmetic note), so the icon is not clipped in content |
| 6 | iOS meta tags and safe-area insets | pass (static) | tags present in `index.html` lines 8–10; body and sign use `env(safe-area-inset-*)`. Real device check is in `tests/manual.md` |
| 7 | `updateSign` pure function and its contract | pass | Node: `null` for undefined, empty, `"__ASSET_VERSION__"`, equal, and equal with pending; `{Nová verzia…, canReload:true}` for a difference; `{Ukladám…, canReload:false}` for a difference with pending writes |
| 8 | Every received payload is checked, the sign latches | pass (static) | `noteAssetVersion` is called from `liveOnState`, the poll and `write()` before the data-version filter; `updateSeen` latch, never hidden again until reload |
| 9 | Sign element: fixed, `role=button`, focusable, Enter/Space, 44 px, `aria-live`, `textContent`, reload only on tap | pass (static) | `index.html` line 420, CSS `min-height:44px`, `updateSignAction` with `location.reload()` only on click or Enter/Space, `textContent` used. Visual placement and the tap on a device: manual |
| 10 | Node and pytest coverage listed in the criterion | pass | `tests/test_pwa.py` in the 543 pytest run, updateSign cases in the 296 Node tests |
| 11 | `tests/manual.md` entries (iPhone, Android, storage note, resume, restart, open form) | pass | two entries added, covering all points listed |
| 12 | `uv run pytest` and `node --test tests/js/` pass | pass | 543 and 296 |

Regressions: the full pytest and Node suites include all `tasks/done/` tests, and all pass (no regression).

Extra scenarios (all as expected):
- No cookie: `GET /api/state` 401, unauthenticated `POST /api/assign` 401.
- Write `POST /api/assign` then a second party on the same slot: 409 `slot_taken`, state carries `asset_version`.
- Two concurrent `POST /api/assign` on the same slot: statuses `[200, 409]`.
- SSE frame after a real write carries the current `asset_version`, `version` 1.
- Not served over HTTP (all 404): `/data/cabin-data.yaml`, `/static/../data/cabin-data.yaml`, `/static/../config/cabin.yaml`, `/config/cabin.yaml`, `/.env`, `/files/mapa-nahlad.html`, `/tests/manual.md`, `/app/main.py`, `/%2e%2e/data/cabin-data.yaml`.
- Cookie header: `Secure` cookie, so the probe passed it by hand.

Minor observation, not a failure (no criterion asks for it): `HEAD /sw.js` returns 405, while `GET /` accepts HEAD. Harmless for installability.

Not verifiable without a browser or device (listed for the human, all in `tests/manual.md`): iOS standalone layout under the status bar, Android install prompt, the sign's placement above the HUD while panning, the tap that reloads, the toast overlapping the sign (reviewer's suggestion; add a manual check if the organizer wants it).

Verdict: all 12 criteria pass, no regressions, no bugs found. Moved to `tasks/done/`. No application code or tests changed by the tester.
