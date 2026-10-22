# T-012: Autumn palette and pixel-art loading animation

- **Phase:** 1 (organizer request, 22. 10. 2026)
- **Depends on:** T-011
- **Size:** S

## Goal
The app should look like autumn: warmer, russet and ochre tones in the page and scene. While the page loads, show a small pixel-art animation instead of an empty screen ("Vzhľad" in `proposal.md`).

**Decision (22. 10. 2026):** the organizer delegated the palette and the animation choice to the product owner ("nech rozhodne product owner a spusti vyvoj dalej"). The values below were chosen by the product owner on that delegation. No previews and no approval step are needed before implementing. The organizer can still ask for changes after trying it on the trial server; such changes are a follow-up task.

## Scope
- `static/index.html`: CSS variables, scene colours in `COLORS`, page/code-screen background, loading view
- `tests/js/logic.test.mjs`: only if pure logic changes (it should not)
- `tests/manualne.md`: visual check items
- `proposal.md` "Vzhľad" section: replace the colour values with the ones below and note the loading animation (Slovak, like the rest of the proposal)

Out of scope: layout, geometry, hit areas, `config/chata.yaml` (room `floor` colours stay as they are, they are organizer data and already warm), the 12 party colours, furniture shapes. The scene has no trees or roofs, and adding them would change geometry, so the autumn accent in the scene is fallen leaves on the grass (colour only, see below).

## Decided palette

### Page and panels (CSS variables)
Light mode (replaces the current `:root` values):
```
--bg:#EFE5D3; --surface:#FBF6EC; --surface2:#F4EBDB; --ink:#2B1D14; --muted:#6B5644;
--line:#DCC9AE; --forest:#4A2C1A; --moss:#5E6B24; --amber:#96540F; --amber-soft:#F6DFB8;
--warn:#A3361E; --warn-soft:#F6D6C8; --ok:#3F6E2C
```
Dark mode (`prefers-color-scheme: dark`):
```
--bg:#1A1410; --surface:#241C16; --surface2:#2D231B; --ink:#F1E7D9; --muted:#B9A38C;
--line:#47382B; --forest:#F2DBB8; --moss:#B9C46F; --amber:#EDA94E; --amber-soft:#3F2C16;
--warn:#F08C70; --warn-soft:#43241A; --ok:#93C67E
```
Variable names stay the same (`--forest` is now a deep chestnut in light mode, but renaming would only add churn). Checked WCAG contrast: every text role (`--ink`, `--muted`, `--forest`, `--moss`, `--amber`, `--warn`, `--ok`) is at least 4.5:1 on `--surface`, `--surface2` and `--bg` in both modes; `--surface` on `--forest` buttons is above 11:1; `--warn` on `--warn-soft` is above 4.9:1.

Other page colours:
- Panel backdrop `rgba(10, 15, 12, .5)` becomes `rgba(26, 20, 16, .5)`.
- Party swatches (`.party-row .swatch`, `.slot-row .swatch`): keep the `rgba(0, 0, 0, .35)` border in light mode; in dark mode use `rgba(241, 231, 217, .55)` so dark party colours (e.g. `#A04848`, `#6D5BA8`) stay distinct from the dark surface. The party name next to the swatch remains the primary identifier.
- Wooden borders `#5C4033` / `#8A5A34`, the paper button `#F4EBD0` with ink `#2E1F14`, and the focus yellow `#FFD54A` stay unchanged.

### Scene (`COLORS` in `static/index.html`, fixed, not inverted in dark mode)
- `grass`: `#79B35A` → `#8E9B48` (dry autumn meadow)
- `tuft`: `#6AA14C` → `#76823A`
- `path`: `#D8C59A` → `#D6BC8E`
- New keys for fallen leaves: `leafRust: "#B5532A"`, `leafOchre: "#D69A2E"`, `leafRed: "#8E3424"`
- Everything else in `COLORS` (wood, beds, sofas, stove, signs, paper, `selected`, `highlight`, `tight`, `picked`, `red`, `green`, `white`) stays as is.
- The same `#8E9B48` replaces `#79B35A` in `<meta name="theme-color">`, `html` and `body` background, and the code screen `background-color`, so there is no colour flash between boot, code screen and scene.

Fallen leaves are colour only, at the existing tuft positions and sizes (4×4), so no geometry changes:
- Grass pattern tile (`GRASS_TUFTS`): index 1 is `leafRust`, index 4 is `leafOchre`, index 6 is `leafRed`; the rest stay `tuft`.
- Scattered scene tufts (the `for (i = 0; i < 70; i++)` loop): `i % 4 === 1` is `leafRust`, `i % 4 === 3` is `leafOchre`, otherwise `tuft`.

Party colours: the 12-colour palette is unchanged (existing parties keep their stored colours). Figures stand on room floors, which do not change, so their readability on the map is the same as today; the free-slot white square is slightly more visible on the new grass (3.0:1 versus 2.5:1 before).

## Decided loading animation: a falling pixel leaf

- `#boot` stays the same element with `role="status"` and is present in the HTML, so it shows before any JS runs. Its content becomes:
  - an inline SVG, `aria-hidden="true"`, `shape-rendering="crispEdges"`, about 64 × 96 CSS px (e.g. `viewBox="0 0 32 48"`, 1 unit = 2 px), static markup written in `index.html` (no runtime `innerHTML`);
  - a text element `<p id="bootText">Načítavam…</p>`. All JS that today sets `$("boot").textContent` must set `$("bootText").textContent` instead, otherwise the SVG is wiped.
- Look: the boot view background is the scene grass `#8E9B48`; the text sits on a small wooden sign styled like `.zoom-reset` (paper `#F4EBD0`, ink `#2E1F14`, 3px `#5C4033` border, monospace, no Alegreya), so it reads as part of the scene.
- Leaf sprite, 7 × 7 pixels at 2 units each, `O` = `leafOchre` `#D69A2E`, `R` = `leafRust` `#B5532A`, `S` = stem `#5C4033`:
  ```
  ...O...
  ..ORO..
  .ORRRO.
  ORRRRRO
  .ORRRO.
  ..ORO..
  ...S...
  ```
- Ground at the bottom of the SVG: a 2-unit strip of `#76823A` with two resting leaves (3 × 2 pixels each, one rust, one `#8E3424`).
- Motion: CSS keyframes on the leaf group, translate only (no rotation, so pixels stay crisp), with `animation-timing-function: steps(2)` per segment for a pixel-art step look. Keyframes: 0% `translate(0, 0)`; 25% `translate(6px, 14px) scaleX(-1)`; 50% `translate(0, 28px)`; 75% `translate(-6px, 42px) scaleX(-1)`; 100% `translate(0, 56px)` with opacity going to 0 in the last step. Duration 2.4 s, infinite. Use `transform-box: fill-box; transform-origin: center` so the flip happens in place.
- Error path: when loading fails ("Nepodarilo sa načítať, skúšam znova…"), add a class (e.g. `boot--error`) that stops the animation and shows the leaf at rest on the ground; remove it again when the text goes back to „Načítavam…“ (the code-screen submit path).
- `prefers-reduced-motion: reduce`: no animation; the leaf is drawn still at the 50% frame.
- The view disappears when the first `/api/state` arrives (the existing `$("boot").hidden = true` paths). `[hidden]` already forces `display: none`, which also stops the animation.

## Acceptance criteria
- [x] The light and dark CSS variables equal the values in "Decided palette" exactly; the page and all panels use them in both modes.
- [x] The backdrop, dark-mode swatch border and scene `COLORS` changes are applied as listed; nothing else in `COLORS` changes.
- [x] `#8E9B48` replaces `#79B35A` everywhere it is used (meta theme-color, `html`, `body`, code screen, grass); `grep -n 79B35A static/index.html` finds nothing.
- [x] Fallen leaves appear on the grass at the existing tuft positions using the stated index rules; no new shapes, no geometry or hit-area changes, `shape-rendering="crispEdges"` stays.
- [x] Party colours (12-colour palette) are unchanged and remain readable in the party list and bed sheet in light and dark mode.
- [x] The loading view shows the falling pixel leaf and „Načítavam…“ immediately on page load, and is replaced when the first `/api/state` arrives.
- [x] Every JS write to the loading text goes through `#bootText` via `textContent`; no `innerHTML` is introduced.
- [x] If loading fails, the existing error text and retry still run, and the leaf stops at rest on the ground.
- [x] With `prefers-reduced-motion: reduce` the leaf is static.
- [x] `proposal.md` "Vzhľad" lists the new light and dark values, the new grass, tuft, path and leaf colours, mentions the falling-leaf loading view, and notes that the palette was chosen by the product owner on the organizer's delegation (22. 10. 2026).
- [x] `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md` has items: autumn palette in light and dark on iPhone Safari and desktop; loading leaf appears and disappears (throttle the network in dev tools to see it); leaf is still with reduced motion; leaf stops on a failed load.

## Notes for developer
- Do not change the layout, geometry or hit areas; this task is colours and a loading view only.
- Keep all text Slovak through `textContent`; no `innerHTML`.
- The values above are final for this task. Do not tweak them by eye; if something looks clearly wrong, note it in the dev log for the organizer instead.

---
## Dev log
### Round 1 (developer)

Done:
- `static/index.html`: light and dark CSS variables, backdrop `rgba(26, 20, 16, .5)`, dark-mode swatch border (`rgba(241, 231, 217, .55)` on `.party-row .swatch` and `.slot-row .swatch`; the free-slot swatch keeps `var(--muted)`), `#79B35A` -> `#8E9B48` everywhere (meta, html, body, code screen; `grep 79B35A` finds nothing), `COLORS` (grass, tuft, path, new `leafRust`/`leafOchre`/`leafRed`), leaf colours at the tuft positions (`GRASS_TUFTS` indices 1, 4, 6; scene loop `i % 4` 1 and 3). No geometry changes.
- Loading view: `#boot` now holds a static inline SVG (aria-hidden, crispEdges, 64 x 96) and `<p id="bootText">`. Both JS writes to the loading text use `#bootText` via `textContent`; the failed-load path adds `boot--error` and the code-screen submit path removes it. Reduced motion draws the leaf still at the 50% frame; `boot--error` stops it on the ground.
- `proposal.md` "Vzhľad", `tests/manualne.md` (four items in section 6) updated.
- `tests/js/logic.test.mjs`: the T-011 test asserted the old theme-color, now `#8E9B48`; added one page test for the palette, `#bootText` and no `$("boot").textContent`/`innerHTML`.

Tests: `node --test tests/js/` (111 pass), `uv run pytest -q` (379 pass). I also looked at the loading view in headless Chrome (error state, and a paused mid-fall frame): the sign, ground and leaf render as intended.

Interpretation notes / deviations for the reviewer and organizer:
- The SVG uses `viewBox="0 0 64 96"` (1 unit = 1 CSS px, one sprite pixel = 2 units) instead of 32 x 48, so the keyframe `translate(... px)` values are real CSS px. The leaf starts at y=22, so after the 56 px fall its stem touches the ground strip (top at y=92). Ground strip is 4 units (= the "2-unit strip" at 2 px per unit); resting leaves are 6 x 4.
- Not listed in the task but needed for consistency: the 7 tufts in the code-screen background tile changed from `#6AA14C` to the new tuft `#76823A` (otherwise green tufts on olive grass). They have no leaf colours there (the task names leaves only for the scene pattern and scattered tufts).
- `#bootText` has `max-width: 100%` so a long error text wraps on a narrow screen.
- The `<noscript>` message keeps the `.boot` class (warm `--bg`, unchanged layout); only `#boot` got the grass background.
- Nothing looked clearly wrong with the palette. Not verified on a real iPhone or in dark mode on a device; those are in the manual checklist.


## Review round 1
(reviewer appends)

Ran myself: `node --test tests/js/` 111 pass, `uv run pytest -q` 379 pass.

Checked and fine: light/dark CSS variables match the task exactly; backdrop `rgba(26, 20, 16, .5)`; dark-mode swatch border (free swatch keeps `var(--muted)`); `COLORS` changes limited to grass/tuft/path plus the three leaf keys; `79B35A` (and the old `6AA14C`, `D8C59A`) no longer appear; leaf index rules for `GRASS_TUFTS` (1, 4, 6) and the scattered loop (`i % 4` 1 and 3) are correct, positions and sizes unchanged; `#boot` keeps `role="status"`, static SVG is `aria-hidden` and `crispEdges`; leaf sprite rows match the 7 × 7 pattern pixel for pixel and are centred (x 25..39 in a 64-wide box); both JS writes go to `#bootText` via `textContent`, `boot--error` is added on the failed poll and removed on the code-screen submit; reduced motion (both the local rule and the global `animation: none !important`) leaves the leaf at the 50% frame, and the error rule wins on specificity so a failed load under reduced motion shows the leaf on the ground; `proposal.md` "Vzhľad" and `tests/manualne.md` items are present. The `viewBox="0 0 64 96"` deviation and the code-screen tuft colour change are reasonable and documented.

### Blocker

1. **`static/index.html` lines 65 and 70-76 (`@keyframes leafFall` with `steps(2)`): the leaf is invisible half of the time and never visibly lands.** Every segment interpolates `scaleX` between `1` and `-1` (the shorter transform list is padded with an identity `scaleX(1)`), and `steps(2)` shows the half-way value, which is `scaleX(0)`, a zero-width leaf. I verified it in headless Chrome by pausing the animation at the middle of each half-step (delays 0.15 s, 0.45 s, … 2.25 s) and reading `getComputedStyle(...).transform` and the bounding box:
   ```
   0: matrix(1, 0, 0, 1, 0, 0)    w=14
   1: matrix(0, 0, 0, 1, 3, 7)    w=0
   2: matrix(-1, 0, 0, 1, 6, 14)  w=14
   3: matrix(0, 0, 0, 1, 3, 21)   w=0
   4: matrix(1, 0, 0, 1, 0, 28)   w=14
   5: matrix(0, 0, 0, 1, -3, 35)  w=0
   6: matrix(-1, 0, 0, 1, -6, 42) w=14
   7: matrix(0, 0, 0, 1, -3, 49)  w=0, opacity .5
   ```
   Failure scenario: on a slow connection the user sees a leaf that blinks out every 0.3 s, and the falling-leaf look in the goal and in the manual item "a pixel leaf falling in steps onto the grass" does not happen. The task's keyframe text was taken literally, but its intent (flip in place, step look, fade at the end) is not met, so this has to be fixed here.
   Expected fix: no interpolated `scaleX`. For example, list all eight half-step frames explicitly with `animation-timing-function: step-end` (or `steps(1)`), each with an explicit `scaleX(1)` or `scaleX(-1)`: 0% `translate(0,0) scaleX(1)`; 12.5% `translate(3px,7px) scaleX(1)`; 25% `translate(6px,14px) scaleX(-1)`; 37.5% `translate(3px,21px) scaleX(-1)`; 50% `translate(0,28px) scaleX(1)`; 62.5% `translate(-3px,35px) scaleX(1)`; 75% `translate(-6px,42px) scaleX(-1)`; 87.5% `translate(-3px,49px) scaleX(-1)` with a reduced opacity; 100% `translate(0,56px)` with opacity 0. Positions and timing stay the same as the steps(2) intent, but every frame shows the leaf at full width. Putting the flip on a separate nested element with its own `step-end` animation would also work. Check it again in a browser at several paused offsets, not only one.

### Suggestion

- Add a page test that every transform in `@keyframes leafFall` has an explicit `scaleX(...)` (or that no keyframe pair mixes a flipped and an unflipped transform under a non-`step-end` timing), so this regression is caught without a browser.
- With `step-end`, the 100% frame is never displayed, so the lowest visible position is y = 49 (stem bottom at 85, ground top at 92): the leaf fades before it touches the ground. If you want it to visibly land, hold a frame at `translate(0, 56px)` (e.g. at 93.75%) before the fade. Optional; the task only asks for the fade in the last step.

### Nit

- The new test's `<svg[^>]*aria-hidden="true"[^>]*shape-rendering="crispEdges"` would also match any other inline SVG with those attributes; anchoring it inside `<div id="boot"` would make it specific.

Verdict: CHANGES REQUESTED

### Round 2 (developer): answers to review round 1

- **Blocker (zero-width leaf): fixed.** `@keyframes leafFall` in `static/index.html` now lists all frames explicitly, each with its own `translate(...) scaleX(1|-1)` and `opacity`, and the animation uses `step-end` instead of `steps(2)`. The eight fall frames are at 0, 12.5, ..., 87.5 % with exactly the positions and flips from the review (y 0, 7, 14, 21, 28, 35, 42, 49; x 0, 3, 6, 3, 0, -3, -6, -3). Duration (2.4 s) and positions are unchanged. Reduced-motion and `boot--error` rules are untouched.
- **Suggestion, landing frame: done.** After 87.5 % there is a frame on the ground, 91 % `translate(0, 56px)` (opacity 1), then 96 % at opacity .5, and 100 % at opacity 0 (not displayed under `step-end`, the loop restarts). So the leaf lands, fades and restarts.
- **Suggestion, Node test: done.** New test "page: every leafFall keyframe sets its own scaleX and the animation uses step-end (T-012)" checks the `step-end` animation, that every keyframe has `translate(...) scaleX(1|-1)`, and the first eight percentages.
- **Nit, test anchoring: done.** The SVG assertion is now anchored inside `<div id="boot"`.

Verified in headless Chrome (a temp page with the real CSS and boot markup, animation paused at 12 offsets between 0.15 s and 2.39 s): bounding box width is 14 at every offset (never 0), matrices follow the listed frames (e.g. 0.75 s `matrix(-1,0,0,1,6,14)`, 1.35 s `matrix(1,0,0,1,0,28)`, 2.25 s on the ground at y 56), opacity 1 until the fade frames, .5 at 2.35 s.

Tests: `node --test tests/js/` (112 pass), `uv run pytest -q` (379 pass). No new deviations.

## Review round 2
(reviewer appends)

Ran myself: `node --test tests/js/` 112 pass, `uv run pytest -q` 379 pass.

Round-1 blocker (zero-width leaf from interpolated `scaleX` under `steps(2)`): **fixed.** `@keyframes leafFall` now lists every frame with its own `translate(...) scaleX(±1)`, and the animation uses `step-end`, so no frame is ever interpolated. I checked it again in headless Chrome using the real CSS and `#boot` markup taken from `static/index.html`, with the animation paused at 10 offsets:
```
0.15 matrix(1,0,0,1,0,0)    w=14 op=1
0.45 matrix(1,0,0,1,3,7)    w=14 op=1
0.75 matrix(-1,0,0,1,6,14)  w=14 op=1
1.05 matrix(-1,0,0,1,3,21)  w=14 op=1
1.35 matrix(1,0,0,1,0,28)   w=14 op=1
1.65 matrix(1,0,0,1,-3,35)  w=14 op=1
1.95 matrix(-1,0,0,1,-6,42) w=14 op=1
2.15 matrix(-1,0,0,1,-3,49) w=14 op=1
2.25 matrix(1,0,0,1,0,56)   w=14 op=1
2.35 matrix(1,0,0,1,0,56)   w=14 op=0.5
```
The leaf is full width in every frame. It flips in place, lands on the ground strip (stem bottom at y 92) and then fades. The round-1 suggestions (landing frame, keyframe test) and the nit (test anchored inside `#boot`) are also done.

Fresh pass over the changed code: the reduced-motion rule (local `animation: none` plus the global `!important`) still shows the leaf at the 50% frame. `#boot.boot--error .leaf` still wins on specificity, so the leaf lies on the ground on a failed load, with or without reduced motion. Nothing else changed since round 1: the palette, `COLORS`, leaf index rules and `#bootText` writes are all the same, and no `innerHTML` is added.

### Blocker
None.

### Suggestion
None.

### Nit
- The landing frame is held for about 0.12 s (91% to 96%), which is short. It is fine as it is. If the organizer wants the leaf to rest longer, that can be a follow-up tweak.

Verdict: APPROVED

## Test report

Tester run on the working tree (uncommitted, after review round 2). No application code was changed. No test was added. Temporary server on `127.0.0.1:8765` with `/tmp/tester-t012/data`, test secrets only, stopped afterwards. The real `data/` and `.env` were not touched. Ports 8000 and 8010 were not used.

### Commands and results

| Command | Result |
| --- | --- |
| `node --test tests/js/` | 112 tests, 112 pass, 0 fail |
| `uv run pytest -q` | 379 passed |
| `curl /api/health`, `/`, `/api/state` (no cookie), `/data/...`, `/config/...`, `/files/...` | 200, 200, 401, 404, 404, 404 (nothing from `data/`, `config/` or `files/` is served) |
| `grep -n 79B35A static/index.html` | no match |
| `grep -n innerHTML static/index.html` | no match |
| Headless Chrome (CDP) against the live server, light and dark scheme | joined with the group code; scene drawn (38 leaf-coloured and 39 tuft-coloured rects, as the index rules predict); `#boot` hidden after the first state; board background `#FBF6EC` (light) and `#241C16` (dark); `--bg` on body `#8E9B48` |
| Headless Chrome, `/api/state` blocked with CDP | after the failed poll: text „Nepodarilo sa načítať, skúšam znova…“, class `boot boot--error`, leaf at `matrix(1,0,0,1,0,56)` with `animation: none`; the retry ran (repeated refused requests) |
| Headless Chrome, boot-only fixture (scripts removed) | light: leaf and „Načítavam…“ on the grass at first paint; error class: leaf on the ground |
| Computed style, boot fixture: normal / reduced motion / error | normal: `leafFall`, `steps(1)` (step-end), mid-fall frame; reduced motion: `animation: none`, leaf at `translate(0, 28px)`; error (with or without reduced motion): `animation: none`, leaf at `translate(0, 56px)`, opacity 1 |
| WCAG contrast (script in `/tmp/tester-t012/scripts/contrast.py`, not in the repo) | light: worst text role 4.67 (`--moss` on `--bg`); dark: worst 6.35; `--surface` on `--forest` 11.70 (light) and 12.45 (dark); `--warn` on `--warn-soft` 4.95 (light) and 5.77 (dark); free-slot white on the new grass 3.03 (old 2.50). The dev log claims hold |
| Party list („Kto si?“) and a bed sheet („Manželská posteľ“) with 12 parties, light and dark | all 12 rows visible, swatches readable; dark mode swatch border `rgba(241, 231, 217, 0.55)`; light `rgba(0, 0, 0, 0.35)`; bed sheet text and buttons readable in both |
| Diff check | only `static/index.html`, `proposal.md`, `tests/manualne.md`, `tests/js/logic.test.mjs` changed. Nothing in `app/`, `config/` or `data/` |
| Party palette in `app/models.py` | same 12 values, same order, as the proposal |

Note on screenshots: in headless Chrome the `preferredColorScheme` value looked inverted in this build (value 1 gave the light palette, 0 the dark one). I checked the mode by the computed colours, not by the flag name.

### Acceptance criteria

| # | Criterion | Result | How verified |
| --- | --- | --- | --- |
| 1 | Light and dark CSS variables equal the decided values; page and panels use them in both modes | PASS | Compared every value with the task text; computed board and body colours in both schemes |
| 2 | Backdrop, dark swatch border and scene `COLORS` changes applied; nothing else in `COLORS` changed | PASS | Diff: backdrop `rgba(26, 20, 16, .5)`; swatch border in dark mode; only grass, tuft and path changed, three leaf keys added |
| 3 | `#8E9B48` replaces `#79B35A` everywhere (meta, html, body, code screen, grass); grep finds nothing | PASS | grep; `theme-color` and body computed colour |
| 4 | Fallen leaves on the grass at tuft positions with the index rules; no geometry change; `crispEdges` kept | PASS | Diff only changes fills; 38 leaf rects = 3 pattern leaves + 35 scattered (`i % 4` 1 and 3); scene `shape-rendering="crispEdges"` kept |
| 5 | Party colours unchanged; readable in party list and bed sheet, light and dark | PASS | Palette matches proposal; screenshots of both panels in both schemes |
| 6 | Loading view shows the falling leaf and „Načítavam…“ immediately; replaced on first `/api/state` | PASS | Static markup in served HTML and boot-only first paint; `#boot` hidden after state in live run |
| 7 | Every JS write to the loading text uses `#bootText` via `textContent`; no `innerHTML` | PASS | Two `bootText` writes only; no `innerHTML` anywhere in the file |
| 8 | On a failed load the error text and retry still run; the leaf stops on the ground | PASS | Live run with `/api/state` blocked (text, class, transform, retries) |
| 9 | `prefers-reduced-motion: reduce` makes the leaf static | PASS | Computed style with emulated reduced motion (`animation: none`, 50% frame) |
| 10 | `proposal.md` "Vzhľad" lists new light and dark values, new grass, tuft, path and leaf colours, the falling-leaf view, and the product-owner delegation (22. 10. 2026) | PASS | Diff of `proposal.md` |
| 11 | `node --test tests/js/` and `uv run pytest -q` pass | PASS | 112 and 379 pass |
| 12 | `tests/manualne.md` has the four items (palette light and dark on iPhone Safari and desktop; leaf appears and disappears; reduced motion; failed load) | PASS | Diff of `tests/manualne.md` (items present; real devices still need a human) |

### Extra scenarios tried

- Live page without cookie: 401 on `/api/state`, code screen shown, no JS errors except the expected 401 and the favicon 404.
- Rate limit hit while I created parties (30 writes per minute): 429 returned as designed, nothing corrupted.
- Scene with 9 assigned parties and 3 unassigned: party colours and figures on the beds render in both schemes.
- Reduced motion combined with a failed load: the leaf stays on the ground.
- Leaf width in every frame of the `step-end` animation: checked by the reviewer and the developer in headless Chrome at 10 to 12 offsets. I re-checked only the keyframes text and two computed transforms (0.8 s and the error state), so this is not an independent re-measurement of every frame.

### Observations (not failures)

- The code-screen background tile tufts changed from `#6AA14C` to `#76823A` (the developer's note). The task does not list them, but they match the new tuft colour. No leaves are on that tile. Acceptable.
- The headless Chrome window was about 500 px wide, so the 390 px screenshots show the left part of the layout. This is a harness artifact, not a page bug.
- Still for a human (already in `tests/manualne.md`): the look on a real iPhone Safari and Android Chrome, the dark palette on a device, the leaf timing on a real slow network, and the WhatsApp in-app browser.

### Failures

None. All 12 criteria pass, and no regressions in `tasks/done/` (the full pytest and Node suites pass).

### Decision

PASS. Moved to `tasks/done/`. The task is ready for the orchestrator's commit (`T-012: Autumn palette and pixel-art loading animation`). Two untracked files appeared in `tasks/todo/` during the run (`T-013`, `T-014`). I did not touch them.
