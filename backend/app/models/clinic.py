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


class AvailableSlot(BaseModel):
    time: str
    available: int


class QuotaSetRequest(BaseModel):
    """Admin request body for PUT /quotas/{clinic_id}/{date}.

    Sets the daily *limit* for each coverage type; the current *used* counter
    in Firestore is preserved (we only overwrite the limit field).
    """
    cash: int
    sso: int
    universal: int
