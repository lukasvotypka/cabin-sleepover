"""Installable app and the "new version" sign (T-055): manifest, service worker, `asset_version` in the state."""

import json
import re
import shutil
import struct

from tests.api_helpers import A1, THU, mk_party
from tests.conftest import ROOT, TEST_ENV
from tests.test_api_events import Sse, group_cookie, server  # noqa: F401 (server is a fixture)

STATIC = ROOT / "static"


def page_meta(html: str) -> str:
    match = re.search(r'<meta name="asset-version" content="([^"]+)">', html)
    assert match, "no asset-version meta"
    return match.group(1)


def test_manifest_fields():
    manifest = json.loads((STATIC / "manifest.webmanifest").read_text(encoding="utf-8"))
    assert manifest["id"] == manifest["start_url"]
    assert manifest["description"]
    assert manifest["display"] == "standalone"
    icons = {i["src"]: i for i in manifest["icons"]}
    assert {"icons/icon-192.png", "icons/icon-512.png"} <= set(icons)
    maskable = icons["icons/icon-maskable-512.png"]
    assert maskable["purpose"] == "maskable" and maskable["sizes"] == "512x512"
    png = (STATIC / maskable["src"]).read_bytes()
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    assert struct.unpack(">II", png[16:24]) == (512, 512)


def test_page_head_has_ios_app_tags():
    html = (STATIC / "index.html").read_text(encoding="utf-8")
    assert '<meta name="apple-mobile-web-app-capable" content="yes">' in html
    assert '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">' in html
    assert '<meta name="apple-mobile-web-app-title" content="Chata">' in html


async def test_service_worker_route(client):
    resp = await client.get("/sw.js")  # no cookie
    assert resp.status_code == 200
    assert "javascript" in resp.headers["content-type"]
    assert resp.headers["cache-control"] == "no-cache"
    source = resp.text
    assert "install" in source and "activate" in source
    assert "skipWaiting" in source and "clients.claim" in source
    assert "'fetch'" not in source and '"fetch"' not in source and "caches" not in source


async def test_asset_version_matches_the_page(group_client, client):
    meta = page_meta((await client.get("/")).text)
    state = (await group_client.get("/api/state")).json()["state"]
    assert state["asset_version"] == meta
    assert f"?v={meta}" in (await client.get("/")).text


async def test_asset_version_in_writes_errors_and_broadcast(group_client, app):
    meta = app.state.runtime.asset_version()
    created = await group_client.post(
        "/api/parties",
        json={"name": "Ivan a Eva", "adults": 2, "kids": 0, "kids_in_parents_bed": 0, "arrive": THU, "leave": "2026-11-06"},
    )
    assert created.json()["state"]["asset_version"] == meta
    err = await group_client.post("/api/assign", json={"night": THU, "slots": ["nope"], "party_id": created.json()["party"]["id"]})
    assert err.json()["ok"] is False and err.json()["state"]["asset_version"] == meta
    conn = app.state.runtime.hub.connect("c1", None)
    gen = app.state.runtime.hub.stream(conn, {"hello": 1})
    await anext(gen)
    await group_client.post("/api/assign", json={"night": THU, "slots": [A1], "party_id": created.json()["party"]["id"]})
    frame = await anext(gen)
    assert json.loads(frame.split("data: ", 1)[1])["asset_version"] == meta
    await gen.aclose()


async def test_etag_changes_after_a_script_edit(make_app, make_client, tmp_path):
    static = tmp_path / "static"
    shutil.copytree(STATIC, static)
    app = make_app(static_dir=static)
    async with make_client(app) as c:
        await c.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})
        first = await c.get("/api/state")
        etag = first.headers["etag"]
        assert (await c.get("/api/state", headers={"If-None-Match": etag})).status_code == 304
        script = static / "js" / "logic-live.js"
        script.write_text(script.read_text(encoding="utf-8") + "\n// edited\n", encoding="utf-8")
        again = await c.get("/api/state", headers={"If-None-Match": etag})
        assert again.status_code == 200
        assert again.json()["state"]["asset_version"] != first.json()["state"]["asset_version"]
        assert again.headers["etag"] != etag


def test_initial_sse_frame_has_asset_version(server):  # noqa: F811
    _proc, base = server
    cookie = group_cookie(base)
    meta = page_meta(__import__("httpx").get(f"{base}/", timeout=5).text)
    sse = Sse(base, cookie, "?client=a")
    try:
        event, data = sse.frame()
        assert event == "state" and data["asset_version"] == meta
    finally:
        sse.close()


async def test_page_carries_the_release_version(client):
    resp = await client.get("/")
    match = re.search(r'<meta name="app-version" content="([^"]+)">', resp.text)
    assert match
    assert match.group(1) == (await client.get("/api/health")).json()["version"]
    assert "__APP_VERSION__" not in resp.text and "__ASSET_VERSION__" not in resp.text


def test_asset_version_changes_with_the_release():
    from app.main import PageRenderer

    old, new, same = PageRenderer(STATIC, "1.0.0"), PageRenderer(STATIC, "1.0.1"), PageRenderer(STATIC, "1.0.0")
    assert old.version() != new.version()
    assert old.version() == same.version()
    assert page_meta(new.render()) == new.version()
