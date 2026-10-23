# T-023: Table of all parties and their places per night, under the night signposts

- **Phase:** 1 (organizer request, 23. 10. 2026)
- **Depends on:** T-013, T-014, T-020 (all in `done/`), **T-022** (build order only: T-022 is being implemented in `static/index.html` right now, and this task changes the same file plus `tests/js/logic.test.mjs`, `tests/manualne.md` and `proposal.md`. Start only after T-022 is in `done/` and committed. Nothing from T-022 is needed). Do not run in parallel with T-009 if it is ever unblocked (same files).
- **Size:** M

## Goal
Organizer, verbatim, with a screenshot of the grass under the three night signposts (left of the collapsed „?“ box): „V tejto casti by sa mi pacilo keby boli vylistovane aj ostatne partie/rodiny aj s poctami posteli na kazdu noc (riadok = rodina, stlpce pocet posteli)“.

Draw a small pixel table in the scene, on that free grass: one row per party (colour square and name), one column per night, each cell the party's places on that night. Today the per-night numbers exist only for *my* party (T-013 chips „máš 3/3“ on the signposts) and the list of parties only in the „Kto je kto“ panel (T-014) without nights. Proposal sections: "Informácie v scéne" (everything is drawn in the scene, no list view), "Mapa" (the hidden text summary replaces a separate list), "Vzhľad".

## Design decisions (analyst defaults, for the organizer to change after trying it)
These are not open decisions from `proposal.md`. They are also listed in `tasks/QUESTIONS.md` (Q14).

1. **Extends the legend, does not replace it.** The table is the at-a-glance view in the scene. The „Kto je kto“ sign at `map.scene.legend` stays. Tapping the table opens the same „Kto je kto“ panel, and each panel row gets one more line with the same per-night numbers at normal text size. So the full names and readable numbers are one tap away on a phone. Removing the „Kto je kto“ sign is a possible follow-up if the organizer finds it redundant.
2. **Cell = placed / needed places**, e.g. `2/3`, the same numbers and rule as the signpost chip (`nightTally`: `placed` = slots the party holds that night, `needed` = `adults + kids − kids_in_parents_bed` when present). Places, not heads, as everywhere. A plain "assigned count" alone would not show who still misses a place, and "needed" alone would not show progress. Cell texts:
   - present, all placed: `3/3` (plain ink text, no chip, so the table stays calm);
   - places missing: `2/3!` on a red chip (white text), the `!` so it does not depend on colour only;
   - more places than needed (also "not present but holds places"): `4/3` or `1/0` on the amber chip (ink text);
   - not present that night and holds nothing: `–` (en dash).
   The chip colours are the T-013 `TALLY_COLORS` (`under`, `over`); `ok` has no chip here.
3. **Position: a new scene rect `parties: [176, 112, 148, 82]`** under `map.scene`, i.e. x 176–324, y 112–194: below the signposts, left of the collapsed „?“ box (x 328–372, y 112–156) and above the house (rooms and windows start at y 196). Never hardcode it in code.
4. **Columns are not under the signposts.** Exact alignment is impossible: the third signpost (centre x ≈ 341) is above the „?“ box, and the names need a column of their own. Instead the table has a header row with the same night labels as the signposts (`nightInfo(night).label`: `Št → Pi`, `Pi → So`, `So → Ne`), and the header cell of the selected night gets the yellow `COLORS.selected` background like the selected signpost.
5. **Shown only while the noticeboard is collapsed.** The expanded noticeboard (`notice: [176, 112, 196, 66]`, shown on the very first visit until the first bed tap or a tap on it) covers the same grass. While it is expanded the table is not drawn; once it collapses to „?“, the table appears. The hidden screen-reader summary always contains the table data.
6. **Rows in `state.parties` order** (creation order, same as „Kto je kto“ and the palette). My party is not moved; its row has a `COLORS.selected` (yellow) background and a bold name, matching „Žltý rámik majú miesta tvojej partie“.
7. **Size:** the row height adapts to the number of parties (see `partyTableLayout`), up to 10 rows in the 82-unit rect. With 8–10 parties the text is about 5–5.5 scene units, i.e. about 5 px on a 380 px phone. That is small; the map zoom (T-010, T-019) and the „Kto je kto“ panel (decision 1) are the readable paths. With more parties than rows, the last row reads `+N ďalších` (unlikely with 20 places). No scrolling inside the SVG.
8. **The whole table is one button** that opens „Kto je kto“ (148 × 82 units, well above 44 px). Rows and cells are not separate buttons.
9. **No new server data.** Everything comes from `state.parties`, `state.sleeping` and `state.event.nights`, which the page already has. The table and the signposts both draw from `app.state` (server state, like `drawNights`), so they never disagree. An unconfirmed write shows on the map at once and in the table after the server confirms.

## Scope
- `config/chata.yaml`: under `map.scene`, after `legend`, add `parties: [176, 112, 148, 82]` with the comment `# tabuľka partií a ich miest po nociach (vidno ju, keď je návod zbalený)`.
- `app/models.py`: `SceneRects` gets a required `parties: Rect`, like the other scene rects.
- `tests/test_models.py`: add `"parties": [176, 112, 148, 82]` to `SCENE` (extends the parametrized missing-rect test).
- `static/index.html`:
  - `<script id="logic">`: the pure functions below.
  - `drawNotice`: use the new `noticeIconRect(r)` for the collapsed „?“ box instead of the inline `[r[0] + r[2] - 44, r[1], 44, 44]` (same value, no visual change).
  - `drawBoards()`: call a new `drawPartyTable(g, scene.parties, state)` only when `app.noticeCollapsed` is true. `collapseNotice` / `expandNotice` already call `renderBoards()`, so the table appears and disappears with the notice.
  - `openLegend(returnKey)`: optional argument, default `"legend"`, so focus goes back to the table when the panel was opened from it (`"parties"`). Each row gets a third line (class `legend-nights`) with `legendNightsText(row)`.
  - `renderSummary()`: after the rooms, append `<h3>Partie po nociach</h3>` and a `<ul>` with one `<li>` per line of `partyTableSummary(app.state, app.myParty)`; for no parties a single `<li>` `Zatiaľ tu nikto nie je.`
  - CSS: `.legend-nights` (muted, like `.legend-meta`; keep each `Št → Pi 2/3` part on one line with `white-space: nowrap` on its span).
- `tests/js/logic.test.mjs`: tests of the new functions; add `parties: [176, 112, 148, 82]` to the `scene` fixture.
- `tests/manualne.md`: items in sections 5, 6 and 8.
- `proposal.md`: Slovak text below.

Out of scope: the server and API, the signpost chips (T-013) and the status board, the WhatsApp text (`summaryText`), the „Kto si?“ panel, bed drawing, figures, the meadow, zoom, T-022's loading view, phase 2 elements (`locked`, `key`), new `COLORS` keys.

## Pure functions (in `<script id="logic">`, no DOM, no `app`)
```js
// The collapsed noticeboard's „?“ box: the top-right 44×44 of the notice rect.
function noticeIconRect(r)              // [r[0] + r[2] - 44, r[1], 44, 44]

// Cell text from a nightTally: "–" absent; "2/3!" under; "4/3" over; "3/3" ok.
function tableCellText(t)

// One row per party, in state.parties order; [] when there are no parties.
// [{id, name, label: ellipsize(name, 14), color, mine, cells: [{night, kind, text}]}]
// kind and the numbers come from nightTally (one cell per state.event.nights entry, in order).
function partyTableRows(state, myPartyId)

// Geometry of the table inside `rect` for `count` parties, in scene units.
// pad 3, header row 9, row height = min(10, avail / max(1, rows)) where avail = rect h − 2·pad − 9 (67 at h 82),
// at most maxRows = floor(avail / 6.5) rows (10 at h 82); text size = clamp(rowH − 1.5, 5, 7).
// With count 0 the empty-state text uses the first row position (rowH 10).
// Name column = rect w − 2·pad − nightCount·28 (58 units at w 148); 28-unit night columns, ending at x + w − pad.
// {pad, head, rowH, size, rows, more, nameX, nameW, colX: [..], colW}
//   rows = how many party rows to draw; more = parties not shown (0 when all fit).
//   When count > maxRows: rows = maxRows − 1 and the last row is the "+N" row with more = count − rows.
function partyTableLayout(rect, count, nightCount)

// "+1 ďalšia", "+2 ďalšie" (2–4), "+5 ďalších" (5+)
function moreText(n)

// The „Kto je kto“ third line: "Št → Pi 2/3 · Pi → So 3/3 · So → Ne –" (same tableCellText).
function legendNightsText(row)

// Screen-reader lines: "Ivan a Eva (ty): Št → Pi 2 z 3, Pi → So 3 z 3, So → Ne nie je tu".
function partyTableSummary(state, myPartyId)
```
`legendRows` gets a `nights` field with the same cells as `partyTableRows` (or `openLegend` calls `partyTableRows`; either way the numbers come from one function).

### Exact Slovak wording
- Header of the name column: `Partia`. Night headers: `nightInfo(night).label` (fallback: the raw night).
- Empty table (no parties): one row `Zatiaľ tu nikto nie je.` (same text as „Kto je kto“).
- Overflow row: `moreText(n)` as above.
- Table button `aria-label`: `Partie a ich miesta po nociach. Ťuknutím otvoríš „Kto je kto“.`
- `partyTableSummary`, per cell (`d = |placed − needed|`, reuse `pluralPlaces`, `missingVerb`):
  - absent: `<label> nie je tu`
  - ok: `<label> <placed> z <needed>`
  - under: `<label> <placed> z <needed>, <missingVerb(d)> <pluralPlaces(d)>` e.g. `Št → Pi 0 z 2, chýbajú 2 miesta`
  - over, present: `<label> <placed> z <needed>, o <pluralPlaces(d)> viac`
  - over, not present: `<label> nie je tu, ale má <pluralPlaces(placed)>`
  - the line is `name + (mine ? " (ty)" : "") + ": " + cells.join(", ")` with the full name, not the truncated label.
- These are 3rd-person texts about a party, allowed by the T-020 wording policy. No plural 2nd-person forms.

## Drawing (`drawPartyTable`)
- Board: `board(g, r, COLORS.paper, COLORS.woodDark)` (paper like the noticeboard, highest contrast for small text), `shape-rendering="crispEdges"` as everywhere.
- Header row: `Partia` left in the name column, the night labels centred in their columns, bold, ink, `maxWidth` = column width − 2. Selected night (`app.night`): a `COLORS.selected` rect behind its header cell. A 1-unit `COLORS.woodDark` line under the header.
- Party row: my row first gets a `COLORS.selected` background over the full inner width. Then a 5 × 5 square in exactly `party.color` (no shirt letter, too small), then `row.label` via `addText` (`textContent`), bold for my row, `maxWidth: nameW − 8` so `setText` squeezes anything still too wide. Cells centred in their columns: `ok` and absent as plain ink text; `under` / `over` on a chip (edge rect plus face inset by 1, colours from `TALLY_COLORS`) that fits inside the cell.
- Overflow row: `moreText(more)` in the name column, muted ink, no cells.
- Hit area and button: `hitRect(g, r)` and `makeButton(g, <label above>, "parties", function () { openLegend("parties"); })`. The row elements carry no roles of their own (the SVG group is one button; the data is in the hidden summary).
- Redraws on every `render()` / `renderBoards()` (poll, write response, night change, party change in „Kto si?“, notice collapse/expand) because `drawBoards` already runs there. All text through `addText` / `setText`. No `innerHTML`.

## proposal.md (Slovak)
- "Informácie v scéne", after the „Nástenka s návodom“ bullet, add:
  „- **Tabuľka partií:** keď je návod zbalený na „?“, pod smerovníkmi je papierová tabuľka so všetkými partiami: riadok je partia (farebný štvorček a meno, dlhé mená skrátené), stĺpce sú tri noci a v každej bunke je počet miest partie z potrebných, napríklad „2/3“. Keď miesta chýbajú, bunka je červená s výkričníkom, keď ich je viac, oranžová, a „–“ znamená, že partia v tú noc nie je na chate. Riadok mojej partie je žltý a stĺpec zvolenej noci má žltú hlavičku. Ťuknutím na tabuľku sa otvorí „Kto je kto“.“
- "Informácie v scéne", in the „Kto je kto“ bullet, after „počet ľudí a príchod a odchod“, add „a miesta po nociach („Št → Pi 2/3“)“.
- "Rozloženie chaty", in the `map.scene` example after the `legend` line:
  `    parties: [176, 112, 148, 82] # tabuľka partií a ich miest po nociach (vidno ju, keď je návod zbalený)`
- "Vzhľad", after the bullet about the shirt letter, add:
  „- Tabuľka partií v scéne má pevné farby scény ako ostatné tabule (papier, tmavé písmo, červený a oranžový štítok ako na smerovníkoch) a v tmavom režime sa nemení. Písmo je malé, preto ju na mobile treba priblížiť alebo ťuknúť na ňu a pozrieť si čísla v „Kto je kto“.“

## Acceptance criteria
- [x] `config/chata.yaml` and the `proposal.md` example have `parties: [176, 112, 148, 82]`; `SceneRects` requires it; a config without it fails at startup naming `map.scene.parties` (parametrized test in `tests/test_models.py`).
- [x] With the notice collapsed, the table is drawn inside the `parties` rect and touches neither the „?“ box, the signposts' hit areas, any room, bed hit area, window or door. With the notice expanded, no table is drawn and nothing else on the map changes.
- [x] One row per party in `state.parties` order with a square in exactly `party.color`, the name via `textContent` (a name with HTML markup shows as literal text), names longer than 14 characters end with `…`.
- [x] Each cell shows `placed/needed` per the rules above, `2/3!` on red for missing places, the amber chip for extra places, `–` when not present; the numbers equal the signpost chip of the same party and night.
- [x] My party's row is highlighted yellow with a bold name; the selected night's header is highlighted and moves when another signpost is tapped.
- [x] With 0 parties the table shows `Zatiaľ tu nikto nie je.`; with more parties than rows the last row is `+N ďalších` (correct form for 1 / 2–4 / 5+).
- [x] Tapping the table, or Enter/Space when it is focused, opens „Kto je kto“; closing the panel returns focus to the table. Opening from the „Kto je kto“ sign still returns focus to the sign.
- [x] „Kto je kto“ rows show the third line `Št → Pi 2/3 · Pi → So 3/3 · So → Ne –` and it updates while the panel is open (poll or write).
- [x] The table updates after a poll, a confirmed write, a party change in „Kto si?“ and a night change.
- [x] The hidden summary has the „Partie po nociach“ list with one line per party in the wording above.
- [ ] Mobile (380 px) and desktop: the table fits its rect, nothing overlaps; on a phone it is readable with map zoom. Dark mode: the table looks exactly the same as in light mode (fixed scene colours); the new `.legend-nights` line in the panel uses the panel's light/dark colours.
- [x] No `innerHTML`, no new `COLORS` keys, no new server fields, no geometry hardcoded (all from `map.scene`).
- [x] Node tests in `tests/js/logic.test.mjs` cover at least: `noticeIconRect` for the real notice rect (`[328, 112, 44, 44]`) and that it does not overlap `parties`; `tableCellText` for all four kinds including `1/0` (not present but holding a slot) and `–`; `partyTableRows` order, colour, `mine`, `label` truncation at 14 characters, one cell per night in event order, `[]` for no parties; consistency: every cell's numbers and kind equal `nightTally` for that party and night; `partyTableLayout` for 0, 1, 5, 10 and 12 parties (row height capped at 10, `rows`/`more` for overflow, every row and column inside the rect, columns do not overlap); `moreText` for 1, 2, 4, 5; `legendNightsText`; `partyTableSummary` for every cell kind including the plural forms (`chýba 1 miesto`, `chýbajú 2 miesta`, `o 1 miesto viac`, `ale má 1 miesto`) and `(ty)` only for my party; the existing bed-hit-area overlap test passes with `parties` in the `scene` fixture; the new texts pass the T-020 `formalForms` guard.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md`:
  - section 5: after the notice collapses, the table is visible under the signposts, lists every party with the right colour, numbers match the signpost chip for my party, `–` on nights outside a stay, red cell when a place is missing, my row yellow; it follows a change from another device; tapping it opens „Kto je kto“ with the per-night line;
  - section 6: on a 380 px phone (iPhone Safari, Android Chrome) the table fits next to the „?“ box, is readable after zooming the map, long names are cut with `…`; desktop and dark mode look the same as light mode;
  - section 8: VoiceOver/TalkBack reads the table button label and the „Partie po nociach“ list in the hidden summary.

## Notes for developer
- **Build order:** T-022 is in progress in the same files. Start after it is in `done/` and committed, and read the committed `drawBoards`, `render` and `renderSummary` again (line numbers will have moved).
- Reuse `nightTally`, `nightInfo`, `ellipsize`, `pluralPlaces`, `missingVerb`, `partyById`, `TALLY_COLORS`, `board`, `addText`, `hitRect`, `makeButton`, `htmlEl`, `clearNode`. Do not duplicate the placed/needed rule.
- Party colours come from the server (`party.color`); never recompute them.
- The rect is a default on free grass. If adding it to the `scene` fixture makes an existing synthetic test object overlap it (as happened in T-014), move the synthetic object and say so in the dev log; do not move real layout elements. If something collides when drawn, note it for the organizer instead of moving other elements.
- `sceneRects` (used for bed and signpost hit areas) picks up `parties` on its own. The signpost hit area already stops at y 112 because of `notice`, so it does not change.
- `parties` overlaps `notice` by design (decision 5). No test asserts that scene rects are disjoint; do not add one that would forbid this pair.
- Text below about 5 units may render blurry on some phones; keep the `clamp(…, 5, 7)` floor and rely on zoom.
- More than 12 parties repeat palette colours; the names still identify them. No special handling.

---
## Dev log
### Dev log (developer, T-023)

**What was done**
- `config/chata.yaml`: `map.scene.parties: [176, 112, 148, 82]` after `legend`, with the requested comment. `app/models.py`: `SceneRects.parties: Rect` (required). `tests/test_models.py`: `parties` added to `SCENE`, so the parametrized missing-rect test now also covers it (error names `map.scene.parties`).
- `static/index.html`, logic block: `noticeIconRect`, `tableCellText`, `partyTableRows`, `partyTableLayout`, `moreText`, `legendNightParts` (small helper so the panel can put each `Št → Pi 2/3` part in its own nowrap span) with `legendNightsText` joining it, `partyTableSummary`. All numbers come from `nightTally`.
- `static/index.html`, page: `drawPartyTable` (drawn from `drawBoards` only when `app.noticeCollapsed`), `drawNotice` uses `noticeIconRect`, `openLegend(returnKey)` (default `"legend"`; the sign now calls `openLegend("legend")`, the table `openLegend("parties")`), the panel row gets a `legend-nights` line (via `partyTableRows`, so `legendRows` and its test are unchanged), `renderSummary` appends `Partie po nociach` (one `<li>` per party, or `Zatiaľ tu nikto nie je.`), CSS `.legend-nights` (muted, 15 px, `span { white-space: nowrap }`). No `innerHTML`, no new `COLORS` keys; the overflow row uses the existing `COLORS.roomLabel` as muted ink.
- `proposal.md` (4 edits as specified) and `tests/manualne.md` (sections 5, 6, 8).
- `tests/js/logic.test.mjs`: `parties` in the `scene` fixture, a new T-023 test block (notice icon rect and no overlap with rooms, doors, windows and other scene rects except `notice`, cell texts, rows, tally consistency, layout for 0/1/5/10/11/12 parties, `moreText`, legend line, summary wording with all plural forms and `(ty)`, tykanie guard), and the new producers added to the existing text-producer guard.

**Files:** `config/chata.yaml`, `app/models.py`, `tests/test_models.py`, `static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md`, `proposal.md`.

**Tests**
- `node --test tests/js/` : 181 pass, 0 fail.
- `uv run pytest -q` : 384 passed.

**Headless Chrome check** (own server on port 8123, Chrome on 9423, temp data dir, 380x760 mobile emulation at 2x; both stopped afterwards): with the notice expanded no table and nothing else changed; after collapsing, the table sits in 176/112/148/82 right of the corner „?“, all text inside the rect. 12 parties show 9 rows plus `+3 ďalšie`; 5 parties show the red `0/3!`, amber `4/3`, plain `3/3`, `–`; names with markup (`<b>Mrco</b>`) show literally; the long name is `Novákovci s v…`; my row is yellow and bold and the selected night header is yellow and moves when another signpost is tapped. The table is one button, tap and Enter open „Kto je kto“; closing returns focus to `parties` (opened from the table) and to `legend` (opened from the sign). The panel's `legend-nights` lines match the table, and a party added from another client appears in the open panel after a poll (13 to 14 rows). The hidden summary has `Partie po nociach`. Empty state shows `Zatiaľ tu nikto nie je.`. Desktop 1200 px with dark colour scheme: the table is unchanged.

**Notes / deviations**
- I did not test on real iPhone/Android devices or with VoiceOver/TalkBack; the mobile/desktop acceptance box is therefore left open for the tester and the manual checklist. At 380 px with 8-12 parties the text is small (about 5 px) as the task predicts, but legible in the 2x screenshot.
- Cell chips for `under`/`over` are 24 x (rowH-1) units, inset in the 28-unit column; at 10 rows they are about 5.7 units high.
- `legendRows` was not extended (the task allowed either way); the panel calls `partyTableRows`.
- Left for follow-ups: nothing outside the scope was changed. `tasks/QUESTIONS.md` untouched.

(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

### Review round 1 (reviewer, T-023)

**Tests run by the reviewer:** `node --test tests/js/` gave 181 pass, 0 fail. `uv run pytest -q` gave 384 passed.

**Headless Chrome check (reviewer's own run).** Three servers on ports 8137, 8138 and 8139 with temp data dirs seeded with 5, 12 and 0 parties, Chrome DevTools on 9337, all stopped afterwards. The 5-party data covers every cell kind: `3/3`, `1/3!`, `1/0` (not present but holds a slot), `2/1`, `–`, a long name and a `<b>Mrco</b>` name. I checked 380×760 at 2x and 1280×900 at 1x, each in light and dark.
- The table group's bbox is exactly `[176, 112, 148, 82]` in every run. No text bbox and no rect falls outside the rect, and no other `data-key` element (signposts, „?“, beds, legend) intersects it. The bed hit areas cannot reach it (beds start at y 220, grow 8).
- With the notice expanded there is no `parties` element, and the rest of the keys and the scene look the same.
- 12 parties: 9 rows plus `+3 ďalšie` in muted ink, every row inside. 0 parties: `Zatiaľ tu nikto nie je.`. The long name shows as `Novákovci s v…` (squeezed via `textLength` at 5 rows), and the markup name is drawn as literal text.
- My row is yellow with a bold name. The yellow header moves from x 237 to x 293 after tapping the third signpost.
- Enter on the focused table opens „Kto je kto“, and Escape returns focus to `parties`. Opening from the sign returns focus to `legend`.
- The panel's `.legend-nights` lines match the table, and the spans are `nowrap`. Their colour is `--muted` in light (rgb 107 86 68 on 251 246 236) and in dark (rgb 185 163 140 on 45 35 27, same as `.legend-meta`).
- Desktop light and dark screenshots are byte-identical. The mobile ones differ only in the age line, so the scene keeps its fixed colours.
- The hidden summary has `Partie po nociach` with one line per party (all 12, so it is not cut at 9), worded as in the spec, with `(ty)` only on my party.

**Code check.** All numbers come from `nightTally` through `tableCellText`, with no second copy of the placed/needed rule. All text goes through `addText`/`htmlEl`, and the diff has no `innerHTML`. No new `COLORS` keys (the overflow uses the existing `roomLabel`). The geometry comes from `map.scene.parties` only, and `SceneRects.parties` is required, so the parametrized test names `map.scene.parties`. `drawNotice` uses `noticeIconRect` and draws the same box. The Node tests cover every item the criteria list, including the 1/2–4/5+ forms, tally consistency, layout bounds for 0/1/5/10/11/12 parties, and both tykanie guards. The `proposal.md` and `tests/manualne.md` edits match the requested text.

**Blockers:** none.

**Suggestions**
- `static/index.html` `openLegend` refresh: `nightsLine(tableRows[i])` relies on `legendRows` and `partyTableRows` both mapping `state.parties` in the same order. That holds today. Adding a `nights` field to `legendRows`, built from `partyTableRows`'s cells, would remove the coupling by index. This is optional, and the task allowed either way.

**Nits**
- At 10 or more parties `rowH` is 6.7, so with `crispEdges` the 1-unit gaps between stacked red chips snap unevenly (visible in the 12-party screenshot). Rounding `rowH` to a whole or half unit would even them out. This is cosmetic only.
- The three bold night headers (size 6 in 28-unit columns) nearly touch each other. They are readable at 2x.

The acceptance box for real phones and VoiceOver/TalkBack is still open, correctly, for the tester and the manual checklist. Headless 380 px and desktop, light and dark, pass.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2
(reviewer appends)

## Test report
(tester appends)

### Test report (tester, T-023)

**Result: PASS.** No bugs found. No tests added to the repo (the gap check found nothing missing). Nothing committed.

**Automated suites (run from the repo root)**
- `node --test tests/js/`: 181 tests, 181 pass, 0 fail.
- `uv run pytest -q`: 384 passed.
- `uv run pytest tests/test_models.py -q -k "scene or rect or missing"`: 14 passed (the parametrized missing-rect tests, `parties` included).
- Startup with `config/chata.yaml` minus the `parties` line (temp config dir, temp data dir): `ConfigError`, message `…/chata.yaml: invalid file` / `map.scene.parties: Field required`.

**Headless Chrome check (own servers on ports 8241, 8242, 8243 with temp data dirs; Chrome DevTools on 9441; all stopped afterwards; 8000 and 8010 never touched)**
- Seed: 4 parties (Ivan a Eva 2 adults, Novákovci s vnúčatami 2+1 kid, `<b>Mrco</b>` 1 adult FRI→SUN, Šimon 2 adults THU→FRI) with bed holdings chosen to cover `2/2`, `1/2!`, `0/2!`, `3/3`, `4/3`, `0/3!`, `–`, `1/1`, `0/1!`. Empty server (0 parties). Server with 12 parties.
- Table bbox is exactly `[176, 112, 148, 82]` in every run (380×760 @2x and 1280×900 @1x, light and dark, collapsed). No other `data-key` element intersects it: `notice` (328–372), `legend`, `who`/`status`, and bed boxes all lie outside. The night hit areas end at y 112, the table starts there.
- Texts in the table (380 px): `Št → Pi`, `Pi → So`, `So → Ne`, `Partia`, then the rows, exactly as expected. Cells: Ivan `2/2`, `1/2!`, `0/2!`; Novákovci `3/3`, `4/3`, `0/3!`; Mrco `–`, `1/1`, `0/1!`; Šimon `2/2`, `–`, `–`. The name `<b>Mrco</b>` is literal text, and the 14-char cut gives `Novákovci s v…`, `Ďurišovci z B…`.
- Colours: each square's `fill` equals the party's server colour (`#2F7D6D`, `#D07A2B`, `#6D5BA8`, `#C08A1E`). Red chips use `#6E2414` / `#B4472F` with white text, the amber chip `#C98A1C` / `#F3E3C0` with ink text, as on the signposts.
- Signpost chips for my party (`máš 2/2`, `máš 1/2 !`, `máš 0/2 !`) equal the table cells (`2/2`, `1/2!`, `0/2!`). After a write (`máš 3/2`) the table shows `3/2` too.
- My row (Ivan) yellow `#F2D58A` with a bold name. The selected night header is yellow at x 237 (Št → Pi) and moves to x 265 after tapping the Pi → So signpost. After switching my party to Šimon in „Kto si?“ the yellow row moves to Šimon and Ivan's name is no longer bold.
- Table tap (real mouse events), Enter and Space on the focused table all open „Kto je kto“ (title „Kto je kto“). Escape returns focus to `parties`. Opening from the `legend` sign and closing returns focus to `legend`.
- „Kto je kto“ rows: `Št → Pi 2/2 · Pi → So 1/2! · So → Ne 0/2!`, `Št → Pi – · Pi → So 1/1 · So → Ne 0/1!` etc., equal to the table. The line is muted (`rgb(185,163,140)` in dark, same as `.legend-meta`), 15 px, and each `span` has `white-space: nowrap`. The open panel updates after a poll (another client assigns Mrco a Friday place: the line changes `Pi → So 1/1` → `2/1` in 25 s, panel still open).
- Writes and polls: a confirmed write from the page (Zapísať nás sem) updates Ivan's cell and the chip at once. Another client's write is shown after 22 s (poll).
- Night change, party change, and the write path all re-render the table (checked above).
- Notice expanded (first visit, no `chata.noticeCollapsed`): no `parties` element drawn. The other elements were not compared one by one in this run.
- 0 parties: `Zatiaľ tu nikto nie je.` in the table and `Partie po nociach` → `Zatiaľ tu nikto nie je.` in the hidden summary.
- 12 parties: 9 rows (Ivan … Peťo) and a last row `+3 ďalšie` (Žofia, Ema, Bohdan are the missing three). Everything inside the rect. The summary lists all 12 lines.
- Dark mode (`prefers-color-scheme: dark`, desktop 1280 px and 380 px): the table's rects and texts are identical to light mode (same fills, same positions, compared in the run data).
- Desktop 1280 px: the table fits its rect with the same texts as at 380 px.
- `innerHTML`: no added line in the diff of `static/index.html` contains `innerHTML`, `outerHTML` or `insertAdjacentHTML`. The table text is all `textContent`.
- The hidden summary (`Partie po nociach`) for the 4-party seed: `Ivan a Eva (ty): Št → Pi 2 z 2, Pi → So 1 z 2, chýba 1 miesto, So → Ne 0 z 2, chýbajú 2 miesta`, `Novákovci s vnúčatami: … Pi → So 4 z 3, o 1 miesto viac, …`, `<b>Mrco</b>: Št → Pi nie je tu, …`, `Šimon: … Pi → So nie je tu, So → Ne nie je tu`.
- The Node test names and assertions match the items the task lists for the pure functions (including `1/0`, `–`, the plural forms `chýba 1 miesto`, `chýbajú 2 miesta`, `o 1 miesto viac`, `ale má 1 miesto`, `(ty)` only for my party, and the tykanie guard). The suite passed as a whole; I did not run single tests separately.

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| `parties: [176, 112, 148, 82]` in config and proposal; `SceneRects` requires it; missing rect fails at startup naming `map.scene.parties` | PASS | config and proposal lines checked; startup test with the line removed; `test_models.py` parametrized |
| Collapsed: table in rect, touches no `?`, signpost hit area, room, bed, window or door; expanded: no table | PASS | bbox and `others` list at 380 and 1280 (`?`, signposts, beds, legend, who, status); windows and doors checked by their layout coordinates (all at y ≥ 196 or x outside 176–324); expanded run has no `parties` key |
| One row per party in `state.parties` order, square in exact colour, textContent, names over 14 chars end with `…` | PASS | fills, `<b>Mrco</b>` literal, `Novákovci s v…`, `Ďurišovci z B…` |
| Cells `placed/needed`, `!` on red, amber for extra, `–` absent; numbers equal the signpost chip | PASS | Ivan's table cells vs chips (`2/2`, `1/2!`, `0/2!`, `3/2` after write); all cells in the seed |
| My row yellow with bold name; selected night header highlighted and moves | PASS | `#F2D58A` row, header x 237 → 265 after the Pi → So tap, yellow row moved to Šimon on party switch |
| 0 parties `Zatiaľ tu nikto nie je.`; overflow `+N ďalších` with the correct form | PASS (0 parties and `+3 ďalšie` in browser; 1, 2–4, 5+ forms in Node) | 0-party and 12-party runs |
| Tap or Enter/Space opens „Kto je kto“; closing returns focus to the table; sign still returns focus to the sign | PASS | interaction script (Escape → `parties`, Enter, Space; sign → `legend`) |
| „Kto je kto“ rows show the third line and update while open | PASS | line text equals the table; open panel updated after a poll (25 s) |
| Table updates after poll, confirmed write, party change, night change | PASS | poll 22 s; write at once; party switch; night header move |
| Hidden summary has `Partie po nociach` with one line per party in the wording | PASS | summary text read from DOM for the 4-party and 12-party seeds |
| 380 px and desktop: fits, nothing overlaps; dark mode identical; `.legend-nights` uses panel colours | PASS (headless). Real iPhone and Android readability and zoom stay in `tests/manualne.md` sections 5, 6, 8 for the organizer | bbox, screenshots, dark vs light identical fills, muted colour in dark panel |
| No `innerHTML`, no new `COLORS` keys, no new server fields, no hardcoded geometry | PASS | grep of added lines; diff touches only `SceneRects.parties`; geometry read from `scene.parties` |
| Node tests cover the listed items; `node --test tests/js/` and `uv run pytest -q` pass | PASS | 181 and 384 pass |
| `tests/manualne.md` items in sections 5, 6, 8 | PASS | present in the diff, each covers its item |

**Extra scenarios tried**
- Tap on the table and on the sign, keyboard on the table, Escape focus returns, Space opens.
- Table with notice expanded on a fresh visit (no `chata.noticeCollapsed`).
- Write from the page and a second client's write while the page is open.
- Party switch in „Kto si?“ while the table is shown.
- 12 parties (overflow) and 0 parties.
- Name containing HTML markup, names longer than 14 characters.
- Dark mode at 380 px and at 1280 px.

**Observations (not failures, for the organizer, no change requested)**
- At 380 px with 4 parties the bold night headers `Št → Pi`, `Pi → So`, `So → Ne` touch each other and the `Partia` header touches the yellow selected header. Readable at 2x, consistent with the reviewer's nit.
- With 10 or more parties the stacked red chips have uneven gaps (reviewer's rounding nit). Cosmetic.
- The first table tap opened „Kto je kto“ correctly; the table's `Enter`/`Space` path works in headless Chrome. Real VoiceOver and TalkBack reading still needs the manual checklist.

**Manual checks still open (not verifiable headless)**: iPhone Safari and Android Chrome readability and pinch zoom of the table at 380 px, the 10/12-party layout on a real phone, VoiceOver/TalkBack reading. These are in `tests/manualne.md` (section 5 „Party table (T-023)“, section 6 „Party table on phones (T-023)“, section 8 „Party table (T-023)“).

**Decision:** all criteria pass headless, no regressions (`tasks/done/` still green in both suites, T-022 splash loads in every probe). Moved to `tasks/done/`. Not committed.
