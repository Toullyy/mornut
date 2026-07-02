from fastapi import APIRouter, UploadFile, File

router = APIRouter()


@router.post("/{booking_id}/verify")
async def verify_slip(booking_id: str, file: UploadFile = File(...)) -> dict:
    # Week 4: upload image to Cloud Storage, call SlipOK, update booking status
    raise NotImplementedError
