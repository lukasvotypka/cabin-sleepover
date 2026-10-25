# T-067: Page uses the new `info` fields, no fixed cabin sentences

- **Phase:** 1
- **Depends on:** T-065
- **Size:** M

## Goal
Show the organizer's texts from `state.info` and drop the sentences about the cabin hardcoded in the page. See proposal "Pred cestou" › "Obsah podľa organizátora a „Čo kto donesie“" (bullets „Žiadne pevné vety“ and „Nové polia“).

## Scope
- `static/js/app-slides.js`, `static/js/app-quick.js`, `static/js/app-adventure.js` (host arrival on the yard), `static/js/logic-info.js`, `static/index.html` (CSS only, if needed)
- `tests/js/logic.test.mjs`

## Acceptance criteria
- [ ] Removed from the page code: „Koniec októbra na chate býva chladno a vlhko. Toto si dones:“, „Postele a matrace sú pripravené, ale bez perín a obliečok.“, „ Nákup na spoločné jedlá rozpočítame.“ and „Nič nie je povinné. Kto chce, len leží pri peci.“ (Q19). `grep` for each finds nothing in `static/`. The non-drinkable water warning stays.
- [ ] Pack, sleep and food slides start with `pack_intro`, `sleep_intro`, `food_intro` when set; nothing (no empty element) when missing.
- [ ] A pack item `note` is shown under the item on the pack slide and in the quick list.
- [ ] Food slide and quick list: `food_plan` as a list, `menu` by days only when present, `food_note` as a text, `bring` only when present; the „Na jedlo nás je“ counts stay.
- [ ] Chata slide: „Na chate je“ (✓) and „Na chate nie je“ (✗, visually stronger) from `facilities.have`/`missing`, each list only when non-empty; the same two lists in the quick list in the „Spanie“ card.
- [ ] `host_arrival` on the yard intro (Q20) and at the top of the quick list, only when set.
- [ ] `slideSignature` covers the new food and sleep fields; `quickWhatsAppText` includes `food_plan`, `food_note`, missing facilities and `host_arrival` when set, and no menu line when `menu` is absent.
- [ ] All config text via `textContent`/`createTextNode`; no `innerHTML`.
- [ ] Node tests: `quickWhatsAppText` with and without each new field and without `menu`/`bring`; any new pure helper (e.g. facility lists) tested. `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Keep new logic in `logic-info.js` so Node can test it; no new script file is needed (if you add one, list it in `index.html` with `?v=__ASSET_VERSION__`).
- Check with the shipped `config/info.yaml` from T-065 and with a file that has none of the optional fields.

---
## Dev log

## Review round 1

## Review round 2

## Test report
