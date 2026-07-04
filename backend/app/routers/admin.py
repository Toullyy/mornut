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
from app.core.db import cursor, get_conn  # used by debug/db endpoint
from app.models.booking import BookingOut
from app.services import database as repo
from app.services.booking_service import _to_out
from app.services.line import connect_line_oa

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


# ── LINE OA ───────────────────────────────────────────────────────────────────

class LineOAConnect(BaseModel):
    channel_secret: str
    channel_access_token: str


@router.post("/line-oa/connect")
async def connect_line_oa_endpoint(body: LineOAConnect) -> dict:
    """
    Authenticate using LINE OA credentials — no login page needed.
    Valid secret + token → returns a JWT for all other admin endpoints.
    """
    try:
        bot_info = await connect_line_oa(body.channel_secret, body.channel_access_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LINE API error: {e}")

    token = create_access_token(bot_info["userId"])
    return {
        "connected": True,
        "access_token": token,
        "token_type": "bearer",
        "bot": bot_info,
    }


@router.post("/line-oa/dev-connect")
async def dev_connect(body: LineOAConnect) -> dict:
    """Local dev bypass — skips LINE API call and returns a JWT immediately.
    Only works when DEBUG_MODE=true. Returns 403 in production."""
    if not settings.debug_mode:
        raise HTTPException(status_code=403, detail="Only available in debug mode")

    token = create_access_token("dev-admin")
    return {
        "connected": True,
        "access_token": token,
        "token_type": "bearer",
        "bot": {
            "userId": "dev-admin",
            "displayName": "Dev Admin",
            "pictureUrl": "",
            "chatMode": "chat",
            "markAsReadMode": "auto",
        },
    }


@router.post("/debug/reseed-today")
async def reseed_today_endpoint() -> dict:
    """DEBUG_MODE only — full reseed anchored to today. Same logic as auto-startup seed."""
    if not settings.debug_mode:
        raise HTTPException(status_code=403, detail="Only available in debug mode")
    from app.services.dev_seed import reseed_today
    return await asyncio.to_thread(reseed_today)


@router.get("/debug/db")
async def debug_db() -> dict:
    """DEBUG_MODE only — shows raw DB counts and booking dates to diagnose empty results."""
    if not settings.debug_mode:
        raise HTTPException(status_code=403, detail="Only available in debug mode")

    def _query():
        with get_conn() as conn:
            with cursor(conn) as cur:
                counts = {}
                for table in ("services", "doctors", "slots", "quotas", "bookings"):
                    cur.execute(f"SELECT COUNT(*) AS n FROM {table}")
                    counts[table] = cur.fetchone()["n"]

                cur.execute(
                    "SELECT clinic_id, date::text, COUNT(*) AS n "
                    "FROM bookings GROUP BY clinic_id, date ORDER BY date"
                )
                by_date = [dict(r) for r in cur.fetchall()]

                cur.execute(
                    "SELECT id::text, clinic_id, patient_name, date::text, time::text, status "
                    "FROM bookings ORDER BY date, time LIMIT 20"
                )
                sample = [dict(r) for r in cur.fetchall()]

        return {"counts": counts, "bookings_by_date": by_date, "sample": sample}

    result = await asyncio.to_thread(_query)
    return result


class AdminBookingCreate(BaseModel):
    patient_name: str
    phone: str
    service_id: str
    service_name: str
    date: str
    time: str
    coverage: Literal["cash", "sso", "universal"]
    deposit_amount: float = 0.0
    clinic_id: str = ""


@router.post("/bookings", status_code=201)
async def create_booking_admin(
    body: AdminBookingCreate,
    _admin: AdminUser = None,
) -> dict:
    cid = body.clinic_id or settings.clinic_id
    doc = {
        "clinicId": cid,
        "patientName": body.patient_name,
        "phone": body.phone,
        "serviceId": body.service_id,
        "serviceName": body.service_name,
        "depositAmount": body.deposit_amount,
        "date": body.date,
        "time": body.time,
        "coverage": body.coverage,
    }
    try:
        booking_id = await asyncio.to_thread(
            repo.create_admin_booking, cid, body.date, body.time, body.coverage, doc
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"id": booking_id}
