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

_SYSTEM_PROMPT_TEMPLATE = """คุณคือผู้ช่วย AI ของคลินิกที่ตอบแชทลูกค้าทาง LINE

หน้าที่ของคุณ:
- ตอบคำถามทั่วไปเกี่ยวกับการจองคิว, บริการของคลินิก, และขั้นตอนต่างๆ อย่างสุภาพและกระชับ
- แนะนำให้พิมพ์ 'จอง' เพื่อรับลิงก์จองคิว หรือ 'สถานะ' เพื่อตรวจสอบคิวที่จองไว้ เมื่อเกี่ยวข้อง
- ห้ามวินิจฉัยโรค ให้คำแนะนำทางการแพทย์ หรือแนะนำยา/การรักษาใดๆ โดยเด็ดขาด
- หากคำถามเกี่ยวกับอาการป่วย การวินิจฉัย การรักษา ข้อร้องเรียน หรือเรื่องที่คุณไม่มั่นใจ
  ให้ตอบอย่างสุภาพว่าเจ้าหน้าที่จะติดต่อกลับ และตั้งค่า needs_human เป็น true

บริการที่คลินิกมี: {services}

ตอบกลับเป็น JSON เท่านั้น รูปแบบ:
{{"reply": "<ข้อความภาษาไทยที่จะส่งหาผู้ป่วย>", "needs_human": true หรือ false}}
"""


async def _build_system_prompt(clinic_id: str) -> str:
    services = await asyncio.to_thread(repo.get_services, clinic_id)
    names = ", ".join(s["name"] for s in services) or "ไม่มีข้อมูล"
    return _SYSTEM_PROMPT_TEMPLATE.format(services=names)


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
