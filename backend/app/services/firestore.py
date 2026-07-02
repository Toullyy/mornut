import uuid
from datetime import datetime, timezone
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import Client
from google.cloud.firestore import transactional, Increment

from app.core.config import settings

_db: Client | None = None


def get_db() -> Client:
    """Return a singleton Firestore client.

    Cloud Run: uses Application Default Credentials automatically.
    Local dev:  point GOOGLE_APPLICATION_CREDENTIALS at a service account JSON.
    """
    global _db
    if _db is None:
        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            bucket = (
                settings.firebase_storage_bucket
                or f"{settings.firebase_project_id}.appspot.com"
            )
            firebase_admin.initialize_app(
                cred,
                {"projectId": settings.firebase_project_id, "storageBucket": bucket},
            )
        _db = firestore.client()
    return _db


# ── Bookings ──────────────────────────────────────────────────────────────────

def get_booking(booking_id: str) -> Optional[dict]:
    doc = get_db().collection("bookings").document(booking_id).get()
    if not doc.exists:
        return None
    return {"id": doc.id, **doc.to_dict()}


def create_booking(
    clinic_id: str,
    date: str,
    time_slot: str,
    coverage: str,
    doc: dict,
) -> str:
    """Create a booking inside a Firestore transaction.

    Slot and quota counters are incremented atomically so concurrent
    requests cannot double-book the same slot.
    Raises ValueError if the slot is full or the coverage quota is exhausted.
    Returns the new booking_id.
    """
    db = get_db()
    slot_ref = (
        db.collection("clinics").document(clinic_id).collection("slots").document(date)
    )
    quota_ref = (
        db.collection("clinics").document(clinic_id).collection("quotas").document(date)
    )
    booking_id = str(uuid.uuid4())
    booking_ref = db.collection("bookings").document(booking_id)
    now = datetime.now(timezone.utc)

    @transactional
    def _tx(transaction) -> None:
        slot_snap = slot_ref.get(transaction=transaction)
        quota_snap = quota_ref.get(transaction=transaction)

        slot_data = slot_snap.to_dict() or {}
        slot_info = slot_data.get(time_slot, {})
        if slot_info.get("reserved", 0) >= slot_info.get("capacity", 0):
            raise ValueError(f"เวลา {time_slot} เต็มแล้ว")

        quota_data = quota_snap.to_dict() or {}
        cov = quota_data.get(coverage, {})
        if cov.get("used", 0) >= cov.get("limit", 0):
            raise ValueError(f"สิทธิ์ {coverage} เต็มในวันนี้")

        transaction.set(
            booking_ref,
            {**doc, "status": "pending_slip", "createdAt": now, "updatedAt": now},
        )
        transaction.update(slot_ref, {f"{time_slot}.reserved": Increment(1)})
        transaction.update(quota_ref, {f"{coverage}.used": Increment(1)})

    _tx(db.transaction())
    return booking_id


def update_booking(booking_id: str, data: dict) -> None:
    data = {**data, "updatedAt": datetime.now(timezone.utc)}
    get_db().collection("bookings").document(booking_id).update(data)


def cancel_booking(booking_id: str) -> None:
    """Cancel a booking and release its reserved slot + quota counter atomically."""
    db = get_db()
    booking_ref = db.collection("bookings").document(booking_id)

    @transactional
    def _tx(transaction) -> None:
        snap = booking_ref.get(transaction=transaction)
        if not snap.exists:
            raise ValueError("Booking not found")
        b = snap.to_dict()
        if b["status"] in ("cancelled", "done"):
            return  # already terminal — nothing to release

        slot_ref = (
            db.collection("clinics")
            .document(b["clinicId"])
            .collection("slots")
            .document(b["date"])
        )
        quota_ref = (
            db.collection("clinics")
            .document(b["clinicId"])
            .collection("quotas")
            .document(b["date"])
        )
        now = datetime.now(timezone.utc)
        transaction.update(booking_ref, {"status": "cancelled", "updatedAt": now})
        transaction.update(slot_ref, {f"{b['time']}.reserved": Increment(-1)})
        transaction.update(quota_ref, {f"{b['coverage']}.used": Increment(-1)})

    _tx(db.transaction())


# ── Slots & Quotas (read-only helpers used by booking service) ────────────────

def get_slots(clinic_id: str, date: str) -> dict:
    """Return raw slot map for a date, e.g. {"09:00": {"capacity":2,"reserved":1}}."""
    doc = (
        get_db()
        .collection("clinics")
        .document(clinic_id)
        .collection("slots")
        .document(date)
        .get()
    )
    return doc.to_dict() or {}


def get_quota(clinic_id: str, date: str) -> dict:
    """Return raw quota map for a date, e.g. {"cash":{"limit":10,"used":3},...}."""
    doc = (
        get_db()
        .collection("clinics")
        .document(clinic_id)
        .collection("quotas")
        .document(date)
        .get()
    )
    return doc.to_dict() or {}


def is_trans_ref_used(trans_ref: str) -> bool:
    """Return True if any confirmed booking already contains this transRef."""
    docs = (
        get_db()
        .collection("bookings")
        .where("slip.transRef", "==", trans_ref)
        .where("slip.verified", "==", True)
        .limit(1)
        .stream()
    )
    return any(True for _ in docs)


def set_quota(clinic_id: str, date: str, data: dict) -> None:
    (
        get_db()
        .collection("clinics")
        .document(clinic_id)
        .collection("quotas")
        .document(date)
        .set(data, merge=True)
    )


def update_quota_limits(clinic_id: str, date: str, cash: int, sso: int, universal: int) -> None:
    """Update only the limit fields for each coverage type, preserving used counters.

    Uses update() with dot-notation so sibling fields (like .used) are untouched.
    Falls back to set() if the document doesn't exist yet.
    """
    ref = (
        get_db()
        .collection("clinics")
        .document(clinic_id)
        .collection("quotas")
        .document(date)
    )
    try:
        ref.update({"cash.limit": cash, "sso.limit": sso, "universal.limit": universal})
    except Exception:
        # Document doesn't exist — create it with zero used counters
        ref.set({
            "cash": {"limit": cash, "used": 0},
            "sso": {"limit": sso, "used": 0},
            "universal": {"limit": universal, "used": 0},
        })
