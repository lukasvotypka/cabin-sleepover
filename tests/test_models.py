import pytest
import yaml
from pydantic import ValidationError

from app.models import (
    MAX_NIGHTS_PER_REQUEST,
    MAX_SLOTS_PER_REQUEST,
    AppConfig,
    AssignRequest,
    AssignStayRequest,
    ClearRequest,
    ConfigError,
    Layout,
    MoveRequest,
    Party,
    PartyCreate,
    PartyUpdate,
    SignupRequest,
    State,
    load_app_config,
    load_layout,
    parse_layout,
)
from tests.conftest import APP_YAML, CHATA_YAML

SCENE = {
    "title": [176, 10, 196, 30],
    "nights": [176, 46, 196, 58],
    "notice": [176, 112, 196, 82],
    "status": [278, 322, 94, 88],
    "locked": [16, 190, 62, 56],
    "letter": [128, 336, 44, 44],
    "key": [184, 336, 44, 44],
    "legend": [24, 264, 44, 44],
    "parties": [176, 112, 148, 82],
    "meadow": [112, 381, 124, 14],
}


# --- config/chata.yaml and config/app.yaml -------------------------------------


def test_chata_yaml_matches_proposal(layout):
    assert len(layout.rooms) == 6
    assert sum(len(r.beds) for r in layout.rooms) == 12
    assert len(layout.slot_ids) == 20
    assert layout.tight_slots == {"chodba-gauc-2", "kuchynka-pec-2"}
    assert layout.event.nights == ["2026-10-29", "2026-10-30", "2026-10-31"]
    assert layout.event.arrive_days == ["2026-10-29", "2026-10-30", "2026-10-31"]
    assert layout.event.leave_days == ["2026-10-30", "2026-10-31", "2026-11-01"]
    assert layout.map.viewbox == [380, 412]


def test_chata_yaml_dates_are_quoted_strings():
    with open(CHATA_YAML, encoding="utf-8") as fh:
        raw = yaml.safe_load(fh)
    for key in ("arrive_days", "leave_days", "nights"):
        assert all(isinstance(d, str) for d in raw["event"][key])


def test_scene_rects_match_proposal(layout):
    assert layout.map.scene.model_dump() == SCENE


def _overlap(a, b):
    return a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]


def test_meadow_is_inside_the_viewbox_and_overlaps_nothing(layout):
    meadow = layout.map.scene.meadow
    width, height = layout.map.viewbox
    assert meadow[0] >= 0 and meadow[1] >= 0
    assert meadow[0] + meadow[2] <= width and meadow[1] + meadow[3] <= height
    others = {f"room {r.id}": r.rect for r in layout.rooms}
    others.update({f"path {i}": r for i, r in enumerate(layout.map.paths)})
    others.update({f"door {i}": r for i, r in enumerate(layout.map.doors)})
    others.update({f"scene {k}": v for k, v in layout.map.scene.model_dump().items() if k != "meadow"})
    for name, rect in others.items():
        assert not _overlap(meadow, rect), f"meadow overlaps {name}"


def test_slot_order_follows_file_order(layout):
    assert layout.slot_ids[0] == "konica-hore-manzelska-1"
    assert layout.slot_ids[-1] == "kuchynka-pec-2"
    assert layout.slot_order["konica-hore-jedno-1"] == 2


def test_app_yaml_loads(app_config):
    assert isinstance(app_config, AppConfig)
    assert app_config.limits.writes_per_client_minute == 30
    assert app_config.limits.ai_per_client_minute == 10
    assert app_config.limits.ai_per_day == 200
    assert app_config.model == "claude-haiku-5-5"
    assert app_config.backups_keep == 50


def test_app_config_rejects_unknown_and_bad_values(tmp_path):
    bad = tmp_path / "app.yaml"
    bad.write_text("limits: {writes_per_client_minute: 0, ai_per_client_minute: 1, ai_per_day: 1}\n"
                   "model: x\nbackups_keep: 5\n", encoding="utf-8")
    with pytest.raises(ConfigError, match="writes_per_client_minute"):
        load_app_config(bad)


def test_layout_dump_is_json_ready(layout):
    dumped = layout.model_dump(mode="json")
    assert dumped["map"]["scene"]["key"] == [184, 336, 44, 44]
    assert dumped["rooms"][0]["beds"][0]["kind"] == "bed2"


# --- errors in chata.yaml ------------------------------------------------------


@pytest.mark.parametrize("name", sorted(SCENE))
def test_missing_scene_rect_names_it(layout_data, name):
    del layout_data["map"]["scene"][name]
    with pytest.raises(ConfigError) as exc:
        parse_layout(layout_data)
    assert f"map.scene.{name}" in str(exc.value)


def test_scene_rect_must_have_four_ints(layout_data):
    layout_data["map"]["scene"]["title"] = [1, 2, 3]
    with pytest.raises(ConfigError, match="map.scene.title"):
        parse_layout(layout_data)
    layout_data["map"]["scene"]["title"] = [1, 2, 3, "x"]
    with pytest.raises(ConfigError, match="map.scene.title"):
        parse_layout(layout_data)


def test_duplicate_slot_ids(layout_data):
    layout_data["rooms"][1]["beds"][0]["slots"][0] = "konica-hore-jedno-1"
    with pytest.raises(ConfigError, match="duplicate slot ID: .*konica-hore-jedno-1"):
        parse_layout(layout_data)


def test_duplicate_bed_ids(layout_data):
    layout_data["rooms"][1]["beds"][0]["id"] = "konica-hore-jedno"
    with pytest.raises(ConfigError, match="duplicate bed ID: konica-hore-jedno"):
        parse_layout(layout_data)


def test_duplicate_room_ids(layout_data):
    layout_data["rooms"][1]["id"] = "konica-hore"
    with pytest.raises(ConfigError, match="duplicate room ID: konica-hore"):
        parse_layout(layout_data)


def test_tight_slot_must_belong_to_bed(layout_data):
    layout_data["rooms"][3]["beds"][0]["tight"] = ["kuchynka-pec-2"]
    with pytest.raises(ConfigError, match="tight slot “kuchynka-pec-2” is not one of the slots of bed “chodba-gauc”"):
        parse_layout(layout_data)


def test_unknown_bed_kind(layout_data):
    layout_data["rooms"][0]["beds"][0]["kind"] = "hammock"
    with pytest.raises(ConfigError) as exc:
        parse_layout(layout_data)
    assert "rooms[0].beds[0].kind" in str(exc.value)
    assert "hammock" in str(exc.value)


@pytest.mark.parametrize("kind", ["bed2", "bunk", "mats", "sofa", "sofa1", "stove", "bed1", "cot"])
def test_all_documented_kinds_are_accepted(layout_data, kind):
    layout_data["rooms"][0]["beds"][0]["kind"] = kind
    assert parse_layout(layout_data).rooms[0].beds[0].kind == kind


def test_night_must_be_an_arrive_day(layout_data):
    layout_data["event"]["nights"].append("2026-11-01")
    with pytest.raises(ConfigError, match="night 2026-11-01 is not one of the arrive days"):
        parse_layout(layout_data)


def test_unquoted_date_is_rejected(layout_data):
    # PyYAML would load an unquoted date as a date object
    raw = yaml.safe_load("nights: [2026-10-29]")
    layout_data["event"]["nights"] = raw["nights"]
    with pytest.raises(ConfigError, match="event.nights"):
        parse_layout(layout_data)


def test_rect_must_be_four_ints(layout_data):
    layout_data["rooms"][0]["rect"] = [1, 2, 3, 4, 5]
    with pytest.raises(ConfigError, match="rooms\\[0\\].rect"):
        parse_layout(layout_data)


def test_unknown_layout_key_is_rejected(layout_data):
    layout_data["rooms"][0]["beds"][0]["slotz"] = []
    with pytest.raises(ConfigError, match="slotz"):
        parse_layout(layout_data)


def test_invalid_floor_color(layout_data):
    layout_data["rooms"][0]["floor"] = "red"
    with pytest.raises(ConfigError, match="rooms\\[0\\].floor"):
        parse_layout(layout_data)


def test_load_layout_reports_bad_yaml(tmp_path):
    bad = tmp_path / "chata.yaml"
    bad.write_text("event: [unclosed\n", encoding="utf-8")
    with pytest.raises(ConfigError, match="invalid YAML"):
        load_layout(bad)


def test_load_layout_missing_file(tmp_path):
    with pytest.raises(ConfigError, match="cannot read file"):
        load_layout(tmp_path / "nope.yaml")


# --- Party: input limits ---------------------------------------------------

BASE = {
    "name": "Ivan a Eva",
    "adults": 2,
    "kids": 0,
    "kids_in_parents_bed": 0,
    "arrive": "2026-10-29",
    "leave": "2026-10-31",
}


def party_input(**overrides):
    return PartyCreate(**{**BASE, **overrides})


def test_name_is_trimmed():
    assert party_input(name="  Ivan a Eva \n").name == "Ivan a Eva"


def test_name_limits():
    assert party_input(name="x" * 60).name == "x" * 60
    with pytest.raises(ValidationError):
        party_input(name="x" * 61)
    with pytest.raises(ValidationError):
        party_input(name="")
    with pytest.raises(ValidationError):
        party_input(name="    ")


def test_name_length_counts_after_trim():
    assert len(party_input(name="  " + "x" * 60 + "  ").name) == 60


def test_arrival_time_limit():
    assert party_input(arrival_time="x" * 60).arrival_time == "x" * 60
    with pytest.raises(ValidationError):
        party_input(arrival_time="x" * 61)


def test_note_limit():
    assert party_input(note="x" * 300).note == "x" * 300
    with pytest.raises(ValidationError):
        party_input(note="x" * 301)


def test_optional_text_defaults_to_empty():
    p = party_input()
    assert p.arrival_time == "" and p.note == ""


@pytest.mark.parametrize("field", ["adults", "kids", "kids_in_parents_bed"])
def test_count_bounds(field):
    kids = {"kids": 20}  # so that kids_in_parents_bed can reach the upper bound
    assert party_input(**{**kids, field: 0}).model_dump()[field] == 0
    assert party_input(**{**kids, field: 20}).model_dump()[field] == 20
    with pytest.raises(ValidationError):
        party_input(**{**kids, field: 21})
    with pytest.raises(ValidationError):
        party_input(**{**kids, field: -1})


@pytest.mark.parametrize("bad", ["2", 2.5, True, None])
def test_counts_must_be_integers(bad):
    with pytest.raises(ValidationError):
        party_input(adults=bad)


def test_kids_in_parents_bed_not_more_than_kids():
    assert party_input(kids=2, kids_in_parents_bed=2).kids_in_parents_bed == 2
    with pytest.raises(ValidationError, match="kids sleeping in the parents' bed") as err:
        party_input(kids=1, kids_in_parents_bed=2)
    assert err.value.errors()[0]["loc"] == ("kids_in_parents_bed",)  # the error names the field
    assert err.value.errors()[0]["msg"].isascii()
    with pytest.raises(ValidationError):
        party_input(kids=0, kids_in_parents_bed=1)
    with pytest.raises(ValidationError) as err:  # an invalid `kids` is reported alone, with no comparison
        party_input(kids=-1, kids_in_parents_bed=1)
    assert [e["loc"] for e in err.value.errors()] == [("kids",)]


def test_unknown_party_fields_rejected():
    with pytest.raises(ValidationError):
        party_input(color="#000000")
    with pytest.raises(ValidationError):
        PartyUpdate(**BASE, extra_field=1)


def test_arrive_must_be_quoted_iso_date():
    import datetime

    with pytest.raises(ValidationError):
        party_input(arrive=datetime.date(2026, 10, 29))
    with pytest.raises(ValidationError):
        party_input(arrive="29. 10. 2026")


FULL = {
    **BASE,
    "id": "p-7f3k2a",
    "arrival_time": "okolo 18:00",
    "note": "",
    "color": "#D07A2B",
    "created_at": "2026-10-22T20:14:05+02:00",
    "updated_at": "2026-10-25T19:02:11+02:00",
}


def test_full_party_is_valid():
    assert Party(**FULL).id == "p-7f3k2a"


@pytest.mark.parametrize("color", ["#D07A2B", "#d07a2b"])
def test_color_accepts_rrggbb(color):
    assert Party(**{**FULL, "color": color}).color == color


@pytest.mark.parametrize("color", ["D07A2B", "#D07A2", "#D07A2B0", "#GGGGGG", "red", "#D07A2B\n"])
def test_color_rejects_other_formats(color):
    with pytest.raises(ValidationError):
        Party(**{**FULL, "color": color})


@pytest.mark.parametrize("pid", ["p-7f3k2a", "p-ABCdef", "p-000001"])
def test_party_id_accepts_p_plus_six(pid):
    assert Party(**{**FULL, "id": pid}).id == pid


@pytest.mark.parametrize("pid", ["7f3k2a", "p-7f3k2", "p-7f3k2ab", "q-7f3k2a", "p-7f3k2!", "p-7f3k2a\n", ""])
def test_party_id_rejects_other_shapes(pid):
    with pytest.raises(ValidationError):
        Party(**{**FULL, "id": pid})


# --- State -------------------------------------------------------------------

STATE_YAML = """
version: 27
updated_at: "2026-10-25T19:02:11+02:00"
signup_open: true
parties:
  - id: p-7f3k2a
    name: Ivan a Eva
    adults: 2
    kids: 0
    kids_in_parents_bed: 0
    arrive: "2026-10-29"
    leave: "2026-10-31"
    arrival_time: okolo 18:00
    note: ""
    color: "#D07A2B"
    created_at: "2026-10-22T20:14:05+02:00"
    updated_at: "2026-10-25T19:02:11+02:00"
sleeping:
  "2026-10-29":
    vlavo-manzelska-1: p-7f3k2a
    vlavo-manzelska-2: p-7f3k2a
"""


def test_state_from_proposal_example():
    state = State.model_validate(yaml.safe_load(STATE_YAML))
    assert state.version == 27 and state.signup_open is True
    assert state.parties[0].name == "Ivan a Eva"
    assert state.sleeping["2026-10-29"]["vlavo-manzelska-1"] == "p-7f3k2a"


def test_state_defaults_for_empty_file():
    state = State(version=0, updated_at="2026-10-21T10:00:00+02:00")
    assert state.parties == [] and state.sleeping == {} and state.signup_open is True


def test_state_rejects_unquoted_timestamp():
    data = yaml.safe_load(STATE_YAML.replace('"2026-10-25T19:02:11+02:00"', "2026-10-25T19:02:11+02:00", 1))
    with pytest.raises(ValidationError):
        State.model_validate(data)


def test_state_rejects_unquoted_night_key():
    data = yaml.safe_load(STATE_YAML.replace('"2026-10-29":', "2026-10-29:"))
    with pytest.raises(ValidationError):
        State.model_validate(data)


def test_state_rejects_unknown_key_and_bad_party_ref():
    data = yaml.safe_load(STATE_YAML)
    data["sleeping"]["2026-10-29"]["vlavo-okno-1"] = "not-a-party"
    with pytest.raises(ValidationError):
        State.model_validate(data)
    data = yaml.safe_load(STATE_YAML)
    data["extra"] = 1
    with pytest.raises(ValidationError):
        State.model_validate(data)


# --- action requests --------------------------------------------------------


def test_assign_request_valid():
    r = AssignRequest(night="2026-10-30", slots=["a", "b"], party_id="p-7f3k2a")
    assert r.slots == ["a", "b"]


def test_assign_requires_at_least_one_slot():
    with pytest.raises(ValidationError):
        AssignRequest(night="2026-10-30", slots=[], party_id="p-7f3k2a")
    with pytest.raises(ValidationError):
        AssignStayRequest(slots=[], party_id="p-7f3k2a")


def test_assign_rejects_duplicate_slots():
    with pytest.raises(ValidationError, match="more than once"):
        AssignRequest(night="2026-10-30", slots=["a", "a"], party_id="p-7f3k2a")
    with pytest.raises(ValidationError, match="more than once"):
        AssignStayRequest(slots=["a", "b", "a"], party_id="p-7f3k2a")


def test_assign_rejects_single_slot_field_and_extras():
    with pytest.raises(ValidationError):
        AssignRequest(night="2026-10-30", slot="a", party_id="p-7f3k2a")
    with pytest.raises(ValidationError):
        AssignStayRequest(slots=["a"], party_id="p-7f3k2a", night="2026-10-30")


def test_clear_and_move_requests():
    assert ClearRequest(night="2026-10-30", slot="a").slot == "a"
    m = MoveRequest(party_id="p-7f3k2a", from_slot="a", to_slot="b", nights=["2026-10-30"])
    assert m.nights == ["2026-10-30"]
    with pytest.raises(ValidationError):
        MoveRequest(party_id="p-7f3k2a", from_slot="a", to_slot="b", nights=[])


def test_signup_request_needs_real_bool():
    assert SignupRequest(open=False).open is False
    with pytest.raises(ValidationError):
        SignupRequest(open="no")
    with pytest.raises(ValidationError):
        SignupRequest()


def test_unknown_party_id_shape_is_not_rejected_by_request_models():
    # a nonexistent party is `unknown_party` (404) from validate.py, not a 422 from the model
    assert AssignRequest(night="2026-10-30", slots=["a"], party_id="xyz").party_id == "xyz"


def test_layout_class_is_exported(layout):
    assert isinstance(layout, Layout)


# --- list size limits and text hygiene ---------------------------------------


def test_slots_list_has_an_upper_bound():
    ok = [f"s{i}" for i in range(MAX_SLOTS_PER_REQUEST)]
    assert len(AssignRequest(night="2026-10-30", slots=ok, party_id="p-7f3k2a").slots) == MAX_SLOTS_PER_REQUEST
    too_long = ok + ["one-more"]
    with pytest.raises(ValidationError):
        AssignRequest(night="2026-10-30", slots=too_long, party_id="p-7f3k2a")
    with pytest.raises(ValidationError):
        AssignStayRequest(slots=too_long, party_id="p-7f3k2a")


def test_nights_list_has_an_upper_bound():
    ok = [f"2026-10-{20 + i}" for i in range(MAX_NIGHTS_PER_REQUEST)]
    assert len(MoveRequest(party_id="p-7f3k2a", from_slot="a", to_slot="b", nights=ok).nights) == MAX_NIGHTS_PER_REQUEST
    with pytest.raises(ValidationError):
        MoveRequest(party_id="p-7f3k2a", from_slot="a", to_slot="b", nights=ok + ["2026-11-30"])


def test_huge_lists_are_rejected_fast():
    import time

    huge = [f"slot-{i}" for i in range(300_000)]
    start = time.perf_counter()
    with pytest.raises(ValidationError):
        AssignRequest(night="2026-10-30", slots=huge, party_id="p-7f3k2a")
    with pytest.raises(ValidationError):
        MoveRequest(party_id="p-7f3k2a", from_slot="a", to_slot="b", nights=huge)
    assert time.perf_counter() - start < 2.0


def test_duplicate_detection_is_linear():
    import time

    # 32 distinct + the same repeated: many duplicates must not cost quadratic time
    from app.models import _duplicates

    items = [str(i % 50) for i in range(200_000)]
    start = time.perf_counter()
    assert len(_duplicates(items)) == 50
    assert time.perf_counter() - start < 1.0


def test_move_rejects_duplicate_nights():
    with pytest.raises(ValidationError, match="more than once"):
        MoveRequest(party_id="p-7f3k2a", from_slot="a", to_slot="b", nights=["2026-10-30", "2026-10-30"])


@pytest.mark.parametrize("field", ["name", "arrival_time"])
@pytest.mark.parametrize("bad", ["a\nb", "a\rb", "a\tb", "a\x00b", "a\x7fb", "a\u2028b", "a\u2029b", "a\x85b"])
def test_single_line_fields_reject_control_characters(field, bad):
    with pytest.raises(ValidationError, match="control characters"):
        party_input(**{field: bad})


def test_trailing_newline_is_trimmed_not_rejected():
    assert party_input(name="Ivan\n").name == "Ivan"


def test_note_allows_line_breaks_but_not_other_control_characters():
    assert party_input(note="line one\nline two\tindented\r\nthree").note.startswith("line one")
    with pytest.raises(ValidationError, match="control characters"):
        party_input(note="a\x00b")
    with pytest.raises(ValidationError, match="control characters"):
        party_input(note="a\x1bb")


def test_text_is_normalised_to_nfc():
    decomposed = "Mari\u0301a"
    assert party_input(name=decomposed).name == "Mar\u00eda"
    assert party_input(arrival_time=decomposed).arrival_time == "Mar\u00eda"
    assert party_input(note=decomposed).note == "Mar\u00eda"
