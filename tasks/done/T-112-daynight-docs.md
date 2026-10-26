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
- [x] `tests/manual.md` has a **Day and night (T-110, T-111)** item, in English, covering on a 380 px iPhone Safari and Android Chrome:
  - tapping Št → So runs dusk, night, dawn twice with the clock board („Št 12:00“ … „So 12:00“), about 3.4 s; Št → Pi about 2.2 s; So → Št runs backwards;
  - the signpost highlight changes at once, figures change around midnight of the last night passed;
  - rapid taps on several signposts during the animation continue smoothly, with no jump or flash;
  - signposts and the party table stay readable at night; rooms, windows and doors glow; fireflies blink; no bird at night;
  - multiply blend renders on iPhone Safari (orange dusk, navy night, not grey or black);
  - page load, „Kto si?“ pick and a change from a second phone (SSE) switch without the time-lapse, and an SSE update during the animation does not show the new night early;
  - with reduced motion on: instant switch, no clock board, fireflies still;
  - the clock board disappears about 0.9 s after the end and is not shown at rest; taps on beds and signposts still work at night.
- [x] `CLAUDE.md` gets one bullet naming `logic-daynight.js` / `app-daynight.js`, that only signpost and HUD taps animate, and that the light layer sits under `boards`.
- [x] `README.md` mentions the files only if it already lists `static/js` files; otherwise unchanged.
- [x] No code changes; `node --test tests/js/` and `uv run pytest` still pass.

## Notes for developer
- English only in these docs; quote Slovak UI text exactly as shown on the page.
- Mention the open decision defaults ("Deň a noc pri prepnutí noci") in the manual item, so the organizer can judge speed, swap moment and board dimming while testing.

---
## Dev log
Docs only. Rewrote `tests/manual.md` section 11 as „Day and night (T-110, T-111)“ (kept the tester's items, added the rest and the open-decision defaults); added one bullet to `CLAUDE.md`; `README.md` unchanged (lists only the `static/js/` directory, not files). No code changes, so tests not re-run (node/pytest unaffected).

## Review round 1
Docs only (`tests/manual.md` §11, one `CLAUDE.md` bullet, README unchanged since it lists only the `static/js/` directory). Checked the docs against the code: duration `900 + 1250·Δh/24` ms (logic-daynight.js:40) gives 2.2 s for one night and 3.4 s for two. The clock board hides after 900 ms (app-daynight.js:195). The light layer sits between `walk` and `boards`. Only the signpost tap (app-draw.js:324) and the HUD status row (app-hud.js:62) pass `animate: true`. The defaults listed in the manual item match the open decision in proposal.md:604. Every manual criterion is covered, in English, with the Slovak UI text quoted. Tests: `node --test tests/js/` 360 pass / 0 fail, `uv run pytest` 739 passed.

No blockers.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (T-112): PASS. Docs only, no code changes since the last commit (`git diff HEAD -- static tests/js` is empty).

Commands run:
- `uv run pytest -q` → 739 passed in 14.56 s
- `node --test tests/js/` → 360 tests, 360 pass, 0 fail

Acceptance criteria:

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `tests/manual.md` has an English "Day and night (T-110, T-111)" item covering iPhone Safari and Android Chrome, 380 px | PASS | Section 11 renamed, English, Slovak labels quoted |
| 1a | Št → So dusk/night/dawn twice with clock board, about 3.4 s; Št → Pi about 2.2 s; So → Št backwards | PASS | Duration `900 + 1250·|Δh|/24` (logic-daynight.js:40): 48 h gives 3.4 s, 24 h gives 2.15 s |
| 1b | Highlight at once, figures change at midnight of the last night passed | PASS | Listed; matches T-111 review |
| 1c | Rapid taps continue smoothly | PASS | Listed |
| 1d | Readability, room/window/door glow, fireflies, no bird at night | PASS | Listed; `fireflies` in app-daynight.js and logic-daynight.js exist |
| 1e | Multiply blend on iPhone Safari, fallback noted | PASS | Listed with fallback to opacity |
| 1f | Page load, „Kto si?“ and SSE switch without time-lapse; SSE during animation does not show new night early | PASS | Listed |
| 1g | Reduced motion: instant, no clock board, fireflies still | PASS | Listed; `prefersReducedMotion` gate in app-daynight.js:158 |
| 1h | Clock board hides about 0.9 s after end, not at rest; taps work at night | PASS | Listed; `setTimeout(..., 900)` at app-daynight.js:195 |
| 1i | Open-decision defaults mentioned in the item | PASS | Speed, swap moment, dimming, fireflies, sounds, board |
| 2 | CLAUDE.md bullet names logic-daynight.js / app-daynight.js, only signpost and HUD taps animate, light layer under boards | PASS | Only app-draw.js:324 (signpost) and app-hud.js:62 (HUD night row) pass `animate: true`; dnBuild inserts the light layer before `boards` (app-scene.js:137) |
| 3 | README unchanged unless it lists static/js files | PASS | README lists only the `static/js/` directory (line 15); unchanged |
| 4 | No code changes; node and pytest pass | PASS | Diff limited to CLAUDE.md, tests/manual.md, task file moves; both suites green |

Extra checks: the HUD sign text „Ťukni sem ›“ (logic-model.js:383) and „Ťuknutím zvolíš túto noc.“ exist, so the CLAUDE.md wording holds. No server was started (no backend behaviour touched). Nothing committed.

Failures: none.

Manual items (already in tests/manual.md section 11): all device checks (iPhone Safari, Android Chrome, two devices, reduced motion settings) remain for a human.
