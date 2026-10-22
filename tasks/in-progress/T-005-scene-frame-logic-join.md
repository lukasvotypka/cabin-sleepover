# T-005: Scene frame with info boards, core page logic and error texts with Node tests, code screen, „Kto si?“, polling

- **Phase:** 1
- **Depends on:** T-003
- **Size:** L

## Goal
Replace the placeholder `static/index.html` with the one-page app frame. It covers the code screen, the „Kto si?“ panel, live refresh of `/api/state`, and the one table that turns server error codes into Slovak messages. It also draws the pixel scene (grass, paths, buildings) with every info element the proposal puts inside it: the title board, three night signposts, noticeboard, and status board. The core pure logic functions live in their own block and are tested in Node. Beds and actions come in T-006, and the other panels in T-007. Proposal sections: „Pravidlá pre stavbu“ (Jazyky), „HTTP API“ (Odpoveď, Chybové kódy), „Cieľ a kontext“, „Stránka: jedna scéna a interakcie“ (Prvé otvorenie, Informácie v scéne), „Mapa“ (scene basics), „Vzhľad“, „Architektúra“ (Čítanie), „Testy“ (Logika stránky).

## Scope
- `static/index.html`
- `tests/js/logic.test.mjs` (Node built-in `node:test`, no npm dependencies)

## Acceptance criteria
- [ ] One file, no framework, no build step, with `<html lang="sk">` and a mobile viewport. Pinch-zoom stays enabled: no `user-scalable=no` and no `maximum-scale=1` (Q9).
- [ ] The page has no header, list view, „Mapa / Zoznam“ switch or overview page. Outside the scene there are only the code screen and the panels that slide over it.
- [ ] The pure functions live in a `<script id="logic">` block that does not touch `document` or `window` (Q8, decided). It covers:
  - [ ] the event date text from `event.arrive_days[0]` and `event.leave_days[-1]`, giving „29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)“
  - [ ] the night signpost label and dates („Št → Pi“ / „29./30. 10.“, „Pi → So“, „So → Ne“)
  - [ ] the Slovak day locative derived from the date („vo štvrtok“, „v piatok“, „v sobotu“)
  - [ ] presence `arrive ≤ n < leave`
  - [ ] needed slots `adults + kids − kids_in_parents_bed`
  - [ ] slots of a party per night
  - [ ] used count per night and total slot count (from the layout, not a hardcoded 20)
  - [ ] missing places and extra places per party and night (held slots compared with needed slots)
  - [ ] my-party status, in this priority:
    - [ ] the first night with missing places and its text, e.g. „V sobotu vám chýba 1 miesto“ (red)
    - [ ] otherwise the first night with extra places and its text, e.g. „Máte o 1 miesto viac, než potrebujete“ (soft amber, Q4)
    - [ ] otherwise „Všetko máte“ (green)
  - [ ] Slovak plural for places (1 miesto, 2–4 miesta, 5+ miest, 0 miest)
  - [ ] relative refresh time („aktualizované pred 20 s“)
  - [ ] **error text** `errorText(error, state)`: one lookup table from `code` to a Slovak message, filled from `error.params`. It covers every server code: `bad_code`, `forbidden`, `signup_closed`, `slot_taken`, `not_present`, `duplicate_name`, `unknown_slot`, `unknown_party`, `invalid` and `rate_limited`. Examples: `slot_taken` with `night: "2026-10-31"` and `party_name: "Riso a Ben"` gives „Toto miesto má v sobotu už Riso a Ben.“; `invalid` uses `params.field` to name the form field in Slovak. An unknown code, or a missing error (network failure), gives „Niečo sa nepodarilo, skús to znova.“
- [ ] `node --test tests/js/` passes. The tests extract the logic block from `static/index.html`, run it in `node:vm` and cover every function above. The cases include:
  - [ ] the date text and the three signpost labels for the real event dates
  - [ ] a party arriving on Friday is not present on the Thursday night
  - [ ] `kids_in_parents_bed` lowers the needed count
  - [ ] the status for a party missing 1 place on Saturday, for a party with 1 extra place, for a party with both (missing wins), and for a party with everything
  - [ ] the plural forms 0, 1, 2, 5
  - [ ] error texts:
    - [ ] each of the 10 server codes gives a non-empty Slovak text that differs from the fallback
    - [ ] the params are filled in (the `slot_taken` example above, word for word)
    - [ ] a code whose params are missing still gives a sensible sentence, with no `undefined` or `{party_name}` left in it
    - [ ] an unknown code gives the fallback
    - [ ] the English `message` never appears in the result
- [ ] **The page never shows the server's `message`.** Every error shown anywhere on the page (code screen, sheet, panels) goes through `errorText`.
- [ ] **Code screen:**
  - [ ] it uses the Vzhľad colors and fonts, in the scene's style (proposal: „v rovnakom štýle ako scéna“)
  - [ ] it has a code input and a button that call `POST api/join`
  - [ ] a wrong code (`bad_code`) and `rate_limited` each show their Slovak text from `errorText`
  - [ ] any `401` from a later call brings the screen back
- [ ] **„Kto si?“ panel:**
  - [ ] it lists the parties, plus **Pridať partiu**, which hands off to the T-007 party form (a stub hook is fine here)
  - [ ] the choice is stored as *moja partia* in `localStorage`
  - [ ] it opens after the first join, when the stored party no longer exists, and when the user taps „Si: …“ in the scene
- [ ] **Scene frame (SVG):**
  - [ ] built with `createElementNS` and `setAttribute`, with `viewBox` from `layout.map.viewbox` and `shape-rendering="crispEdges"`
  - [ ] it draws the grass with tufts, paths, rooms with labels, doors and windows from `layout`, in the style of `files/mapa-nahlad.html`
  - [ ] no geometry is hardcoded
  - [ ] it fills the full width on mobile
  - [ ] it keeps fixed colors in dark mode
  - [ ] scene text is pixel or monospace, not Alegreya
- [ ] **Title board** in `map.scene.title`: a wooden board with the event name and the date text, both from `/api/state`.
- [ ] **Three night signposts** in `map.scene.nights`:
  - [ ] each shows its label and dates and „obsadené X z 20“
  - [ ] the selected night is highlighted, and tapping one switches the night shown on the map
  - [ ] each hit area is at least 44 units tall and extends into the grass gaps above and below (Q9)
- [ ] **Noticeboard** in `map.scene.notice`:
  - [ ] three short Slovak instruction lines, e.g. „Ťukni na posteľ a zapíš sa.“, „Voľné miesto bliká.“, „Presunúť sa dá cez posteľ.“
  - [ ] open on the first visit; the first tap on the noticeboard or on any bed collapses it to a „?“ icon that reopens it; the collapsed state is remembered in `localStorage` (Q12)
- [ ] **Status board** in `map.scene.status` (94×88, two rows of 44 units, Q9):
  - [ ] top row: „Si: Ivan a Eva“ (or a prompt to choose when no party is set) and „aktualizované pred … s“; tapping the row opens „Kto si?“
  - [ ] bottom row, from the my-party status function:
    - [ ] a clear red sign with an exclamation mark when a night lacks places; tapping it selects that night
    - [ ] otherwise a soft amber note for extra places, e.g. „Máte o 1 miesto viac, než potrebujete“, without any alarm styling
    - [ ] otherwise a green „Všetko máte“ sign
  - [ ] each row is its own tap target, 44 units tall
- [ ] Every tappable scene element (signpost, status board, red sign, noticeboard and „?“) has `role="button"`, `tabindex="0"` and a Slovak `aria-label`, and works with Enter and Space.
- [ ] Polling and requests:
  - [ ] `GET api/state` every 30 s while the tab is visible, immediately on return to the tab, and after every write (using the `state` the write returns)
  - [ ] it sends `If-None-Match` and keeps the current state on `304`
  - [ ] each request sends `X-Client-Id`, a random ID created once and stored in `localStorage`
  - [ ] API paths are relative (`api/...`, not `/api/...`)
- [ ] No `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write` in the file. Party names and every other value from `/api/state` go in through `textContent` or `setAttribute`.
- [ ] Languages: all UI text is Slovak and informal, with „ “ quotes. Code, identifiers, comments and tests are in English.

## Notes for developer
- The server sends no Slovak text. Errors are `{code, message, params}`. `message` is an English note for developers and logs. All Slovak wording lives in the one `errorText` table in this file.
- The `params` keys come from T-004 (`night`, `slot`, `party_id`, `party_name`, `field`, …). Look up bed names from `state.layout` by `slot` when a message needs them.
- The old overview page is gone. The warnings and texts are written fresh from the proposal. The status board shows **missing places** in red and **extra places** as a soft amber note (Q4: the server never refuses extra places). The summary text in T-007 warns only about missing places, as the proposal says.
- Panel colors are the CSS variables in „Vzhľad“ (light, plus dark via `prefers-color-scheme`). The fonts are Alegreya (headings) and Alegreya Sans (text) from Google Fonts. Panels and the code screen use these. The scene does not.
- The doors in config have no color. The preview draws each one in the floor color of the room whose rect contains the door's top-left corner, and that rule matches all 5 doors.
- Signpost text („obsadené 18 z 20“) is tight in a ~65-unit-wide sign. Check it at 380 px and pick a small monospace size. The config rects are the organizer's decision (Q9), so do not change them.
- „obsadené X z 20“: the 20 is the total slot count from the layout, tight slots included.
- For a manual `If-None-Match`, use `fetch(..., {cache: "no-store"})` so the browser hands the `304` to your code.
- Role from join: store it as decided in Q6. The admin key icon and the locked-signup sign are moved to T-009 (phase 2), so nothing uses the role yet.
- This task needs only `/api/join` and `/api/state` (T-003). It runs in parallel with T-004, which touches only `app/` and `tests/*.py`. The error `params` keys are listed in the T-004 task file.
- Keep a single render path: state plus selected night plus *moja partia* gives the scene. T-006 adds beds to the same render.
- Open decision „Umiestnenie na serveri“: the default is the domain root, but relative paths keep a sub-path such as `/chata/` working.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
