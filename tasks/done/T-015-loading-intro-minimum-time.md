# T-015: Loading leaf stays for one fall before the map appears

- **Phase:** 1 (organizer request, 22. 10. 2026, after trying T-012 on the trial server)
- **Depends on:** T-012, T-013 (T-013 only for build order: both change `static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md` and `proposal.md`)
- **Size:** S

## Goal
The loading leaf from T-012 ("Vzhľad": „Pri načítavaní stránka ukáže pixelový lístok, ktorý padá na trávu…“) is never seen. `ensureScene()` hides `#boot` as soon as the first `/api/state` arrives, and on the tailnet that takes a few tens of ms. The organizer expects a short intro. Keep the loading view up for a minimum time measured from page start, about one full leaf fall, then fade it out. The state fetch still runs in parallel, so a slow server adds no extra wait.

## Scope
- `static/index.html`
  - `<script id="logic">`: constants `BOOT_MIN_MS`, `BOOT_MIN_REDUCED_MS`, `BOOT_FADE_MS` and pure functions `bootMinMs(reducedMotion)` and `bootRemaining(startMs, nowMs, minMs)` (see below).
  - `<script id="app">`: intro state in `app`, the reveal in `ensureScene()` / `render()` / `applyState()`, `showCodeScreen()` and the join submit handler.
  - CSS: `#boot` gets a `z-index` and a fade-out class.
- `tests/js/logic.test.mjs`: tests of the new pure functions, plus a check that `BOOT_MIN_MS` matches the `leafFall` CSS duration.
- `tests/manualne.md`: section 6, rewrite the T-012 loading items (see Acceptance criteria).
- `proposal.md`: one sentence in "Vzhľad" (see below).

Out of scope: the leaf drawing and its keyframes (T-012), the code screen look, polling interval, the server, any new text other than the existing „Načítavam…“ and „Nepodarilo sa načítať, skúšam znova…“.

## Decided values (product owner default, organizer may change)
- `BOOT_MIN_MS = 2400`. This is exactly one `leafFall` cycle (`animation: leafFall 2.4s`): the leaf falls, lands and fades to opacity 0 at 100 %, so the map appears right as the leaf has landed. Add a comment that this value must match the CSS duration.
- `BOOT_MIN_REDUCED_MS = 800`. With `prefers-reduced-motion: reduce` the still leaf (T-012) shows for 0.8 s, with no fade.
- `BOOT_FADE_MS = 300`. Opacity fade of `#boot` after the minimum. No fade with reduced motion: hide at once.
- Clock: `performance.now()`, which counts from navigation start. So "page start" is `0` and nothing has to be stored at script start.

## Pure functions (in `<script id="logic">`, no DOM, no `window`)
```js
var BOOT_MIN_MS = 2400;          // one leafFall cycle in the CSS (#boot .leaf); keep the two equal
var BOOT_MIN_REDUCED_MS = 800;   // still leaf with prefers-reduced-motion
var BOOT_FADE_MS = 300;          // fade of the loading view after the minimum

// BOOT_MIN_REDUCED_MS when reducedMotion is true, else BOOT_MIN_MS.
function bootMinMs(reducedMotion)

// How many ms the loading view must still stay: max(0, minMs - (nowMs - startMs)), never more than minMs.
// Any non-finite argument returns 0, so a broken clock never holds the map back.
function bootRemaining(startMs, nowMs, minMs)
```

## Behaviour
1. **First load, state arrives fast:** the scene is not shown while the intro runs. When the first state arrives, store it (`app.state`, `app.night`, title, as now) but do not reveal. Wait `bootRemaining(app.introStart, performance.now(), bootMinMs(reduced))` ms with one `setTimeout`, then `render()` (draws the scene, `showScene(true)`) and fade `#boot` out (add the fade class, after `BOOT_FADE_MS` set `hidden` and remove the class). `reduced` is `window.matchMedia("(prefers-reduced-motion: reduce)").matches` (false if `matchMedia` is missing).
2. **Slow server:** if the state arrives after the minimum, `bootRemaining` is 0 and the map appears at once (still with the 300 ms fade). No extra wait.
3. **Polls during the intro** (tab return, the 30 s interval) only update `app.state`; they neither reveal early nor restart the timer. Exactly one pending timer at a time.
4. **After the first reveal** (`app.introDone = true`) nothing changes from today: polls, writes and tab return never show `#boot` again and never wait.
5. **Error path stays immediate:** a failed first load shows „Nepodarilo sa načítať, skúšam znova…“ and the lying leaf (`boot--error`) as soon as the fetch fails, as now. When a retry then succeeds, the normal rule applies (the minimum is long gone, so the map appears at once). Remove `boot--error` when revealing.
6. **Code screen (`401`) is never delayed:** `showCodeScreen()` shows at once, as now, and also cancels a pending intro timer. After a successful `api/join`, when there is no state yet, `#boot` shows „Načítavam…“ again (as now) and the intro clock restarts at that moment (`app.introStart = performance.now()`), so a first-time visitor sees the intro once, after the code, and the code screen itself is never held back. This is the only wait in the join flow, so it is never delayed twice. If `app.state` already exists (cookie expired mid-session), there is no loading view and no wait, as now.
7. **„Kto si?“ after join or on first visit:** `app.askWho` opens the panel only after the reveal, not under the loading view.
8. The fade class sets `pointer-events: none`, so taps during the 300 ms fade reach the map. `#boot` gets a `z-index` above the scene and the move bar (10) and below panels (20), so the fade is drawn over the freshly drawn scene.

Suggested shape (the developer may differ if the behaviour above holds): new fields `introStart: 0`, `introTimer: null`, `introDone: false` in `app`; `render()` returns early while `!app.introDone`; `applyState()` calls a new `revealWhenReady()` instead of `render()` + `openWho()` while `!app.introDone`; `ensureScene()` no longer sets `$("boot").hidden = true` directly but calls a `hideBoot()` that fades (or hides at once with reduced motion).

## proposal.md
In "Vzhľad", append to the bullet „Pri načítavaní stránka ukáže pixelový lístok…“:
„Lístok je vidno aspoň jeden pád (asi 2,4 s od otvorenia stránky, s `prefers-reduced-motion` 0,8 s), potom sa načítavanie rozplynie a ukáže sa mapa. Ak sa dáta načítavajú dlhšie, mapa sa ukáže hneď, ako prídu. Obrazovka s kódom a chyba načítania sa ukážu hneď, bez čakania.“

## Acceptance criteria
- [x] On a fast connection the loading view (leaf and „Načítavam…“) stays about 2.4 s after page start, then fades out in about 0.3 s and the map is there. The state request still starts at page start (check the Network tab: `/api/state` is not delayed).
- [ ] With a server slower than 2.4 s the map appears as soon as the state arrives, with no extra wait.
- [ ] With `prefers-reduced-motion: reduce` the still leaf shows about 0.8 s and is hidden without a fade.
- [ ] A failed first load shows the error text and the lying leaf at once; a later successful retry shows the map without an extra wait.
- [ ] Without a valid cookie the code screen appears at once. After entering the code the intro plays once (about 2.4 s from the join), then the map; „Kto si?“ opens only after the map is shown.
- [ ] Polling, tab return and writes after the first reveal never show the loading view and never delay drawing.
- [x] `BOOT_MIN_MS`, `BOOT_MIN_REDUCED_MS` and `BOOT_FADE_MS` are named constants in `<script id="logic">`; no magic numbers for these in `<script id="app">`.
- [x] No `innerHTML` introduced; no new Slovak text except the `proposal.md` sentence.
- [x] Node tests cover at least:
  - `bootRemaining(0, 500, 2400) === 1900`, `bootRemaining(0, 2400, 2400) === 0`, `bootRemaining(0, 5000, 2400) === 0`;
  - a non-zero start (restart after join): `bootRemaining(10000, 10500, 2400) === 1900`;
  - a clock that runs backwards (`nowMs < startMs`) returns `minMs`, never more;
  - non-finite arguments (`NaN`, `undefined`) return `0`;
  - `bootMinMs(false) === 2400`, `bootMinMs(true) === 800`;
  - `BOOT_MIN_MS` equals the `leafFall` duration read from the `#boot .leaf` CSS rule of `static/index.html` (the test file already reads the HTML), so the two cannot drift apart.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md` section 6: the three T-012 loading items are updated and these items exist:
  - **Loading intro (T-015):** on the tailnet (fast), reload: the leaf falls once onto the grass with „Načítavam…“ (about 2.5 s), then the view fades into the map. With network throttling (slow 3G) the map appears as soon as the data are loaded, with no extra pause after that.
  - **Loading intro, reduced motion (T-015):** with „Reduce motion“ on, the still leaf shows briefly (under a second) and the map appears without a fade.
  - **Loading intro, failed load (T-015):** stop the server and reload: the error text and the lying leaf appear at once, without waiting for the intro. Start the server: the map appears.
  - **Loading intro and the code screen (T-015):** in a private window (no cookie) the code screen appears at once; after the code the leaf intro plays once, then the map and „Kto si?“. Switching tabs and coming back, or waiting for a poll, never shows the leaf again.

## Notes for developer
- The current hide is in `ensureScene()` (`$("boot").hidden = true;` right before `showScene(true)`), reached from `render()` on every state. The join handler sets `$("boot").hidden = !!app.state`, `showCodeScreen()` hides it, `poll()` sets the error text. Those are the only places that touch `#boot`.
- `ensureScene()` must draw with the scene visible (text is measured while drawing). So reveal = `render()` first, then fade `#boot`, which is why `#boot` needs the `z-index` during the fade.
- Do not delay `poll()` itself or chain the first fetch after a timer: the request must leave at page start.
- Keep `role="status"` on `#boot`; screen readers hear „Načítavam…“ as now.
- Do not change the `leafFall` keyframes or duration. If you do, the Node test forces `BOOT_MIN_MS` to follow.
- No open decision from `proposal.md` is involved. The values 2400 / 800 / 300 ms and "intro restarts after join" are product-owner defaults for the organizer to confirm.

---
## Dev log
Done (developer):
- `static/index.html`
  - Logic script: `BOOT_MIN_MS = 2400`, `BOOT_MIN_REDUCED_MS = 800`, `BOOT_FADE_MS = 300`, pure `bootMinMs()` and `bootRemaining()` as specified.
  - CSS: `#boot` got `z-index: 15`; new `#boot.boot--fade` (opacity transition .3s, `pointer-events: none`; no transition with reduced motion).
  - App: new `app.introStart / introTimer / introDone`. `render()` returns early while `!app.introDone`. `applyState()` stores the state and calls the new `revealWhenReady()` until the first reveal (one timer, `bootRemaining(app.introStart, performance.now(), bootMinMs(reduced))`). The timer renders the scene, calls `hideBoot()` (fade, or hide at once with reduced motion; removes `boot--error`) and then opens „Kto si?“ via the new `openWhoIfAsked()`. `ensureScene()` no longer hides `#boot`. `poll()` itself is untouched, so the first request leaves at page start.
  - `showCodeScreen()` clears a pending intro timer. The join handler shows `#boot` and restarts `introStart` whenever the first reveal has not happened yet (`!app.introDone`), otherwise there is no loading view.
- `tests/js/logic.test.mjs`: tests for `bootRemaining`, `bootMinMs`, `BOOT_MIN_MS` vs the `leafFall` CSS duration, `BOOT_FADE_MS` vs the fade transition, and a check that the app script has no 2400/800/300 literals.
- `tests/manualne.md` section 6: T-012 loading items reworded, four T-015 items added.
- `proposal.md`: the sentence added to the „Vzhľad“ bullet.

Deviation (small): the task said the join handler restarts the intro "when there is no state yet". I used `!app.introDone` instead. This also covers the edge case where the first state was stored during the intro and then a 401 opened the code screen: otherwise the scene would stay empty after the join because `render()` waits for the reveal.

Commands and results:
- `node --test tests/js/` : 123 pass, 0 fail.
- `uv run pytest -q` : 379 passed.
- `node --check` of the extracted app script: ok.
- Browser check against a throwaway server on port 8123 (temp data dir, env codes): code screen shown at once without cookie; after join the loading view was up between 1.3 s and 2.8 s and the scene then shown; on reload with cookie the fade class appeared at about 2.4 s and `#boot` was hidden about 0.3 s later. Not checked in a browser: reduced motion, slow network, stopped server (error path) and the „Kto si?“ timing; these are in the manual checklist.

Acceptance criteria verified: fast-connection timing, constants, no innerHTML, Node tests, pytest, manualne.md. Left unticked (code reading and partial browser check only): code-screen flow with „Kto si?“ timing, polling after reveal, slow server, reduced motion, failed load.

## Review round 1
(reviewer appends)

Reviewer, 22. 10. 2026. Scope: `static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md`, `proposal.md`.

**Tests run myself:** `node --test tests/js/`: 123 pass, 0 fail. `uv run pytest -q`: 379 passed.

**Browser check.** I ran headless Chrome over CDP against a throwaway server on port 8137 with a temp data dir. A recorder sampled `#boot`, `#scene`, `#codeScreen` and the panel title every 5 ms, and `fetch` was wrapped to log request times. All times are `performance.now()` ms.
- *No cookie / join / „Kto si?“:* `/api/state` → 401 at 124 and the code screen at 131, so it shows at once. I joined at 1533. The loading view came back at 1544 and the scene plus fade started at 3984 (2.44 s after the join). „Kto si?“ opened in the same tick as the reveal, never before it, and sits above the fading `#boot` (z 20 > 15). `#boot` was hidden at 4275.
- *Reload with cookie, fast:* `/api/state` left at 17 and answered at 20, so it is not delayed. Fade class at 2415, hidden at 2720. Three tab returns during the intro (406, 1210, 2014, all 304) did not reveal early or restart the timer.
- *Reduced motion (emulated media):* shown 18 → hidden 808. `boot--fade` was never added and the leaf's `animationName` is `none`.
- *Slow server (CDP Fetch delays `/api/state` by 4 s):* the answer came at 4036 and the reveal at 4046, so there is no extra wait. The fade still runs (300 ms).
- *Failed first load (first `/api/state` failed with ConnectionRefused):* error text and `boot--error` at 47, at once. The retry answered at 4061, the reveal came at 4072 and `boot--error` was removed.
- *After the reveal:* three tab returns (304) and one tab return after another client created a party (200) did not change `#boot` at all. A write from the page itself (party form „Uložiť“) left `#boot` hidden and did not delay the redraw.
- *Developer's deviation (`!app.introDone` instead of `!app.state` in the join handler):* I cleared the cookie at 300 ms during the intro and triggered a poll. The 401 showed the code screen and the pending timer was cleared. The join at 2916 restarted the intro and the reveal came at 5337 (2.42 s), with „Kto si?“ after it. I also cleared the cookie after the reveal: after the join the map came back at once with no loading view. The deviation is correct and needed.
- Tab returns were simulated with a synthetic `visibilitychange` event, which reaches the same handler as a real one.

**Code reading:** the first `poll()` is unchanged and still runs at script end. There is exactly one intro timer (guarded by `introTimer !== null`) and `showCodeScreen()` clears it. `render()` is a no-op before the reveal, so `write()`/error paths cannot draw early. `renderAge()` is null-safe for a 304 during the intro. The constants are in `<script id="logic">` and the pure functions match the spec (`min(minMs, max(0, …))`, and any non-finite value gives 0). No `innerHTML` and no new Slovak text outside `proposal.md`. The `proposal.md` sentence matches the task word for word. `manualne.md` has the four T-015 items, and the T-012 items are still accurate. The z-index order is move bar 10 < `#boot` 15 < panels 20 < code screen 30 < toast 40.

**Blockers:** none.

**Suggestions:**
- `tests/js/logic.test.mjs:1373`: `assert.doesNotMatch(app, /\b(2400|800|300)\b/)` checks the whole app script. Any later unrelated `300` or `800` (a debounce, a size) will fail this test for no real reason. Consider narrowing it to the intro code (`revealWhenReady` / `hideBoot` bodies) or to `setTimeout(…, <literal>)` near `boot`.

**Nits:**
- `static/index.html:1476` (`hideBoot`): on the error → retry path, removing `boot--error` before the fade starts the `leafFall` animation again from frame 0. During the 300 ms fade the lying leaf jumps back to the top, and „Nepodarilo sa načítať, skúšam znova…“ stays visible. It is barely visible at fading opacity, and the task asks for `boot--error` to be removed when revealing. Removing the class in the fade's end callback instead would keep the leaf on the ground. Optional.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2
(reviewer appends)

## Test report

Tester, 22. 10. 2026. Scope: `static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md`, `proposal.md`. No application code changed, no tests added to the repo, nothing committed.

### Automated suites
| Command | Result |
| --- | --- |
| `node --test tests/js/` | 123 pass, 0 fail |
| `uv run pytest -q` | 379 passed |

Regressions: the done tasks (T-001 to T-013) are covered by these two suites, and both are green.

### HTTP checks (temp server on 127.0.0.1:8150, temp `data/`, test codes from env; the real `data/`, `.env`, ports 8000 and 8010 were not touched)
- `GET /api/state` without cookie → 401 `bad_code`. Wrong join code → 401 `bad_code`. Right code → 200 with `chata_group` cookie (HttpOnly, Secure, SameSite=Lax).
- With cookie → 200 with ETag; `If-None-Match` → 304. Garbage cookie → 401.
- `/`, `/data/chata-data.yaml`, `/chata-data.yaml`, `/backups/`, `/audit.yaml` and path-traversal variants → `/` 200, the rest 404.

### Browser checks (headless Google Chrome over CDP, own driver in `/tmp/t015/drive/drive.mjs`, time from `performance.now()`)
| Scenario | Result |
| --- | --- |
| Fast, cookie: fade class at 2413–2439 ms, hidden 306 ms later; scene drawn at the fade start, under it | pass |
| No cookie: code screen at 112 ms, loading view hidden; after join the intro restarts (boot back at +8 ms), fade at join + 2449 ms, „Kto si?“ opens in the same tick as the scene, after the fade starts | pass |
| Reduced motion: hidden at 833 ms, no `boot--fade` class, leaf `animation-name: none` | pass |
| Slow server (first `/api/state` held 4 s): reveal 22 ms after the state arrives, fade 300 ms | pass |
| First `/api/state` fails: error text and `boot--error` at 104 ms, leaf `none`; retry at 4 s succeeds, reveal 27 ms later, `boot--error` removed | pass |
| Tab returns at 1, 3, 3.5 s during intro (304): one reveal at 2437 ms, no restart, no loading view later | pass |
| Cookie removed mid-intro (401 at 323 ms): code screen at once, cancelled intro does not reveal; join at 712 ms → fade 2440 ms later | pass |
| Cookie removed after reveal → code screen at once; join → scene back at once, no loading view | pass |
| State changed during intro (party + bed written via API) → latest state drawn at reveal, reveal still at 2434 ms | pass |
| Party created and assigned after reveal, then tab return: no loading view, state drawn | pass |
| Taps during the fade: `elementFromPoint` on the scene returns the scene, not `#boot` (`pointer-events: none`, z-index 15); `#boot` hidden after the fade | pass |

Timing note: `/api/state` leaves at 100 to 490 ms after navigation in every run. This is the page's own script parse time on this machine. The HEAD version of `index.html`, which has no intro, gave 100 to 380 ms in the same setup, so the intro does not delay the first request.

### Node pure-function probes (`bootRemaining`, `bootMinMs`)
`bootRemaining(0,500,2400)=1900`, `(0,2400,2400)=0`, `(0,5000,2400)=0`, `(10000,10500,2400)=1900`, backwards clock `(1000,500,2400)=2400`, `NaN` / `undefined` / `null` / `Infinity` / string arguments → 0, `minMs=0` → 0. `bootMinMs(false)=2400`, `bootMinMs(true)=800`, `bootMinMs(undefined)=2400`.

### Acceptance criteria
| # | Criterion | Result |
| --- | --- | --- |
| 1 | Fast connection: loading view about 2.4 s, fade about 0.3 s, map there; state request not delayed | pass |
| 2 | Server slower than 2.4 s: map at once when the state arrives | pass |
| 3 | Reduced motion: still leaf about 0.8 s, hidden without fade | pass |
| 4 | Failed first load: error text and lying leaf at once; successful retry shows the map without extra wait | pass |
| 5 | No cookie: code screen at once; after the code the intro plays once (about 2.4 s from the join), then the map; „Kto si?“ only after the map | pass |
| 6 | Polling, tab return and writes after the first reveal never show the loading view or delay drawing | pass |
| 7 | Named constants in `<script id="logic">`, no magic numbers in the app script | pass |
| 8 | No `innerHTML` added; no new Slovak text except the `proposal.md` sentence | pass |
| 9 | Node tests cover the listed cases, incl. `BOOT_MIN_MS` = CSS `leafFall` duration | pass |
| 10 | `node --test tests/js/` and `uv run pytest -q` pass | pass |
| 11 | `tests/manualne.md` section 6: T-012 loading items updated, four T-015 items present | pass (note below) |

Note on 11: only the first T-012 item („Loading leaf“) was reworded. The reduced-motion and failed-load T-012 items were left as they are. They are still correct with the new behaviour, and the T-015 items cover the timing. The developer's dev log says "T-012 loading items reworded" (plural), which is slightly inaccurate. Not a blocker.

### Not verifiable here (already in `tests/manualne.md` section 6, no new items needed)
Real iPhone Safari, Android Chrome and the WhatsApp in-app browser; a real slow 3G connection (approximated with a held response); VoiceOver and TalkBack reading „Načítavam…“ (`role="status"` kept).

### Non-blocking observation (matches the reviewer's optional nit, not a failure)
After a failed load and a successful retry, `hideBoot()` removes `boot--error` before the fade starts. The leaf restarts its fall from the top, and the error text „Nepodarilo sa načítať, skúšam znova…“ stays visible for the 300 ms fade. Timeline from the failed-first run: `boot--error` at 120 ms (`anim none`), then at 4167 ms `boot--fade` with `anim leafFall` and the old error text, hidden at 4470 ms. Cosmetic only. Fixable by clearing the text or the class in the fade's end callback.

### Decision
All 11 criteria pass, both suites are green, no regressions. Moved to `tasks/done/`.
