"""Pydantic models: cabin layout, app config, parties, state and action requests.

The models only guard shape and input limits. Write rules (free slot, presence,
move, stay shortening) live exclusively in `app/validate.py`.
Dates are ISO strings everywhere (“2026-10-29”), never `date` objects.
"""

import unicodedata
from datetime import date, datetime
from functools import cached_property
from pathlib import Path
from typing import Annotated, Any, Literal

import yaml
from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationError,
    ValidationInfo,
    field_validator,
    model_validator,
)

BedKind = Literal["bed2", "bunk", "mats", "sofa", "sofa1", "stove", "bed1", "cot"]

PARTY_ID_PATTERN = r"^p-[A-Za-z0-9]{6}$"
COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"
IDENT_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"

# Party colors in the order they are handed out (the "Vzhľad" section of proposal.md). Only the server picks them.
PARTY_PALETTE = (
    "#2F7D6D", "#D07A2B", "#6D5BA8", "#C08A1E", "#3E6FB0", "#9C4A7A",
    "#5E8A2E", "#8A6A4A", "#2E8AA0", "#C0603A", "#7A7F2B", "#A04848",
)

# Upper bounds for lists in requests. They are far above real use (the biggest bed has 3 slots,
# the event has 3 nights) and exist so that one huge body cannot block the single worker.
MAX_SLOTS_PER_REQUEST = 32
MAX_NIGHTS_PER_REQUEST = 10


# --- shared types -----------------------------------------------------------


def _check_iso_date(value: str) -> str:
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        parsed = None
    if parsed is None or parsed.isoformat() != value:
        raise ValueError(f"“{value}” is not a date in YYYY-MM-DD form (put it in quotes)")
    return value


def _check_iso_datetime(value: str) -> str:
    try:
        datetime.fromisoformat(value)
    except ValueError:
        raise ValueError(f"“{value}” is not an ISO timestamp (put it in quotes)") from None
    return value


def _normalize_nfc(value: str) -> str:
    return unicodedata.normalize("NFC", value)


def _reject_control_chars(value: str) -> str:
    """Single-line text: no control characters and no line or paragraph separators."""
    if any(unicodedata.category(ch) in ("Cc", "Zl", "Zp") for ch in value):
        raise ValueError("control characters and line breaks are not allowed")
    return value


def _reject_control_chars_keep_newlines(value: str) -> str:
    """Multi-line text: control characters are rejected, but tab and line breaks are allowed."""
    if any(unicodedata.category(ch) == "Cc" and ch not in "\t\n\r" for ch in value):
        raise ValueError("control characters are not allowed")
    return value


IsoDate = Annotated[str, Field(strict=True), AfterValidator(_check_iso_date)]
IsoDateTime = Annotated[str, Field(strict=True), AfterValidator(_check_iso_datetime)]
Coord = Annotated[int, Field(strict=True)]
Rect = Annotated[list[Coord], Field(min_length=4, max_length=4)]
Ident = Annotated[str, Field(strict=True, pattern=IDENT_PATTERN)]
HexColor = Annotated[str, Field(strict=True, pattern=COLOR_PATTERN)]
PartyId = Annotated[str, Field(strict=True, pattern=PARTY_ID_PATTERN)]
Count = Annotated[int, Field(strict=True, ge=0, le=20)]
Label = Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=120)]

# Requests: only sane bounds. Whether the night, slot or party exists is decided by validate.py
# (which returns `invalid`, `unknown_slot`, `unknown_party`).
SlotRef = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=64)]
NightRef = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=10)]
PartyRef = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=64)]


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _duplicates(items: list[str]) -> list[str]:
    """Repeated items in order of first repetition. Linear in the number of items."""
    seen: set[str] = set()
    reported: set[str] = set()
    dupes: list[str] = []
    for item in items:
        if item in seen and item not in reported:
            reported.add(item)
            dupes.append(item)
        seen.add(item)
    return dupes


# --- cabin layout (config/cabin.yaml) ------------------------------------


class Event(_Model):
    name: Label
    arrive_days: list[IsoDate] = Field(min_length=1)
    leave_days: list[IsoDate] = Field(min_length=1)
    nights: list[IsoDate] = Field(min_length=1)

    @model_validator(mode="after")
    def _check_days(self) -> "Event":
        for field in ("arrive_days", "leave_days", "nights"):
            dupes = _duplicates(getattr(self, field))
            if dupes:
                raise ValueError(f"{field}: repeated days: {', '.join(dupes)}")
        for night in self.nights:
            if night not in self.arrive_days:
                raise ValueError(f"night {night} is not one of the arrive days (arrive_days)")
        return self


CHIMNEY_WIDTH = 6  # px, same as in the page (CHIMNEY_W in static/index.html)


class SceneRects(_Model):
    title: Rect
    nights: Rect
    notice: Rect
    status: Rect
    locked: Rect
    letter: Rect
    key: Rect
    legend: Rect
    parties: Rect
    meadow: Rect


class MapLayout(_Model):
    viewbox: list[Coord] = Field(min_length=2, max_length=2)
    paths: list[Rect]
    doors: list[Rect]
    windows: list[Rect]
    scene: SceneRects


class Bed(_Model):
    id: Ident
    name: Label
    kind: BedKind
    rect: Rect
    slots: list[Ident] = Field(min_length=1)
    tight: list[Ident] = []

    @model_validator(mode="after")
    def _check_tight(self) -> "Bed":
        for slot in self.tight:
            if slot not in self.slots:
                raise ValueError(f"tight slot “{slot}” is not one of the slots of bed “{self.id}”")
        return self


class Room(_Model):
    id: Ident
    name: Label
    rect: Rect
    floor: HexColor
    beds: list[Bed] = Field(min_length=1)


class RoofColors(_Model):
    face: HexColor
    dark: HexColor
    ridge: HexColor


class House(_Model):
    """A group of rooms that share one roof (drawn by the page above the union of the room rects)."""

    id: Ident
    rooms: list[Ident] = Field(min_length=1)
    roof: RoofColors
    chimney: Coord  # x of the left edge of the chimney, must lie within the width of the house


class Layout(_Model):
    event: Event
    map: MapLayout
    rooms: list[Room] = Field(min_length=1)
    houses: list[House] = Field(min_length=1)

    @model_validator(mode="after")
    def _check_unique_ids(self) -> "Layout":
        checks = (
            ("room", [r.id for r in self.rooms]),
            ("bed", [b.id for r in self.rooms for b in r.beds]),
            ("slot", [s for r in self.rooms for b in r.beds for s in b.slots]),
        )
        for what, ids in checks:
            dupes = _duplicates(ids)
            if dupes:
                raise ValueError(f"duplicate {what} ID: {', '.join(dupes)}")
        return self

    @model_validator(mode="after")
    def _check_houses(self) -> "Layout":
        dupes = _duplicates([h.id for h in self.houses])
        if dupes:
            raise ValueError(f"duplicate house ID: {', '.join(dupes)}")
        rooms = {r.id: r for r in self.rooms}
        owner: dict[str, str] = {}
        for house in self.houses:
            for room_id in house.rooms:
                if room_id not in rooms:
                    raise ValueError(f"house “{house.id}” has unknown room “{room_id}”")
                if room_id in owner:
                    raise ValueError(f"room “{room_id}” is in two houses: “{owner[room_id]}” and “{house.id}”")
                owner[room_id] = house.id
            left = min(rooms[r].rect[0] for r in house.rooms)
            right = max(rooms[r].rect[0] + rooms[r].rect[2] for r in house.rooms)
            if not left <= house.chimney <= right - CHIMNEY_WIDTH:
                raise ValueError(f"house “{house.id}”: the chimney at x {house.chimney} is outside the house ({left}–{right})")
        missing = [r.id for r in self.rooms if r.id not in owner]
        if missing:
            raise ValueError(f"room not in any house: {', '.join(missing)}")
        return self

    # The cached properties below assume the layout is read-only after loading.
    @cached_property
    def slot_ids(self) -> tuple[str, ...]:
        """All slots in the order of rooms, beds and slots in cabin.yaml."""
        return tuple(s for r in self.rooms for b in r.beds for s in b.slots)

    @cached_property
    def slot_order(self) -> dict[str, int]:
        return {slot: i for i, slot in enumerate(self.slot_ids)}

    @cached_property
    def tight_slots(self) -> frozenset[str]:
        return frozenset(s for r in self.rooms for b in r.beds for s in b.tight)


# --- config/app.yaml ---------------------------------------------------------

PositiveInt = Annotated[int, Field(strict=True, ge=1)]


class Limits(_Model):
    writes_per_client_minute: PositiveInt
    ai_per_client_minute: PositiveInt
    ai_per_day: PositiveInt


class AppConfig(_Model):
    limits: Limits
    model: Annotated[str, StringConstraints(strict=True, min_length=1)]
    backups_keep: PositiveInt


# --- parties and state (data/cabin-data.yaml) ------------------------------------

_Text = StringConstraints(strict=True, strip_whitespace=True)


class PartyInput(_Model):
    """Party fields entered by the user (used for both create and update)."""

    name: Annotated[
        str, _Text, Field(min_length=1, max_length=60), AfterValidator(_normalize_nfc), AfterValidator(_reject_control_chars)
    ]
    adults: Count
    kids: Count
    kids_in_parents_bed: Count
    arrive: IsoDate
    leave: IsoDate
    arrival_time: Annotated[
        str, _Text, Field(max_length=60), AfterValidator(_normalize_nfc), AfterValidator(_reject_control_chars)
    ] = ""
    # A note may be multi-line, so tab and line breaks are allowed in it.
    note: Annotated[
        str, _Text, Field(max_length=300), AfterValidator(_normalize_nfc), AfterValidator(_reject_control_chars_keep_newlines)
    ] = ""

    @field_validator("kids_in_parents_bed")
    @classmethod
    def _check_kids(cls, value: int, info: ValidationInfo) -> int:
        # A field-level check, so the error names `kids_in_parents_bed` (the page shows it next to that field).
        # `kids` is validated before this field; when it failed, there is nothing to compare with.
        kids = info.data.get("kids")
        if kids is not None and value > kids:
            raise ValueError("kids sleeping in the parents' bed cannot exceed the number of kids")
        return value


class PartyCreate(PartyInput):
    pass


class PartyUpdate(PartyInput):
    pass


class Party(PartyInput):
    id: PartyId
    color: HexColor
    created_at: IsoDateTime
    updated_at: IsoDateTime


class State(_Model):
    version: Annotated[int, Field(strict=True, ge=0)]
    updated_at: IsoDateTime
    signup_open: bool = True
    parties: list[Party] = []
    sleeping: dict[str, dict[str, PartyId]] = {}  # night → slot → party id


# --- action requests --------------------------------------------------------


def _check_unique(items: list[str]) -> list[str]:
    dupes = _duplicates(items)
    if dupes:
        raise ValueError(f"listed more than once: {', '.join(dupes)}")
    return items


SlotList = Annotated[
    list[SlotRef], Field(min_length=1, max_length=MAX_SLOTS_PER_REQUEST), AfterValidator(_check_unique)
]
NightList = Annotated[
    list[NightRef], Field(min_length=1, max_length=MAX_NIGHTS_PER_REQUEST), AfterValidator(_check_unique)
]


class AssignRequest(_Model):
    night: NightRef
    slots: SlotList
    party_id: PartyRef


class AssignStayRequest(_Model):
    slots: SlotList
    party_id: PartyRef


class ClearRequest(_Model):
    night: NightRef
    slot: SlotRef


class MoveRequest(_Model):
    party_id: PartyRef
    from_slot: SlotRef
    to_slot: SlotRef
    nights: NightList


class SignupRequest(_Model):
    open: bool = Field(strict=True)


# --- loading configuration --------------------------------------------------


class ConfigError(Exception):
    """Invalid config file. The message says exactly what is wrong."""


def _format_loc(loc: tuple[Any, ...]) -> str:
    out = ""
    for part in loc:
        if isinstance(part, int):
            out += f"[{part}]"
        else:
            out += f".{part}" if out else str(part)
    return out or "(whole file)"


def format_validation_error(exc: ValidationError, source: str) -> str:
    lines = [f"{source}: invalid file"]
    for err in exc.errors():
        msg = err["msg"].removeprefix("Value error, ")
        line = f"  {_format_loc(err['loc'])}: {msg}"
        value = err.get("input")
        if err["type"] != "missing" and isinstance(value, str | int | float | bool):
            line += f" (got: {value!r})"
        lines.append(line)
    return "\n".join(lines)


def _read_yaml(path: Path) -> Any:
    try:
        with open(path, encoding="utf-8") as fh:
            return yaml.safe_load(fh)
    except OSError as exc:
        raise ConfigError(f"{path}: cannot read file ({exc})") from exc
    except yaml.YAMLError as exc:
        raise ConfigError(f"{path}: invalid YAML ({exc})") from exc


def parse_layout(data: Any, source: str = "cabin.yaml") -> Layout:
    try:
        return Layout.model_validate(data)
    except ValidationError as exc:
        raise ConfigError(format_validation_error(exc, source)) from exc


def load_layout(path: str | Path) -> Layout:
    path = Path(path)
    return parse_layout(_read_yaml(path), str(path))


def load_app_config(path: str | Path) -> AppConfig:
    path = Path(path)
    try:
        return AppConfig.model_validate(_read_yaml(path))
    except ValidationError as exc:
        raise ConfigError(format_validation_error(exc, str(path))) from exc
