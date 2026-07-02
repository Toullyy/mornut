from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from app.core.security import get_line_user_id
from app.services import slip_service

router = APIRouter()

LineUserId = Annotated[str, Depends(get_line_user_id)]


@router.post("/{booking_id}/verify")
async def verify_slip(
    booking_id: str,
    file: UploadFile = File(...),
    _user_id: LineUserId = None,
) -> dict:
    return await slip_service.verify(booking_id, file)
