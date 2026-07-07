from typing import Optional

from pydantic import BaseModel, computed_field


class TimeSlotInfo(BaseModel):
    capacity: int
    reserved: int = 0

    @computed_field  # type: ignore[misc]
    @property
    def available(self) -> int:
        return max(0, self.capacity - self.reserved)


class CoverageQuota(BaseModel):
    limit: int
    used: int = 0

    @computed_field  # type: ignore[misc]
    @property
    def remaining(self) -> int:
        return max(0, self.limit - self.used)


class QuotaOut(BaseModel):
    cash: CoverageQuota
    sso: CoverageQuota
    universal: CoverageQuota


class ServiceOut(BaseModel):
    id: str
    name: str
    duration_min: int
    deposit_amount: float


class ServiceCreate(BaseModel):
    name: str
    duration_min: int = 30
    deposit_amount: float = 0


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    duration_min: Optional[int] = None
    deposit_amount: Optional[float] = None


class ClinicSettingsOut(BaseModel):
    clinic_id: str
    name: str
    address: str
    phone: str
    open_time: str = "08:00"
    close_time: str = "17:00"


class ClinicSettingsUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    open_time: Optional[str] = None
    close_time: Optional[str] = None


class AvailableSlot(BaseModel):
    time: str
    available: int


class QuotaSetRequest(BaseModel):
    """Admin request body for PUT /quotas/{clinic_id}/{date}."""
    cash: int
    sso: int
    universal: int
