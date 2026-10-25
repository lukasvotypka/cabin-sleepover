"""Event hub (T-051). Tested without HTTP; ping interval and clock are injected."""

import asyncio
import json
from datetime import UTC, datetime

import pytest

from app import events
from app.events import EventHub, HubRefused

NOW = datetime(2026, 10, 25, 12, 0, tzinfo=UTC)


def make_hub(**kw):
    kw.setdefault("clock", lambda: NOW)
    kw.setdefault("ping_seconds", 30.0)
    return EventHub(**kw)


def parse(text):
    """Split one frame into (event, data)."""
    assert text.endswith("\n\n")
    lines = text.rstrip("\n").split("\n")
    event = next(x[7:] for x in lines if x.startswith("event: "))
    data = next(x[6:] for x in lines if x.startswith("data: "))
    return event, json.loads(data)


async def start(hub, client="c1", party=None, state=None):
    conn = hub.connect(client, party)
    gen = hub.stream(conn, state or {"version": 1})
    first = await anext(gen)
    return gen, first


async def test_first_frame_has_retry_and_state():
    hub = make_hub()
    gen, first = await start(hub, state={"name": "Chata č. 1"})
    assert first.startswith("retry: 3000\n\n")
    assert "\n" not in first.split("data: ", 1)[1].rstrip("\n")
    assert parse(first.split("\n\n", 1)[1] + "\n\n") == ("state", {"name": "Chata č. 1"})
    assert "Chata č. 1" in first  # ensure_ascii off
    assert not any(line.startswith(":") for line in first.split("\n"))  # no SSE comments
    await gen.aclose()


async def test_broadcast_reaches_all_connections():
    hub = make_hub()
    gens = [(await start(hub, client=f"c{i}"))[0] for i in range(3)]
    hub.publish_state({"version": 2})
    hub.publish_presence({"online": []})
    for gen in gens:
        assert parse(await anext(gen)) == ("state", {"version": 2})
        assert parse(await anext(gen)) == ("presence", {"online": []})
        await gen.aclose()


async def test_coalescing_keeps_only_latest():
    hub = make_hub()
    gen, _ = await start(hub)
    for i in range(100):
        hub.publish_state({"version": i})
        hub.publish_presence({"n": i})
    assert parse(await anext(gen)) == ("state", {"version": 99})
    assert parse(await anext(gen)) == ("presence", {"n": 99})
    nxt = asyncio.ensure_future(anext(gen))
    await asyncio.sleep(0.01)
    assert not nxt.done()  # nothing else pending
    nxt.cancel()
    await asyncio.gather(nxt, return_exceptions=True)
    await gen.aclose()


async def test_ping_has_server_time():
    hub = make_hub(ping_seconds=0.01)
    gen, _ = await start(hub)
    event, data = parse(await anext(gen))
    assert event == "ping"
    assert data == {"server_time": NOW.isoformat()}
    await gen.aclose()


async def test_cap_per_client():
    hub = make_hub()
    for _ in range(events.MAX_PER_CLIENT):
        hub.connect("c1", None)
    with pytest.raises(HubRefused):
        hub.connect("c1", None)
    hub.connect("c2", None)  # other clients are unaffected


async def test_cap_total(monkeypatch):
    monkeypatch.setattr(events, "MAX_TOTAL", 5)
    hub = make_hub()
    for i in range(5):
        hub.connect(f"c{i}", None)
    with pytest.raises(HubRefused):
        hub.connect("other", None)


async def test_presence_set_and_callback():
    seen = []
    hub = make_hub(on_online_change=lambda s: seen.append(set(s)))
    g1, _ = await start(hub, client="a", party="p-1")
    g2, _ = await start(hub, client="b", party="p-1")
    g3, _ = await start(hub, client="c", party=None)  # does not count
    assert hub.online_parties() == {"p-1"}
    assert seen == [{"p-1"}]  # only the first connection of the party
    await g1.aclose()
    assert hub.online_parties() == {"p-1"}
    assert seen == [{"p-1"}]
    await g2.aclose()
    assert hub.online_parties() == set()
    assert seen == [{"p-1"}, set()]
    await g3.aclose()
    assert hub.total == 0


async def test_close_ends_generators_and_refuses_new():
    hub = make_hub()
    gens = [(await start(hub, client=f"c{i}"))[0] for i in range(2)]
    hub.close()
    for gen in gens:
        with pytest.raises(StopAsyncIteration):
            await anext(gen)
    assert hub.total == 0
    with pytest.raises(HubRefused):
        hub.connect("new", None)


async def test_cleanup_after_cancellation_and_aclose():
    hub = make_hub()
    conn = hub.connect("c1", "p-1")
    gen = hub.stream(conn, {})
    await anext(gen)
    task = asyncio.ensure_future(anext(gen))
    await asyncio.sleep(0.01)
    task.cancel()
    await asyncio.gather(task, return_exceptions=True)
    await gen.aclose()
    assert hub.total == 0
    assert hub.client_count("c1") == 0
    assert hub.online_parties() == set()
