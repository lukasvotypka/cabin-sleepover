# T-071: Bed panel: fix the whole-stay button layout and partial stays

- **Phase:** 1
- **Depends on:** T-070
- **Size:** S

## Goal
The organizer tried T-070 on an iPhone 13 mini (375 px wide, Safari) and found two problems (25. 10. 2026):
1. The sub-line „št – pi · 1 noc“ sits **beside** the main text in a narrow column, not under it. `.btn` is `display: inline-flex` (row), so the `display: block` of `.sub-line` does nothing.
2. When the bed can take only some of the party's nights, the main button still says „na celý pobyt“, which is untrue. In the screenshot Friday and Saturday are full, so „Zapísať „Františk“ na celý pobyt“ (št – pi · 1 noc) and „Len na štvrtok“ do exactly the same thing.

## Scope
- `static/index.html` (CSS of the button with a sub-line)
- `static/js/logic-beds.js` (`bedActionTexts`, `stayNightsText`, `stayFullNote`)
- `static/js/app-sheet.js` (`addActions`, only if needed for the note with a single button)
- `tests/js/logic.test.mjs`, `tests/manual.md`

## Acceptance criteria
- [x] The sub-line is a second centred line **under** the main text (the button stacks its content in a column only when it has a sub-line; other `.btn`s are unchanged). It fits at 375 px, the button stays ≥ 44 px.
- [x] **All of the party's remaining nights are bookable** (nothing in `full`): unchanged, „Zapísať „X“ na celý pobyt (1 miesto)“ + „št – ne · 3 noci“ and „Len na sobotu“.
- [x] **Only the selected night is bookable** (`stayNights` gives just that night or nothing more than a single tap would): one filled button „Zapísať sem „X“ (1 miesto)“ (single-night assign) and the note „V piatok a v sobotu je tu plno.“ (without „zapíšeme ťa na …“). No „Len na …“ button.
- [x] **Some but not all nights are bookable, 2 or more**: main button „Zapísať „X“ na voľné noci (1 miesto)“ with the sub-line naming the booked nights; the outlined „Len na …“ stays; the note says only which nights are full („V piatok je tu plno.“).
- [x] The sub-line range „št – ne“ is used only for consecutive nights; for non-consecutive ones it lists the days, e.g. „št, so · 2 noci“.
- [x] Node tests cover the four cases above (all free, only selected night, partial 2+, non-consecutive) and update the T-070 tests that change. `node --test tests/js/` and `uv run pytest -q` pass. `tests/manual.md` T-070 item mentions the iPhone 13 mini check.

## Notes for developer
- Keep the rule in `logic-beds.js`; reuse `stayNights` and the `full` list already computed in `bedActionTexts` (nights where the party already sleeps in this bed are not "full").
- The single-button note is shown only when the party is present and the button is not blocked, like the T-070 note.
- An existing test reads `addActions` with a regex that stops at the first line holding only `}`; keep single-line `if`s there.

---
## Dev log
- `.has-sub` class (column, centred) added in `app-sheet.js` and `index.html`; `bedActionTexts`, `stayNightsText` (non-consecutive lists days), `stayFullNote` (only names full nights) in `logic-beds.js`; note now shown for the single button too. Tests in `tests/js/logic.test.mjs`, `tests/manual.md` updated.
- Single button also when booked has <=1 night. Layout at 375 px not checked in a real browser (manual item added).
- `node --test tests/js/` all pass; `uv run pytest -q` 620 passed.

## Review round 1
Tests run by the reviewer: `node --test tests/js/` 333 passed, `uv run pytest -q` 620 passed. Every script in `static/js/` is listed in `index.html` with `?v=__ASSET_VERSION__`.

- AC1: `.actions .btn.has-sub` sets `flex-direction: column` and centres the content. The class is added only when `t.sub` is set, so other `.btn`s do not change. The 375 px look still has to be checked by hand, and the manual item for that is in place.
- AC2 to AC5: `bedActionTexts` gives one button when `booked.length <= 1` (single-night assign, note names only the full nights), „na voľné noci“ when 2 or more nights are booked but some are full, and leaves the all-free case unchanged. `stayNightsText` lists the days for non-consecutive nights. Nights the party already holds in this bed are still not counted as full, and the existing test now also checks „na celý pobyt“ there.
- `app-sheet.js`: the note now also shows with a single button, still only when `!blocked && present`. A party present on one night gets `note: ""`, so it stays silent there.
- AC6: Node tests cover all-free (existing), only the selected night, partial 2+ with consecutive nights, and partial non-consecutive. `manual.md` is updated, including the iPhone 13 mini check.
- Constraints: Slovak text uses „ “, the sub-line goes in via `htmlEl` text (no `innerHTML`), the rule stays in `logic-beds.js`, and there is no scope creep.

No blockers.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester (25. 10. 2026), Haiku 5.5.

Commands run (PATH needed `/opt/homebrew/bin` for uv and node):
- `uv run pytest -q`: 620 passed.
- `node --test tests/js/`: 333 passed, 0 failed.
- Temp server on 127.0.0.1:8023 with `data/` in a temp dir and test secrets: `/api/health` returns `{"ok":true,"version":"1.14.2"}`. `GET /` has `logic-beds.js?v=<hash>`, the `.has-sub` CSS is served, and `static/js/logic-beds.js?v=x` returns 200. Server stopped afterwards.
- Edge probe (Node vm, `bedActionTexts`, three nights, one party present on all three):
  - Thu and Sat free, Fri full, tap Sat: main „na voľné noci (1 miesto)“, sub „št, so · 2 noci“, only „Len na sobotu“, note „V piatok je tu plno.“
  - Fri full only, tap Thu: same shape, only „Len na štvrtok“.
  - Thu and Fri full, tap Sat only free: single „Zapísať sem „Ivan“ (1 miesto)“, note „Vo štvrtok a v piatok je tu plno.“
  - All free: „na celý pobyt“, sub „št – ne · 3 noci“, note empty.

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Sub-line under the main text (column only with a sub-line), button ≥ 44 px, fits at 375 px | PASS in code (`.actions .btn.has-sub` is column, `.btn` has `min-height: 44px`, the class is added only when `t.sub` is set). The 375 px look needs a real iPhone, see manual.md. |
| 2 | All nights bookable: unchanged „na celý pobyt“, „Len na …“ | PASS (all-free probe and node test) |
| 3 | Only the selected night bookable: single „Zapísať sem „X“ (1 miesto)“, note „V piatok a v sobotu je tu plno.“, no „Len na“ | PASS (single button, note names the full nights, `only` empty) |
| 4 | Partial 2+: „na voľné noci“, sub names booked nights, „Len na …“ kept, note names only full nights | PASS |
| 5 | Range „št – ne“ only for consecutive nights, otherwise list „št, so · 2 noci“ | PASS (`stayNightsText`, node tests and probe) |
| 6 | Node tests cover the four cases, T-070 tests updated; both suites pass; manual.md mentions iPhone 13 mini | PASS |

Extra scenarios: a party held in this bed on one night is not counted as full (existing test, now also asserts main text); a single button shows the note only when the party is present and not blocked (app-sheet.js condition, read, not run in a browser).

Not verified here: the 375 px rendering on iPhone 13 mini Safari (no browser run). It is in `tests/manual.md`.

Decision: all automated criteria pass, no regressions, so the task moves to `done/`. The iPhone check stays open in manual.md.
