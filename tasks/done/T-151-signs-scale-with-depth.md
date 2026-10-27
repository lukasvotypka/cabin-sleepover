# T-151: Signs and labels keep their size next to the houses when panning

- **Phase:** 1
- **Depends on:** T-147
- **Size:** S
- **UX:** no

## Goal
Since T-147 the camera follows the pan, so a house near the camera grows and a far one shrinks. The svg items on top of the
3D world (notice board, title gate, „voľné: N“ ridge signs, room signs, bed tags, the meadow „+N“ chip) only moved with
their anchors and kept a fixed size, so the board looked big next to a far house and small next to a near one
(organizer's report of 27. 10. 2026, three screenshots of the same view panned).

## Scope
- `static/js/logic-iso.js`: `isoSignBox` multiplies the sign size by the depth scale of its plan point; `ISO_SIGNS.board`
  130×82 → 115×73 so the board still covers no house at 135°, where it is nearest the camera (depth 1.15).
- `static/js/app-board.js`, `app-houses.js`, `app-beds.js`: signs, plates, tags and the „+N“ chip are drawn with the
  depth scale of their anchor and hang on scaled anchors (`isoAnchor(..., true)`), so the pan rescales them like the world.
- `tests/js/logic.test.mjs`: sign box size test updated; new test that a sign scales like a ground edge at the same point
  after a pan, and a redraw at the new centre gives the same size.

## Acceptance criteria
- [x] Panning changes the board, gate and ridge signs in the same ratio as the houses next to them (browser: board
      131 → 150 → 175 px for depth 0.90 → 1.03 → 1.20).
- [x] A redraw at a moved centre (state update) does not change their size.
- [x] The board covers no house at any of the four angles (Node test).
- [x] `node --test tests/js/` (470) and `uv run pytest` (746) pass.

## Dev log
- Fixed directly by the orchestrator on branch `t3/fix-map-signs-table-geometry`; checked on a preview server.
