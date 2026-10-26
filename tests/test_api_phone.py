"""Phone login endpoints (T-092): party_auth cookie, session, login start and verify, logout."""

import logging
from datetime import UTC, datetime

import pytest

from app.main import PARTY_COOKIE
from app.sms import FakeSmsClient, SmsUnavailable
from tests.api_helpers import error_of, snapshot

PHONE = "+421905123456"
TYPED = "0905 123 456"
CODE = "123456"


class RecordingSms(FakeSmsClient):
    def __init__(self):
        super().__init__(CODE)
        self.started: list[str] = []
        self.fail = False

    async def start(self, phone):
        if self.fail:
            raise SmsUnavailable()
        self.started.append(phone)

    async def check(self, phone, code):
        if self.fail:
            raise SmsUnavailable()
        return await super().check(phone, code)


@pytest.fixture
def sms():
    return RecordingSms()


@pytest.fixture
def phone_app(make_app, sms):
    return make_app(sms_client=sms)


@pytest.fixture
async def gc(phone_app, make_client):
    async with make_client(phone_app) as c:
        assert (await c.post("/api/join", json={"code": "group-test-code"})).status_code == 200
        yield c


async def add_party(app, make_party, clock, **overrides):
    """A protected party whose number was set a minute before `clock`."""
    set_at = datetime.fromtimestamp(clock.now - 60, tz=UTC).isoformat()
    fields = {"phone": PHONE, "phone_set_at": set_at, **overrides}
    party = make_party(**fields)
    async with app.state.runtime.store.write(action="party-create", source="form", client_id=None) as tx:
        tx.state.parties.append(party)
    return party


async def login(c, party_id, phone=TYPED, code=CODE):
    return await c.post(f"/api/parties/{party_id}/login/verify", json={"phone": phone, "code": code})


async def test_no_group_cookie_is_bad_code_everywhere(phone_app, make_client):
    async with make_client(phone_app) as c:
        calls = [
            c.get("/api/session"),
            c.post("/api/parties/p-abc123/login/start", json={"phone": TYPED}),
            c.post("/api/parties/p-abc123/login/verify", json={"phone": TYPED, "code": CODE}),
            c.post("/api/logout", json={"party_id": "p-abc123"}),
        ]
        for call in calls:
            resp = await call
            assert resp.status_code == 401 and resp.json()["error"]["code"] == "bad_code"


async def test_session_lists_verified_parties_and_cookie_flags(gc, phone_app, make_party, clock):
    party = await add_party(phone_app, make_party, clock)
    assert (await gc.get("/api/session")).json() == {"ok": True, "verified": [], "sms_enabled": True}
    resp = await login(gc, party.id)
    assert resp.status_code == 200 and resp.json()["ok"] is True
    header = resp.headers["set-cookie"]
    assert header.startswith(PARTY_COOKIE + "=")
    assert "HttpOnly" in header and "Secure" in header and "SameSite=lax" in header and "Max-Age=2592000" in header
    assert (await gc.get("/api/session")).json()["verified"] == [party.id]


async def test_tampered_cookie_gives_no_verified_parties(gc, phone_app, make_party, clock):
    party = await add_party(phone_app, make_party, clock)
    await login(gc, party.id)
    token = gc.cookies[PARTY_COOKIE]
    group = gc.cookies["cabin_group"]
    gc.cookies.clear()

    async def verified(value):
        headers = {"Cookie": f"cabin_group={group}; {PARTY_COOKIE}={value}"}
        return (await gc.get("/api/session", headers=headers)).json()["verified"]

    assert await verified(token[:-3] + "abc") == []
    assert await verified(token) == [party.id]


async def test_expired_cookie_entry_is_dropped(gc, phone_app, make_party, clock):
    party = await add_party(phone_app, make_party, clock)
    await login(gc, party.id)
    clock.advance(30 * 24 * 3600 + 120)
    await gc.post("/api/join", json={"code": "group-test-code"})  # the group cookie expired too
    assert (await gc.get("/api/session")).json()["verified"] == []


async def test_verification_older_than_the_number_is_not_listed(gc, phone_app, make_party, clock):
    party = await add_party(phone_app, make_party, clock)
    await login(gc, party.id)
    stored = phone_app.state.runtime.store
    async with stored.write(action="phone", source="form", client_id=None) as tx:
        tx.state.parties[0].phone_set_at = datetime.fromtimestamp(clock.now + 5, tz=UTC).isoformat()
    clock.advance(10)
    assert (await gc.get("/api/session")).json()["verified"] == []


async def test_deleted_or_unprotected_party_is_not_listed(gc, phone_app, make_party, clock):
    party = await add_party(phone_app, make_party, clock)
    await login(gc, party.id)
    async with phone_app.state.runtime.store.write(action="party-delete", source="form", client_id=None) as tx:
        tx.state.parties.clear()
    assert (await gc.get("/api/session")).json()["verified"] == []


async def test_start_errors(gc, phone_app, make_party, clock, sms):
    party = await add_party(phone_app, make_party, clock)
    bare = make_party(id="p-bare01", name="Bez cisla")
    async with phone_app.state.runtime.store.write(action="party-create", source="form", client_id=None) as tx:
        tx.state.parties.append(bare)
    resp = await gc.post("/api/parties/p-nope01/login/start", json={"phone": TYPED})
    assert resp.status_code == 404 and error_of(resp)["code"] == "unknown_party"
    resp = await gc.post(f"/api/parties/{party.id}/login/start", json={"phone": "abc"})
    assert resp.status_code == 422 and error_of(resp)["params"]["field"] == "phone"
    resp = await gc.post(f"/api/parties/{party.id}/login/start", json={"phone": "0900 000 000"})
    assert resp.status_code == 403 and error_of(resp)["code"] == "phone_mismatch" and "state" in resp.json()
    resp = await gc.post("/api/parties/p-bare01/login/start", json={"phone": TYPED})
    assert resp.status_code == 403 and error_of(resp)["code"] == "phone_mismatch"
    assert sms.started == []


async def test_start_sends_sms_on_a_match_and_changes_nothing(gc, phone_app, make_party, clock, sms):
    party = await add_party(phone_app, make_party, clock)
    before = snapshot(phone_app)
    resp = await gc.post(f"/api/parties/{party.id}/login/start", json={"phone": "00421 905-123-456"})
    assert resp.status_code == 200 and resp.json()["ok"] is True
    assert sms.started == [PHONE]
    assert PARTY_COOKIE not in resp.headers.get("set-cookie", "")
    await login(gc, party.id)
    assert snapshot(phone_app) == before


async def test_verify_wrong_code_keeps_the_cookie(gc, phone_app, make_party, clock):
    first = await add_party(phone_app, make_party, clock)
    second = await add_party(phone_app, make_party, clock, id="p-second", name="Druha")
    await login(gc, first.id)
    cookie = gc.cookies[PARTY_COOKIE]
    resp = await login(gc, second.id, code="000000")
    assert resp.status_code == 401 and error_of(resp)["code"] == "bad_sms_code"
    assert "set-cookie" not in resp.headers and gc.cookies[PARTY_COOKIE] == cookie
    resp = await login(gc, second.id)
    assert resp.status_code == 200
    assert sorted((await gc.get("/api/session")).json()["verified"]) == sorted([first.id, second.id])


async def test_verify_with_another_number_is_a_mismatch(gc, phone_app, make_party, clock):
    party = await add_party(phone_app, make_party, clock)
    resp = await login(gc, party.id, phone="0900 000 000")
    assert resp.status_code == 403 and error_of(resp)["code"] == "phone_mismatch"


async def test_logout_removes_only_that_party(gc, phone_app, make_party, clock):
    first = await add_party(phone_app, make_party, clock)
    second = await add_party(phone_app, make_party, clock, id="p-second", name="Druha")
    await login(gc, first.id)
    await login(gc, second.id)
    resp = await gc.post("/api/logout", json={"party_id": first.id})
    assert resp.status_code == 200
    assert (await gc.get("/api/session")).json()["verified"] == [second.id]
    await gc.post("/api/logout", json={"party_id": second.id})
    assert (await gc.get("/api/session")).json()["verified"] == []


async def test_sms_off_and_client_errors_are_503(make_app, make_client, make_party, clock):
    app = make_app()  # no Twilio variables, no SMS_FAKE
    party = await add_party(app, make_party, clock)
    async with make_client(app) as c:
        await c.post("/api/join", json={"code": "group-test-code"})
        assert (await c.get("/api/session")).json()["sms_enabled"] is False
        for path, body in (("start", {"phone": TYPED}), ("verify", {"phone": TYPED, "code": CODE})):
            resp = await c.post(f"/api/parties/{party.id}/login/{path}", json=body)
            assert resp.status_code == 503 and error_of(resp)["code"] == "sms_unavailable"


async def test_client_failure_is_503(gc, phone_app, make_party, clock, sms):
    party = await add_party(phone_app, make_party, clock)
    sms.fail = True
    resp = await gc.post(f"/api/parties/{party.id}/login/start", json={"phone": TYPED})
    assert resp.status_code == 503 and error_of(resp)["code"] == "sms_unavailable"
    resp = await login(gc, party.id)
    assert resp.status_code == 503 and error_of(resp)["code"] == "sms_unavailable"


async def test_second_sms_within_a_minute_is_limited(gc, phone_app, make_party, clock, sms):
    party = await add_party(phone_app, make_party, clock)
    url = f"/api/parties/{party.id}/login/start"
    assert (await gc.post(url, json={"phone": TYPED})).status_code == 200
    resp = await gc.post(url, json={"phone": TYPED})
    assert resp.status_code == 429 and error_of(resp)["params"]["retry_after"] >= 1 and "retry-after" in resp.headers
    assert len(sms.started) == 1
    clock.advance(61)
    assert (await gc.post(url, json={"phone": TYPED})).status_code == 200


async def test_sixth_code_attempt_is_limited(gc, phone_app, make_party, clock):
    party = await add_party(phone_app, make_party, clock)
    for _ in range(5):
        assert (await login(gc, party.id, code="000000")).status_code == 401
    resp = await login(gc, party.id)  # even the right code waits
    assert resp.status_code == 429 and error_of(resp)["params"]["retry_after"] >= 1


async def test_mismatches_on_start_count_as_attempts(gc, phone_app, make_party, clock):
    party = await add_party(phone_app, make_party, clock)
    url = f"/api/parties/{party.id}/login/start"
    for _ in range(5):
        assert (await gc.post(url, json={"phone": "0900 000 000"})).status_code == 403
    assert (await gc.post(url, json={"phone": "0900 000 000"})).status_code == 429


async def test_verify_is_not_counted_in_the_write_limit(gc, phone_app, make_party, clock):
    party = await add_party(phone_app, make_party, clock)
    headers = {"X-Client-Id": "one-device"}
    for _ in range(30):  # logout counts toward the 30 writes per minute
        assert (await gc.post("/api/logout", json={"party_id": "p-x"}, headers=headers)).status_code == 200
    assert (await gc.post("/api/logout", json={"party_id": "p-x"}, headers=headers)).status_code == 429
    resp = await gc.post(
        f"/api/parties/{party.id}/login/verify", json={"phone": TYPED, "code": CODE}, headers=headers
    )
    assert resp.status_code == 200


# --- access rule on the party writes (T-093) ----------------------------------------------------

from tests.api_helpers import A1, A2, FRI, OKNO, THU, party_body  # noqa: E402


def write_requests(pid: str) -> list[tuple[str, str, dict]]:
    return [
        ("put", f"/api/parties/{pid}", party_body("Renamed")),
        ("post", "/api/assign", {"night": FRI, "slots": [A2], "party_id": pid}),
        ("post", "/api/assign-stay", {"slots": [OKNO], "party_id": pid}),
        ("post", "/api/clear", {"night": THU, "slot": A1}),
        ("post", "/api/move", {"party_id": pid, "from_slot": A1, "to_slot": A2, "nights": [THU]}),
        ("post", "/api/places", {"party_id": pid, "night": THU, "places": 1}),
        ("post", "/api/food", {"party_id": pid, "text": "no nuts"}),
        ("post", "/api/briefing", {"party_id": pid, "step": "pack"}),
    ]


WRITE_IDS = ["update", "assign", "assign-stay", "clear", "move", "places", "food", "briefing"]


async def protected_party_sleeping(app, make_party, clock):
    party = await add_party(app, make_party, clock)
    async with app.state.runtime.store.write(action="seed", source="form", client_id=None) as tx:
        tx.state.sleeping.setdefault(THU, {})[A1] = party.id
    return party


@pytest.mark.parametrize("index", range(len(WRITE_IDS)), ids=WRITE_IDS)
async def test_protected_party_writes_need_login(index, gc, phone_app, make_party, clock):
    party = await protected_party_sleeping(phone_app, make_party, clock)
    method, url, body = write_requests(party.id)[index]
    before = snapshot(phone_app)
    resp = await getattr(gc, method)(url, json=body)
    assert resp.status_code == 403
    error = error_of(resp)
    assert error["code"] == "login_required"
    assert error["params"] == {"party_id": party.id, "party_name": party.name}
    assert "state" in resp.json()
    assert snapshot(phone_app) == before

    # The same request goes through once this device verified the party.
    assert (await login(gc, party.id)).status_code == 200
    resp = await getattr(gc, method)(url, json=body)
    assert resp.status_code == 200, resp.text


@pytest.mark.parametrize("index", range(len(WRITE_IDS)), ids=WRITE_IDS)
async def test_admin_needs_no_login(index, phone_app, make_client, make_party, clock):
    party = await protected_party_sleeping(phone_app, make_party, clock)
    method, url, body = write_requests(party.id)[index]
    async with make_client(phone_app) as admin:
        await admin.post("/api/join", json={"code": "admin-test-code"})
        resp = await getattr(admin, method)(url, json=body)
    assert resp.status_code == 200, resp.text


async def test_login_older_than_the_number_is_rejected(gc, phone_app, make_party, clock):
    party = await protected_party_sleeping(phone_app, make_party, clock)
    await login(gc, party.id)
    async with phone_app.state.runtime.store.write(action="phone", source="form", client_id=None) as tx:
        tx.state.parties[0].phone_set_at = datetime.fromtimestamp(clock.now + 5, tz=UTC).isoformat()
    clock.advance(10)
    resp = await gc.post("/api/places", json={"party_id": party.id, "night": THU, "places": 1})
    assert error_of(resp)["code"] == "login_required"


async def test_login_of_another_party_does_not_help(gc, phone_app, make_party, clock):
    one = await add_party(phone_app, make_party, clock)
    two = await add_party(phone_app, make_party, clock, phone="+421905999888")
    await login(gc, one.id)
    resp = await gc.post("/api/food", json={"party_id": two.id, "text": "x"})
    assert error_of(resp)["code"] == "login_required"


async def test_unprotected_party_and_free_slot_behave_as_before(gc, phone_app, make_party, clock):
    open_party = make_party()
    async with phone_app.state.runtime.store.write(action="seed", source="form", client_id=None) as tx:
        tx.state.parties.append(open_party)
    assert (await gc.post("/api/food", json={"party_id": open_party.id, "text": "x"})).status_code == 200
    await add_party(phone_app, make_party, clock)
    before = snapshot(phone_app)
    resp = await gc.post("/api/clear", json={"night": THU, "slot": A1})  # free slot: a no-op, even next to protected parties
    assert resp.status_code == 200
    assert snapshot(phone_app) == before
    resp = await gc.post("/api/food", json={"party_id": "p-nobody", "text": "x"})
    assert error_of(resp)["code"] == "unknown_party"


async def test_login_required_comes_before_the_slot_rules(gc, phone_app, make_party, clock):
    # Slot THU/A1 is held by a protected party; a second protected party without login asks for it.
    await protected_party_sleeping(phone_app, make_party, clock)
    other = await add_party(phone_app, make_party, clock, phone="+421905999888")
    resp = await gc.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": other.id})
    assert error_of(resp)["code"] == "login_required"


async def test_tampered_party_cookie_does_not_pass_the_write_check(gc, phone_app, make_party, clock):
    party = await protected_party_sleeping(phone_app, make_party, clock)
    gc.cookies.set(PARTY_COOKIE, "tampered.value")
    before = snapshot(phone_app)
    resp = await gc.post("/api/food", json={"party_id": party.id, "text": "x"})
    assert error_of(resp)["code"] == "login_required"
    assert snapshot(phone_app) == before


# --- phone management (T-094) -----------------------------------------------------------------

NEW_TYPED = "0911 222 333"
NEW_PHONE = "+421911222333"


async def add_plain(app, make_party):
    party = make_party()
    async with app.state.runtime.store.write(action="party-create", source="form", client_id=None) as tx:
        tx.state.parties.append(party)
    return party


def stored(app, party_id):
    return next(p for p in app.state.runtime.store.read().parties if p.id == party_id)


async def set_phone(c, party_id, typed=NEW_TYPED, code=CODE):
    assert (await c.post(f"/api/parties/{party_id}/phone/start", json={"phone": typed})).status_code == 200
    return await c.post(f"/api/parties/{party_id}/phone/verify", json={"phone": typed, "code": code})


async def test_unprotected_party_gets_a_number_after_the_code(gc, phone_app, make_party, sms):
    from tests.api_helpers import audit_docs, backup_count

    party = await add_plain(phone_app, make_party)
    before = snapshot(phone_app)
    resp = await gc.post(f"/api/parties/{party.id}/phone/start", json={"phone": NEW_TYPED})
    assert resp.status_code == 200 and sms.started == [NEW_PHONE]
    assert snapshot(phone_app) == before and stored(phone_app, party.id).phone is None

    bad = await gc.post(f"/api/parties/{party.id}/phone/verify", json={"phone": NEW_TYPED, "code": "000000"})
    assert bad.status_code == 401 and error_of(bad)["code"] == "bad_sms_code"
    assert snapshot(phone_app) == before

    rt = phone_app.state.runtime
    _conn, gen = await _stream(rt)
    resp = await gc.post(f"/api/parties/{party.id}/phone/verify", json={"phone": NEW_TYPED, "code": CODE})
    assert resp.status_code == 200, resp.text
    saved = stored(phone_app, party.id)
    assert saved.phone == NEW_PHONE and saved.phone_set_at
    version, backups, audits = snapshot(phone_app)
    assert (version, backups, audits) == (before[0] + 1, before[1] + 1, before[2] + 1)
    assert audit_docs(phone_app)[-1]["action"] == "phone_set"
    assert audit_docs(phone_app)[-1]["phone_hint"] == "333"
    assert backup_count(phone_app) == backups
    assert "phone" not in str(resp.json()["state"]["parties"]) or "phone_hint" in str(resp.json()["state"]["parties"])
    assert NEW_PHONE not in resp.text
    event, data = await _frame(gen)
    assert event == "state" and data["version"] == version
    await gen.aclose()

    # The same device is now verified at exactly phone_set_at.
    assert (await gc.get("/api/session")).json()["verified"] == [party.id]
    cookie = rt.party_cookies.load(gc.cookies.get(PARTY_COOKIE))
    assert cookie[party.id] == datetime.fromisoformat(saved.phone_set_at).timestamp()
    assert (await gc.post("/api/assign", json={"night": "2026-10-29", "slots": ["left-double-1"], "party_id": party.id})).status_code == 200


async def _stream(rt):
    conn = rt.hub.connect("sse", None)
    gen = rt.hub.stream(conn, {"hello": 1})
    await anext(gen)
    return conn, gen


async def _frame(gen):
    import asyncio
    import json

    lines = (await asyncio.wait_for(anext(gen), 2.0)).strip().splitlines()
    return lines[0].removeprefix("event: "), json.loads(lines[1].removeprefix("data: "))


async def test_protected_party_needs_a_verified_device_or_admin(gc, phone_app, make_client, make_party, clock):
    party = await add_party(phone_app, make_party, clock)
    before = snapshot(phone_app)
    calls = (
        ("post", f"/api/parties/{party.id}/phone/start", {"phone": NEW_TYPED}),
        ("post", f"/api/parties/{party.id}/phone/verify", {"phone": NEW_TYPED, "code": CODE}),
        ("delete", f"/api/parties/{party.id}/phone", None),
    )
    for method, url, body in calls:
        resp = await (gc.delete(url) if method == "delete" else gc.post(url, json=body))
        assert resp.status_code == 403 and error_of(resp)["code"] == "login_required"
    assert snapshot(phone_app) == before and stored(phone_app, party.id).phone == PHONE

    async with make_client(phone_app) as admin:
        await admin.post("/api/join", json={"code": "admin-test-code"})
        assert (await set_phone(admin, party.id)).status_code == 200
    assert stored(phone_app, party.id).phone == NEW_PHONE


async def test_unknown_party_and_invalid_number(gc, phone_app, make_party):
    resp = await gc.post("/api/parties/p-nope00/phone/start", json={"phone": NEW_TYPED})
    assert resp.status_code == 404 and error_of(resp)["code"] == "unknown_party"
    party = await add_plain(phone_app, make_party)
    for path, body in (("start", {"phone": "12"}), ("verify", {"phone": "abc", "code": CODE})):
        resp = await gc.post(f"/api/parties/{party.id}/phone/{path}", json=body)
        assert resp.status_code == 422
        assert error_of(resp)["code"] == "invalid" and error_of(resp)["params"]["field"] == "phone"


async def test_changing_the_number_cancels_other_devices(gc, phone_app, make_client, make_party, clock):
    party = await add_party(phone_app, make_party, clock)
    async with make_client(phone_app) as b:
        await b.post("/api/join", json={"code": "group-test-code"})
        assert (await login(gc, party.id)).status_code == 200  # device A
        assert (await login(b, party.id)).status_code == 200  # device B
        clock.now += 30
        assert (await set_phone(b, party.id)).status_code == 200
        assert (await b.get("/api/session")).json()["verified"] == [party.id]
    resp = await gc.delete(f"/api/parties/{party.id}/phone")
    assert resp.status_code == 403 and error_of(resp)["code"] == "login_required"
    assert (await gc.get("/api/session")).json()["verified"] == []


async def test_remove_phone(gc, phone_app, make_client, make_party, clock):
    from tests.api_helpers import audit_docs

    party = await add_party(phone_app, make_party, clock)
    async with make_client(phone_app) as admin:  # never verified the party
        await admin.post("/api/join", json={"code": "admin-test-code"})
        before = snapshot(phone_app)
        resp = await admin.delete(f"/api/parties/{party.id}/phone")
        assert resp.status_code == 200
        saved = stored(phone_app, party.id)
        assert saved.phone is None and saved.phone_set_at is None
        assert snapshot(phone_app) == (before[0] + 1, before[1] + 1, before[2] + 1)
        doc = audit_docs(phone_app)[-1]
        assert doc["action"] == "phone_remove" and doc["phone_hint"] == "456"
        again = snapshot(phone_app)
        assert (await admin.delete(f"/api/parties/{party.id}/phone")).status_code == 200
        assert snapshot(phone_app) == again  # no-op


async def test_sms_off_blocks_start_and_verify_but_not_delete(make_app, make_client, make_party, clock):
    app = make_app()
    party = await add_party(app, make_party, clock)
    async with make_client(app) as admin:
        await admin.post("/api/join", json={"code": "admin-test-code"})
        for path, body in (("start", {"phone": NEW_TYPED}), ("verify", {"phone": NEW_TYPED, "code": CODE})):
            resp = await admin.post(f"/api/parties/{party.id}/phone/{path}", json=body)
            assert resp.status_code == 503 and error_of(resp)["code"] == "sms_unavailable"
        assert (await admin.delete(f"/api/parties/{party.id}/phone")).status_code == 200
    assert stored(app, party.id).phone is None


async def test_limits_and_no_full_number_in_audit_or_log(gc, phone_app, make_party, caplog):
    caplog.set_level(logging.DEBUG)
    party = await add_plain(phone_app, make_party)
    assert (await gc.post(f"/api/parties/{party.id}/phone/start", json={"phone": NEW_TYPED})).status_code == 200
    resp = await gc.post(f"/api/parties/{party.id}/phone/start", json={"phone": NEW_TYPED})
    assert resp.status_code == 429 and error_of(resp)["params"]["retry_after"] > 0
    for _ in range(5):
        assert (await gc.post(f"/api/parties/{party.id}/phone/verify", json={"phone": NEW_TYPED, "code": "1"})).status_code == 401
    resp = await gc.post(f"/api/parties/{party.id}/phone/verify", json={"phone": NEW_TYPED, "code": CODE})
    assert resp.status_code == 429 and error_of(resp)["code"] == "rate_limited"
    assert stored(phone_app, party.id).phone is None

    # Another party, so the limits do not hide the success path; then grep the audit file and the log.
    other = await add_plain(phone_app, make_party)
    assert (await set_phone(gc, other.id, "0905 111 222")).status_code == 200
    audit_text = phone_app.state.runtime.store.audit_path.read_text(encoding="utf-8")
    assert "+421905111222" not in audit_text and "905111222" not in audit_text and "phone_hint" in audit_text
    for number in (NEW_PHONE, "+421905111222", "911222333", "905111222"):
        assert number not in audit_text
        assert number not in caplog.text
