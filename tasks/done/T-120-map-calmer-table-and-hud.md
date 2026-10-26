# T-120: Calmer party table, captioned „Pred cestou“ board, no quest log before „Kto si?“

- **Phase:** 1
- **Depends on:** none
- **Size:** S
- **UX:** yes

## Goal
Four small visual fixes from the ux-designer review of the main map (26. 10. 2026), approved by the organizer from a live preview: the party table reads "what is left to do" instead of "something is broken", the suitcase board says what it is, and a new visitor sees only one call to action („Kto si?“).

## Scope
- `static/js/app-draw.js` (party table night headers)
- `static/js/app-core.js` (`TALLY_COLORS`)
- `static/js/logic-summary.js` (`tableCellText`)
- `static/js/app-briefing.js` (`drawBriefing`)
- `static/js/app-hud.js` (`renderHud`), `static/index.html` (CSS)
- tests in `tests/js/` that cover `tableCellText` (and any others that change), docs if they describe these details (`CLAUDE.md`, `proposal.md` only where they state the old look)

## Acceptance criteria
- [x] Party table „Noc“ header columns show the short day of the night start („Št“, „Pi“, „So“, via `dayShort`) instead of „Št → Pi“. Signposts keep „Št → Pi“.
- [x] Missing places (`under`) are drawn amber (amberEdge/amber, ink text) and red is used for extra places (`over`: redEdge/red, white text), both in the table and on the signpost chips (`TALLY_COLORS` swap).
- [x] Table cells no longer append „!“: `tableCellText` returns e.g. „0/2“ for under. Node test updated.
- [x] „Pred cestou“ board has the caption „Pred cestou“ (`iconCaption`, like „Kto je kto“/„Návod“/„Prehľad“) under it; the `done/total` count is a small badge at the top-left corner of the board.
- [x] The blinking „!“ bubble on that board shows only when a party is chosen and has not done the briefing.
- [x] The quest log („ÚLOHY“) is hidden while no party is chosen (`#quest` hidden; `questBottom()` then returns 0 so the scene refits), and visible again after a party is picked.
- [x] While no party is chosen the „Kto si?“ crest gently bobs (`steps(2)`, 1.2 s, 3 px); no animation under `prefers-reduced-motion`.
- [x] `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
The approved preview is the diff in `/tmp/cabin-preview-map.diff` (worktree `/tmp/cabin-preview-map`, running on :8445). Apply the same changes, then fix tests and comments that mention the old look (e.g. the `tableCellText` comment, the `TALLY_COLORS` meaning, „Úlohy“ docs). Do not touch the worktree or its server.

## Design
Approved by the organizer from the live preview (see Notes). Texts: caption „Pred cestou“; no other new Slovak text.

---
## Dev log
Applied the approved preview diff (/tmp/cabin-preview-map.diff): day-short table headers, TALLY_COLORS swap (under amber, over red), no „!“ in `tableCellText`, „Pred cestou“ caption + count badge + „!“ only with a chosen party, quest log hidden without a party (`questBottom()` already returns 0 for a hidden element), bobbing crest. Updated comments, `tests/js/logic.test.mjs` (2/3 without „!“, legend texts) and the proposal.md line on the board.
Files: static/index.html, static/js/{app-briefing,app-core,app-draw,app-hud,logic-summary}.js, tests/js/logic.test.mjs, proposal.md.
Tests: `node --test tests/js/` 375 pass; `uv run pytest` 740 pass. Not checked visually in a browser (the preview was approved by the organizer).

## Review round 1
Checked the diff against every criterion. Tests run by the reviewer: `node --test tests/js/` 375 pass, `uv run pytest` 740 pass.

- Table headers use `dayShort(n)`; signposts still use `info.label`. `TALLY_COLORS` swap covers both the chips and the table cells. `tableCellText` has no „!“, and the comment and tests are updated (the legend text keeps „Št → Pi“, which is correct).
- Board: `iconCaption` „Pred cestou“ at y+48 and a count badge at the top left. The bang is gated on `partyById(...)`. `briefingLabel` already describes the count for screen readers.
- `#quest` is hidden without a party. `.quest[hidden]` outranks `.quest { display: flex }`, and `questBottom()` returns 0 through `offsetParent === null`, so the scene refits.
- Crest bob: `steps(2)`, 1.2 s, 3 px, turned off under `prefers-reduced-motion`. No new Slovak text beyond the caption. No `innerHTML`. Every `static/js/` script carries `?v=__ASSET_VERSION__`.

No blockers.

Nit: the trailing comment on the `briefing-bang` line in `app-briefing.js` is now padded far out of alignment.

Verdict: APPROVED (round 2 skipped, no blockers)

## Test report (tester, 26. 10. 2026)

Commands and results:
- `node --test tests/js/` → 375 pass, 0 fail.
- `uv run pytest -q` → 740 passed.
- Temp server on 127.0.0.1:8042 (test secrets, temp data dir, now stopped): `/api/health` 200; `/` 200 with no `__ASSET_VERSION__` left and the `crest-ask` and `quest[hidden]` CSS served; `/static/js/app-draw.js?v=x` 200; `/data/cabin-data.yaml`, `/config/cabin.yaml`, `/static/../data/cabin-data.yaml` all 404.
- Changed ranges read: all of the diff listed in the Dev log, plus the helpers they use (`dayShort`, `partyById`, `iconCaption`, `questBottom`, `drawCrest`).

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Table „Noc“ headers use `dayShort` | pass | app-draw.js uses `dayShort(n)`; signposts keep `info.label`; DAY_SHORT maps Thu→„Št“ |
| 2 | Under amber, over red in table and chips | pass (code); colours need eyes | `TALLY_COLORS` swapped; used at app-draw.js:333 and :420 |
| 3 | `tableCellText` without „!“ | pass | logic-summary.js; node test updated and green |
| 4 | „Pred cestou“ caption and count badge | pass (code); visual needs a device | `iconCaption(... "Pred cestou")` and badge at top-left |
| 5 | „!“ only with a chosen party not done | pass | `partyById(...) && !briefingDone(...)` |
| 6 | Quest log hidden without a party, refits | pass (code) | `quest.hidden = !party`, `.quest[hidden]` CSS, `questBottom()` returns 0 when offsetParent is null |
| 7 | Crest bobs, `steps(2)`, 1.2 s, 3 px, none under reduced motion | pass (code); motion needs a device | `.crest.ask` rules and `prefers-reduced-motion` media query |
| 8 | Node and pytest pass | pass | see commands above |

Extra scenarios: no leftover „2/3!“ or old text in code; `proposal.md` line updated; the `briefing-bang` trailing-comment alignment nit from review round 1 is still present (cosmetic, not a criterion).

Not verifiable here (no browser): visual look of the caption, badge, amber/red cells and crest bob on a 380 px phone, light and dark mode, reduced motion. Added to `tests/manual.md` as a new T-120 item. Also updated three stale manual items (T-013, T-023, T-047 wording) that still described red „!“ and „Št → Pi“ headers.

Verdict: PASS. No failures, no regressions (all of `done/` is covered by the pytest suite).
