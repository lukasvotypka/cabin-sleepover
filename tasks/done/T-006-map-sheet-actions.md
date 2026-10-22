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
- [x] New pure functions in the logic block, with Node tests:
  - [x] figure positions per bed `kind`, ported from `pos()` in `files/mapa-nahlad.html`; tests check `bed2`, `bunk`, `mats`, `sofa`, `stove` and the 1-slot kinds against the preview
  - [x] adult or kid per occupied slot (Q2)
  - [x] **slots to take** in a bed for *moja partia* on a night (Q3): the first free slots of the bed in config order. The count is the places the party still lacks that night, at least 1, and no more than the bed has free. Tests cover:
    - [x] a couple missing 2 on an empty `bed2` gets both slots
    - [x] a couple missing 2 on a `bed2` with 1 free gets 1
    - [x] a party missing 0 gets 1 (an extra place)
    - [x] a full bed gets none
    - [x] a party of 3 on `mats` with 3 free gets all 3
  - [x] the nights in which a party holds a given slot (used by move with all nights)
  - [x] the bed screen-reader label, e.g. „Manželská posteľ, izba vľavo, v sobotu Ivan a Eva, 0 voľných“
- [x] Every bed in `layout.rooms[].beds[]` is drawn from config in the scene, with its furniture per `kind` from the preview's `furn()`. No coordinates are hardcoded, so changing a bed rect in `chata.yaml` moves it.
- [x] Occupied slots show a pixel figure in the party color, from `sprite()`. Kids are the smaller figure. Hover, or a long press on touch, shows the party name, inserted with `textContent` (for example an SVG `<title>`).
- [x] Free places show a white square that blinks gently. A tight slot (`tight` in config) has an orange (`#E0A33A`) square. With `prefers-reduced-motion` nothing blinks.
- [x] Slots of *moja partia* have a yellow frame under the figure. A pending change is drawn semi-transparent („ukladám“) until the server answers.
- [x] Each bed is a `<g role="button" tabindex="0">` with the label above. Enter and Space open the sheet like a tap does.
- [x] Tapping a bed opens a bottom sheet that slides up from the bottom, using the Vzhľad panel colors. It shows:
  - [x] the bed name and room
  - [x] the occupancy of every slot for all three nights
  - [x] the actions below
  - [x] it closes with a close button and with Escape, and focus returns to the bed
- [x] **Zapísať nás sem**:
  - [x] one tap calls `api/assign` once with `{night, slots[], party_id}`, using the „slots to take“ for the selected night, so a couple fills a double bed with one tap (Q3)
  - [x] the request is all or nothing; on `slot_taken` none of the pending figures stay and the Slovak text from `errorText` is shown
  - [x] the button label says how many places it takes (e.g. „Zapísať nás sem (2 miesta)“) and is disabled when the bed has no free place
  - [x] **Na všetky naše noci** calls `api/assign-stay` once with `{slots[], party_id}`, using the „slots to take“ for the selected night (Q13), and reports the `skipped` nights in Slovak (e.g. „V piatok je to tu obsadené, tú noc sme vynechali.“)
- [x] **Uvoľniť** per occupied slot:
  - [x] for *moja partia* it clears right away
  - [x] for another party it first asks „Toto miesto má Riso a Ben. Naozaj ho uvoľniť?“ (with the real name)
- [x] **Presunúť**:
  - [x] it turns on move mode with a bar at the top of the scene, „Ťukni na nové miesto pre Ivan a Eva“, a switch for this night or all nights, and **Zrušiť**
  - [x] tapping a free place calls `api/move` with the selected night, or with all nights where the party holds the source slot
- [x] When *moja partia* is not present on the selected night, the assign actions are disabled. The sheet says why („V sobotu nie ste na chate“) and links to editing arrival and departure (the T-007 form, through a hook).
- [x] Without a chosen *moja partia*, the actions open „Kto si?“.
- [x] Optimistic flow:
  - [x] the change shows at once as pending
  - [x] on success, the returned `state` replaces the local one, and the signposts and status board update too
  - [x] on rejection, the map returns to the `state` from the error response and the Slovak text from `errorText(error, state)` is shown, e.g. „Toto miesto má v sobotu už Riso a Ben.“; the server's English `message` is never shown
  - [x] a poll arriving during a pending write does not drop the pending marker
- [x] Switching nights on a signpost redraws the figures for that night.
- [x] Still no `innerHTML`, `outerHTML` or `insertAdjacentHTML` anywhere in the file.
- [x] Languages: UI text is Slovak and informal with „ “ quotes. Code, comments and tests are in English.
- [x] Sheet and bar buttons are at least 44 px. Beds get the largest hit area that does not overlap a neighbour or a scene board (Q9). Pinch-zoom stays enabled.
- [x] The art is custom. No characters, art or names from Pokémon or other games.

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

**Round 1.** Built on the T-005 page (`static/index.html`), no T-005 work rewritten. Nothing in `app/` changed, and no backend bug blocked me.

What was added:
- **Logic block (pure, Node-tested):** `figurePositions` / `figurePosition` (ported from `pos()`), `figureKind` and `slotOccupant` (Q2), `slotsToTake` (Q3), `holdingNights`, `stayNights`, `moveTarget`, `withPending` (pending overlay), `bedLabel`, `freeText`, `assignLabel`, `notPresentText`, `skippedText`, `releaseConfirmText`, `moveBarText`, `joinList`, and the hit-area helpers `growRect`, `sceneRects`, `nightsHit`, `bedHit`.
- **App block:** beds drawn from `layout.rooms[].beds[]` (`drawBeds`, `drawFurniture` from `furn()`, `drawFigure` from `sprite()`), with a transparent hit rect first (so figures keep their hover `<title>`), a keyboard focus ring, a blue frame for the bed whose sheet is open (not yellow, yellow stays for *moja partia*), a long press on touch that shows the occupants as a small board (`watchLongPress`, `showTip`), the bed sheet (`openBedSheet`), a toast (`showToast`), the move bar, and `runWrite` for the optimistic flow.
- **Optimistic flow:** pending changes live in `app.pending` as ops `{night, slot, party_id}` and are drawn on top of the state by `withPending` (semi-transparent). They are removed just before the server answer is applied (`write(method, path, body, ops)`), so a poll that arrives during a write cannot drop them. On success the returned state replaces the local one. On rejection the error's state is applied and `errorText(error, state)` is shown in the toast. The English `message` is never read. A `slot_taken` with `params.own === true` is a silent no-op.
- **Sheet:** bed name and room, all three nights with every slot (the night heading is a button that switches the selected night), per-slot **Uvoľniť** (own: at once, other party: inline „Toto miesto má … Naozaj ho uvoľniť?“ with Uvoľniť / Nie) and **Presunúť** (own slots), then **Zapísať nás sem (N miesta)** and **Na všetky naše noci**. Both are disabled with a note when the bed is full or my party is not present that night („V sobotu nie ste na chate.“ plus a button to edit arrival and departure, through `hooks.editParty`, which shows a „coming soon“ toast until T-007). Without a chosen party the buttons close the sheet and open „Kto si?“. Each action closes the sheet and the result shows as pending on the map, with a toast for `skipped` nights or errors.
- **Move:** a sticky HTML bar above the scene („Ťukni na nové miesto pre …“, **Táto noc** / **Všetky noci**, **Zrušiť**). Escape also cancels. Tapping a bed moves to its first slot that is free in every night of the move (`moveTarget`). „All nights“ uses the nights where the party holds the source slot (`holdingNights`). Pre-checks with their own toasts: not holding the source slot on the selected night, and no free place in the bed.
- **T-005 review suggestions:**
  1. Signpost hit areas: `nightsHit` caps the growth at `NIGHTS_HIT_GROW` = 8 units up and down and never grows into a scene board, a room or a bed (tests for a far neighbour and a near room). `expandHit` was replaced by `growRect`. Bed hit areas use the same function: at most 8 units, half of the gap to a neighbouring bed, the whole gap to a board, plus a rule so diagonal neighbours cannot touch at a corner. A test checks that no two bed hit areas and no bed and scene board overlap in the real layout.
  2. „Kto si?“ keeps focus on the same party row after a state refresh rebuilds the list (`keepFocus`, rows have `data-key`). Checked live. `keepFocus` is also used for the scene and the sheet.
  3. ETag after a write: write responses carry no `ETag` header, so the page cannot know the new one. `write()` now sets `app.etag` to the header if present, otherwise `null`, and runs one poll after a successful write. That poll fetches the new ETag, and the following poll returns 304. Checked live: POST 200, GET 200 (no If-None-Match), GET 304. If the backend later adds `ETag` to write responses, the extra poll becomes unnecessary (small follow-up in `app/main.py`, `ok_response`).

Decisions and deviations:
- **Kids and extra places (Q2):** the first `adults` held slots are adults, the next `kids - kids_in_parents_bed` are kids, any extra place beyond that is an adult figure (Q2 literally says „the rest are kids“, but an extra place is not a kid).
- **Move is per slot:** the API moves one slot, so „Presunúť“ is on each slot of my party in the sheet. A couple moves with two moves.
- **Toast:** hidden when any panel opens, otherwise it sat on top of the sheet buttons (found in the browser check).
- **Presunúť when a night is switched during move:** with „Táto noc“ and a night where the party does not hold the source slot, a toast explains instead of calling the API.
- „Chodbička“ does not fit the 54-unit corridor at 11 units and is squeezed with `textLength` (looks condensed on the map). I did not shorten it in code. Shortening `name` in `chata.yaml` fixes it, or the organizer can accept it.
- The „Letná kuchynka“ label touches the stove pipe (it does in the approved preview as well).
- Below the SVG the page shows the plain `--bg` color, as noted in T-005.

Tests:
- `node --test tests/js/` gives 70 pass, 0 fail (was 40, one T-005 `expandHit` test replaced by `growRect`/`nightsHit` tests). The new tests cover: figure positions per kind against the preview, one-slot kinds, clamping, kid/adult (Q2), `slotsToTake` (the five required cases plus partial), `holdingNights`, `stayNights`, `moveTarget`, `withPending` (and that it does not mutate the state), the bed label (the AC example), plural texts, skipped-night texts, hit areas (caps, shared and fixed obstacles, diagonals, real layout, a moved bed), no hardcoded geometry or names in the page code, and the reduced-motion rule.
- `uv run pytest -q` gives 379 passed.
- Browser check (headless Chrome over CDP at 380 px, mobile emulation, scripts in `/tmp/t006`, outside the repo): local uvicorn with `create_app(data_dir="/tmp/t006/data", env={test secrets})` on 127.0.0.1:8031, seeded with 3 parties through the API. The real `data/` and `.env` were not used. I verified:
  - 12 beds with labels, 20 free squares and 2 orange tight ones, hit areas (tap targets are smaller than 44 px on small beds, as accepted in Q9).
  - A couple takes both slots of a double bed in one tap, drawn pending (semi-transparent) and then confirmed. The yellow frame shows on my party's figures. The status board and signposts update from the returned state.
  - A full bed disables the assign buttons with the note. Own „Uvoľniť“ clears at once. Another party's slot asks the confirm text with the real name.
  - A stale page assigning a slot that was taken meanwhile: `slot_taken`, the map shows the other party, toast „Toto miesto má vo štvrtok už Riso a Ben.“
  - „Na všetky naše noci“ with Friday taken: Thursday and Saturday written, toast „V piatok je to tu obsadené, tú noc sme vynechali.“
  - Move for this night and for all nights, Escape and Zrušiť cancel, a stale move target is rejected and rolled back. Network failure rolls back with the generic Slovak text.
  - Not present on a night: both actions disabled, text „Vo štvrtok nie ste na chate.“, the edit button closes the sheet (T-007 hook). With no party chosen the assign button opens „Kto si?“.
  - Enter and Space on a bed open the sheet, Escape and the close button return focus to the bed, a keyboard Enter on „Zapísať nás sem“ returns focus to the bed after the write.
  - A poll during a pending write keeps the pending marker. A signpost switch redraws the figures. Reduced motion turns blinking off (`animation-name: none`). Dark mode sheet looks right.
  - A touch long press shows the occupants and does not open the sheet. A short touch tap opens it.
  - No console errors (the only logged errors are the expected 409s, the first-load 401 before joining, and `favicon.ico` 404).
- Not checked: Safari, a real phone, long-press feel on a real device.

Follow-ups outside this task: the hidden screen-reader text summary and the WhatsApp text (T-007), locked-signup view-only and admin (T-009), an `ETag` header on write responses (optional, `app/main.py`).

## Review round 1
(reviewer appends)

Reviewer, 22. 10. 2026. I read the T-006 diff of `static/index.html` and `tests/js/logic.test.mjs` against the task, `proposal.md` („Architektúra“, „HTTP API“, „Mapa“, „Ťuknutie na posteľ“, „Vzhľad“), `tasks/QUESTIONS.md` (Q2, Q3, Q9, Q13), the preview's `pos()`, `furn()`, `sprite()` and blink CSS, and the server rules in `app/validate.py` and `app/main.py` (`slot_taken.own`, `skipped`, `not_holding`, no ETag on writes).

Runs: `node --test tests/js/` gives **70 pass, 0 fail**. `uv run pytest -q` gives **379 passed**. `grep innerHTML|outerHTML|insertAdjacentHTML|.message` on the page finds nothing.

What I checked and found correct:
- `figurePositions` and `drawFurniture` and `drawFigure` match `pos()`, `furn()` and `sprite()` exactly (same offsets and colors). Blink keyframes and the reduced-motion rule match the preview, and the global reduced-motion rule from T-005 still applies. Tight squares use `#E0A33A`. The selected bed uses blue `#3AA7E0`, so yellow stays for *moja partia*.
- `slotsToTake` implements Q3 (first free slots in config order, `max(1, missing)`, capped by free). Tests cover all five required cases plus a partial case. `holdingNights`, `stayNights`, `moveTarget`, `withPending` (and that it does not mutate) and `bedLabel` (the AC example verbatim) are tested.
- Human text: party names, room and bed names go in through `htmlEl`/`svgEl` text, `setText` and the SVG `<title>`. No HTML sinks.
- Errors: every rejection goes through `errorText(e, app.state)`. `slot_taken` with `params.own === true` is a silent no-op, as the T-001 note asks. Network failures and non-JSON replies roll back (`settle()` plus `render()`) and show the generic text.
- Optimistic flow: pending ops are kept apart from `app.state` and drawn by `withPending`, so a poll that lands during a write keeps them, and `writeEpoch` stops an older poll from overwriting a write's state. Ops are dropped right before the server's state (success or error) is applied, so rollback is exact. The sheet and `slotsToTake` use the same view state, so a second action sees the pending one.
- Assign: one `api/assign` call with `{night, slots[], party_id}`. „Na všetky naše noci“ is one `api/assign-stay` call with `{slots[], party_id}`, and `skipped` from the success body is reported with `skippedText`. The all-skipped case comes back as `slot_taken` and is shown by `errorText`.
- Move: `{party_id, from_slot, to_slot, nights}` with the selected night or `holdingNights`, with a page pre-check that matches the server's `not_holding` rule. Escape and „Zrušiť“ cancel.
- Not present: both assign buttons are disabled, with `notPresentText` and the `hooks.editParty` link. With no party chosen, the assign buttons open „Kto si?“.
- Accessibility: beds are `<g role="button" tabindex="0">` with a Slovak `aria-label`. Enter and Space work, focus returns to the bed by `data-key` after close and after redraws, the panel focus trap is kept, the toast is `role="status"`. Sheet, night-head and bar buttons are 44 px min (`.btn`, `.night-head`, `.close`). Pinch-zoom is untouched.
- Hit areas: `growRect` never lets two bed hit areas overlap or cover a scene board (tested on the real layout, including diagonals). On the real layout the signpost hit area (y 54–112) and the bed hit areas (all at y ≥ 36 inside rooms) do not meet.
- Scope: only `static/index.html` and `tests/js/logic.test.mjs` changed, and no room, bed or slot names or geometry are in the code (tested).

Developer decisions:
- **Per-slot „Presunúť“:** accepted. `/api/move` moves one slot, and a per-slot button is the clearest mapping. A couple needs two moves, and `moveTarget` puts the second one into the next free slot of the same bed. Worth listing for the organizer as a possible later „move the whole party“ action.
- **Extra held slot drawn as an adult (Q2):** accepted. Q2 literally says „the rest are kids“, but for a party with `kids = 0` holding an extra place that would draw a child that does not exist. The developer's rule matches the intent. Add it to the open-decisions list at the end so the organizer sees the reading.
- **Write responses without ETag:** accepted. `app.etag = null` plus one poll after a successful write is correct (the follow-up poll gets a 200 with the new ETag, the one after gets 304). It costs one GET per write. Adding `ETag` to `ok_response` in `app/main.py` is a clean small backend follow-up, outside this task's scope.

**Blockers:** none.

**Suggestions:**
1. `static/index.html:1486` and `:1491`: the two move pre-check toasts („Tú noc nespíte na pôvodnom mieste…“, „Tu nie je voľné miesto.“) are Slovak error strings written inline in the app block. The task note says not to write Slovak error strings outside the `errorText` table. They are page-only cases with no server code, so this is not a spec break, but move them into the logic block (as text helpers like `notPresentText`, or as page-local codes in `ERROR_TEXTS`) so they sit with the other texts and get a Node test. The same applies to the repeated „neznáma partia“ (four places), which could be one constant or helper.
2. `watchLongPress` (line 1279): any `pointermove` cancels the long press. On a real phone a resting finger usually emits small `pointermove` events, so the long press may rarely fire on iOS or Android. Cancel only when the pointer moved more than about 10 px from the `pointerdown` point. Add „long press on a bed shows the names“ to the T-008 manual checklist, since it was only checked in emulation.
3. Escape while a panel is open in move mode (for example „Kto si?“ opened from the status board): the panel's capture-phase handler closes the panel and sets `app.panel = null`, then the bubble-phase document handler at line 1729 sees `app.move && !app.panel` and also cancels the move. One Escape should do one thing. Call `e.stopPropagation()` in the panel's Escape branch, or check `e.defaultPrevented` in the move handler. Related: changing *moja partia* during move mode keeps `app.move.partyId` of the old party while `renderMoveBar` shows the new party's name. Cancel the move when `setMyParty` changes the party, or show `partyById(state, app.move.partyId)` in the bar.
4. Bed hit areas are capped at 8 units (`BED_HIT_GROW`). Q9 asks for the largest hit area that does not overlap a neighbour. A fixed cap is a sensible reading, since nobody wants a bed to react to a tap two rooms away, but the smallest beds stay narrow (both lehátka about 32 units wide, while lehátko 2 has about 38 free units to its right before the wall). Consider letting a bed grow up to its room's inner rect instead of a flat 8, with the same neighbour and board rules. That is config-driven too.
5. A 401 on a write shows the code screen and also the toast „Kód nesedí, skús ho zadať znova.“ (from `bad_code`), although the person typed nothing. `runWrite` could skip the toast when the code screen opened. A 401 during move mode also leaves the move bar visible above the code screen (`showCodeScreen` does not reset `app.move`).

**Nits:**
- `tests/js/logic.test.mjs:504`: the `bedLabel` mats case passes `rooms[0]` („Konica, podkrovie“) for a bed in „Konica, dole“, so the expected string documents a wrong room. Pass `rooms[1]`.
- `app.suppressClick` is global and cleared only on the next `pointerdown`. If a long press is not followed by a click (iOS can drop it), the next keyboard Enter on a bed is swallowed once. Clear it after a short timeout, or ignore it for keyboard activation.
- The move bar is a sticky element in normal flow, so showing it pushes the scene down just after the sheet closes. An overlay (fixed) bar would avoid the jump. Optional, check it on a phone.
- `drawFurniture` for `mats` uses fixed 32/46 unit mat widths from the preview, so a wider or narrower mats rect in `chata.yaml` does not scale the mats. It matches the preview, so this is fine for now.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2
(reviewer appends)

## Test report

Tester, 22. 10. 2026. Result: **PASS**, no failures, no regressions. No application code and no tests were changed or added by me (`tests/manualne.md` extended with a T-006 section).

### Commands and results
- `node --test tests/js/` : 70 pass, 0 fail.
- `uv run pytest -q` : 379 passed (T-001..T-005 regression, nothing in `app/` changed).
- `grep innerHTML|outerHTML|insertAdjacentHTML` on `static/index.html`: no matches.
- Browser: headless Chrome 151 (Playwright headless shell) over CDP, mobile emulation 380 x 800, DPR 2. Two isolated browser contexts (own cookies and localStorage) for the race. Local uvicorn on 127.0.0.1:8041 via `create_app(data_dir="/tmp/tst6/data", env={test secrets})`, seeded with 3 parties through the API. The real `data/` and `.env` and the user's running uvicorn were not touched. Scripts live in `/tmp/tst6` (outside the repo). The browser and my server were restarted once after a host restart, and the keyboard run was repeated after fixing my harness (Enter on a button needs `text: "\r"` in CDP).

### Acceptance criteria
| # | Criterion | Result |
| --- | --- | --- |
| 1 | Pure functions and Node tests (positions per kind, adult or kid, `slotsToTake` incl. the 5 cases, holding nights, bed label) | PASS (70 tests, the five `slotsToTake` cases and the AC label example present) |
| 2 | All 12 beds drawn from config, furniture per kind, nothing hardcoded | PASS (12 `g.bed`, a Node test forbids hardcoded names and geometry) |
| 3 | Figures in party color, kids smaller, name on hover or long press via `textContent` | PASS (SVG `<title>` has the name, XSS name `<img onerror>` stayed text, no injection; long press with touch shows a „Riso a Ben“ board and does not open the sheet) |
| 4 | Free places blink, tight orange `#E0A33A`, reduced motion stops blinking | PASS (20 free squares animated, 0 animated with `prefers-reduced-motion`; tight squares orange; the outlined square matches the preview) |
| 5 | Yellow frame for moja partia, pending semi-transparent | PASS (frames present after assign, pending `opacity` 0.5, gone after the answer) |
| 6 | Beds are `<g role="button" tabindex="0">`, Enter and Space open the sheet | PASS |
| 7 | Bottom sheet: name and room, all slots for 3 nights, actions, close button and Escape, focus returns to bed | PASS (also Tab stays inside the sheet, dark mode colors OK) |
| 8 | Zapísať nás sem: one `api/assign` with `{night, slots[], party_id}`, couple takes 2, label with count, disabled when full | PASS (exactly 1 POST with 2 slots, label „(2 miesta)“ / „(1 miesto)“, disabled on a full bed with a note) |
| 9 | All or nothing, rollback on `slot_taken` with Slovak text | PASS (see race below) |
| 10 | Na všetky naše noci: one `api/assign-stay`, `skipped` reported in Slovak | PASS („V piatok je to tu obsadené, tú noc sme vynechali.“, Thu and Sat written) |
| 11 | Uvoľniť: own at once, other party asks with the real name | PASS („Toto miesto má Riso a Ben. Naozaj ho uvoľniť?“, Nie keeps it, Uvoľniť clears it) |
| 12 | Presunúť: bar „Ťukni na nové miesto pre Ivan a Eva“, this or all nights, Zrušiť, `api/move` | PASS (this night sent `nights:[Thu]`, all nights sent all three; Zrušiť and Escape cancel; a bed with no common free place gives a toast without a call) |
| 13 | Not present: assign disabled, Slovak reason, edit link | PASS („Vo štvrtok nie ste na chate.“, both buttons disabled, edit button present; enabled again on Friday) |
| 14 | No party chosen: actions open „Kto si?“ | PASS |
| 15 | Optimistic flow: pending at once, success replaces state and updates signposts and board, rejection rolls back with `errorText`, poll during pending keeps the marker | PASS (a visibilitychange poll during a 1.5 s write left both pending groups; stale move rolled back with the Slovak text; network failure rolled back with „Niečo sa nepodarilo, skús to znova.“) |
| 16 | Signpost switch redraws figures | PASS |
| 17 | No `innerHTML` and similar | PASS |
| 18 | Slovak UI, English code | PASS (spot check; no English `message` shown anywhere) |
| 19 | Buttons >= 44 px, bed hit areas largest without overlap, pinch-zoom on | PASS (sheet and bar buttons >= 44 px, viewport has no `user-scalable=no`; bed hit areas range 32x52 to 140x42 CSS px, the small cots are below 44 px wide as accepted in Q9) |
| 20 | Custom art, no Pokémon or other games | PASS (reused the approved preview art) |

### Extra scenarios
- **Race:** two contexts (Ivan a Eva, Riso a Ben), both tapped „Zapísať nás sem“ on the same one-slot bed at the same moment (one delayed 700 ms). Exactly one slot holder in the data. The loser got „Toto miesto má vo štvrtok už Riso a Ben.“, pending was cleared, the bed shows one figure (the winner), console only has the expected 409.
- Clearing another party's slot: confirm text, Nie, then Uvoľniť wrote the clear.
- Keyboard: Enter, Space, Escape, close button, Tab trap, Enter on „Zapísať nás sem“ writes and focus returns to the bed.
- Move onto a bed that was taken meanwhile (server `slot_taken`): bar closed, map rolled back, Slovak toast.
- Party name `<img src=x onerror=...>`: shown as text in sheet, `<title>` and aria-label, no element created, no script run.
- Dark mode sheet and board look right (screenshots checked).
- Not exercised in the browser: a real `rate_limited` toast (needs 30 writes from the page's own client id; the code maps to a Slovak text in `ERROR_TEXTS`).

### Observations (not failures, already noted by the reviewer)
- „Chodbička“ is squeezed with `textLength`, „Letná kuchynka“ touches the stove pipe (same as the preview).
- Reviewer suggestions 1 to 5 (inline Slovak move pre-check texts, long-press `pointermove` cancel, double Escape in move mode, hit-area cap, 401 toast) remain open as optional follow-ups.

Manual items added to `tests/manualne.md` under „T-006“.
