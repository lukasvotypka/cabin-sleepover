import pytest

from app.ratelimit import SlidingWindowLimiter


def test_allows_up_to_the_limit_then_rejects(clock):
    limiter = SlidingWindowLimiter(3, clock=clock)
    assert [limiter.allow("a") for _ in range(4)] == [True, True, True, False]


def test_window_rolls_over(clock):
    limiter = SlidingWindowLimiter(2, window=60, clock=clock)
    assert limiter.allow("a")
    clock.advance(30)
    assert limiter.allow("a")
    assert not limiter.allow("a")
    clock.advance(29.9)  # the first hit is 59.9 s old: still inside
    assert not limiter.allow("a")
    clock.advance(0.2)  # now it is 60.1 s old: out, the second one (30.1 s) stays
    assert limiter.allow("a")
    assert not limiter.allow("a")


def test_rejected_hits_are_not_counted(clock):
    limiter = SlidingWindowLimiter(1, window=60, clock=clock)
    assert limiter.allow("a")
    for _ in range(5):
        clock.advance(10)
        assert not limiter.allow("a")
    clock.advance(10)  # 60 s after the only counted hit
    assert limiter.allow("a")


def test_keys_are_independent(clock):
    limiter = SlidingWindowLimiter(1, clock=clock)
    assert limiter.allow("a")
    assert not limiter.allow("a")
    assert limiter.allow("b")


def test_retry_after(clock):
    limiter = SlidingWindowLimiter(1, window=60, clock=clock)
    assert limiter.retry_after("a") == 0
    limiter.allow("a")
    assert limiter.retry_after("a") == 60
    clock.advance(59.5)
    assert limiter.retry_after("a") == 1
    clock.advance(1)
    assert limiter.retry_after("a") == 0


def test_idle_keys_are_pruned(clock):
    limiter = SlidingWindowLimiter(1, window=60, clock=clock)
    for i in range(300):
        limiter.allow(f"k{i}")
    clock.advance(61)
    for i in range(300):  # enough calls to trigger a sweep
        limiter.allow("fresh")
    assert set(limiter._hits) == {"fresh"}


def test_limit_must_be_positive():
    with pytest.raises(ValueError):
        SlidingWindowLimiter(0)


def test_blocked_counts_nothing_and_hit_counts_one(clock):
    limiter = SlidingWindowLimiter(2, window=60, clock=clock)
    for _ in range(5):
        assert not limiter.blocked("a")
    limiter.hit("a")
    assert not limiter.blocked("a")
    limiter.hit("a")
    assert limiter.blocked("a")
    assert not limiter.blocked("b")
    clock.advance(61)
    assert not limiter.blocked("a")
