# T-140: The sun moves with the time of day

- **Phase:** 1
- **Depends on:** T-139
- **Size:** S
- **UX:** yes

## Goal
Organizer's request of 27. 10. 2026: „Move shadow / position of light in scene when daylight changing“. The sun's direction and height follow the time slider (sunrise in the east, low long shadows in the morning and evening, short at noon, sunset in the west), so the shadows turn and stretch during the day and the time-lapse; at night a weak moon light takes over.

## Scope
- Pure sun path in `logic-daynight.js` or `logic-iso.js` (azimuth and elevation for an hour, using the same sunrise/sunset as `lightAt`), with Node tests.
- `app-iso.js`: `isoLight` moves the sun (and its shadow camera target) by hour; the shadow map is re-rendered only when the sun has moved by a step (quantized, e.g. every few degrees), not every frame, and never while nothing changes.
- Keep bed tops readable (no long shadow fully over an open room at the slider's resting noon).

## Acceptance criteria
- [x] Dragging the slider or running the time-lapse visibly turns and stretches the shadows (morning, noon, evening screenshots differ as expected).
- [x] Noon (the resting time) still has every bed top at most half in shadow.
- [x] No shadow re-render while the time stands still; phone cost during the time-lapse measured and reported.
- [x] Reduced motion: the sun jumps to the new position at once, one render.
- [x] Tests added; all green.

## Design
Stylized sun path, not an astronomical one. The camera looks from the south-east (azimuth about +45°, angles counted from south, + = east). A sun near +45° throws every shadow straight behind its object, where nobody sees it. So the path stays east and then west of that axis and crosses it quickly in the morning. Noon stays exactly the T-136 look that is in the code now (24°, 20° west of south).

- **Path (pure, `logic-daynight.js`, e.g. `sunAt(h)` → `{az, elev, moon}`):** keyframes on the hour of the day, linear between them, with `SUNRISE`/`SUNSET` reused from the top of the file:
  | time | az | elev | why |
  |---|---|---|---|
  | `SUNRISE` 06:40 | +95° | 6° | rises in the east, long shadows to the west |
  | 08:00 | +70° | 13° | |
  | 09:15 | +25° | 19° | passes the camera axis here, short flat-lit stretch |
  | 11:00 | −10° | 23° | |
  | **12:00** | **−20°** | **24°** | **rest view = the current T-136 values, unchanged** |
  | 13:00 | −28° | 23° | plateau around noon so a small drag near the resting time barely changes the look |
  | 15:00 | −60° | 15° | |
  | `SUNSET` 16:40 | −95° | 6° | sets in the west, long shadows to the east |
  The elevation never goes below 6°: lower angles give acne and stripes, and the light is almost gone at that point anyway (`sunPower` already fades with `lightAt(h).d`). Between `SUNSET` and `SUNSET + TWILIGHT/2` and between `SUNRISE − TWILIGHT/2` and `SUNRISE`, hold the end keyframe.
- **Moon:** from `SUNSET + TWILIGHT/2` (17:16) to `SUNRISE − TWILIGHT/2` (06:04), so whenever `d` = 1, the light sits at a fixed moon spot: az −40°, elev 40°. That gives short, soft shadows beside the objects. Keep the colour and strength from `isoLightParams` (blue, about 0.15), with no new intensity. The sun↔moon jump happens only at those two moments, where the light is at its weakest, so it reads as a change of light, not a glitch. The moon stays still all night, so a night-to-night time-lapse redraws no shadows during the night part.
- **Shadow step (pixel feel plus phone cost):** quantize the direction. Redraw the shadow map (`sun.position` + `needsUpdate`) only when az has moved ≥ 6° or elev ≥ 2° since the last redraw, and at most once per shared 8 fps tick (no own timer, no own rAF). The shadows then jump in small steps like a sundial instead of sliding, which suits pixel art and limits a full-day time-lapse (2.15 s) to about 8–10 shadow renders. A drag follows the same rule. The time standing still gives zero redraws. The target and the shadow frustum stay centred and sized as now (`reach`). Do not refit the frustum per hour.
- **Noon readability:** the noon keyframe is the approved T-136 one, so the criterion holds by construction. Check it at 12:00, and check the plateau ends (11:00, 13:00) too. If a bed top is more than half shaded at 11:00 or 13:00, narrow the plateau toward −20° (e.g. −14°/−26°) rather than add light.
- **Reduced motion:** with no tick, every hour change sets the sun at once and redraws once.
- **What the person sees:** dragging the knob from morning to evening turns the tree and wall shadows from west through north to east and shortens them toward noon. The time-lapse shows a quick sundial sweep. No new texts, panels or controls. The svg flat shadows under the figures (`ISO_SHADOW`) do not move.
- **Not in scope:** a visible sun or moon disc in the sky, moon phases, real ephemeris or season, cloud shadows, figure cast shadows, refitting the frustum or changing the map size per hour, changing the light colours of `isoLightParams`.
- [x] (design) Screenshots at 08:00, 12:00, 15:30 and 22:00 in the dev log: the shadows point west, north-north-east, east, and short (moon).

---
## Dev log

- Added `sunAt(h)` (+ `SUN_PATH`, `MOON_SPOT`) in `static/js/logic-daynight.js`; `lightAt` now carries `sun`. `app-iso.js`: `isoSunStep(me)` (called from `isoLight` and the shared tick) moves the sun/shadow target only when az moved >= 6 deg or elev >= 2 deg, at most once per tick (immediately with reduced motion), then sets `shadowMap.needsUpdate`. Frustum untouched. Design keyframes used unchanged (plateau 11:00/13:00 needed no narrowing: beds lit in both).
- Tests: `tests/js/logic.test.mjs` (sunAt path, noon = -20/24, moon, step source checks; lightAt deepEqual updated). Commands: `node --test tests/js/` (all pass), `uv run pytest -q` (pass).
- Browser: headless Chrome SwiftShader, own server :8140, script `/tmp/cabin-t140/shot.mjs`, phone 390x844 DPR 3, houses open. Screenshots `/tmp/cabin-t140/phone-{0800,1100,1200,1300,1530,2200}.png`: 08:00 long shadows to the west/north-west, 11:00/12:00/13:00 short, beds lit, 15:30 long toward the east, 22:00 weak short moon shadows. 08:00 wall shadows do fall partly over Konica dole (not in criteria).
- Cost: shadow redraws while time stands still: 0 (reduced motion and normal motion; normal motion still renders ~7/s for campfire/smoke as before). Time-lapse 12:00 -> 36:00 (full day, 4.5 s window): 10 shadow renders, 64 total renders, avg rAF frame 16.9 ms, worst 49 ms (software GL, pessimistic). No page errors.
- Reduced motion: sun jumps at once (the 6 screenshots were taken that way, one draw per hour change).
- Trial link: not restarted (uncommitted; orchestrator restarts after commit): https://lukass-laptop-1.tail3bf463.ts.net:8443/ after restart.

## Review round 1

Checked: `git diff` (app-iso.js, logic-daynight.js, logic.test.mjs), build/loop context in `app-iso.js`, screenshots `/tmp/cabin-t140/phone-{0800,1200,1300,1530}.png`. Ran `node --test tests/js/` (425 pass) and `uv run pytest -q` (741 pass). No new scripts; every `static/js/*.js` is listed with `?v=__ASSET_VERSION__`.

- `sunAt` matches the design table exactly (keyframes, twilight hold, moon spot −40°/40° outside 06:04–17:16, wraps hours ≥ 24); noon = −20°/24° so the T-136 rest look is unchanged.
- `isoSunStep`: 6°/2° threshold, at most once per tick (`sunClock === clock`), immediate with reduced motion (no tick, called from `isoLight`), zero redraws while time stands still (threshold returns early every tick). Rebuild/context restore gets a fresh `me` without `sunDrawn`, so the first `isoLight` places the sun at once. Target and frustum untouched. Fine.
- Screenshots: 08:00 shadows long to the west/north-west, 12:00/13:00 short with beds lit, 15:30 long to the east. Noon criterion holds.
- Cost reported (10 shadow renders per full-day time-lapse, 0 at rest).

**Blockers:** none.

**Suggestion:**
- `app-iso.js:736-739`: because of the step, when a drag or time-lapse stops, the sun can stay up to 6° az / 2° elev short of the exact hour (e.g. a time-lapse ending at noon may rest at about −15° instead of −20°). It is within the design's "sundial step" intent, so not required. A cheap fix would be a final snap when the time settles (e.g. from `dnPaint` at animation end).
- The sun position formula is now duplicated (build line 417 and `isoSunStep`); a small helper would keep them in step.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

- **Tester (T-140, 27. 10. 2026):** PASS. Commands: `node --test tests/js/` (425 pass), `uv run pytest -q` (741 pass). Browser: Google Chrome headless (SwiftShader), phone 390x844 DPR 3, one house open (`housesAll = true`, not a house tap), temporary server on 127.0.0.1:8153 with a temp `data/` (stopped afterwards). Scripts in `/tmp/cabin-t140-test/` (`check.mjs`, `probe.mjs`, `sun.mjs`). Hours are since midnight of 29. 10., so 08:00 = 32, 12:00 = 36, 15:30 = 39.5, 22:00 = 46 (the slider starts at 12, so 08:00 on 29. 10. is out of range).
  - Screenshots: `/tmp/cabin-t140-test/phone-0800.png`, `phone-1200.png`, `phone-1530.png`, `phone-2200.png`, plus `phone-bedtap.png`. 08:00 shadows long to the west and north-west, 12:00 short, 15:30 long to the east, 22:00 moon-dark with soft short shadows.
  - Shadow renders (counted by wrapping `shadowMap.render` where `needsUpdate` is set): idle at rest 3 s = 0; each still 2 s after a change = 0; four hour jumps 3–9 renders each; drag by mouse 12→~29 = 3 renders, then 0 after release; full-day time-lapse by rail tap 12→36 = 9 renders over about 2.2 s, rAF avg 16.8 ms, worst 49 ms (software GL).
  - Reduced motion: sun at the target value at once, one render per hour change, 0 while still.
  - Criteria: morning/noon/evening differ as designed; noon rest sun about −20°/24° (T-136 look); beds lit in the 12:00 screenshot (judged by eye, not measured); no re-render at rest; reduced motion one render; tests green.
  - Regression: bed tap opens the panel; page errors none; the svg beds still tap; alignment of the 3D world with the svg checked by eye in the screenshots only.
  - Observations (not failures): (1) the sun can rest up to ~5° off its keyframe after a time-lapse, e.g. hour 36 read −17.6°/23.8° and 12:00 showed −15.3° in a screenshot. This is the step quantization the design accepts, and it is the reviewer's suggested final snap. (2) A mouse drag from the knob to 08:00 ended at about 28.8 h, so the knob's pointer offset is about 3 h off (existing drag code, not in T-140 scope). (3) The moon takes over at 17:16 with the sun still at −95°/6° just before, so the time-lapse has a visible shadow jump there, as designed.
  - Manual: added a checklist item for iPhone Safari and Android Chrome to `tests/manual.md` (moving sun, step feel, phone heat, reduced motion).
