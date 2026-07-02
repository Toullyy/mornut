import base64
import hashlib
import hmac

from fastapi import HTTPException


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
