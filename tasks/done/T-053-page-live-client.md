# T-053: Page: EventSource client, fallback polling, liveness indicator

- **Phase:** 1
- **Depends on:** T-052
- **Size:** M

## Goal
The page gets changes through `/api/events` instead of polling every 30 s, closes the stream when hidden, shows „aktualizované pred …“ only on a problem, and falls back to polling when streaming does not work. See proposal "Architektúra" (Čítanie), "Zmeny naživo", "Informácie v scéne" (Spodná lišta).

## Scope
- New `static/js/logic-live.js` (pure functions), new `static/js/app-live.js` (EventSource), both listed in `static/index.html` with `?v=__ASSET_VERSION__` (logic before `app-core.js`, `app-live.js` before `app-start.js`)
- `static/js/app-core.js`, `app-start.js`, `app-beds.js` (age text), `logic-model.js` (`crestAgeText`) as needed
- `tests/js/logic.test.mjs`

## Acceptance criteria
- [x] Boot: `GET /api/state` first (401 → code screen as now), then `new EventSource("api/events?party=…&client=…")` (relative path, `encodeURIComponent`, `party` omitted with no party chosen). Changing my party reopens the stream with the new id.
- [x] `state` events go through `applyState` only when their `version` is higher than the shown one; with an equal version only `presence` is taken; lower is ignored. `presence` events replace `app.state.presence` (and the server-time offset) and re-render the HUD online chips and an open „Kto si?“; `ping` only updates liveness and server time. Pending „ukladám“ changes stay drawn.
- [x] After a successful write the response state is applied as now, and no extra poll is made while the stream is open.
- [x] Hidden tab: stream closed. Visible again: stream reopened (no extra `/api/state` fetch while the stream works). `online` event: reopen if closed.
- [x] On stream `error`: one `GET /api/state`; `401` → close the stream and show the code screen. A stream in `CLOSED` state (the browser does not retry after a non-200 such as 429) is reopened by the page with a delay (a few seconds, growing, capped).
- [x] Fallback: no `EventSource`, or no `state` event received within 60 s of opening (covers a proxy that buffers), → the existing 30 s polling with its 10 s timeout runs; the stream is retried every 3 minutes and polling stops once a stream `state` arrives.
- [x] HUD: the online row is replaced by „aktualizované pred …“ when visible and the stream is in error or no event (state, presence, ping) came for more than 45 s; in fallback mode the old rule (failed poll or older than 90 s) applies. The online row returns on recovery.
- [x] Pure functions in `logic-live.js` (no DOM) with Node tests: the version guard (higher / equal / lower), the problem rule (stream mode 44 s vs 46 s, error flag; fallback mode as `crestAgeText` today), the fallback decision (60 s without a state), the reconnect delay sequence and cap, and building the events URL (encoding, no party). `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Defaults from proposal „Otvorené rozhodnutia“ (Zmeny naživo cez SSE): 45 s, 60 s, 3 min, close when hidden.
- `EventSource` cannot set headers: ids go in the query. It sends same-origin cookies by itself (no `withCredentials` needed).
- `writeEpoch` stays for poll vs write; the version guard replaces it for stream events.
- No new user-visible text is needed beyond the existing „aktualizované pred …“; any new Slovak text uses tykanie and goes in via `textContent`.
- Update `tests/manual.md` lines that say "after the next poll" only in T-054, not here.

---
## Dev log

- New `static/js/logic-live.js` (stateEventAction, liveProblemText, shouldFallBack, reconnectDelayMs, eventsUrl) and `static/js/app-live.js` (EventSource, fallback, retry), both in `index.html` with `?v=__ASSET_VERSION__`.
- `app-core.js`: `poll()` ends with `liveEnsure()` (opens the stream after the first state), 401 stops the stream, a successful write polls only when no open stream. `app-scene.js`: party change reopens the stream. `app-summary.js`: code screen stops the stream. `app-start.js`: hidden tab closes the stream, visible reopens it (no extra fetch), `online` reopens, 30 s interval polls only in fallback, the 1 s tick runs `liveTick` (60 s without a state -> fallback; retry every 3 min). `app-beds.js` `renderAge` uses `liveProblemText` (stream rule 45 s / error; polling rule kept in fallback or without a stream).
- Tests: `tests/js/logic.test.mjs` (+6). `node --test tests/js/` 293 pass; `uv run pytest -q` 534 pass.
- Not verified in a real browser (no browser run); the criteria are ticked from code and the pure-function tests. Reviewer/tester should try the stream on a phone or in a browser, including a 429 (CLOSED) reopen and a buffering proxy.
- Note: `tests/manual.md` "after the next poll" lines left for T-054.

## Review round 1

Tests: `node --test tests/js/` 293 pass, `uv run pytest -q` 534 pass. Both new scripts are in `index.html` with `?v=__ASSET_VERSION__` in the required order; no `innerHTML`, no new Slovak text. Lifecycle checked: no duplicate streams (`liveOpen` always closes the previous one and its reopen timer), the hide/show and code-screen paths stop the stream, 401 on the error poll closes it, CLOSED gets a growing reopen delay, the fallback switches both ways, and the retry interval is created once and cleared on recovery. Pending ops stay drawn because `render` goes through `withPending`.

- **Blocker 1** (`static/js/app-core.js:203-210`, `write`): the write response state is applied with no version check, and with an open stream no poll follows to correct it. Scenario: I assign a bed (response v8 is in flight). Someone else writes v9 and the stream delivers it first (it travels on a different connection). Then my v8 response arrives and `applyState` puts v8 back. The other person's change is gone from my map and stays gone until the next write anywhere: the v9 event was already used up, and nothing polls in stream mode. The same can happen with two quick writes of my own. Before T-053, the poll after every write fixed this. Fix: apply `r.json.state` only when `!app.state || r.json.state.version >= app.state.version` (otherwise just `render()` after `settle()`). Apply the same guard to the 200 branch of `poll()`, which can also overwrite a newer stream state (the poll from `liveOnError` / `online`).
- **Blocker 2** (`static/js/app-live.js`, `liveTick`): a stream that stays `OPEN` but goes silent never recovers. This is common on phones: a network switch or a NAT/proxy idle drop leaves a half-open TCP connection, and no `error` fires. `noStateSince` is already `null` by then, so there is no fallback. `liveStreaming()` stays true, so writes do not poll and the 30 s interval does not run. The HUD shows „aktualizované pred …“ (correct), but the map stays stale for as long as the tab stays visible. Pings come every 20 s, so the page can tell. Fix: in `liveTick`, in stream mode with no event for more than `LIVE_STALE_MS` (or a little more), reopen the stream (`liveOpen()`, using `reconnectDelayMs` so it does not reopen every second). The fresh stream sends the full state. Put the "needs reopen" decision in `logic-live.js` with a Node test (44 s / 46 s).
- **Suggestion**: the `online` handler (`app-start.js`) checks `!live.es`, but a CLOSED stream waiting on its backoff timer keeps `live.es` non-null, so it is not reopened at once ("reopen if closed"). Use `!live.es || live.es.readyState === 2`.
- **Suggestion**: without `EventSource`, boot makes two `GET /api/state` in a row (`poll` → `liveEnsure` → `liveFallBack` → `poll`). This is harmless (304), but `liveFallBack` could skip `poll()` when called from `liveEnsure`.

Verdict: CHANGES REQUESTED

## Dev log (fixes after round 1)

- Blocker 1: fixed. `write()` and the 200 branch of `poll()` (`app-core.js`) apply a state only when `version >= shown`; otherwise `write` just renders (etag untouched).
- Blocker 2: fixed. New `shouldReopenStale` in `logic-live.js` (Node test 44 s / 46 s); `liveTick` reopens an active, silent stream (no reopen timer, tab visible). `liveOpen` resets `lastEventAt`, so at most every 45 s.
- Suggestion 1: fixed. `online` handler reopens at once when `!live.es || readyState === 2` (calls `liveOpen` directly, since `liveEnsure` returns when `live.es` exists).
- Suggestion 2: fixed. `liveEnsure` calls `liveFallBack(true)` to skip the extra poll.
- Tests: `node --test tests/js/` 294 pass; `uv run pytest -q` 534 pass. Not run in a browser.

## Review round 2

Tests: `node --test tests/js/` 294 pass, `uv run pytest -q` 534 pass. Scripts still listed in order with `?v=__ASSET_VERSION__`.

- Blocker 1: fixed. `write()` applies the response state only when `version >= shown` (else `render()`), and `poll()` 200 does the same, so an older write or poll reply can no longer overwrite a newer stream state. With the stream open no extra poll runs, which is now safe.
- Blocker 2: fixed. `shouldReopenStale` (pure, Node test 44 s / 46 s) is used in `liveTick` to reopen an active, silent stream (visible tab, no pending reopen timer). `liveOpen` resets `lastEventAt`, so it reopens at most every 45 s, and it keeps `noStateSince`, so a buffering proxy still reaches the 60 s fallback after the stale reopen at 45 s.
- Suggestions 1 and 2: done (`online` reopens a CLOSED stream right away; `liveEnsure` skips the double poll without `EventSource`).

No new blockers. Still not tried in a real browser: the tester should check the stream on a phone (hide/show, network switch, 429 reopen).

Verdict: APPROVED

## Test report

Tester: Haiku 5.5 (tester), 2026-10-25. Scope: automated suite plus a headless Chrome run over CDP against a temporary server on port 8931 (data in `/tmp/t53/data`, removed by nothing in the repo; server and Chrome stopped afterwards). No application code changed. `tests/manual.md`: one new item added in section 3 ("Stream on a phone (T-053)").

### Commands and results
- `node --test tests/js/` : 294 pass, 0 fail.
- `uv run pytest -q` : 534 passed.
- Browser: Chrome 156 headless (`--headless=new --remote-debugging-port=9341`, temporary profile), pages in separate browser contexts (own `localStorage`, own client id), driven by a Node CDP script. Server: `uvicorn.run(create_app(...), host=127.0.0.1, port=8931, workers=1, timeout_graceful_shutdown=3)`.
- Caveat: Chrome `Network.emulateNetworkConditions(offline)` does not cut an already open stream (pings kept arriving). Offline was therefore tested as "offline plus server down", which is what a real network drop looks like.
- Caveat: real tab hiding could not be triggered in headless (switching tabs did not change `visibilityState`). Hidden tab was tested by dispatching `visibilitychange` after overriding `visibilityState`.

### Acceptance criteria
| # | Criterion | Result |
| --- | --- | --- |
| 1 | Boot: state first, then `api/events?party=…&client=…` (relative, encoded) | PASS (server log shows `GET /api/events?party=p-…&client=c-…` per page). Party change reopen not run in browser. |
| 2 | `state` version guard, `presence` events, `ping` | PASS: a write from page A reached page B's `app.state` version without a poll. Presence events reached B. Guard covered by Node tests. |
| 3 | No extra poll after a successful write while the stream is open | PASS: 0 `GET /api/state` around the write. |
| 4 | Hidden closes stream, visible reopens, no extra fetch | PASS (emulated visibility): `live.es` null when hidden, reopened `readyState 1` when visible. Real tab hiding not verifiable headless. |
| 5 | Error → one state GET, 401 closes, CLOSED (429) reopened with delay | PASS for 429 and restart: after 4 extra streams with B's client id, B's reopen got `429` then `200` after 1.5 s (`readyState 2`, `attempt 1`). 401 path not run. |
| 6 | Fallback: no EventSource or no state in 60 s → polling; retry every 3 min | Not run in browser (needs a buffering proxy or no EventSource). Node tests cover the decision. |
| 7 | HUD „aktualizované pred …“ on problem, row returns on recovery | PASS: offline plus server down: HUD showed „aktualizované pred 22 s“, after reconnecting the row returned (`errored false`, `readyState 1`). |
| 8 | Pure functions with Node tests; `node --test` and pytest pass | PASS (294 and 534). |

Extra user-requested scenarios:
- Two pages, write on one, appears on the other: PASS, within the same tick (1 ms after the write request, no poll).
- No periodic `GET /api/state` over 35 s idle with both tabs visible: PASS (0 GETs).
- Online chips when one page closes: FAIL (see bug 1).
- Offline and back: PASS as described above (offline plus server down, then back online).
- Server restart (kill and start with the same data): PASS. Stream reopened by the browser, no problem shown on the HUD.
- Hidden tab closes stream: PASS (emulated only).
- 429 (more than four streams with the same client id): PASS, recovered after the extra streams closed.

### Bug 1: a closed tab stays "online" for about 77 s
- Steps: page B (party Beta) visible with its stream open. Open page D (party Alpha), wait 4 s, close D (`Target.closeTarget`). Watch B's `app.state.presence.online`.
- Expected: Alpha leaves B's online chips at once (within about 2 s). The comment in `app/seen.py` says "a closed tab goes offline at once instead of after the window".
- Actual: Alpha stays in `online` for 77.5 s (measured twice), then drops. Cause: every plain request with `X-Party-Id` records `polled` (`app/main.py` line 303, default `polled=True`), and the boot poll and every write do that. The presence published when the stream closes still counts the party as `polled` inside `ONLINE_WINDOW = 75 s`. Stream-only tabs are fine. Nearly every tab makes a plain request, so this affects almost all closed tabs.
- Owner: server presence (T-052) and the page's expectation (T-053). The developer decides the fix; a sensible option is to clear `polled` for a party when its last stream closes and no other plain request for it is recent, or to not count the boot poll as presence.

### Other notes
- Not run: the 401 path on the stream error, party change while streaming, `online` event, buffering proxy fallback. These need a second run after the fix.
- Phone checks added to `tests/manual.md` (section 3): hidden tab and lock screen, airplane mode for 50 s.
- `tests/manual.md` line about the online row „after about 90 s“ (T-050) now conflicts with the 45 s rule. Left for T-054 as the task notes say.

### Decision
Bug 1 fails the user's expected behaviour (chips update when a page closes). Task moved to `in-progress` with this report.

## Orchestrator fix for the test failure (bug 1)
Server-side cause: plain requests with `X-Party-Id` (boot load, writes) set `polled`, which kept a party online for the 75 s window after its stream closed.
- `require_group` (`app/main.py`) records `polled=False` while the party has an open stream.
- When a party's last stream closes, `on_online_change` calls the new `SeenTracker.forget_polled` (`app/seen.py`), so the boot load before the stream does not count either.
- New test `test_requests_of_a_streaming_party_do_not_keep_it_online` in `tests/test_api_events.py` (fails on the old code, passes now). Full pytest: 535 passed.

## Review re-check
Scope: "Orchestrator fix for the test failure (bug 1)" only, diff in `app/main.py`, `app/seen.py`, `tests/test_api_events.py`.

- `require_group` now records `polled=False` while the party is in `rt.connected`, and `on_online_change` calls `SeenTracker.forget_polled` for parties whose last stream closed (under the tracker lock). `presence()` then drops the party from `online` at once, since it is neither connected nor inside the polling window. Correct, and it does not raise inside the hub callback (still wrapped in the try).
- New test `test_requests_of_a_streaming_party_do_not_keep_it_online` covers both the boot load before the stream and a request while streaming, and checks that the watcher gets the presence frame. Full pytest: 535 passed (run by reviewer). Node tests not re-run, because the fix touches no JS.

Suggestion: if one party has a streaming tab and a polling-only device at once, closing the stream also clears the polling device's window, so the party shows offline until that device polls again (at most 30 s). This is a rare case and the effect is harmless, so it does not need fixing now.

Verdict: APPROVED

## Test report (re-test after the bug-1 fix)

Tester: Haiku 5.5 (tester), 2026-10-25. Scope: the orchestrator fix (`require_group` / `forget_polled`), the re-run of the failing scenario, a two-page regression, party change while streaming, and the 401 path. No application code or tests changed. Temporary server on port 8931 (data in `/tmp/t53/data`), headless Chrome 156 on port 9341 with a temporary profile. Server and Chrome stopped afterwards, no processes left.

### Commands and results
- `node --test tests/js/` : 294 pass, 0 fail.
- `uv run pytest -q` : 535 passed.
- Browser script `/tmp/t53/cdp6.mjs` (Node CDP, one browser context per page, own client id, server `uvicorn.run(..., timeout_graceful_shutdown=3)` via `/tmp/t53/server.py`).

### Results
| Scenario | Result |
| --- | --- |
| Bug 1: page B (Beta) open, page D (Alpha) opened, D closed | PASS: Alpha left B's `online` after 103 ms (was 77 s). B kept only Beta. |
| Two-page live update: write from another client, B shows it | PASS: B's `sleeping` showed the write after 6 ms, version 3 → 4, no poll. Clear also reached B. Stream still open and `readyState 1`, no fallback. |
| Party change while streaming | PASS: stream URL changed to `api/events?party=p-vmbhwy&client=…` (Alpha), back to Beta, and with no party it is `api/events?client=…` (no `party` param). `readyState 1` each time, no error. |
| 401 path: cookie cleared, server killed and restarted | PASS: after the server came back, the page showed the code screen (`app.codeOpen`) within 1000 ms, stream closed (`live.es` null). |
| Criteria from the earlier run (boot URL, version guard, no poll after write, hidden/visible, 429 reopen, offline + server down HUD, server restart) | Not re-run; the fix touches only server presence, so they are unchanged. Earlier results stand. |

### Still not verified in a browser
- Fallback on a buffering proxy (60 s without a state → polling, retry every 3 min): covered by the Node tests and the "Behind Caddy" item in `tests/manual.md` (section 3, T-052 item).
- A real tab hide (headless cannot switch tabs): covered by the phone item in `tests/manual.md`.

### Decision
All criteria pass in the re-test, no regressions in the Node or pytest suites. Task moved to `done/`.
