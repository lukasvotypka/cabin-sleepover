import asyncio
import re
from datetime import datetime

import pytest
import yaml

from app import store as store_module
from app.models import State
from app.store import AUDIT_FILE, BACKUP_DIR, DATA_FILE, Store, StartupError, now_iso
from app.validate import RuleError, check_assign
from tests.conftest import FRI, THU

SLOT1, SLOT2 = "left-double-1", "left-double-2"


@pytest.fixture
def data_dir(tmp_path):
    return tmp_path / "data"


@pytest.fixture
def store(layout, data_dir):
    return Store(layout, data_dir=data_dir)


def party_dict(make_party, **kw):
    return make_party(**kw).model_dump()


def write_data(data_dir, content):
    """Put a hand-made data file in place (a data directory with only this file)."""
    data_dir.mkdir(parents=True, exist_ok=True)
    text = content if isinstance(content, str) else yaml.safe_dump(content, allow_unicode=True, sort_keys=False)
    (data_dir / DATA_FILE).write_text(text, encoding="utf-8")


def good_data(make_party, parties=(), sleeping=None):
    return {
        "version": 3,
        "updated_at": "2026-10-25T19:02:11+02:00",
        "signup_open": True,
        "parties": [p.model_dump() for p in parties],
        "sleeping": sleeping or {},
    }


def audit_docs(data_dir):
    with open(data_dir / AUDIT_FILE, encoding="utf-8") as fh:
        return list(yaml.safe_load_all(fh))


def backups(data_dir):
    return sorted((data_dir / BACKUP_DIR).iterdir())


async def add_party(store, make_party, **kw):
    party = make_party(**kw)
    async with store.write(action="party-create", source="form", client_id="c1") as tx:
        tx.state.parties.append(party)
        tx.audit(party=party.id, before=None, after=party.model_dump())
    return party


# --- creating the files ------------------------------------------------------


def test_creates_directories_and_fresh_state(store, data_dir):
    assert data_dir.is_dir() and (data_dir / BACKUP_DIR).is_dir()
    state = store.read()
    assert (state.version, state.signup_open, state.parties, state.sleeping) == (0, True, [], {})
    assert datetime.fromisoformat(state.updated_at).utcoffset() is not None
    assert (data_dir / DATA_FILE).exists()


def test_default_data_dir_is_data(layout, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    Store(layout)
    assert (tmp_path / "data" / DATA_FILE).exists() and (tmp_path / "data" / BACKUP_DIR).is_dir()


@pytest.mark.parametrize("content", ["", "\n  \n"])
def test_empty_file_is_replaced_by_fresh_state(layout, data_dir, content):
    write_data(data_dir, content)
    assert Store(layout, data_dir=data_dir).read().version == 0


def test_existing_file_is_kept(layout, data_dir, make_party):
    ivan = make_party(name="Ivan a Eva", id="p-ivan01")
    write_data(data_dir, good_data(make_party, [ivan], {THU: {SLOT1: ivan.id}}))
    state = Store(layout, data_dir=data_dir).read()
    assert state.version == 3 and state.sleeping == {THU: {SLOT1: ivan.id}}


def test_now_iso_carries_local_offset():
    stamp = now_iso()
    assert re.search(r"[+-]\d\d:\d\d$", stamp) and datetime.fromisoformat(stamp).utcoffset() is not None


def test_backups_keep_must_be_positive(layout, data_dir):
    with pytest.raises(ValueError):
        Store(layout, data_dir=data_dir, backups_keep=0)


# --- startup check -----------------------------------------------------------


def start_error(layout, data_dir) -> str:
    with pytest.raises(StartupError) as exc:
        Store(layout, data_dir=data_dir)
    return str(exc.value)


def test_startup_yaml_syntax_error_names_file_and_line(layout, data_dir):
    write_data(data_dir, "version: 1\nparties: [unclosed\nsleeping: {}\n")
    msg = start_error(layout, data_dir)
    assert str(data_dir / DATA_FILE) in msg and "invalid YAML" in msg and re.search(r"line \d+", msg)


def test_startup_comment_only_file(layout, data_dir):
    write_data(data_dir, "# nothing here\n")
    msg = start_error(layout, data_dir)
    assert str(data_dir / DATA_FILE) in msg and "no content" in msg


def test_startup_pydantic_error_names_field_path(layout, data_dir, make_party):
    data = good_data(make_party, [make_party(id="p-ivan01")])
    data["parties"][0]["adults"] = "two"
    write_data(data_dir, data)
    msg = start_error(layout, data_dir)
    assert str(data_dir / DATA_FILE) in msg and "parties[0].adults" in msg


def test_startup_unquoted_date_is_an_error(layout, data_dir):
    write_data(data_dir, "version: 1\nupdated_at: 2026-10-25T19:02:11+02:00\nparties: []\nsleeping: {}\n")
    assert "updated_at" in start_error(layout, data_dir)


def test_startup_non_mapping_file(layout, data_dir):
    write_data(data_dir, "- just\n- a list\n")
    assert str(data_dir / DATA_FILE) in start_error(layout, data_dir)


def test_startup_unknown_slot(layout, data_dir, make_party):
    ivan = make_party(id="p-ivan01")
    write_data(data_dir, good_data(make_party, [ivan], {THU: {"no-such-slot": ivan.id}}))
    msg = start_error(layout, data_dir)
    assert f"sleeping.{THU}.no-such-slot" in msg and "unknown slot" in msg and str(data_dir / DATA_FILE) in msg


def test_startup_unknown_party(layout, data_dir, make_party):
    write_data(data_dir, good_data(make_party, [], {THU: {SLOT1: "p-ghost1"}}))
    msg = start_error(layout, data_dir)
    assert f"sleeping.{THU}.{SLOT1}" in msg and "unknown party ID" in msg and "p-ghost1" in msg


def test_startup_night_not_in_event(layout, data_dir, make_party):
    ivan = make_party(id="p-ivan01")
    write_data(data_dir, good_data(make_party, [ivan], {"2026-11-05": {SLOT1: ivan.id}}))
    msg = start_error(layout, data_dir)
    assert "sleeping.2026-11-05" in msg and "not in event.nights" in msg


def test_startup_duplicate_party_id(layout, data_dir, make_party):
    a = make_party(id="p-same01", name="Ivan")
    b = make_party(id="p-same01", name="Eva")
    write_data(data_dir, good_data(make_party, [a, b]))
    msg = start_error(layout, data_dir)
    assert "parties[1].id" in msg and "duplicate party ID" in msg and "p-same01" in msg


def test_startup_duplicate_party_name_ignoring_case(layout, data_dir, make_party):
    a = make_party(id="p-aaaaaa", name="Vilčo a Eva")
    b = make_party(id="p-bbbbbb", name="VILČO A EVA")
    write_data(data_dir, good_data(make_party, [a, b]))
    msg = start_error(layout, data_dir)
    assert "parties[1].name" in msg and "duplicate party name" in msg and "p-aaaaaa" in msg


def test_startup_reports_all_problems_at_once(layout, data_dir, make_party):
    write_data(data_dir, good_data(make_party, [], {THU: {SLOT1: "p-ghost1", "nope": "p-ghost2"}}))
    msg = start_error(layout, data_dir)
    assert msg.count("unknown party ID") == 2 and "unknown slot" in msg


def test_startup_error_leaves_file_untouched(layout, data_dir):
    write_data(data_dir, "version: [broken\n")
    before = (data_dir / DATA_FILE).read_text()
    start_error(layout, data_dir)
    assert (data_dir / DATA_FILE).read_text() == before and not list((data_dir / BACKUP_DIR).iterdir())


# --- write transaction -------------------------------------------------------


async def test_write_bumps_version_and_persists(store, data_dir, make_party):
    ivan = await add_party(store, make_party, name="Ivan a Eva", id="p-ivan01")
    async with store.write(action="assign", source="map", client_id="c1") as tx:
        tx.state.sleeping.setdefault(THU, {})[SLOT1] = ivan.id
    assert tx.state.version == 2
    state = store.read()
    assert state.version == 2 and state.sleeping == {THU: {SLOT1: ivan.id}}
    assert state.updated_at == tx.state.updated_at and state.parties[0].name == "Ivan a Eva"


async def test_write_order_load_change_backup_write_audit(store, data_dir, make_party, monkeypatch):
    calls = []
    real_backup, real_replace = store._backup, store_module.os.replace
    monkeypatch.setattr(store, "_backup", lambda v: (calls.append("backup"), real_backup(v)))
    monkeypatch.setattr(store_module.os, "replace", lambda *a: (calls.append("replace"), real_replace(*a)))
    await add_party(store, make_party)
    assert calls == ["backup", "replace"] and len(audit_docs(data_dir)) == 1


async def test_write_sees_the_current_file_not_a_cache(store, data_dir, make_party):
    await add_party(store, make_party, name="Ivan", id="p-ivan01")
    other = Store(store.layout, data_dir=data_dir)  # a second instance on the same files
    async with other.write(action="signup", source="admin", client_id=None) as tx:
        tx.state.signup_open = False
    async with store.write(action="signup", source="admin", client_id=None) as tx:
        assert tx.state.signup_open is False and tx.state.version == 2


async def test_rule_error_writes_nothing(store, data_dir, make_party):
    ivan = await add_party(store, make_party, name="Ivan", id="p-ivan01")
    raw_before = (data_dir / DATA_FILE).read_bytes()
    backups_before, audit_before = backups(data_dir), audit_docs(data_dir)
    with pytest.raises(RuleError) as exc:
        async with store.write(action="assign", source="map", client_id="c1") as tx:
            check_assign(tx.state, store.layout, "2026-12-24", [SLOT1], ivan.id)  # night outside the event
    assert exc.value.code == "invalid"
    assert (data_dir / DATA_FILE).read_bytes() == raw_before
    assert backups(data_dir) == backups_before and audit_docs(data_dir) == audit_before
    assert store.read().version == 1


async def test_exception_after_changing_state_discards_the_change(store, make_party):
    ivan = await add_party(store, make_party, name="Ivan", id="p-ivan01")
    with pytest.raises(RuntimeError):
        async with store.write(action="assign", source="map", client_id=None) as tx:
            tx.state.sleeping.setdefault(THU, {})[SLOT1] = ivan.id
            raise RuntimeError("boom")
    assert store.read().sleeping == {}


async def test_lock_is_released_after_error(store):
    with pytest.raises(RuntimeError):
        async with store.write(action="x", source="map", client_id=None):
            raise RuntimeError("boom")
    async with asyncio.timeout(2):
        async with store.write(action="x", source="map", client_id=None):
            pass


async def test_unknown_source_is_rejected(store):
    with pytest.raises(ValueError):
        async with store.write(action="x", source="somewhere", client_id=None):
            pass


async def test_writes_are_serialized_by_the_lock(store, make_party):
    active, peak = 0, 0

    async def one(i):
        nonlocal active, peak
        async with store.write(action="signup", source="admin", client_id=str(i)) as tx:
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0.005)
            tx.state.signup_open = not tx.state.signup_open
            active -= 1

    await asyncio.gather(*(one(i) for i in range(10)))
    assert peak == 1 and store.read().version == 10
    assert store.read().signup_open is True  # ten toggles: none was lost


async def test_caller_bug_cannot_corrupt_the_file(store, data_dir, make_party):
    raw_before = (data_dir / DATA_FILE).read_bytes()
    with pytest.raises(RuntimeError, match="unknown slot"):
        async with store.write(action="assign", source="map", client_id=None) as tx:
            tx.state.sleeping.setdefault(THU, {})["no-such-slot"] = "p-ghost1"
    assert (data_dir / DATA_FILE).read_bytes() == raw_before and backups(data_dir) == []


# --- atomic write ------------------------------------------------------------


def no_temp_files(data_dir):
    return sorted(p.name for p in data_dir.iterdir() if p.name.endswith(".tmp"))


@pytest.mark.parametrize("failure", ["replace", "dump", "fsync"])
async def test_failed_write_keeps_original_and_leaves_no_temp_file(store, data_dir, make_party, monkeypatch, failure):
    await add_party(store, make_party, name="Ivan", id="p-ivan01")
    raw_before = (data_dir / DATA_FILE).read_bytes()
    audit_before = audit_docs(data_dir)

    def boom(*args, **kwargs):
        raise OSError("disk exploded")

    if failure == "replace":
        monkeypatch.setattr(store_module.os, "replace", boom)
    elif failure == "fsync":
        monkeypatch.setattr(store_module.os, "fsync", boom)
    else:
        real = store_module.yaml.safe_dump

        def dump_half(data, stream=None, **kwargs):  # writes a partial file, then fails
            if stream is not None:
                stream.write("version: 99\nparties: [\n")
                raise OSError("disk exploded")
            return real(data, stream, **kwargs)

        monkeypatch.setattr(store_module.yaml, "safe_dump", dump_half)

    with pytest.raises(OSError, match="disk exploded"):
        async with store.write(action="signup", source="admin", client_id=None) as tx:
            tx.state.signup_open = False
    monkeypatch.undo()

    assert (data_dir / DATA_FILE).read_bytes() == raw_before
    assert no_temp_files(data_dir) == []
    assert audit_docs(data_dir) == audit_before
    assert store.read().version == 1  # still usable
    async with store.write(action="signup", source="admin", client_id=None):
        pass
    assert store.read().version == 2


async def test_atomic_write_uses_flush_fsync_replace_in_order(store, data_dir, monkeypatch):
    calls = []
    real_fsync, real_replace = store_module.os.fsync, store_module.os.replace
    monkeypatch.setattr(store_module.os, "fsync", lambda fd: (calls.append("fsync"), real_fsync(fd)))
    monkeypatch.setattr(store_module.os, "replace", lambda a, b: (calls.append(("replace", a.parent, b.parent)), real_replace(a, b)))
    async with store.write(action="signup", source="admin", client_id=None):
        pass
    replaces = [c for c in calls if isinstance(c, tuple)]
    assert len(replaces) == 1 and replaces[0][1] == replaces[0][2] == data_dir  # temp file in the same directory
    assert "fsync" in calls[: calls.index(replaces[0])]  # synced before the rename
    assert no_temp_files(data_dir) == []


# --- backups ----------------------------------------------------------------


async def test_backup_holds_the_state_before_the_write(store, data_dir, make_party):
    await add_party(store, make_party, name="Ivan", id="p-ivan01")
    assert len(backups(data_dir)) == 1
    first = yaml.safe_load(backups(data_dir)[0].read_text(encoding="utf-8"))
    assert first["version"] == 0 and first["parties"] == []
    async with store.write(action="signup", source="admin", client_id=None) as tx:
        tx.state.signup_open = False
    newest = yaml.safe_load(backups(data_dir)[-1].read_text(encoding="utf-8"))
    assert newest["version"] == 1 and len(newest["parties"]) == 1 and newest["signup_open"] is True


async def test_backups_pruned_to_backups_keep_and_newest_kept(layout, data_dir):
    store = Store(layout, data_dir=data_dir, backups_keep=5)
    for _ in range(12):  # many writes within one second
        async with store.write(action="signup", source="admin", client_id=None):
            pass
    files = backups(data_dir)
    assert len(files) == 5
    versions = [yaml.safe_load(f.read_text(encoding="utf-8"))["version"] for f in files]
    assert versions == [7, 8, 9, 10, 11]  # the file before the 12th write (version 11) is the newest


async def test_default_backups_keep_is_fifty(layout, data_dir):
    store = Store(layout, data_dir=data_dir)
    for _ in range(53):
        async with store.write(action="signup", source="admin", client_id=None):
            pass
    assert len(backups(data_dir)) == 50
    assert yaml.safe_load(backups(data_dir)[-1].read_text())["version"] == 52


async def test_backup_names_unique_within_a_second(store, data_dir, monkeypatch):
    class FrozenNow(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 10, 29, 12, 0, 0, 0, tzinfo=tz)

    monkeypatch.setattr(store_module, "datetime", FrozenNow)
    for _ in range(3):
        async with store.write(action="signup", source="admin", client_id=None):
            pass
    assert len(backups(data_dir)) == 3  # same instant, still three files


# --- audit -------------------------------------------------------------------


async def test_audit_is_one_document_per_write(store, data_dir, make_party):
    ivan = await add_party(store, make_party, name="Ivan a Eva", id="p-ivan01")
    async with store.write(action="assign", source="map", client_id="client-xyz") as tx:
        tx.state.sleeping.setdefault(THU, {})[SLOT1] = ivan.id
        tx.state.sleeping[THU][SLOT2] = ivan.id
        tx.audit(party=ivan.id, nights=[THU], slots=[SLOT1, SLOT2], before=None, after=ivan.id)
    raw = (data_dir / AUDIT_FILE).read_text(encoding="utf-8")
    assert raw.count("---\n") == 2
    first, second = audit_docs(data_dir)
    assert first["action"] == "party-create" and first["source"] == "form" and first["client_id"] == "c1"
    assert first["after"]["name"] == "Ivan a Eva" and first["before"] is None
    assert second["action"] == "assign" and second["source"] == "map" and second["client_id"] == "client-xyz"
    assert second["party"] == "p-ivan01" and second["nights"] == [THU] and second["slots"] == [SLOT1, SLOT2]
    assert second["before"] is None and second["after"] == "p-ivan01"
    assert second["version"] == 2 and second["time"] == store.read().updated_at
    assert datetime.fromisoformat(second["time"]).utcoffset() is not None


async def test_audit_multi_night_action_is_one_document_with_changes(store, data_dir, make_party):
    ivan = await add_party(store, make_party, name="Ivan", id="p-ivan01")
    async with store.write(action="move", source="map", client_id="c1") as tx:
        tx.state.sleeping = {THU: {SLOT2: ivan.id}, FRI: {SLOT2: ivan.id}}
        changes = [{"night": n, "slot": SLOT2, "before": None, "after": ivan.id} for n in (THU, FRI)]
        tx.audit(party=ivan.id, nights=[THU, FRI], slots=[SLOT1, SLOT2], changes=changes)
    docs = audit_docs(data_dir)
    assert len(docs) == 2 and docs[1]["changes"] == changes


async def test_audit_without_details_still_records_the_write(store, data_dir):
    async with store.write(action="signup", source="admin", client_id=None) as tx:
        tx.state.signup_open = False
    (doc,) = audit_docs(data_dir)
    assert doc["action"] == "signup" and doc["client_id"] is None and doc["nights"] == [] and doc["party"] is None


async def test_audit_keeps_slovak_text_readable(store, data_dir, make_party):
    await add_party(store, make_party, name="Vilčo", id="p-vilco1", note="príď o šiestej")
    raw = (data_dir / AUDIT_FILE).read_text(encoding="utf-8")
    assert "Vilčo" in raw and "príď o šiestej" in raw and "\\u" not in raw


async def test_audit_unserializable_detail_fails_before_any_write(store, data_dir):
    raw_before = (data_dir / DATA_FILE).read_bytes()
    with pytest.raises(yaml.YAMLError):
        async with store.write(action="x", source="map", client_id=None) as tx:
            tx.audit(before=object())
    assert (data_dir / DATA_FILE).read_bytes() == raw_before and backups(data_dir) == []


async def test_failing_audit_append_does_not_fail_a_committed_write(store, data_dir, monkeypatch, caplog):
    real_open = open

    def fake_open(path, mode="r", *args, **kwargs):
        if str(path).endswith(AUDIT_FILE):
            raise OSError("no space")
        return real_open(path, mode, *args, **kwargs)

    monkeypatch.setattr("builtins.open", fake_open)
    async with store.write(action="signup", source="admin", client_id=None) as tx:
        tx.state.signup_open = False
    monkeypatch.undo()
    assert store.read().signup_open is False and "could not append" in caplog.text


async def test_skip_ends_the_transaction_without_writing(store, data_dir):
    raw_before = (data_dir / DATA_FILE).read_bytes()
    audit_before = audit_docs(data_dir) if (data_dir / AUDIT_FILE).exists() else []
    async with store.write(action="clear", source="map", client_id="c1") as tx:
        tx.state.signup_open = False  # would be a change, but the write is skipped
        tx.skip()
    assert (data_dir / DATA_FILE).read_bytes() == raw_before
    assert backups(data_dir) == []
    assert (audit_docs(data_dir) if (data_dir / AUDIT_FILE).exists() else []) == audit_before
    assert store.read().version == 0
    async with store.write(action="signup", source="admin", client_id=None) as tx:  # the lock was released
        tx.state.signup_open = False
    assert store.read().version == 1


async def test_audit_entry_starts_with_its_own_separator(store, data_dir):
    async with store.write(action="signup", source="admin", client_id=None) as tx:
        tx.state.signup_open = False
    async with store.write(action="signup", source="admin", client_id=None) as tx:
        tx.state.signup_open = True
    assert (data_dir / AUDIT_FILE).read_text(encoding="utf-8").count("\n---\n") == 2


async def test_truncated_audit_entry_does_not_hide_the_next_ones(store, data_dir):
    async with store.write(action="signup", source="admin", client_id=None) as tx:
        tx.state.signup_open = False
    with open(data_dir / AUDIT_FILE, "a", encoding="utf-8") as fh:
        fh.write("time: '2026-10-2")  # a crash cut the entry short, with no newline
    async with store.write(action="signup", source="admin", client_id=None) as tx:
        tx.state.signup_open = True
    text = (data_dir / AUDIT_FILE).read_text(encoding="utf-8")
    docs = text.split("\n---\n")
    assert yaml.safe_load(docs[-1])["version"] == 2  # the last entry is readable on its own


async def test_failing_audit_append_logs_the_full_entry(store, data_dir, monkeypatch, caplog):
    real_open = open

    def fake_open(path, *args, **kwargs):
        if str(path).endswith(AUDIT_FILE):
            raise OSError("no space")
        return real_open(path, *args, **kwargs)

    monkeypatch.setattr("builtins.open", fake_open)
    async with store.write(action="signup", source="admin", client_id="c9") as tx:
        tx.state.signup_open = False
    monkeypatch.undo()
    assert "action: signup" in caplog.text and "client_id: c9" in caplog.text and "version: 1" in caplog.text


# --- YAML round trip ----------------------------------------------------------


async def test_data_file_is_readable_yaml_with_strings(store, data_dir, make_party):
    ivan = await add_party(
        store, make_party, name="Vilčo a Žofia", id="p-vilco1", arrival_time="18:00", note="Ďakujeme!\nDruhý riadok"
    )
    async with store.write(action="assign", source="map", client_id=None) as tx:
        tx.state.sleeping.setdefault(THU, {})[SLOT1] = ivan.id
    raw = (data_dir / DATA_FILE).read_text(encoding="utf-8")
    assert "Vilčo a Žofia" in raw and "Ďakujeme" in raw and "\\u" not in raw and "\\x" not in raw
    loaded = yaml.safe_load(raw)  # plain load: nothing may turn into date, time or int objects
    assert loaded["updated_at"] == store.read().updated_at and isinstance(loaded["updated_at"], str)
    party = loaded["parties"][0]
    assert all(isinstance(party[k], str) for k in ("arrive", "leave", "arrival_time", "created_at", "updated_at"))
    assert party["arrival_time"] == "18:00" and party["note"] == "Ďakujeme!\nDruhý riadok"
    assert list(loaded["sleeping"]) == [THU] and isinstance(next(iter(loaded["sleeping"])), str)
    assert list(loaded) == ["version", "updated_at", "signup_open", "parties", "sleeping"]  # key order kept


async def test_new_store_on_same_directory_sees_the_same_data(layout, data_dir, make_party):
    first = Store(layout, data_dir=data_dir)
    ivan = await add_party(first, make_party, name="Ivan", id="p-ivan01")
    async with first.write(action="assign", source="map", client_id=None) as tx:
        tx.state.sleeping.setdefault(THU, {})[SLOT1] = ivan.id
    restarted = Store(layout, data_dir=data_dir)  # a restart
    assert restarted.read() == first.read() == State.model_validate(yaml.safe_load((data_dir / DATA_FILE).read_text("utf-8")))
    assert restarted.read().version == 2
