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
- [ ] On a fast connection the loading view (leaf and „Načítavam…“) stays about 2.4 s after page start, then fades out in about 0.3 s and the map is there. The state request still starts at page start (check the Network tab: `/api/state` is not delayed).
- [ ] With a server slower than 2.4 s the map appears as soon as the state arrives, with no extra wait.
- [ ] With `prefers-reduced-motion: reduce` the still leaf shows about 0.8 s and is hidden without a fade.
- [ ] A failed first load shows the error text and the lying leaf at once; a later successful retry shows the map without an extra wait.
- [ ] Without a valid cookie the code screen appears at once. After entering the code the intro plays once (about 2.4 s from the join), then the map; „Kto si?“ opens only after the map is shown.
- [ ] Polling, tab return and writes after the first reveal never show the loading view and never delay drawing.
- [ ] `BOOT_MIN_MS`, `BOOT_MIN_REDUCED_MS` and `BOOT_FADE_MS` are named constants in `<script id="logic">`; no magic numbers for these in `<script id="app">`.
- [ ] No `innerHTML` introduced; no new Slovak text except the `proposal.md` sentence.
- [ ] Node tests cover at least:
  - `bootRemaining(0, 500, 2400) === 1900`, `bootRemaining(0, 2400, 2400) === 0`, `bootRemaining(0, 5000, 2400) === 0`;
  - a non-zero start (restart after join): `bootRemaining(10000, 10500, 2400) === 1900`;
  - a clock that runs backwards (`nowMs < startMs`) returns `minMs`, never more;
  - non-finite arguments (`NaN`, `undefined`) return `0`;
  - `bootMinMs(false) === 2400`, `bootMinMs(true) === 800`;
  - `BOOT_MIN_MS` equals the `leafFall` duration read from the `#boot .leaf` CSS rule of `static/index.html` (the test file already reads the HTML), so the two cannot drift apart.
- [ ] `node --test tests/js/` and `uv run pytest -q` pass.
- [ ] `tests/manualne.md` section 6: the three T-012 loading items are updated and these items exist:
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
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
