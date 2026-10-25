# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## State of the repo

`proposal.md` (Slovak brief, the source of truth) plus input material. The backend is being built task by task (see `tasks/`). The repo uses git (branch `main`, remote `origin` = `git@github.com:lukasvotypka/cabin-sleepover.git`).

**The only input material is `files/mapa-nahlad.html`**, the approved pixel-map preview (vanilla JS, SVG 380×412). Its bed coordinates match the `config/cabin.yaml` example in the proposal. Reuse its `pos()` (figure positions by bed `kind`), `furn()` (furniture drawing), `sprite()` (adult and kid figures) and `room()` functions, plus the blink and reduced-motion CSS. It builds markup with `innerHTML` from fixed demo data, so rewrite the rendering to meet the `textContent` rule for anything from people. Treat `files/` as read-only reference (it is an export from the claude.ai conversation where the proposal was made). Never edit it or serve it.

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

Run one task per developer call. To keep the main session's context small, pass subagents only the task id (they read the task file themselves), do not paste their reports back into later prompts, and run `/compact` between tasks. Avoid needless send-backs: each `in-progress ↔ review` cycle costs the developer and the reviewer (opus) a full read again. Tasks whose dependencies are all in `done/` may run in parallel only if they touch different files. When a task fails review round 2, report it to the user instead of looping. Phase 2 tasks stay blocked until the organizer confirms. When all work is done, list the open decisions from `proposal.md` with the defaults used.

**Git:** only the orchestrator commits and pushes. Commit once per task when it reaches `done/`, staging only that task's files plus its task file, with the message `T-00x: <title>`. Agents never commit, but the reviewer and tester may use `git status` and `git diff` to see what changed since the last commit. When two tasks run in parallel, the diff contains both, so look at the files in the task's scope. After each task commit, the orchestrator pushes `main` to `origin` (organizer's decision of 23. 10. 2026); agents never push, and nothing is force-pushed. Never commit `.env` or `data/`.

**Trial server (restart after every task):** the organizer tries each change on a phone through Tailscale (`tailscale serve --https=8443` → `127.0.0.1:8010`, tailnet only). Once a task is committed and pushed, the orchestrator **restarts the trial server right away without asking** (organizer's instruction of 24. 10. 2026, replacing the ask-first rule of 23. 10.). This applies only to the trial server, never to production. To restart: kill whatever listens on port 8010, then from the repo root: `mkdir -p /tmp/cabin-try; set -a; . ./.env; set +a; nohup uv run python -c "import uvicorn; from app.main import create_app; uvicorn.run(create_app(data_dir='/tmp/cabin-try/data'), host='127.0.0.1', port=8010, workers=1, timeout_graceful_shutdown=3)" > /tmp/cabin-try/server.log 2>&1 &`, then check `/api/health`. Its data lives in `/tmp/cabin-try/data`, separate from the real `data/`. Agents never use or kill ports 8000 and 8010; they run their own servers on other free ports.

**Production (votypka.sk, never without being asked):** the real deploy — the Docker/compose stack behind Caddy that serves `votypka.sk` for the actual event — is a distinct, higher-stakes target from the local Tailscale trial server above. The orchestrator never builds, (re)deploys, restarts, or runs `docker compose`/Caddy commands against production on its own initiative, under any circumstance, including "the task is done" or "all tests pass" — only when the organizer explicitly asks for that specific deploy, each time (organizer's instruction of 23. 10. 2026).

## What this is

A small web app for assigning sleeping places at a cabin (chata) for the event 29. 10. (Thursday) – 1. 11. 2026 (Sunday) (three nights, ~8–10 parties, 13–18 people, 20 slots of which 2 are "tight"). Friends tap a pixel-art top-down map to pick who sleeps where each night. There are no accounts. Access is a shared group code, plus an admin code for the organizer. The people use it from a WhatsApp link on mobile.

## Hard constraints from the brief

- **Languages:** all UI text is **Slovak**, informal (tykanie), with typographic quotes „ “. This covers scene text, panels, user-facing messages, and room and bed names in `config/cabin.yaml`. Code, identifiers, comments, logs, startup/config errors, tests and README are **English**.
- **The server sends no Slovak text.** Errors carry a stable `code`, an English developer `message` and optional `params`. The page maps `code` (+ `params`) to Slovak messages in one lookup table in `static/js/logic-errors.js`, with a generic Slovak fallback for unknown codes.
- **Mobile first** (~380 px wide), then desktop.
- **Frontend has no build step and no framework**: plain HTML and CSS in `static/index.html` and the JS split into plain scripts in `static/js/` (`logic-*.js` pure logic, `app-*.js` DOM and requests), served by FastAPI (organizer's decision of 24. 10. 2026). No ES modules and no bundler: the scripts share one global scope and load in the order of the `<script>` tags in `index.html`, logic first, `app-start.js` last. **Every script URL ends in `?v=__ASSET_VERSION__`**, which `GET /` replaces with a hash of the release version, `index.html` and `static/js/*.js` (`PageRenderer` in `app/main.py`), so browsers never run stale code and every release shows the „Nová verzia“ sign. When adding a script, list it in `index.html` with that query, and keep new logic in `logic-*.js` so Node can test it.
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
- `app/events.py`: the in-memory hub of the live event streams (`GET /api/events`, SSE): coalescing per connection, caps (4 per client, 200 total), pings, presence by open stream. Another reason the app must stay one process.
- `app/seen.py`: last seen per party (`data/seen.yaml`) and the online list.
- `app/llm.py`: phase 2 only. Forced tool `propose_signup` (schema generated from Pydantic), with a swappable client for tests.
- `config/cabin.yaml`: event, nights, and the full layout (rooms, beds, slots, SVG coordinates for viewBox 380×496, plus the `houses` list that groups rooms under roofs). Written by the organizer and sent to the page inside `/api/state`, so the map and the validation share one source. The layout is a guess from a preview, so keep it data-driven and never hardcode geometry in code. Bed `kind` (`bed2`, `bunk`, `mats`, `sofa`, `sofa1`, `stove`, `bed1`, `cot`) determines figure placement.
- `config/app.yaml`: limits, model name, `backups_keep`.
- `data/` (git-ignored, created on first start): `cabin-data.yaml`, `seen.yaml` (last seen per party), `audit.yaml` (one YAML document per write, separated by `---`), `backups/`. `data/` must never be served statically.
- `Dockerfile`, `compose.yaml`: the deploy (organizer decision of 22. 10. 2026: Docker instead of systemd). Inside the container uvicorn listens on `0.0.0.0:8010`; compose publishes it only on host `127.0.0.1:8010`, passes the secrets as environment variables (no `.env`), mounts `./data` read-write and `./config` read-only. `deploy/Caddyfile` is the proxy example. `tests/manual.md` is the manual checklist.

### Data model essentials

- A night is identified by its start date (`2026-10-29` = Thu→Fri; nights are 2026-10-29, 2026-10-30, 2026-10-31). `sleeping` is `night → slot → party_id`, so double-booking is impossible by structure, and a free slot is simply absent.
- Party `id` is `p-` plus 6 random chars. The name is case-insensitively unique and can be renamed without touching `sleeping`. The server assigns the color from the 12-color palette listed in the proposal's "Vzhľad" section unless the request carries its own `color` (T-031, organizer's decision of 24. 10. 2026: chosen on create, overridable on edit; free hex colors allowed, but the server rejects ones too light or too dark with `invalid` and a reason in `params`).
- Needed slots per night = `adults + kids − kids_in_parents_bed`. A party is present on night *n* if `arrive ≤ n < leave`.
- Dates and times in YAML must be **quoted strings** so PyYAML does not parse them into `date` objects.

### Write path and file safety

Every write action runs under the one lock: load current state → validate via `validate.py` → write → bump `version` → append audit → return `{ok, state}`. Writes are atomic: temp file in the same directory, `fsync`, `os.replace`. A timestamped backup goes to `data/backups/` before each write (keep the last `backups_keep`, 5000 in `config/app.yaml`). Use `yaml.safe_load` and `safe_dump(allow_unicode=True, sort_keys=False)` only. At startup, validate the data file with the Pydantic models and against `cabin.yaml` (unknown slot, party or night; duplicate slot IDs). On error, refuse to start with a precise message. A missing or empty file is created.

### API conventions

Success is `200 {"ok": true, "state": {...}}`. Errors are `{"ok": false, "error": {"code", "message"}, "state": {...}}` with an English developer `message` and optional `params` (e.g. `night`, `party_name`); the page never shows `message` and builds the Slovak text from `code`. Codes: `bad_code` 401, `forbidden` 403, `signup_closed` 403, `slot_taken` 409, `not_present` 409, `duplicate_name` 409, `unknown_slot` 404, `unknown_party` 404, `invalid` 422, `rate_limited` 429. Everything except `/`, static files, `/api/health` and `/api/join` needs the signed group cookie (itsdangerous with `SECRET_KEY`; HttpOnly, Secure, SameSite=Lax; group 30 days, admin 12 h). Admin endpoints need the admin cookie. Codes are compared with `secrets.compare_digest`. The page sends an `X-Client-Id` header (random ID in `localStorage`) for audit and limits. `GET /api/state` supports `ETag` by `version` plus the presence data (304). The page sends the party chosen in „Si: …“ as `X-Party-Id`; the server records its last seen time in `data/seen.yaml` (`app/seen.py`, throttled, no `version` bump, backup or audit) and returns `state.presence`. Online = an open event stream, or a plain request within 75 s for a polling page. `GET /api/events?party=…&client=…` (SSE; `EventSource` cannot send headers) sends `event: state` at once and after every committed write (hooked into the store commit), `event: presence` when the online set changes, and `event: ping` every 20 s. uvicorn must run with `timeout_graceful_shutdown=3` (`--timeout-graceful-shutdown 3`), otherwise open streams hang a restart. When signup is locked, writes return `signup_closed` unless the admin cookie is present. The full endpoint table is in `proposal.md`.

### Frontend behaviour worth knowing

- **The whole app is one page, and that page is the pixel map.** Event title and dates, the three night signposts with occupancy, the party table and the locked-signup sign are drawn inside the SVG scene (positions in `config/cabin.yaml` under `map.scene`, content from `/api/state`). The „?“ icon in the scene opens „Návod“ (the four steps) as a centred window. The party table has two parts, „Noc“ (a row per party, a column per night) and „Cez deň“ (day-only visits, with the „spolu na jedlo“ row). „Si: …“ with the age of the data and the status sign of my party (missing, fewer, extra, ok) are a fixed bottom HUD in HTML outside the SVG, so they stay put while the map is panned or zoomed; the scene is fitted above it. Once per page load, after the splash is gone, the map starts 2× zoomed on the top of the scene and eases out to the fitted view over 2.8 s (`introStartView`/`introViewAt`, `app-zoom.js`) to show that the map can be moved; a touch, wheel or key on the map, a resize or the move mode stops it where it is, an opened panel does not (a new visitor sees it zoom out behind the semi-transparent backdrop of the automatic „Kto si?“), and with `prefers-reduced-motion` it does not run (organizer's decision of 24. 10. 2026). There is no separate header, list view or overview page. Party form, „Kto si?“, the WhatsApp summary text and the admin controls open as panels over the map. A visually hidden text summary serves screen readers.
- The map is SVG with `shape-rendering="crispEdges"`. The scene uses fixed colors and is not inverted in dark mode. Panels follow the light/dark colors in the proposal's "Vzhľad" section.
- Live updates over SSE (`static/js/app-live.js`, pure parts in `logic-live.js`, organizer's decision of 25. 10. 2026): the page loads `/api/state` once, then keeps an `EventSource` open while the tab is visible (closed at once when hidden or on `pagehide`, since iOS freezes hidden pages; the server keeps the party online for `STREAM_GRACE` = 10 s after its last stream closed, reopened on return or reconnect, reopened when silent for 45 s). States apply only if their `version` is not older than the shown one. If the stream cannot deliver for 60 s, the page falls back to polling `/api/state` every 30 s (10 s timeout) and retries the stream every 3 min. Under „Si: …“ the HUD shows the online parties as shirt-letter chips, or „aktualizované pred …“ only when there is a problem. Updates are optimistic ("ukladám", semi-transparent) and roll back to server state with the server's reason on rejection.
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
- Manual: `tests/manual.md` (deployment, two devices at once, iPhone Safari, Android Chrome).
