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

import unicodedata
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.models import Layout, Party, PartyInput, State

ERROR_STATUS: dict[str, int] = {
    "bad_code": 401,
    "forbidden": 403,
    "signup_closed": 403,
    "slot_taken": 409,
    "not_present": 409,
    "duplicate_name": 409,
    "unknown_slot": 404,
    "unknown_party": 404,
    "invalid": 422,
    "rate_limited": 429,
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


def is_present(party: Party | PartyInput, night: str) -> bool:
    """A party is present on a night if arrive ≤ night < leave (ISO strings compare as text)."""
    return party.arrive <= night < party.leave


def needed_slots(party: Party | PartyInput) -> int:
    return party.adults + party.kids - party.kids_in_parents_bed


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


def stay_shortening(state: State, layout: Layout, party_id: str, arrive: str, leave: str) -> list[dict[str, str]]:
    """The party’s slots on nights outside the new stay: a list of {night, slot} (the future `freed`)."""
    return _party_entries(state, layout, party_id, keep=lambda night: arrive <= night < leave)


def check_party_create(state: State, layout: Layout, data: PartyInput) -> None:
    check_party_name(state, data.name)
    check_stay(layout, data.arrive, data.leave)


def check_party_update(state: State, layout: Layout, party_id: str, data: PartyInput) -> list[dict[str, str]]:
    """Check a party update and return the slots freed by shortening the stay."""
    find_party(state, party_id)
    check_party_name(state, data.name, own_id=party_id)
    check_stay(layout, data.arrive, data.leave)
    return stay_shortening(state, layout, party_id, data.arrive, data.leave)


def check_party_delete(state: State, layout: Layout, party_id: str) -> list[dict[str, str]]:
    """Return all slots of a deleted party (they get freed)."""
    find_party(state, party_id)
    return _party_entries(state, layout, party_id)
