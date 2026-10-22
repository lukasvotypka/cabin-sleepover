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

## Review round 2
(reviewer appends)

## Test report
(tester appends)
