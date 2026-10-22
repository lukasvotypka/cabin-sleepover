# T-006: Beds and figures on the map, bottom sheet, assign / clear / move with optimistic UI

- **Phase:** 1
- **Depends on:** T-004, T-005
- **Size:** L

## Goal
Put the beds into the T-005 scene. That means the furniture by `kind`, party figures, blinking free places and the yellow frame for *moja partia*. Add the bottom sheet with the slot actions (Zapísať nás sem, Na všetky naše noci, Uvoľniť, Presunúť), shown optimistically and rolled back to the server state on rejection. Proposal sections: „Mapa“, „Ťuknutie na posteľ“, „Architektúra“ (Optimistické UI), „HTTP API“ (Odpoveď), „Vzhľad“, „Rozloženie chaty“.

## Scope
- `static/index.html`
- `tests/js/logic.test.mjs` (extend it)

## Acceptance criteria
- [ ] New pure functions in the logic block, with Node tests:
  - [ ] figure positions per bed `kind`, ported from `pos()` in `files/mapa-nahlad.html`; tests check `bed2`, `bunk`, `mats`, `sofa`, `stove` and the 1-slot kinds against the preview
  - [ ] adult or kid per occupied slot (Q2)
  - [ ] **slots to take** in a bed for *moja partia* on a night (Q3): the first free slots of the bed in config order. The count is the places the party still lacks that night, at least 1, and no more than the bed has free. Tests cover:
    - [ ] a couple missing 2 on an empty `bed2` gets both slots
    - [ ] a couple missing 2 on a `bed2` with 1 free gets 1
    - [ ] a party missing 0 gets 1 (an extra place)
    - [ ] a full bed gets none
    - [ ] a party of 3 on `mats` with 3 free gets all 3
  - [ ] the nights in which a party holds a given slot (used by move with all nights)
  - [ ] the bed screen-reader label, e.g. „Manželská posteľ, izba vľavo, v sobotu Ivan a Eva, 0 voľných“
- [ ] Every bed in `layout.rooms[].beds[]` is drawn from config in the scene, with its furniture per `kind` from the preview's `furn()`. No coordinates are hardcoded, so changing a bed rect in `chata.yaml` moves it.
- [ ] Occupied slots show a pixel figure in the party color, from `sprite()`. Kids are the smaller figure. Hover, or a long press on touch, shows the party name, inserted with `textContent` (for example an SVG `<title>`).
- [ ] Free places show a white square that blinks gently. A tight slot (`tight` in config) has an orange (`#E0A33A`) square. With `prefers-reduced-motion` nothing blinks.
- [ ] Slots of *moja partia* have a yellow frame under the figure. A pending change is drawn semi-transparent („ukladám“) until the server answers.
- [ ] Each bed is a `<g role="button" tabindex="0">` with the label above. Enter and Space open the sheet like a tap does.
- [ ] Tapping a bed opens a bottom sheet that slides up from the bottom, using the Vzhľad panel colors. It shows:
  - [ ] the bed name and room
  - [ ] the occupancy of every slot for all three nights
  - [ ] the actions below
  - [ ] it closes with a close button and with Escape, and focus returns to the bed
- [ ] **Zapísať nás sem**:
  - [ ] one tap calls `api/assign` once with `{night, slots[], party_id}`, using the „slots to take“ for the selected night, so a couple fills a double bed with one tap (Q3)
  - [ ] the request is all or nothing; on `slot_taken` none of the pending figures stay and the Slovak text from `errorText` is shown
  - [ ] the button label says how many places it takes (e.g. „Zapísať nás sem (2 miesta)“) and is disabled when the bed has no free place
  - [ ] **Na všetky naše noci** calls `api/assign-stay` once with `{slots[], party_id}`, using the „slots to take“ for the selected night (Q13), and reports the `skipped` nights in Slovak (e.g. „V piatok je to tu obsadené, tú noc sme vynechali.“)
- [ ] **Uvoľniť** per occupied slot:
  - [ ] for *moja partia* it clears right away
  - [ ] for another party it first asks „Toto miesto má Riso a Ben. Naozaj ho uvoľniť?“ (with the real name)
- [ ] **Presunúť**:
  - [ ] it turns on move mode with a bar at the top of the scene, „Ťukni na nové miesto pre Ivan a Eva“, a switch for this night or all nights, and **Zrušiť**
  - [ ] tapping a free place calls `api/move` with the selected night, or with all nights where the party holds the source slot
- [ ] When *moja partia* is not present on the selected night, the assign actions are disabled. The sheet says why („V sobotu nie ste na chate“) and links to editing arrival and departure (the T-007 form, through a hook).
- [ ] Without a chosen *moja partia*, the actions open „Kto si?“.
- [ ] Optimistic flow:
  - [ ] the change shows at once as pending
  - [ ] on success, the returned `state` replaces the local one, and the signposts and status board update too
  - [ ] on rejection, the map returns to the `state` from the error response and the Slovak text from `errorText(error, state)` is shown, e.g. „Toto miesto má v sobotu už Riso a Ben.“; the server's English `message` is never shown
  - [ ] a poll arriving during a pending write does not drop the pending marker
- [ ] Switching nights on a signpost redraws the figures for that night.
- [ ] Still no `innerHTML`, `outerHTML` or `insertAdjacentHTML` anywhere in the file.
- [ ] Languages: UI text is Slovak and informal with „ “ quotes. Code, comments and tests are in English.
- [ ] Sheet and bar buttons are at least 44 px. Beds get the largest hit area that does not overlap a neighbour or a scene board (Q9). Pinch-zoom stays enabled.
- [ ] The art is custom. No characters, art or names from Pokémon or other games.

## Notes for developer
- Rewrite the preview's string-built `innerHTML` rendering as DOM building. Keep its look: colors, the blink keyframes and the reduced-motion rule.
- The preview uses the yellow `#FFD54A` frame for the selected bed, but the proposal reserves yellow for *moja partia*. Do not use the same yellow for both.
- Room and bed names come from `name` in `chata.yaml` and stay Slovak (Q10). „Chodbička“ may overflow the corridor. Report it if it does, and do not hardcode a shorter label.
- After a tap that leaves the party with more places than it needs, the T-005 status board shows the amber note. Nothing extra is needed here, because the status comes from the returned `state`.
- If a new error case needs a text, add it to the `errorText` table from T-005. Do not write Slovak error strings anywhere else.
- Server rules are authoritative. Any pre-check on the page is only for speed and must reuse the logic block.
- Open decision „Môže sa kamarát zapísať na noc, keď nie je na chate?“: default no. The action is disabled and the page explains why.
- Open decision „Skutočné rozloženie postelí, dverí a okien“: default is the preview layout. It comes only from config.
- From T-001 testing: re-tapping a slot the party already holds returns `slot_taken` with `params.own = true`. The page must treat that as a no-op (or offer „Uvoľniť“), never show it as an error.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
