from fastapi import APIRouter, Header, Request

from app.core.config import settings
from app.core.security import verify_line_signature

router = APIRouter()


@router.post("")
async def handle_webhook(
    request: Request,
    x_line_signature: str = Header(...),
) -> dict:
    body = await request.body()
    verify_line_signature(body, x_line_signature, settings.line_channel_secret)
    # Week 2: parse LINE events (message, follow, postback) and dispatch to services
    return {"status": "ok"}
