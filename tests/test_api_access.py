"""Startup, page serving, join and cookies, state with ETag, the error envelope, the limits over HTTP."""

import logging
import re
import secrets
import shutil
import tomllib
from pathlib import Path

import pytest
import yaml
from fastapi import Depends
from pydantic import BaseModel

import app.main as main_module
from app.main import (
    ADMIN_COOKIE,
    GROUP_COOKIE,
    CookieSigner,
    configure_logging,
    enforce_write_limit,
    load_settings,
    require_admin,
    require_group,
    state_etag,
)
from app.models import ConfigError, State
from app.store import StartupError
from tests.conftest import ROOT, TEST_ENV

STATE_KEYS = {"version", "updated_at", "signup_open", "event", "layout", "parties", "sleeping", "briefing", "presence", "asset_version", "info"}


async def test_join_logs_are_emitted(client, caplog):
    caplog.set_level(logging.INFO, logger="chrapa")
    await client.post("/api/join", json={"code": "secret-guess"})
    await client.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})
    messages = [r.getMessage() for r in caplog.records if r.name == "chrapa.app"]
    assert any("wrong code attempt from 203.0.113.7" in m for m in messages)
    assert any("join as group from 203.0.113.7" in m for m in messages)
    assert not any("secret-guess" in m or TEST_ENV["GROUP_CODE"] in m for m in messages)


def test_configure_logging_adds_one_handler():
    logger = logging.getLogger("chrapa-test-logger")
    try:
        configure_logging("chrapa-test-logger", logging.INFO)
        configure_logging("chrapa-test-logger", logging.INFO)
        assert len(logger.handlers) == 1
        assert logger.level == logging.INFO
    finally:
        logger.handlers.clear()


def error_of(resp):
    body = resp.json()
    assert body["ok"] is False
    assert set(body["error"]) == {"code", "message", "params"}
    assert isinstance(body["error"]["params"], dict)
    assert body["error"]["message"].isascii(), "the server must not send Slovak text"
    return body["error"]


# --- startup ---------------------------------------------------------------------


def test_startup_creates_a_fresh_data_file(make_app, tmp_path):
    make_app()
    data = yaml.safe_load((tmp_path / "data" / "cabin-data.yaml").read_text(encoding="utf-8"))
    assert data["version"] == 0


@pytest.mark.parametrize("missing", ["GROUP_CODE", "ADMIN_CODE", "SECRET_KEY"])
def test_startup_stops_on_a_missing_variable(make_app, missing):
    env = {k: v for k, v in TEST_ENV.items() if k != missing}
    with pytest.raises(ConfigError, match=missing):
        make_app(env=env)


def test_startup_names_every_missing_variable(make_app):
    with pytest.raises(ConfigError) as err:
        make_app(env={"SECRET_KEY": "  "})
    assert all(name in str(err.value) for name in ("GROUP_CODE", "ADMIN_CODE", "SECRET_KEY"))


def test_startup_refuses_equal_codes():
    with pytest.raises(ConfigError, match="must differ"):
        load_settings({"GROUP_CODE": "same", "ADMIN_CODE": "same", "SECRET_KEY": "k" * 32})


@pytest.mark.parametrize("key", ["x", "k" * 31, " " + "k" * 31 + " "])
def test_startup_refuses_a_short_secret_key(make_app, key):
    with pytest.raises(ConfigError, match="SECRET_KEY must be at least 32"):
        make_app(env={**TEST_ENV, "SECRET_KEY": key})


def test_startup_accepts_a_32_character_secret_key(make_app):
    make_app(env={**TEST_ENV, "SECRET_KEY": "k" * 32})


def test_env_values_are_stripped():
    settings = load_settings({"GROUP_CODE": " g ", "ADMIN_CODE": "a\n", "SECRET_KEY": " " + "k" * 32})
    assert (settings.group_code, settings.admin_code, settings.secret_key) == ("g", "a", "k" * 32)


def test_startup_runs_the_data_file_check(make_app, tmp_path):
    (tmp_path / "data").mkdir()
    bad = {"version": 3, "updated_at": "2026-10-25T19:02:11+02:00", "sleeping": {"2026-10-29": {"nope": "p-abcdef"}}}
    (tmp_path / "data" / "cabin-data.yaml").write_text(yaml.safe_dump(bad), encoding="utf-8")
    with pytest.raises(StartupError, match="unknown slot"):
        make_app()


def test_startup_stops_on_a_broken_config_file(make_app, tmp_path):
    config = tmp_path / "config"
    config.mkdir()
    (config / "cabin.yaml").write_text("rooms: []\n", encoding="utf-8")
    (config / "app.yaml").write_text((ROOT / "config" / "app.yaml").read_text(encoding="utf-8"), encoding="utf-8")
    with pytest.raises(ConfigError):
        make_app(config_dir=config)


def test_startup_stops_without_the_page(make_app, tmp_path):
    with pytest.raises(ConfigError, match="index.html"):
        make_app(static_dir=tmp_path / "no-static")


def test_module_level_app_reports_a_startup_problem(monkeypatch):
    for name in TEST_ENV:
        monkeypatch.delenv(name, raising=False)
    try:
        with pytest.raises(ConfigError, match="GROUP_CODE"):
            main_module.app  # noqa: B018 (module __getattr__ builds the app)
    finally:
        logging.getLogger("chrapa").handlers.clear()  # undo configure_logging for the other tests


# --- the page and what is not reachable ---------------------------------------------


async def test_index_page(client):
    resp = await client.get("/")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    assert "<!DOCTYPE html>" in resp.text
    assert 'lang="sk"' in resp.text


PROJECT_VERSION = tomllib.loads((Path(__file__).resolve().parent.parent / "pyproject.toml").read_text())["project"]["version"]


@pytest.mark.parametrize("path", ["/", "/api/health"])
async def test_head_is_answered(client, path):
    assert (await client.head(path)).status_code == 200


async def test_health_needs_no_cookie(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "version": PROJECT_VERSION}


async def test_health_version_unknown_without_pyproject(make_app, make_client, tmp_path, caplog):
    async with make_client(make_app(pyproject=tmp_path / "missing.toml")) as c:
        resp = await c.get("/api/health")
    assert resp.json() == {"ok": True, "version": "unknown"}
    assert sum("App version unavailable" in r.message for r in caplog.records) == 1


SCRIPT_URL = re.compile(r'<script src="(static/js/[\w-]+\.js)\?v=([0-9a-f]{12})"></script>')


async def test_page_loads_every_script_with_a_version_query(client):
    resp = await client.get("/")
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "no-cache"
    assert "__ASSET_VERSION__" not in resp.text
    scripts = SCRIPT_URL.findall(resp.text)
    on_disk = sorted(p.name for p in (ROOT / "static" / "js").glob("*.js"))
    assert sorted(path.rsplit("/", 1)[1] for path, _ in scripts) == on_disk
    assert len({version for _, version in scripts}) == 1
    for path, version in scripts:
        js = await client.get(f"/{path}?v={version}")
        assert js.status_code == 200


async def test_script_version_changes_with_the_code(make_app, make_client, tmp_path):
    static = tmp_path / "static"
    shutil.copytree(ROOT / "static", static)
    app = make_app(static_dir=static)
    async with make_client(app) as c:
        first = SCRIPT_URL.search((await c.get("/")).text).group(2)
        again = SCRIPT_URL.search((await c.get("/")).text).group(2)
        assert first == again
        with (static / "js" / "app-start.js").open("a", encoding="utf-8") as f:
            f.write("// changed\n")
        changed = SCRIPT_URL.search((await c.get("/")).text).group(2)
        assert changed != first


async def test_static_folder_is_served(client):
    resp = await client.get("/static/index.html")
    assert resp.status_code == 200
    assert "<!DOCTYPE html>" in resp.text


@pytest.mark.parametrize(
    "path",
    [
        "/data/cabin-data.yaml",
        "/config/app.yaml",
        "/files/mapa-nahlad.html",
        "/.env",
        "/static/../data/cabin-data.yaml",
        "/static/%2e%2e/data/cabin-data.yaml",
        "/static/..%2fdata/cabin-data.yaml",
        "/static/../.env",
        "/static/",
        "/openapi.json",
        "/docs",
    ],
)
async def test_nothing_outside_static_is_reachable(client, path):
    resp = await client.get(path)
    assert resp.status_code == 404
    assert "version" not in resp.text
    assert "GROUP_CODE" not in resp.text


# --- join ---------------------------------------------------------------------------------


def cookies_set(resp) -> dict[str, str]:
    """Raw Set-Cookie headers by cookie name."""
    out = {}
    for header in resp.headers.get_list("set-cookie"):
        out[header.split("=", 1)[0]] = header
    return out


async def test_join_with_the_group_code(client):
    resp = await client.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "role": "group"}
    assert set(cookies_set(resp)) == {GROUP_COOKIE}


async def test_join_with_the_admin_code_sets_both_cookies(client):
    resp = await client.post("/api/join", json={"code": TEST_ENV["ADMIN_CODE"]})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "role": "admin"}
    assert set(cookies_set(resp)) == {GROUP_COOKIE, ADMIN_COOKIE}


@pytest.mark.parametrize("code", ["wrong", "", "   ", "group-test-code x", "GROUP-TEST-CODE", "skupina-žľťč"])
async def test_join_with_a_wrong_code(client, code):
    resp = await client.post("/api/join", json={"code": code})
    assert resp.status_code == 401
    assert error_of(resp)["code"] == "bad_code"
    assert "state" not in resp.json()
    assert "set-cookie" not in resp.headers


@pytest.mark.parametrize(
    "code, role",
    [(" group-test-code", "group"), ("group-test-code \n", "group"), ("\tadmin-test-code ", "admin")],
)
async def test_join_trims_the_submitted_code(client, code, role):
    resp = await client.post("/api/join", json={"code": code})
    assert resp.status_code == 200
    assert resp.json()["role"] == role


async def test_join_compares_with_compare_digest(client, monkeypatch):
    calls = []
    real = secrets.compare_digest

    def spy(a, b):
        calls.append((a, b))
        return real(a, b)

    monkeypatch.setattr(secrets, "compare_digest", spy)
    await client.post("/api/join", json={"code": "wrong"})
    compared = {b for _, b in calls}
    assert {TEST_ENV["GROUP_CODE"].encode(), TEST_ENV["ADMIN_CODE"].encode()} <= compared
    assert all(a == b"wrong" for a, _ in calls[:2])


async def test_join_validates_the_body(client):
    for body, field in (({}, "code"), ({"code": 5}, "code"), ({"code": "x", "extra": 1}, "extra"), ({"code": "x" * 300}, "code")):
        resp = await client.post("/api/join", json=body)
        assert resp.status_code == 422
        err = error_of(resp)
        assert err["code"] == "invalid"
        assert err["params"] == {"field": field}
        assert "state" not in resp.json()  # the caller is not authorized


async def test_join_with_a_body_that_is_not_json(client):
    resp = await client.post("/api/join", content=b"not json", headers={"content-type": "application/json"})
    assert resp.status_code == 422
    assert error_of(resp)["code"] == "invalid"
    assert error_of(resp)["params"] == {}


# --- cookies -----------------------------------------------------------------------------------


async def test_cookie_attributes_and_lifetimes(client):
    resp = await client.post("/api/join", json={"code": TEST_ENV["ADMIN_CODE"]})
    jar = cookies_set(resp)
    for name, max_age in ((GROUP_COOKIE, 30 * 24 * 3600), (ADMIN_COOKIE, 12 * 3600)):
        attrs = [a.strip().lower() for a in jar[name].split(";")]
        assert "httponly" in attrs
        assert "secure" in attrs
        assert "samesite=lax" in attrs
        assert f"max-age={max_age}" in attrs
        assert "path=/" in attrs


def tamper(token: str) -> str:
    """Change the first character of the signature. (The last base64 character may carry unused bits.)"""
    payload, _, signature = token.rpartition(".")
    return f"{payload}.{'B' if signature[0] == 'A' else 'A'}{signature[1:]}"


CODES = {"group": TEST_ENV["GROUP_CODE"], "admin": TEST_ENV["ADMIN_CODE"]}


async def test_cookies_are_signed(app):
    signer = CookieSigner(TEST_ENV["SECRET_KEY"], CODES)
    token = signer.issue("group")
    assert signer.is_valid("group", token)
    assert not signer.is_valid("group", None)
    assert not signer.is_valid("group", "")
    assert not signer.is_valid("group", "garbage")
    assert not signer.is_valid("group", tamper(token))  # tampered signature
    assert not CookieSigner("another-secret-key" * 2, CODES).is_valid("group", token)  # signed with another key
    assert not signer.is_valid("admin", token)  # a group cookie is not an admin cookie


async def test_changing_a_code_revokes_its_cookies(make_app, make_client, clock):
    app = make_app()
    async with make_client(app) as admin:
        await admin.post("/api/join", json={"code": TEST_ENV["ADMIN_CODE"]})
        group_token, admin_token = admin.cookies[GROUP_COOKIE], admin.cookies[ADMIN_COOKIE]

    async def status_with(env):
        async with make_client(make_app(env=env)) as c:
            c.cookies.set(GROUP_COOKIE, group_token)
            c.cookies.set(ADMIN_COOKIE, admin_token)
            return (await c.get("/api/state")).status_code

    assert await status_with(TEST_ENV) == 200  # same codes: still logged in
    assert await status_with({**TEST_ENV, "GROUP_CODE": "a-new-group-code"}) == 401
    assert await status_with({**TEST_ENV, "ADMIN_CODE": "a-new-admin-code"}) == 200  # only the admin cookie dies
    signer = CookieSigner(TEST_ENV["SECRET_KEY"], {**CODES, "admin": "a-new-admin-code"}, clock)
    assert not signer.is_valid("admin", admin_token)
    assert signer.is_valid("group", group_token)


async def test_cookie_with_forged_payload_is_rejected(client):
    """A payload signed with the right key but another salt (or no signature) must not pass."""
    forged = CookieSigner(TEST_ENV["SECRET_KEY"], CODES).issue("admin")
    client.cookies.set(GROUP_COOKIE, forged)
    resp = await client.get("/api/state")
    assert resp.status_code == 401


async def test_tampered_cookie_is_rejected_over_http(group_client):
    token = group_client.cookies[GROUP_COOKIE]
    group_client.cookies.set(GROUP_COOKIE, tamper(token))
    resp = await group_client.get("/api/state")
    assert resp.status_code == 401
    assert error_of(resp)["code"] == "bad_code"


async def test_group_cookie_expires_after_30_days(group_client, clock):
    clock.advance(30 * 24 * 3600 - 1)
    assert (await group_client.get("/api/state")).status_code == 200
    clock.advance(2)
    resp = await group_client.get("/api/state")
    assert resp.status_code == 401
    assert error_of(resp)["code"] == "bad_code"


async def test_admin_cookie_expires_after_12_hours(admin_client, clock, app):
    @app.get("/api/_admin-only")
    def admin_only(_auth=Depends(require_admin)):
        return {"ok": True}

    assert (await admin_client.get("/api/_admin-only")).status_code == 200
    clock.advance(12 * 3600 + 1)
    resp = await admin_client.get("/api/_admin-only")
    assert resp.status_code == 403
    assert error_of(resp)["code"] == "forbidden"
    assert (await admin_client.get("/api/state")).status_code == 200  # the group cookie is still valid


async def test_cookie_from_the_far_future_is_rejected(group_client, clock):
    clock.advance(-3600)  # the clock was set back an hour after the cookie was issued
    assert (await group_client.get("/api/state")).status_code == 401


# --- GET /api/state ---------------------------------------------------------------------------------


@pytest.mark.parametrize("headers", [{}, {"X-Client-Id": "abc"}])
async def test_state_without_a_cookie(client, headers):
    resp = await client.get("/api/state", headers=headers)
    assert resp.status_code == 401
    assert error_of(resp)["code"] == "bad_code"
    assert "state" not in resp.json()


async def test_state_with_a_bad_cookie(client):
    client.cookies.set(GROUP_COOKIE, "not-a-signed-value")
    resp = await client.get("/api/state")
    assert resp.status_code == 401
    assert "state" not in resp.json()


async def test_state_content(group_client, layout):
    resp = await group_client.get("/api/state")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    state = body["state"]
    assert set(state) == STATE_KEYS
    assert state["version"] == 0
    assert state["signup_open"] is True
    assert state["parties"] == []
    assert state["sleeping"] == {}
    assert state["event"]["nights"] == ["2026-10-29", "2026-10-30", "2026-10-31"]
    assert set(state["event"]) == {"name", "arrive_days", "leave_days", "nights"}
    assert state["layout"] == layout.model_dump(mode="json")
    assert [r["id"] for r in state["layout"]["rooms"]] == [r.id for r in layout.rooms]


async def test_state_reflects_writes(group_client, app, make_party):
    rt = app.state.runtime
    party = make_party()
    async with rt.store.write(action="party_create", source="form", client_id=None) as tx:
        tx.state.parties.append(party)
    state = (await group_client.get("/api/state")).json()["state"]
    assert state["version"] == 1
    assert [p["id"] for p in state["parties"]] == [party.id]


async def test_state_etag_and_304(group_client, app, make_party):
    resp = await group_client.get("/api/state")
    etag = resp.headers["etag"]
    assert etag.startswith('"0-')
    assert etag.endswith('"')

    same = await group_client.get("/api/state", headers={"If-None-Match": etag})
    assert same.status_code == 304
    assert same.content == b""
    assert same.headers["etag"] == etag

    for header in (f"W/{etag}", f'"other", {etag}', "*"):
        assert (await group_client.get("/api/state", headers={"If-None-Match": header})).status_code == 304
    assert (await group_client.get("/api/state", headers={"If-None-Match": '"nope"'})).status_code == 200

    async with app.state.runtime.store.write(action="signup", source="admin", client_id=None) as tx:
        tx.state.signup_open = False
    changed = await group_client.get("/api/state", headers={"If-None-Match": etag})
    assert changed.status_code == 200
    assert changed.headers["etag"] != etag
    assert changed.json()["state"]["signup_open"] is False


async def test_etag_stays_the_same_without_a_write(group_client):
    first = (await group_client.get("/api/state")).headers["etag"]
    second = (await group_client.get("/api/state")).headers["etag"]
    assert first == second


def test_etag_differs_after_a_restored_backup(make_state):
    """A restored older file has a lower or equal `version` but another `updated_at`."""
    current = make_state()
    restored = State(version=current.version, updated_at="2026-10-24T08:00:00+02:00")
    assert state_etag(current, "cfg") != state_etag(restored, "cfg")
    older = State(version=0, updated_at=current.updated_at)
    assert state_etag(current, "cfg") != state_etag(older, "cfg")
    assert state_etag(current, "cfg") != state_etag(current, "other-cfg")


async def test_etag_changes_when_cabin_yaml_changes(make_app, make_client, tmp_path):
    """After the organizer edits cabin.yaml and restarts, an old ETag must not give 304 (stale map)."""
    config = tmp_path / "config-edited"
    shutil.copytree(ROOT / "config", config)
    layout = yaml.safe_load((config / "cabin.yaml").read_text(encoding="utf-8"))
    old_name = layout["rooms"][0]["name"]
    layout["rooms"][0]["name"] = old_name + " (nové)"
    (config / "cabin.yaml").write_text(yaml.safe_dump(layout, allow_unicode=True, sort_keys=False), encoding="utf-8")

    first, second = make_app(), make_app(config_dir=config)  # one data dir, two layouts
    async with make_client(first) as c1, make_client(second) as c2:
        for c in (c1, c2):
            await c.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})
        resp1 = await c1.get("/api/state")
        old_etag = resp1.headers["etag"]
        assert (await c1.get("/api/state", headers={"If-None-Match": old_etag})).status_code == 304
        resp2 = await c2.get("/api/state", headers={"If-None-Match": old_etag})
        assert resp2.status_code == 200
        assert resp2.headers["etag"] != old_etag
        assert resp1.json()["state"]["version"] == resp2.json()["state"]["version"]  # only the layout differs
        assert resp2.json()["state"]["layout"]["rooms"][0]["name"] == old_name + " (nové)"


async def test_state_cache_control_is_private(group_client):
    resp = await group_client.get("/api/state")
    assert resp.headers["cache-control"] == "private, no-cache"


async def test_state_304_needs_the_cookie(client):
    resp = await client.get("/api/state", headers={"If-None-Match": "*"})
    assert resp.status_code == 401


# --- error envelope and dependencies ----------------------------------------------------------------------


class NameBody(BaseModel):
    name: str
    slots: list[str] = []


@pytest.fixture
def test_routes(app):
    """Extra routes that exercise the reusable dependencies the way T-004 will."""

    @app.post("/api/_body")
    def with_body(body: NameBody, _auth=Depends(require_group)):
        return {"ok": True}

    @app.get("/api/_admin")
    def admin_only(_auth=Depends(require_admin)):
        return {"ok": True}

    @app.post("/api/_write")
    def limited(_limit=Depends(enforce_write_limit)):
        return {"ok": True}

    return app


async def test_admin_dependency_returns_forbidden_with_state(test_routes, group_client):
    resp = await group_client.get("/api/_admin")
    assert resp.status_code == 403
    err = error_of(resp)
    assert err["code"] == "forbidden"
    assert err["params"] == {}
    assert set(resp.json()["state"]) == STATE_KEYS  # the caller is in the group, so the state is included


async def test_admin_dependency_without_cookies_is_bad_code(test_routes, client):
    resp = await client.get("/api/_admin")
    assert resp.status_code == 401
    assert error_of(resp)["code"] == "bad_code"
    assert "state" not in resp.json()


async def test_admin_dependency_passes_for_admin(test_routes, admin_client):
    assert (await admin_client.get("/api/_admin")).json() == {"ok": True}


async def test_validation_error_names_the_first_failing_field(test_routes, group_client):
    resp = await group_client.post("/api/_body", json={"slots": "x"})
    assert resp.status_code == 422
    err = error_of(resp)
    assert err["code"] == "invalid"
    assert err["params"] == {"field": "name"}
    assert set(resp.json()["state"]) == STATE_KEYS

    resp = await group_client.post("/api/_body", json={"name": "ok", "slots": [1, 2]})
    assert error_of(resp)["params"] == {"field": "slots"}  # the top-level field, not slots[0]


async def test_validation_error_without_cookie_has_no_state(test_routes, client):
    resp = await client.post("/api/_body", json={})
    assert resp.status_code == 401  # the cookie check runs first
    assert "state" not in resp.json()


# --- limits over HTTP ----------------------------------------------------------------------------------------


async def test_join_attempts_are_limited_per_ip(app, make_client, clock):
    async with make_client(app, ("198.51.100.1", 1)) as c, make_client(app, ("198.51.100.2", 1)) as other:
        for _ in range(10):
            assert (await c.post("/api/join", json={"code": "wrong"})).status_code == 401
        resp = await c.post("/api/join", json={"code": "wrong"})
        assert resp.status_code == 429
        err = error_of(resp)
        assert err["code"] == "rate_limited"
        assert err["params"]["retry_after"] >= 1
        assert "state" not in resp.json()
        assert "retry-after" in resp.headers
        # even the right code is refused while the limit holds
        assert (await c.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})).status_code == 429
        # another IP is not affected
        assert (await other.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})).status_code == 200
        clock.advance(61)
        assert (await c.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})).status_code == 200


async def test_successful_joins_do_not_count(app, make_client):
    """Friends on one cabin Wi-Fi share an IP and must all be able to join."""
    async with make_client(app, ("198.51.100.3", 1)) as c:
        for _ in range(25):
            assert (await c.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})).status_code == 200


async def test_failed_attempts_count_even_between_successes(app, make_client):
    async with make_client(app, ("198.51.100.6", 1)) as c:
        for _ in range(5):
            await c.post("/api/join", json={"code": "wrong"})
            assert (await c.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})).status_code == 200
        for _ in range(5):
            await c.post("/api/join", json={"code": "wrong"})
        assert (await c.post("/api/join", json={"code": "wrong"})).status_code == 429


async def test_write_limit_comes_from_app_yaml(app):
    assert app.state.runtime.write_limiter.limit == app.state.runtime.app_config.limits.writes_per_client_minute == 30


async def test_write_limit_per_client_id(test_routes, group_client, clock):
    mine, theirs = {"X-Client-Id": "client-a"}, {"X-Client-Id": "client-b"}
    for _ in range(30):
        assert (await group_client.post("/api/_write", headers=mine)).status_code == 200
    resp = await group_client.post("/api/_write", headers=mine)
    assert resp.status_code == 429
    err = error_of(resp)
    assert err["code"] == "rate_limited"
    assert err["params"]["retry_after"] >= 1
    assert set(resp.json()["state"]) == STATE_KEYS  # an authorized caller still gets the state
    assert (await group_client.post("/api/_write", headers=theirs)).status_code == 200
    clock.advance(61)
    assert (await group_client.post("/api/_write", headers=mine)).status_code == 200


async def test_write_limit_falls_back_to_the_ip(test_routes, app, make_client):
    async with make_client(app, ("198.51.100.4", 1)) as c, make_client(app, ("198.51.100.5", 1)) as other:
        for client in (c, other):
            await client.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})
        for _ in range(30):
            assert (await c.post("/api/_write")).status_code == 200
        assert (await c.post("/api/_write")).status_code == 429
        assert (await other.post("/api/_write")).status_code == 200
        # a client ID is a separate key from the IP
        assert (await c.post("/api/_write", headers={"X-Client-Id": "fresh"})).status_code == 200


async def test_write_limit_needs_the_group_cookie_first(test_routes, client):
    resp = await client.post("/api/_write")
    assert resp.status_code == 401
    assert error_of(resp)["code"] == "bad_code"


# --- phone never leaves the server (T-090) -------------------------------------------

PHONE = "+421905123456"


async def test_state_hides_the_phone_and_shows_a_hint(group_client, app, make_party):
    rt = app.state.runtime
    locked = make_party(phone=PHONE, phone_set_at="2026-10-25T10:00:00+02:00")
    free = make_party()
    async with rt.store.write(action="party_create", source="form", client_id=None) as tx:
        tx.state.parties.extend([locked, free])
    resp = await group_client.get("/api/state")
    assert PHONE not in resp.text and "phone_set_at" not in resp.text and "905123456" not in resp.text
    by_id = {p["id"]: p for p in resp.json()["state"]["parties"]}
    assert by_id[locked.id]["phone_hint"] == "456"
    assert "phone_hint" not in by_id[free.id]
    assert "phone" not in by_id[locked.id]


async def test_party_forms_reject_a_phone_and_keep_the_stored_one(group_client, app, make_party):
    from tests.api_helpers import party_body

    rt = app.state.runtime
    locked = make_party(id="p-lockd1", phone=PHONE, phone_set_at="2026-10-25T10:00:00+02:00")
    async with rt.store.write(action="party_create", source="form", client_id=None) as tx:
        tx.state.parties.append(locked)
    resp = await group_client.post("/api/parties", json=party_body("Nova", phone=PHONE))
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "invalid"
    resp = await group_client.put(f"/api/parties/{locked.id}", json=party_body("Zmena", phone="+421900000000"))
    assert resp.status_code == 422
    resp = await group_client.put(f"/api/parties/{locked.id}", json=party_body("Zmena"))
    assert resp.status_code == 200 and PHONE not in resp.text
    stored = rt.store.read().parties[0]
    assert stored.name == "Zmena" and stored.phone == PHONE and stored.phone_set_at == "2026-10-25T10:00:00+02:00"
    audit = rt.store.audit_path.read_text(encoding="utf-8")
    assert PHONE not in audit and "905123456" not in audit and "phone_set_at" not in audit
    assert "phone_hint: '456'" in audit
