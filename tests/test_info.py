import shutil
from pathlib import Path

import pytest
import yaml

from app.main import create_app
from app.models import INFO_ICONS, ConfigError, load_info, load_layout
from tests.conftest import ROOT, TEST_ENV

SAMPLE = ROOT / "config" / "info.yaml"


def _config(tmp_path: Path, info: dict | None) -> Path:
    cfg = tmp_path / "config"
    shutil.copytree(ROOT / "config", cfg)
    (cfg / "info.yaml").unlink()
    if info is not None:
        (cfg / "info.yaml").write_text(yaml.safe_dump(info, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return cfg


def _sample() -> dict:
    return yaml.safe_load(SAMPLE.read_text(encoding="utf-8"))


def _app(tmp_path: Path, info: dict | None):
    return create_app(config_dir=_config(tmp_path, info), data_dir=tmp_path / "data", env=TEST_ENV)


def test_icon_set_has_22_names():
    assert len(INFO_ICONS) == 22


def test_sample_file_loads():
    info = load_info(SAMPLE, load_layout(ROOT / "config" / "cabin.yaml").event)
    assert info.water.drinkable is False
    assert len(info.pack) == 12 and len(info.sleep) == 2 and info.menu is None and len(info.program) == 7


def test_missing_file_means_feature_off(tmp_path):
    assert _app(tmp_path, None).state.runtime.info_json is None


def _break_icon(d):
    d["pack"][3]["icon"] = "dragon"


def _empty_list(d):
    d["program"] = []


MENU = [
    {"day": "2026-10-29", "meals": [{"when": "večer", "what": "guláš"}]},
    {"day": "2026-10-30", "meals": [{"when": "ráno", "what": "raňajky"}]},
]


def _day_outside(d):
    d["menu"] = [dict(m) for m in MENU]
    d["menu"][0]["day"] = "2026-11-05"


def _day_repeated(d):
    d["menu"] = [dict(m) for m in MENU]
    d["menu"][1]["day"] = d["menu"][0]["day"]


def _unknown_key(d):
    d["water"]["color"] = "blue"


@pytest.mark.parametrize(
    ("mutate", "needle"),
    [
        (_break_icon, "pack[3].icon"),
        (_empty_list, "program"),
        (_day_outside, "menu[0].day"),
        (_day_repeated, "menu[1].day"),
        (_unknown_key, "water.color"),
    ],
)
def test_broken_file_refuses_startup(tmp_path, mutate, needle):
    data = _sample()
    mutate(data)
    with pytest.raises(ConfigError) as exc:
        _app(tmp_path, data)
    assert "info.yaml" in str(exc.value) and needle in str(exc.value)


def test_bad_icon_message_names_the_value(tmp_path):
    data = _sample()
    _break_icon(data)
    with pytest.raises(ConfigError, match="dragon"):
        _app(tmp_path, data)


async def test_state_carries_info_and_etag_follows_it(tmp_path, make_client):
    other = _sample()
    other["bring"] = "nič"
    tags, infos = [], []
    for i, data in enumerate((_sample(), other)):
        app = create_app(config_dir=_config(tmp_path / str(i), data), data_dir=tmp_path / str(i) / "data", env=TEST_ENV)
        async with make_client(app) as client:
            r = await client.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})
            assert r.status_code == 200
            r = await client.get("/api/state")
        tags.append(r.headers["etag"])
        infos.append(r.json()["state"]["info"])
    assert infos[0]["water"]["liters_per_day"] == 2 and infos[1]["bring"] == "nič"
    assert tags[0] != tags[1]


NEW_FIELDS = {
    "pack_intro": "Úvod",
    "sleep_intro": "Spanie",
    "food_intro": "Jedlo",
    "food_note": "Obchod",
    "host_arrival": "O 16:00",
    "food_plan": ["gril"],
    "facilities": {"have": ["gril"], "missing": ["WC"]},
}


def _load(tmp_path, data):
    path = tmp_path / "info.yaml"
    path.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return load_info(path, load_layout(ROOT / "config" / "cabin.yaml").event)


def test_shipped_file_has_organizer_content():
    info = load_info(SAMPLE, load_layout(ROOT / "config" / "cabin.yaml").event)
    assert info.menu is None and info.bring is None
    assert info.food_plan and info.facilities.have and info.facilities.missing
    assert info.host_arrival and info.pack_intro and info.sleep_intro and info.food_intro and info.food_note
    assert info.pack[0].note


def test_old_required_fields_only_load(tmp_path):
    data = {k: _sample()[k] for k in ("water", "pack", "sleep", "program")}
    info = _load(tmp_path, data)
    assert info.menu is None and info.facilities is None and info.food_plan is None and info.host_arrival is None


@pytest.mark.parametrize("field", sorted(NEW_FIELDS))
def test_each_new_field_present_and_absent(tmp_path, field):
    base = {k: _sample()[k] for k in ("water", "pack", "sleep", "program")}
    assert getattr(_load(tmp_path, base), field) is None
    info = _load(tmp_path, {**base, field: NEW_FIELDS[field]})
    assert getattr(info, field) is not None


def test_facilities_with_only_have(tmp_path):
    base = {k: _sample()[k] for k in ("water", "pack", "sleep", "program")}
    info = _load(tmp_path, {**base, "facilities": {"have": ["gril"]}})
    assert info.facilities.have == ["gril"] and info.facilities.missing is None


def test_pack_item_note(tmp_path):
    base = {k: _sample()[k] for k in ("water", "pack", "sleep", "program")}
    base["pack"] = [{"icon": "spacak", "label": "Spacák", "note": "Požičiame."}]
    assert _load(tmp_path, base).pack[0].note == "Požičiame."


def test_menu_still_checked_when_present(tmp_path):
    base = {k: _sample()[k] for k in ("water", "pack", "sleep", "program")}
    assert _load(tmp_path, {**base, "menu": MENU}).menu[0].day == "2026-10-29"


@pytest.mark.parametrize(
    ("patch", "needle"),
    [
        ({"food_note": "  "}, "food_note"),
        ({"host_arrival": ""}, "host_arrival"),
        ({"food_plan": ["gril", ""]}, "food_plan[1]"),
        ({"facilities": {"have": [""]}}, "facilities.have[0]"),
        ({"facilities": {"have": ["a"], "extra": []}}, "facilities.extra"),
        ({"unknown_key": "x"}, "unknown_key"),
    ],
)
def test_rejected_new_field_values(tmp_path, patch, needle):
    base = {k: _sample()[k] for k in ("water", "pack", "sleep", "program")}
    with pytest.raises(ConfigError) as exc:
        _load(tmp_path, {**base, **patch})
    assert needle in str(exc.value)
