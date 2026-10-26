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
- [ ] `tests/manual.md` section 11 is renamed to cover T-110, T-111, T-114, T-115, mentions no clock board, no midnight swap, and has items (English, Slovak UI quoted exactly) for 380 px iPhone Safari and Android Chrome:
  - top bar always visible left of „Úlohy“, ≥ 44 px, does not cover „Úlohy“, hidden in move mode („Ťukni na nové miesto“), scene starts below it;
  - dragging the knob moves light and time text smoothly and does not pan the map; release keeps the time (also at night); tap on the strip runs the time-lapse there;
  - crossing 06:00 switches the signpost highlight, bottom HUD and an open panel; figures that leave shift and fade, new ones fade in, same-place figures stay; Št → So swaps twice; Sunday morning nobody gets up;
  - signpost and „Ťukni sem“ go to noon; page load is at noon of the chosen night; „Kto si?“ and an SSE change from a second phone switch without a time-lapse;
  - VoiceOver/TalkBack read the value like „piatok 03:00, noc Št → Pi“; arrows, Page Up/Down, Home/End on desktop;
  - reduced motion: no time-lapse, no fade, fireflies still, drag works;
  - the open-decision defaults (time stays where released, noon after load, fade in place) and the two defaults from T-115 notes (instant switch keeps the hour if it is in the new night; meadow figures switch without fade), so the organizer can judge them.
- [ ] `CLAUDE.md` bullet updated: fixed top time slider, nights change at 06:00 (last night clamped), figures swap with a fade at each 06:00, only signpost / „Ťukni sem“ / strip taps animate; no clock board.
- [ ] No code changes; `node --test tests/js/` and `uv run pytest -q` still pass.

## Notes for developer
- English only; keep the T-113 pan/zoom fps item if section 11 has one.

---
## Dev log

## Review round 1

## Review round 2

## Test report
