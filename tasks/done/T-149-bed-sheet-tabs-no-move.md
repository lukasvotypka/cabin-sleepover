# T-149: Bed sheet with night tabs, release for the whole stay, no move mode

- **Phase:** 1
- **Depends on:** T-148
- **Size:** M
- **UX:** yes

## Goal
The organizer finds the bed sheet long and repetitive (three stacked night sections, „Ľahnúť si sem „Meno““ repeated on every free place, the main button below the fold) and wants the „Presunúť“ feature gone: moving is „Uvoľniť“ and a tap on the new place (organizer's request of 27. 10. 2026). Proposal sections „Mapa“ (bed panel) and „HTTP API“.

## Scope
- `static/js/app-sheet.js`, `static/js/logic-beds.js`, `static/index.html` (sheet CSS, move bar removed), `static/js/app-actions.js`.
- Move mode removal everywhere: `app-core.js` (`app.move`, line ~312), `app-start.js` (move bar listeners, Escape handler), `app-draw.js` (`renderMoveBar` calls), `app-zoom.js` (intro check, move bar inset in `readInsets`, the `moveBar` observer), `app-tophud.js`, `app-daynight.js` (`over()`), `app-turn.js`, `app-houses.js` (`app.move` opens all houses), `app-beds.js` (`lift`), `logic-iso-people.js` + `app-iso-people.js` (`ISO_PEOPLE.lift`, `liftMs`, `isoLiftOffset`), `app-boot.js`, `app-login.js`, `app-scene.js`, `app-summary.js`, comments in `app-panels.js`, `logic-iso-roof.js`; CSS selectors with `#moveBar` / `.movebar` in `index.html` (lines ~82, 240, 297, 430–434, markup 768–775).
- `app/models.py` (`ClearRequest.nights`), `app/main.py` (`/api/clear`), `app/validate.py` if needed; tests in `tests/` and `tests/js/logic.test.mjs`; `tests/manual.md` (lines ~60–61); `proposal.md` (bed panel bullets, API table row of `/api/clear`, the move acceptance line) and the move-mode sentences in `CLAUDE.md`.

## Acceptance criteria
- [x] No „Presunúť“ button, no move bar, no `app.move`, `startMove`, `cancelMove`, `moveTo`, `planMove`, `moveTarget`, `moveBarText`, `MOVE_TEXTS`, `isoLiftOffset` left in `static/`; a tap on a bed always opens the sheet; Escape on the map does nothing special.
- [x] Houses open only by tap, zoom, Tab focus and a pending write (the move-mode rule is gone); the top HUD and turn buttons no longer depend on a move bar.
- [x] `/api/move` and `check_move` stay on the server unchanged (default, see Notes); the page never calls them.
- [x] `POST /api/clear` accepts an optional `nights` list (1–3 unique event nights, instead of `night`; exactly one of the two): all slots released under one lock, one audit entry with `changes`, `guard_party` per holder, all-or-nothing on unknown slot/night; nights where the slot is already free are skipped without error. Pytest covers it.
- [x] Sheet shows night tabs and only the selected night's places, as in Design; tapping a tab calls `selectNight` (map and HUD follow). (design)
- [x] Releasing my own place held in 2+ nights asks „celý pobyt / len …“; one night releases at once; someone else's place keeps the existing confirm and frees only the shown night. (design)
- [x] Node tests for the new pure helpers (tab dots, release texts and nights); old move tests removed; `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Keep `holdingNights` (now feeds the release choice; update its comment).
- `/api/move` stays because removing it touches models, validate, store and six test files for no user gain; the organizer can ask to delete it later.
- „Ľahnúť si sem“ keeps the whole-stay logic of e9939d5 (`takeSlotNights`), only its look changes.

## Design
Prototype: `design/bed-sheet/index.html` (scenarios, light/dark, error and reduced-motion toggles). Decided: `/api/move` stays on the server unused (organizer approved 27. 10. 2026).

**Layout, top to bottom (phone ~380 px bottom sheet; desktop the same content in the existing centred window, max 440 px wide):**
1. Title = bed name, sub line = `room.name · N miesta` (+ „, 1 tesné“ when the bed has tight slots).
2. **Night tabs** (`.bed-nights`, role `tablist` look, real `button`s with `aria-pressed`): three equal cells, 52 px tall, label „Št → Pi“ (bold 15 px) and under it one 8×8 px square per slot: party colour filled, my party's with a 2 px amber (`--amber`) outline, free = 1 px dashed `--muted` outline; `crispEdges` look (plain divs, no radius). Selected = `app.night`: `--surface2` background, 3 px `--moss` bottom border. Tab = `selectNight(night)`; the sheet refills. Replaces the three stacked `section.night` blocks (sheet ~430 px instead of ~1100 px).
3. **Status line** (14 px, `--muted`, only with a party chosen and present): „V piatok vám chýbajú 2 miesta.“ / „V piatok máte všetko.“ / existing `notPresentNote`. Replaces the repeated party name.
4. **Place rows of the selected night only**, 48 px min height: „Miesto 1“ quiet label (64 px), then
   - taken: figure icon + bold name, right-aligned **Uvoľniť** (secondary, 44 px tall) when allowed, or the `login_required` note;
   - free + I can take it: the whole rest of the row is one dashed-outline button „+ Ľahnúť si sem“ (no party name; `aria-label` keeps name, place and „na celý pobyt“), with „na celý pobyt“ as `small` second line when `takeSlotNights` > 1; „tesné“ stays as a tag;
   - free otherwise: the „voľné“ tag as now.
5. **Actions** as now (main „Zapísať „X“ na celý pobyt“ + sub line, „Len na piatok“, notes, „Upraviť príchod a odchod“, „Som niekto iný“); hide the main block when it would take exactly the one place a row button already offers (party misses 1 place) to avoid two identical choices.

**Release (replaces move):** my place held only this night → frees at once (as now). Held in 2+ nights → the row turns into: „Uvoľniť toto miesto?“ + **„Celý pobyt (3 noci)“** (primary, calls `/api/clear` with `nights` = `holdingNights`) + **„Len v piatok“** (secondary) + **„Nie“** (link-style). Focus goes to „Celý pobyt“. After it the row shows „+ Ľahnúť si sem“ and a toast „Uvoľnené. Ťukni na nové miesto na mape.“ (info, 3 s) so people know how to move now. Someone else's place: unchanged confirm, shown night only.

**States:** pending write = rows semi-transparent with „ukladám…“ in the status line, buttons disabled; error = existing toast + rollback, the sheet stays open; locked = `LOCKED_TEXTS.note` under the rows, no buttons; no party chosen = status line hidden, row buttons open „Kto si?“.

**Feel:** tab press = 2-frame `steps(2)` 1 px down-shift (80 ms); a freed row's figure icon blinks out in `steps(3)` over 180 ms before the dashed button appears; the tab's square changes at once. With `prefers-reduced-motion` none of it. Dark mode uses the existing panel variables only.

**Do not:** add drag-and-drop, a „move“ shortcut in the release toast, multi-night release of other parties' places, or new colours; do not change the map's tap behaviour beyond dropping move mode; class names must not start with `ad-`, `adv-`, `banner`, `sponsor`.

---
## Dev log
- Backend: `ClearRequest` takes exactly one of `night` / `nights` (model validator, `night_list`); `validate.check_clear_nights` returns `{night: holder}` for held nights (all-or-nothing on unknown night/slot, free nights skipped); `/api/clear` releases all under one lock, `guard_party` per holder, one audit entry with `changes`; no write when all free. `/api/move` and `check_move` untouched.
- Page: move mode removed everywhere (see scope list; a Node test greps `static/` for the old names). Sheet rewritten in `app-sheet.js`: night tabs (`nightTabDots`, `nightTabLabel`), sub line (`bedSubLine`), status line (`sheetStatusLine`), only the shown night's rows, dashed „+ Ľahnúť si sem“ (small „na celý pobyt“), release choice (`releaseChoice`, `RELEASE_TEXTS`: „Celý pobyt (N noci)“ / „Len v piatok“ / „Nie“), main block hidden by `showMainAssign`. `clearSlot(slot, nights, mine)` keeps the sheet open, toast 3 s (`RELEASE_TOAST_MS`, `showToast` got an optional `ms`). CSS in `index.html` (tabs, rows, confirm box, steps(2) tab press, steps(3) figure blink, reduced motion).
- Deviation: the design status texts „vám chýbajú“ / „máte všetko“ are plural 2nd person and break the project's tykanie guard test, so they are „V piatok ti chýbajú 2 miesta.“ / „V piatok máš všetko.“. Not browser-tested by me (no visual check done); logic and source guards covered by tests.
- Left as is: `check_clear` (single night) still exists for its tests; `design/bed-sheet/` untouched.
- Docs: `proposal.md` (bed panel bullets, API rows, acceptance line, intro-zoom sentence), `CLAUDE.md` (move-mode sentences), `tests/manual.md` (release and move item).
- Commands: `uv run pytest` -> 746 passed; `node --test tests/js/` -> 469 passed, 0 failed.

## Review round 1

Reviewed the task-scope diff (backend clear, sheet, logic-beds, actions, move-mode removal in the listed files, CSS/markup, docs). Ran `uv run pytest` -> 746 passed; `node --test tests/js/` -> 469 passed, 0 failed. No old move names left in `static/js` or `index.html`; every `static/js/*.js` is listed in `index.html` with `?v=__ASSET_VERSION__`.

- Backend: `ClearRequest` exactly-one validator plus `NightList` (non-empty, unique) give 422 for all four bad bodies. `check_clear_nights` checks every night and the slot before it reads anything (all-or-nothing). `/api/clear` runs `guard_party` once per distinct holder before any write, releases under one tx, writes one audit entry with `changes`, and skips the write when nothing is held. `/api/move` and `check_move` are untouched. Order is lock -> validate -> write -> audit, as before.
- Page: the tabs call `selectNight` (map, HUD and panel refresh follow). Only the shown night's rows appear. The release choice comes from `holdingNights` on the view state. The focus goes to „Celý pobyt“. Someone else's place keeps the confirm and frees the shown night only. The toast lasts 3 s and shows only on success. The status line uses tykanie (a documented deviation from the design wording, needed by the guard test). Reduced motion turns off both animations. All text goes in through `textContent`/`htmlEl`.

No blockers.

- **Suggestion:** `app-sheet.js` `slotActions`: the „Nie“ link button is built outside `button()`, so it stays enabled while `busy`. It does no harm (it only drops the question), but for consistency it could be disabled too.
- **Nit:** `static/index.html:428` `.seg .btn + .btn` is dead CSS. It belonged to the move bar's segmented control, and `.seg` is now only the rail segment.

Verdict: APPROVED (round 2 skipped, no blockers)

**Tester, 27. 10. 2026 (Haiku 5.5):** PASS. No regressions. Moved to `done/`.

Commands and results:
- `uv run pytest -q` → 746 passed (14.7 s).
- `node --test tests/js/` → 469 passed, 0 failed.
- Temporary server on `127.0.0.1:8137` with its own `/tmp/t149/data` and test secrets (not the real `data/` or `.env`). Exposed as `https://lukass-laptop-1.tail3bf463.ts.net:8445/` (tailnet only, still running).
- Browser: headless Google Chrome over DevTools, viewport 390×844 mobile. The preview tool's tab hung on the page, so I used the DevTools route.

| # | Criterion | Result | How |
|---|---|---|---|
| 1 | No move names, no move bar in `static/`; bed tap opens sheet | PASS | grep of `static/index.html` and `static/js` (vendored three.js excluded): zero hits. Tap on a bed opened the sheet. |
| 2 | Houses open only by tap, zoom, Tab, pending write | PASS (code) | No `app.move` left. Not exercised on the page. |
| 3 | `/api/move` and `check_move` unchanged; page never calls them | PASS | Page has no `api/move` call. `/api/move` answers 422 on an empty body. Existing move tests still pass. |
| 4 | `POST /api/clear` with `nights` | PASS | See API probe below. |
| 5 | Sheet shows night tabs and only the selected night's places (design) | PASS | Screenshot 1: three tabs with slot squares, status line, one row per place. |
| 6 | Release of my multi-night place asks „celý pobyt / len …“ (design) | PASS | Screenshot 2: „Uvoľniť toto miesto?“ with „Celý pobyt (3 noci)“, „Len vo štvrtok“, „Nie“. Focus on the first button. |
| 7 | Node tests for the new helpers; old move tests removed; both suites pass | PASS | 469 Node and 746 pytest pass. Helper names found in `tests/js/logic.test.mjs`. |

API probe on the temporary server (`/api/clear`):
- Both `night` and `nights`, neither, empty list, duplicate nights, extra field: all 422 `invalid`.
- Unknown slot: 404 `unknown_slot`, and no version bump.
- Unknown night in the list (`2026-11-09`): 422 `night_outside_event`, and the held night stayed held (all-or-nothing).
- `nights` = 3 nights with one free: 200, released where held, version bumped once.
- All nights already free: 200, no write (version unchanged).
- Whole-stay release by the group: 200, all nights freed.
- Single `night` still works (backwards compatible).
- Audit: one `clear` entry per write with `changes` (2 and 3 entries seen).

Visual check at 390 px (screenshots):
- `/tmp/t149/probe-sheet-raw.png`: sheet after the slide-in, my place and one other party's place (Thu row), tabs and actions.
- `/tmp/t149/t149-release-choice.png`: release choice on my multi-night place.
- `/tmp/t149/t149-free-place.png`: free bed, dashed „+ Ľahnúť si sem“ with „na celý pobyt“.

No layout problems seen at 390 px. Nothing overlaps or is cut off, and touch sizes were judged by eye, not measured.

Not verified (needs a real device, listed in `tests/manual.md`):
- Slide-in and tab press animation feel, and reduced motion.
- Dark mode.
- iPhone Safari and Android Chrome.

Non-blocking notes for the developer:
- `tests/manual.md` still has older move-mode items that now describe removed features: the „Presunúť“ items around lines 96, 191, 219, 260, 288 and 300. These are stale checklist text, not a failing criterion. They should be cleaned up.
- The „Nie“ link stays enabled while a write is pending (the reviewer already noted this).

Cleanup: no repo files changed by me. The temporary server stays up on port 8137 for the organizer's preview. Chrome was stopped.
