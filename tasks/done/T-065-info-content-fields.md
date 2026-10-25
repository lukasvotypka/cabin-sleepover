# T-065: New optional `info.yaml` fields and the organizer's content

- **Phase:** 1
- **Depends on:** none
- **Size:** S

## Goal
Accept the new optional fields of `config/info.yaml` and replace the invented sample content with the organizer's facts. See proposal "Pred cestou", subsection "Obsah podľa organizátora a „Čo kto donesie“" (bullets „Nové polia“ and „Obsah“).

## Scope
- `app/models.py` (`Info`, `InfoItem` or a pack-item model), `config/info.yaml`
- `tests/test_info.py`

## Acceptance criteria
- [x] `Info` accepts, all optional (missing = `null`/absent in `state.info`): `pack_intro`, `sleep_intro`, `food_intro`, `food_note`, `host_arrival` (strings, `Label` rules), `food_plan` (list of non-empty strings), `facilities: {have: [...], missing: [...]}` (lists of non-empty strings, each list optional).
- [x] `note` is allowed on `pack` items (it already is on `InfoItem`; keep it covered by a test).
- [x] `menu` becomes optional (may be absent); when present, the existing day checks (outside event, repeated) still apply. `bring` becomes optional (see Q19).
- [x] Unknown keys still refuse startup (`extra` forbidden as today); empty strings or empty `food_plan` entries refuse startup with a precise English message naming the path.
- [x] `config/info.yaml` holds the organizer's content: no `menu`; `food_plan` grilovanie and mäso upečené v piecke; `food_intro` (každý si bežne donesie jedlo, varí sa spolu, organizátor kúpi niečo navyše); `food_note` (obchod je 15 minút, netreba nákup na 4 dni); `facilities.have` gril, piecka, sporák, teplá voda v kuchynke; `facilities.missing` sprcha, WC; spacák in `pack` with `note` „Nemáš? Daj vedieť, požičiame.“; plachta na matrac „podľa potreby“; `host_arrival` „Organizátor príde na chatu okolo 16:00.“; `pack_intro`, `sleep_intro`. Slovak, typographic quotes, no claims the organizer did not make (no „bez obliečok“ unless kept from his facts).
- [x] The shipped `config/info.yaml` loads (test), and a file with only the old required fields (`water`, `pack`, `sleep`, `program`) loads.
- [x] Tests: each new field present and absent, `menu` absent, `facilities` with only `have`, rejected empty strings. `uv run pytest` passes.

## Notes for developer
- Do not touch the page here; T-067 uses the fields. Until T-067 lands the page must not crash on a missing `menu`/`bring` (`info.menu || []` is already used in the quick list; check `slFood` and `quickWhatsAppText` and guard with `|| []` only if needed).
- Open decision „Pred cestou, obsah“: the organizer's facts above replace the sample; he may still edit the file.

---
## Dev log
- `app/models.py`: `Info` gets optional `pack_intro`, `sleep_intro`, `food_intro`, `food_note`, `host_arrival`, `food_plan`, `facilities` (new `InfoFacilities`); `menu` and `bring` optional; menu day checks guard `None`.
- `config/info.yaml`: organizer content (no menu/bring); sleep list now has 2 items (spacák, plachta „podľa potreby“; pack spacák has the note).
- `static/js/app-slides.js`: `slFood` guards `info.menu || []` (quickWhatsAppText already guarded).
- `tests/test_info.py`: adapted menu tests, added tests for new fields, absent menu, facilities only `have`, empty strings, unknown keys.
- `uv run pytest`: 588 passed; `node --test tests/js/` run, see result below.

## Review round 1

Ran: `uv run pytest tests/test_info.py` 28 passed; `uv run pytest` 588 passed; `node --test tests/js/` 314 passed.

All acceptance criteria are met. `Info` adds the new optional fields using `Label` rules. `InfoFacilities` keeps `extra` forbidden. `menu` and `bring` are now optional, and the menu day checks still run when `menu` is present. The tests cover each new field present and absent, absent `menu`, `facilities` with only `have`, the `pack` note, and rejected empty strings and unknown keys, with the path in the error. The shipped `info.yaml` holds the organizer's facts: no menu or bring, no „bez obliečok“, and the spacák note and „podľa potreby“ as specified. The page is safe with missing `menu` and `bring`: `slFood` now guards `menu`, and `bring` and quick/WhatsApp were already guarded. The one-line change to `app-slides.js` is outside the listed scope, but the task notes allow it.

No blockers.

- **Suggestion:** the sleep spacák note „každý vlastný, aj deti“ differs a little from the organizer's „kto nemá, dá vedieť“ (which is on the pack item). T-067 or the organizer may want to align them.
- **Suggestion:** `sleep_intro` „Spí sa v spacákoch na posteliach a matracoch.“ and `pack_intro` are wording the developer wrote, not facts the organizer gave. They are harmless, but worth listing for the organizer under the open decision „Pred cestou, obsah“.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (T-065), config/server only, no browser check.

Commands and results:
- `uv run pytest` → 588 passed (full suite, no regressions in `tasks/done/` coverage).
- `node --test tests/js/` → 314 pass, 0 fail.
- Startup probe, in-process `create_app` with temp config and data dirs (`/tmp/t065/probe.py`, deleted afterwards):
  - Loads OK: shipped `config/info.yaml`; old required fields only (`water`, `pack`, `sleep`, `program`); menu and bring absent; `facilities` with only `have`; `menu` present with `bring`; pack `spacak` note.
  - Refuses with path-naming English messages: empty and whitespace-only `host_arrival`; empty `food_plan` entry; empty `facilities.missing` entry; top-level unknown key; unknown key in `facilities`; label over 120 chars; menu day outside event; repeated menu day; `menu: []`.
  - The probe case "facilities.have not a list" produced invalid YAML (probe artifact), so it refused on parse. Not counted as evidence.
- Live server on a temp port 8771 with a temp data dir (stopped afterwards): `/api/health` ok; `/api/join` ok; `/api/state` `info` has all new keys, `facilities` = `{have: [4 items], missing: [sprcha, WC]}`, `host_arrival` = „Organizátor príde na chatu okolo 16:00.“, `menu` and `bring` = null. `/data/cabin-data.yaml`, `/config/info.yaml` and a traversal path return 404.
- Note: port 8765 is held by an unrelated `http.server` process (not started by me, not touched).

Acceptance criteria:

| # | Criterion | Result |
| --- | --- | --- |
| 1 | New optional fields accepted, absent = null, `facilities` lists optional | PASS |
| 2 | `note` on pack items covered | PASS (shipped spacák note reaches the state) |
| 3 | `menu` optional, day checks still apply; `bring` optional | PASS |
| 4 | Unknown keys refuse; empty strings / empty food_plan entries refuse with path | PASS |
| 5 | Shipped `info.yaml` has the organizer's content, no menu | PASS (content checked in the file diff; no „bez obliečok“) |
| 6 | Shipped file and old-fields-only file load | PASS |
| 7 | Tests for each new field, absent menu, facilities.have only, empty strings; pytest passes | PASS (588 passed) |

Extra scenarios: whitespace-only strings, 121-character label, `menu: []`, unknown key in `facilities`, path traversal and data/config not served.

Result: all criteria pass, no regressions. Moved to `tasks/done/`. No bugs found.
