# T-060: Adventure view: yard, figure, stations, walking, navigation

- **Phase:** 1
- **Depends on:** T-057, T-059
- **Size:** M

## Goal
The main „Pred cestou“ view: a full-screen pixel yard with my party's figure walking to five stations. See proposal "Pred cestou" › "Stránka", bullet „Dobrodružstvo (hlavný pohľad)“ and the accessibility bullet. Reuse `design/info/index.html` (`PAL`, `SPR`, `spr()`, `fig()`, `drawYard()`, `ST`, `LEG`, `walk()`, `refresh()`, `endPanel()`), rewritten to project rules.

## Scope
- New `static/js/logic-info-art.js` (palette and sprite grids as pure data, incl. the 22 `INFO_ICONS` names plus page-only sprites such as `batoh`)
- New `static/js/app-adventure.js` (view, yard SVG, stations, walk, top board, bottom bar, end panel)
- `static/index.html` (view container, CSS, two `<script>` tags with `?v=__ASSET_VERSION__`)
- Test: a check (pytest or Node) that every name in `app.models.INFO_ICONS` has a sprite in `logic-info-art.js`

## Acceptance criteria
- [ ] `openAdventure()` shows a full-screen view over the map; the yard is drawn in code (fixed decoration, `shape-rendering="crispEdges"`), figure in my party's color (shirt letter not needed).
- [ ] Five stations in order auto (`pack`), studňa (`water`), ohnisko (`food`), smerovník (`program`), chata (`sleep`). The next one blinks, has a bouncing arrow and a big label; others a small label; visited ones a green ✓.
- [ ] Tapping a station walks the figure along the path, then calls `openStation(step)` (a hook T-061 fills; until then a placeholder panel). Tapping the yard while a slide is open only closes it.
- [ ] Top board always says what to do (`boardHint`). Bottom bar: five station icons (colored once visited), „☰“ (calls `openQuickList()`, T-062), and „Choď: <next> ›“.
- [ ] After the last station the end panel „Máš všetko, vidíme sa na chate!“ with „Na mapu postelí“ (closes the view), „Zoznam na zbalenie“ (quick list) and „Prejsť dvor znova“ (figure back to start, visited marks kept).
- [ ] Visited marks come from `state.briefing[myParty]` plus stations opened in this page load (default of `tasks/QUESTIONS.md` Q17).
- [ ] `prefers-reduced-motion`: the figure jumps at once, nothing blinks or bounces. Animations step in pixel steps.
- [ ] Stations are `role="button"`, `tabindex="0"`, Enter/Space activate, Slovak `aria-label`. Esc closes an open slide, then the view.
- [ ] No `innerHTML` in new files (grep check); all config text via `textContent`. `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
- Ignore the prototype's „Prezentácia“ view and the phone-frame tools (theme/motion toggles); only „Dobrodružstvo“ and „Rýchly prehľad“ apply.
- Desktop split (≥ 900 px) is in T-061, the board/offer entry in T-063; expose `openAdventure()` only.
- Keep the yard at viewBox 380×600 as in the prototype; it is its own SVG, not part of `cabin.yaml` geometry.

---
## Dev log

## Review round 1

## Review round 2

## Test report
