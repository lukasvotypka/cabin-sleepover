# T-024: Show each date once: event name on the title board, night dates on the signposts, party chip under the date

- **Phase:** 1 (organizer request, 23. 10. 2026)
- **Depends on:** T-013, T-020, T-023 (all in `done/`). Same files as T-009 (`static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md`, `proposal.md`); T-009 is blocked in phase 2, but if it is ever unblocked, do not run the two in parallel.
- **Size:** S

## Goal
Today the dates appear twice at the top of the scene: the title board ("Tabuľa s názvom a termínom", `map.scene.title`) shows `29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)`, and each night signpost ("Tri smerovníky nocí", `map.scene.nights`) shows its own `29./30. 10.`. The organizer wants the dates shown in one place only. When *moja partia* is chosen, the T-013 chip `máš 2/3` also *replaces* the signpost's date row, so the date disappears. The date must stay visible at all times, with the chip below it. Proposal sections: "Informácie v scéne" (title board and signpost bullets), "Rozloženie chaty" (the `map.scene` example).

## Options considered
- **A (chosen default): the title board shows only the event name, and each signpost shows its full night date.** Every date appears once, on the signpost you tap to pick the night. The title board gets shorter, and the space it frees makes each signpost taller, so the date row and the chip row fit one under the other. The event range is still visible from the first and last signpost (`29./30. 10.` … `31. 10./1. 11.`). Only the year is no longer drawn, and it stays in the title's screen-reader label.
- **B: the dates stay on the title board, and the signposts show only the day abbreviation or the day number.** The signposts already show the day abbreviation (`Št → Pi`), so B would really mean dropping the date row, or shrinking it to `29./30.`. The full date would then be away from where you choose the night, and a day-number row still needs the same extra signpost row under the chip, so B saves no layout work. Not chosen.
- **A without a config change (fallback, not chosen):** keep both rects as they are and pack label, date, chip and occupancy into the existing 44-unit signpost by merging `obsadené` and `X z 20` into one row. That changes the occupancy wording, and the text would get even smaller on a 380 px phone. Use it only if the organizer refuses any `config/chata.yaml` change.

## Design decisions (product-owner defaults, for the organizer to change after trying it)
These are not open decisions from `proposal.md`.
1. **Option A** as above.
2. **Geometry: two lines in `config/chata.yaml`.** Only the existing `title` and `nights` rects change. No new keys, no model change:
   - `title:  [176, 10, 196, 30]` (was `[176, 10, 196, 44]`), with the comment `# názov akcie`
   - `nights: [176, 46, 196, 58]` (was `[176, 60, 196, 44]`), comment unchanged
   The signposts' bottom edge stays at y 104 and the posts still end at y 110, so the notice (y 112), the party table (T-023, y 112) and everything below stay where they are. The gap between the title and the signposts stays 6 units.
3. **Signpost rows, top to bottom:** night label (`Št → Pi`), date (`29./30. 10.`), party row (the T-013 chip or `nie si tu`), `obsadené`, `X z 20`. The date row is always drawn. The party row has a fixed position. Without a party it stays empty, so nothing moves when you pick a party in „Kto si?“.
4. **No new texts.** The chip texts, `tallyLabel`, `nightInfo` and `eventDateText` stay exactly as they are (T-013 and T-020 wording, tykanie).

## Organizer decision (23. 10. 2026, after the test report)
The event name in `config/chata.yaml` stays `"Chata 29. 10. – 1. 11."` (and the same in the `proposal.md` example). The organizer does not want it shortened. The dates that this name shows on the title board are the organizer's own content, not text the code adds. So criterion 5 now asks that the **code** draws no date text on the title board, not that the rendered board shows no date. No code or config change follows from this. The task goes from `in-progress` straight back to `testing`, because the reviewer approved the unchanged code and only the criterion's wording changed.

## Scope
- `config/chata.yaml`: the two rects above, and the `title` comment `# názov akcie`.
- `static/index.html`:
  - `<script id="logic">`: new pure functions `signpostLayout` and `titleLabel` (below), in the scene geometry section next to `nightsHit` and in the texts section respectively.
  - `drawTitle`: draws only `state.event.name`, bold size 12, centred horizontally and vertically in the rect (baseline computed from `r[1]` and `r[3]`, not a fixed `+20`). The `aria-label` comes from `titleLabel(state.event)` and still contains the full event dates. The two decorative nails stay.
  - `drawNights`: board positions and all row positions come from `signpostLayout(scene.nights, nights.length, gap)`. The date row is drawn in every case. The T-013 chip (or the `nie si tu` text for `absent`) goes into the party row, below the date. Chip colours (`TALLY_COLORS`), text sizes, `maxWidth` values, the post, the hit area (`nightsHit`), `aria-pressed` and the `aria-label` (which already contains `info.dates`, plus `tallyLabel` when a party is chosen) stay as they are.
- `tests/js/logic.test.mjs`: update the `scene` fixture to the new `title` and `nights`, add the new tests, and update the expectations that follow from the new geometry (see below).
- `tests/test_models.py`: update `SCENE` `title` and `nights` to the new values so the fixture mirrors the config (no new test).
- `tests/manualne.md`: items in sections 5, 6 and 8.
- `proposal.md`: Slovak text below.

Out of scope: the server and API, `app/models.py`, the chip texts and colours, `nightTally`/`tallyChipText`/`tallyLabel`, the status board, the party table (T-023), the notice, the WhatsApp text (`summaryText`, which keeps the name and full term), the hidden summary structure, `document.title`, the splash (T-022), phase 2 elements, new `COLORS` keys.

## Pure functions (in `<script id="logic">`, no DOM, no `app`)
```js
// Boards and row positions of the night signposts inside `rect` ([x, y, w, h]) for `count` nights and
// `gap` units between boards. All y values are absolute scene units derived from rect[1] and rect[3].
// {w, boards: [[x, y, w, h], ...],
//  label, date, absent, used, total,        // text baselines
//  chip: [dy, h], chipText}                 // chip rect top (absolute) and height, chip text baseline
function signpostLayout(rect, count, gap)

// Screen-reader label of the title board: "<name>, <eventDateText>", or just "<name>" when the dates
// cannot be built.
function titleLabel(event)
```
Row rule for `signpostLayout` (the reference values are for the real rect, h = 58): label baseline `y + 12` (bold 9), date baseline `y + 21` (6.5), chip rect `y + 24`, height 10, chip text baseline `y + 32` (bold 7), absent text baseline `y + 31` (6.5), `obsadené` baseline `y + h − 15` (6.5), count baseline `y + h − 6` (bold 8). Board width and x as today: `w = (rect w − gap·(count − 1)) / count`, `x = rect x + i·(w + gap)`. You may write it as offsets from the top for the upper three rows and from the bottom for the lower two, as above. The point is that the positions live in one tested function and the draw code reads them.

## proposal.md (Slovak)
- "Informácie v scéne", replace the bullet „**Tabuľa s názvom a termínom:** …“ with:
  „- **Tabuľa s názvom:** názov akcie z `/api/state`, nič napevno v kóde. Termín na tabuli nie je, lebo každý smerovník má svoj dátum; čítačka ho prečíta v popise tabule.“
- "Informácie v scéne", in the „**Tri smerovníky nocí:**“ bullet:
  - replace „Št → Pi (29./30. 10.), Pi → So, So → Ne.“ with „Št → Pi, Pi → So, So → Ne a pod každým jeho dátum, napríklad „29./30. 10.“. Dátum je na smerovníku vždy.“
  - replace „Keď je vybratá moja partia, namiesto dátumu je na smerovníku štítok“ with „Keď je vybratá moja partia, pod dátumom je na smerovníku štítok“.
- "Rozloženie chaty", the `map.scene` example:
  `    title:  [176, 10, 196, 30]   # názov akcie`
  `    nights: [176, 46, 196, 58]   # tri smerovníky nocí`

## Acceptance criteria
- [x] `config/chata.yaml` and the `proposal.md` example have `title: [176, 10, 196, 30]` and `nights: [176, 46, 196, 58]`. No other config line changes, and no new keys. The server starts with the real config.
- [x] The title board shows only the event name, centred in its rect. No dates are drawn on it. Its `aria-label` is `titleLabel(state.event)`, e.g. `Chata …, 29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)`.
- [x] Each signpost always shows its night label and, below it, its date (`29./30. 10.`, `30./31. 10.`, `31. 10./1. 11.`), with or without a chosen party, on every night kind (`under`, `over`, `ok`, `absent`).
- [x] With a party chosen, the T-013 chip (or `nie si tu`) is drawn below the date row and above `obsadené`, with the same texts and colours as before. Nothing overlaps: the chip rect lies fully between the date text and the `obsadené` text. Without a party the party row is empty and the other rows keep their positions.
- [x] The code draws no date text of its own on the title board: `drawTitle` draws only `state.event.name`, and no date text (`eventDateText`, `nightInfo().dates` or a date built in place) reaches its visible text; the dates are only in its `aria-label`. The signposts draw only their own night dates and no event-range text. If the event name itself contains dates, as the real `"Chata 29. 10. – 1. 11."` does, they show on the title board as part of the organizer's content. That is accepted (organizer decision of 23. 10. 2026) and is not a failure. Check it with the real config and with an event name without dates (e.g. `"Chata"`): the latter shows no date on the title board at all.
- [x] Screen readers still get the dates: the signpost `aria-label` still starts `Noc Št → Pi, 29./30. 10., obsadené …`, the title `aria-label` contains the full term, and the hidden summary still has its dates paragraph (`hiddenSummary().dates`) and the per-night `Noc … (29./30. 10.)` heading.
- [x] Geometry is only in `config/chata.yaml` and `signpostLayout`. `drawNights` and `drawTitle` contain no absolute coordinates. The signposts, their posts and their hit areas do not touch the title board, the notice, the party table, the „?“ box or any room. Each signpost is at least 44 units tall.
- [x] All text through `addText`/`setText` (`textContent`). No `innerHTML`, no new `COLORS` keys, no new UI strings, `shape-rendering="crispEdges"` unchanged.
- [x] Node tests in `tests/js/logic.test.mjs`:
  - `signpostLayout([176, 46, 196, 58], 3, 4)`: three boards of width `188/3`, x of board i = `176 + i·(188/3 + 4)`, every board `[x, 46, w, 58]`; baselines `label 58`, `date 67`, chip rect top `70`, height 10, chip text `78`, absent `77`, `obsadené 89`, count `98`.
  - Row order and no overlap on the real rect: label < date < chip top, date baseline < chip top, chip bottom (`chip top + chip h`) < `obsadené` baseline − 5 (cap height at 6.5), `obsadené` < count < rect bottom. Run this check on the `nights` rect taken from the `scene` fixture (which mirrors `config/chata.yaml`), so a later config edit that squeezes the rows fails the test.
  - The `title` rect and the `nights` rect plus the posts (bottom + 6) do not overlap each other, `notice`, `parties` or any room in the fixture.
  - `titleLabel` for the real event (`… , 29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)`) and for an event with bad dates (name only, no trailing comma).
  - `nightsHit(realLayout, 8)` is now `[176, 40, 196, 72]` (6 up to the title board, 8 down to y 112). Recompute the "far neighbour" and "close room" expectations from the new fixture and say in the dev log what changed and why.
  - The existing T-020 tykanie guard and text-producer guard still pass (no new strings, `titleLabel` added to the producer list).
- [x] `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md`:
  - section 5: the title board shows only the name; each signpost shows its date at all times; with a party chosen, the chip is under the date on all three signposts, and the date is still visible on `nie si tu` nights; switching party in „Kto si?“ does not move the date or `obsadené` rows;
  - section 6: on a 380 px phone (iPhone Safari, Android Chrome) the date and chip rows are readable with map zoom and do not touch; desktop and dark mode look the same as light mode (fixed scene colours);
  - section 8: VoiceOver/TalkBack reads the full term on the title board and the night date on each signpost.

## Notes for developer
- Start from the committed `drawTitle` and `drawNights` (after T-023). The current `drawNights` puts the chip at `r[1] + 16 … + 26`, in place of the date row at `r[1] + 23`. That is exactly the bug to fix.
- `nightsHit` and `sceneRects` pick up the new rects on their own. `bedHit` is unaffected (beds start at y 220).
- `realLayout` in the Node tests is built from the `scene` fixture, not from the YAML. Change the fixture to match the config, or the hit-area tests will test the old layout.
- The longest date `31. 10./1. 11.` is 14 monospace characters at size 6.5, about 55 units, which is right at the signpost's inner width (`w − 8` ≈ 54.7). `setText` squeezes it as today. Do not enlarge the date font.
- The chip is 10 units tall at size 7, as in T-013. Keep `x + 5` / `w − 10` for the chip edge and the 1-unit inset face. Only the y comes from `signpostLayout`.
- The chosen-night yellow board and the selected border are unchanged. Check that the chip still reads on the yellow board.
- If anything still collides on screen with the given rects, report it in the dev log for the organizer instead of moving other scene elements.

---
## Dev log
### Round 1 (developer)
Implemented option A with the product-owner defaults.

- `config/chata.yaml`: `title: [176, 10, 196, 30]  # názov akcie`, `nights: [176, 46, 196, 58]`. No other line, no new keys.
- `static/index.html`: new pure `signpostLayout(rect, count, gap)` (next to `nightsHit`) and `titleLabel(event)` (next to `eventDateText`). `drawTitle` draws only the name, vertically centred (`r[1] + r[3]/2 + 4`), `aria-label` from `titleLabel`. `drawNights` takes boards and all row baselines from `signpostLayout`; the date row is always drawn, the chip (or `nie si tu`) sits in the party row below it, empty without a party. Chip colours, sizes, `maxWidth`, post, hit area, `aria-pressed` and `aria-label` unchanged.
- `proposal.md`: the two bullets in "Informácie v scéne" and the `map.scene` example, with the Slovak text from the task. `tests/test_models.py`: `SCENE` title and nights mirror the config.
- `tests/js/logic.test.mjs`: fixture `scene` updated; new tests: `titleLabel` (real event and bad dates), `signpostLayout` reference values (58/67/70+10/78/77/89/98, board x = `176 + i*(188/3+4)`), row order and no overlap on the fixture's `nights` rect, title/signposts+posts/notice/parties/`?` box/rooms do not overlap, a source guard that `drawNights` uses `signpostLayout` and `drawTitle` uses `titleLabel` with no row offsets. `titleLabel` added to the text-producer guard.
- Hit-area expectations that changed because of the new geometry: `nightsHit(realLayout, 8)` is now `[176, 40, 196, 72]` (was `[176, 54, 196, 58]`: 6 up to the title board bottom at y 40, 8 down to y 112). "Far neighbour": `[176, 38, 196, 74]` (was `[176, 52, 196, 60]`: 8 up from y 46, 8 down from y 104). "Close room" (room top at y 107): `[176, 38, 196, 69]` (was `[176, 52, 196, 55]`, still stops 3 units above the room).
- `tests/manualne.md`: new items in sections 5, 6 and 8, and the T-013 chip item reworded (chip under the date, empty chip row without a party).

Tests: `node --test tests/js/` -> 186 pass, 0 fail. `uv run pytest -q` -> 384 passed. (`tests/test_map_layout.py` loads the real `config/chata.yaml`, so the config is valid.)

Not verified: no browser run, so the on-screen look (date and chip on a 380 px phone, chip on the yellow board) is for the manual checklist. Geometry is checked only by the tests above.

## Review round 1
(reviewer appends)

Reviewed the diff of `config/chata.yaml`, `proposal.md`, `static/index.html`, `tests/js/logic.test.mjs`, `tests/test_models.py`, `tests/manualne.md`, and read the surrounding `drawBoards`, `nightsHit`, `addText`/`setText` code.

Tests run by the reviewer: `node --test tests/js/` gives 186 pass, 0 fail. `uv run pytest -q` gives 384 passed (`tests/test_map_layout.py` loads the real config).

Checked against the acceptance criteria:
- Config and the proposal example have exactly the two new rects and the `# názov akcie` comment. No other config line changed. The proposal bullets match the Slovak text in the task word for word.
- `signpostLayout` matches the row rule (58/67/70+10/78/77/89/98 for the real rect). The board x/w formula is unchanged from the old inline code. `drawNights` reads every y from it. The date row is now drawn unconditionally, and the chip and `nie si tu` go in the party row below it. Chip colours, insets (`x + 5`/`w − 10`, 1-unit face), sizes, `maxWidth`, post, hit rect, `aria-pressed` and the `aria-label` are unchanged. The `else if (tally)` branch covers `under`/`over`/`ok` as before.
- `drawTitle` draws only the name, with the baseline computed from `r[1] + r[3] / 2`. It keeps both nails, and its `aria-label` is `titleLabel(state.event)`. `titleLabel` has no trailing comma when the dates fail.
- Hidden summary (`eventDateText` at the hiddenSummary/summaryText call sites) and `summaryText` are untouched, so screen-reader and WhatsApp dates stay.
- Geometry tests: the reference values, row order and overlap on the fixture's `nights` rect, the title and signposts plus posts against notice, parties, the „?“ box and rooms, and a source guard on `drawTitle`/`drawNights`. The recomputed `nightsHit` expectations are correct: title bottom 40, notice and table top 112, and the moved title bottom at 20, so 8 up from 46 gives 38.
- `titleLabel` is added to the text-producer guard. There are no new UI strings, no `innerHTML` and no new `COLORS` keys, and `crispEdges` is untouched. No scope creep, and no server or model changes.

**Blocker**: none.

**Suggestion**
- `config/chata.yaml` line 2: the real event name is `"Chata 29. 10. – 1. 11."`. The title board now draws only the name, but that name still contains the dates, so on screen the term shows twice: in the name, and on the first and last signpost. That defeats the organizer's "each date once" goal on the real data. The code is right, and the task forbade other config edits, so this is not a blocker. Tell the organizer they may want to shorten the event name (e.g. „Chata“). That is a data change only, and `summaryText`/`titleLabel` already add the full term on their own.

**Nit**
- `drawTitle`'s `+ 4` baseline nudge is a font-metric constant, not a position, so it is fine under the "no absolute coordinates" rule. It could live in a tiny helper if more boards ever need vertical centring.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2
(reviewer appends)

## Test report

Tester run, 23. 10. 2026. Result: **FAIL on one criterion** (the title board's date text, see bug report). All code paths work as specified.

### Commands and results
- `uv run pytest -q` → 384 passed in 2.42 s.
- `node --test tests/js/` → 186 tests, 186 pass, 0 fail.
- `git diff` of `config/chata.yaml`: only the `title` and `nights` lines changed, with the `# názov akcie` comment. No new keys.
- Temporary server (not 8000/8010): `create_app(data_dir=/tmp/t024-test/data, env={test secrets})` on `127.0.0.1:8031`, real `config/` and `static/`. Started fine, `/api/health` ok. Seeded two parties with assignments through `/api/parties` and `/api/assign`.
- Headless Chromium (chrome-headless-shell from the Playwright cache, port 9333, temp profile) driven over CDP. The page loaded at 380 px (DPR 2, mobile emulation) and at 1280 px, with no console errors or exceptions, for three states: no party, „Novákovci“ (my party, placed on all nights), and „Ivan a Eva“ (my party, absent on Thursday). Captured screenshots and the SVG text and bounding boxes.

### Acceptance criteria
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Config has `title [176,10,196,30]` and `nights [176,46,196,58]`, no other changes, server starts | PASS | git diff; server started on the real config |
| 2 | Title board shows only the event name, centred, `aria-label = titleLabel(event)` | PASS | Title text `Chata 29. 10. – 1. 11.` at y 29 (rect centre 25 + 4); label `Chata 29. 10. – 1. 11., 29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)` |
| 3 | Each signpost always shows label and date, every state | PASS | Texts `29./30. 10.`, `30./31. 10.`, `31. 10./1. 11.` in none, pa and pb states |
| 4 | Chip below date, above `obsadené`, no overlap; no party keeps rows | PASS | Chip rect y 244–254 on screen. Date box bottom 243, `obsadené` box top 257. Row baselines 58/67/89/98 identical in all three states |
| 5 | Each date appears visibly once: title board has no date text, signposts no event range | **FAIL** | The title board draws the real event name, which contains the dates (see bug report) |
| 6 | Screen readers still get dates | PASS | Signpost label `Noc Št → Pi, 29./30. 10., obsadené 3 z 20 miest, zvolená noc`. Hidden summary has `29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)` and `Noc Št → Pi (29./30. 10.), obsadené 3 z 20` |
| 7 | Geometry only in config and `signpostLayout`; posts and hit areas do not touch other elements | PASS | Diff of `drawTitle`/`drawNights` has no absolute coordinates (only the `+4` font nudge). Node overlap tests pass. Screenshots show no collisions with the notice, the party table, the „?“ box or the rooms |
| 8 | `textContent` only, no `innerHTML`, no new `COLORS` keys, no new UI strings | PASS | Diff grep: no `innerHTML` added, no `COLORS` key added, no new Slovak string |
| 9 | Node tests for `signpostLayout`, row order, overlaps, `titleLabel`, `nightsHit`, guards | PASS | `node --test tests/js/`: 186 pass |
| 10 | `node --test tests/js/` and `uv run pytest -q` pass | PASS | See commands above |
| 11 | `tests/manualne.md` sections 5, 6, 8 have the T-024 items | PASS | Lines 64, 96 and 111 |
| 12 | `proposal.md` bullets and `map.scene` example match the task text | PASS | Diff compared with the task text |

Regressions: `tests/` for T-001 to T-023 is part of the 384 pytest and 186 Node tests, and all pass. Nothing in `tasks/done/` was re-run separately.

### Extra scenarios tried
- Switching party (none → Novákovci → Ivan a Eva): date and `obsadené` rows keep identical y positions. Only the party row changes.
- Thursday with absent party: `nie si tu` sits under the date, the date stays visible.
- Desktop 1280 px with party „Ivan a Eva“: layout is clean, same as phone.
- Longest date `31. 10./1. 11.` at 380 px: width 55 inside the board. Screenshot shows it fitting.
- Page console errors and exceptions during load: none.
- Overlap check over all visible scene text boxes of the signpost and title area (three states): no overlaps.

### Not verifiable here (manual, already in `tests/manualne.md`)
- iPhone Safari and Android Chrome at 380 px, real touch, pinch zoom.
- Dark mode look (scene colours are fixed, expected identical).
- VoiceOver and TalkBack readout.
- Chip readability on the yellow chosen-night board (looked fine in the headless screenshot, but a real device check is still needed).

### Bug report (criterion 5)
- **Steps:** start the app with the committed `config/chata.yaml`. Its event name is `"Chata 29. 10. – 1. 11."` (line 2). Open the page at 380 px, join, look at the top of the scene.
- **Expected** (criterion 5): each date appears once. The title board has no date text, the dates are only on the signposts.
- **Actual:** the title board draws `Chata 29. 10. – 1. 11.`, so the date range appears there and again on the signposts (`29./30. 10.`, `30./31. 10.`, `31. 10./1. 11.`). The code draws no date text of its own, and the title's code is correct. The duplicate comes from the event name in the data.
- **Why it is not a code fix:** the event name is organizer data (`config/chata.yaml` line 2, also in `proposal.md` line 258). The task forbids config changes beyond the two rects, and the reviewer already flagged it in round 1.
- **Choices for the organizer:** (a) rename the event to `"Chata"` in `config/chata.yaml` and in the `proposal.md` example. The full term still reaches the screen reader through `titleLabel` and the hidden summary, so nothing is lost. (b) Keep the name and reword criterion 5 to match. Under (b) the task passes as is.

### Decision
Criterion 5 fails on the real data, so the task goes back to `in-progress`. Everything else passes. If the organizer picks (b), the task can go to `done` without code changes.

### Re-test 2 (tester, 23. 10. 2026, after the organizer decision)

Scope: criterion 5 re-verified with the real config and with a name without dates. Code and config unchanged since round 1, so the other criteria keep the round-1 results above.

Commands and results:
- `uv run pytest -q` → 384 passed in 2.52 s.
- `node --test tests/js/` → 186 tests, 186 pass, 0 fail.
- Two temporary servers on `127.0.0.1:8041` (real `config/`, copy in `/tmp/t024-retest/config-real`) and `127.0.0.1:8042` (copy with `event.name: "Chata"`, `/tmp/t024-retest/config-chata`). Both used temp data dirs and test secrets, and both started and answered `/api/health`. Both servers are stopped again.
- Headless `chrome-headless-shell` over CDP at 380 px (DPR 2, mobile emulation), group cookie set via CDP, page loaded and the SVG read from the DOM.

Criterion 5 evidence:

| Config | Title `<text>` drawn in the title `<g>` | `aria-label` of the title | Date text drawn above y 42 |
| --- | --- | --- | --- |
| Real (`"Chata 29. 10. – 1. 11."`) | `Chata 29. 10. – 1. 11.` only | `Chata 29. 10. – 1. 11., 29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)` | only the organizer's event name (accepted) |
| Name `"Chata"` | `Chata` only | `Chata, 29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)` | none |

The code adds no date text to the title board in either case. Signposts still show `29./30. 10.`, `30./31. 10.`, `31. 10./1. 11.` below the night labels. No console errors or exceptions on load. Screenshots of both states were checked visually (`/tmp/t024-retest/real.png`, `/tmp/t024-retest/chata.png`).

Acceptance criteria (final):

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Config geometry, no other config change, server starts | PASS (round 1) |
| 2 | Title board shows only the name, centred, `aria-label = titleLabel(event)` | PASS (round 1, re-checked) |
| 3 | Each signpost always shows label and date | PASS (round 1, re-checked on screen) |
| 4 | Chip under date, above `obsadené`, no overlap | PASS (round 1) |
| 5 | Code draws no date text on the title board; signposts show only their own night dates (organizer decision wording) | PASS (re-test 2, see table above) |
| 6 | Screen readers still get dates | PASS (round 1) |
| 7 | Geometry only in config and `signpostLayout` | PASS (round 1) |
| 8 | `textContent` only, no `COLORS` keys, no new strings | PASS (round 1) |
| 9 | Node tests for the new functions and guards | PASS (186 pass) |
| 10 | `node --test tests/js/` and `uv run pytest -q` pass | PASS (re-run) |
| 11 | `tests/manualne.md` sections 5, 6, 8 | PASS (round 1) |
| 12 | `proposal.md` text matches the task | PASS (round 1) |

Regressions: none. The full pytest and Node suites (which cover T-001 to T-023) pass.

Manual checks still open (already in `tests/manualne.md`): iPhone Safari and Android Chrome at 380 px, VoiceOver and TalkBack, dark mode.

Verdict: PASS. Moved to `tasks/done/`. Nothing committed or pushed.
