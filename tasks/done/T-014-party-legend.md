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
- [x] `config/chata.yaml` and the `proposal.md` example have `legend: [24, 264, 44, 44]`; `SceneRects` requires it; a config without it fails at startup naming `map.scene.legend` (covered by the parametrized test).
- [x] The legend sign is drawn in the `legend` rect, is a focusable `role="button"` with the Slovak `aria-label`, and does not overlap any bed hit area, room or other scene rect (the existing overlap test passes with `legend` in the fixture).
- [x] Tapping, Enter or Space on the sign opens the „Kto je kto“ panel; closing it returns focus to the sign.
- [x] The panel lists every party in `state.parties` order with a swatch in exactly `party.color`, the name, `(vy)` for my party, and the people and stay line; the empty state shows `Zatiaľ tu nikto nie je.`
- [ ] The list updates while the panel is open when a poll or write brings a new state (new party, rename, changed counts or stay).
- [x] `Vybrať moju partiu` opens the existing „Kto si?“ panel; the legend rows themselves are not buttons and change nothing.
- [ ] In dark mode the legend swatch has the T-012 light border, so dark party colours stay visible on the dark surface.
- [x] No `innerHTML` introduced; all party text via `textContent`.
- [x] Node tests cover at least: `peopleText` for 1 / 3 / 5 adults and 0 adults, 1 / 2 / 5 kids, kids in parents' bed 1 / 2 / 5 (`spí` / `spia` / `spí`); `stayText` for a stay inside one month and across months (`Št 29. 10. – Ne 1. 11.`), and the raw fallback for a bad date; `legendRows` order, `color`, `mine` true only for my party, and `[]` for no parties.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md`:
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
Implemented as specified.

Files touched: `config/chata.yaml` (`map.scene.legend`), `app/models.py` (`SceneRects.legend` required), `tests/test_models.py` (`SCENE`), `static/index.html` (pure `peopleText`, `stayText`, `legendRows`; `drawLegend` called from `drawBoards`; `openLegend` panel with `panel.refresh` and `returnKey: "legend"`; `.legend-*` CSS; dark-mode swatch border rule extended to `.legend-row .swatch`), `tests/js/logic.test.mjs` (`legend` in the `scene` fixture, new tests for the three functions), `tests/manualne.md` (sections 5, 6, 8), `proposal.md` (bullet and `legend` line).

Commands and results:
- `node --test tests/js/` -> 126 pass, 0 fail.
- `uv run pytest -q` -> 380 passed (the parametrized missing-rect test now also covers `legend`).
- Manual check in a browser against a throw-away server on port 8123 (temp data dir, now stopped): the sign exists with the Slovak `aria-label`, the click opens the panel with both parties in order, swatches are exactly `party.color`, people/stay lines are right (e.g. `2 dospelí, 2 deti (1 spí s rodičmi) · Št 29. 10. – Ne 1. 11.`), and closing returns focus to the sign (`data-key=legend`). I could not get a screenshot (preview snapshot timed out), so the look of the sign and dark mode are not visually checked. I checked by script that the `legend` rect overlaps no room, bed, path, door, window or other scene rect.

Deviation: the existing test "a bed hit area follows the bed rect from the config" moved the synthetic bed to `[20, 250, 24, 34]`, which now overlaps the legend rect. I moved the synthetic bed to `[20, 312, 24, 34]` and changed the expected hit area to `[12, 308, 40, 41]` (it now stops at the legend sign above and at half the gap to a bed below). The test's purpose is unchanged.

Notes: the empty state is a `<li class="legend-empty">` and the hint is a plain `<p>` (the `.sheet p` rule already makes it muted); `keepFocus` is not needed in `panel.refresh` because the rows are not focusable and the button is not rebuilt. Left unticked: the dark-mode border (CSS rule added, not seen) and live refresh while the panel is open (`panel.refresh` is wired the same way as the other panels and runs from `applyState`, but I did not watch a poll update an open list).


## Review round 1
(reviewer appends)

Reviewed the diff of `app/models.py`, `config/chata.yaml`, `proposal.md`, `static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md` and `tests/test_models.py` against the task and the proposal sections "Informácie v scéne" and "Rozloženie chaty".

Tests run by the reviewer:
- `node --test tests/js/`: 126 pass, 0 fail.
- `uv run pytest -q`: 380 passed. `test_missing_scene_rect_names_it[legend]` exists and passes, so a config without `map.scene.legend` is refused with the key in the message.

Config and model: `SceneRects.legend: Rect` is required like the other rects. `config/chata.yaml` and the proposal example both have `legend: [24, 264, 44, 44]` with the requested Slovak comment. No geometry is hardcoded: `drawLegend` reads `scene.legend`, and `sceneRects(layout)` picks the new key up for the bed hit-area obstacles on its own.

Test-fixture change is legitimate. The old synthetic bed `[20, 250, 24, 34]` now sits inside the new legend rect (y 264–308), so it no longer described a valid layout. The bed moved to `[20, 312, 24, 34]`. The expected hit area `[12, 308, 40, 41]` is right: the top stops at the legend's bottom edge (308, gap 4 < grow 8), and the bottom stops at half the 6-unit gap to the stove at y 352 (346 + 3 = 349). The test still checks what it is meant to check (the hit area follows the config rect and stops at a scene board), and it now also covers the legend as an obstacle.

Headless Chrome check (Chrome 155, CDP, 380×800 at DPR 2, own server on port 8137 with a temp data dir, 4 parties including a long name with `<b>` markup):
- Sign: `role="button"`, `tabindex="0"`, `aria-label` „Kto je kto. Ťuknutím uvidíš partie a ich farby.“, 44×44 CSS px at 380 px width. `elementFromPoint` at its centre hits `data-key=legend`. It sits on free grass left of „Izba vľavo“, next to the path, and does not touch the summer kitchen. The three squares and paper lines read as a small legend board.
- Enter on the focused sign opens „Kto je kto“. Rows are in `state.parties` order, the swatch background is exactly `party.color` (checked as rgb), `(vy)` is only on my party, and the meta lines are correct, e.g. „2 dospelí, 2 deti (1 spí s rodičmi) · Št 29. 10. – Ne 1. 11.“ and „5 dospelých, 5 detí (5 spí s rodičmi)“. `<b>` in a name shows as literal text, so `textContent` is used. Row heights are 68–114 px, which is at least 44.
- Dark mode (unticked criterion): the computed swatch border is `rgba(0,0,0,.35)` in light mode and `rgba(241, 231, 217, 0.55)` in dark mode, and the screenshot shows the light border around each swatch on the dark surface. **Met.**
- Live refresh (unticked criterion): with the panel open, I added a party and renamed my party (changing its counts and stay) through raw API calls from a different `X-Client-Id`. The list kept 4 rows until the 30 s poll, then showed 5 rows with „Eva a Juraj (vy) · 2 dospelí, 1 dieťa (1 spí s rodičmi) · Št 29. 10. – So 31. 10.“ and the new „Neskorí“. The write path uses the same `applyState` → `app.panel.refresh` call. **Met.**
- Escape closes the panel and focus returns to `data-key=legend`. „Vybrať moju partiu“ opens „Kto si?“.
- Empty state, on a second fresh server (port 8138): a single `li.legend-empty` with „Zatiaľ tu nikto nie je.“.
- Both servers and Chrome were stopped afterwards. Ports 8000 and 8010 were not touched.

Constraints: all new UI text is Slovak and informal. No `innerHTML`. The pure functions are in `<script id="logic">`, the decorative palette squares are fixed and party colours come from `party.color`, the dark-mode rule was extended rather than duplicated, and nothing is out of scope.

**Blocker**
- None.

**Suggestion**
- `static/index.html` `openLegend` / `.legend-meta`: at 380 px the stay line breaks inside a date („… · Št 29. 10. – Ne 1.“ / „11.“, and „Št 29. 10. –“ / „So 31. 10.“). Wrapping the stay part in a span with `white-space: nowrap`, or putting ` ` between day, day number and month in the rendering only, would keep each date on one line. `stayText` and its tests can stay as they are.

**Nit**
- The sign is drawn after the letter icon, so in the tab order it comes after the bottom-centre letter even though it sits further up and to the left. This is harmless and matches the spec ("call from `drawBoards`").
- In the „Vybrať moju partiu“ handler, `closePanel()` before `openWho()` is redundant because `openPanel` closes the current panel itself. It is harmless.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2
(reviewer appends)

## Test report

Tester run, 22. 10. 2026. Result: **all acceptance criteria pass, no regressions.** Task moved to `done/`.

### Commands and results
- `node --test tests/js/` → 126 pass, 0 fail (exit 0).
- `uv run pytest -q` → 380 passed in 2.5 s.
- `uv run pytest -q tests/test_models.py -k "legend or missing" -v` → 9 passed, including `test_missing_scene_rect_names_it[legend]`.
- Startup refusal without the legend rect: a copy of `config/` with the `legend:` line removed, passed to `create_app(config_dir=..., data_dir=<temp>)` → `ConfigError`, message names `map.scene.legend: Field required`, and no data directory is created.
- Browser checks (headless Chrome 155 over CDP, viewport 380×800 at DPR 2, mobile emulation). Servers ran on temp ports 8131, 8133–8137 with temp data dirs. All were stopped afterwards. Ports 8000 and 8010 (not mine) were not touched. Scripts are in `/tmp/t014/` (outside the repo).
- API seeding (temp data): three parties (Riso a Ben, Eva, Peter a Zuzka) with assignments, so figures are on the map.

### Acceptance criteria
| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `legend` in config, proposal example, required in `SceneRects`; missing key fails at startup naming `map.scene.legend` | PASS | Config has `legend: [24, 264, 44, 44]`; proposal line present; startup refusal checked above; parametrized test passes. |
| 2 | Sign drawn in the `legend` rect, `role="button"`, Slovak `aria-label`, no overlap with bed hit areas or scene rects | PASS | In browser: `role=button`, `tabindex=0`, label „Kto je kto. Ťuknutím uvidíš partie a ich farby.“, 44×44 CSS px, `elementFromPoint` at its centre hits `data-key=legend`. Overlap: Node fixture test with `legend` in the scene passes. By hand against `config/chata.yaml`, the rect x 24–68, y 264–308 touches no room, path, door, window, locked sign, kitchen (y ≥ 334) or letter/key rects. |
| 3 | Tap, Enter or Space opens the panel; closing returns focus to the sign | PASS | Real pointer tap, Enter and Space each opened „Kto je kto“. Escape closed it and `document.activeElement` was `data-key=legend`. |
| 4 | Panel lists every party in `state.parties` order, swatch = `party.color`, name, `(vy)` for my party, people and stay; empty state `Zatiaľ tu nikto nie je.` | PASS | Order Riso, Eva, Peter. Meta lines e.g. „2 dospelí, 2 deti (1 spí s rodičmi) · Št 29. 10. – Ne 1. 11.“, „1 dospelý · Pi 30. 10. – So 31. 10.“. Swatch computed colours rgb(47,125,109), rgb(208,122,43), rgb(109,91,168) equal the hex fills of the map figures (`#2F7D6D`, `#D07A2B`, `#6D5BA8`). `(vy)` only on the party I chose in „Kto si?“. Empty state on a fresh server shows exactly `Zatiaľ tu nikto nie je.` |
| 5 | List follows changes while open (poll or write) | PASS | Panel open; two writes from another client id (rename Eva → „Eva a Juraj“ with new counts and stay, add „Neskorí“). After the 30 s poll the list showed 4 rows with the new values; `(vy)` stayed on the renamed party. Verified here (the developer's box is still unticked). |
| 6 | „Vybrať moju partiu“ opens „Kto si?“; rows are not buttons and change nothing | PASS | Button opened the „Kto si?“ panel. Rows are `LI` with no role, no tabindex and no buttons. |
| 7 | Dark mode: swatch has the T-012 light border | PASS | Computed border `rgba(241, 231, 217, 0.55)` in dark mode, `rgba(0, 0, 0, 0.35)` in light mode. Screenshots of both modes checked. Verified here (the developer's box is still unticked). |
| 8 | No `innerHTML`; party text via `textContent` | PASS | Diff adds no `innerHTML`. A party named `<img src=x onerror="document.title=1"> Tóno & "Q"` renders as literal text: no `img` element, the title is unchanged, no exception. |
| 9 | Node tests cover the listed cases | PASS | Tests exist and pass: `peopleText` for 0/1/3/5 adults, 1/2/5 kids and kids in the bed 1/2/5 (spí/spia/spí); `stayText` in one month and across months, and the raw fallback; `legendRows` order, colour, `mine`, and `[]`. |
| 10 | `node --test tests/js/` and `uv run pytest -q` pass | PASS | See commands above. |
| 11 | `tests/manualne.md` sections 5, 6 and 8 have the items | PASS | Items present in sections 5 (line 61), 6 (line 88) and 8 (line 102). |

### Extra scenarios tried
- Light and dark mode, forced via emulation, on a 380 px viewport. Light screenshot is correct (cream sheet, dark ink, light borders). Dark is correct.
- Enter, Space and Escape keyboard paths, and focus return.
- Live refresh with two remote writes, then the poll.
- Empty state on a fresh data directory.
- HTML-like party name (rendered as text, no injected element).
- Startup refusal without `map.scene.legend`, with no data written.
- Night signposts with a chosen party (T-013) show their chips (for example „máte 1/1“ on the Pi → So signpost for Eva) while the legend is closed.
- Regression: all tests in the suite pass, including the tests of the tasks already in `done/`.

### Observations (not failures)
- **Stay line breaks a date at 380 px.** The stay text wraps inside a date in the panel, for example „Št 29. 10. – Ne 1.“ / „11.“ and „Pi 30. 10. –“ / „So 31. 10.“. The criteria do not require otherwise, so this does not block. The reviewer raised the same point. A `white-space: nowrap` on each date span would fix it. I added a manual check to `tests/manualne.md` section 6 (item for „Kto je kto“ on a phone) instead of failing the task. This is the only edit I made to the repo; no test code was added.
- The two boxes the developer left unticked (dark-mode border, live refresh) are now verified here, but I did not tick them in the file. They are the developer's boxes.

### Needs a real device (in `tests/manualne.md`)
- Sections 5, 6 and 8: iPhone Safari and Android Chrome (touch first-tap on the 44 px sign, scrolling the list with a thumb, real dark mode), two devices at once (list follows a change from the other device), VoiceOver and TalkBack reading the sign label and each row.
