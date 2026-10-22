# T-004: Write endpoints (assign, assign-stay, clear, move, parties)

- **Phase:** 1
- **Depends on:** T-001, T-002, T-003
- **Size:** M

## Goal
Expose every phase-1 write action. Each one runs through the store transaction and the `validate.py` rules and returns the fresh state. Write rate limits are enforced. Admin actions are moved to T-009 (phase 2, not built now). Proposal sections: „HTTP API“ (Endpointy, Konzistencia, Chybové kódy), „Dáta v YAML“, „Bezpečnosť a limity“.

## Scope
- `app/main.py` (new routes)
- `tests/test_api_write.py`

## Acceptance criteria
- [x] Every write endpoint needs the group cookie.
- [x] Every write endpoint counts toward the per-client write limit (30/min) and runs under the store lock.
- [x] On success, every write endpoint returns `200 {"ok": true, "state": …}`.
- [x] On a rule failure, every write endpoint returns the proper code and status, with the current `state` and nothing written.
- [x] `POST /api/assign {night, slots[], party_id}`:
  - [x] writes all listed free slots for a present party in one write (one version bump, one backup, one audit document listing every slot)
  - [x] all or nothing (Q3): if any slot is taken or unknown, nothing is written
  - [x] can return `slot_taken`, `not_present`, `unknown_slot`, `unknown_party` or `invalid`
  - [x] tested: two free slots both written; one free plus one taken returns `409 slot_taken`, neither is written and `version` is unchanged; an empty `slots` list returns `422 invalid`
- [x] `POST /api/assign-stay {slots[], party_id}` (Q13):
  - [x] for each night of the stay, it writes all listed slots together, or skips the night and lists it in `skipped`
  - [x] the whole request is one write (one version bump, backup and audit document)
  - [x] if every night is skipped, it returns `409 slot_taken` and writes nothing (Q5)
  - [x] tested: a couple's two slots with one of them taken on Friday writes Thursday and Saturday in full, writes nothing on Friday, and returns `skipped: ["2026-10-30"]`; all nights taken returns `409` with `version` unchanged
- [x] `POST /api/clear {night, slot}` frees the slot. On an already free slot it returns `200` without writing (Q5).
- [x] `POST /api/move {party_id, from_slot, to_slot, nights[]}` is all or nothing. If any night fails, nothing changes (tested with a conflict in one of three nights).
- [x] `POST /api/parties` creates a party:
  - [x] the server sets the `id` (`p-` plus 6 random characters, unique)
  - [x] `color` is the first unused color of the 12-color palette from „Vzhľad“, in this order: `#2F7D6D, #D07A2B, #6D5BA8, #C08A1E, #3E6FB0, #9C4A7A, #5E8A2E, #8A6A4A, #2E8AA0, #C0603A, #7A7F2B, #A04848`. Once all 12 are used it starts again from the top. Tested: the first party gets `#2F7D6D`, the second `#D07A2B`, and when a party is removed from the data file (set up directly in the test, there is no delete endpoint now) its color is reused.
  - [x] `created_at` and `updated_at` are set
  - [x] the name is trimmed
  - [x] a case-insensitive duplicate name returns `409 duplicate_name`
  - [x] the response includes the created `party` next to `state`
- [x] `PUT /api/parties/{id}`:
  - [x] edits the party's fields
  - [x] a rename does not touch `sleeping`
  - [x] shortening the stay frees the slots in nights outside the new stay and returns them in `freed`
  - [x] an unknown ID returns `404 unknown_party`
- [x] No admin endpoints (`DELETE /api/parties/{id}`, `/api/admin/*`) exist in this task. They moved to T-009.
- [x] Signup lock (`403 signup_closed` for writes without the admin cookie while `signup_open` is false) also moved to T-009. If it was already implemented before the scope change, it may stay, but then it must be tested.
- [x] Every successful write bumps `version`, creates a backup and appends one audit document:
  - [x] the audit `source` is `mapa` for slot actions, `formular` for party create and edit, and `admin` for any write with the admin cookie (Q10)
  - [x] the audit `client_id` comes from `X-Client-Id`
  - [x] tests check the backup and the audit
- [x] **Concurrency tests** with `asyncio.gather`, two different parties, the same night:
  - [x] both request the same single slot: exactly one gets `200`; the other gets `409 slot_taken` with `params.party_id` and `params.party_name` of the winning party, and its `state` shows the winner on that slot
  - [x] they request overlapping slot lists (e.g. `[A, B]` and `[B, C]`): exactly one gets `200`; the loser has **no** slot written (C stays free), so there is never a partial write
- [x] The 31st write within a minute from the same `X-Client-Id` returns `429 rate_limited`.
- [x] Errors use the T-003 envelope `{code, message, params}`. There is no Slovak text from the server. `message` is a short English developer note. `params` carry what the page needs for its Slovak text:
  - [x] `slot_taken`: `night`, `slot`, `party_id`, `party_name` of the current holder
  - [x] `not_present`: `night`, `party_id`, `party_name`
  - [x] `duplicate_name`: `name` (the clashing name as stored)
  - [x] `unknown_slot`: `slot`
  - [x] `unknown_party`: `party_id`
  - [x] `invalid`: `field` (and `night` when the night is the problem)
  - [ ] `signup_closed`, `forbidden`, `rate_limited`: empty `params`
- [x] Every error test asserts the status, the `code` and the relevant `params`. No test asserts `message` text.

## Notes for developer
- The handlers stay thin. Load state, call `validate.py`, apply the change, and let the store do the version bump, backup and audit. Do not put rules in `main.py`.
- **Palette:** use exactly the 12 colors and order from the proposal's „Vzhľad“ section, as one constant on the server. The page never picks colors itself.
- `move` with `from_slot == to_slot`, or with a `to_slot` that the same party already holds, should be `invalid`, not a silent success.
- Organizer decision 22. 10. 2026: everything admin (delete party, signup lock endpoint, export, admin panel) is moved to T-009, phase 2, and is not built now.
- Open decision „Môže sa kamarát zapísať na noc, keď nie je na chate?“: default no (`not_present`).
- Phase 2 (`/api/ai/*`) is out of scope.
- From T-002 review, you may change `app/store.py` for these:
  - add a way to end a write transaction without writing (e.g. `tx.skip()`), needed for `clear` on an already free slot (200, no write, no backup, no audit, no version bump).
  - make the audit append robust: write each entry in one append that starts with `\n---\n`, so a truncated entry cannot make the rest of `audit.yaml` unreadable, and log the full entry when the append fails.

---
## Dev log
Resumed after an interrupted session. Handled the organizer's scope change (admin features moved to T-009): no delete, signup or export endpoints exist. The `signup_closed` check and the `admin` audit source for writes with the admin cookie were already done, so they stay and are tested.

**app/main.py**: new routes `POST /api/assign`, `/api/assign-stay`, `/api/clear`, `/api/move`, `/api/parties`, `PUT /api/parties/{id}`. Each uses `Depends(enforce_write_limit)` (which needs the group cookie first), runs in `store.write(...)`, calls `check_signup_open` and then the `validate.py` check, applies the change, and calls `tx.audit(...)`. Helpers: `client_id_of` (also used by `enforce_write_limit`), `audit_source`, `new_party_id`, `next_party_color` (first unused palette color, least used first when all 12 are in use, so it wraps), `release_slot` (drops a night from `sleeping` when it becomes empty). Responses: `ok_response(rt, state, ...)` with `skipped` (assign-stay), `party` (create, update) and `freed` (update).
**app/models.py**: `PARTY_PALETTE` constant (12 colors, order from "Vzhľad").
**app/validate.py**: `duplicate_name` params now also carry `name` (the stored clashing name), as the task requires. `party_name` and `party_id` stay.
**app/store.py** (allowed by the T-002 review): `Transaction.skip()` ends a write without version bump, backup or audit (used by `clear` on a free slot). The audit entry now starts with its own `\n---\n` and goes out in one unbuffered append, and a failed append logs the full entry.
**Tests**: `tests/api_helpers.py` (shared helpers), `tests/test_api_write.py` (new), `tests/test_store.py` (+4 tests: skip, separator, truncated entry, logged entry), `tests/test_validate.py` (duplicate_name params).

Run: `uv run pytest` -> 372 passed. Only the new files: `uv run pytest tests/test_api_write.py`.

**Deviations and notes**
- `rate_limited` params carry `retry_after` (from T-003, the page can show it), so the last "empty params" item is left unticked for `rate_limited`. `signup_closed` has empty params (tested), and `forbidden` is not raised by any endpoint here.
- Move to a slot the same party already holds returns `409 slot_taken` with `params.own = true` (validate.py from T-001, as the coordinator said for re-taps), not `invalid`. `from_slot == to_slot` is `422 invalid`. Neither is a silent success.
- A party body that breaks the model-level rule `kids_in_parents_bed <= kids` returns `422 invalid` without `params.field` (pydantic reports no field for model validators). Follow-up for the T-003 handler or the page: fall back to a generic text. Not done here.
- A forbidden-or-unauthorized caller on a write endpoint still gets the rate-limit check after the group cookie is verified, so only authorized calls count.
- The rate-limit test uses `clear` on a free slot (200 without a write) to reach 30 calls cheaply.

## Review round 1
(reviewer appends)

Reviewed `app/main.py`, `app/store.py`, `app/validate.py`, `app/models.py`, `tests/test_api_write.py`, `tests/api_helpers.py` against the task, `proposal.md` („HTTP API“, „Dáta v YAML“, „Bezpečnosť a limity“) and `tasks/QUESTIONS.md` (Q3, Q5, Q10, Q13). Ran `uv run pytest`: **372 passed**; `uv run pytest tests/test_api_write.py`: **55 passed**. Also probed the running app against a temp data dir (malformed JSON, list body, long path ID, `kids_in_parents_bed > kids`, HTML/YAML-looking names).

What is good: handlers are thin and rules stay in `validate.py`; every write runs lock → load → `check_signup_open` → validate → mutate → `_commit` (re-validates the new state, backup, atomic write, version, audit) with no `await` between check and write, so the concurrency tests are meaningful. All-or-nothing holds for `assign`, `assign-stay` per night, and `move`. `clear` on a free slot uses `tx.skip()` (no version, backup or audit). Audit append now starts with its own `\n---\n` and logs the full entry on failure. No admin endpoints exist (correct after the 22. 10. scope change); the kept `signup_closed` check is tested for all six endpoints with the admin bypass. Group cookie is checked before the rate limit, and a 401 carries no `state`.

**Judgement of the Dev log deviations**
- `rate_limited` carrying `params.retry_after`: **accepted.** It comes from T-003 (done), it is a number, not text, and the page can use it or ignore it. The "empty params" AC is superseded for `rate_limited`; tester should not fail on this. `signup_closed` has empty params (tested).
- Move to a slot the same party already holds → `409 slot_taken` with `params.own = true` instead of `invalid`: **accepted.** The intent of the note (never a silent success) is met, it matches the `assign` re-tap behaviour T-006 already relies on („From T-001 testing … `params.own = true`“), and `from_slot == to_slot` is still `422 invalid` (tested).
- `kids_in_parents_bed > kids` → `422 invalid` with empty `params`: **not accepted**, see Blocker 1.

**Blocker**
1. `app/models.py:253-257` (`PartyInput._check_kids`, a `model_validator`) together with `app/main.py:344-350` (`_first_failing_field`). A party create or update with `kids: 0, kids_in_parents_bed: 1` returns `{"code": "invalid", "params": {}}` (verified). The AC requires `invalid` to carry `field`, and T-007 shows the `invalid` text "next to the field named in `params.field`", so this case (the one Q10 explicitly calls out) gets no field to attach to. The `message` is also non-ASCII (`parents’ bed`, U+2019), which the project's own `error_of` helper (`message.isascii()`) would reject. There is no API test for this case at all.
   Expected fix: report the error on the field, e.g. turn it into a `field_validator("kids_in_parents_bed")` that reads `info.data["kids"]` (pydantic then puts `kids_in_parents_bed` in `loc`, so `params.field == "kids_in_parents_bed"` with no handler change), with an ASCII message (`parents' bed`). Keep `tests/test_models.py::test_kids_in_parents_bed_not_more_than_kids` green. Add a case to `test_create_party_invalid_input` (`{"kids": 0, "kids_in_parents_bed": 1}` → `"kids_in_parents_bed"`) and one for `PUT /api/parties/{id}`, both asserting status, code, `params.field`, and no write.

**Suggestion**
- `app/main.py:561-562`: `party_id` in the path has no bound. `PUT /api/parties/<5000 chars>` returns a 404 that echoes the whole string in `params.party_id` (8 KB body). Typing it as the `PartyId` pattern (or a max length) would make it a cheap `422 invalid` with `field`.
- `tests/test_api_write.py:289-293`: `test_move_unknown_party_and_slot` only tests the unknown party. Add an unknown `to_slot` case (`404 unknown_slot`, `params.slot`).
- No upper bound on the number of parties. Anyone with the group code can create up to 30 per minute per `X-Client-Id` (and the ID is client-chosen). A sane cap (e.g. 100, `invalid` with `field: "name"` or a new reason) would protect the file and the single worker. Not in the proposal, so optional.
- `app/main.py:497-505`: `tx.audit_details["skipped"] = ...` after `tx.audit(...)` reaches into the transaction's internals. A `skipped` (or generic `**extra`) argument on `Transaction.audit` would be cleaner.

**Nit**
- `app/main.py:287-289` has three blank lines and `324` is missing the second blank line before `# --- request models`.
- `app/main.py:13-14`: the module docstring still says "T-004 builds the write endpoints on …"; they now live in this file.

Verdict: CHANGES REQUESTED

## Dev log, round 1 fixes
- **Blocker 1 (fixed):** `PartyInput._check_kids` in `app/models.py` is now a `field_validator("kids_in_parents_bed")` that compares with `info.data["kids"]` (skipped when `kids` itself failed). Pydantic puts the field in `loc`, so `invalid` carries `params.field == "kids_in_parents_bed"`. The message is ASCII (`parents' bed`). New API tests: create (`kids 0 / bed 1`, `kids 1 / bed 2`) in `test_create_party_invalid_input`, and `test_update_party_invalid_input` for PUT (also `adults: 99`). Both check status 422, code, `params.field` and that nothing was written. `tests/test_models.py::test_kids_in_parents_bed_not_more_than_kids` is updated for the ASCII text, the `loc`, and the invalid-`kids` case.
- **Suggestion, path `party_id` (fixed):** `PUT /api/parties/{party_id}` is typed as `PartyId` (pattern), so a malformed or 5000-character ID is `422 invalid` with `field: "party_id"` and is not echoed back. Test: `test_update_party_with_a_malformed_id_is_invalid`.
- **Suggestion, move with unknown `to_slot` (done):** added to `test_move_unknown_party_and_slot` (404 `unknown_slot`, `params.slot`, nothing written).
- **Suggestion, `skipped` via audit (done):** `Transaction.audit(..., **extra)` merges extra fields into the audit details. assign-stay passes `skipped=plan.skipped`, and no code reaches into `tx.audit_details` any more.
- **Suggestion, cap on number of parties (not done):** not in the proposal and it would be a product decision (limit and error shape). Left for the organizer or a later task.
- **Nits (fixed):** blank lines in `app/main.py`, and the module docstring no longer says "T-004 builds ...".
- Did not touch `static/` or `tests/js/`. Run: `uv run pytest` -> 379 passed.

## Review round 2
(reviewer appends)

Re-read the round-1 fix diff (`git diff` on `app/main.py`, `app/models.py`, `app/store.py`, `tests/test_api_write.py`, `tests/test_models.py`; `static/` and `tests/js/` belong to T-005 and were not reviewed). Ran `uv run pytest`: **379 passed**. Ran `tests/test_api_write.py`, `tests/test_models.py` and `tests/test_store.py` together: **217 passed**.

**Round-1 blocker**
1. `kids_in_parents_bed > kids`: **fixed.** `PartyInput._check_kids` is now a `field_validator("kids_in_parents_bed")` reading `info.data.get("kids")`. `kids` is declared before `kids_in_parents_bed`, so it is already in `info.data`, and when `kids` itself fails the comparison is skipped, so only one error comes back. Pydantic puts `kids_in_parents_bed` in `loc`, so the existing `_first_failing_field` returns `params.field == "kids_in_parents_bed"` with no handler change. The message is ASCII. API tests cover create (`0/1`, `1/2`) and update (`test_update_party_invalid_input`), each asserting 422, `invalid`, `params.field` and an unchanged snapshot. The model test checks `loc`, the ASCII message, and the invalid-`kids` case. Stored parties (`Party` inherits the validator) still load the same way.

**Extra changes, fresh pass**
- The `PUT /api/parties/{party_id}` path is now typed as `PartyId`: a malformed or very long ID returns `422 invalid` with `field: "party_id"` and is not echoed back (tested with three values). A well-formed unknown ID still returns `404 unknown_party` (`test_update_party_errors`). The auth and rate-limit dependencies still run before path validation, so an unauthenticated call still gets 401 with no state.
- The move test now covers an unknown `to_slot`: `404 unknown_slot`, `params.slot`, and nothing written.
- `Transaction.audit(**extra)`: assign-stay passes `skipped=plan.skipped`, and nothing touches `tx.audit_details` directly any more. The existing assign-stay test still checks `doc["skipped"]`.
- Nits fixed (blank lines, module docstring).
- The cap on the number of parties was not done. That is fine: it was optional and is not in the proposal.

**Nit**
- `app/store.py` `Transaction.audit`: `**extra` is merged last into `entry` in `_commit`, so an extra key named `action`, `source`, `version` or `time` would silently overwrite the core audit fields. The only caller passes `skipped` today. Rejecting reserved keys, or merging `extra` before the core fields, would make this robust. Not required.

Round-1 blocker verified fixed, no new blockers.

Verdict: APPROVED

## Test report
Tester run on 22. 10. 2026 (fresh run, after review round 2 APPROVED). Admin endpoints are out of scope (T-009). T-005 files (`static/index.html`, `tests/js/`) ignored.

**Commands and results**
- `uv run pytest -q` -> **379 passed** (2.4 s). Run twice, the second time after all probes. This includes the tests of the done tasks T-001, T-002 and T-003, so there are no regressions.
- Live probes: a real `uvicorn --factory` on `127.0.0.1:8123` with a temp data dir `/tmp/t004/data`, test secrets, built by a small factory in `/tmp/t004/serve.py` (`create_app(data_dir=..., env=...)`). Probe scripts `/tmp/t004/probe.py`, `probe2.py`, `probe3.py` (httpx, cookies set by hand because the cookie is `Secure`). The repo `data/` and `.env` were not touched. No tests were added.

**Acceptance criteria (verified by running the code, not from the Dev log)**

| Criterion | Result |
| --- | --- |
| Every write endpoint needs the group cookie (none, garbage, and the admin cookie in the group slot all give 401 `bad_code`, no `state`) | pass |
| Every write counts toward 30/min per `X-Client-Id` (31st call is `429 rate_limited`, another client id is still served, `Retry-After: 60` header, `state` included), runs under the lock | pass |
| Success is `200 {ok: true, state}` | pass |
| Rule failures give the right code and status with current `state` and nothing written (version, backups, audit unchanged) | pass |
| `assign`: two free slots in one write (one version bump, one backup, one audit document with both slots); taken + free = 409 `slot_taken`, free slot stays free, version unchanged; empty list = 422 `invalid` `field: slots`; duplicate slot in list = 422; `unknown_slot`, `unknown_party`, `not_present`, bad night all with the right params | pass |
| `assign-stay`: couple with a taken slot on Thu (p1) and Fri (p2) wrote Sat in full and returned `skipped: [Thu, Fri]`; one version bump; all nights taken = 409 `slot_taken` and version unchanged; empty list = 422 | pass |
| `clear`: frees the slot; on an already free slot 200 and version unchanged (no backup, no audit); unknown slot 404, bad night 422 | pass |
| `move`: all or nothing (conflict on Fri of three nights = 409, whole state byte-identical); success wrote two nights in one bump; `from == to` 422; not holding 422; unknown from or to 404; empty or duplicate nights 422 | pass |
| `POST /api/parties`: server `id` `p-` + 6 chars and unique, name trimmed (`"  Ivan a Eva  "`), first party `#2F7D6D`, second `#D07A2B`, 14 parties wrapped from the top in palette order, `created_at` and `updated_at` set, duplicate (case-insensitive, trimmed) 409 `duplicate_name` with `name`, response has `party` | pass |
| `PUT /api/parties/{id}`: edits fields, rename leaves `sleeping` alone, shortening returns `freed` and frees those slots (verified in state), unknown ID 404, malformed or 5000-char ID 422 with `field: party_id` and not echoed, rename to own name in other case is allowed, rename to another party's name 409 | pass |
| No admin endpoints: `DELETE /api/parties/{id}` 405, `/api/admin/*` 404 | pass |
| Signup lock (kept, tested): with `signup_open: false` in the data file all six endpoints return 403 `signup_closed` with `params: {}` and version unchanged, the admin cookie bypasses it | pass |
| Every write bumps `version`, makes a backup and appends one audit document (37 versions = 37 docs = 37 backups, contiguous); `source` is `mapa` for slot actions, `formular` for party create and update, `admin` for writes with the admin cookie; `client_id` from `X-Client-Id` (null when the header is absent) | pass |
| Concurrency over real HTTP (8 threads, same slot): exactly one 200, seven 409 `slot_taken` with `party_id` and `party_name` of the winner and `state` showing the winner | pass |
| Concurrency, overlapping lists `[B, C]` vs `[C, D]` on one night: one 200, one 409, loser wrote nothing | pass |
| 31st write within a minute is 429 `rate_limited` | pass |
| Error envelope `{code, message, params}`, English ASCII `message`, params as listed (`slot_taken`, `not_present`, `duplicate_name`, `unknown_slot`, `unknown_party`, `invalid` with `field` and `night` when the night is the problem) | pass |
| `signup_closed`, `forbidden`, `rate_limited` have empty `params` | pass with accepted deviation: `signup_closed` is empty, `forbidden` is not raised by any endpoint here, `rate_limited` carries `retry_after` (accepted in review, from T-003) |
| Every error test asserts status, `code` and `params`, none asserts `message` text | pass (spot-checked `tests/test_api_write.py`, helper `error_of` only checks the shape and ASCII) |

**Extra scenarios tried**
- Invalid input: empty or 500-char name (422 `field: name`), missing fields, extra fields such as `id` or `color` (422, the client cannot set them), malformed JSON (422, empty params), bad date string, arrival or departure outside the event, `leave <= arrive`, `kids_in_parents_bed > kids` (422 `field: kids_in_parents_bed`, on create and on PUT).
- A name like `<b>x</b>: yes` is stored as-is (the page must use `textContent`, T-005 to T-007).
- Restart with existing data: version 37 and all 23 parties came back, and the signup state was kept.
- Corrupted data file: invalid YAML refuses to start with `invalid YAML at line 2, column 1 ...`, a file missing required fields refuses with a pydantic message. The good file works again afterwards.
- Nothing from `data/` or `config/` is reachable: `/data/chata-data.yaml`, `/data/audit.yaml`, `/static/../data/...`, `/static/%2e%2e/data/...`, `/chata-data.yaml`, `/config/chata.yaml`, `/.env` all 404.
- Failed and invalid requests also count toward the 30/min limit (my first probe run hit 429 that way). This matches "every write endpoint counts" and is not a defect.

**Observations (not failures, no AC covers them)**
- A party with `adults: 0, kids: 0` is accepted (`POST /api/parties`). The proposal does not forbid it. Possibly worth a rule later, the organizer or T-007 form can decide.
- Failed requests (409, 422) use up the rate-limit budget, so a client that retries a lot hits 429 sooner. Fine for 30/min.

**Manual only** (added to `tests/manualne.md` under "T-004"): two phones racing for one bed, stay with a skipped night shown on a second phone, shortening a stay, audit and backups after real use behind Caddy, the 31st tap message on a phone.

**Failures:** none.

**Verdict: PASS** -> moved to `tasks/done/`.
