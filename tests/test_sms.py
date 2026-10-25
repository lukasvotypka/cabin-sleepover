import logging
from urllib.parse import parse_qs

import httpx
import pytest

from app.main import ConfigError, create_app, load_settings
from app.sms import FakeSmsClient, SmsUnavailable, TwilioVerifyClient, mask_phone
from app.validate import ERROR_STATUS
from tests.conftest import ROOT, TEST_ENV

PHONE = "+421905123456"
TOKEN = "tok-secret-9f8e7d"
SERVICE = "VAservice"
ACCOUNT = "ACaccount"


def twilio(handler) -> TwilioVerifyClient:
    return TwilioVerifyClient(ACCOUNT, TOKEN, SERVICE, transport=httpx.MockTransport(handler))


def json_handler(status, body, seen=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        return httpx.Response(status, json=body)

    return handler


def test_error_code_is_registered():
    assert ERROR_STATUS["sms_unavailable"] == 503
    assert SmsUnavailable().status == 503


async def test_start_request_shape():
    seen = []
    await twilio(json_handler(201, {"status": "pending"}, seen)).start(PHONE)
    (request,) = seen
    assert request.method == "POST"
    assert str(request.url) == f"https://verify.twilio.com/v2/Services/{SERVICE}/Verifications"
    assert parse_qs(request.content.decode()) == {"To": [PHONE], "Channel": ["sms"], "Locale": ["sk"]}
    expected = httpx.BasicAuth(ACCOUNT, TOKEN)._auth_header
    assert request.headers["authorization"] == expected


async def test_check_request_shape_and_approved():
    seen = []
    assert await twilio(json_handler(200, {"status": "approved"}, seen)).check(PHONE, "123456") is True
    (request,) = seen
    assert str(request.url) == f"https://verify.twilio.com/v2/Services/{SERVICE}/VerificationCheck"
    assert parse_qs(request.content.decode()) == {"To": [PHONE], "Code": ["123456"]}
    assert request.headers["authorization"] == httpx.BasicAuth(ACCOUNT, TOKEN)._auth_header


async def test_check_pending_is_false():
    assert await twilio(json_handler(200, {"status": "pending"})).check(PHONE, "000000") is False


async def test_check_404_is_false():
    assert await twilio(json_handler(404, {"code": 20404, "message": "not found"})).check(PHONE, "1") is False


async def test_server_error_is_unavailable_and_leaks_nothing(caplog):
    caplog.set_level(logging.DEBUG)
    client = twilio(json_handler(500, {"code": 1, "message": "boom"}))
    with pytest.raises(SmsUnavailable) as start_exc:
        await client.start(PHONE)
    with pytest.raises(SmsUnavailable) as check_exc:
        await client.check(PHONE, "123456")
    assert "500" in caplog.text
    for text in (caplog.text, str(start_exc.value), str(check_exc.value)):
        assert PHONE not in text and "905123456" not in text and TOKEN not in text


@pytest.mark.parametrize("status", [400, 500])
async def test_twilio_message_echoing_the_phone_is_redacted(caplog, status):
    caplog.set_level(logging.DEBUG)
    body = {"code": 60200, "message": f"Invalid parameter `To`: {PHONE}"}
    with pytest.raises(SmsUnavailable):
        await twilio(json_handler(status, body)).start(PHONE)
    assert "60200" in caplog.text
    assert PHONE not in caplog.text and "905123456" not in caplog.text


@pytest.mark.parametrize("body", [[1], "text", None, 5])
async def test_check_200_with_non_object_json_is_unavailable(body):
    with pytest.raises(SmsUnavailable):
        await twilio(json_handler(200, body)).check(PHONE, "123456")


async def test_phone_at_the_truncation_edge_is_masked(caplog):
    caplog.set_level(logging.DEBUG)
    body = {"code": 1, "message": "x" * 195 + PHONE}
    with pytest.raises(SmsUnavailable):
        await twilio(json_handler(500, body)).start(PHONE)
    assert "905123456" not in caplog.text


async def test_timeout_is_unavailable(caplog):
    def handler(request):
        raise httpx.ReadTimeout("timed out", request=request)

    caplog.set_level(logging.DEBUG)
    client = twilio(handler)
    with pytest.raises(SmsUnavailable):
        await client.start(PHONE)
    with pytest.raises(SmsUnavailable):
        await client.check(PHONE, "123456")
    assert PHONE not in caplog.text and TOKEN not in caplog.text


async def test_fake_client_accepts_only_its_code_and_masks_phone(caplog):
    caplog.set_level(logging.INFO)
    fake = FakeSmsClient("654321")
    await fake.start(PHONE)
    assert "654321" in caplog.text and "***456" in caplog.text and PHONE not in caplog.text
    assert await fake.check(PHONE, "654321") is True
    assert await fake.check(PHONE, "123456") is False
    assert await FakeSmsClient().check(PHONE, "123456") is True


def test_mask_phone():
    assert mask_phone(PHONE) == "***456"


# --- settings and wiring ------------------------------------------------------------

TWILIO_ENV = {
    "TWILIO_ACCOUNT_SID": ACCOUNT,
    "TWILIO_AUTH_TOKEN": TOKEN,
    "TWILIO_VERIFY_SERVICE_SID": SERVICE,
}


def runtime_of(tmp_path, **env):
    app = create_app(config_dir=ROOT / "config", data_dir=tmp_path / "data", env={**TEST_ENV, **env})
    return app.state.runtime


def test_all_twilio_variables_enable_the_twilio_client(tmp_path):
    rt = runtime_of(tmp_path, **TWILIO_ENV)
    assert rt.sms_enabled and isinstance(rt.sms, TwilioVerifyClient)


def test_sms_fake_enables_the_fake_client(tmp_path):
    rt = runtime_of(tmp_path, SMS_FAKE="1", SMS_FAKE_CODE="777777")
    assert rt.sms_enabled and isinstance(rt.sms, FakeSmsClient) and rt.sms.code == "777777"
    assert runtime_of(tmp_path, SMS_FAKE="1").sms.code == "123456"


def test_twilio_wins_over_fake(tmp_path):
    assert isinstance(runtime_of(tmp_path, SMS_FAKE="1", **TWILIO_ENV).sms, TwilioVerifyClient)


def test_nothing_configured_means_sms_off(tmp_path):
    rt = runtime_of(tmp_path)
    assert rt.sms is None and not rt.sms_enabled


def test_partial_twilio_is_off_and_names_the_missing_variable(tmp_path, caplog):
    rt = runtime_of(tmp_path, TWILIO_ACCOUNT_SID=ACCOUNT, TWILIO_AUTH_TOKEN=TOKEN)
    assert not rt.sms_enabled
    assert "TWILIO_VERIFY_SERVICE_SID" in caplog.text and TOKEN not in caplog.text


def test_injected_client_is_used(tmp_path):
    fake = FakeSmsClient()
    app = create_app(
        config_dir=ROOT / "config", data_dir=tmp_path / "data", env=TEST_ENV, sms_client=fake
    )
    assert app.state.runtime.sms is fake and app.state.runtime.sms_enabled


def test_load_settings_still_requires_secrets():
    with pytest.raises(ConfigError):
        load_settings({})
