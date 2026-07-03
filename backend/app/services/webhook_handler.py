"""Dispatch LINE webhook events to appropriate handlers."""
import asyncio

from linebot.v3.webhook import Event, MessageEvent
from linebot.v3.webhooks import FollowEvent, TextMessageContent

from app.core.config import settings
from app.services import database as repo
from app.services.line import reply_text

_MENU = (
    "สวัสดี! ระบบหมอนัด\n"
    "─────────────────\n"
    "พิมพ์ 'จอง'   → จองคิวแพทย์\n"
    "พิมพ์ 'สถานะ' → ตรวจสอบคิวของคุณ"
)

_COVERAGE_TH = {"cash": "เงินสด", "sso": "ประกันสังคม", "universal": "บัตรทอง"}


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
        line_uid = event.source.user_id
        bookings = await asyncio.to_thread(repo.get_patient_bookings, line_uid)
        if not bookings:
            msg = "ไม่พบคิวที่รอรับบริการในขณะนี้\n\nพิมพ์ 'จอง' เพื่อจองคิวใหม่"
        else:
            lines = ["📋 คิวของคุณ\n" + "─" * 18]
            for i, b in enumerate(bookings, 1):
                status_th = "ยืนยันแล้ว" if b["status"] == "confirmed" else "แจ้งเตือนแล้ว"
                coverage_th = _COVERAGE_TH.get(b["coverage"], b["coverage"])
                lines.append(
                    f"คิวที่ {i}\n"
                    f"📅 {b['date']}  🕐 {b['time']} น.\n"
                    f"🏥 {b.get('service_name', '')}\n"
                    f"💳 {coverage_th}  |  {status_th}"
                )
            msg = "\n\n".join(lines)
        await reply_text(event.reply_token, msg)

    else:
        await reply_text(event.reply_token, _MENU)
