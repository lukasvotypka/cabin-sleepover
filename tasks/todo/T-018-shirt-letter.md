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
- [ ] Every figure of a known party in every bed shows the first letter of the party name on its torso, and kids show it too. Unknown-party figures have no letter.
- [ ] The letter is crisp (pixel squares, no blur) at 1x and at 4x zoom, in the dark or light colour from `shirtInk`.
- [ ] Rename a party (on another device too, after the poll) and its letters change. A pending figure's letter fades with it.
- [ ] The „Kto je kto“ swatches show the same letter in the same colour as the figures. The rows read the same to a screen reader as before.
- [ ] Hit areas, figure positions, bed geometry and the bed-hit tests are unchanged. The bed `aria-label` and the hidden summary are unchanged. The letter paths are `aria-hidden`.
- [ ] No `innerHTML`, and the party name is never put into markup. The new numbers live in `<script id="logic">`. The app script has no 300, 800 or 2400 literal (T-015 test).
- [ ] Node tests cover at least:
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
- [ ] `node --test tests/js/` and `uv run pytest -q` pass.
- [ ] `tests/manualne.md`:
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
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
