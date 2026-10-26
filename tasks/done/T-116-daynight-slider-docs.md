# T-116: Docs and manual checks for the time slider

- **Phase:** 1
- **Depends on:** T-115
- **Size:** S

## Goal
Update the docs to the slider and 06:00 swap (proposal "Deň a noc pri prepnutí noci"), replacing the clock-board and midnight-swap wording from T-112.

## Scope
- `tests/manual.md` (section 11 „Day and night“)
- `CLAUDE.md` (the day-and-night bullet in "Frontend behaviour worth knowing")

## Acceptance criteria
- [x] `tests/manual.md` section 11 is renamed to cover T-110, T-111, T-114, T-115, mentions no clock board, no midnight swap, and has items (English, Slovak UI quoted exactly) for 380 px iPhone Safari and Android Chrome:
  - top bar always visible left of „Úlohy“, ≥ 44 px, does not cover „Úlohy“, hidden in move mode („Ťukni na nové miesto“), scene starts below it;
  - dragging the knob moves light and time text smoothly and does not pan the map; release keeps the time (also at night); tap on the strip runs the time-lapse there;
  - crossing 06:00 switches the signpost highlight, bottom HUD and an open panel; figures that leave shift and fade, new ones fade in, same-place figures stay; Št → So swaps twice; Sunday morning nobody gets up;
  - signpost and „Ťukni sem“ go to noon; page load is at noon of the chosen night; „Kto si?“ and an SSE change from a second phone switch without a time-lapse;
  - VoiceOver/TalkBack read the value like „piatok 03:00, noc Št → Pi“; arrows, Page Up/Down, Home/End on desktop;
  - reduced motion: no time-lapse, no fade, fireflies still, drag works;
  - the open-decision defaults (time stays where released, noon after load, fade in place) and the two defaults from T-115 notes (instant switch keeps the hour if it is in the new night; meadow figures switch without fade), so the organizer can judge them.
- [x] `CLAUDE.md` bullet updated: fixed top time slider, nights change at 06:00 (last night clamped), figures swap with a fade at each 06:00, only signpost / „Ťukni sem“ / strip taps animate; no clock board.
- [x] No code changes; `node --test tests/js/` and `uv run pytest -q` still pass.

## Notes for developer
- English only; keep the T-113 pan/zoom fps item if section 11 has one.

---
## Dev log
Rewrote section 11 of `tests/manual.md` (merged the T-115 tester section, dropped clock board and midnight swap, added all listed items and defaults, kept the T-113 fps item) and the day-and-night bullet in `CLAUDE.md`. No code changes. `node --test tests/js/` (365 pass) and `uv run pytest -q` (739 passed) pass.
Rewrote section 11 of `tests/manual.md` (merged the T-115 tester section, dropped clock board and midnight swap, added all listed items and defaults, kept the T-113 fps item) and the day-and-night bullet in `CLAUDE.md`. No code changes. `node --test tests/js/` and `uv run pytest -q` (739 passed) pass.

## Review round 1

Docs-only diff (`CLAUDE.md` bullet, `tests/manual.md` section 11); no code touched. Verified: section 11 renamed to T-110/T-111/T-114/T-115, no clock board or midnight swap left, all listed items present (bar position/44 px/move mode, drag, strip tap, 06:00 crossing incl. Št → So twice and Sunday, noon on signpost/„Ťukni sem“/load, instant „Kto si?“/SSE, screen reader value format matches `sliderValueText` and keys match `logic-daynight.js`, reduced motion, open-decision defaults and both T-115 defaults), T-113 fps item kept, Multiply item kept. `CLAUDE.md` bullet covers all required points and matches proposal „Deň a noc pri prepnutí noci“. Tests: `node --test tests/js/` 365 pass, `uv run pytest -q` 739 passed.

**Blocker:** none.

**Nit:** the Dev log entry is duplicated (two near-identical paragraphs).

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (T-116, docs-only, run by the organizer's request; file was still in `review/`, not `testing/`):

Commands and results:
- `node --test tests/js/`: 365 pass, 0 fail.
- `uv run pytest -q`: 739 passed.
- `git diff HEAD --name-only` outside `CLAUDE.md`, `tests/manual.md`, `tasks/`: empty, so no code changed.
- Grep of `tests/manual.md` and `CLAUDE.md` for clock board / midnight / T-112 wording: none left, except the intended "There is no clock board" sentence.
- Quoted Slovak UI strings exist in code: „Úlohy“ (index.html, app-hud.js), „Presunúť“ (app-sheet.js), „Ťukni na nové miesto“ (logic-beds.js), „Ťukni sem“ (logic-model.js), „Kto si?“ (app-hud.js), label format "piatok 03:00, noc Št → Pi" (logic-daynight.js line 95 and 101).

Acceptance criteria:
| Criterion | Result |
| manual.md section 11 renamed, covers T-110/111/114/115, no clock board or midnight swap | pass |
| Items: top bar position, move-mode hide, knob drag, strip tap | pass |
| Items: 06:00 crossing, highlight/HUD/panel, figure fade, Št→So twice, Sunday | pass |
| Items: signpost and „Ťukni sem“ to noon, page load noon, Kto si?/SSE no time-lapse | pass |
| Items: screen reader label and desktop keys, reduced motion | pass |
| Items: open-decision defaults and the two T-115 defaults listed | pass |
| CLAUDE.md day-and-night bullet updated (slider, 06:00, last night clamped, fade, animation triggers, no clock board) | pass |
| No code changes; node and pytest pass | pass |

Extra checks: only section 11 of `tests/manual.md` changed (single hunk). The T-113 fps item is kept.

Failures: none.

Result: PASS. Not moved. The file is in `review/` and has no reviewer approval yet, so it should go `review → testing → done` after the reviewer's round 2, not straight to `done/`. The orchestrator should do that move.
