"""Admin-facing recurring booking reminders: periodic LINE nudges telling a
patient it's time to come back for a checkup. Deliberately stores no
clinical/treatment data (name/phone/LINE id + schedule only) — the patient
books their own follow-up via the existing LINE bot flow after the nudge.
"""
import asyncio
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import get_admin_user
from app.services import database as repo
from app.services.line import push_text

router = APIRouter()

AdminUser = Annotated[dict, Depends(get_admin_user)]


class ReminderCreate(BaseModel):
    patient_line_id: str
    patient_name: str
    patient_phone: str = ""
    interval_days: int
    start_date: str
    clinic_id: str = ""


class ReminderUpdate(BaseModel):
    interval_days: Optional[int] = None
    next_reminder_date: Optional[str] = None
    status: Optional[Literal["active", "stopped"]] = None


@router.get("")
async def list_reminders(clinic_id: str = "", _admin: AdminUser = None) -> list[dict]:
    cid = clinic_id or settings.clinic_id
    return await asyncio.to_thread(repo.list_booking_reminders, cid)


@router.get("/patients")
async def list_patients(clinic_id: str = "", _admin: AdminUser = None) -> list[dict]:
    """Patients with a real LINE account on file, for the reminder-creation picker."""
    cid = clinic_id or settings.clinic_id
    return await asyncio.to_thread(repo.list_line_patients, cid)


@router.post("", status_code=201)
async def create_reminder(body: ReminderCreate, _admin: AdminUser = None) -> dict:
    if body.interval_days <= 0:
        raise HTTPException(status_code=400, detail="ระยะเวลาต้องมากกว่า 0 วัน")

    cid = body.clinic_id or settings.clinic_id
    return await asyncio.to_thread(
        repo.create_booking_reminder,
        cid,
        body.patient_line_id,
        body.patient_name,
        body.patient_phone,
        body.interval_days,
        body.start_date,
    )


@router.patch("/{reminder_id}")
async def update_reminder(reminder_id: str, body: ReminderUpdate, _admin: AdminUser = None) -> dict:
    reminder = await asyncio.to_thread(repo.get_booking_reminder, reminder_id)
    if reminder is None:
        raise HTTPException(status_code=404, detail="ไม่พบการแจ้งเตือนนี้")

    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        return reminder
    return await asyncio.to_thread(repo.update_booking_reminder, reminder_id, **fields)


async def send_due_reminders(clinic_id: str) -> int:
    """Push a LINE nudge to every patient whose reminder is due today, then
    advance it. Called by the periodic sweep in app/routers/internal.py.
    Returns the number actually sent — a push failure (e.g. bad/missing LINE
    token) leaves that reminder due so it's retried on the next sweep."""
    due = await asyncio.to_thread(repo.list_due_reminders, clinic_id)
    sent = 0
    for reminder in due:
        try:
            await push_text(
                reminder["patient_line_id"],
                "ถึงเวลานัดตรวจติดตามผลแล้วนะคะ 😊\nพิมพ์ 'จอง' เพื่อจองคิวได้เลยค่ะ",
            )
        except Exception as e:
            print(f"[BOOKING_REMINDERS] push_text failed for {reminder['id']} (non-fatal): {e}")
            continue
        await asyncio.to_thread(repo.mark_reminder_sent, reminder["id"])
        sent += 1
    return sent
