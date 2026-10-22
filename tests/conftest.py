import copy
import itertools
from pathlib import Path

import pytest
import yaml
from httpx import ASGITransport, AsyncClient

from app.main import create_app
from app.models import AppConfig, Layout, Party, State, load_app_config, load_layout

ROOT = Path(__file__).resolve().parent.parent
CHATA_YAML = ROOT / "config" / "chata.yaml"
APP_YAML = ROOT / "config" / "app.yaml"

THU, FRI, SAT = "2026-10-29", "2026-10-30", "2026-10-31"
SUN = "2026-11-01"


@pytest.fixture(scope="session")
def _layout_raw() -> dict:
    with open(CHATA_YAML, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


@pytest.fixture
def layout_data(_layout_raw) -> dict:
    """A fresh deep copy of the raw chata.yaml data that a test may modify."""
    return copy.deepcopy(_layout_raw)


@pytest.fixture(scope="session")
def layout() -> Layout:
    return load_layout(CHATA_YAML)


@pytest.fixture(scope="session")
def app_config() -> AppConfig:
    return load_app_config(APP_YAML)


@pytest.fixture
def make_party():
    counter = itertools.count(1)

    def factory(**overrides) -> Party:
        n = next(counter)
        data = {
            "id": f"p-{n:06d}",
            "name": f"Party {n}",
            "adults": 2,
            "kids": 0,
            "kids_in_parents_bed": 0,
            "arrive": THU,
            "leave": SUN,
            "arrival_time": "",
            "note": "",
            "color": "#2F7D6D",
            "created_at": "2026-10-22T20:14:05+02:00",
            "updated_at": "2026-10-22T20:14:05+02:00",
        }
        data.update(overrides)
        return Party(**data)

    return factory


@pytest.fixture
def make_state():
    def factory(parties=(), sleeping=None, signup_open=True) -> State:
        return State(
            version=1,
            updated_at="2026-10-25T19:02:11+02:00",
            signup_open=signup_open,
            parties=list(parties),
            sleeping=sleeping or {},
        )

    return factory


# --- HTTP app fixtures (T-003) ------------------------------------------------

TEST_ENV = {
    "GROUP_CODE": "group-test-code",
    "ADMIN_CODE": "admin-test-code",
    "SECRET_KEY": "test-secret-key-for-signing-cookies",
}


class FakeClock:
    """Callable clock for cookie ages and rate-limit windows. `advance()` moves it."""

    def __init__(self, now: float = 1_800_000_000.0):
        self.now = now

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def make_app(tmp_path, clock):
    """Build an app on a temporary data dir with test secrets. Keyword arguments override the defaults."""

    def factory(**overrides):
        kwargs = {
            "config_dir": ROOT / "config",
            "data_dir": tmp_path / "data",
            "env": TEST_ENV,
            "clock": clock,
            "monotonic": clock,
        }
        kwargs.update(overrides)
        return create_app(**kwargs)

    return factory


@pytest.fixture
def app(make_app):
    return make_app()


@pytest.fixture
def make_client():
    """An httpx client against the app over https (Secure cookies are only kept over https)."""

    def factory(app, client_addr=("203.0.113.7", 50000)):
        return AsyncClient(transport=ASGITransport(app=app, client=client_addr), base_url="https://test")

    return factory


@pytest.fixture
async def client(app, make_client):
    async with make_client(app) as c:
        yield c


@pytest.fixture
async def group_client(app, make_client):
    async with make_client(app) as c:
        resp = await c.post("/api/join", json={"code": TEST_ENV["GROUP_CODE"]})
        assert resp.status_code == 200
        yield c


@pytest.fixture
async def admin_client(app, make_client):
    async with make_client(app) as c:
        resp = await c.post("/api/join", json={"code": TEST_ENV["ADMIN_CODE"]})
        assert resp.status_code == 200
        yield c
