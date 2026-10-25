"""Last seen and online (T-049). The clock is injected, nothing sleeps."""

import yaml

PARTY_HEADER = "X-Party-Id"


async def add_party(app, party):
    async with app.state.runtime.store.write(action="party_create", source="form", client_id=None) as tx:
        tx.state.parties.append(party)


def seen_file(tmp_path):
    return tmp_path / "data" / "seen.yaml"


async def state_of(client, party_id=None):
    resp = await client.get("/api/state", headers={PARTY_HEADER: party_id} if party_id else {})
    return resp.json()["state"]


async def test_records_via_header_and_presence(group_client, app, make_party, clock):
    party = make_party()
    await add_party(app, party)
    state = await state_of(group_client, party.id)
    presence = state["presence"]
    assert presence["online"] == [party.id]
    assert set(presence["last_seen"]) == {party.id}
    assert presence["server_time"]
    assert presence["last_seen"][party.id] == presence["server_time"]


async def test_recorded_on_304(group_client, app, make_party, clock):
    party = make_party()
    await add_party(app, party)
    etag = (await group_client.get("/api/state")).headers["etag"]
    resp = await group_client.get("/api/state", headers={"If-None-Match": etag, PARTY_HEADER: party.id})
    assert resp.status_code == 200  # the new party coming online changes the tag
    etag = resp.headers["etag"]
    clock.advance(5)
    resp = await group_client.get("/api/state", headers={"If-None-Match": etag, PARTY_HEADER: party.id})
    assert resp.status_code == 304
    assert app.state.runtime.seen.seen[party.id] == clock.now


async def test_ignored_header_values(group_client, app, make_party):
    party = make_party()
    await add_party(app, party)
    for value in ("p-zzzzzz", "garbage !!", "", "x" * 500):
        resp = await group_client.get("/api/state", headers={PARTY_HEADER: value})
        assert resp.status_code == 200
        assert resp.json()["state"]["presence"]["last_seen"] == {}
    assert app.state.runtime.seen.seen == {}


async def test_no_cookie_no_record(client, app, make_party):
    party = make_party()
    await add_party(app, party)
    resp = await client.get("/api/state", headers={PARTY_HEADER: party.id})
    assert resp.status_code == 401
    assert app.state.runtime.seen.seen == {}


async def test_no_version_backup_audit_or_rate_limit(group_client, app, make_party, tmp_path):
    party = make_party()
    await add_party(app, party)
    data = tmp_path / "data"
    backups = sorted((data / "backups").iterdir())
    audit = (data / "audit.yaml").read_bytes()
    before = await state_of(group_client)
    limit = app.state.runtime.app_config.limits.writes_per_client_minute
    for _ in range(limit + 5):
        await group_client.get("/api/state", headers={PARTY_HEADER: party.id, "X-Client-Id": "c1"})
    after = await state_of(group_client)
    assert (after["version"], after["updated_at"]) == (before["version"], before["updated_at"])
    assert sorted((data / "backups").iterdir()) == backups
    assert (data / "audit.yaml").read_bytes() == audit
    assert app.state.runtime.write_limiter.allow("id:c1")


async def test_rejected_write_records_and_has_presence(group_client, app, make_party):
    party = make_party()
    await add_party(app, party)
    resp = await group_client.post(
        "/api/assign",
        json={"night": "2099-01-01", "slot": "nope", "party_id": party.id},
        headers={PARTY_HEADER: party.id},
    )
    body = resp.json()
    assert body["ok"] is False
    assert body["state"]["presence"]["online"] == [party.id]


async def test_online_window(group_client, app, make_party, clock):
    party = make_party()
    await add_party(app, party)
    await state_of(group_client, party.id)
    clock.advance(74)
    assert (await state_of(group_client))["presence"]["online"] == [party.id]
    clock.advance(2)  # 76 s
    presence = (await state_of(group_client))["presence"]
    assert presence["online"] == []
    assert party.id in presence["last_seen"]


async def test_file_writes_are_throttled(group_client, app, make_party, clock, tmp_path):
    party = make_party()
    await add_party(app, party)
    await state_of(group_client, party.id)
    first = seen_file(tmp_path).read_text(encoding="utf-8")
    assert list(yaml.safe_load(first)) == [party.id]
    clock.advance(30)
    await state_of(group_client, party.id)
    assert seen_file(tmp_path).read_text(encoding="utf-8") == first  # not rewritten
    assert app.state.runtime.seen.seen[party.id] == clock.now  # memory is current
    clock.advance(31)
    await state_of(group_client, party.id)
    assert seen_file(tmp_path).read_text(encoding="utf-8") != first
    assert not list((tmp_path / "data").glob(".seen.yaml.*"))


async def test_unknown_ids_are_not_written(group_client, tmp_path):
    await state_of(group_client, "p-nobody")
    assert not seen_file(tmp_path).exists()


async def test_etag_follows_presence(group_client, app, make_party, clock):
    a, b = make_party(), make_party()
    await add_party(app, a)
    await add_party(app, b)
    etag0 = (await group_client.get("/api/state", headers={PARTY_HEADER: a.id})).headers["etag"]
    # nothing relevant changed: 304 (same minute, still online)
    resp = await group_client.get("/api/state", headers={"If-None-Match": etag0})
    assert resp.status_code == 304
    # a second party comes online
    resp = await group_client.get("/api/state", headers={"If-None-Match": etag0, PARTY_HEADER: b.id})
    assert resp.status_code == 200
    etag1 = resp.headers["etag"]
    assert etag1 != etag0
    assert (await group_client.get("/api/state", headers={"If-None-Match": etag1})).status_code == 304
    # both drop out of the window
    clock.advance(100)
    resp = await group_client.get("/api/state", headers={"If-None-Match": etag1})
    assert resp.status_code == 200
    assert resp.headers["etag"] != etag1


async def test_startup_with_bad_files(make_app, tmp_path, make_party, caplog):
    data = tmp_path / "data"
    for content in (": : not yaml [", "- a\n- b\n", "p-x: 5\n"):
        data.mkdir(exist_ok=True)
        (data / "seen.yaml").write_text(content, encoding="utf-8")
        caplog.clear()
        app = make_app()
        assert app.state.runtime.seen.seen == {}
        warnings = [r for r in caplog.records if r.name == "chrapa.seen" and r.levelname == "WARNING"]
        assert warnings, f"no English warning logged for {content!r}"
    (data / "seen.yaml").write_text("", encoding="utf-8")
    assert make_app().state.runtime.seen.seen == {}


async def test_startup_loads_and_drops_unknown(make_app, tmp_path, make_party, clock):
    app = make_app()
    party = make_party()
    await add_party(app, party)
    (tmp_path / "data" / "seen.yaml").write_text(
        yaml.safe_dump({party.id: "2026-10-25T10:00:00+00:00", "p-gone00": "2026-10-25T10:00:00+00:00"}),
        encoding="utf-8",
    )
    app2 = make_app()
    assert list(app2.state.runtime.seen.seen) == [party.id]
