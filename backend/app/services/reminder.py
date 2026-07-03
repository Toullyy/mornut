"""Reminder service — called by Cloud Scheduler daily at 18:00."""
import asyncio
from datetime import date, timedelta

from app.services import database as repo
from app.services.line import push_text


async def send_tomorrow_reminders(clinic_id: str) -> int:
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    bookings = await asyncio.to_thread(repo.get_confirmed_bookings_for_date, clinic_id, tomorrow)

    count = 0
    for b in bookings:
        text = (
            f"แจ้งเตือน: คุณมีนัดพรุ่งนี้ ({tomorrow}) เวลา {b['time']} น.\n"
            "กรุณาตรงเวลา หากไม่สะดวกกรุณาแจ้งยกเลิกล่วงหน้า"
        )
        await push_text(b["patient_line_id"], text)
        await asyncio.to_thread(repo.mark_reminded, b["id"])
        count += 1

    return count
