"""In-memory sliding-window rate limits.

The limits live in process memory, which is correct only because the app runs as a single
uvicorn worker. The clock is injectable so tests do not have to wait.
"""

import math
import time
from collections import deque
from collections.abc import Callable

WINDOW_SECONDS = 60.0
CODE_ATTEMPTS_PER_MINUTE = 10  # per IP, see "Bezpečnosť a limity" in proposal.md
_PRUNE_EVERY = 256  # calls between sweeps that drop keys with no recent hits


class SlidingWindowLimiter:
    """Allows at most `limit` hits per key within the last `window` seconds.

    A rejected hit is not recorded, so a client that keeps hammering gets in again as soon
    as its oldest allowed hit leaves the window.
    """

    def __init__(
        self,
        limit: int,
        window: float = WINDOW_SECONDS,
        clock: Callable[[], float] = time.monotonic,
    ):
        if limit < 1:
            raise ValueError("limit must be at least 1")
        self.limit = limit
        self.window = window
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        self._calls = 0

    def _recent(self, key: str, now: float) -> deque[float]:
        hits = self._hits.get(key)
        if hits is None:
            return deque()
        while hits and hits[0] <= now - self.window:
            hits.popleft()
        return hits

    def blocked(self, key: str) -> bool:
        """True when `key` has reached the limit. Counts nothing."""
        now = self._clock()
        self._calls += 1
        if self._calls % _PRUNE_EVERY == 0:
            self._prune(now)
        return len(self._recent(key, now)) >= self.limit

    def hit(self, key: str) -> None:
        """Count one hit for `key` unconditionally (use after `blocked()` returned False)."""
        now = self._clock()
        hits = self._recent(key, now)
        hits.append(now)
        self._hits[key] = hits

    def allow(self, key: str) -> bool:
        """Count one hit for `key`. False means the limit is reached and the hit was not counted."""
        if self.blocked(key):
            return False
        self.hit(key)
        return True

    def retry_after(self, key: str) -> int:
        """Whole seconds (at least 1) until `key` may hit again. 0 when it may hit now."""
        now = self._clock()
        hits = self._recent(key, now)
        if len(hits) < self.limit:
            return 0
        return max(1, math.ceil(hits[0] + self.window - now))

    def _prune(self, now: float) -> None:
        for key in [k for k in self._hits if not self._recent(k, now)]:
            del self._hits[key]
