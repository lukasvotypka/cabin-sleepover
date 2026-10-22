# T-016: People without a bed wait as figures on the meadow

- **Phase:** 1 (organizer request, 22. 10. 2026)
- **Depends on:** T-013, T-014, T-015 (T-014 and T-015 only for build order: they change the same files, see Notes)
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
- Each cell: `drawFigure(g, x, y, party.color, kind)`, the same sprite as in the beds. No yellow frame (that marks held places).
- Overflow: at `morePos` a small `board(...)` chip (`COLORS.plank`, about 12 × 12) with `"+" + more` in `COLORS.paper`, bold, size about 7, through `addText` (which uses `textContent`).
- `shape-rendering="crispEdges"` stays. Do not change the furniture, beds, boards or hit rects.

## proposal.md
- In "Mapa", after the bullet about the yellow frame, add:
  „- Ľudia mojej partie, ktorí v zvolenú noc ešte nemajú posteľ, stoja ako postavičky na lúke pri chodníku (`map.scene.meadow`), vo farbe partie, deti menšie. Deti, ktoré spia s rodičmi, nemajú vlastnú postavičku. Keď sa všetci nezmestia, na poslednom mieste je štítok „+N“. Postavičky iných partií na lúke nie sú.“
- In the `map.scene` example in "Rozloženie chaty", after the last line (`legend` from T-014), add:
  `    meadow: [112, 381, 124, 14]  # lúka, kde čakajú ľudia mojej partie bez postele`

## Acceptance criteria
- [ ] `config/chata.yaml` and the `proposal.md` example have `meadow: [112, 381, 124, 14]`. `SceneRects` requires it, and a config without it fails at startup naming `map.scene.meadow` (the parametrized test covers this).
- [ ] A pytest checks that the real `meadow` rect is inside the viewbox and overlaps no room, path, door or other scene rect.
- [ ] With my party chosen and present on the selected night, the meadow shows exactly `missingPlaces` figures, in `party.color`, adults first and then the smaller kid figures. Kids in the parents' bed are not drawn.
- [ ] Nothing is drawn on the meadow with no party chosen, when my party is not present that night, or when it has all its places (or more).
- [ ] An assign removes the figure(s) from the meadow at once (optimistic). A rejection brings them back with the existing toast. Switching nights, choosing another party and a poll with changes from another device all redraw the meadow.
- [ ] Overflow: with more people than fit, the last cell is a „+N“ chip and N is the number not drawn.
- [ ] The meadow group is `role="img"` with the Slovak `meadowLabel` and is not focusable. It does not catch taps (`pointer-events="none"`).
- [ ] The existing bed hit-area and signpost hit-area tests pass with unchanged expected values, and the "bed hit areas never overlap a scene board" test passes with `meadow` in the fixture.
- [ ] No `innerHTML` introduced. Any text goes in through `addText` / `textContent`.
- [ ] Node tests cover at least:
  - `waitingFigures`: no party → `[]`; absent night → `[]`; 2 adults + 1 kid with 0 placed → adult, adult, kid; the same party with 1 placed → adult, kid; 2 adults + 2 kids with 1 in the parents' bed → 3 figures; all placed or over → `[]`;
  - `meadowLayout`: count 0; count 3 in the real rect (centred, integer, all inside the rect, 14 apart); count equal to capacity (9) → no badge; count 10 → 8 cells, `more` 2, `morePos` the 9th cell; a rect too narrow for one figure still gives capacity 1 (count 3 → 0 cells, `more` 3);
  - `meadowLabel` for 0, 1, 2, 4, 5, 11 (`""`, `čaká 1 človek`, `čakajú 2 ľudia`, `čakajú 4 ľudia`, `čaká 5 ľudí`, `čaká 11 ľudí`).
- [ ] `node --test tests/js/` and `uv run pytest -q` pass.
- [ ] `tests/manualne.md`:
  - section 5: with a party of 2 adults and 1 kid and no beds on a night, three figures (two adults, one smaller kid) stand on the meadow between the summer kitchen and the path. After „Zapísať nás sem“ on a double bed, one figure is left. Another night shows that night's figures. A night the party is not there shows none. With no party chosen there are none. A change from another device shows up after the poll;
  - section 6: on a 380 px phone the meadow figures are visible, nothing covers the letter icon or the path, and in dark mode the scene colours stay the same;
  - section 8: VoiceOver/TalkBack reads „Na lúke čakajú 2 ľudia z vašej partie bez postele“ (or the right form for the count) and does not stop on the meadow as a button.

## Notes for developer
- **Order:** T-014 (legend) and T-015 (loading intro) change the same files (`static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md`, `proposal.md`, and for T-014 also `config/chata.yaml`, `app/models.py`, `tests/test_models.py`). Start T-016 only after both are in `done/` and committed. T-016 needs nothing from them functionally. If T-014 is dropped, the orchestrator may remove it from `Depends on`. In that case the `meadow` line goes after `key` in the proposal example.
- **Why this rect:** `[112, 381, 124, 14]` is the grass strip under the letter and key icons (which end at y 380), right of the summer kitchen (ends at x 110), left of the entrance path (x 240) and above the bottom path (y 396). It is more than `BED_HIT_GROW` (8) away from every bed, so `bedHit` and `nightsHit` give the same rects as before. Check this with the existing tests. Do not change their expected values. If it collides with anything when drawn, note it in the dev log for the organizer instead of moving other elements.
- `sceneRects()` returns every `map.scene` key, so `meadow` becomes a fixed obstacle for hit-area growth automatically. That is fine and has no effect at this distance.
- Reuse `missingPlaces`, `partySlots`, `isPresent`, `figureKind`, `drawFigure`, `board`, `addText`, `viewState`. Do not duplicate the rules.
- Keep the layout logic in `meadowLayout` so T-017 can take the start points of the walk from it.
- The T-015 test `assert.doesNotMatch(app, /\b(2400|800|300)\b/)` scans the whole app script. Keep the new numbers as named constants in `<script id="logic">` and avoid those three literals in `<script id="app">`.
- No open decision from `proposal.md` is involved. The position, "only my party", "no kids in the parents' bed" and the „+N“ fallback are product-owner defaults for the organizer to confirm.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
