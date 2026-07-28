import asyncio

from fastapi import APIRouter, Header, Request
from linebot.v3.webhook import WebhookParser

from app.core.security import verify_line_signature
from app.services import line as line_service
from app.services import webhook_handler

router = APIRouter()


@router.post("")
async def handle_webhook(
    request: Request,
    x_line_signature: str = Header(...),
) -> dict:
    body = await request.body()

    # Resolve the clinic's channel secret from DB (falls back to ENV). Running it
    # here also warms the credentials cache so reply/push downstream hit memory.
    secret = await asyncio.to_thread(line_service.resolve_channel_secret)

    verify_line_signature(body, x_line_signature, secret)

    events = WebhookParser(secret).parse(body.decode("utf-8"), x_line_signature)
    await webhook_handler.dispatch(events)

    return {"status": "ok"}
