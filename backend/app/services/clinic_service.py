"""Read-only clinic data access: services, available slots, quota info."""
import asyncio

from app.models.clinic import AvailableSlot, CoverageQuota, QuotaOut, ServiceOut
from app.services import firestore as repo


# ── Services ──────────────────────────────────────────────────────────────────

async def list_services(clinic_id: str) -> list[ServiceOut]:
    return await asyncio.to_thread(_fetch_services, clinic_id)


def _fetch_services(clinic_id: str) -> list[ServiceOut]:
    db = repo.get_db()
    docs = (
        db.collection("clinics")
        .document(clinic_id)
        .collection("services")
        .stream()
    )
    result = []
    for doc in docs:
        d = doc.to_dict()
        result.append(
            ServiceOut(
                id=doc.id,
                name=d.get("name", ""),
                duration_min=int(d.get("durationMin", 30)),
                deposit_amount=float(d.get("depositAmount", 0)),
            )
        )
    return result


# ── Slots ─────────────────────────────────────────────────────────────────────

async def get_available_slots(clinic_id: str, date: str) -> list[AvailableSlot]:
    raw = await asyncio.to_thread(repo.get_slots, clinic_id, date)
    slots: list[AvailableSlot] = []
    for time_str, info in sorted(raw.items()):
        if isinstance(info, dict):
            capacity = int(info.get("capacity", 0))
            reserved = int(info.get("reserved", 0))
        else:
            # Legacy format: slot value is just the capacity integer
            capacity = int(info)
            reserved = 0
        slots.append(AvailableSlot(time=time_str, available=max(0, capacity - reserved)))
    return slots


# ── Quota ─────────────────────────────────────────────────────────────────────

async def get_quota_info(clinic_id: str, date: str) -> QuotaOut:
    raw = await asyncio.to_thread(repo.get_quota, clinic_id, date)

    def _parse(key: str) -> CoverageQuota:
        d = raw.get(key, {})
        return CoverageQuota(
            limit=int(d.get("limit", 0)),
            used=int(d.get("used", 0)),
        )

    return QuotaOut(cash=_parse("cash"), sso=_parse("sso"), universal=_parse("universal"))
