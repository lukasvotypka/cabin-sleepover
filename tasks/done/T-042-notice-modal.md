# T-042: „Návod“ as a centred window opened from the „?“ icon

- **Phase:** 1
- **Depends on:** none
- **Size:** M

## Goal
Organizer's decision of 24. 10. 2026 (scene redesign, item 2): the noticeboard is no longer drawn in the scene. The „?“ icon stays in the scene as a button and opens „Návod“ as a modal floating in the centre of the screen. The party table under the signposts is then always shown (proposal "Informácie v scéne", Nástenka and Tabuľka partií).

## Scope
- `config/cabin.yaml` (`map.scene.notice` becomes the 44×44 icon rect), `tests/test_models.py`, `tests/test_map_layout.py`
- `static/js/app-draw.js` (`drawNotice`, `drawBoards`), `static/js/app-scene.js`, `static/js/app-core.js`, `static/js/app-actions.js` (`onBedTap`), `static/js/app-panels.js` (centred variant), `static/js/logic-model.js`
- `static/index.html` (CSS of the centred window), `tests/js/logic.test.mjs`, `tests/manual.md`

## Acceptance criteria
- [x] `map.scene.notice` is `[328, 112, 44, 44]` (the spot of today's collapsed „?“). The scene draws only the „?“ icon there (same look as today's collapsed icon), `role="button"`, `tabindex="0"`, `aria-label` „Návod. Ťuknutím ho otvoríš.“, hit area = the whole rect.
- [x] Tap, Enter or Space on „?“ opens a dialog titled „Návod“ with the four `NOTICE_LINES` unchanged, one paragraph each, set via `textContent`. It is centred horizontally and vertically (not a bottom sheet), max width about 360 px, with backdrop, the „Zavrieť“ ✕ button, Esc, Tab focus trap, and focus returns to the „?“ button (`returnKey: "notice"`). Backdrop tap closes it.
- [x] Opening uses no transform/slide animation under `prefers-reduced-motion`. Colours follow the panel light/dark variables like other panels.
- [x] The collapse state is gone: no `app.noticeCollapsed`, `KEYS.notice`, `collapseNotice`, `expandNotice`, `noticeIconRect`, `noticeLayout`, and `onBedTap` no longer touches the notice. `grep -rn "noticeCollapsed\|collapseNotice\|expandNotice\|noticeIconRect\|noticeLayout" static tests` prints nothing.
- [x] `drawPartyTable` runs on every `drawBoards`, in `map.scene.parties` (unchanged `[176, 112, 148, 82]`).
- [x] `test_scene_boards_stay_clear_of_rooms_and_each_other` no longer has the `notice`/`parties` exception and passes. `test_models.py` uses the new `notice` rect.
- [x] Node tests about the removed notice functions are deleted; a new Node test checks `NOTICE_LINES` is still the four Slovak steps. The hidden screen-reader summary still lists the instructions.
- [x] `uv run pytest` and `node --test tests/js/` pass. `tests/manual.md` gets one item: „?“ opens a centred „Návod“, Esc and ✕ close it, focus returns to „?“ (iPhone Safari, Android Chrome, dark mode).

## Notes for developer
- Reuse `openPanel` (backdrop, Esc, focus trap, focus return) with an option such as `opts.center` that adds a class; do not build a second dialog system.
- Not opening it automatically on the first visit is the default from proposal „Otvorené rozhodnutia“ (Návod ako okno). An old `cabin.noticeCollapsed` value in `localStorage` is simply ignored.
- T-043 moves the „?“ icon to the left and widens the table; keep positions only in `cabin.yaml`.

---
## Dev log
- `map.scene.notice` is now `[328, 112, 44, 44]`. `drawNotice` draws only the „?“ icon (aria-label „Návod. Ťuknutím ho otvoríš.“), tap/Enter/Space calls new `openNotice()` (`app-scene.js`), which uses `openPanel("Návod", ..., {returnKey: "notice", center: true})` with one `<p>` per `NOTICE_LINES` entry. `openPanel` got `opts.center` (class `sheet center`); CSS in `index.html` centres it (max 360 px, fade only, no slide; global reduced-motion rule removes the transition).
- Removed `app.noticeCollapsed`, `KEYS.notice`, `collapseNotice`, `expandNotice`, `noticeIconRect`, `noticeLayout`; `onBedTap` no longer touches the notice; `drawPartyTable` runs on every `drawBoards`.
- Tests: `test_map_layout.py` lost the notice/parties exception, `test_models.py` has the new rect; Node tests of removed functions replaced by tests of the icon, `openNotice`, always-drawn table and absence of the old names (`NOTICE_LINES` test and screen-reader summary test kept). `tests/manual.md`: new item, old items about collapsing reworded.
- Commands: `export PATH=/opt/homebrew/bin:$PATH; uv run pytest` (503 passed), `node --test tests/js/` (all pass). The grep from the criteria prints nothing.
- Not verified in a real browser (no visual check of the centred window); the first poll/redraw with the panel open is handled by the existing `keepFocus`/returnKey logic.

## Review round 1
Checked the diff of all scoped files. Ran `uv run pytest` (503 passed) and `node --test tests/js/` (255 passed). The criteria grep prints nothing. Every `static/js/*.js` is listed in `index.html` with `?v=__ASSET_VERSION__`.

- Criteria 1–2: `notice` is `[328, 112, 44, 44]`. `drawNotice` draws the plank icon with „?“, `hitRect(g, r)` over the whole rect, and `makeButton` with the required label and the `notice` key. `openNotice` reuses `openPanel` with `{returnKey: "notice", center: true}`. It builds one `<p>` per `NOTICE_LINES` entry via `htmlEl` (textContent). Backdrop, ✕, Esc, the Tab trap and focus return all come from the existing `openPanel`/`closePanel`. Focus goes to ✕ first because the body has no button, which is fine.
- Criterion 3: `.sheet.center` keeps the same `translate(-50%, -50%)` in the closed and open states and fades only. The global reduced-motion rule (`* { transition: none !important }`) removes the fade. The colours come from `.sheet` (`--surface`, `--ink`).
- Criteria 4–5: all collapse state is removed, `onBedTap` is clean, and `drawPartyTable` runs on every `drawBoards`. The empty-state text „Zatiaľ tu nikto nie je.“ already exists, so an empty table is handled.
- Criteria 6–8: the exception is removed in both the Python and Node layout tests. The parties rect (ends at x=324) and the icon (starts at 328) do not overlap. The `NOTICE_LINES` test and the screen-reader `instructions` in `logic-summary.js` are kept. The manual item is added.

**Blocker:** none.

**Suggestion:** none worth a send-back. The `proposal.md` change in the working tree is outside this task's scope. Leave it out of the T-042 commit unless it belongs to this task.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester: haiku, 2026-10-24. Scope: T-042 criteria, with the T-042 changes in the working tree (other uncommitted files left alone).

### Automated suite (run once)
- `export PATH=/opt/homebrew/bin:$PATH; uv run pytest` → 503 passed, 0 failed.
- `node --test tests/js/` → 255 pass, 0 fail, 0 cancelled.
- Grep from the criteria `grep -rn "noticeCollapsed\|collapseNotice\|expandNotice\|noticeIconRect\|noticeLayout" static tests` → no output (exit 1). `KEYS.notice` is absent from `static/js/*.js`, and `onBedTap` (`app-actions.js`) has no notice reference.

### Acceptance criteria
| # | Criterion | Result |
|---|---|---|
| 1 | `notice` is `[328,112,44,44]`; scene draws only the „?“ icon; `role=button`, `tabindex=0`, exact aria-label; hit area = whole rect | PASS (bounding box at 390 px: 337,252, 45×45; hit rect matches) |
| 2 | Tap/Enter/Space opens „Návod“ with the four `NOTICE_LINES` as `<p>` each; centred, max 360 px; backdrop, ✕, Esc, Tab trap, focus returns to „?“; backdrop tap closes | PASS (sheet centre delta 0,0 at 390×780; width 358; four paragraphs match; focus to ✕ on open; Esc, ✕ and backdrop all return focus to `data-key="notice"`) |
| 3 | No transform/slide under reduced motion; panel colours | PASS by CSS (`.sheet.center` transform is identical closed/open, only opacity transitions; global `prefers-reduced-motion` rule sets `transition: none`). Colours use `var(--surface)`/`var(--ink)`, dark mode NOT seen (see unverified) |
| 4 | Collapse state removed, grep empty | PASS |
| 5 | `drawPartyTable` runs on every `drawBoards` | PASS (table visible with 0 parties, with 1 party and after a poll-driven redraw with an open panel) |
| 6 | Layout test has no notice/parties exception; `test_models.py` uses new rect | PASS (pytest green; no `notice`/`parties` exception text in `tests/test_map_layout.py`) |
| 7 | Node tests for removed functions gone; `NOTICE_LINES` test kept; summary lists instructions | PASS (hidden summary contains „1. Pridaj sa (koľko vás príde).“) |
| 8 | pytest and node pass; manual item in `tests/manual.md` | PASS (`tests/manual.md` line 102 „Návod flow (T-026, T-042)“, covering centred window, Esc/✕, VoiceOver/TalkBack; dark mode and iPhone/Android listed there) |

### Extra scenarios (temp server on 127.0.0.1:8031, temp data dir, removed afterwards)
- Enter and Space on „?“ open the dialog; another key (`a`) does nothing.
- Esc closes and focus returns to the „?“ (`g` with `data-key="notice"`); the sheet is removed from `#panelRoot`.
- Tab and Shift+Tab inside the dialog keep focus on ✕ (only focusable element).
- `document.elementFromPoint(5,5)` with the dialog open is the backdrop, so the backdrop covers the map.
- Party table: with 0 parties it shows „Zatiaľ tu nikto nie je.“; after creating a party via `POST /api/parties` (200) the table row appears after the poll; a second party appears after a `visibilitychange` refresh while the dialog is open, the dialog stays open, and Esc still returns focus to „?“.
- First load does not auto-open „Návod“. With an old `localStorage["cabin.noticeCollapsed"]="1"` and a reload, the page shows the „?“ and no dialog.
- The table rect (181–333 px) and the „?“ rect (337–382 px) do not overlap at 390 px.

### Unverified (needs a human or a working screenshot)
- Visual result: no screenshot could be taken (`preview_snapshot`, with and without `save`, timed out 3 times; `preview_click` on the „?“ timed out, so all taps were simulated with `element.click()`/synthetic events plus a real `elementFromPoint` hit test). Layout is checked only through `getBoundingClientRect`.
- Dark mode colours of the centred window, and the text fitting in 380 px phones (manual item 102).
- Real touch and pointer taps, VoiceOver/TalkBack, iPhone Safari, Android Chrome (manual item 102).
- Reduced-motion behaviour was checked from CSS, not by emulating `prefers-reduced-motion`.
- Focus on open happens one animation frame after the open call. In the hidden preview tab the first frame came late, so a 300 ms wait was too short. Not a bug in the app.

### Result
All 8 criteria pass, no regressions (503 pytest, 255 Node). Verdict: PASS, moved to `tasks/done/`. No commit (orchestrator commits). Temp server stopped, temp data dir removed.
