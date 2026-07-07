"""Appointment reminder service — called by Cloud Scheduler or admin manual trigger."""
import asyncio
from datetime import date, timedelta

from app.services import database as repo
from app.services.line import push_appointment_reminder


async def send_appointment_reminders(clinic_id: str, days_before: int = 1) -> int:
    """Push a Flex reminder to every confirmed patient whose appointment is
    `days_before` days from today. Returns the number of messages sent."""
    target_date = (date.today() + timedelta(days=days_before)).isoformat()
    bookings = await asyncio.to_thread(
        repo.get_confirmed_bookings_for_date, clinic_id, target_date
    )

    count = 0
    for b in bookings:
        line_id = b.get("patient_line_id", "")
        if not line_id or line_id == "walk-in":
            continue
        try:
            await push_appointment_reminder(
                user_id=line_id,
                booking_id=b["id"],
                patient_name=b["patient_name"],
                date=target_date,
                time=b["time"],
                service_name=b["service_name"],
                days_before=days_before,
            )
            await asyncio.to_thread(repo.mark_reminded, b["id"])
            count += 1
        except Exception as e:
            print(f"[REMINDER] push failed for booking {b['id']} (non-fatal): {e}")

    return count


async def send_reminders_from_settings(clinic_id: str) -> int:
    """Read reminder config from clinic_settings, then send if enabled."""
    row = await asyncio.to_thread(repo.get_clinic_settings, clinic_id)
    if row and not row.get("reminder_enabled", True):
        return 0
    days_before = row.get("reminder_days_before", 1) if row else 1
    return await send_appointment_reminders(clinic_id, days_before)


# Backward-compatible alias used by internal.py scheduler endpoint
async def send_tomorrow_reminders(clinic_id: str) -> int:
    return await send_reminders_from_settings(clinic_id)
