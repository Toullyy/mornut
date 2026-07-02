from fastapi import APIRouter, Header, Request
from linebot.v3.webhooks import WebhookParser

from app.core.config import settings
from app.core.security import verify_line_signature
from app.services import webhook_handler

router = APIRouter()

_parser = WebhookParser(settings.line_channel_secret)


@router.post("")
async def handle_webhook(
    request: Request,
    x_line_signature: str = Header(...),
) -> dict:
    body = await request.body()
    verify_line_signature(body, x_line_signature, settings.line_channel_secret)

    events = _parser.parse(body.decode("utf-8"), x_line_signature)
    await webhook_handler.dispatch(events)

    return {"status": "ok"}
