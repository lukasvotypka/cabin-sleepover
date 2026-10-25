# T-057: Load `config/info.yaml` and send it as `state.info`

- **Phase:** 1
- **Depends on:** none (all earlier phase 1 tasks are done)
- **Size:** M

## Goal
Organizer's decision of 25. 10. 2026: guest information before the trip. The server loads and validates `config/info.yaml` at startup and sends it in every `state` as `info`, like the layout. See proposal "Pred cestou: informácie pre hostí", subsection "Obsah: `config/info.yaml`", and the endpoint table ("HTTP API").

## Scope
- `app/models.py` (info models, fixed icon name set `INFO_ICONS`, optional `briefing` rect in `SceneRects`), `app/main.py` (load, `info` in `state_payload`, ETag)
- New `config/info.yaml` (sample content from the proposal and from `design/info/index.html` `INFO`), `config/cabin.yaml` (`map.scene.briefing`)
- New `tests/test_info.py`; `README.md` (one row in the config table, short "Editing the guest info" note)

## Acceptance criteria
- [x] Pydantic models for `water` (`drinkable: bool`, `liters_per_day > 0`, `bottle_liters > 0`), `pack` and `sleep` (`icon`, `label`, optional `note`), `menu` (`day`, `meals: [{when, what}]`), `bring: str`, `program` (`icon`, `title`, `when`, optional `note`). Unknown keys rejected (as other config models).
- [x] `INFO_ICONS` holds exactly the 22 names listed in the proposal section; any other `icon` value fails startup with an English message naming the file, the path (e.g. `pack[3].icon`) and the bad value.
- [x] Empty `pack`, `sleep`, `menu` or `program` list fails startup; a `menu[].day` outside the event days (first `arrive_days` … last `leave_days` of `cabin.yaml`) or repeated fails startup; days are quoted ISO strings.
- [x] Missing `config/info.yaml`: the server starts and `state.info` is `null` (feature off). A present but broken file refuses startup (`ConfigError`, same style as `cabin.yaml` errors).
- [x] Every `state` (200 of `/api/state`, write success and error bodies, SSE `event: state`) contains `info`. The ETag changes when `info.yaml` changes after a restart (mix it into `config_hash`).
- [x] `map.scene.briefing` is an optional rect, default `[296, 408, 56, 56]`, set explicitly in `config/cabin.yaml`; the existing `tests/test_map_layout.py` checks (no overlap with rooms and other boards, inside viewbox) pass with it.
- [x] Sample `config/info.yaml`: Slovak content of the prototype (`water.drinkable: false`, 2 l, 1.5 l bottles, the 12 pack items, 3 sleep items, menu for the 4 event days, `bring`, 7 program items) using only icons from the set.
- [x] `tests/test_info.py` covers: sample file loads; missing file → `info: null`; unknown icon, empty list, day outside event, unknown key each refuse startup with the path in the message; `info` present in `/api/state`; ETag differs between two different info files.
- [x] `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
- The Slovak texts in `info.yaml` are organizer data like room names, not server messages (open decision "Pred cestou, slovenský text zo servera", default kept). Server error and log messages stay English.
- Open decision "Pred cestou, obsah": default is the prototype's sample content; the organizer edits it later.
- Prototype icon names differ slightly from the proposal list (`baterka`, `smernik`, `batoh`, `mesiac`): the proposal list is the contract (`nabijacka`, `smerovnik`, ...). Use ASCII slugs; T-060 maps them to sprites. `batoh` (board/offer art) is page decoration, not an `info.yaml` icon.
- Use `yaml.safe_load`. `compose.yaml` already mounts `./config` read-only, so no deploy change.

---
## Dev log
- Added `Info` models, `INFO_ICONS` (22 names), `load_info`/`event_days` and optional `SceneRects.briefing` (default `[296, 408, 56, 56]`) in `app/models.py`; `app/main.py` loads `config/info.yaml` (missing means `null`), puts `info` in `state_payload`, and mixes it into `config_hash`.
- Files: `app/models.py`, `app/main.py`, `config/info.yaml` (new), `config/cabin.yaml`, `tests/test_info.py` (new), `README.md`; adjusted `tests/test_models.py`, `tests/test_api_access.py` (STATE_KEYS), `tests/test_api_write.py` (body size bound 4000 to 8000 because state grew).
- Icon list: used the proposal's 22 names; the proposal lists "fľaša" which I slugged as `flasa`.
- Run: `uv run pytest` (556 passed); `node --test tests/js/` (see below).

## Review round 1

Ran `uv run pytest` (556 passed) and `node --test tests/js/` (307 passed). The acceptance criteria are met: the models reject unknown keys, `INFO_ICONS` has the 22 proposal names, empty lists and menu days that are out of range or repeated are rejected with the path in the message, a missing file gives `info: null`, `info` goes out through `state_payload` (200 responses, success and error bodies, SSE initial and commit), `config_hash` now covers `info`, and the `briefing` rect is optional with the default, set in `cabin.yaml` and checked by the generic scene loops in `test_map_layout.py`. All server and loader messages are in English.

**Blocker:** none.

**Suggestion**
- `README.md` lines 17-18: the `config/info.yaml` row of the config table appears twice. Delete one copy (the orchestrator can do it when committing, or the developer can do it in the next task that edits the README).
- `app/models.py` `Positive` (`strict=False`) and `InfoWater.drinkable: bool` are lax. `liters_per_day: true` loads as `1.0`, and `drinkable: "no"` loads as `False`. Other config numbers (`Coord`) are strict. Use `StrictBool` and a float that rejects bool for consistency.
- `tests/test_info.py` checks only `program` for the empty-list case. Parametrizing it over `pack`, `sleep`, `menu` and `program` would cost little.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (run 1, 25. 10. 2026)

Commands (PATH needed `/opt/homebrew/bin`, `uv` and `node` were not on the default PATH):
- `uv run pytest -q`: 556 passed (no regressions in `tasks/done/` tests).
- `node --test tests/js/`: 307 passed, 0 failed.
- Startup probes: `uv run python -I /tmp/t057/probe.py` (31 mutated `info.yaml` and `cabin.yaml` cases, temp config copies) and `/tmp/t057/probe2.py` (unquoted date, live app through ASGI, file exposure, ETag across restarts).
- Live server on a temp port 8791 with a temp data dir (`/tmp/t057/live`), probes in `/tmp/t057/live.py`: join, state, 304, write success and errors, concurrent assign, SSE, restart with existing data. Server stopped afterwards.

| # | Acceptance criterion | Result |
| --- | --- | --- |
| 1 | Models for water, pack, sleep, menu, bring, program; unknown keys rejected | PASS (unknown keys at top, pack, meal and program levels refused, path named) |
| 2 | `INFO_ICONS` = the 22 proposal names; other icon fails startup with file, path and value | PASS (set matches proposal list incl. `flasa`, `smerovnik`; `pack[0].icon`, `sleep[0].icon`, `program[0].icon` named; case `Spacak` refused) |
| 3 | Empty pack/sleep/menu/program fails; menu day outside event or repeated fails; days quoted ISO | PASS (all four empty lists refused; 2026-10-28 and 2026-11-02 refused; repeated day refused; unquoted `2026-10-29` refused) |
| 4 | Missing file → starts, `info` null; broken file → ConfigError | PASS (`info_json` None; corrupted YAML, empty file, top-level list, bad values refused with path) |
| 5 | Every state (200, write success and error bodies, SSE state) has `info`; ETag changes when info changes after restart | PASS (200, 304 path, 409 slot_taken, 404 unknown_slot, 409 duplicate_name, 404 unknown_party, 422 invalid, SSE initial and commit states all carry `info`; different info gives different ETag, same info gives equal config part across restarts) |
| 6 | `map.scene.briefing` optional, default `[296,408,56,56]`, set in cabin.yaml; layout checks pass | PASS (cabin.yaml sets it; removing it starts the app; `test_map_layout.py` covers scene rects generically, passes) |
| 7 | Sample info.yaml has the prototype content and only set icons | PASS (drinkable false, 2 / 1.5, 12 pack, 3 sleep, 4 menu days, bring, 7 program items; loads) |
| 8 | `tests/test_info.py` covers the listed cases | PASS (file present with the listed tests; the empty-list refusal is checked for `program` only, but my probe confirmed pack, sleep, menu and program each refuse) |
| 9 | `uv run pytest` and `node --test tests/js/` pass | PASS (556 and 307) |

Extra scenarios tried:
- Concurrent `assign` of three parties to the same slot through HTTP: one 200, two 409 `slot_taken` (first run; a later run hit an already taken slot and gave 409 for all three, as expected).
- Restart of the live server with existing data: `info` still served, the config part of the ETag unchanged (the last ETag segment changes because presence changed, expected).
- Unauthenticated `/api/state`, bad join code, no cookie write: 401 `bad_code`, body has no `state` (pre-existing behaviour for auth errors, not a regression).
- Static exposure: `/data/cabin-data.yaml`, `/data/`, `/config/info.yaml`, `/config/cabin.yaml`, `/static/../config/info.yaml`, `/static/../data/cabin-data.yaml`, `/api/../data/...`, `/proposal.md`, `/tests/test_info.py` all 404; `/static/index.html` 200.
- SSE: `event: state` on connect carries `info`; a committed write sends a second `event: state` with `info`.

Non-blocking observations (not failures; the reviewer's round 1 suggestion was not applied):
- `drinkable` is not strict: `drinkable: "no"` loads as `False`.
- `liters_per_day: true` loads as `1.0`. `Positive` uses `strict=False`, unlike `Coord` in the other config models.
- Suggested fix for a later task: `StrictBool` for `drinkable` and a strict float that rejects bool.

Added to `tests/manual.md` (one item, deployment): the guest info file reaches the container, a restart picks up an edit, and a broken file stops the container with the path in the message.

Verdict: all 9 criteria PASS, no regressions. Task moved to `tasks/done/`.
