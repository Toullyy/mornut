import base64
import hashlib
import hmac
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)


# ── LINE webhook ──────────────────────────────────────────────────────────────

def verify_line_signature(body: bytes, signature: str, channel_secret: str) -> None:
    """Raise HTTP 400 if the LINE webhook signature does not match."""
    digest = hmac.new(
        channel_secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).digest()
    expected = base64.b64encode(digest).decode("utf-8")
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid LINE signature")


# ── LIFF / patient API ────────────────────────────────────────────────────────

async def get_line_user_id(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ] = None,
) -> str:
    """FastAPI dependency: verify a LIFF access token and return the LINE user ID.

    The LIFF app passes `Authorization: Bearer <liff_access_token>`.
    We call LINE's profile API to validate and extract the user ID.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(
            "https://api.line.me/v2/profile",
            headers={"Authorization": f"Bearer {credentials.credentials}"},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired LINE access token")

    return resp.json()["userId"]
