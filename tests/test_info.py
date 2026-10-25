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
    assert len(info.pack) == 12 and len(info.sleep) == 3 and len(info.menu) == 4 and len(info.program) == 7


def test_missing_file_means_feature_off(tmp_path):
    assert _app(tmp_path, None).state.runtime.info_json is None


def _break_icon(d):
    d["pack"][3]["icon"] = "dragon"


def _empty_list(d):
    d["program"] = []


def _day_outside(d):
    d["menu"][0]["day"] = "2026-11-05"


def _day_repeated(d):
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
