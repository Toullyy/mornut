from typing import Optional
from pydantic import BaseModel


class TimeSlotOut(BaseModel):
    day_of_week: int
    start: str   # "08:00"
    end: str     # "17:00"


class TimeSlotUpdate(BaseModel):
    day_of_week: int
    start: str
    end: str


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
    shifts: list[TimeSlotOut] = []
