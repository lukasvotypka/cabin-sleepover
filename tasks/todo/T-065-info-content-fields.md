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
- [ ] `Info` accepts, all optional (missing = `null`/absent in `state.info`): `pack_intro`, `sleep_intro`, `food_intro`, `food_note`, `host_arrival` (strings, `Label` rules), `food_plan` (list of non-empty strings), `facilities: {have: [...], missing: [...]}` (lists of non-empty strings, each list optional).
- [ ] `note` is allowed on `pack` items (it already is on `InfoItem`; keep it covered by a test).
- [ ] `menu` becomes optional (may be absent); when present, the existing day checks (outside event, repeated) still apply. `bring` becomes optional (see Q19).
- [ ] Unknown keys still refuse startup (`extra` forbidden as today); empty strings or empty `food_plan` entries refuse startup with a precise English message naming the path.
- [ ] `config/info.yaml` holds the organizer's content: no `menu`; `food_plan` grilovanie and mäso upečené v piecke; `food_intro` (každý si bežne donesie jedlo, varí sa spolu, organizátor kúpi niečo navyše); `food_note` (obchod je 15 minút, netreba nákup na 4 dni); `facilities.have` gril, piecka, sporák, teplá voda v kuchynke; `facilities.missing` sprcha, WC; spacák in `pack` with `note` „Nemáš? Daj vedieť, požičiame.“; plachta na matrac „podľa potreby“; `host_arrival` „Organizátor príde na chatu okolo 16:00.“; `pack_intro`, `sleep_intro`. Slovak, typographic quotes, no claims the organizer did not make (no „bez obliečok“ unless kept from his facts).
- [ ] The shipped `config/info.yaml` loads (test), and a file with only the old required fields (`water`, `pack`, `sleep`, `program`) loads.
- [ ] Tests: each new field present and absent, `menu` absent, `facilities` with only `have`, rejected empty strings. `uv run pytest` passes.

## Notes for developer
- Do not touch the page here; T-067 uses the fields. Until T-067 lands the page must not crash on a missing `menu`/`bring` (`info.menu || []` is already used in the quick list; check `slFood` and `quickWhatsAppText` and guard with `|| []` only if needed).
- Open decision „Pred cestou, obsah“: the organizer's facts above replace the sample; he may still edit the file.

---
## Dev log

## Review round 1

## Review round 2

## Test report
