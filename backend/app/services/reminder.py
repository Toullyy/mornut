"""Reminder service — called by Cloud Scheduler daily at 18:00.

Firestore stream() is synchronous, so it runs in a thread.
LINE push calls are async and awaited on the event loop.
"""
import asyncio
from datetime import date, timedelta

from app.services.firestore import get_db
from app.services.line import push_text


async def send_tomorrow_reminders(clinic_id: str) -> int:
    """Push reminder messages for all confirmed bookings tomorrow.

    Returns the number of reminders sent.
    """
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    docs = await asyncio.to_thread(_query_confirmed, clinic_id, tomorrow)

    count = 0
    for doc in docs:
        data = doc.to_dict()
        text = (
            f"แจ้งเตือน: คุณมีนัดพรุ่งนี้ ({tomorrow}) เวลา {data['time']} น.\n"
            "กรุณาตรงเวลา หากไม่สะดวกกรุณาแจ้งยกเลิกล่วงหน้า"
        )
        await push_text(data["patientLineId"], text)
        await asyncio.to_thread(doc.reference.update, {"status": "reminded"})
        count += 1

    return count


def _query_confirmed(clinic_id: str, date_str: str) -> list:
    return list(
        get_db()
        .collection("bookings")
        .where("clinicId", "==", clinic_id)
        .where("date", "==", date_str)
        .where("status", "==", "confirmed")
        .stream()
    )
