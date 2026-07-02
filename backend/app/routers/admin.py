import asyncio
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.security import get_admin_user
from app.services import firestore as repo

router = APIRouter()

AdminUser = Annotated[dict, Depends(get_admin_user)]


class StatusUpdate(BaseModel):
    status: Literal["done", "cancelled"]


@router.patch("/bookings/{booking_id}/status", status_code=204)
async def update_booking_status(
    booking_id: str,
    body: StatusUpdate,
    _admin: AdminUser,
) -> None:
    if body.status == "cancelled":
        # Releases slot + quota counters atomically
        await asyncio.to_thread(repo.cancel_booking, booking_id)
    else:
        # "done" — visit completed; counters are not released
        await asyncio.to_thread(repo.update_booking, booking_id, {"status": "done"})
