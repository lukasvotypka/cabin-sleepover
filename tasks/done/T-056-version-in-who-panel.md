# T-056: App version at the bottom of the „Kto si?“ panel

- **Phase:** 1 (organizer request, 25. 10. 2026)
- **Depends on:** T-055
- **Size:** S

## Goal
The organizer wants to see which version a phone runs. Show the app version in a very small, muted line at the very bottom of the open „Kto si?“ panel (the party picker), e.g. `verzia 1.11.0 · 3f9a2c1b7d0e`: the release version from `pyproject.toml` (what `/api/health` reports) and the page code hash the page was loaded with (the `asset-version` meta from T-055).

## Scope
- `app/main.py` (make the release version available to the page, e.g. a second meta tag filled by `PageRenderer`, or a field in the state payload — pick one, prefer the meta tag so it shows the version *this page* was loaded with)
- `static/index.html` (meta tag, small CSS for the line)
- `static/js/app-*.js` where the „Kto si?“ panel is built
- `static/js/logic-*.js` (pure function that builds the line text)
- `tests/js/logic.test.mjs`, `tests/test_pwa.py` (or the nearest fitting pytest file)

## Acceptance criteria
- [x] The open „Kto si?“ panel ends with one line `verzia X.Y.Z · <hash>` in a very small muted font (about 11 px, `var(--muted)`), readable in light and dark mode, not a touch target, not announced as a heading.
- [x] X.Y.Z is the version from `pyproject.toml` (same value as `/api/health`); `<hash>` is the `asset-version` the page was loaded with. If either is missing or still the raw placeholder, it is left out (only the version, only the hash, or no line at all).
- [x] The text is set with `textContent`.
- [x] The line text is built by a pure function with Node tests (both values, one missing, placeholders).
- [x] pytest: `GET /` contains the release version in the page (where it was put) and no unreplaced placeholder.
- [x] `uv run pytest -q` and `node --test tests/js/` pass.

## Notes for developer
- Do not change the version sign logic of T-055.
- Keep `/api/health` as it is.
- `read_version(pyproject)` already exists in `app/main.py`.

---
## Dev log
- Added `app-version` meta (placeholder `__APP_VERSION__`, filled by `PageRenderer(static_dir, release)` in `app/main.py` from `read_version`), `.version-line` CSS in `static/index.html`, pure `versionLine()` in `static/js/logic-live.js`, line appended in `openWho` (`static/js/app-sheet.js`) via `textContent`.
- Tests: `tests/js/logic.test.mjs` (versionLine), `tests/test_pwa.py` (page carries release version).
- `node --test tests/js/` 297 pass; `uv run pytest -q` 544 pass. Visual check in a browser not done.

## Review round 1
Tests run by reviewer: `node --test tests/js/` 297 pass, `uv run pytest -q` 544 pass.

All acceptance criteria met: `app-version` meta filled by `PageRenderer` from `read_version` (same value as `/api/health`, which is unchanged), pure `versionLine()` with Node tests covering both / one missing / placeholders, line set via `htmlEl` text (textContent), plain `<p>` (not a heading, not focusable), last child of the panel body, `var(--muted)` at 11 px with light and dark values. T-055 sign logic untouched. All `static/js/*.js` are listed with `?v=__ASSET_VERSION__`.

No blockers.

- **Suggestion:** `static/index.html` `.version-line` sets `margin: 14px 0 0`, but `.sheet p { margin: 0 0 12px }` has higher specificity, so the 14 px top gap is ignored (the line sits 12 px below the actions with an extra 12 px under it). Use `.sheet .version-line` if the gap matters.
- **Nit:** when `pyproject.toml` has no version, `read_version` returns `"unknown"`, so the line reads `verzia unknown · <hash>`. Harmless, and it matches `/api/health`.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report
Tester: Haiku 5.5, 25. 10. 2026. Working tree as left by the developer and the orchestrator (`.sheet .version-line` selector).

Commands and results:
- `uv run pytest -q` (from repo root, uv at /opt/homebrew/bin): 544 passed.
- `node --test tests/js/`: 297 pass, 0 fail.
- Temp server on 127.0.0.1:8571 with a temp data dir and test secrets (not the real `data/`, not 8000/8010): `GET /api/health` → `{"ok":true,"version":"1.11.0"}`; `GET /` contains `<meta name="app-version" content="1.11.0">` and `<meta name="asset-version" content="5a6dc2050b6b">`; zero `__APP_VERSION__` or `__ASSET_VERSION__` left in the HTML; `HEAD /` → 200.
- Node probe of `versionLine` (through the real `logic-live.js` in a vm context): both values → `verzia 1.11.0 · 5a6dc2050b6b`; hash placeholder → `verzia 1.11.0`; release placeholder → hash only; null/undefined/empty on both → `""`; both placeholders → `""`; release `unknown` → `verzia unknown · abc` (the reviewer's nit, accepted as harmless and consistent with `/api/health`); a value with markup is returned as plain text (the page inserts it with `textContent` through `htmlEl`).
- Code read: `openWho` in `static/js/app-sheet.js` appends the line last in the panel body, as a `<p class="version-line">` (not a heading, not a button); the CSS selector `.sheet .version-line` is in effect because `openPanel` builds `div.sheet`; `--muted` is defined for light (#6B5644) and dark (#B9A38C) themes.

Acceptance criteria:
| # | Criterion | Result |
|---|---|---|
| 1 | Line `verzia X.Y.Z · <hash>` at the end of the open „Kto si?“, ~11 px, `var(--muted)`, not a touch target, not a heading | PASS by code and CSS read; visual size and contrast need a device (added to `tests/manual.md`) |
| 2 | X.Y.Z equals `pyproject.toml` / `/api/health`; hash equals the page's `asset-version`; missing or placeholder parts left out | PASS (health 1.11.0 = meta 1.11.0; hash = asset-version meta; edge cases probed above) |
| 3 | Text set with `textContent` | PASS (`htmlEl` sets `node.textContent`; `versionLine` output goes through it) |
| 4 | Pure function with Node tests (both, one missing, placeholders) | PASS (`tests/js/logic.test.mjs` line 3520) |
| 5 | pytest: `GET /` has the release version, no unreplaced placeholder | PASS (`tests/test_pwa.py::test_page_carries_the_release_version`, also checked by hand) |
| 6 | `uv run pytest -q` and `node --test tests/js/` pass | PASS |

Regressions: all of `tasks/done/` is covered by the full pytest and Node runs above, all green. T-055 sign logic unchanged (`updateSign` untouched in the diff); `/api/health` unchanged.

Extra scenarios: placeholder combinations and `null`/`undefined` inputs in `versionLine`; markup in the hash argument (text only); HEAD on `/`.

Not verifiable without a browser or device: the panel's actual rendering (the 11 px line, gap above it, light and dark look), and screen-reader behaviour on iPhone Safari and Android Chrome. Added as a checklist item in `tests/manual.md` (line 172).

Known minor point (not a failure): when `pyproject.toml` has no version, the line reads `verzia unknown`. Matches `/api/health`; left as is.

No bugs found. Result: PASS. Task moved to `tasks/done/`. Nothing committed.
