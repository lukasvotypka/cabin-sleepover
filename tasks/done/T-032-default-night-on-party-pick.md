# T-032: Switch to the arrival night when the party is picked

- **Phase:** 1
- **Depends on:** T-031
- **Size:** S

## Goal
Organizer's follow-up request of 24. 10. 2026 (not in `proposal.md`): when the user's party is chosen, the map's selected night jumps to the party's arrival night (`party.arrive`). This happens only when the party is chosen or restored. Refreshes never override a night the user picked by hand. Page only. See "Frontend" in `proposal.md` and the night signposts in the scene.

## Scope
- `static/js/logic-model.js`: new pure `defaultNightFor(party, nights)`.
- `static/js/app-sheet.js`: the party row click handler in „Kto si?“.
- `static/js/app-form.js`: the create branch of `send()` (`!editing && created`).
- `static/js/app-core.js`: `applyState()` plus a one-shot flag in `app` for the restore on load.
- `tests/js/logic.test.mjs`: new tests.

## Acceptance criteria
- [x] `defaultNightFor(party, nights)` lives in `static/js/logic-model.js`, uses no DOM, and returns `party.arrive` when `nights` contains it. Otherwise it returns `nights[0]`, also when `party` is null/undefined or has no `arrive`.
- [x] Node tests in `tests/js/logic.test.mjs` cover these cases: arrive = first night, arrive = a later night (e.g. `2026-10-30`), arrive outside `nights` (e.g. `2026-11-01`), missing `arrive`, `party` null. `node --test tests/js/` passes.
- [x] Picking a party row in „Kto si?“ sets `app.night = defaultNightFor(party, app.state.event.nights)` before the existing `render()`.
- [x] Creating a new party in the form sets the night from the `created` party in the response, so a party arriving on Friday lands on the Friday night. Editing a party does **not** change the night.
- [x] On page load with a remembered party (`KEYS.party` in storage), the **first** state applied after load sets the night from that party, if the party still exists. If it was deleted (the existing `forgetMyParty()` path), the night falls back to `nights[0]` as it does today.
- [x] Later `applyState()` calls (30 s poll, tab return, after writes and the ETag 304 path) never change `app.night`, except for the existing fallback when `app.night` is not among the event nights. The one-shot flag is the check for this: once it is set, `applyState` never calls `defaultNightFor` again.
- [x] No server or API changes. No new script file (if one is added anyway, it is listed in `index.html` with `?v=__ASSET_VERSION__`, logic before app).
- [x] `uv run pytest` and `node --test tests/js/` both pass.

## Notes for developer
- `selectNight()` in `app-scene.js` also calls `cancelWalks()` and re-renders. When the night changes in the handlers above, set `app.night` directly before their existing `render()`, or call `selectNight()`, but render only once.
- Picking the party that is already mine in „Kto si?“ also jumps to its arrival night, because the request says "right after the user picks a party". Do not add a "same party" special case.
- On load the first state can arrive during the splash or intro (`revealWhenReady()` path in `applyState`). Set the night before that early `return` so the first visible frame already shows the right night.
- The join flow (no cookie, code entry, then the first state) counts as the first state after load. With no remembered party it keeps `nights[0]`, and „Kto si?“ then does the switch.
- After a pick the text summary for screen readers (`srSummary`) follows `app.night` through `render()`, so nothing extra is needed there.
- Keep UI text Slovak. This task adds no new UI text.

---
## Dev log

- Added pure `defaultNightFor(party, nights)` to `static/js/logic-model.js` (arrive if in nights, else `nights[0]`).
- `app-core.js`: new `app.nightSynced` one-shot flag. The first `applyState()` takes the night from the remembered party (before the intro early `return`); later calls never do. The existing out-of-range fallback is unchanged.
- `app-sheet.js`: the „Kto si?“ row click sets `app.night` before the existing `render()`. `app-form.js`: the create branch sets it from `created` (edit does not).
- Test: `tests/js/logic.test.mjs` "default night ..." covers first night, later night, outside nights, missing arrive, null/undefined party.
- Commands: `node --test tests/js/` (212 pass), `uv run pytest -q` (433 pass).
- Not browser-tested; no server/API changes, no new script files.

## Review round 1

Checked: `git diff` of the five scoped files, `applyState()`, `write()`, `poll()` and the form `send()` around the change, the script list in `index.html`.

- Tests run by reviewer: `node --test tests/js/` 212 pass, `uv run pytest -q` 433 pass.
- `defaultNightFor` is pure, sits in `logic-model.js` (loaded by the Node vm harness), and covers all five required cases plus `undefined`.
- `applyState`: the one-shot `nightSynced` is set on the first call, before the out-of-range fallback and before the intro early `return`. Polls, the 304 path (which does not call `applyState`), and write responses never reach `defaultNightFor` again. If the remembered party was deleted, `remembered` is null, `app.night` stays null, the fallback picks `nights[0]`, and `forgetMyParty()` runs as before.
- „Kto si?“ row and create branch set `app.night` before their single existing `render()`. The edit branch is untouched. On create, `app.state` is already the write response's state, so `nights` is current.
- No server/API change, no new script, all `static/js/*.js` are listed with `?v=__ASSET_VERSION__`, no new UI text.

No blockers.

- **Suggestion:** setting `app.night` directly skips `cancelWalks()` (the task notes allow it). If a walk animation of the old night can still be running when „Kto si?“ is tapped, consider calling it there too. This is not required.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (24. 10. 2026), no browser available; checks by running the code and by reading the changed ranges.

Commands and results:
- `uv run pytest -q`: 433 passed (no failures).
- `node --test tests/js/`: 212 pass, 0 fail (includes the "default night ..." test in `tests/js/logic.test.mjs`).
- Behavioural check (`/tmp/cabin-tester/applystate-check.mjs`, not in the repo): loads the real `defaultNightFor` (`logic-model.js`) and the real `applyState` (`app-core.js`) into a `node:vm` context with DOM and render functions stubbed, then runs 9 sequences. All 9 pass: remembered party on Fri gives Fri; on Thu gives Thu; a later poll keeps a hand-picked night (Sat); arrive outside nights gives Thu; deleted remembered party gives Thu, calls `forgetMyParty`, sets `askWho`; no remembered party gives Thu and a later state with a party does not switch; first state during the intro sets the night before the early return (no render yet); an out-of-range night resets to Thu; the party not yet known on the first state and appearing on a later one does not switch.
- Call sites (grep): `defaultNightFor` is called only in `app-core.js` `applyState` (guarded by `nightSynced`), `app-sheet.js` row click and `app-form.js` create branch. `applyState` is called only from `write()` and `poll()`'s 200 path, so the 304 path cannot reach it.
- `git status`: only `static/js/app-core.js`, `app-form.js`, `app-sheet.js`, `logic-model.js` and `tests/js/logic.test.mjs` changed. No `app/`, `config/` or `static/index.html` change. No new script.

Acceptance criteria:

| # | Criterion | Result | How verified |
|---|---|---|---|
| 1 | `defaultNightFor` is pure, in `logic-model.js`, returns arrive if in nights, else `nights[0]` (also null/undefined/no arrive) | PASS | code read; Node test runs it in an empty vm context (any DOM use would throw) |
| 2 | Node tests cover first night, later night, outside nights, missing arrive, null | PASS | `node --test` 212 pass |
| 3 | „Kto si?“ row click sets `app.night` before `render()` | PASS (code) | `app-sheet.js:172` read; browser click is manual |
| 4 | Create sets night from `created`; edit does not | PASS (code) | `app-form.js:229` only in the `!editing && created` branch; `write()` applies the write response state before that branch, so `app.state.event.nights` is current |
| 5 | First state after load sets night from remembered party; deleted party falls back to `nights[0]` | PASS | vm check, cases 1, 2, 4, 5, 7 |
| 6 | Later `applyState` never changes night (except out-of-range fallback) | PASS | vm check, cases 3, 6, 9; call-site grep |
| 7 | No server/API change, no new script, index.html unchanged | PASS | `git status`, pytest unchanged |
| 8 | `uv run pytest` and `node --test tests/js/` both pass | PASS | 433 and 212 |

Extra scenarios tried: the vm sequences above (restart with remembered party, deleted party, intro path, poll after hand pick). Not tried in a browser: the visual jump, the walk-in-progress case (the developer skipped `cancelWalks()`, which the task allows; the reviewer's note is open), iPhone Safari and Android Chrome.

Failures: none.

Manual checklist: added the item "Arrival night on pick (T-032)" to `tests/manual.md`, covering the Friday pick, poll and tab return, reload, edit, and a walk in progress.

Result: PASS. Moved to `tasks/done/`.
