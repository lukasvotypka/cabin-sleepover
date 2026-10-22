# T-013: My party's places per night on the night signposts

- **Phase:** 1 (organizer request, 22. 10. 2026)
- **Depends on:** T-012
- **Size:** S

## Goal
When *moja partia* is chosen, the organizer wants to see, for every night at once, how many places the party needs and how many of its people are placed in beds, with nights that are under or over clearly marked. Today the status board ("Tabuľka s partiou a stavom" in `proposal.md`) shows only the first problem night, so finding the others means tapping through the night signposts. This task adds a small per-night tally chip to each of the three night signposts ("Tri smerovníky nocí" in `proposal.md`, section "Čo je na stránke"). It adds no new view.

Organizer's words: „keď mám vybratú partiu, tak aby som mal prehľad na ktorý deň koľkí sme a koľko osôb mám umiestnených v posteli (a vyznačiť ak je niekto nad a niekto pod limit)“.

## Scope
- `static/index.html`:
  - `<script id="logic">`: new pure functions `nightTally`, `partyTallies`, `tallyChipText`, `tallyLabel` (section `// --- parties and nights ---` / `// --- texts ---`, next to `missingPlaces`, `extraPlaces` and `myPartyStatus`).
  - `drawNights()`: draw the chip and extend the signpost `aria-label`.
- `tests/js/logic.test.mjs`: tests of the new pure functions (next to the `// --- my-party status ---` tests).
- `tests/manualne.md`: check items (sections 5 and 8).
- `proposal.md`: one sentence in the "Tri smerovníky nocí" bullet (Slovak, see below).

Out of scope: the status board (`drawStatus`, `myPartyStatus` stay exactly as they are), geometry, `config/chata.yaml`, hit areas (`nightsHit`), the bed sheet, the hidden summary (`hiddenSummary` / `renderSummary`), the server, new `COLORS` keys.

## Definitions (reuse existing helpers, do not duplicate the rules)
For party `p` and night `n`:
- `present = isPresent(p, n)` (arrive ≤ n < leave)
- `needed = neededOnNight(p, n)` (adults + kids − kids_in_parents_bed when present, else 0)
- `placed = partySlots(state, p.id, n).length`
- `kind`:
  - `"absent"`: not present and `placed === 0`
  - `"under"`: `placed < needed`
  - `"over"`: `placed > needed` (this includes "not present but still holds slots")
  - `"ok"`: `placed === needed` (present)

`kind === "under"` must hold exactly when `missingPlaces(state, p, n) > 0`, and `"over"` exactly when `extraPlaces(state, p, n) > 0`, so the chips never disagree with the status board.

## Pure functions (in `<script id="logic">`)
```js
// Placed vs needed places of a party on one night.
// {night, present, needed, placed, kind: "absent" | "under" | "over" | "ok"}
function nightTally(state, party, night)

// nightTally for every night of the event, in event order; [] when party is null.
function partyTallies(state, party)

// Short text on the signpost chip.
function tallyChipText(t)

// Full sentence for screen readers (aria-label of the signpost).
function tallyLabel(t)
```

### Exact Slovak texts (informal plural, as in the status board)
`tallyChipText` (`d` = |placed − needed|):

| kind | chip text | example |
| --- | --- | --- |
| under | `"máte " + placed + "/" + needed + " !"` | `máte 2/3 !` |
| over | `"máte " + placed + "/" + needed` | `máte 4/3` |
| ok | `"máte " + placed + "/" + needed` | `máte 3/3` |
| absent | `"nie ste tu"` | `nie ste tu` |

`tallyLabel` (use `pluralPlaces` and `missingVerb`):

| kind | sentence | example |
| --- | --- | --- |
| under | `"Máte " + pluralPlaces(placed) + ", potrebujete " + needed + ", " + missingVerb(d) + " " + pluralPlaces(d)` | `Máte 2 miesta, potrebujete 3, chýba 1 miesto` / `Máte 0 miest, potrebujete 2, chýbajú 2 miesta` |
| over, present | `"Máte " + pluralPlaces(placed) + ", potrebujete " + needed + ", o " + pluralPlaces(d) + " viac"` | `Máte 4 miesta, potrebujete 3, o 1 miesto viac` |
| over, not present | `"V túto noc tu nie ste, ale máte " + pluralPlaces(placed)` | `V túto noc tu nie ste, ale máte 1 miesto` |
| ok | `"Máte " + pluralPlaces(placed) + ", presne toľko, koľko potrebujete"` | `Máte 3 miesta, presne toľko, koľko potrebujete` |
| absent | `"V túto noc tu nie ste"` | |

## Drawing (`drawNights`)
- Party: `partyById(state, app.myParty)`, the same lookup `drawStatus` uses. Use the same `state` that `drawNights` already gets (`app.state`, like the occupancy count and the status board). Do not switch the boards to `viewState()`.
- **No party chosen:** the signposts look and read exactly as today.
- **Party chosen:** the dates row (`info.dates`, baseline `r[1] + 23`) is replaced by the tally row. The night label row, the `obsadené` row and the `X z 20` row stay where they are. The dates stay in the `aria-label`, and the event dates stay on the title board.
  - Chip (kinds under, over, ok): an edge rect `[x + 5, r[1] + 16, w - 10, 10]` and on it a face rect inset by 1 unit. Centred bold text, size 7, baseline `r[1] + 24`, `maxWidth: w - 14`.
  - Absent: no chip. Centred regular text `nie ste tu`, size 6.5, `COLORS.ink`, baseline `r[1] + 23` (same as the dates row).
- Colours are the existing scene `COLORS`, the same meaning as on the status board. T-012 kept them unchanged in the autumn scene, so no new keys:
  - under: edge `redEdge`, face `red`, text `white`
  - over: edge `amberEdge`, face `amber`, text `ink`
  - ok: edge `greenEdge`, face `green`, text `white`
- The `aria-label` becomes the current label plus `". " + tallyLabel(t)` when a party is chosen, e.g. `Noc Št → Pi, 29./30. 10., obsadené 12 z 20 miest, zvolená noc. Máte 2 miesta, potrebujete 3, chýba 1 miesto`.
- Tapping a signpost still only selects the night. `aria-pressed`, the hit area and the post are unchanged.
- The chips update with every render (poll, write response, change of *moja partia* in „Kto si?“), because `drawBoards` already redraws the signposts. Choosing a party in „Kto si?“ already calls `render()` after `setMyParty`, so nothing extra is needed.
- All text goes through `addText` / `setText` (`textContent`). No `innerHTML`. No party name appears on the signposts.

## proposal.md
In the "Tri smerovníky nocí" bullet, after „Na každom je „obsadené X z 20“.“, add:
„Keď je vybratá moja partia, namiesto dátumu je na smerovníku štítok „máte 2/3“ (umiestnení z potrebných miest): červený s výkričníkom, keď miesta chýbajú, oranžový, keď ich je viac, zelený, keď sedia, a „nie ste tu“, keď partia v tú noc nie je na chate.“

## Acceptance criteria
- [ ] `nightTally`, `partyTallies`, `tallyChipText`, `tallyLabel` exist in `<script id="logic">`, are pure (no DOM, no `app`), and reuse `isPresent`, `neededOnNight`, `partySlots`, `pluralPlaces`, `missingVerb`.
- [ ] With a party chosen, each signpost shows the chip text and colour from the tables above, in place of the dates row. Without a party, signposts are unchanged.
- [ ] Signpost `aria-label` ends with `tallyLabel` when a party is chosen and is unchanged otherwise.
- [ ] No geometry, hit-area, `config/chata.yaml` or status-board changes. `shape-rendering="crispEdges"` stays. No `innerHTML` introduced.
- [ ] `proposal.md` has the sentence above in the "Tri smerovníky nocí" bullet.
- [ ] Node tests (in `tests/js/logic.test.mjs`) cover at least:
  - under, over, ok and absent kinds, with `placed` and `needed` values;
  - kids in parents' bed lower `needed` (adults 2, kids 1, kids_in_parents_bed 1, 2 slots held → ok `máte 2/2`);
  - not present but holding a slot → `over`, chip `máte 1/0`, label `V túto noc tu nie ste, ale máte 1 miesto`;
  - all chip texts and all label sentences from the tables, including the plural forms (`chýbajú 2 miesta`, `0 miest`, `o 2 miesta viac`);
  - `partyTallies` returns one entry per event night in order, and `[]` for `null`;
  - consistency: for every night of a few fixtures, `kind === "under"` ⇔ `missingPlaces > 0` and `kind === "over"` ⇔ `extraPlaces > 0`.
- [ ] `node --test tests/js/` and `uv run pytest -q` pass.
- [ ] `tests/manualne.md`:
  - section 5: with a party chosen, the three signposts show `máte X/Y` chips in the right colours, and `nie ste tu` on nights outside the stay; no chips without a party; chips change after an assign/release and after switching party in „Kto si?“; text readable on a 380 px phone (pinch zoom allowed);
  - section 8: VoiceOver/TalkBack reads the tally sentence on each signpost.

## Notes for developer
- Signpost width is `(196 − 8) / 3 ≈ 62.7` units, so the chip inner width is about 50 units. `máte 10/10 !` (12 monospace chars at size 7 ≈ 50 units) is the longest realistic text. `setText` squeezes anything wider, so no ellipsis is needed.
- The numbers count **places**, not heads: kids sleeping in the parents' bed are not counted, the same as everywhere else (`neededSlots`). This is the stated rule in `proposal.md`, not a new decision.
- Keep `myPartyStatus` and its tests untouched. The chips complement the status board, they do not replace it.
- T-012 (palette) touches the same file and is in review. Start only after it is in `done/` and committed, and rebase your mental model on the committed `drawNights`.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
