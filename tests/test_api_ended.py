"""After the event (T-152): the reduced state, `event_ended` writes, no stream, no seen, ETag shape."""

import asyncio
import json
from datetime import date

import pytest
import yaml

from app.models import ConfigError, Event, load_layout
from app.validate import event_is_ended
from tests.api_helpers import A1, CLIENT, THU, backup_count, error_of, mk_party, snapshot
from tests.conftest import CABIN_YAML

REDUCED_KEYS = {"version", "updated_at", "event", "layout", "ended", "totals", "asset_version"}
AFTER = date(2026, 11, 9)


def event(**extra) -> Event:
    return Event(
        name="X", arrive_days=["2026-11-05"], leave_days=["2026-11-06", "2026-11-08"], nights=["2026-11-05"], **extra
    )


def test_event_is_ended_auto_with_real_config(layout):
    assert event_is_ended(layout.event, date(2026, 11, 8)) is False
    assert event_is_ended(layout.event, date(2026, 11, 9)) is True
    assert event_is_ended(layout.event, date(2026, 10, 1)) is False


def test_event_is_ended_overrides():
    assert event_is_ended(event(ended=True), date(2026, 1, 1)) is True
    assert event_is_ended(event(ended=False), date(2030, 1, 1)) is False
    assert event_is_ended(event(ended="auto"), date(2026, 11, 9)) is True
    assert event_is_ended(event(), date(2026, 11, 8)) is False


@pytest.mark.parametrize("value", ["maybe", "yes", 1, 0, "True", None])
def test_bad_ended_value_refuses_startup(layout_data, tmp_path, value):
    layout_data["event"]["ended"] = value
    path = tmp_path / "cabin.yaml"
    path.write_text(yaml.safe_dump(layout_data, allow_unicode=True), encoding="utf-8")
    with pytest.raises(ConfigError, match="ended"):
        load_layout(path)


def test_ended_is_not_sent_in_event(layout):
    assert "ended" not in layout.model_dump(mode="json")["event"]


@pytest.fixture
def today():
    box = {"d": date(2026, 10, 25)}
    return lambda: box["d"], box


async def make_ended(make_app, make_client, today, join="group-test-code"):
    """An app with two parties made before the event; the date then moves past it."""
    fn, box = today
    app = make_app(today=fn)
    async with make_client(app) as admin:
        await admin.post("/api/join", json={"code": "admin-test-code"})
        await mk_party(admin, "Ivan a Eva")
        await mk_party(admin, "Day Only", adults=1, kids=2, kids_in_parents_bed=0, arrive=THU, leave="2026-11-06")
    box["d"] = AFTER
    return app


async def test_reduced_state_and_totals(make_app, make_client, today):
    app = await make_ended(make_app, make_client, today)
    async with make_client(app) as c:
        await c.post("/api/join", json={"code": "group-test-code"})
        body = (await c.get("/api/state")).json()
        state = body["state"]
        assert set(state) == REDUCED_KEYS
        assert state["ended"] is True
        assert state["totals"] == {"people": 5, "parties": 2, "nights": 3}
        text = json.dumps(body)
        for needle in ("Ivan a Eva", "Day Only", "p-", "phone_hint"):
            assert needle not in text
        # an error body carries the same reduced state
        resp = await c.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": "p-aaaaaa"}, headers=CLIENT)
        assert resp.status_code == 403
        assert error_of(resp)["code"] == "event_ended"
        assert set(resp.json()["state"]) == REDUCED_KEYS
        assert "Ivan a Eva" not in resp.text


async def test_admin_gets_full_state(make_app, make_client, today):
    app = await make_ended(make_app, make_client, today)
    async with make_client(app) as admin:
        await admin.post("/api/join", json={"code": "admin-test-code"})
        state = (await admin.get("/api/state")).json()["state"]
        assert state["ended"] is True
        assert [p["name"] for p in state["parties"]] == ["Ivan a Eva", "Day Only"]
        assert {"sleeping", "presence", "signup_open"} <= set(state)
        party = state["parties"][0]
        resp = await admin.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": party["id"]}, headers=CLIENT)
        assert resp.status_code == 200
        assert resp.json()["state"]["sleeping"][THU][A1] == party["id"]


async def test_before_the_event_state_is_full_with_ended_false(group_client):
    state = (await group_client.get("/api/state")).json()["state"]
    assert state["ended"] is False
    assert "parties" in state and "totals" not in state


WRITES = [
    ("post", "/api/assign", {"night": THU, "slots": [A1], "party_id": "p-aaaaaa"}),
    ("post", "/api/assign-stay", {"slot": A1, "party_id": "p-aaaaaa", "nights": [THU]}),
    ("post", "/api/clear", {"night": THU, "slot": A1}),
    ("post", "/api/move", {"night": THU, "from_slot": A1, "to_slot": "left-double-2"}),
    ("post", "/api/parties", {"name": "New", "adults": 1, "kids": 0, "kids_in_parents_bed": 0, "arrive": THU, "leave": THU}),
    ("put", "/api/parties/p-aaaaaa", {"name": "Renamed"}),
    ("post", "/api/places", {"party_id": "p-aaaaaa", "night": THU, "count": 1}),
    ("post", "/api/briefing", {"party_id": "p-aaaaaa", "step": "water"}),
    ("post", "/api/food", {"party_id": "p-aaaaaa", "note": "x"}),
    ("post", "/api/parties/p-aaaaaa/login/start", {"phone": "+421900000000"}),
    ("post", "/api/parties/p-aaaaaa/login/verify", {"phone": "+421900000000", "code": "123456"}),
    ("post", "/api/parties/p-aaaaaa/phone/start", {"phone": "+421900000000"}),
    ("post", "/api/parties/p-aaaaaa/phone/verify", {"phone": "+421900000000", "code": "123456"}),
    ("put", "/api/parties/p-aaaaaa/phone", {"phone": "+421900000000"}),
    ("delete", "/api/parties/p-aaaaaa/phone", None),
]


@pytest.mark.parametrize(("method", "path", "body"), WRITES)
async def test_writes_are_refused_without_admin(make_app, make_client, today, method, path, body):
    app = await make_ended(make_app, make_client, today)
    before = snapshot(app)
    async with make_client(app) as c:
        await c.post("/api/join", json={"code": "group-test-code"})
        kwargs = {"headers": CLIENT}
        if body is not None:
            kwargs["json"] = body
        resp = await c.request(method.upper(), path, **kwargs)
        assert resp.status_code == 403, resp.text
        assert error_of(resp)["code"] == "event_ended"
        assert set(resp.json()["state"]) == REDUCED_KEYS
    assert snapshot(app) == before


async def test_events_refused_and_open_stream_closed(make_app, make_client, today):
    fn, box = today
    app = make_app(today=fn)
    async with make_client(app) as c:
        await c.post("/api/join", json={"code": "group-test-code"})
        await mk_party(c, "Ivan a Eva")
        box["d"] = AFTER
        resp = await c.get("/api/events")
        assert resp.status_code == 403
        assert error_of(resp)["code"] == "event_ended"


async def test_open_stream_is_closed_after_the_flip(make_app, make_client, today):
    fn, box = today
    app = make_app(today=fn)
    rt = app.state.runtime
    cookie = f"cabin_group={rt.cookies.issue('group')}"
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "GET", "scheme": "https",
        "path": "/api/events", "raw_path": b"/api/events", "query_string": b"", "root_path": "", "server": ("test", 443),
        "client": ("203.0.113.7", 50000), "headers": [(b"cookie", cookie.encode())],
    }
    sent: list[bytes] = []
    first = asyncio.Event()

    async def receive():
        await asyncio.sleep(3600)

    async def send(message):
        if message["type"] == "http.response.body" and message.get("body"):
            sent.append(message["body"])
            first.set()

    task = asyncio.create_task(app(scope, receive, send))
    await asyncio.wait_for(first.wait(), 2)
    box["d"] = AFTER
    rt.hub.publish_state({"parties": ["secret-party"]})
    await asyncio.wait_for(task, 2)  # the stream ends instead of sending the frame
    assert b"secret-party" not in b"".join(sent)
    assert rt.hub.total == 0


async def test_no_seen_and_empty_session_when_ended(make_app, make_client, today):
    app = await make_ended(make_app, make_client, today)
    rt = app.state.runtime
    party_id = next(iter(rt.known_ids))
    async with make_client(app) as c:
        await c.post("/api/join", json={"code": "group-test-code"})
        await c.get("/api/state", headers={"X-Party-Id": party_id})
        assert not rt.seen.path.exists() or party_id not in (yaml.safe_load(rt.seen.path.read_text()) or {})
        session = (await c.get("/api/session")).json()
        assert session == {"ok": True, "verified": [], "sms_enabled": False}


async def test_etag_changes_when_the_event_ends(make_app, make_client, today):
    fn, box = today
    app = make_app(today=fn)
    async with make_client(app) as c:
        await c.post("/api/join", json={"code": "group-test-code"})
        first = await c.get("/api/state")
        etag = first.headers["etag"]
        assert (await c.get("/api/state", headers={"If-None-Match": etag})).status_code == 304
        box["d"] = AFTER
        resp = await c.get("/api/state", headers={"If-None-Match": etag})
        assert resp.status_code == 200
        assert resp.json()["state"]["ended"] is True


async def test_health_and_join_unchanged(make_app, make_client, today):
    app = await make_ended(make_app, make_client, today)
    async with make_client(app) as c:
        assert (await c.get("/api/health")).status_code == 200
        assert (await c.post("/api/join", json={"code": "group-test-code"})).status_code == 200
        assert (await c.post("/api/join", json={"code": "nope"})).status_code == 401


async def test_logout_stays_open_after_the_event(make_app, make_client, today):
    app = await make_ended(make_app, make_client, today)
    async with make_client(app) as c:
        await c.post("/api/join", json={"code": "group-test-code"})
        resp = await c.post("/api/logout", json={"party_id": "p-aaaaaa"}, headers=CLIENT)
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


async def test_write_passing_the_guard_before_midnight_is_refused_at_commit(make_app, make_client, today):
    fn, box = today
    app = make_app(today=fn)
    async with make_client(app) as admin:
        await admin.post("/api/join", json={"code": "admin-test-code"})
        party = await mk_party(admin, "Ivan a Eva")
    box["d"] = date(2026, 11, 8)
    calls = {"n": 0}

    def flipping():
        calls["n"] += 1
        return box["d"] if calls["n"] == 1 else AFTER  # open at the route guard, ended at the commit

    app.state.runtime.today = flipping
    before = snapshot(app)
    async with make_client(app) as c:
        await c.post("/api/join", json={"code": "group-test-code"})
        calls["n"] = 0
        resp = await c.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": party["id"]}, headers=CLIENT)
        assert resp.status_code == 403
        assert error_of(resp)["code"] == "event_ended"
    assert snapshot(app) == before


async def test_admin_presence_stays_live_after_the_event(make_app, make_client, today):
    app = await make_ended(make_app, make_client, today)
    rt = app.state.runtime
    party_id = next(iter(rt.known_ids))
    rt.seen.record(party_id, rt.known_ids, polled=True)
    async with make_client(app) as admin:
        await admin.post("/api/join", json={"code": "admin-test-code"})
        first = await admin.get("/api/state")
        assert party_id in first.json()["state"]["presence"]["online"]
        assert first.headers["etag"].endswith('"') and "-ended" in first.headers["etag"]
        now = rt.seen.clock()
        rt.seen.clock = lambda: now + 200  # the polling window (75 s) is over
        second = await admin.get("/api/state", headers={"If-None-Match": first.headers["etag"]})
        assert second.status_code == 200
        assert second.json()["state"]["presence"]["online"] == []
