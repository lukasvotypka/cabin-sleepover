# T-033: Per-night places override („Vo štvrtok nás viac nebude“)

- **Phase:** 1
- **Depends on:** T-032
- **Size:** L (kept as one task on request; do Part A, then Part B)

## Goal
Organizer's decision of 24. 10. 2026: when one member of a party arrives earlier or leaves later, the party records fewer needed places for that night from the map. The form keeps describing the whole party. See `proposal.md`: "Dáta v YAML" → `data/cabin-data.yaml` (the `places` bullet), "HTTP API" → Endpointy (`POST /api/places`), and "Informácie v scéne" → Tabuľka s partiou a stavom.

## Scope
- Part A (server): `app/models.py`, `app/validate.py`, `app/store.py` (`_data_problems`), `app/main.py`, `tests/test_models.py`, `tests/test_validate.py`, `tests/test_store.py`, `tests/test_api_write.py`.
- Part B (page): `static/js/logic-model.js`, `static/js/logic-errors.js` (only if a new `reason` is added), `static/js/app-draw.js` (status board button), `static/js/app-actions.js` (the write), `tests/js/logic.test.mjs`.

## Acceptance criteria
Part A
- [x] `Party` has `places: dict[str, int]`, default `{}`, with keys as ISO night strings and strict int values ≥ 1. It is saved in `cabin-data.yaml` and returned in `state`. An empty `places` may be left out of the YAML or kept as `{}`, but it must load either way. `PartyCreate`/`PartyUpdate` do not accept `places`, so the form cannot overwrite it.
- [x] `needed_slots(party, night)` (or a new `needed_on_night`) returns 0 when the party is absent, `places[night]` when set, and otherwise the full count. The existing callers and tests are updated.
- [x] Pure helpers in `validate.py`, with unit tests: `check_places(state, layout, party_id, night, places)` and `adjust_places(party)`. `check_places` raises `unknown_party`, `invalid` for an unknown night, `not_present`, or `invalid` (`params.reason` = `places_out_of_range`) unless 1 ≤ places ≤ full. `adjust_places` drops nights outside the stay, lowers values above the full count to it, and removes entries equal to the full count. A third helper raises the override to the placed count after a write and removes it once it reaches the full count.
- [x] `POST /api/places` `{party_id, night, places}` follows the write path: group cookie, write rate limit, `signup_closed` unless admin, lock, validate, `version` bump, audit (action `places`, source `map`, with before/after values). It returns `{ok, state}`. Setting `places` = full count removes the night's entry.
- [x] `PUT /api/parties/{id}` applies `adjust_places`. Tests: a shorter stay drops the override, a lower full count clamps it, a higher full count keeps it.
- [x] `/api/assign` and `/api/assign-stay` raise the override when the party's placed count on that night goes above it, and remove it at the full count. `/api/clear` and `/api/move` never lower it. API tests cover each case.
- [x] Startup refuses with a precise message (path such as `parties[0].places.2026-10-30`) for: a night not in `event.nights`, a night outside the party's stay, a value < 1, a value > the full count. `tests/test_store.py` covers each one.

Part B
- [x] `neededOnNight(party, night)` uses `party.places[night]` when present, capped at `neededSlots(party)`. `nightTally`, `missingPlaces`, `waitingFigures`, the signpost chip, the party table, „Kto je kto“ and `summaryText` all follow it with no extra code paths.
- [x] New pure `fewerPlacesAction(state, party, night)` returns `null` unless the party is present, 1 ≤ placed < needed. Otherwise it returns `{night, places: placed, text}`, where text = capitalized `dayLocative(night)` + " nás viac nebude".
- [x] Panel, not a button on the map (organizer approved the mockups on 24. 10. 2026). The red status board stays as is. Tapping it when its night is not selected still selects that night. When its night **is** already selected (`app.night`), the tap opens a panel (`openPanel`) titled with the capitalized day name (e.g. „Štvrtok“):
  - placed ≥ 1: text „Vo štvrtok máš 1 miesto, chýbajú ti ešte 2.“ and „Ak vo štvrtok nebudú všetci, ťukni nižšie. Ostatné noci sa nemenia.“, primary `.btn` „Vo štvrtok nás viac nebude“ (from `fewerPlacesAction`), secondary `.btn secondary` „Ešte hľadám posteľ“ (closes the panel).
  - placed = 0: text „Vo štvrtok ešte nemáš žiadne miesto, chýbajú ti 3.“ and „Ak vo štvrtok nepríde nikto, uprav si príchod.“, primary „Upraviť príchod a odchod“ (opens the party form), secondary „Ešte hľadám posteľ“.
  - Correct Slovak plurals for the counts (reuse `pluralPlaces`/`missingVerb`); all text built in pure logic functions with Node tests, set via `textContent`; buttons full width, ≥ 44 px.
  - The primary button posts `/api/places` through the existing write/rollback path, closes the panel and re-renders from the returned state. On error it shows `errorText`.
  - Reference mockups: `/tmp/cabin-mock-site/shots/*.png` (if still present).
- [x] Node tests: `neededOnNight` (no override, override, override above full, absent night); `fewerPlacesAction` labels for every day locative (Mon–Sun, e.g. „Vo štvrtok…“, „V stredu…“) and the null cases (placed 0, placed ≥ needed, absent); `waitingFigures` with an override shows only the missing places, keeping the first kinds in order; `summaryText` and the legend/„Kto je kto“ parts show e.g. „Št 1/1“ with an override.
- [x] `uv run pytest` and `node --test tests/js/` pass. No new script file (if one is added, list it in `index.html` with `?v=__ASSET_VERSION__`).

## Notes for developer
- The page sends an explicit `places` (= its placed count) rather than "set to current". The server only checks the range, so a stale page cannot set an invalid value.
- `places` is not part of `PartyInput` on purpose. A form `PUT` keeps the stored overrides and then runs `adjust_places`.
- Raising back is automatic (organizer's default). Do not add a „predsa nás bude viac“ link. Releasing a bed never lowers the override.
- `dayLocative` already exists in `logic-model.js`. Reuse it.
- The new Slovak UI text lives only in logic tables or functions. If you add `places_out_of_range`, add it to `REASON_TEXTS`.
- The meadow trim follows from `missingPlaces`, because `figureKind(party, placed + k)` keeps the existing order.

---
## Dev log

Part A: `Party.places` (not in `PartyInput`), `PlacesRequest`, `POST /api/places`, validate helpers `needed_on_night`, `placed_on_night`, `check_places`, `set_places`, `adjust_places`, `raise_places_to_placed`; `assign` and `assign-stay` raise the override, `PUT` runs `adjust_places`, `clear`/`move` never lower it; startup checks in `_data_problems` (`parties[i].places.<night>`; value < 1 is caught by the model).
Part B: `neededOnNight` honours the override, `dayTitle`, `fewerPlacesAction`, `placesPanelInfo` (logic-model.js); `places_out_of_range` in `REASON_TEXTS`; red status board opens the panel (`openPlacesPanel`, `sendPlaces` in app-actions.js) when its night is already selected, else selects the night; `.places-panel .btn` full-width CSS in index.html.
Deviations: kept `needed_slots(party)` as the full count and added `needed_on_night` (allowed by the task). Panel texts follow tykanie (coordinator correction); the plural-2nd-person guard keeps its original rules except `ešte` (an adverb) is added to `TE_ALLOWED`.
Not checked in a browser; mockups in /tmp not consulted.
Commands: `uv run pytest` (460 passed), `node --test tests/js/` (219 passed).


## Review round 1

Ran `uv run pytest` (460 passed) and `node --test tests/js/` (219 passed). No new script file; all 19 scripts in `static/js/` are listed in `index.html` with `?v=__ASSET_VERSION__`.

Checked against the criteria and the proposal:
- `Party.places` is strict int >= 1 keyed by `NightRef`, default `{}`, absent from `PartyInput`, so `PartyCreate`/`PartyUpdate` reject it and a form `PUT` keeps it (the setattr loop only touches input fields).
- `POST /api/places` has group auth, `Limited`, `check_signup_open` inside the lock, validation, version bump through `store.write`, and an audit with action `places`, source `map`, before/after. Full count removes the entry.
- `check_places` order (unknown_party, invalid night, not_present, `places_out_of_range`) and the `params` match. `adjust_places` drops entries >= full, which is the same as "clamp to full, then remove at full". `raise_places_to_placed` only raises the value and is called after assign and assign-stay. Clear and move do not touch it.
- `_data_problems` reports `parties[i].places.<night>` for an unknown night, a night outside the stay, and a value above full. A value < 1 is caught by the model with the same path prefix. Tests cover each case.
- Page: `neededOnNight` caps the override at the full count, and every caller goes through it (no other `neededSlots` use). `placesPanelInfo`/`fewerPlacesAction` are pure and tested for every weekday locative, the plurals and the null cases. The panel uses `htmlEl` (textContent) and full-width `.btn`. The write goes through `write()`, so the state is reapplied and errors show `errorText`. The status board picks the night when it is not selected and opens the panel when it is.

Blockers: none.

Suggestion:
- `app/validate.py` `adjust_places` docstring says "clamp", but the code removes the entry (the result is the same). A one-word docstring fix would avoid confusion later.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester: haiku-5.5 (test pass on uncommitted working tree, 24. 10. 2026)

**Result: PASS.** No functional failures. Device-only checks went to `tests/manual.md` (T-033 items, four new lines at the end). No application code changed. No new tests added (existing tests cover the rules).

Environment note: `uv` and `node` are not on the default PATH here. Ran with `PATH=/opt/homebrew/bin:$PATH`.

### Commands and results
- `uv run pytest` → 460 passed in 3.55 s.
- `node --test tests/js/` → 219 pass, 0 fail.
- In-process API probes (httpx ASGI, temporary `data/` dir, `monotonic` clock advanced per call so the write limit does not interfere): `/tmp/t33probe/probe.py`, `probe2.py`. Result: all pass except three probe-side expectations that I corrected and re-ran (not app bugs).
- Pure page logic with the real `/api/state` layout (Node vm, `static/js/logic-*.js`): `/tmp/t33probe/js-probe*.mjs`.
- One temporary uvicorn on 127.0.0.1:8031 (stopped afterwards, port 8010 untouched): `/api/health` ok; `/data/cabin-data.yaml`, `/config/cabin.yaml`, `/app/main.py` and `/static/../data/...` → 404; `/api/state` and `POST /api/places` without cookie → 401; `GET /` serves `?v=<hash>` for scripts and no `__ASSET_VERSION__` left.

### Acceptance criteria
| Criterion | Result | Evidence |
| --- | --- | --- |
| A1 `Party.places` dict, default `{}`, strict int ≥ 1, saved and returned, not in Create/Update | PASS | new party `places: {}`; POST and PUT with `places` → 422; YAML keeps `'2026-10-30': 1`; YAML without the key loads; bool and string values refused at startup |
| A2 `needed_on_night`: 0 absent, override, else full; callers updated | PASS | pytest; JS `neededOnNight` 3 / override 1 / above full → 3 / absent 0 |
| A3 `check_places` and `adjust_places` helpers and the raise helper | PASS | pytest 460; probes: unknown_party, invalid night, not_present, `places_out_of_range` for 0, 4, -1 |
| A4 `POST /api/places`: cookie, limit, signup lock, validate, version, audit, `{ok,state}`, full removes entry | PASS | 401 without cookie; group 403 `signup_closed` when locked, admin allowed; full count removes entry; audit doc `action: places, source: map` written. Audit `before`/`after` fields are set in code (not inspected in the YAML). |
| A5 PUT runs `adjust_places` (shorter stay drops, lower full clamps, higher full keeps) | PASS | arrive moved to SAT drops FRI; full 3→2 with override 2 removes it; full 3→4 keeps override 1 |
| A6 assign and assign-stay raise; full removes; clear and move never lower | PASS | assign 1→2 raises; assign-stay raises to full and removes; clear and move keep 2 |
| A7 startup refusals with path (`parties[0].places.<night>`) for night not in nights, outside stay, < 1, > full | PASS | messages: `parties[0].places.2026-10-28: night is not in event.nights of cabin.yaml`; `…2026-10-31: night is outside the stay of the party`; `…2026-10-30: Input should be greater than or equal to 1 (got: 0)`; `…2026-10-30: 9 is more than the 4 places the party needs` |
| B1 `neededOnNight` used by tally, missing, waiting figures, signpost, table, „Kto je kto“, summary | PASS | `nightTally` 1/1 with override, table cell „Št → Pi 1/1“ (no override: „1/3!“); `waitingFigures` with override 2 and 1 placed → one adult; `summaryText` shows „Ivan: v piatok chýbajú 3 miesta“ when no override |
| B2 `fewerPlacesAction` returns `{night, places, text}` or null | PASS | locatives: V pondelok, V utorok, V stredu, Vo štvrtok, V piatok, V sobotu, V nedeľu nás viac nebude; null for placed 0, placed = needed, override = placed, absent night |
| B3 status board opens panel when its night is selected, else selects it; panel texts; buttons; `errorText` on error | PASS (logic and wiring); tap behaviour manual | `placesPanelInfo` texts for placed 1 and 0 match the spec; `openPlacesPanel` in `app-actions.js`, board tap in `app-draw.js`; `sendPlaces` uses `write()` and `errorText`. Actual tapping, layout and 44 px targets not run in a browser → `tests/manual.md`. |
| B4 Node tests for neededOnNight, fewerPlacesAction, waitingFigures, summaryText, legend | PASS | 219 Node tests pass; behaviour re-checked by hand as above |
| B5 `uv run pytest` and `node --test tests/js/` pass; no new script without `?v=` | PASS | 460 and 219 pass; no new script file |

### Extra scenarios tried
- No cookie on `/api/places` → 401. Unknown party → 404 `unknown_party`. Unknown night `2026-10-28` and malformed `2026-1-30` → 422. Extra field → 422.
- Strict ints: `true`, `"2"`, `1.0`, `null` refused with 422.
- Absent night (party leaves on FRI, asked for SAT or FRI) → 409 `not_present`. Full count on an absent override → no entry.
- Stale page: setting places when placed is already above it is accepted and stored, no crash.
- Two concurrent `assign` calls for the same slot on SAT via `asyncio.gather` → one 200, one 409 `slot_taken`.
- Restart on the same `data/` dir keeps `places`.
- Startup with a raw unquoted `2026-10-30: 1` key → refused. Observation only: the message is `parties[0].places.datetime.date(2026, 10, 30).[key]: Input should be a valid string`. It names the path, but the text is not as readable as the others. Not a criterion. Optional polish for the developer.
- The `adjust_places` docstring says "clamp", but the code removes entries at or above the full count. Reviewer already noted this. Behaviour is correct.

### Not verifiable here (in `tests/manual.md`)
- Tapping the red board twice (select, then panel), panel layout, full-width buttons and the 44 px touch targets on iPhone Safari and Android Chrome, light and dark.
- Two devices: the other phone sees the lower need after refresh.
- The mockups in `/tmp/cabin-mock-site/shots` were not compared.

### Bugs
None found.
