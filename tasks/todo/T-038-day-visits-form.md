# T-038: Day visits: party form toggle and day buttons

- **Phase:** 1
- **Depends on:** T-036, T-037
- **Size:** M

## Goal
Let a friend add or edit a day-only party in the party form (organizer's decision of 24. 10. 2026; proposal "Formulár partie"). A toggle „Prídem len na návštevu“ swaps arrival/departure for one button per event day. Look: mockup `/tmp/day-mock/index.html`, tab „Formulár“ (if still present).

## Scope
- `static/js/logic-form.js`, `static/js/app-form.js`, `static/index.html` (CSS only)
- `tests/js/logic.test.mjs`

## Acceptance criteria
- [ ] `defaultPartyForm(event)` adds `day_only: false, day_visits: []`. `partyToForm(dayOnlyParty)` gives `day_only: true`, its `day_visits`, and `arrive`/`leave` = the default first/last event days (so turning the toggle off has values).
- [ ] `partyPayload(raw)`: with `day_only` → `day_visits` sorted and unique, `kids_in_parents_bed: 0`, **no** `arrive`/`leave` keys; without it → exactly today's payload, **no** `day_visits` key.
- [ ] `checkPartyPayload` in day mode: no day → `{field: "day_visits", reason: "day_visits_empty"}`; a day not in `eventDays(event)` → `reason: "day_outside_event"`; arrive/leave checks are skipped. Stay mode is unchanged. `FORM_FIELDS` includes `day_visits`, so `errorField` maps server errors to the day grid.
- [ ] Form UI (Slovak, tykanie, all text via `textContent`):
  - [ ] Under the name field a toggle button (`aria-pressed`, ≥ 44 px, check box drawn with ✓) „Prídem len na návštevu“ with the hint „Nebudem nocovať, nepotrebujem miesto na spanie.“
  - [ ] Toggle on: the arrive/leave pair and „Deti v rodičovskej posteli“ are hidden; a field „Ktoré dni prídeš?“ shows one button per `eventDays` day labelled with `dayLabel` (e.g. „Pi 30. 10.“), each `aria-pressed`, ≥ 44 px, in a 2-column grid, with the hint „Môžeš vybrať aj dni, ktoré nejdú po sebe.“
  - [ ] Count, „Čas príchodu“, „Poznámka“ and „Farba“ stay in both modes. Toggling back and forth keeps the entered values.
  - [ ] Editing a day-only party opens with the toggle on and its days pressed.
  - [ ] Switching an overnight party that holds beds to day-only shows the existing freed-places confirmation (via `freedByStay(..., null, null)`) before saving, and the „Uvoľnili sa…“ result after.
- [ ] Node tests: `defaultPartyForm`, `partyToForm`, `partyPayload` and `checkPartyPayload` for both modes, including non-consecutive days (Pi + Ne) and the two day-mode errors.
- [ ] `node --test tests/js/` and `uv run pytest` pass. No new script file (if one is added, list it in `index.html` with `?v=__ASSET_VERSION__`).

## Notes for developer
- Day buttons are `<button type="button">`, not checkboxes, to match the mockup; keep keyboard focus visible (`:focus-visible` like `.pform .swatch`).
- Panel colors follow the "Vzhľad" CSS variables (light and dark). Reuse `.btn.secondary[aria-pressed]` styles where possible.
- The server re-checks everything (T-036); the form pre-check is only for speed.

---
## Dev log

## Review round 1

## Review round 2

## Test report
