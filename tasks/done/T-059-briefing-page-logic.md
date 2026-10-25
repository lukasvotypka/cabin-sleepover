# T-059: Page logic for „Pred cestou“ (Node-tested)

- **Phase:** 1
- **Depends on:** none (data shapes as in proposal "Pred cestou"; can run in parallel with T-057/T-058)
- **Size:** M

## Goal
All derived values of „Pred cestou“ as pure functions, so the views (T-060 … T-064) only draw them. See proposal "Pred cestou" subsections "Stránka" and "Kto si to prešiel".

## Scope
- New `static/js/logic-info.js` (listed in `static/index.html` after `logic-summary.js`, with `?v=__ASSET_VERSION__`)
- `tests/js/index.js` / `tests/js/logic.test.mjs` (new tests)

## Acceptance criteria
- [x] `BRIEFING_STEPS` = `["pack","water","food","program","sleep"]` (station order: auto, studňa, ohnisko, smerovník, chata).
- [x] `needsMat(state, partyId)`: true when the party has a slot on any night in a bed of kind `mats` or `cot`. `matPlaces(state, partyId)` returns the distinct „room · bed“ names for the chata note (Q18 default).
- [x] `packItems(info, needsMat)`: `info.pack`, then „Plachta na matrac“, then „Karimatka“ only when `needsMat`, then „Balená voda“ (order as prototype `packItems()`), each `{icon, label}`.
- [x] `loadPacked(storage)` / `togglePacked(storage, label)` with an injected `localStorage`-like object, key `info-packed`; corrupt JSON gives an empty set. `packProgressText(done, total)` → „Ťukni, čo už máš · 3 z 15“, and „Všetko zbalené!“ when all are done.
- [x] `waterDefaults(state, partyId)`: people = adults + kids; days = nights of the stay, or number of `day_visits` for a day-only party. `waterResult(people, days, info.water)` → litres and bottles (`ceil(l / bottle_liters)`); `formatNumber` uses a decimal comma (`1,5`). Bounds for the +/− buttons: people 1–20, days 1–number of event days.
- [x] `briefingDone(state, partyId)`: true when all five steps or `list` are recorded. `briefingStatusText(state, partyId)` → „✓ prejdené“, „2 z 5“ (station steps only) or „ešte nie“. `briefingCount(state)` → `{done, total}` over all parties (board „6/9“). `notBriefedNames(state)` → names of parties not done, in party order.
- [x] `nextStation(visited)` → first of `BRIEFING_STEPS` not visited, or `null`; `boardHint(nextStep)` → the prototype `hint` texts.
- [x] `quickWhatsAppText(info, title)`: the prototype `waText()` lines from `info` (water line only when `drinkable` is `false`), no HTML.
- [x] Every function returns `null`/empty sensibly when `state.info` is `null` or the party is unknown. Node tests cover each bullet including a `cot` bed, a day-only party, `list` alone counting as done, and the „Všetko zbalené!“ case. `node --test tests/js/` passes.

## Notes for developer
- Open decision "Pred cestou, čo je „prejdené“": default all five stations or `list`.
- Packed state is phone-only and is never sent to the server.
- If `info.pack` already has an item labelled like an added one, show it once (default of `tasks/QUESTIONS.md` Q18).
- Plain script, no ES modules, shares the global scope; no DOM access in this file.

---
## Dev log

Added `static/js/logic-info.js` (listed after `logic-summary.js` in `static/index.html`) and tests at the end of `tests/js/logic.test.mjs`. `node --test tests/js/`: 307 pass, 0 fail. Python suite not run (no `uv` on PATH here; only a script tag was added). Assumptions: `state.briefing` is `{party_id: [steps]}`; `loadPacked`/`togglePacked` return a `Set`; `waterBounds(state)` gives the +/- limits; `briefingStatusText`/`briefingCount` return `null` when `state.info` is null; `quickWhatsAppText` labels menu days with `dayLabel` („Št 29. 10.“).

## Review round 1

Checked `static/js/logic-info.js`, the `index.html` script tag (after `logic-summary.js`, with `?v=__ASSET_VERSION__`; every file in `static/js/` is listed) and the new tests. Ran `node --test tests/js/`: 307 pass, 0 fail. Ran `uv run pytest -q`: 556 passed (the tree includes T-057).

Every criterion is met: station order, `mats`/`cot` detection with distinct „room · bed“ names (Q18), pack order and case-insensitive de-duplication (Q18), injected storage with a corrupt-JSON fallback, progress text, water defaults (nights via `isPresent`, day visits for a day-only party, clamped to the bounds), done = five stations or `list`, „2 z 5“ counting station steps only, count and names in party order, prototype hints, and WhatsApp text with no HTML. No DOM access, no new globals that clash with other scripts, and null/unknown inputs are handled.

**Blockers:** none.

**Suggestion**
- `logic-info.js` `waterResult`: `Math.ceil(liters / water.bottle_liters)` can round up one bottle too many when floating-point error pushes an exact quotient just above an integer. Example: `liters_per_day: 0.1`, `bottle_liters: 0.1`, 3 people, 1 day gives 4 bottles instead of 3. With the default 2 / 1.5 this cannot happen. A small epsilon (`Math.ceil(q - 1e-9)`) would fix it.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (T-059, run on the working tree; no commit). PATH needed `/opt/homebrew/bin` for `node` and `uv`.

**Commands and results**
- `node --test tests/js/`: 307 pass, 0 fail.
- `uv run pytest -q`: 556 passed (full suite, includes T-057 files; no failures).
- Served page: `GET /` lists `static/js/logic-info.js?v=<hash>` (placeholder replaced), `GET /static/js/logic-info.js` returns 200, `GET /data/cabin-data.yaml` returns 404 (temp data dir).
- Name collisions: none of the new globals (`BRIEFING_STEPS`, `PACKED_KEY`, `WATER_LIMITS`, `BRIEFING_HINTS`, all functions) is declared in another `static/js/*.js` file.
- Probes in a Node vm with the real logic files (scratch scripts in `/tmp/t059`, not in the repo): `matPlaces` distinct names for `mats` and `cot`, `needsMat`, `packItems` with and without a mat, duplicate label ignored case-insensitively, `packItems(null)`, `loadPacked` on corrupt JSON / non-array / non-string items / `getItem` returning `null` or throwing, `togglePacked` twice restores the set, `packProgressText` (3 of 15, 15 of 15), `waterDefaults` clamping (0 people → 1, 30+5 → 20, day-only party → 1 day, one-night stay → 1), `waterBounds` (4 event days), `waterResult` (3 × 3 × 2 l = 18 l, 12 bottles; `water` null → null), `formatNumber` (`1,5`, `3`, `0,3`, `2,5`), `briefingStatusText` (`✓ prejdené`, `1 z 5`, `2 z 5`, `ešte nie`, null without info), duplicate `water` counted once, `list` plus `water` done, `briefingCount` (1 of 2; null without info), `notBriefedNames` in party order, `briefingDone` for unknown party and null info, `nextStation` (`water`, null when all visited, `pack` for undefined), `boardHint`, `quickWhatsAppText` (water line only for `drinkable: false`, no HTML, `""` for null). The text matches the prototype `waText()` in `design/info/index.html`, except the water line is conditional as specified.

**Acceptance criteria**

| # | Criterion | Result |
| --- | --- | --- |
| 1 | `BRIEFING_STEPS` order | pass |
| 2 | `needsMat` / `matPlaces` (mats and cot, distinct names) | pass |
| 3 | `packItems` order, mat only when `needsMat`, dedupe | pass |
| 4 | `loadPacked` / `togglePacked` injected storage, corrupt JSON, `packProgressText` | pass |
| 5 | `waterDefaults`, `waterResult`, `formatNumber`, bounds | pass |
| 6 | `briefingDone`, `briefingStatusText`, `briefingCount`, `notBriefedNames` | pass |
| 7 | `nextStation`, `boardHint` | pass |
| 8 | `quickWhatsAppText` | pass |
| 9 | null/unknown handling, Node tests cover each bullet, `node --test tests/js/` passes | pass |

**Extra scenarios:** null `info` and unknown party across all functions; corrupt storage; clamping at both bounds; `cot` bed; day-only party; `list` alone counts as done; „Všetko zbalené!“.

**Non-blocking note (not a failure):** `waterResult` uses the literal `Math.ceil(liters / bottle_liters)`, which matches the criterion. With `liters_per_day: 0.1` and `bottle_liters: 0.1`, 3 people and 1 day, it returns 4 bottles instead of 3, because `0.30000000000000004 / 0.1` is `3.0000000000000004`. The shipped config (2 l, 1.5 l) is exact and not affected. The reviewer's epsilon suggestion was not applied. Optional follow-up for the developer: `Math.ceil(liters / bottle_liters - 1e-9)`.

**Manual:** nothing for T-059 (pure logic). The visual check belongs to T-060 to T-064.

**Result: PASS.** Moved to `tasks/done/`.
