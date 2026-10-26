# Day and night when switching nights: analysis

Design prototype and analysis only. Nothing in `static/` or `app/` changes yet.

## The request

When someone taps a night signpost, the scene shows time passing. Switching from Št → Pi to So → Ne runs the clock from
Thursday 12:00 to Saturday 12:00. The light goes through dusk, night, dawn and day twice. Then the scene rests at
noon of the new night's first day.

## Time model

- Each night is shown at **noon of the day it starts**: night `2026-10-29` = Thu 12:00. In hours since Thu 00:00
  that is 12, 36 and 60 (`noon = index(night) * 24 + 12`).
- A switch animates the hour from the current value to the target. Going back (So → Št) runs the clock backwards.
- Duration: `900 ms + 1250 ms per 24 h`, so 1 night ≈ 2.2 s and 2 nights ≈ 3.4 s, with ease-in-out.
- A tap during the animation retargets from the current hour, with no jump.
- Sun around 30. 10. 2026 (CET, after the clock change on 25. 10.): sunrise ~06:40, sunset ~16:40, about 1.2 h
  of twilight. These could become optional `event.sun: { rise: "06:40", set: "16:40" }` in `cabin.yaml`.

## What changes in the scene

| Layer | Day | Dusk/dawn | Night |
| --- | --- | --- | --- |
| Dark tint (navy `#16224A`, multiply) | 0 | ramps | 78 % outside, ~35 % over room floors (mask) |
| Warm tint (orange, multiply) | 0 | peak at sunset/sunrise | 0 |
| Lamp light (rooms, windows, light pools at doors) | off | fades in | on |
| Fireflies (7 blinking dots on the grass) | off | off | on |
| Bird | flies | fades out | hidden |
| Clock board at the top: sun/moon, „Pi 03:00“, 3 h strip Thu 12 → Sun 12 | shown during the animation, fades out 0.9 s after it ends |

All coordinates come from `layout.rooms`, `map.windows` and `map.doors`, so the effect follows `cabin.yaml`.

## When the figures switch

Two options, both in the preview:

1. **In the last night passed (recommended default):** the figures of the new night appear at the darkest point
   (midnight of the last night the clock crosses), as if people went to bed. The signpost highlight changes at once
   in the real app, not at midnight as in the preview, where each night is a captured picture.
2. **At once:** figures switch on tap, and the time-lapse is only decoration.

When fewer than 12 h pass, the figures always switch at once.

## Fit into the code

- `static/js/logic-daynight.js` (new, pure, Node-tested): `noonOf`, `darkness(h)`, `dusk(h)`, `clockLabel(h)`,
  `durationMs`, `swapHour(from, to)`, `ease`.
- `static/js/app-daynight.js` (new): builds the light layer once in `ensureScene()` and drives it with
  `requestAnimationFrame`, setting only `opacity` attributes each frame.
- `selectNight(night, { animate: true })` in `app-scene.js`: only a **user tap** on a signpost or on the HUD
  „Ťukni sem“ animates. Initial load, party pick (`defaultNightFor`) and SSE updates jump without the animation.
- `render()` during the animation draws the beds of the night already shown, so an SSE update does not reveal the
  new night before the swap.
- `prefers-reduced-motion`: no animation and no clock, just the switch (as now). The fireflies don't blink.
- Light layer placement: the preview darkens everything, including boards. **Recommended:** put it under `boards`,
  so signposts and the table stay readable, and dim the boards only lightly.
- No server change, no new endpoint and no Slovak text from the server. The only new UI text is the day
  abbreviations, which already exist.
- Optional sound in `app-sound.js` (an owl at night, a rooster at dawn), muted like the other sounds.
- Performance: one mask plus about 20 rects, with attribute updates only. That is fine on older iPhones.

## Proposed tasks (next free ids after T-103)

- **T-110 Day–night logic:** `logic-daynight.js` plus Node tests (light curves, labels, swap hour, duration,
  retarget).
- **T-111 Day–night scene layer and animation:** `app-daynight.js`, light layer, clock board, hook into
  `selectNight` for taps only, reduced motion, SSE during the animation.
- **T-112 Docs:** proposal section (Slovak), `tests/manual.md` (iPhone Safari blend modes, rapid taps).

## Open decisions for the organizer

1. When the figures switch: in the last night (default) or at once.
2. Do boards darken with the scene (preview) or stay readable (default)?
3. Speed: about 2.2 s per night (default). The preview has faster and slower options.
4. Fireflies, sounds: on (default) or off.
5. Should the clock board stay visible at rest (e.g. „Št 12:00“ next to the title)? Default: no, only during the
   animation.

## Preview

`index.html` is a template. `build.py` inlines the scene SVGs captured from a running app for each night, plus
the app CSS: `python3 -I build.py index.html <capture-dir> <out.html>`. `?h=40.5` freezes the clock at that hour
for screenshots.
