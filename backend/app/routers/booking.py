import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.security import get_line_user_id
from app.models.booking import BookingCreate, BookingOut, BookingUpdate
from app.services import booking_service
from app.services import database as repo

router = APIRouter()

LineUserId = Annotated[str, Depends(get_line_user_id)]


@router.get("/mine", response_model=list[BookingOut])
async def get_my_bookings(line_user_id: LineUserId) -> list[BookingOut]:
    """Return upcoming confirmed/reminded bookings for the authenticated LINE user."""
    rows = await asyncio.to_thread(repo.get_patient_bookings, line_user_id)
    return [booking_service._to_out(r) for r in rows]


@router.post("", response_model=BookingOut, status_code=201)
async def create_booking(payload: BookingCreate, line_user_id: LineUserId) -> BookingOut:
    # Enforce that the token owner is the patient making the booking
    payload = payload.model_copy(update={"patient_line_id": line_user_id})
    return await booking_service.create(payload)


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(booking_id: str, _: LineUserId) -> BookingOut:
    return await booking_service.get(booking_id)


@router.patch("/{booking_id}", response_model=BookingOut)
async def update_booking(
    booking_id: str,
    payload: BookingUpdate,
    _: LineUserId,
) -> BookingOut:
    return await booking_service.update(booking_id, payload)


@router.delete("/{booking_id}", status_code=204)
async def cancel_booking(booking_id: str, _: LineUserId) -> None:
    await booking_service.cancel(booking_id)
