"""In-memory hub for live updates over Server-Sent Events (T-051).

Everything runs on the event loop only (no threads). Each connection keeps at most
one pending state and one pending presence payload (latest wins), so a slow reader
can never grow memory. The HTTP layer (T-052) calls `connect()` before it starts the
response, so a refusal can still become `429 rate_limited`, then iterates `stream()`.
"""

import asyncio
import json
from collections import Counter
from collections.abc import AsyncIterator, Callable
from datetime import UTC, datetime
from typing import Any

RETRY_MS = 3000
PING_SECONDS = 20.0
MAX_PER_CLIENT = 4
MAX_TOTAL = 200


class HubRefused(Exception):
    """A connection was refused (cap reached or hub closed). The HTTP layer maps it to 429."""


def dumps(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def frame(event: str, data_json: str) -> str:
    return f"event: {event}\ndata: {data_json}\n\n"


class Connection:
    def __init__(self, client_id: str, party_id: str | None) -> None:
        self.client_id = client_id
        self.party_id = party_id
        self.wake = asyncio.Event()
        self.state: str | None = None  # pending state frame, already serialized
        self.presence: str | None = None
        self.closed = False
        self.released = False


class EventHub:
    def __init__(
        self,
        *,
        clock: Callable[[], datetime] | None = None,
        ping_seconds: float = PING_SECONDS,
        on_online_change: Callable[[set[str]], None] | None = None,
    ) -> None:
        self._clock = clock or (lambda: datetime.now(UTC))
        self._ping_seconds = ping_seconds
        self._on_online_change = on_online_change
        self._connections: set[Connection] = set()
        self._per_client: Counter[str] = Counter()
        self._per_party: Counter[str] = Counter()
        self._closed = False

    @property
    def total(self) -> int:
        return len(self._connections)

    def client_count(self, client_id: str) -> int:
        return self._per_client[client_id]

    def online_parties(self) -> set[str]:
        """Party ids with at least one open connection."""
        return set(self._per_party)

    def connect(self, client_id: str, party_id: str | None) -> Connection:
        if self._closed:
            raise HubRefused("hub is closed")
        if len(self._connections) >= MAX_TOTAL:
            raise HubRefused("too many open connections")
        if self._per_client[client_id] >= MAX_PER_CLIENT:
            raise HubRefused("too many open connections for this client")
        conn = Connection(client_id, party_id)
        self._connections.add(conn)
        self._per_client[client_id] += 1
        if party_id is not None:
            self._per_party[party_id] += 1
            if self._per_party[party_id] == 1:
                self._notify_online()
        return conn

    def release(self, conn: Connection) -> None:
        """Remove a connection. Safe to call more than once."""
        if conn.released:
            return
        conn.released = True
        conn.closed = True
        self._connections.discard(conn)
        self._per_client[conn.client_id] -= 1
        if self._per_client[conn.client_id] <= 0:
            del self._per_client[conn.client_id]
        if conn.party_id is not None:
            self._per_party[conn.party_id] -= 1
            if self._per_party[conn.party_id] <= 0:
                del self._per_party[conn.party_id]
                self._notify_online()

    def _notify_online(self) -> None:
        if self._on_online_change is not None:
            self._on_online_change(self.online_parties())

    def publish_state(self, payload: Any) -> None:
        data = frame("state", dumps(payload))  # serialized once per broadcast
        for conn in self._connections:
            conn.state = data
            conn.wake.set()

    def publish_presence(self, presence: Any) -> None:
        data = frame("presence", dumps(presence))
        for conn in self._connections:
            conn.presence = data
            conn.wake.set()

    def drop_pending_presence(self, conn: Connection) -> None:
        """Forget a queued presence frame (the initial state frame already carries the presence)."""
        conn.presence = None

    def close(self) -> None:
        """End every generator and refuse new connections."""
        self._closed = True
        for conn in self._connections:
            conn.closed = True
            conn.wake.set()

    async def stream(self, conn: Connection, initial_state: Any) -> AsyncIterator[str]:
        try:
            yield f"retry: {RETRY_MS}\n\n" + frame("state", dumps(initial_state))
            while not conn.closed:
                try:
                    await asyncio.wait_for(conn.wake.wait(), timeout=self._ping_seconds)
                except TimeoutError:
                    yield frame("ping", dumps({"server_time": self._clock().isoformat()}))
                    continue
                if conn.closed:
                    break
                conn.wake.clear()
                state, conn.state = conn.state, None
                presence, conn.presence = conn.presence, None
                if state is not None:
                    yield state
                if presence is not None:
                    yield presence
        finally:
            self.release(conn)
