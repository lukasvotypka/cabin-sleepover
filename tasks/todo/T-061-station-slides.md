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
- [ ] A slide covers the whole yard on mobile; „‹ Dvor“ top left and a bottom button return to the yard.
- [ ] `pack` (auto): the packing to-do from `packItems()`; tap toggles packed (green, ✓, `aria-pressed`) via `togglePacked(localStorage, …)`; progress line from `packProgressText`.
- [ ] `water` (studňa): red warning „Voda z kohútika nie je na pitie.“ only when `drinkable` is `false`; calculator prefilled with `waterDefaults`, − / + within the T-059 bounds, result in litres and bottles; text „Podľa tvojej partie „…““.
- [ ] `food` (ohnisko): `menu` by day with meals, `bring`, and the „na jedlo“ counts per event day from the existing `foodCount` (T-039).
- [ ] `program` (smerovník): `program` items with icon, title, `when`, `note`.
- [ ] `sleep` (chata): `sleep` items; when `needsMat`, the note „Tvoje miesto: <matPlaces> … pribaľ karimatku“.
- [ ] Desktop ≥ 900 px: yard left, slide right; with nothing open the right side shows a welcome with the station list, each entry tappable (`role="button"`) and opening that station.
- [ ] All text from `info.yaml` and party names via `textContent`; no `innerHTML` (grep check). Reduced motion: no wipe animation.
- [ ] `node --test tests/js/` and `uv run pytest` pass; manual check on a 380 px and a 1200 px wide window noted in the Dev log.

## Notes for developer
- Recording the step on the server is T-063; this task only opens and closes slides.
- The packed set is shared with the quick list (T-062) through the T-059 functions and the same `localStorage` key; re-read it when a view opens.

---
## Dev log

## Review round 1

## Review round 2

## Test report
