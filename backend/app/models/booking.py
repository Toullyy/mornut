from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

# ── Type aliases ──────────────────────────────────────────────────────────────

BookingStatus = Literal[
    "pending_slip",
    "confirmed",
    "reminded",
    "done",
    "no_show",
    "cancelled",
]

CoverageType = Literal["cash", "sso", "universal"]


# ── Sub-schemas ───────────────────────────────────────────────────────────────

class SlipInfo(BaseModel):
    url: str
    verified: bool = False
    amount: Optional[float] = None
    trans_ref: Optional[str] = None
    verified_at: Optional[datetime] = None


# ── Request schemas ───────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    clinic_id: str
    patient_line_id: str
    patient_name: str
    phone: str
    service_id: str
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", examples=["2025-12-31"])
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$", examples=["09:00"])
    coverage: CoverageType


class BookingUpdate(BaseModel):
    status: Optional[BookingStatus] = None
    slip: Optional[SlipInfo] = None


# ── Response schema ───────────────────────────────────────────────────────────

class BookingOut(BaseModel):
    id: str
    clinic_id: str
    patient_line_id: str
    patient_name: str
    phone: str
    service_id: str
    date: str
    time: str
    coverage: CoverageType
    status: BookingStatus
    slip: Optional[SlipInfo] = None
    created_at: datetime
    updated_at: datetime
