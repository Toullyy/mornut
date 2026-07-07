import asyncio
from typing import Annotated, Literal, Optional

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
from app.models.clinic import (
    ClinicSettingsOut,
    ClinicSettingsUpdate,
    ServiceCreate,
    ServiceOut,
    ServiceUpdate,
)
from app.services import database as repo
from app.services.booking_service import _to_out
from app.services import line as line_service
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
    clinic_id: str = "",
    date: Optional[str] = None,
    _admin: AdminUser = None,
) -> list[BookingOut]:
    """List bookings for a clinic. If date is omitted, returns all bookings."""
    cid = clinic_id or settings.clinic_id
    if date:
        rows = await asyncio.to_thread(repo.list_bookings, cid, date)
    else:
        rows = await asyncio.to_thread(repo.list_all_bookings, cid)
    return [_to_out(r) for r in rows]


class BookingPagedOut(BaseModel):
    items: list[BookingOut]
    total: int


@router.get("/bookings/paged", response_model=BookingPagedOut)
async def list_bookings_paged(
    clinic_id: str = "",
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    _admin: AdminUser = None,
) -> BookingPagedOut:
    cid = clinic_id or settings.clinic_id
    items, total = await asyncio.to_thread(
        repo.list_all_bookings_paged, cid, search, page, page_size
    )
    return BookingPagedOut(items=[_to_out(r) for r in items], total=total)


@router.get("/bookings/range", response_model=list[BookingOut])
async def list_bookings_range(
    start: str,
    end: str,
    clinic_id: str = "",
    _admin: AdminUser = None,
) -> list[BookingOut]:
    """List all bookings for a clinic across a date range (inclusive), for the
    Appointments view's multi-day browse — as opposed to /bookings' single day."""
    cid = clinic_id or settings.clinic_id
    rows = await asyncio.to_thread(repo.list_bookings_range, cid, start, end)
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


# ── Clinic settings ──────────────────────────────────────────────────────────

@router.get("/clinic-settings", response_model=ClinicSettingsOut)
async def get_clinic_settings(clinic_id: str = "", _admin: AdminUser = None) -> ClinicSettingsOut:
    cid = clinic_id or settings.clinic_id
    row = await asyncio.to_thread(repo.get_clinic_settings, cid)
    return ClinicSettingsOut(clinic_id=cid, name=row["name"] if row else "",
                              address=row["address"] if row else "", phone=row["phone"] if row else "")


@router.put("/clinic-settings", response_model=ClinicSettingsOut)
async def update_clinic_settings(
    body: ClinicSettingsUpdate,
    clinic_id: str = "",
    _admin: AdminUser = None,
) -> ClinicSettingsOut:
    cid = clinic_id or settings.clinic_id
    row = await asyncio.to_thread(
        repo.upsert_clinic_settings, cid, **body.model_dump(exclude_none=True)
    )
    return ClinicSettingsOut(clinic_id=cid, name=row["name"], address=row["address"], phone=row["phone"])


# ── Services ──────────────────────────────────────────────────────────────────

@router.get("/services", response_model=list[ServiceOut])
async def list_services(clinic_id: str = "", _admin: AdminUser = None) -> list[ServiceOut]:
    cid = clinic_id or settings.clinic_id
    return await asyncio.to_thread(repo.get_services, cid)


@router.post("/services", response_model=ServiceOut, status_code=201)
async def create_service(
    body: ServiceCreate,
    clinic_id: str = "",
    _admin: AdminUser = None,
) -> ServiceOut:
    cid = clinic_id or settings.clinic_id
    service_id = await asyncio.to_thread(
        repo.create_service, cid, body.name, body.duration_min, body.deposit_amount
    )
    return ServiceOut(id=service_id, name=body.name, duration_min=body.duration_min,
                       deposit_amount=body.deposit_amount)


@router.patch("/services/{service_id}", status_code=204)
async def update_service(
    service_id: str,
    body: ServiceUpdate,
    _admin: AdminUser = None,
) -> None:
    await asyncio.to_thread(repo.update_service, service_id, body.model_dump(exclude_none=True))


@router.delete("/services/{service_id}", status_code=204)
async def delete_service(service_id: str, _admin: AdminUser = None) -> None:
    await asyncio.to_thread(repo.delete_service, service_id)


# ── LINE OA settings (connect / webhook / rich menu) ────────────────────────────

class LineCredentials(BaseModel):
    channel_secret: str
    channel_access_token: str
    clinic_id: str = ""


class WebhookSetup(BaseModel):
    webhook_url: str
    clinic_id: str = ""


class RichMenuSetup(BaseModel):
    clinic_id: str = ""


def _mask_token(token: str) -> str:
    if not token:
        return ""
    return "••••••••" + token[-4:] if len(token) > 4 else "••••"


def _settings_public(row: dict | None) -> dict:
    """Shape a line_settings row for the client, never exposing the raw token."""
    if not row:
        return {
            "has_credentials": False,
            "connected": False,
            "bot": None,
            "webhook_url": "",
            "webhook_active": False,
            "rich_menu_id": "",
            "masked_token": "",
        }
    has = bool(row.get("channel_access_token"))
    bot = None
    if row.get("bot_user_id") or row.get("bot_display_name"):
        bot = {
            "userId": row.get("bot_user_id", ""),
            "displayName": row.get("bot_display_name", ""),
            "pictureUrl": row.get("bot_picture_url", ""),
        }
    return {
        "has_credentials": has,
        "connected": has,
        "bot": bot,
        "webhook_url": row.get("webhook_url", ""),
        "webhook_active": bool(row.get("webhook_active", False)),
        "rich_menu_id": row.get("rich_menu_id", ""),
        "masked_token": _mask_token(row.get("channel_access_token", "")),
    }


@router.get("/line-oa/settings")
async def get_line_oa_settings(clinic_id: str = "", _admin: AdminUser = None) -> dict:
    """Return the current LINE OA connection state for a clinic (token masked)."""
    cid = clinic_id or settings.clinic_id
    row = await asyncio.to_thread(repo.get_line_settings, cid)
    return _settings_public(row)


@router.post("/line-oa/settings")
async def save_line_oa_settings(body: LineCredentials, _admin: AdminUser = None) -> dict:
    """Verify and persist a clinic's LINE channel secret + access token."""
    cid = body.clinic_id or settings.clinic_id
    if not body.channel_secret or not body.channel_access_token:
        raise HTTPException(
            status_code=400,
            detail="กรุณากรอก Channel Secret และ Channel Access Token",
        )

    if settings.debug_mode:
        bot = {"userId": "dev-bot", "displayName": "Dev Clinic OA", "pictureUrl": ""}
    else:
        try:
            bot = await connect_line_oa(body.channel_secret, body.channel_access_token)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"LINE API error: {e}")

    row = await asyncio.to_thread(
        repo.upsert_line_settings,
        cid,
        channel_secret=body.channel_secret,
        channel_access_token=body.channel_access_token,
        bot_user_id=bot.get("userId", ""),
        bot_display_name=bot.get("displayName", ""),
        bot_picture_url=bot.get("pictureUrl", ""),
    )
    return _settings_public(row)


@router.post("/line-oa/webhook")
async def setup_line_oa_webhook(body: WebhookSetup, _admin: AdminUser = None) -> dict:
    """Register the webhook endpoint URL with LINE and mark it active."""
    cid = body.clinic_id or settings.clinic_id
    url = body.webhook_url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="กรุณาระบุ Webhook URL")

    row = await asyncio.to_thread(repo.get_line_settings, cid)
    if not row or not row.get("channel_access_token"):
        raise HTTPException(status_code=400, detail="กรุณาเชื่อมต่อ LINE OA ก่อน")

    if not settings.debug_mode:
        try:
            await line_service.set_webhook_endpoint(row["channel_access_token"], url)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"LINE API error: {e}")

    row = await asyncio.to_thread(
        repo.upsert_line_settings, cid, webhook_url=url, webhook_active=True
    )
    return _settings_public(row)


@router.post("/line-oa/rich-menu")
async def setup_line_oa_rich_menu(
    body: RichMenuSetup | None = None, _admin: AdminUser = None
) -> dict:
    """Create + publish a default rich menu and persist its id."""
    cid = (body.clinic_id if body else "") or settings.clinic_id
    row = await asyncio.to_thread(repo.get_line_settings, cid)
    if not row or not row.get("channel_access_token"):
        raise HTTPException(status_code=400, detail="กรุณาเชื่อมต่อ LINE OA ก่อน")

    if settings.debug_mode:
        rich_menu_id = "richmenu-dev00000000000000000000000000"
    else:
        liff_url = settings.liff_url
        if not liff_url or "YOUR_LIFF_ID" in liff_url:
            raise HTTPException(
                status_code=400,
                detail="กรุณาตั้งค่า LIFF_URL ใน backend/.env ก่อนสร้าง Rich Menu",
            )
        try:
            rich_menu_id = await line_service.create_and_publish_rich_menu(
                row["channel_access_token"], liff_url
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"LINE API error: {e}")

    row = await asyncio.to_thread(repo.upsert_line_settings, cid, rich_menu_id=rich_menu_id)
    return _settings_public(row)


@router.delete("/line-oa/rich-menu")
async def delete_line_oa_rich_menu(clinic_id: str = "", _admin: AdminUser = None) -> dict:
    """Delete the current rich menu (if any) and clear its id."""
    cid = clinic_id or settings.clinic_id
    row = await asyncio.to_thread(repo.get_line_settings, cid)
    if row and row.get("rich_menu_id") and not settings.debug_mode:
        try:
            await line_service.delete_rich_menu(
                row["channel_access_token"], row["rich_menu_id"]
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"LINE API error: {e}")

    row = await asyncio.to_thread(repo.upsert_line_settings, cid, rich_menu_id="")
    return _settings_public(row)


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
