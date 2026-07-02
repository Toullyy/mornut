from fastapi import APIRouter

from app.models.clinic import AvailableSlot, QuotaOut, ServiceOut
from app.services import clinic_service

router = APIRouter()


@router.get("/{clinic_id}/services", response_model=list[ServiceOut])
async def list_services(clinic_id: str) -> list[ServiceOut]:
    return await clinic_service.list_services(clinic_id)


@router.get("/{clinic_id}/slots/{date}", response_model=list[AvailableSlot])
async def get_slots(clinic_id: str, date: str) -> list[AvailableSlot]:
    return await clinic_service.get_available_slots(clinic_id, date)


@router.get("/{clinic_id}/quotas/{date}", response_model=QuotaOut)
async def get_quota(clinic_id: str, date: str) -> QuotaOut:
    return await clinic_service.get_quota_info(clinic_id, date)
