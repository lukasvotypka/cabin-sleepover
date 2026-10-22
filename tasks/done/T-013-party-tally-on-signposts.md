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
- [x] `nightTally`, `partyTallies`, `tallyChipText`, `tallyLabel` exist in `<script id="logic">`, are pure (no DOM, no `app`), and reuse `isPresent`, `neededOnNight`, `partySlots`, `pluralPlaces`, `missingVerb`.
- [x] With a party chosen, each signpost shows the chip text and colour from the tables above, in place of the dates row. Without a party, signposts are unchanged.
- [x] Signpost `aria-label` ends with `tallyLabel` when a party is chosen and is unchanged otherwise.
- [x] No geometry, hit-area, `config/chata.yaml` or status-board changes. `shape-rendering="crispEdges"` stays. No `innerHTML` introduced.
- [x] `proposal.md` has the sentence above in the "Tri smerovníky nocí" bullet.
- [x] Node tests (in `tests/js/logic.test.mjs`) cover at least:
  - under, over, ok and absent kinds, with `placed` and `needed` values;
  - kids in parents' bed lower `needed` (adults 2, kids 1, kids_in_parents_bed 1, 2 slots held → ok `máte 2/2`);
  - not present but holding a slot → `over`, chip `máte 1/0`, label `V túto noc tu nie ste, ale máte 1 miesto`;
  - all chip texts and all label sentences from the tables, including the plural forms (`chýbajú 2 miesta`, `0 miest`, `o 2 miesta viac`);
  - `partyTallies` returns one entry per event night in order, and `[]` for `null`;
  - consistency: for every night of a few fixtures, `kind === "under"` ⇔ `missingPlaces > 0` and `kind === "over"` ⇔ `extraPlaces > 0`.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md`:
  - section 5: with a party chosen, the three signposts show `máte X/Y` chips in the right colours, and `nie ste tu` on nights outside the stay; no chips without a party; chips change after an assign/release and after switching party in „Kto si?“; text readable on a 380 px phone (pinch zoom allowed);
  - section 8: VoiceOver/TalkBack reads the tally sentence on each signpost.

## Notes for developer
- Signpost width is `(196 − 8) / 3 ≈ 62.7` units, so the chip inner width is about 50 units. `máte 10/10 !` (12 monospace chars at size 7 ≈ 50 units) is the longest realistic text. `setText` squeezes anything wider, so no ellipsis is needed.
- The numbers count **places**, not heads: kids sleeping in the parents' bed are not counted, the same as everywhere else (`neededSlots`). This is the stated rule in `proposal.md`, not a new decision.
- Keep `myPartyStatus` and its tests untouched. The chips complement the status board, they do not replace it.
- T-012 (palette) touches the same file and is in review. Start only after it is in `done/` and committed, and rebase your mental model on the committed `drawNights`.

---
## Dev log
**Done.**
- `static/index.html`: pure functions `nightTally`, `partyTallies` (section "parties and nights") and `tallyChipText`, `tallyLabel` (section "texts"), reusing `isPresent`, `neededOnNight`, `partySlots`, `pluralPlaces`, `missingVerb`. New `TALLY_COLORS` map (under/over/ok -> keys of the existing `COLORS`, no new colour keys). `drawNights()` looks up `partyById(state, app.myParty)` once; with a party it replaces the dates row by the chip (edge rect `[x+5, r[1]+16, w-10, 10]`, face inset by 1, bold size 7 text at baseline `r[1]+24`, `maxWidth: w-14`) or, for absent, plain `nie ste tu` (size 6.5, ink, baseline `r[1]+23`). The `aria-label` gets `". " + tallyLabel(t)` appended only with a party. Without a party the output is unchanged. No change to hit areas, geometry, `drawStatus`, `myPartyStatus`, `config/chata.yaml`. No `innerHTML`.
- `tests/js/logic.test.mjs`: 8 new tests under "night tally" (kinds with placed/needed, kids in parents' bed, not present but holding a slot, all chip texts, all label sentences with plural forms, `partyTallies` order and `[]` for null, consistency with `missingPlaces`/`extraPlaces` over 3 parties and all nights).
- `tests/manualne.md`: one item in section 5, one in section 8.
- `proposal.md`: the sentence added to the "Tri smerovníky nocí" bullet.

**Commands and results**
- `node --test tests/js/` : 119 pass, 0 fail.
- `uv run pytest -q` : 379 passed.
- `node --check` on both inline scripts of `static/index.html`: ok.

**Notes**
- Not verified in a real browser (visual look of the chip on a 380 px phone is covered by the manual checklist items). The `drawNights` change was checked by reading and syntax check only.
- The task file was moved todo -> in-progress by `mv`; `git status` shows the todo path as deleted until the orchestrator commits.


## Review round 1
(reviewer appends)

**Tests run by the reviewer:** `node --test tests/js/` 119 pass, 0 fail. `uv run pytest -q` 379 passed.

**Code check:**
- `nightTally`, `partyTallies`, `tallyChipText` and `tallyLabel` are pure. They do not touch the DOM or `app`, they reuse `isPresent`, `neededOnNight`, `partySlots`, `pluralPlaces` and `missingVerb`, and they sit in the requested sections. The kind order (absent → under → over → ok) matches the definitions. `under` can only happen when the party is present (needed is 0 otherwise), so `under`/`over` agree with `missingPlaces`/`extraPlaces`, and a consistency test covers this.
- `drawNights` uses `partyById(state, app.myParty)` on `app.state`, the same as `drawStatus`. With no party, the dates row and the `aria-label` are byte-for-byte what they were. The chip geometry (edge `[x+5, r1+16, w-10, 10]`, face inset 1, bold 7 at `r1+24`, `maxWidth: w-14`), the absent row (6.5, ink, `r1+23`) and the `TALLY_COLORS` mapping to existing `COLORS` keys all match the spec. Hit area, post, `aria-pressed`, `drawStatus`, `myPartyStatus`, `config/chata.yaml` and `crispEdges` are unchanged. No `innerHTML` was added, all text goes through `addText`/`setText`, and no party name appears on the signposts.
- If `app.myParty` points to a deleted party, `partyById` returns null, so the signposts fall back to the dates.
- `proposal.md` has the exact sentence. `tests/manualne.md` has the section 5 and section 8 items.
- The tests cover all four kinds with placed/needed, kids in the parents' bed (`máte 2/2`), not present but holding a slot (`máte 1/0` plus its label), every chip text, every label sentence including `chýbajú 2 miesta`, `0 miest` and `o 2 miesta viac`, `partyTallies` order and `[]`, and the consistency check.

**Visual check (headless Chrome, 380×760 CSS px, DPR 3, light and dark `prefers-color-scheme`, own server on port 8765 with temp data):**
- Party under/over/ok on the three nights: red `máte 2/3 !` (white text), cream/amber `máte 4/3` (ink), green `máte 3/3` (white). Each chip sits inside the signpost face, with a visible gap above „obsadené“. The selected (yellow) signpost still reads well.
- Longest realistic text `máte 10/12 !` measures 48.7 units and is squeezed to `maxWidth` by `setText` (`textLength` set). It still fits the chip and stays legible.
- Absent nights show plain `nie ste tu` in place of the dates. With no party, the dates are shown and there are no chips.
- Dark mode: the scene and chips look identical, as intended (fixed scene colours).
- The `aria-label` values read in the browser match the spec, e.g. `Noc Št → Pi, 29./30. 10., obsadené 12 z 20 miest, zvolená noc. Máte 10 miest, potrebujete 12, chýbajú 2 miesta`.

**Blocker:** none.

**Suggestion:**
- The `over` chip face (`COLORS.amber` #F3E3C0) is very pale on the wooden signpost and reads more cream than "orange". It is the same colour as the status board's soft-amber note, so it is consistent and within the spec. If the organizer finds it too faint on the phone, a later task could add a stronger chip face. Not for this task, because it would need a new `COLORS` key.
- At 380 px the size-7 chip text is about 7 CSS px tall. This is accepted by the task ("pinch zoom allowed") and is already on the manual checklist.

**Nit:** `partyTallies` is not used by the page yet (`drawNights` calls `nightTally` per night). The spec requires it and the tests cover it, so it stays.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2
(reviewer appends)

## Test report

**Verdict: PASS.** No failures, no regressions. No test was added (the gaps I looked at are covered by the existing Node tests and the manual checklist).

**Commands and results**
- `node --test tests/js/`: 119 pass, 0 fail.
- `uv run pytest -q`: 379 passed.
- Test server (own port 8791, temp data dir `/tmp/t013-test/data`, test secrets, `create_app(data_dir=..., env=...)`), stopped after the run. Ports 8000 and 8010 were not touched.
- Headless Google Chrome driven over DevTools at 380×760 CSS px, DPR 2, mobile emulation. The page was loaded with `localStorage["chata.myParty"]` set to each test party.
- Same page from `git show HEAD:static/index.html` on a second temp server (port 8792), same data, compared with the working tree on the no-party view: the three signposts are byte-identical (`outerHTML`).
- `grep -c crispEdges static/index.html`: 3. `grep innerHTML static/index.html`: no matches.

**Test data** (temp server): Ivan a Eva (3 adults, Thu–Sun) placed 2 / 4 / 3 on Thu / Fri / Sat. Riso (2 adults, from Fri) and Mia (1 adult, from Sat) held no places.

**Acceptance criteria**

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `nightTally`, `partyTallies`, `tallyChipText`, `tallyLabel` exist in `<script id="logic">`, are pure, reuse the existing helpers | PASS | Read the code: no DOM or `app` access, uses `isPresent`, `neededOnNight`, `partySlots`, `pluralPlaces`, `missingVerb`. Called directly by the Node tests. |
| 2 | With a party, each signpost shows the chip text and colour from the tables, in place of the dates; without a party, unchanged | PASS | Ivan: Thu `máte 2/3 !` (rect `#6E2414` edge, `#B4472F` face, `#FFFFFF` text), Fri `máte 4/3` (`#C98A1C`, `#F3E3C0`, ink), Sat `máte 3/3` (`#1F4A31`, `#3D7A55`, white). Riso: Thu `nie ste tu` (6.5, ink, y = r1+23, no chip), Fri and Sat `máte 0/2 !`. Mia: Thu and Fri `nie ste tu`, Sat `máte 0/1 !`. No party: dates shown, no chip, identical to HEAD. Screenshots checked (light, dark). |
| 3 | `aria-label` ends with `tallyLabel` with a party, unchanged without | PASS | Thu label: `Noc Št → Pi, 29./30. 10., obsadené 2 z 20 miest, zvolená noc. Máte 2 miesta, potrebujete 3, chýba 1 miesto`. Fri: `… obsadené 4 z 20 miest. Máte 4 miesta, potrebujete 3, o 1 miesto viac`. Riso Thu: `… V túto noc tu nie ste`. No party: same as HEAD. |
| 4 | No geometry, hit-area, config or status-board changes; `crispEdges` kept; no `innerHTML` | PASS | Diff only touches `drawNights`, the pure functions, `TALLY_COLORS`. Each signpost keeps one `rect.hit`, `role="button"`, `tabindex="0"`, `aria-pressed`. `crispEdges` is still in place. No `innerHTML`. |
| 5 | `proposal.md`: the sentence in the "Tri smerovníky nocí" bullet | PASS | Diff matches the task text word for word, after „obsadené X z 20“. |
| 6 | Node tests cover kinds, kids in the parents' bed, not present but holding a slot, all chip texts and label sentences (with plurals), `partyTallies`, consistency | PASS | All in `tests/js/logic.test.mjs` and passing. Seven new `test(` blocks (the Dev log says eight; the count is a minor discrepancy, not a failure). |
| 7 | `node --test tests/js/` and `uv run pytest -q` pass | PASS | 119 and 379 pass. |
| 8 | `tests/manualne.md` section 5 and section 8 items | PASS | Both items present (section 5: chips in colour, `nie ste tu`, no chips without a party, updates after assign/release and after switching party, 380 px readability; section 8: VoiceOver/TalkBack reads the tally sentence). Their real-device checks are still open, see below. |

**Live update (polling):** the page was open with Riso chosen. A `POST /api/assign` (2 places on Fri) from outside changed the Fri chip from red `máte 0/2 !` to green `máte 2/2` after the 30 s poll. `POST /api/clear` (both places) turned it back to red after the next poll. The redraw happens on every render, as specified.

**Tap to select:** tapping (dispatching the click on) the Fri signpost moved `aria-pressed` to Fri only. The chip texts did not change, and the hit area and the post are as before.

**Extra scenarios tried**
- Stay shortening with Ivan's Sat slots: `PUT /api/parties/{id}` with leave Fri → 200, and the server freed the Sat slots. So "over but not present" cannot be reached through the API (the server frees those places). It is only reachable by editing the YAML by hand, which is why the Node test is the only check of that case. This is not a bug.
- `POST /api/assign` to a night outside the event → 422 `invalid`. Slot already taken → 409 `slot_taken`. These are existing behaviour and unchanged by this task.
- Party with the kids in the parents' bed (Node test: 2 adults, 1 kid, 1 in parents' bed, 2 places → `máte 2/2`, green).
- Server-side or chip-specific concurrency, signup lock, corrupt YAML, cookies: not applicable, the task changes only the page's drawing and pure functions. Covered by the existing pytest suite (379 pass).

**Needs a human (in `tests/manualne.md`, not yet checked off):** pinch zoom and legibility of the chips on a real 380 px phone, the choice of colours on a phone in daylight, the switch of party in „Kto si?“ on two devices at once, VoiceOver on iPhone and TalkBack on Android reading the tally sentence, and dark mode on device. The headless screenshots at DPR 2 look correct, but they are not a substitute for the device check.

**Bugs:** none found.

**Observation for the organizer (not a failure):** the `over` chip face (`#F3E3C0`) is very pale on the wood (the reviewer raised the same point). It fits the spec.
