# Cabin sleepover: who sleeps where

A small web app for sorting out sleeping places at the cabin for the event 29. 10. – 1. 11. 2026 (three nights). Friends open a link from WhatsApp, enter a shared group code and tap a pixel-art map of the cabin to say who sleeps where each night. There are no accounts and no database: everything lives in a few readable YAML files, so you can back them up by copying and fix them in an editor if you ever have to.

The page itself is Slovak (informal), this README and all code are English.

Stack: FastAPI, Pydantic v2, PyYAML, uvicorn (Python 3.12), managed with [uv](https://docs.astral.sh/uv/). The frontend is plain HTML, CSS and JavaScript with no build step: `static/index.html` plus the scripts in `static/js/`.

Where things are:

| Path | What it is |
| --- | --- |
| `app/` | the backend (`main.py` routes, `store.py` YAML storage, `validate.py` all the rules, ...) |
| `static/index.html` | the page shell (markup and CSS); it loads the scripts below |
| `static/js/` | the page code as plain scripts: `logic-*.js` (pure logic, tested in Node) and `app-*.js` (DOM, drawing, requests); load order is the order of the `<script>` tags in `index.html` |
| `config/cabin.yaml` | event dates, nights and the cabin layout (rooms, beds, slots, map coordinates) |
| `config/app.yaml` | limits and `backups_keep` |
| `data/` | the live data, created on first start, never committed, never served |
| `Dockerfile`, `compose.yaml` | the Docker image and its one-service compose file |
| `deploy/` | Caddy example (with the nginx equivalent) |
| `tests/` | pytest, Node tests of the page logic, and the manual checklist `tests/manual.md` |

## 1. Install (for development and local runs)

On a server you normally skip sections 1 and 3 and go straight to the Docker deployment in section 4 (the image installs everything itself). For working on the code you need a machine with `curl` and git. Python 3.12 comes with uv, you do not install it yourself.

Install uv with the official installer. It also fetches Python 3.12 on demand:

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then, in the project directory:

```sh
uv sync --frozen --no-dev      # runtime dependencies only (what the Docker image installs)
uv sync --frozen               # development: adds pytest and httpx
```

`uv` reads `.python-version` (3.12) and `uv.lock`, so everyone gets the same versions. Please use uv for everything (no pip, no `requirements.txt`).

## 2. Configure the secrets for local development (`.env`)

This `.env` file is only for running the app on your own machine (section 3). The Docker deployment does not use it, see section 4.

```sh
cp .env.example .env
```

Fill in `.env` (it is git-ignored, never commit it):

| Variable | Meaning |
| --- | --- |
| `GROUP_CODE` | the code you send to friends in WhatsApp |
| `ADMIN_CODE` | the organizer's code, it must differ from `GROUP_CODE` |
| `SECRET_KEY` | signs the cookies, at least 32 characters |

Generate a good `SECRET_KEY` with:

```sh
uv run python -c "import secrets; print(secrets.token_urlsafe(48))"
```

If a variable is missing or `SECRET_KEY` is too short, the app refuses to start and says exactly what is wrong. Changing `GROUP_CODE` and restarting logs everybody out (they have to enter the new code again).

## 3. Run it locally

```sh
uv run uvicorn app.main:app --host 127.0.0.1 --port 8010 --env-file .env
```

and open <http://127.0.0.1:8010/>. (`--env-file` works because `python-dotenv` is installed as a dependency; the app itself never reads `.env`.) Note that the join cookie is `Secure`, so a plain `http://` page may not keep it in every browser. Chrome and Firefox accept it on `localhost`, Safari does not, so test on a phone through the HTTPS deployment.

Run the tests (they use temporary data directories and never touch `data/`):

```sh
uv run pytest                  # backend
node --test tests/js/          # page logic, no browser, no uv needed
```

What the tests cannot cover (two phones at once, iPhone Safari, the real deployment, ...) is in `tests/manual.md`.

## 4. Deploy with Docker and Caddy

The app runs as one Docker container (`Dockerfile`, `compose.yaml`), and Caddy in front of it gives you HTTPS. The examples assume the project in `/opt/chrapa-poll` and a domain `cabin.example.com`. You need Docker Engine 28 or newer with the compose plugin on the server (install it from Docker's official packages). Older engines on Linux let other machines on the same local network reach ports published on `127.0.0.1`, and because the app trusts the forwarded client address, such a machine could get around the wrong-code limit.

What you get: the image is built from the official `python:3.12-slim` with the locked dependencies installed by uv (`uv sync --frozen --no-dev`). The container runs as a non-root user with a read-only root filesystem, and only `data/` (read-write) and `config/` (read-only) are mounted from the project directory. The image holds no secrets, no data and no tests. The secrets are given to the container as environment variables when it starts (there is no `.env` in a Docker deployment).

**Important:** the container runs exactly **one** uvicorn worker (`--workers 1`, set in the `Dockerfile`, do not raise it). The write lock and the rate limits live in the memory of that one process. Two workers would break the "one winner per slot" guarantee.

1. Copy the project to the server (git clone, or rsync without `data/`, `.env` and `.venv/`; if a `.env` exists, delete it, see step 2):

   ```sh
   git clone <your repository> /opt/chrapa-poll
   cd /opt/chrapa-poll
   ```

2. Prepare the secrets and the data directory.

   The container needs three environment variables: `GROUP_CODE`, `ADMIN_CODE` (different from the group code) and `SECRET_KEY` (at least 32 characters, see section 2 for how to generate one). `compose.yaml` refuses to run if one is missing. How you supply them is up to you: export them in the shell, or let your hosting platform or secrets manager set them. A simple way on one server is a root-only file **outside** the project, given to compose with `--env-file`:

   ```sh
   sudo install -d -m 700 /etc/cabin
   sudo nano /etc/cabin/secrets.env      # three lines: GROUP_CODE=..., ADMIN_CODE=..., SECRET_KEY=...
   sudo chmod 600 /etc/cabin/secrets.env
   ```

   Then run every compose command as `sudo docker compose --env-file /etc/cabin/secrets.env ...` (`sudo` because the file is readable by root only; if you prefer, make the file owned by the deploying user instead) (the examples below show the plain `docker compose ...` for short; add the option, or export the variables first, for `up`, `down` and `config`; `stop`, `start` and `restart` work without them).

   Do **not** keep a file called `.env` next to `compose.yaml` on the server. Compose reads such a file automatically to fill in `${...}` values, so it would silently supply (or override) the secrets, and it would leave them in the project directory. `--env-file` replaces that default, so an old `.env` is ignored, but the cleanest server has none.

   Then create the data directory:

   ```sh
   mkdir -p data
   sudo chown 1000:1000 data         # the container user (UID 1000) must be able to write here
   ```

   Create `data/` yourself, as above: if Docker creates it, it belongs to root and the app cannot write to it. If the owner of `data/` has another UID, run the container as that user instead by setting `CABIN_UID` and `CABIN_GID` next to the secrets (in the same secrets file or exported).

3. Build and start:

   ```sh
   docker compose up -d --build
   docker compose ps                 # should say "healthy" after a few seconds
   docker compose logs -f            # the app log, also the reason if it refuses to start
   curl -s http://127.0.0.1:8010/api/health   # {"ok":true,"version":"..."}: must show the version you just released
   ```

   The container restarts after a crash and after a reboot (`restart: unless-stopped`). It does not help when the config or the data file is broken: the app refuses to start with an English message in `docker compose logs`, and Docker keeps retrying until you fix the file (see "Fix the data by hand").

4. **To update:** `git pull`, then `docker compose up -d --build`. Your data is not touched.

   **To change or rotate a secret:** change it where you keep it (the secrets file, your export, the platform), then run `docker compose up -d`, which recreates the container with the new values. A plain `docker compose restart` does **not** pick up new values. Changing `GROUP_CODE` logs everybody out (they enter the new code), changing `SECRET_KEY` does the same for all cookies, and the data is not affected.

5. Put Caddy in front for HTTPS (install Caddy from its official packages first). Put the contents of `deploy/Caddyfile` into `/etc/caddy/Caddyfile` with your domain, then `sudo systemctl reload caddy`. Caddy fetches the certificate by itself. The file also has a short nginx equivalent in a comment.

   Two settings work together, and both are needed. Caddy **overwrites** `X-Forwarded-For` with the real client IP, and uvicorn runs with `--proxy-headers`, so the wrong-code limit counts per real client. Without that every client would look the same and one person's wrong codes would lock everybody out of joining. Inside Docker the requests come from the bridge gateway, not from `127.0.0.1`, so uvicorn has to trust `X-Forwarded-For` from any address (`--forwarded-allow-ips=*`). That is safe only because `compose.yaml` publishes the port on the host's `127.0.0.1` only (`127.0.0.1:8010:8010`). **Never publish it as `8010:8010`**, because then anyone on the internet could fake the header.

6. Open `https://cabin.example.com/`, enter the group code, and send the link and the code to your friends.

The page uses relative paths for the API, so it also works under a sub-path such as `https://example.com/cabin/` (see the comment in `deploy/Caddyfile`). The default is the root of its own (sub)domain.

### Live updates

The page opens one `EventSource` on `GET /api/events` (needs the group cookie) and gets the full state as an `event: state` frame after every write, within about a second. The same stream carries who is online (`event: presence`) and an `event: ping` every 20 s as a keep-alive. If the stream cannot be opened or breaks, the page polls `/api/state` every 30 s (with `ETag`) and reconnects by itself.

- **One worker is required.** The event hub lives in the memory of the single uvicorn process, like the write lock. With more workers a change would reach only the pages connected to the same worker.
- **Proxies must not buffer or compress the stream.** Caddy flushes `text/event-stream` at once, so the example needs nothing. For nginx use the `location /api/events` block in `deploy/Caddyfile` (`proxy_buffering off;`, `proxy_read_timeout 1h;`). Do not apply `encode` to `/api/events`.
- **Tailscale serve works as is** (`tailscale serve --https=8443 http://127.0.0.1:8010`).
- **Shutdown:** an event stream never ends by itself, so uvicorn would wait for it forever. uvicorn therefore runs with `--timeout-graceful-shutdown 3` (in the `Dockerfile`; use the same flag when starting uvicorn by hand): it waits at most about 3 s for open requests, then cancels the remaining streams, and only after that the app closes its event hub in the lifespan shutdown. `docker compose stop` and `restart` therefore do not hang, and the pages reconnect when the server is back.
- **Check it:** `curl -N -H 'Cookie: <group cookie>' https://cabin.example.com/api/events` prints `event: state` at once and `event: ping` every 20 s.

## 5. Where the data lives

Everything is in `data/` next to the app (git-ignored, created on first start, and **never served over HTTP**; a test checks that `/data/...` and `/.env` give 404):

| File | What it holds |
| --- | --- |
| `data/cabin-data.yaml` | the parties and who sleeps where: the live data, with a `version` counter |
| `data/audit.yaml` | one YAML document per write, separated by `---`: time, version, action, source, anonymous client id, party, nights, slots, before and after |
| `data/seen.yaml` | when each party was last seen (`party id: time`), written at most once a minute per party; losing it only forgets who was online. On the first start without it, each party gets the time of its `party-create` audit entry; `uv run python -m app.seen seed data` fills in parties without a time later (server stopped) |
| `data/backups/` | a copy of the data file taken before every write, named `cabin-data-<UTC time>-v<version>.yaml`; the last 50 are kept (`backups_keep` in `config/app.yaml`) |

Every write is atomic (temp file, `fsync`, rename), so a crash cannot leave a half-written file.

### Back up

Copy the directory:

```sh
sudo cp -a /opt/chrapa-poll/data /root/cabin-data-backup-$(date +%F)   # while the container runs is fine
```

It is plain files, so rsync, a cron job or a snapshot work equally well.

### Restore from `data/backups/`

1. `cd /opt/chrapa-poll && docker compose stop`
2. Pick a backup (the newest file name is the latest state before the last write) and copy it over the data file:

   ```sh
   cd /opt/chrapa-poll/data
   sudo cp backups/cabin-data-<time>-v<version>.yaml cabin-data.yaml
   sudo chown 1000:1000 cabin-data.yaml      # use the UID the container runs as
   ```

3. `docker compose start`, then check `docker compose logs --tail 20` and open the page.

To start from nothing, stop the container, delete `data/cabin-data.yaml` and start it again: a fresh empty file is created.

### Fix the data by hand

Only while the container is **stopped**. The app reads the file on every request, so a half-finished edit would be served at once, and a write that runs at the same moment would overwrite your edit:

1. `cd /opt/chrapa-poll && docker compose stop`
2. Edit `data/cabin-data.yaml`. Keep dates and times in quotes (`"2026-10-29"`), or YAML turns them into dates. Slot IDs and nights must exist in `config/cabin.yaml`. `sleeping` is `night → slot → party id`, one party per slot.
3. Make sure the file is still owned by the container user (`sudo chown 1000:1000 data/cabin-data.yaml`), then `docker compose start`. On start the app validates the file against the models and the layout. If something is wrong, it refuses to start and names the exact line or entry in `docker compose logs --tail 30` (the container keeps restarting until the file is fixed). Fix it, or restore a backup.

### The map does not match the cabin

The layout (rooms, beds, slots, coordinates) is a guess taken from a preview. To change it edit `config/cabin.yaml` and restart the container (`docker compose restart`, no rebuild needed because `config/` is mounted). Open pages pick up the new layout on their next refresh. If you remove a slot that someone already sleeps in, the startup check stops the app and tells you which entries to fix first (see above). All text on the map (room and bed names) lives in that file too.

### Trace a change

`data/audit.yaml` has one document per write. Search it for a party id, a slot or a night, for example:

```sh
grep -n -B3 -A12 'slot-id-here' /opt/chrapa-poll/data/audit.yaml
```

`source` says where the change came from (`map` for a tap on the map, `form` for the party form), `client_id` is a random anonymous id of the browser, and `before` and `after` show what changed. The backup taken before that write is in `data/backups/` and carries the previous version: the audit entry for `version: 12` belongs to the backup `...-v000011.yaml`.

## 6. Open decisions and the defaults used

These are listed in `proposal.md` ("Otvorené rozhodnutia"). They were not decided by the developer: the stated default is used until the organizer says otherwise.

| Decision | Default used |
| --- | --- |
| Dates | decided: 29. 10. 2026 (Thu) – 1. 11. 2026 (Sun), nights 2026-10-29, 2026-10-30, 2026-10-31, only in `config/cabin.yaml` |
| Real layout of beds, doors and windows | as in the preview; send corrections, they are a change in `config/cabin.yaml` only |
| Can a friend take a place on a night the party is not at the cabin? | no (error `not_present`): the party first edits its arrival and departure |
| Signup deadline | signup is never locked in phase 1 |
| Placement on the server | a Docker container with the port published on `127.0.0.1:8010` only, the app at the root of its own (sub)domain; a sub-path works too (relative API paths) |
| Build phase 2 (admin tools, free-text signup with AI)? | not yet, only after the organizer has tried phase 1 |

Smaller questions that came up while splitting the proposal into tasks, with the defaults used and the organizer's answers, are in `tasks/QUESTIONS.md`.
