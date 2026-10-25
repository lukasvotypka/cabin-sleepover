# T-062: „Rýchly prehľad“ panel with packing and WhatsApp copy

- **Phase:** 1
- **Depends on:** T-060
- **Size:** S

## Goal
One-page summary in the panel style. See proposal "Pred cestou" › "Stránka", bullet „Rýchly prehľad“ (and „Desktop“ for two columns). Layout follows the prototype `buildQuick()`.

## Scope
- New `static/js/app-quick.js` (`openQuickList()`)
- `static/index.html` (CSS, `<script>` tag with `?v=__ASSET_VERSION__`)

## Acceptance criteria
- [x] Order: water on top (warning when not drinkable, litres from the T-059 calculation for my party), packing to-do with checkboxes, sleep, food (menu, `bring`), program, button „Kopírovať do WhatsAppu“.
- [x] Packing uses the same `localStorage` state as the adventure: an item ticked here is ticked in the pack slide and back (re-read on open). Progress line as in T-061.
- [x] „Kopírovať do WhatsAppu“ copies `quickWhatsAppText` via the Clipboard API and shows a Slovak toast; without clipboard access it shows the text selectable, like the existing „Prehľad na poslanie“ panel.
- [x] Follows the light/dark panel colors of "Vzhľad"; two columns from 900 px.
- [x] Opens from „☰“ in the adventure and is callable as `openQuickList()` for the board (T-063).
- [x] All config text via `textContent`, no `innerHTML` (grep check). `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Reuse `openPanel` from `app-panels.js` and the copy helper of `app-summary.js` if one exists; do not duplicate it.
- Sending the `list` step is T-063.

---
## Dev log

- Added `static/js/app-quick.js` (`openQuickList()`): water card (warning style when not drinkable, litres from `waterDefaults`/`waterResult` for my party), packing checkboxes (`loadPacked`/`togglePacked`, re-read on every open, progress via `packProgressText`), sleep, food (menu + `bring`), program, and „Kopírovať do WhatsAppu“ (Clipboard API + toast „Skopírované.“, fallback shows a selectable textarea like `openSummary`; `quickWhatsAppText(info, event.name)`).
- `app-panels.js`: new `opts.wide` (class `sheet quick`). `index.html`: `.qk-*` CSS in theme variables, two columns and 900 px max width from 900 px, script tag after `app-slides.js`/before `app-sound.js` with `?v=__ASSET_VERSION__`.
- T-060 note: `openPanel` starts with `closePanel()`, so `openQuickList()` from the end panel replaces it (no extra code needed).
- No `innerHTML` in app-quick.js. Sending the `list` step is T-063. Not checked in a real browser.
- Tests: `node --test tests/js/` (311 pass), `uv run pytest` (570 pass).

## Review round 1

Checked: `static/js/app-quick.js` (new), the diff of `static/index.html` and `static/js/app-panels.js`, the prototype `buildQuick()` in `design/info/index.html`, proposal "Pred cestou" › „Rýchly prehľad“ / „Desktop“. Tests run by the reviewer: `node --test tests/js/` 311 pass, `uv run pytest` 570 pass. Every script in `static/js/` is listed in `index.html` with `?v=__ASSET_VERSION__`; `app-quick.js` loads after all helpers it uses (`logic-info.js`, `logic-model.js`, `app-panels.js`). No `innerHTML` in `app-quick.js`; all config text goes through `htmlEl(..., text)`/`textContent`.

Acceptance criteria: order water → pack → sleep → food → program → copy matches the prototype; warning style only when `drinkable === false`; litres via `waterDefaults`/`waterResult` (`info.water` is required in `Info`, so no null path). Packing uses `loadPacked`/`togglePacked` (same `PACKED_KEY` and `packItems(info, needsMat(...))` labels as the pack slide), re-read on every open, progress via `packProgressText`. Copy uses Clipboard API with toast, and on failure/absence shows the selectable textarea with `execCommand` attempt, same as `openSummary`. Panel colors use theme variables (all defined in light and dark); two columns and 900 px width from 900 px. Panel (z 21) stacks above the adventure (z 18), and `advQuickList()` calls `openQuickList()`. Checkboxes have 44 px rows inside `<label>`.

No blockers.

- **Suggestion:** the copy/fallback logic in `qkCopy` (app-quick.js:88-110) duplicates `openSummary`'s `selectText`/`fallback`/clipboard code in `app-summary.js:28-48`. No shared helper existed, so this is not a blocker, but extracting one `copyText(text, area, onDone)` into `app-panels.js` or `app-summary.js` would keep the two in sync.
- **Suggestion:** the prototype shows a pixel icon in each card heading (`flasa`, `batoh`, `spacak`, `hrniec`, `smernik`) and the event subtitle under the title; the implementation has plain headings. Optional polish, could reuse `advIcon` from the adventure.
- **Nit:** the fallback textarea toast „Text je označený, skopíruj ho.“ is fine, but the textarea stays visible on later successful copies; harmless.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

- Tester: T-062 · 2026-10-25 · Result: PASS (no bugs). Also added one manual checklist item (T-062) to `tests/manual.md`.

### Commands and results
- `uv run pytest -q`: 570 passed.
- `node --test tests/js/`: 311 pass, 0 fail.
- Browser check (headless Google Chrome over CDP, temp `data/` dir, own server on a free port, stopped afterwards; driver scripts in `/tmp/t062/driver/`, not in the repo): 53 of 53 checks pass, no console errors or exceptions. Second run (copy fallback without the Clipboard API): 3 of 3 pass.

### Acceptance criteria
| Criterion | Result |
| --- | --- |
| Order water, pack, sleep, food, program, copy button | PASS (headings in that order at 390, 899, 900, 1200 px; water card red/warning with `drinkable: false`; litres 18 l = 12 bottles for 3 people in the test party) |
| Packing uses the `info-packed` localStorage state, re-read on open, progress line | PASS (tick stored under `info-packed`, survives close and reopen, progress „1 z 14“) |
| Copy via Clipboard API with Slovak toast; fallback shows selectable text | PASS (toast „Skopírované.“ with clipboard; with `navigator.clipboard` removed: read-only textarea with the text and toast „Text je označený, skopíruj ho.“, panel stays open). Clipboard content itself not read back (headless focus limit), text taken from `quickWhatsAppText` in code |
| Light and dark panel colors | PASS (screenshots at 390 and 1200 px in both modes look right; colors come from theme variables) |
| Two columns from 900 px | PASS (1 column at 390 and 899 px, 2 columns at 900 and 1200 px; panel stays inside the viewport, no horizontal overflow) |
| Opens from ☰ in the adventure, callable as `openQuickList()` | PASS (☰ click at 390 and 1200 px; `openQuickList` is a global function in a plain script, reached in the fallback test) |
| No `innerHTML`, config text via `textContent`; both test suites pass | PASS (grep: 0 matches in `app-quick.js`; `htmlEl` sets text with `textContent`; both suites pass) |

### Extra scenarios
- Reload with a chosen party, open the quick list, tick an item, close, reopen: tick kept.
- Viewports 390×844, 899×800, 900×800, 1200×900, each in light and dark (`prefers-color-scheme`, reduced motion on): no horizontal overflow, no „undefined“/„NaN“/„null“ in the panel text.
- Copy with clipboard permission granted and with the Clipboard API removed.

### Not checked automatically (in `tests/manual.md`)
- Real phones (iPhone Safari, Android Chrome), touch targets, real clipboard paste into WhatsApp, VoiceOver/TalkBack reading of the checkboxes.

### Observations (not failures, no bug report needed)
- Food table on desktop: the date column wraps („Št 29.“ / „10.“). Cosmetic.
- Card headings have no pixel icons or event subtitle, unlike the prototype `buildQuick()` (the reviewer already noted this as optional).
- On desktop the water card sits alone in the left column with empty space below it. Cosmetic.

Verdict: all criteria pass, no regressions, moved to `tasks/done/`.
