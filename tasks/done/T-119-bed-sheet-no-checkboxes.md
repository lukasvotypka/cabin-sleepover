# T-119: Bed sheet without checkbox-like squares; a free place takes you there

- **Phase:** 1
- **Depends on:** none
- **Size:** S

## Goal
Organizer report of 26. 10. 2026: in the bed sheet the empty square next to „Miesto 1: voľné“ looks like an
unchecked checkbox (and the filled ones like checked ones), so people keep tapping it. Organizer chose both fixes
(„A+B“): no squares at all, and a free place in the shown night becomes a real button that writes my party on
exactly that place. Proposal section „Ťuknutie na posteľ“, item „Miesta po nociach“.

## Scope
- `static/js/app-sheet.js` (slot rows, `figureIcon`), `static/js/app-actions.js` (`assignHere` with `only` slots)
- `static/js/logic-beds.js` (`freeSlotTakes`, `takeSlotTexts`)
- `static/index.html` (slot row CSS, dark-mode rule), `tests/js/logic.test.mjs`, `tests/manual.md` (section 4)

## Acceptance criteria
- [ ] No `.swatch` in the slot rows of the bed sheet, and no CSS for `.slot-row .swatch` remains.
- [ ] Occupied row: a 15 × 18 px pixel figure like `drawFigure` (party colour, shirt letter, smaller for kids; unknown
      party in `COLORS.mat`, no letter) and the name in bold. Free row: dashed pill „voľné“ (+ „tesné“ on a tight slot).
      „Miesto N“ is a muted label on the left, absent for one-slot beds. The full row text stays for screen readers.
- [ ] A free row is an outlined (`secondary`) button „Ľahnúť si sem“ with the party name in quotes exactly when
      `freeSlotTakes(state, myParty, night, app.night, canWrite)` is true: shown night only, writing allowed, and my
      party present that night and still missing a place, or no party chosen (then the tap opens „Kto si?“).
      Otherwise only the pill. Touch target ≥ 44 px.
- [ ] One tap calls `assignHere(bed, false, [slot])`: `/api/assign` with that single slot for the shown night, the
      optimistic figure and the walk from the meadow as with the big button; a slot taken meanwhile is skipped and the
      server error rolls back as before. The big „Zapísať …“ button and „celý pobyt“ are unchanged.
- [ ] Button `aria-label` from `takeSlotTexts` names the place and the party (+ „Tesné miesto.“ on a tight slot).
- [ ] Node tests: `freeSlotTakes` (other night, locked, no party, enough places, half placed, not present, day-only),
      `takeSlotTexts`, and source checks that the squares are gone and the row button assigns the one slot.
- [ ] Light and dark mode readable on a 390 px phone; all UI text Slovak and informal; text from people via
      `textContent` only.
- [ ] `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
Already implemented by the orchestrator on branch `ui/beds-readable` in commit `13dbe37` (see `git show 13dbe37`);
the proposal text is uncommitted in the working tree. The branch also holds unrelated UI commits (beds art, „+“,
zoom tags, z-z-z, crickets, room signs) that are not part of this task.

---
## Dev log
- 26. 10. 2026 (orchestrator): implemented in `13dbe37`. `freeSlotTakes`/`takeSlotTexts` in `logic-beds.js`,
  `figureIcon` and the new `slotRow` in `app-sheet.js`, `assignHere(bed, stay, only)` in `app-actions.js`, CSS in
  `index.html`, 3 Node tests, one item in `tests/manual.md` §4. Checked in headless Chrome on port 8031 (copy of the
  trial data): light/dark screenshots `/tmp/beds-ui/sheet-light.png`, `/tmp/beds-ui/sheet-dark.png` (taken before the
  button became `secondary`); a tap on `take-left-double-1` wrote `p-83te66` to that slot on Thu.
  Tests: `node --test tests/js/` 373 pass, `uv run pytest -q` 740 pass.

- 26. 10. 2026 (orchestrator, after review round 1 suggestion): screen readers hear „tesné“ once in both cases: added
  „, tesné“ to the hidden row text of a free tight place, and hid the visible „tesné“ next to the button (its
  `aria-label` already says „Tesné miesto.“). Uncommitted in `static/js/app-sheet.js`.

## Review round 1
Reviewed `13dbe37` (static/index.html, app-sheet.js, app-actions.js, logic-beds.js, tests) and the uncommitted
proposal item. Ran `node --test tests/js/` (373 pass) and `uv run pytest -q` (740 pass). All `static/js/*.js` are
listed in `index.html` with `?v=__ASSET_VERSION__` (no new script).

All acceptance criteria are met: no `.slot-row .swatch` markup or CSS (dark rule trimmed too); `figureIcon` matches
`drawFigure` geometry (kid shirt/head offset by 3 rows, `shirtOrigin` consistent), unknown party in `COLORS.mat`
without letter; free row is a pill or a `secondary` button gated by the pure `freeSlotTakes`; `assignHere(bed, false,
[slot])` filters against the pending view state so a slot taken meanwhile is skipped, server rollback and walk
cancel unchanged; min-height 44 px; names only via `textContent`/`htmlEl`; Slovak informal text with „ “. No server
change, so validation stays in `validate.py`.

**Blocker:** none.

**Suggestion**
- `static/js/app-sheet.js` slotRow, plain free row: the „tesné“ span is now `aria-hidden` and `rowText` does not
  include it, so screen readers lose the tight hint that the old visible „(tesné)“ gave. Add „, tesné“ to the
  sr-only `rowText` when `tight`. Conversely, on the button row the visible „tesné“ span is not `aria-hidden`
  although the button label already says „Tesné miesto.“ (read twice).

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
- 26. 10. 2026 (tester, Haiku 5.5). Test report:

**Commands run**
- `node --test tests/js/` → 373 pass, 0 fail (run on the working tree with the uncommitted `app-sheet.js` change).
- `uv run pytest -q` → 740 passed.
- Temp server: `GROUP_CODE=testgroup ADMIN_CODE=testadmin SECRET_KEY=<40 chars> uv run python -c "...create_app(data_dir='/tmp/t119/data')..." ` on `127.0.0.1:8042`, data = copy of `/tmp/beds-ui/data` (reset per run, test party created via `POST /api/parties`). Not 8000, 8010, 8031.
- Headless Chrome 390×844 @2x, mobile emulation, driven over CDP (scratch script `/tmp/t119/driver/cdp.mjs`), page loaded after the intro, reduced motion on for the scene. Light and dark (`prefers-color-scheme`) screenshots: `/tmp/t119/sheet-light.png`, `/tmp/t119/sheet-dark.png`, `/tmp/t119/sheet-occupied.png`.

**Browser checks (all as expected)**
- Panel rows: 0 `.swatch` in any slot row; no `.slot-row .swatch` rule in loaded stylesheets. Occupied rows have one 15×18 `svg.fig`, the name bold, `Miesto N` label. Free rows: dashed pill „voľné“, „tesné“ on the tight place. Plain row sr-only text `Miesto 2: voľné, tesné`.
- Take button on shown night only: „Ľahnúť si sem“ + „„Test Tester““, height 44 px, `aria-label` „Miesto 2, voľné. Ľahnúť si sem: zapíše „Test Tester“ na toto miesto. Tesné miesto.“. Other night (same bed, party present): pill only. Party not present that night (Lukas): no take button. No party chosen: take button without a name; tap opens „Kto si?“.
- One tap on the take button wrote exactly one slot (`hallway-sofa-2` / `kitchen-stove-2` depending on run) for the shown night; other nights and other slots unchanged. Big „Zapísať … na celý pobyt“ button still present.
- No horizontal overflow: `scrollWidth` 390 / 390 in light and dark.
- No page errors captured.

**API checks**
- `POST /api/assign` on a taken slot → 409 `slot_taken` with params (`slot`, `night`, `party_name`, `own`). Unknown slot → 404 `unknown_slot`.

**Acceptance criteria**

| # | Criterion | Result |
|---|---|---|
| 1 | No `.swatch` in slot rows, no `.slot-row .swatch` CSS | PASS |
| 2 | Occupied figure 15×18 with letter and bold name; free dashed pill (+ „tesné“); muted „Miesto N“, absent for one-slot beds; full sr text | PASS (one-slot absence read from code, `bed.slots.length > 1`; not rendered in the browser) |
| 3 | Outlined „Ľahnúť si sem“ with name exactly when `freeSlotTakes` true; otherwise pill; ≥ 44 px | PASS |
| 4 | One tap → `assignHere(bed,false,[slot])`, one slot for the shown night; walk and rollback | PARTIAL: single-slot write PASS; walk and rollback need a human (reduced motion was on, and a race with a slot taken meanwhile is not simulated) |
| 5 | `aria-label` from `takeSlotTexts`, „Tesné miesto.“ on tight | PASS |
| 6 | Node tests for `freeSlotTakes`, `takeSlotTexts`, source checks | PASS (373 pass, existing tests) |
| 7 | Light and dark readable at 390 px, Slovak, textContent | PASS for layout and language (screenshots, no overflow); visual judgement on a real phone stays in `tests/manual.md` §4 |
| 8 | `node --test tests/js/` and `uv run pytest -q` pass | PASS |

**Regressions**: the full pytest and Node suites cover the tasks in `tasks/done/`; both pass.

**Extra scenarios**: single-slot write to a taken slot (409), unknown slot (404), a second night with the same bed, party absent, no party, dark/light, 390 px overflow.

**Bugs**: none found.

**Manual (already in `tests/manual.md` §4, line 58)**: walk animation and rollback on iPhone Safari and Android Chrome, a slot taken by another phone meanwhile, VoiceOver/TalkBack reading the row and button. No new item needed.

**Notes**: the uncommitted `tesné` change (`aria-hidden` on the button row, „, tesné“ in the sr text of plain rows) is verified in the browser (sr text and button label) but has no Node test. This is a small gap; I did not add a test.

Result: PASS → moved to `tasks/done/`. No commit made.
