import asyncio
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import (
    create_access_token,
    get_admin_user,
    verify_password,
)
from app.models.booking import BookingOut
from app.services import database as repo
from app.services.booking_service import _to_out

router = APIRouter()

AdminUser = Annotated[dict, Depends(get_admin_user)]


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    """Authenticate admin and return a JWT."""
    admin = await asyncio.to_thread(repo.get_admin_by_email, body.email)
    if admin is None or not verify_password(body.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง")
    token = create_access_token(admin["email"])
    return TokenResponse(access_token=token)


# ── Bookings ──────────────────────────────────────────────────────────────────

@router.get("/bookings", response_model=list[BookingOut])
async def list_bookings(
    date: str,
    clinic_id: str = "",
    _admin: AdminUser = None,
) -> list[BookingOut]:
    """List all bookings for a clinic on a given date."""
    cid = clinic_id or settings.clinic_id
    rows = await asyncio.to_thread(repo.list_bookings, cid, date)
    return [_to_out(r) for r in rows]


class StatusUpdate(BaseModel):
    status: Literal["done", "cancelled"]


@router.patch("/bookings/{booking_id}/status", status_code=204)
async def update_booking_status(
    booking_id: str,
    body: StatusUpdate,
    _admin: AdminUser = None,
) -> None:
    if body.status == "cancelled":
        await asyncio.to_thread(repo.cancel_booking, booking_id)
    else:
        await asyncio.to_thread(repo.update_booking, booking_id, {"status": "done"})
