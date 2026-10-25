"""Who was seen when: the "last seen" time per party and the "online" list (T-049).

Any request that passes the group cookie check and names an existing party in `X-Party-Id`
records that party's time. Memory always holds the newest time (epoch seconds). The file
`data/seen.yaml` (`{party_id: "iso"}`) is rewritten atomically, and for a given party at most
once per `PERSIST_INTERVAL` seconds. Recording never touches the data file, backups or audit.
"""

import logging
import threading
from collections.abc import Callable, Collection
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

from app.store import _atomic_write

log = logging.getLogger("chrapa.seen")

ONLINE_WINDOW = 75  # seconds: a party seen within this long is online
PERSIST_INTERVAL = 60  # seconds between file writes for one party


def to_iso(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, UTC).isoformat(timespec="seconds")


class SeenTracker:
    def __init__(self, path: Path, clock: Callable[[], float], known_ids: Collection[str]):
        self.path = path
        self.clock = clock
        self.seen: dict[str, float] = {}
        self.written: dict[str, float] = {}  # when each party's time was last put into the file
        # Sync dependencies and endpoints run in FastAPI's thread pool, so the dicts need a lock.
        self._lock = threading.Lock()
        self._load(set(known_ids))

    def _load(self, known_ids: set[str]) -> None:
        try:
            text = self.path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return
        except (OSError, UnicodeDecodeError) as exc:
            log.warning("%s: cannot read the file, starting with empty seen data (%s)", self.path, exc)
            return
        try:
            data: Any = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            log.warning("%s: invalid YAML, starting with empty seen data (%s)", self.path, exc)
            return
        if data is None:
            return
        if not isinstance(data, dict):
            log.warning("%s: expected a mapping of party ID to time, starting with empty seen data", self.path)
            return
        for party_id, value in data.items():
            if party_id not in known_ids:
                log.warning("%s: dropping unknown party ID %r", self.path, party_id)
                continue
            try:
                epoch = datetime.fromisoformat(value).timestamp()
            except (TypeError, ValueError):
                log.warning("%s: dropping bad time for %s", self.path, party_id)
                continue
            self.seen[party_id] = epoch
            self.written[party_id] = epoch

    def record(self, party_id: str | None, known_ids: Collection[str]) -> None:
        """Remember now as the party's last seen time. Anything unknown or malformed is ignored."""
        if not party_id or party_id not in known_ids:
            return
        with self._lock:
            now = self.clock()
            self.seen[party_id] = now
            if now - self.written.get(party_id, float("-inf")) >= PERSIST_INTERVAL:
                self._persist(known_ids, party_id, now)

    def _persist(self, known_ids: Collection[str], party_id: str, now: float) -> None:
        data = {pid: to_iso(t) for pid, t in self.seen.items() if pid in known_ids}
        try:
            _atomic_write(self.path, data)
        except OSError:
            log.exception("could not write %s", self.path)
        self.written[party_id] = now  # also after a failure, so a broken disk is not hit on every request

    def presence(self, known_ids: Collection[str]) -> dict[str, Any]:
        """The `presence` object of the state: only parties that exist are listed."""
        with self._lock:
            now = self.clock()
            seen = {pid: t for pid, t in self.seen.items() if pid in known_ids}
        return {
            "server_time": to_iso(now),
            "last_seen": {pid: to_iso(t) for pid, t in seen.items()},
            "online": [pid for pid, t in seen.items() if now - t <= ONLINE_WINDOW],
        }
