"""The data file `data/chata-data.yaml`: the single source of truth, with safe writes.

One process, one `asyncio.Lock`. Every write runs as a transaction under that lock:
load the current file, let the caller change the state (the caller validates with
`app/validate.py`), back up the old file, write atomically, bump `version`, append
one audit document, return the new state. If the caller raises, nothing is written.

Usage (T-003 and T-004 build on this):

    async with store.write(action="assign", source="mapa", client_id=cid) as tx:
        validate.check_assign(tx.state, layout, ...)      # may raise RuleError: nothing is written
        tx.state.sleeping.setdefault(night, {})[slot] = party_id
        tx.audit(party=party_id, nights=[night], slots=[slot], before=None, after=party_id)
    new_state = tx.state        # version and updated_at are already bumped here

Reading is `store.read()`. The file is only ever replaced atomically, so a read needs no lock.
Manual edits of the files are allowed only while the service is stopped. The startup check
(`Store(...)` itself) refuses to start on any mistake and says exactly what is wrong.
"""

import asyncio
import logging
import os
import shutil
import tempfile
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import yaml
from pydantic import ValidationError

from app.models import Layout, State, format_validation_error
from app.validate import RuleError, check_party_name

log = logging.getLogger("chrapa.store")

DATA_FILE = "chata-data.yaml"
AUDIT_FILE = "audit.yaml"
BACKUP_DIR = "backups"
TIMEZONE = ZoneInfo("Europe/Bratislava")
AUDIT_SOURCES = frozenset({"mapa", "formular", "admin", "ai"})


class StartupError(Exception):
    """The data file is unusable. The message names the file and the exact problems."""


def now_iso() -> str:
    """Current local time with its offset, to the second (summer time ends on 2026-10-25)."""
    return datetime.now(TIMEZONE).isoformat(timespec="seconds")


def _dump(data: Any, stream=None) -> str | None:
    return yaml.safe_dump(data, stream, allow_unicode=True, sort_keys=False)


def _fsync_dir(path: Path) -> None:
    """Make a rename durable. Best effort: not every platform can open a directory."""
    try:
        fd = os.open(path, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(fd)
    except OSError:
        pass
    finally:
        os.close(fd)


def _atomic_write(path: Path, data: Any) -> None:
    """Dump to a temp file in the same directory, flush, fsync, then replace. No temp file is left on failure."""
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            _dump(data, fh)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise
    _fsync_dir(path.parent)


def _data_problems(state: State, layout: Layout) -> list[str]:
    """Everything wrong with a parsed state against the layout. An empty list means it is fine."""
    problems: list[str] = []
    seen_ids: set[str] = set()
    for i, party in enumerate(state.parties):
        if party.id in seen_ids:
            problems.append(f"parties[{i}].id: duplicate party ID “{party.id}”")
        seen_ids.add(party.id)
        try:  # the same rule as for a new party: names are unique ignoring case
            check_party_name(state.model_copy(update={"parties": state.parties[:i]}), party.name)
        except RuleError as exc:
            problems.append(
                f"parties[{i}].name: duplicate party name “{party.name}” (same as party {exc.params['party_id']}, ignoring case)"
            )
    nights, slots = set(layout.event.nights), set(layout.slot_ids)
    for night, by_slot in state.sleeping.items():
        if night not in nights:
            problems.append(f"sleeping.{night}: night is not in event.nights of chata.yaml")
        for slot, party_id in by_slot.items():
            where = f"sleeping.{night}.{slot}"
            if slot not in slots:
                problems.append(f"{where}: unknown slot (not in chata.yaml)")
            if party_id not in seen_ids:
                problems.append(f"{where}: unknown party ID “{party_id}”")
    return problems


@dataclass
class Transaction:
    """What a write body works with. `state` is a private copy that is saved when the body ends without error."""

    state: State
    audit_details: dict[str, Any] = field(default_factory=dict)
    skipped: bool = False

    def skip(self) -> None:
        """End the transaction without writing: no version bump, backup or audit (e.g. `clear` on a free slot)."""
        self.skipped = True

    def audit(
        self,
        *,
        party: str | None = None,
        nights: Sequence[str] = (),
        slots: Sequence[str] = (),
        before: Any = None,
        after: Any = None,
        changes: Sequence[dict[str, Any]] | None = None,
    ) -> None:
        """Describe the write for `audit.yaml`. One action gives one audit document, even across several nights.

        `before` and `after` are plain YAML values (use `model_dump()` for models). `changes` is an optional
        per-night, per-slot list for actions that touch many places (move, assign-stay, party delete).
        """
        details: dict[str, Any] = {"party": party, "nights": list(nights), "slots": list(slots), "before": before, "after": after}
        if changes is not None:
            details["changes"] = list(changes)
        self.audit_details = details


class Store:
    def __init__(self, layout: Layout, *, data_dir: str | Path = "data", backups_keep: int = 50):
        if backups_keep < 1:
            raise ValueError("backups_keep must be at least 1")
        self.layout = layout
        self.data_dir = Path(data_dir)
        self.backups_keep = backups_keep
        self.data_path = self.data_dir / DATA_FILE
        self.audit_path = self.data_dir / AUDIT_FILE
        self.backup_dir = self.data_dir / BACKUP_DIR
        self._lock = asyncio.Lock()
        self._startup()

    # --- startup and reading ------------------------------------------------

    def _startup(self) -> None:
        self.backup_dir.mkdir(parents=True, exist_ok=True)  # also creates data_dir
        if not self.data_path.exists() or self._is_blank():
            self._create_fresh()
        self._load()  # raises StartupError when the file is wrong

    def _is_blank(self) -> bool:
        try:
            return not self.data_path.read_text(encoding="utf-8").strip()
        except (OSError, UnicodeDecodeError):
            return False  # _load reports the real problem

    def _create_fresh(self) -> None:
        log.info("creating a fresh %s", self.data_path)
        _atomic_write(self.data_path, State(version=0, updated_at=now_iso()).model_dump())

    def _load(self) -> State:
        path = self.data_path
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            raise StartupError(f"{path}: cannot read file ({exc})") from exc
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            mark = getattr(exc, "problem_mark", None)
            where = f" at line {mark.line + 1}, column {mark.column + 1}" if mark else ""
            problem = getattr(exc, "problem", None) or str(exc)
            raise StartupError(f"{path}: invalid YAML{where}: {problem}") from exc
        if data is None:  # only comments or blanks, e.g. emptied by hand while stopped
            raise StartupError(f"{path}: the file has no content (delete it to start with a fresh one)")
        try:
            state = State.model_validate(data)
        except ValidationError as exc:
            raise StartupError(format_validation_error(exc, str(path))) from exc
        problems = _data_problems(state, self.layout)
        if problems:
            raise StartupError("\n".join([f"{path}: data does not match chata.yaml", *(f"  {p}" for p in problems)]))
        return state

    def read(self) -> State:
        """Current content of the data file (for `GET /api/state`). A new Store on the same directory sees the same."""
        return self._load()

    # --- writing ----------------------------------------------------------------

    @asynccontextmanager
    async def write(self, *, action: str, source: str, client_id: str | None) -> AsyncIterator[Transaction]:
        """One write transaction under the lock. See the module docstring."""
        if source not in AUDIT_SOURCES:
            raise ValueError(f"unknown audit source {source!r}")
        async with self._lock:
            tx = Transaction(state=self._load())
            old_version = tx.state.version
            yield tx  # an exception from the body leaves here: nothing is written
            if tx.skipped:
                return
            self._commit(tx, old_version, action, source, client_id)

    def _commit(self, tx: Transaction, old_version: int, action: str, source: str, client_id: str | None) -> None:
        state = tx.state
        state.version = old_version + 1
        state.updated_at = now_iso()
        data = state.model_dump()
        # A caller bug must not corrupt the file: check the result like at startup, before writing anything.
        try:
            checked = State.model_validate(data)
        except ValidationError as exc:
            raise RuntimeError(format_validation_error(exc, "new state")) from exc
        problems = _data_problems(checked, self.layout)
        if problems:
            raise RuntimeError("new state does not match chata.yaml: " + "; ".join(problems))
        entry = {
            "time": state.updated_at,
            "version": state.version,
            "action": action,
            "source": source,
            "client_id": client_id,
            "party": None,
            "nights": [],
            "slots": [],
            "before": None,
            "after": None,
            **tx.audit_details,
        }
        # Rendered first, so an unserializable detail fails before any write. The entry starts with its own
        # separator, so a truncated earlier entry cannot swallow this one.
        audit_doc = "\n---\n" + _dump(entry)
        self._backup(old_version)
        _atomic_write(self.data_path, data)
        try:
            # Unbuffered binary append: the whole entry goes out in one write call.
            with open(self.audit_path, "ab", buffering=0) as fh:
                fh.write(audit_doc.encode("utf-8"))
                os.fsync(fh.fileno())
        except OSError:
            # The write is already committed, so the client must not see a failure and retry.
            # The full entry goes to the log so that it can be restored by hand.
            log.exception(
                "could not append to %s (write %s, version %d), entry:%s",
                self.audit_path, action, state.version, audit_doc,
            )

    def _backup(self, version: int) -> None:
        """Copy the current file to backups/ (UTC time with microseconds, then version) and prune the old ones."""
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
        shutil.copyfile(self.data_path, self.backup_dir / f"chata-data-{stamp}-v{version:06d}.yaml")
        backups = sorted(self.backup_dir.glob("chata-data-*.yaml"))
        for old in backups[: max(0, len(backups) - self.backups_keep)]:
            old.unlink(missing_ok=True)
