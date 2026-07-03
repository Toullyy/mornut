"""Read-only clinic data access: services, available slots, quota info."""
import asyncio

from app.models.clinic import AvailableSlot, CoverageQuota, QuotaOut, ServiceOut
from app.services import database as repo


async def list_services(clinic_id: str) -> list[ServiceOut]:
    rows = await asyncio.to_thread(repo.get_services, clinic_id)
    return [
        ServiceOut(
            id=r["id"],
            name=r["name"],
            duration_min=int(r["duration_min"]),
            deposit_amount=float(r["deposit_amount"]),
        )
        for r in rows
    ]


async def get_available_slots(clinic_id: str, date: str) -> list[AvailableSlot]:
    raw = await asyncio.to_thread(repo.get_slots, clinic_id, date)
    return [
        AvailableSlot(time=time_str, available=max(0, info["capacity"] - info["reserved"]))
        for time_str, info in sorted(raw.items())
    ]


async def get_quota_info(clinic_id: str, date: str) -> QuotaOut:
    raw = await asyncio.to_thread(repo.get_quota, clinic_id, date)

    def _parse(key: str) -> CoverageQuota:
        d = raw.get(key, {})
        return CoverageQuota(limit=int(d.get("limit", 0)), used=int(d.get("used", 0)))

    return QuotaOut(cash=_parse("cash"), sso=_parse("sso"), universal=_parse("universal"))
