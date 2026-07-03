from typing import Optional
from pydantic import BaseModel


class ShiftOut(BaseModel):
    day_of_week: int
    morning: bool
    afternoon: bool


class ShiftUpdate(BaseModel):
    day_of_week: int
    morning: bool
    afternoon: bool


class DoctorCreate(BaseModel):
    name: str
    specialty: str
    color: str = 'bg-sky-500'
    initials: str = ''


class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    color: Optional[str] = None
    initials: Optional[str] = None


class DoctorOut(BaseModel):
    id: str
    clinic_id: str
    name: str
    specialty: str
    color: str
    initials: str
    shifts: list[ShiftOut] = []
