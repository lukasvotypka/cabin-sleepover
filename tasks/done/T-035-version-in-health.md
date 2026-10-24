# T-035: App version in /api/health

- **Phase:** 1
- **Depends on:** T-034
- **Size:** S

## Goal
Organizer's request of 24. 10. 2026: after a deploy the orchestrator must be able to check which release is running. `GET /api/health` returns the app version next to `ok`. See `proposal.md` → "HTTP API" (the health row).

## Scope
`app/main.py` (or a tiny `app/version.py`), `Dockerfile`, `tests/test_api_access.py`, `README.md` (deploy section: verification step), `proposal.md` (health row).

## Acceptance criteria
- [x] `GET /api/health` returns `200 {"ok": true, "version": "1.4.0"}`; `HEAD` still works. No cookie needed, as before.
- [x] The version comes from `[project].version` in `pyproject.toml`, the single source bumped at each release. Read once at startup with `tomllib` from the repo root (path relative to the `app` package, not the working directory). Do not hardcode it and do not rely on the project being installed as a package (the Docker image uses `--no-install-project`).
- [x] `Dockerfile` copies `pyproject.toml` into the runtime image so the version is available there. The image still holds no secrets, data or tests.
- [x] If `pyproject.toml` is missing or has no version, the app still starts and health returns `"version": "unknown"` (no crash, one warning in the log). Test for this case (e.g. by pointing the reader at a temp path).
- [x] Test that health returns the same version as `pyproject.toml`.
- [x] `README.md` deploy section: after `docker compose up -d --build`, check that `/api/health` shows the version just released.
- [ ] `uv run pytest` and `node --test tests/js/` pass.

## Notes for developer
- The Dockerfile `HEALTHCHECK` only needs a 200, keep it as is.
- English only in code, logs and README.

---
## Dev log
Added `read_version()` (tomllib, `[project].version`, else "unknown" + one warning) and a `pyproject` kwarg to `create_app` in `app/main.py`; health returns `{ok, version}`. Dockerfile copies `pyproject.toml`; README deploy step and proposal health row updated. Tests in `tests/test_api_access.py` (matches pyproject; unknown when missing). Ran `uv run pytest` (461 passed) and `node --test tests/js/` could not run: `node` is not installed in this shell (no JS touched). Docker build not run.

## Review round 1
Ran `uv run pytest` (461 passed) and `node --test tests/js/` (224 passed).

- All acceptance criteria met. `read_version()` in `app/main.py` reads `[project].version` via `tomllib` from `ROOT / "pyproject.toml"` (`ROOT` = parent of the `app` package), once in `create_app`; falls back to "unknown" with exactly one warning (TOMLDecodeError/UnicodeDecodeError are covered by `ValueError`). Health returns `{ok, version}`, HEAD still answered, no cookie.
- Dockerfile: runtime stage has `WORKDIR /app`, `COPY pyproject.toml ./pyproject.toml` and `COPY app ./app`, so `/app/app/main.py` resolves to `/app/pyproject.toml`. `.dockerignore` does not exclude `pyproject.toml`; no secrets, data or tests added. HEALTHCHECK unchanged.
- Tests: health matches `pyproject.toml` version; missing file yields "unknown" and one warning. README and proposal health row updated (proposal text Slovak, consistent with the file).

Blockers: none.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

Tester (Haiku 5.5), 24. 10. 2026:

Commands and results:
- `uv run pytest -q`: 461 passed.
- `PATH=/opt/homebrew/bin:$PATH node --test tests/js/`: 224 passed, 0 failed (Node v26.12.1 is present at /opt/homebrew/bin, so the developer's "node not installed" note does not apply here).
- Probe script (temp data dirs, ASGI transport, `cwd=/tmp`): default health gives `200 {"ok": true, "version": "1.4.0"}` and matches `pyproject.toml`; HEAD gives 200 with empty body; no Set-Cookie.
- Edge cases of `read_version`: missing file, no `version` key, empty string, integer version, invalid TOML, no `[project]` table, non-UTF-8 bytes, and a directory path all give `"unknown"` with exactly one warning, and the app starts.
- Real uvicorn on 127.0.0.1:8731 (temp data dir): `GET` and `HEAD /api/health` return 200, version 1.4.0. Server stopped afterwards.
- Image-like layout (`app`, `static`, `config`, `pyproject.toml` copied to a temp dir, app imported from there): version 1.4.0. Without `pyproject.toml`: `unknown`, one warning, startup OK.
- `.dockerignore` does not exclude `pyproject.toml`; the Dockerfile still excludes secrets, data and tests. Docker build not run (Docker unavailable locally).

| Criterion | Result |
| --- | --- |
| Health 200 `{ok, version: "1.4.0"}`, HEAD works, no cookie | PASS |
| Version from `[project].version`, tomllib, path relative to package, not hardcoded | PASS |
| Dockerfile copies `pyproject.toml`; no secrets/data/tests | PASS (by inspection; build not run) |
| Missing or versionless pyproject gives "unknown", one warning, no crash, tested | PASS |
| Test that health equals pyproject version | PASS |
| README deploy verification step | PASS |
| `uv run pytest` and `node --test tests/js/` pass | PASS |

Extra: added one manual checklist item in `tests/manual.md` (version after deploy, Docker build).

Verdict: PASS, moved to `tasks/done/`. Regressions: none, the full pytest suite includes the earlier done tasks.
