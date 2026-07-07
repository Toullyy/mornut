"""Internal routes called by Cloud Scheduler — not exposed to patients or admins."""
import asyncio

from fastapi import APIRouter, Header, HTTPException

from app.core.config import settings
from app.routers import booking_reminders
from app.services import database as repo
from app.services import reminder, webhook_handler
from app.services import line as line_svc

router = APIRouter()


def _check_scheduler_secret(authorization: str) -> None:
    # Validate shared secret when SCHEDULER_SECRET is configured.
    # Leave SCHEDULER_SECRET empty in local dev to skip this check.
    if settings.scheduler_secret and authorization != f"Bearer {settings.scheduler_secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/remind/{clinic_id}")
async def trigger_reminder(
    clinic_id: str,
    authorization: str = Header(...),
) -> dict:
    _check_scheduler_secret(authorization)
    count = await reminder.send_tomorrow_reminders(clinic_id)
    return {"clinic_id": clinic_id, "reminders_sent": count}


@router.post("/chat/check-timeouts")
async def check_chat_timeouts(authorization: str = Header(...)) -> dict:
    """Call periodically (e.g. every 5 min via Cloud Scheduler) to hand
    admin-mode conversations back to AI once CHAT_ADMIN_TIMEOUT_MINUTES has
    passed without an admin reply."""
    _check_scheduler_secret(authorization)
    count = await webhook_handler.check_admin_timeouts()
    return {"handed_back_to_ai": count}


@router.post("/booking-reminders/check/{clinic_id}")
async def check_booking_reminders(
    clinic_id: str,
    authorization: str = Header(...),
) -> dict:
    """Call periodically (e.g. daily via Cloud Scheduler) to push a LINE nudge
    to every patient whose recurring reminder is due today."""
    _check_scheduler_secret(authorization)
    count = await booking_reminders.send_due_reminders(clinic_id)
    return {"clinic_id": clinic_id, "reminders_sent": count}


@router.post("/cancel-expired/{clinic_id}")
async def cancel_expired_bookings(
    clinic_id: str,
    authorization: str = Header(...),
) -> dict:
    """Cancel pending_slip bookings older than the clinic's cancel_ttl_minutes.
    Call every ~5 min via Cloud Scheduler. Pushes a LINE cancel notice to each patient."""
    _check_scheduler_secret(authorization)
    settings_row = await asyncio.to_thread(repo.get_clinic_settings, clinic_id)
    ttl = settings_row.get("cancel_ttl_minutes", 15) if settings_row else 15

    cancelled = await asyncio.to_thread(repo.cancel_expired_pending_slip, clinic_id, ttl)

    for row in cancelled:
        line_id = row.get("patient_line_id", "")
        if not line_id or line_id == "walk-in":
            continue
        try:
            await line_svc.push_booking_cancelled(
                user_id=line_id,
                booking_id=row["id"],
                patient_name=row.get("patient_name", ""),
                date=str(row.get("date", "")),
                time=str(row.get("time", ""))[:5],
                service_name=row.get("service_name", ""),
            )
        except Exception as e:
            print(f"[INTERNAL] cancel push failed for {row['id']} (non-fatal): {e}")

    return {"clinic_id": clinic_id, "cancelled": len(cancelled)}
