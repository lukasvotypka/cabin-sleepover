# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## State of the repo

`proposal.md` (Slovak brief, the source of truth) plus input material. The backend is being built task by task (see `tasks/`). The repo uses git (branch `main`, remote `origin` = `git@github.com:lukasvotypka/cabin-sleepover.git`).

**The only input material is `files/mapa-nahlad.html`**, the approved pixel-map preview (vanilla JS, SVG 380×412). Its bed coordinates match the `config/chata.yaml` example in the proposal. Reuse its `pos()` (figure positions by bed `kind`), `furn()` (furniture drawing), `sprite()` (adult and kid figures) and `room()` functions, plus the blink and reduced-motion CSS. It builds markup with `innerHTML` from fixed demo data, so rewrite the rendering to meet the `textContent` rule for anything from people. Treat `files/` as read-only reference (it is an export from the claude.ai conversation where the proposal was made). Never edit it or serve it.

The old overview page and spreadsheet are gone and not needed. The proposal's "Vzhľad" section now contains the theme colors, fonts and the 12-color party palette.

## Python tooling: uv only

Python 3.12 and all dependencies are managed with **uv**. Do not use pip, `requirements.txt` or hand-made venvs.

- Pin the Python version with `uv python pin 3.12` (writes `.python-version`).
- Add runtime deps with `uv add <pkg>` and dev deps (pytest, httpx) with `uv add --dev <pkg>`. They are declared in `pyproject.toml` and locked in `uv.lock`, which stays in the repo.
- Install with `uv sync` and run everything through `uv run`, e.g. `uv run pytest`, `uv run pytest tests/test_validate.py::test_name`, `uv run uvicorn app.main:app --host 127.0.0.1 --port 8010`.
- The Node tests of the page logic need no uv: `node --test tests/js/`.

## Development workflow (agents and task board)

Work is organized as a kanban board in `tasks/` (`todo`, `in-progress`, `review`, `testing`, `done`). A task's folder is its status, and the format is in `tasks/README.md`. Five project subagents in `.claude/agents/` own the stages:

| Agent | Model | Role |
| --- | --- | --- |
| `product-owner` | opus | Sets priorities and scope on the board, follows the organizer's requests, moves phase 2 items; does not code |
| `analyst` | opus | Reads `proposal.md`, writes ordered tasks into `tasks/todo/` |
| `developer` | sonnet | Takes one task at a time (fixes first): `todo → in-progress → review` |
| `reviewer` | opus | Two review rounds: `review → in-progress` (changes) or `→ testing` (approved) |
| `tester` | haiku | Verifies acceptance criteria: `testing → done` or back to `in-progress` |

Subagents cannot launch each other, so the **main session is the orchestrator**. Loop: run `analyst` once, then repeat until `todo`, `in-progress`, `review` and `testing` are empty:

1. Anything in `testing/` → `tester`.
2. Anything in `review/` → `reviewer`.
3. Anything in `in-progress/` → `developer` (fix it).
4. Otherwise a ready task in `todo/` → `developer`.

Run one task per developer call. Tasks whose dependencies are all in `done/` may run in parallel only if they touch different files. When a task fails review round 2, report it to the user instead of looping. Phase 2 tasks stay blocked until the organizer confirms. When all work is done, list the open decisions from `proposal.md` with the defaults used.

**Git:** only the orchestrator commits and pushes. Commit once per task when it reaches `done/`, staging only that task's files plus its task file, with the message `T-00x: <title>`. Agents never commit, but the reviewer and tester may use `git status` and `git diff` to see what changed since the last commit. When two tasks run in parallel, the diff contains both, so look at the files in the task's scope. After each task commit, the orchestrator pushes `main` to `origin` (organizer's decision of 23. 10. 2026); agents never push, and nothing is force-pushed. Never commit `.env` or `data/`.

**Trial server (restart after every task):** the organizer tries each change on a phone through Tailscale (`tailscale serve --https=8443` → `127.0.0.1:8010`, tailnet only). After each task is committed, the orchestrator restarts that server and tells the organizer. Kill whatever listens on port 8010, then from the repo root: `set -a; . ./.env; set +a; nohup uv run python -c "import uvicorn; from app.main import create_app; uvicorn.run(create_app(data_dir='/tmp/chata-try/data'), host='127.0.0.1', port=8010, workers=1)" > /tmp/chata-try/server.log 2>&1 &`, then check `/api/health`. Its data lives in `/tmp/chata-try/data`, separate from the real `data/`. Agents never use or kill ports 8000 and 8010; they run their own servers on other free ports.

## What this is

A small web app for assigning sleeping places at a cabin (chata) for the event 29. 10. (Thursday) – 1. 11. 2026 (Sunday) (three nights, ~8–10 parties, 13–18 people, 20 slots of which 2 are "tight"). Friends tap a pixel-art top-down map to pick who sleeps where each night. There are no accounts. Access is a shared group code, plus an admin code for the organizer. The people use it from a WhatsApp link on mobile.

## Hard constraints from the brief

- **Languages:** all UI text is **Slovak**, informal (tykanie), with typographic quotes „ “. This covers scene text, panels, user-facing messages, and room and bed names in `config/chata.yaml`. Code, identifiers, comments, logs, startup/config errors, tests and README are **English**.
- **The server sends no Slovak text.** Errors carry a stable `code`, an English developer `message` and optional `params`. The page maps `code` (+ `params`) to Slovak messages in one lookup table in `static/index.html`, with a generic Slovak fallback for unknown codes.
- **Mobile first** (~380 px wide), then desktop.
- **Frontend has no build step and no framework**: plain HTML, CSS and JS in a single `static/index.html`, served by FastAPI.
- Pixel art is custom, in an old top-down RPG style. Use **no characters, art or names from Pokémon or other games**.
- Backend is **FastAPI + Pydantic v2 + PyYAML + uvicorn, Python 3.12**. **No database and no external services**, except the optional Claude API in phase 2.
- Phase 1 is no-AI and has no admin tools. Phase 2 (admin tools: signup lock, export, delete party, key icon and panel, task T-009; and free-text signup via Claude API) is optional and **not to be built until the organizer confirms** after trying phase 1.
- Section "Otvorené rozhodnutia" in `proposal.md` lists open decisions. Do not decide them yourself. Use the stated defaults and list them for the organizer at the end of the work.

## Planned architecture

Single uvicorn process with **one worker**, bound to `127.0.0.1` (default port 8010) behind a Caddy/nginx HTTPS proxy. Single-process is a correctness requirement. The `asyncio.Lock`, rate limits and phase-2 conversations all live in process memory.

- `app/main.py`: routes, cookies, serving `static/`.
- `app/store.py`: YAML read and atomic write, the lock, `version`, backups, audit.
- `app/models.py`: Pydantic models (`Party`, `Slot`, `State`, action requests).
- `app/validate.py`: **pure functions** that check writes (free slot, presence, move, stay shortening). They are the only place rules live. The server always re-checks, and the page may pre-check only for speed.
- `app/ratelimit.py`: in-memory limits (30 writes/min per client, 10 code attempts/min per IP).
- `app/llm.py`: phase 2 only. Forced tool `navrh_zapisu` (schema generated from Pydantic), with a swappable client for tests.
- `config/chata.yaml`: event, nights, and the full layout (rooms, beds, slots, SVG coordinates for viewBox 380×412). Written by the organizer and sent to the page inside `/api/state`, so the map and the validation share one source. The layout is a guess from a preview, so keep it data-driven and never hardcode geometry in code. Bed `kind` (`bed2`, `bunk`, `mats`, `sofa`, `sofa1`, `stove`, `bed1`, `cot`) determines figure placement.
- `config/app.yaml`: limits, model name, `backups_keep`.
- `data/` (git-ignored, created on first start): `chata-data.yaml`, `audit.yaml` (one YAML document per write, separated by `---`), `backups/`. `data/` must never be served statically.
- `Dockerfile`, `compose.yaml`: the deploy (organizer decision of 22. 10. 2026: Docker instead of systemd). Inside the container uvicorn listens on `0.0.0.0:8010`; compose publishes it only on host `127.0.0.1:8010`, passes the secrets as environment variables (no `.env`), mounts `./data` read-write and `./config` read-only. `deploy/Caddyfile` is the proxy example. `tests/manualne.md` is the manual checklist.

### Data model essentials

- A night is identified by its start date (`2026-10-29` = Thu→Fri; nights are 2026-10-29, 2026-10-30, 2026-10-31). `sleeping` is `night → slot → party_id`, so double-booking is impossible by structure, and a free slot is simply absent.
- Party `id` is `p-` plus 6 random chars. The name is case-insensitively unique and can be renamed without touching `sleeping`. The server assigns the color from the 12-color palette listed in the proposal's "Vzhľad" section.
- Needed slots per night = `adults + kids − kids_in_parents_bed`. A party is present on night *n* if `arrive ≤ n < leave`.
- Dates and times in YAML must be **quoted strings** so PyYAML does not parse them into `date` objects.

### Write path and file safety

Every write action runs under the one lock: load current state → validate via `validate.py` → write → bump `version` → append audit → return `{ok, state}`. Writes are atomic: temp file in the same directory, `fsync`, `os.replace`. A timestamped backup goes to `data/backups/` before each write (keep the last 50). Use `yaml.safe_load` and `safe_dump(allow_unicode=True, sort_keys=False)` only. At startup, validate the data file with the Pydantic models and against `chata.yaml` (unknown slot, party or night; duplicate slot IDs). On error, refuse to start with a precise message. A missing or empty file is created.

### API conventions

Success is `200 {"ok": true, "state": {...}}`. Errors are `{"ok": false, "error": {"code", "message"}, "state": {...}}` with an English developer `message` and optional `params` (e.g. `night`, `party_name`); the page never shows `message` and builds the Slovak text from `code`. Codes: `bad_code` 401, `forbidden` 403, `signup_closed` 403, `slot_taken` 409, `not_present` 409, `duplicate_name` 409, `unknown_slot` 404, `unknown_party` 404, `invalid` 422, `rate_limited` 429. Everything except `/`, static files, `/api/health` and `/api/join` needs the signed group cookie (itsdangerous with `SECRET_KEY`; HttpOnly, Secure, SameSite=Lax; group 30 days, admin 12 h). Admin endpoints need the admin cookie. Codes are compared with `secrets.compare_digest`. The page sends an `X-Client-Id` header (random ID in `localStorage`) for audit and limits. `GET /api/state` supports `ETag` by `version` (304). When signup is locked, writes return `signup_closed` unless the admin cookie is present. The full endpoint table is in `proposal.md`.

### Frontend behaviour worth knowing

- **The whole app is one page, and that page is the pixel map.** Event title and dates, the three night signposts with occupancy, the instruction noticeboard, my-party status and warning, and the locked-signup sign are drawn inside the SVG scene (positions in `config/chata.yaml` under `map.scene`, content from `/api/state`). There is no separate header, list view or overview page. Party form, „Kto si?“, the WhatsApp summary text and the admin controls open as panels over the map. A visually hidden text summary serves screen readers.
- The map is SVG with `shape-rendering="crispEdges"`. The scene uses fixed colors and is not inverted in dark mode. Panels follow the light/dark colors in the proposal's "Vzhľad" section.
- Polling `/api/state` every 30 s while the tab is visible, on tab return, and after every write. Updates are optimistic ("ukladám", semi-transparent) and roll back to server state with the server's reason on rejection.
- All human-provided text goes in via `textContent`, **never `innerHTML`**.
- Beds are focusable `role="button"` elements with screen-reader labels. Respect `prefers-reduced-motion`. Touch targets are at least 44 px.
- Page logic (presence, needed slots, warnings, WhatsApp "Prehľad na poslanie" text, figure positions) is in **separate pure functions** so it can be tested in Node without a browser.
- If the app might run under a sub-path, use relative API paths.

## Secrets

`GROUP_CODE`, `ADMIN_CODE`, `SECRET_KEY` and optionally `ANTHROPIC_API_KEY` are environment variables. For local development they come from `.env` (git-ignored; `.env.example` is committed). In Docker there is no `.env`: `compose.yaml` passes them as environment variables supplied by whoever deploys it. The API key must never appear on the page, in YAML or in the repo. Without it, phase 2 is disabled and its input is hidden.

## Testing (as specified)

- Backend: pytest with `httpx.AsyncClient` against the app and a temporary `data/` directory. It must cover `validate.py` rules, atomic write and backups, concurrent `assign` to the same slot via `asyncio.gather` (exactly one succeeds), cookies and rate limits.
- Page logic: Node tests of the pure functions, with no browser.
- Phase 2: `llm.py` tested with a fake client, never the real API. A separate set of 15 sample Slovak messages is for manual checks with the real model.
- Manual: `tests/manualne.md` (deployment, two devices at once, iPhone Safari, Android Chrome).
