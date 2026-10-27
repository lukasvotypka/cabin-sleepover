"""scripts/shift_event.py: moves the stored parties to the new dates in cabin.yaml and frees all beds."""

import importlib.util
from pathlib import Path

import yaml

from app.models import State
from app.store import Store
from tests.conftest import FRI, SUN, THU

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("shift_event", ROOT / "scripts" / "shift_event.py")
shift_event = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(shift_event)


def _party(pid, name, **stay):
    return {
        "name": name, "adults": 2, "kids": 0, "kids_in_parents_bed": 0, "arrive": None, "leave": None,
        "day_visits": [], "arrival_time": "", "note": "", "id": pid, "color": "#2F7D6D", "places": {},
        "phone": "+421900123456", "phone_set_at": "2026-10-24T10:00:00+02:00",
        "created_at": "2026-10-24T10:00:00+02:00", "updated_at": "2026-10-24T10:00:00+02:00", **stay,
    }


def _old_data():
    """A data file of the old event (one week earlier than the cabin.yaml in the repo)."""
    return {
        "version": 41, "updated_at": "2026-10-26T10:00:00+01:00", "signup_open": True, "phone_verify": True,
        "parties": [
            _party("p-aaaaaa", "Ivan", arrive="2026-10-29", leave="2026-11-01", places={"2026-10-30": 1}),
            _party("p-bbbbbb", "Eva", day_visits=["2026-10-30", "2026-11-01"]),
        ],
        "sleeping": {"2026-10-29": {"left-double-1": "p-aaaaaa"}, "2026-10-31": {"left-double-2": "p-aaaaaa"}},
        "briefing": {"p-aaaaaa": ["pack"]},
    }


def _run(monkeypatch, data_dir, *extra):
    argv = ["shift_event.py", "--days", "7", "--data-dir", str(data_dir), "--cabin", str(ROOT / "config/cabin.yaml"), *extra]
    monkeypatch.setattr("sys.argv", argv)
    return shift_event.main()


def test_moves_party_dates_frees_beds_and_keeps_the_rest(tmp_path, monkeypatch, layout):
    path = tmp_path / "cabin-data.yaml"
    path.write_text(yaml.safe_dump(_old_data(), allow_unicode=True, sort_keys=False), encoding="utf-8")

    assert _run(monkeypatch, tmp_path) == 0

    state = State.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
    ivan, eva = state.parties
    assert (ivan.arrive, ivan.leave, ivan.places) == (THU, SUN, {FRI: 1})
    assert eva.day_visits == [FRI, SUN]
    assert ivan.phone == "+421900123456" and ivan.name == "Ivan"
    assert state.sleeping == {}
    assert state.briefing == {"p-aaaaaa": ["pack"]}
    assert state.version == 42
    Store(layout, data_dir=tmp_path)  # the server starts on the result
    backups = list((tmp_path / "backups").glob("*-before-shift.yaml"))
    assert len(backups) == 1 and yaml.safe_load(backups[0].read_text(encoding="utf-8"))["version"] == 41
    audit = list(yaml.safe_load_all((tmp_path / "audit.yaml").read_text(encoding="utf-8")))
    assert audit[-1]["action"] == "shift_event" and audit[-1]["freed_beds"] == 2


def test_dry_run_writes_nothing(tmp_path, monkeypatch):
    path = tmp_path / "cabin-data.yaml"
    path.write_text(yaml.safe_dump(_old_data(), allow_unicode=True, sort_keys=False), encoding="utf-8")
    before = path.read_bytes()

    assert _run(monkeypatch, tmp_path, "--dry-run") == 0

    assert path.read_bytes() == before
    assert not (tmp_path / "backups").exists() and not (tmp_path / "audit.yaml").exists()


def test_refuses_dates_that_do_not_fit_the_new_event(tmp_path, monkeypatch, capsys):
    path = tmp_path / "cabin-data.yaml"
    path.write_text(yaml.safe_dump(_old_data(), allow_unicode=True, sort_keys=False), encoding="utf-8")
    before = path.read_bytes()

    monkeypatch.setattr("sys.argv", ["shift_event.py", "--days", "3", "--data-dir", str(tmp_path)])
    assert shift_event.main() == 1

    assert "does not match cabin.yaml" in capsys.readouterr().err
    assert path.read_bytes() == before
