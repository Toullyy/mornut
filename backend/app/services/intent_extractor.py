"""Blueprint §3 — Structured Intent Extraction.

LLM call → fixed JSON schema + confidence score.
- English system prompt (cheaper token cost for Thai input)
- temperature=0.0 (deterministic for booking intents)
- JSON mode enforced
- Provider fallback: OpenAI → DeepSeek (if configured)

The LLM's only job is translating natural language → structured dict.
All workflow decisions happen in booking_flow.py (pure reasoning engine).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from openai import AsyncOpenAI

from app.core.config import settings

_WEEKDAYS_TH = ["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์"]

_SYSTEM = """You are an intent extraction engine for a Thai clinic LINE chatbot.
Your ONLY job: parse Thai text into a JSON object. Make no decisions — just extract.

Context:
  Today: {today} ({weekday})
  Tomorrow: {tomorrow}
  Available services: {services}
  Coverage types: cash (เงินสด), sso (ประกันสังคม), universal (บัตรทอง)

Output ONLY valid JSON with these exact keys:
{{
  "intent": "book|cancel|check_status|ask_info|greeting|offtopic|unknown",
  "confidence": <0.0-1.0>,
  "date": "<YYYY-MM-DD or null>",
  "time": "<HH:MM 24h or null>",
  "service": "<service name from list or null>",
  "coverage": "<cash|sso|universal or null>",
  "patient_name": "<Thai name or null>",
  "phone": "<digits only or null>"
}}

Intent definitions:
- book: patient wants to make/schedule an appointment
- cancel: patient wants to cancel an existing booking
- check_status: patient wants to see their current bookings
- ask_info: patient is asking a question about clinic hours, prices, location, etc.
- greeting: pure greetings or farewells, no action needed
- offtopic: completely unrelated to clinic/booking (weather, news, etc.)
- unknown: cannot determine

Extraction rules:
- date: resolve relative Thai dates using today's date above
  "พรุ่งนี้"=tomorrow, "วันนี้"=today, "วันจันทร์"=next Monday, etc.
- time: resolve Thai time expressions to 24h HH:MM
  "บ่ายสอง"=14:00, "เก้าโมง"=09:00, "บ่ายโมงครึ่ง"=13:30
- service: partial match against available services list; null if not mentioned
- coverage: map Thai terms; null if not mentioned
- patient_name: extract if explicitly given, null otherwise
- phone: digits only (strip dashes/spaces), null if not mentioned
- Unknown field → null, NEVER fabricate a value

Examples:
user: "จองพรุ่งนี้เก้าโมง"
{{"intent":"book","confidence":0.98,"date":"{tomorrow}","time":"09:00","service":null,"coverage":null,"patient_name":null,"phone":null}}

user: "ขอจองตรวจเลือด วันอังคาร บ่ายสอง ประกันสังคม ชื่อ สมชาย 0812345678"
{{"intent":"book","confidence":0.99,"date":null,"time":"14:00","service":"ตรวจเลือด","coverage":"sso","patient_name":"สมชาย","phone":"0812345678"}}

user: "ยกเลิกนัดได้ไหม"
{{"intent":"cancel","confidence":0.90,"date":null,"time":null,"service":null,"coverage":null,"patient_name":null,"phone":null}}

user: "ดูคิวของฉัน"
{{"intent":"check_status","confidence":0.97,"date":null,"time":null,"service":null,"coverage":null,"patient_name":null,"phone":null}}

user: "เปิดกี่โมง"
{{"intent":"ask_info","confidence":0.95,"date":null,"time":null,"service":null,"coverage":null,"patient_name":null,"phone":null}}

user: "สวัสดีครับ"
{{"intent":"greeting","confidence":0.99,"date":null,"time":null,"service":null,"coverage":null,"patient_name":null,"phone":null}}

user: "อยากนวด"
{{"intent":"book","confidence":0.75,"date":null,"time":null,"service":"นวด","coverage":null,"patient_name":null,"phone":null}}
"""


@dataclass
class IntentResult:
    intent: str = "unknown"
    confidence: float = 0.0
    date: Optional[str] = None
    time: Optional[str] = None
    service: Optional[str] = None
    coverage: Optional[str] = None
    patient_name: Optional[str] = None
    phone: Optional[str] = None


def _build_prompt(services: list[dict], today: date) -> str:
    tomorrow = str(today + timedelta(days=1))
    service_list = ", ".join(s["name"] for s in services) if services else "ไม่มีข้อมูล"
    weekday_th = _WEEKDAYS_TH[today.weekday()]
    return _SYSTEM.format(
        today=str(today),
        tomorrow=tomorrow,
        weekday=weekday_th,
        services=service_list,
    )


def _parse_response(data: dict) -> IntentResult:
    return IntentResult(
        intent=str(data.get("intent", "unknown")),
        confidence=float(data.get("confidence", 0.0)),
        date=data.get("date") or None,
        time=data.get("time") or None,
        service=data.get("service") or None,
        coverage=data.get("coverage") or None,
        patient_name=data.get("patient_name") or None,
        phone=str(data["phone"]).strip() if data.get("phone") else None,
    )


async def extract(text: str, services: list[dict], today: date) -> IntentResult:
    """Extract intent and structured fields from Thai text.

    Never raises — returns IntentResult(intent="unknown") on any failure.
    Falls back to DeepSeek if OpenAI fails and deepseek_api_key is configured.
    """
    if not settings.openai_api_key:
        return IntentResult()

    system_prompt = _build_prompt(services, today)

    try:
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        resp = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=250,
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        return _parse_response(data)
    except Exception as e:
        print(f"[INTENT] OpenAI extract failed (non-fatal): {e}")

    # Provider fallback
    if settings.deepseek_api_key:
        return await _extract_fallback(text, system_prompt)

    return IntentResult()


async def _extract_fallback(text: str, system_prompt: str) -> IntentResult:
    """DeepSeek fallback — same prompt, same schema."""
    try:
        client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url="https://api.deepseek.com/v1",
        )
        resp = await client.chat.completions.create(
            model=settings.deepseek_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=250,
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        return _parse_response(data)
    except Exception as e:
        print(f"[INTENT] DeepSeek fallback failed (non-fatal): {e}")
        return IntentResult()
