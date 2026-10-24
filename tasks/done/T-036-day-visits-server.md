# T-036: Day visits: server model and rules

- **Phase:** 1
- **Depends on:** none (T-001 … T-035 are done; T-009 stays blocked)
- **Size:** M

## Goal
Organizer's decision of 24. 10. 2026 ("day visits", denné návštevy): a party may come only for the day and never sleep. It is a regular party (own name, color, people, note, `arrival_time`) with a new field `day_visits` (list of event days) instead of `arrive`/`leave`. It is never present on a night, needs 0 slots and cannot get a bed. Proposal sections touched: "Dáta v YAML" (`data/cabin-data.yaml`), "HTTP API" (`POST`/`PUT /api/parties`, Chybové kódy).

## Scope
- `app/models.py`, `app/validate.py`, `app/store.py` (`_data_problems`), `app/main.py` (only if `create_party`/`update_party` need it)
- `proposal.md`: one bullet in "Dáta v YAML" under `data/cabin-data.yaml` describing `day_visits` (Slovak, "Rozhodnutie organizátora z 24. 10. 2026")
- Tests: `tests/test_models.py`, `tests/test_validate.py`, `tests/test_store.py`, `tests/test_api_write.py`

## Acceptance criteria
- [x] `PartyInput`: `arrive` and `leave` become `IsoDate | None = None`; new `day_visits: list[IsoDate] = []` (max 10 items, shape only). Pydantic does **not** check the mode, so `validate.py` can return a `reason`.
- [x] Event days are derived, not configured: pure `event_days(layout)` returns every calendar day from `arrive_days[0]` to `leave_days[-1]` inclusive (`2026-10-29` … `2026-11-01`, 4 days, for the current config). Unit test.
- [x] A party is day-only when `day_visits` is non-empty and `arrive`/`leave` are both `None` (helper `is_day_only`). `is_present` returns `False` for it on every night without comparing `None`; `needed_on_night` returns 0.
- [x] `check_party_create` and `check_party_update` check the mode in this order, each as 422 `invalid` with `params.reason` and `params.field`:
  - `stay_mode_mixed` (field `day_visits`): `day_visits` non-empty and `arrive` or `leave` given
  - `day_visits_empty` (field `day_visits`): no `arrive`, no `leave`, empty `day_visits`
  - `stay_incomplete` (field = the missing one, `arrive` or `leave`): only one of the two given
  - `duplicate_day` (field `day_visits`, param `day`), `day_outside_event` (field `day_visits`, param `day`): checked against `event_days`
  - `day_only_kids_in_bed` (field `kids_in_parents_bed`): day-only with `kids_in_parents_bed > 0`
  - overnight parties keep the existing `check_stay` reasons unchanged.
- [x] The server stores `day_visits` sorted ascending. In `state` JSON every party has `day_visits` (`[]` for overnight parties) and day-only parties have `arrive`/`leave` = `null`.
- [x] `POST /api/assign` for a day-only party → 409 `not_present`; `POST /api/places` → 409 `not_present`; `POST /api/assign-stay` → 422 `invalid` `no_event_nights` (existing). API tests for all three.
- [x] `PUT` switching an overnight party that holds beds to day-only frees all its slots, returns them in `freed`, drops its `places`, writes one audit entry. Switching back to `arrive`/`leave` works. API tests.
- [x] Startup (`_data_problems`) uses `is_present` (no `None` comparisons) and refuses a stored party that breaks any mode rule above, with a precise path, e.g. `parties[2].day_visits: day 2026-11-05 is outside the event (2026-10-29 – 2026-11-01)`. A `places` entry on a day-only party is reported as "outside the stay". `tests/test_store.py` covers each rule and that an existing data file without `day_visits` loads unchanged; a day-only party survives a save → load round trip.
- [x] `uv run pytest` passes; `node --test tests/js/` still passes.

## Notes for developer
- Rules live only in `validate.py` (reuse `_invalid`). Keep one shared mode check that both the request path and `_data_problems` call, so the rules cannot drift.
- `None` pitfalls: `stay_shortening` (lambda `arrive <= night < leave`), `check_party_update`, `_data_problems` (`party.arrive <= night < party.leave`), `party_nights`. With no stay, `stay_shortening` returns all of the party's slots.
- A day-only party with `kids > 0` is fine; only `kids_in_parents_bed` must be 0 (the form sends 0).
- `day_visits` items are ISO strings in quotes in YAML, like all dates. Overnight parties may be written with or without `day_visits: []`; both must load.
- Do not touch phase 2 (`llm.py`, `/api/ai/*`). The page changes come in T-037 … T-041.

---
## Dev log
- `PartyInput`: `arrive`/`leave` are `IsoDate | None`, new `day_visits` (max 10, sorted by a field validator, so it is stored ascending). Mode is not checked by Pydantic.
- `validate.py`: `is_day_only`, `event_days`, `check_stay_mode` (mixed, empty, incomplete), `check_day_visits` (duplicate, outside, kids in bed), `check_stay_shape` (both, shared with the startup check), `check_party_stay` (shape + `check_stay` for overnight; used by create and update). `is_present` returns False without a stay; `stay_shortening` accepts `None` and then frees everything. `needed_on_night`, `party_nights`, `check_assign`, `check_places`, `check_assign_stay`, `adjust_places` work through `is_present`, so they needed no change. `main.py` needed no change.
- `store.py` `_data_problems`: calls `check_stay_shape` per party (path `parties[i].<field>: <message>`) and uses `is_present` for `places`.
- `proposal.md`: one bullet under `data/cabin-data.yaml`.
- Tests: `tests/test_validate.py`, `test_models.py`, `test_store.py`, `test_api_write.py`. `test_validate_module_has_no_io_or_fastapi_imports` whitelist now allows `datetime` (pure, used by `event_days`).
- Commands: `uv run pytest` (501 passed), `node --test tests/js/` (224 passed).
- Deviations: RuleError messages must be ASCII (existing test), so the startup message reads `(2026-10-29 to 2026-11-01)` instead of an en dash. Startup does not run `check_stay` (arrive/leave allowed days) for overnight parties, as before. Sleeping entries of a day-only party are not flagged at startup (the existing check never compared `sleeping` with presence); only `places` is, as specified.

## Review round 1
Ran `uv run pytest` (501 passed) and `node --test tests/js/` (224 passed). Every acceptance criterion is met and has a test: the mode order in `check_stay_mode` / `check_day_visits` matches the spec, `is_present` / `stay_shortening` / `_data_problems` no longer compare `None`, the request path and startup share `check_stay_shape`, `day_visits` is sorted by the model, `[]` is stored for overnight parties, arrive/leave are `null` in JSON, PUT to day-only frees all slots and drops `places` with one write and one audit entry, and switching back works. `main.py` needed no change because `adjust_places` and the assign, places and assign-stay checks all go through `is_present`. The two documented deviations (ASCII "to" in the startup message, no startup check of `sleeping` against presence) are consistent with the existing code.

No blockers.

- **Suggestion**: `app/validate.py:84-88` `event_days` assumes `arrive_days` and `leave_days` in `cabin.yaml` are sorted, and `Event` does not enforce that. If the organizer lists them out of order, the range can come out wrong or empty. When it is empty, the `days[0]` in the `day_outside_event` message raises `IndexError` and the request fails with a 500. Use `min(arrive_days)` / `max(leave_days)`, or require sorted lists in `Event._check_days`.
- **Suggestion**: the startup check does not flag `sleeping` entries that belong to a day-only party. This is the same gap that already exists for overnight parties outside their stay. If it is ever wanted, it belongs in a separate task.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester: claude-haiku-5-5, 24. 10. 2026. Verdict: PASS, no regressions.

**Commands (run once for the suite)**
- `uv run pytest -q`: 501 passed in 3.89 s.
- `node --test tests/js/`: 224 passed, 0 failed.
- Probes: temporary server `uvicorn` on `127.0.0.1:8777` with `create_app(data_dir="/tmp/t036/data", env={test secrets})`, driven with `httpx`. Startup probes used `create_app` on temporary directories with hand-written YAML. Scripts in `/tmp/t036/` (outside the repo). No real `data/` or `.env` was touched. The server was stopped afterwards.
- Pure-function spot check: `event_days` returned `['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']`, `is_present` was False on all nights for a day-only party, and `party_nights` returned `[]`.

**Acceptance criteria**

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `PartyInput` arrive/leave optional, `day_visits` max 10, shape only | PASS | Day-only create 200 with `arrive: null`. 11 items → 422 `invalid` (pydantic). Non-padded, datetime and bad dates → 422 |
| 2 | `event_days` derived from the layout | PASS | Four days, see above. Boundary days 10-29 and 11-01 accepted, 10-28 and 11-02 → `day_outside_event` |
| 3 | `is_day_only`, `is_present` False without `None` comparison, `needed_on_night` 0 | PASS | Spot check above. `needed_on_night` returns 0 through `is_present`. Startup and PUT paths run without TypeError |
| 4 | Check order and reasons (mode, incomplete, duplicate/outside, kids) | PASS | Mixed+outside → `stay_mode_mixed`. Empty+kids → `day_visits_empty`. Duplicate+kids → `duplicate_day`. Incomplete+kids → `stay_incomplete`. Each has `params.reason` and `params.field` |
| 5 | Stored sorted, `day_visits: []` for overnight, `arrive`/`leave` null for day-only | PASS | Unsorted input stored ascending. Overnight with `[]` or without the key both stored `[]`. State JSON checked |
| 6 | assign / places → 409 `not_present`, assign-stay → 422 `invalid` `no_event_nights` | PASS | Live responses: 409 `not_present`, 409 `not_present`, 422 `invalid` with `reason` `no_event_nights`. Version and audit unchanged |
| 7 | PUT overnight-with-beds → day-only frees all slots, `freed`, drops `places`, one audit entry; switching back works | PASS | Four freed entries returned, `sleeping` empty for the party, `places` `{}` (FRI=1 had been set), audit 12 → 13 documents, version 12 → 13. Switch back 200, `freed: []`. Four bad PUTs (kids in bed, arrive only, mixed, empty) → 422 with correct reasons, version and audit unchanged |
| 8 | Startup refuses each broken mode rule with a precise path; legacy file loads; day-only survives save and load | PASS | See scenario list. Round trip: restart loaded 9 parties with `day_visits` intact. Legacy file with overnight parties and no `day_visits` key loads |
| 9 | `uv run pytest` and `node --test tests/js/` pass | PASS | See commands |

**Extra scenarios tried**
- Startup refusals (message text checked): day outside event (`parties[0].day_visits: Day 2026-11-05 is outside the event (2026-10-29 to 2026-11-01)`), places on a day-only party (`parties[1].places.2026-10-29: night is outside the stay of the party`), places on a night not in the event (`night is not in event.nights of cabin.yaml`), arrive only with `day_visits: []` (`parties[1].leave: Only one of arrive and leave is given: leave is missing`), leave only, mixed stored, `kids_in_parents_bed` 1 on a day-only party, duplicate stored day, empty stored party (`day_visits_empty`), and a day outside on the early side.
- Unsorted stored `day_visits` loads and is sorted.
- Day-only with zero people (0 adults, 0 kids) is accepted. Overnight parties accept 0 people too (`Count` is `ge=0`), so this is consistent and not a finding.
- Overnight with `day_visits: null` → 422 `invalid`. Day-only with an extra `places` key → 422 `invalid`.
- `/data/cabin-data.yaml`, `/data/audit.yaml`, `/static/../data/cabin-data.yaml` and `/api/../data/cabin-data.yaml` all → 404.
- Stored `day_visits` survive a process restart (`/api/state` after restart matches).

**Notes (not failures)**
- Day-only with `kids: 0` and `kids_in_parents_bed: 1` is rejected by the existing pydantic rule (`kids sleeping in the parents' bed cannot exceed the number of kids`, 422 `invalid`, `params` has only `field`, no `reason`). The `day_only_kids_in_bed` reason appears only when `kids` ≥ 1. The request is still refused on the right field, so I count it as a pass. The page (T-038) will then get no `reason` for this case and must use the generic message for `kids_in_parents_bed`.
- The reviewer's suggestion about unsorted `arrive_days` in `event_days` was not applied. The current `cabin.yaml` is sorted, so this does not affect any criterion.
- Existing tests cover each rule (`test_store.py` parametrized startup cases, `test_validate.py` mode order, `test_api_write.py` create, PUT, and not_present). I did not add tests, since the gaps were not small enough to need them.
- Manual checks: T-036 has none. The page checks belong to T-037 to T-041. `tests/manual.md` is unchanged.

**Decision:** all criteria pass and there are no regressions, so the task moves to `tasks/done/`.
