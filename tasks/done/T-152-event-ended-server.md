# T-152: After the event, the server hides who slept where (`ended`, `event_ended`)

- **Phase:** 1
- **Depends on:** none
- **Size:** M
- **UX:** no

## Goal
From the day after the event the server sends nobody's sleeping data to non-admins and refuses their writes, so the page can show the closed cabin (T-153). Proposal section „Po akcii: zatvorená chata“, error list in „HTTP API“ (`event_ended`), open decision „Po akcii, zatvorená chata“.

## Scope
- `app/models.py` (layout: optional `event.ended`), `app/main.py` (`ended` flag, reduced state, write guard, SSE/SMS/seen off), `app/events.py` if the stream needs it.
- `static/js/logic-errors.js`: Slovak text for `event_ended`.
- `config/cabin.yaml`: commented `ended: auto` line under `event`.
- Tests: new `tests/test_api_ended.py`; `tests/conftest.py` (default "today" before the event); a Node test for the new error text in `tests/js/logic.test.mjs`.
- `README.md` (the switch, the manual clean-up step), `tests/manual.md` (closed-state check, manual clean-up).

## Acceptance criteria
- [x] Pure function (e.g. `event_is_ended(event, today: date) -> bool`): `ended: true` → true, `false` → false, `auto` or missing → `today > max(leave_days)`. Pytest: 2026-11-08 false, 2026-11-09 true for the real `cabin.yaml`; overrides both ways.
- [x] Any other `event.ended` value refuses startup with a precise English `ConfigError` (pytest).
- [x] "Today" is the date in Europe/Bratislava (`store.TIMEZONE`), taken per request from an injectable source in `create_app` (no restart needed at midnight). `conftest.make_app` defaults to a date before the event, so the existing suite passes unchanged.
- [x] Every `state` has `ended` (bool). When ended and no admin cookie, `state` has exactly `version`, `updated_at`, `event`, `layout`, `ended`, `totals`, `asset_version`, and no `parties`, `sleeping`, `briefing`, `presence`, `info`, `phone_verify`, `signup_open`. The same holds for the `state` in error bodies. Pytest checks the key set for `/api/state` and for an error response, and checks that no party name, id or `phone_hint` appears anywhere in the JSON.
- [x] `totals` = `{people: Σ(adults + kids) over all parties, parties: number of parties, nights: len(event.nights)}`. Pytest with day-only and normal parties.
- [x] With the admin cookie the state is the full state as today, plus `ended: true`.
- [x] When ended, all writes without the admin cookie return `403 event_ended` (English `message`, reduced `state`) and change nothing: `assign`, `assign-stay`, `clear`, `move`, `POST/PUT /api/parties`, `places`, `briefing`, `food`, all `login/*` and `phone/*`. No backup and no audit entry. Parametrised pytest; admin `assign` still succeeds.
- [x] `GET /api/events` without admin returns `403 event_ended` JSON. A group stream opened before the flip gets no more `state`/`presence` with party data after it and is closed by its next ping at the latest (pytest with the injected date).
- [x] When ended, `X-Party-Id` writes nothing to `seen.yaml`, and `/api/session` returns `{verified: [], sms_enabled: false}` for non-admins.
- [x] The ETag includes `ended` and the reduced-vs-full shape: an `If-None-Match` from before the flip gets `200`, not `304` (pytest).
- [x] `/api/health` and `/api/join` unchanged.
- [x] `logic-errors.js` maps `event_ended` to „Chata je zatvorená, zapisovať sa už nedá.“ (Node test).
- [x] No code deletes or rewrites `data/` files because the event ended (review check). README and `tests/manual.md` describe the manual steps: removing `phone` from `cabin-data.yaml` with the service stopped, archiving `data/`.
- [x] `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
- Defaults from the open decision „Po akcii, zatvorená chata“ in `proposal.md`. Questions Q28–Q30 in `tasks/QUESTIONS.md`.
- Today is 2026-11-20, so the trial server shows the closed state as soon as this ships. To try the normal app locally, set `event.ended: false` in a copy of the config, not in the committed file.
- `FakeClock` in `conftest.py` starts at 1_800_000_000 (January 2027, after the event). Do not derive "today" from that clock, or every existing test hits `event_ended`.
- `signup_closed` and `login_required` checks come after `event_ended`: when ended, the code is always `event_ended`.
- Error bodies call `state_payload` in `error_response`. Shape the state by role in one place, so no path leaks the full state.
- Keep the data file and its startup validation as they are. The reduced view is only the output.

## Design

---
## Dev log

- Added `Event.ended` (`auto`/true/false, server-only, `exclude=True` so the page's `event` is unchanged; bad values give a `ConfigError`), `event_is_ended` and `event_ended` (403) in `app/validate.py`.
- `app/main.py`: `Runtime.ended()` with injectable `today` (`create_app(today=...)`, default Europe/Bratislava date per request); `state_payload` is the one place that shapes the state: after the event non-admins get the reduced state with `totals`, admins the full one plus `ended`. The role comes from `REQUEST_IS_ADMIN` (ContextVar set by a pure ASGI `AdminContextMiddleware`, default False = safe), so error bodies are covered too. `require_group` refuses non-GET without admin with `event_ended` before anything else and skips `seen`; `/api/events` refused for non-admins, an open stream stops at its next frame (state, presence or ping) once ended; `/api/session` is empty; presence broadcasts are off; ETag has a `closed`/`ended` suffix.
- Slovak text for `event_ended` in `logic-errors.js`; commented `ended: auto` in `config/cabin.yaml`; README section and `tests/manual.md` section 24.
- Tests: new `tests/test_api_ended.py` (33), `BEFORE_EVENT` and `today` default in `conftest.make_app`; direct `create_app` calls in `test_info.py`, `test_sms.py` and the uvicorn snippet in `test_api_events.py` now pass `today`; `ended` added to `STATE_KEYS`; Node test for the text.
- Commands: `uv run pytest` (779 passed), `node --test tests/js/` (472 passed).
- Note: the page (T-153) must handle `state.ended`; until then the trial server (today is after the event) shows a state without `parties` and the current page will likely break. Streams with `?party=` for admin when ended get no presence frames.
- The "review check" box (no code deletes data) holds: nothing touches `data/` for this.

## Review round 1

Ran `uv run pytest` (779 passed) and `node --test tests/js/` (472 passed). Every acceptance criterion checked in the code and in `tests/test_api_ended.py`. Role shaping is in one place (`state_payload` + `REQUEST_IS_ADMIN`, safe default False), set by a pure ASGI middleware outside the exception handlers, so error bodies are covered. `event_ended` comes before `signup_closed`/`login_required` and before any seen record. Admin login still works after the event (it goes through `/api/join`). `ended` is `exclude=True`, so `event` on the page is unchanged. Nothing deletes `data/`.

**Blockers:** none.

**Suggestions**
- `app/main.py` `on_commit` (about line 754): `payload["presence"]["online"]` raises `KeyError` if a commit runs while `ended` and outside an admin request. Today that only happens in a rare race: a non-admin write passes `require_group` just before midnight on 8./9. 11. and commits just after it. The file is written, then the hook raises inside the lock and the client gets a 500. Use `payload.get("presence")` or build the hook payload with full state on purpose. This is not a leak, because non-admin streams break before they yield.
- Orchestrator: today is after the event, so once this ships the trial server sends the reduced state and the current page (before T-153) will likely break. Ship it together with T-153, or run the trial server on a config copy with `ended: false` until then.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

Scope: the fix diff for the tester's bugs (`app/store.py`, the changed parts of `app/main.py`, the new tests in `tests/test_api_ended.py`). Ran `uv run pytest -q` (781 passed) and `node --test tests/js/` (472 passed).

- Bug 1 (admin presence): fixed. `refresh_presence` now always publishes, and non-admin streams break on any frame after the event, so they get no presence. The admin ETag carries presence unless the response is reduced. `seen.record` stays off after the event. Covered by `test_admin_presence_stays_live_after_the_event`.
- Bug 2 (write across midnight): fixed. `Store.before_write` runs under the lock before the load, and an `ApiError` raised there leaves the context manager before `yield`, so there is no write, backup or audit. The error body is reduced through `state_payload`. `on_commit` now builds the full payload on purpose, which also clears the round-1 `KeyError` suggestion, and admin streams never get the reduced shape. Covered by `test_write_passing_the_guard_before_midnight_is_refused_at_commit`.
- Logout exemption: fine. It touches no data and only clears the caller's own cookie. A test covers it.

**Blockers:** none.

**Suggestion**
- `app/main.py` `require_group`: the logout exemption compares `request.url.path != "/api/logout"`. If the app runs under a sub-path with `root_path` set, the path no longer matches and logout gets `event_ended` again. That is harmless but inconsistent. A route-based check would hold up better, for example a flag on the route, or matching `request.scope.get("route")`.

Verdict: APPROVED

## Test report

Tester run (uncommitted working tree, 20. 11. 2026, date injected per probe).

Commands and results:
- `uv run pytest -q`: 779 passed in 15.6 s.
- `node --test tests/js/`: 472 passed, 0 failed.
- Probes (scratch scripts outside the repo, `create_app` on a temp `data/`, test secrets, httpx ASGI transport, injected `today`):
  - `probe_t152.py` (44 checks, 42 pass; the 2 failures were a wrong assign body in the probe, `slots` not `slot`, re-run in probe 2 with the right body).
  - `probe2_t152.py`: presence after the flip and the boundary race.
  - `probe3_t152.py`: startup with `ended` set to `"yes"`, `1`, `"true"`, `null` (refused with a precise `ConfigError`), `true`, `false`, `auto` (accepted); `ended` never in `layout_json["event"]`.

Acceptance criteria:

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `event_is_ended` pure, overrides both ways, 11-08 open, 11-09 closed | PASS | probe (admin `ended` false on 11-08, reduced on 11-09), suite |
| 2 | Other `ended` values refuse startup, English `ConfigError` | PASS | probe3 (`"yes"`, `1`, `"true"`, `null`) |
| 3 | Today in Europe/Bratislava per request, injectable, suite unchanged | PASS | code (`TIMEZONE`, `rt.today`), suite passes with `BEFORE_EVENT` default |
| 4 | Reduced state key set exact, no names, ids or phone | PASS | probe: key set equal, no "Ivan"/"Denny"/id in body; error body reduced too |
| 5 | `totals` | PASS | probe: `{people: 5, parties: 2, nights: 3}` |
| 6 | Admin gets the full state plus `ended: true` | FAIL (minor, bug 1) | state contents PASS; presence goes stale after the flip |
| 7 | All listed writes refused with `403 event_ended`, nothing changed | PASS (bug 2 at the boundary) | probe: 19 write routes (assign, assign-stay, clear, move, parties POST/PUT/DELETE, places, briefing, food, login/*, phone/*, logout, admin signup) all 403 `event_ended`; data files and backups byte-identical; admin assign still 200 |
| 8 | `/api/events` refused for non-admin; open stream closed after the flip | PASS | probe: 403 `event_ended`; suite `test_open_stream_is_closed_after_the_flip` |
| 9 | No `seen` write and empty `/api/session` when ended | PASS | probe: session `{ok, verified: [], sms_enabled: false}`; code guards `seen.record`; suite |
| 10 | ETag shape: closed ETag after the flip, 200 when open again | PASS | probe: 304 with own closed ETag, 200 when day moved back |
| 11 | `/api/health` and `/api/join` unchanged | PASS | probe: health 200 without cookie, admin join works |
| 12 | `event_ended` Slovak text | PASS | Node test (`Chata je zatvorená, zapisovať sa už nedá.`) |
| 13 | No code touches `data/`; README and manual describe the clean-up | PASS | README lines 236–240, `tests/manual.md` lines 348–350; refused writes left files intact |
| 14 | `uv run pytest` and `node --test` pass | PASS | 779 and 472 |

Extra scenarios tried:
- Boundary: 2026-11-08 open, 2026-11-09 closed, ETag from the closed state gives 200 on an open day.
- Writes without cookie: still 401 `bad_code`, not `event_ended`. Writes with a bad body and without `X-Client-Id` after the flip still answer `event_ended` (the guard runs first).
- Health and public routes unchanged, and an admin-only `DELETE /api/parties/{id}` from a group cookie gets `event_ended`.
- Admin presence after the flip (bug 1).
- Write in flight across midnight (bug 2).

Bug 1 (minor): admin presence freezes after the event.
- Steps: with `today` = 2026-11-08, a party polls with `X-Party-Id` (`GET /api/state`). Move `today` to 2026-11-09. Admin `GET /api/state` (200, `presence.online` contains the party, ETag `…-ended`). Advance the clock 200 s. Admin `GET /api/state` with `If-None-Match` from the previous response.
- Expected: presence recomputed as today (online empty), the ETag carries the presence, so a fresh 200 with the new presence.
- Actual: 304. The admin keeps showing the party as online. Also `refresh_presence` returns early when ended, so admin streams never get `presence` frames after the flip, and `state_payload` drops presence from the ETag (`presence = None if rt.ended()`).
- Probable fix: keep presence for admins after the event (`presence` in the ETag and `refresh_presence` for admin streams) and keep the reduced shape only for non-admins. Maybe keep `seen.record` off for everyone, as the spec says, but not the presence readout.

Bug 2 (minor, boundary race): a non-admin write that passes `require_group` before midnight is committed after it.
- Steps: `today` returns 2026-11-08 on the first call and 2026-11-09 afterwards (simulates the flip between the guard and the commit). Group client `POST /api/assign` with `slots: ["konica-lower-mat-1"]`.
- Expected: 403 `event_ended`, no write, no frame.
- Actual: 200 `ok`, the write lands, and the commit hook publishes a reduced frame (`asset_version, ended, event, layout, totals, updated_at, version`, no parties) to every stream, including admin streams. An admin page would show no parties until its next full frame.
- Probable fix: decide `ended` inside the store lock (or in the commit hook) for the write itself, and never publish the reduced payload to admin streams; the admin stream should get the full payload.

Not a failure, for the developer to confirm: `POST /api/logout` by a group user is refused with `event_ended` after the flip (the spec lists `login/*` and `phone/*`, not logout), so a party cannot clear its own cookie after the event.

Verdict: FAIL (criterion 6 and the boundary write). Moved back to `in-progress`.

Trial server: the change is uncommitted; `https://lukass-laptop-1.tail3bf463.ts.net:8443/` still shows the committed build until restarted. No screenshots (backend only).

## Dev log (fix round, tester bugs)

- Bug 1 fixed: presence is kept for the admin after the event. `refresh_presence` no longer returns early (non-admin streams are cut before any frame anyway), `GET /api/state` keeps presence in the ETag unless the response is reduced. `seen.record` stays off after the event.
- Bug 2 fixed: new `Store.before_write` hook, called under the write lock; `main.py` sets it to refuse non-admin writes with `event_ended` when the event has ended at commit time. `on_commit` now builds the full (admin) payload for the hub, so a stream never gets the reduced shape from a commit; non-admin streams are closed before sending after the event.
- Logout: `POST /api/logout` is exempt from the `event_ended` write guard (it only clears the caller's own cookie). Removed it from the refused-writes test list.
- Tests added in `tests/test_api_ended.py`: logout open after the event, write refused at commit after a flip between guard and lock, admin presence refreshed and ETag changing after the event.
- Files: `app/main.py`, `app/store.py`, `tests/test_api_ended.py`.
- `uv run pytest -q`: 781 passed.

## Test report (re-test after fixes, 20. 11. 2026)

Tester run on the uncommitted working tree (`today` injected per probe, temporary `data/`, test secrets, httpx ASGI transport).

Commands and results:
- `uv run pytest -q`: 781 passed in 15.60 s.
- `node --test tests/js/`: 472 passed, 0 failed.
- Probe `scratchpad/probe_t152_fix.py` (25 checks, all pass): boundary 11-08 open and 11-09 closed, reduced key set, totals, no names, ids or phone in body, session empty, health without cookie, `seen.yaml` not written, nine write routes refused with `403 event_ended` with data file and backups unchanged, `/api/events` refused, closed ETag gives 304, admin full state with `ended: true`, admin assign still 200, bug 1 and bug 2 scenarios below.
- Probe `scratchpad/probe_logout.py`: group `POST /api/logout` after the flip gives 200; party create gives 403 `event_ended`.

Fix verification:
- Bug 1 (admin presence after the flip): PASS. The admin gets presence after the flip, and after 200 s the same ETag gives a fresh 200 with the party offline (was 304).
- Bug 2 (write across midnight): PASS. A write that passes the route guard and sees the flip at the commit gets `403 event_ended`, with the data file byte-identical. Admin stream frames from a commit carry the full payload (`parties` present).

Acceptance criteria:

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `event_is_ended` pure, overrides both ways, 11-08 open, 11-09 closed | PASS | pytest `test_event_is_ended_*`, probe boundary |
| 2 | Other `ended` values refuse startup with a precise `ConfigError` | PASS | pytest parametrised (`maybe`, `yes`, `1`, `0`, `True`, `None`) |
| 3 | Today in Europe/Bratislava per request, injectable, suite unchanged | PASS | `TIMEZONE` checked; `today` read per request; 781 existing tests pass with the default |
| 4 | Reduced state has exactly the listed keys, no names, ids or phone; same in error bodies | PASS | probe and pytest |
| 5 | `totals` = `{people 5, parties 2, nights 3}` | PASS | probe |
| 6 | Admin gets the full state plus `ended: true` | PASS | probe; bug 1 fixed |
| 7 | Listed writes refused with `403 event_ended`, nothing changed, no backup or audit | PASS | probe (9 routes), pytest parametrised (listed routes); bug 2 fixed. Note: `POST /api/logout` stays open (see below) |
| 8 | `/api/events` refused for non-admin; open stream closed after the flip | PASS | probe 403; pytest `test_open_stream_is_closed_after_the_flip` |
| 9 | No `seen` write and `/api/session` empty when ended | PASS | probe |
| 10 | ETag includes the shape; pre-flip ETag gives 200 | PASS | probe (closed ETag 304 on unchanged; pytest covers the open-day 200) |
| 11 | `/api/health` and `/api/join` unchanged | PASS | probe (health 200 without cookie, admin join) |
| 12 | `event_ended` maps to the Slovak text | PASS | `static/js/logic-errors.js` line 96, Node test |
| 13 | No code touches `data/`; README and `tests/manual.md` (section 24) describe the manual steps | PASS | README lines 236–240, manual section 24 |
| 14 | `uv run pytest` and `node --test tests/js/` pass | PASS | 781 and 472 |

Extra scenarios tried: writes without a cookie stay `bad_code` 401; a write with a bad body after the flip still answers `event_ended` (guard first); `ended` values `"yes"`, `1`, `"true"`, `null` refuse startup; the health and join routes stay public; the admin phone route is not refused by `event_ended`.

Note for the developer (not a failure): the spec's "all writes" rule has `POST /api/logout` open after the event, so a party can clear its own cookie. The reviewer already accepted this as harmless. The sub-path `root_path` concern from review round 2 is not a criterion. Please confirm the logout exemption is intended.

Manual items (in `tests/manual.md`, section 24): the closed-state check on a real server and the manual clean-up. No screenshots: backend only. The trial server still shows the committed build until the change is committed and the trial server restarted by the orchestrator. Its page depends on T-153 (the page must handle `state.ended`).

Verdict: PASS. All criteria met, no regressions. Moved to `tasks/done/`.
