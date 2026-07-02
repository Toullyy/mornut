from fastapi import APIRouter

from app.models.clinic import QuotaOut
from app.services import clinic_service

router = APIRouter()


@router.get("/{clinic_id}/{date}", response_model=QuotaOut)
async def get_quota(clinic_id: str, date: str) -> QuotaOut:
    return await clinic_service.get_quota_info(clinic_id, date)


@router.put("/{clinic_id}/{date}", status_code=204)
async def set_quota(clinic_id: str, date: str) -> None:
    # Week 5: admin sets daily quota limits via Dashboard
    raise NotImplementedError
