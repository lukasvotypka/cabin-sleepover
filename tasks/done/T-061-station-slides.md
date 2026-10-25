# T-061: Station slides and the desktop layout

- **Phase:** 1
- **Depends on:** T-060
- **Size:** M

## Goal
The content of the five station slides (pixel picture on top, text below) and the desktop side-by-side layout. See proposal "Pred cestou" › "Stránka", bullets „Obsah zastávok“, „Zbaliť si ako zoznam úloh“ and „Desktop (od 900 px)“. Pictures and texts follow the prototype slides in `design/info/index.html`.

## Scope
- New `static/js/app-slides.js` (`openStation(step)` and the five slide builders)
- `static/index.html` (CSS, `<script>` tag with `?v=__ASSET_VERSION__`)

## Acceptance criteria
- [x] A slide covers the whole yard on mobile; „‹ Dvor“ top left and a bottom button return to the yard.
- [x] `pack` (auto): the packing to-do from `packItems()`; tap toggles packed (green, ✓, `aria-pressed`) via `togglePacked(localStorage, …)`; progress line from `packProgressText`.
- [x] `water` (studňa): red warning „Voda z kohútika nie je na pitie.“ only when `drinkable` is `false`; calculator prefilled with `waterDefaults`, − / + within the T-059 bounds, result in litres and bottles; text „Podľa tvojej partie „…““.
- [x] `food` (ohnisko): `menu` by day with meals, `bring`, and the „na jedlo“ counts per event day from the existing `foodCount` (T-039).
- [x] `program` (smerovník): `program` items with icon, title, `when`, `note`.
- [x] `sleep` (chata): `sleep` items; when `needsMat`, the note „Tvoje miesto: <matPlaces> … pribaľ karimatku“.
- [x] Desktop ≥ 900 px: yard left, slide right; with nothing open the right side shows a welcome with the station list, each entry tappable (`role="button"`) and opening that station.
- [x] All text from `info.yaml` and party names via `textContent`; no `innerHTML` (grep check). Reduced motion: no wipe animation.
- [x] `node --test tests/js/` and `uv run pytest` pass; manual check on a 380 px and a 1200 px wide window noted in the Dev log (done via a scripted browser tab, see log; walking animation and visual look not judged by eye).

## Notes for developer
- Recording the step on the server is T-063; this task only opens and closes slides.
- The packed set is shared with the quick list (T-062) through the T-059 functions and the same `localStorage` key; re-read it when a view opens.

---
## Dev log (developer, 25. 10. 2026)
- New `static/js/app-slides.js`: `openStation(step, slide)` (picture on top, text below), five builders (pack, water, food, program, sleep), pictures ported from the prototype, desktop welcome `slWelcome` with tappable `role="button"` station list (marks visited), `slidesReset()`. The placeholder `openStation` in `app-adventure.js` was removed.
- `logic-info.js`: added `bottlesText(n, bottleLiters)` (Slovak plural); test appended to `tests/js/logic.test.mjs`.
- `app-adventure.js`: `.adv-side` welcome element, `advOnState()` (T-060 suggestion: `advRefresh()` when new state arrives; also redraws the open food/sleep slide). Called from `applyState` in `app-core.js` (guarded by `typeof`). `closeAdventure` calls `slidesReset()`.
- `static/index.html`: slide/welcome/desktop CSS (`@media (min-width: 900px)`: yard 440 px left, slide and welcome right, "‹ Dvor" hidden, next button right), wipe animation (reduced motion covered by the global rule), script tag with `?v=__ASSET_VERSION__`.
- Desktop board placement decision: the board stays in the yard column (left, 420 px wide), so it stays visible with the hint while a slide is open on desktop; on mobile it is still covered by the slide (T-060 decision).
- Commands: `node --test tests/js/` 311 pass; `uv run pytest -q` 570 pass; `grep innerHTML` on both files: none.
- Manual check with a scripted browser tab against a temp server (port 8123, stopped): at 380 px all five slides build, the water warning shows, calculator 2 l / 2 fľaše, pack toggle saves to localStorage and updates progress, welcome hidden; at 1200 px the welcome is `flex` at left 444 px, hidden once a slide opens, "‹ Dvor" hidden, board 420 px. Walking animation was not judged (background tab throttles rAF). No party was selected, so party-based defaults and the mat note were not checked in the browser.

## Review round 1
Reviewer, 25. 10. 2026. Scope: `static/js/app-slides.js`, the T-061 parts of `static/index.html`, `app-adventure.js`, `app-core.js`, `logic-info.js` (`bottlesText`) and its Node test. T-064 changes ignored.

Tests run by me: `node --test tests/js/` 311 pass, `uv run pytest -q` 570 pass. `grep innerHTML` on `app-slides.js` / `app-adventure.js`: none. Every `static/js/*.js` is listed in `index.html` with `?v=__ASSET_VERSION__`.

All criteria are met. The five slides match the prototype in `design/info/index.html` (pictures, kicks, titles, texts, pack grid with `aria-pressed`, red water warning only when `drinkable === false`, calculator using `waterDefaults`/`waterBounds`/`waterResult`, food counts from `foodRow` → `foodCount`, mat note from `matPlaces`). The desktop CSS mirrors the prototype's 900 px block (yard 440 px, slide at left 444 px, back hidden, picture 36 %, 5-column grid, next button 340 px). People and config text all go through `textContent`. The global reduced-motion rule turns off the wipe, pop, leaf, drip and zz animations, and `both` fill leaves the content visible.

**Blockers:** none.

**Suggestions**
- `app-adventure.js` `advOnState()`: each committed write by anyone (SSE `state`) rebuilds an open food/sleep slide. That replays every `adv-b` pop-in (a visible flicker while people are signing up) and drops focus from the `h2` inside the `aria-modal` dialog to `body`. Fix: redraw only when the data the slide shows actually changed (the `foodRow` numbers, or the `matPlaces` list), or skip the pop class on a redraw and put focus back on the heading.
- Desktop: while a slide is open the bottom button says „‹ Späť na dvor“ even though the yard is already on screen. On wide screens the prototype's next button goes on to the next station (`if (adv.sheet && !isWide()) closeSheet(); else … goTo(nextIndex())`). Consider matching that.
- Desktop: the slide keeps `aria-modal="true"` while the yard beside it stays usable. Consider dropping `aria-modal` at ≥ 900 px.
- Add `app-slides.js` to the file list of the Node test „the adventure files avoid innerHTML and are listed in index.html“, so the grep check stays automated.

**Nit**
- `slFood`: `info.bring + "."` gives „..“ if the organizer ends `bring` with a period. The prototype's second sentence „Nákup na spoločné jedlá rozpočítame.“ was dropped (fine if intended).

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester, 25. 10. 2026. Scope: T-061 only (T-064 ignored). Result: **PASS**, no criterion failed.

**Commands run**
- `uv run pytest -q` → 570 passed (full suite, before my test edit; backend untouched).
- `node --test tests/js/` → 311 pass, 0 fail (run before and after my test edit).
- `grep -c innerHTML static/js/app-slides.js static/js/app-adventure.js` → 0 and 0.
- Temporary server on 127.0.0.1:8123 with a temp `data/` (GROUP_CODE/ADMIN_CODE/SECRET_KEY test values), stopped afterwards. Port 8010 was not touched. `/static/js/app-slides.js` → 200, `/data/cabin-data.yaml` → 404.
- Headless Google Chrome driven over CDP (scripts in `/tmp/t61-scripts/`, not in the repo): 380×700 mobile and 1200×800 desktop, party with 2 adults + 1 kid, one mat bed assigned on 29. 10.

**Acceptance criteria**

| Criterion | Result | Evidence |
| --- | --- | --- |
| Slide covers whole yard on mobile; „‹ Dvor“ top left and bottom button back | PASS | Slide rect 380×632 = world rect; `.adv-back` present and first in slide; bottom button in `advRefresh`/`advGoTo` code. Back-click not clicked in browser (only the desktop next-station click was run). |
| `pack`: packing list, tap toggles green ✓ + `aria-pressed`, `togglePacked`, progress line | PASS | 0 z 14 → 1 z 14, `aria-pressed` true, class `got`, localStorage `info-packed` = ["Spacák"], second tap reverts. |
| `water`: red warning only when `drinkable` false; calculator prefilled, − / + within bounds, litres + bottles, „Podľa tvojej partie „…““ | PASS | Warning shown (config `drinkable: false`); prefilled 3 people × 3 days × 2 l = 18 l / 12 fliaš (from the party); Dni + → 4 days = 24 l / 16 fliaš; 20× Ľudia − clamps at 1 person = 8 l / 6 fliaš; label „Podľa tvojej partie „Test <b>x</b> Ivan“. Môžeš zmeniť.“ (name as text). Code: warning only inside `if (info.water.drinkable === false)`. |
| `food`: menu by day, `bring`, „na jedlo“ counts per event day from `foodCount` | PASS | Menu rows „Št 29. 10. večer: …“ rendered; counts from `foodRow(app.state)` (4 event days Thu–Sun, the same as the calculator's day max). |
| `program`: items with icon, title, when, note | PASS | „Túra na vyhliadku · Pi doobeda · pevné topánky“ etc. rendered. |
| `sleep`: items; when needsMat, „Tvoje miesto: <matPlaces> … pribaľ karimatku“ | PASS (nit) | With the mat bed: chip „Tvoje miesto“ + „Konica, dole · Matrace na zemi. Od zeme ťahá, pribaľ karimatku.“. The chip has no colon after it; wording otherwise matches. Without a mat: no tip. |
| Desktop ≥ 900 px: yard left, slide right; welcome with station list, tappable `role="button"` opens station | PASS | At 1200 px: `.adv-side` display flex at left 444; five `role=button` tabindex 0 entries; click on „Ohnisko“ walked (9 s) and opened the food slide on the right, side hidden, `.adv-back` display none. |
| All text via `textContent`, grep check, reduced motion no wipe | PASS | grep: no innerHTML. Party name `<b>x</b>` shown literally. Reduced motion: global `animation: none !important` rule at the end of the stylesheet covers `.adv-slide` wipe (CSS read). |
| `node --test` and `uv run pytest` pass; 380 px and 1200 px checks noted | PASS | See commands above. Dev log's 380/1200 checks reproduced in headless Chrome; visual look not judged. |

**Extra scenarios tried**
- Mobile and desktop: no console errors or uncaught exceptions while building all five slides, toggling pack, changing the calculator, and opening the desktop welcome/station.
- Name with HTML markup shown as text in water and mat notes.
- Calculator bounds: 20 clicks on − stops at the minimum, no negative or zero values.
- Party without a mat: no „Tvoje miesto“ tip, no mat note.
- Two-device-style update: `applyState(state)` while the food slide is open (see defect below).

**Non-blocking defect (not a listed criterion, same as reviewer suggestion of 25. 10. 2026, not applied)**
- Steps: 380 px page with a party chosen. Open the „Pred cestou“ food (or Chata) slide. Focus the slide's `h2` (it does get focus on open). Any state update arrives (another person's write over SSE, or a poll; `applyState` calls `advOnState`).
- Expected: the open slide keeps its content and focus, and the pop-in animation does not replay.
- Actual: `openStation` rebuilds the slide, so the `h2` is replaced; `document.activeElement` becomes `BODY` inside an `aria-modal="true"` dialog, and all `.adv-b` items replay their pop-in (observed 5 items with the class again). This happens on every committed write while the slide is open, and on each poll (30 s fallback) too if `applyState` runs for it.
- Suggested fix (developer): redraw only when the shown data changed (`foodRow` numbers or `matPlaces` list), or keep focus on the heading and skip the pop class on redraw.
- Decision: the criteria all pass, so the task moves to `done/`; the organizer or product owner should decide whether this goes into a fix task before the event.

**Test edit (tester)**
- `tests/js/logic.test.mjs`: added `app-slides.js` to the list in „the adventure files avoid innerHTML and are listed in index.html“ (the reviewer's suggestion, so the grep check stays automated). Node tests 311 pass.
- `tests/manual.md`: added two checklist items for T-061 (station slides and desktop layout on phones and desktop; the open slide redraw issue).

**Not verifiable here (manual, see `tests/manual.md`)**
- Look and feel of the pictures in light and dark mode, the walk, the wipe animation, VoiceOver/TalkBack reading of the slides, iPhone Safari and Android Chrome layout at 380 px.
