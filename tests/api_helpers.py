"""Shared helpers for the write and admin endpoint tests."""

import yaml

THU, FRI, SAT, SUN = "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"
A1, A2 = "vlavo-manzelska-1", "vlavo-manzelska-2"
OKNO = "vlavo-okno-1"
M1, M2, M3 = "konica-dole-matrac-1", "konica-dole-matrac-2", "konica-dole-matrac-3"

PALETTE = [
    "#2F7D6D", "#D07A2B", "#6D5BA8", "#C08A1E", "#3E6FB0", "#9C4A7A",
    "#5E8A2E", "#8A6A4A", "#2E8AA0", "#C0603A", "#7A7F2B", "#A04848",
]
CLIENT = {"X-Client-Id": "test-client"}


def party_body(name="Ivan a Eva", **overrides) -> dict:
    body = {"name": name, "adults": 2, "kids": 0, "kids_in_parents_bed": 0, "arrive": THU, "leave": SUN}
    body.update(overrides)
    return body


async def mk_party(client, name="Ivan a Eva", headers=None, **overrides) -> dict:
    """Create a party through the API and return it."""
    resp = await client.post("/api/parties", json=party_body(name, **overrides), headers=headers or CLIENT)
    assert resp.status_code == 200, resp.text
    return resp.json()["party"]


def error_of(resp) -> dict:
    body = resp.json()
    assert body["ok"] is False
    assert set(body["error"]) == {"code", "message", "params"}
    assert body["error"]["message"].isascii(), "the server must not send Slovak text"
    return body["error"]


def audit_docs(app) -> list[dict]:
    path = app.state.runtime.store.audit_path
    if not path.exists():
        return []
    return [d for d in yaml.safe_load_all(path.read_text(encoding="utf-8")) if d is not None]


def backup_count(app) -> int:
    return len(list(app.state.runtime.store.backup_dir.iterdir()))


def snapshot(app) -> tuple[int, int, int]:
    """(version, number of backups, number of audit documents): equal before and after means nothing was written."""
    return app.state.runtime.store.read().version, backup_count(app), len(audit_docs(app))


def sleeping_of(app) -> dict:
    return app.state.runtime.store.read().sleeping
