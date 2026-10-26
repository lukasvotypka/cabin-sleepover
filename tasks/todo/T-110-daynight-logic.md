# T-110: Day–night pure logic

- **Phase:** 1
- **Depends on:** none
- **Size:** S

## Goal
Pure functions for the time-lapse when switching nights (proposal "Stránka: jedna scéna a interakcie" → "Deň a noc pri prepnutí noci"): light by hour, clock label, duration, easing and the hour the figures swap. Values and formulas follow the approved prototype `design/day-night/index.html` (pure part) and `design/day-night/README.md` ("Time model").

## Scope
- `static/js/logic-daynight.js` (new)
- `static/index.html`: one `<script src="static/js/logic-daynight.js?v=__ASSET_VERSION__">` tag among the `logic-*` tags (before `app-core.js`)
- `tests/js/logic.test.mjs`: new tests

## Acceptance criteria
- [ ] `logic-daynight.js` is a plain script (no ES modules, no DOM, no `window`/`document`), loads in the Node vm context of `tests/js/logic.test.mjs`.
- [ ] Hours are counted from 00:00 of the first night's start day. `noonOf(night, nights)` returns `index * 24 + 12` (12, 36, 60 for the three nights); an unknown night returns `null`.
- [ ] Sun constants: sunrise 06:40, sunset 16:40, twilight 1.2 h (prototype values). `darkness(h)` is 0 at 12:00, 1 at 00:00 and 03:00, between 0 and 1 at 06:40 and 16:40, rises monotonically from 16:00 to 18:00, and works for negative hours and hours ≥ 24 (modulo 24).
- [ ] `dusk(h)` is 1 at 06:40 and 16:40, 0 at 12:00 and 00:00, never negative.
- [ ] `clockLabel(h, nights)` gives the Slovak day abbreviation plus `HH:MM` rounded down to 15 min: `"Št 12:00"` at 12, `"Pi 03:00"` at 27, `"So 12:00"` at 60, `"Ne 12:00"` at 84; minutes like `27.6 → "Pi 03:30"`. Day abbreviations come from the existing `dayShort`/`DAY_SHORT` in `logic-model.js` (dates from `nights`), not a new hardcoded list.
- [ ] `durationMs(fromH, toH)` = `900 + 1250 * |toH − fromH| / 24`: 24 h → 2150, 48 h → 3400, backwards equals forwards.
- [ ] `ease(x)`: ease-in-out cubic as in the prototype; `ease(0) = 0`, `ease(0.5) = 0.5`, `ease(1) = 1`, monotonic.
- [ ] `swapHour(fromH, toH)`: returns `fromH` (swap at once) when `|toH − fromH| < 12`, otherwise `toH − 12` going forward and `toH + 12` going back (midnight of the last night passed). Tested: 12→36 gives 24, 12→60 gives 48, 60→12 gives 24, 30→36 gives 30.
- [ ] Retarget is covered by a test: from a mid-animation hour (e.g. 40.3) to a new noon, `durationMs` and `swapHour` use the current hour, with no jump.
- [ ] Light opacities the app sets per frame come from one pure function, e.g. `lightAt(h)` → `{dark, dusk, lamp, fireflies, bird}` using the prototype formulas (`dark = d * 0.78`, `dusk = k * 0.55 * (1 − d * 0.5)`, lamps `smooth((d − .25) / .5)`, fireflies `smooth((d − .6) / .4)`, bird `1 − smooth(d / .6)`); tests check day (all night parts 0, bird 1) and midnight (dark 0.78, lamps 1, fireflies 1, bird 0).
- [ ] `node --test tests/js/` passes, and `uv run pytest` still passes.

## Notes for developer
- Top-level names share one global scope with the other scripts: check for clashes (`smooth`, `ease` and `noonOf` may already be used; prefix them with `dn` if so).
- No speed multiplier: the prototype's `speed` switch was for the preview only. Open decision "Deň a noc pri prepnutí noci": default is about 2.2 s per night and figures swap in the last night passed.
- Sun times stay constants in this file. The README idea of `event.sun` in `cabin.yaml` is not in the proposal, so do not add it.

---
## Dev log

## Review round 1

## Review round 2

## Test report
