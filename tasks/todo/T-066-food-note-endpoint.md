# T-066: `Party.food_note` and `POST /api/food`

- **Phase:** 1
- **Depends on:** none (shares `app/models.py` with T-065, so do not run them at the same time)
- **Size:** M

## Goal
Let each party store one free text „Čo kto donesie“ through the normal write path. See proposal "Pred cestou" › "Obsah podľa organizátora a „Čo kto donesie“" (last bullet) and the `POST /api/food` row in "HTTP API" › "Endpointy".

## Scope
- `app/models.py` (`Party.food_note`, `FoodRequest`), `app/validate.py` (`check_food`, `set_food_note`), `app/main.py` (endpoint)
- Tests in `tests/test_api_write.py`, `tests/test_validate.py`, `tests/test_store.py`

## Acceptance criteria
- [ ] `Party.food_note: str` optional, stored in `cabin-data.yaml` only when set; old data files load unchanged; it is not part of the party form input, and `PUT /api/parties/{id}` keeps it (test).
- [ ] `POST /api/food {party_id, text}` (group cookie, write rate limit, `X-Client-Id`): trims the text; a non-empty text sets `food_note`, an empty one removes the field. Under the lock: version bump, backup, one audit document with action `food` (party, before, after), SSE `event: state`.
- [ ] Text longer than 120 characters after trimming → `422 invalid` with `params.reason` `too_long` (and `max: 120`), decided in `validate.py`, not by a Pydantic length error. Unknown party → `404 unknown_party`. Both return `state` and write nothing.
- [ ] Works while `signup_open` is `false` without the admin cookie (no `check_signup_open`).
- [ ] Startup refuses a stored `food_note` that is empty or longer than 120 characters (precise message with the path).
- [ ] Tests: set, change, clear with `""` and with spaces only, too long (121 chars) vs. exactly 120, unknown party, locked signup allowed, no cookie → `401 bad_code`, audit content, unchanged text behaviour per Q21. `uv run pytest` passes.

## Notes for developer
- Follow the shape of `/api/briefing` and `/api/places`; the rule lives in `validate.py`.
- Text rules besides length are open (`tasks/QUESTIONS.md` Q21). Default: NFC and no control characters or line breaks, like the party name (existing `invalid` reason); the same text as stored is a no-op `200` via `tx.skip()` (no version bump, backup or audit).
- Open decision „Čo kto donesie“: default one text per party, anyone with the group code may edit it, everyone sees it.
- T-009 (phase 2 party delete) removes the party with its `food_note`; nothing extra needed.

---
## Dev log

## Review round 1

## Review round 2

## Test report
