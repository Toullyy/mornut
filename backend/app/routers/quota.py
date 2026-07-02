from fastapi import APIRouter
from typing import Any

router = APIRouter()


@router.get("/{clinic_id}/{date}")
async def get_quota(clinic_id: str, date: str) -> Any:
    # Week 5: return quota doc for the given clinic + date
    raise NotImplementedError


@router.put("/{clinic_id}/{date}")
async def set_quota(clinic_id: str, date: str) -> Any:
    # Week 5: admin sets daily quota caps (cash / sso / universal)
    raise NotImplementedError
