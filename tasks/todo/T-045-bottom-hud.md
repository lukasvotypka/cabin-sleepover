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
- [ ] Pure `statusHud(status, selectedNight)` in `logic-model.js` → `{kind, lines, label, action}`, `action` ∈ `"places" | "night" | "undo" | "who" | null`, with exactly today's labels: missing „<text>. Ťuknutím otvoríš možnosti.“ (night selected → `places`) or „… zvolíš túto noc.“ (`night`); fewer „<text>. Ťuknutím môžeš vrátiť plný počet.“ (`undo`); extra „<text>. Ťuknutím zvolíš túto noc.“ (`night`); ok `<text>` (`null`, includes „Prídeš len cez deň“); none „Najprv vyber, kto si. Ťuknutím to vyberieš.“ (`who`). Node tests cover all five kinds.
- [ ] The HUD has two real `<button>`s (≥ 44 px tall): „Si: …“ (`whoText`, plus the „aktualizované pred …“ age that `renderAge` keeps updating; label as today, opens „Kto si?“) and the status sign (lines from `statusBoardLines`/`status.text`, red with blinking „!“, amber, green with pixel check mark). Kind `ok` is a non-button element with `role="img"` and the label. Actions call the same functions as today (`openPlacesPanel`, `selectNight`, `openPlacesUndoPanel`, `openWho`).
- [ ] All text set via `textContent`. Look: wood plank / paper faces, thick dark border, hard drop shadow, monospace font, fixed colours that do not change in dark mode. Padding includes `env(safe-area-inset-*)`. The blink stops under `prefers-reduced-motion`.
- [ ] The HUD is shown only while the map is shown (hidden on the code screen and the loading splash), sits below panels and their backdrop, and is re-rendered on every `render`.
- [ ] `readInsets()` adds the HUD height to the bottom inset, so in the fitted view the whole scene, including the meadow hit area, is above the HUD. „Celá mapa“ and toasts sit above the HUD.
- [ ] `map.scene.status` is removed from `cabin.yaml` and `SceneRects`; `grep -rn "drawStatus\|scene.status" static app tests` prints nothing. `uv run pytest` (layout tests unchanged and green) and `node --test tests/js/` pass.
- [ ] `tests/manual.md` gets items: HUD stays put while panning and pinching, every state taps through as before, notch and home-bar phones, dark mode, VoiceOver/TalkBack labels.

## Notes for developer
- Layout inside the HUD (who left, status right) and "only with the map" are defaults in proposal „Otvorené rozhodnutia“ (Spodné menu).
- Pixel icons in HTML: tiny inline SVG built with `createElementNS`, never `innerHTML`.
- The viewbox may stay `[380, 496]`: the meadow hit area still needs it.
- Keep the move bar (top) working with the HUD present; focus after closing „Kto si?“ returns to the „Si: …“ button.

---
## Dev log

## Review round 1

## Review round 2

## Test report
