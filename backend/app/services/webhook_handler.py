"""Dispatch LINE webhook events to appropriate handlers."""
from linebot.v3.webhook import Event, MessageEvent
from linebot.v3.webhooks import FollowEvent, TextMessageContent

from app.core.config import settings
from app.services.line import reply_text

_MENU = (
    "สวัสดี! ระบบหมอนัด\n"
    "─────────────────\n"
    "พิมพ์ 'จอง'   → จองคิวแพทย์\n"
    "พิมพ์ 'สถานะ' → ตรวจสอบคิวของคุณ"
)


async def dispatch(events: list[Event]) -> None:
    for event in events:
        if isinstance(event, FollowEvent):
            await _on_follow(event)
        elif isinstance(event, MessageEvent) and isinstance(
            event.message, TextMessageContent
        ):
            await _on_text(event)


async def _on_follow(event: FollowEvent) -> None:
    await reply_text(event.reply_token, f"ยินดีต้อนรับสู่หมอนัด!\n\n{_MENU}")


async def _on_text(event: MessageEvent) -> None:
    lower = event.message.text.strip().lower()

    if lower in ("จอง", "book", "นัด"):
        if settings.liff_url and settings.clinic_id:
            url = f"{settings.liff_url}?clinicId={settings.clinic_id}"
            msg = f"กดลิงก์ด้านล่างเพื่อจองคิว:\n{url}"
        else:
            msg = "ระบบกำลังเตรียมพร้อม กรุณารอสักครู่"
        await reply_text(event.reply_token, msg)

    elif lower in ("สถานะ", "status", "คิว", "ดูคิว"):
        # Week 3 scope: basic reply; full booking list query in a later iteration
        await reply_text(event.reply_token, "กรุณาติดต่อเจ้าหน้าที่เพื่อตรวจสอบคิว")

    else:
        await reply_text(event.reply_token, _MENU)
