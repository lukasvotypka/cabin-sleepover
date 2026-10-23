# T-016: People without a bed wait as figures on the meadow

- **Phase:** 1 (organizer request, 22. 10. 2026)
- **Depends on:** T-013, T-014, T-015, T-018 (T-014 and T-015 only for build order: they change the same files, see Notes; T-018 adds the shirt letter to `drawFigure`)
- **Size:** S

## Goal
Today a person of my party who has no bed on the selected night is not drawn anywhere. The only signs are the signpost chip „máte 1/3 !“ (T-013) and the red status board. The organizer wants these people drawn in the scene. Each one is a pixel figure standing on a meadow (a strip of grass), in the party colour, with kids as the smaller figure. This is the start point for the walk animation in T-017. Proposal sections: "Mapa" (postavička vo farbe partie, deti menšie), "Informácie v scéne" (scene positions in `map.scene`), "Rozloženie chaty".

Organizer's words: „vždy sa zobrazí počet osôb na lúke, ktoré nie sú umiestnené ešte v posteli“, later corrected through the orchestrator: no number. Draw the unplaced people as figures on the meadow, one figure per person.

## Scope
- `config/chata.yaml`: new scene rect `meadow: [112, 381, 124, 14]` under `map.scene`, with the comment `# lúka, kde čakajú ľudia mojej partie bez postele`.
- `app/models.py`: `SceneRects` gets a required `meadow: Rect`, the same as the other scene rects. A missing key stops the server at startup with `map.scene.meadow` in the message.
- `tests/test_models.py`: add `meadow` to `SCENE`, which also extends the parametrized missing-rect test. Add one test on the real `config/chata.yaml`: the `meadow` rect is inside the viewbox and overlaps no room, path, door or other scene rect.
- `static/index.html`:
  - `<script id="logic">`: new constants and pure functions `waitingFigures`, `meadowLayout`, `meadowLabel` (see below).
  - `<script id="app">`: new `drawMeadow(g, view)` called at the end of `drawBeds()`, so it is redrawn with every bed redraw and uses the same `viewState()` (pending changes included).
- `tests/js/logic.test.mjs`: tests of the new pure functions. Add `meadow` to the `scene` fixture. The existing bed hit-area tests must pass **unchanged** (exact values included), which proves that no hit area moved.
- `tests/manualne.md`: check items in sections 5, 6 and 8.
- `proposal.md`: one bullet in "Mapa" and the `meadow` line in the `map.scene` example in "Rozloženie chaty" (Slovak, see below).

Out of scope: the walk animation (T-017), any count or number text except the overflow badge, figures of other parties, the signposts (T-013), the status board, the legend (T-014), the bed sheet, move mode, the hidden summary (`hiddenSummary` / `renderSummary`), the server API.

## Who stands on the meadow
- Only **my party** (`app.myParty`), only on the **selected night** (`app.night`). There are no meadow figures when no party is chosen or when my party is not present that night (`isPresent` false).
- Count = `missingPlaces(viewState().state, party, night)`, i.e. needed slots minus held slots, never below 0. Kids who sleep in their parents' bed have no slot, so they get no figure, the same as in the beds.
- Figure kind: the waiting people are the party's slot indices `placed … needed − 1`, so the k-th waiting figure is `figureKind(party, placed + k)` (`placed = partySlots(...).length`). Adults come first, then kids, matching the order the beds use.
- The pending view counts. An optimistic assign removes the figure from the meadow at once, and a server rejection puts it back through the normal redraw.

## Pure functions (in `<script id="logic">`, no DOM, no `app`)
```js
var MEADOW_FIG_W = 10;   // width of the adult sprite (drawFigure)
var MEADOW_FIG_H = 12;   // height of the adult sprite
var MEADOW_GAP = 4;      // grass between two waiting figures

// The waiting figures of my party on a night: [{kind: "adult" | "kid"}], one per missing place,
// in slot order (see figureKind). [] when party is null or not present that night.
function waitingFigures(state, party, night)

// Where `count` figures stand in the meadow rect: one row, centred horizontally, vertically centred,
// integer coordinates (crisp pixels). capacity = max(1, floor((w + GAP) / (FIG_W + GAP))).
// count <= capacity: {cells: [[x, y], …count], more: 0, morePos: null}
// count >  capacity: {cells: first capacity − 1 cells, more: count − (capacity − 1), morePos: [x, y] of the last cell}
// count 0: {cells: [], more: 0, morePos: null}
function meadowLayout(rect, count)

// Screen-reader label for the meadow group, "" for 0:
// 1 → "Na lúke čaká 1 človek z vašej partie bez postele"
// 2–4 → "Na lúke čakajú N ľudia z vašej partie bez postele"
// 5+ → "Na lúke čaká N ľudí z vašej partie bez postele"
function meadowLabel(count)
```
With the decided rect (124 wide) the capacity is 9. A real party needs at most about 5 places, so the badge is a safety net only.

## Drawing (`drawMeadow`)
- Read the rect from `state.layout.map.scene.meadow`. Never hardcode the position.
- One `<g>` with `role="img"`, `aria-label = meadowLabel(n)` and `pointer-events="none"`. It is not a button and has no hit area. Nothing is drawn (no group at all) when `n` is 0.
- Each cell: `drawFigure(g, x, y, party.color, kind, shirtChar(party.name))`, the same sprite as in the beds, including the shirt letter from T-018. No yellow frame (that marks held places).
- Overflow: at `morePos` a small `board(...)` chip (`COLORS.plank`, about 12 × 12) with `"+" + more` in `COLORS.paper`, bold, size about 7, through `addText` (which uses `textContent`).
- `shape-rendering="crispEdges"` stays. Do not change the furniture, beds, boards or hit rects.

## proposal.md
- In "Mapa", after the bullet about the yellow frame, add:
  „- Ľudia mojej partie, ktorí v zvolenú noc ešte nemajú posteľ, stoja ako postavičky na lúke pri chodníku (`map.scene.meadow`), vo farbe partie, deti menšie. Deti, ktoré spia s rodičmi, nemajú vlastnú postavičku. Keď sa všetci nezmestia, na poslednom mieste je štítok „+N“. Postavičky iných partií na lúke nie sú.“
- In the `map.scene` example in "Rozloženie chaty", after the last line (`legend` from T-014), add:
  `    meadow: [112, 381, 124, 14]  # lúka, kde čakajú ľudia mojej partie bez postele`

## Acceptance criteria
- [x] `config/chata.yaml` and the `proposal.md` example have `meadow: [112, 381, 124, 14]`. `SceneRects` requires it, and a config without it fails at startup naming `map.scene.meadow` (the parametrized test covers this).
- [x] A pytest checks that the real `meadow` rect is inside the viewbox and overlaps no room, path, door or other scene rect.
- [x] With my party chosen and present on the selected night, the meadow shows exactly `missingPlaces` figures, in `party.color`, adults first and then the smaller kid figures. Kids in the parents' bed are not drawn.
- [x] Nothing is drawn on the meadow with no party chosen, when my party is not present that night, or when it has all its places (or more).
- [x] An assign removes the figure(s) from the meadow at once (optimistic). A rejection brings them back with the existing toast. Switching nights, choosing another party and a poll with changes from another device all redraw the meadow.
- [x] Overflow: with more people than fit, the last cell is a „+N“ chip and N is the number not drawn.
- [x] The meadow group is `role="img"` with the Slovak `meadowLabel` and is not focusable. It does not catch taps (`pointer-events="none"`).
- [x] The existing bed hit-area and signpost hit-area tests pass with unchanged expected values, and the "bed hit areas never overlap a scene board" test passes with `meadow` in the fixture.
- [x] No `innerHTML` introduced. Any text goes in through `addText` / `textContent`.
- [x] Node tests cover at least:
  - `waitingFigures`: no party → `[]`; absent night → `[]`; 2 adults + 1 kid with 0 placed → adult, adult, kid; the same party with 1 placed → adult, kid; 2 adults + 2 kids with 1 in the parents' bed → 3 figures; all placed or over → `[]`;
  - `meadowLayout`: count 0; count 3 in the real rect (centred, integer, all inside the rect, 14 apart); count equal to capacity (9) → no badge; count 10 → 8 cells, `more` 2, `morePos` the 9th cell; a rect too narrow for one figure still gives capacity 1 (count 3 → 0 cells, `more` 3);
  - `meadowLabel` for 0, 1, 2, 4, 5, 11 (`""`, `čaká 1 človek`, `čakajú 2 ľudia`, `čakajú 4 ľudia`, `čaká 5 ľudí`, `čaká 11 ľudí`).
- [x] `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md`:
  - section 5: with a party of 2 adults and 1 kid and no beds on a night, three figures (two adults, one smaller kid) stand on the meadow between the summer kitchen and the path. After „Zapísať nás sem“ on a double bed, one figure is left. Another night shows that night's figures. A night the party is not there shows none. With no party chosen there are none. A change from another device shows up after the poll;
  - section 6: on a 380 px phone the meadow figures are visible, nothing covers the letter icon or the path, and in dark mode the scene colours stay the same;
  - section 8: VoiceOver/TalkBack reads „Na lúke čakajú 2 ľudia z vašej partie bez postele“ (or the right form for the count) and does not stop on the meadow as a button.

## Notes for developer
- **Order:** T-014 (legend) and T-015 (loading intro) change the same files (`static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md`, `proposal.md`, and for T-014 also `config/chata.yaml`, `app/models.py`, `tests/test_models.py`). Start T-016 only after both are in `done/` and committed. T-016 needs nothing from them functionally. T-018 (shirt letter) changes `drawFigure` and adds `shirtChar`, which the meadow figures use, so start only after T-018 is in `done/` too. If T-014 is dropped, the orchestrator may remove it from `Depends on`. In that case the `meadow` line goes after `key` in the proposal example.
- **Why this rect:** `[112, 381, 124, 14]` is the grass strip under the letter and key icons (which end at y 380), right of the summer kitchen (ends at x 110), left of the entrance path (x 240) and above the bottom path (y 396). It is more than `BED_HIT_GROW` (8) away from every bed, so `bedHit` and `nightsHit` give the same rects as before. Check this with the existing tests. Do not change their expected values. If it collides with anything when drawn, note it in the dev log for the organizer instead of moving other elements.
- `sceneRects()` returns every `map.scene` key, so `meadow` becomes a fixed obstacle for hit-area growth automatically. That is fine and has no effect at this distance.
- Reuse `missingPlaces`, `partySlots`, `isPresent`, `figureKind`, `drawFigure`, `board`, `addText`, `viewState`. Do not duplicate the rules.
- Keep the layout logic in `meadowLayout` so T-017 can take the start points of the walk from it.
- The T-015 test `assert.doesNotMatch(app, /\b(2400|800|300)\b/)` scans the whole app script. Keep the new numbers as named constants in `<script id="logic">` and avoid those three literals in `<script id="app">`.
- No open decision from `proposal.md` is involved. The position, "only my party", "no kids in the parents' bed" and the „+N“ fallback are product-owner defaults for the organizer to confirm.

---
## Dev log
Done in one pass; all acceptance criteria verified (the optimistic and rejection paths by code reading, the rest by tests and in headless Chrome).

**What changed**
- `config/chata.yaml`: `map.scene.meadow: [112, 381, 124, 14]` with the Slovak comment.
- `app/models.py`: `SceneRects.meadow: Rect` (required; the missing-rect test confirms `map.scene.meadow` is named).
- `tests/test_models.py`: `meadow` in `SCENE`; new `test_meadow_is_inside_the_viewbox_and_overlaps_nothing` (real config: inside the viewbox, no overlap with rooms, paths, doors or other scene rects).
- `static/index.html`: in `<script id="logic">` the constants `MEADOW_FIG_W/H/GAP` and pure `waitingFigures`, `meadowLayout`, `meadowLabel` (placed before `isFreeSlot`). In `<script id="app">`, `drawMeadow(parent, view)` is called at the end of `drawBeds()`, reads `view.state` (pending included) and `scene.meadow`, draws one `<g role="img" aria-label pointer-events="none">` (none when 0 figures) with `drawFigure(..., shirtChar(party.name))` and, on overflow, a 12 x 12 `board` chip with `"+N"` through `addText`. No `innerHTML`; no 2400/800/300 literals in the app script.
- `tests/js/logic.test.mjs`: `meadow` in the `scene` fixture; tests for `waitingFigures`, `meadowLayout` (0, 3 in the real rect = [[155,382],[169,382],[183,382]], 9 = capacity, 10 = 8 cells + `+2` on the 9th cell, too-narrow rect), `meadowLabel` (0, 1, 2, 4, 5, 11), and a page-source test for the group attributes. Existing bed and signpost hit-area tests are unchanged and pass.
- `tests/manualne.md`: items in sections 5, 6 and 8. `proposal.md`: the "Mapa" bullet and the `meadow` line in the `map.scene` example.

**Tests**
- `node --test tests/js/` -> 141 pass, 0 fail.
- `uv run pytest -q` -> 382 passed.

**Visual check** (headless Chrome, 380 px, 2x, own server on port 8057 with temp data, now stopped; screenshots in `/tmp/t016/`):
- Party 2 adults + 1 kid, Thursday, no beds: 3 figures (two adults, one smaller kid) with the shirt letter, in the party colour, on the grass between the summer kitchen and the path, below the letter icon; nothing is covered. Label read from the DOM: „Na lúke čakajú 3 ľudia z vašej partie bez postele“, `pointer-events="none"`, no tabindex.
- After one assign on a double bed: label changed to 2 people.
- Party of 11 people: 8 figures plus a „+3“ chip on the 9th cell; the „+3“ text slightly overlaps the light top edge of the chip but reads fine.
- Party not present that night: no group. No party chosen: no group.
- Dark colour scheme emulated: the meadow looks identical (fixed scene colours).

**Notes for the organizer / follow-ups**
- Figures stand 1 unit above the bottom path (y 396); no collision with other elements was found, so no other element was moved.
- When testing I noticed that setting `localStorage` `chata.myParty` and reloading once restores the old value (the page seems to write it back on unload); only a test-driver quirk, not changed.
- Not driven in the browser: the optimistic removal and the rollback on rejection. They go through the same `viewState()` redraw as the beds, which the existing code already covers.


## Review round 1
Reviewer, 23. 10. 2026. Scope: `app/models.py`, `config/chata.yaml`, `proposal.md` (2 lines), `static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md`, `tests/test_models.py`. `tasks/todo/T-019-*` in the working tree is a separate task and was not reviewed.

**Tests run by the reviewer**
- `node --test tests/js/`: 141 pass, 0 fail.
- `uv run pytest -q`: 382 passed. `test_missing_scene_rect_names_it[meadow]` and `test_meadow_is_inside_the_viewbox_and_overlaps_nothing` are among them.
- The diff of `tests/js/logic.test.mjs` removes only the `scene` fixture line (to add `meadow`). No expected value of the bed or signpost hit-area tests changed.

**Code check**
- `waitingFigures` reuses `isPresent`, `partySlots`, `missingPlaces` and `figureKind`, and adds no rule of its own. Kids in the parents' bed get no figure, and the figure kinds continue from the held slots (`placed + k`), so the meadow and the beds agree.
- `meadowLayout`: the capacity formula matches the spec (9 in the real rect), the coordinates are integers, the badge goes in the last cell, and a narrow rect has capacity 1. `meadowLabel` uses the correct Slovak plural forms.
- `drawMeadow` reads the rect only from `state.layout.map.scene.meadow` and uses `viewState()` (pending changes included). It draws one `<g role="img" aria-label pointer-events="none">` and no group at all for 0. Text goes in only through `addText`. No `innerHTML`, no 2400/800/300 literals in the app script, and no new motion.
- `SceneRects.meadow` is required. `sceneRects()` picks it up as a hit-area obstacle, and since the existing hit tests pass unchanged, no hit area moved. The rect `[112, 381, 124, 14]` sits inside the viewbox. The summer kitchen ends at x 110, the letter icon at y 380, the bottom path starts at y 396 and the entrance path at x 240, so nothing overlaps.

**Browser check** (headless Chrome 155, 380 × 760 at 2×, own server on 8063 with temp data, CDP driver; server and browser stopped afterwards)
- 2 adults + 1 kid, Thursday, no beds: two adults and one smaller kid, in the party colour with the shirt letter, centred on the grass under the letter icon, clear of the path, the kitchen and the icon. The label reads „Na lúke čakajú 3 ľudia …“.
- 2 adults + 2 kids, 1 kid in the parents' bed: 3 figures (adult, adult, kid).
- 11 people: 8 figures plus a „+3“ chip in the 9th cell, which ends at x 235, inside the rect and before the path.
- Party absent that night (arrives Friday) and no party chosen: no meadow group.
- Dark colour scheme emulated: the meadow pixels are identical.
- Accessibility tree: one node with role `image` named „Na lúke čaká 10 ľudí …“. It is not focusable and its children are not exposed.
- **Optimistic assign.** I held `api/assign` with `Fetch.requestPaused` and tapped the double bed, then „Zapísať nás sem (2 miesta)“. While the request was still held, the meadow went from 3 figures to 1 right away. After the request continued it stayed at 1.
- **Rejection.** I held a second assign (single bed), and the meadow went from 1 to none. Another client then took that slot through the API and I let the request through. The server answered `slot_taken`, the kid figure came back on the meadow, and the toast read „Toto miesto má vo štvrtok už Veľká partia.“
- Switching nights redraws (Thursday 1, Friday 3). Picking another party in „Kto si?“ redraws. A release from another device showed up after the 30 s poll (1 → 2 figures).

**About the `chata.myParty` note in the Dev log.** This is not a page bug. The page writes `chata.myParty` in only two places: `setMyParty` (a pick in „Kto si?“ or a newly created party) and `forgetMyParty` (the stored party no longer exists). It has no `unload`, `pagehide` or `beforeunload` handler, so the Dev log's guess that it writes the value back on unload is wrong. In my run, `localStorage.setItem` on the page's origin followed by a reload kept the new value three times out of three. A pick through the „Kto si?“ UI also survived a reload. The developer's driver ran its first `setItem` while the tab was still on `about:blank`, where storage access throws, so that write never landed. That is the cause of the "revert".

**Blocker**
- None.

**Suggestion**
- `static/index.html` `drawMeadow`, the „+N“ chip: `board()` leaves only a 6 × 6 face inside the 12 × 12 chip, and its light top stripe crosses the top of the 7 px text. It reads fine at the current scale, as the developer also noted. If the organizer finds it cramped, a plain plank rect without the stripe, or a slightly wider chip still inside the cell, would look cleaner. Not required: with real party sizes the badge never appears.

**Nit**
- `tests/js/logic.test.mjs` "page: the meadow is drawn …": the regex depends on the attribute order inside the `svgEl` call. It is fine as a smoke check, but it is brittle if someone reorders the keys.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2
(reviewer appends)

## Test report
Tester, 23. 10. 2026. Result: **PASS**, no bugs. No test files added (the existing suite already covered the pure functions, the config test and the page source check). The label „z vašej partie“ was not counted against the task (T-020).

**Commands and results**
- `node --test tests/js/` (repo root): 141 pass, 0 fail.
- `uv run pytest -q` (repo root): 382 passed. Includes `test_missing_scene_rect_names_it[meadow]` and `test_meadow_is_inside_the_viewbox_and_overlaps_nothing`.
- Server on `127.0.0.1:8061` (own port, temp data dir `/tmp/t016-tester/data`, test secrets in env only, no `.env`, no `data/` touched). `/api/health` ok. Stopped afterwards.
- Startup check: a copy of `config/chata.yaml` without the `meadow` line, through `create_app`, gives `ConfigError: ... map.scene.meadow: Field required`.
- `GET /api/state` (after join with the group cookie): `layout.map.scene.meadow` = `[112, 381, 124, 14]`, viewbox `[380, 412]`. 304 on `If-None-Match`. Without cookie: 401. `/data/chata-data.yaml` and `/chata-data.yaml` over HTTP: 404.
- Browser (headless Chrome, CDP driver `/tmp/t016-tester/scripts/drive.mjs`, viewport 380 × 760 at 2×, fresh server data): 21 of 21 checks pass. Screenshots in `/tmp/t016-tester/shots/`.
- Pure-function probes (`/tmp/t016-tester/scripts/probe_logic.mjs`): count −1, NaN, undefined → no cells; labels for 21, 22, 24, 25 correct; centring for 1 and 2 figures correct; capacity 9 in the real rect, 8 for a 121-wide rect.

**Acceptance criteria**

| # | Criterion | Result | How verified |
| --- | --- | --- | --- |
| 1 | `meadow` in yaml and proposal example, `SceneRects` requires it, startup error names `map.scene.meadow` | PASS | config diff, `/api/state`, startup probe with the line removed |
| 2 | pytest: real meadow rect inside viewbox, overlaps nothing | PASS | `uv run pytest` (test passes) |
| 3 | Party chosen and present: exactly `missingPlaces` figures, party colour, adults then kids, kids in parents' bed not drawn | PASS | browser: 2+1 → 3 figures, fill `#2F7D6D` only party colour; 2+2 with 1 in parents' bed → 3 figures; body widths `[10,10,8]` (kid smaller) |
| 4 | Nothing with no party, party absent that night, or all places held | PASS | browser: no party → no group; C (arrives Fri) on Thu → no group; G with 3 of 3 placed on Sat → no group |
| 5 | Optimistic removal, rollback on rejection with toast, night switch, party switch, poll redraw | PASS | browser: night switch Thu → Fri shows C's 1 person; held `/api/assign` → meadow 3 → 1 at once; another client takes the slot, release → server `slot_taken`, meadow back to 3, toast „Toto miesto má v piatok už Driver F …“; another device's change appears after the poll (3 → 2 in 21 s) |
| 6 | Overflow: last cell is „+N“, N = not drawn | PASS | browser: 11 people → 8 figures and chip `+3`, chip inside the rect (x ≤ 236). Probe: count 10 in real rect → `more` 2 |
| 7 | `role="img"`, Slovak `meadowLabel`, not focusable, `pointer-events="none"` | PASS | DOM: role `img`, no tabindex, `pointer-events` none, label „Na lúke čakajú 3 ľudia z vašej partie bez postele“; `elementFromPoint` at its centre is not the meadow |
| 8 | Bed and signpost hit-area tests unchanged and passing; "no overlap with boards" test with `meadow` | PASS | diff of `tests/js/logic.test.mjs` only changes the `scene` fixture; full Node run passes |
| 9 | No `innerHTML`, text via `addText` / `textContent` | PASS | `grep innerHTML static/index.html` finds nothing; `+N` goes through `addText` |
| 10 | Node tests for `waitingFigures`, `meadowLayout`, `meadowLabel` as listed | PASS | all listed cases present in `tests/js/logic.test.mjs` and pass |
| 11 | `node --test tests/js/` and `uv run pytest -q` pass | PASS | see commands |
| 12 | `tests/manualne.md` sections 5, 6, 8 | PASS | items present at lines 63, 71, 108 |
| 13 | `proposal.md`: "Mapa" bullet and `meadow` line in the example | PASS | diff |

**Extra scenarios tried**
- Several parties in the same state (A, B, D, E, F, G created in one run): the page only ever shows my party's figures, colours matched the chosen party in each run.
- Kid in parents' bed (2 adults + 2 kids, 1 in bed): 3 figures, not 4.
- Party with 11 people (8 adults + 3 kids): 8 figures and `+3`.
- Night switch: Thursday → Friday changes the group (party C arrives Friday, so Thursday has none and Friday shows one). Switching back to Thursday was not run.
- Rejection path: held request, competing write from another client, server answer `slot_taken` (409), rollback, toast.
- Unauthenticated `/api/state` (401), no HTTP access to `data/` (404).
- Edge inputs to `meadowLayout`/`meadowLabel` (NaN, negative, undefined, zero-width rect): no crash. A zero-width rect with count 2 gives `morePos` `[-5, 1]`, i.e. outside the rect. This only happens with a broken config, the real rect is fixed, so I did not count it as a bug.

**Not verifiable here (in `tests/manualne.md`)**
- VoiceOver and TalkBack reading of the meadow label (section 8), real phone rendering at 380 px and dark mode on a device (section 6), two-device behaviour (section 5). The dark-mode scene colours were not rechecked in the browser (fixed colours in code).

**Result:** all criteria pass, no regressions (`tasks/done/` tests are part of the 382 pytest and 141 Node runs). Moved to `tasks/done/`.
