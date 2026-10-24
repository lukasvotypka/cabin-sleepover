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
- [x] `defaultPartyForm(event)` adds `day_only: false, day_visits: []`. `partyToForm(dayOnlyParty)` gives `day_only: true`, its `day_visits`, and `arrive`/`leave` = the default first/last event days (so turning the toggle off has values).
- [x] `partyPayload(raw)`: with `day_only` → `day_visits` sorted and unique, `kids_in_parents_bed: 0`, **no** `arrive`/`leave` keys; without it → exactly today's payload, **no** `day_visits` key.
- [x] `checkPartyPayload` in day mode: no day → `{field: "day_visits", reason: "day_visits_empty"}`; a day not in `eventDays(event)` → `reason: "day_outside_event"`; arrive/leave checks are skipped. Stay mode is unchanged. `FORM_FIELDS` includes `day_visits`, so `errorField` maps server errors to the day grid.
- [x] Form UI (Slovak, tykanie, all text via `textContent`):
  - [x] Under the name field a toggle button (`aria-pressed`, ≥ 44 px, check box drawn with ✓) „Prídem len na návštevu“ with the hint „Nebudem nocovať, nepotrebujem miesto na spanie.“
  - [x] Toggle on: the arrive/leave pair and „Deti v rodičovskej posteli“ are hidden; a field „Ktoré dni prídeš?“ shows one button per `eventDays` day labelled with `dayLabel` (e.g. „Pi 30. 10.“), each `aria-pressed`, ≥ 44 px, in a 2-column grid, with the hint „Môžeš vybrať aj dni, ktoré nejdú po sebe.“
  - [x] Count, „Čas príchodu“, „Poznámka“ and „Farba“ stay in both modes. Toggling back and forth keeps the entered values.
  - [x] Editing a day-only party opens with the toggle on and its days pressed.
  - [x] Switching an overnight party that holds beds to day-only shows the existing freed-places confirmation (via `freedByStay(..., null, null)`) before saving, and the „Uvoľnili sa…“ result after.
- [x] Node tests: `defaultPartyForm`, `partyToForm`, `partyPayload` and `checkPartyPayload` for both modes, including non-consecutive days (Pi + Ne) and the two day-mode errors.
- [x] `node --test tests/js/` and `uv run pytest` pass. No new script file (if one is added, list it in `index.html` with `?v=__ASSET_VERSION__`).

## Notes for developer
- Day buttons are `<button type="button">`, not checkboxes, to match the mockup; keep keyboard focus visible (`:focus-visible` like `.pform .swatch`).
- Panel colors follow the "Vzhľad" CSS variables (light and dark). Reuse `.btn.secondary[aria-pressed]` styles where possible.
- The server re-checks everything (T-036); the form pre-check is only for speed.

---
## Dev log
- `logic-form.js`: `defaultPartyForm` gets `day_only`/`day_visits`; `partyToForm(party, event)` (new optional second argument, needed to give a day-only party the default first/last event days); `partyPayload` day branch (sorted unique `day_visits`, `kids_in_parents_bed: 0`, no `arrive`/`leave`); `checkPartyPayload` day branch (`day_visits_empty`, `day_outside_event`); `day_visits` in `FORM_FIELDS`.
- `app-form.js`: toggle button „Prídem len na návštevu“ under the name, day grid (`aria-pressed` buttons, `dayLabel`, hint), stay pair and „Deti v rodičovskej posteli“ hidden in day mode (values kept, just `hidden`), edit opens in the right mode, `freedByStay(..., null, null)` in day mode so the existing confirmation and „Uvoľnili sa…“ screen apply.
- `index.html`: CSS only (`.pform .toggle`, `.pform .daygrid`), from the mockup, with `:focus-visible` outlines.
- Tests: `partyToForm`/default test updated, 4 new tests at the end of `tests/js/logic.test.mjs`.
- Run: `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` (237 pass), `uv run pytest -q` (501 pass), `node --check` on both JS files.
- Not verified: the form UI items (toggle, day grid, edit mode, freed confirmation) are unticked below. I only syntax-checked the DOM code and did not open it in a browser, so the reviewer or tester should try it on the page.

## Review round 1
Tests run by the reviewer: `node --test tests/js/` 237 pass, `uv run pytest -q` 501 pass. No new script file, so all 19 scripts in `static/js/` are still listed in `index.html` with `?v=__ASSET_VERSION__`.

I checked the UI items by reading the code, without a browser (the tester should still try them on the page):
- Toggle: `<button type="button">` with `aria-pressed`, ✓ box, min-height 48 px and `:focus-visible`. It sits right under the name field, as in the mockup. Its text goes in via `textContent` (`htmlEl`).
- Hiding works: the global `[hidden] { display: none !important; }` (index.html:51) beats `.pform .pair` and `.pform .field`, so `inBed`, `days` and `dayGrid` really hide.
- Hidden fields stay safe:
  - In day mode, `partyPayload` forces `kids_in_parents_bed: 0` and drops `arrive`/`leave`, so a bad hidden count (`"?"`) or a stale arrive/leave cannot produce an error on a field the user can't see.
  - In stay mode, the array that `fields.day_visits.value` reads is ignored.
  - `PartyUpdate` is a full replacement, so omitting `arrive`/`leave` on PUT really switches the party to day-only and does not trip `stay_mode_mixed`.
- Day grid: one `aria-pressed` button per `eventDays` day, labelled with `dayLabel`, in a 2-column grid, 48 px tall, with the hint. The group has `role="group"`, is labelled by the visible label, carries `aria-describedby` for the error and the hint, and has `tabindex=-1` so `showError` can focus it, like the colour group. Pressed and unpressed styles come from the existing `.btn[aria-pressed]` rules (light and dark).
- Toggling keeps all values and clears errors. A `change` event (from the toggle and from the day buttons) dismisses a pending freed-places confirmation.
- Overnight to day-only: `freedByStay(..., null, null)` returns every held slot, so the existing confirmation runs before saving and `showDone` (`freed` from the PUT response) runs after.
- Edit of a day-only party: `partyToForm(party, event)` turns the toggle on, presses its days, and fills arrive/leave with the default first and last event days.

No blockers.

**Suggestion**
- `app-form.js:136`: if a stored day-only party has a day that is no longer in `eventDays(event)` (the organizer changed the dates in `cabin.yaml`), that day stays in `picked` with no button to unpress it. Every save then fails with `day_outside_event` and the user cannot fix it. Startup validation (T-036) probably rejects such data anyway. If not, filtering `picked` to `eventDays(event)` would be a one-line guard.
- `FREED_TEXTS.ask` says „Skrátením pobytu…“. That reads a little off when someone switches to day-only, but the task asks for the existing confirmation, so this is fine for now.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester: Haiku 5.5 (tester), 2026-10-24. Result: **PASS**, no defects found. No application code changed. The tester added nothing to `tests/`, and changed `tests/manual.md` only (see below). Nothing committed.

**Automated suite (run once, full):**
- `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` → 237 pass, 0 fail.
- `uv run pytest -q` → 501 passed (no regressions in `tasks/done/` work).

**Browser run (t3-code preview tab, viewport 380 × 800 CSS px, own server on `127.0.0.1:8123`, temp data dir, test secrets via env, `/api/state` checked via curl):**
- The preview tab never became visible and screenshots timed out, so layout was checked numerically (`getBoundingClientRect`, computed styles), not by eye.
- Toggle „Prídem len na návštevu“: `aria-pressed` true/false, 340 × 98 px, ✓ box and hint present, pressed/unpressed toggles correctly.
- Day mode: arrive/leave pair and „Deti v rodičovskej posteli“ hidden; grid shows „Št 29. 10.“, „Pi 30. 10.“, „So 31. 10.“, „Ne 1. 11.“; 2 columns (166 px each), 2 rows, 48 px tall; hint „Môžeš vybrať aj dni, ktoré nejdú po sebe.“; no horizontal overflow (`scrollWidth` 380).
- Count, „Čas príchodu“, „Poznámka“, „Farba“ visible in both modes; adults `2`, name and picked days survive toggle off → on.
- Create day-only with Pi 30. 10. + Ne 1. 11. (non-consecutive): saved as `day_visits: ['2026-10-30', '2026-11-01']`, no `arrive`/`leave`, `kids_in_parents_bed: 0`.
- Edit of that party: toggle opens on, Pi and Ne pressed.
- Day mode with no day selected: „Vyber aspoň jeden deň, keď prídeš.“ under the grid, focus moves to the grid, `aria-describedby` = error + hint.
- Overnight party „Jano Stay“ with 2 beds on all three nights (set up via `/api/assign-stay`) → toggle on, Pi + Ne → „Uložiť a uvoľniť miesta“ shows „Skrátením pobytu sa uvoľnia tieto miesta:“ with Thu/Fri/Sat „Manželská posteľ (2 miesta)“ before saving; after saving the panel reads „Uložené. Uvoľnili sa tieto miesta:“ with the same three lines. Server: `sleeping` empty, party day-only.
- Day-only → overnight (Ivan Test): toggle off shows default `2026-10-29` / `2026-11-01`, save creates a stay party with no freed confirmation (no beds held). Server stored `day_visits: []` for the overnight party (model default after the full PUT; not a defect).
- Focus: toggle and day buttons show a 3 px `:focus-visible` outline.
- Dark mode (`prefers-color-scheme: dark`): panel `rgb(36,28,22)`; unpressed day text `rgb(242,219,184)` on the panel; pressed day light background with dark text; toggle `rgb(241,231,217)` on `rgb(63,44,22)`. Reset to light afterwards.
- `innerHTML`/`outerHTML`/`insertAdjacentHTML` absent from `static/js/app-form.js` and `static/js/logic-form.js`.
- `git diff static/index.html`: CSS only.

**Server probes (`POST /api/parties`, day mode):**
- `day_visits: ['2026-11-02']` → 422 `invalid`, reason `day_outside_event`, field `day_visits`.
- `day_visits: []` → 422 `day_visits_empty`.
- `['2026-11-01', '2026-10-30', '2026-10-30']` → 422 `duplicate_day`.
- `day_visits` + `arrive` → 422 `stay_mode_mixed`.
- Startup with a stored day outside the event → refuses (`StartupError … day_visits … outside the event`). This covers the review-round-1 suggestion, so no code change is needed.
- `kids_in_parents_bed` 3 with `kids` 0 → 422 `invalid` without a reason (the existing count rule, not the day-only rule; the day-only rule with reason is covered by pytest).

**Criteria:**

| Criterion | Result | Evidence |
| --- | --- | --- |
| `defaultPartyForm`, `partyToForm` (default first/last days) | pass | node tests; UI edit and toggle-off values |
| `partyPayload` day and stay branches | pass | node tests; saved payloads on the server |
| `checkPartyPayload` day errors, stay unchanged, `FORM_FIELDS` | pass | node tests; UI error under the grid; server reasons |
| Toggle (`aria-pressed`, ≥ 44 px, ✓, hint) | pass | browser |
| Toggle on hides pair and bed count, day grid with `dayLabel`, 2 columns, ≥ 44 px, hint | pass | browser |
| Count, time, note, color in both modes; values kept | pass | browser |
| Edit opens in day mode with days pressed | pass | browser |
| Overnight with beds → day-only: freed confirmation before, „Uvoľnili sa…“ after | pass | browser and server |
| Node tests and suite pass, no new script | pass | commands above; `index.html` diff CSS only |

**Not verified (need a human or a real device):**
- iPhone Safari and Android Chrome: touch and layout at 380 px, light and dark by eye.
- VoiceOver and TalkBack: toggle and day buttons read with their pressed state, and the group label „Ktoré dni prídeš?“.
- Visual look against the mockup (no screenshot was possible).

**Observations (not failures):**
- `FREED_TEXTS.ask` „Skrátením pobytu sa uvoľnia…“ reads oddly when someone switches to day visits. Already noted by the reviewer. Added to `tests/manual.md` as a wording check for the organizer.

**Changes by the tester:**
- `tests/manual.md`: the T-037 item said the form could not yet create day-only parties (T-038); it now describes the form. Added a T-038 checklist item for iPhone Safari, Android Chrome and screen readers.
- Ticked the Form UI criteria in this file, which were verified in the browser.

**Decision:** all criteria pass, no regressions → `tasks/done/`.
