"""AI-generated LINE chat replies — scoped to clinic FAQ/booking help, never medical advice.

Falls back to a safe "staff will follow up" response (with needs_human=True) whenever
OpenAI isn't configured or the call fails, so the webhook never goes silent.
"""
import asyncio
import json

from openai import AsyncOpenAI

from app.core.config import settings
from app.services import database as repo

_HISTORY_LIMIT = 20

_FALLBACK_NOT_CONFIGURED = (
    "ขออภัยค่ะ ระบบ AI ยังไม่พร้อมใช้งาน กรุณาพิมพ์ 'จอง' หรือ 'สถานะ' หรือรอเจ้าหน้าที่ติดต่อกลับ"
)
_FALLBACK_ERROR = "ขออภัยค่ะ ระบบขัดข้องชั่วคราว เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด"

_SYSTEM_PROMPT_TEMPLATE = """You are a Thai clinic LINE chatbot assistant that answers patient questions.

Your duties:
- Answer questions about queue booking, clinic services, and procedures politely and concisely
- Suggest typing 'จอง' to book an appointment or 'สถานะ' to check existing bookings when relevant
- NEVER diagnose illness, give medical advice, or recommend any medication/treatment
- If the question is about symptoms, diagnosis, treatment, complaints, or anything you're unsure of,
  reply politely that staff will follow up and set needs_human to true
- If the question is completely unrelated to the clinic (weather, news, etc.), politely decline and redirect

Clinic services: {services}
{knowledge_section}
Reply ONLY with valid JSON:
{{"reply": "<Thai text to send to patient>", "needs_human": true or false}}
"""

_KNOWLEDGE_SECTION = """Clinic information (use this to answer FAQ accurately):
{knowledge}
"""


async def _build_system_prompt(clinic_id: str) -> str:
    services, clinic_settings = await asyncio.gather(
        asyncio.to_thread(repo.get_services, clinic_id),
        asyncio.to_thread(repo.get_clinic_settings, clinic_id),
    )
    names = ", ".join(s["name"] for s in services) or "ไม่มีข้อมูล"
    knowledge = (clinic_settings or {}).get("ai_knowledge", "").strip()
    knowledge_section = _KNOWLEDGE_SECTION.format(knowledge=knowledge) if knowledge else ""
    return _SYSTEM_PROMPT_TEMPLATE.format(services=names, knowledge_section=knowledge_section)


async def generate_reply(line_user_id: str, clinic_id: str, latest_text: str) -> tuple[str, bool]:
    """Return (reply_text, needs_human)."""
    if not settings.openai_api_key:
        return _FALLBACK_NOT_CONFIGURED, True

    history = await asyncio.to_thread(repo.get_messages, line_user_id, _HISTORY_LIMIT)
    system_prompt = await _build_system_prompt(clinic_id)

    messages = [{"role": "system", "content": system_prompt}]
    for m in history:
        role = "user" if m["direction"] == "in" else "assistant"
        messages.append({"role": role, "content": m["text"]})
    messages.append({"role": "user", "content": latest_text})

    try:
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        resp = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=400,
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        reply = str(data.get("reply", "")).strip()
        needs_human = bool(data.get("needs_human", False))
        if not reply:
            raise ValueError("empty reply from model")
        return reply, needs_human
    except Exception as e:
        print(f"[AI_CHAT] generate_reply failed (non-fatal): {e}")
        return _FALLBACK_ERROR, True
