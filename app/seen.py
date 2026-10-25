"""Who was seen when: the "last seen" time per party and the "online" list (T-049).

Any request that passes the group cookie check and names an existing party in `X-Party-Id`
records that party's time. Memory always holds the newest time (epoch seconds). The file
`data/seen.yaml` (`{party_id: "iso"}`) is rewritten atomically, and for a given party at most
once per `PERSIST_INTERVAL` seconds. Recording never touches the data file, backups or audit.

Migration: when `seen.yaml` does not exist yet (the first start with this feature), every party
starts with the time of its `party-create` entry in `audit.yaml`, so it shows an age instead of
"never seen". `python -m app.seen seed <data_dir>` does the same for a data directory that
already has `seen.yaml`, filling in only the parties without a time (run it with the server stopped).
"""

import logging
import sys
import threading
from collections.abc import Callable, Collection
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

from app.store import _atomic_write

log = logging.getLogger("chrapa.seen")

ONLINE_WINDOW = 75  # seconds: a party that polled within this long is online (or has an open stream)
PERSIST_INTERVAL = 60  # seconds between file writes for one party


def creation_times(audit_path: Path) -> dict[str, float]:
    """Party ID -> epoch of its `party-create` audit entry. A missing file or a broken entry is skipped."""
    try:
        text = audit_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    except (OSError, UnicodeDecodeError) as exc:
        log.warning("%s: cannot read the audit file, no last seen times seeded (%s)", audit_path, exc)
        return {}
    times: dict[str, float] = {}
    # Entries start with their own "---" line; one broken entry must not hide the others.
    for chunk in text.split("\n---\n"):
        try:
            entry = yaml.safe_load(chunk)
        except yaml.YAMLError:
            continue
        if not isinstance(entry, dict) or entry.get("action") != "party-create":
            continue
        party_id, when = entry.get("party"), entry.get("time")
        if not isinstance(party_id, str) or not isinstance(when, str):
            continue
        try:
            times.setdefault(party_id, datetime.fromisoformat(when).timestamp())
        except ValueError:
            continue
    return times


def to_iso(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, UTC).isoformat(timespec="seconds")


class SeenTracker:
    def __init__(
        self, path: Path, clock: Callable[[], float], known_ids: Collection[str], audit_path: Path | None = None
    ):
        self.path = path
        self.clock = clock
        self.seen: dict[str, float] = {}
        # When a plain request (not an event stream) last named the party: the polling fallback for "online".
        # Stream activity only moves `seen`, so a closed tab goes offline at once instead of after the window.
        self.polled: dict[str, float] = {}
        self.written: dict[str, float] = {}  # when each party's time was last put into the file
        # Sync dependencies and endpoints run in FastAPI's thread pool, so the dicts need a lock.
        # The lock is a threading.Lock on purpose: the live stream code (event loop) and the sync
        # dependencies (thread pool) both call in, and no critical section awaits.
        self._lock = threading.Lock()
        # Party ids with at least one open event stream; they are online whatever their last seen time is.
        self.connected: Callable[[], Collection[str]] = lambda: ()
        if audit_path is not None and not path.exists():
            self.seed(audit_path, known_ids)
        else:
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

    def seed(self, audit_path: Path, known_ids: Collection[str]) -> int:
        """Give every known party without a time its creation time from the audit file. Returns how many."""
        added = 0
        with self._lock:
            for party_id, epoch in creation_times(audit_path).items():
                if party_id in known_ids and party_id not in self.seen:
                    self.seen[party_id] = self.written[party_id] = epoch
                    added += 1
            if added:
                try:
                    _atomic_write(self.path, {pid: to_iso(t) for pid, t in self.seen.items() if pid in known_ids})
                except OSError:
                    log.exception("could not write %s", self.path)
        if added:
            log.info("%s: seeded last seen of %d parties from %s", self.path, added, audit_path)
        return added

    def record(self, party_id: str | None, known_ids: Collection[str], polled: bool = True) -> None:
        """Remember now as the party's last seen time. Anything unknown or malformed is ignored.

        `polled=False` is for event stream activity (connect, ping, disconnect): it updates last seen only.
        """
        if not party_id or party_id not in known_ids:
            return
        with self._lock:
            now = self.clock()
            self.seen[party_id] = now
            if polled:
                self.polled[party_id] = now
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
        connected = set(self.connected())
        with self._lock:
            now = self.clock()
            seen = {pid: t for pid, t in self.seen.items() if pid in known_ids}
            polled = dict(self.polled)
        return {
            "server_time": to_iso(now),
            "last_seen": {pid: to_iso(t) for pid, t in seen.items()},
            "online": [pid for pid, t in seen.items() if pid in connected or now - polled.get(pid, float("-inf")) <= ONLINE_WINDOW],
        }


def main(argv: list[str]) -> int:
    """`python -m app.seen seed <data_dir>`: fill in missing last seen times from the audit file."""
    if len(argv) != 2 or argv[0] != "seed":
        print("usage: python -m app.seen seed <data_dir>", file=sys.stderr)
        return 2
    import time

    data_dir = Path(argv[1])
    try:
        data = yaml.safe_load((data_dir / "cabin-data.yaml").read_text(encoding="utf-8")) or {}
    except (OSError, UnicodeDecodeError, yaml.YAMLError) as exc:
        print(f"{data_dir / 'cabin-data.yaml'}: cannot read ({exc})", file=sys.stderr)
        return 1
    known = {p["id"] for p in data.get("parties") or [] if isinstance(p, dict) and isinstance(p.get("id"), str)}
    tracker = SeenTracker(data_dir / "seen.yaml", time.time, known)
    added = tracker.seed(data_dir / "audit.yaml", known)
    print(f"seeded {added} of {len(known)} parties")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    raise SystemExit(main(sys.argv[1:]))
