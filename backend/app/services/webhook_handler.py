"""Dispatch LINE webhook events to appropriate handlers.

Every inbound/outbound chat message is logged (chat_messages) against a
per-user conversation (chat_conversations) that tracks whether AI or an
admin is currently answering. See app/routers/chat.py for the admin-facing
endpoints that read/write this state, and app/routers/internal.py for the
periodic sweep that hands timed-out admin conversations back to AI.
"""
import asyncio

from linebot.v3.webhook import Event, MessageEvent
from linebot.v3.webhooks import FollowEvent, TextMessageContent

from app.core.config import settings
from app.services import ai_chat
from app.services import database as repo
from app.services.line import get_profile, push_text, reply_text, send_line_notify

_MENU = (
    "สวัสดี! ระบบหมอนัด\n"
    "─────────────────\n"
    "พิมพ์ 'จอง'   → จองคิวแพทย์\n"
    "พิมพ์ 'สถานะ' → ตรวจสอบคิวของคุณ"
)

_COVERAGE_TH = {"cash": "เงินสด", "sso": "ประกันสังคม", "universal": "บัตรทอง"}

_BOOK_KEYWORDS = ("จอง", "book", "นัด")
_STATUS_KEYWORDS = ("สถานะ", "status", "คิว", "ดูคิว")


async def dispatch(events: list[Event]) -> None:
    for event in events:
        if isinstance(event, FollowEvent):
            await _on_follow(event)
        elif isinstance(event, MessageEvent) and isinstance(
            event.message, TextMessageContent
        ):
            await _on_text(event)


async def _on_follow(event: FollowEvent) -> None:
    line_user_id = event.source.user_id
    profile = await get_profile(line_user_id)
    await asyncio.to_thread(
        repo.get_or_create_conversation,
        line_user_id,
        settings.clinic_id,
        profile.get("displayName", ""),
        profile.get("pictureUrl", ""),
    )

    welcome = f"ยินดีต้อนรับสู่หมอนัด!\n\n{_MENU}"
    await reply_text(event.reply_token, welcome)
    await asyncio.to_thread(repo.record_outbound_message, line_user_id, "ai", welcome)


async def _on_text(event: MessageEvent) -> None:
    line_user_id = event.source.user_id
    text = event.message.text.strip()

    convo = await asyncio.to_thread(repo.get_conversation, line_user_id)
    if convo is None:
        profile = await get_profile(line_user_id)
        await asyncio.to_thread(
            repo.get_or_create_conversation,
            line_user_id,
            settings.clinic_id,
            profile.get("displayName", ""),
            profile.get("pictureUrl", ""),
        )

    result = await process_inbound_text(line_user_id, text)
    if result["replied"]:
        await reply_text(event.reply_token, result["reply"])


async def process_inbound_text(
    line_user_id: str, text: str, clinic_id: str | None = None
) -> dict:
    """Core mode-switch + reply logic, independent of how the message arrived
    (real LINE webhook vs. the DEBUG_MODE-only simulate endpoint in chat.py).

    Logs the inbound message, resolves AI/admin mode, and — only when AI is
    in control — generates and logs a reply. Returns {"replied", "mode", "reply"}
    without sending anything over LINE; callers decide how to deliver `reply`.
    """
    cid = clinic_id or settings.clinic_id

    convo = await asyncio.to_thread(repo.get_conversation, line_user_id)
    if convo is None:
        convo = await asyncio.to_thread(repo.get_or_create_conversation, line_user_id, cid)

    await asyncio.to_thread(repo.record_inbound_message, line_user_id, text)

    # A resolved thread getting a new question is treated as fresh — AI takes it.
    if convo["status"] == "resolved":
        convo = await asyncio.to_thread(repo.reopen_conversation_as_ai, line_user_id)

    if convo["mode"] == "admin":
        # A human is handling this conversation — stay quiet. If the admin
        # never answers, /internal/chat/check-timeouts hands it back to AI.
        return {"replied": False, "mode": "admin", "reply": None}

    reply = await _generate_ai_reply(line_user_id, cid, text)
    await asyncio.to_thread(repo.record_outbound_message, line_user_id, "ai", reply)
    return {"replied": True, "mode": "ai", "reply": reply}


async def _generate_ai_reply(line_user_id: str, clinic_id: str, text: str) -> str:
    lower = text.lower()

    if lower in _BOOK_KEYWORDS:
        if settings.liff_url and settings.clinic_id:
            url = f"{settings.liff_url}?clinicId={settings.clinic_id}"
            return f"กดลิงก์ด้านล่างเพื่อจองคิว:\n{url}"
        return "ระบบกำลังเตรียมพร้อม กรุณารอสักครู่"

    if lower in _STATUS_KEYWORDS:
        bookings = await asyncio.to_thread(repo.get_patient_bookings, line_user_id)
        if not bookings:
            return "ไม่พบคิวที่รอรับบริการในขณะนี้\n\nพิมพ์ 'จอง' เพื่อจองคิวใหม่"
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
        return "\n\n".join(lines)

    reply, needs_human = await ai_chat.generate_reply(line_user_id, clinic_id, text)
    if needs_human:
        await asyncio.to_thread(repo.set_needs_attention, line_user_id, True)
        try:
            await send_line_notify(f"[AI ต้องการเจ้าหน้าที่] {line_user_id}: {text}")
        except Exception as e:
            print(f"[WEBHOOK] send_line_notify failed (non-fatal): {e}")
    return reply


async def check_admin_timeouts() -> int:
    """Sweep admin-mode conversations with an inbound message the admin never
    answered within CHAT_ADMIN_TIMEOUT_MINUTES: hand each back to AI and have
    it answer the message that was left hanging. Called periodically via
    POST /internal/chat/check-timeouts (see app/routers/internal.py)."""
    overdue = await asyncio.to_thread(
        repo.list_timed_out_admin_conversations, settings.chat_admin_timeout_minutes
    )
    for convo in overdue:
        await _answer_overdue_message(convo)
    return len(overdue)


async def _answer_overdue_message(convo: dict) -> None:
    line_user_id = convo["line_user_id"]
    last_inbound = await asyncio.to_thread(repo.get_last_inbound_message, line_user_id)
    if last_inbound is None:
        return

    await asyncio.to_thread(repo.reopen_conversation_as_ai, line_user_id)
    reply = await _generate_ai_reply(line_user_id, convo["clinic_id"], last_inbound["text"])
    await asyncio.to_thread(repo.record_outbound_message, line_user_id, "ai", reply)
    try:
        await push_text(line_user_id, reply)
    except Exception as e:
        print(f"[WEBHOOK] push_text failed during timeout handback (non-fatal): {e}")
