import base64
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

_bearer = HTTPBearer(auto_error=False)
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc


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

import httpx


async def get_line_user_id(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ] = None,
) -> str:
    """Verify a LIFF access token and return the LINE user ID."""
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


# ── Admin API (JWT) ───────────────────────────────────────────────────────────

async def get_admin_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ] = None,
) -> dict:
    """Verify a JWT and return the decoded payload."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    return decode_access_token(credentials.credentials)
