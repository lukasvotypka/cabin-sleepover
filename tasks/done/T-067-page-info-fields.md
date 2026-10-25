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
- [x] Removed from the page code: „Koniec októbra na chate býva chladno a vlhko. Toto si dones:“, „Postele a matrace sú pripravené, ale bez perín a obliečok.“, „ Nákup na spoločné jedlá rozpočítame.“ and „Nič nie je povinné. Kto chce, len leží pri peci.“ (Q19). `grep` for each finds nothing in `static/`. The non-drinkable water warning stays.
- [x] Pack, sleep and food slides start with `pack_intro`, `sleep_intro`, `food_intro` when set; nothing (no empty element) when missing.
- [x] A pack item `note` is shown under the item on the pack slide and in the quick list.
- [x] Food slide and quick list: `food_plan` as a list, `menu` by days only when present, `food_note` as a text, `bring` only when present; the „Na jedlo nás je“ counts stay.
- [x] Chata slide: „Na chate je“ (✓) and „Na chate nie je“ (✗, visually stronger) from `facilities.have`/`missing`, each list only when non-empty; the same two lists in the quick list in the „Spanie“ card.
- [x] `host_arrival` on the yard intro (Q20) and at the top of the quick list, only when set.
- [x] `slideSignature` covers the new food and sleep fields; `quickWhatsAppText` includes `food_plan`, `food_note`, missing facilities and `host_arrival` when set, and no menu line when `menu` is absent.
- [x] All config text via `textContent`/`createTextNode`; no `innerHTML`.
- [x] Node tests: `quickWhatsAppText` with and without each new field and without `menu`/`bring`; any new pure helper (e.g. facility lists) tested. `node --test tests/js/` and `uv run pytest` pass.

## Notes for developer
- Keep new logic in `logic-info.js` so Node can test it; no new script file is needed (if you add one, list it in `index.html` with `?v=__ASSET_VERSION__`).
- Check with the shipped `config/info.yaml` from T-065 and with a file that has none of the optional fields.

---
## Dev log

- Removed the fixed sentences (slides, "Nákup..." tip); added intros, pack item notes, food_plan/menu/food_note/bring, facilities lists (slide and quick list), host_arrival (yard `.adv-host` + top of quick list), WhatsApp text and slideSignature extended.
- Files: static/js/logic-info.js (infoList, facilityLists, menuDays, quickWhatsAppText, slideSignature), app-slides.js, app-quick.js, app-adventure.js, static/index.html (CSS), tests/js/logic.test.mjs.
- Commands: `node --test tests/js/` (all pass), `uv run pytest -q` (603 passed). Not checked visually in a browser.

## Review round 1

Tests run: `node --test tests/js/` 318/318 pass, `uv run pytest -q` 603 passed. Checked against the shipped `config/info.yaml` and a minimal info (server sends unset fields as `null` via `model_dump`; all new reads are guarded: `infoList`, `menuDays`, `facilityLists`, truthy checks for intros/`food_note`/`bring`/`host_arrival`). Fixed sentences are gone from `static/` (grep and the new Node test), water warning stays, no `innerHTML`, no new script file.

**Blocker**

1. `static/js/logic-info.js:42-56` `packItems()` was not changed and builds items as `{icon, label}` only, so it drops `note`. `app-slides.js` (`if (it.note) ...adv-note`) and `app-quick.js` (`if (it.note) ...qk-note`) therefore never show anything. Scenario: shipped `config/info.yaml` has `Spacák` with `note: "Nemáš? Daj vedieť, požičiame."`; `packItems(info, false)` returns `[{"icon":"spacak","label":"Spacák"}, ...]` (verified in Node), and the note appears on neither the pack slide nor the quick list. AC 3 is not met. Fix: carry `note` through in `add()` for `info.pack` items (the fixed extra items have none), and add a Node test that `packItems` keeps a pack item's `note` (and omits it when absent).

**Suggestion**

- `app-adventure.js` `.adv-host` is fixed at `top: 78px`; if the board hint wraps to a third line on a narrow phone, the board (top 10px, min-height 48px) can grow over it. Consider placing the host note in the flow under the board, or check at 380 px with the longest hint.
- The host note is set only in `advBuild()`, so a live `info` change while the yard is open does not update it. Fine in practice (config changes need a restart), just noting.

Verdict: CHANGES REQUESTED

## Dev log (round 1 fixes)

- Blocker fixed: `packItems()` in `static/js/logic-info.js` now carries `note` for `info.pack` items (omitted when absent); Node test extended in `tests/js/logic.test.mjs`.
- Suggestion taken: board and host note now sit in one `.adv-top` wrapper (`app-adventure.js`, `static/index.html`), the note in the flow under the board, so a wrapped hint cannot cover it. Live `info` update of the note: left as is (config changes need a restart).
- `node --test tests/js/`: 318/318 pass.

## Review round 2

Tests run: `node --test tests/js/` 318/318 pass; `uv run pytest -q` 603 passed (with node on PATH; without it the 3 `test_map_layout.py` tests fail only because they need Node).

- Round-1 blocker fixed: `packItems()` (`static/js/logic-info.js:41-56`) now passes `note` through for `info.pack` items and leaves it out when absent or null. The test in `tests/js/logic.test.mjs` (~3580) covers both cases, and the fixed extra items stay `{icon, label}`.
- Suggestion taken: the board and `.adv-host` now sit in the flow inside the absolutely positioned `.adv-top`, so a wrapped hint pushes the note down instead of covering it. The positioning moved from `.adv-board` to `.adv-top` in both the base rule and the ≥900 px rule, and nothing else depended on `.adv-board` being absolute. The host text uses `textContent`, the note is hidden while a slide is open and only shows when `host_arrival` is set.
- No new script files. Every script in `static/js/` is listed with `?v=__ASSET_VERSION__`.

No blockers.

Verdict: APPROVED

## Test report

## Test report

Result: **PASS** (orchestrator, 25. 10. 2026, browser check in the T3 preview at 390 px against an own server on port 8131 with the shipped `config/info.yaml`).

- Suites: `node --test tests/js/` 318 pass, `uv run pytest -q` 603 passed.
- Yard: „Organizátor príde na chatu okolo 16:00.“ under the top board.
- Chata: `sleep_intro`, plachta „podľa potreby“, „Na chate je“ ✓ gril, piecka, sporák, teplá voda v kuchynke; „Na chate nie je“ ✗ sprcha, WC in the strong red box; mat note kept.
- Ohnisko: `food_intro`, `food_plan` list, `food_note`, „Na jedlo nás je“ counts; no day menu, no „Nákup na spoločné jedlá rozpočítame.“
- Auto: `pack_intro`, Spacák shows „Nemáš? Daj vedieť, požičiame.“
