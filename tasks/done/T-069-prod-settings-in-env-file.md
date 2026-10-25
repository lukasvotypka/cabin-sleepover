# T-069: Production settings in the env file next to the secrets

- **Phase:** 1
- **Depends on:** none (organizer gave the go on 25. 10. 2026)
- **Size:** S

## Goal
Document that production switches such as `INFO_ENABLED` live in `/etc/cabin/secrets.env` together with the secrets, not in `compose.yaml` and not in a `.env` next to it ("Otvorené rozhodnutia", plan T-069). No code change.

## Scope
`README.md` (section 4, deployment), `.env.example`, `tests/manual.md`. Do not change `compose.yaml` beyond its comment (it keeps `INFO_ENABLED: ${INFO_ENABLED:-false}` as the safe default).

## Acceptance criteria
- [x] README section 4: the `secrets.env` step lists the optional fourth line `INFO_ENABLED=true` (or `false`) and says the section stays off when the line is missing; changing it needs `docker compose --env-file /etc/cabin/secrets.env up -d` (a restart without the env file keeps the old value).
- [x] README says how to check the result: the startup log line `„Pred cestou“ section on/off (INFO_ENABLED)` (`docker compose logs cabin | grep "Pred cestou"`).
- [x] The README keeps the warning against a `.env` next to `compose.yaml` and explains that it would also override `INFO_ENABLED`.
- [x] `.env.example` separates the local-development part from a short comment block "production: put these in /etc/cabin/secrets.env" listing the three secrets and the optional `INFO_ENABLED`.
- [x] `compose.yaml` comment above `INFO_ENABLED` points to `/etc/cabin/secrets.env`.
- [x] `tests/manual.md` has a deployment item: with no `INFO_ENABLED` line the board is hidden; with `INFO_ENABLED=true` and `up -d` it shows; the log line matches.
- [x] `uv run pytest` and `node --test tests/js/` still pass.

## Notes for developer
Never run anything against production (votypka.sk). Only documentation changes. English text in README and comments.

---
## Dev log
Docs only. README section 4 (INFO_ENABLED fourth line, `--env-file ... up -d`, log check, `.env` warning extended), `.env.example` (dev vs production block), `compose.yaml` comment, `tests/manual.md` item. Tests: `uv run pytest` 620 passed; `node --test tests/js/` passed.

## Review round 1
Docs only; diff limited to README.md, .env.example, compose.yaml (comment only), tests/manual.md. Checked against the code:
- `app/main.py:526-527` logs `„Pred cestou“ section on|off (INFO_ENABLED | info.yaml | no info.yaml)`. On production compose always sets `INFO_ENABLED` (default `false`), so the source is always `INFO_ENABLED`, matching the README and manual wording. `configure_logging` puts the line on stderr under uvicorn, so `docker compose logs cabin` shows it; service name `cabin` matches compose.yaml.
- `info_enabled_override` accepts true/false (and 1/0, yes/no, on/off); the README text `true` (or `false`) is right.
- `restart` keeps the old environment and only `up -d` with the env file recreates the container: correct.
- compose.yaml keeps `INFO_ENABLED: ${INFO_ENABLED:-false}`; only the comment changed.
- Tests: `uv run pytest` 620 passed; `node --test tests/js/` 324 passed.

No blockers.

Verdict: APPROVED (round 2 skipped, no blockers)

## Review round 2

## Test report

- **Tester (T-069, 25. 10. 2026)**
  - `PATH=/opt/homebrew/bin:$PATH uv run pytest -q`: 620 passed.
  - `node --test tests/js/`: 324 pass, 0 fail.
  - Startup log, temp `data/` dirs, own servers on ports 8741-8743 (stopped afterwards; the trial server on 8010 was not touched). Started as production does (`configure_logging()` then `create_app`, the same path as `app.main.__getattr__`; `uvicorn app.main:app` itself would use the real `data/`, so it was not run):
    - `INFO_ENABLED` unset: `„Pred cestou“ section on (info.yaml)` (repo `config/info.yaml` is enabled; production never leaves it unset because compose sets `false`).
    - `INFO_ENABLED=false`: `„Pred cestou“ section off (INFO_ENABLED)`.
    - `INFO_ENABLED=true`: `„Pred cestou“ section on (INFO_ENABLED)`.
    The line format matches the README and the manual item.

| # | Criterion | Result |
| --- | --- | --- |
| 1 | README sec. 4: optional fourth line `INFO_ENABLED=true`/`false`, missing = off, `up -d` with `--env-file` needed, restart keeps old value | PASS |
| 2 | README log check line `„Pred cestou“ section on/off (INFO_ENABLED)` and `docker compose logs cabin \| grep` | PASS (line verified above) |
| 3 | README keeps the `.env` warning and says it also overrides `INFO_ENABLED` | PASS |
| 4 | `.env.example` separates dev from a production block listing the 3 secrets and optional `INFO_ENABLED` | PASS |
| 5 | `compose.yaml` comment points to `/etc/cabin/secrets.env`, default still `${INFO_ENABLED:-false}` | PASS |
| 6 | `tests/manual.md` deployment item (no line = hidden; `true` + `up -d` = shown; log matches) | PASS |
| 7 | `uv run pytest` and `node --test tests/js/` pass | PASS |

Extra checks: no code changed in the diff (README, .env.example, compose.yaml comment, tests/manual.md only); production was not touched; no docker commands run.

Failures: none. Moved to `tasks/done/`. Nothing committed.
