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

import hashlib
import json
import logging
import os
import secrets
import time
import tomllib
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from itsdangerous import BadSignature, URLSafeSerializer
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.models import (
    PARTY_PALETTE,
    AppConfig,
    AssignRequest,
    AssignStayRequest,
    ClearRequest,
    ConfigError,
    Layout,
    MoveRequest,
    PlacesRequest,
    PartyId,
    Party,
    PartyCreate,
    PartyUpdate,
    State,
    load_app_config,
    load_layout,
)
from app.ratelimit import CODE_ATTEMPTS_PER_MINUTE, SlidingWindowLimiter
from app.seen import SeenTracker
from app.store import Store, now_iso
from app.validate import (
    ERROR_STATUS,
    RuleError,
    check_assign,
    check_assign_stay,
    check_clear,
    check_move,
    check_party_create,
    check_party_update,
    check_places,
    check_signup_open,
    adjust_places,
    find_party,
    raise_places_to_placed,
    set_places,
)

log = logging.getLogger("chrapa.app")

ROOT = Path(__file__).resolve().parent.parent
GROUP_COOKIE = "cabin_group"
ADMIN_COOKIE = "cabin_admin"
COOKIE_MAX_AGE = {"group": 30 * 24 * 3600, "admin": 12 * 3600}  # seconds
COOKIE_CLOCK_SKEW = 60  # tolerated seconds of a cookie "from the future" (clock set back)
CLIENT_ID_MAX_LEN = 64
MIN_SECRET_KEY_LEN = 32
PARTY_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
LOG_FORMAT = "%(levelname)s %(name)s: %(message)s"


# --- settings and cookies ----------------------------------------------------


@dataclass(frozen=True)
class Settings:
    group_code: str
    admin_code: str
    secret_key: str


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
    return Settings(values["GROUP_CODE"], values["ADMIN_CODE"], values["SECRET_KEY"])


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


@dataclass
class Runtime:
    """Everything a request needs. Lives in `app.state.runtime`."""

    settings: Settings
    layout: Layout
    app_config: AppConfig
    store: Store
    cookies: CookieSigner
    join_limiter: SlidingWindowLimiter
    write_limiter: SlidingWindowLimiter
    seen: SeenTracker
    layout_json: dict[str, Any]
    config_hash: str  # digest of the served layout, computed once at startup


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


def state_payload(rt: Runtime, state: State) -> dict[str, Any]:
    """The `state` object of every response: the data file plus the layout from `cabin.yaml`."""
    return {
        "version": state.version,
        "updated_at": state.updated_at,
        "signup_open": state.signup_open,
        "event": rt.layout_json["event"],
        "layout": rt.layout_json,
        "parties": [p.model_dump(mode="json") for p in state.parties],
        "sleeping": state.sleeping,
        "presence": rt.seen.presence({p.id for p in state.parties}),
    }


def config_digest(layout_json: dict[str, Any]) -> str:
    canonical = json.dumps(layout_json, sort_keys=True, ensure_ascii=False)
    return hashlib.sha1(canonical.encode()).hexdigest()[:8]


def state_etag(state: State, config_hash: str, presence: dict[str, Any] | None = None) -> str:
    """Changes on every write, when the served `cabin.yaml` changes (after a restart) and when presence changes.

    `updated_at` is mixed in, so a hand-restored older backup (lower `version`) differs too.
    `config_hash` covers `layout` and `event`, which come from `cabin.yaml` and not from the data file.
    Presence (T-049) adds the `online` set and every party's `last_seen` floored to the minute: second
    precision would change the tag on every poll, while the page only shows minutes. The `online` set keeps
    "online" right within one poll, so the page can use the server's list as it is after a 304.
    """
    digest = hashlib.sha1(state.updated_at.encode()).hexdigest()[:8]
    tag = f"{state.version}-{digest}-{config_hash}"
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
    rt.seen.record(request.headers.get("x-party-id"), {p.id for p in rt.store.read().parties})
    return auth


def require_admin(auth: Annotated[Auth, Depends(require_group)]) -> Auth:
    if not auth.is_admin:
        raise ApiError("forbidden", "Admin cookie required")
    return auth


def client_ip(request: Request) -> str:
    """Behind the proxy this is the real client only when uvicorn runs with --proxy-headers (see T-008)."""
    return request.client.host if request.client else "unknown"


def client_id_of(request: Request) -> str | None:
    """The page's `X-Client-Id` (trimmed, length-capped) or None. Used for audit and limits."""
    return (request.headers.get("x-client-id") or "").strip()[:CLIENT_ID_MAX_LEN] or None


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


class PageRenderer:
    """Serves `static/index.html` with the placeholder in its script URLs replaced by a content hash.

    The page loads its scripts as `static/js/x.js?v=<hash>`. The hash changes whenever any file in
    `static/js/` or the page itself changes, so a browser never runs a stale script after an edit.
    The result is cached until a file's modification time or size changes (no restart needed in development).
    """

    def __init__(self, static_dir: Path) -> None:
        self._index = static_dir / "index.html"
        self._scripts = static_dir / "js"
        self._signature: tuple[Any, ...] | None = None
        self._html = ""

    def _files(self) -> list[Path]:
        scripts = sorted(self._scripts.rglob("*.js")) if self._scripts.is_dir() else []
        return [self._index, *scripts]

    def render(self) -> str:
        files = self._files()
        signature = tuple((str(f), f.stat().st_mtime_ns, f.stat().st_size) for f in files)
        if signature != self._signature:
            digest = hashlib.sha256()
            for f in files:
                digest.update(f.name.encode("utf-8"))
                digest.update(f.read_bytes())
            version = digest.hexdigest()[:12]
            html = self._index.read_text(encoding="utf-8")
            self._html = html.replace(ASSET_VERSION_PLACEHOLDER, version)
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
) -> FastAPI:
    """Build the app. Raises `ConfigError` or `StartupError` with a precise message when something is wrong.

    `env` defaults to `os.environ`. `clock` (epoch seconds) is used for cookie ages and
    `monotonic` for the rate-limit windows. Both are injectable for tests.
    """
    settings = load_settings(os.environ if env is None else env)
    config_dir, static_dir = Path(config_dir), Path(static_dir)
    layout = load_layout(config_dir / "cabin.yaml")
    app_config = load_app_config(config_dir / "app.yaml")
    index_file = static_dir / "index.html"
    if not index_file.is_file():
        raise ConfigError(f"{index_file}: the page is missing")
    store = Store(layout, data_dir=data_dir, backups_keep=app_config.backups_keep)  # the data file check
    layout_json = layout.model_dump(mode="json")

    rt = Runtime(
        settings=settings,
        layout=layout,
        app_config=app_config,
        store=store,
        cookies=CookieSigner(
            settings.secret_key, {"group": settings.group_code, "admin": settings.admin_code}, clock
        ),
        join_limiter=SlidingWindowLimiter(CODE_ATTEMPTS_PER_MINUTE, clock=monotonic),
        write_limiter=SlidingWindowLimiter(app_config.limits.writes_per_client_minute, clock=monotonic),
        seen=SeenTracker(
            Path(data_dir) / "seen.yaml", clock, {p.id for p in store.read().parties}, store.audit_path
        ),
        layout_json=layout_json,
        config_hash=config_digest(layout_json),
    )
    # No docs or OpenAPI routes: the app has one consumer, its own page.
    app = FastAPI(title="chrapa-poll", docs_url=None, redoc_url=None, openapi_url=None)
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

    page = PageRenderer(static_dir)
    version = read_version(Path(pyproject))

    @app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
    async def index() -> HTMLResponse:
        return HTMLResponse(page.render(), headers={"Cache-Control": "no-cache"})

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
        etag = state_etag(state, rt.config_hash, rt.seen.presence({p.id for p in state.parties}))
        headers = {"ETag": etag, "Cache-Control": "private, no-cache"}
        if _etag_matches(request.headers.get("if-none-match"), etag):
            return Response(status_code=304, headers=headers)
        response = ok_response(rt, state)
        response.headers.update(headers)
        return response

    # --- write endpoints: thin handlers, the rules are in validate.py ------------------------

    Group = Annotated[Auth, Depends(require_group)]
    Limited = Depends(enforce_write_limit)

    @app.post("/api/assign", dependencies=[Limited])
    async def assign(request: Request, body: AssignRequest, auth: Group) -> JSONResponse:
        async with rt.store.write(
            action="assign", source=audit_source(auth, "map"), client_id=client_id_of(request)
        ) as tx:
            check_signup_open(tx.state, auth.is_admin)
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
            party = check_places(tx.state, rt.layout, body.party_id, body.night, body.places)
            before = party.places.get(body.night)
            set_places(party, body.night, body.places)
            tx.audit(
                party=party.id, nights=[body.night], before=before, after=party.places.get(body.night),
                places=body.places,
            )
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
            tx.audit(party=party.id, before=None, after=party.model_dump())
        return ok_response(rt, tx.state, party=party.model_dump(mode="json"))

    @app.put("/api/parties/{party_id}", dependencies=[Limited])
    async def update_party(request: Request, party_id: PartyId, body: PartyUpdate, auth: Group) -> JSONResponse:
        async with rt.store.write(
            action="party-update", source=audit_source(auth, "form"), client_id=client_id_of(request)
        ) as tx:
            check_signup_open(tx.state, auth.is_admin)
            freed = check_party_update(tx.state, rt.layout, party_id, body)
            party = find_party(tx.state, party_id)
            before = party.model_dump()
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
                after=party.model_dump(),
                changes=[{**e, "before": party.id, "after": None} for e in freed],
            )
        return ok_response(rt, tx.state, party=party.model_dump(mode="json"), freed=freed)

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
