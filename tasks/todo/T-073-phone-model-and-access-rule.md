# T-073: Phone on `Party`, phone normalization and `check_party_access`

- **Phase:** 1
- **Depends on:** none
- **Size:** M

## Goal
Data and pure rules for the phone login: proposal "Prihlásenie telefónom (SMS)" › "Čo je chránené" and "Telefónne číslo". No endpoints yet.

## Scope
- `app/models.py` (`Party.phone`, `Party.phone_set_at`), `app/validate.py` (`normalize_phone`, `phone_hint`, `is_protected`, `is_verified`, `check_party_access`), `app/main.py` (`state_payload` only)
- Tests in `tests/test_validate.py`, `tests/test_models.py`, `tests/test_store.py`, `tests/test_api_access.py`

## Acceptance criteria
- [ ] `Party.phone` (E.164 string) and `Party.phone_set_at` (ISO string, quoted in YAML) are optional, written to `cabin-data.yaml` only when set; old files load unchanged.
- [ ] Startup refuses (precise message with path) a stored `phone` that is not normalized E.164, and `phone` without `phone_set_at` or vice versa.
- [ ] `normalize_phone(raw) -> str` per Q25 default: `"0905 123 456"`, `"0905-123-456"`, `"00421905123456"`, `"+421 905 123 456"` → `"+421905123456"`; `""`, `"abc"`, `"+12"`, too long → `RuleError` `invalid` with `params.field = "phone"`.
- [ ] `phone_hint(party)` = last 3 digits, or `None` without phone.
- [ ] `check_party_access(party, verified: Mapping[str, float], is_admin)` raises `login_required` (403) with `params.party_id` and `params.party_name` when the party has a phone, the admin flag is false and `verified` has no entry for it at or after `phone_set_at`; passes for unprotected parties and for admin. Error code `login_required` → 403 registered with the other codes.
- [ ] `/api/state` and SSE `event: state` never contain `phone` or `phone_set_at`; a protected party carries `phone_hint`, an unprotected one has no `phone_hint` key (API test that greps the raw response body for the full number).
- [ ] `POST`/`PUT /api/parties` with a `phone` field → `422 invalid` (extra field); `PUT` keeps stored `phone` and `phone_set_at` (test).
- [ ] `uv run pytest` passes.

## Notes for developer
- Keep the rule only in `validate.py`; endpoints call it later (T-075 to T-077).
- Compare verification time against `phone_set_at` with `>=`; T-077 sets both from the same timestamp.
- Open decision "Prihlásenie telefónom": default home `0` = `+421`, state shows only 3 digits. Format details: `tasks/QUESTIONS.md` Q25.
- T-009 (phase 2 export) would expose the phone in the YAML download; not in scope here.

---
## Dev log

## Review round 1

## Review round 2

## Test report
