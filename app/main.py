"""FastAPI app: startup, the page, group/admin cookies, rate limits and `GET /api/state`.

`create_app()` does all startup work eagerly (secrets, both config files, the data file check),
so a mistake stops the process with a clear message, and tests cover it without lifespan events.
uvicorn finds the module-level `app`, which is built on first access (see `__getattr__`).

Every response uses the envelope from "HTTP API" in proposal.md:

    {"ok": true, "state": {...}}
    {"ok": false, "error": {"code", "message", "params"}, "state": {...}}

The server sends no Slovak text: the page maps `code` and `params` to its own texts.
The write endpoints are built on `require_group`, `require_admin`, `enforce_write_limit`,
`ok_response` and `RuleError`/`ApiError` defined here.
"""

import asyncio
import hashlib
import json
import logging
import os
import secrets
import time
import tomllib
from collections.abc import AsyncIterator, Callable, Mapping
from contextlib import aclosing, asynccontextmanager, suppress
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from itsdangerous import BadSignature, URLSafeSerializer
from starlette.background import BackgroundTask
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.events import PING_SECONDS, EventHub, HubRefused
from app.models import (
    PARTY_PALETTE,
    AppConfig,
    AssignRequest,
    AssignStayRequest,
    ClearRequest,
    ConfigError,
    Layout,
    MoveRequest,
    BriefingRequest,
    FoodRequest,
    LoginStartRequest,
    LoginVerifyRequest,
    LogoutRequest,
    PlacesRequest,
    PartyId,
    Party,
    PartyCreate,
    PartyUpdate,
    State,
    load_app_config,
    load_info,
    load_layout,
)
from app.ratelimit import CODE_ATTEMPTS_PER_MINUTE, SlidingWindowLimiter, SmsLimits
from app.sms import DEFAULT_FAKE_CODE, FakeSmsClient, SmsClient, TwilioVerifyClient
from app.seen import STREAM_GRACE, SeenTracker
from app.store import Store, now_iso
from app.validate import (
    ERROR_STATUS,
    RuleError,
    check_assign,
    check_assign_stay,
    check_clear,
    check_move,
    check_party_access,
    check_party_create,
    check_party_update,
    add_briefing_step,
    check_briefing,
    check_food,
    check_places,
    check_signup_open,
    adjust_places,
    find_party,
    is_verified,
    normalize_phone,
    raise_places_to_placed,
    phone_hint,
    set_food_note,
    set_places,
)

log = logging.getLogger("chrapa.app")

ROOT = Path(__file__).resolve().parent.parent
GROUP_COOKIE = "cabin_group"
ADMIN_COOKIE = "cabin_admin"
PARTY_COOKIE = "party_auth"
PARTY_COOKIE_MAX_AGE = 30 * 24 * 3600
COOKIE_MAX_AGE = {"group": 30 * 24 * 3600, "admin": 12 * 3600}  # seconds
COOKIE_CLOCK_SKEW = 60  # tolerated seconds of a cookie "from the future" (clock set back)
CLIENT_ID_MAX_LEN = 64
MIN_SECRET_KEY_LEN = 32
PARTY_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
LOG_FORMAT = "%(levelname)s %(name)s: %(message)s"


# --- settings and cookies ----------------------------------------------------


@dataclass(frozen=True)
class Settings:
    group_code: str = field(repr=False)
    admin_code: str = field(repr=False)
    secret_key: str = field(repr=False)
    twilio: tuple[str, str, str] | None = field(default=None, repr=False)  # account SID, auth token, Verify service SID; None = not configured
    sms_fake: bool = False  # SMS_FAKE=1: log the code instead of sending it (trial server and development)
    sms_fake_code: str = DEFAULT_FAKE_CODE


def info_enabled_override(env: Mapping[str, str]) -> bool | None:
    """`INFO_ENABLED` from the environment: None when unset or empty (the file decides), else true/false."""
    raw = env.get("INFO_ENABLED", "").strip().lower()
    if not raw:
        return None
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    raise ConfigError(f"INFO_ENABLED must be true or false, got {raw!r}")


def load_settings(env: Mapping[str, str]) -> Settings:
    """Read the secrets from the environment. Names every problem at once."""
    values = {name: env.get(name, "").strip() for name in ("GROUP_CODE", "ADMIN_CODE", "SECRET_KEY")}
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise ConfigError(
            f"missing environment variable(s): {', '.join(missing)} "
            "(set them in the environment: in Docker via compose `environment:`, locally via `uvicorn --env-file .env`; "
            "see .env.example)"
        )
    if len(values["SECRET_KEY"]) < MIN_SECRET_KEY_LEN:
        raise ConfigError(
            f"SECRET_KEY must be at least {MIN_SECRET_KEY_LEN} characters long "
            "(generate one with the command in .env.example)"
        )
    if secrets.compare_digest(values["GROUP_CODE"].encode(), values["ADMIN_CODE"].encode()):
        raise ConfigError("GROUP_CODE and ADMIN_CODE must differ")
    twilio_names = ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID")
    twilio_values = [env.get(name, "").strip() for name in twilio_names]
    twilio = tuple(twilio_values) if all(twilio_values) else None
    if any(twilio_values) and twilio is None:
        absent = [n for n, v in zip(twilio_names, twilio_values) if not v]
        log.warning("Twilio is not configured, missing: %s", ", ".join(absent))
    return Settings(
        values["GROUP_CODE"],
        values["ADMIN_CODE"],
        values["SECRET_KEY"],
        twilio,
        env.get("SMS_FAKE", "").strip().lower() in ("1", "true", "yes", "on"),
        env.get("SMS_FAKE_CODE", "").strip() or DEFAULT_FAKE_CODE,
    )


def build_sms_client(settings: Settings) -> SmsClient | None:
    """Twilio when all three variables are set, else the fake client for `SMS_FAKE=1`, else None."""
    if settings.twilio:
        return TwilioVerifyClient(*settings.twilio)
    if settings.sms_fake:
        log.warning("SMS_FAKE is on: codes are written to the log and nothing is sent")
        return FakeSmsClient(settings.sms_fake_code)
    return None


class CookieSigner:
    """Signed cookie values (itsdangerous).

    The salt holds the role and a short hash of that role's code. A group cookie never passes as
    admin, and changing a code invalidates every cookie issued for the old one.
    """

    def __init__(self, secret_key: str, codes: Mapping[str, str], clock: Callable[[], float] = time.time):
        self._clock = clock
        self._serializers = {
            role: URLSafeSerializer(
                secret_key, salt=f"chrapa-poll/cookie/{role}/{hashlib.sha256(codes[role].encode()).hexdigest()[:16]}"
            )
            for role in COOKIE_MAX_AGE
        }

    def issue(self, role: str) -> str:
        return self._serializers[role].dumps({"issued": int(self._clock())})

    def is_valid(self, role: str, token: str | None) -> bool:
        """True for an untampered cookie of this role that is not older than its lifetime."""
        if not token:
            return False
        try:
            payload = self._serializers[role].loads(token)
        except BadSignature:
            return False
        issued = payload.get("issued") if isinstance(payload, dict) else None
        if not isinstance(issued, int) or isinstance(issued, bool):
            return False
        age = self._clock() - issued
        return -COOKIE_CLOCK_SKEW <= age <= COOKIE_MAX_AGE[role]


class PartyAuthSigner:
    """The `party_auth` cookie: `{party_id: verified_at}` for every party this device proved by SMS."""

    def __init__(self, secret_key: str, clock: Callable[[], float] = time.time):
        self._clock = clock
        self._serializer = URLSafeSerializer(secret_key, salt="chrapa-poll/party_auth")

    def now(self) -> float:
        return self._clock()

    def issue(self, verified: Mapping[str, float]) -> str:
        return self._serializer.dumps({"verified": dict(verified)})

    def load(self, token: str | None) -> dict[str, float]:
        """The valid entries of a cookie. Tampered, malformed or expired ones give nothing."""
        if not token:
            return {}
        try:
            payload = self._serializer.loads(token)
        except BadSignature:
            return {}
        entries = payload.get("verified") if isinstance(payload, dict) else None
        if not isinstance(entries, dict):
            return {}
        now = self._clock()
        result: dict[str, float] = {}
        for party_id, at in entries.items():
            if isinstance(at, (int, float)) and not isinstance(at, bool) and -COOKIE_CLOCK_SKEW <= now - at <= PARTY_COOKIE_MAX_AGE:
                result[party_id] = float(at)
        return result


@dataclass
class Runtime:
    """Everything a request needs. Lives in `app.state.runtime`."""

    settings: Settings
    layout: Layout
    app_config: AppConfig
    store: Store
    cookies: CookieSigner
    party_cookies: PartyAuthSigner
    join_limiter: SlidingWindowLimiter
    write_limiter: SlidingWindowLimiter
    sms_limits: SmsLimits
    sms: SmsClient | None  # None = SMS is off
    seen: SeenTracker
    layout_json: dict[str, Any]
    info_json: dict[str, Any] | None  # `config/info.yaml` as served, None when the file is missing
    config_hash: str  # digest of the served layout, computed once at startup
    hub: EventHub
    known_ids: set[str]  # party ids, refreshed on every commit (no file read per request)
    # Event loop state, touched on the loop only (the lifespan sets `loop`; without it nothing is scheduled).
    loop: asyncio.AbstractEventLoop | None = None
    connected: set[str] = field(default_factory=set)  # last set of parties with a stream, to see who changed
    last_online: set[str] = field(default_factory=set)  # online set of the last state or presence frame sent
    asset_version: Callable[[], str] = lambda: ""  # current page code hash (set to `PageRenderer.version`)

    @property
    def sms_enabled(self) -> bool:
        return self.sms is not None

    def refresh_presence(self) -> None:
        """Send a `presence` event when the online set differs from the last one sent. Event loop only."""
        presence = self.seen.presence(self.known_ids)
        online = set(presence["online"])
        if online != self.last_online:
            self.last_online = online
            self.hub.publish_presence(presence)

    def request_presence_check(self) -> None:
        """Like `refresh_presence`, callable from the thread pool (a polling party may have entered the window)."""
        if self.loop is not None:
            with suppress(RuntimeError):  # the loop is closed during shutdown
                self.loop.call_soon_threadsafe(self.refresh_presence)


def get_runtime(request: Request) -> Runtime:
    return request.app.state.runtime


# --- envelope -------------------------------------------------------------------


class ApiError(RuleError):
    """A `RuleError` raised by the HTTP layer itself. `with_state=False` leaves `state` out of the body."""

    def __init__(
        self,
        code: str,
        message: str,
        params: dict[str, Any] | None = None,
        *,
        with_state: bool = True,
        headers: dict[str, str] | None = None,
    ):
        super().__init__(code, message, params)
        self.with_state = with_state
        self.headers = headers or {}


def public_party(party: Party) -> dict[str, Any]:
    """A party as the page sees it: never the number, only `phone_hint` when it is protected."""
    data = party.model_dump(mode="json", exclude={"phone", "phone_set_at"})
    hint = phone_hint(party)
    if hint is not None:
        data["phone_hint"] = hint
    return data


def state_payload(rt: Runtime, state: State) -> dict[str, Any]:
    """The `state` object of every response: the data file plus the layout from `cabin.yaml`."""
    return {
        "version": state.version,
        "updated_at": state.updated_at,
        "signup_open": state.signup_open,
        "event": rt.layout_json["event"],
        "layout": rt.layout_json,
        "info": rt.info_json,
        "parties": [public_party(p) for p in state.parties],
        "sleeping": state.sleeping,
        "briefing": state.briefing,
        "presence": rt.seen.presence({p.id for p in state.parties}),
        "asset_version": rt.asset_version(),
    }


def config_digest(layout_json: dict[str, Any], info_json: dict[str, Any] | None = None) -> str:
    canonical = json.dumps([layout_json, info_json], sort_keys=True, ensure_ascii=False)
    return hashlib.sha1(canonical.encode()).hexdigest()[:8]


def state_etag(
    state: State, config_hash: str, presence: dict[str, Any] | None = None, asset_version: str = ""
) -> str:
    """Changes on every write, when the served `cabin.yaml` changes (after a restart) and when presence changes.

    `updated_at` is mixed in, so a hand-restored older backup (lower `version`) differs too.
    `config_hash` covers `layout`, `event` and `info`, which come from `cabin.yaml` and `info.yaml`, not the data file.
    Presence (T-049) adds the `online` set and every party's `last_seen` floored to the minute: second
    precision would change the tag on every poll, while the page only shows minutes. The `online` set keeps
    "online" right within one poll, so the page can use the server's list as it is after a 304.
    `asset_version` (T-055) is the page code hash: after a code edit the old tag no longer matches, so the
    page gets the new `asset_version` in a 200 instead of a 304.
    """
    digest = hashlib.sha1(state.updated_at.encode()).hexdigest()[:8]
    tag = f"{state.version}-{digest}-{config_hash}"
    if asset_version:
        tag += f"-{asset_version}"
    if presence:
        minutes = sorted(
            (pid, int(datetime.fromisoformat(t).timestamp() // 60)) for pid, t in presence["last_seen"].items()
        )
        seen_digest = hashlib.sha1(json.dumps([sorted(presence["online"]), minutes]).encode()).hexdigest()[:8]
        tag += f"-{seen_digest}"
    return f'"{tag}"'


def ok_response(rt: Runtime, state: State, **extra: Any) -> JSONResponse:
    """`200 {"ok": true, "state": {...}, **extra}`, e.g. `ok_response(rt, state, freed=[...])`."""
    return JSONResponse({"ok": True, "state": state_payload(rt, state), **extra})


def error_body(code: str, message: str, params: dict[str, Any] | None = None, state: dict[str, Any] | None = None) -> dict:
    body: dict[str, Any] = {"ok": False, "error": {"code": code, "message": message, "params": params or {}}}
    if state is not None:
        body["state"] = state
    return body


def error_response(
    rt: Runtime,
    code: str,
    message: str,
    params: dict[str, Any] | None = None,
    *,
    with_state: bool = True,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    state = state_payload(rt, rt.store.read()) if with_state else None
    return JSONResponse(error_body(code, message, params, state), status_code=ERROR_STATUS[code], headers=headers)


# --- access dependencies -----------------------------------------------------------


@dataclass(frozen=True)
class Auth:
    is_admin: bool


def _auth_of(request: Request) -> Auth | None:
    """The caller's role from the cookies, or None without a valid group cookie."""
    rt = get_runtime(request)
    if not rt.cookies.is_valid("group", request.cookies.get(GROUP_COOKIE)):
        return None
    return Auth(is_admin=rt.cookies.is_valid("admin", request.cookies.get(ADMIN_COOKIE)))


def require_group(request: Request) -> Auth:
    auth = _auth_of(request)
    if auth is None:
        raise ApiError("bad_code", "Missing or invalid group cookie", with_state=False)
    rt = get_runtime(request)  # the caller proves to be in the group: note which party it says it is
    party_id = clean_id(request.headers.get("x-party-id"))
    if party_id in rt.known_ids:
        # With an open stream the stream is what keeps the party online; only a polling party uses the window.
        rt.seen.record(party_id, rt.known_ids, polled=party_id not in rt.connected)
        rt.request_presence_check()
    return auth


def verified_parties(request: Request, state: State) -> dict[str, float]:
    """Parties this device proved by SMS: in the cookie, still existing, protected and not older than the number."""
    rt = get_runtime(request)
    entries = rt.party_cookies.load(request.cookies.get(PARTY_COOKIE))
    by_id = {p.id: p for p in state.parties}
    return {pid: at for pid, at in entries.items() if pid in by_id and is_verified(by_id[pid], {pid: at})}


def guard_party(request: Request, state: State, party_id: str, auth: Auth) -> None:
    """Raise `unknown_party` or `login_required` unless the caller may change this party (call under the lock)."""
    check_party_access(find_party(state, party_id), verified_parties(request, state), auth.is_admin)


def require_admin(auth: Annotated[Auth, Depends(require_group)]) -> Auth:
    if not auth.is_admin:
        raise ApiError("forbidden", "Admin cookie required")
    return auth


def client_ip(request: Request) -> str:
    """Behind the proxy this is the real client only when uvicorn runs with --proxy-headers (see T-008)."""
    return request.client.host if request.client else "unknown"


def clean_id(value: str | None) -> str | None:
    """An id from a header or query parameter: trimmed and length-capped, or None when empty."""
    return (value or "").strip()[:CLIENT_ID_MAX_LEN] or None


def client_id_of(request: Request) -> str | None:
    """The page's `X-Client-Id` (trimmed, length-capped) or None. Used for audit and limits."""
    return clean_id(request.headers.get("x-client-id"))


def enforce_write_limit(request: Request, _auth: Annotated[Auth, Depends(require_group)]) -> None:
    """Per-client write limit, keyed by `X-Client-Id` and by IP when the header is missing."""
    rt = get_runtime(request)
    client_id = client_id_of(request) or ""
    key = f"id:{client_id}" if client_id else f"ip:{client_ip(request)}"
    if not rt.write_limiter.allow(key):
        retry = rt.write_limiter.retry_after(key)
        raise ApiError(
            "rate_limited",
            "Too many writes, slow down",
            {"retry_after": retry},
            headers={"Retry-After": str(retry)},
        )


# --- write helpers ---------------------------------------------------------------------


def audit_source(auth: Auth, default: str) -> str:
    """`admin` for any write that carries the admin cookie (Q10), else the endpoint's own source."""
    return "admin" if auth.is_admin else default


def new_party_id(state: State) -> str:
    """`p-` plus 6 random characters, not used by any party in `state`."""
    used = {p.id for p in state.parties}
    while True:
        candidate = "p-" + "".join(secrets.choice(PARTY_ID_ALPHABET) for _ in range(6))
        if candidate not in used:
            return candidate


def next_party_color(state: State) -> str:
    """First palette color not in use. When all are in use, the least used one (first in order), so it starts again."""
    uses = {color: 0 for color in PARTY_PALETTE}
    for party in state.parties:
        if party.color.upper() in uses:
            uses[party.color.upper()] += 1
    return min(PARTY_PALETTE, key=lambda color: uses[color])  # min() keeps the first of equal counts


def release_slot(state: State, night: str, slot: str) -> None:
    """Free a slot. A night without any occupied slot is dropped from `sleeping`."""
    by_slot = state.sleeping.get(night)
    if by_slot is None:
        return
    by_slot.pop(slot, None)
    if not by_slot:
        del state.sleeping[night]


# --- request models ----------------------------------------------------------------


class JoinRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # No minimum length: an empty code is simply a wrong code (401), not a malformed request.
    code: Annotated[str, StringConstraints(strict=True, max_length=256)]


# --- app factory ---------------------------------------------------------------------


def _etag_matches(header: str | None, etag: str) -> bool:
    if not header:
        return False
    tags = [t.strip().removeprefix("W/") for t in header.split(",")]
    return "*" in tags or etag in tags


def _first_failing_field(exc: RequestValidationError) -> str | None:
    for err in exc.errors():
        loc = err.get("loc", ())
        if len(loc) > 1 and isinstance(loc[1], str):  # loc[0] is "body", "query", ...
            return loc[1]
        return None
    return None


ASSET_VERSION_PLACEHOLDER = "__ASSET_VERSION__"
APP_VERSION_PLACEHOLDER = "__APP_VERSION__"


class PageRenderer:
    """Serves `static/index.html` with the placeholder in its script URLs replaced by a content hash.

    The page loads its scripts as `static/js/x.js?v=<hash>`. The hash changes whenever any file in
    `static/js/` or the page itself changes, so a browser never runs a stale script after an edit.
    The release version is mixed in too, so every release shows the "new version" sign (and the page
    then shows the new version number), even one that changed no page file.
    The result is cached until a file's modification time or size changes (no restart needed in development).
    """

    def __init__(self, static_dir: Path, release: str = "") -> None:
        self._release = release
        self._index = static_dir / "index.html"
        self._scripts = static_dir / "js"
        self._signature: tuple[Any, ...] | None = None
        self._html = ""
        self._version = ""

    def _files(self) -> list[Path]:
        scripts = sorted(self._scripts.rglob("*.js")) if self._scripts.is_dir() else []
        return [self._index, *scripts]

    def version(self) -> str:
        """The current hash (the one in the script URLs)."""
        self.render()
        return self._version

    def render(self) -> str:
        files = self._files()
        signature = tuple((str(f), f.stat().st_mtime_ns, f.stat().st_size) for f in files)
        if signature != self._signature:
            digest = hashlib.sha256(self._release.encode("utf-8"))
            for f in files:
                digest.update(f.name.encode("utf-8"))
                digest.update(f.read_bytes())
            version = self._version = digest.hexdigest()[:12]
            html = self._index.read_text(encoding="utf-8")
            html = html.replace(ASSET_VERSION_PLACEHOLDER, version)
            self._html = html.replace(APP_VERSION_PLACEHOLDER, self._release)
            self._signature = signature
        return self._html


def read_version(pyproject: Path) -> str:
    """Return `[project].version` from pyproject.toml, or "unknown" (with one warning) if unavailable."""
    try:
        version = tomllib.loads(pyproject.read_text(encoding="utf-8"))["project"]["version"]
        if isinstance(version, str) and version:
            return version
    except (OSError, ValueError, KeyError, TypeError):
        pass
    log.warning("App version unavailable: no [project].version in %s", pyproject)
    return "unknown"


def create_app(
    config_dir: str | Path = ROOT / "config",
    data_dir: str | Path = ROOT / "data",
    static_dir: str | Path = ROOT / "static",
    env: Mapping[str, str] | None = None,
    clock: Callable[[], float] = time.time,
    monotonic: Callable[[], float] = time.monotonic,
    pyproject: str | Path = ROOT / "pyproject.toml",
    sms_client: SmsClient | None = None,
) -> FastAPI:
    """Build the app. Raises `ConfigError` or `StartupError` with a precise message when something is wrong.

    `env` defaults to `os.environ`. `clock` (epoch seconds) is used for cookie ages and
    `monotonic` for the rate-limit windows. Both are injectable for tests, and so is `sms_client`
    (it replaces the one the settings would build).
    """
    env = os.environ if env is None else env
    settings = load_settings(env)
    info_override = info_enabled_override(env)
    config_dir, static_dir = Path(config_dir), Path(static_dir)
    layout = load_layout(config_dir / "cabin.yaml")
    app_config = load_app_config(config_dir / "app.yaml")
    index_file = static_dir / "index.html"
    if not index_file.is_file():
        raise ConfigError(f"{index_file}: the page is missing")
    store = Store(layout, data_dir=data_dir, backups_keep=app_config.backups_keep)  # the data file check
    layout_json = layout.model_dump(mode="json")
    info_path = config_dir / "info.yaml"
    info = load_info(info_path, layout.event, info_override)
    info_json = info.model_dump(mode="json") if info else None
    source = "INFO_ENABLED" if info_override is not None else ("info.yaml" if info_path.is_file() else "no info.yaml")
    log.info("„Pred cestou“ section %s (%s)", "on" if info else "off", source)

    hub = EventHub(on_online_change=lambda online: on_online_change(online))
    rt = Runtime(
        settings=settings,
        layout=layout,
        app_config=app_config,
        store=store,
        cookies=CookieSigner(
            settings.secret_key, {"group": settings.group_code, "admin": settings.admin_code}, clock
        ),
        party_cookies=PartyAuthSigner(settings.secret_key, clock),
        join_limiter=SlidingWindowLimiter(CODE_ATTEMPTS_PER_MINUTE, clock=monotonic),
        write_limiter=SlidingWindowLimiter(app_config.limits.writes_per_client_minute, clock=monotonic),
        sms_limits=SmsLimits(app_config.limits, clock=monotonic),
        sms=sms_client or build_sms_client(settings),
        seen=SeenTracker(
            Path(data_dir) / "seen.yaml", clock, {p.id for p in store.read().parties}, store.audit_path
        ),
        layout_json=layout_json,
        info_json=info_json,
        config_hash=config_digest(layout_json, info_json),
        hub=hub,
        known_ids={p.id for p in store.read().parties},
    )
    seen = rt.seen
    seen.connected = hub.online_parties
    rt.last_online = set(seen.presence(rt.known_ids)["online"])

    def on_online_change(online: set[str]) -> None:
        """Hub callback (event loop): a party's first stream opened or its last one closed."""
        try:
            for party_id in online ^ rt.connected:  # connect and disconnect both count as "seen now"
                seen.record(party_id, rt.known_ids, polled=False)
            closed = rt.connected - online
            for party_id in closed:  # its last stream closed: offline after the short grace, not the poll window
                seen.last_stream_closed(party_id)
            rt.connected = set(online)
            rt.refresh_presence()
            if closed and rt.loop is not None:  # tell everyone when the grace is over (unless it reconnected)
                rt.loop.call_later(STREAM_GRACE + 0.5, rt.refresh_presence)
        except Exception:  # must not raise: it would replace the stream's normal end (see events.py)
            log.exception("presence update failed")

    def on_commit(state: State) -> None:
        """Store hook (event loop, inside the write lock): tell every stream about the committed state."""
        rt.known_ids = {p.id for p in state.parties}
        payload = state_payload(rt, state)
        rt.last_online = set(payload["presence"]["online"])  # the state frame carries presence too
        hub.publish_state(payload)

    store.after_commit = on_commit

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        rt.loop = asyncio.get_running_loop()

        async def presence_watch() -> None:
            # Parties that only poll age out of the 75 s window without any event of their own.
            while True:
                await asyncio.sleep(PING_SECONDS)
                try:
                    rt.refresh_presence()
                except Exception:
                    log.exception("presence check failed")

        watcher = asyncio.create_task(presence_watch())
        try:
            yield
        finally:
            watcher.cancel()
            hub.close()
            rt.loop = None
    # No docs or OpenAPI routes: the app has one consumer, its own page.
    app = FastAPI(title="chrapa-poll", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.state.runtime = rt

    @app.exception_handler(RuleError)
    async def _rule_error(request: Request, exc: RuleError) -> JSONResponse:
        # `bad_code` has no state: the caller is not authorized to see it.
        with_state = getattr(exc, "with_state", exc.code != "bad_code")
        headers = getattr(exc, "headers", None)
        return error_response(rt, exc.code, exc.message, exc.params, with_state=with_state, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def _invalid_request(request: Request, exc: RequestValidationError) -> JSONResponse:
        field = _first_failing_field(exc)
        errors = exc.errors()
        detail = errors[0].get("msg", "invalid") if errors else "invalid"
        return error_response(
            rt,
            "invalid",
            f"Invalid request: {detail}",
            {"field": field} if field else {},
            with_state=_auth_of(request) is not None,
        )

    version = read_version(Path(pyproject))
    page = PageRenderer(static_dir, version)
    rt.asset_version = page.version

    @app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
    async def index() -> HTMLResponse:
        return HTMLResponse(page.render(), headers={"Cache-Control": "no-cache"})

    @app.get("/sw.js", include_in_schema=False)
    async def service_worker() -> FileResponse:
        # Served from the root so its scope covers the page. It has no fetch handler (installability only).
        return FileResponse(
            Path(static_dir) / "sw.js", media_type="text/javascript", headers={"Cache-Control": "no-cache"}
        )

    @app.api_route("/api/health", methods=["GET", "HEAD"])
    async def health() -> dict[str, bool | str]:
        return {"ok": True, "version": version}

    @app.post("/api/join")
    async def join(request: Request, body: JoinRequest) -> JSONResponse:
        ip = client_ip(request)
        limiter_key = f"ip:{ip}"
        # Only failed attempts count, so friends behind one Wi-Fi can all join. No await between
        # the check and the count, so concurrent requests cannot slip past the limit.
        if rt.join_limiter.blocked(limiter_key):
            retry = rt.join_limiter.retry_after(limiter_key)
            raise ApiError(
                "rate_limited",
                "Too many code attempts",
                {"retry_after": retry},
                with_state=False,
                headers={"Retry-After": str(retry)},
            )
        code = body.code.strip().encode()
        # Both comparisons always run, so timing does not reveal which code was close.
        is_admin = secrets.compare_digest(code, settings.admin_code.encode())
        is_group = secrets.compare_digest(code, settings.group_code.encode())
        if not (is_admin or is_group):
            rt.join_limiter.hit(limiter_key)
            log.info("wrong code attempt from %s", ip)
            raise ApiError("bad_code", "Wrong code", with_state=False)
        response = JSONResponse({"ok": True, "role": "admin" if is_admin else "group"})
        roles = ["group", "admin"] if is_admin else ["group"]  # the admin code sets both cookies
        for role in roles:
            response.set_cookie(
                GROUP_COOKIE if role == "group" else ADMIN_COOKIE,
                rt.cookies.issue(role),
                max_age=COOKIE_MAX_AGE[role],
                path="/",
                secure=True,
                httponly=True,
                samesite="lax",
            )
        log.info("join as %s from %s", roles[-1], ip)
        return response

    @app.get("/api/state")
    async def get_state(request: Request, _auth: Annotated[Auth, Depends(require_group)]) -> Response:
        state = rt.store.read()
        etag = state_etag(state, rt.config_hash, rt.seen.presence(rt.known_ids), page.version())
        headers = {"ETag": etag, "Cache-Control": "private, no-cache"}
        if _etag_matches(request.headers.get("if-none-match"), etag):
            return Response(status_code=304, headers=headers)
        response = ok_response(rt, state)
        response.headers.update(headers)
        return response

    @app.get("/api/events")
    async def events(
        request: Request, _auth: Annotated[Auth, Depends(require_group)], party: str | None = None, client: str | None = None
    ) -> StreamingResponse:
        # `EventSource` cannot send headers, so the party and the client come as query parameters.
        party_id = clean_id(party)
        if party_id not in rt.known_ids:
            party_id = None  # unknown or malformed: a stream without presence
        client_id = clean_id(client) or client_id_of(request) or f"ip:{client_ip(request)}"
        seen.record(party_id, rt.known_ids, polled=False)
        try:
            conn = hub.connect(client_id, party_id)
        except HubRefused as exc:
            raise ApiError("rate_limited", f"Too many open event streams: {exc}", {"retry_after": 5}) from exc
        try:
            initial = state_payload(rt, rt.store.read())  # after connect(), so presence lists this party
            hub.drop_pending_presence(conn)  # our own connect may have queued one; the initial state has it
        except BaseException:
            hub.release(conn)
            raise

        async def body() -> AsyncIterator[str]:
            async with aclosing(hub.stream(conn, initial)) as frames:
                async for chunk in frames:
                    if chunk.startswith("event: ping"):
                        seen.record(party_id, rt.known_ids, polled=False)
                    yield chunk

        return StreamingResponse(
            body(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            background=BackgroundTask(hub.release, conn),  # a stream that never started would leak its slot
        )

    Group = Annotated[Auth, Depends(require_group)]
    Limited = Depends(enforce_write_limit)

    # --- phone login: no state change, so no version bump, backup or audit ----------------------

    def rate_limited(wait: int) -> ApiError:
        return ApiError(
            "rate_limited", "Too many SMS requests", {"retry_after": wait}, headers={"Retry-After": str(wait)}
        )

    def sms_client() -> SmsClient:
        if rt.sms is None:
            raise ApiError("sms_unavailable", "SMS verification is not configured")
        return rt.sms

    def protected_party(state: State, party_id: str) -> Party:
        party = next((p for p in state.parties if p.id == party_id), None)
        if party is None:
            raise ApiError("unknown_party", "No such party")
        return party

    def phone_matches(party: Party, typed: str) -> bool:
        """Both numbers are normalized; the comparison is constant-time. A party without a number never matches."""
        number = normalize_phone(typed)  # first, so a malformed number is `invalid` for every party
        return party.phone is not None and secrets.compare_digest(party.phone.encode(), number.encode())

    def set_party_cookie(response: Response, verified: Mapping[str, float]) -> None:
        if verified:
            response.set_cookie(
                PARTY_COOKIE,
                rt.party_cookies.issue(verified),
                max_age=PARTY_COOKIE_MAX_AGE,
                path="/",
                secure=True,
                httponly=True,
                samesite="lax",
            )
        else:
            response.delete_cookie(PARTY_COOKIE, path="/", secure=True, httponly=True, samesite="lax")

    @app.get("/api/session")
    async def session(request: Request, _auth: Annotated[Auth, Depends(require_group)]) -> JSONResponse:
        verified = verified_parties(request, rt.store.read())
        return JSONResponse({"ok": True, "verified": sorted(verified), "sms_enabled": rt.sms_enabled})

    @app.post("/api/parties/{party_id}/login/start", dependencies=[Limited])
    async def login_start(request: Request, party_id: PartyId, body: LoginStartRequest, auth: Group) -> JSONResponse:
        client = sms_client()
        state = rt.store.read()
        party = protected_party(state, party_id)
        if not phone_matches(party, body.phone):
            # A wrong number costs a code attempt, so the hint cannot be used to guess the rest of the number.
            wait = rt.sms_limits.attempt(party.id)
            if wait:
                raise rate_limited(wait)
            raise ApiError("phone_mismatch", "Phone number does not match the party")
        wait = rt.sms_limits.send(party.id, client_ip(request))
        if wait:
            raise rate_limited(wait)
        await client.start(party.phone)
        return JSONResponse({"ok": True})

    @app.post("/api/parties/{party_id}/login/verify")
    async def login_verify(
        request: Request, party_id: PartyId, body: LoginVerifyRequest, auth: Group
    ) -> JSONResponse:
        client = sms_client()  # not counted in the write limit: the code attempts have their own
        state = rt.store.read()
        party = protected_party(state, party_id)
        wait = rt.sms_limits.attempt(party.id)
        if wait:
            raise rate_limited(wait)
        if not phone_matches(party, body.phone):
            raise ApiError("phone_mismatch", "Phone number does not match the party")
        if not await client.check(party.phone, body.code):
            raise ApiError("bad_sms_code", "Wrong or expired code")
        verified = verified_parties(request, state)
        verified[party.id] = rt.party_cookies.now()
        response = ok_response(rt, state, verified=sorted(verified))
        set_party_cookie(response, verified)
        return response

    @app.post("/api/logout", dependencies=[Limited])
    async def logout(request: Request, body: LogoutRequest, auth: Group) -> JSONResponse:
        state = rt.store.read()
        verified = verified_parties(request, state)
        verified.pop(body.party_id, None)
        response = ok_response(rt, state, verified=sorted(verified))
        set_party_cookie(response, verified)
        return response

    # --- phone management: the number is saved only after a correct SMS code --------------------

    def check_access(request: Request, state: State, party_id: str, auth: Auth) -> Party:
        party = protected_party(state, party_id)
        check_party_access(party, verified_parties(request, state), auth.is_admin)
        return party

    @app.post("/api/parties/{party_id}/phone/start", dependencies=[Limited])
    async def phone_start(request: Request, party_id: PartyId, body: LoginStartRequest, auth: Group) -> JSONResponse:
        state = rt.store.read()
        party = check_access(request, state, party_id, auth)
        number = normalize_phone(body.phone)
        client = sms_client()
        wait = rt.sms_limits.send(party.id, client_ip(request))
        if wait:
            raise rate_limited(wait)
        await client.start(number)
        return JSONResponse({"ok": True})

    @app.post("/api/parties/{party_id}/phone/verify")
    async def phone_verify(request: Request, party_id: PartyId, body: LoginVerifyRequest, auth: Group) -> JSONResponse:
        state = rt.store.read()
        party = check_access(request, state, party_id, auth)
        number = normalize_phone(body.phone)
        client = sms_client()
        wait = rt.sms_limits.attempt(party.id)
        if wait:
            raise rate_limited(wait)
        if not await client.check(number, body.code):
            raise ApiError("bad_sms_code", "Wrong or expired code")
        now = rt.party_cookies.now()
        async with rt.store.write(
            action="phone_set", source=audit_source(auth, "form"), client_id=client_id_of(request)
        ) as tx:
            party = check_access(request, tx.state, party_id, auth)  # re-check: it may have changed meanwhile
            party.phone = number
            party.phone_set_at = datetime.fromtimestamp(now, UTC).isoformat()
            tx.audit(party=party.id, phone_hint=phone_hint(party))
        verified = verified_parties(request, tx.state)
        verified[party.id] = datetime.fromisoformat(party.phone_set_at).timestamp()
        response = ok_response(rt, tx.state, verified=sorted(verified))
        set_party_cookie(response, verified)
        return response

    @app.delete("/api/parties/{party_id}/phone", dependencies=[Limited])
    async def phone_remove(request: Request, party_id: PartyId, auth: Group) -> JSONResponse:
        async with rt.store.write(
            action="phone_remove", source=audit_source(auth, "form"), client_id=client_id_of(request)
        ) as tx:
            party = check_access(request, tx.state, party_id, auth)
            if party.phone is None:
                tx.skip()
            else:
                tx.audit(party=party.id, phone_hint=phone_hint(party))
                party.phone = None
                party.phone_set_at = None
        return ok_response(rt, tx.state)

    # --- write endpoints: thin handlers, the rules are in validate.py ------------------------

    @app.post("/api/assign", dependencies=[Limited])
    async def assign(request: Request, body: AssignRequest, auth: Group) -> JSONResponse:
        async with rt.store.write(
            action="assign", source=audit_source(auth, "map"), client_id=client_id_of(request)
        ) as tx:
            check_signup_open(tx.state, auth.is_admin)
            guard_party(request, tx.state, body.party_id, auth)
            slots = check_assign(tx.state, rt.layout, body.night, body.slots, body.party_id)
            for slot in slots:
                tx.state.sleeping.setdefault(body.night, {})[slot] = body.party_id
            raise_places_to_placed(tx.state, find_party(tx.state, body.party_id), body.night)
            tx.audit(party=body.party_id, nights=[body.night], slots=slots, before=None, after=body.party_id)
        return ok_response(rt, tx.state)

    @app.post("/api/assign-stay", dependencies=[Limited])
    async def assign_stay(request: Request, body: AssignStayRequest, auth: Group) -> JSONResponse:
        async with rt.store.write(
            action="assign-stay", source=audit_source(auth, "map"), client_id=client_id_of(request)
        ) as tx:
            check_signup_open(tx.state, auth.is_admin)
            guard_party(request, tx.state, body.party_id, auth)
            plan = check_assign_stay(tx.state, rt.layout, body.slots, body.party_id)
            for night in plan.nights:
                for slot in plan.slots:
                    tx.state.sleeping.setdefault(night, {})[slot] = body.party_id
            for night in plan.nights:
                raise_places_to_placed(tx.state, find_party(tx.state, body.party_id), night)
            tx.audit(
                party=body.party_id,
                nights=plan.nights,
                slots=plan.slots,
                changes=[
                    {"night": n, "slot": s, "before": None, "after": body.party_id} for n in plan.nights for s in plan.slots
                ],
                skipped=plan.skipped,
            )
        return ok_response(rt, tx.state, skipped=plan.skipped)

    @app.post("/api/clear", dependencies=[Limited])
    async def clear(request: Request, body: ClearRequest, auth: Group) -> JSONResponse:
        async with rt.store.write(
            action="clear", source=audit_source(auth, "map"), client_id=client_id_of(request)
        ) as tx:
            check_signup_open(tx.state, auth.is_admin)
            holder = check_clear(tx.state, rt.layout, body.night, body.slot)
            if holder is not None:
                guard_party(request, tx.state, holder, auth)
            if holder is None:
                tx.skip()  # already free: 200 without a write (Q5)
            else:
                release_slot(tx.state, body.night, body.slot)
                tx.audit(party=holder, nights=[body.night], slots=[body.slot], before=holder, after=None)
        return ok_response(rt, tx.state)

    @app.post("/api/move", dependencies=[Limited])
    async def move(request: Request, body: MoveRequest, auth: Group) -> JSONResponse:
        async with rt.store.write(
            action="move", source=audit_source(auth, "map"), client_id=client_id_of(request)
        ) as tx:
            check_signup_open(tx.state, auth.is_admin)
            guard_party(request, tx.state, body.party_id, auth)
            nights = check_move(tx.state, rt.layout, body.party_id, body.from_slot, body.to_slot, body.nights)
            for night in nights:
                release_slot(tx.state, night, body.from_slot)
                tx.state.sleeping.setdefault(night, {})[body.to_slot] = body.party_id
            tx.audit(
                party=body.party_id,
                nights=nights,
                slots=[body.from_slot, body.to_slot],
                before=body.from_slot,
                after=body.to_slot,
                changes=[{"night": n, "from_slot": body.from_slot, "to_slot": body.to_slot} for n in nights],
            )
        return ok_response(rt, tx.state)

    @app.post("/api/places", dependencies=[Limited])
    async def places(request: Request, body: PlacesRequest, auth: Group) -> JSONResponse:
        async with rt.store.write(
            action="places", source=audit_source(auth, "map"), client_id=client_id_of(request)
        ) as tx:
            check_signup_open(tx.state, auth.is_admin)
            guard_party(request, tx.state, body.party_id, auth)
            party = check_places(tx.state, rt.layout, body.party_id, body.night, body.places)
            before = party.places.get(body.night)
            set_places(party, body.night, body.places)
            tx.audit(
                party=party.id, nights=[body.night], before=before, after=party.places.get(body.night),
                places=body.places,
            )
        return ok_response(rt, tx.state)

    @app.post("/api/briefing", dependencies=[Limited])
    async def briefing(request: Request, body: BriefingRequest, auth: Group) -> JSONResponse:
        # No check_signup_open: "Pred cestou" is not a signup change and stays open when signup is locked.
        async with rt.store.write(
            action="briefing", source=audit_source(auth, "map"), client_id=client_id_of(request)
        ) as tx:
            guard_party(request, tx.state, body.party_id, auth)
            party = check_briefing(tx.state, body.party_id, body.step)
            if not add_briefing_step(tx.state, party.id, body.step):
                tx.skip()
            else:
                tx.audit(party=party.id, step=body.step)
        return ok_response(rt, tx.state)

    @app.post("/api/food", dependencies=[Limited])
    async def food(request: Request, body: FoodRequest, auth: Group) -> JSONResponse:
        # No check_signup_open: the food note is not a signup change and stays open when signup is locked.
        async with rt.store.write(
            action="food", source=audit_source(auth, "map"), client_id=client_id_of(request)
        ) as tx:
            guard_party(request, tx.state, body.party_id, auth)
            party, text = check_food(tx.state, body.party_id, body.text)
            before = party.food_note
            if not set_food_note(party, text):
                tx.skip()
            else:
                tx.audit(party=party.id, before=before, after=party.food_note)
        return ok_response(rt, tx.state)

    @app.post("/api/parties", dependencies=[Limited])
    async def create_party(request: Request, body: PartyCreate, auth: Group) -> JSONResponse:
        async with rt.store.write(
            action="party-create", source=audit_source(auth, "form"), client_id=client_id_of(request)
        ) as tx:
            check_signup_open(tx.state, auth.is_admin)
            check_party_create(tx.state, rt.layout, body)
            stamp = now_iso()
            party = Party(
                id=new_party_id(tx.state),
                color=body.color.upper() if body.color else next_party_color(tx.state),
                created_at=stamp,
                updated_at=stamp,
                **body.model_dump(exclude={"color"}),
            )
            tx.state.parties.append(party)
            tx.audit(party=party.id, before=None, after=public_party(party))
        return ok_response(rt, tx.state, party=public_party(party))

    @app.put("/api/parties/{party_id}", dependencies=[Limited])
    async def update_party(request: Request, party_id: PartyId, body: PartyUpdate, auth: Group) -> JSONResponse:
        async with rt.store.write(
            action="party-update", source=audit_source(auth, "form"), client_id=client_id_of(request)
        ) as tx:
            check_signup_open(tx.state, auth.is_admin)
            guard_party(request, tx.state, party_id, auth)
            freed = check_party_update(tx.state, rt.layout, party_id, body)
            party = find_party(tx.state, party_id)
            before = public_party(party)
            for key, value in body.model_dump(exclude={"color"}).items():
                setattr(party, key, value)
            if body.color is not None:
                party.color = body.color.upper()
            party.updated_at = now_iso()
            adjust_places(party)
            for entry in freed:
                release_slot(tx.state, entry["night"], entry["slot"])
            tx.audit(
                party=party.id,
                nights=sorted({e["night"] for e in freed}),
                slots=[e["slot"] for e in freed],
                before=before,
                after=public_party(party),
                changes=[{**e, "before": party.id, "after": None} for e in freed],
            )
        return ok_response(rt, tx.state, party=public_party(party), freed=freed)

    # Only the static folder is served. data/, config/, files/ and .env are never mounted.
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    return app


def configure_logging(name: str = "chrapa", level: int = logging.INFO) -> None:
    """Make the app's own log lines visible under uvicorn, which configures only its own loggers.

    Called only on the uvicorn path (not by `create_app`), so tests keep their logging untouched.
    Idempotent. The handler goes on the `chrapa` logger, which also covers `chrapa.store`.
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(LOG_FORMAT))
        logger.addHandler(handler)


def __getattr__(name: str) -> FastAPI:
    """Module-level `app` for `uvicorn app.main:app`, built on first access.

    Importing this module (tests, tooling) therefore does not need secrets or data files.
    A startup problem is logged as a clear message and then stops uvicorn.
    """
    if name != "app":
        raise AttributeError(name)
    configure_logging()
    try:
        built = create_app()
    except Exception as exc:
        logging.getLogger("chrapa.app").critical("startup failed: %s", exc)
        raise
    globals()["app"] = built
    return built
