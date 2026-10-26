"""Write rules as pure functions.

No I/O, no FastAPI. The functions receive the state and the layout, change nothing,
and either return what should be written or raise a `RuleError`. A `RuleError` carries
a stable `code`, a short English developer `message` (never shown to users), `params`
with the values the page needs to build its Slovak text, and an HTTP status.
The server calls these functions under the lock on every write; the page may use them
only as a quick pre-check. There is no other place for rules.

`params` conventions: `night`, `slot`, `party_id`, `party_name`, `field`. For
`invalid`, `params["reason"]` says what exactly is wrong (see the `_invalid(...)` calls below).
"""

import re
import unicodedata
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from app.models import BRIEFING_STEPS, FOOD_NOTE_MAX, Layout, Party, PartyCreate, PartyInput, PartyUpdate, State

ERROR_STATUS: dict[str, int] = {
    "bad_code": 401,
    "forbidden": 403,
    "login_required": 403,
    "phone_mismatch": 403,
    "bad_sms_code": 401,
    "signup_closed": 403,
    "slot_taken": 409,
    "not_present": 409,
    "duplicate_name": 409,
    "unknown_slot": 404,
    "unknown_party": 404,
    "invalid": 422,
    "rate_limited": 429,
    "sms_unavailable": 503,
}


class RuleError(Exception):
    def __init__(self, code: str, message: str, params: dict[str, Any] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.params: dict[str, Any] = params or {}
        self.status = ERROR_STATUS[code]


@dataclass(frozen=True)
class StayPlan:
    """Result of `check_assign_stay`: nights to write and skipped nights."""

    slots: list[str]
    nights: list[str]
    skipped: list[str]


# --- helpers -----------------------------------------------------------------


def find_party(state: State, party_id: str) -> Party:
    for party in state.parties:
        if party.id == party_id:
            return party
    raise RuleError("unknown_party", "Party not found", {"party_id": party_id})


def occupant(state: State, night: str, slot: str) -> str | None:
    """ID of the party sleeping in the slot on that night, or None."""
    return state.sleeping.get(night, {}).get(slot)


def is_day_only(party: Party | PartyInput) -> bool:
    """A day-only party comes for the day (`day_visits`) and never sleeps: no arrive, no leave."""
    return bool(party.day_visits) and party.arrive is None and party.leave is None


def is_present(party: Party | PartyInput, night: str) -> bool:
    """A party is present on a night if arrive ≤ night < leave (ISO strings compare as text).

    A party without a stay (day-only) is never present.
    """
    if party.arrive is None or party.leave is None:
        return False
    return party.arrive <= night < party.leave


def event_days(layout: Layout) -> list[str]:
    """Every calendar day from the first arrive day to the last leave day, inclusive (derived, not configured)."""
    first = date.fromisoformat(layout.event.arrive_days[0])
    last = date.fromisoformat(layout.event.leave_days[-1])
    return [(first + timedelta(days=i)).isoformat() for i in range((last - first).days + 1)]


def needed_slots(party: Party | PartyInput) -> int:
    return party.adults + party.kids - party.kids_in_parents_bed


def needed_on_night(party: Party, night: str) -> int:
    """Places the party needs on a night: 0 when absent, the `places` override when set, else the full count."""
    if not is_present(party, night):
        return 0
    full = needed_slots(party)
    return min(party.places.get(night, full), full)


def placed_on_night(state: State, party_id: str, night: str) -> int:
    return sum(1 for pid in state.sleeping.get(night, {}).values() if pid == party_id)


def party_nights(party: Party | PartyInput, layout: Layout) -> list[str]:
    """Event nights on which the party is at the cabin."""
    return [n for n in layout.event.nights if is_present(party, n)]


def _invalid(reason: str, message: str, **params: Any) -> RuleError:
    return RuleError("invalid", message, {"reason": reason, **params})


def _check_night(layout: Layout, night: str) -> None:
    if night not in layout.event.nights:
        raise _invalid("night_outside_event", "Night is not part of the event", field="night", night=night)


def _check_slots_known(layout: Layout, slots: list[str]) -> None:
    for slot in slots:
        if slot not in layout.slot_order:
            raise RuleError("unknown_slot", "Slot does not exist", {"slot": slot})


def _taken_error(state: State, night: str, slot: str, party_id: str | None = None) -> RuleError:
    """`slot_taken` naming the holder. `own` is true when the holder is the requesting party."""
    holder = occupant(state, night, slot)
    name = next((p.name for p in state.parties if p.id == holder), None)
    params = {
        "night": night,
        "slot": slot,
        "party_id": holder,
        "party_name": name,
        "own": holder is not None and holder == party_id,
    }
    return RuleError("slot_taken", "Slot already taken", params)


def _check_slot_list(slots: list[str]) -> None:
    if not slots:
        raise _invalid("empty_list", "The list of slots is empty", field="slots")
    if len(set(slots)) != len(slots):
        raise _invalid("duplicate_slot", "A slot is listed more than once", field="slots")


# --- assigning slots ---------------------------------------------------------


def check_signup_open(state: State, is_admin: bool) -> None:
    """When signup is locked, a write passes only with the admin cookie."""
    if not state.signup_open and not is_admin:
        raise RuleError("signup_closed", "Signup is closed")


def check_assign(state: State, layout: Layout, night: str, slots: list[str], party_id: str) -> list[str]:
    """Return all slots to write, or raise. Never a partial list.

    A party that ends up with more slots than it needs is not refused (Q4).
    """
    _check_slot_list(slots)
    _check_night(layout, night)
    party = find_party(state, party_id)
    _check_slots_known(layout, slots)
    if not is_present(party, night):
        raise RuleError(
            "not_present",
            "Party is not at the cabin on this night",
            {"night": night, "party_id": party.id, "party_name": party.name},
        )
    for slot in slots:
        if occupant(state, night, slot) is not None:
            raise _taken_error(state, night, slot, party_id)
    return list(slots)


def check_assign_stay(state: State, layout: Layout, slots: list[str], party_id: str) -> StayPlan:
    """For each night of the stay: all slots free means the whole night is written, else it is skipped.

    If every night is skipped, this is `slot_taken` (Q5) with the first conflict in `params`
    plus `skipped` (all nights of the stay). A slot the same party already holds on a night
    counts as taken, so that night is skipped.
    """
    _check_slot_list(slots)
    party = find_party(state, party_id)
    _check_slots_known(layout, slots)
    stay = party_nights(party, layout)
    if not stay:
        raise _invalid(
            "no_event_nights", "Party is not at the cabin on any night of the event",
            party_id=party.id, party_name=party.name,
        )
    nights: list[str] = []
    skipped: list[str] = []
    first_conflict: RuleError | None = None
    for night in stay:
        taken = next((s for s in slots if occupant(state, night, s) is not None), None)
        if taken is None:
            nights.append(night)
        else:
            skipped.append(night)
            if first_conflict is None:
                first_conflict = _taken_error(state, night, taken, party_id)
    if not nights:
        assert first_conflict is not None
        raise RuleError(
            "slot_taken", "No night of the stay has these slots free", {**first_conflict.params, "skipped": skipped}
        )
    return StayPlan(slots=list(slots), nights=nights, skipped=skipped)


def check_clear(state: State, layout: Layout, night: str, slot: str) -> str | None:
    """Return the ID of the party whose slot will be cleared. None means it is already free (nothing is written, Q5)."""
    _check_night(layout, night)
    _check_slots_known(layout, [slot])
    return occupant(state, night, slot)


def check_move(
    state: State, layout: Layout, party_id: str, from_slot: str, to_slot: str, nights: list[str]
) -> list[str]:
    """A move is all or nothing. Returns the nights in which to move."""
    if not nights:
        raise _invalid("empty_list", "The list of nights is empty", field="nights")
    if len(set(nights)) != len(nights):
        raise _invalid("duplicate_night", "A night is listed more than once", field="nights")
    for night in nights:
        _check_night(layout, night)
    party = find_party(state, party_id)
    _check_slots_known(layout, [from_slot, to_slot])
    if from_slot == to_slot:
        raise _invalid("same_slot", "The new slot is the same as the old one", field="to_slot", slot=to_slot)
    for night in nights:
        if occupant(state, night, from_slot) != party_id:
            raise _invalid(
                "not_holding", "Party does not hold the source slot on this night", field="from_slot",
                night=night, slot=from_slot, party_id=party.id, party_name=party.name,
            )
    for night in nights:
        if occupant(state, night, to_slot) is not None:
            raise _taken_error(state, night, to_slot, party_id)
    return list(nights)


# --- parties -----------------------------------------------------------------


def _name_key(name: str) -> str:
    return unicodedata.normalize("NFC", name.strip()).casefold()


def check_party_name(state: State, name: str, own_id: str | None = None) -> None:
    """Names are unique ignoring case and Unicode composition (NFC). On rename, the party’s own name is ignored."""
    wanted = _name_key(name)
    for party in state.parties:
        if party.id != own_id and _name_key(party.name) == wanted:
            raise RuleError(
                "duplicate_name", "A party with this name already exists",
                {"field": "name", "name": party.name, "party_id": party.id, "party_name": party.name},
            )


def check_stay(layout: Layout, arrive: str, leave: str) -> None:
    if arrive not in layout.event.arrive_days:
        raise _invalid("arrive_not_allowed", "Arrival is not one of the arrive days", field="arrive", arrive=arrive)
    if leave not in layout.event.leave_days:
        raise _invalid("leave_not_allowed", "Departure is not one of the leave days", field="leave", leave=leave)
    if not arrive < leave:
        raise _invalid(
            "leave_not_after_arrive", "Departure must be after arrival", field="leave", arrive=arrive, leave=leave
        )


def check_stay_mode(data: Party | PartyInput) -> None:
    """The party is either overnight (`arrive` and `leave`) or day-only (`day_visits`), never both or neither.

    Shared by the request path and the startup check. The arrive and leave values of an overnight
    party are checked separately by `check_stay`.
    """
    if data.day_visits and (data.arrive is not None or data.leave is not None):
        raise _invalid(
            "stay_mode_mixed", "A party with day visits cannot also have arrive or leave", field="day_visits"
        )
    if data.arrive is None and data.leave is None and not data.day_visits:
        raise _invalid("day_visits_empty", "Give arrive and leave, or at least one day visit", field="day_visits")
    if not data.day_visits and (data.arrive is None or data.leave is None):
        missing = "arrive" if data.arrive is None else "leave"
        raise _invalid("stay_incomplete", f"Only one of arrive and leave is given: {missing} is missing", field=missing)


def check_day_visits(layout: Layout, data: Party | PartyInput) -> None:
    """Rules for a day-only party: known, distinct event days, and no kid in the parents' bed."""
    days = event_days(layout)
    seen: set[str] = set()
    for day in data.day_visits:
        if day in seen:
            raise _invalid("duplicate_day", f"Day {day} is listed more than once", field="day_visits", day=day)
        seen.add(day)
    for day in data.day_visits:
        if day not in days:
            raise _invalid(
                "day_outside_event", f"Day {day} is outside the event ({days[0]} to {days[-1]})",
                field="day_visits", day=day,
            )
    if data.kids_in_parents_bed > 0:
        raise _invalid(
            "day_only_kids_in_bed", "A day-only party has no bed, so kids_in_parents_bed must be 0",
            field="kids_in_parents_bed",
        )


def check_stay_shape(layout: Layout, data: Party | PartyInput) -> None:
    """The mode rules plus the day-visit rules. The startup check of stored parties calls this."""
    check_stay_mode(data)
    if is_day_only(data):
        check_day_visits(layout, data)


def check_party_stay(layout: Layout, data: Party | PartyInput) -> None:
    """All stay rules of a party request: `check_stay_shape`, then arrive and leave of an overnight party."""
    check_stay_shape(layout, data)
    if not is_day_only(data):
        check_stay(layout, data.arrive, data.leave)


def _party_entries(state: State, layout: Layout, party_id: str, keep: Callable[[str], bool] | None = None) -> list[dict[str, str]]:
    """The party’s {night, slot} entries, ordered by night, then by slot order in cabin.yaml.

    Nights for which `keep(night)` is true are skipped.
    """
    entries: list[dict[str, str]] = []
    unknown = len(layout.slot_order)
    for night in sorted(state.sleeping):
        if keep is not None and keep(night):
            continue
        mine = [s for s, pid in state.sleeping[night].items() if pid == party_id]
        for slot in sorted(mine, key=lambda s: layout.slot_order.get(s, unknown)):
            entries.append({"night": night, "slot": slot})
    return entries


def stay_shortening(
    state: State, layout: Layout, party_id: str, arrive: str | None, leave: str | None
) -> list[dict[str, str]]:
    """The party’s slots on nights outside the new stay: a list of {night, slot} (the future `freed`).

    Without a stay (day-only), that is all of its slots.
    """
    if arrive is None or leave is None:
        return _party_entries(state, layout, party_id)
    return _party_entries(state, layout, party_id, keep=lambda night: arrive <= night < leave)


# Allowed WCAG relative luminance of a party color: dark enough to show on the light room floors,
# light enough to show on the dark ones. static/js/logic-form.js (`colorProblem`) mirrors these two values.
COLOR_MIN_LUMINANCE = 0.06
COLOR_MAX_LUMINANCE = 0.36


def relative_luminance(color: str) -> float:
    """WCAG relative luminance of "#RRGGBB"."""
    channels = []
    for i in (1, 3, 5):
        c = int(color[i : i + 2], 16) / 255
        channels.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def check_party_color(color: str) -> None:
    """A chosen party color must not be so light or so dark that the figure is lost on the map."""
    lum = relative_luminance(color)
    if lum > COLOR_MAX_LUMINANCE:
        raise _invalid("color_too_light", "Color is too light to show on the map", field="color", color=color)
    if lum < COLOR_MIN_LUMINANCE:
        raise _invalid("color_too_dark", "Color is too dark to show on the map", field="color", color=color)


def check_party_create(state: State, layout: Layout, data: PartyCreate) -> None:
    check_party_name(state, data.name)
    check_party_stay(layout, data)
    if data.color is not None:
        check_party_color(data.color)


def check_party_update(state: State, layout: Layout, party_id: str, data: PartyUpdate) -> list[dict[str, str]]:
    """Check a party update and return the slots freed by shortening the stay."""
    party = find_party(state, party_id)
    check_party_name(state, data.name, own_id=party_id)
    check_party_stay(layout, data)
    # An unchanged color is not checked again, so a color stored earlier never blocks other edits.
    if data.color is not None and data.color.upper() != party.color.upper():
        check_party_color(data.color)
    return stay_shortening(state, layout, party_id, data.arrive, data.leave)


def check_party_delete(state: State, layout: Layout, party_id: str) -> list[dict[str, str]]:
    """Return all slots of a deleted party (they get freed)."""
    find_party(state, party_id)
    return _party_entries(state, layout, party_id)


# --- per-night places override -----------------------------------------------


def check_places(state: State, layout: Layout, party_id: str, night: str, places: int) -> Party:
    """Check a `places` request: 1 <= places <= full count, party present. Returns the party."""
    party = find_party(state, party_id)
    _check_night(layout, night)
    if not is_present(party, night):
        raise RuleError(
            "not_present",
            "Party is not at the cabin on this night",
            {"night": night, "party_id": party.id, "party_name": party.name},
        )
    if not 1 <= places <= needed_slots(party):
        raise _invalid(
            "places_out_of_range", "Places must be between 1 and the full count of the party",
            field="places", night=night, places=places, party_id=party.id, party_name=party.name,
        )
    return party


def check_briefing(state: State, party_id: str, step: str) -> Party:
    """Check a `briefing` request: known step, known party. Returns the party. Allowed while signup is locked."""
    if step not in BRIEFING_STEPS:
        raise _invalid("unknown_step", "Unknown briefing step", field="step", step=step)
    return find_party(state, party_id)


def add_briefing_step(state: State, party_id: str, step: str) -> bool:
    """Record the step in canonical order. False when it was already recorded (nothing changed)."""
    done = state.briefing.get(party_id, [])
    if step in done:
        return False
    state.briefing[party_id] = [s for s in BRIEFING_STEPS if s in done or s == step]
    return True


def check_food(state: State, party_id: str, text: str) -> tuple[Party, str]:
    """Check a `food` request: known party, text trimmed (NFC), at most 120 chars, no control characters.

    Returns the party and the normalized text ("" clears the note). Allowed while signup is locked.
    """
    party = find_party(state, party_id)
    text = unicodedata.normalize("NFC", text.strip())
    if len(text) > FOOD_NOTE_MAX:
        raise _invalid("too_long", "Food note is too long", field="text", max=FOOD_NOTE_MAX)
    if any(unicodedata.category(ch) in ("Cc", "Zl", "Zp") for ch in text):
        raise _invalid("control_chars", "Control characters and line breaks are not allowed", field="text")
    return party, text


def set_food_note(party: Party, text: str) -> bool:
    """Set or (for "") remove the note. False when nothing changed."""
    new = text or None
    if party.food_note == new:
        return False
    party.food_note = new
    return True


def set_places(party: Party, night: str, places: int) -> None:
    """Store the override; the full count removes the night's entry."""
    if places >= needed_slots(party):
        party.places.pop(night, None)
    else:
        party.places[night] = places


def adjust_places(party: Party) -> None:
    """After a party edit: drop nights outside the stay, clamp values to the full count, drop entries equal to it."""
    full = needed_slots(party)
    for night in list(party.places):
        if not is_present(party, night) or party.places[night] >= full:
            del party.places[night]


def raise_places_to_placed(state: State, party: Party, night: str) -> None:
    """After placing: lift the override to the placed count; at the full count it disappears. Never lowers it."""
    current = party.places.get(night)
    if current is None:
        return
    placed = placed_on_night(state, party.id, night)
    if placed > current:
        set_places(party, night, placed)


# --- phone login (T-090) -------------------------------------------------------

_PHONE_RE = re.compile(r"^\+[1-9][0-9]{7,14}$")


def normalize_phone(raw: str) -> str:
    """Return the E.164 form of a typed number: `0905 123 456` -> `+421905123456`.

    Spaces, dashes, dots and parentheses are dropped, a leading `00` becomes `+`, a single
    leading `0` means Slovakia (`+421`).
    """
    value = re.sub(r"[\s().\-]", "", raw if isinstance(raw, str) else "")
    if value.startswith("00"):
        value = "+" + value[2:]
    elif value.startswith("0"):
        value = "+421" + value[1:]
    if not _PHONE_RE.match(value):
        raise RuleError("invalid", "Phone number is not valid", {"field": "phone", "reason": "phone_format"})
    return value


def phone_hint(party: Party) -> str | None:
    """The last 3 digits of the stored number, or None for a party without a phone."""
    return party.phone[-3:] if party.phone else None


def is_protected(party: Party, phone_verify: bool = True) -> bool:
    """A party with a phone is protected only while SMS verification is on."""
    return phone_verify and party.phone is not None


def is_verified(party: Party, verified: Mapping[str, float]) -> bool:
    """True when the caller verified the party's phone at or after the time the phone was set."""
    if party.phone_set_at is None or party.id not in verified:
        return False
    set_at = datetime.fromisoformat(party.phone_set_at).timestamp()
    return verified[party.id] >= set_at


def check_party_access(
    party: Party, verified: Mapping[str, float], is_admin: bool, phone_verify: bool = True
) -> None:
    """A party with a phone may be changed only by a verified caller or the admin."""
    if is_admin or not is_protected(party, phone_verify) or is_verified(party, verified):
        return
    raise RuleError(
        "login_required", "Party is protected by a phone number", {"party_id": party.id, "party_name": party.name}
    )
