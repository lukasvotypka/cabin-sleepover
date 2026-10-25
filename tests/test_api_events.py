"""`GET /api/events` (T-052): broadcast, presence by connection, and a real uvicorn for streaming and shutdown.

httpx's ASGI transport buffers a whole response, so the hub is read directly here; the HTTP-level
checks (headers, 401, 429, SIGTERM) use a real uvicorn on a free port (never 8000 or 8010).
"""

import asyncio
import json
import os
import signal
import socket
import subprocess
import sys
import time

import httpx
import pytest

from app.events import MAX_PER_CLIENT
from tests.api_helpers import A1, FRI, THU, mk_party
from tests.conftest import ROOT, TEST_ENV
from tests.test_seen import add_party


def parse(chunk: str) -> tuple[str, dict]:
    lines = [ln for ln in chunk.split("\n") if ln.startswith(("event:", "data:"))]
    event = lines[0].removeprefix("event: ")
    return event, json.loads(lines[1].removeprefix("data: "))


async def next_frame(gen, timeout=2.0) -> tuple[str, dict]:
    return parse(await asyncio.wait_for(anext(gen), timeout))


async def open_stream(rt, party_id=None, client="c1"):
    conn = rt.hub.connect(client, party_id)
    gen = rt.hub.stream(conn, {"hello": 1})
    await anext(gen)  # the initial frame
    return conn, gen


async def test_write_broadcasts_state(group_client, app):
    rt = app.state.runtime
    _conn, gen = await open_stream(rt)
    await mk_party(group_client)
    event, data = await next_frame(gen)
    assert event == "state"
    assert data["version"] == 1
    assert [p["name"] for p in data["parties"]] == ["Ivan a Eva"]
    assert set(data) == set((await group_client.get("/api/state")).json()["state"])
    await gen.aclose()


async def test_every_write_broadcasts_but_a_skip_does_not(group_client, app):
    rt = app.state.runtime
    party = await mk_party(group_client)
    _conn, gen = await open_stream(rt)
    hdr = {"X-Client-Id": "c"}
    await group_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": party["id"]}, headers=hdr)
    assert (await next_frame(gen))[1]["version"] == 2
    await group_client.post("/api/clear", json={"night": THU, "slot": A1}, headers=hdr)
    assert (await next_frame(gen))[1]["version"] == 3
    await group_client.post("/api/clear", json={"night": THU, "slot": A1}, headers=hdr)  # already free: skipped
    with pytest.raises(TimeoutError):
        await next_frame(gen, timeout=0.2)
    await gen.aclose()


async def test_presence_on_connect_and_disconnect(group_client, app, make_party, clock):
    rt = app.state.runtime
    party = make_party()
    await add_party(app, party)
    _watcher, wgen = await open_stream(rt, client="watcher")
    conn, gen = await open_stream(rt, party.id, client="phone")
    event, data = await next_frame(wgen)  # the party's first stream opened
    assert event == "presence"
    assert data["online"] == [party.id]
    assert rt.hub.online_parties() == {party.id}
    clock.advance(10)
    await gen.aclose()  # the last stream of the party closed: last seen is now, online ends at once
    assert rt.seen.seen[party.id] == clock.now
    assert rt.hub.online_parties() == set()
    event, data = await next_frame(wgen)
    assert event == "presence"
    assert data["online"] == []
    assert conn.released
    await wgen.aclose()


async def test_polling_party_enters_and_ages_out(group_client, app, make_party, clock):
    rt = app.state.runtime
    party = make_party()
    await add_party(app, party)
    _conn, gen = await open_stream(rt)
    rt.loop = asyncio.get_running_loop()
    await group_client.get("/api/state", headers={"X-Party-Id": party.id})
    event, data = await next_frame(gen)
    assert (event, data["online"]) == ("presence", [party.id])
    clock.advance(76)
    rt.refresh_presence()
    event, data = await next_frame(gen)
    assert (event, data["online"]) == ("presence", [])
    rt.loop = None
    await gen.aclose()


async def test_etag_follows_the_online_set(group_client, app, make_party, clock):
    rt = app.state.runtime
    party = make_party()
    await add_party(app, party)
    before = (await group_client.get("/api/state")).headers["etag"]
    conn = rt.hub.connect("c", party.id)
    after = (await group_client.get("/api/state")).headers["etag"]
    assert after != before
    assert (await group_client.get("/api/state", headers={"If-None-Match": after})).status_code == 304
    rt.hub.release(conn)


async def test_cap_per_client_is_refused_by_the_hub(app, make_party):
    rt = app.state.runtime
    for _ in range(MAX_PER_CLIENT):
        rt.hub.connect("same", None)
    assert rt.hub.client_count("same") == MAX_PER_CLIENT


# --- real uvicorn --------------------------------------------------------------------------

TRIAL = (
    "import uvicorn, sys; from app.main import create_app; "
    "uvicorn.run(create_app(data_dir=sys.argv[2]), host='127.0.0.1', port=int(sys.argv[1]), "
    "workers=1, timeout_graceful_shutdown=3)"
)


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture
def server(tmp_path):
    port = free_port()
    assert port not in (8000, 8010)
    env = {**os.environ, **TEST_ENV}
    proc = subprocess.Popen(
        [sys.executable, "-c", TRIAL, str(port), str(tmp_path / "live-data")],
        cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(100):
            try:
                if httpx.get(f"{base}/api/health", timeout=1).status_code == 200:
                    break
            except httpx.HTTPError:
                time.sleep(0.1)
        else:
            pytest.fail("the test server did not start")
        yield proc, base
    finally:
        if proc.poll() is None:
            proc.kill()
        proc.wait(timeout=5)


def group_cookie(base: str) -> dict:
    resp = httpx.post(f"{base}/api/join", json={"code": TEST_ENV["GROUP_CODE"]}, timeout=5)
    token = next(c for c in resp.headers.get_list("set-cookie") if c.startswith("cabin_group=")).split(";")[0]
    return {"Cookie": token}


class Sse:
    """A streaming connection read frame by frame, with a timeout on every read."""

    def __init__(self, base: str, headers: dict, query: str = ""):
        self.cm = httpx.stream("GET", f"{base}/api/events{query}", headers=headers, timeout=5)
        self.resp = self.cm.__enter__()
        self.lines = self.resp.iter_lines()

    def frame(self) -> tuple[str, dict]:
        event = None
        for line in self.lines:
            if line.startswith("event: "):
                event = line.removeprefix("event: ")
            elif line.startswith("data: ") and event:
                return event, json.loads(line.removeprefix("data: "))
        raise AssertionError("stream ended")

    def close(self) -> None:
        self.cm.__exit__(None, None, None)


def test_live_stream_end_to_end(server):
    _proc, base = server
    cookie = group_cookie(base)
    # No cookie: JSON 401, no stream.
    resp = httpx.get(f"{base}/api/events", timeout=5)
    assert resp.status_code == 401 and resp.json()["error"]["code"] == "bad_code"

    party = httpx.post(
        f"{base}/api/parties", headers={**cookie, "X-Client-Id": "w"}, timeout=5,
        json={"name": "Ivan a Eva", "adults": 2, "kids": 0, "kids_in_parents_bed": 0, "arrive": THU, "leave": FRI},
    ).json()["party"]

    sse = Sse(base, cookie, f"?party={party['id']}&client=a")
    try:
        assert sse.resp.status_code == 200
        assert sse.resp.headers["content-type"].startswith("text/event-stream")
        assert sse.resp.headers["cache-control"] == "no-cache"
        assert sse.resp.headers["x-accel-buffering"] == "no"
        assert "content-encoding" not in sse.resp.headers
        event, data = sse.frame()
        assert event == "state" and party["id"] in data["presence"]["online"]
        assert data["version"] == 1

        wrote = httpx.post(
            f"{base}/api/assign", headers={**cookie, "X-Client-Id": "w"}, timeout=5,
            json={"night": THU, "slots": [A1], "party_id": party["id"]},
        )
        assert wrote.status_code == 200
        event, data = sse.frame()
        assert event == "state" and data["version"] == 2 and data["sleeping"][THU][A1] == party["id"]

        # A malformed party opens the stream without presence and without an error.
        odd = Sse(base, cookie, "?party=%20nope%20&client=b")
        try:
            assert odd.resp.status_code == 200
            assert odd.frame()[0] == "state"
        finally:
            odd.close()

        # Over the per-client cap: 429 JSON. Stream openings do not use the write limiter.
        extra = [Sse(base, cookie, "?client=cap") for _ in range(MAX_PER_CLIENT)]
        try:
            over = httpx.get(f"{base}/api/events?client=cap", headers=cookie, timeout=5)
            assert over.status_code == 429 and over.json()["error"]["code"] == "rate_limited"
        finally:
            for s in extra:
                s.close()
    finally:
        sse.close()


def test_sigterm_with_open_streams_exits_fast(server):
    proc, base = server
    cookie = group_cookie(base)
    streams = [Sse(base, cookie, f"?client=s{i}") for i in range(2)]
    for s in streams:
        assert s.frame()[0] == "state"
    started = time.monotonic()
    proc.send_signal(signal.SIGTERM)
    proc.wait(timeout=5)
    assert time.monotonic() - started < 5
    for s in streams:
        with pytest.raises((AssertionError, httpx.HTTPError)):
            s.frame()
        s.cm.__exit__(None, None, None)
