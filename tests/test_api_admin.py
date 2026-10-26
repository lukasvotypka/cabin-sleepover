"""Admin endpoints: delete party, signup lock, export; and what the lock does and does not close."""

import yaml

from tests.api_helpers import A1, A2, CLIENT, FRI, PALETTE, THU, audit_docs, backup_count, error_of, mk_party, snapshot
from tests.conftest import TEST_ENV

ADMIN_REQUESTS = [
    ("delete", "/api/parties/p-abcdef", None),
    ("post", "/api/admin/signup", {"open": False}),
    ("post", "/api/admin/phone-verify", {"on": False}),
    ("get", "/api/admin/export", None),
]


async def send(client, method, url, body=None):
    return await client.request(method.upper(), url, json=body, headers=CLIENT)


# --- access ------------------------------------------------------------------------------


async def test_admin_endpoints_need_a_cookie(client, app):
    before = snapshot(app)
    for method, url, body in ADMIN_REQUESTS:
        resp = await send(client, method, url, body)
        assert (resp.status_code, error_of(resp)["code"]) == (401, "bad_code"), url
    assert snapshot(app) == before


async def test_admin_endpoints_refuse_the_group_cookie(app, group_client):
    before = snapshot(app)
    for method, url, body in ADMIN_REQUESTS:
        resp = await send(group_client, method, url, body)
        assert (resp.status_code, error_of(resp)["code"]) == (403, "forbidden"), url
    assert snapshot(app) == before


async def test_admin_writes_count_toward_the_write_limit(app, admin_client):
    limit = app.state.runtime.write_limiter.limit
    for _ in range(limit):
        assert (await send(admin_client, "post", "/api/admin/signup", {"open": True})).status_code == 200
    resp = await send(admin_client, "post", "/api/admin/signup", {"open": True})
    assert (resp.status_code, error_of(resp)["code"]) == (429, "rate_limited")


# --- delete party --------------------------------------------------------------------------


async def test_delete_frees_slots_and_drops_party_data(app, admin_client):
    ivan = await mk_party(admin_client)
    riso = await mk_party(admin_client, "Riso a Ben")
    await admin_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": ivan["id"]})
    await admin_client.post("/api/assign", json={"night": FRI, "slots": [A1], "party_id": ivan["id"]})
    await admin_client.post("/api/assign", json={"night": THU, "slots": [A2], "party_id": riso["id"]})
    await admin_client.post("/api/briefing", json={"party_id": ivan["id"], "step": "water"})
    await admin_client.post("/api/food", json={"party_id": ivan["id"], "text": "chlieb"})
    rt = app.state.runtime
    rt.seen.record(ivan["id"], rt.known_ids)
    before = snapshot(app)

    resp = await send(admin_client, "delete", f"/api/parties/{ivan['id']}")
    assert resp.status_code == 200
    state = resp.json()["state"]
    assert [p["id"] for p in state["parties"]] == [riso["id"]]
    assert state["sleeping"] == {THU: {A2: riso["id"]}}
    assert ivan["id"] not in state["briefing"]
    assert ivan["id"] not in state["presence"]["last_seen"]
    assert snapshot(app) == (before[0] + 1, before[1] + 1, before[2] + 1)
    doc = audit_docs(app)[-1]
    assert (doc["action"], doc["source"], doc["party"], doc["after"]) == ("party-delete", "admin", ivan["id"], None)
    assert doc["before"]["name"] == "Ivan a Eva" and doc["before"]["food_note"] == "chlieb"
    assert doc["nights"] == [THU, FRI] and doc["slots"] == [A1, A1]
    seen_file = yaml.safe_load(rt.seen.path.read_text(encoding="utf-8")) or {}
    assert ivan["id"] not in seen_file


async def test_delete_unknown_party(app, admin_client):
    before = snapshot(app)
    resp = await send(admin_client, "delete", "/api/parties/p-abcdef")
    assert (resp.status_code, error_of(resp)["code"]) == (404, "unknown_party")
    assert snapshot(app) == before


async def test_a_freed_color_is_given_out_again(admin_client):
    first = await mk_party(admin_client, "Prvá")
    second = await mk_party(admin_client, "Druhá")
    assert (first["color"], second["color"]) == (PALETTE[0], PALETTE[1])
    await send(admin_client, "delete", f"/api/parties/{first['id']}")
    third = await mk_party(admin_client, "Tretia")
    assert third["color"] == PALETTE[0]


# --- signup lock -----------------------------------------------------------------------------


async def test_signup_toggle_commits_and_audits(app, admin_client):
    before = snapshot(app)
    resp = await send(admin_client, "post", "/api/admin/signup", {"open": False})
    assert resp.status_code == 200
    assert resp.json()["state"]["signup_open"] is False
    assert snapshot(app) == (before[0] + 1, before[1] + 1, before[2] + 1)
    doc = audit_docs(app)[-1]
    assert (doc["action"], doc["source"], doc["before"], doc["after"]) == ("signup", "admin", True, False)
    resp = await send(admin_client, "post", "/api/admin/signup", {"open": True})
    assert resp.json()["state"]["signup_open"] is True


async def test_signup_rejects_a_non_bool(app, admin_client):
    before = snapshot(app)
    for body in ({"open": "yes"}, {"open": 1}, {}, {"open": False, "x": 1}):
        resp = await send(admin_client, "post", "/api/admin/signup", body)
        assert (resp.status_code, error_of(resp)["code"]) == (422, "invalid"), body
    assert snapshot(app) == before


async def test_lock_closes_places_but_not_briefing_and_food(app, make_client, admin_client):
    ivan = await mk_party(admin_client)
    await admin_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": ivan["id"]})
    await send(admin_client, "post", "/api/admin/signup", {"open": False})
    async with make_client(app) as group:
        await group.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})
        resp = await send(group, "post", "/api/places", {"party_id": ivan["id"], "night": THU, "places": 1})
        assert (resp.status_code, error_of(resp)["code"]) == (403, "signup_closed")
        resp = await send(group, "post", "/api/briefing", {"party_id": ivan["id"], "step": "water"})
        assert resp.status_code == 200
        resp = await send(group, "post", "/api/food", {"party_id": ivan["id"], "text": "chlieb"})
        assert resp.status_code == 200
    resp = await send(admin_client, "post", "/api/places", {"party_id": ivan["id"], "night": THU, "places": 1})
    assert resp.status_code == 200


# --- export ------------------------------------------------------------------------------------


async def test_export_returns_the_file_and_writes_nothing(app, admin_client):
    await mk_party(admin_client)
    before = snapshot(app)
    resp = await send(admin_client, "get", "/api/admin/export")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/x-yaml; charset=utf-8"
    assert resp.headers["content-disposition"] == f'attachment; filename="cabin-data-{before[0]}.yaml"'
    assert resp.headers["cache-control"] == "no-store"
    assert resp.content == app.state.runtime.store.data_path.read_bytes()
    assert yaml.safe_load(resp.content)["version"] == before[0]
    assert snapshot(app) == before
    assert backup_count(app) == before[1]


async def test_signup_toggle_reaches_open_streams(app, admin_client):
    from tests.test_api_events import next_frame, open_stream  # the same hub helpers as the events tests

    rt = app.state.runtime
    _conn, gen = await open_stream(rt)
    await send(admin_client, "post", "/api/admin/signup", {"open": False})
    event, data = await next_frame(gen)
    assert event == "state" and data["signup_open"] is False
    await gen.aclose()
