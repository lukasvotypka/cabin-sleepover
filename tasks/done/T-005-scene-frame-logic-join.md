# T-005: Scene frame with info boards, core page logic and error texts with Node tests, code screen, „Kto si?“, polling

- **Phase:** 1
- **Depends on:** T-003
- **Size:** L

## Goal
Replace the placeholder `static/index.html` with the one-page app frame. It covers the code screen, the „Kto si?“ panel, live refresh of `/api/state`, and the one table that turns server error codes into Slovak messages. It also draws the pixel scene (grass, paths, buildings) with every info element the proposal puts inside it: the title board, three night signposts, noticeboard, and status board. The core pure logic functions live in their own block and are tested in Node. Beds and actions come in T-006, and the other panels in T-007. Proposal sections: „Pravidlá pre stavbu“ (Jazyky), „HTTP API“ (Odpoveď, Chybové kódy), „Cieľ a kontext“, „Stránka: jedna scéna a interakcie“ (Prvé otvorenie, Informácie v scéne), „Mapa“ (scene basics), „Vzhľad“, „Architektúra“ (Čítanie), „Testy“ (Logika stránky).

## Scope
- `static/index.html`
- `tests/js/logic.test.mjs` (Node built-in `node:test`, no npm dependencies)

## Acceptance criteria
- [x] One file, no framework, no build step, with `<html lang="sk">` and a mobile viewport. Pinch-zoom stays enabled: no `user-scalable=no` and no `maximum-scale=1` (Q9).
- [x] The page has no header, list view, „Mapa / Zoznam“ switch or overview page. Outside the scene there are only the code screen and the panels that slide over it.
- [x] The pure functions live in a `<script id="logic">` block that does not touch `document` or `window` (Q8, decided). It covers:
  - [x] the event date text from `event.arrive_days[0]` and `event.leave_days[-1]`, giving „29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)“
  - [x] the night signpost label and dates („Št → Pi“ / „29./30. 10.“, „Pi → So“, „So → Ne“)
  - [x] the Slovak day locative derived from the date („vo štvrtok“, „v piatok“, „v sobotu“)
  - [x] presence `arrive ≤ n < leave`
  - [x] needed slots `adults + kids − kids_in_parents_bed`
  - [x] slots of a party per night
  - [x] used count per night and total slot count (from the layout, not a hardcoded 20)
  - [x] missing places and extra places per party and night (held slots compared with needed slots)
  - [x] my-party status, in this priority:
    - [x] the first night with missing places and its text, e.g. „V sobotu vám chýba 1 miesto“ (red)
    - [x] otherwise the first night with extra places and its text, e.g. „Máte o 1 miesto viac, než potrebujete“ (soft amber, Q4)
    - [x] otherwise „Všetko máte“ (green)
  - [x] Slovak plural for places (1 miesto, 2–4 miesta, 5+ miest, 0 miest)
  - [x] relative refresh time („aktualizované pred 20 s“)
  - [x] **error text** `errorText(error, state)`: one lookup table from `code` to a Slovak message, filled from `error.params`. It covers every server code: `bad_code`, `forbidden`, `signup_closed`, `slot_taken`, `not_present`, `duplicate_name`, `unknown_slot`, `unknown_party`, `invalid` and `rate_limited`. Examples: `slot_taken` with `night: "2026-10-31"` and `party_name: "Riso a Ben"` gives „Toto miesto má v sobotu už Riso a Ben.“; `invalid` uses `params.field` to name the form field in Slovak. An unknown code, or a missing error (network failure), gives „Niečo sa nepodarilo, skús to znova.“
- [x] `node --test tests/js/` passes. The tests extract the logic block from `static/index.html`, run it in `node:vm` and cover every function above. The cases include:
  - [x] the date text and the three signpost labels for the real event dates
  - [x] a party arriving on Friday is not present on the Thursday night
  - [x] `kids_in_parents_bed` lowers the needed count
  - [x] the status for a party missing 1 place on Saturday, for a party with 1 extra place, for a party with both (missing wins), and for a party with everything
  - [x] the plural forms 0, 1, 2, 5
  - [x] error texts:
    - [x] each of the 10 server codes gives a non-empty Slovak text that differs from the fallback
    - [x] the params are filled in (the `slot_taken` example above, word for word)
    - [x] a code whose params are missing still gives a sensible sentence, with no `undefined` or `{party_name}` left in it
    - [x] an unknown code gives the fallback
    - [x] the English `message` never appears in the result
- [x] **The page never shows the server's `message`.** Every error shown anywhere on the page (code screen, sheet, panels) goes through `errorText`.
- [x] **Code screen:**
  - [x] it uses the Vzhľad colors and fonts, in the scene's style (proposal: „v rovnakom štýle ako scéna“)
  - [x] it has a code input and a button that call `POST api/join`
  - [x] a wrong code (`bad_code`) and `rate_limited` each show their Slovak text from `errorText`
  - [x] any `401` from a later call brings the screen back
- [x] **„Kto si?“ panel:**
  - [x] it lists the parties, plus **Pridať partiu**, which hands off to the T-007 party form (a stub hook is fine here)
  - [x] the choice is stored as *moja partia* in `localStorage`
  - [x] it opens after the first join, when the stored party no longer exists, and when the user taps „Si: …“ in the scene
- [x] **Scene frame (SVG):**
  - [x] built with `createElementNS` and `setAttribute`, with `viewBox` from `layout.map.viewbox` and `shape-rendering="crispEdges"`
  - [x] it draws the grass with tufts, paths, rooms with labels, doors and windows from `layout`, in the style of `files/mapa-nahlad.html`
  - [x] no geometry is hardcoded
  - [x] it fills the full width on mobile
  - [x] it keeps fixed colors in dark mode
  - [x] scene text is pixel or monospace, not Alegreya
- [x] **Title board** in `map.scene.title`: a wooden board with the event name and the date text, both from `/api/state`.
- [x] **Three night signposts** in `map.scene.nights`:
  - [x] each shows its label and dates and „obsadené X z 20“
  - [x] the selected night is highlighted, and tapping one switches the night shown on the map
  - [x] each hit area is at least 44 units tall and extends into the grass gaps above and below (Q9)
- [x] **Noticeboard** in `map.scene.notice`:
  - [x] three short Slovak instruction lines, e.g. „Ťukni na posteľ a zapíš sa.“, „Voľné miesto bliká.“, „Presunúť sa dá cez posteľ.“
  - [x] open on the first visit; the first tap on the noticeboard or on any bed collapses it to a „?“ icon that reopens it; the collapsed state is remembered in `localStorage` (Q12)
- [x] **Status board** in `map.scene.status` (94×88, two rows of 44 units, Q9):
  - [x] top row: „Si: Ivan a Eva“ (or a prompt to choose when no party is set) and „aktualizované pred … s“; tapping the row opens „Kto si?“
  - [x] bottom row, from the my-party status function:
    - [x] a clear red sign with an exclamation mark when a night lacks places; tapping it selects that night
    - [x] otherwise a soft amber note for extra places, e.g. „Máte o 1 miesto viac, než potrebujete“, without any alarm styling
    - [x] otherwise a green „Všetko máte“ sign
  - [x] each row is its own tap target, 44 units tall
- [x] Every tappable scene element (signpost, status board, red sign, noticeboard and „?“) has `role="button"`, `tabindex="0"` and a Slovak `aria-label`, and works with Enter and Space.
- [x] Polling and requests:
  - [x] `GET api/state` every 30 s while the tab is visible, immediately on return to the tab, and after every write (using the `state` the write returns)
  - [x] it sends `If-None-Match` and keeps the current state on `304`
  - [x] each request sends `X-Client-Id`, a random ID created once and stored in `localStorage`
  - [x] API paths are relative (`api/...`, not `/api/...`)
- [x] No `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write` in the file. Party names and every other value from `/api/state` go in through `textContent` or `setAttribute`.
- [x] Languages: all UI text is Slovak and informal, with „ “ quotes. Code, identifiers, comments and tests are in English.

## Notes for developer
- The server sends no Slovak text. Errors are `{code, message, params}`. `message` is an English note for developers and logs. All Slovak wording lives in the one `errorText` table in this file.
- The `params` keys come from T-004 (`night`, `slot`, `party_id`, `party_name`, `field`, …). Look up bed names from `state.layout` by `slot` when a message needs them.
- The old overview page is gone. The warnings and texts are written fresh from the proposal. The status board shows **missing places** in red and **extra places** as a soft amber note (Q4: the server never refuses extra places). The summary text in T-007 warns only about missing places, as the proposal says.
- Panel colors are the CSS variables in „Vzhľad“ (light, plus dark via `prefers-color-scheme`). The fonts are Alegreya (headings) and Alegreya Sans (text) from Google Fonts. Panels and the code screen use these. The scene does not.
- The doors in config have no color. The preview draws each one in the floor color of the room whose rect contains the door's top-left corner, and that rule matches all 5 doors.
- Signpost text („obsadené 18 z 20“) is tight in a ~65-unit-wide sign. Check it at 380 px and pick a small monospace size. The config rects are the organizer's decision (Q9), so do not change them.
- „obsadené X z 20“: the 20 is the total slot count from the layout, tight slots included.
- For a manual `If-None-Match`, use `fetch(..., {cache: "no-store"})` so the browser hands the `304` to your code.
- Role from join: store it as decided in Q6. The admin key icon and the locked-signup sign are moved to T-009 (phase 2), so nothing uses the role yet.
- This task needs only `/api/join` and `/api/state` (T-003). It runs in parallel with T-004, which touches only `app/` and `tests/*.py`. The error `params` keys are listed in the T-004 task file.
- Keep a single render path: state plus selected night plus *moja partia* gives the scene. T-006 adds beds to the same render.
- Open decision „Umiestnenie na serveri“: the default is the domain root, but relative paths keep a sub-path such as `/chata/` working.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

**Round 1 (continued after an interrupted run).** The earlier run had already written `static/index.html` and the Node tests. I read all of it against the acceptance criteria, found nothing missing, and did not rewrite anything. I changed no code in this run, only verified.

Files (T-005 scope): `static/index.html` (logic block `<script id="logic">`, app block `<script id="app">`), `tests/js/logic.test.mjs`, and `tests/js/index.js`. The last one is a 3-line entry point that imports the test file. `node --test tests/js/` treats the directory as a module on Node 22+, so without it the run finds nothing there. I did not touch `app/` or `tests/*.py`.

Tests:
- `node --test tests/js/` gives 40 pass, 0 fail. It covers the logic functions, `errorText` (10 codes, params, missing params, unknown code, no English `message`) and static checks of the page (lang, viewport, no unsafe HTML sinks, relative API paths, no header or list view).
- `uv run pytest -q` gives 379 passed (whole backend suite, including T-004 work in progress).

Manual check in a real browser. I ran the app with `/tmp/chata-run/run.py`, a temp data dir seeded with 2 parties, test secrets, and `127.0.0.1:8010`. The repo's `data/` and `.env` were not used. I drove headless Chrome at 380 px wide through CDP (scripts in `/tmp/chata-cdp`, not in the repo) and checked:
- The code screen shows. A wrong code shows „Kód nesedí, skús ho zadať znova.“. After 10 attempts `rate_limited` shows „…skús to o 31 s.“. A good code opens „Kto si?“ with the 2 parties and „Pridať partiu“.
- Choosing a party gives the scene with the title board and date text, 3 signposts with „obsadené X z 20“ (2, 0, 3), the noticeboard, and the status board. The red sign „Vo štvrtok vám chýba 1 miesto“ is correct for the seeded data (needs 3, holds 2).
- Tapping a signpost switches the night (`aria-pressed`). Space on a signpost works. The red sign selects its night.
- The first tap on the noticeboard collapses it to „?“. It is stored in `localStorage` and survives a reload. „?“ reopens it.
- The „Si: …“ row opens „Kto si?“. A stored party that no longer exists is dropped and the panel opens.
- `If-None-Match` gives `304`. `X-Client-Id` comes from `localStorage`. Clearing the cookie and returning to the tab gives a 401 and the code screen comes back.
- No console errors or exceptions.

Notes and follow-ups:
- Not in scope and not built, as instructed: the locked-signup sign, key icon and letter icon (T-009 and T-007). The beds layer (`app.layers.beds`) is empty and ready for T-006. `collapseNotice()` is the hook T-006 calls on the first bed tap. `hooks.addParty` is the stub for the T-007 party form. `write()` is the request helper for T-006 and T-007. It applies the `state` from successes and errors and returns `{ok, error}`.
- The page below the SVG (the scene is 380x412, so a tall phone screen has empty space) shows the plain `--bg` color, not grass. Left as is. It is a one-line change if the organizer wants it.
- Not checked: dark mode and Safari. The scene uses fixed hex colors, and panels use the CSS variables.

## Review round 1
(reviewer appends)

Scope reviewed: `static/index.html`, `tests/js/logic.test.mjs`, `tests/js/index.js` (T-004 backend changes ignored). I read the full page and test file and cross-checked against the proposal („Stránka: jedna scéna a interakcie“, „Vzhľad“, „HTTP API“), `config/chata.yaml`, and the T-004 error `params` (`own`, `retry_after`, `name`, `field`).

Tests run by me: `node --test tests/js/` gives 40 pass, 0 fail (Node 24.1). `node --test tests/js/logic.test.mjs` also gives 40/40, so `index.js` does not double-run anything. The `<script id="app">` block parses (`new Function`).

What is good:
- The logic block is pure, and the test runs it in an empty `vm` context, so any touch of `document` or `window` would throw. Every listed function is covered, including the AC cases word for word (date text, the 3 signposts, Friday arrival, `kids_in_parents_bed`, missing/extra/both/ok status, plurals 0/1/2/5, the `slot_taken` example).
- `errorText` is the only code→Slovak table. It is prototype-safe (`hasOwnProperty`, so `constructor` falls back), handles missing or null params with no `undefined` leaks, uses `params.own` and `retry_after` from T-004, and looks up the bed name from `state.layout`. A static test asserts that `.message` is never read anywhere in the page.
- No `innerHTML` or other HTML sinks. Party names go through `textContent` (panel rows, SVG text) or `setAttribute` (`aria-label`). `party.color` is set through the CSSOM, and the server validates it as `HexColor`.
- API paths are relative (statically tested). `X-Client-Id` is a 26-char random ID in `localStorage` (under the server's 64 cap). `If-None-Match` is sent with `cache: "no-store"`, and on `304` the state is kept and the age is refreshed. A 401 from poll or write brings the code screen back. A write epoch stops an in-flight poll from overwriting a newer write state.
- No geometry in code: the viewBox, paths, doors, windows, rooms and scene rects all come from `layout`. Door colors follow the containing-room rule, which is tested against all 5 config doors. The tuft pattern is derived from the viewBox.
- Accessibility: signposts, the „?“ icon, the noticeboard, the „Si: …“ row and the red/amber/none status rows are `role="button"`, `tabindex="0"`, with a Slovak `aria-label` and Enter/Space handling. Signposts have `aria-pressed`. Focus is restored by `data-key` after re-render. The dialog has `aria-modal`, Escape and a Tab trap. The panel rows, buttons and close button are at least 44 px. Signpost hit areas are 58 units (54→112), the status rows are 44, and the „?“ is 44×44. Reduced motion disables the sheet transition. Pinch zoom is not blocked.
- Slovak UI with „ “ quotes. English code and comments. No header, list view or „Zoznam“. Out-of-scope items (locked sign, key, letter) were correctly not built.

**Blocker**
- None.

**Suggestion**
1. `static/index.html:761` (`expandHit(r, titleBottom, scene.notice[1], 44)`): the signpost hit area grows all the way to whatever `title` bottom and `notice` top are, with no cap and no check that those boards are actually next to it. With the current config this gives 54→112, which is fine. But `map.scene` is meant to be editable. If the organizer moves the noticeboard below the house (say y=330), the transparent signpost hit rects would stretch over y 54→330 and cover the house rooms. The boards layer is on top of the beds layer, so in T-006 they would swallow bed taps. Cap the growth (for example, at most about 8 units into each gap, or only expand toward a neighbour that overlaps horizontally and is within a small distance). Add a `expandHit` test for a far neighbour.
2. `static/index.html:934-957` (`panel.refresh`): a poll that brings new state while „Kto si?“ is open rebuilds the list. If a party row had keyboard focus, focus drops to `body` and leaves the dialog's Tab trap. Keep the focused party id and refocus that row after the rebuild, the same way `renderBoards` does with `data-key`.
3. Status and signpost text sizes (6–6.5 units for the dates, the „obsadené“ line, the age line and the status sign lines) render at roughly 6 CSS px on a 380 px phone. The rects are fixed by Q9, but the red „V sobotu vám chýba 1 miesto“ is the most important message in the scene. Worth checking on a real phone during manual testing (T-008 checklist). If it is too small, raise only the sign text a little and wrap it to fewer words.
4. `write()` (`:537`) does not clear or update `app.etag`, so the first poll after a write always gets a full `200` instead of a `304`. This is harmless, but setting `app.etag = null` (or taking the `ETag` header if write responses carry one) states the intent.
5. `KEYS.role` stays in `localStorage` with no expiry, while the admin cookie lasts 12 h. T-009 should treat the stored role only as a hint and react to `forbidden` (its AC already does). Noting it here so the hint is not trusted later.

**Nit**
- The signpost `aria-label` says „zvolená noc“ and the button also has `aria-pressed="true"`, so screen readers announce the selection twice. Either one is enough.
- `li.muted` (`:938`) has no CSS rule. The empty-list text renders in normal ink, which is fine, but the class does nothing.

Verdict: APPROVED

Round 2 skipped, no blockers. Moving to testing.

## Review round 2
(reviewer appends)

## Test report

**Tester run, 2026-10-22.** Verdict: **PASS**. No application code changed. I added no tests, only T-005 items to `tests/manualne.md`.

Commands and results:
- `node --test tests/js/` gives 40 pass, 0 fail (Node 24.1).
- `uv run pytest -q` gives 379 passed (T-001 to T-004 regression, no failures).
- App: `create_app(data_dir="/tmp/t005/data", env={test secrets})` under uvicorn on `127.0.0.1:8023` (script `/tmp/t005/run.py`, outside the repo). Seeded through the API with 2 parties (one name is an HTML-injection string) and some `assign` calls. The real `data/` and `.env` were not used.
- Headless Chrome 155 over CDP (scripts in `/tmp/t005`, outside the repo) at 380 px wide, mobile emulation, dpr 2, light and dark scheme. Screenshots checked by eye.
- Extra check of `errorText` through `node:vm` for all 10 codes with and without params, `__proto__` as a field name, a null `party_name` and a bad date.
- Grep of `static/index.html` for `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `user-scalable`, `maximum-scale`, `.message` and absolute `/api` paths: no hits.

| Acceptance criterion | Result | How checked |
| --- | --- | --- |
| One file, `lang="sk"`, viewport, pinch-zoom allowed | pass | grep, served HTML, static Node test |
| No header, list view, „Mapa / Zoznam“ or overview page | pass | live DOM and screenshots: only the scene, the code screen and the panels |
| `<script id="logic">` pure, all listed functions | pass | the Node tests run it in an empty `vm` context. Date text, signposts, locative, presence, needed, per-night slots, used count and total (20 from layout), missing/extra, status priority, plurals, age text were also run by hand |
| `errorText` covers 10 codes, params, missing params, unknown code, no English message | pass | Node tests, plus my own `vm` run. The `slot_taken` example gives „Toto miesto má v sobotu už Riso a Ben.“ word for word |
| `node --test tests/js/` passes | pass | 40/40 |
| The page never shows the server `message` | pass | grep shows no `.message` reads. Wrong code on the code screen shows the `errorText` text |
| Code screen (Vzhľad colors, fonts, scene style; `POST api/join`; `bad_code` and `rate_limited` texts; 401 brings it back) | pass | Live: wrong code gives „Kód nesedí, skús ho zadať znova.“. After 11 wrong codes it shows „Príliš veľa pokusov za krátky čas, skús to o 58 s.“. Clearing cookies and a visibility poll bring the code screen back, and an open panel is closed. An empty submit gives „Najprv napíš kód.“ |
| „Kto si?“ panel (list, Pridať partiu stub, localStorage, opens after join, for an unknown stored party, and by tapping „Si:“) | pass | Live. Party names with `<img ...>` render as text, with 0 `img` elements in the DOM |
| Scene frame (createElementNS, viewBox, crispEdges, grass, paths, rooms, doors, windows, full width, fixed colors in dark mode, monospace text) | pass | viewBox `0 0 380 412`, `crispEdges`, svg width 380 = viewport, no horizontal overflow. In dark mode the grass stays `#79B35A` and the panel turns dark. Scene font is the monospace stack |
| Title board with event name and date text from state | pass | screenshot, `aria-label` |
| Three night signposts (label, dates, „obsadené X z 20“, highlight, tap switches the night, hit area ≥ 44 units reaching into the gaps) | pass | Counts 2/5/4 of 20 match the API. Hit rects are 58 units tall (y 54 to 112). Real mouse taps at y=57 and y=108 (gaps) select the right night |
| Noticeboard (3 lines, open first, first tap collapses to „?“, remembered, „?“ reopens) | pass | `localStorage` `chata.noticeCollapsed=1`, survives reload. Enter and Space toggle. The „?“ hit is 44×44 px. Focus stays on it |
| Status board (top row, red sign selects the night, amber note, green sign, 2 rows of 44 units each its own tap target) | pass | Missing: „Vo štvrtok vám chýba 1 miesto“, tapping selects Thursday. Plural: „V sobotu vám chýbajú 2 miesta“. Extra: „Máte o 1 miesto viac, než potrebujete“ in amber without an exclamation mark. All fine: „Všetko máte“ in green. No party: „Najprv si vyber partiu“ (tap opens „Kto si?“). Hit rects 94×44 |
| `role="button"`, `tabindex="0"`, Slovak `aria-label`, Enter and Space | pass | All tappable elements dumped. Space and Enter checked on signposts and the „?“ icon |
| Polling (30 s visible, on tab return, `If-None-Match` and 304, `X-Client-Id`, relative paths) | pass | Instrumented `fetch`: exactly one `api/state` in 31.5 s with `If-None-Match` and a `X-Client-Id` of the stored ID, status 304, age line reset to 0 s. No calls in 31.5 s while `visibilityState` was „hidden“. A `visibilitychange` to visible polls at once. An ETag-less first load gives a 200 |
| No innerHTML-type sinks, values via `textContent` or `setAttribute` | pass | grep, plus the injection-name party |
| Slovak informal UI, English code | pass | read through |

Extra scenarios tried:
- Unknown stored party id in `localStorage` opens „Kto si?“ and clears the key.
- A valid cookie with no stored party loads the scene directly and does not open the panel (only the first join does, as the AC says). Not a failure.
- Admin code join stores `chata.role=admin` and works.
- No console errors or exceptions in any run. The only network error is `GET /favicon.ico` 404 (cosmetic).
- Nothing from the repo is reachable over HTTP except `/static/*`: `/data/...`, `/config/chata.yaml`, `/files/...`, `/app/main.py`, `/.env`, `/tests/...` give 404.
- Beds, actions and the party form (T-006, T-007) are not part of this task. The locked-signup sign, the key icon and the letter icon are out of scope.

Not verifiable without a human or a real device (added to `tests/manualne.md`, section T-005): readability of the 6 to 7 unit sign texts on a real phone (the reviewer raised it too), thumb taps, Google Fonts in the WhatsApp browser, dark mode on a phone, two-device polling, and deployment under the final URL or a sub-path. I did not run Safari or Android Chrome.

Observations, not failures:
- The reviewer's suggestions still hold (signpost hit growth is uncapped for far-away neighbours, the panel refresh drops row focus, small sign text). None breaks an acceptance criterion with the current config.
- No favicon is served, so every first load logs one 404.
- Below the 412-unit scene a tall phone shows the plain `--bg` color, not grass (dev log noted this).
