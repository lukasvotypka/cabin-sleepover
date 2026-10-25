"""SMS verification of phone numbers through Twilio Verify (REST over httpx, no SDK).

`SmsClient` is the swappable seam: `TwilioVerifyClient` for real use, `FakeSmsClient` for the trial
server and development. Neither logs or raises with a full phone number or the auth token.
"""

import logging
import secrets
from typing import Protocol

import httpx

from app.validate import RuleError

log = logging.getLogger("app.sms")

VERIFY_URL = "https://verify.twilio.com/v2/Services/{service_sid}"
TIMEOUT_SECONDS = 10.0
DEFAULT_FAKE_CODE = "123456"


class SmsUnavailable(RuleError):
    """The SMS service failed or is not configured (`503 sms_unavailable`). Details go to the log only."""

    def __init__(self, message: str = "SMS verification is unavailable"):
        super().__init__("sms_unavailable", message)


class SmsClient(Protocol):
    async def start(self, phone: str) -> None:
        """Send a code to `phone` (E.164). Raises `SmsUnavailable` on failure."""

    async def check(self, phone: str, code: str) -> bool:
        """True when `code` is the right, unexpired code for `phone`. Raises `SmsUnavailable` on failure."""


def mask_phone(phone: str) -> str:
    """`+421905123456` -> `***456`: only the last 3 digits are safe to log."""
    return "***" + phone[-3:]


class TwilioVerifyClient:
    def __init__(
        self,
        account_sid: str,
        auth_token: str,
        service_sid: str,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout: float = TIMEOUT_SECONDS,
    ):
        self._auth = (account_sid, auth_token)
        self._base = VERIFY_URL.format(service_sid=service_sid)
        self._transport = transport
        self._timeout = timeout

    async def _post(self, path: str, data: dict[str, str], phone: str) -> httpx.Response:
        try:
            async with httpx.AsyncClient(transport=self._transport, timeout=self._timeout) as client:
                return await client.post(f"{self._base}/{path}", data=data, auth=self._auth)
        except httpx.HTTPError as exc:  # timeouts and network errors; the text may hold the URL, never the phone
            log.warning("Twilio Verify %s for %s failed: %s", path, mask_phone(phone), type(exc).__name__)
            raise SmsUnavailable() from None

    async def start(self, phone: str) -> None:
        data = {"To": phone, "Channel": "sms", "Locale": "sk"}
        response = await self._post("Verifications", data, phone)
        if response.status_code not in (200, 201):
            log.warning(
                "Twilio Verify start for %s answered %s: %s",
                mask_phone(phone), response.status_code, _twilio_error(response, phone),
            )
            raise SmsUnavailable()
        log.info("Verification code sent to %s", mask_phone(phone))

    async def check(self, phone: str, code: str) -> bool:
        response = await self._post("VerificationCheck", {"To": phone, "Code": code}, phone)
        if response.status_code == 404:  # no pending verification: expired, used or never started
            return False
        # Twilio's 429 / 60202 ("max check attempts") falls under SmsUnavailable below; the endpoint task decides the mapping.
        if response.status_code == 400:  # a malformed code is simply wrong
            return False
        if response.status_code != 200:
            log.warning(
                "Twilio Verify check for %s answered %s: %s",
                mask_phone(phone), response.status_code, _twilio_error(response, phone),
            )
            raise SmsUnavailable()
        try:
            return response.json().get("status") == "approved"
        except (ValueError, AttributeError):  # not JSON, or JSON that is not an object
            log.warning("Twilio Verify check for %s returned a body that is not JSON", mask_phone(phone))
            raise SmsUnavailable() from None


def _twilio_error(response: httpx.Response, phone: str) -> str:
    """Twilio's error code and message when present, with the phone number masked (Twilio echoes it)."""
    try:
        body = response.json()
        message = str(body.get("message"))
        message = message.replace(phone, mask_phone(phone)).replace(phone.lstrip("+"), mask_phone(phone))[:200]
        return f"{body.get('code')} {message}"
    except (ValueError, AttributeError):
        return "no error body"


class FakeSmsClient:
    """Accepts only one fixed code and writes it to the log instead of sending anything."""

    def __init__(self, code: str = DEFAULT_FAKE_CODE):
        self.code = code

    async def start(self, phone: str) -> None:
        log.info("FAKE SMS for %s: code %s", mask_phone(phone), self.code)

    async def check(self, phone: str, code: str) -> bool:
        return secrets.compare_digest(code.encode(), self.code.encode())
