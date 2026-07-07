import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import settings
from app.core.security import get_admin_user
from app.models.doctor import DoctorCreate, DoctorOut, DoctorUpdate, TimeSlotUpdate
from app.services import database as repo

router = APIRouter()
AdminUser = Annotated[dict, Depends(get_admin_user)]


@router.get("", response_model=list[DoctorOut])
async def list_doctors(
    clinic_id: str = "",
    _admin: AdminUser = None,
) -> list[DoctorOut]:
    cid = clinic_id or settings.clinic_id
    return await asyncio.to_thread(repo.get_doctors, cid)


@router.post("", response_model=DoctorOut, status_code=201)
async def create_doctor(
    body: DoctorCreate,
    clinic_id: str = "",
    _admin: AdminUser = None,
) -> DoctorOut:
    cid = clinic_id or settings.clinic_id
    doctor_id = await asyncio.to_thread(
        repo.create_doctor, cid, body.name, body.specialty, body.color, body.initials
    )
    doctors = await asyncio.to_thread(repo.get_doctors, cid)
    doc = next((d for d in doctors if d["id"] == doctor_id), None)
    if doc is None:
        raise HTTPException(status_code=500, detail="Failed to retrieve created doctor")
    return doc


@router.patch("/{doctor_id}", status_code=204)
async def update_doctor(
    doctor_id: str,
    body: DoctorUpdate,
    _admin: AdminUser = None,
) -> None:
    await asyncio.to_thread(
        repo.update_doctor, doctor_id, body.model_dump(exclude_none=True)
    )


@router.delete("/{doctor_id}", status_code=204)
async def delete_doctor(
    doctor_id: str,
    _admin: AdminUser = None,
) -> None:
    await asyncio.to_thread(repo.delete_doctor, doctor_id)


@router.put("/{doctor_id}/shifts", status_code=204)
async def update_shifts(
    doctor_id: str,
    shifts: list[TimeSlotUpdate],
    _admin: AdminUser = None,
) -> None:
    await asyncio.to_thread(
        repo.upsert_doctor_shifts,
        doctor_id,
        [s.model_dump() for s in shifts],
    )
