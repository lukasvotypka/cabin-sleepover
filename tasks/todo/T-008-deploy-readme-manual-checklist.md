# T-008: Deploy files, English README and manual checklist

- **Phase:** 1
- **Depends on:** T-004
- **Size:** S

## Goal
Let the organizer install and run the app on a clean server under systemd behind Caddy with HTTPS, back it up and fix data by hand. Add the manual checklist for what automated tests cannot cover. Proposal sections: „Výstupy a podklady“ (`deploy/`, `README.md`), „Bezpečnosť a limity“, „Akceptačné kritériá a testovanie“ (Fáza 1, Ručný kontrolný zoznam).

## Scope
- `deploy/chata.service` (systemd unit), `deploy/Caddyfile` (example)
- `README.md` (English)
- `tests/manualne.md`

## Acceptance criteria
- [ ] The systemd unit:
  - [ ] runs under its own user, with `WorkingDirectory` set to the app
  - [ ] loads `EnvironmentFile=` from `.env`
  - [ ] runs `uv run --frozen uvicorn app.main:app --host 127.0.0.1 --port 8010 --workers 1 --proxy-headers --forwarded-allow-ips=127.0.0.1`
  - [ ] restarts on failure
  - [ ] can write only to `data/` (`ReadWritePaths=` plus a read-only system, e.g. `ProtectSystem=strict`)
- [ ] The Caddyfile example serves HTTPS for a (sub)domain with `reverse_proxy 127.0.0.1:8010`. A short comment shows the nginx equivalent (proposal allows Caddy or nginx).
- [ ] README in English (casual, friendly) covers:
  - [ ] installation with uv on Python 3.12 (`uv sync --frozen --no-dev`; uv itself installed by the official installer, which also fetches Python 3.12)
  - [ ] filling in `.env` from `.env.example`, including how to generate `SECRET_KEY`
  - [ ] a local run (`uv run uvicorn ... --env-file .env`) and running the tests (`uv run pytest`, `node --test tests/js/`)
  - [ ] deployment with systemd and Caddy
  - [ ] where the data lives and that `data/` is never served
  - [ ] backup by copying `data/`
  - [ ] restoring from `data/backups/`
  - [ ] fixing data by hand only while the service is stopped, then a restart that runs the startup check
  - [ ] editing `config/chata.yaml` and restarting when the map does not match reality
  - [ ] reading `audit.yaml` to trace a change
- [ ] README lists the open decisions from `proposal.md` with the defaults used. It also points to `tasks/QUESTIONS.md`.
- [ ] `tests/manualne.md` is a checklist with one item for each phase-1 acceptance criterion that needs a human, among them:
  - [ ] a clean-server deploy following the README
  - [ ] HTTPS works
  - [ ] the group code works
  - [ ] two devices tap the same free slot at once (one wins, the other sees who has it and the map is correct again)
  - [ ] a change appears on a second device within 30 s
  - [ ] a couple fills a double bed with one tap, and two people taking overlapping places at once never leaves half a booking
  - [ ] the amber note appears when a party holds more places than it needs
  - [ ] pinch-zoom works on iPhone and Android
  - [ ] move for one night and for all nights
  - [ ] stay shortening with the advance warning
  - [ ] restart keeps the data
  - [ ] a corrupted YAML prevents start with a clear message
  - [ ] the audit entry and backup are created
  - [ ] iPhone Safari, Android Chrome and desktop, each in light and dark mode
  - [ ] reduced motion stops the blinking
  - [ ] the date, the night signposts with occupancy, the noticeboard and my-party warning are drawn in the scene from `/api/state`
  - [ ] every visible text (scene, panels, error messages) is Slovak and informal, and no English server `message` ever shows up on the page
  - [ ] signposts, signs and icons are easy to hit on a phone (44 px, see `tasks/QUESTIONS.md` Q9)
  - [ ] a screen reader (VoiceOver, TalkBack) reads the bed labels and the hidden summary
  - [ ] „Prehľad na poslanie“ and the hidden summary match the map
  - [ ] `/data/…` and `/.env` are not reachable

## Notes for developer
- `--workers 1` is a correctness requirement (the lock and the rate limits live in process memory). Say so in the README.
- `--proxy-headers --forwarded-allow-ips=127.0.0.1` is required, or every client looks like `127.0.0.1` and one person's wrong codes lock everyone out of joining.
- `uvicorn --env-file` needs `python-dotenv`. Either list it as a dependency or tell the reader to export the variables. Do not add a dotenv loader to the app.
- Open decision „Umiestnenie na serveri“: the default is `127.0.0.1:8010` at the root of its own (sub)domain. Mention that a sub-path works because the page uses relative API paths.
- Phase 2 and `ANTHROPIC_API_KEY` are out of scope. Do not document them as available.
- Use uv everywhere (see `CLAUDE.md`, "Python tooling: uv only"). No pip or requirements.txt in the README or the systemd unit. The unit must call uv by absolute path (e.g. `/usr/local/bin/uv` or the service user's `~/.local/bin/uv`), because systemd has no login PATH.
- From T-002 testing, add to `tests/manualne.md`: `data/` is writable by the service user on the real host; a backup restore drill (stop service, copy backup, start, check); a corrupt data file stops the service with the English error visible in `journalctl`; the server has tz data for `Europe/Bratislava`.
- `tests/manualne.md` already exists (created during T-003 testing). Extend it, do not overwrite it.
- From T-003 testing: uvicorn trusts `X-Forwarded-For` from loopback, so the per-IP join limit follows that header. The Caddy config must set (overwrite) `X-Forwarded-For` with the real client IP, and uvicorn must stay bound to `127.0.0.1`.
- From T-003 review: do not add a root handler via a uvicorn `--log-config`, or app log lines print twice.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
