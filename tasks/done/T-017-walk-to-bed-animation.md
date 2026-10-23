# T-017: A waiting figure walks from the meadow to the bed

- **Phase:** 1 (organizer request, 22. 10. 2026)
- **Depends on:** T-016, T-018, T-020 (T-020 only for build order: it changes texts in the same files, `static/index.html` and `tests/js/logic.test.mjs`)
- **Size:** S

## Goal
When my party takes a bed („Zapísať nás sem“ or „Na všetky naše noci“ in the bed sheet), the figure(s) waiting on the meadow (T-016) walk to that bed, slowly and smoothly (about 3 s), before they stand there. This makes clear who went where. The optimistic update and the rollback stay as they are. Proposal sections: "Mapa" (ukladaná zmena je polopriehľadná), "Ťuknutie na posteľ", "Vzhľad" (`prefers-reduced-motion`).

Organizer's words: „Keď kliknem na posteľ, tak sa animuje, ako sa postavička presunie do tej postele.“

## Scope
- `static/index.html`:
  - `<script id="logic">`: constant `WALK_MS` and pure functions `walkProgress`, `walkPosition` and `walkers` (see below).
  - `<script id="app">`: a new SVG layer `walk` in `ensureScene()`, right after `beds` (so walking figures pass under the boards and icons), with `aria-hidden="true"` and `pointer-events="none"`. Also `app.walking` (the hidden target slots), `startWalk(...)` / `cancelWalks()` / `cancelWalkersAt()`, the start of the walk in `assignHere`, a skip in `drawBed` for slots that are walking, and cancelling in `selectNight`, `showCodeScreen`, on a rejected write and when the place being walked to is released or moved away.
- `tests/js/logic.test.mjs`: tests of the pure functions.
- `tests/manualne.md`: check items in sections 4 and 6.
- `proposal.md`: one sentence in "Mapa" (see below).

Out of scope: animations for „Uvoľniť“ (bed → meadow) and for move mode (bed → bed), other parties' changes arriving by poll, any change to the meadow layout (T-016), bed geometry, hit areas, the server.

## Decided values (organizer change request of 23. 10. 2026: „sprav pomalšie a plynulejšie, kľudne cca 3 sekundy“)
- `WALK_MS = 3000`. Continuous movement on every animation frame with ease-in-out (smoothstep), not discrete steps. The original 420 ms / 7 steps version was replaced. The literal 3000 must not appear in the app script (the constant lives in the logic script).
- Positions are rounded to whole scene pixels (pixel-art rule, crisp under `shape-rendering="crispEdges"`). No walking bob or leg animation: a one-pixel hop was implemented and measured in frame captures, and it is invisible next to the movement per frame (about 1 px per frame in the middle of the walk), so it was removed again.
- All walkers of one tap start together. A double bed takes two figures side by side.
- Only the selected night is animated. For „Na všetky naše noci“ the other nights are not visible, so they change at once as today.
- The walker is always fully opaque. The server normally confirms long before the figure lands, so the landing is drawn from the state at that moment: opaque when confirmed, semi-transparent („ukladám“) only when the write is still unanswered.
- Rejection mid-walk: the walker disappears at once and the figure is back on the meadow (the normal rollback), with the toast. No reverse walk (simplest, and a turn-around would need the meadow to hide the figure again).
- Several walks at once are independent. A tap on another bed while a figure walks uses the next waiting figure; with nobody waiting there is no walk (the extra place just appears).
- Releasing or moving away the place a figure is still walking to removes that walker at once.

## Pure functions (in `<script id="logic">`, no DOM, no `app`)
```js
var WALK_MS = 3000;    // the whole walk from the meadow to the bed

// 0 ... 1 after `elapsed` ms of `ms`, with smoothstep ease-in-out t*t*(3-2t). Clamped: 0 before the start,
// 1 at and after the end, and 1 for a bad duration.
function walkProgress(elapsed, ms)

// The point at progress t of the straight walk from `from` to `to` ([x, y]), rounded to whole pixels.
// t <= 0 (or NaN) is exactly `from`, t >= 1 exactly `to`.
function walkPosition(from, to, t)

// The walks for one assign on `night`: stateBefore is the view before the tap, stateAfter the view with
// the new pending ops. For the i-th slot of `slots`:
//   from = meadowLayout(meadowRect, waitingFigures(stateBefore, party, night).length).cells[i],
//          or morePos when i is past the drawn cells and there is a „+N“ chip, else no walker for that slot;
//   to   = figurePosition(bed, bed.slots.indexOf(slot));
//   kind = slotOccupant(stateAfter, slot, night).kind (what will stand in the bed, so nothing swaps at landing).
// Returns [{slot, from, to, kind, color: party.color}]. [] when party is null or had no waiting figures.
function walkers(stateBefore, stateAfter, party, bed, slots, night, meadowRect)
```

## Behaviour
1. In `assignHere`, keep the current flow (close the panel, push pending ops, `runWrite`). Before `runWrite`, compute `walkers(viewState().state before the ops, state with the ops, …)` for `app.night`. Skip all of this when `prefersReducedMotion()` (from T-015) is true.
2. For each walker, add its key `night + "|" + slot` to `app.walking`. `drawBed` then draws **nothing** for that slot (neither the figure nor the blinking free square) while the key is there. The meadow (T-016) already shows one figure fewer, so the figure exists only once on screen.
3. Each walker is a `<g>` in the `walk` layer holding `drawFigure(g, 0, 0, color, kind, shirtChar(party.name))` (the shirt letter from T-018, so the figure looks the same on the meadow, on the way and in the bed). One shared `requestAnimationFrame` loop sets `transform="translate(x y)"` to `walkPosition(from, to, walkProgress(elapsed, WALK_MS))` on every frame. The walker has no `.pending` class: it stays opaque the whole way.
4. At `WALK_MS`: remove the walker, delete its key and `renderBeds()`. The figure is drawn from the state at that moment: opaque if the server has confirmed meanwhile (no „ukladám“ fade after landing), semi-transparent (`.pending`) only if the write is still unanswered. The loop stops when no walk is left.
5. **Rejection:** when `runWrite` resolves with `!res.ok`, cancel the walkers of this tap (remove the nodes, delete the keys) together with the redraw, wherever on the way they are. The figure is back on the meadow by the normal rollback, and the toast shows the server's reason as today. A `slot_taken` with `params.own === true` is not an error, so treat it like success. A rejection that arrives after landing needs nothing extra: the normal redraw moves the figure back to the meadow at once (no reverse walk).
6. `selectNight`, `showCodeScreen` and a 401 cancel all walks, so no figure is left on the wrong night. Polls and other redraws during a walk do not cancel it, because the `walk` layer is never cleared by `drawBeds`.
7. A second tap while a figure walks starts its own independent walk with the next waiting figure (none waiting: no walk). `clearSlot` and `moveTo` cancel the walker heading to the released or moved-away place (`cancelWalkersAt`). Zoom and pan keep working during a walk (the layer is in scene units and does not catch pointers). Bed taps, the bed sheet and keyboard focus are unchanged.

## proposal.md
In "Mapa", append to the T-016 meadow bullet:
„Keď si partia zaberie posteľ, postavička z lúky k nej prejde …“ (the final wording is in `proposal.md`: slow and smooth, about 3 s, opaque on the way, semi-transparent in the bed only while unanswered, back on the meadow at once when rejected, no walk with `prefers-reduced-motion`).

## Acceptance criteria
- [x] Tapping „Zapísať nás sem“ on a bed walks the waiting figure from its meadow cell to its place in the bed in about 3 s, continuously (every animation frame, ease-in-out, no discrete steps, no jumps, monotonic positions).
- [x] The walker stays fully opaque all the way. At landing the figure is opaque when the server has confirmed meanwhile (no fade), and semi-transparent only while the write is still unanswered.
- [x] On a double bed with two people waiting, both walk together to their two places. The figure kinds at landing match what the bed shows afterwards, with no swap.
- [x] During the walk the target slot shows neither the figure nor the blinking square, and the meadow shows the figure only once (as the walker).
- [x] A rejected assign, also in the middle of the walk, removes the walker at once. The figure is back on the meadow and the existing Slovak toast explains why.
- [x] Switching the night, a 401, or releasing the place being walked to during a walk leaves no stray figure.
- [x] A second tap while a figure walks starts an independent walk with the next waiting figure. The shared animation loop stops when no walk is left.
- [x] With `prefers-reduced-motion: reduce` there is no walk and the figure appears in the bed at once, as before T-017.
- [x] Hit areas, bed geometry and the bed-hit tests are unchanged. The `walk` layer is `aria-hidden` and `pointer-events="none"`.
- [x] No `innerHTML` introduced, and no magic numbers for the walk in `<script id="app">`. Texts keep tykanie (T-020 guard test passes).
- [x] Node tests cover at least:
  - `walkProgress`: 0 at t=0, 0.5 in the middle, 1 at the end and beyond, clamped, bad duration, monotonic, slower at the ends than in the middle;
  - `walkPosition`: exactly `from` at 0 and exactly `to` at 1, integers in between, clamping, no movement, and a 16 ms frame sweep from meadow to bed that is monotonic and has no jump larger than 2 px (x) / 3 px (y);
  - `walkers`: a party of 2 adults with nothing placed, tapping a double bed → two walkers from the first two meadow cells to the two `figurePosition`s of that bed, kinds from the after-state; a party with nothing waiting → `[]`; no party → `[]`; an overflow meadow where the second walker starts at `morePos`.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md`:
  - section 4: the 3 s walk on a single and a double bed (opaque on the way, no fade at landing); a forced conflict from a second device (the walker disappears mid-way, the figure goes back to the meadow, toast); a second tap and a release during a walk; switching nights mid-walk;
  - section 6: on a phone the 3 s walk is smooth at 1x and zoomed in; with „Reduce motion“ on there is no walk.

## Notes for developer
- `assignHere` calls `closePanel()` before the write, so the sheet slides away while the figure walks. That is intended.
- Compute the before-state from `viewState()` **before** appending the ops, and the after-state with `withPending(app.state, app.pending.concat(ops))`. `walkers` needs both.
- Keep `app.walking` keys out of the pending logic. They only hide drawing; they never change `viewState()`, `hiddenSummary` or the bed labels.
- Use one rAF loop per tap (or one shared one) and make sure a cancelled walk also stops its loop.
- No open decision from `proposal.md` is involved. The duration (3 s, organizer's request of 23. 10.), the whole-pixel positions, "only the selected night", "no walk for Uvoľniť and move" and "no reverse walk on late rejection" are product-owner defaults for the organizer to confirm.

---
## Dev log
Implemented in `static/index.html` (logic and app scripts), with tests, manual checklist items and the proposal sentence.

**Logic script:** `WALK_MS = 420`, `WALK_STEPS = 7`, `walkPath(from, to, steps)`, `walkers(stateBefore, stateAfter, party, bed, slots, night, meadowRect)` as specified. One small extra pure helper, `walkStepIndex(elapsed, ms, steps)` (which of the path points shows after `elapsed` ms, clamped to 0 ... steps-1), so the app script holds no arithmetic and the clamp is unit tested.

**App script:**
- New SVG layer `walk` between `beds` and `boards` in `ensureScene()` (`aria-hidden="true"`, `pointer-events="none"`). It is never cleared by `drawBeds`.
- `app.walking` (keys `night|slot`), `app.walks` (one entry per tap), `app.walkFrame`. `startWalk` draws each walker with `drawFigure(g, 0, 0, color, kind, shirtChar(party.name))` and starts one shared rAF loop (`stepWalks`). `dropWalk` / `cancelWalks(only?)` remove nodes and keys and stop the loop. `cancelWalks` does not redraw, the callers do (or a render follows).
- `drawBed` skips slots whose key is in `app.walking` (no figure, no blinking square).
- `assignHere`: the walkers are computed from `st` (the view before the ops) and `withPending(app.state, app.pending.concat(ops))` for `app.night` only, and only when `!prefersReducedMotion()`. After the write, a rejection (`!res.ok` and not an own `slot_taken`) calls `cancelWalks(walk)` and `renderBeds()`. A late rejection (after landing) needs nothing extra, the normal redraw puts the figure back on the meadow.
- `selectNight`, `showCodeScreen` (covers 401) and the scene rebuild in `ensureScene` cancel all walks.
- Small refactor: the "own slot" test from `runWrite` became `isOwnSlotTaken(e)`, shared with `assignHere`.

**Files:** `/Users/luigi/workspace/chrapa-poll/static/index.html`, `/Users/luigi/workspace/chrapa-poll/tests/js/logic.test.mjs`, `/Users/luigi/workspace/chrapa-poll/tests/manualne.md` (section 4: three items, section 6: one item), `/Users/luigi/workspace/chrapa-poll/proposal.md` (one sentence appended to the meadow bullet in "Mapa").

**Tests:** `node --test tests/js/` gives 156 pass, 0 fail (new: walk constants, `walkPath` x2, `walkStepIndex`, `walkers` x5, two page-source tests; the T-020 tykanie guard still passes). `uv run pytest -q` gives 382 passed.

**Headless Chrome check** (Chrome 155, 380x760 at 2x, own server on port 8031 with a temp data dir, own Chrome on debug port 9444, both stopped afterwards; scripts in `/tmp/t017/`). An in-page rAF sampler recorded the walk layer, the bed and the meadow every frame, and screenshots were taken at several points during the walk:
- Single bed, server delayed 1 s: the walker appears at the first meadow cell (155 382) and steps through 7 integer positions (160 360, 166 339, 171 317, 177 295, 182 273, 188 252, 193 230), about 60 ms apart, to the bed, then the walk node is removed and the figure stands in the bed with class `pending` until the response (about 1.4 s), then opaque. During the walk the bed slot has neither figure nor free square, and the meadow has one figure fewer (the walker is the only copy). The walker passes over cots and under the signs and the letter icon.
- Double bed (party 2 adults + 1 kid): two walkers side by side from the first two meadow cells to the two bed places (135 228 and 155 228), both adults, the kid stays on the meadow, two pending figures at landing, opaque after the response.
- Rejection during the walk (another device took the place, server answered after 100 ms): walker removed at once, meadow figure back (10 rects as before), the bed shows the other party, Slovak toast „Toto miesto má vo štvrtok už Beta.“. Rejection after landing (1.2 s delay): the figure goes back to the meadow at once with the toast, no reverse walk.
- Reduced motion (emulated `prefers-reduced-motion: reduce`): the walk layer stays empty, the figure is in the bed at once (pending, then opaque).
- Night switch 150 ms into the walk: walk layer empty, no stray figure on the other night, the booking shows on Thursday when switching back.
- 401 during the walk (cookies cleared before the write): the code screen opens, the walk layer is empty.
- No console errors or exceptions in any run. The walk layer has `aria-hidden="true"` and `pointer-events="none"`.

**Not checked:** a real phone (smoothness, zoomed in, pinch while walking), listed in `tests/manualne.md` section 6. Pinch and pan during a walk was not driven in headless Chrome, it is covered only by the layer having `pointer-events="none"`.

**Notes for the orchestrator:** `tasks/todo/T-019-zoom-out-below-fit.md` was not touched. Product-owner defaults used as written (420 ms, 7 steps, selected night only, no walk for Uvoľniť and move, no reverse walk on late rejection). No open decision from `proposal.md` is involved.

### Dev log, change request of 23. 10. 2026 (3 s, smooth walk)
Organizer: „animácia presunu figúrky sprav pomalšie a plynulejšie - kľudne cca 3 sekundy“. The task came back from `review` (round 1 was interrupted, no findings) to `in-progress`; spec, acceptance criteria, `proposal.md`, `tests/manualne.md` and the code were updated.

**Logic script:** `WALK_MS = 3000`. Removed `WALK_STEPS`, `walkPath`, `walkStepIndex`. New pure functions `walkProgress(elapsed, ms)` (smoothstep ease-in-out, clamped, 1 for a bad duration) and `walkPosition(from, to, t)` (whole pixels, exact `from` at t<=0/NaN and exact `to` at t>=1). `walkers` is unchanged.

**App script:** `stepWalks` now sets the transform on every rAF frame from `walkPosition(item.from, item.to, walkProgress(elapsed, WALK_MS))` (items hold `from`/`to` instead of a path). Still one shared loop, `stopWalkLoop()` stops it when no walk is left. New `cancelWalkersAt(night, slot)`, called from `clearSlot` and `moveTo`, so releasing or moving away a place that is still being walked to removes that walker instead of letting it land in an empty bed (found while thinking through the 3 s window, about 3 s is long enough for a person to do this).

**Design decisions (documented in the task, proposal and manual checklist):**
- Whole-pixel positions, kept: pixel-art rule, and the frame captures show crisp figures with at most 2 px movement per frame. I did not compare against sub-pixel positions, that was not looked at.
- Walking bob: implemented (1 px hop every 250 ms), measured in the per-frame positions and removed again. In the middle of the walk the figure already moves about 1.3 px per frame, so a 1 px hop is just noise, and it is only above noise in the first and last 300 ms. No leg frames exist in the sprite, so no cheap leg feel is possible.
- The walker is always opaque. Because the server confirms in tens of ms, the landing is normally already confirmed: no „ukladám“ fade after landing (verified: no `.pending` after landing with the server answering at 0.4 s). It lands semi-transparent only when the write is still unanswered.
- Rejection mid-walk: walker disappears at once, figure is back on the meadow with the toast (no turn-around, no reverse walk).
- Second tap while walking: starts its own independent walk with the next waiting figure; with nobody waiting there is no walk (the extra place just appears). Night switch, 401, scene rebuild, reduced motion unchanged. The `walk` layer keeps `pointer-events="none"`, no layout or hit area changed.
- Texts: no new Slovak strings in the page (only the existing toasts).

**Tests:** `node --test tests/js/` gives 158 pass, 0 fail (replaced the `walkPath`/`walkStepIndex` tests with `walkProgress` x2 (endpoints, clamping, bad duration, monotonic, slow at the ends), `walkPosition` x3 (endpoints, integers, clamping, a 16 ms frame sweep with no jump above 2 px and monotonic), the constant test, and extended the page-source tests: the app uses `walkProgress` / `walkPosition` by name, no literal 3000 in the app script, `clearSlot` and `moveTo` call `cancelWalkersAt`; the T-020 tykanie guard passes). `uv run pytest -q` gives 382 passed.

**Headless Chrome check** (Chrome 155, 380x760 at 2x, own server on port 8031 with a temp data dir, own Chrome on debug port 9444, both stopped afterwards; scripts in `/tmp/t017/`, screenshots in `/tmp/t017/out/`). A per-frame in-page sampler recorded the walk layer and the bed, plus screenshots at 0.3, 0.8, 1.5, 2.2, 2.8 and 3.3 s:
- Single bed, server answering after 0.4 s: the walker runs 179 frames from the meadow cell (155 382) to the bed (193 230) over about 3.0 s, positions sampled every ~250 ms: 155,382 / 156,379 / 158,370 / 161,358 / 165,342 / 170,323 / 175,304 / 179,284 / 184,267 / 188,251 / 191,240 / 192,232 / 193,230 (slow, fast in the middle, slow again). Largest per-frame jump 2 px, x never goes backwards. The bed slot has neither figure nor free square during the walk. After landing no `.pending` is ever seen (server had confirmed), so there is no fade. Screenshots show a crisp figure on the way, passing over the beds and under the signs.
- Rejection mid-walk (another device took the place, the answer arrives at ~0.1 s): walker removed at once, the other party stands in the bed, the toast is „Toto miesto má vo štvrtok už Beta.“, no stray figure after 1.2 s.
- Night switch 1 s into the walk: walk layer empty at once, the slot is free on Friday, and the booking shows on Thursday when switching back. 
- Reduced motion (emulated): no walker, the figure is in the bed at once (pending until the answer).
- 401 mid-walk: code screen open, walk layer empty.
- Two taps: the first bed, then 1 s later the double bed: three walkers at once (independent), all landed after another 3 s, signpost shows „máš 3/3“. 
- Release of the place 0.8 s into its walk: the walker disappears at once and the bed is empty, nothing lands later.
- No console errors or exceptions.

**Not checked:** a real phone (smoothness and pinch/pan while walking, listed in `tests/manualne.md` section 6). Pinch and pan during a walk were not driven in headless Chrome (the layer has `pointer-events="none"`). The case of the walk being finished while the tab is hidden (rAF pauses): the first frame after returning lands it at once by the elapsed time, not driven in the browser.

**Files:** `/Users/luigi/workspace/chrapa-poll/static/index.html`, `/Users/luigi/workspace/chrapa-poll/tests/js/logic.test.mjs`, `/Users/luigi/workspace/chrapa-poll/tests/manualne.md`, `/Users/luigi/workspace/chrapa-poll/proposal.md`, this task file. `tasks/todo/T-019-zoom-out-below-fit.md` was not touched.

## Review round 1
(reviewer appends)

Reviewed on 23. 10. 2026 against the 3 s change request. The earlier round 1 was interrupted with no findings, so this is a full round 1.

**Tests run by the reviewer:** `node --test tests/js/` gives 158 pass, 0 fail (the T-020 tykanie guard included). `uv run pytest -q` gives 382 passed.

**Headless Chrome (own harness).** Chrome 155, 380x760 at 2x, mobile with touch emulation. My own server ran on port 8047 with data in `/tmp/t017r/data` and Chrome on debug port 9471, and I stopped both afterwards. Scripts are in `/tmp/t017r/`. An init script wrapped `requestAnimationFrame` to count `stepWalks` frames and the live frame ids. It could also pause rAF and fake `visibilityState`, to simulate a hidden tab. A sampler running on the original rAF recorded the walk layer, the meadow, the watched beds, the viewBox and the toast on every frame. Results:
- **Single bed, server at 0.4 s:** 181 frames over 3000 ms, from (155 382) to (193 230). The largest step per frame was 1 px in x and 2 px in y. No frame went backwards and every position was a whole pixel. Sampled about every 250 ms, it is slow at both ends and fast in the middle. During the walk the target slot showed no figure and no free square, and the meadow went from 3 to 2 figures. At landing the figure was opaque with no `.pending`. The rAF loop stopped after landing: the counter did not move during 1 s idle and no frame was live.
- **Slow server (4.5 s):** the figure landed with `.pending` at 3.0 s and turned opaque when the answer came at about 4.9 s.
- **Double bed, 2 adults and 1 kid:** two walkers ran together from (155 382) and (169 382) to (135 228) and (155 228). Both were adults, both beds showed adults afterwards with no swap, and the kid stayed on the meadow.
- **Rejected mid-walk:** I took the place from a second client first, and the answer came at about 0.9 s. The walker was removed in the same frame as the rollback, the meadow was back to 3 figures, Beta was in the bed, the toast read „Toto miesto má vo štvrtok už Beta.“ and no frame was left live. **Rejected after landing (3.8 s):** the figure landed `.pending`, then went back to the meadow at once with the toast. There was no reverse walk.
- **Reduced motion (emulated):** no walker and 0 `stepWalks` frames. The figure was in the bed at once, `.pending` until the answer, then opaque.
- **Night switch 1 s into the walk:** the walk layer emptied at once and no frame was live. Friday showed the full meadow, and back on Thursday the bed showed the booking. A switch to Friday and back within the walk window also left no stray figure and no hidden slot. **401 mid-walk** (cookies cleared before the write): the code screen opened, the walk layer emptied and no frame was live. After signing in again the bed was free and the meadow full.
- **Pinch and pan during the walk:** I sent touch events through CDP: a pinch 0.5 s into the walk, then a one-finger pan. The viewBox changed 20 times, ending at (101.88 127.6 145.6 291.2). The walker's scene positions stayed monotonic with no jump (same figures as above), it landed normally, and no bed sheet opened.
- **Second tap 1 s into a walk** (Gama, 4 adults): the second tap took the double bed, so two more walkers started while the first was still on its way, three in total. All landed: the first at about 3.0 s, the other two at about 4.4 s. The loop then stopped.
- **Rapid taps** (three beds as fast as the sheet allows): three independent walkers, all landed, and the server holds exactly those three places. A tap with nobody waiting (all places held, then an extra bed) gave 0 `stepWalks` frames and the place just appeared.
- **Uvoľniť 0.8 s into the walk** (`cancelWalkersAt`): the walker disappeared at once, the bed was empty, nothing landed later, no frame was live, and the server had nothing for that night.
- **Presunúť 0.8 s into the walk, then a tap on another bed:** the walker kept walking while move mode was on and was removed at the tap. The figure stood in the target bed and the server had only the target.
- **Tab hidden 0.5 s into the walk** (rAF paused, server answered while hidden): the walker was frozen at (158 370) with one buffered frame. On return the first frame landed it opaque in the bed and no frame was left live. **Rejection while hidden:** the walker was removed and the figure was back on the meadow with the toast. On return nothing was left to draw.
- **Logs:** no console errors and no exceptions in any run.

Code reading: the walk layer sits between `beds` and `boards`, with `aria-hidden="true"` and `pointer-events="none"`. `app.walking` only hides drawing, so `viewState`, `hiddenSummary` and the bed labels are untouched. The 3000 lives only in the logic script. There is no `innerHTML`, and the T-016/T-018 helpers are reused. The diff adds no new Slovak strings to the page. The proposal sentence is descriptive Slovak, and the manual checklist items are in sections 4 and 6. Bed geometry, hit areas and the server are unchanged.

### Blocker
None.

### Suggestion
- **The meadow jumps under the walker at the start** (`walkers` in `static/index.html`, about lines 718–731, together with the T-016 centred `meadowLayout`). This follows the spec (`from` = the old layout's `cells[i]`). But the meadow is re-centred for the smaller count in the same frame the walker appears. Measured: 3 waiting at x 155/169/184 become 162/177. The walker starts at 155 and overlaps the shifted figure by 3 px. On the double bed the kid jumps from 184 to 170 and sits exactly under the second walker at (169 382). With a second tap, the one remaining figure sits exactly under the new walker. Smoothstep starts slowly, so the overlap lasts about 0.5 s: the group slides half a cell and a figure is hidden at the moment that should show who went where. This is worth a product-owner follow-up, not a fix in this task. One option is to keep the meadow layout stable while walks run on that night: lay out `waiting + walking` cells and leave the walkers' cells empty, so nobody slides and nobody is covered. The organizer should judge it on the phone (manual section 4).
- **Whole-pixel positions when zoomed in.** At 4x zoom one scene pixel is 4 CSS px, so in the slow first and last ~0.4 s the figure moves in visible 4 px steps. This is the spec's pixel-art decision and is already in manual section 6. Just flag it for the organizer when they check smoothness at 4x.

### Nit
- `assignHere`, `run.then`: after a 401 the walks are already cancelled by `showCodeScreen`. The branch still runs `renderBeds()`, which redraws the hidden scene while the code screen is up. `render()` deliberately skips that. It is harmless, but `res.status !== 401` in the condition would match the comment.
- `moveTo` calls `cancelWalkersAt` for every night of the plan, but only `app.night` can have walkers. It is harmless.

Verdict: APPROVED. Round 2 skipped, no blockers.

## Review round 2
(reviewer appends)

## Test report

Tested on 23. 10. 2026 by the tester (Haiku 5.5), after review round 1 approved the 3 s version. Result: **PASS**, no blockers, no regressions. Nothing was committed. No application code was changed. No test file was added (the existing Node tests already cover the pure functions and the page source guards).

### Automated suite
| Command | Result |
| --- | --- |
| `cd /Users/luigi/workspace/chrapa-poll && node --test tests/js/` | 158 pass, 0 fail (includes the T-016, T-018 and T-020 regression tests and all new T-017 tests) |
| `cd /Users/luigi/workspace/chrapa-poll && uv run pytest -q` | 382 passed |

### Browser check (own harness, not the developer's)
Headless Chrome 155 at 380x760, 2x, mobile emulation. My own server on `127.0.0.1:8061` with a temporary data directory (`/tmp/t017-tester/data`, secrets are test values), Chrome on debug port 9461. A per-frame sampler (own `requestAnimationFrame` loop plus a counter on `stepWalks` calls) recorded the walk layer. The real `data/`, `.env` and port 8010 were not touched. Both servers were stopped afterwards. Scripts and screenshots are in `/tmp/t017-tester/` (`scen.mjs`, `s1.mjs`, `s7b.mjs`, `s9b.mjs`, `late.mjs`, `out/*.png`).

Scenario results:
- **S1 single bed** (Beta, „Posteľ pod oknom“): 181 frames, span 2996 ms, from (169 382) to (193 230). Largest step per frame 1 px in x and 2 px in y, no backward step, all positions whole pixels. Samples: 0 ms 169,382 / 1013 ms 175,342 / 2014 ms 187,269 / 2764 ms 193,233 (slow, fast, slow). Opacity 1 and no class on the walker for all frames. At landing the bed figure is opaque (no `.pending`), it has the same body rect (size, colour, position) as the walker, and the walk layer is empty. The `stepWalks` loop stops at landing (call count unchanged 1.5 s later).
- **S2 double bed, 2 adults** (Alfa, „Manželská posteľ, izba vľavo“): 2 walkers from (162 382) and (176 382) to (135 228) and (155 228), 3002 ms, opacity 1, both land as adult figures (same body rect as the walker), nothing pending afterwards, server holds both places.
- **S3 three places, mats bed** (Gama, 2 adults + 1 kid, „Matrace na zemi“): 3 walkers, kinds adult, adult, kid. Each landed figure matches its walker's kind (kid body rect 8x6, adults 10x7). Server holds 3 places.
- **S4 slow write (4 s):** the figure lands at 3.0 s with class `pending` (1 figure), and no `pending` remains after the answer at about 4 s. Opacity stays 1 during the walk.
- **S5 rejection mid-walk** (Delta took the place on the server, the page did not know; answer at 1.0 s): walker removed at 1.0 s (61 frames), the figure is back on the meadow (screenshot `out/s5-rejected.png`), the bed shows Delta, toast „Toto miesto má vo štvrtok už Delta.“.
- **S5b late rejection** (answer at 3.5 s, after landing): figure is `pending` in the bed at 3.3 s, the walk layer is empty, at 4.3 s the `pending` is gone and the toast is shown. No reverse walk.
- **S6 night switch mid-walk** (answer delayed 2 s): walk layer empty at once after switching to Friday (0 walkers, no pending on Friday). Back on Thursday the bed shows Beta in „Posteľ pod oknom“, server state correct.
- **S7 second tap during a walk** (Gama: okno, then 1 s later the mats bed, 2 more walkers): walker count 3, then 2 at 3.2 s (first landed), then 0 at 4.2 s. `stepWalks` calls stop (254 at 5 s and 254 at 6.5 s), server holds 3 places.
- **S8 release during the walk** (tap, reopen the bed at 1 s, „Uvoľniť“): walker is 1 during the walk, 0 right after the release, 0 later. The server is empty, no pending.
- **S9 reduced motion** (`prefers-reduced-motion: reduce` emulated): no walker, 0 frames with walkers, the figure is in the bed 0.1 s after the tap.
- **S10 401 mid-walk** (cookie deleted at 0.4 s, write answered 401 at 1.5 s): walk layer empty after the 401, the code screen is shown, no walker left, server not changed.
- **Console:** no exceptions, no console errors caused by the walk. The only logged failures are expected: 401 before sign-in, and the 409 of S5/S5b.
- **Static checks:** the walk layer is `aria-hidden="true"` and `pointer-events="none"` (checked in the DOM). `grep innerHTML static/index.html` returns nothing. The literal 3000 is not in the app script (test guard passes).

### Acceptance criteria
| Criterion | Result | Evidence |
| --- | --- | --- |
| Tap walks the figure from its meadow cell to its bed place in about 3 s, continuously | PASS | S1, S2: span 2996 to 3002 ms, 181 frames, ease-in-out, whole pixels, monotonic |
| Walker stays opaque; at landing opaque if confirmed, semi-transparent only while unanswered | PASS | S1 (no pending), S4 (pending only while unanswered, gone after the answer), S5b |
| Double bed: both walk together, kinds match the bed after landing | PASS | S2, S3 (adult, adult, kid) |
| Target slot shows neither figure nor square during the walk, meadow shows the figure once | PASS | Rect probe on the target slot (8x8 free square and figure rects at its place): before the tap the square is there, at 0.3 s, 1.5 s and 2.6 s of the walk nothing is drawn there, after landing the figure and no square. Meadow figure count drops by one (the walker is the only copy; reviewer and screenshot `out/s1-walk-1s.png`) |
| Rejected assign, also mid-walk, removes the walker at once, figure back on meadow, Slovak toast | PASS | S5 (screenshot), S5b |
| Night switch, 401, or releasing the target place during a walk leaves no stray figure | PASS | S6, S10, S8 |
| Second tap starts an independent walk, the shared loop stops when no walk is left | PASS | S7 (3 walkers, 2, 0; loop calls stop) |
| Reduced motion: no walk, figure in the bed at once | PASS | S9 |
| Hit areas, bed geometry and bed-hit tests unchanged; walk layer `aria-hidden` and `pointer-events="none"` | PASS | Diff only touches the walk layer, `drawBed` skip and the actions; DOM check; 382 pytest and the Node hit-area tests pass |
| No `innerHTML`, no magic numbers in the app script, tykanie guard passes | PASS | `grep innerHTML` empty; no 3000 in app script; T-020 guard passes |
| Node tests cover walkProgress, walkPosition (incl. 16 ms sweep), walkers (double bed, nothing waiting, no party, overflow) | PASS | 158 pass, the listed tests are present in `tests/js/logic.test.mjs` (lines about 1580 to 1720) |
| `node --test tests/js/` and `uv run pytest -q` pass | PASS | 158 pass, 382 passed |
| `tests/manualne.md` sections 4 and 6 have the T-017 items | PASS | Section 4: three walk items (single/double bed, forced conflict, second tap, release, night switch). Section 6: one walk item (phone, 1x and 4x, pinch and pan, reduce motion) |

Manual only (not checked here, already in `tests/manualne.md`): smoothness on a real phone at 1x and 4x, pinch and pan while a figure walks, iPhone Safari and Android Chrome, a second physical device taking the place, and a hidden tab returning during a walk (the reviewer simulated the hidden tab, I did not).

### Judgment calls for the organizer (not failures)
- **Whole-pixel steps at 4x zoom:** the positions are rounded to whole scene pixels as specified. At 4x zoom one scene pixel is 4 CSS px, so the slow start and end (per frame 0 to 1 px) show as visible 4 px steps, and the middle moves up to 2 scene px (8 CSS px) per frame. The criterion "no discrete steps" is read as "no jumps at 1x" together with the whole-pixel rule. The organizer should judge this on the phone (manual section 6 already asks).
- **Meadow re-centring under the walker** (reviewer's suggestion, confirmed by reading the code): the meadow is laid out for the count after the tap, so the remaining figures slide while a walker starts from the old cell. Follow-up topic for the product owner, not a failure of this task.

### Result
All acceptance criteria pass, no regressions in the Node or pytest suites. Moved to `tasks/done/`.
