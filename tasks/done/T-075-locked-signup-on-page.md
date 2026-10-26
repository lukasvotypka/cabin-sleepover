# T-075: Page: „Zápis je zatvorený“ sign and view-only map

- **Phase:** 2 (split from T-009)
- **Depends on:** T-073, T-074
- **Size:** M

## Goal
When `signup_open` is false everyone sees that signup is closed and non-admins can only look. Proposal section „Informácie v scéne“ (Zamknutý zápis).

## Scope
- `static/js/app-scene.js` or `app-draw.js` (sign), `static/js/app-sheet.js` (bed sheet), `static/js/app-form.js`, the HUD status panel, a pure `canWrite(state, role)` in a `logic-*.js`, `tests/js/logic.test.mjs`, `tests/manual.md`

## Acceptance criteria
- [x] Pure `canWrite(state, role)`: true when `signup_open` or admin; Node tests for all four cases.
- [x] With signup closed, a pixel sign „Zápis je zatvorený“ is drawn in `map.scene.locked` (position from config, not code) for everyone, admin included, and the screen-reader summary says it.
- [x] Non-admins: the bed sheet shows occupancy only, no write buttons; the party form opens read-only with the note „Zápis je zatvorený, zmeny už nejdú uložiť.“; the HUD buttons that change places („… nás viac nebude“ and similar) are hidden; move mode cannot start. Briefing and food notes still work.
- [x] Admin: everything works as with open signup.
- [x] Opening or closing signup elsewhere applies live (SSE state) without reload.
- [x] `tests/manual.md`: „Keď je zápis zamknutý, je vidieť ceduľu „Zápis je zatvorený“ a postele sa dajú len prezerať.“ `node --test tests/js/` passes.

---
## Dev log
Added pure `canWrite(state, role)` + `LOCKED_TEXTS` (logic-errors.js). Sign `drawLocked` in app-draw.js at `map.scene.locked` (drawn for everyone when `signup_open === false`; screen-reader line added in `renderSummary`). Bed sheet (app-sheet.js): no slot actions or assign buttons, note instead. Party form (app-form.js): fields disabled, save hidden, note, "Zavrieť". HUD quest rows "places"/"undo" become plain text (app-hud.js). `startMove` refuses and an active move mode is dropped when locked (app-actions.js). Live updates work because every state apply re-renders the boards, HUD and open panels. Tests: `canWrite` in tests/js/logic.test.mjs; manual item in tests/manual.md.
Not browser-checked (no browser run); verified by Node tests only. Criteria ticked on code reading.
Run: `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` (pass), `uv run pytest -q` (631 passed).

## Review round 1
Ran `node --test tests/js/` (339 pass) and `uv run pytest -q` (631 pass). No new scripts, so `index.html` needs no change.

No blockers. Checked:
- `canWrite` is pure, sits in `logic-errors.js` next to `isAdmin`, and the test covers all four cases plus a missing `signup_open`.
- The sign is drawn for every role when `signup_open === false`, at `map.scene.locked`, which is already in `config/cabin.yaml` and the `Scene` model. It fits on the grass between Konica and the legend. Its aria-label and the line in the screen-reader summary come from `LOCKED_TEXTS`.
- Bed sheet: for non-admins, no slot actions and no assign buttons, plus the note. Party form: fields disabled, save hidden, the note shown, and "Zavrieť". The quest rows "places" and "undo" become plain text. `startMove` returns early, and an active move is dropped in `renderMoveBar`. Briefing and food are left alone, which matches the server (no `check_signup_open` there). Admins pass `canWrite` everywhere.
- Live updates: the boards, HUD and open panels re-render whenever a state is applied. The server still enforces `signup_closed` on every write.

**Suggestion**
- `static/js/app-sheet.js` ~150, the „Pridať sa“ button in „Kto si?“: when signup is locked, a non-admin gets an empty, disabled form. Hide the button, or show the note in its place.
- A places or undo panel that was already open when signup got locked keeps its write button. The server rejects the tap with `signup_closed` and the page shows the Slovak toast, so this is acceptable. Re-checking `canWrite` in `sendPlaces` would make it tidier.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2
(reviewer appends)

## Test report

**Result: FAIL** (criterion 3, one path where a place-changing button stays visible while signup is locked). Moved back to `in-progress`.

### Commands and results
- `cd /Users/luigi/.t3/worktrees/chrapa-poll/t3-888383ee && uv run pytest -q` → 631 passed.
- `node --test tests/js/` → 339 pass, 0 fail.
- Temporary API probe (`uv run python -I` script, `create_app` with a temp `data_dir`, separate group and admin clients, base URL `https://` for the Secure cookie; script deleted afterwards):
  - Group member, signup open: party created (200).
  - Group member locks signup → 403 (`forbidden`, as specified). Admin locks → 200; `/api/state` then has `signup_open: false`.
  - While locked, group member: `assign` 403 `signup_closed`; `places` 403 `signup_closed`; `move` 403 `signup_closed`; `clear` 403 `signup_closed`; `food` 200 (still allowed, as specified).
  - Admin while locked: `assign` 200. Admin reopens → 200.

### Criteria
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Pure `canWrite`, Node tests for four cases | PASS | `logic-errors.js:56`; test at `tests/js/logic.test.mjs` passes |
| 2 | Sign „Zápis je zatvorený“ at `map.scene.locked` for everyone, summary line | PASS (code and config; visual check not possible here) | `app-draw.js` `drawLocked`, drawn when `signup_open === false` with no role check; `config/cabin.yaml:16` has `locked`; `renderSummary` adds `LOCKED_TEXTS.summary` |
| 3 | Non-admins: occupancy-only sheet, read-only party form with note, place-changing HUD buttons hidden, move cannot start, briefing and food still work | FAIL | See bug 1. Sheet, form, HUD quest rows and `startMove` are gated. The API confirms the server rejects `assign`, `places`, `move`, `clear` and accepts `food`. |
| 4 | Admin: everything works as with open signup | PASS | `canWrite` is true for admin; API probe: admin `assign` 200 while locked |
| 5 | Opening or closing signup applies live without reload | NOT VERIFIED (needs two devices or a browser) | Code only: every state apply re-renders boards, HUD and panels. Listed in `tests/manual.md` |
| 6 | `tests/manual.md` item present, `node --test` passes | PASS | Item at the end of the „Admin“ section (line 190); Node suite passes |

### Extra scenarios tried
- Backend lock contract for group, admin and the page-used write paths (above).
- Reviewed the page paths that reach write actions while locked: HUD quest rows (gated), bed sheet slot actions (gated), move (gated), party form (gated), meadow button (NOT gated, bug 1), „Pridať sa“ button in „Kto si?“ (visible, opens a read-only form; acceptable under criterion 3, a cosmetic gap the reviewer already noted).

### Bug report 1: place-changing button visible while signup is locked (meadow path)
- **Steps:** Signup is locked (admin uses „Zamknúť zápis“). Log in as a group member whose party is waiting on the meadow (no slots yet, or fewer places than needed). Tap the meadow button in the scene.
- **Expected:** No button that changes places is offered to a non-admin. Per the criterion, the places panel either hides its send button or shows only the read-only note.
- **Actual:** `static/js/app-beds.js:96` calls `openPlacesPanel(app.night)` with no `canWrite` check. In `static/js/app-actions.js` `openPlacesPanel`, when the info kind is `fewer`, the primary button calls `sendPlaces`. The panel shows it, and the tap sends `POST api/places`, which the server rejects with `signup_closed`, so the user sees an error toast. The HUD rows are gated, but this path is not.
- **Suggested fix (for the developer):** in `openPlacesPanel`, when `!canWrite(st, app.role)`, do not render the send button (show `LOCKED_TEXTS.note` instead), or return early for non-admins. Add a Node source-level test like the other `app-*` source checks.

### Failure summary
- Criterion 3 fails on bug 1 above. Criterion 5 remains to be checked manually.


## Dev log, fix round (test bug 1 and review suggestions)
- Bug 1 fixed: `openPlacesPanel` and `openPlacesUndoPanel` (app-actions.js) now show `LOCKED_TEXTS.note` and omit the primary (send) button when `!canWrite`; the meadow path therefore no longer offers a write. `sendPlaces` also re-checks `canWrite`, so a panel opened before the lock cannot send.
- Reviewer suggestion fixed: in „Kto si?“ (app-sheet.js) „Pridať sa“ is replaced by the note when locked for a non-admin.
- Test: source-level test in tests/js/logic.test.mjs. `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` (340 pass), `uv run pytest -q` (631 pass). Not browser-checked.

## Review re-check
Scope: the fix round for test bug 1 and the round-1 suggestion. Ran `node --test tests/js/` (340 pass) and `uv run pytest -q` (631 pass).

- Bug 1 is fixed. `openPlacesPanel` and `openPlacesUndoPanel` (`static/js/app-actions.js`) leave out the primary button and show `LOCKED_TEXTS.note` when `!canWrite`. `sendPlaces` checks again, so a panel opened before the lock cannot send. Every caller (the meadow button in `app-beds.js:96` and the HUD rows in `app-hud.js:60-61`) goes through these panels.
- The „Pridať sa“ button in „Kto si?“ is replaced by the note for a locked non-admin.
- The new source-level test covers the three functions and `openWho`.

No blockers.

**Nit**
- The new notes use `class="locked-note"`, and no CSS rule exists for it. The bed sheet and the form use `.note`, which has the amber style. The text still shows as a plain paragraph. Use `note` for a consistent look.

Verdict: APPROVED

### Re-test after the fix round (tester)

**Result: PASS.** Moved to `done/`. Bug 1 is fixed and no regressions were found.

Commands (run from the worktree, `PATH=/opt/homebrew/bin:$PATH`):
- `uv run pytest -q` → 631 passed. No `.py` or `config/` file changed since the last run, so the backend contract from the earlier probe still holds (no server probe repeated).
- `node --test tests/js/` → 340 pass, 0 fail (includes the four `canWrite` cases and the new source-level gate test for `openPlacesPanel`, `openPlacesUndoPanel`, `sendPlaces`, `openWho`).

Checked in code (the page was not run in a browser):
- Every place-changing write in `static/js/` is gated. Writes are `api/places` (`sendPlaces`, re-checks `canWrite`), `api/parties` POST/PUT (form disabled, save hidden), `api/food` and `api/briefing` (left open, as specified). Assign, clear and move are reached only through `slotActions` (sheet), `addActions` (sheet, "Pridať sa" replaced by the note), `startMove` (refuses) and `renderMoveBar` (drops an active move when locked). The HUD rows „places“ and „undo“ become plain text. The meadow path (`app-beds.js:96`) now opens a panel with the note and no send button.
- `drawLocked` has no role check. It is drawn when `signup_open === false` at `map.scene.locked` (`config/cabin.yaml:16`). The screen-reader line is in `renderSummary`.
- The `.note` class used in the new panels is styled by `.sheet .note` (index.html:196), and every panel uses `.sheet`, so the nit from the re-check (`locked-note` without CSS) is fixed.

Criteria:
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Pure `canWrite`, Node tests for four cases | PASS | `logic-errors.js:56`, test passes |
| 2 | Sign at `map.scene.locked` for everyone, summary says it | PASS (code; visual check manual) | `drawLocked`, `renderSummary`, config:16 |
| 3 | Non-admin read-only: sheet, form note, HUD place buttons hidden, move blocked, briefing and food work | PASS (code and Node source tests) | bug 1 fixed; all paths above gated |
| 4 | Admin: everything as with open signup | PASS | `canWrite` true for admin; API probe in earlier round: admin assign 200 while locked |
| 5 | Opening or closing signup applies live without reload | PASS by code, live check manual | every state apply re-renders boards, HUD, open panels; listed in `tests/manual.md` (two devices) |
| 6 | `tests/manual.md` item, `node --test` passes | PASS | item present in „Admin“ section; Node 340/340 |

Extra scenarios: the meadow path while locked (code path, fixed); a panel opened before the lock cannot send (`sendPlaces` re-check); „Pridať sa“ in „Kto si?“ under lock (note instead of an empty form).

Not verified here, for the manual checklist: real browser rendering of the sign and its position on the grass, two devices seeing the lock change live, iPhone Safari and Android Chrome. These are covered by the `tests/manual.md` item.
Tester added no tests and changed no application code.
