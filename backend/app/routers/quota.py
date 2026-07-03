import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.security import get_admin_user
from app.models.clinic import QuotaOut, QuotaSetRequest
from app.services import clinic_service
from app.services import database as repo

router = APIRouter()

AdminUser = Annotated[dict, Depends(get_admin_user)]


@router.get("/{clinic_id}/{date}", response_model=QuotaOut)
async def get_quota(clinic_id: str, date: str) -> QuotaOut:
    return await clinic_service.get_quota_info(clinic_id, date)


@router.put("/{clinic_id}/{date}", status_code=204)
async def set_quota(
    clinic_id: str,
    date: str,
    body: QuotaSetRequest,
    _admin: AdminUser,
) -> None:
    await asyncio.to_thread(
        repo.update_quota_limits, clinic_id, date, body.cash, body.sso, body.universal
    )
