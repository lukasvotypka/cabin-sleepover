"""tests/js/cabin-layout.json (used by the Node iso tests) must equal config/cabin.yaml."""

import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent


def test_node_layout_fixture_matches_cabin_yaml():
    fixture = json.loads((ROOT / "tests/js/cabin-layout.json").read_text(encoding="utf8"))
    config = yaml.safe_load((ROOT / "config/cabin.yaml").read_text(encoding="utf8"))
    assert fixture == config, "regenerate tests/js/cabin-layout.json from config/cabin.yaml"
