# T-018: First letter of the party name on every figure's shirt

- **Phase:** 1 (organizer request, 22. 10. 2026)
- **Depends on:** T-014
- **Size:** S

## Goal
Each figure on the map carries the first letter of its party's name as a tiny pixel letter on its torso, like a print on a T-shirt. This tells parties with similar colours apart without a long press. The „Kto je kto“ legend (T-014) shows the same letter in each party's swatch, so the map and the list match. Proposal sections: "Mapa" (postavička vo farbe partie), "Vzhľad".

Organizer's words: „nech má každá postavička malej veľkosti prvý znak mena na chrbte – akoby na tričku“. This replaces the earlier hover-tooltip idea, which the organizer withdrew.

## Scope
- `static/index.html`:
  - `<script id="logic">`: constants `PIXEL_FONT`, `SHIRT_DARK`, `SHIRT_LIGHT` and pure functions `shirtChar`, `glyphPath`, `relLuminance`, `contrastRatio`, `shirtInk`, `shirtOrigin`. `legendRows` gets two more fields (see below).
  - `<script id="app">`:
    - `drawFigure(g, px, py, color, kind, ch)` gets an optional `ch` (a `PIXEL_FONT` key, or null/undefined for no letter) and draws the letter last.
    - `drawBed` passes `shirtChar(who.party.name)`, or null for an unknown party.
    - The legend rows (`openLegend`) draw the letter in the swatch.
  - CSS: `.legend-row .swatch` centres its content.
- `tests/js/logic.test.mjs`: tests of the new pure functions and the extended `legendRows`.
- `tests/manualne.md`: check items in sections 5, 6 and 8.
- `proposal.md`: one bullet in "Vzhľad" (see below).

Out of scope:
- figure size, bed geometry, `figurePositions`, hit areas;
- the long-press names board, the bed sheet swatches, the „Kto si?“ swatches;
- the meadow (T-016) and the walk (T-017). They reuse `drawFigure` and pass the letter, see their task files;
- the server.

## Decisions (product owner defaults, organizer may change)
- **A hand-made 3 × 5 pixel font, drawn as one SVG `<path>` per letter, not SVG `<text>`.**
  - Scale: the torso of an adult is 10 × 7 scene units. One unit is about 1 CSS px on a 380 px phone at 1x (3 device px on a typical phone).
  - Why not `<text>`: text at size 5–6 is anti-aliased whatever `shape-rendering` says, depends on the font, and turns into a grey smudge.
  - Why the font: it stays crisp at every zoom (T-010, up to 4x), matches the pixel style, and needs no font.
  - Legibility: at 1x the letter is a small mark you can read when you look closely. With zoom it reads clearly. This is the most the current figure size allows.
- **Kids get the letter too, the same 3 × 5 glyph.** The organizer said „každá postavička“.
  - The visible kid shirt below the head is exactly 8 × 5, so the letter fills its height with no margin.
  - Omitting it for kids, or a 2 × 3 font, was rejected: 2 × 3 cannot draw most letters distinctly.
- **Character rule:**
  - Normalize the name with NFD and strip combining marks, so Š → S, Ľ → L, Ď → D, Ô → O, Ä → A.
  - Take the first letter or digit, skipping leading spaces, quotes and emoji.
  - Uppercase it.
  - If that character is not in the font (e.g. Ł, Ø, Greek, Cyrillic), or there is no letter or digit at all, the fallback is a single centred dot `·`.
  - The rule never skips ahead to a later letter: „Łukasz“ gets `·`, not `U`.
- **Letter colour:**
  - dark `#2E1F14` (= `COLORS.ink`) or light `#F4EBD0` (= `COLORS.paper`), whichever has the higher WCAG contrast ratio with the party colour;
  - with the 12 palette colours every choice is at least 3.2 : 1;
  - a figure of an unknown party (party missing from the state, grey `COLORS.mat`) gets no letter.

## Pure functions and constants (in `<script id="logic">`, no DOM, no `app`)
```js
var SHIRT_DARK = "#2E1F14";    // same as COLORS.ink
var SHIRT_LIGHT = "#F4EBD0";   // same as COLORS.paper

// 3 x 5 glyphs, rows top to bottom, "#" = pixel. Keys: A–Z, 0–9 and the fallback "·".
var PIXEL_FONT = { A: [".#.", "#.#", "###", "#.#", "#.#"], ... };

// The PIXEL_FONT key for a party name: NFD, strip \p{M}, first char matching [\p{L}\p{N}] (u flag),
// toUpperCase, first code point; "·" when there is none or it is not a key of PIXEL_FONT.
function shirtChar(name)

// SVG path data of a glyph with its top-left pixel at (x, y): "M{x+c} {y+r}h1v1h-1z" for every "#",
// in row order. Unknown keys draw the "·" glyph. Numbers only, never any text from people.
function glyphPath(ch, x, y)

// WCAG relative luminance of "#RRGGBB" (0 … 1), and the contrast ratio of two such colours (1 … 21).
function relLuminance(hex)
function contrastRatio(a, b)

// SHIRT_DARK or SHIRT_LIGHT, whichever contrasts more with `color` (a tie goes to dark).
// Anything that is not "#RRGGBB" gives SHIRT_DARK.
function shirtInk(color)

// Top-left pixel of the letter on a figure drawn at (px, py), see drawFigure:
// adult [px + 3, py + 6] (rows 6–10 of the 7-row torso, 1 unit of shirt above and below);
// kid   [px + 3, py + 4] (rows 4–8, the shirt below the head).
function shirtOrigin(px, py, kind)
```

### Font table (start from this; a developer may redraw a glyph that reads badly, but must say so in the dev log)
```
A .#. #.# ### #.# #.#    N ##. #.# #.# #.# #.#    0 ### #.# #.# #.# ###
B ##. #.# ##. #.# ##.    O .#. #.# #.# #.# .#.    1 .#. ##. .#. .#. ###
C .## #.. #.. #.. .##    P ##. #.# ##. #.. #..    2 ##. ..# .#. #.. ###
D ##. #.# #.# #.# ##.    Q .#. #.# #.# ##. .##    3 ##. ..# .#. ..# ##.
E ### #.. ##. #.. ###    R ##. #.# ##. #.# #.#    4 #.# #.# ### ..# ..#
F ### #.. ##. #.. #..    S .## #.. .#. ..# ##.    5 ### #.. ##. ..# ##.
G .## #.. #.# #.# .##    T ### .#. .#. .#. .#.    6 .## #.. ### #.# ###
H #.# #.# ### #.# #.#    U #.# #.# #.# #.# ###    7 ### ..# .#. .#. .#.
I ### .#. .#. .#. ###    V #.# #.# #.# #.# .#.    8 ### #.# ### #.# ###
J ..# ..# ..# #.# .#.    W #.# #.# ### ### #.#    9 ### #.# ### ..# ##.
K #.# #.# ##. #.# #.#    X #.# #.# .#. #.# #.#    · ... ... .#. ... ...
L #.. #.. #.. #.. ###    Y #.# #.# .#. .#. .#.
M #.# ### ### #.# #.#    Z ### ..# .#. #.. ###
```

## Drawing
- `drawFigure(g, px, py, color, kind, ch)` draws torso, head and eyes exactly as today. Then, when `ch` is given, it adds one `<path>` with `d = glyphPath(ch, …shirtOrigin(px, py, kind))`, `fill = shirtInk(color)` and `aria-hidden="true"`, through `svgEl` with attributes only. The party name never goes into markup, `textContent` or an attribute. Only the font key selects fixed pixel data.
- The letter lies inside the torso rect (adult `[px, py+5, 10, 7]`, kid visible shirt `[px+1, py+4, 8, 5]`). It never overlaps the head, so the figure's outline, the yellow frame of my party (`pos − 1`, 12 × 14) and every hit area stay the same.
- The letter is inside the slot's `<g>`, so a pending („ukladám“) figure fades together with its letter.
- `drawBed`: `drawFigure(sg, pos[0], pos[1], color, who.kind, who.party ? shirtChar(who.party.name) : null)`.
- The long-press tip (`showTip`) is not changed.

## Legend (T-014)
- `legendRows` rows get `ch: shirtChar(p.name)` and `ink: shirtInk(p.color)`.
- In `openLegend`, the swatch `<span class="swatch" aria-hidden="true">` gets a child inline SVG, created with `document.createElementNS`:
  - `viewBox="0 0 3 5"`, `width="6"`, `height="10"`, `shape-rendering="crispEdges"`, `aria-hidden="true"`, `focusable="false"`;
  - one `<path d=glyphPath(row.ch, 0, 0) fill=row.ink>`.
  This is the same mark as on the map, at 2 CSS px per pixel.
- `.legend-row .swatch` becomes `display: flex; align-items: center; justify-content: center`. Its size (16 × 16) and borders, including the T-012 dark-mode border, stay.

## proposal.md
In "Vzhľad", after the bullet with the 12-colour party palette, add:
„- Každá postavička má na tričku prvé písmeno mena svojej partie, malým pixelovým písmom 3 × 5 (aj deti). Diakritika sa vynechá (Š → S), berie sa prvé písmeno alebo číslica mena, a keď v písme nie je, je tam bodka. Písmeno je tmavé alebo svetlé podľa toho, čo je na farbe partie lepšie vidieť. To isté písmeno je aj vo farebnom štvorčeku partie v „Kto je kto“.“

## Acceptance criteria
- [x] Every figure of a known party in every bed shows the first letter of the party name on its torso, and kids show it too. Unknown-party figures have no letter.
- [x] The letter is crisp (pixel squares, no blur) at 1x and at 4x zoom, in the dark or light colour from `shirtInk`.
- [ ] Rename a party (on another device too, after the poll) and its letters change. A pending figure's letter fades with it. (Left unticked: rename and pending fade not exercised in a browser, see the dev log. The code path is shared with the figure `<g>`, so both should work.)
- [x] The „Kto je kto“ swatches show the same letter in the same colour as the figures. The rows read the same to a screen reader as before.
- [x] Hit areas, figure positions, bed geometry and the bed-hit tests are unchanged. The bed `aria-label` and the hidden summary are unchanged. The letter paths are `aria-hidden`.
- [x] No `innerHTML`, and the party name is never put into markup. The new numbers live in `<script id="logic">`. The app script has no 300, 800 or 2400 literal (T-015 test).
- [x] Node tests cover at least:
  - `shirtChar`:
    - `"Novákovci"` → `N`, `"  ivan a Eva"` → `I`, `"Šimon"` → `S`, `"Ľubo"` → `L`, `"Ďuro"` → `D`, `"Ôsmi"` → `O`;
    - decomposed `"Šimon"` → `S`;
    - `"„Bratia“"` → `B`, `"😀 Novákovci"` → `N`, `"4 kamaráti"` → `4`;
    - `"😀"`, `""`, `"   "`, `"Łukasz"` and `"Ωmega"` → `·`.
  - `PIXEL_FONT`:
    - exactly the 37 keys A–Z, 0–9 and `·`;
    - every glyph has 5 rows of 3 characters from `#` and `.` and at least one pixel;
    - all glyphs are pairwise different.
  - `glyphPath`:
    - `("·", 10, 20)` → `"M11 22h1v1h-1z"`;
    - `"A"` has 10 `M` commands (one per pixel of the table glyph);
    - an unknown key gives the `·` path;
    - all numbers are integers.
  - `relLuminance` / `contrastRatio`: white → 1, black → 0, black on white → 21.
  - `shirtInk`:
    - light for `#2F7D6D, #6D5BA8, #3E6FB0, #9C4A7A, #8A6A4A, #A04848`;
    - dark for `#D07A2B, #C08A1E, #5E8A2E, #2E8AA0, #C0603A, #7A7F2B`;
    - for every palette colour, the chosen colour's contrast is ≥ 3.2;
    - `"red"` and `""` → dark.
  - `shirtOrigin`: the adult and kid glyph boxes (3 × 5) lie inside the torso rects above and do not overlap the head rects (adult `[px+2, py, 6, 5]`, kid `[px+2, py, 6, 4]`).
  - `legendRows`: `ch` and `ink` for a party with a diacritic name.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md`:
  - Section 5: parties „Novákovci“, „Šimon a Ela“ and one named with a leading emoji show N, S and the name's first letter. A name starting with „Ł“ shows a dot. Renaming changes the letters after the poll.
  - Section 6, on a 380 px iPhone and Android phone and on desktop:
    - at 1x the letters are visible as letters when you look closely, and at 2–4x zoom they read clearly;
    - kids' letters are readable, or note for the organizer that they are not;
    - the letter is readable on each of the 12 party colours (create 12 parties on the trial server);
    - in dark mode the scene and the letters keep their colours;
    - the legend swatch letters match the map.
  - Section 8: VoiceOver/TalkBack read the beds and the „Kto je kto“ rows exactly as before, with no extra letter.

## Notes for developer
- **Order:** T-014 is in `done/`, so this task is ready. T-016 (meadow) and T-017 (walk) come after it, because they draw figures with `drawFigure` and must pass the letter. Do not run them in parallel with this one (same files).
- Use `Array.from` or a `u`-flag regex for the first code point, so an emoji's surrogate pair is never split. Keep the NFD + `\p{M}` stripping before the letter search, so names stored decomposed also work. The server already stores NFC.
- `"ß".toUpperCase()` is `"SS"`. Taking the first code point after uppercasing gives `S`, which is fine.
- Do not ellipsize or measure the name for this. Only one font key leaves `shirtChar`.
- Keep `drawFigure`'s existing calls working when `ch` is omitted (no letter).
- No open decision from `proposal.md` is involved. The decisions above are product-owner defaults for the organizer to confirm.

---
## Dev log
**Done (developer, 22. 10. 2026).** All decisions of the task used as written, font table used unchanged (no glyph redrawn).

Files touched:
- `static/index.html`:
  - logic script: `SHIRT_DARK`, `SHIRT_LIGHT`, `PIXEL_FONT`, `shirtChar`, `glyphPath`, `relLuminance`, `contrastRatio`, `shirtInk`, `shirtOrigin`. `legendRows` rows now also have `ch` and `ink`.
  - app script: `drawFigure(g, px, py, color, kind, ch)` draws the letter last as one `<path aria-hidden="true">` through `svgEl` (the existing kid/adult drawing is unchanged, only restructured into if/else so the letter code runs for both). `drawBed` passes `shirtChar(party.name)` or null for an unknown party. New helper `glyphIcon(ch, ink)` (inline SVG 3x5 viewBox, 6x10, crispEdges, aria-hidden, focusable false) is appended to the legend swatch in `openLegend`.
  - CSS: `.legend-row .swatch` is `display: flex` with centred content.
- `tests/js/logic.test.mjs`: tests for `shirtChar`, `PIXEL_FONT`, `glyphPath`, `relLuminance`/`contrastRatio`, `shirtInk`, `shirtOrigin`, and the extended `legendRows` (also a diacritic name). Extra cases beyond the task: decomposed `S\u030C`, `ß`, Cyrillic `Я`, null/undefined names.
- `tests/manualne.md`: new items in sections 5, 6 and 8.
- `proposal.md`: the bullet in "Vzhľad", right after the 12-colour palette bullet.

Tests:
- `node --test tests/js/` -> 133 pass, 0 fail (includes the T-015 no-300/800/2400 test on the app script).
- `uv run pytest -q` -> 380 passed.

Visual check (headless Chrome 155 over CDP, own server on port 8123 with a temp data dir `/tmp/t018/data`, both stopped afterwards): seeded 12 parties, one per palette colour, names „Novákovci“, „Šimon a Ela“, „😀 Dubáci“, „Łukasz“, „Bratia“, „Ľubo a Zuza“, „Kamaráti“, „Ôsmi“, „Peter“, „4 kamaráti“, „Mia a Tom“, „Ružena“, 5 of them with a kid, all 17 figures on the Thursday night. 380 px viewport, screenshots at 1x and 3x device pixel ratio and 4x clips of the rooms (`/tmp/t018/*.png`, not in the repo).
- Letters appear on all 17 figures (17 `aria-hidden` paths), crisp square pixels. The dark/light ink choice is readable on all 12 colours (light on teal, purple, blue, plum, brown, red; dark on orange, ochre, green, cyan, rust, olive). Names starting with emoji, Š, Ľ, Ô and a digit gave D, S, L, O, 4; „Łukasz“ gave the dot.
- At 1x the letters are small marks (as the task predicts), at 3x device pixels and at zoom they read clearly.
- Weak spots to note for the organizer: (1) kids' letters fill the visible shirt completely (5 of 5 rows, touching head and hem) and look cramped, but K, B, R, 4 and L stay readable; N and M (the 3 x 5 glyphs of N and M are close to a lowercase n and to H at this size) are the least distinct. (2) The dot is just 1 pixel, which is as intended.
- „Kto je kto“ (dark mode): the swatch letters match the map in glyph and ink. Swatch 16 x 16, svg 6 x 10 centred (3 px inner margin each side).
- Not tried: renaming across two devices and the pending fade (code path is the same `<g>` as the figure, so it fades together; not looked at in the browser), real phones and VoiceOver (manual list updated).

## Review round 1
(reviewer appends)

**Reviewer, 22. 10. 2026.** Scope checked: `static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md`, `proposal.md`. No server change.

Tests run by the reviewer: `node --test tests/js/` 133 pass, 0 fail. `uv run pytest -q` 380 passed.

Visual check: own server on port 8131 (temp data `/tmp/t018-rev/data`) and headless Chrome 155 over CDP on port 9461, both stopped afterwards. Seeded 12 parties, one per palette colour: „Novákovci“, „Mia a Tom“, „Hanka“ and „Bratia“ with a kid, plus „Šimon a Ela“, „😀 Dubáci“, „Łukasz“, „Ľubo a Zuza“, „Kamaráti“, „Wanda“, „4 kamaráti“, „Ružena“. 16 figures on Thursday. Screenshots at 380 px, 1x and 3x, light and dark, in `/tmp/t018-rev/out/`.
- Map: every known-party figure has its letter (N, M, H, S, D, ·, B, L, K, W, 4, R), and the kids have it too. Pixels are crisp at 3x device px and at 4–6x clip zoom. The ink matches `shirtInk` on all 12 colours. The letter stays inside the torso and the head, eyes, my-party frame and hit areas are untouched.
- Legend, light and dark: each swatch is 16 × 16 with the 6 × 10 glyph centred (5/3 px offset with the 2 px border). Glyph and ink match the map. The dark-mode border `rgba(241, 231, 217, .55)` is kept. Row `textContent` has no extra character.
- **Rename from another client (unverified in the dev log):** renamed „Novákovci“ → „Žofia a spol“ through the API with a separate client id. The page kept N until the poll, and after `visibilitychange` both figures (adult and kid) showed the Z glyph with the new `<title>`. Passes.
- **Pending fade (unverified in the dev log):** held `/api/assign` with CDP `Fetch.requestPaused` and assigned a new party „Ondro“ from the bed sheet. The slot `<g class="pending">` has computed opacity 0.5, and the letter path is inside it, so it fades with the figure. After the request was released the `<g>` went back to opacity 1 with the same letter. Passes. Side note: the 13th party wraps the palette to the same teal as „Novákovci“. Here O vs Z on the same colour is exactly the case the letter is meant to solve, and it does.

Code: the rules in `shirtChar` match the task (NFD, `\p{M}` stripped, first `[\p{L}\p{N}]` with the `u` flag, first code point after uppercasing, `·` fallback). `glyphPath` emits numbers only. No `innerHTML`, and the name never reaches markup through the new code. `drawFigure` without `ch` draws no letter. The paths are `aria-hidden`, and the bed `aria-label`, hidden summary and bed-hit logic are unchanged. The constants live in the logic script, and the T-015 literal test passes.

**Blocker:** none.

**Suggestion:**
1. Glyph legibility, N vs M and the H cluster. **N and M are distinguishable.** They differ in 4 of 15 pixels: N reads like a lowercase „n“ and M like an „H“ with a closed top. The real weak spot is a cluster around **H**: M, W and K each differ from H by **one pixel** (a script over `PIXEL_FONT` found these 1-pixel letter pairs: H–K, H–M, H–W, K–X; digits: 0–8, 0–U, 2–Z). At 3x device px, same colour side by side, H, M and W look almost identical, and K only barely differs. M, H and K are common Slovak initials (Miro, Martin, Hanka, Katka, Kubo). The palette wraps after 12 parties, so two same-coloured parties „Hanka“ and „Miro“ cannot be told apart without zoom. The task lets the developer redraw a glyph, so either the developer or the organizer should consider:
   - K `#.# ##. #.. ##. #.#`: clearly a K at 3x, 4+ pixels from H, X and R;
   - M `#.# ### #.# #.# #.#` and W `#.# #.# #.# ### #.#`: 2 pixels from H instead of 1. Still close, but a better trade-off within 3 × 5.

   If glyphs are redrawn, add a test that letter glyphs differ pairwise by at least 2 pixels. I rendered a side-by-side comparison of the current and the alternative glyphs at 3x in `/tmp/t018-rev/out/glyphs-3x.png`. This is a product call on a PO-provided font, so it does not block.
2. Kids: the letter fills the visible 8 × 5 shirt with no margin. At 3x B, H, S and 4 stay readable, but the kid M reads as H (same cluster as above). For the organizer this is acceptable as „malá značka“. Keep the manual item in section 6, which already asks to note it.

**Nit:**
- `SHIRT_DARK`/`SHIRT_LIGHT` duplicate `COLORS.ink`/`COLORS.paper` and only a comment ties them together. A Node test that parses both from the page source would catch drift. Optional.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2
(reviewer appends)

## Test report
(tester appends)

**Tester, 23. 10. 2026. Verdict: PASS.** No application code changed by the tester. No file in the repo was edited by the tester except this task file. Test server (port 8137, temp data in `/tmp/t018-tester/data`, test secrets in the environment only) and headless Chrome (port 9237) were stopped afterwards. Port 8010 (trial server) was not touched.

Commands and results:
- `node --test tests/js/` → 133 pass, 0 fail.
- `uv run pytest -q` → 380 passed.
- Independent probe (`node` script loading `<script id="logic">` from `static/index.html`): `PIXEL_FONT` equals the 37 glyphs in the task's font table, character for character (0 mismatches). `shirtChar` gives the expected key for all spec cases, plus extra cases (`'quoted' x` → Q, `—Ahoj` → A, `ﬁnal` → F, `İstanbul` → I, leading combining mark, `ÄÖÜ` → A, `Øyvind` → dot, `Ⅻ` → dot). `shirtInk` on the 12 palette colours gives contrast 3.70 to 5.21 (all ≥ 3.2). `shirtOrigin` values match the spec.
- Live page (Chrome, 380 px, DSF 3, group cookie): server seeded with the 12 palette parties (one per colour, names with diacritics, a leading emoji, „Łukasz“, a digit name, 4 kid figures). Result: 15 figures, 15 letter paths, one per figure. For every figure the path equals `glyphPath(shirtChar(name), …)` on the torso origin, the fill equals `shirtInk(torso colour)`, and every pixel lies inside the torso rect. Kids and adults both have the letter. Legend (`Kto je kto`) opened by a real mouse click: 12 rows, each swatch 16 × 16 with a 6 × 10 `aria-hidden` SVG that matches the map glyph and ink; row text unchanged (name, people, stay).
- Rename from a second client (`PUT /api/parties/p-nz0u0l`, „Novákovci“ → „Žofia a spol“), then 36 s wait for the 30 s poll on the open page: the figures show the Z glyph in the same colour, and no Novákovci figure is left.
- Screenshots (`/tmp/t018-tester/shots/`): map at 1x (letters visible, dot for Łukasz), legend at 3x (swatch letters match the map), Bratia adult figure at 4x clip (crisp square pixels, light letter on blue), Z figure at 8x.

Acceptance criteria:

| Criterion | Result | Evidence |
| --- | --- | --- |
| Every known-party figure shows its first letter, kids too; unknown party has none | Pass | 15/15 figures, kids included (live page). Unknown-party branch is `who.party ? … : null` in code; not reachable via the API, so not exercised live |
| Crisp at 1x and 4x, colour from `shirtInk` | Pass | 1x and 4x/8x screenshots; ink check on every figure |
| Rename changes letters after poll; pending figure fades with its letter | Pass (partly by reviewer) | Rename verified live (Z after poll). Pending fade: letter path is a child of the slot `<g>` that gets `pending`; the reviewer measured opacity 0.5 with the letter inside it. Not repeated by the tester |
| Legend swatches show the same letter and colour; rows read as before | Pass | 12/12 rows; row text has no extra characters |
| Hit areas, positions, geometry, aria-labels, hidden summary unchanged | Pass | Diff touches only `drawFigure`, `drawBed` (letter arg), `legendRows`, `openLegend`, `glyphIcon` and one CSS rule; `aria-hidden` on all letter paths |
| No `innerHTML`; name never in markup; numbers in `<script id="logic">`; T-015 literal test | Pass | `innerHTML` count 0 in HEAD and now; no added `innerHTML` in the diff; the T-015 test passes |
| Node tests cover the listed cases | Pass | All listed groups present in `logic.test.mjs` (shirtChar, PIXEL_FONT, glyphPath, relLuminance/contrastRatio, shirtInk, shirtOrigin, legendRows diacritic) |
| `node --test tests/js/` and `uv run pytest -q` pass | Pass | 133 and 380 |
| `tests/manualne.md` items in sections 5, 6, 8 | Pass | Items at lines in §5 (T-018 shirt letter), §6 (phones, zoom, 12 colours, dark mode, swatches), §8 (screen reader) |

Extra scenarios tried: server-side rename with a second client id and poll propagation (above); 4x and 8x zoom crops; legend open by real pointer input; diacritic and emoji names live on the map; 1x and 3x device pixel ratios. Not run by the tester (left to manual checklist or reviewer evidence): dark mode colours, real iPhone and Android rendering, VoiceOver and TalkBack, and the kid letter readability on a real phone.

Failures: none.

Notes for the organizer (not failures):
- Glyph legibility, same as the reviewer's note. The font has 1-pixel pairs: H–K, H–M, H–W, K–X, 0–8, 0–U, 2–Z, 08. Initials H, M, K and W are common in Slovak party names, so two same-coloured parties may be hard to tell apart. The developer may redraw a glyph, but the task says the table is the start point. A glyph redesign would need a test that every pair differs by at least 2 pixels.
- The kid letter fills the visible 8 × 5 shirt with no margin (as the task says).
