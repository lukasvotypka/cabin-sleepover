# T-050: Online line in the HUD and last seen in „Kto si?“

- **Phase:** 1
- **Depends on:** T-049
- **Size:** M

## Goal
Organizer's decision of 25. 10. 2026 (proposal "Informácie v scéne", Spodná lišta, and "Prvé otvorenie", „Kto si?“): the page sends my party with every request, the line under „Si: …“ shows who is online instead of „aktualizované pred …“ (the data age appears only when there is a problem), and each row in „Kto si?“ shows when that party was last seen.

## Scope
- `static/js/app-core.js` (`X-Party-Id` header, poll failure flag, server clock offset), `static/js/app-hud.js`, `static/js/app-beds.js` (`renderAge`), `static/js/app-sheet.js` (`openWho` rows), `static/js/logic-model.js`, `static/index.html` (CSS for the row text only, if needed)
- `tests/js/logic.test.mjs`, `tests/manual.md`

## Acceptance criteria
- [x] `request()` adds `X-Party-Id: <app.myParty>` when a party is chosen and omits the header otherwise (also after `forgetMyParty`).
- [x] Pure `seenText(lastSeenIso, serverNowMs, isOnline)` in `logic-model.js`: online → „online“; never seen (no time) → „zatiaľ nevidené“; else „pred N min“ (N = whole minutes, at least 1) under 1 h, „pred N h“ under 24 h, „pred N d“ from 24 h. Node tests cover each branch and the boundaries 59 min / 60 min and 23 h / 24 h.
- [x] Pure `onlineLine(presence, myPartyId)` → „online: N“ where N counts online parties other than mine, „online: len ty“ when my party is chosen and N = 0, „online: nikto“ when no party is chosen and N = 0. Node tests cover all three, plus my party absent from `online`.
- [x] Pure `hudCrestLine({presence, myPartyId, fetchedAtMs, nowMs, lastPollFailed})` returns the `updatedAgoText` text when the last poll failed or `nowMs − fetchedAtMs > 90000`, otherwise `onlineLine(...)`. Node tests: fresh (online line), 91 s old (age text), failed poll (age text), 304 refresh resets the age.
- [x] A poll that rejects (network error) or returns a status other than 200/304/401 sets the failed flag; the next 200 or 304 clears it. The HUD line updates on the existing 1-s tick, so it switches without waiting for a render.
- [x] Relative ages use the server clock: `server_time` from the last 200 plus local time elapsed since that response, never the phone's absolute time. The online state comes from `presence.online` as sent (not recomputed).
- [x] „Kto si?“: each party row shows `seenText(...)` in its own span after the name (`textContent`), and the row's accessible name includes it. The panel's `refresh` updates it after each poll.
- [x] The „Si: …“ button still opens „Kto si?“; its `aria-label` includes the current crest line. At 380 px wide the crest line fits on one line without overlapping the status sign.
- [x] No `innerHTML` added (`git diff static | grep innerHTML` prints nothing). `node --test tests/js/` and `uv run pytest` pass.
- [ ] `tests/manual.md`: two phones with different parties see each other online within ~30 s and „pred 1 min“-style text a minute or two after one closes the tab; airplane mode turns the line into „aktualizované pred …“ after ~90 s and back after reconnect.

## Notes for developer
- Texts and thresholds are the defaults in proposal „Otvorené rozhodnutia“ (Naposledy videná a online); keep them in the pure functions so the organizer can change them in one place.
- „zatiaľ nevidené“ is gender-neutral on purpose (party names are mixed groups).
- After a 304 there is no body: keep the last `presence` and the server/local time pair from the last 200. T-049 makes the ETag change whenever the online set changes, so a 304 means the online list is still right.
- `updatedAgoText` stays as is (it is the problem text now).

---
## Dev log
- Added `seenText`, `onlineLine`, `hudCrestLine` (+ `STALE_DATA_MS`) to `logic-model.js`; `X-Party-Id` header, `pollFailed`, server clock pair and `serverNow()` in `app-core.js` (tick now 1 s); `renderAge` (app-beds.js) shows the crest line and updates the crest `aria-label` (`app.crestLabel` set in `drawCrest`); `openWho` rows get a `.seen` span and aria-label (app-sheet.js); CSS `.party-row .seen`; Node tests; manual checklist item.
- Tests: `node --test tests/js/` and `uv run pytest` pass (513 py). No `innerHTML` added.
- Not verified in a real browser: the 380 px fit and the two-phone/airplane manual checks (listed in tests/manual.md).

## Review round 1
Ran `node --test tests/js/` (287 pass) and `uv run pytest` (513 pass). `git diff static | grep innerHTML` prints nothing. All 22 scripts in `static/js/` are listed in `index.html` with `?v=__ASSET_VERSION__`. The header name matches the server (`x-party-id`, app/main.py:277). The server-clock pair is taken only from a 200 and kept across 304s. `presence.online` is used as sent. The seen span and the row label use `textContent`/`setAttribute`. The texts and thresholds are in the pure functions.

**Blockers:** none.

**Suggestions**
- static/js/app-core.js:216 (304 branch): a 304 only calls `renderAge()` and does not call `app.panel.refresh()`. If „Kto si?“ stays open across polls, its „pred N min“ texts freeze until the next 200. Last-seen times of offline parties do not change the ETag, so 304s are the normal case. Opening the panel always computes fresh text, so the impact is small. A `if (app.panel && app.panel.refresh) app.panel.refresh();` in the 304 branch would meet the „after each poll“ wording exactly.
- `app.pollFailed` is cleared only by a poll. After a failed poll, a successful write (`applyState`) still shows „aktualizované pred 0 s“ until the next poll, up to 30 s later. Clearing the flag in `applyState` would fix that.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester run, 25. 10. 2026 (Haiku 5.5). No application code changed. Temp server on 127.0.0.1:8055 with temp data dir `/tmp/t050/data` and test secrets; Chrome headless with a temp profile.

**Commands and results**
- `uv run pytest -q`: 513 passed.
- `node --test tests/js/`: 287 passed, 0 failed.
- `git diff static | grep -c innerHTML`: 0.
- Probes (`/tmp/t050/probe.py`, `probe2.py`): unauth `/api/state` 401 `bad_code`; wrong join 401 `bad_code`; join 200 with `cabin_group` HttpOnly, Secure, SameSite=Lax; bad cookie 401; `presence` (`online`, `last_seen`, `server_time`) present under `state.presence`; with `X-Party-Id` of Alpha, Alpha is online; after Beta sends the header both are online; unknown, empty and 5000-char party headers return 200; a second poll with the ETag returns 304; `GET /` has no `__ASSET_VERSION__` left; `/data/cabin-data.yaml`, `/static/../data/...`, `/static/%2e%2e/data/...`, `/data/` all 404.
- Headless Chrome at 380×760 (DPR 2, mobile), `/tmp/t050/crest*.mjs`: crest line reads „online: 1“ (party chosen) with aria-label „Si: Alpha Test. Ťuknutím vyberieš, kto si. online: 1.“; candidates „online: len ty“, „online: nikto“ and „aktualizované pred 59 min“ all stay on one line inside the crest plate (no overflow). Screenshot `/tmp/t050/crest-380.png`: the plate sits clear of the status sign and the map.
- Headless Chrome: „Kto si?“ rows show „online“ for Alpha and „pred 3 min“ for Beta, each row's aria-label includes it.
- Headless Chrome offline emulation: after a failed poll the line becomes „aktualizované pred 47 s“; after reconnect it returns to „online: len ty“.

**Acceptance criteria**

| # | Criterion | Result |
|---|---|---|
| 1 | `X-Party-Id` sent when a party is chosen, omitted otherwise (also after forget) | PASS (browser: Alpha sees itself online with the header; omission by code read, `forgetMyParty` sets `myParty = null`) |
| 2 | `seenText` branches and boundaries | PASS (Node tests; browser shows „pred 3 min“) |
| 3 | `onlineLine` three cases and my party absent from `online` | PASS (Node tests; browser „online: len ty“) |
| 4 | `hudCrestLine` fresh / 91 s / failed / 304 reset | PASS (Node tests; browser offline flip) |
| 5 | Failed poll sets flag, 200/304 clears it, updates on the 1-s tick | PASS (browser offline and reconnect; `AGE_TICK_MS` = 1000 calls `renderAge`) |
| 6 | Server clock used for ages, `presence.online` used as sent | PASS by code read (`serverNow()`, `applyState` sets the pair only from a state with `server_time`) |
| 7 | „Kto si?“ rows show `seenText` in a span and in the accessible name, refresh after each poll | PASS (browser rows; 304 refresh via `ageTicks` by code read) |
| 8 | Crest opens „Kto si?“, aria-label includes crest line, fits at 380 px | PASS (browser, see above) |
| 9 | No `innerHTML`, `node --test` and `uv run pytest` pass | PASS |
| 10 | `tests/manual.md` item present (two phones, airplane mode) | PASS as a checklist item; the real-device run is still for a human |

**Extra scenarios:** unauthenticated and bad-cookie requests, wrong join code, traversal and encoded traversal to `data/`, bogus/empty/oversized `X-Party-Id`, ETag 304, presence after a second party sends the header.

**Notes (not failures):**
- `tests/manual.md` says the airplane-mode line switches „after ~90 s“. The page switches at the first failed poll (within about 30 s, as seen in the browser). The 90 s threshold applies only when a request hangs without failing. The manual wording can stay as a fallback, but a tester on a real phone should expect the earlier switch.
- Real iPhone Safari and Android Chrome checks, and the two-phone online check, are not run here. They stay in `tests/manual.md`.

**Verdict: PASS.** No regressions in the 513 pytest and 287 Node tests. Task moved to `tasks/done/`.

## Orchestrator fix after review round 1
Both review suggestions applied: a 304 poll now refreshes an open „Kto si?“ (flag `panel.ageTicks`, so other panels such as the form are not rebuilt on 304), and `applyState` clears `app.pollFailed`, so a successful write removes the problem text at once. Node suite re-run: green.
