"""Admin-facing chat inbox: view LINE conversations, reply as a human (overriding
AI), resolve threads, and manually hand a conversation back to AI.
"""
import asyncio
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import get_admin_user
from app.services import database as repo
from app.services import webhook_handler
from app.services.line import push_text

router = APIRouter()

AdminUser = Annotated[dict, Depends(get_admin_user)]


def _conversation_out(row: dict) -> dict:
    return {
        "line_user_id": row["line_user_id"],
        "display_name": row["display_name"],
        "picture_url": row["picture_url"],
        "mode": row["mode"],
        "status": row["status"],
        "needs_attention": row["needs_attention"],
        "last_message_at": row["last_message_at"],
        "last_message_preview": row["last_message_preview"],
        "unread_count": row["unread_count"],
    }


def _message_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "direction": row["direction"],
        "sender": row["sender"],
        "text": row["text"],
        "created_at": row["created_at"],
    }


@router.get("/conversations")
async def list_conversations(clinic_id: str = "", _admin: AdminUser = None) -> list[dict]:
    cid = clinic_id or settings.clinic_id
    rows = await asyncio.to_thread(repo.list_conversations, cid)
    return [_conversation_out(r) for r in rows]


@router.get("/conversations/{line_user_id}/messages")
async def get_messages(line_user_id: str, _admin: AdminUser = None) -> list[dict]:
    rows = await asyncio.to_thread(repo.get_messages, line_user_id, 200)
    return [_message_out(r) for r in rows]


class AdminMessage(BaseModel):
    text: str


@router.post("/conversations/{line_user_id}/messages")
async def send_admin_message(
    line_user_id: str, body: AdminMessage, _admin: AdminUser = None
) -> dict:
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="ข้อความว่างเปล่า")

    convo = await asyncio.to_thread(repo.get_conversation, line_user_id)
    if convo is None:
        raise HTTPException(status_code=404, detail="ไม่พบการสนทนานี้")

    if not settings.debug_mode:
        try:
            await push_text(line_user_id, text)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"LINE API error: {e}")

    await asyncio.to_thread(repo.record_outbound_message, line_user_id, "admin", text)
    row = await asyncio.to_thread(repo.set_conversation_admin_reply, line_user_id)
    return _conversation_out(row)


@router.post("/conversations/{line_user_id}/resolve")
async def resolve_conversation(line_user_id: str, _admin: AdminUser = None) -> dict:
    convo = await asyncio.to_thread(repo.get_conversation, line_user_id)
    if convo is None:
        raise HTTPException(status_code=404, detail="ไม่พบการสนทนานี้")
    row = await asyncio.to_thread(repo.resolve_conversation, line_user_id)
    return _conversation_out(row)


class ModeUpdate(BaseModel):
    mode: Literal["ai", "admin"]


@router.post("/conversations/{line_user_id}/mode")
async def set_mode(line_user_id: str, body: ModeUpdate, _admin: AdminUser = None) -> dict:
    convo = await asyncio.to_thread(repo.get_conversation, line_user_id)
    if convo is None:
        raise HTTPException(status_code=404, detail="ไม่พบการสนทนานี้")

    if body.mode == "ai":
        row = await asyncio.to_thread(repo.reopen_conversation_as_ai, line_user_id)
    else:
        row = await asyncio.to_thread(repo.set_conversation_mode, line_user_id, "admin")
    return _conversation_out(row)


# ── Local dev only: simulate an inbound LINE text message ─────────────────────
# Lets us exercise the AI/admin mode-switch logic without a live LINE channel.

class SimulateMessage(BaseModel):
    line_user_id: str
    text: str
    clinic_id: str = ""


@router.post("/debug/simulate-message")
async def simulate_message(body: SimulateMessage) -> dict:
    if not settings.debug_mode:
        raise HTTPException(status_code=403, detail="Only available in debug mode")

    result = await webhook_handler.process_inbound_text(
        body.line_user_id, body.text, body.clinic_id or settings.clinic_id
    )
    return result
