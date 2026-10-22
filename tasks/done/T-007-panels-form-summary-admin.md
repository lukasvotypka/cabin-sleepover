# T-007: Panels over the map: party form, „Prehľad na poslanie“, hidden screen-reader summary

- **Phase:** 1
- **Depends on:** T-006
- **Size:** M

## Goal
Finish the one-page app. Add the party form (add and edit, warning before a stay is shortened), the letter icon with the WhatsApp summary panel, and the visually hidden text summary that replaces a list view for screen readers. Proposal sections: „Informácie v scéne“ (Prehľad na poslanie), „Formulár partie“, „Mapa“ (hidden summary), „Prvé otvorenie“ (Pridať partiu), „HTTP API“ (parties), „Vzhľad“.

## Scope
- `static/index.html`
- `tests/js/logic.test.mjs` (extend it)

## Acceptance criteria
- [x] New pure functions in the logic block, with Node tests:
  - [x] **summary text**: the name and date, then for each night the rooms (in layout order) with the party names, then warnings for parties with missing places, then the page link; tested against an expected string for a sample state
  - [x] **hidden summary content** for the selected night: the date, the instructions, and each room with its beds and names (or „voľné“)
  - [x] **slots freed by a changed stay**: tested for leave moved from Sunday to Saturday and for arrive moved from Thursday to Friday
- [x] A test builds the summary text and the hidden summary for the same sample state. Both list exactly the same party per bed and night as the slot data the map draws from (proposal acceptance criterion).
- [x] **Party form** (panel), opened from „Kto si?“ → **Pridať partiu**, from the status board for *moja partia*, and from the sheet's „not present“ hint:
  - [x] fields: meno, dospelí, deti, deti spiace s rodičmi, príchod (select from `event.arrive_days`), odchod (select from `event.leave_days`), čas príchodu, poznámka
  - [x] `maxlength` and min / max match the server limits (60 / 60 / 300, counts 0–20)
- [x] Creating a party calls `POST api/parties` and sets the new party as *moja partia*. `duplicate_name` and `invalid` errors show next to the form as Slovak text from the T-005 `errorText` table. For `invalid`, the text is shown next to the field named in `params.field`.
- [x] Editing calls `PUT api/parties/{id}`.
- [x] Before a save that shortens the stay, the form lists which places will be freed, with night and bed name, and asks for confirmation. After saving, it reports the server's `freed`.
- [x] **Letter icon** in `map.scene.letter` (Q11) opens a panel with the summary text in a read-only `textarea` and a **Kopírovať** button. The button uses `navigator.clipboard`, falls back to selecting the text, and confirms in Slovak. The text contains the page link and never a code.
- [x] **Hidden summary:** a visually hidden region (not `display:none`) that screen readers reach. It holds the hidden summary content for the selected night and updates with every new state and night switch. The SVG scene is labelled so a screen reader is pointed to it.
- [x] The letter icon has `role="button"`, `tabindex="0"`, a Slovak `aria-label` and a hit area of at least 44 units.
- [x] Panels use the Vzhľad colors and Alegreya fonts in light and dark mode. Buttons are at least 44 px. Escape closes a panel and focus returns to where it came from.
- [x] The server's English `message` is never shown. Every error goes through `errorText`, and new cases are added to that one table.
- [x] UI text is Slovak and informal with „ “ quotes. Code, comments and tests are in English. Human text goes in only through `textContent`, `value` or `setAttribute`, and there is still no `innerHTML`.
- [x] `node --test tests/js/` passes.

## Notes for developer
- The summary text format is defined by the proposal („Informácie v scéne“ → Prehľad na poslanie), not by any old page. Keep it plain and readable in WhatsApp.
- The summary link is the page URL (`location.origin + location.pathname`). Pass it into the pure function, so the function stays DOM-free and testable.
- `navigator.clipboard` needs HTTPS, which production has. Keep the fallback for local testing.
- Visually hidden means the usual clip / 1 px pattern. Do not use `display:none` or `visibility:hidden`, which hide it from screen readers too.
- The admin key icon, admin panel and signup lock are moved to T-009 (phase 2, not built now).
- Organizer decision `tasks/QUESTIONS.md` Q10: shrinking the party size frees nothing automatically, so only stay shortening shows a warning.

---
## Dev log

**What was done** (all in `static/index.html`, tests in `tests/js/logic.test.mjs`; `app/` untouched)

New pure functions in `<script id="logic">`:
- `summaryText(state, link)`: name, dates, per night the rooms in layout order with party names (`(N voľné)` when places remain, `nikto` for an empty room), then `Chýbajú miesta:` with one line per party, then `Tu sa zapíšeš: <link>`. No code ever appears. The section is left out when nobody lacks a place.
- `hiddenSummary(state, night)`: title, dates, instructions, night line, rooms with beds and `text` (names, or `voľné`).
- `bedOccupants` / `roomOccupants`: the one source of "who is in a bed" now shared by `bedLabel`, both summaries (so the map labels, the WhatsApp text and the hidden summary cannot drift apart).
- `freedByStay`, `freedLines`, `FREED_TEXTS`: places freed by a shortened stay (same order as the server's `freed`), worded per night with bed names.
- Form helpers: `defaultPartyForm`, `partyToForm`, `partyPayload`, `checkPartyPayload` (quick pre-check that returns server-shaped `{code: "invalid", params: {field}}` so `errorText` words it), `errorField`, `dayOptionText`, `PARTY_LIMITS` (60 / 60 / 300, counts 0-20), `FORM_FIELDS`. `errorText` for `invalid` also knows `reason: leave_not_after_arrive` ("Odchod musí byť po príchode.").
- `NOTICE_LINES` and `UNKNOWN_PARTY` moved into the logic block.

Page:
- **Party form** panel (`openPartyForm`): all eight fields, `maxlength`/`min`/`max` taken from `PARTY_LIMITS`, per-field error paragraphs (`aria-describedby`, `aria-invalid`), `duplicate_name` and `invalid` go next to the field named in `params.field`, other errors on top of the form. Create calls `POST api/parties` and sets the new party as *moja partia*. Edit calls `PUT api/parties/{id}`. When the new stay frees places, the form lists them (night + bed name) and asks for confirmation ("Uložiť a uvoľniť miesta"; editing any field drops the question). After saving it shows the server's `freed` in the panel.
- Entry points: „Kto si?“ -> **Pridať partiu**; for *moja partia* the status board opens „Kto si?“, which now has **Upraviť partiu „X“** (shown when a party is chosen); the sheet's "Upraviť príchod a odchod" hint (the `hooks` stubs are gone). Focus returns to the scene element the panel came from.
- **Letter icon** (`map.scene.letter`, 44x44 hit rect, `role="button"`, `tabindex="0"`, Slovak `aria-label`) opens „Prehľad na poslanie“: read-only textarea, **Kopírovať** (`navigator.clipboard`, falls back to select + `execCommand("copy")`, Slovak confirmation). The text follows the state while the panel is open. The link is `location.origin + location.pathname`.
- **Hidden summary**: `<section id="srSummary" class="sr-only">` (clip / 1 px, not `display:none`), redrawn on every render (new state and night switch) from the same state the map draws. The SVG label now says the same data is in text right after the map. It is hidden together with the scene while the code screen is up.
- Panels: form fields use the Vzhľad variables (checked in light and dark in headless Chrome at 380 px), buttons and inputs are at least 44 px, the Tab trap now covers select/textarea and skips hidden buttons.

T-006 review suggestions:
1. Move-check messages are now `MOVE_TEXTS` plus a pure `planMove(state, move, bed, night)` in the logic block (Node tests for one night, all nights, both failures). The four inline "neznáma partia" strings are the constant `UNKNOWN_PARTY`.
2. Long press tolerates 10 px of finger movement (`LONG_PRESS_SLOP`, `movedBeyond`, tested). `pointermove` no longer cancels unconditionally; up/cancel/leave still do.
3. In a move, one Escape only closes the open panel (the panel's capture handler now calls `stopPropagation`); a change of *moja partia* (`setMyParty` / `forgetMyParty`) ends the move.
4. On a 401 in a write there is no toast (`write()` now also returns `status`), the code screen shows with an empty error line, the move bar is hidden and the move ended. I also made `render()` return while the code screen is up: before, the response handler redrew and un-hid the scene behind the code screen.
5. Test nit fixed: the mattress bed label test now passes `rooms[1]` and expects "konica, dole".

**Files:** `/Users/luigi/workspace/chrapa-poll/static/index.html`, `/Users/luigi/workspace/chrapa-poll/tests/js/logic.test.mjs`.

**Tests**
- `cd /Users/luigi/workspace/chrapa-poll && node --test tests/js/` -> 86 pass, 0 fail (was 62; new tests for summary text against an expected string, hidden summary, same-parties-per-bed-and-night check between both texts and the slot data, freed slots for leave Sunday->Saturday and arrive Thursday->Friday, form payload/pre-check/limits/error field, move plan, long-press slop).
- `uv run pytest -q` -> 379 passed.
- Headless check at 380 px against my own uvicorn (port 8123, temp data dir, test secrets; the user's server was not touched; my server, temp data and browser profile are removed): create party (empty name and leave-before-arrive errors next to the field, then success, toast, set as *moja partia*), duplicate name error next to the name field, edit with shortening (places listed, confirm, saved, freed list shown, server state matches), letter panel (copy button, focus returns to the icon), hidden summary content, Escape in move mode (panel only, then move), party switch cancels move, 401 on move (code screen, no error text, move bar hidden, re-join works), long press with 6 px wobble shows the tip and 15 px does not. Screenshots in light and dark looked right.

**Deviations / notes**
- The Escape check used synthetic key events on `document`, not real key presses.
- "From the status board for *moja partia*": the board still opens „Kto si?“; the edit button sits there. A direct edit on the board would need more room in the 94x88 rect.
- The WhatsApp text format (headings, `(N voľné)`, `Chýbajú miesta:`, `Tu sa zapíšeš:`) is my own wording, as the proposal gives only the structure. The organizer may want to change the phrases.
- The note field is not checked client-side for control characters (the server does and returns `invalid` with `field: note`).
- Admin and signup lock were not touched (T-009).

## Review round 1

Checked: the full `git diff` of `static/index.html` and `tests/js/logic.test.mjs`, the surrounding page code (write/poll/applyState, openPanel/closePanel, code screen, move mode), `app/models.py` `PartyInput` and `app/validate.py` `check_stay` / duplicate name (params, field names, limits), `PUT api/parties` `freed` shape, and `config/chata.yaml` `map.scene.letter`.

Tests run by me:
- `node --test tests/js/`: 86 pass, 0 fail.
- `uv run pytest -q`: 379 passed.
- The `<script id="app">` block parses (`node --check` on the extracted block).

Acceptance criteria:
- Pure functions `summaryText`, `hiddenSummary`, `freedByStay` (+ `freedLines`) are DOM-free; the link is passed in. Tests cover the expected summary string, the hidden summary for Saturday, leave Sun -> Sat and arrive Thu -> Fri, and a cross-check of both texts against the raw `sleeping` data per bed and night. Met.
- Party form: all eight fields, `maxlength` 60/60/300 and counts `min 0 / max 20` from `PARTY_LIMITS`, which match `PartyInput`. Pre-check order (name, adults, kids, kids_in_parents_bed, arrive, leave, leave-after-arrive) mirrors the server and yields server-shaped errors. `duplicate_name` (server sends `field: name`) and `invalid` go next to `params.field` via `errorField`; anything else goes to the top error line. All text goes through `errorText`; the server `message` is never read. Met.
- Create -> `POST api/parties`, sets the new party as *moja partia*; edit -> `PUT api/parties/{id}` with `encodeURIComponent`. Shortening asks first with night + bed names, any field change drops the question, and after save the server's `freed` is listed. Met.
- Letter icon: 44x44 hit rect from config, `role="button"`, `tabindex="0"`, Slovak label, opens the panel with a readonly textarea and **Kopírovať** (clipboard, then select + `execCommand` fallback, Slovak status in a `role="status"` line). Link is `origin + pathname`, so no query/hash; the code is never in the URL anyway. Met.
- Hidden summary: `.sr-only` clip pattern (not `display:none`), rebuilt in `render()` (new state, night switch), hidden only together with the scene while the code screen is up; the SVG label points to it. Met.
- Panels: Vzhľad variables for inputs, 48 px controls, Escape closes and focus returns by `returnKey`, Tab trap now includes select/textarea and skips hidden buttons. Met.
- textContent only: all human text (names in the edit button, toast, summary, freed lists, hidden summary) goes through `htmlEl`/`textContent`/`.value`; no `innerHTML` (also enforced by the existing page test). Slovak, tykanie, „ “ quotes. Met.

T-006 follow-ups: `planMove` + `MOVE_TEXTS` are pure and tested; long-press slop is correct (`pointermove` cancels only beyond 10 px, up/cancel/leave still cancel); the panel's capture-phase `stopPropagation` on Escape does keep the document bubble-phase move handler from firing; a 401 in `runWrite` and in the form `send` shows no toast/error, and `showCodeScreen` now also hides the toast and ends the move. The `render()` guard on `app.codeOpen` is correct, and the join success path re-shows the scene and polls with a cleared ETag, so the scene is redrawn right after re-join.

**Blocker**
- None.

**Suggestion**
- `static/index.html` `openPartyForm` (`initialFocus` -> first `input`): when the form is opened from the sheet's „Upraviť príchod a odchod“, focus lands on the name field. On a phone this can pop the keyboard and the arrive/leave selects are further down. Consider focusing the `arrive` select (or the panel heading) for that entry point.
- `openSummary` `panel.refresh` uses `viewState().state`, so text copied mid-write can contain an unconfirmed change that is later rolled back. For the WhatsApp text, plain `app.state` (server truth) would be safer. The hidden summary is fine on `viewState`, since it mirrors the map.
- `.summary-text { font-size: 14px }`: iOS Safari zooms the page when a textarea with a font smaller than 16 px gets focus (the fallback `selectText()` focuses it, and so does a manual tap). 16 px avoids the zoom.
- Entry point "from the status board for *moja partia*" is two taps (board -> „Kto si?“ -> **Upraviť partiu „X“**). It is acceptable as is (the dev log says so). The tester should know this is the intended path.
- Empty name gives „Skontroluj pole „meno“.“ A specific text (e.g. `reason` from the pre-check -> „Napíš meno partie.“) would be friendlier. This is optional because the server does not send such a reason today.

**Nit**
- Night headings in the hidden summary read „Noc Št → Pi …“. Screen readers usually say "right arrow". Wording like „Noc zo štvrtka na piatok“ would read better.
- Client-side length checks use UTF-16 `.length` while the server counts code points after NFC, so the client is slightly stricter for emoji. This is harmless.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2
(reviewer appends)

## Test report

**Verdict: PASS.** No application code was changed and no tests were added by the tester.

**Automated**
- `node --test tests/js/` -> 86 pass, 0 fail.
- `uv run pytest -q` -> 379 passed (T-001..T-006 regression: no failures).
- `git diff --stat -- app` is empty (backend untouched).

**Browser run.** Chrome for Testing (headless, mobile emulation 380 px wide, scale 2), driven over CDP with real mouse, keyboard and touch input. Against my own uvicorn on 127.0.0.1:8137 (temp data dir, test secrets, started from an empty data file). The user's uvicorn on 8011 was not touched. Server, browser, profile and temp data were removed afterwards.

| Acceptance criterion | Result | Evidence |
| --- | --- | --- |
| Pure functions with Node tests (summary text, hidden summary, freed slots Sun->Sat and Thu->Fri) | pass | 86 Node tests pass; the freed lines also shown correctly in the browser |
| Summary text and hidden summary list the same party per bed and night as the slot data | pass | Node cross-check test; in the browser the WhatsApp text, hidden summary and `api/state` agreed for Thu, Fri and Sat |
| Party form fields, entry points (Kto si? -> Pridať partiu, board -> Kto si? -> Upraviť partiu, sheet hint „Upraviť príchod a odchod“) | pass | all eight fields present; all three paths opened the form; Escape from the hint form returned focus to the bed |
| `maxlength` / min / max match the server (60 / 60 / 300, counts 0-20) | pass | DOM: name 60, arrival_time 60, note 300, counts min 0 max 20 |
| Create: `POST api/parties`, new party becomes *moja partia*; `duplicate_name` / `invalid` next to the field as Slovak text | pass | empty name, leave not after arrive (next to leave), adults 21, kids_in_parents_bed above kids: field error, `aria-invalid`, focus on field. Duplicate name (also different case) -> „Partia „…“ už existuje. Vymysli iné meno.“ next to the name field, nothing on top. Server-side `invalid` (note with a control character, which the client does not pre-check) -> „Skontroluj pole „poznámka““ next to the note |
| Edit: `PUT api/parties/{id}` | pass | edit saved; `api/state` showed new leave and arrival time |
| Shortening a stay: lists freed places (night + bed) and asks; after saving shows the server's `freed` | pass | „V sobotu: Manželská posteľ (2 miesta), Posteľ pod oknom“ shown, `sleeping` unchanged until confirm; editing a field dropped the question; after confirm the same list shown as done and Saturday slots really free in `api/state` |
| Letter icon in `map.scene.letter`, textarea read-only, Kopírovať with clipboard, fallback and Slovak confirmation; link, never a code | pass | opened by tap and by Enter; `navigator.clipboard.readText()` equalled the textarea; with the clipboard removed the select + `execCommand` fallback said „Skopírované.“ with the text selected; text contains `http://127.0.0.1:8137/` and neither test code |
| Hidden summary region (not `display:none`), updates on state and night switch, SVG label points to it | pass | `display:block`, 1x1 px, absolute, clip; Friday and Saturday content differed after night switch; label „…Rovnaké údaje sú aj ako text hneď za mapou.“ |
| Letter icon `role="button"`, `tabindex="0"`, Slovak `aria-label`, hit area >= 44 | pass | measured 44x44 px at 380 px, keyboard focus works |
| Panels use Vzhľad colors, Alegreya, buttons >= 44 px, Escape closes and focus returns | pass | light and dark screenshots checked; controls 47-48 px; focus returned to `who`, `letter` and the bed. Note: the summary textarea is monospace (see notes) |
| Server `message` never shown, every error goes through `errorText` | pass | all errors seen were Slovak table texts; empty `codeError` on 401 |
| Slovak UI, English code, human text via `textContent` only, no `innerHTML` | pass | `grep innerHTML/outerHTML/insertAdjacentHTML/document.write` finds nothing; see HTML test below |
| `node --test tests/js/` passes | pass | 86/86 |

**T-006 follow-ups**
- Move texts (`planMove`, `MOVE_TEXTS`): Node tests pass; the move bar text rendered „Ťukni na nové miesto pre …“. pass.
- Long-press tolerance, with CDP touch events: 6 px wobble still showed the occupants tip and did not open the sheet; a 30 px drag showed no tip and no sheet; a short tap opened the sheet. pass (real fingers still on the manual list).
- Escape in move mode: with the „Kto si?“ panel open during a move, the first Escape closed only the panel (move bar stayed), the second ended the move. pass (real key events via CDP, not synthetic).
- 401 during a write: cleared cookies in mid move, tapped a bed -> no toast, code screen shown with empty error line, move bar hidden, scene hidden. Re-entering the code showed the scene again, redrawn. pass.

**Extra scenarios**
- Full end-to-end from an empty data file: create party (2 adults, 1 kid) -> is *moja partia* -> assign „Na všetky naše noci“ at the double bed (2 places) and a third place at the window bed -> `api/state` has the expected `sleeping` for all three nights.
- HTML in names and notes: name `<img src=x onerror="window.PWNED=1">Novákovci`, note `<b>bold</b> & <script>window.PWNED=2</script> „citát“`. Rendered as plain text in the form, toast, „Kto si?“ list, edit button, status board, WhatsApp textarea, hidden summary and the SVG; `window.PWNED` stayed undefined, no `<img>` in the body, script count unchanged.
- WhatsApp text with a party that lacks places: the „Chýbajú miesta:“ block lists „Veľkí: vo štvrtok chýba 6 miest, …“.
- `/data/chata-data.yaml`, `/config/app.yaml`, `/.env`, `/files/mapa-nahlad.html` all 404.
- Dark mode form with a field error and dark letter panel looked right (colors, 47-48 px controls).

**Observations (not failures)**
- The summary textarea is 14 px (the reviewer's iOS zoom note) and monospace rather than Alegreya. The criterion's fonts line is about panels in general; left as a manual check.
- The empty-name error is the generic „Skontroluj pole „meno““ (reviewer already noted it as optional).
- Real clipboard behaviour on iPhone and in the WhatsApp browser, real finger long press and screen readers could not be checked here. Added to `tests/manualne.md` under T-007.

**Bugs:** none.
