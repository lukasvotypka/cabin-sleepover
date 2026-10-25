"""Slot and party write endpoints: rules, errors, audit, backups, concurrency and the write limit."""

import asyncio

import pytest

from app.main import next_party_color
from tests.api_helpers import (
    A1, A2, CLIENT, FRI, M1, M2, M3, OKNO, PALETTE, SAT, SUN, THU,
    audit_docs, backup_count, error_of, mk_party, party_body, sleeping_of, snapshot,
)
from tests.conftest import TEST_ENV

WRITES = [
    ("post", "/api/assign", {"night": THU, "slots": [A1], "party_id": "p-abcdef"}),
    ("post", "/api/assign-stay", {"slots": [A1], "party_id": "p-abcdef"}),
    ("post", "/api/clear", {"night": THU, "slot": A1}),
    ("post", "/api/move", {"party_id": "p-abcdef", "from_slot": A1, "to_slot": A2, "nights": [THU]}),
    ("post", "/api/places", {"party_id": "p-abcdef", "night": THU, "places": 1}),
    ("post", "/api/parties", party_body()),
    ("put", "/api/parties/p-abcdef", party_body()),
]


async def lock_signup(app):
    """Close signup directly in the store: the admin endpoint for it is a later phase."""
    async with app.state.runtime.store.write(action="signup", source="admin", client_id=None) as tx:
        tx.state.signup_open = False


# --- access ----------------------------------------------------------------------------


@pytest.mark.parametrize("method,url,body", WRITES)
async def test_writes_need_the_group_cookie(client, app, method, url, body):
    before = snapshot(app)
    resp = await client.request(method.upper(), url, json=body)
    assert resp.status_code == 401
    assert error_of(resp)["code"] == "bad_code"
    assert "state" not in resp.json()
    assert snapshot(app) == before


# --- assign ----------------------------------------------------------------------------


async def test_assign_writes_all_slots_in_one_write(app, group_client):
    ivan = await mk_party(group_client)
    before = snapshot(app)
    resp = await group_client.post(
        "/api/assign", json={"night": THU, "slots": [A1, A2], "party_id": ivan["id"]}, headers={"X-Client-Id": "phone-1"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["state"]["sleeping"] == {THU: {A1: ivan["id"], A2: ivan["id"]}}
    assert body["state"]["version"] == before[0] + 1
    assert snapshot(app) == (before[0] + 1, before[1] + 1, before[2] + 1)
    doc = audit_docs(app)[-1]
    assert (doc["action"], doc["source"], doc["client_id"], doc["party"]) == ("assign", "map", "phone-1", ivan["id"])
    assert doc["nights"] == [THU] and doc["slots"] == [A1, A2]


async def test_assign_one_free_one_taken_writes_nothing(app, group_client):
    ivan, riso = await mk_party(group_client), await mk_party(group_client, "Riso a Ben")
    await group_client.post("/api/assign", json={"night": THU, "slots": [A2], "party_id": riso["id"]})
    before = snapshot(app)
    resp = await group_client.post("/api/assign", json={"night": THU, "slots": [A1, A2], "party_id": ivan["id"]})
    assert resp.status_code == 409
    err = error_of(resp)
    assert err["code"] == "slot_taken"
    assert err["params"] == {
        "night": THU, "slot": A2, "party_id": riso["id"], "party_name": "Riso a Ben", "own": False,
    }
    assert resp.json()["state"]["sleeping"] == {THU: {A2: riso["id"]}}  # the current state, A1 untouched
    assert snapshot(app) == before


async def test_assign_to_own_slot_says_own(app, group_client):
    ivan = await mk_party(group_client)
    await group_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": ivan["id"]})
    before = snapshot(app)
    resp = await group_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": ivan["id"]})
    assert resp.status_code == 409
    err = error_of(resp)
    assert err["code"] == "slot_taken" and err["params"]["own"] is True and err["params"]["party_id"] == ivan["id"]
    assert snapshot(app) == before


@pytest.mark.parametrize("slots", [[], None])
async def test_assign_empty_or_missing_slots_is_invalid(app, group_client, slots):
    ivan = await mk_party(group_client)
    before = snapshot(app)
    body = {"night": THU, "party_id": ivan["id"]}
    if slots is not None:
        body["slots"] = slots
    resp = await group_client.post("/api/assign", json=body)
    assert resp.status_code == 422
    err = error_of(resp)
    assert (err["code"], err["params"]["field"]) == ("invalid", "slots")
    assert snapshot(app) == before


async def test_assign_not_present(app, group_client):
    late = await mk_party(group_client, "Neskoro", arrive=FRI)
    before = snapshot(app)
    resp = await group_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": late["id"]})
    assert resp.status_code == 409
    err = error_of(resp)
    assert err["code"] == "not_present"
    assert err["params"] == {"night": THU, "party_id": late["id"], "party_name": "Neskoro"}
    assert snapshot(app) == before


async def test_assign_unknown_slot(app, group_client):
    ivan = await mk_party(group_client)
    resp = await group_client.post("/api/assign", json={"night": THU, "slots": [A1, "nope"], "party_id": ivan["id"]})
    assert resp.status_code == 404
    err = error_of(resp)
    assert (err["code"], err["params"]) == ("unknown_slot", {"slot": "nope"})
    assert sleeping_of(app) == {}


async def test_assign_unknown_party(app, group_client):
    resp = await group_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": "p-zzzzzz"})
    assert resp.status_code == 404
    err = error_of(resp)
    assert (err["code"], err["params"]) == ("unknown_party", {"party_id": "p-zzzzzz"})


async def test_assign_night_outside_the_event_is_invalid(app, group_client):
    ivan = await mk_party(group_client)
    resp = await group_client.post("/api/assign", json={"night": SUN, "slots": [A1], "party_id": ivan["id"]})
    assert resp.status_code == 422
    err = error_of(resp)
    assert err["code"] == "invalid" and err["params"]["field"] == "night" and err["params"]["night"] == SUN


async def test_assign_malformed_body_is_invalid(group_client):
    resp = await group_client.post("/api/assign", json={"night": THU, "slots": A1, "party_id": "p-abcdef"})
    assert resp.status_code == 422
    err = error_of(resp)
    assert (err["code"], err["params"]["field"]) == ("invalid", "slots")
    assert "state" in resp.json()


# --- assign-stay -----------------------------------------------------------------------


async def test_assign_stay_skips_a_night_with_a_taken_slot(app, group_client):
    couple, riso = await mk_party(group_client), await mk_party(group_client, "Riso a Ben")
    await group_client.post("/api/assign", json={"night": FRI, "slots": [A2], "party_id": riso["id"]})
    before = snapshot(app)
    resp = await group_client.post("/api/assign-stay", json={"slots": [A1, A2], "party_id": couple["id"]})
    assert resp.status_code == 200
    body = resp.json()
    assert body["skipped"] == [FRI]
    assert body["state"]["sleeping"] == {
        THU: {A1: couple["id"], A2: couple["id"]},
        FRI: {A2: riso["id"]},  # nothing of the couple on Friday, not even A1
        SAT: {A1: couple["id"], A2: couple["id"]},
    }
    assert snapshot(app) == (before[0] + 1, before[1] + 1, before[2] + 1)
    doc = audit_docs(app)[-1]
    assert doc["action"] == "assign-stay" and doc["nights"] == [THU, SAT] and doc["slots"] == [A1, A2] and doc["source"] == "map"
    assert doc["skipped"] == [FRI]


async def test_assign_stay_without_skips_returns_an_empty_list(app, group_client):
    ivan = await mk_party(group_client, leave=SAT)
    resp = await group_client.post("/api/assign-stay", json={"slots": [A1], "party_id": ivan["id"]})
    assert resp.status_code == 200
    assert resp.json()["skipped"] == []
    assert sleeping_of(app) == {THU: {A1: ivan["id"]}, FRI: {A1: ivan["id"]}}


async def test_assign_stay_all_nights_taken(app, group_client):
    ivan, riso = await mk_party(group_client), await mk_party(group_client, "Riso a Ben")
    for night in (THU, FRI, SAT):
        await group_client.post("/api/assign", json={"night": night, "slots": [A1], "party_id": riso["id"]})
    before = snapshot(app)
    resp = await group_client.post("/api/assign-stay", json={"slots": [A1], "party_id": ivan["id"]})
    assert resp.status_code == 409
    err = error_of(resp)
    assert err["code"] == "slot_taken"
    assert err["params"]["party_id"] == riso["id"] and err["params"]["party_name"] == "Riso a Ben"
    assert err["params"]["skipped"] == [THU, FRI, SAT]
    assert snapshot(app) == before


async def test_assign_stay_errors(app, group_client):
    ivan = await mk_party(group_client)
    resp = await group_client.post("/api/assign-stay", json={"slots": [], "party_id": ivan["id"]})
    assert (resp.status_code, error_of(resp)["code"]) == (422, "invalid")
    resp = await group_client.post("/api/assign-stay", json={"slots": ["nope"], "party_id": ivan["id"]})
    assert (resp.status_code, error_of(resp)["params"]) == (404, {"slot": "nope"})
    resp = await group_client.post("/api/assign-stay", json={"slots": [A1], "party_id": "p-zzzzzz"})
    assert (resp.status_code, error_of(resp)["code"]) == (404, "unknown_party")
    assert sleeping_of(app) == {}


# --- clear -----------------------------------------------------------------------------


async def test_clear_frees_the_slot(app, group_client):
    ivan = await mk_party(group_client)
    await group_client.post("/api/assign", json={"night": THU, "slots": [A1, A2], "party_id": ivan["id"]})
    before = snapshot(app)
    resp = await group_client.post("/api/clear", json={"night": THU, "slot": A1}, headers={"X-Client-Id": "phone-2"})
    assert resp.status_code == 200
    assert resp.json()["state"]["sleeping"] == {THU: {A2: ivan["id"]}}
    assert snapshot(app) == (before[0] + 1, before[1] + 1, before[2] + 1)
    doc = audit_docs(app)[-1]
    assert (doc["action"], doc["source"], doc["client_id"], doc["party"]) == ("clear", "map", "phone-2", ivan["id"])
    assert (doc["before"], doc["after"]) == (ivan["id"], None)


async def test_clear_on_a_free_slot_writes_nothing(app, group_client):
    await mk_party(group_client)
    before = snapshot(app)
    resp = await group_client.post("/api/clear", json={"night": THU, "slot": A1})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True and resp.json()["state"]["version"] == before[0]
    assert snapshot(app) == before  # no version bump, no backup, no audit


async def test_clear_errors(app, group_client):
    resp = await group_client.post("/api/clear", json={"night": THU, "slot": "nope"})
    assert (resp.status_code, error_of(resp)["params"]) == (404, {"slot": "nope"})
    resp = await group_client.post("/api/clear", json={"night": SUN, "slot": A1})
    assert resp.status_code == 422 and error_of(resp)["params"]["night"] == SUN


# --- move ------------------------------------------------------------------------------


async def test_move_in_several_nights(app, group_client):
    ivan = await mk_party(group_client)
    for night in (THU, FRI):
        await group_client.post("/api/assign", json={"night": night, "slots": [A1], "party_id": ivan["id"]})
    before = snapshot(app)
    resp = await group_client.post(
        "/api/move", json={"party_id": ivan["id"], "from_slot": A1, "to_slot": OKNO, "nights": [THU, FRI]}
    )
    assert resp.status_code == 200
    assert resp.json()["state"]["sleeping"] == {THU: {OKNO: ivan["id"]}, FRI: {OKNO: ivan["id"]}}
    assert snapshot(app) == (before[0] + 1, before[1] + 1, before[2] + 1)
    doc = audit_docs(app)[-1]
    assert doc["action"] == "move" and doc["nights"] == [THU, FRI] and doc["slots"] == [A1, OKNO] and doc["source"] == "map"


async def test_move_is_all_or_nothing(app, group_client):
    ivan, riso = await mk_party(group_client), await mk_party(group_client, "Riso a Ben")
    for night in (THU, FRI, SAT):
        await group_client.post("/api/assign", json={"night": night, "slots": [A1], "party_id": ivan["id"]})
    await group_client.post("/api/assign", json={"night": SAT, "slots": [OKNO], "party_id": riso["id"]})
    before, sleeping = snapshot(app), sleeping_of(app)
    resp = await group_client.post(
        "/api/move", json={"party_id": ivan["id"], "from_slot": A1, "to_slot": OKNO, "nights": [THU, FRI, SAT]}
    )
    assert resp.status_code == 409
    err = error_of(resp)
    assert err["code"] == "slot_taken"
    assert err["params"]["night"] == SAT and err["params"]["party_id"] == riso["id"]
    assert snapshot(app) == before and sleeping_of(app) == sleeping


async def test_move_to_the_same_slot_or_an_own_slot_is_refused(app, group_client):
    ivan = await mk_party(group_client)
    await group_client.post("/api/assign", json={"night": THU, "slots": [A1, A2], "party_id": ivan["id"]})
    before = snapshot(app)
    move = {"party_id": ivan["id"], "from_slot": A1, "nights": [THU]}
    resp = await group_client.post("/api/move", json={**move, "to_slot": A1})
    assert (resp.status_code, error_of(resp)["code"]) == (422, "invalid")
    resp = await group_client.post("/api/move", json={**move, "to_slot": A2})
    err = error_of(resp)
    assert (resp.status_code, err["code"], err["params"]["own"]) == (409, "slot_taken", True)
    assert snapshot(app) == before


async def test_move_from_a_slot_the_party_does_not_hold(app, group_client):
    ivan = await mk_party(group_client)
    resp = await group_client.post(
        "/api/move", json={"party_id": ivan["id"], "from_slot": A1, "to_slot": A2, "nights": [THU]}
    )
    assert resp.status_code == 422
    assert error_of(resp)["code"] == "invalid"


async def test_move_unknown_party_and_slot(app, group_client):
    resp = await group_client.post(
        "/api/move", json={"party_id": "p-zzzzzz", "from_slot": A1, "to_slot": A2, "nights": [THU]}
    )
    assert (resp.status_code, error_of(resp)["params"]) == (404, {"party_id": "p-zzzzzz"})
    ivan = await mk_party(group_client)
    await group_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": ivan["id"]})
    before = snapshot(app)
    resp = await group_client.post(
        "/api/move", json={"party_id": ivan["id"], "from_slot": A1, "to_slot": "nope", "nights": [THU]}
    )
    err = error_of(resp)
    assert (resp.status_code, err["code"], err["params"]) == (404, "unknown_slot", {"slot": "nope"})
    assert snapshot(app) == before


# --- create party ----------------------------------------------------------------------


async def test_create_party(app, group_client):
    resp = await group_client.post(
        "/api/parties",
        json=party_body("  Ivan a Eva  ", note="Prídeme neskoro", arrival_time="18:00"),
        headers={"X-Client-Id": "phone-3"},
    )
    assert resp.status_code == 200
    body = resp.json()
    party = body["party"]
    assert party["name"] == "Ivan a Eva"
    assert party["id"].startswith("p-") and len(party["id"]) == 8
    assert party["color"] == PALETTE[0]
    assert party["created_at"] and party["updated_at"] == party["created_at"]
    assert body["state"]["parties"] == [party]
    assert body["state"]["version"] == 1
    doc = audit_docs(app)[-1]
    assert (doc["action"], doc["source"], doc["client_id"], doc["party"]) == ("party-create", "form", "phone-3", party["id"])
    assert backup_count(app) == 1


async def test_create_party_colors_follow_the_palette_and_wrap(app, make_client):
    async with make_client(app) as c:
        await c.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})
        colors = []
        for i in range(13):
            colors.append((await mk_party(c, f"Partia {i}", headers={"X-Client-Id": "creator"}))["color"])
    assert colors[:12] == PALETTE
    assert colors[12] == PALETTE[0]  # all 12 in use: it starts again from the top
    assert len({p.id for p in app.state.runtime.store.read().parties}) == 13


def test_next_party_color_reuses_a_freed_color(make_party, make_state):
    parties = [make_party(color=PALETTE[0]), make_party(color=PALETTE[1])]
    assert next_party_color(make_state(parties)) == PALETTE[2]
    assert next_party_color(make_state(parties[1:])) == PALETTE[0]  # the first party was deleted
    assert next_party_color(make_state([])) == PALETTE[0]


async def test_create_party_reuses_the_color_of_a_removed_party(app, group_client):
    first, second = await mk_party(group_client, "Prvá"), await mk_party(group_client, "Druhá")
    assert (first["color"], second["color"]) == (PALETTE[0], PALETTE[1])
    async with app.state.runtime.store.write(action="party-delete", source="admin", client_id=None) as tx:
        tx.state.parties = [p for p in tx.state.parties if p.id != first["id"]]  # no delete endpoint yet
    third = await mk_party(group_client, "Tretia")
    assert third["color"] == PALETTE[0]


async def test_create_party_ids_are_unique_and_retried(app, group_client, monkeypatch):
    first = await mk_party(group_client)
    answers = iter(first["id"][2:] + "abcdef")  # first draw collides with the existing party, the second is free
    monkeypatch.setattr("app.main.secrets.choice", lambda alphabet: next(answers))
    second = await mk_party(group_client, "Riso a Ben")
    assert second["id"] == "p-abcdef"


async def test_create_party_duplicate_name_is_case_insensitive(app, group_client):
    await mk_party(group_client)
    before = snapshot(app)
    resp = await group_client.post("/api/parties", json=party_body(" IVAN a eva "), headers=CLIENT)
    assert resp.status_code == 409
    err = error_of(resp)
    assert (err["code"], err["params"]["name"]) == ("duplicate_name", "Ivan a Eva")
    assert snapshot(app) == before


@pytest.mark.parametrize(
    "overrides,field",
    [
        ({"name": "   "}, "name"),
        ({"adults": -1}, "adults"),
        ({"arrive": SUN}, "arrive"),
        ({"leave": THU}, "leave"),
        ({"arrive": "2026-10-31", "leave": "2026-10-31"}, "leave"),
        ({"unknown_field": 1}, "unknown_field"),
        ({"kids": 0, "kids_in_parents_bed": 1}, "kids_in_parents_bed"),
        ({"kids": 1, "kids_in_parents_bed": 2}, "kids_in_parents_bed"),
    ],
)
async def test_create_party_invalid_input(app, group_client, overrides, field):
    before = snapshot(app)
    resp = await group_client.post("/api/parties", json=party_body(**overrides), headers=CLIENT)
    assert resp.status_code == 422
    err = error_of(resp)
    assert (err["code"], err["params"]["field"]) == ("invalid", field)
    assert snapshot(app) == before


# --- update party ----------------------------------------------------------------------


async def test_update_party_rename_keeps_sleeping(app, group_client):
    ivan = await mk_party(group_client)
    await group_client.post("/api/assign", json={"night": THU, "slots": [A1, A2], "party_id": ivan["id"]})
    sleeping = sleeping_of(app)
    resp = await group_client.put(
        f"/api/parties/{ivan['id']}", json=party_body("Ivan a Eva Nová", kids=1), headers={"X-Client-Id": "phone-4"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["freed"] == []
    assert body["party"]["name"] == "Ivan a Eva Nová" and body["party"]["kids"] == 1
    assert body["party"]["id"] == ivan["id"] and body["party"]["color"] == ivan["color"]
    assert body["party"]["created_at"] == ivan["created_at"]
    assert body["state"]["sleeping"] == sleeping == sleeping_of(app)
    doc = audit_docs(app)[-1]
    assert (doc["action"], doc["source"], doc["client_id"]) == ("party-update", "form", "phone-4")
    assert doc["before"]["name"] == "Ivan a Eva" and doc["after"]["name"] == "Ivan a Eva Nová"


async def test_update_party_shortening_frees_slots_outside_the_stay(app, group_client):
    ivan = await mk_party(group_client)
    for night in (THU, FRI, SAT):
        await group_client.post("/api/assign", json={"night": night, "slots": [A1, A2], "party_id": ivan["id"]})
    before = snapshot(app)
    resp = await group_client.put(f"/api/parties/{ivan['id']}", json=party_body(leave=FRI), headers=CLIENT)
    assert resp.status_code == 200
    body = resp.json()
    assert body["freed"] == [
        {"night": FRI, "slot": A1}, {"night": FRI, "slot": A2},
        {"night": SAT, "slot": A1}, {"night": SAT, "slot": A2},
    ]
    assert body["state"]["sleeping"] == {THU: {A1: ivan["id"], A2: ivan["id"]}}
    assert snapshot(app) == (before[0] + 1, before[1] + 1, before[2] + 1)  # one write


@pytest.mark.parametrize(
    "overrides,field",
    [({"kids": 0, "kids_in_parents_bed": 1}, "kids_in_parents_bed"), ({"adults": 99}, "adults")],
)
async def test_update_party_invalid_input(app, group_client, overrides, field):
    ivan = await mk_party(group_client)
    before = snapshot(app)
    resp = await group_client.put(f"/api/parties/{ivan['id']}", json=party_body(**overrides), headers=CLIENT)
    assert resp.status_code == 422
    err = error_of(resp)
    assert (err["code"], err["params"]["field"]) == ("invalid", field)
    assert snapshot(app) == before


@pytest.mark.parametrize("party_id", ["x" * 5000, "nope", "p-short"])
async def test_update_party_with_a_malformed_id_is_invalid(app, group_client, party_id):
    before = snapshot(app)
    resp = await group_client.put(f"/api/parties/{party_id}", json=party_body(), headers=CLIENT)
    assert resp.status_code == 422
    err = error_of(resp)
    assert (err["code"], err["params"]["field"]) == ("invalid", "party_id")
    assert len(resp.text) < 8000  # the long value is not echoed back
    assert snapshot(app) == before


async def test_update_party_errors(app, group_client):
    ivan, riso = await mk_party(group_client), await mk_party(group_client, "Riso a Ben")
    before = snapshot(app)
    resp = await group_client.put("/api/parties/p-zzzzzz", json=party_body(), headers=CLIENT)
    assert resp.status_code == 404
    assert (error_of(resp)["code"], error_of(resp)["params"]) == ("unknown_party", {"party_id": "p-zzzzzz"})
    resp = await group_client.put(f"/api/parties/{ivan['id']}", json=party_body("riso a ben"), headers=CLIENT)
    assert resp.status_code == 409 and error_of(resp)["params"]["name"] == "Riso a Ben"
    resp = await group_client.put(f"/api/parties/{ivan['id']}", json=party_body(arrive=SAT, leave=FRI), headers=CLIENT)
    assert (resp.status_code, error_of(resp)["code"]) == (422, "invalid")
    assert snapshot(app) == before
    # keeping the own name is not a duplicate
    resp = await group_client.put(f"/api/parties/{riso['id']}", json=party_body("Riso a Ben"), headers=CLIENT)
    assert resp.status_code == 200


# --- signup lock -----------------------------------------------------------------------


@pytest.fixture
async def locked(app, make_client):
    """A group client and an admin client on an app with signup closed, with one party that sleeps in A1 on Thursday."""
    async with make_client(app) as group, make_client(app) as admin:
        await group.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})
        await admin.post("/api/join", json={"code": TEST_ENV["ADMIN_CODE"]})
        ivan = await mk_party(group)
        await group.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": ivan["id"]})
        await lock_signup(app)
        yield group, admin, ivan


def locked_requests(ivan: dict) -> list[tuple[str, str, dict]]:
    pid = ivan["id"]
    return [
        ("post", "/api/assign", {"night": FRI, "slots": [A2], "party_id": pid}),
        ("post", "/api/assign-stay", {"slots": [OKNO], "party_id": pid}),
        ("post", "/api/clear", {"night": THU, "slot": A1}),
        ("post", "/api/move", {"party_id": pid, "from_slot": A1, "to_slot": A2, "nights": [THU]}),
        ("post", "/api/parties", party_body("Riso a Ben")),
        ("put", f"/api/parties/{pid}", party_body("Ivan a Eva Nová")),
    ]


@pytest.mark.parametrize("index", range(6))
async def test_signup_lock_refuses_the_group_and_lets_the_admin_through(app, locked, index):
    group, admin, ivan = locked
    method, url, body = locked_requests(ivan)[index]
    before = snapshot(app)
    resp = await group.request(method.upper(), url, json=body, headers=CLIENT)
    assert resp.status_code == 403
    err = error_of(resp)
    assert (err["code"], err["params"]) == ("signup_closed", {})
    assert snapshot(app) == before
    resp = await admin.request(method.upper(), url, json=body, headers=CLIENT)
    assert resp.status_code == 200, resp.text
    assert snapshot(app)[0] == before[0] + 1


async def test_clear_on_a_free_slot_is_also_refused_when_locked(locked):
    group, _admin, _ivan = locked
    resp = await group.post("/api/clear", json={"night": FRI, "slot": A1})
    assert (resp.status_code, error_of(resp)["code"]) == (403, "signup_closed")


async def test_audit_source_is_admin_for_a_slot_write_with_the_admin_cookie(app, admin_client):
    ivan = await mk_party(admin_client)
    assert audit_docs(app)[-1]["source"] == "admin"
    await admin_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": ivan["id"]})
    assert audit_docs(app)[-1]["source"] == "admin"


async def test_audit_without_client_id_has_null(app, group_client):
    await group_client.post("/api/parties", json=party_body())
    assert audit_docs(app)[-1]["client_id"] is None


# --- concurrency -----------------------------------------------------------------------


@pytest.fixture
async def two_clients(app, make_client):
    async with make_client(app) as one, make_client(app) as two:
        for c in (one, two):
            await c.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})
        yield one, two


async def test_concurrent_assign_to_the_same_slot_has_one_winner(app, two_clients):
    one, two = two_clients
    ivan, riso = await mk_party(one, "Ivan a Eva"), await mk_party(one, "Riso a Ben")
    results = await asyncio.gather(
        one.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": ivan["id"]}, headers={"X-Client-Id": "one"}),
        two.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": riso["id"]}, headers={"X-Client-Id": "two"}),
    )
    statuses = sorted(r.status_code for r in results)
    assert statuses == [200, 409]
    winner_resp = next(r for r in results if r.status_code == 200)
    loser_resp = next(r for r in results if r.status_code == 409)
    winner = ivan if winner_resp is results[0] else riso
    err = error_of(loser_resp)
    assert err["code"] == "slot_taken"
    assert err["params"]["party_id"] == winner["id"] and err["params"]["party_name"] == winner["name"]
    assert loser_resp.json()["state"]["sleeping"] == {THU: {A1: winner["id"]}}
    assert sleeping_of(app) == {THU: {A1: winner["id"]}}


async def test_concurrent_overlapping_lists_never_write_partially(app, two_clients):
    one, two = two_clients
    ivan, riso = await mk_party(one, "Ivan a Eva"), await mk_party(one, "Riso a Ben")
    results = await asyncio.gather(
        one.post("/api/assign", json={"night": THU, "slots": [M1, M2], "party_id": ivan["id"]}, headers={"X-Client-Id": "one"}),
        two.post("/api/assign", json={"night": THU, "slots": [M2, M3], "party_id": riso["id"]}, headers={"X-Client-Id": "two"}),
    )
    assert sorted(r.status_code for r in results) == [200, 409]
    sleeping = sleeping_of(app)[THU]
    if results[0].status_code == 200:
        assert sleeping == {M1: ivan["id"], M2: ivan["id"]}  # M3 stays free
    else:
        assert sleeping == {M2: riso["id"], M3: riso["id"]}  # M1 stays free
    assert error_of(next(r for r in results if r.status_code == 409))["code"] == "slot_taken"


# --- party color -------------------------------------------------------------------------


async def test_create_party_with_a_chosen_color_stores_it_upper_case(app, group_client):
    party = await mk_party(group_client, color="#2f7d6d")
    assert party["color"] == "#2F7D6D"
    assert audit_docs(app)[-1]["after"]["color"] == "#2F7D6D"
    other = await mk_party(group_client, "Druhí", color="#3e6fb0")  # not the next palette color
    assert other["color"] == "#3E6FB0"
    same = await mk_party(group_client, "Tretí", color="#3E6FB0")  # the same color twice is fine
    assert same["color"] == other["color"]


async def test_create_party_without_color_or_with_null_gets_the_palette_color(group_client):
    first = await mk_party(group_client)
    second = await mk_party(group_client, "Druhí", color=None)
    assert (first["color"], second["color"]) == (PALETTE[0], PALETTE[1])


@pytest.mark.parametrize("color", ["#abc", "red", "#GGGGGG", 123, ""])
async def test_party_color_with_a_bad_format_is_invalid(app, group_client, color):
    ivan = await mk_party(group_client)
    before = snapshot(app)
    for resp in (
        await group_client.post("/api/parties", json=party_body("Druhí", color=color), headers=CLIENT),
        await group_client.put(f"/api/parties/{ivan['id']}", json=party_body(color=color), headers=CLIENT),
    ):
        assert resp.status_code == 422
        err = error_of(resp)
        assert (err["code"], err["params"]["field"]) == ("invalid", "color")
    assert snapshot(app) == before


@pytest.mark.parametrize(
    "color,reason", [("#FFFFFF", "color_too_light"), ("#E8D2A6", "color_too_light"),
                     ("#000000", "color_too_dark"), ("#222222", "color_too_dark")],
)
async def test_party_color_too_light_or_dark_is_invalid(app, group_client, color, reason):
    ivan = await mk_party(group_client)
    before = snapshot(app)
    for resp in (
        await group_client.post("/api/parties", json=party_body("Druhí", color=color), headers=CLIENT),
        await group_client.put(f"/api/parties/{ivan['id']}", json=party_body(color=color), headers=CLIENT),
    ):
        assert resp.status_code == 422
        err = error_of(resp)
        assert err["code"] == "invalid"
        assert err["params"] == {"reason": reason, "field": "color", "color": color}
    assert snapshot(app) == before


@pytest.mark.parametrize("color", PALETTE)
async def test_every_palette_color_is_accepted(group_client, color):
    assert (await mk_party(group_client, color=color))["color"] == color


async def test_update_party_changes_the_color(app, group_client):
    ivan = await mk_party(group_client)
    resp = await group_client.put(f"/api/parties/{ivan['id']}", json=party_body(color="#a04848"), headers=CLIENT)
    assert resp.status_code == 200
    assert resp.json()["party"]["color"] == "#A04848"
    doc = audit_docs(app)[-1]
    assert (doc["action"], doc["before"]["color"], doc["after"]["color"]) == ("party-update", PALETTE[0], "#A04848")


@pytest.mark.parametrize("overrides", [{}, {"color": None}])
async def test_update_party_without_color_keeps_it(group_client, overrides):
    ivan = await mk_party(group_client, color="#A04848")
    resp = await group_client.put(f"/api/parties/{ivan['id']}", json=party_body(kids=1, **overrides), headers=CLIENT)
    assert resp.status_code == 200
    assert resp.json()["party"]["color"] == "#A04848"


async def test_update_party_does_not_recheck_an_unchanged_color(app, group_client):
    ivan = await mk_party(group_client)
    # A color stored before the brightness rule (here written to the store directly) never blocks other edits.
    async with app.state.runtime.store.write(action="test", source="admin", client_id=None) as tx:
        tx.state.parties[0].color = "#FFFFFF"
    resp = await group_client.put(f"/api/parties/{ivan['id']}", json=party_body(kids=1, color="#ffffff"), headers=CLIENT)
    assert resp.status_code == 200 and resp.json()["party"]["color"] == "#FFFFFF"
    resp = await group_client.put(f"/api/parties/{ivan['id']}", json=party_body(color="#FFFFFE"), headers=CLIENT)
    assert resp.status_code == 422


async def test_party_color_follows_the_signup_lock(app, group_client):
    ivan = await mk_party(group_client)
    await lock_signup(app)
    resp = await group_client.put(f"/api/parties/{ivan['id']}", json=party_body(color="#A04848"), headers=CLIENT)
    assert (resp.status_code, error_of(resp)["code"]) == (403, "signup_closed")


# --- rate limit ------------------------------------------------------------------------


async def test_the_31st_write_in_a_minute_is_rate_limited(app, group_client, clock):
    headers = {"X-Client-Id": "busy"}
    for _ in range(30):
        resp = await group_client.post("/api/clear", json={"night": THU, "slot": A1}, headers=headers)
        assert resp.status_code == 200
    before = snapshot(app)
    resp = await group_client.post("/api/clear", json={"night": THU, "slot": A1}, headers=headers)
    assert resp.status_code == 429
    err = error_of(resp)
    assert err["code"] == "rate_limited" and err["params"]["retry_after"] >= 1
    assert "state" in resp.json()
    assert snapshot(app) == before
    clock.advance(61)
    assert (await group_client.post("/api/clear", json={"night": THU, "slot": A1}, headers=headers)).status_code == 200


# --- per-night places (T-033) --------------------------------------------------------


def places_of(app, pid):
    return next(p for p in app.state.runtime.store.read().parties if p.id == pid).places


async def set_places(client, pid, night, places):
    return await client.post("/api/places", json={"party_id": pid, "night": night, "places": places}, headers=CLIENT)


async def test_places_sets_and_audits(app, group_client):
    p = await mk_party(group_client, adults=3)
    before = snapshot(app)
    resp = await set_places(group_client, p["id"], THU, 1)
    assert resp.status_code == 200
    assert [x for x in resp.json()["state"]["parties"] if x["id"] == p["id"]][0]["places"] == {THU: 1}
    assert snapshot(app) == (before[0] + 1, before[1] + 1, before[2] + 1)
    doc = audit_docs(app)[-1]
    assert (doc["action"], doc["source"], doc["before"], doc["after"]) == ("places", "map", None, 1)


async def test_places_full_count_removes_entry(app, group_client):
    p = await mk_party(group_client, adults=3)
    await set_places(group_client, p["id"], THU, 1)
    assert (await set_places(group_client, p["id"], THU, 3)).status_code == 200
    assert places_of(app, p["id"]) == {}


@pytest.mark.parametrize("night,places,code", [(THU, 0, "invalid"), (THU, 4, "invalid"), (SAT, 1, "not_present"), ("2026-12-01", 1, "invalid")])
async def test_places_errors(app, group_client, night, places, code):
    p = await mk_party(group_client, adults=3, leave=FRI)
    before = snapshot(app)
    resp = await set_places(group_client, p["id"], night, places)
    assert error_of(resp)["code"] == code
    assert snapshot(app) == before


async def test_places_unknown_party_and_locked(app, group_client):
    assert error_of(await set_places(group_client, "p-nobody", THU, 1))["code"] == "unknown_party"
    p = await mk_party(group_client, adults=3)
    await lock_signup(app)
    assert error_of(await set_places(group_client, p["id"], THU, 1))["code"] == "signup_closed"


async def test_party_update_adjusts_places(app, group_client):
    p = await mk_party(group_client, adults=3, arrive=THU, leave=SUN)
    await set_places(group_client, p["id"], THU, 2)
    await set_places(group_client, p["id"], SAT, 1)
    put = lambda **o: group_client.put(f"/api/parties/{p['id']}", json=party_body(**{"adults": 3, "arrive": THU, "leave": SUN, **o}))
    assert (await put(adults=4)).status_code == 200  # higher full count keeps the overrides
    assert places_of(app, p["id"]) == {THU: 2, SAT: 1}
    assert (await put(adults=2, leave=FRI)).status_code == 200  # shorter stay, lower full count
    # THU=2 equals the new full count 2, so it disappears; SAT is outside the shorter stay
    assert places_of(app, p["id"]) == {}


async def test_party_update_clamps_places(app, group_client):
    p = await mk_party(group_client, adults=4)
    await set_places(group_client, p["id"], THU, 3)
    resp = await group_client.put(f"/api/parties/{p['id']}", json=party_body(adults=3))
    assert resp.status_code == 200
    assert places_of(app, p["id"]) == {}


async def test_assign_raises_places_and_clear_move_never_lower(app, group_client):
    p = await mk_party(group_client, adults=3)
    await set_places(group_client, p["id"], THU, 1)
    await group_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": p["id"]})
    assert places_of(app, p["id"]) == {THU: 1}
    await group_client.post("/api/assign", json={"night": THU, "slots": [A2], "party_id": p["id"]})
    assert places_of(app, p["id"]) == {THU: 2}
    await group_client.post("/api/move", json={"party_id": p["id"], "from_slot": A2, "to_slot": OKNO, "nights": [THU]})
    await group_client.post("/api/clear", json={"night": THU, "slot": A1})
    assert places_of(app, p["id"]) == {THU: 2}
    await group_client.post("/api/assign", json={"night": THU, "slots": [A1, A2], "party_id": p["id"]})
    assert places_of(app, p["id"]) == {}


async def test_assign_stay_raises_places(app, group_client):
    p = await mk_party(group_client, adults=2, arrive=THU, leave=SAT)
    await set_places(group_client, p["id"], FRI, 1)
    resp = await group_client.post("/api/assign-stay", json={"slots": [A1, A2], "party_id": p["id"]})
    assert resp.status_code == 200
    assert places_of(app, p["id"]) == {}


# --- day visits (T-036) ----------------------------------------------------------


def day_body(name="Hosť", **overrides) -> dict:
    return party_body(name, **{"arrive": None, "leave": None, "day_visits": [SAT, THU], **overrides})


async def test_create_day_only_party_stores_sorted_days_and_null_stay(app, group_client):
    resp = await group_client.post("/api/parties", json=day_body(kids=1), headers=CLIENT)
    assert resp.status_code == 200
    party = resp.json()["party"]
    assert (party["arrive"], party["leave"], party["day_visits"]) == (None, None, [THU, SAT])
    state = (await group_client.get("/api/state")).json()["state"]
    assert state["parties"][0]["day_visits"] == [THU, SAT] and state["parties"][0]["arrive"] is None
    overnight = await mk_party(group_client, "Ivan a Eva")
    state = (await group_client.get("/api/state")).json()["state"]
    assert [p["day_visits"] for p in state["parties"]] == [[THU, SAT], []]
    assert overnight["day_visits"] == []


@pytest.mark.parametrize(
    "overrides,reason,field",
    [
        ({"arrive": THU}, "stay_mode_mixed", "day_visits"),
        ({"day_visits": []}, "day_visits_empty", "day_visits"),
        ({"day_visits": [THU, THU]}, "duplicate_day", "day_visits"),
        ({"day_visits": ["2026-11-05"]}, "day_outside_event", "day_visits"),
        ({"kids": 1, "kids_in_parents_bed": 1}, "day_only_kids_in_bed", "kids_in_parents_bed"),
    ],
)
async def test_create_day_only_party_invalid(app, group_client, overrides, reason, field):
    before = snapshot(app)
    resp = await group_client.post("/api/parties", json=day_body(**overrides), headers=CLIENT)
    assert resp.status_code == 422
    err = error_of(resp)
    assert (err["code"], err["params"]["reason"], err["params"]["field"]) == ("invalid", reason, field)
    assert snapshot(app) == before


async def test_create_party_without_stay_or_with_half_a_stay_is_invalid(group_client):
    body = party_body()
    del body["arrive"], body["leave"]
    err = error_of(await group_client.post("/api/parties", json=body, headers=CLIENT))
    assert err["params"]["reason"] == "day_visits_empty"
    err = error_of(await group_client.post("/api/parties", json={**body, "arrive": THU}, headers=CLIENT))
    assert (err["params"]["reason"], err["params"]["field"]) == ("stay_incomplete", "leave")


async def test_day_only_party_cannot_be_placed(app, group_client):
    guest = (await group_client.post("/api/parties", json=day_body(), headers=CLIENT)).json()["party"]
    before = snapshot(app)
    resp = await group_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": guest["id"]})
    assert resp.status_code == 409 and error_of(resp)["code"] == "not_present"
    resp = await group_client.post("/api/places", json={"party_id": guest["id"], "night": THU, "places": 1})
    assert resp.status_code == 409 and error_of(resp)["code"] == "not_present"
    resp = await group_client.post("/api/assign-stay", json={"slots": [A1], "party_id": guest["id"]})
    assert resp.status_code == 422
    assert error_of(resp)["params"]["reason"] == "no_event_nights"
    assert snapshot(app) == before


async def test_update_to_day_only_frees_slots_and_back(app, group_client):
    ivan = await mk_party(group_client)
    for night in (THU, FRI):
        await group_client.post("/api/assign", json={"night": night, "slots": [A1, A2], "party_id": ivan["id"]})
    await group_client.post("/api/places", json={"party_id": ivan["id"], "night": THU, "places": 1})
    before = snapshot(app)
    resp = await group_client.put(f"/api/parties/{ivan['id']}", json=day_body("Ivan a Eva"), headers=CLIENT)
    assert resp.status_code == 200
    body = resp.json()
    assert body["freed"] == [
        {"night": THU, "slot": A1}, {"night": THU, "slot": A2},
        {"night": FRI, "slot": A1}, {"night": FRI, "slot": A2},
    ]
    assert body["state"]["sleeping"] == {}
    assert body["party"]["places"] == {} and body["party"]["arrive"] is None
    assert snapshot(app) == (before[0] + 1, before[1] + 1, before[2] + 1)  # one write, one audit entry
    resp = await group_client.put(f"/api/parties/{ivan['id']}", json=party_body("Ivan a Eva"), headers=CLIENT)
    assert resp.status_code == 200
    party = resp.json()["party"]
    assert (party["arrive"], party["leave"], party["day_visits"]) == (THU, SUN, [])
    resp = await group_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": ivan["id"]})
    assert resp.status_code == 200


async def test_update_party_mode_errors_write_nothing(app, group_client):
    ivan = await mk_party(group_client)
    before = snapshot(app)
    resp = await group_client.put(
        f"/api/parties/{ivan['id']}", json=party_body(day_visits=[THU]), headers=CLIENT
    )
    assert resp.status_code == 422 and error_of(resp)["params"]["reason"] == "stay_mode_mixed"
    assert snapshot(app) == before
