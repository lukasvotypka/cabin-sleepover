# T-145: Fixed top HUD with night stamps and time slider, icons in the bottom HUD

- **Phase:** 1
- **Depends on:** T-144
- **Size:** M
- **UX:** yes

## Goal
The organizer asked (27. 10. 2026) to keep only the night date stamps and the time slider fixed at the top of the screen as a HUD, and to take the boards off the top of the map. This task does the HUD part: the night signposts and the time slider leave the svg scene and become a fixed HTML bar at the top; the icons (Návod „?“, Info/„Kto je kto“, Prehľad letter, Pred cestou, admin key) move into the bottom HUD next to „Si: …“. The party table and the title stay in the scene for now (T-146 moves them into the village).

## Scope
- `static/index.html` (top HUD markup + CSS, icon buttons in the bottom HUD), `static/js/app-daynight.js` (slider in HTML), `app-draw.js`/`app-scene.js` (stop drawing signposts, slider and icons in svg), `app-hud.js`, `app-zoom.js` (the scene is fitted between the top and bottom HUD), `logic-iso.js` (`isoScene` board block without signposts/slider/icons), `config/cabin.yaml` `map.scene` (drop or keep unused keys, docs), tests, `tests/manual.md`, CLAUDE.md.

## Acceptance criteria
- [x] A fixed top bar (does not pan or zoom with the map) shows three night stamps (`Št → Pi`, dates, occupancy `11/20`, my party chip `4/4` / amber / red / „nie si“) and the time slider under them, segments aligned to the stamps. Safe-area aware, fixed scene colours, never darkened by the night tint.
- [x] A stamp tap selects the night and runs the time-lapse exactly as the signpost tap did; dragging the knob sets the time; keyboard and screen reader work (stamps are buttons with labels, slider is a slider with Slovak value text); 44 px targets.
- [x] Návod, Kto je kto, Prehľad, Pred cestou (and the key for admin, the locked sign state) are buttons in the bottom HUD, all working as before; they no longer appear in the svg.
- [x] The map, rest view, intro zoom, „Celá mapa“, turn buttons and zoom are fitted between the two HUDs; svg and 3D still line up at all four angles; move mode hides what it hid before.
- [x] The no-WebGL fallback still works.
- [x] Node tests and pytest updated and green; screenshots phone 390×844 and desktop.

## Notes for developer
- Prototype: `design/hud-boards/index.html` (open `?phone`), notes in `design/hud-boards/README.md`. Match its top bar (≈92 px, perforated stamp edges, rail below) and its bottom bar layout.
- The organizer accepted all recommended defaults of the prototype.
- Keep Slovak texts as they are today for existing labels.

## Design
From the ux-designer prototype (accepted 27. 10. 2026):
- **Top HUD (fixed, ~92 px + safe area):** three perforated date stamps side by side (`Št → Pi`, `29. – 30. 10.`, occupancy `11/20` and my chip: green `4/4`, amber `3/4`, red when too many, „nie si“ when absent); the selected night's stamp is highlighted (yellow). Under them the time rail with three segments lined up under the stamps and the sun/moon knob; while dragging it shows the time (`18:00`). Only the world darkens at night, never the HUD. On windows under 620 px tall the date line hides.
- **Bottom HUD:** „Si: …“ card on the left, then icon buttons Návod, Info, Prehľad, Pred cestou (key for admin) with small captions, as in the prototype.
- Desktop: same bars, centred content with sensible max width.

---
## Dev log

### Developer
- Top bar: `#tophud` in `#hud` (`static/index.html`): stamps (`app-tophud.js`, new) and the rail (`#rail`, `app-daynight.js`: `dnBuildRail`, `dnRailEvents`; segment colours from new pure `railColor`/`railGradient` in `logic-daynight.js`; hour mapping reuses `sliderSegments` with a pixel rect and gap 6). Bottom bar `#bar`: „Si: …“ card plus tool buttons (`hudTools`/`drawTools` in `app-hud.js`; key for admin, red „Zatvorené“ sign while locked, count and „!“ on Pred cestou).
- Removed from the svg: signposts, slider, icons (`drawNights`, `drawNotice`, `drawLetter`, `drawLegend`, `drawLocked`, `drawKey`, `drawBriefing`). `isoScene` has no icon grid (block = title + parties). `map.scene` now holds only `title`, `parties`, `meadow` (`parties` moved up to y 36); `SceneRects` in `app/models.py`, `tests/js/cabin-layout.json` and `tests/test_models.py` updated.
- Fit: `readInsets` uses `topHudBottom()`; `--top-h` places the quest log below the top bar; `--hud-h` (bar height) lifts „Celá mapa“, turn buttons, toast. The move bar hides the whole top bar (stamps too, not only the rail). `CREST_CHIPS_MAX` 6 to 4 (narrower „Si“ card).
- Left in place (pure, still tested): `signpostLayout`, `nightsHit`.
- Tests: `node --test tests/js/` 448 pass; `uv run pytest -q` 733 pass. Screenshots (Chrome via Playwright, phone 390x844 and desktop 1280x800): `/tmp/cabin-t145-dev/{phone,phone-drag,phone-night1,desktop,desktop-drag,desktop-night1}.png`. Drag showed the time and switched the night; stamp tap ran the time-lapse; the Info button opened its panel.
- Not verified: the four turn angles and the no-WebGL fallback by eye (code paths untouched except the smaller block), so those two criteria are left unticked. Docs: CLAUDE.md, `tests/manual.md`.

## Review round 1

Tests run by the reviewer: `node --test tests/js/` 448 pass, `uv run pytest -q` 733 pass. All scripts in `static/js/` are listed in `index.html` with `?v=__ASSET_VERSION__` (new `app-tophud.js` included). No `innerHTML`; the stamps, captions and „Si: …“ use `textContent` via `htmlEl`. No references remain to the removed svg drawers, `app.iso.icons` or the dropped `map.scene` keys. Panel focus return falls back to `#hud` (`app-panels.js:17`, `app-adventure.js:472`), so Návod/Info/Prehľad/Admin/Pred cestou get focus back on close.

**Blockers:** none.

**Suggestions**
- `CLAUDE.md` lines 105, 107, 109 still describe the old design: „night signposts … locked-signup sign drawn inside the SVG scene“, „the „?“ icon in the scene“, „board block (title, slider, signposts, party table, icon grid)“, „time slider drawn in the scene … (`map.scene.time`)“. The new T-145 line contradicts them. Update them in place so later tasks are not misled.
- `app/models.py` `SceneRects` with `extra="forbid"`: a `cabin.yaml` that still has the old keys (`nights`, `time`, `notice`, …), for example an organizer-edited copy on a server, now refuses to start. The error message is precise and the repo config is updated, but tolerating the obsolete keys, or noting it in the deploy notes, would make the upgrade safer.
- `.hud .tool` has `min-width: 38px` (`index.html`). With the admin key and the „Zatvorené“ sign (6 tools) at 380 px, the tools shrink below 44 px, and the bar overflows by a few px (96 + 6·38 + gaps > 354). This affects only the admin. `tests/manual.md` claims „all 44 px wide“. Consider letting the crest shrink further or wrapping the captions instead.
- `logic-model.js` `nightsHit` reads `layout.map.scene.nights`, which no longer exists, and `signpostLayout` now serves only `sliderSegments`. Their tests in `logic.test.mjs` (~1120–1170, 1616–1668) check an inline fixture of the old geometry. This is dead code, and its removal could go into T-146.
- Phone screenshot (`/tmp/cabin-t145-dev/phone.png`): the folded „Úlohy“ log overlaps the title board. The cause is the existing phone rest view (`phoneRestView` fits the content width and ignores the top inset). T-146 moves the title, so it may go away. If not, look at it there.

**Nit**
- `index.html:380-381` `#scene svg .dn-slider …` CSS is now dead.

The four angles and the no-WebGL fallback were not checked by eye. The code paths change only by the smaller board block, so the tester should confirm both (still unticked).

Verdict: APPROVED (round 2 skipped, no blockers)

## Test report

Tester run on 27. 10. 2026 against the uncommitted worktree (not committed). Own server on `127.0.0.1:8155` with a temp `data/` (`/tmp/cabin-t145-test/data`), test secrets only, three parties and assignments created through the API. Port 8155 stopped after the run. Browser: Google Chrome headless through `playwright-core` (scripts in `/tmp/cabin-t145-test/scripts/`). Screenshots: `/tmp/cabin-t145-test/shots/`.

### Commands and results
- `node --test tests/js/`: 448 pass, 0 fail.
- `uv run pytest -q`: 733 passed.
- Browser scenarios (phone 390×844 and 380×760, desktop 1280×800, group and admin cookies, `cabin.myParty` set): see the criteria below. Console: only the expected 401 before the first join, and three.js „Error creating WebGL context“ in the no-WebGL run (logged, not an uncaught error).

### Acceptance criteria
| # | Criterion | Result |
| --- | --- | --- |
| 1 | Fixed top bar, 3 stamps with occupancy and my chip, slider under them, safe area, not darkened at night | PASS (safe area on a notch phone: manual, see `tests/manual.md`) |
| 2 | Stamp tap = time-lapse, knob drag, keyboard and labels, 44 px targets | FAIL (minor, see BUG-2) |
| 3 | Návod, Kto je kto, Prehľad, Pred cestou, admin key and „Zatvorené“ in the bottom bar, not in svg | PASS |
| 4 | Map fitted between both HUDs; rest, intro, „Celá mapa“, turn buttons, zoom; svg and 3D line up at 4 angles; move mode | FAIL (minor, see BUG-1); angles, alignment and taps PASS (below) |
| 5 | No-WebGL fallback works | PASS |
| 6 | Node and pytest green, screenshots | PASS |

Details:
- **Stamps and rail (1, 2):** top bar fixed at 0,0 (390×108 phone, 1280×108 desktop) and unchanged while the map was zoomed in (`shots/open-45.png`). Stamps 115×56. Night 23:00 (`shots/phone-night.png`): the world is dark, the HUD is not. Stamp tap on 30. 10. ran the time-lapse: night 29. → 30. 10. after about 9 s. Keyboard: ArrowRight 12:00 → 15:00 with `aria-valuetext` „štvrtok 15:00, noc Št → Pi“. Mouse drag of the knob moved to „sobota 14:30, noc So → Ne“ and switched the night. A stamp focused in code and sent Enter starts the time-lapse (night still the old one after 0.8 s, as with a tap).
- **Bottom bar (3):** unlocked admin: Návod, Info, Prehľad, Pred cestou, Admin (44×48 each). Návod, Kto je kto and Prehľad open their panels. Pred cestou opens the yard (`shots/briefing-phone.png`). Locked: „Zatvorené“ sign (red). The svg contains no signposts, legend or notice buttons.
- **Four angles and taps (4):** 45 → 135 → 225 → 315 by the real turn button (`app.viewAngle` 135, 225, 315 each time). Screenshots `shots/phone-135.png`, `shots/phone-315.png`, `shots/phone-225-hits.png`, `shots/desktop-225.png`, `shots/open-135.png`, `shots/open-315.png`. Svg sprites and „volné“ signs sit on the 3D beds and roofs (checked by eye, not pixel-measured). A closed house tapped after each turn opened (its beds became live). A tap on a visible bed opened its sheet with the bed name at every angle: Matrace na zemi (135, 225), Jednomiestna posteľ (225, 315), Manželská posteľ (45, 135, 315). Move mode (`startMove`): top bar hidden, move bar on top, houses open, scene below the bar (`shots/phone-move.png`). Desktop fit is fine.
- **No WebGL (5):** `getContext('webgl*')` forced to null. No uncaught errors. 3 stamps, the bottom bar, flat plan with 344 shapes and 14 bed buttons. Turning to 315 turns the flat plan (`shots/nowebgl-315.png`). A bed tap opens its sheet.
- **Locked admin at 380 px (extra, non-blocking):** with the admin role, the locked bar has 6 tools, each 38 px wide (below 44 px), left edge 116 to 336, right edge 374. No element goes past the bar edge; `briefing` caption text is wider than its box (`scrollWidth` > `clientWidth`) but readable. `shots/admin-380-locked.png`. The reviewer's overflow note is therefore only the 38 px width.

### Extra scenarios
Signup lock toggled through `/api/admin/signup` (open again after the test). Locked and unlocked admin bars at 380 px. Stamp Enter. Keyboard on the slider. Drag. Move mode. Pred cestou. Turn at each angle with houses open and closed. Pytest and Node suites as above.

### Bug reports
**BUG-1 (fit, minor).** Steps: open the page on a 390×844 phone (or 380×760), wait for the splash and the intro zoom to end, do not touch. Expected: the title board „Chata 29. 10. – 1. 11.“ sits fully below the top HUD and the folded „ÚLOHY“ tab. Actual: the „ÚLOHY“ tab covers the right end of the title (at 380 px only „Chata 29. 10“ is readable; `shots/admin-380.png`, `shots/phone-rest.png`). Desktop 1280×800 is clean. Likely cause: `phoneRestView` (`static/js/app-zoom.js`) ignores the top inset that `readInsets` computes, as the reviewer noted. T-146 may move the title, but the rest view is in this task's scope.

**BUG-2 (touch target, minor, to confirm).** Steps: at 390 px, measure `#tophud [role="slider"]`. Actual: 358×32 px. The rail is the knob's hit area. Expected: at least 44 px tall touch area (CLAUDE.md „Touch targets are at least 44 px“). The knob hit area was not measured separately, so the developer should confirm or extend the hit area to 44 px.

### Verdict
FAIL on criteria 2 and 4 (minor). Task moved back to `in-progress` with BUG-1 and BUG-2. Criteria 3, 5 and 6 pass, and the four-angle and no-WebGL checks that the developer left open pass.

Manual: appended the no-WebGL and safe-area device item to `tests/manual.md` (end of file).

## Dev log (fix round, BUG-1 and BUG-2)
- BUG-1: `phoneRestView`/`restView` (`static/js/logic-view.js`) take an optional `insets` ({top, bottom}) and centre the content in the band between them; `app-zoom.js` passes `readInsets()` (top HUD, quest tab, bottom bar). At 390×844 the title now sits fully below the „ÚLOHY“ tab (`/tmp/cabin-t145-dev/phone-fix.png`, also 380×760 in `phone-380.png`). The map's lower edge is a bit tighter (trees clip at the bottom, rooms and beds stay visible).
- BUG-2: `.rail-wrap` (`static/index.html`) is now 44 px tall (confirmed 358×44 and 348×44 in Chrome), pulled back with negative margins (−6/−4) so the bar height and the look are unchanged; rail and knob moved down by 8 px inside it. The wrap overlaps the lowest 6 px of the stamps' row.
- Test added: `phoneRestView: with a top inset ...` in `tests/js/logic.test.mjs`.
- Commands: `node --test tests/js/` 449 pass; `uv run pytest -q` 733 pass.

## Review re-check
- BUG-1 fixed: `phoneRestView`/`restView` (`static/js/logic-view.js:45-66`) take `insets` and centre the content in the band between the top and bottom insets; `app-zoom.js:37,48` pass `readInsets()`, which already takes the max of safe-area, quest tab and top HUD bottoms (move bar when shown). New Node test checks the content top lands below a 190 px top inset. Screenshot at 380 px shows the title fully below „ÚLOHY“.
- BUG-2 fixed: `.rail-wrap` is 44 px tall (`static/index.html:318`), knob and rail are `pointer-events: none` inside it, so the whole 44 px band is the hit area. It overlaps the lowest 6 px of the stamps (later in DOM, positioned, so it wins the tap there), leaving the stamps 44 px of tappable height (min-height 50). In the `max-height: 620px` case the stamps were already 38 px by design; not a new regression.
- Tests: `node --test tests/js/` 449 pass, `uv run pytest` 733 pass.
- No blockers.

Verdict: APPROVED

## Test report (retest after BUG-1 and BUG-2)

Tester run on 27. 10. 2026, uncommitted worktree. Own server on `127.0.0.1:8163` with temp data (`/tmp/cabin-t145-retest/data`), test secrets only, three parties and assignments created through the API. Server stopped after the run. Browser: Google Chrome headless through `playwright-core`. Scripts in `/tmp/cabin-t145-retest/scripts/`. Screenshots in `/tmp/cabin-t145-retest/shots/`. The server is not exposed through `tailscale serve`; no new tailnet port was opened.

### Commands and results
- `node --test tests/js/`: 449 pass, 0 fail.
- `uv run pytest -q`: 733 passed.
- Browser checks (phone 390×844, 380×760, desktop 1280×800, member cookie, `cabin.myParty` set).

### Fixes
| Item | Result |
| --- | --- |
| BUG-1: title board under the „ÚLOHY“ tab at 390×844 | PASS. Title rect 228–247 px, quest tab 126–170 px, no overlap. At 380×760: title 192–211, quest 126–170, no overlap. `shots/phone-rest-390x844.png`, `shots/phone-rest-380x760.png` |
| BUG-2: rail touch target 44 px | PASS. `#rail` measures 358×44 at 390 px. `elementFromPoint` at 1, 6, 12, 22, 30, 40 and 43 px from its top returns the rail at each point. A mouse drag starting on the rail works. |

### Regression
| Scenario | Result |
| --- | --- |
| Stamp tap | PASS. Tapping the „Pi → So“ stamp with night 29. 10. selected ran the time-lapse: noon 29. 10. to noon 30. 10. in about 12 s, night switched to 30. 10. |
| Knob drag | PASS. Dragging the knob moved the time to „piatok 18:00, noc Pi → So“ and switched the night. Dragging to the left end shows „piatok 03:30, noc Št → Pi“. |
| One turn | PASS. The clockwise button moved 45 → 135; the counter-clockwise button returned 135 → 45. Svg labels („volné: N“) sit on the 3D roofs at 135 (`shots/phone-turn.png`). |
| Bed tap | PASS. After the turn to 135, Tab focus on „Manželská posteľ, izba vľavo“ opened its house; a mouse tap on the bed opened its sheet („Manželská posteľ | Izba vľavo | Št → Pi · 29./30. 10. | Miesto 1“) (`shots/phone-bed-tap.png`). |
| Phone at night | PASS. `shots/phone-night.png`: the world is dark, the top bar and bottom bar stay bright. |
| Desktop 1280×800 | PASS. Top bar, title, bottom bar and turn buttons fitted, no console errors. `shots/desktop.png` |
| Page errors | None (only the expected 401 before the first join). |

### Not re-run this round
The four-angle line-up and the no-WebGL fallback were verified in round 1 (PASS). The BUG-1 fix changes only the rest-view insets, so both are unaffected. The round-1 evidence stands, and I ticked both criteria on it. Only one turn was re-run.

### Observation (not a failure)
The rail hit area (44 px, `.rail-wrap`) overlaps the lowest 6 px of the stamps. A tap there goes to the rail, not the stamp. The stamp still has about 44 px of tappable height, so this is acceptable.

### Verdict
PASS. All criteria pass, and no regressions were found. Both bugs are fixed. Task moved to `tasks/done/`.
