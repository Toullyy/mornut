"""Dispatch LINE webhook events to appropriate handlers.

Week 2 handles: Follow and plain-text Message events.
Postback events (booking actions) will be added in Week 3.
"""
from linebot.v3.webhooks import (
    Event,
    FollowEvent,
    MessageEvent,
    TextMessageContent,
)

from app.services.line import push_text, reply_text

_MENU = (
    "สวัสดี! ระบบหมอนัด 🏥\n"
    "─────────────────\n"
    "พิมพ์ 'จอง'  → จองคิวผ่าน LINE\n"
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
    await reply_text(event.reply_token, f"ยินดีต้อนรับ!\n\n{_MENU}")


async def _on_text(event: MessageEvent) -> None:
    text = event.message.text.strip()
    lower = text.lower()

    if lower in ("จอง", "book", "นัด"):
        # Week 3: replace placeholder with actual LIFF URL
        await reply_text(
            event.reply_token,
            "กรุณากดลิงก์ด้านล่างเพื่อจองคิว:\n[LIFF URL — จะเพิ่มใน Week 3]",
        )
    elif lower in ("สถานะ", "status", "คิว", "ดูคิว"):
        # Week 3: query patient's bookings and format them
        await reply_text(event.reply_token, "ระบบกำลังพัฒนา กรุณารอสักครู่")
    else:
        await reply_text(event.reply_token, _MENU)
