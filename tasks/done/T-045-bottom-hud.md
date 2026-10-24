# T-045: „Si: …“ and the status sign as a fixed HUD at the bottom

- **Phase:** 1
- **Depends on:** T-043 (shares `app-draw.js` with T-044: do not run in parallel with it)
- **Size:** M

## Goal
Organizer's decision of 24. 10. 2026 (scene redesign, item 3): the „Si: …“ board and the status sign (proposal "Informácie v scéne", Tabuľka s partiou a stavom) leave the SVG and become a fixed, game-like HUD at the bottom of the viewport that stays put while the map is panned or zoomed. Same behaviour, labels and data as today.

## Scope
- `static/index.html` (HUD markup and CSS, `.zoom-reset` and `#toast` position), `static/js/app-draw.js` (remove `drawStatus`), a HUD renderer in an `app-*.js` file (`app-hud.js` if new, listed in `index.html` with `?v=__ASSET_VERSION__` before `app-start.js`), `static/js/app-zoom.js` (`readInsets`), `static/js/app-beds.js` (`renderAge`), `static/js/logic-model.js`
- `config/cabin.yaml`, `app/models.py`, `tests/test_models.py`, `tests/js/logic.test.mjs`, `tests/manual.md`

## Acceptance criteria
- [x] Pure `statusHud(status, selectedNight)` in `logic-model.js` → `{kind, lines, label, action}`, `action` ∈ `"places" | "night" | "undo" | "who" | null`, with exactly today's labels: missing „<text>. Ťuknutím otvoríš možnosti.“ (night selected → `places`) or „… zvolíš túto noc.“ (`night`); fewer „<text>. Ťuknutím môžeš vrátiť plný počet.“ (`undo`); extra „<text>. Ťuknutím zvolíš túto noc.“ (`night`); ok `<text>` (`null`, includes „Prídeš len cez deň“); none „Najprv vyber, kto si. Ťuknutím to vyberieš.“ (`who`). Node tests cover all five kinds.
- [x] The HUD has two real `<button>`s (≥ 44 px tall): „Si: …“ (`whoText`, plus the „aktualizované pred …“ age that `renderAge` keeps updating; label as today, opens „Kto si?“) and the status sign (lines from `statusBoardLines`/`status.text`, red with blinking „!“, amber, green with pixel check mark). Kind `ok` is a non-button element with `role="img"` and the label. Actions call the same functions as today (`openPlacesPanel`, `selectNight`, `openPlacesUndoPanel`, `openWho`).
- [x] All text set via `textContent`. Look: wood plank / paper faces, thick dark border, hard drop shadow, monospace font, fixed colours that do not change in dark mode. Padding includes `env(safe-area-inset-*)`. The blink stops under `prefers-reduced-motion`.
- [x] The HUD is shown only while the map is shown (hidden on the code screen and the loading splash), sits below panels and their backdrop, and is re-rendered on every `render`.
- [x] `readInsets()` adds the HUD height to the bottom inset, so in the fitted view the whole scene, including the meadow hit area, is above the HUD. „Celá mapa“ and toasts sit above the HUD.
- [x] `map.scene.status` is removed from `cabin.yaml` and `SceneRects`; `grep -rn "drawStatus\|scene.status" static app tests` prints nothing. `uv run pytest` (layout tests unchanged and green) and `node --test tests/js/` pass.
- [x] `tests/manual.md` gets items: HUD stays put while panning and pinching, every state taps through as before, notch and home-bar phones, dark mode, VoiceOver/TalkBack labels.

## Notes for developer
- Layout inside the HUD (who left, status right) and "only with the map" are defaults in proposal „Otvorené rozhodnutia“ (Spodné menu).
- Pixel icons in HTML: tiny inline SVG built with `createElementNS`, never `innerHTML`.
- The viewbox may stay `[380, 496]`: the meadow hit area still needs it.
- Keep the move bar (top) working with the HUD present; focus after closing „Kto si?“ returns to the „Si: …“ button.

---
## Dev log
- New `statusHud(status, selectedNight)` in `logic-model.js` (kinds missing/fewer/extra/ok/none, same labels as before). Node tests added for all five kinds and for the HUD markup/CSS wiring.
- New `static/js/app-hud.js` (listed after `app-draw.js`, before `app-start.js`): `renderHud` (called from `render`), `hudHeight` (publishes `--hud-h`, refits the scene when the HUD height changes), status sign built with `htmlEl` and `createElementNS` icons, `textContent` only. The `<div id="hud">` markup and CSS are in `index.html` (z-index 12: above the move bar, below the panels and the splash). Fixed colours, monospace font, 3 px dark borders, hard shadow, `env(safe-area-inset-*)` padding. The blink stops under the global reduced-motion rule plus an explicit `.hud-bang` rule.
- `showScene` now also shows/hides the HUD (hidden on the code screen and the splash). `closePanel` also looks for the return-focus key in the HUD, so focus returns to „Si: …“ or the status sign. `renderAge` writes to the HUD span; `app.ageMax` removed.
- `readInsets()` bottom inset = max(home-bar inset, HUD height) (the HUD height already contains the home-bar padding, so adding would count it twice). `.zoom-reset` and `#toast` sit above `max(--hud-h, safe-area)`.
- Removed `drawStatus`, `raisedBoard`, `drawLines` from `app-draw.js`; removed `map.scene.status` from `config/cabin.yaml`, `SceneRects`, `tests/test_models.py` and the Node test fixture. Viewbox unchanged.
- `tests/manual.md`: five HUD items added.
- Visual check with headless Chrome against a temp server (/tmp/t045-test): red, green, amber, none, panel over the HUD, focus return to „Si: …“, zoomed view with toast and „Celá mapa“ above the HUD (HUD 76 px tall at 380 px width). No page errors.
- Tests: `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` → 265 pass; `uv run pytest` → 501 pass. `grep -rn "drawStatus\|scene.status" static app tests` prints nothing.
- Follow-up outside scope: `proposal.md` line ~275 still lists `status: [278, 322, 94, 88]` in the cabin.yaml example and should drop it; older manual items (T-034, T-041) still say „status board“ in the scene.

## Review round 1
Checked: `statusHud` labels and actions against the removed `drawStatus` (identical sentences, same functions via `runHudAction`). The HUD is built with `htmlEl`/`createElementNS` and `textContent` only (no `innerHTML`). Both buttons are ≥ 44 px (min-height 56). Kind `ok` is a `div role="img"` with its label. Fixed colours and monospace font. Padding uses `env(safe-area-inset-*)`. `.hud-bang` stops blinking under reduced motion. z-order: move bar 10 < HUD 12 < splash 15 < backdrop/panel 20/21 < toast 40, and „Celá mapa“ and the toast are offset by `max(--hud-h, safe-area)`. `showScene` hides the HUD on the code screen and the splash. `render()` returns early there, and `ensureScene` shows the HUD before it is measured. Polling re-render: `#hudWho` is never recreated, and the status sign is redrawn inside `keepFocus($("hud"))`, so focus is not stolen. Focus return: „Kto si?“ falls back to `returnFocus` (the persistent `#hudWho`), and the status panels use `returnKey: "status"`, which `closePanel` now finds in `#hud`. The age line updates through `app.ageNode = #hudAge` and the existing 1-s `renderAge` interval and on 304. `readInsets` uses `max(paddingBottom, hudHeight())`, and the HUD height already contains the home-bar padding, so this is correct. A height change refits through `refitView`, which keeps the user's zoom. All 20 scripts in `static/js/` are listed with `?v=__ASSET_VERSION__`, and `app-hud.js` comes before `app-start.js`.

Tests run by reviewer: `node --test tests/js/` 265 pass; `uv run pytest` 501 pass; `grep -rn "drawStatus\|scene.status" static app tests` prints nothing.

**Blockers:** none.

**Suggestions:**
- `static/index.html:175,177`: the `#scene svg .alert-sign` blink rule and its reduced-motion override are dead now that `drawStatus` is gone (no JS sets `alert-sign`). Remove them in a later cleanup.
- `wrapText` in `logic-model.js` has no caller in `app-*.js` any more. Only its Node test uses it. Drop it or keep it on purpose.
- The developer's follow-up is valid: `proposal.md` still shows `status: [...]` in the cabin.yaml example, and the T-034 and T-041 manual items still say "status board in the scene". This is for the analyst or product owner.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester: claude-haiku-5-5 (tester role). Own temp server on 127.0.0.1:8050 with data in /tmp/t045-tester/data (killed afterwards). Chrome headless over CDP, driver in /tmp/t045-tester/drive.mjs. No commits.

### Commands and results
- `uv run pytest -q` (in repo root, uv from /opt/homebrew/bin): 501 passed.
- `node --test tests/js/`: 265 pass, 0 fail.
- `grep -rn "drawStatus\|scene.status" static app tests`: no output.
- Served HTML: `app-hud.js?v=__ASSET_VERSION__` listed before `app-start.js`; HUD loads with no page errors in any run.

### Acceptance criteria
| # | Criterion | Result |
|---|---|---|
| 1 | Pure `statusHud` with the five kinds, labels and actions as before; Node tests cover all five | Pass (labels compared with HEAD `drawStatus` sentence for sentence; Node tests green) |
| 2 | Two real buttons ≥44 px: „Si: …“ and status sign; `ok` is `div role="img"`; actions call the same functions | Pass (buttons 56 px at 380, 320, 390; Denny `ok` is DIV role=img, tap does nothing) |
| 3 | textContent only, fixed colours in dark mode, safe-area padding, blink stops under reduced motion | Pass for colours (identical computed colours in light and dark), blink (`blink` normal, `none` reduced), code reads `env(safe-area-inset-*)`. Notch not testable headless. |
| 4 | HUD only with the map (hidden on code screen and splash), below panels and backdrop, re-rendered on every render | Pass (code screen: hidden; panel and backdrop cover HUD; poll re-render changed the sign) |
| 5 | `readInsets` includes HUD height; „Celá mapa“ and toast above HUD | Pass (fitted 380 and 320 views show whole scene above HUD; zoomed view: zoom button bottom 676, toast bottom 672, HUD top 684) |
| 6 | `map.scene.status` removed from yaml and SceneRects; grep empty; pytest and node pass | Pass |
| 7 | `tests/manual.md` items | Pass (five T-045 items present, plus one added by tester, see below) |

### Scenarios run (all in headless Chrome, no page errors)
- Missing, night not selected (Novákovci, Pi): tap selects Friday, label changes to „…Ťuknutím otvoríš možnosti.“, second tap opens places panel, Escape returns focus to the sign.
- Fewer (lowered places on Pi, selected): label „Pi: len 1 z 2. Ťuknutím môžeš vrátiť plný počet.“, tap opens undo panel „Piatok“, Escape returns focus.
- Ok („Všetko máš“ after server-side assignment, arrived through poll): non-button, role=img.
- Ok („Prídeš len cez deň“, day visitor): DIV role=img, tap does nothing.
- None (no party chosen): label „Najprv vyber, kto si. Ťuknutím to vyberieš.“, tap opens „Kto si?“, Escape returns focus to „Si: …“ button (`hudWho`).
- Si button: opens „Kto si?“, Escape returns focus to `hudWho`.
- Extra: not reachable with real data (server refuses over-assignment). Rendered through `drawHudStatus(statusHud(...))` only: label „Máš o 1 miesto viac, než potrebuješ. Ťuknutím zvolíš túto noc.“, class `hud-extra`, BUTTON. Tap action not run live.
- Drag over the map (190,300 → 190,150): viewBox changed from `0 -94` to `0 56`, HUD top stayed at 684.
- Zoomed (half-size view) with toast and „Celá mapa“: both above HUD (see criterion 5).
- Viewports: 380×760 (main), 320×568 with a 40-char party name (name truncated with ellipsis, status wraps to 3 lines, HUD grows to 90.5 px, fitted scene fully above HUD), 390×844 iPhone 12 Pro (HUD flush with bottom, 76 px).
- Dark mode (`prefers-color-scheme: dark`): HUD computed colours and screenshot identical to light.
- Reduced motion: `.hud-bang` animation `none`; normal motion `blink`.
- Code screen (no cookie): `#hud` hidden, height 0.
- Poll: server-side assignment while sign is focused; within 30 s the HUD re-rendered from red to green. Focus fell to BODY (the element was replaced by a non-button).

### Issues (none blocks a criterion)
1. Minor: when a toast is shown in the zoomed view, it covers the „Celá mapa“ button (same x range, y 632–672 vs 632–676, toast z-index 40 above the button). Both sit above the HUD as required, but the button is hidden while the toast lasts (about 3 s). Reproduce: pan/zoom the map so „Celá mapa“ shows, trigger any toast (e.g. save). Expected: button stays tappable or the toast sits above it. Actual: toast covers it. Suggest the developer or product owner decides; not a criterion failure.
2. Minor: at 320 px with a long party name the status sign text wraps into three lines („Pi: chýbajú / 4 / Ťukni sem ›“, orphan „4“). Cosmetic.
3. Minor: when the status sign changes from a button to the non-interactive `ok` state during a poll (or after a tap), keyboard focus falls to BODY. Acceptable, but worth knowing for screen reader users.

### Manual items added by tester
- toast over „Celá mapa“ check (see issue 1), in `tests/manual.md`.

### Verdict
All acceptance criteria pass. No regressions (pytest 501, Node 265 green, the tasks in done/ are covered by them). Moved to `done/`. Not committed.
