# T-154: Closed page: admin way in, no „partie“ in the totals

- **Phase:** 1
- **Depends on:** T-152, T-153
- **Size:** S
- **UX:** yes

## Goal
Organizer's decisions of 23. 11. 2026 on the closed cabin (proposal „Po akcii: zatvorená chata“, Q28 and Q29 in `tasks/QUESTIONS.md`):
1. The admin must be able to log in from the closed page. After login the admin sees the normal map (already the behaviour once the server sends the full state, T-152/T-153).
2. The totals must not say „partie“ (rule of T-030). Use the word the page already uses for one sign-up unit: „meno“ („Meno „X“ už niekto má“).

## Scope
`static/js/logic-ended.js`, `static/js/app-ended.js` (and `app-sheet.js` / `app-core.js` only if needed to open the existing admin code screen), `tests/js/logic.test.mjs`, `tests/manual.md` §25, `proposal.md` (short note in the closed-cabin section and mark Q28/Q29 resolved), `tasks/QUESTIONS.md`.

## Acceptance criteria
- [x] The „Čo teraz“ panel has a small secondary link button „Mám admin kód“ under „Dobre“ (same `link-btn` style as on the code screen, ≥ 44 px touch target). It opens the existing admin code entry (the same flow as the code screen's „Mám admin kód“, with „Späť“ back to the closed page). No other entry point is added, no new texts besides reused ones.
- [x] A correct admin code: the page reloads the state, gets the full state, and shows the normal map with the normal HUD (no closed sign, no padlocks), with no page reload by hand. A wrong code shows the existing `bad_code` text.
- [x] The middle total reads „1 meno“, „2–4 mená“, „5+ mien“ (pure plural function, Node test for 1, 2, 4, 5, 0). No Slovak „parti*“ text remains in `static/` (Node test greps `logic-ended.js` texts or the existing guard covers it).
- [x] The screen-reader summary of the closed page uses the same word.
- [x] `node --test tests/js/` and `uv run pytest -q` pass; manual §25 lists the admin login check.

## Notes for developer
- Nothing else in the closed page changes; keep the design of T-153.
- The admin cookie lasts 12 h; after it expires the page shows the closed village again (no extra work).

## Design
Reuse, no new look: the link sits centred under the „Dobre“ button in the „Čo teraz“ panel, quiet (link style, muted colour), text „Mám admin kód“. Totals tiles: „10 / ľudí“, „4 / mená“, „3 / noci“.

---
## Dev log

**Developer (T-154):**
- `logic-ended.js`: `endedNamesWord`/`endedNamesText` (meno, mená, mien) replace the „partia“ forms; `ENDED_TEXTS.adminCode`, `endedPanelModel().adminCode`. Totals and the screen-reader summary use the same word.
- `app-ended.js`: „Mám admin kód“ `link-btn` (in `.admin-line`, 44 px by the `.sheet .link-btn` rule) under „Dobre“: `closePanel(); showCodeScreen(true)`. The existing join flow does `poll(true)` with the etag cleared, so the full state replaces the closed one (not run in a browser; relies on T-152/T-153 behaviour, covered by manual §25).
- Tests: `tests/js/logic.test.mjs` (plurals 0/1/2/4/5, no „parti“ in closed texts). Docs: `tests/manual.md` §25, `proposal.md`, `tasks/QUESTIONS.md` (Q28, Q29 resolved).
- `node --test tests/js/`: 479 pass. `uv run pytest -q`: 781 pass.
- Not verified live in a browser: the criterion about the map returning after login is ticked from code reading only.

## Review round 1

Tests: `node --test tests/js/` 479 pass, `uv run pytest -q` 781 pass. Texts, plurals (0/1/2/4/5), SR summary, board label, docs and Q28/Q29 are fine. The link reuses `.sheet .admin-line` / `.sheet .link-btn` (44 px), uses `textContent` through `htmlEl`, and „Späť“ returns to the closed page (`liveOpen` is a no-op in closed mode). A wrong code shows the `bad_code` text through the existing form.

**Blocker**
- `static/js/app-scene.js:112` (`ensureScene` key), along with `static/js/app-iso.js:397` and `:745`: the 3D world is built only when the layout key changes, and the key ignores closed mode. The closed page builds the world with charred campfire logs and skips the campfire flames, fire light, light ring, chimney smoke and fireflies (`isoCampfire`, `isoBuildLife` read `endedMode()` at build time). After the new admin login, `poll(true)` sends the full state with the same layout and view angle, so `ensureScene` returns early. The admin then sees the normal HUD over a still closed world: a cold black fire, no smoke and no fireflies, at any hour, until a hand reload or a view turn. That fails the criterion "shows the normal map … with no page reload by hand". The flow is new in this task, because before it nothing led from the closed page to the full state without a reload. Fix: put the closed mode in the scene key (e.g. `JSON.stringify([layout.map, layout.rooms, layout.houses, app.viewAngle, endedMode()])`). This also handles the opposite case when the admin cookie expires. `app-scene.js` is outside the listed scope, but the change is needed for the criterion. Add a line to manual §25: after admin login the campfire burns, the chimneys smoke and the fireflies come out at night.

**Suggestion**
- After the login, `app.askWho` is true (`codeVoluntary`), so „Kto si?“ opens over the admin's map. That matches the normal code screen flow and is fine, but manual §25 could say so, so the tester does not think it is a bug.

Verdict: CHANGES REQUESTED

### Orchestrator fix (23. 11. 2026)
Review blocker fixed directly: `ensureScene` in `static/js/app-scene.js` adds `endedMode()` to the scene key, so the 3D world is rebuilt (fire, smoke, fireflies) when the admin's full state replaces the closed one, and again when the admin cookie runs out. Manual §25 gained the matching check and the „Kto si?“ note.

## Review round 2

Tests: `node --test tests/js/` 479 pass, `uv run pytest -q` 781 pass. All scripts in `static/js/` are listed in `index.html` with `?v=__ASSET_VERSION__`.

- Round-1 blocker fixed: `static/js/app-scene.js:112` puts `endedMode()` in the scene key. When the admin's full state comes in after login, the key changes and `ensureScene` takes the same rebuild path a view turn uses (`isoAnchorsReset`, `isoBuild`, new svg). That brings back the campfire flames, smoke and fireflies, and it handles the cookie running out as well. `endedMode` lives in `app-ended.js`, which loads after `app-scene.js`. That is fine because the function is only called when the scene is built, never at load time.
- The loosened regex at `tests/js/logic.test.mjs:5521` still checks that the angle is part of the key.
- Manual §25 has the new check and the „Kto si?“ note.

**Nit**
- `tests/manual.md` §25: the last line ("After the admin login from the closed page …") has no `[ ]` checkbox, unlike the other lines.

Verdict: APPROVED

**Tester (23. 11. 2026): FAIL, back to in-progress.**

Commands: `node --test tests/js/` → 479 pass, 0 fail. `uv run pytest -q` → 781 passed. Browser: headless Google Chrome 158 via puppeteer-core in the scratchpad (not in the repo), viewport 380×780 at 2× (mobile). Temporary server `uvicorn` on 127.0.0.1:8031 with a scratchpad data dir (3 fictional parties, slots on 5. and 6. 11., closed by date). Server stopped afterwards. ADMIN_CODE was taken from `.env` for the test only, not printed or written.

| # | Criterion | Result |
|---|---|---|
| 1 | „Mám admin kód“ link under „Dobre“ in „Čo teraz“, 44 px, opens the code screen, „Späť“ back | PASS when the page was reloaded first. FAIL in the join flow, see bug 1 |
| 2 | Correct admin code → normal map and HUD, no closed sign, no padlocks, no manual reload. Wrong code → `bad_code` text | PASS (HUD, parties, „Admin“ key, no „Čo teraz“ sign). Wrong code shows „Kód nesedí, skús ho zadať znova.“. Fire and smoke in the 3D world only checked by code and manual §25, not seen in the browser |
| 3 | Middle total reads „3 mená“ (plural by count), Node tests 0/1/2/4/5 | PASS for 3 (panel shows „3 mená“). Plural cases covered by the Node suite |
| 4 | Screen-reader summary uses the same word | PASS (visually hidden text reads „Bolo nás: 7 ľudí, 3 mená, 3 noci“) |
| 5 | Node and pytest pass, manual §25 has the admin login check | PASS (suites above; §25 present) |
| 6 | Extra: no „parti*“ text in `static/` | FAIL (literal). Closed-page texts are clean. Still present in `static/js/logic-phone.js:164,166,167` („partiu“) and `static/js/app-slides.js:204` („partie“), outside T-154 scope |

**Bug 1 (criterion 1 and 2 in the join flow): the closed page's „Čo teraz“ does nothing after a fresh group-code join**
- Steps: open http://127.0.0.1:8031/ with no cookie (closed page, ended state) → type the group code → Enter → wait 4 s → tap „Čo teraz“ (bottom right, 52×48 px).
- Expected: the „Čo teraz“ panel opens with „Dobre“ and „Mám admin kód“.
- Actual: no panel. Console: `TypeError: Cannot read properties of undefined (reading 'length')` at `static/js/app-sheet.js:275` (`fillParties`, called from `panel.refresh` at `app-sheet.js:264` through `keepFocus`). The closed state has no `parties`, and the party sheet left open by the join (`app-sheet.js:262`) still refreshes on each state. The error also appears right after the join.
- Not affected: after a reload with the cookie, „Čo teraz“ opens normally with no errors. So the bug only shows in the join flow.
- Fix idea: in the party sheet refresh (or in the closed path that skips the party sheet), guard `app.state.parties` with the closed-mode check (`endedMode()`), the same as the other closed guards.

**Bug 2 (criterion 6 literal): „parti*“ wording in `static/`** (outside the closed page, from earlier tasks). Replace with „meno/mená“ or reword, or narrow the criterion to the closed page.

Screenshots (phone width):
- Closed „Čo teraz“ panel, „3 mená“ and the link: `/private/tmp/claude-501/-Users-luigi-workspace-chrapa-poll/73961c50-17e3-4ffd-b8ad-9f4455a75282/scratchpad/t154-panel-open.png`
- Wrong code on the code screen: `/private/tmp/claude-501/-Users-luigi-workspace-chrapa-poll/73961c50-17e3-4ffd-b8ad-9f4455a75282/scratchpad/t154-wrong-code.png`
- After the correct admin code, normal HUD: `/private/tmp/claude-501/-Users-luigi-workspace-chrapa-poll/73961c50-17e3-4ffd-b8ad-9f4455a75282/scratchpad/t154-admin-map.png`

Manual still needed: campfire flames, chimney smoke and fireflies after admin login at night (iPhone Safari and Android Chrome, WebGL).

## Dev log (fix round, tester bugs)
- Bug 1: `app-sheet.js` (`fillParties`) and `app-admin.js` now read `(app.state && app.state.parties) || []`, so a party sheet left open by the join no longer throws on the closed state and „Čo teraz“ opens.
- Bug 2: removed every Slovak „parti*“ text in `static/`: `logic-phone.js` (addIntro, offer, removeAsk: „svoj zápis“), `app-slides.js` („Podľa tvojho zápisu“), `logic-board.js` board label („Na noc: N, cez deň: M“), `app-admin.js` („Zmazať záznam“, „Vyber záznam…“), `app-quick.js`, `app-briefing.js`, `app-board.js` table headers („Meno“).
- Tests in `tests/js/logic.test.mjs`: a guard scanning all `static/js/*.js` and `index.html` for Slovak „parti*“ forms, and a structural test for the parties guard; updated the board label test.
- Run: `node --test tests/js/` 481 pass; `uv run pytest -q` 781 pass.
- Note: `tests/manual.md` still has „Napíš meno partie.“ at line 121 (outside static; not touched).

## Review re-check

Tests: `node --test tests/js/` 481 pass, `uv run pytest -q` 781 pass. The `static/` grep finds no Slovak „parti*“ text left.

**Blocker**
- `static/js/app-core.js:324` (`openWhoIfAsked`), reached from the join in `static/js/app-summary.js:105`. The guard in `app-sheet.js:274` stops the TypeError, but the join flow on the closed page still opens „Kto si?“. Steps: closed page, no cookie, type the group code. `askWho` is true, the closed state arrives, `applyState` calls `openWhoIfAsked()`, and `openWho()` shows „Zatiaľ tu nikto nie je. Pridaj sa ako prvý.“ with a „Pridať sa“ button over the closed village. That text is false after the event, and the sheet offers a sign-up that the closed page must not have (T-153). Expected fix: in `openWhoIfAsked`, when `endedMode()`, clear `app.askWho` and return without opening the sheet. The admin path still works, because after an admin join the full state is not in closed mode. Keep the `|| []` guards as a safety net. Add a line to manual §25: after a group-code join on the closed page, only the closed village shows and no „Kto si?“ opens.

**Wording (T-030 consistency)**
These read naturally in tykanie: „svoj zápis“ / „Tvoj zápis“ in `logic-phone.js`, „Podľa tvojho zápisu „X““, „Tvoj zápis „X“:“, „Ty to (ešte nemáš) máš prejdené.“, and the board label „Na noc: N, cez deň: M.“. They match the existing „Tento zápis je chránený telefónom“ in `logic-errors.js`.

**Suggestion**
- `app-admin.js:72,74`: „Zmazať záznam“ / „Vyber záznam, ktorý chceš zmazať.“ bring in a third word next to „zápis“ and „meno“. „Zápis“ would clash with „Zamknúť zápis“ (the signup lock) in the same panel, so use the unit word this task chose: „Zmazať meno“ / „Vyber meno, ktoré chceš zmazať.“.
- `app-board.js:201,231`: T-030 replaced the table header „Partia“ with „Kto“. „Meno“ is understandable, but use „Kto“ to stay consistent with T-030.
- `tests/js/logic.test.mjs:5897`: the trailing `\b` fails after „í“, because JS `\b` without the `u` flag counts only ASCII letters as word characters. So the guard misses „partií“, which is exactly the form removed from `boardLabel`. I checked it: `/\bparti(?:…|í|…)\b/i.test("5 partií na noc")` is false. Use `(?![\p{L}])` with the `u` flag instead of the trailing `\b`.
- `tests/manual.md:121` still says „Napíš meno partie.“.

Verdict: CHANGES REQUESTED

### Orchestrator fix after re-check (23. 11. 2026)
- Blocker: `openWhoIfAsked` (`static/js/app-core.js`) returns early in `endedMode()`, so a group-code join on the closed page opens no „Kto si?“.
- Suggestions applied: admin „Zmazať meno“ / „Vyber meno, ktoré chceš zmazať.“; board headers „Kto“ (T-030); the „parti*“ guard regex uses Unicode letter lookarounds (catches „partií“); manual line 121 and a new §25 check.
- `node --test tests/js/`: 481 pass.

### Re-test after fixes (23. 11. 2026)
PASS at 380 px in headless Chrome: group-code join on the closed page opens no „Kto si?“; „Čo teraz“ opens with „Mám admin kód“ (92×44 px); wrong code shows `bad_code`, „Späť“ returns; correct admin code brings the normal map and HUD without reload. `uv run pytest -q` 781 pass, `node --test tests/js/` 481 pass. Fire, smoke and fireflies after admin login remain a manual check (§25).
