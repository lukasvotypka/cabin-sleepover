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
- [x] `logic-daynight.js` is a plain script (no ES modules, no DOM, no `window`/`document`), loads in the Node vm context of `tests/js/logic.test.mjs`.
- [x] Hours are counted from 00:00 of the first night's start day. `noonOf(night, nights)` returns `index * 24 + 12` (12, 36, 60 for the three nights); an unknown night returns `null`.
- [x] Sun constants: sunrise 06:40, sunset 16:40, twilight 1.2 h (prototype values). `darkness(h)` is 0 at 12:00, 1 at 00:00 and 03:00, between 0 and 1 at 06:40 and 16:40, rises monotonically from 16:00 to 18:00, and works for negative hours and hours ≥ 24 (modulo 24).
- [x] `dusk(h)` is 1 at 06:40 and 16:40, 0 at 12:00 and 00:00, never negative.
- [x] `clockLabel(h, nights)` gives the Slovak day abbreviation plus `HH:MM` rounded down to 15 min: `"Št 12:00"` at 12, `"Pi 03:00"` at 27, `"So 12:00"` at 60, `"Ne 12:00"` at 84; minutes like `27.6 → "Pi 03:30"`. Day abbreviations come from the existing `dayShort`/`DAY_SHORT` in `logic-model.js` (dates from `nights`), not a new hardcoded list.
- [x] `durationMs(fromH, toH)` = `900 + 1250 * |toH − fromH| / 24`: 24 h → 2150, 48 h → 3400, backwards equals forwards.
- [x] `ease(x)`: ease-in-out cubic as in the prototype; `ease(0) = 0`, `ease(0.5) = 0.5`, `ease(1) = 1`, monotonic.
- [x] `swapHour(fromH, toH)`: returns `fromH` (swap at once) when `|toH − fromH| < 12`, otherwise `toH − 12` going forward and `toH + 12` going back (midnight of the last night passed). Tested: 12→36 gives 24, 12→60 gives 48, 60→12 gives 24, 30→36 gives 30.
- [x] Retarget is covered by a test: from a mid-animation hour (e.g. 40.3) to a new noon, `durationMs` and `swapHour` use the current hour, with no jump.
- [x] Light opacities the app sets per frame come from one pure function, e.g. `lightAt(h)` → `{dark, dusk, lamp, fireflies, bird}` using the prototype formulas (`dark = d * 0.78`, `dusk = k * 0.55 * (1 − d * 0.5)`, lamps `smooth((d − .25) / .5)`, fireflies `smooth((d − .6) / .4)`, bird `1 − smooth(d / .6)`); tests check day (all night parts 0, bird 1) and midnight (dark 0.78, lamps 1, fireflies 1, bird 0).
- [x] `node --test tests/js/` passes, and `uv run pytest` still passes.

## Notes for developer
- Top-level names share one global scope with the other scripts: check for clashes (`smooth`, `ease` and `noonOf` may already be used; prefix them with `dn` if so).
- No speed multiplier: the prototype's `speed` switch was for the preview only. Open decision "Deň a noc pri prepnutí noci": default is about 2.2 s per night and figures swap in the last night passed.
- Sun times stay constants in this file. The README idea of `event.sun` in `cabin.yaml` is not in the proposal, so do not add it.

---
## Dev log

- Added `static/js/logic-daynight.js` (noonOf, smooth, darkness, dusk, clockLabel, durationMs, ease, swapHour, lightAt; no name clashes, so no `dn` prefix; day abbreviations via `dayShort`/`addDays`). Script tag after `logic-live.js` in `static/index.html`. Tests appended to `tests/js/logic.test.mjs`.
- Commands: `node --test tests/js/` (359 pass), `uv run pytest -q` (739 pass).

## Review round 1

Checked: `git diff` of the three scoped files, prototype `design/day-night/index.html` (lines 75-95, 148-149). `node --test tests/js/`: 359 pass. `uv run pytest -q`: 739 pass.

- All acceptance criteria are met. The constants, `smooth`, `darkness`, `dusk`, `durationMs` (without the preview `speed`) and `ease` match the prototype exactly, and `lightAt` matches the prototype opacity formulas. `clockLabel` uses `dayShort`/`addDays` from `logic-model.js`. `noonOf` returns null for an unknown night.
- No global name clashes: none of the new top-level names exist in any other `static/js/*.js`. The script tag is among the `logic-*` tags with `?v=__ASSET_VERSION__`, and every file in `static/js/` is listed. The file uses no DOM or browser globals.

**Blockers:** none.

**Suggestion:** `smooth`, `ease`, `dusk` and `darkness` are generic names in the shared global scope. T-111 should watch for top-level clashes when it brings over the prototype's app code. A `dn` prefix would be safer, but the task allowed plain names because there is no clash today.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2

## Test report

Tester (T-110), run from the repo root:
- `node --test tests/js/`: 359 pass, 0 fail.
- `uv run pytest -q`: 739 passed (regression check of the done tasks).
- Probe of `static/js/logic-daynight.js` in a Node vm context (temp script, removed afterwards), with the three nights from `2026-10-29`:
  - `noonOf`: 12, 60 for the first and last night; `null` for an unknown night.
  - `darkness`: 0 at 12, 1 at 0 and 3, 0.5 at 06:40 and 16:40 (between 0 and 1); monotonic 16:00 to 18:00 (checked every 0.01 h); negative hours and 24+3 give the same as modulo 24 (`darkness(-12)=0`, `darkness(27)=1`).
  - `dusk`: 1 at 06:40 and 16:40, 0 at 12 and 0, never negative (0 at -5 and 100).
  - `clockLabel`: "Št 12:00", "Pi 03:00", "So 12:00", "Ne 12:00", 27.6 → "Pi 03:30" (all as specified).
  - `durationMs`: 2150 (12→36), 3400 (12→60), 3400 backwards (60→12).
  - `ease`: 0, 0.5, 1; monotonic.
  - `swapHour`: 24, 48, 24, 30 as specified; 40.3→12 gives 24, 12→40.3 gives 28.3 (no jump at retarget).
  - `lightAt`: midnight gives dark 0.78, lamp 1, fireflies 1, bird 0; noon gives dark 0, bird 1.
- Served page (`create_app` with a temp data dir and test secrets, via httpx ASGI): `GET /` 200 and contains `logic-daynight.js?v=` with the placeholder replaced; `GET /static/js/logic-daynight.js` 200 `text/javascript`; `GET /data/cabin-data.yaml` 404.
- No global name clashes: none of the new top-level names (`smooth`, `ease`, `dusk`, `darkness`, `lightAt`, `swapHour`, `durationMs`, `clockLabel`, `noonOf`, `SUNRISE`, `SUNSET`, `TWILIGHT`) is declared in another `static/js/*.js`.

| Criterion | Result |
| --- | --- |
| Plain script, no DOM, loads in the vm context | PASS |
| noonOf values, unknown → null | PASS |
| Sun constants, darkness (incl. negative and ≥24 hours) | PASS |
| dusk values, never negative | PASS |
| clockLabel values and day abbreviations | PASS |
| durationMs values, backwards equals forwards | PASS |
| ease(0/0.5/1), monotonic | PASS |
| swapHour cases | PASS |
| Retarget from mid-animation hour | PASS |
| lightAt formulas, day and midnight | PASS |
| node --test and uv run pytest pass | PASS |

Observation (not a criterion, no failure): `clockLabel(h, [])` returns `" 12:00"` (leading space, no day) when `nights` is empty. Unreachable with the real config, so not blocking.

Verdict: PASS. No bugs found. Moved to `tasks/done/`.
