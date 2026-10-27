import pytest

from app import validate as v
from app.models import PartyCreate, PartyUpdate, State
from app.validate import RuleError
from tests.conftest import FRI, SAT, SUN, THU

A1, A2 = "left-double-1", "left-double-2"
OKNO = "left-window-1"
MAT1, MAT2 = "konica-lower-mat-1", "konica-lower-mat-2"


@pytest.fixture
def riso(make_party):
    return make_party(name="Riso a Ben", id="p-riso01")


@pytest.fixture
def ivan(make_party):
    return make_party(name="Ivan a Eva", id="p-ivan01", adults=2)


def err(fn, *args, **kwargs) -> RuleError:
    with pytest.raises(RuleError) as exc:
        fn(*args, **kwargs)
    return exc.value


# --- RuleError and helpers ---------------------------------------------


@pytest.mark.parametrize(
    "code,status",
    [("bad_code", 401), ("forbidden", 403), ("signup_closed", 403), ("slot_taken", 409), ("not_present", 409),
     ("duplicate_name", 409), ("unknown_slot", 404), ("unknown_party", 404), ("invalid", 422),
     ("rate_limited", 429)],
)
def test_rule_error_carries_status(code, status):
    e = RuleError(code, "message")
    assert (e.code, e.status, e.message, e.params) == (code, status, "message", {})


def test_rule_error_carries_params():
    assert RuleError("invalid", "m", {"field": "night"}).params == {"field": "night"}


def _rule_error_call_strings():
    """Every string literal passed to RuleError(...) or _invalid(...) in app/validate.py, with the call name."""
    import ast
    import inspect

    found = []
    for node in ast.walk(ast.parse(inspect.getsource(v))):
        if isinstance(node, ast.Call) and getattr(node.func, "id", None) in ("RuleError", "_invalid"):
            args = list(node.args) + [kw.value for kw in node.keywords]
            keys = [kw.arg for kw in node.keywords]
            for arg in args:
                for sub in ast.walk(arg):
                    if isinstance(sub, ast.Constant) and isinstance(sub.value, str):
                        found.append((node.func.id, sub.value))
            found.extend((node.func.id, k) for k in keys if k)
    return found


def test_rule_error_texts_are_english_ascii_for_every_call():
    """The server sends no Slovak text: every literal given to RuleError/_invalid is plain ASCII."""
    found = _rule_error_call_strings()
    assert len(found) > 30
    assert [text for _, text in found if not text.isascii()] == []


def test_every_error_code_used_in_validate_is_known():
    codes = {text for name, text in _rule_error_call_strings() if name == "RuleError" and text in v.ERROR_STATUS}
    assert {"slot_taken", "not_present", "duplicate_name", "unknown_slot", "unknown_party", "invalid",
            "signup_closed"} <= codes


def test_runtime_messages_are_ascii_for_all_rule_errors(layout, make_state, ivan, riso):
    state = make_state([ivan, riso], {SAT: {A1: riso.id}, FRI: {A1: ivan.id}})
    calls = [
        lambda: v.check_signup_open(make_state(signup_open=False), False),
        lambda: v.check_assign(state, layout, SAT, [A1], ivan.id),
        lambda: v.check_assign(state, layout, SAT, ["x"], ivan.id),
        lambda: v.check_assign(state, layout, SAT, [A1], "p-zzzzzz"),
        lambda: v.check_assign(state, layout, SUN, [A1], ivan.id),
        lambda: v.check_move(state, layout, ivan.id, A1, OKNO, [SAT]),
        lambda: v.check_move(state, layout, ivan.id, A1, OKNO, [FRI, FRI]),
        lambda: v.check_party_name(state, "ivan a eva"),
        lambda: v.check_stay(layout, SAT, FRI),
    ]
    for call in calls:
        e = err(call)
        assert e.message.isascii()
        assert all(str(k).isascii() for k in e.params)


# --- presence and needed slots --------------------------------------------


def test_presence_is_arrive_inclusive_leave_exclusive(make_party):
    p = make_party(arrive=FRI, leave=SUN)
    assert [v.is_present(p, n) for n in (THU, FRI, SAT, SUN)] == [False, True, True, False]


def test_party_nights(layout, make_party):
    assert v.party_nights(make_party(arrive=FRI, leave=SUN), layout) == [FRI, SAT]
    assert v.party_nights(make_party(arrive=THU, leave=FRI), layout) == [THU]


@pytest.mark.parametrize(
    "adults,kids,kib,expected", [(2, 0, 0, 2), (2, 2, 0, 4), (2, 2, 1, 3), (1, 3, 3, 1), (0, 1, 1, 0)]
)
def test_needed_slots(make_party, adults, kids, kib, expected):
    assert v.needed_slots(make_party(adults=adults, kids=kids, kids_in_parents_bed=kib)) == expected


# --- locked signup ----------------------------------------------------------


def test_signup_closed_blocks_without_admin(make_state):
    e = err(v.check_signup_open, make_state(signup_open=False), is_admin=False)
    assert (e.code, e.status) == ("signup_closed", 403)


def test_signup_closed_passes_with_admin(make_state):
    v.check_signup_open(make_state(signup_open=False), is_admin=True)


def test_signup_open_passes_for_everyone(make_state):
    v.check_signup_open(make_state(signup_open=True), is_admin=False)


# --- assign ------------------------------------------------------------------


def test_assign_free_slots_returns_all(layout, make_state, ivan):
    state = make_state([ivan])
    assert v.check_assign(state, layout, FRI, [A1, A2], ivan.id) == [A1, A2]


def test_assign_extra_slots_are_not_refused(layout, make_state, make_party):
    solo = make_party(adults=1)
    state = make_state([solo])
    assert v.check_assign(state, layout, FRI, [A1, A2, OKNO], solo.id) == [A1, A2, OKNO]


def test_assign_unknown_slot(layout, make_state, ivan):
    e = err(v.check_assign, make_state([ivan]), layout, FRI, [A1, "no-such-slot"], ivan.id)
    assert (e.code, e.status) == ("unknown_slot", 404)
    assert e.params == {"slot": "no-such-slot"}


def test_assign_unknown_party(layout, make_state, ivan):
    e = err(v.check_assign, make_state([ivan]), layout, FRI, [A1], "p-zzzzzz")
    assert (e.code, e.status) == ("unknown_party", 404)
    assert e.params == {"party_id": "p-zzzzzz"}


def test_assign_night_outside_event(layout, make_state, ivan):
    e = err(v.check_assign, make_state([ivan]), layout, SUN, [A1], ivan.id)
    assert (e.code, e.status) == ("invalid", 422)
    assert e.params == {"reason": "night_outside_event", "field": "night", "night": SUN}
    assert err(v.check_assign, make_state([ivan]), layout, "not-a-date", [A1], ivan.id).code == "invalid"


def test_assign_empty_or_duplicate_slots_invalid(layout, make_state, ivan):
    state = make_state([ivan])
    e = err(v.check_assign, state, layout, FRI, [], ivan.id)
    assert (e.code, e.params) == ("invalid", {"reason": "empty_list", "field": "slots"})
    e = err(v.check_assign, state, layout, FRI, [A1, A1], ivan.id)
    assert (e.code, e.params["reason"]) == ("invalid", "duplicate_slot")


def test_assign_not_present(layout, make_state, make_party):
    late = make_party(arrive=FRI, leave=SUN)
    state = make_state([late])
    e = err(v.check_assign, state, layout, THU, [A1], late.id)
    assert (e.code, e.status) == ("not_present", 409)
    assert e.params == {"night": THU, "party_id": late.id, "party_name": late.name}
    # on the night of departure the party is no longer present
    assert err(v.check_assign, state, layout, SUN, [A1], late.id).code == "invalid"
    leaves_sat = make_party(arrive=THU, leave=SAT)
    assert err(v.check_assign, make_state([leaves_sat]), layout, SAT, [A1], leaves_sat.id).code == "not_present"
    assert v.check_assign(state, layout, FRI, [A1], late.id) == [A1]


def test_assign_slot_taken_names_party_and_day(layout, make_state, ivan, riso):
    state = make_state([ivan, riso], {SAT: {A1: riso.id}})
    e = err(v.check_assign, state, layout, SAT, [A1], ivan.id)
    assert (e.code, e.status) == ("slot_taken", 409)
    assert e.params == {"night": SAT, "slot": A1, "party_id": riso.id, "party_name": "Riso a Ben", "own": False}


def test_assign_only_same_night_conflicts(layout, make_state, ivan, riso):
    state = make_state([ivan, riso], {SAT: {A1: riso.id}})
    assert v.check_assign(state, layout, FRI, [A1], ivan.id) == [A1]


def test_assign_multi_slot_one_taken_rejects_whole_request(layout, make_state, ivan, riso):
    state = make_state([ivan, riso], {SAT: {A2: riso.id}})
    e = err(v.check_assign, state, layout, SAT, [A1, A2], ivan.id)
    assert e.code == "slot_taken"
    assert e.params["slot"] == A2 and e.params["party_name"] == "Riso a Ben"


def test_assign_own_slot_is_taken(layout, make_state, ivan):
    state = make_state([ivan], {SAT: {A1: ivan.id}})
    e = err(v.check_assign, state, layout, SAT, [A1], ivan.id)
    assert e.code == "slot_taken" and e.params["own"] is True


def test_assign_does_not_mutate_state(layout, make_state, ivan):
    state = make_state([ivan])
    v.check_assign(state, layout, FRI, [A1, A2], ivan.id)
    assert state.sleeping == {}


# --- assign-stay -------------------------------------------------------------


def test_stay_all_nights_free(layout, make_state, make_party):
    p = make_party(arrive=THU, leave=SUN)
    plan = v.check_assign_stay(make_state([p]), layout, [A1, A2], p.id)
    assert plan.nights == [THU, FRI, SAT] and plan.skipped == [] and plan.slots == [A1, A2]


def test_stay_uses_only_party_nights(layout, make_state, make_party):
    p = make_party(arrive=FRI, leave=SAT)
    plan = v.check_assign_stay(make_state([p]), layout, [A1], p.id)
    assert plan.nights == [FRI] and plan.skipped == []


def test_stay_skips_whole_night_when_one_of_two_slots_taken(layout, make_state, ivan, riso):
    state = make_state([ivan, riso], {FRI: {A2: riso.id}})
    plan = v.check_assign_stay(state, layout, [A1, A2], ivan.id)
    assert plan.nights == [THU, SAT]
    assert plan.skipped == [FRI]


def test_stay_every_night_skipped_is_slot_taken(layout, make_state, ivan, riso):
    sleeping = {n: {A1: riso.id} for n in (THU, FRI, SAT)}
    e = err(v.check_assign_stay, make_state([ivan, riso], sleeping), layout, [A1, A2], ivan.id)
    assert (e.code, e.status) == ("slot_taken", 409)
    assert e.params["party_name"] == "Riso a Ben"
    assert e.params["skipped"] == [THU, FRI, SAT]


def test_stay_every_night_skipped_with_different_slots_taken(layout, make_state, ivan, riso):
    sleeping = {THU: {A1: riso.id}, FRI: {A2: riso.id}, SAT: {A1: riso.id}}
    assert err(v.check_assign_stay, make_state([ivan, riso], sleeping), layout, [A1, A2], ivan.id).code == "slot_taken"


def test_stay_unknown_slot_and_party_and_invalid_lists(layout, make_state, ivan):
    state = make_state([ivan])
    assert err(v.check_assign_stay, state, layout, [A1, "x"], ivan.id).code == "unknown_slot"
    assert err(v.check_assign_stay, state, layout, [A1], "p-zzzzzz").code == "unknown_party"
    assert err(v.check_assign_stay, state, layout, [], ivan.id).code == "invalid"
    assert err(v.check_assign_stay, state, layout, [A1, A1], ivan.id).code == "invalid"


# --- clear -------------------------------------------------------------------


def test_clear_returns_holder(layout, make_state, ivan):
    state = make_state([ivan], {FRI: {A1: ivan.id}})
    assert v.check_clear(state, layout, FRI, A1) == ivan.id


def test_clear_free_slot_is_noop_marker(layout, make_state, ivan):
    assert v.check_clear(make_state([ivan]), layout, FRI, A1) is None


def test_clear_unknown_slot_or_night(layout, make_state):
    state = make_state()
    e = err(v.check_clear, state, layout, FRI, "no-such-slot")
    assert (e.code, e.status) == ("unknown_slot", 404)
    e = err(v.check_clear, state, layout, SUN, A1)
    assert (e.code, e.status) == ("invalid", 422)


# --- move --------------------------------------------------------------------


def test_move_single_night(layout, make_state, ivan):
    state = make_state([ivan], {FRI: {A1: ivan.id}})
    assert v.check_move(state, layout, ivan.id, A1, OKNO, [FRI]) == [FRI]


def test_move_all_nights(layout, make_state, ivan):
    state = make_state([ivan], {n: {A1: ivan.id} for n in (THU, FRI, SAT)})
    assert v.check_move(state, layout, ivan.id, A1, OKNO, [THU, FRI, SAT]) == [THU, FRI, SAT]


def test_move_target_taken_in_one_of_several_nights_rejects_all(layout, make_state, ivan, riso):
    sleeping = {THU: {A1: ivan.id}, FRI: {A1: ivan.id}, SAT: {A1: ivan.id, OKNO: riso.id}}
    state = make_state([ivan, riso], sleeping)
    e = err(v.check_move, state, layout, ivan.id, A1, OKNO, [THU, FRI, SAT])
    assert (e.code, e.status) == ("slot_taken", 409)
    assert e.params == {"night": SAT, "slot": OKNO, "party_id": riso.id, "party_name": "Riso a Ben", "own": False}
    # without the conflicting night the move would pass
    assert v.check_move(state, layout, ivan.id, A1, OKNO, [THU, FRI]) == [THU, FRI]


def test_move_party_must_hold_from_slot_in_every_night(layout, make_state, ivan):
    state = make_state([ivan], {THU: {A1: ivan.id}, FRI: {A1: ivan.id}})
    e = err(v.check_move, state, layout, ivan.id, A1, OKNO, [THU, FRI, SAT])
    assert (e.code, e.status) == ("invalid", 422)
    assert e.params["reason"] == "not_holding"
    assert (e.params["night"], e.params["slot"], e.params["party_id"]) == (SAT, A1, ivan.id)


def test_move_from_slot_held_by_other_party(layout, make_state, ivan, riso):
    state = make_state([ivan, riso], {FRI: {A1: riso.id}})
    assert err(v.check_move, state, layout, ivan.id, A1, OKNO, [FRI]).code == "invalid"


def test_move_nights_must_be_nonempty_and_valid(layout, make_state, ivan):
    state = make_state([ivan], {FRI: {A1: ivan.id}})
    e = err(v.check_move, state, layout, ivan.id, A1, OKNO, [])
    assert (e.code, e.params["reason"], e.params["field"]) == ("invalid", "empty_list", "nights")
    assert err(v.check_move, state, layout, ivan.id, A1, OKNO, [FRI, SUN]).code == "invalid"


def test_move_unknown_slot_and_party(layout, make_state, ivan):
    state = make_state([ivan], {FRI: {A1: ivan.id}})
    assert err(v.check_move, state, layout, ivan.id, A1, "x", [FRI]).code == "unknown_slot"
    assert err(v.check_move, state, layout, ivan.id, "x", OKNO, [FRI]).code == "unknown_slot"
    assert err(v.check_move, state, layout, "p-zzzzzz", A1, OKNO, [FRI]).code == "unknown_party"


def test_move_duplicate_nights_invalid(layout, make_state, ivan):
    state = make_state([ivan], {FRI: {A1: ivan.id}})
    e = err(v.check_move, state, layout, ivan.id, A1, OKNO, [FRI, FRI])
    assert (e.code, e.params["reason"], e.params["field"]) == ("invalid", "duplicate_night", "nights")


def test_move_to_same_slot_is_invalid(layout, make_state, ivan):
    state = make_state([ivan], {FRI: {A1: ivan.id}})
    e = err(v.check_move, state, layout, ivan.id, A1, A1, [FRI])
    assert (e.code, e.params["reason"]) == ("invalid", "same_slot")


# --- parties ------------------------------------------------------------------


def create(name="New party", arrive=THU, leave=SUN, **kw):
    return PartyCreate(name=name, adults=2, kids=0, kids_in_parents_bed=0, arrive=arrive, leave=leave, **kw)


def test_duplicate_name_is_case_insensitive(layout, make_state, ivan):
    state = make_state([ivan])
    e = err(v.check_party_create, state, layout, create(name="IVAN A EVA"))
    assert (e.code, e.status) == ("duplicate_name", 409)
    assert e.params == {"field": "name", "name": "Ivan a Eva", "party_id": ivan.id, "party_name": "Ivan a Eva"}
    assert err(v.check_party_create, state, layout, create(name="  ivan a eva ")).code == "duplicate_name"
    v.check_party_create(state, layout, create(name="Ivan a Eva 2"))


def test_duplicate_name_ignores_unicode_composition(layout, make_state, make_party):
    nfd = make_party(name="Mari\u0301a a Ja\u0301n")  # built with combining accents (NFD), as stored by hand
    state = make_state([nfd])
    nfc = "Mar\u00eda a J\u00e1n"
    assert err(v.check_party_create, state, layout, create(name=nfc)).code == "duplicate_name"
    assert err(v.check_party_create, state, layout, create(name=nfc.upper())).code == "duplicate_name"
    # renaming to the composed form of its own name is not a duplicate
    assert v.check_party_update(state, layout, nfd.id, create(name=nfc)) == []


def test_duplicate_name_ignores_own_name_on_rename(layout, make_state, ivan, riso):
    state = make_state([ivan, riso])
    # changing the case of its own name is fine
    assert v.check_party_update(state, layout, ivan.id, create(name="IVAN A EVA")) == []
    # another party’s name is not
    e = err(v.check_party_update, state, layout, ivan.id, create(name="riso a ben"))
    assert e.code == "duplicate_name"


def test_update_unknown_party(layout, make_state, ivan):
    assert err(v.check_party_update, make_state([ivan]), layout, "p-zzzzzz", create()).code == "unknown_party"


@pytest.mark.parametrize(
    "arrive,leave",
    [(THU, SUN), (FRI, SAT), (SAT, SUN), (THU, FRI)],
)
def test_valid_stays(layout, arrive, leave):
    v.check_stay(layout, arrive, leave)


@pytest.mark.parametrize(
    "arrive,leave",
    [
        ("2026-11-04", SAT),   # arrival outside arrive_days
        (SUN, SUN),            # arrival is not in arrive_days
        (THU, THU),            # departure is not in leave_days
        (THU, "2026-11-09"),   # departure outside leave_days
        (SAT, SAT),            # departure is not in leave_days
        (FRI, FRI),
    ],
)
def test_invalid_stays(layout, arrive, leave):
    e = err(v.check_stay, layout, arrive, leave)
    assert (e.code, e.status) == ("invalid", 422)


def test_leave_must_be_after_arrive(layout):
    # SAT is a valid arrive and leave day, but departure may not be before or equal to arrival
    assert err(v.check_stay, layout, SAT, FRI).params["reason"] == "leave_not_after_arrive"
    assert err(v.check_stay, layout, SAT, SAT).code == "invalid"


def test_create_checks_stay(layout, make_state):
    assert err(v.check_party_create, make_state(), layout, create(arrive=SAT, leave=FRI)).code == "invalid"


def test_stay_shortening_lists_slots_outside_new_stay(layout, make_state, ivan, riso):
    sleeping = {
        THU: {A1: ivan.id, A2: ivan.id, OKNO: riso.id},
        FRI: {A1: ivan.id, A2: ivan.id},
        SAT: {A2: ivan.id, A1: ivan.id},
    }
    state = make_state([ivan, riso], sleeping)
    freed = v.stay_shortening(state, layout, ivan.id, FRI, SAT)
    # order: night, then slot order in cabin.yaml; other parties’ slots are untouched
    assert freed == [
        {"night": THU, "slot": A1},
        {"night": THU, "slot": A2},
        {"night": SAT, "slot": A1},
        {"night": SAT, "slot": A2},
    ]


def test_stay_shortening_nothing_when_stay_not_shortened(layout, make_state, ivan):
    state = make_state([ivan], {THU: {A1: ivan.id}, FRI: {A1: ivan.id}})
    assert v.stay_shortening(state, layout, ivan.id, THU, SUN) == []


def test_update_returns_freed_for_shortened_stay(layout, make_state, ivan):
    state = make_state([ivan], {THU: {A1: ivan.id}, FRI: {A1: ivan.id}, SAT: {A1: ivan.id}})
    freed = v.check_party_update(state, layout, ivan.id, create(name="Ivan a Eva", arrive=THU, leave=SAT))
    assert freed == [{"night": SAT, "slot": A1}]


def test_update_without_shortening_frees_nothing_even_if_party_shrinks(layout, make_state, ivan):
    state = make_state([ivan], {THU: {A1: ivan.id, A2: ivan.id}})
    smaller = PartyCreate(name="Ivan a Eva", adults=1, kids=0, kids_in_parents_bed=0, arrive=THU, leave=SUN)
    assert v.check_party_update(state, layout, ivan.id, smaller) == []


def test_delete_frees_all_slots_of_party(layout, make_state, ivan, riso):
    state = make_state([ivan, riso], {THU: {A1: ivan.id, OKNO: riso.id}, SAT: {MAT1: ivan.id}})
    assert v.check_party_delete(state, layout, ivan.id) == [
        {"night": THU, "slot": A1},
        {"night": SAT, "slot": MAT1},
    ]
    assert err(v.check_party_delete, state, layout, "p-zzzzzz").code == "unknown_party"


# --- module purity ----------------------------------------------------------


def test_validate_module_has_no_io_or_fastapi_imports():
    import ast
    import inspect

    tree = ast.parse(inspect.getsource(v))
    imported = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported |= {a.name.split(".")[0] for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
    assert imported <= {"collections", "dataclasses", "datetime", "typing", "unicodedata", "re", "app"}


# --- party color ----------------------------------------------------------------


def test_luminance_limits_and_the_palette():
    from app.models import PARTY_PALETTE

    assert v.COLOR_MIN_LUMINANCE == 0.06 and v.COLOR_MAX_LUMINANCE == 0.36
    assert v.relative_luminance("#FFFFFF") == pytest.approx(1.0)
    assert v.relative_luminance("#000000") == 0
    for color in PARTY_PALETTE:
        v.check_party_color(color)


@pytest.mark.parametrize(
    "color,reason", [("#FFFFFF", "color_too_light"), ("#E8D2A6", "color_too_light"),
                     ("#000000", "color_too_dark"), ("#222222", "color_too_dark")],
)
def test_check_party_color_rejects_too_light_and_too_dark(color, reason):
    e = err(v.check_party_color, color)
    assert (e.code, e.status) == ("invalid", 422)
    assert e.params == {"reason": reason, "field": "color", "color": color}


def test_check_party_create_checks_only_a_given_color(layout, make_state):
    state = make_state([])
    v.check_party_create(state, layout, create())
    v.check_party_create(state, layout, create(color="#2F7D6D"))
    assert err(v.check_party_create, state, layout, create(color="#FFFFFF")).params["reason"] == "color_too_light"


def test_check_party_update_checks_the_color_only_when_it_changes(layout, make_state, make_party):
    pale = make_party(color="#FFFFFF")
    state = make_state([pale])

    def update(**kw):
        return PartyUpdate(name=pale.name, adults=2, kids=0, kids_in_parents_bed=0, arrive=THU, leave=SUN, **kw)

    v.check_party_update(state, layout, pale.id, update())
    v.check_party_update(state, layout, pale.id, update(color="#ffffff"))  # unchanged, ignoring case
    assert err(v.check_party_update, state, layout, pale.id, update(color="#000000")).params["reason"] == "color_too_dark"
    v.check_party_update(state, layout, pale.id, update(color="#2F7D6D"))


# --- per-night places (T-033) -------------------------------------------------


def test_needed_on_night(make_party):
    p = make_party(adults=3, arrive=FRI, leave=SUN, places={FRI: 1})
    assert [v.needed_on_night(p, n) for n in (THU, FRI, SAT, SUN)] == [0, 1, 3, 0]


def test_check_places_ok(layout, make_state, make_party):
    p = make_party(adults=3, id="p-ivan01")
    st = make_state([p])
    assert v.check_places(st, layout, p.id, THU, 1) is p
    assert v.check_places(st, layout, p.id, THU, 3) is p


@pytest.mark.parametrize(
    "party_id,night,places,code,reason",
    [
        ("p-nobody", THU, 1, "unknown_party", None),
        ("p-ivan01", "2026-12-01", 1, "invalid", "night_outside_event"),
        ("p-ivan01", SAT, 1, "not_present", None),
        ("p-ivan01", THU, 0, "invalid", "places_out_of_range"),
        ("p-ivan01", THU, 4, "invalid", "places_out_of_range"),
    ],
)
def test_check_places_errors(layout, make_state, make_party, party_id, night, places, code, reason):
    p = make_party(adults=3, id="p-ivan01", arrive=THU, leave=SAT)
    with pytest.raises(RuleError) as exc:
        v.check_places(make_state([p]), layout, party_id, night, places)
    assert exc.value.code == code
    assert exc.value.params.get("reason") == reason


def test_adjust_places(make_party):
    p = make_party(adults=3, arrive=THU, leave=SAT, places={THU: 2, FRI: 3, SAT: 1, SUN: 1})
    v.adjust_places(p)
    assert p.places == {THU: 2}
    p = make_party(adults=2, arrive=THU, leave=SUN, places={THU: 5})
    v.adjust_places(p)
    assert p.places == {}


def test_set_places_full_count_removes_entry(make_party):
    p = make_party(adults=3, places={THU: 1})
    v.set_places(p, THU, 3)
    assert p.places == {}
    v.set_places(p, THU, 2)
    assert p.places == {THU: 2}


def test_raise_places_to_placed(make_state, make_party):
    p = make_party(adults=3, id="p-ivan01", places={THU: 1})
    st = make_state([p], {THU: {A1: p.id}})
    v.raise_places_to_placed(st, p, THU)
    assert p.places == {THU: 1}
    st.sleeping[THU][A2] = p.id
    v.raise_places_to_placed(st, p, THU)
    assert p.places == {THU: 2}
    st.sleeping[THU][OKNO] = p.id
    v.raise_places_to_placed(st, p, THU)
    assert p.places == {}


# --- day visits (T-036) ----------------------------------------------------------


def day_only(make_party, **kw):
    return make_party(arrive=None, leave=None, day_visits=[THU], **kw)


def test_event_days_run_from_first_arrive_day_to_last_leave_day(layout):
    assert v.event_days(layout) == [THU, FRI, SAT, SUN]


def test_day_only_party_is_never_present_and_needs_nothing(layout, make_party):
    guest = day_only(make_party, adults=2, kids=1)
    assert v.is_day_only(guest)
    assert not any(v.is_present(guest, n) for n in layout.event.nights)
    assert [v.needed_on_night(guest, n) for n in layout.event.nights] == [0, 0, 0]
    assert v.party_nights(guest, layout) == []
    assert not v.is_day_only(make_party())
    assert not v.is_day_only(make_party(day_visits=[], arrive=None, leave=None))


def test_stay_shortening_without_a_stay_frees_everything(layout, make_state, make_party):
    ivan = make_party(id="p-ivan01")
    state = make_state([ivan], {THU: {A1: ivan.id}, FRI: {A2: ivan.id}})
    assert v.stay_shortening(state, layout, ivan.id, None, None) == [
        {"night": THU, "slot": A1}, {"night": FRI, "slot": A2},
    ]


def mode_error(layout, **fields):
    base = {"name": "Hosť", "adults": 1, "kids": 0, "kids_in_parents_bed": 0}
    return err(v.check_party_create, State(version=0, updated_at="2026-10-25T19:02:11+02:00"), layout,
               PartyCreate(**{**base, **fields}))


@pytest.mark.parametrize(
    "fields,reason,field,extra",
    [
        ({"day_visits": [THU], "arrive": THU}, "stay_mode_mixed", "day_visits", {}),
        ({"day_visits": [THU], "leave": SUN}, "stay_mode_mixed", "day_visits", {}),
        ({"day_visits": [THU], "arrive": THU, "leave": SUN}, "stay_mode_mixed", "day_visits", {}),
        ({}, "day_visits_empty", "day_visits", {}),
        ({"arrive": THU}, "stay_incomplete", "leave", {}),
        ({"leave": SUN}, "stay_incomplete", "arrive", {}),
        ({"day_visits": [THU, THU]}, "duplicate_day", "day_visits", {"day": THU}),
        ({"day_visits": [THU, "2026-11-12"]}, "day_outside_event", "day_visits", {"day": "2026-11-12"}),
        ({"day_visits": ["2026-11-04"]}, "day_outside_event", "day_visits", {"day": "2026-11-04"}),
        ({"day_visits": [THU], "kids": 1, "kids_in_parents_bed": 1}, "day_only_kids_in_bed",
         "kids_in_parents_bed", {}),
    ],
)
def test_party_mode_rules(layout, fields, reason, field, extra):
    e = mode_error(layout, **fields)
    assert (e.code, e.status) == ("invalid", 422)
    assert e.params == {"reason": reason, "field": field, **extra}
    assert e.message.isascii()


def test_mode_rules_are_checked_in_order(layout):
    # mixed comes before day checks, duplicates before the event range
    assert mode_error(layout, day_visits=["2026-11-12"], arrive=THU).params["reason"] == "stay_mode_mixed"
    assert mode_error(layout, day_visits=["2026-11-12", "2026-11-12"]).params["reason"] == "duplicate_day"


def test_day_only_party_with_kids_and_all_event_days_is_valid(layout, make_state):
    data = PartyCreate(name="Hosť", adults=2, kids=2, kids_in_parents_bed=0, day_visits=[SUN, THU, FRI, SAT])
    assert data.day_visits == [THU, FRI, SAT, SUN]  # sorted
    v.check_party_create(make_state(), layout, data)


def test_overnight_party_keeps_the_stay_reasons(layout, make_state):
    with pytest.raises(RuleError) as exc:
        v.check_party_create(make_state(), layout, PartyCreate(
            name="X", adults=1, kids=0, kids_in_parents_bed=0, arrive=SAT, leave=FRI))
    assert exc.value.params["reason"] == "leave_not_after_arrive"


def test_update_to_day_only_frees_all_slots(layout, make_state, make_party):
    ivan = make_party(id="p-ivan01")
    state = make_state([ivan], {THU: {A1: ivan.id}, FRI: {A1: ivan.id}})
    data = PartyUpdate(name=ivan.name, adults=2, kids=0, kids_in_parents_bed=0, day_visits=[FRI])
    assert v.check_party_update(state, layout, ivan.id, data) == [
        {"night": THU, "slot": A1}, {"night": FRI, "slot": A1},
    ]


def test_assign_and_places_refuse_a_day_only_party(layout, make_state, make_party):
    guest = day_only(make_party, id="p-guest1")
    state = make_state([guest])
    assert err(v.check_assign, state, layout, THU, [A1], guest.id).code == "not_present"
    assert err(v.check_places, state, layout, guest.id, THU, 1).code == "not_present"
    assert err(v.check_assign_stay, state, layout, [A1], guest.id).params["reason"] == "no_event_nights"


# --- briefing (T-058) ---------------------------------------------------------


def test_check_briefing_known_step_and_party(make_state, ivan):
    assert v.check_briefing(make_state([ivan]), ivan.id, "water") is ivan


def test_check_briefing_errors(make_state, ivan):
    state = make_state([ivan])
    assert (err(v.check_briefing, state, ivan.id, "nope").code) == "invalid"
    assert (err(v.check_briefing, state, "p-ghost1", "pack").code) == "unknown_party"


def test_add_briefing_step_keeps_canonical_order_and_reports_repeat(make_state, ivan):
    state = make_state([ivan])
    assert v.add_briefing_step(state, ivan.id, "list") is True
    assert v.add_briefing_step(state, ivan.id, "pack") is True
    assert state.briefing[ivan.id] == ["pack", "list"]
    assert v.add_briefing_step(state, ivan.id, "pack") is False


# --- food note (T-066) --------------------------------------------------------


def test_check_food_trims_and_normalizes(make_state, ivan):
    party, text = v.check_food(make_state([ivan]), ivan.id, "  Café  ")
    assert party is ivan and text == "Café"


def test_check_food_length_boundary(make_state, ivan):
    state = make_state([ivan])
    assert v.check_food(state, ivan.id, "a" * 120)[1] == "a" * 120
    with pytest.raises(v.RuleError) as exc:
        v.check_food(state, ivan.id, "a" * 121)
    assert exc.value.code == "invalid" and exc.value.params["reason"] == "too_long" and exc.value.params["max"] == 120


def test_check_food_rejects_control_chars_and_unknown_party(make_state, ivan):
    state = make_state([ivan])
    with pytest.raises(v.RuleError) as exc:
        v.check_food(state, ivan.id, "a\tb")
    assert exc.value.params["reason"] == "control_chars"
    with pytest.raises(v.RuleError) as exc:
        v.check_food(state, "p-nobody", "x")
    assert exc.value.code == "unknown_party"


def test_set_food_note(ivan):
    assert v.set_food_note(ivan, "x") and ivan.food_note == "x"
    assert not v.set_food_note(ivan, "x")
    assert v.set_food_note(ivan, "") and ivan.food_note is None
    assert not v.set_food_note(ivan, "")


# --- phone login (T-090) -----------------------------------------------------------


@pytest.mark.parametrize(
    "raw", ["0905 123 456", "0905-123-456", "00421905123456", "+421 905 123 456", "(0905) 123.456"]
)
def test_normalize_phone_accepts_common_forms(raw):
    assert v.normalize_phone(raw) == "+421905123456"


@pytest.mark.parametrize("raw", ["", "abc", "+12", "0", "+1234567890123456", "905123456", "0905 12x 456"])
def test_normalize_phone_rejects(raw):
    with pytest.raises(RuleError) as exc:
        v.normalize_phone(raw)
    assert exc.value.code == "invalid" and exc.value.params["field"] == "phone"


def test_phone_hint(make_party):
    assert v.phone_hint(make_party()) is None
    assert v.phone_hint(make_party(phone="+421905123456", phone_set_at="2026-10-25T10:00:00+02:00")) == "456"


def test_check_party_access(make_party):
    set_at = "2026-10-25T10:00:00+02:00"
    ts = 1792915200.0  # 2026-10-25T10:00:00+02:00
    assert v.datetime.fromisoformat(set_at).timestamp() == ts
    protected = make_party(phone="+421905123456", phone_set_at=set_at)
    open_party = make_party()
    v.check_party_access(open_party, {}, False)
    v.check_party_access(protected, {}, True)
    v.check_party_access(protected, {protected.id: ts}, False)  # equal time passes
    v.check_party_access(protected, {protected.id: ts + 5}, False)
    for verified in ({}, {protected.id: ts - 1}, {open_party.id: ts}):
        with pytest.raises(RuleError) as exc:
            v.check_party_access(protected, verified, False)
        assert exc.value.code == "login_required" and exc.value.status == 403
        assert exc.value.params == {"party_id": protected.id, "party_name": protected.name}


def test_phone_verify_off_unprotects_parties_with_a_phone(make_party):
    protected = make_party(phone="+421905123456", phone_set_at="2026-10-25T10:00:00+02:00")
    assert v.is_protected(protected) and v.is_protected(protected, True)
    assert not v.is_protected(protected, False) and not v.is_protected(make_party(), True)
    for is_admin in (True, False):
        v.check_party_access(protected, {}, is_admin, False)
    v.check_party_access(protected, {protected.id: 0.0}, False, False)  # verified caller, flag off: still passes
    with pytest.raises(RuleError):
        v.check_party_access(protected, {}, False, True)
    v.check_party_access(protected, {}, True, True)
