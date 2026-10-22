# T-002: `store.py`: YAML data file, lock, atomic write, backups, audit, startup check

- **Phase:** 1
- **Depends on:** T-001
- **Size:** M

## Goal
Make `data/chata-data.yaml` the safe single source of truth. One `asyncio.Lock` covers each read, change and write. Writes are atomic, a backup is taken before each write, an audit entry is appended after it, and a broken file stops the server from starting. Proposal sections: „Dáta v YAML“ („data/chata-data.yaml“, „data/audit.yaml“, „Zápis bez poškodenia súboru“) and „Architektúra“ (one process).

## Scope
- `app/store.py`
- `tests/test_store.py`

## Acceptance criteria
- [x] The data directory is a parameter (default `data/`), so tests use `tmp_path`. `data/` and `data/backups/` are created if missing.
- [x] A missing or empty `chata-data.yaml` is created as a fresh state: `version: 0`, `signup_open: true`, empty `parties` and `sleeping`, and a current `updated_at`.
- [x] Startup check, which refuses to start by raising a clear startup error. The message is in English and names the file and the exact problem:
  - [x] YAML syntax error (with line)
  - [x] Pydantic validation error (with the field path)
  - [x] unknown slot in `sleeping`
  - [x] unknown party ID in `sleeping`
  - [x] night not in `event.nights`
  - [x] duplicate party ID
  - [x] duplicate party name (case-insensitive)
  - [x] tests cover each case
- [x] One write transaction runs entirely under one `asyncio.Lock`:
  - [x] load the current file
  - [x] run the caller's change, which validates with `validate.py`
  - [x] back up the old file
  - [x] write atomically
  - [x] bump `version` and set `updated_at`
  - [x] append the audit entry
  - [x] return the new state
- [x] If the change raises a rule error, nothing is written: no backup, no audit entry, `version` unchanged. Tested.
- [x] Atomic write: a temp file in the same directory, then `flush`, `os.fsync`, `os.replace`. A test makes the write fail midway (for example by monkeypatching `os.replace` or the dump to raise) and asserts the original file is intact and no temp file is left behind.
- [x] Before each write, a timestamped copy goes to `data/backups/`. Only the newest `backups_keep` (from `config/app.yaml`, 50) are kept. A test does more than 50 writes, or sets a small `backups_keep`, and checks the count and that the newest one is kept.
- [x] Each write appends one YAML document to `data/audit.yaml`, separated by `---`, with:
  - [x] time
  - [x] action
  - [x] party
  - [x] night(s)
  - [x] slot(s)
  - [x] value before and value after
  - [x] `source` (`mapa`, `formular` or `admin`)
  - [x] `client_id`
  - [x] a test reads it back with `yaml.safe_load_all`
- [x] YAML is written only with `yaml.safe_dump(..., allow_unicode=True, sort_keys=False)`. Slovak characters in party names (e.g. „Vilčo“) stay readable in the file and are not escaped. Dates and times come back as strings after a round trip. Tested.
- [x] Reading state for `GET /api/state` returns the current file content (a new instance reading the same directory sees the same data, which simulates a restart). Tested.

## Notes for developer
- Single process is a correctness requirement. The lock is a process-level `asyncio.Lock`, not a file lock.
- Backup file names must be unique even within one second, because concurrent writes in tests happen in the same second. Use microseconds or the version in the name, and sort by name to prune.
- Timestamps carry the local offset, e.g. `datetime.now(ZoneInfo("Europe/Bratislava")).isoformat(timespec="seconds")`. Summer time ends on 25. 10. 2026, so do not hardcode `+02:00`.
- One write action gives one audit document, even when it touches several nights (`move`, `assign-stay`, party delete). Put the per-night and per-slot changes in a list inside that document.
- Keep the store API small, for example `async with store.write(action=…, source=…, client_id=…) as state:` or a `transact(fn)` helper. T-003 and T-004 build on it.
- Manual editing of the files is allowed only while the service is stopped (proposal). The startup check is what catches mistakes.

---
## Dev log

**Done.** New `app/store.py` and `tests/test_store.py`. Nothing else touched (`validate.py` and `models.py` are reused as they are).

API (T-003 and T-004 build on it):
- `Store(layout, *, data_dir="data", backups_keep=50)`. The constructor creates `data/` and `data/backups/`, creates a fresh file when it is missing or blank (size 0 or only whitespace), then runs the startup check. On any problem it raises `StartupError` with an English message naming the file and every problem found (all at once, not just the first).
- `store.read() -> State`: current file content, no lock (the file is only ever replaced atomically).
- `async with store.write(action=, source=, client_id=) as tx:` is the one write transaction under the `asyncio.Lock`. `tx.state` is a fresh `State` loaded from the file. The body validates with `validate.py` and mutates `tx.state`, and may call `tx.audit(party=, nights=, slots=, before=, after=, changes=)`. If the body raises (for example `RuleError`), nothing is written: no backup, no audit, no version bump. After the `with` block, `tx.state` is the new state (version and `updated_at` already bumped).
- `now_iso()`: local time with the offset (`Europe/Bratislava`, so no hardcoded `+02:00`). Callers use it for `Party.created_at` and `updated_at`.
- Commit order: bump version and `updated_at`, re-validate the result like at startup (a caller bug raises `RuntimeError` before any write), render the audit document, back up the old file, atomic write (temp file in the same dir, flush, `os.fsync`, `os.replace`, then a best-effort directory fsync), append the audit document with fsync.
- Backups: `backups/chata-data-<UTC time with microseconds>-v<old version>.yaml`, sorted by name and pruned to `backups_keep`. The caller passes `backups_keep` from `config/app.yaml`.
- Audit document keys: `time, version, action, source, client_id, party, nights, slots, before, after` (+ `changes` when given). `source` must be one of `mapa`, `formular`, `admin`, `ai` (the proposal lists `ai` for phase 2; any other value raises `ValueError`).
- Startup name-uniqueness check calls `validate.check_party_name`, so the rule stays only in `validate.py`.

Decisions and deviations to note:
- If appending to `audit.yaml` fails after the data file was already replaced, the error is logged and the write still returns success (otherwise the client would see a failure for a committed write and retry). The audit document is rendered before any write, so an unserializable audit detail fails the write cleanly.
- A comment-only data file is a startup error ("no content"), not silently replaced, so hand-written comments are never destroyed. Only a missing, empty or whitespace-only file is recreated.
- `zoneinfo` needs the system tz database (present on macOS and normal Linux). Follow-up for T-008 or the deploy notes: if the server image has no tzdata, `uv add tzdata`. I did not change `pyproject.toml`.
- `read()` parses and checks the file on every call (a few KB, polled every 30 s by ~15 people). A cache keyed on the file's mtime could be added later if needed.

Files: `/Users/luigi/workspace/chrapa-poll/app/store.py`, `/Users/luigi/workspace/chrapa-poll/tests/test_store.py` (44 tests: creation, each startup error, transaction order, rule error writes nothing, lock serialization of 10 concurrent writes, atomic-write failures via `os.replace` / `os.fsync` / dump, backup pruning with `backups_keep=5` and the default 50, unique backup names at a frozen instant, audit round trip with `yaml.safe_load_all`, Slovak text unescaped, strings stay strings, restart sees the same data).

Commands:
```
uv run pytest tests/test_store.py -q    # 44 passed
uv run pytest                           # whole suite: 227 passed
```
I also checked that the atomic-write test fails when the temp-file cleanup is removed, then restored the code.

All acceptance criteria verified and ticked.

## Review round 1
(reviewer appends)

Reviewer ran `uv run pytest -q`: 227 passed. `uv run pytest tests/test_store.py -q`: 44 passed. I also ran probes in a temp dir: an unquoted night key, a `~` night value and an unknown top-level key are each rejected at startup with the file path and field path. A truncated audit append makes `audit.yaml` unreadable (see Suggestion 3).

Acceptance criteria are all met, and the tests for each exist and pass. The transaction order matches „Konzistencia“ and „Zápis bez poškodenia súboru“: lock → load → caller change and validation → bump version and `updated_at` → re-validate the result → render the audit doc → backup → atomic write → audit append. The bump has to come before the write because `version` is stored in the file. The atomic write uses mkstemp in the same dir, flush, fsync, `os.replace` and a best-effort dir fsync, and it removes the temp file on any exception. `_commit` is synchronous, so a cancellation cannot interrupt it halfway. An exception from the body leaves through the `yield` before `_commit`, so nothing is written. YAML goes only through `safe_load` and `safe_dump(allow_unicode=True, sort_keys=False)`. The name-uniqueness rule is reused from `validate.check_party_name`, not duplicated. All messages are in English.

On the developer's stated decisions:
- **Audit append failure only logged:** accepted. The data write is already durable, and failing the request would lead the client to retry a write that was committed. See Suggestion 2 for making the lost entry recoverable.
- **Comment-only file is a startup error:** accepted. The proposal says a „prázdny alebo chýbajúci“ file is recreated, and a file with hand-written comments is not empty. Refusing to start with "delete it to start with a fresh one" is the conservative choice and destroys nothing.
- **`source` accepts `ai`:** correct. The proposal's `data/audit.yaml` section lists `mapa`, `formular`, `admin`, `ai`, and phase 2 (`/api/ai/apply`) needs it.
- **Timezone and `tzdata`:** using `ZoneInfo("Europe/Bratislava")` with no hardcoded offset is correct, and DST on 25. 10. is handled. See Suggestion 1 about the dependency.
- **`read()` without the lock:** a deviation from „každé čítanie … pod jedným zámkom“, but a sound one. The file is only replaced through `os.replace`, so a reader sees either the old file or the new one.

**Blocker**
- None.

**Suggestion**
1. `pyproject.toml`: run `uv add tzdata`. `app/store.py:45` resolves the zone at import time, so a host without `/usr/share/zoneinfo` fails at import with `ZoneInfoNotFoundError`. Examples are slim container images and some minimal VPS images. The uv-managed Python does not bundle tz data (TZPATH is system paths only). `zoneinfo` falls back to the `tzdata` package automatically, so the dependency is cheap and removes this deploy-time failure. If it is not added here, T-008 must record it in the README and deploy notes.
2. `app/store.py:253-255`: when the audit append fails, include the rendered `audit_doc` in the log record, for example `log.exception("… lost audit entry:\n%s", …, audit_doc)`. The entry (`before`, `after`, `client_id`) can then be recovered from journald, which keeps the proposal's „Každý zápis je v audit.yaml“ as close to true as possible.
3. `app/store.py:249-252`: a partial append can make the whole audit file unparseable. This can happen with ENOSPC, or with a crash during the write. The next `---` is glued to the truncated line, so `yaml.safe_load_all` fails from that point on, and the probe confirmed a `ParserError`. Two cheap mitigations: write each document with a single `os.write` on an `O_APPEND` fd, and start every document with `"\n---\n"` so a separator always begins a line. The proposal relies on the audit file for manual undo.
4. Store API: the Q5 default for T-004 is that `clear` on an already free slot returns `200` without writing, decided under the lock. Right now the only way to leave a transaction without a write is to raise. T-004 would need a private "nothing to do" exception in `main.py`, or a racy read before the lock. A small `tx.skip()` (or `tx.cancel()`) that makes `write()` return without backup, write, version bump or audit would keep the handlers thin. T-004's scope lists only `main.py`, so if this is not added now, the T-004 developer should be allowed to add it to `store.py`.
5. ETag reuse after a manual restore: if the organizer restores an older backup while the service is stopped, `version` goes back, and version numbers get reused for different content. A client holding an `ETag` from before could then get a `304` for stale data. This is not for this task. Note it for T-003 (for example, include `updated_at` in the ETag) or for T-008 (README: after a restore, set `version` higher than the last one).

**Nit**
- `app/store.py:261`: the prune glob `chata-data-*.yaml` also matches files the organizer copies into `backups/` by hand, such as `chata-data-pred-opravou.yaml`. Letters sort after digits, so such a file always looks like the newest and is never pruned, and each one takes the place of a real backup. A stricter pattern such as `chata-data-2*-v*.yaml` would avoid that.
- Stale `.chata-data.yaml.*.tmp` files from a crash during a write are never cleaned up. Deleting them at startup would keep `data/` tidy.
- `read()` raises `StartupError` at runtime when the file is broken. T-003 should map that to a 500 without leaking the path. Leaving the class name is fine.
- `_commit` does up to four `fsync` calls on the event loop while holding the lock. That is fine at this scale and only worth knowing.

Verdict: APPROVED. Round 2 skipped, no blockers.

## Review round 2
(reviewer appends)

## Test report

Tester run on 2026-10-22. No HTTP app exists yet, so `app/store.py` was exercised directly with a throw-away probe script (`/tmp/t002probe/probe.py`, outside the repo, temp dirs only, never the real `data/` or `.env`). No tests were added to `tests/`. No application code was changed.

### Commands and results
- `uv run pytest -q` -> 227 passed (includes all of T-001: `test_models.py`, `test_validate.py`).
- `uv run pytest tests/test_store.py -q` -> 44 passed.
- `uv run python /tmp/t002probe/probe.py` -> 86 checks, 85 PASS. The one "FAIL" (`newest kept (v000007..9)`) is a mistake in my probe (wrong string slice). The directory listing it printed is correct: `...-v000007.yaml`, `-v000008`, `-v000009` with `backups_keep=3` after 10 writes. It is not a product bug.
- Node tests (`node --test tests/js/`): not applicable yet, no page logic exists.

### Acceptance criteria (verified independently by running the code)
| Criterion | Result |
| --- | --- |
| Data dir is a parameter (default `data`), `data/` and `data/backups/` created if missing (tried a nested non-existing path) | pass |
| Missing, empty or whitespace-only file is created fresh: `version: 0`, `signup_open: true`, empty `parties`/`sleeping`, `updated_at` current with local offset, stored as a string | pass |
| Startup: YAML syntax error names file, line and column | pass |
| Startup: Pydantic error names file and field path (`version`, `parties`, whole-file wrong type, bool `version`, unquoted date key) | pass |
| Startup: unknown slot, unknown party ID, night not in `event.nights`, duplicate party ID, duplicate name ignoring case (`Vilčo` vs `VILČO`). All raise `StartupError`, in English, naming `chata-data.yaml`, and all problems are listed at once. The file is left untouched | pass |
| Write transaction under one lock: load, change, backup, atomic write, bump `version` and `updated_at`, audit, return new state (`tx.state`) | pass |
| Rule error or any exception in the body (also mutate-then-raise): no backup, no audit, version unchanged, file byte-identical, lock released afterwards | pass |
| Atomic write: `os.replace` failure, `os.fsync` failure and a dump that dies midway: original intact, no `.tmp` left, no audit written, store usable afterwards | pass |
| Backup before each write (content is the previous version), unique microsecond names, pruned to `backups_keep`: keep=3 after 10 writes leaves the newest 3; default 50 after 55 writes leaves 50 and the oldest 5 are gone; `backups_keep=0` rejected | pass |
| Audit: one `---` document per write with time, version, action, source, client_id, party, nights, slots, before, after; reads back with `yaml.safe_load_all`; 55 writes give 55 documents; versions contiguous; invalid `source` raises `ValueError` | pass |
| Only `safe_dump(allow_unicode=True, sort_keys=False)`: `Vilčo „Šťastný“` is readable in the data file and in the audit, no `\u` escapes. Dates, times and night keys come back as strings | pass |
| `read()` and a new `Store` on the same directory see the same data (restart); restart adds no backup and no audit entry | pass |

### Extra scenarios tried
- 20 concurrent `assign` to the same slot via `asyncio.gather` (with a yield inside the lock): exactly 1 wins, 19 get `RuleError`, version +1 only, one audit document.
- 20 concurrent writes to 20 different slots: no lost update (20 entries, version 22), audit versions 1..22 contiguous, 22 unique backup names within the same second.
- Caller bug (writes an unknown slot into the state): `RuntimeError`, file unchanged.
- Corrupt file edited while the store is running: `read()` and `write()` raise `StartupError`, the file is not overwritten and no backup is made.
- Invalid UTF-8, a NUL character, a top-level list, a comment-only file: clear `StartupError` that names the file.
- Audit append failure (path blocked by a directory): the data write stays committed and the write returns success, as documented.

### Observations, not failures
- Confirmed the reviewer's nit: a hand-made file `backups/chata-data-pred-opravou.yaml` counts toward `backups_keep` and is never pruned. With `backups_keep=2`, only one real backup remained. A stricter prune glob (`chata-data-2*-v*.yaml`) would fix it. Not part of the acceptance criteria.
- The reviewer's other suggestions (`tzdata` dependency, logging the lost audit document, a glued `---` after a partial audit append, a `tx.skip()` for T-004, ETag reuse after a manual restore) were not re-tested and are not blocking.
- No `tests/manualne.md` exists yet (T-008 owns it), so I did not create it. Items for T-008 to add: (1) on the real host, check that `data/` is writable by the service user and that `chata-data.yaml`, `audit.yaml` and `backups/` appear after the first start; (2) restore drill: stop the service, copy a backup over `chata-data.yaml`, start, check that the page shows the restored state and (see review suggestion 5) bump `version` above the last one served; (3) stop the service, corrupt the file, check that the service refuses to start and the journal shows the English message with the file name; (4) confirm `tzdata` or the system tz database exists on the server (the import of `store.py` needs `Europe/Bratislava`).

### Bugs
None.

Verdict: PASS, T-002 moved to `tasks/done/`.
