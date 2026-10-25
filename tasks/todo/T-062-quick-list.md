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
- [ ] Order: water on top (warning when not drinkable, litres from the T-059 calculation for my party), packing to-do with checkboxes, sleep, food (menu, `bring`), program, button „Kopírovať do WhatsAppu“.
- [ ] Packing uses the same `localStorage` state as the adventure: an item ticked here is ticked in the pack slide and back (re-read on open). Progress line as in T-061.
- [ ] „Kopírovať do WhatsAppu“ copies `quickWhatsAppText` via the Clipboard API and shows a Slovak toast; without clipboard access it shows the text selectable, like the existing „Prehľad na poslanie“ panel.
- [ ] Follows the light/dark panel colors of "Vzhľad"; two columns from 900 px.
- [ ] Opens from „☰“ in the adventure and is callable as `openQuickList()` for the board (T-063).
- [ ] All config text via `textContent`, no `innerHTML` (grep check). `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Reuse `openPanel` from `app-panels.js` and the copy helper of `app-summary.js` if one exists; do not duplicate it.
- Sending the `list` step is T-063.

---
## Dev log

## Review round 1

## Review round 2

## Test report
