from datetime import date, timedelta

from app.services.firestore import get_db
from app.services.line import push_text


async def send_tomorrow_reminders(clinic_id: str) -> int:
    """Push reminder messages for all confirmed bookings tomorrow.

    Called by Cloud Scheduler (POST /internal/remind) daily at 18:00.
    Returns the number of reminders sent.
    """
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    db = get_db()

    docs = (
        db.collection("bookings")
        .where("clinicId", "==", clinic_id)
        .where("date", "==", tomorrow)
        .where("status", "==", "confirmed")
        .stream()
    )

    count = 0
    for doc in docs:
        data = doc.to_dict()
        await push_text(
            data["patientLineId"],
            f"แจ้งเตือน: คุณมีนัดพรุ่งนี้ ({tomorrow}) เวลา {data['time']} น.\n"
            "กรุณาตรงเวลา หากไม่สะดวกกรุณาแจ้งยกเลิกล่วงหน้า",
        )
        doc.reference.update({"status": "reminded"})
        count += 1

    return count
