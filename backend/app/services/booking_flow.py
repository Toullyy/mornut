"""Blueprint §4 + §5 — Conversational Booking Flow.

State Machine (§4):
  State persisted as JSONB columns on chat_conversations.
  Auto-expires after FLOW_EXPIRE_MINUTES of inactivity.
  States: bk_active | bk_confirm

Reasoning Engine (§5) — decide() is a PURE FUNCTION:
  No I/O, no LLM calls. Takes accumulator + context dicts, returns ReasoningDecision.
  Testable with golden tests without DB or OpenAI.

Orchestrator — handle_message():
  Phase 1: DB Prep  — fetch slots, services, clinic settings
  Phase 2: Decide   — call pure decide()
  Phase 3: Response — map decision to Thai text

Returns None if message is not a booking intent (caller handles via general AI chat).
"""
from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from app.core.config import settings
from app.services import database as repo
from app.services import intent_extractor, intent_normalizer, thai_optimizer

_FLOW_EXPIRE_MINUTES = 30
_COVERAGE_TH = {"cash": "เงินสด", "sso": "ประกันสังคม", "universal": "บัตรทอง"}
_THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")


# ── §5 Reasoning Engine (pure) ────────────────────────────────────────────────

@dataclass
class ReasoningDecision:
    action: str  # ask_date|ask_time|ask_service|ask_coverage|ask_name|ask_phone|confirm|no_slots|slot_full
    available_slots: list[str] = field(default_factory=list)
    services: list[dict] = field(default_factory=list)
    coverage_options: list[str] = field(default_factory=list)


def decide(
    bk: dict,
    slots: dict,          # {"09:00": {"capacity": 2, "reserved": 1}, ...}
    services: list[dict], # [{"id": "...", "name": "...", "deposit_amount": ...}, ...]
    clinic_settings: dict,
) -> ReasoningDecision:
    """Pure function: given accumulator + context, decide the next step.

    No I/O. No LLM. Fully testable with golden tests.
    Field collection order: date → time → service → coverage → name → phone → confirm
    """
    # ── 1. Need a date ────────────────────────────────────────────────────────
    if not bk.get("date"):
        return ReasoningDecision(action="ask_date")

    # ── 2. Check available slots for this date ────────────────────────────────
    available = [t for t, s in sorted(slots.items()) if s["capacity"] > s["reserved"]]
    if not available:
        return ReasoningDecision(action="no_slots")

    # ── 3. Need a time ────────────────────────────────────────────────────────
    if not bk.get("time"):
        return ReasoningDecision(action="ask_time", available_slots=available)

    # ── 4. Validate time is still available ──────────────────────────────────
    if bk["time"] not in available:
        return ReasoningDecision(action="slot_full", available_slots=available)

    # ── 5. Need a service (skip if clinic has no services configured) ─────────
    if not bk.get("service_id") and services:
        return ReasoningDecision(action="ask_service", services=services)

    # ── 6. Need coverage type ─────────────────────────────────────────────────
    if not bk.get("coverage"):
        options = _get_coverage_options(clinic_settings)
        return ReasoningDecision(action="ask_coverage", coverage_options=options)

    # ── 7. Need patient name ──────────────────────────────────────────────────
    if not bk.get("patient_name"):
        return ReasoningDecision(action="ask_name")

    # ── 8. Need phone ─────────────────────────────────────────────────────────
    if not bk.get("phone"):
        return ReasoningDecision(action="ask_phone")

    # ── 9. All collected → confirm ────────────────────────────────────────────
    return ReasoningDecision(action="confirm")


def _get_coverage_options(clinic_settings: dict) -> list[str]:
    """Return coverage types that are enabled in clinic settings."""
    opts: list[str] = ["cash"]  # cash always available
    if clinic_settings.get("sso_enabled", True):
        opts.append("sso")
    if clinic_settings.get("universal_enabled", True):
        opts.append("universal")
    return opts


# ── §5 Phase 3: Response Map ─────────────────────────────────────────────────

def _format_slot_list(slots: list[str]) -> str:
    lines = ["⏰ เลือกเวลานัดหมาย:\n" + "─" * 20]
    for i, t in enumerate(slots, 1):
        lines.append(f"  {i}. {t} น.")
    lines.append("\nพิมพ์หมายเลข หรือพิมพ์เวลาที่ต้องการ")
    return "\n".join(lines)


def _format_service_list(services: list[dict]) -> str:
    lines = ["🏥 เลือกบริการ:\n" + "─" * 20]
    for i, s in enumerate(services, 1):
        dep = s.get("deposit_amount", 0)
        dep_str = f" (มัดจำ {float(dep):.0f} บ.)" if dep and float(dep) > 0 else ""
        lines.append(f"  {i}. {s['name']}{dep_str}")
    lines.append("\nพิมพ์หมายเลข หรือชื่อบริการ")
    return "\n".join(lines)


def _format_coverage_list(options: list[str]) -> str:
    lines = ["💳 สิทธิ์การรักษา:\n" + "─" * 20]
    for i, opt in enumerate(options, 1):
        lines.append(f"  {i}. {_COVERAGE_TH.get(opt, opt)}")
    lines.append("\nพิมพ์หมายเลขหรือชื่อสิทธิ์")
    return "\n".join(lines)


def _format_confirm_card(bk: dict) -> str:
    svc = bk.get("service_name") or bk.get("service_id") or "-"
    cov = _COVERAGE_TH.get(bk.get("coverage", ""), bk.get("coverage", "-"))
    return (
        "📋 สรุปการจอง\n" + "─" * 20 + "\n"
        f"📅 วันที่:  {bk.get('date', '-')}\n"
        f"⏰ เวลา:   {bk.get('time', '-')} น.\n"
        f"🏥 บริการ: {svc}\n"
        f"💳 สิทธิ์: {cov}\n"
        f"👤 ชื่อ:   {bk.get('patient_name', '-')}\n"
        f"📱 โทร:   {bk.get('phone', '-')}\n"
        + "─" * 20 + "\n"
        "ยืนยันการจองหรือไม่?\n"
        "พิมพ์ 'ยืนยัน' หรือ 'ยกเลิก'"
    )


def _decision_to_response(decision: ReasoningDecision, bk: dict) -> str:
    a = decision.action
    if a == "ask_date":
        return "📅 ต้องการจองวันไหนครับ?\n(เช่น พรุ่งนี้, วันจันทร์, 28/7)"
    if a == "no_slots":
        d = bk.get("date", "วันที่เลือก")
        return f"ขออภัยค่ะ วันที่ {d} ไม่มีช่องว่างแล้ว\nกรุณาเลือกวันอื่นได้เลยครับ"
    if a == "ask_time":
        return _format_slot_list(decision.available_slots)
    if a == "slot_full":
        t = bk.get("time", "")
        return f"ขออภัยค่ะ เวลา {t} น. เต็มแล้ว\n\n" + _format_slot_list(decision.available_slots)
    if a == "ask_service":
        return _format_service_list(decision.services)
    if a == "ask_coverage":
        return _format_coverage_list(decision.coverage_options)
    if a == "ask_name":
        return "👤 กรุณาแจ้งชื่อ-นามสกุลของคุณครับ"
    if a == "ask_phone":
        return "📱 กรุณาแจ้งหมายเลขโทรศัพท์ของคุณครับ"
    if a == "confirm":
        return _format_confirm_card(bk)
    return "ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"


# ── §4 State Persistence ──────────────────────────────────────────────────────

def _is_expired(bk: dict) -> bool:
    """Check if the flow's last update timestamp has exceeded the expiry window."""
    from datetime import datetime, timezone
    updated_raw = bk.get("_updated_at")
    if not updated_raw:
        return False
    try:
        updated = datetime.fromisoformat(updated_raw)
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - updated).total_seconds()
        return age > _FLOW_EXPIRE_MINUTES * 60
    except Exception:
        return False


def _jsonable(obj):
    """Recursively convert non-JSON-serializable types (e.g. Decimal) to float."""
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_jsonable(i) for i in obj]
    try:
        float(obj)
        return float(obj)
    except (TypeError, ValueError):
        return obj


# ── Accumulator helpers ───────────────────────────────────────────────────────

def _resolve_service(text: str, services: list[dict]) -> Optional[dict]:
    """Fuzzy-match service name by exact, then contains."""
    t = text.strip().lower()
    for s in services:
        if s["id"].lower() == t or s["name"].lower() == t:
            return s
    for s in services:
        if t in s["name"].lower() or s["name"].lower() in t:
            return s
    return None


def _resolve_coverage(text: str, options: list[str]) -> Optional[str]:
    mapping = {
        "เงินสด": "cash", "cash": "cash",
        "ประกันสังคม": "sso", "ประกัน": "sso", "sso": "sso",
        "บัตรทอง": "universal", "universal": "universal", "uc": "universal",
    }
    t = text.strip().lower()
    for k, v in mapping.items():
        if k in t and v in options:
            return v
    return None


def _parse_number(text: str) -> Optional[int]:
    """Parse '1', '2', ... from user input. Returns 1-based int or None."""
    cleaned = text.translate(_THAI_DIGITS).strip()
    if re.fullmatch(r"\d+", cleaned):
        return int(cleaned)
    return None


def _merge(bk: dict, intent_result, extracted: dict, text: str,
           services: list[dict], coverage_options: list[str]) -> dict:
    """Merge bypass-extracted + LLM-extracted fields into accumulator.

    Existing fields are never overwritten (first value wins).
    Pending lists (_pending_*) enable numbered selection next turn.
    """
    bk = dict(bk)

    # Bypass layer results
    for key in ("date", "time"):
        if not bk.get(key) and extracted.get(key):
            bk[key] = extracted[key]

    # LLM results
    if intent_result:
        for key in ("date", "time", "patient_name"):
            if not bk.get(key) and getattr(intent_result, key, None):
                bk[key] = getattr(intent_result, key)

        if not bk.get("phone") and intent_result.phone:
            digits = re.sub(r"[^\d]", "", intent_result.phone)
            if 9 <= len(digits) <= 10:
                bk["phone"] = digits

        if not bk.get("service_id") and intent_result.service:
            svc = _resolve_service(intent_result.service, services)
            if svc:
                bk["service_id"] = svc["id"]
                bk["service_name"] = svc["name"]
                bk["deposit_amount"] = float(svc.get("deposit_amount") or 0)

        if not bk.get("coverage") and intent_result.coverage:
            if intent_result.coverage in coverage_options:
                bk["coverage"] = intent_result.coverage

    # Numbered selection from pending lists
    n = _parse_number(text)

    if n is not None and not bk.get("time") and bk.get("_pending_slots"):
        idx = n - 1
        if 0 <= idx < len(bk["_pending_slots"]):
            bk["time"] = bk["_pending_slots"][idx]

    if n is not None and not bk.get("service_id") and bk.get("_pending_services"):
        idx = n - 1
        if 0 <= idx < len(bk["_pending_services"]):
            svc = bk["_pending_services"][idx]
            bk["service_id"] = svc["id"]
            bk["service_name"] = svc["name"]
            bk["deposit_amount"] = float(svc.get("deposit_amount") or 0)
    elif not bk.get("service_id") and bk.get("_pending_services"):
        svc = _resolve_service(text, bk["_pending_services"])
        if svc:
            bk["service_id"] = svc["id"]
            bk["service_name"] = svc["name"]
            bk["deposit_amount"] = float(svc.get("deposit_amount") or 0)

    if not bk.get("coverage") and bk.get("_pending_coverage"):
        if n is not None:
            idx = n - 1
            if 0 <= idx < len(bk["_pending_coverage"]):
                bk["coverage"] = bk["_pending_coverage"][idx]
        if not bk.get("coverage"):
            resolved = _resolve_coverage(text, coverage_options)
            if resolved:
                bk["coverage"] = resolved

    # Free-text capture for name/phone (only when explicitly asking for them)
    norm = intent_normalizer.normalize_in_flow(text)
    if not bk.get("patient_name") and bk.get("_asking") == "name":
        if norm in ("UNCERTAIN",) or norm.startswith("SELECT_"):
            cleaned = text.strip()
            if 2 <= len(cleaned) <= 60:
                bk["patient_name"] = cleaned

    if not bk.get("phone") and bk.get("_asking") == "phone":
        if norm in ("UNCERTAIN",) or norm.startswith("SELECT_"):
            digits = re.sub(r"[^\d]", "", text.translate(_THAI_DIGITS))
            if 9 <= len(digits) <= 10:
                bk["phone"] = digits

    return bk


# ── §5 Phase 1 + 2 + 3: Orchestrated step ────────────────────────────────────

async def _run_decide_and_respond(
    line_user_id: str, bk: dict, clinic_id: str, services: list[dict]
) -> str:
    """Phase 1: DB Prep → Phase 2: decide() → Phase 3: build response + save state."""
    # Phase 1 — DB Prep
    slots: dict = {}
    if bk.get("date"):
        slots = await asyncio.to_thread(repo.get_slots, clinic_id, bk["date"])
    clinic_settings = await asyncio.to_thread(repo.get_clinic_settings, clinic_id) or {}

    # Phase 2 — Decide (pure)
    decision = decide(bk, slots, services, clinic_settings)

    # Update pending lists and context hints in accumulator
    for key in ("_pending_slots", "_pending_services", "_pending_coverage", "_asking"):
        bk.pop(key, None)

    if decision.action == "confirm":
        await asyncio.to_thread(repo.save_booking_flow, line_user_id, "bk_confirm", _jsonable(bk))
        return _format_confirm_card(bk)

    if decision.action == "no_slots":
        response = _decision_to_response(decision, bk)
        bk.pop("date", None)
        bk.pop("time", None)
        await asyncio.to_thread(repo.save_booking_flow, line_user_id, "bk_active", _jsonable(bk))
        return response

    if decision.action == "slot_full":
        response = _decision_to_response(decision, bk)
        bk.pop("time", None)
        bk["_pending_slots"] = decision.available_slots
        await asyncio.to_thread(repo.save_booking_flow, line_user_id, "bk_active", _jsonable(bk))
        return response

    if decision.action == "ask_time":
        bk["_pending_slots"] = decision.available_slots
    elif decision.action == "ask_service":
        bk["_pending_services"] = _jsonable(decision.services)
    elif decision.action == "ask_coverage":
        bk["_pending_coverage"] = decision.coverage_options
    elif decision.action == "ask_name":
        bk["_asking"] = "name"
    elif decision.action == "ask_phone":
        bk["_asking"] = "phone"

    await asyncio.to_thread(repo.save_booking_flow, line_user_id, "bk_active", _jsonable(bk))
    return _decision_to_response(decision, bk)


# ── Orchestrator entry point ──────────────────────────────────────────────────

async def handle_message(line_user_id: str, text: str, clinic_id: str) -> Optional[str]:
    """Main entry point for the booking flow.

    Returns a reply string if the booking flow handled this message,
    or None if the message should fall through to the general AI chat.
    """
    today = date.today()

    # ── Load persisted state ──────────────────────────────────────────────────
    flow_state, bk = await asyncio.to_thread(repo.get_booking_flow, line_user_id)

    # Check expiry (DB-level updated_at handled by get_booking_flow column;
    # we also check bk["_updated_at"] if stored)
    if flow_state and _is_expired(bk):
        await asyncio.to_thread(repo.clear_booking_flow, line_user_id)
        flow_state, bk = None, {}

    # ── CANCEL is always highest priority ────────────────────────────────────
    if flow_state:
        compressed = thai_optimizer.compress(text)
        norm = intent_normalizer.normalize_in_flow(compressed)
        if norm == "CANCEL":
            await asyncio.to_thread(repo.clear_booking_flow, line_user_id)
            return "ยกเลิกการจองแล้วครับ 😊\nหากต้องการจองใหม่ พิมพ์ 'จอง' ได้เลย"

    services = await asyncio.to_thread(repo.get_services, clinic_id)

    # ── No active flow: classify intent ──────────────────────────────────────
    if flow_state is None:
        compressed = thai_optimizer.compress(text)
        extracted = thai_optimizer.bypass_extract(compressed, today)
        intent_result = await intent_extractor.extract(compressed, services, today)

        if intent_result.intent == "book" and intent_result.confidence >= 0.65:
            clinic_settings = await asyncio.to_thread(repo.get_clinic_settings, clinic_id) or {}
            coverage_options = _get_coverage_options(clinic_settings)
            bk = _merge({}, intent_result, extracted, text, services, coverage_options)
            return await _run_decide_and_respond(line_user_id, bk, clinic_id, services)

        # Not a booking intent → fall through
        return None

    # ── Active flow: bk_confirm ───────────────────────────────────────────────
    if flow_state == "bk_confirm":
        compressed = thai_optimizer.compress(text)
        norm = intent_normalizer.normalize_in_flow(compressed)

        if norm == "CONFIRM":
            return await _complete_booking(line_user_id, bk, clinic_id)

        if norm == "MODIFY":
            await asyncio.to_thread(repo.save_booking_flow, line_user_id, "bk_active", _jsonable(bk))
            return "ต้องการแก้ไขอะไรครับ? (เช่น วันที่, เวลา, บริการ, สิทธิ์, ชื่อ, โทรศัพท์)"

        # UNCERTAIN or anything else → repeat confirm card
        return _format_confirm_card(bk) + "\n\n(พิมพ์ 'ยืนยัน' เพื่อยืนยัน หรือ 'ยกเลิก' เพื่อยกเลิก)"

    # ── Active flow: bk_active ────────────────────────────────────────────────
    compressed = thai_optimizer.compress(text)
    extracted = thai_optimizer.bypass_extract(compressed, today)
    clinic_settings = await asyncio.to_thread(repo.get_clinic_settings, clinic_id) or {}
    coverage_options = _get_coverage_options(clinic_settings)

    # Only call LLM if there are still missing fields
    intent_result = None
    needs_all = ("date", "time", "service_id", "coverage", "patient_name", "phone")
    if not all(bk.get(f) for f in needs_all):
        intent_result = await intent_extractor.extract(compressed, services, today)

    bk = _merge(bk, intent_result, extracted, text, services, coverage_options)
    return await _run_decide_and_respond(line_user_id, bk, clinic_id, services)


async def _complete_booking(line_user_id: str, bk: dict, clinic_id: str) -> str:
    """Create the booking in DB and clear flow state."""
    try:
        doc = {
            "clinic_id": clinic_id,
            "patient_line_id": line_user_id,
            "patient_name": bk.get("patient_name", ""),
            "phone": bk.get("phone", ""),
            "service_id": bk.get("service_id", ""),
            "service_name": bk.get("service_name", ""),
            "deposit_amount": float(bk.get("deposit_amount", 0)),
            "date": bk["date"],
            "time": bk["time"],
            "coverage": bk["coverage"],
        }
        await asyncio.to_thread(
            repo.create_booking,
            clinic_id=clinic_id,
            date=bk["date"],
            time_slot=bk["time"],
            coverage=bk["coverage"],
            doc=doc,
        )
        await asyncio.to_thread(repo.clear_booking_flow, line_user_id)
        svc = bk.get("service_name", "")
        cov = _COVERAGE_TH.get(bk.get("coverage", ""), bk.get("coverage", ""))
        return (
            f"✅ จองสำเร็จแล้วครับ!\n"
            f"📅 {bk['date']}  ⏰ {bk['time']} น.\n"
            f"🏥 {svc}\n"
            f"💳 {cov}\n"
            f"👤 {bk.get('patient_name', '')}\n\n"
            f"กรุณามาตรงเวลานะครับ ขอบคุณที่ใช้บริการ 🙏"
        )
    except ValueError as e:
        await asyncio.to_thread(repo.clear_booking_flow, line_user_id)
        return f"ขออภัยครับ {e}\n\nพิมพ์ 'จอง' เพื่อเริ่มใหม่"
    except Exception as e:
        print(f"[BOOKING_FLOW] create_booking failed: {e}")
        await asyncio.to_thread(repo.clear_booking_flow, line_user_id)
        return "ขออภัยครับ เกิดข้อผิดพลาดในการจอง กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่"
