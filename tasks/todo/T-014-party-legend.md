# T-014: „Kto je kto“: legend of parties and their colours

- **Phase:** 1 (organizer request, 22. 10. 2026)
- **Depends on:** T-012, T-013, T-015 (T-013 and T-015 only for build order: they change the same files, see Notes)
- **Size:** S

## Goal
On the map every party is a figure in its own colour ("Mapa": „Obsadené miesto: postavička vo farbe partie“), but nothing on the page says which colour is which party. The only way to find out is a long press on a figure. Add a legend: a small sign in the scene opens a panel „Kto je kto“ that lists every party with a colour swatch matching its figures, how many people it is, and when it arrives and leaves. It is a panel over the map, like „Prehľad na poslanie“, not a new page ("Stránka: jedna scéna a interakcie", "Informácie v scéne").

Organizer's words: „A ešte chýba zoznam rodín a farieb (legenda)“.

## Scope
- `config/chata.yaml`: new scene rect `legend: [24, 264, 44, 44]` under `map.scene`, with the comment `# ikona „Kto je kto“, legenda farieb partií`.
- `app/models.py`: `SceneRects` gets a required `legend: Rect`, the same as the other scene rects (so a missing key stops the server at startup with `map.scene.legend` in the message, like the others).
- `tests/test_models.py`: add `legend` to `SCENE` (this also extends the parametrized missing-rect test).
- `static/index.html`:
  - `<script id="logic">`: new pure functions `peopleText(party)`, `stayText(party)` and `legendRows(state, myPartyId)` (see below).
  - `drawBoards()`: call a new `drawLegend(g, scene.legend)`, drawn like `drawLetter` (pixel sign, `hitRect` over the whole rect, `makeButton`).
  - New `openLegend()` panel, built with `openPanel(...)` and `{ returnKey: "legend" }`, with a `panel.refresh` so a poll updates the list while it is open.
  - CSS: a `.legend-list` / `.legend-row` style next to `.party-row`; the swatch reuses the `.party-row .swatch` look, and the dark-mode swatch border rule from T-012 (`rgba(241, 231, 217, .55)`) must also cover the legend swatch.
- `tests/js/logic.test.mjs`: tests of the new pure functions; add `legend` to the `scene` fixture so the existing "bed hit areas never overlap a scene board" test also covers it.
- `tests/manualne.md`: check items (sections 5, 6 and 8).
- `proposal.md`: one bullet in "Informácie v scéne" and the `legend` line in the `map.scene` example in "Rozloženie chaty" (Slovak, see below).

Out of scope: the server API and state (the legend uses `state.parties` as it is), the „Kto si?“ panel and *moja partia* logic, the night signposts (T-013), the status board, figures and bed drawing, zoom, the hidden summary (`hiddenSummary` / `renderSummary`), any per-night counts (T-013 shows those), new `COLORS` keys, phase 2 elements (`locked`, `key`).

## Pure functions (in `<script id="logic">`, no DOM, no `app`)
```js
// "2 dospelí, 1 dieťa" / "2 dospelí, 2 deti (1 spí s rodičmi)" / "1 dospelý"
function peopleText(party)

// "Št 29. 10. – Ne 1. 11." from party.arrive and party.leave (DAY_SHORT, parseIso)
function stayText(party)

// One row per party, in state.parties order (creation order, which is also the palette order):
// [{id, name, color, people: peopleText(p), stay: stayText(p), mine: p.id === myPartyId}]; [] when there are no parties.
function legendRows(state, myPartyId)
```

### Exact Slovak wording
- Adults (always shown): 1 → `1 dospelý`; 2–4 → `N dospelí`; 0 and 5+ → `N dospelých`.
- Kids (only when `kids > 0`), after `", "`: 1 → `1 dieťa`; 2–4 → `N deti`; 5+ → `N detí`.
- Kids in the parents' bed (only when `kids_in_parents_bed > 0`), after a space: `(N spí s rodičmi)` for 1 and 5+, `(N spia s rodičmi)` for 2–4. This explains why such a party has fewer figures than people.
- Stay: `DAY_SHORT[arrive] + " " + d + ". " + m + ". – " + DAY_SHORT[leave] + " " + d + ". " + m + "."`, e.g. `Št 29. 10. – Ne 1. 11.`, `Pi 30. 10. – So 31. 10.`. If a date does not parse, fall back to the raw string (like `dayOptionText`).

## Scene sign (`drawLegend`)
- Position and hit area: the whole `map.scene.legend` rect (44 × 44 units, on the free grass left of the house, below the reserved `locked` rect and above the summer kitchen). Never hardcode the position; read it from the config like `drawLetter` does.
- Look: a small wooden board (`board(...)` with `COLORS.plank` or `COLORS.wood`, like the other signs) with three rows, each a 6 × 6 colour square and a short paper-coloured line next to it, so it reads as "colour = name". The three squares use fixed decorative colours, the first three of the party palette (`#2F7D6D`, `#D07A2B`, `#6D5BA8`), not live party data. `shape-rendering="crispEdges"` stays, no geometry changes elsewhere.
- `makeButton(g, "Kto je kto. Ťuknutím uvidíš partie a ich farby.", "legend", openLegend)`. The key `"legend"` lets focus return to the sign when the panel closes.

## Panel („Kto je kto“)
- Title: `Kto je kto`. Intro line: `Farba postavičky na mape patrí partii.`
- A list (`<ul class="legend-list">`). Each item is a plain `<li class="legend-row">`, not a button (the legend is read-only):
  - swatch `<span class="swatch" aria-hidden="true">` with `style.background = row.color` (the same colour `drawFigure` uses, `party.color`);
  - the party name, bold, via `textContent`; for my party append a separate muted span `(vy)`;
  - a second muted line: `people + " · " + stay`, e.g. `2 dospelí, 1 dieťa · Št 29. 10. – Ne 1. 11.`.
  - Row min-height 44 px, so the list is easy to scan and tap-scroll on a phone.
- Empty state: `Zatiaľ tu nikto nie je.` (one muted `<li>`).
- Under the list, a muted hint: `Menšia postavička je dieťa. Žltý rámik majú miesta tvojej partie.`
- One button `Vybrať moju partiu` (class `btn secondary`) that closes this panel and calls the existing `openWho()`. This is the only link to party selection; the legend itself does not select or change anything, so it does not duplicate „Kto si?“.
- All party text (name, counts) goes in through `textContent` (`htmlEl(..., text)`); no `innerHTML`.
- Screen readers: the swatch is `aria-hidden`; each row reads as name, `(vy)`, people and stay, which is the full information without the colour. The sign has the `aria-label` above.

## proposal.md
- In "Informácie v scéne", after the „Prehľad na poslanie“ bullet, add:
  „- **Kto je kto:** malá tabuľka s farebnými štvorčekmi v scéne otvorí panel so zoznamom partií: farba postavičky, meno, počet ľudí a príchod a odchod. Je len na pozeranie, partiu si vyberáš v „Kto si?“.“
- In the `map.scene` example in "Rozloženie chaty", after the `key` line, add:
  `    legend: [24, 264, 44, 44]   # ikona „Kto je kto“, legenda farieb partií`

## Acceptance criteria
- [ ] `config/chata.yaml` and the `proposal.md` example have `legend: [24, 264, 44, 44]`; `SceneRects` requires it; a config without it fails at startup naming `map.scene.legend` (covered by the parametrized test).
- [ ] The legend sign is drawn in the `legend` rect, is a focusable `role="button"` with the Slovak `aria-label`, and does not overlap any bed hit area, room or other scene rect (the existing overlap test passes with `legend` in the fixture).
- [ ] Tapping, Enter or Space on the sign opens the „Kto je kto“ panel; closing it returns focus to the sign.
- [ ] The panel lists every party in `state.parties` order with a swatch in exactly `party.color`, the name, `(vy)` for my party, and the people and stay line; the empty state shows `Zatiaľ tu nikto nie je.`
- [ ] The list updates while the panel is open when a poll or write brings a new state (new party, rename, changed counts or stay).
- [ ] `Vybrať moju partiu` opens the existing „Kto si?“ panel; the legend rows themselves are not buttons and change nothing.
- [ ] In dark mode the legend swatch has the T-012 light border, so dark party colours stay visible on the dark surface.
- [ ] No `innerHTML` introduced; all party text via `textContent`.
- [ ] Node tests cover at least: `peopleText` for 1 / 3 / 5 adults and 0 adults, 1 / 2 / 5 kids, kids in parents' bed 1 / 2 / 5 (`spí` / `spia` / `spí`); `stayText` for a stay inside one month and across months (`Št 29. 10. – Ne 1. 11.`), and the raw fallback for a bad date; `legendRows` order, `color`, `mine` true only for my party, and `[]` for no parties.
- [ ] `node --test tests/js/` and `uv run pytest -q` pass.
- [ ] `tests/manualne.md`:
  - section 5: the „Kto je kto“ sign is visible, opens the list, the swatch colours match the figures on the map, my party is marked `(vy)`, the list follows changes from another device;
  - section 6: on a 380 px phone the sign is at least 44 px and easy to hit, the list is readable in light and dark mode;
  - section 8: VoiceOver/TalkBack reads the sign label and each row (name, people, stay) without relying on the colour.

## Notes for developer
- **Order with T-013:** T-013 (per-night tally chips on the signposts) changes `drawNights` in `static/index.html` and also edits `tests/js/logic.test.mjs`, `tests/manualne.md` and `proposal.md`. There is no functional overlap (T-013 shows numbers per night on the signposts, T-014 a list of parties in a panel), but the files are the same, so do not run them in parallel. Start T-014 after T-013 is in `done/` and committed. If T-013 is dropped or stuck, the orchestrator may remove it from `Depends on`; T-014 does not need anything from it.
- **Order with T-015:** T-015 (minimum time for the loading leaf) also changes `static/index.html` (boot, `ensureScene`, `render`, `applyState`), `tests/js/logic.test.mjs`, `tests/manualne.md` and `proposal.md`. The organizer wants it first, so start T-014 only after T-015 is in `done/` and committed. No functional overlap; T-014 needs nothing from it. If `applyState` / `render` changed shape in T-015, call `panel.refresh` the same way the other panels do after T-015.
- Party colours come from the server (`party.color`); never recompute them from the palette in the page. The palette squares on the sign are decoration only.
- Reuse `parseIso`, `DAY_SHORT`, `htmlEl`, `clearNode`, `openPanel`, `keepFocus` and the `.party-row .swatch` look. Do not touch `openWho` beyond calling it.
- The `legend` position is a default chosen by the product owner on free grass. If it collides with anything when drawn (it should not: the area x 10–84, y 250–330 is grass), note it in the dev log for the organizer instead of moving other elements.
- More than 12 parties would repeat colours (palette wraps); the legend still lists them by name, which is the primary identifier. No special handling.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
