# T-069: Production settings in the env file next to the secrets

- **Phase:** 1
- **Depends on:** none (blocked: start only when the organizer says go)
- **Size:** S

## Goal
Document that production switches such as `INFO_ENABLED` live in `/etc/cabin/secrets.env` together with the secrets, not in `compose.yaml` and not in a `.env` next to it ("Otvorené rozhodnutia", plan T-069). No code change.

## Scope
`README.md` (section 4, deployment), `.env.example`, `tests/manual.md`. Do not change `compose.yaml` beyond its comment (it keeps `INFO_ENABLED: ${INFO_ENABLED:-false}` as the safe default).

## Acceptance criteria
- [ ] README section 4: the `secrets.env` step lists the optional fourth line `INFO_ENABLED=true` (or `false`) and says the section stays off when the line is missing; changing it needs `docker compose --env-file /etc/cabin/secrets.env up -d` (a restart without the env file keeps the old value).
- [ ] README says how to check the result: the startup log line `„Pred cestou“ section on/off (INFO_ENABLED)` (`docker compose logs cabin | grep "Pred cestou"`).
- [ ] The README keeps the warning against a `.env` next to `compose.yaml` and explains that it would also override `INFO_ENABLED`.
- [ ] `.env.example` separates the local-development part from a short comment block "production: put these in /etc/cabin/secrets.env" listing the three secrets and the optional `INFO_ENABLED`.
- [ ] `compose.yaml` comment above `INFO_ENABLED` points to `/etc/cabin/secrets.env`.
- [ ] `tests/manual.md` has a deployment item: with no `INFO_ENABLED` line the board is hidden; with `INFO_ENABLED=true` and `up -d` it shows; the log line matches.
- [ ] `uv run pytest` and `node --test tests/js/` still pass.

## Notes for developer
Never run anything against production (votypka.sk). Only documentation changes. English text in README and comments.

---
## Dev log

## Review round 1

## Review round 2

## Test report
