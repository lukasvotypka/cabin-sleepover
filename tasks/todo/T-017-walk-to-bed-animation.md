# T-017: A waiting figure walks from the meadow to the bed

- **Phase:** 1 (organizer request, 22. 10. 2026)
- **Depends on:** T-016, T-018
- **Size:** S

## Goal
When my party takes a bed („Zapísať nás sem“ or „Na všetky naše noci“ in the bed sheet), the figure(s) waiting on the meadow (T-016) walk to that bed in a few pixel steps before they appear there. This makes clear who went where. The optimistic update and the rollback stay as they are. Proposal sections: "Mapa" (ukladaná zmena je polopriehľadná), "Ťuknutie na posteľ", "Vzhľad" (`prefers-reduced-motion`).

Organizer's words: „Keď kliknem na posteľ, tak sa animuje, ako sa postavička presunie do tej postele.“

## Scope
- `static/index.html`:
  - `<script id="logic">`: constants `WALK_MS`, `WALK_STEPS` and pure functions `walkPath` and `walkers` (see below).
  - `<script id="app">`: a new SVG layer `walk` in `ensureScene()`, right after `beds` (so walking figures pass under the boards and icons), with `aria-hidden="true"` and `pointer-events="none"`. Also `app.walking` (the hidden target slots), `startWalk(...)` / `cancelWalks()`, the start of the walk in `assignHere`, a skip in `drawBed` for slots that are walking, and cancelling in `selectNight`, `showCodeScreen` and on a rejected write.
- `tests/js/logic.test.mjs`: tests of the pure functions.
- `tests/manualne.md`: check items in sections 4 and 6.
- `proposal.md`: one sentence in "Mapa" (see below).

Out of scope: animations for „Uvoľniť“ (bed → meadow) and for move mode (bed → bed), other parties' changes arriving by poll, any change to the meadow layout (T-016), bed geometry, hit areas, the server.

## Decided values (product owner default, organizer may change)
- `WALK_MS = 420`, `WALK_STEPS = 7`: seven visible pixel steps, 60 ms each, so it reads as walking in an old RPG rather than gliding. Do not use 300, 800 or 2400 (the T-015 test forbids those literals in the app script, and these constants live in the logic script anyway).
- All walkers of one tap start together. A double bed takes two figures side by side.
- Only the selected night is animated. For „Na všetky naše noci“ the other nights are not visible, so they change at once as today.

## Pure functions (in `<script id="logic">`, no DOM, no `app`)
```js
var WALK_MS = 420;     // the whole walk from the meadow to the bed
var WALK_STEPS = 7;    // visible pixel steps of the walk

// The points of a walk from `from` to `to` ([x, y]), `steps` points for k = 1 … steps:
// [round(from.x + (to.x − from.x)·k/steps), round(…y…)]. The last point is exactly `to`.
// steps < 1 or any non-finite number gives [to].
function walkPath(from, to, steps)

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
3. Each walker is a `<g>` in the `walk` layer holding `drawFigure(g, 0, 0, color, kind, shirtChar(party.name))` (the shirt letter from T-018, so the figure looks the same on the meadow, on the way and in the bed). A `requestAnimationFrame` loop sets `transform="translate(x y)"` to `walkPath(from, to, WALK_STEPS)[i]` with `i = min(WALK_STEPS − 1, floor(elapsed · WALK_STEPS / WALK_MS))`. The positions are integers, so the pixels stay crisp.
4. At `WALK_MS`: remove the walker, delete its key and `renderBeds()`. If the server has not answered yet, the figure stands there semi-transparent („ukladám“, `.pending`), as today.
5. **Rejection:** when `runWrite` resolves with `!res.ok`, cancel the walkers of this tap (remove the nodes, delete the keys) before or together with the redraw. The figure is back on the meadow by the normal rollback, and the toast shows the server's reason as today. A `slot_taken` with `params.own === true` is not an error, so treat it like success. A rejection that arrives after landing needs nothing extra: the normal redraw moves the figure back to the meadow at once (no reverse walk).
6. `selectNight`, `showCodeScreen` and a 401 cancel all walks, so no figure is left on the wrong night. Polls and other redraws during a walk do not cancel it, because the `walk` layer is never cleared by `drawBeds`.
7. Zoom and pan keep working during a walk (the layer is in scene units and does not catch pointers). Bed taps, the bed sheet and keyboard focus are unchanged.

## proposal.md
In "Mapa", append to the T-016 meadow bullet:
„Keď si partia zaberie posteľ, postavička z lúky k nej prejde v niekoľkých pixelových krokoch (asi 0,4 s) a ostane polopriehľadná, kým zápis nepotvrdí server. Ak ho server odmietne, postavička sa vráti na lúku. S `prefers-reduced-motion` sa objaví v posteli hneď.“

## Acceptance criteria
- [ ] Tapping „Zapísať nás sem“ on a bed walks the waiting figure from its meadow cell to its place in the bed in about 0.4 s in visible steps. It then stands there semi-transparent until the server confirms, then opaque.
- [ ] On a double bed with two people waiting, both walk together to their two places. The figure kinds at landing match what the bed shows afterwards, with no swap.
- [ ] During the walk the target slot shows neither the figure nor the blinking square, and the meadow shows the figure only once (as the walker).
- [ ] A rejected assign (e.g. another device took the slot first) removes the walker. The figure is back on the meadow and the existing Slovak toast explains why.
- [ ] Switching the night or a 401 during a walk leaves no stray figure.
- [ ] With `prefers-reduced-motion: reduce` there is no walk and the figure appears in the bed at once, as before T-017.
- [ ] Hit areas, bed geometry and the bed-hit tests are unchanged. The `walk` layer is `aria-hidden` and `pointer-events="none"`.
- [ ] No `innerHTML` introduced, and no magic numbers for the walk in `<script id="app">`.
- [ ] Node tests cover at least:
  - `walkPath`: 7 steps from `[0, 0]` to `[70, -14]` gives integer points ending exactly at `[70, -14]`; `steps` 1 gives `[to]`; `steps` 0 / `NaN` gives `[to]`; from equal to to gives `steps` copies of `to`;
  - `walkers`: a party of 2 adults with nothing placed, tapping a double bed → two walkers from the first two meadow cells to the two `figurePosition`s of that bed, kinds from the after-state; a party with nothing waiting (only an extra place taken) → `[]`; no party → `[]`; an overflow meadow where the second walker starts at `morePos`.
- [ ] `node --test tests/js/` and `uv run pytest -q` pass.
- [ ] `tests/manualne.md`:
  - section 4: the walk on a single and a double bed; the semi-transparent landing until saved; a forced conflict from a second device (the figure goes back to the meadow, toast); switching nights mid-walk;
  - section 6: on a phone the walk is smooth enough and readable at 1x and zoomed in; with „Reduce motion“ on there is no walk.

## Notes for developer
- `assignHere` calls `closePanel()` before the write, so the sheet slides away while the figure walks. That is intended.
- Compute the before-state from `viewState()` **before** appending the ops, and the after-state with `withPending(app.state, app.pending.concat(ops))`. `walkers` needs both.
- Keep `app.walking` keys out of the pending logic. They only hide drawing; they never change `viewState()`, `hiddenSummary` or the bed labels.
- Use one rAF loop per tap (or one shared one) and make sure a cancelled walk also stops its loop.
- No open decision from `proposal.md` is involved. Duration and steps, "only the selected night", "no walk for Uvoľniť and move" and "no reverse walk on late rejection" are product-owner defaults for the organizer to confirm.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
