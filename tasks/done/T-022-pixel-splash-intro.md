# T-022: Full-screen pixel splash that falls apart into the map

- **Phase:** 1 (organizer request, 23. 10. 2026, after trying T-015 on the trial server)
- **Depends on:** T-012, T-015 (the loading view and the intro timing it replaces). Build order only: every task that touches `static/index.html`, `tests/js/logic.test.mjs`, `tests/manualne.md` and `proposal.md` is in `done/`. Do not run in parallel with T-009 if that is ever unblocked (same files).
- **Size:** M

## Goal
Organizer, verbatim: „Intro splash screen sprav velky obrazok cez cely screen s vela pixelmi ktore sa tak ako listy padaju tiez vypixeluju nadol von z obrazovky a zobrazi sa obsah.“

Replace the small falling leaf of T-012/T-015 ("Vzhľad": „Pri načítavaní stránka ukáže pixelový lístok…“) with a large pixel-art picture that covers the whole screen. It is made of many square blocks. When the intro ends, the blocks fall downwards in steps, like the leaf did, and leave the screen. The map, already drawn underneath, shows through as they go. The T-015 rules stay: a minimum time from page start, no delay of the first request, the code screen and the error state shown at once, and a short still version with `prefers-reduced-motion`.

## Scope
- `static/index.html`
  - Markup: inside `#boot`, replace the leaf `<svg>` with one `<canvas id="bootCanvas" aria-hidden="true">`. Keep `#boot` (`class="boot" role="status"`) and `<p id="bootText">Načítavam…</p>`.
  - CSS: the `#boot` rules. Remove the `.leaf` rules and `@keyframes leafFall`. Replace `.boot--fade` with a falling class (see Behaviour). Add a step-timed drop of the sign, and reduced-motion overrides.
  - `<script id="logic">`: the intro constants and the pure splash functions below. They are pure (no DOM, no `window`, no `Math.random`, no `Date`).
  - `<script id="app">`: draw the splash on the canvas, run the fall, and adapt `revealWhenReady()`, `hideBoot()`, `showCodeScreen()`, the join submit handler and the error path in `poll()`.
- `tests/js/logic.test.mjs`: tests of the new pure functions. Update the T-012/T-015 page tests that refer to the leaf, `leafFall`, `BOOT_FADE_MS` and `.boot--fade`.
- `tests/manualne.md`: section 6, replace the loading items (see Acceptance criteria).
- `proposal.md`: "Vzhľad", replace the loading bullet (see below).

Out of scope: the server, polling interval, the code screen look, the scene drawing, the walk (T-017), `config/chata.yaml`, any new Slovak UI text. The only texts on the loading view are the existing „Načítavam…“ and „Nepodarilo sa načítať, skúšam znova…“.

## Design decisions (analyst defaults, for the organizer to change after trying it)
The organizer asked for these to be settled in the task. They are not open decisions from `proposal.md`.

1. **What the picture shows:** an original front view of the cabin on an autumn day. It has blue sky with a few white clouds, a log cabin in the middle (wooden walls, dark roof edge, a chimney, two lit windows and a door), a sandy path from the door down the grass, autumn trees on both sides when there is room (trunk plus a rust, ochre and dark red crown), and grass with tufts and fallen leaves. **There is no text in the picture.** The event name is not known before `/api/state` and is not known at all on the code screen. Text in a picture would also be new Slovak text. Nothing from Pokémon or any other game.
2. **Colors:** only existing keys of `COLORS` in the app script, which are the fixed scene colors: sky `window`, clouds `white`, walls `wood`/`woodLight`/`plank`, edges and roof `woodDark`/`leafRed`/`redEdge`, chimney `stoveDark`/`stovePipe`, lit windows `selected`, path `path`, grass `grass`/`tuft`, leaves and crowns `leafRust`/`leafOchre`/`leafRed`. No new colors and no CSS variables, so dark mode looks the same as light mode.
3. **How it is drawn:** one `<canvas>`, one solid color per block (`fillRect`). The picture *is* the block grid, so a block never has to be cut out of a bigger image. No SVG with hundreds of rects, no DOM element per block.
4. **Block size:** the organizer suggested blocks of about 8–12 px and "a few hundred to ~1500 blocks" on a phone. Those two do not fit together: a 380×844 phone at 12 px has about 2200 blocks. Default: cap the count, not the size. `size = clamp(ceil(sqrt(vw·vh / SPLASH_MAX_BLOCKS)), SPLASH_MIN_BLOCK, SPLASH_MAX_BLOCK)` with `SPLASH_MAX_BLOCKS = 1500`, `SPLASH_MIN_BLOCK = 10`, `SPLASH_MAX_BLOCK = 40` (CSS px). That gives 15 px and 26×57 = 1482 blocks on 380×844, 13 px and 28×50 = 1400 blocks on 360×640, and 38 px and 51×29 = 1479 blocks on 1920×1080. Above about 2.4 Mpx (4K) the 40 px cap lets the count grow, which is fine on a desktop.
5. **Hold, then fall:** the picture stands still with the sign for `BOOT_MIN_MS = 1500` ms from page start. Then it falls for `BOOT_FALL_MS = 1500` ms, so a fast load shows the map whole after about 3 s (T-015 took about 2.7 s). With reduced motion it stays still for `BOOT_MIN_REDUCED_MS = 800` ms and is hidden at once, with no fall.
6. **The fall:** the bottom rows go first, with a deterministic per-block jitter so the edge is ragged like falling leaves rather than a straight wipe. Each block drops in steps of `SPLASH_STEP_MS = 80` ms (step timing like the leaf, about 12 steps per second). It sways a little sideways like the leaf (translate only, no rotation, no scale) and accelerates downwards. It is fully below the screen `SPLASH_BLOCK_FALL_MS = 600` ms after its own delay. The delays lie in `[0, BOOT_FALL_MS − SPLASH_BLOCK_FALL_MS]`, so every block is gone by `BOOT_FALL_MS`.
7. **The sign** (`#bootText`, fixed cream and dark brown as now) sits centered on the grass, in the lower part of the screen, below the cabin. When the fall starts it drops out of the screen with a CSS step animation (`steps()`, translate only) lasting `SPLASH_BLOCK_FALL_MS`, together with the bottom rows. It is not drawn on the canvas, so it stays real text for screen readers.
8. **During the hold the picture is still.** There is no loop animation while waiting, and a slow server just keeps the still picture with „Načítavam…“. (The old leaf looped. If the organizer wants motion while waiting, that is a follow-up.)
9. **„Kto si?“** opens when the fall has ended (after `BOOT_FALL_MS`), not at its start, so the panel does not cover the reveal. With reduced motion it opens right after the splash is hidden.

## Pure functions (in `<script id="logic">`)
```js
var BOOT_MIN_MS = 1500;           // still splash before the fall may start, from page start
var BOOT_MIN_REDUCED_MS = 800;    // still splash with prefers-reduced-motion, then hidden at once
var BOOT_FALL_MS = 1500;          // whole fall: the last block is below the screen by then
var SPLASH_STEP_MS = 80;          // one held step of the fall (like the leaf's step-end frames)
var SPLASH_BLOCK_FALL_MS = 600;   // one block, from its place to below the screen; also the CSS sign drop
var SPLASH_MAX_BLOCKS = 1500, SPLASH_MIN_BLOCK = 10, SPLASH_MAX_BLOCK = 40;

function bootMinMs(reducedMotion)                 // unchanged contract: BOOT_MIN_REDUCED_MS or BOOT_MIN_MS
function bootRemaining(startMs, nowMs, minMs)     // unchanged from T-015
function bootFallMs(reducedMotion)                // 0 with reduced motion, else BOOT_FALL_MS

// Block grid that covers a vw×vh viewport (CSS px): {size, cols, rows}, cols·size ≥ vw, rows·size ≥ vh.
// Non-finite or non-positive sizes give {size: SPLASH_MIN_BLOCK, cols: 0, rows: 0}.
function splashGrid(vw, vh)

// The picture as rows × cols COLORS keys (array of `rows` arrays of `cols` strings). Deterministic,
// built from a fixed hand-drawn cabin sprite (a string map in the logic script) centered on the
// horizon, plus sky, clouds, trees (only when they fit), path, grass, tufts and leaves.
function splashPicture(cols, rows)

// Fall delay of one block in ms: bottom rows earlier, a deterministic jitter from (col, row),
// a multiple of SPLASH_STEP_MS, within [0, BOOT_FALL_MS − SPLASH_BLOCK_FALL_MS].
function splashDelay(col, row, cols, rows)

// Offset of a block at elapsedMs since the fall started: {dx, dy} in whole CSS px. {0, 0} before
// its delay; held constant within each SPLASH_STEP_MS step; dy never decreases and reaches at least
// fallPx once elapsedMs ≥ delayMs + SPLASH_BLOCK_FALL_MS; |dx| ≤ size / 2 (sideways sway).
function splashFall(elapsedMs, delayMs, fallPx, size)
```
The names are a suggestion. The behaviour and the tests below are what count. `fallPx` is the viewport height plus one block, so a top-row block leaves the screen as well.

## Behaviour
1. **Page start:** `#boot` is visible from the HTML with its fixed grass background (`#8E9B48`, as now), so there is no flash before the script runs. The app script draws the splash on the canvas. It sizes the canvas from `#boot`'s size times `devicePixelRatio`, and it rounds every block edge to whole device pixels (`x0 = round(c·size·dpr)`, `x1 = round((c+1)·size·dpr)`), so there are no hairline seams at fractional ratios (Android 2.625). The first `/api/state` request still leaves at page start. Drawing must not come before it or delay it.
2. **Resize or rotation during the hold:** recompute the grid and redraw (debounced or on the next frame). Ignore resizes during the fall.
3. **Reveal (first state, after the minimum, as T-015):** `render()` draws the scene first (it needs to be visible to measure text), then the fall starts. `#boot` gets the falling class: transparent background and `pointer-events: none`, so the map shows through where blocks have gone and taps reach it. One `requestAnimationFrame` loop clears the canvas and draws every block at `splashFall(...)`. It redraws only when the step index changes, with no layout reads inside the loop. Time comes from `performance.now()` minus the fall start, not from a frame count, so a throttled or paused tab ends in the right place.
4. **End of the fall:** a `setTimeout(BOOT_FALL_MS)` (independent of rAF, which stops in background tabs) stops the loop, sets `#boot.hidden = true`, removes the falling and error classes, and frees the canvas (`width = height = 0`). Then „Kto si?“ opens if asked (decision 9).
5. **Slow server:** the still picture waits. When the state arrives after the minimum, the fall starts at once. The fall itself (1.5 s) is not an extra wait for the user, because the map is drawn and tappable from its first step.
6. **Polls and writes:** as T-015. During the hold they only store the state. From the fall start (`app.introDone = true`) everything renders normally under the falling blocks, and `#boot` never shows again.
7. **Error path:** when the first load fails, the sign shows „Nepodarilo sa načítať, skúšam znova…“ at once, as now (`boot--error`). The picture stays still and complete, and the text stays readable on the sign at 380 px (it wraps inside the sign, nothing cut off). A later successful retry starts the fall at once. The sign drops with whatever text it shows, so nothing jumps back (this fixes the T-015 review nit).
8. **Code screen:** `showCodeScreen()` hides `#boot` at once (as now), clears the intro timer, and also stops a running fall (cancels the rAF and the end timer). After a successful join with `!app.introDone`, the splash is shown and drawn again, the intro clock restarts (`app.introStart = performance.now()`), and the hold and the fall play once. When the intro already happened, there is no splash and no wait, as now.
9. **Reduced motion** (`prefersReducedMotion()`, as now): the still picture shows for 0.8 s (or until the state arrives), then `#boot` is hidden at once. No rAF loop, no sign animation (CSS `@media (prefers-reduced-motion: reduce)` turns the sign drop off as well).

## proposal.md
In "Vzhľad", replace the whole bullet „Pri načítavaní stránka ukáže pixelový lístok…“ (with the T-015 sentence) by:
„Pri načítavaní stránka ukáže cez celú obrazovku veľký pixelový obrázok chaty v jesennej krajine (obloha, stromy, tráva, popadané lístie; iba farby scény, bez textu v obrázku) a text „Načítavam…“ na malej drevenej ceduľke. Obrázok stojí aspoň 1,5 s od otvorenia stránky. Potom sa rozpadne na pixely, ktoré ako lístie po krokoch padajú nadol von z obrazovky (spodné rady prvé), a pod nimi sa ukáže mapa; pád trvá asi 1,5 s. S `prefers-reduced-motion` obrázok stojí 0,8 s a potom zmizne bez pádu. Ak sa dáta načítavajú dlhšie, obrázok počká a padá hneď, ako prídu. Pri chybe načítania obrázok stojí a na ceduľke je „Nepodarilo sa načítať, skúšam znova…“. Obrazovka s kódom a chyba načítania sa ukážu hneď, bez čakania. Farby obrázka sú pevné, v tmavom režime sa nemenia.“

## Acceptance criteria
- [x] On a 380 px phone viewport (e.g. 380×844) and on a desktop window (e.g. 1440×900 and 1920×1080), the splash covers the whole viewport edge to edge, with no gaps or seams between blocks. It shows the cabin centered with sky, grass, path and leaves; trees appear on both sides on desktop. Blocks are square and crisp (no smoothing).
- [x] On a fast connection the still splash with „Načítavam…“ stays about 1.5 s from page start, then the blocks fall in visible steps, bottom rows first with a ragged edge, sideways sway and translate only, and leave the screen downwards. The map is visible underneath as they go and is fully shown about 3 s after page start. `/api/state` is not delayed (Network tab).
- [x] Taps during the fall reach the map (`pointer-events: none`). After the fall `#boot` is `hidden` and the canvas is freed.
- [x] With a server slower than the minimum, the still splash waits and the fall starts as soon as the state arrives.
- [x] With `prefers-reduced-motion: reduce` the still splash shows about 0.8 s and disappears at once: no fall, no sign drop, no rAF loop.
- [x] A failed first load shows „Nepodarilo sa načítať, skúšam znova…“ on the sign at once, readable at 380 px over the still picture. A later successful retry starts the fall without an extra wait.
- [x] Without a cookie the code screen appears at once (no splash under or before it). After the code, the splash plays once (hold and fall), and „Kto si?“ opens after the fall has ended. A 401 during the fall shows the code screen at once and stops the fall.
- [x] Polling, tab return and writes after the fall started never show the splash again. Switching tabs during the fall and coming back shows the map with no leftover blocks.
- [x] In dark mode the splash and the sign look exactly as in light mode: the `#boot`, `#bootText` and `#bootCanvas` CSS rules use no `var(--…)`, and the picture uses only `COLORS` keys.
- [x] The leaf `<svg>`, the `.leaf` rules and `@keyframes leafFall` are gone. `#boot` keeps `role="status"`, and the canvas has `aria-hidden="true"`.
- [x] No `innerHTML` added. No new Slovak text except the `proposal.md` bullet. No external images or fonts, no build step, no framework.
- [x] The intro constants are named in `<script id="logic">`, and `<script id="app">` uses no literals for them.
- [x] Node tests cover at least:
  - `splashGrid(380, 844)` → `{size: 15, cols: 26, rows: 57}`; `splashGrid(360, 640)` → `{13, 28, 50}`; `splashGrid(1920, 1080)` → `{38, 51, 29}`. For 360×640, 380×844, 390×844, 768×1024, 1440×900 and 1920×1080, the grid covers the viewport, `size` is within [10, 40], and the block count is between 300 and 1600. A tiny viewport (100×100) gives size 10, a 3840×2160 one gives size 40, and `NaN`, `0` and negative sizes give `cols = rows = 0`.
  - `splashPicture(cols, rows)` for 26×57, 28×50, 51×29 and 1×1 returns exactly `rows` arrays of `cols` keys and is deterministic (two calls are deep-equal). Every key is in an allowed list, and every allowed key appears as a key of the `COLORS` literal in the app script (read from the HTML). On 26×57 and 51×29 the door and window colors are present near the horizontal center. 51×29 contains the tree crown colors on both halves. `0×0` returns `[]` without throwing.
  - `splashDelay`: every value over a 26×57 and a 51×29 grid is a multiple of `SPLASH_STEP_MS` within `[0, BOOT_FALL_MS − SPLASH_BLOCK_FALL_MS]` and deterministic. The bottom row's mean delay is lower than the top row's. A row does not have all equal delays (jitter).
  - `splashFall`: `{0, 0}` before the delay; constant within one step; `dy` non-decreasing over time; `dy ≥ fallPx` at `delay + SPLASH_BLOCK_FALL_MS`; `|dx| ≤ size / 2`; whole numbers.
  - For the sample grids, `max(splashDelay) + SPLASH_BLOCK_FALL_MS ≤ BOOT_FALL_MS`; `bootFallMs(true) === 0`, `bootFallMs(false) === BOOT_FALL_MS`.
  - `bootMinMs(false) === 1500`, `bootMinMs(true) === 800`. The T-015 `bootRemaining` tests are kept, with the 2400 examples rewritten or kept as plain arguments (the function is unchanged).
  - CSS and JS stay equal: the sign drop animation in the `#bootText` falling rule uses `steps(` and a duration equal to `SPLASH_BLOCK_FALL_MS` (read from the HTML). The falling class sets `pointer-events: none`. The reduced-motion media block turns the sign animation off.
  - The T-012/T-015 page tests are updated: the leaf/`leafFall` assertions are replaced by checks for `<canvas id="bootCanvas" aria-hidden="true"`, the absence of `leafFall`, `bootText` still being set by `textContent`, and no `innerHTML`. The magic-number check is narrowed to the intro code (e.g. the bodies of `revealWhenReady`, `hideBoot` and the fall function), as the T-015 reviewer suggested, so unrelated `300`/`800` elsewhere do not break it.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.
- [x] `tests/manualne.md` section 6: the three T-012 "Loading leaf" items and the four T-015 "Loading intro" items are replaced by these items (T-022). The T-012 palette item stays.
  - **Splash intro (T-022):** on iPhone Safari (portrait and landscape), Android Chrome and a desktop window, reload: a full-screen pixel picture of the cabin with „Načítavam…“ stands about 1.5 s, then it falls apart in steps from the bottom up, the pixels leave the screen downwards like leaves, and the map appears underneath (about 3 s in total). No seams or gaps between blocks, no stutter, the picture fills the screen behind the notch and the toolbar.
  - **Splash, slow and failed load (T-022):** with network throttling (slow 3G) the still picture waits and falls as soon as the data are loaded. Stop the server and reload: „Nepodarilo sa načítať, skúšam znova…“ appears at once and is readable on a 380 px phone. Start the server: the picture falls and the map appears.
  - **Splash, reduced motion and dark mode (T-022):** with „Reduce motion“ on, the still picture shows under a second and disappears without falling. In dark mode the picture and the sign have the same colors as in light mode.
  - **Splash and the code screen (T-022):** in a private window the code screen appears at once. After the code the splash plays once, and „Kto si?“ opens after the pixels are gone. Tapping the map during the fall works. Switching tabs during the fall and back, or waiting for a poll, never shows the splash again.

## Notes for developer
- Baseline: T-015 (`tasks/done/T-015-loading-intro-minimum-time.md`) and the current code: CSS at the top of `static/index.html` (`#boot`, `.boot--fade`, `.leaf`, `leafFall`), markup right after `<body>`, logic constants near the end of `<script id="logic">` (`BOOT_MIN_MS` …), and in the app `poll()` error branch, `applyState()`, `revealWhenReady()`, `hideBoot()`, `showCodeScreen()` and the `codeForm` submit handler. These are the only places that touch `#boot`.
- `COLORS` lives in the app script, so the pure `splashPicture` returns **keys** and the app maps them to colors. Keep the keys a plain allowed list in the logic script so the test can check them against `COLORS`.
- Draw the cabin sprite yourself as a small string map (about 16–20 × 12–16 blocks, one character per color key). Keep it centered. When the grid is narrower than the sprite (very small viewports) clip it and do not throw. Place the horizon so the cabin fits on both a tall phone (26×57) and a wide desktop (51×29), for example with its base a little below the vertical middle. Clouds, tufts and leaves come from a small deterministic hash of (col, row), never `Math.random`, so the tests are stable and every reload looks the same.
- Performance: about 1500 `fillRect` calls per redraw, about 12 redraws per second for 1.5 s. Do not read `clientWidth` or any other layout inside the loop. Read the size once when the fall starts. Do not create DOM nodes per block.
- iOS Safari: `#boot` is `position: fixed; inset: 0`, so size the canvas from `#boot` after it is visible, not from `window.innerHeight` alone (toolbar). A grid slightly larger than the viewport is fine, because the canvas is clipped by `#boot`.
- The scene and its `z-index` stay as in T-015: `#boot` 15 sits above the scene and move bar (10) and below panels (20). Since „Kto si?“ now opens after the fall, it never sits over falling blocks.
- Keep `bootRemaining()` and `bootMinMs()` as they are. Only the values change. `BOOT_FADE_MS` and `.boot--fade` go away, so update every reference and test.
- No open decision from `proposal.md` is involved. The picture content, block-size rule, 1500/1500/800 ms, 80 ms steps, bottom-first order and the „Kto si?“ timing are analyst defaults (see Design decisions) for the organizer to confirm on the trial server.

---
## Dev log

**What was done (T-022)**
- `static/index.html`
  - Markup: the leaf `<svg>` in `#boot` is replaced by `<canvas id="bootCanvas" aria-hidden="true">`. `#boot` keeps `role="status"` and `#bootText`.
  - CSS: removed `.leaf`, `@keyframes leafFall`, `.boot--fade`. Added `#bootCanvas`, `#boot.boot--falling` (transparent background, `pointer-events: none`), the sign drop `bootSignDrop 600ms steps(8, end)` and its reduced-motion override. The sign sits in the lower part of the screen (`justify-content: flex-end; padding-bottom: 14vh`) and wraps (`overflow-wrap: anywhere`). No `var(--...)` in the boot rules.
  - Logic script: constants `BOOT_MIN_MS 1500`, `BOOT_FALL_MS 1500`, `SPLASH_*`, and the pure `bootMinMs`, `bootFallMs`, `bootRemaining` (unchanged), `splashGrid`, `splashPicture` (hand-drawn 18x14 cabin string map, crowns, path, hills, clouds, hash-based tufts and leaves), `splashDelay`, `splashFall`, `splashHash`, `SPLASH_COLOR_KEYS`.
  - App script: `drawSplash`, `paintSplash`, `startFall`, `fallFrame` (rAF, time from `performance.now()`, redraw only when the 80 ms step changes), `hideBoot` (cancels rAF and timers, removes classes, frees the canvas), `showBoot`, debounced resize redraw during the hold. `revealWhenReady` starts the fall after `render()`. `openWhoIfAsked` waits while `splash.falling`; the end-of-fall timer (`BOOT_FALL_MS`, not rAF) hides the splash and then asks. `showCodeScreen` calls `hideBoot()`; the join handler restarts the intro clock and calls `showBoot()` only if `!app.introDone`. `poll()` is called before `drawSplash()` at the end of the script, so the first request is not delayed.
- `tests/js/logic.test.mjs`: new tests for all the pure functions and the CSS/JS equalities; T-012/T-015 leaf tests replaced; the magic-number check is narrowed to the intro code. The "logic block does not touch the browser" test now ignores the quoted COLORS key `"window"` (the sky color), which is a string, not the global.
- `tests/manualne.md` section 6 and `proposal.md` "Vzhľad" updated as the task says.

**Tests**
- `node --test tests/js/` : 172 pass, 0 fail.
- `uv run pytest -q` : 383 passed.

**Headless browser check** (Chrome via Playwright, own server on port 8123, temp data dir, stopped afterwards)
- 380x844 (dpr 2.625 and 2), 1920x1080, 1440x900 and 844x390: splash covers the screen with no seams; cabin centered, trees on both sides on the wide screens only. Screenshots looked right.
- Fast load: fall class at about 1.52 s, `#boot` hidden at about 3.02 s, canvas freed (width 0), `pointer-events: none` during the fall. No console errors (only a favicon 404).
- Reduced motion: hidden at about 0.81 s, the fall class never set.
- `/api/state` delayed 3 s: still picture waited, the fall began at about 3.15 s.
- Failed first load: the error text shows at once on the sign, wraps inside it at 380 px; after the route was fixed the fall started and the splash hid.
- No cookie: code screen at once, `#boot` hidden; after the code the splash showed again and fell once; „Kto si?“ sheet was open after the fall ended.

**Not verified / notes**
- Tab switching during the fall and real iOS/Android devices are not tested (manual list items added). The code path is: rAF stops in a hidden tab, the `BOOT_FALL_MS` timer still ends the fall, and the loop uses the clock.
- The fall's sign drop is linear in steps (CSS `steps(8)`), while the blocks accelerate. The sign does not sway. Acceptable per the task, easy to change.
- The sway uses per-step phase from the block's delay, so neighbours sway out of phase.
- Out of scope but seen: `/favicon.ico` returns 404 (console error only).


## Review round 1
(reviewer appends)

Reviewed the T-022 scope only: `static/index.html` (boot CSS, markup, logic constants and splash functions, app intro code, `poll()`, `applyState()`, `showCodeScreen()`, join handler, start), `tests/js/logic.test.mjs`, `tests/manualne.md` section 6 and the `proposal.md` "Vzhľad" bullet. The `tasks/QUESTIONS.md` change and `tasks/todo/T-023-*` belong to T-023 and were not reviewed.

**Tests run by the reviewer**
- `node --test tests/js/`: 172 pass, 0 fail.
- `uv run pytest -q`: 383 passed.

**Headless Chrome (system Chrome via Playwright, own server on 127.0.0.1:8131, temp data dir, stopped afterwards)**
- 380x844 at dpr 2.625: still picture with no seams, cabin centered, path, leaves, sign on the grass. The fall class was set at 1515 ms and `#boot` hidden at 3016 ms, with the canvas freed (0x0). There were no rAF calls after the end. A mid-fall screenshot shows ragged blocks falling over the drawn map.
- 1920x1080 in dark mode: identical fixed colors, trees on both sides, no seams.
- Reduced motion: hidden at 829 ms, the falling class was never set, no rAF loop and 1 still paint only.
- Failed first load at 380 px: „Nepodarilo sa načítať, skúšam znova…“ shows at once and wraps inside the sign (16 to 364 px, no overflow). After the route was restored the retry started the fall and the sign dropped with the error text. Hidden at the end.
- No cookie: the code screen shows at once with `#boot` hidden. After the code the hold and fall played once (falling at +1.5 s, hidden at +3.0 s), and „Kto si?“ opened only after the fall ended.
- 401 during the fall: the code screen shows at once, the fall stops (class removed, canvas 0, no more rAF). After the join there is no splash, and „Kto si?“ opens at once.
- **Unticked criterion, verified:**
  - Polls (`visibilitychange`) and a server-side write followed by polls, both after the fall: `#boot` stays hidden.
  - A poll during the fall renders under the blocks, and the fall still ends on time.
  - The page frozen (CDP `Page.setWebLifecycleState`, like an iOS background tab) for 3 s mid-fall: on resume `#boot` is already hidden, the canvas is 0 and the screenshot shows no leftover blocks.
  - rAF held back from mid-fall until after the end timer (a hidden but not frozen tab): the end timer hid the splash, and flushing rAF afterwards painted nothing.
  - Frozen for 4 s during the hold: hidden on resume, no leftovers.
  - Code reading agrees with these results. The only place that un-hides `#boot` is `showBoot()`, which is called only from the join handler under `!app.introDone`. The error branch in `poll()` needs `!app.state`, and `app.state` is never cleared. After `BOOT_FALL_MS`, `splashFall` gives `dy ≥ fallPx` for every block (max delay 900 + 560 < 1500), so a late rAF paints an empty canvas even if it fires before the end timer.

**Blocker**
- None.

**Suggestion**
- `static/index.html` `hideBoot()`: it frees the canvas but keeps `splash.colors`, `splash.delays`, `splash.xs` and `splash.ys` (about 1500 entries each). Clearing them would match "the canvas is freed" in spirit. This is tiny, so it is not required.
- `#boot.boot--error` has no CSS rule any more, and the class stays on during a retry fall. That is harmless. The class could be dropped, or kept on purpose as a hook (tests reference it). Either is fine.

**Nit**
- The comment above `resetSplash()` mentions `splash.pic`, which does not exist. The `splash` object literal also does not list the fields that `drawSplash()` adds (`dpr`, `size`, `cols`, `rows`, `height`, `xs`, `ys`, `colors`, `delays`).
- The sign drop uses `steps(8)` over 600 ms (75 ms per step) while the blocks step every 80 ms. The difference is not visible. It matches the criterion (`steps(` plus the duration equal to `SPLASH_BLOCK_FALL_MS`).

Verdict: APPROVED. Round 2 skipped, no blockers.

## Review round 2
(reviewer appends)

## Test report

**Tester: Haiku 5.5, 23. 10. 2026. Verdict: PASS → done/.** Checked against the working tree (uncommitted T-022 changes). `tasks/QUESTIONS.md` and `tasks/todo/T-023-*` were ignored.

**Automated suites**
- `node --test tests/js/` → 172 tests, 172 pass, 0 fail.
- `uv run pytest -q` → 383 passed.

**Browser checks (independent)**
- Server: `GROUP_CODE`/`ADMIN_CODE`/`SECRET_KEY` set to test values, `create_app(data_dir='/tmp/t022/data')` on `127.0.0.1:8142` (temp data, stopped afterwards). `/api/health` ok, `/api/state` 401 without cookie.
- Chrome 155 (the installed Google Chrome) driven from Node over CDP. Scripts live in `/tmp/t022/` (`cdp.mjs`, `run.mjs`, `fail2.mjs`), outside the repo. Screenshots in `/tmp/t022/shots/`. Network interception used to delay, fail or 401 `/api/state`. Page-side timeline from `performance.now()` on `#boot` changes.
- Timeline, 380×844 at dpr 2.625: still from 36 ms, `boot--falling` at 1514 ms, `hidden` at 3027 ms, canvas freed (0×0). 20 distinct canvas frames across the fall (80 ms steps).
- Canvas coverage: 0 non-opaque pixels at 380×844 (dpr 2.625), 1440×900, 1920×1080, 360×640 (dpr 3) and 844×390 (dpr 3). Resize during the hold redraws to the new size, still fully covered.

**Acceptance criteria**

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Full-viewport splash, no seams, cabin centered, trees on desktop, crisp | pass | Coverage 0 transparent px on 4 sizes; `shots/fast-380-still.png`, `desk-1440-still.png` (trees both sides); 1920 still ok |
| 2 | Fast load: still ~1.5 s, falls in steps bottom-first, map visible, done ~3 s, `/api/state` not delayed | pass | Fall at 1514 ms, hidden at 3027 ms; first `api/state` request paused 34 ms after navigate; `shots/desk-1440-midfall.png` shows bottom gone first |
| 3 | Taps reach the map during fall; `#boot` hidden and canvas freed after | pass | During fall `pointer-events: none`, `elementFromPoint` under the tap is the scene (not in `#boot`); after fall hidden, canvas 0×0 |
| 4 | Slow server: still waits, fall starts when state arrives | pass | 3 s held request: fall at 3072 ms, hidden at 4574 ms |
| 5 | Reduced motion: ~0.8 s, no fall, no sign drop, no rAF loop | pass | Hidden at 845 ms, class never set, rAF count 0 |
| 6 | Failed first load: error text at once, readable at 380 px; retry starts fall without extra wait | pass | Error at 36 ms, text rect 16–364 px of 380; two failures, then retry at ~8.2 s starts fall, hidden at 9713 ms |
| 7 | No cookie: code screen at once; splash once after code; „Kto si?“ after fall; 401 during fall stops it | pass | Code screen at 500 ms, `#boot` hidden; after join splash at 570 ms, fall at 2090, hidden 3593, sheet „Kto si?“ logged at 3593 (same tick as hidden, after the fall); 401 in fall: code screen at once, canvas 0, rAF delta 0 in 0.8 s |
| 8 | Polls, tab return, writes after fall never show splash; tab switch during fall shows map, no leftovers | pass | 3 visibility polls after fall: `#boot` changes stay at 3 (show, fall, hide), still hidden. Frozen (`Page.setWebLifecycleState`) mid-fall for 3 s: hidden on resume, canvas 0. Writes: code path only (`applyState` → `render`, no `#boot` change), reviewer also checked a server write |
| 9 | Dark mode: splash and sign look as light | pass | Canvas hash identical light vs dark at 1440×900; sign color `rgb(46,31,20)`, bg `rgb(244,235,208)`, `#boot` `rgb(142,155,72)` in dark; no `var(--` in boot rules |
| 10 | Leaf svg, `.leaf`, `leafFall` gone; `role="status"`, canvas `aria-hidden="true"` | pass | grep: no leaf/boot--fade/BOOT_FADE refs; `static/index.html` lines 228–229 |
| 11 | No `innerHTML` added; no new Slovak text; no external assets, build step or framework | pass | Diff has 0 `innerHTML` added; the only Slovak text is the existing „Načítavam…“ and the error string |
| 12 | Intro constants named in logic script; app script uses no literals | pass | Grep of intro code in `<script id="app">` shows only named constants; test "no magic numbers" passes |
| 13 | Node tests cover grid, picture, delay, fall, CSS/JS equality, page tests | pass | Grid values, 360×640 etc., 3840×2160 → 40, 100×100 → 10, NaN/0/negative → 0 cols/rows; picture and delay and fall tests present; 172 pass |
| 14 | `node --test tests/js/` and `uv run pytest -q` pass | pass | 172 pass; 383 passed |
| 15 | `tests/manualne.md` section 6 updated (T-012 palette item kept) | pass | Four T-022 items present, T-012 leaf/T-015 intro items replaced, palette item kept |
| 16 | `proposal.md` "Vzhľad" bullet replaced | pass | Bullet matches the text in the task |

**Extra scenarios tried**
- Resize 380×844 → 844×390 during the hold: canvas redrawn to 1688×780, fully covered.
- Landscape 844×390 dpr 3 and 360×640 dpr 3: full coverage, no seams.
- Desktop 1440×900 mid-fall: map visible under the falling blocks, bottom rows gone first.
- Error sign at 380 px: text wraps inside the sign, nothing cut off.
- Tap during fall with a real `elementFromPoint` check: scene element, not `#boot`.

**Observations (not failures)**
- Without a cookie and a slow `/api/state` response, the splash stays up until the 401 arrives (measured with a 2 s delayed 401: splash still shown at 1.0 s, code screen at 2.8 s). The page cannot know there is no cookie before the response, so this is inherent to the design. On a fast link it is 27–39 ms, invisible. Organizer may want to know this.
- Reviewer's nit still open: the comment above `resetSplash()` mentions `splash.pic`, which does not exist. Cosmetic, no action needed for done.

**Not verified here (manual, already in `tests/manualne.md` section 6)**
- iPhone Safari (portrait and landscape), Android Chrome, notch and toolbar behaviour, real-device stutter, real tab switching in a browser (only the frozen-lifecycle simulation was run), slow 3G throttling on a real network.

**Failures:** none.
