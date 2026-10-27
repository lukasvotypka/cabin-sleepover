# T-148: New event date 5.–8. 11. 2026, „Našich 40“, dates visible, whole-stay take button

- **Phase:** 1
- **Depends on:** none
- **Size:** M
- **UX:** yes

## Goal
The event moved by a week and was renamed (organizer, 27. 10. 2026). The stored parties move with it and all beds are
freed. The term must be visible on the map, and the free place button in the bed sheet takes the place for the whole stay.
Done directly by the orchestrator (commits 1e04c3d, 629a7de, 26608f7, e9939d5); this task is for testing only.

## Scope
`config/cabin.yaml`, `scripts/shift_event.py`, `static/index.html`, `static/manifest.webmanifest`,
`static/js/logic-model.js` (`eventTermShort`), `static/js/app-board.js` (`drawGate`), `static/js/app-core.js`,
`static/js/logic-iso.js` (`ISO_SIGNS.gate`), `static/js/logic-beds.js` (`takeSlotNights`, `takeSlotTexts`),
`static/js/app-sheet.js`, `static/js/app-actions.js`, `app/models.py`, `app/validate.py`, `app/main.py`
(`assign-stay` optional `nights`), tests.

## Acceptance criteria
- [ ] `config/cabin.yaml`: name „Našich 40“, arrive 5.–7. 11., leave 6.–8. 11., nights 2026-11-05..07; `tests/js/cabin-layout.json` matches.
- [ ] `scripts/shift_event.py --days 7`: on a copy of an old-date data file (make one in a temp dir, never touch `data/` or `/tmp/cabin-try`) `--dry-run` writes nothing; a real run moves `arrive`, `leave`, `day_visits`, `places`, empties `sleeping`, keeps names, phones, colours, `briefing`, bumps `version`, leaves a `*-before-shift.yaml` backup and one `shift_event` audit entry, and the app starts on the result. A wrong `--days` (e.g. 3) is refused and writes nothing.
- [ ] The title gate shows „Našich 40“ and under it „5. – 8. 11. 2026“; the tab title is „Našich 40 · 5. – 8. 11. 2026“ (`eventTermShort`, Node tests for same month, other month, other year, bad data).
- [ ] Night stamps in the top HUD show their dates („5./6. 11.“) also on a window of 600 px height or lower (8 px, not hidden).
- [ ] Bed sheet: a free place row in the shown night says „Ľahnúť si sem na celý pobyt“ (party name under it) when it would write more than one night, else „Ľahnúť si sem“. A tap writes that exact place on the shown night plus every other stay night where the place is free and the party still misses a place (`takeSlotNights`); nights already complete get no extra place; a night taken by another party is skipped with the toast.
- [ ] `POST /api/assign-stay` with `nights` writes only those nights of the stay; `nights` outside the stay only → 422 `no_event_nights`; duplicates → 422 `invalid`; without `nights` it works as before (pytest).
- [ ] `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
None (implemented). Do not use or kill ports 8000/8010; run your own server on a free port with its own temp data.

## Design
ux-designer recommendation (27. 10. 2026): term as a second line under the name on the gate (size 8 under size 10 bold),
same text in the tab title, not on the splash or in „Kto si?“.

---
## Dev log
Implemented by the orchestrator on 27. 10. 2026, see the commits above. Tests: `uv run pytest`, `node --test tests/js/`.

## Review round 1

## Review round 2

## Test report

Tester run on 27. 10. 2026 (uncommitted: `tests/manual.md` only, new section 23 and two stale 29. 10. strings fixed).

Commands and results:
- `uv run pytest -q`: 738 passed (includes tests/test_shift_event.py, test_iso_layout_fixture.py, test_api_write.py nights tests, test_validate.py).
- `node --test tests/js/`: 468 passed, 0 failed.
- Node check of `eventTermShort` with `node` + `vm` on the real event, 29. 10. – 1. 11., year change, `[]`, unparsable date, `null`: `"5. – 8. 11. 2026"`, `"29. 10. – 1. 11. 2026"`, `"30. 12. 2026 – 2. 1. 2027"`, `""`, `""`, `""`, `""`. Title built as in `app-board.js`: `Našich 40 · 5. – 8. 11. 2026`.
- `served /`: `<title>Našich 40</title>`; manifest name „Našich 40“, description „5. 11. – 8. 11.“. No stale „29. 10.“ found in `static/`, `config/`, `app/`.

Shift script on temp copies (`/tmp/t148-shift/`, not `data/` or `/tmp/cabin-try`):
- `--days 3 --dry-run` and `--days 3`: exit 1, refused with `day_visits` / `places` messages, file byte-identical.
- `--days 7 --dry-run`: prints the moves, „dry run: nothing written“, file byte-identical, no backup.
- `--days 7`: `version` 41 → 42, `arrive` 2026-10-29 → 2026-11-05, `leave` → 2026-11-08, `day_visits` moved, `places` key moved, `sleeping` emptied (2 beds freed), name, phone, phone_set_at, colour, food_note, briefing kept. Backup `backups/cabin-data-…-v000041-before-shift.yaml` is byte-identical to the old file. `audit.yaml` has exactly one `action: shift_event` entry.
- Server started on the result (temp port 8731, own copy of the data): `/api/health` ok, `/api/state` returns the event block and shifted parties, no phone in state (only `phone_hint`).

assign-stay probes on that server (admin cookie, temp data):
- `nights: ["2026-11-06"]`: 200, only 11-06 written.
- `nights: ["2026-10-29"]` and `["2026-11-09"]`: 422, `code: invalid`, `params.reason: no_event_nights`, nothing written.
- `nights` with duplicate: 422 `invalid`. Empty list: 422 `invalid`.
- No `nights` key: 200, whole stay written (3 nights).
- Another party holds the slot on one night: 200 with `skipped: ["2026-11-05"]`, the other nights written.
- 10 concurrent assign-stay requests (two parties, same slot, same night): exactly one ok, nine `slot_taken`, the slot holds one party.
- Audit: `assign-stay` entries carry the written `nights` and `slots`.

Acceptance criteria:

| # | Criterion | Result | Note |
| --- | --- | --- | --- |
| 1 | cabin.yaml name, arrive, leave, nights; `tests/js/cabin-layout.json` matches | PASS | fixture test passes, values compared by hand |
| 2 | shift script: dry-run writes nothing; real run moves dates, empties sleeping, keeps names/phones/colours/briefing, bumps version, backup, one audit entry; app starts; `--days 3` refused | PASS | see above |
| 3 | gate shows name and term; tab title; Node tests for same month, other month, other year, bad data | PASS (automated) | gate look on a phone is in manual.md section 23 |
| 4 | night stamps show dates at 600 px height or lower | PASS (code) | `@media (max-height: 620px)` sets `.stamp .dt` to 8 px, not hidden; covers 600. Visual check in manual.md section 23 |
| 5 | bed sheet button text, whole-stay write, skip nights, toast | PASS (automated + code) | `takeSlotNights` / `takeSlotTexts` Node tests pass; `assignHere` sends `nights`; server skip verified. Touch/visual check in manual.md section 23 |
| 6 | assign-stay `nights`: only those nights; outside stay → 422 `no_event_nights`; duplicates → 422 `invalid`; without `nights` unchanged | PASS, with a wording note | status 422 and reason `no_event_nights` are right, but the `code` is `invalid` with `params.reason: no_event_nights`, the project convention for `invalid` reasons. The criterion text reads as if `no_event_nights` were the code. Not a failure; the orchestrator may want to say it in the task or accept it as is |
| 7 | `uv run pytest` and `node --test tests/js/` pass | PASS | 738 and 468 |

Extra scenarios tried: wrong `--days`, dry-run byte check, backup identity, single audit entry, unknown night, empty and duplicate nights, skipped night, concurrent writes to one slot, stale-term strings. Regression: the full pytest and Node suites include all tasks in `tasks/done/`, all green.

Observations (not T-148 failures):
- Headless Chrome screenshot of the join screen at 380 px (no cookie, so the map could not be shown without a browser session) looks clipped on the right edge: the card runs past the viewport. Screenshot `/tmp/t148-shots/s380x600.png`. May be a headless artefact; check on a real phone.
- The page has no Slovak text for `invalid` with `reason: no_event_nights`. The bed sheet only offers the button on present nights, so this is only reachable in a race (party moved out while the sheet is open). Low priority.

Manual (added to `tests/manual.md`, section 23): gate and tab title, stamps on a 600 px window, whole-stay button on two phones, single-night button, and the real `shift_event.py` run for the organizer. Also fixed two stale „29. 10.“ strings: the title board item in section 8 and the notice board and gate item (T-146).

Result: all criteria pass (criterion 6 with the wording note). Moved to `done/`.
