"""Move the stored parties to a new event date after the dates in config/cabin.yaml changed.

Run it only while the service is stopped, after `config/cabin.yaml` already has the new dates:

    uv run python scripts/shift_event.py --days 7 --data-dir data --dry-run
    uv run python scripts/shift_event.py --days 7 --data-dir data

Every party keeps its name, people, colour, phone and "Pred cestou" progress. Its `arrive`, `leave`,
`day_visits` and `places` nights move by `--days`. All beds are freed (`sleeping` is emptied), so
everyone picks a bed again. The result is checked like at startup against the new cabin.yaml before
anything is written. The old file is copied to `data/backups/` first, then the file is replaced
atomically with `version` bumped and one audit entry appended.
"""

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

import yaml
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.models import State, format_validation_error, load_layout  # noqa: E402
from app.store import AUDIT_FILE, BACKUP_DIR, DATA_FILE, _atomic_write, _data_problems, _dump, now_iso  # noqa: E402


def shift(day: str | None, days: int) -> str | None:
    return None if day is None else (date.fromisoformat(day) + timedelta(days=days)).isoformat()


def shifted(data: dict, days: int) -> dict:
    """A copy of the raw data file with the party dates moved and all beds freed."""
    out = dict(data)
    out["parties"] = []
    for party in data.get("parties") or []:
        party = dict(party)
        party["arrive"] = shift(party.get("arrive"), days)
        party["leave"] = shift(party.get("leave"), days)
        party["day_visits"] = [shift(d, days) for d in party.get("day_visits") or []]
        party["places"] = {shift(n, days): count for n, count in (party.get("places") or {}).items()}
        out["parties"].append(party)
    out["sleeping"] = {}
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--days", type=int, required=True, help="how many days to move the party dates")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--cabin", default="config/cabin.yaml", help="cabin.yaml with the new dates")
    parser.add_argument("--dry-run", action="store_true", help="show what would change, write nothing")
    args = parser.parse_args()

    layout = load_layout(args.cabin)
    data_dir = Path(args.data_dir)
    path = data_dir / DATA_FILE
    old = yaml.safe_load(path.read_text(encoding="utf-8"))
    new = shifted(old, args.days)
    new["version"] = old["version"] + 1
    new["updated_at"] = now_iso()
    try:
        state = State.model_validate(new)
    except ValidationError as exc:
        print(format_validation_error(exc, "new state"), file=sys.stderr)
        return 1
    problems = _data_problems(state, layout)
    if problems:
        print("new state does not match cabin.yaml:\n  " + "\n  ".join(problems), file=sys.stderr)
        return 1

    freed = sum(len(by_slot) for by_slot in (old.get("sleeping") or {}).values())
    for before, after in zip(old.get("parties") or [], new["parties"]):
        stay = (
            f"{before['arrive']}..{before['leave']} -> {after['arrive']}..{after['leave']}"
            if before.get("arrive")
            else f"day visits {before.get('day_visits')} -> {after['day_visits']}"
        )
        print(f"{before['id']} {before['name']}: {stay}")
    print(f"{len(new['parties'])} parties moved by {args.days} days, {freed} beds freed, version {new['version']}")
    if args.dry_run:
        print("dry run: nothing written")
        return 0

    stamp = now_iso().replace(":", "").replace("-", "")
    backup = data_dir / BACKUP_DIR / f"cabin-data-{stamp}-v{old['version']:06d}-before-shift.yaml"
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_bytes(path.read_bytes())
    _atomic_write(path, state.model_dump())
    entry = {
        "time": new["updated_at"],
        "version": new["version"],
        "action": "shift_event",
        "source": "admin",
        "client_id": None,
        "party": None,
        "nights": list(layout.event.nights),
        "slots": [],
        "before": None,
        "after": None,
        "days": args.days,
        "freed_beds": freed,
    }
    with open(data_dir / AUDIT_FILE, "ab") as fh:
        fh.write(("\n---\n" + _dump(entry)).encode("utf-8"))
    print(f"written {path} (backup {backup})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
