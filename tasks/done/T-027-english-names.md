# T-027: English names for IDs, files and identifiers (plus migration of the trial data)

- **Phase:** 1 (organizer request, approved 23. 10. 2026)
- **Depends on:** **T-025** (in `testing/`), **T-026** (in `todo/`). Both change `static/index.html`, `tests/js/logic.test.mjs` and `tests/manualne.md`, and T-026 also changes `config/chata.yaml` and `proposal.md`. Do not start T-027 until **both** are in `done/` and committed. Never run it in parallel with any other task: it touches almost every file in the repo.
- **Size:** M (wide but mechanical). By organizer decision this is **one atomic task**. Do not split it and do not commit half of it.

## Goal
Everything in code, config and definitions gets an English name: room, bed and slot IDs in the layout, file names, cookie and `localStorage` names, Docker and env names, test names, and the phase-2 tool name. Everything people see stays Slovak: UI texts, the room and bed display `name:` values in the layout, and the event name „Chata 29. 10. – 1. 11.“. This follows CLAUDE.md "Hard constraints" (code and identifiers in English) and proposal „Jazyky“. The existing data keeps working: the real `data/` is renamed, and the trial server data is migrated by the orchestrator after the commit (section "Orchestrator: after the commit").

## Mapping (derived from the current `config/chata.yaml`)

`kind` values (`bed2`, `bed1`, `mats`, `cot`, `sofa`, `sofa1`, `bunk`, `stove`) do not change. No `name:`, `rect`, `floor` or other value changes. Only `id`, `slots` and `tight` entries change.

### Rooms (6)
| old | new |
| --- | --- |
| `konica-hore` | `konica-upper` |
| `konica-dole` | `konica-lower` |
| `vlavo` | `left` |
| `chodba` | `hallway` |
| `vpravo` | `right` |
| `kuchynka` | `kitchen` |

("konica" stays: it is the building's name in the approved mapping.)

### Beds (12)
| old | new |
| --- | --- |
| `konica-hore-manzelska` | `konica-upper-double` |
| `konica-hore-jedno` | `konica-upper-single` |
| `konica-dole-matrace` | `konica-lower-mats` |
| `vlavo-manzelska` | `left-double` |
| `vlavo-okno` | `left-window` |
| `vlavo-lehatko-1` | `left-cot-1` |
| `vlavo-lehatko-2` | `left-cot-2` |
| `chodba-gauc` | `hallway-sofa` |
| `vpravo-poschodova-1` | `right-bunk-1` |
| `vpravo-poschodova-2` | `right-bunk-2` |
| `vpravo-gauc` | `right-sofa` |
| `kuchynka-pec` | `kitchen-stove` |

### Slots (20, two tight)
| old | new |
| --- | --- |
| `konica-hore-manzelska-1` | `konica-upper-double-1` |
| `konica-hore-manzelska-2` | `konica-upper-double-2` |
| `konica-hore-jedno-1` | `konica-upper-single-1` |
| `konica-dole-matrac-1` | `konica-lower-mat-1` |
| `konica-dole-matrac-2` | `konica-lower-mat-2` |
| `konica-dole-matrac-3` | `konica-lower-mat-3` |
| `vlavo-manzelska-1` | `left-double-1` |
| `vlavo-manzelska-2` | `left-double-2` |
| `vlavo-okno-1` | `left-window-1` |
| `vlavo-lehatko-1` | `left-cot-1` |
| `vlavo-lehatko-2` | `left-cot-2` |
| `chodba-gauc-1` | `hallway-sofa-1` |
| `chodba-gauc-2` (tight) | `hallway-sofa-2` (tight) |
| `vpravo-posch1-hore` | `right-bunk1-top` |
| `vpravo-posch1-dole` | `right-bunk1-bottom` |
| `vpravo-posch2-hore` | `right-bunk2-top` |
| `vpravo-posch2-dole` | `right-bunk2-bottom` |
| `vpravo-gauc-1` | `right-sofa-1` |
| `kuchynka-pec-1` | `kitchen-stove-1` |
| `kuchynka-pec-2` (tight) | `kitchen-stove-2` (tight) |

The cot beds keep the existing pattern where the bed ID and its only slot ID are equal (`left-cot-1` is both, as `vlavo-lehatko-1` is today).

### Other names
| what | old | new |
| --- | --- | --- |
| layout file | `config/chata.yaml` | `config/cabin.yaml` (`git mv`) |
| data file | `data/chata-data.yaml` | `data/cabin-data.yaml` (`DATA_FILE` in `app/store.py`) |
| backup files | `data/backups/chata-data-<UTC>-v<version>.yaml` | `data/backups/cabin-data-<UTC>-v<version>.yaml` (name and prune glob in `app/store.py`) |
| manual checklist | `tests/manualne.md` | `tests/manual.md` (`git mv`) |
| cookies | `chata_group`, `chata_admin` | `cabin_group`, `cabin_admin` (`app/main.py`) |
| `localStorage` keys | `chata.clientId`, `chata.myParty`, `chata.role`, `chata.noticeCollapsed` | `cabin.clientId`, `cabin.myParty`, `cabin.role`, `cabin.noticeCollapsed` (`KEYS` in `static/index.html`) |
| compose service and image | `chata`, `chata:latest` | `cabin`, `cabin:latest` |
| compose env vars | `CHATA_UID`, `CHATA_GID` | `CABIN_UID`, `CABIN_GID` |
| container user (Dockerfile) | `chata` | `cabin` (UID stays 1000) |
| Python test constant | `CHATA_YAML` (`tests/conftest.py`, `tests/test_models.py`) | `CABIN_YAML` |
| secrets dir (README) | `/etc/chata` | `/etc/cabin` |
| backup copy (README) | `/root/chata-data-backup-…` | `/root/cabin-data-backup-…` |
| example domain and sub-path | `chata.example.com`, `/chata/` | `cabin.example.com`, `/cabin/` |
| test URL fixture | `https://chata.example/` | `https://cabin.example/` |
| trial server dir | `/tmp/chata-try` | `/tmp/cabin-try` |
| phase-2 tool (docs only, `app/llm.py` does not exist yet) | `navrh_zapisu` | `propose_signup` |
| test names | `test_chata_yaml_matches_proposal`, `test_chata_yaml_dates_are_quoted_strings`, `test_etag_changes_when_chata_yaml_changes` | `test_cabin_yaml_…` / `test_etag_changes_when_cabin_yaml_changes` |
| audit `source` values (organizer decision 23. 10. 2026) | `mapa`, `formular` | `map`, `form` (`AUDIT_SOURCES` and docstring example in `app/store.py`, the `audit_source(auth, …)` defaults in `app/main.py`) |

The other two audit sources, `admin` and `ai`, are already English and stay. The full set after the task is `{"map", "form", "admin", "ai"}`. The negative test value `"somewhere"` in `tests/test_store.py` (`test_unknown_source_is_rejected`) stays.

## Scope
Exact files, checked with `git grep` on 23. 10. 2026 (re-run the greps after T-025 and T-026 land, they may add lines):

**Renamed with `git mv`:** `config/chata.yaml` → `config/cabin.yaml`, `tests/manualne.md` → `tests/manual.md`.

**IDs (room, bed, slot):**
- `config/cabin.yaml`: all `id`, `slots`, `tight` entries per the tables.
- `proposal.md`: the layout example (section „Rozloženie chaty“, ~lines 281–334), the `data/…` example (`sleeping`, ~lines 110–114), the `slot_taken` error example (~line 144).
- `tests/api_helpers.py` (lines 6–8), `tests/test_models.py` (tight slots, slot order, duplicate-ID tests, YAML sample ~lines 368–399), `tests/test_validate.py` (lines 8–10), `tests/test_store.py` (line 14), `tests/js/logic.test.mjs` (~154 lines: fixtures and expectations).

**File names, cookies, keys, Docker, paths, tool name:**
- `app/main.py`: cookie constants (lines 70–71), `load_layout(config_dir / "cabin.yaml")` (line 369), docstrings (lines 184, 202, 205).
- `app/store.py`: module docstring, `DATA_FILE`, backup name and prune glob (lines 275–276), messages that say `chata.yaml` (lines 109, 113, 206, 240).
- `app/models.py` (comments lines 118, 234; docstring 205; `parse_layout(..., source="cabin.yaml")` line 376), `app/validate.py` (docstring line 246).
- `static/index.html`: `KEYS` (line ~1747). `<title>Chata</title>` and `<h1>Chata</h1>` stay (UI text).
- `tests/conftest.py`, `tests/test_models.py`, `tests/test_api_access.py` (data file name, `config / "cabin.yaml"`, the not-served paths list ~lines 166–172, test name), `tests/test_map_layout.py` (docstring, path line 45), `tests/js/logic.test.mjs` (comments naming `config/chata.yaml`, the `chata.example` URLs).
- `Dockerfile` (comment line 20, `useradd … cabin`, `USER cabin`), `compose.yaml` (service, image, `CABIN_UID`/`CABIN_GID`, comment about `config/cabin.yaml`), `deploy/Caddyfile` (host, sub-path, nginx `server_name`).
- `README.md`: every `chata` path, file and env name listed by `git grep -n -i chata README.md`, the two `tests/manualne.md` links, and the title (`# Chata: who sleeps where` → `# Cabin sleepover: who sleeps where`, the repo's name).
- `tests/manual.md`: its own `chata` paths (`data/cabin-data.yaml`, `config/cabin.yaml`, `docker compose exec cabin …`, sub-path `/cabin/`). The „Chata“ heading (line ~85) is UI text and stays.
- `CLAUDE.md`: `config/cabin.yaml` (lines 9, 53, 72, 94), `cabin.yaml` (line 86), `cabin-data.yaml` (line 74), `propose_signup` (line 71), `tests/manual.md` (line 111), and the "Trial server" paragraph (line 45): `/tmp/cabin-try/data` and `/tmp/cabin-try/server.log`, with `mkdir -p /tmp/cabin-try` before `nohup`. Line 49 "at a cabin (chata)" stays (it explains the Slovak word).
- `.claude/agents/developer.md`, `.claude/agents/reviewer.md` (`config/cabin.yaml`), `.claude/agents/tester.md` (`tests/manual.md`).
- `proposal.md`: `config/cabin.yaml`, `cabin.yaml`, `data/cabin-data.yaml`, `cabin-data.yaml` (lines 19, 38, 40, 74, 89, 133, 152, 170, 198, 234, 243, 252, 337, 347, 414), `propose_signup` (lines 36, 348), `tests/manual.md` (line 408), the sub-path example `/cabin/` (line 418). **Keep the Slovak prose and the Slovak comments in its YAML examples**; change only file names, IDs and identifiers. Prose words like „chodba“, „vľavo“, „okno“ are not IDs and stay.
- `tasks/todo/T-009-admin.md` is already updated by the product owner (do not touch it).

**Audit `source` values `mapa` → `map`, `formular` → `form`** (checked with `git grep` on 23. 10. 2026; re-run `git grep -n -E "\"(mapa|formular)\"|'(mapa|formular)'|\`(mapa|formular)\`" -- ':!tasks/' ':!files/'` after T-025 and T-026 land):
- `app/store.py`: `AUDIT_SOURCES` (line 46) becomes `frozenset({"map", "form", "admin", "ai"})`; the module docstring example (line 10) `source="map"`.
- `app/main.py`: the six `audit_source(auth, "mapa")` / `audit_source(auth, "formular")` calls (lines 479, 491, 512, 526, 546, 565).
- `tests/test_store.py` (15 lines), `tests/test_api_write.py` (lines 59, 213, 324, 413), `tests/test_api_access.py` (line 399): the `source=` arguments and the asserted values.
- `proposal.md` line 125 (`audit.yaml` section): only the code values in the parentheses, i.e. „zdroj (`map`, `form`, `admin`, `ai`)“. The Slovak sentence around it stays.
- `README.md` line 199: `` `map` for a tap on the map, `form` for the party form ``.
- `tests/manual.md` (today `tests/manualne.md` line 20): `` (`map` or `form`) ``.
- Not affected: `static/index.html` (the page never sends or reads a source; the server picks it per endpoint), `tests/js/`, `config/`, `CLAUDE.md`, `.claude/agents/`.

**Existing `audit.yaml` entries stay unchanged** (organizer decision 23. 10. 2026, default applied). The audit is a history log: the app only appends to it (`open(..., "ab")` in `app/store.py`) and never reads it back, and nothing validates old entries at startup, so old `mapa`/`formular` values cannot break anything. After the migration the trial `audit.yaml` holds old entries with `mapa`/`formular` and old slot IDs, and new entries with `map`/`form` and new slot IDs. This is expected. Do not add code that reads, rewrites or normalises old entries, and the migration script does not touch `audit.yaml`. The real repo `data/audit.yaml` (if it exists) is also left as it is.

**`CLAUDE.md` and `.claude/agents/*.md` are confirmed in scope** (organizer decision 23. 10. 2026): the developer edits exactly the lines listed above for those files and nothing else in them.

**Comments in `config/cabin.yaml`** (the `map.scene` block) are translated to English. Use exactly:
```yaml
  scene:                       # info elements on the grass, rect = [x, y, width, height]
    title:  …   # event name
    nights: …   # three night signposts
    notice: …   # noticeboard with the how-to
    status: …   # „Si: …“, last update, warning (two rows of 44)
    locked: …   # „Zápis je zatvorený“ sign
    letter: …   # letter icon, summary to send
    key:    …   # key icon, admin only
    legend: …   # „Kto je kto“ icon, party color legend
    parties: …  # table of parties and their places per night (shown when the noticeboard is collapsed)
    meadow: …   # meadow where people of my party without a bed wait
```
(keep the current values and column alignment; quoted Slovak UI strings stay inside the comments).

**No change needed** (verified): `.gitignore` and `.dockerignore` (they ignore `data/` as a whole and have no `chata` name), `.env.example`, `config/app.yaml`, `pyproject.toml`, `uv.lock`, `app/ratelimit.py`, `tests/js/index.js`, `tests/test_api_write.py`, `tests/test_ratelimit.py`.

**Out of scope:** `files/` (read-only), `tasks/` history (done, testing, and the dev logs of other tasks), existing entries in any `audit.yaml`, logger names `chrapa.*`, the project folder name.

## Organizer decisions (23. 10. 2026)
Both questions raised when the task was written were answered „Áno“:
1. The audit `source` values are translated to English (`mapa` → `map`, `formular` → `form`; `admin` and `ai` stay). Existing `audit.yaml` entries are history and stay unchanged (the app never reads them back).
2. Edits to `CLAUDE.md` and `.claude/agents/*.md` (only the lines in the scope above) are part of this task.

No open questions remain for this task.

## Acceptance criteria
- [x] `config/cabin.yaml` and `tests/manual.md` exist; `config/chata.yaml` and `tests/manualne.md` do not. `git status` shows both as renames (`R`), not delete plus add.
- [x] Layout content check: apart from IDs and comments, `config/cabin.yaml` equals the old file. Verify with a one-off command (not committed), e.g. load `git show HEAD:config/chata.yaml` and the new file with `yaml.safe_load`, map old IDs through the tables above, and assert the two structures are equal. Also: 6 rooms, 12 beds, 20 slots, tight slots `{hallway-sofa-2, kitchen-stove-2}`, every `kind` and `name:` unchanged.
- [x] `git grep -n -E 'konica-(hore|dole)|\b(vlavo|chodba|vpravo|kuchynka)-|posch[12]-|matrac-|manzelska|lehatko|navrh_zapisu|manualne|chata_(group|admin)|CHATA_|chata-data|chata\.yaml|chata-try|/etc/chata|chata\.example|chata\.(clientId|myParty|role|noticeCollapsed)' -- ':!tasks/' ':!files/'` prints nothing.
- [x] `git grep -n -E "\"(mapa|formular)\"|'(mapa|formular)'|\`(mapa|formular)\`" -- ':!tasks/' ':!files/'` prints nothing. `AUDIT_SOURCES` is exactly `{"map", "form", "admin", "ai"}`. Tests assert `map` for `assign`/`clear`/`move` and `form` for `party-create`/`party-update`, and `admin` with the admin cookie as before.
- [x] Server smoke test (same run as below): after one `assign` the new last document in `<data_dir>/audit.yaml` has `source: map`.
- [x] `git grep -n -i chata -- ':!tasks/' ':!files/'` prints only these allowed exceptions (the reviewer checks each line):
  - the event name „Chata 29. 10. – 1. 11.“: `config/cabin.yaml` (`event.name`), `proposal.md` (title line 1 and the YAML example), `tests/js/logic.test.mjs` fixtures and expectations (including the short `name: "Chata"` fixture);
  - UI text „Chata“: `static/index.html` `<title>` and `<h1>`, `tests/manual.md` (the „Chata“ heading item);
  - the Slovak word explained or discussed: `CLAUDE.md` "at a cabin (chata)", the `tests/js/logic.test.mjs` comment about the locative of „chata“;
  - historical file names in `proposal.md` (`podklady/chata-prehlad.html`, `podklady/chata-spanie-tabulka.xlsx`, files that no longer exist).
- [x] Test names are `test_cabin_yaml_matches_proposal`, `test_cabin_yaml_dates_are_quoted_strings`, `test_etag_changes_when_cabin_yaml_changes`. No test was deleted or skipped: the pytest and Node test counts are the same as before the task (write both counts in the dev log).
- [x] `uv run pytest` passes. `node --test tests/js/` passes.
- [x] Server smoke test on a free port (never 8000 or 8010) with a fresh temp data dir: it starts, creates `<data_dir>/cabin-data.yaml` (and no `chata-data.yaml`), `/api/health` is OK, `POST /api/join` with the group code sets a cookie named `cabin_group`, and `/api/state` returns the new slot IDs in `layout`. After one `assign`, a backup named `cabin-data-*.yaml` exists in `backups/`.
- [x] In a browser (or by reading the code): the page stores `cabin.clientId`, `cabin.myParty`, `cabin.role`, `cabin.noticeCollapsed` and no `chata.*` key.
- [x] `compose.yaml` service `cabin`, image `cabin:latest`, `user: "${CABIN_UID:-1000}:${CABIN_GID:-1000}"`; Dockerfile user `cabin`. If Docker is available, `GROUP_CODE=x ADMIN_CODE=y SECRET_KEY=$(python3 -c 'print("z"*40)') docker compose config` succeeds (otherwise say so in the dev log).
- [x] The real repo `data/`: `data/chata-data.yaml` (version 0, no parties, empty `backups/`) is renamed to `data/cabin-data.yaml` with a plain `mv` (not git, `data/` is ignored). Nothing else in `data/` changes.
- [x] **Migration rehearsal on a copy** (the real trial data is migrated only by the orchestrator after the commit): `cp -a /tmp/chata-try/data /tmp/t027-rehearsal/data`, run the migration script below on `/tmp/t027-rehearsal/data`, then start the new server on a free port with `data_dir='/tmp/t027-rehearsal/data'`. It starts (so every slot ID is known to `config/cabin.yaml`), the `version` is unchanged, the number of `sleeping` entries per night is unchanged, all backups are renamed to `cabin-data-*`, `audit.yaml` is byte-identical. Paste the script output and the checks into the dev log. Do not touch `/tmp/chata-try` itself and do not use port 8010.
- [x] `CLAUDE.md` "Trial server" uses `/tmp/cabin-try` everywhere.

## Notes for developer
- **Replace whole IDs only, longest first.** Do the slot IDs before bed IDs before room IDs (for example `vlavo-manzelska-1` before `vlavo-manzelska` before `vlavo`), and match on ID boundaries, so `vlavo-lehatko-1` does not become `left-lehatko-1` and no Slovak prose changes. In `proposal.md`, „vľavo“, „chodba“, „okno“ in sentences are prose, not IDs.
- **Order must still come from the config.** The new IDs sort differently from the old ones (`hallway` < `kitchen` < `konica-…` < `left` < `right`). If a test fails only because of order after the rename, do not just reorder the expectation: some code sorts by ID string instead of `slot_order` / config order, and that is a bug to fix (and mention in the dev log).
- **No compatibility shim.** The server does not look for `chata-data.yaml` or old cookies. A missing `cabin-data.yaml` is created empty, so on the trial server the migration must happen before the new server starts (the orchestrator steps below handle it).
- Old cookies (`chata_group`, `chata_admin`) and old `localStorage` keys are abandoned: everyone enters the group code again and picks „Kto si?“ again. The organizer accepted this before the event. Do not add code to read or clean up the old keys.
- The error `params` and audit entries carry slot IDs. Nothing in the page shows a slot ID to people (it shows the bed `name:`); check that this is still true after the rename.
- Keep the Slovak UI texts byte-identical. The diff of `static/index.html` should be the `KEYS` line only.
- Do not touch `files/`, other task files, `.env`, or `/tmp/chata-try`.

## Migration script (one-off, never committed)
Run from the repo root as a heredoc, so nothing lands in the repo. Argument: the data directory to migrate in place.

```sh
uv run python - "$DATA_DIR" <<'PY'
import os, sys, yaml
from pathlib import Path

SLOT_MAP = {
    "konica-hore-manzelska-1": "konica-upper-double-1",
    "konica-hore-manzelska-2": "konica-upper-double-2",
    "konica-hore-jedno-1": "konica-upper-single-1",
    "konica-dole-matrac-1": "konica-lower-mat-1",
    "konica-dole-matrac-2": "konica-lower-mat-2",
    "konica-dole-matrac-3": "konica-lower-mat-3",
    "vlavo-manzelska-1": "left-double-1",
    "vlavo-manzelska-2": "left-double-2",
    "vlavo-okno-1": "left-window-1",
    "vlavo-lehatko-1": "left-cot-1",
    "vlavo-lehatko-2": "left-cot-2",
    "chodba-gauc-1": "hallway-sofa-1",
    "chodba-gauc-2": "hallway-sofa-2",
    "vpravo-posch1-hore": "right-bunk1-top",
    "vpravo-posch1-dole": "right-bunk1-bottom",
    "vpravo-posch2-hore": "right-bunk2-top",
    "vpravo-posch2-dole": "right-bunk2-bottom",
    "vpravo-gauc-1": "right-sofa-1",
    "kuchynka-pec-1": "kitchen-stove-1",
    "kuchynka-pec-2": "kitchen-stove-2",
}
NEW = set(SLOT_MAP.values())

def migrate(old: Path, new: Path):
    data = yaml.safe_load(old.read_text(encoding="utf-8")) or {}
    sleeping = data.get("sleeping") or {}
    counts = {}
    for night, slots in sleeping.items():
        renamed = {}
        for slot, party in (slots or {}).items():
            if slot in SLOT_MAP:
                slot = SLOT_MAP[slot]
            elif slot not in NEW:
                sys.exit(f"{old}: unknown slot {slot!r} on night {night}")
            renamed[slot] = party
        if len(renamed) != len(slots or {}):
            sys.exit(f"{old}: slot collision on night {night}")
        sleeping[night] = renamed
        counts[night] = len(renamed)
    tmp = new.with_name(new.name + ".tmp")
    tmp.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")
    os.chmod(tmp, old.stat().st_mode & 0o777)
    with open(tmp, "rb") as fh:
        os.fsync(fh.fileno())
    os.replace(tmp, new)
    old.unlink()
    return data.get("version"), counts

d = Path(sys.argv[1])
if (d / "cabin-data.yaml").exists():
    sys.exit(f"{d}: cabin-data.yaml already exists, refusing to overwrite")
version, counts = migrate(d / "chata-data.yaml", d / "cabin-data.yaml")
print(f"cabin-data.yaml: version {version}, sleeping entries per night {counts}")
n = 0
for b in sorted((d / "backups").glob("chata-data-*.yaml")):
    migrate(b, b.with_name("cabin-data-" + b.name[len("chata-data-"):]))
    n += 1
print(f"backups migrated: {n}")
PY
```
Before running it, note `version` and the per-night entry counts of the old file (`grep '^version:'` and the script's own output on the copy). `audit.yaml` is left as it is: it is a history log that the app only appends to, so the old slot IDs and the old `source` values (`mapa`, `formular`) stay in its old entries (organizer decision 23. 10. 2026).

## Orchestrator: after the commit (trial server migration)
Do these instead of the usual restart, right after committing T-027 and pushing:
1. Stop the trial server: kill whatever listens on port 8010.
2. Safety copy: `cp -a /tmp/chata-try /tmp/chata-try-before-T027`.
3. Note `grep '^version:' /tmp/chata-try/data/chata-data.yaml`.
4. `mv /tmp/chata-try /tmp/cabin-try`.
5. Run the migration script above with `DATA_DIR=/tmp/cabin-try/data`.
6. Start the server with the new command from `CLAUDE.md` "Trial server" (paths `/tmp/cabin-try/...`) and check `/api/health`. If the server refuses to start, read `/tmp/cabin-try/server.log`; the safety copy from step 2 is the fallback.
7. Check: `version` in `/tmp/cabin-try/data/cabin-data.yaml` equals step 3, the per-night counts match the script output, `ls /tmp/cabin-try/data/backups` shows only `cabin-data-*`. Then remove `/tmp/chata-try-before-T027` once the organizer has seen the map with the old places.
8. Tell the organizer: the phone asks for the group code again and „Kto si?“ again (old cookie and `localStorage` names were dropped on purpose).

If the app is ever deployed with real data before this task lands, the same script and steps apply to the server's `data/`, plus `docker compose down` before pulling (the service name changed from `chata` to `cabin`, so the old container would keep port 8010).

---
## Dev log

**Done as one atomic change (nothing committed).** Dependencies T-025 and T-026 are committed (git log: `e8c448b`, `25a6115`).

**Method.** `git mv config/chata.yaml config/cabin.yaml` and `git mv tests/manualne.md tests/manual.md` (both show as `R` in `git status`). The IDs and names were replaced with a one-off script outside the repo (`/tmp/t027-tools/rename.py`, not committed): whole-ID matches only, slots before beds before rooms, so `vlavo-lehatko-1-1` style fixture slots in `tests/js/logic.test.mjs` became `left-cot-1-1` (bed ID plus `-1`, as the fixture helper builds them). File names, cookies, keys, Docker/env names, the tool name and `/tmp/chata-try` were done by plain string replacement over the files in the task scope. `Dockerfile` user, `compose.yaml` service/image, `deploy/Caddyfile` sub-path, the README title and the two sub-path examples were edited by hand. Audit sources `mapa`/`formular` became `map`/`form` in `app/store.py` (`AUDIT_SOURCES`, docstring), `app/main.py` (six calls), the tests, README line 199, `tests/manual.md` and `proposal.md` (code values in the parentheses only). The `map.scene` comments in `config/cabin.yaml` are the exact English text from the task (proposal keeps its Slovak comments).

**Files touched:** `config/cabin.yaml` (renamed), `tests/manual.md` (renamed), `app/main.py`, `app/store.py`, `app/models.py`, `app/validate.py`, `static/index.html` (the `KEYS` line only), `tests/conftest.py`, `tests/api_helpers.py`, `tests/test_models.py`, `tests/test_validate.py`, `tests/test_store.py`, `tests/test_api_access.py`, `tests/test_api_write.py`, `tests/test_map_layout.py`, `tests/js/logic.test.mjs`, `Dockerfile`, `compose.yaml`, `deploy/Caddyfile`, `README.md`, `proposal.md`, `CLAUDE.md` (only the listed lines, plus `mkdir -p /tmp/cabin-try;` in the Trial server command), `.claude/agents/developer.md`, `.claude/agents/reviewer.md`, `.claude/agents/tester.md`. `tasks/todo/T-009-admin.md` was not touched by me (its modification was already there at the start). Real `data/chata-data.yaml` renamed with plain `mv` to `data/cabin-data.yaml` (version 0, `backups/` empty, nothing else changed).

**One deviation (test guard).** `tests/js/logic.test.mjs` "no bed, room or slot geometry or names are hardcoded in the page code" matched the old Slovak words `konica|vlavo|vpravo|chodba|kuchynka|manzelska|matrace`. The new English words `left`/`right` appear in CSS and layout code, so a plain word match would fail. The regex is now `/konica|["'](left|right|hallway|kitchen)["']|(left|right)-(double|window|cot|bunk|sofa)|hallway-sofa|kitchen-stove/i` (quoted room IDs and bed/slot ID prefixes). Same intent, test not weakened in what it forbids (no ID is hardcoded in the page); it passes.

**Order check.** No test failed because of order, so no code sorts by ID string (nothing to fix).

**Tests (counts unchanged: 384 pytest, 199 Node).**
- `uv run pytest -q` -> `384 passed` (before the task: 384 passed).
- `node --test tests/js/` -> `tests 199, pass 199, fail 0` (before: 199).
- Renamed tests: `test_cabin_yaml_matches_proposal`, `test_cabin_yaml_dates_are_quoted_strings`, `test_etag_changes_when_cabin_yaml_changes`.

**Greps (all run at the end):**
- ID/name grep from the task (`konica-(hore|dole)|...|chata\.(clientId|...)`) -> prints nothing.
- Audit grep (`"mapa"|"formular"` etc.) -> prints nothing.
- `git grep -n -i chata -- ':!tasks/' ':!files/'` prints only the allowed exceptions: `CLAUDE.md:49` ("a cabin (chata)"); `config/cabin.yaml:2` (event name); `proposal.md` lines 1, 258 (event name) and 50, 52 (historical `podklady/chata-*` files); `static/index.html` `<title>` and `<h1>`; `tests/js/logic.test.mjs` lines 28, 83, 84, 1096, 1142 (event name / short "Chata" fixture) and 2360 (locative comment); `tests/manual.md:85` (the „Chata“ heading item).

**Layout content check (one-off, not committed).** Loaded `git show HEAD:config/chata.yaml` and the new file with `yaml.safe_load`, mapped old IDs through the tables, `assert old == new` passed (so every `kind`, `name:`, `rect`, `floor`, the whole `map` block and `event` are equal). 6 rooms, 12 beds, 20 distinct slots, tight slots `{hallway-sofa-2, kitchen-stove-2}`.

**Server smoke test** (port 18765, `data_dir=/tmp/t027-smoke/data`, fresh): started; `/api/health` `{"ok":true}`; `POST /api/join` set `cabin_group=...`; `/api/state` returned `konica-upper-double-1, konica-upper-double-2, ...` in `layout`; created a party and one `assign` of `left-window-1`; `data/` holds `cabin-data.yaml` and `audit.yaml` and no `chata-data.yaml`; `backups/` holds `cabin-data-20261023T183743768358Z-v000000.yaml` and `...-v000001.yaml`; the audit documents are `party-create` with `source: form` and `assign` with `source: map`. Server stopped afterwards.

**Page keys:** the diff of `static/index.html` is the `KEYS` line only: `cabin.clientId`, `cabin.myParty`, `cabin.role`, `cabin.noticeCollapsed`; no `chata.*` remains. The page code was not otherwise changed, so it still shows bed `name:` values and never a slot ID.

**Docker:** `GROUP_CODE=x ADMIN_CODE=y SECRET_KEY=zzzz... docker compose config` succeeds (service `cabin`, `image: cabin:latest`, `user: 1000:1000`). The image was not built.

**Migration rehearsal on a copy** (`/tmp/chata-try` was only read by `cp -a`, never modified; port 8010 not used):
```
cp -a /tmp/chata-try/data /tmp/t027-rehearsal/data      # old: version 57, per night {'2026-10-29': 5, '2026-10-30': 4, '2026-10-31': 5}, 50 backups
uv run python /tmp/t027-tools/migrate.py /tmp/t027-rehearsal/data     # the script from this task, extracted verbatim
cabin-data.yaml: version 57, sleeping entries per night {'2026-10-29': 5, '2026-10-30': 4, '2026-10-31': 5}
backups migrated: 50
```
Checks: `ls` shows `audit.yaml backups cabin-data.yaml` (no `chata-data.yaml`); all 50 backups are `cabin-data-*`; `version: 57` unchanged; `shasum -c` of `audit.yaml` before/after: OK (byte-identical). New server started on port 18766 with `data_dir='/tmp/t027-rehearsal/data'`: starts, `/api/health` OK, `/api/state` returns version 57 and the same per-night counts 5/4/5, so every migrated slot ID is known to `config/cabin.yaml`. Server stopped; the script sits outside the repo.

**Follow-ups for the orchestrator:** do the trial-data migration steps from the task after the commit. `tests/js` and docs mention nothing else to change. The tmp dirs `/tmp/t027-smoke`, `/tmp/t027-rehearsal`, `/tmp/t027-tools` can be deleted.

### Fixes for review round 1

- Blocker (`test_move_in_several_nights` does not assert the audit source): fixed. The audit assertion in `tests/test_api_write.py` now also checks `doc["source"] == "map"`.
- Suggestion (assign-stay audit source): fixed. `test_assign_stay_skips_a_night_with_a_taken_slot` now also asserts `doc["source"] == "map"`.
- Suggestion (guard pattern in `tests/js/logic.test.mjs`): fixed. The pattern is now `/konica|hallway|kitchen|["'`](left|right)["'`]|(left|right)-(double|window|cot|bunk|sofa)/i`. `hallway` and `kitchen` match unquoted anywhere (this also covers `hallway-sofa` and `kitchen-stove`), and `left`/`right` are caught in backtick quotes too. It still passes on the current page, since `left`/`right` appear there only as CSS words and are not quoted in the checked script.
- Commands: `uv run pytest -q` gives 384 passed. `node --test tests/js/` gives 199 tests, 199 pass. Nothing was committed or pushed.

## Review round 1

What I checked myself, without relying on the Dev log:
- `uv run pytest -q`: 384 passed. `node --test tests/js/`: 199 tests, 199 pass. Both counts match the Dev log.
- Both inline scripts in `static/index.html` (`logic`, `app`) parse with `vm.Script`. The `static/index.html` diff is only the `KEYS` line.
- Layout mapping: I loaded `HEAD:config/chata.yaml`, mapped every room, bed, slot and bed-level `tight` ID through the task tables, and compared it with `config/cabin.yaml`. They are equal. The new file has 6 rooms, 12 beds, 20 distinct slots, and the tight slots are `hallway-sofa-2` and `kitchen-stove-2`. Slot order still follows the config. The `map.scene` comments match the prescribed English text, with the same values and alignment.
- `git status` shows both `config/chata.yaml → config/cabin.yaml` and `tests/manualne.md → tests/manual.md` as `R`.
- The ID/name grep and the audit-source grep from the criteria print nothing. `git grep -i chata` prints only the allowed exceptions: CLAUDE.md:49, config event name, proposal lines 1/50/52/258, `<title>`/`<h1>`, the logic test fixtures at lines 28/83/84/1096/1142, the locative comment at line 2360, and tests/manual.md:85.
- `proposal.md` word-diff: only file names, IDs, `propose_signup`, the audit codes in parentheses and `/cabin/` changed. The Slovak prose and the Slovak YAML comments are untouched.
- Node test diff: only ID and URL tokens changed. No Slovak expectation text changed.
- In-process smoke test against a temp data dir:
  - `join` sets `cabin_group`.
  - `/api/state` returns the new slot IDs.
  - The audit sources are `party-create→form`, `assign→map`, `move→map`, `assign-stay→map`.
  - The data dir holds `cabin-data.yaml`, and the backups are named `cabin-data-*`.
- `docker compose config` shows service `cabin`, `image: cabin:latest` and `user: 1000:1000`.
- Real `data/` now holds `cabin-data.yaml` (version 0, `backups/` empty). It is still git-ignored.
- `.claude/agents/*.md`: each file has exactly one changed line, the listed one.
- CLAUDE.md: the changed lines are 9, 45 (with `mkdir -p /tmp/cabin-try;`), 53, 71, 72, 74, 75, 86, 94 and 111. Line 75 (`tests/manualne.md` in the Dockerfile/compose bullet) was not in the task's list. Changing it is still required, because the grep criterion forbids `manualne`. I accept it.
- The guard test still fails for every actual ID in `config/cabin.yaml`: quoted `"left"`/`'kitchen'`, `left-cot-1`, `right-bunk1-top`, `hallway-sofa-2`, `kitchen-stove-1`, `konica-upper-double-1`. It passes on the current page. No code sorts slot IDs as strings (only nights and backup names are sorted).

**Blocker**
1. `tests/test_api_write.py:248` (`test_move_in_several_nights`): the move test does not assert the audit source. The criterion says "Tests assert `map` for `assign`/`clear`/`move`", and it is ticked, but no test checks `source` for `move`. Today only lines 59 (assign), 213 (clear), 324 and 413 (form), and 524/526 (admin) assert a source.
   - Failure scenario: someone changes the `move` route in `app/main.py:526` to `audit_source(auth, "form")`. All 384 tests still pass, and the audit wrongly says the move came from the form.
   - Fix: extend the assertion at line 248 to `... and doc["source"] == "map"`.

**Suggestion**
- `tests/test_api_write.py:164` (`test_assign_stay_skips_a_night_with_a_taken_slot`): add `doc["source"] == "map"` here too. `assign-stay` is the sixth `audit_source(..., "map")` call and has the same gap.
- `tests/js/logic.test.mjs:1311`: the guard could be stricter at no cost. `hallway`, `kitchen`, `double` and `upper`/`lower` occur nowhere in the page code today. Matching them unquoted would keep the old guard's "any occurrence" strength for those words. The current regex also misses backtick-quoted `` `left` ``. A possible form: `/konica|hallway|kitchen|["'`](left|right)["'`]|(left|right)-(double|window|cot|bunk|sofa)/i`. The current form is acceptable as it is.

**Nit**
- None.

Verdict: CHANGES REQUESTED

## Review round 2

Round-1 blocker:
- Fixed. `tests/test_api_write.py:248` (`test_move_in_several_nights`) now also asserts `doc["source"] == "map"`. Every `map` route (`assign`, `assign-stay`, `clear`, `move`) and every `form` route (`party-create`, `party-update`) now has a source assertion, so the criterion "Tests assert `map` for `assign`/`clear`/`move` …" holds.

Round-1 suggestions:
- Assign-stay: done. Line 164 asserts `doc["source"] == "map"`.
- Guard in `tests/js/logic.test.mjs:1311`: done. The pattern is now `/konica|hallway|kitchen|["'`](left|right)["'`]|(left|right)-(double|window|cot|bunk|sofa)/i`. I probed it on its own. It matches `"left"`, `` `right` ``, `left-cot-1`, `right-bunk1-top`, `hallway-sofa-2`, `kitchen-stove-1` and `konica-upper-double-1`. It does not match the CSS words `text-align: left` or `margin-right`, and it passes on the current page.

Fresh pass (I ran everything myself):
- `uv run pytest -q`: 384 passed. `node --test tests/js/`: 199 tests, 199 pass. The counts have not changed.
- The ID/name grep and the audit-source grep from the criteria both print nothing.
- `git grep -i chata` prints only the allowed exceptions: CLAUDE.md:49, config/cabin.yaml:2, proposal.md lines 1/50/52/258, static/index.html `<title>`/`<h1>`, logic.test.mjs lines 28/83/84/1096/1142/2360, and tests/manual.md:85.
- Since round 1, only the assertions above and the guard regex changed. No application code changed, and no test was removed or weakened.

**Blocker**
- None.

**Suggestion**
- None.

**Nit**
- None.

Verdict: APPROVED

## Test report

**Tester: Haiku 5.5, 23. 10. 2026. Result: PASS, all 12 acceptance criteria and the extra scenarios. Nothing committed or pushed.**

**Commands and results**
- `uv run pytest -q`: 384 passed. Same count as HEAD (25a6115), checked by `git archive HEAD` into `/tmp/t027-tester/head` and running the same command there. The test names differ only by the rename (`chata` to `cabin`); no test was added or removed.
- `node --test tests/js/`: 199 tests, 199 pass, 0 fail. Test names identical to HEAD.
- `git grep -n -E 'konica-(hore|dole)|\b(vlavo|chodba|vpravo|kuchynka)-|posch[12]-|matrac-|manzelska|lehatko|navrh_zapisu|manualne|chata_(group|admin)|CHATA_|chata-data|chata\.yaml|chata-try|/etc/chata|chata\.example|chata\.(clientId|myParty|role|noticeCollapsed)' -- ':!tasks/' ':!files/'`: no output.
- `git grep -n -E "\"(mapa|formular)\"|'(mapa|formular)'|\`(mapa|formular)\`" -- ':!tasks/' ':!files/'`: no output.
- `git grep -n -i chata -- ':!tasks/' ':!files/'`: only the allowed exceptions (CLAUDE.md:49, config/cabin.yaml:2, proposal.md 1/50/52/258, static/index.html `<title>`/`<h1>`, logic.test.mjs 28/83/84/1096/1142/2360, tests/manual.md "Chata" heading at line 86 now, after my one-line insert).
- `git status --short`: `RM config/chata.yaml -> config/cabin.yaml` and `RM tests/manualne.md -> tests/manual.md`. The index holds `R100` renames.
- Layout check (one-off script in `/tmp/t027-tester/layout_check.py`, not in the repo): `yaml.safe_load(git show HEAD:config/chata.yaml)` with IDs mapped through the task tables equals `config/cabin.yaml` (rooms, beds, slots, `tight`, `map`, `event`). 6 rooms, 12 beds, 20 slots, `tight` = `hallway-sofa-2`, `kitchen-stove-2`. Every `kind` and `name:` is unchanged.
- `docker compose config` with test secrets: OK, service `cabin`, `image: cabin:latest`, `user: 1000:1000`, port `127.0.0.1:8010`, `read_only`. The Dockerfile has `useradd … cabin` and `USER cabin`. The image was not built.
- The real `data/` holds `cabin-data.yaml` (94 bytes, consistent with version 0) and an empty `backups/`. `data/chata-data.yaml` is gone. I checked this by listing only and did not open the file.
- `.env` was not read. `/tmp/chata-try` was only read (`cp -a`, and a hash list taken before the copy). Port 8010 was not used by me; its process is still the organizer's trial server.

**Server smoke test** (own server, port 18801, temp `data_dir=/tmp/t027-tester/run/data`, test secrets). Script: `/tmp/t027-tester/api_check.py`. Result: 43 passed, 0 failed.
- `/api/health` OK. `/api/state` without a cookie gives 401 `bad_code`.
- Wrong code: 401 `bad_code`. Right code: 200, sets `cabin_group` (Secure, HttpOnly, SameSite=lax). No `chata` cookie. Admin code sets `cabin_admin` and `cabin_group`.
- `/api/state` has the new slot IDs, 6 rooms, 20 slots, `tight` = `hallway-sofa-2`, `kitchen-stove-2`. Repeat with `If-None-Match` gives 304.
- Create party, assign to `konica-upper-double-1`, `left-window-1`, move to `kitchen-stove-1`, clear, assign-stay, unknown party, duplicate name, empty name, night outside event: each gives the right status and `code`. Version bumps by 1 per write.
- Old slot ID `vlavo-okno-1`: 404 `unknown_slot`. Old cookie `chata_group`: 401.
- `data/`: `/data/cabin-data.yaml`, `/data/audit.yaml`, `/data/backups/`, `/config/cabin.yaml`, `/config/app.yaml`, `/.env`, `/docs`, `/openapi.json`, `/files/mapa-nahlad.html`, `/static/../data/cabin-data.yaml` all 404.
- File names on disk: `cabin-data.yaml` and 50 `cabin-data-*` backups. No `chata-data.yaml`.
- `audit.yaml` sources: `party-create` → `form`, `assign`/`move`/`clear`/`assign-stay` → `map`, admin-cookie `assign` → `admin`. Each document is valid YAML.

**Browser test** (headless Google Chrome 156 through `playwright-core` in `/tmp/t027-tester`, viewport 380×720, DPR 2, mobile and touch emulation, `sk-SK`). Scripts: `/tmp/t027-tester/browser_check.js` and `move_check.js`. Screenshots in `/tmp/t027-tester/shots/`.
- Code screen shows at 380 px. A wrong code shows the Slovak „Kód nesedí, skús ho zadať znova.“. The right code opens the map.
- The „Kto si?“ list shows the party. Choosing it stores `cabin.myParty` and `cabin.clientId`, and `cabin.role` is set. After a reload `cabin.noticeCollapsed` is there too. No `chata.*` key exists at any point.
- The map renders: the scene is 380 units wide and fits the screen. 12 beds are `role="button"` with the new IDs as `data-key`. Their `aria-label` is Slovak and shows no slot ID. The night signposts, the noticeboard, the party table and the „?“ box are drawn.
- No horizontal overflow at 380 px.
- Tapping the free double bed, then „Zapísať nás sem (1 miesto)“, writes `left-double-*` to the server (version 7 → 8).
- Move from the sheet („Presunúť“, then „Táto noc“, then a tap on a free cot): the server state moves `konica-upper-double-1` to `left-cot-1` on 2026-10-29. The move bar closes.
- After a reload the page still shows the party as chosen, and `localStorage` still holds only `cabin.*` keys.
- The page text has no English server message, no `undefined` or `NaN`, and no slot ID.
- The only console errors are the expected 401s (`/api/state` before the join, `/api/join` with the wrong code) and a 404 that is most likely `/favicon.ico` (curl confirms that path is 404, and the page has no favicon link; the 404 itself was not traced by URL). This is not caused by T-027 (see observations).

**Migration rehearsal on a copy** (as the task says; the original `/tmp/chata-try/data` was only read).
- `cp -a /tmp/chata-try/data /tmp/t027-rehearsal/data`. Before: `version: 57`, `sleeping` per night `{'2026-10-29': 5, '2026-10-30': 4, '2026-10-31': 5}`, 50 backups, `audit.yaml` sha256 `8f21b39c…a0fa1e`.
- Migration script, extracted verbatim from the task file to `/tmp/t027-tester/migrate.py`, run with `uv run python -I`: `cabin-data.yaml: version 57, sleeping entries per night {'2026-10-29': 5, '2026-10-30': 4, '2026-10-31': 5}` and `backups migrated: 50`. Exit 0.
- Checks (`/tmp/t027-tester/verify_migration.py`): the migrated file equals the original with IDs mapped (True). The 50 backups equal the mapped originals (True). File mode 0600 kept. `chata-data.yaml` gone. `audit.yaml` byte-identical (`shasum -c` OK).
- A new server on port 18802 with `data_dir` on the copy starts. `/api/health` OK. `/api/state`: version 57, per-night counts 5/4/5, same parties (`Lukas`, `ivan`, `Lukas2`), slots only the new IDs. Join works. One `assign` on the copy works and bumps the version to 58.
- Negative: the original `chata-data.yaml` copied to `cabin-data.yaml` without migration makes startup fail with `StartupError` naming each unknown slot (e.g. `sleeping.2026-10-29.vlavo-manzelska-1: unknown slot`). The old file name alone is ignored and an empty `cabin-data.yaml` is created (as the task says, no compatibility shim).

**Extra scenarios**
- Concurrency (`/tmp/t027-tester/race_check.py`): two parties `asyncio.gather` an assign to the same slot, 3 times. Each time exactly one gets 200, the other 409 `slot_taken`. Two parties with overlapping two-slot requests: one 200, one 409, and only the winner's slots are written (no partial booking).
- Duplicate name in another case (`novákovci`): 409 `duplicate_name`.
- Admin code and cookie: `assign` with `cabin_admin` gives `source: admin`.
- Old cookies and old `localStorage` keys are not read.
- Static: `/static/index.html` served. The page has no `chata.` localStorage key.

**Failures**
None.

**Observations (not failures, for the developer or the orchestrator)**
- `/favicon.ico` returns 404 (the app has no favicon). It shows as a console error in headless Chrome. It is not part of T-027, and the criteria do not mention it. Only worth a note if you care about console noise.
- If the orchestrator starts the new server before migrating `/tmp/cabin-try`, the app silently creates an empty `cabin-data.yaml` and the map looks empty. The old `chata-data.yaml` stays behind. That follows the task's "no compatibility shim" rule, so only the order of the steps protects against it: migrate first, then start.
- Touch target sizes of the beds were not measured here (outside T-027).

**Added by me (tester, small gap):** `tests/manual.md`, one new checklist item in section 2, „Renamed cookies and keys (T-027)“: on a phone with the old trial page, the code screen and „Kto si?“ come back after the update, and the places stay. It is for iPhone Safari and Android Chrome, which I could not test here. No automated test was added, so the test counts stay at 384 and 199.

**Verdict:** PASS. Moved to `tasks/done/`.

### Acceptance criteria

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `config/cabin.yaml` and `tests/manual.md` exist, old names gone, shown as renames | PASS | `ls`, `git status` (`R`/`RM`), index `R100` |
| 2 | Layout equal to old file apart from IDs and comments; 6 rooms, 12 beds, 20 slots, tight ones correct, `kind`/`name:` unchanged | PASS | `layout_check.py` |
| 3 | ID/name git grep prints nothing | PASS | empty output |
| 4 | Audit source grep prints nothing; `AUDIT_SOURCES` exact; tests assert `map`/`form`/`admin` | PASS | empty output; `app/store.py:46`; `tests/test_api_write.py` lines 59, 164, 213, 248, 324, 413, 524, 526 |
| 5 | Test names renamed; no test deleted or skipped; counts as before | PASS | 384 and 199 on HEAD and now; name diff only renames |
| 6 | `uv run pytest` and `node --test tests/js/` pass | PASS | 384 passed; 199 pass |
| 7 | Server smoke on own port with fresh temp dir: `cabin-data.yaml` created, no `chata-data.yaml`, health, `cabin_group` cookie, new slot IDs in `layout`, backup `cabin-data-*` after assign | PASS | `api_check.py` (port 18801) |
| 8 | Page stores `cabin.clientId`, `cabin.myParty`, `cabin.role`, `cabin.noticeCollapsed`, no `chata.*` key | PASS | browser run, `localStorage` before and after reload |
| 9 | `compose.yaml` service `cabin`, image `cabin:latest`, `user: ${CABIN_UID:-1000}:…`; Dockerfile user `cabin`; `docker compose config` works | PASS | `docker compose config` (test secrets); the image was not built |
| 10 | Real `data/chata-data.yaml` renamed to `data/cabin-data.yaml`, nothing else changed | PASS | listing: `cabin-data.yaml` (94 bytes), empty `backups/`, no `chata-data.yaml`. Not opened |
| 11 | Migration rehearsal on a copy: script runs; version unchanged; per-night counts unchanged; backups renamed; `audit.yaml` byte-identical; server starts and the slot IDs are known | PASS | rehearsal section above; server on port 18802 |
| 12 | `CLAUDE.md` "Trial server" uses `/tmp/cabin-try` everywhere | PASS | line 45: `mkdir -p /tmp/cabin-try`, `/tmp/cabin-try/data`, `/tmp/cabin-try/server.log` |

Files I used or made (all outside the repo except the manual item): `/tmp/t027-tester/` (scripts, screenshots, hash lists), `/tmp/t027-rehearsal/data` (the copy). The repo change I made is the one-line addition in `tests/manual.md`.
