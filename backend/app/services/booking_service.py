"""Business logic for bookings — database calls run via asyncio.to_thread."""
import asyncio
from datetime import datetime, timezone

from fastapi import HTTPException

from app.models.booking import BookingCreate, BookingOut, BookingUpdate, SlipInfo
from app.services import database as repo
from app.services.line import push_text


async def create(payload: BookingCreate) -> BookingOut:
    doc = {
        "clinicId": payload.clinic_id,
        "patientLineId": payload.patient_line_id,
        "patientName": payload.patient_name,
        "phone": payload.phone,
        "serviceId": payload.service_id,
        "serviceName": payload.service_name,
        "depositAmount": payload.deposit_amount,
        "date": payload.date,
        "time": payload.time,
        "coverage": payload.coverage,
    }
    try:
        booking_id = await asyncio.to_thread(
            repo.create_booking,
            clinic_id=payload.clinic_id,
            date=payload.date,
            time_slot=payload.time,
            coverage=payload.coverage,
            doc=doc,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    raw = await asyncio.to_thread(repo.get_booking, booking_id)
    return _to_out(raw)


async def get(booking_id: str) -> BookingOut:
    raw = await asyncio.to_thread(repo.get_booking, booking_id)
    if raw is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    return _to_out(raw)


async def update(booking_id: str, payload: BookingUpdate) -> BookingOut:
    raw = await asyncio.to_thread(repo.get_booking, booking_id)
    if raw is None:
        raise HTTPException(status_code=404, detail="Booking not found")

    changes: dict = {}
    if payload.status is not None:
        changes["status"] = payload.status
    if payload.slip is not None:
        changes["slip_url"] = payload.slip.url
        changes["slip_verified"] = payload.slip.verified
        changes["slip_amount"] = payload.slip.amount
        changes["slip_trans_ref"] = payload.slip.trans_ref
        changes["slip_verified_at"] = payload.slip.verified_at
    if changes:
        await asyncio.to_thread(repo.update_booking, booking_id, changes)

    raw = await asyncio.to_thread(repo.get_booking, booking_id)
    return _to_out(raw)


async def cancel(booking_id: str) -> None:
    try:
        await asyncio.to_thread(repo.cancel_booking, booking_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    raw = await asyncio.to_thread(repo.get_booking, booking_id)
    if raw:
        await push_text(
            raw["patient_line_id"],
            f"การจองของคุณ ({raw['date']} เวลา {raw['time']} น.) ถูกยกเลิกแล้ว",
        )


# ── Internal helper ───────────────────────────────────────────────────────────

def _to_out(raw: dict) -> BookingOut:
    """Map a DB row (snake_case) to BookingOut."""
    slip = None
    if raw.get("slip_url"):
        slip = SlipInfo(
            url=raw["slip_url"],
            verified=raw.get("slip_verified", False),
            amount=raw.get("slip_amount"),
            trans_ref=raw.get("slip_trans_ref"),
            verified_at=raw.get("slip_verified_at"),
        )
    now = datetime.now(timezone.utc)
    return BookingOut(
        id=str(raw["id"]),
        clinic_id=raw.get("clinic_id", ""),
        patient_line_id=raw.get("patient_line_id", ""),
        patient_name=raw.get("patient_name", ""),
        phone=raw.get("phone", ""),
        service_id=raw.get("service_id", ""),
        service_name=raw.get("service_name", ""),
        deposit_amount=float(raw.get("deposit_amount", 0)),
        date=raw["date"],
        time=raw["time"],
        coverage=raw["coverage"],
        status=raw["status"],
        slip=slip,
        created_at=raw.get("created_at", now),
        updated_at=raw.get("updated_at", now),
    )
