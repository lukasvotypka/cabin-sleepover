# T-112: Day–night docs and manual checks

- **Phase:** 1
- **Depends on:** T-111
- **Size:** S

## Goal
Document the day–night time-lapse (proposal "Stránka: jedna scéna a interakcie" → "Deň a noc pri prepnutí noci") for the manual test round and for developers.

## Scope
- `tests/manual.md`
- `README.md` (only if it lists page features or `static/js` files)
- `CLAUDE.md` ("Frontend behaviour worth knowing": one short bullet)

## Acceptance criteria
- [ ] `tests/manual.md` has a **Day and night (T-110, T-111)** item, in English, covering on a 380 px iPhone Safari and Android Chrome:
  - tapping Št → So runs dusk, night, dawn twice with the clock board („Št 12:00“ … „So 12:00“), about 3.4 s; Št → Pi about 2.2 s; So → Št runs backwards;
  - the signpost highlight changes at once, figures change around midnight of the last night passed;
  - rapid taps on several signposts during the animation continue smoothly, with no jump or flash;
  - signposts and the party table stay readable at night; rooms, windows and doors glow; fireflies blink; no bird at night;
  - multiply blend renders on iPhone Safari (orange dusk, navy night, not grey or black);
  - page load, „Kto si?“ pick and a change from a second phone (SSE) switch without the time-lapse, and an SSE update during the animation does not show the new night early;
  - with reduced motion on: instant switch, no clock board, fireflies still;
  - the clock board disappears about 0.9 s after the end and is not shown at rest; taps on beds and signposts still work at night.
- [ ] `CLAUDE.md` gets one bullet naming `logic-daynight.js` / `app-daynight.js`, that only signpost and HUD taps animate, and that the light layer sits under `boards`.
- [ ] `README.md` mentions the files only if it already lists `static/js` files; otherwise unchanged.
- [ ] No code changes; `node --test tests/js/` and `uv run pytest` still pass.

## Notes for developer
- English only in these docs; quote Slovak UI text exactly as shown on the page.
- Mention the open decision defaults ("Deň a noc pri prepnutí noci") in the manual item, so the organizer can judge speed, swap moment and board dimming while testing.

---
## Dev log

## Review round 1

## Review round 2

## Test report
