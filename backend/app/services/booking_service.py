"""Business logic for bookings.

All Firestore calls (sync) are run via asyncio.to_thread so the event loop
is never blocked. LINE API calls (async) are awaited directly.
"""
import asyncio
from datetime import datetime, timezone

from fastapi import HTTPException

from app.models.booking import BookingCreate, BookingOut, BookingUpdate, SlipInfo
from app.services import firestore as repo
from app.services.line import push_text


async def create(payload: BookingCreate) -> BookingOut:
    doc = {
        "clinicId": payload.clinic_id,
        "patientLineId": payload.patient_line_id,
        "patientName": payload.patient_name,
        "phone": payload.phone,
        "serviceId": payload.service_id,
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
        changes["slip"] = {
            "url": payload.slip.url,
            "verified": payload.slip.verified,
            "amount": payload.slip.amount,
            "transRef": payload.slip.trans_ref,
            "verifiedAt": payload.slip.verified_at,
        }
    if changes:
        await asyncio.to_thread(repo.update_booking, booking_id, changes)

    raw = await asyncio.to_thread(repo.get_booking, booking_id)
    return _to_out(raw)


async def cancel(booking_id: str) -> None:
    try:
        await asyncio.to_thread(repo.cancel_booking, booking_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Notify the patient their booking was cancelled
    raw = await asyncio.to_thread(repo.get_booking, booking_id)
    if raw:
        await push_text(
            raw["patientLineId"],
            f"การจองของคุณ ({raw['date']} เวลา {raw['time']} น.) ถูกยกเลิกแล้ว",
        )


# ── Internal helper ───────────────────────────────────────────────────────────

def _to_out(raw: dict) -> BookingOut:
    """Map a Firestore document (camelCase) to BookingOut (snake_case)."""
    slip_raw = raw.get("slip")
    slip = None
    if slip_raw:
        slip = SlipInfo(
            url=slip_raw.get("url", ""),
            verified=slip_raw.get("verified", False),
            amount=slip_raw.get("amount"),
            trans_ref=slip_raw.get("transRef"),
            verified_at=slip_raw.get("verifiedAt"),
        )
    now = datetime.now(timezone.utc)
    return BookingOut(
        id=raw["id"],
        clinic_id=raw.get("clinicId", ""),
        patient_line_id=raw.get("patientLineId", ""),
        patient_name=raw.get("patientName", ""),
        phone=raw.get("phone", ""),
        service_id=raw.get("serviceId", ""),
        date=raw["date"],
        time=raw["time"],
        coverage=raw["coverage"],
        status=raw["status"],
        slip=slip,
        created_at=raw.get("createdAt", now),
        updated_at=raw.get("updatedAt", now),
    )
