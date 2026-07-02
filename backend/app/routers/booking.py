from fastapi import APIRouter

from app.models.booking import BookingCreate, BookingOut, BookingUpdate

router = APIRouter()


@router.post("", response_model=BookingOut, status_code=201)
async def create_booking(payload: BookingCreate) -> BookingOut:
    # Week 2: BookingService.create() — Firestore transaction + slot lock
    raise NotImplementedError


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(booking_id: str) -> BookingOut:
    # Week 2: BookingService.get()
    raise NotImplementedError


@router.patch("/{booking_id}", response_model=BookingOut)
async def update_booking(booking_id: str, payload: BookingUpdate) -> BookingOut:
    # Week 2: BookingService.update()
    raise NotImplementedError


@router.delete("/{booking_id}", status_code=204)
async def cancel_booking(booking_id: str) -> None:
    # Week 2: BookingService.cancel() — release slot, notify patient
    raise NotImplementedError
