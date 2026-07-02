"""Internal routes called by Cloud Scheduler — not exposed to patients or admins."""
from fastapi import APIRouter, Header, HTTPException

from app.core.config import settings
from app.services import reminder

router = APIRouter()


@router.post("/remind/{clinic_id}")
async def trigger_reminder(
    clinic_id: str,
    authorization: str = Header(...),
) -> dict:
    # Validate shared secret when SCHEDULER_SECRET is configured.
    # Leave SCHEDULER_SECRET empty in local dev to skip this check.
    if settings.scheduler_secret and authorization != f"Bearer {settings.scheduler_secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    count = await reminder.send_tomorrow_reminders(clinic_id)
    return {"clinic_id": clinic_id, "reminders_sent": count}
