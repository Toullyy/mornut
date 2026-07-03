"""PostgreSQL data access layer — replaces firestore.py.

All functions are synchronous and intended to be called via asyncio.to_thread
so the FastAPI event loop is never blocked.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.core.db import cursor, get_conn


# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_to_booking(row: dict) -> dict:
    """Convert a DB row (snake_case, date/time objects) to the shape booking_service expects."""
    r = dict(row)
    # psycopg2 returns date as datetime.date and time as datetime.time
    r["date"] = str(r["date"])          # "2025-07-03"
    r["time"] = str(r["time"])[:5]      # "09:00"
    if r.get("slip_verified_at"):
        r["slip_verified_at"] = r["slip_verified_at"]
    return r


# ── Bookings ──────────────────────────────────────────────────────────────────

def get_booking(booking_id: str) -> Optional[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute("SELECT * FROM bookings WHERE id = %s", (booking_id,))
            row = cur.fetchone()
    return _row_to_booking(dict(row)) if row else None


def list_bookings(clinic_id: str, date: str) -> list[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM bookings WHERE clinic_id = %s AND date = %s ORDER BY time ASC",
                (clinic_id, date),
            )
            rows = cur.fetchall()
    return [_row_to_booking(dict(r)) for r in rows]


def create_booking(
    clinic_id: str,
    date: str,
    time_slot: str,
    coverage: str,
    doc: dict,
    initial_status: str = "pending_slip",
) -> str:
    """Insert a booking inside a transaction with slot+quota guard.

    Raises ValueError if the slot is full or the coverage quota is exhausted.
    Returns the new booking_id.
    """
    booking_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    with get_conn() as conn:
        with cursor(conn) as cur:
            # Lock and check slot
            cur.execute(
                "SELECT capacity, reserved FROM slots "
                "WHERE clinic_id = %s AND date = %s AND time = %s FOR UPDATE",
                (clinic_id, date, time_slot),
            )
            slot = cur.fetchone()
            if slot is None:
                raise ValueError(f"ไม่มีช่องเวลา {time_slot}")
            if slot["reserved"] >= slot["capacity"]:
                raise ValueError(f"เวลา {time_slot} เต็มแล้ว")

            # Lock and check quota
            cur.execute(
                "SELECT limit_count, used_count FROM quotas "
                "WHERE clinic_id = %s AND date = %s AND coverage = %s FOR UPDATE",
                (clinic_id, date, coverage),
            )
            quota = cur.fetchone()
            if quota is None:
                raise ValueError(f"ไม่มีโควตาสำหรับสิทธิ์ {coverage}")
            if quota["used_count"] >= quota["limit_count"]:
                raise ValueError(f"สิทธิ์ {coverage} เต็มในวันนี้")

            # Insert booking
            cur.execute(
                """
                INSERT INTO bookings (
                    id, clinic_id, patient_line_id, patient_name, phone,
                    service_id, service_name, deposit_amount,
                    date, time, coverage, status, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, 'pending_slip', %s, %s
                )
                """,
                (
                    booking_id,
                    doc["clinicId"],
                    doc["patientLineId"],
                    doc["patientName"],
                    doc["phone"],
                    doc["serviceId"],
                    doc["serviceName"],
                    doc["depositAmount"],
                    doc["date"],
                    doc["time"],
                    doc["coverage"],
                    now, now,
                ),
            )

            # Increment slot reserved
            cur.execute(
                "UPDATE slots SET reserved = reserved + 1 "
                "WHERE clinic_id = %s AND date = %s AND time = %s",
                (clinic_id, date, time_slot),
            )

            # Increment quota used
            cur.execute(
                "UPDATE quotas SET used_count = used_count + 1 "
                "WHERE clinic_id = %s AND date = %s AND coverage = %s",
                (clinic_id, date, coverage),
            )

    return booking_id


def update_booking(booking_id: str, data: dict) -> None:
    data = {**data, "updated_at": datetime.now(timezone.utc)}
    allowed = {
        "status", "slip_url", "slip_verified", "slip_amount",
        "slip_trans_ref", "slip_verified_at", "updated_at",
    }
    fields = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        return
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [booking_id]
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(f"UPDATE bookings SET {set_clause} WHERE id = %s", values)


def cancel_booking(booking_id: str) -> None:
    """Cancel a booking and release its reserved slot + quota counter atomically."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute("SELECT * FROM bookings WHERE id = %s FOR UPDATE", (booking_id,))
            row = cur.fetchone()
            if row is None:
                raise ValueError("Booking not found")
            if row["status"] in ("cancelled", "done"):
                return

            cur.execute(
                "UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = %s",
                (booking_id,),
            )
            cur.execute(
                "UPDATE slots SET reserved = GREATEST(0, reserved - 1) "
                "WHERE clinic_id = %s AND date = %s AND time = %s",
                (row["clinic_id"], row["date"], str(row["time"])[:5]),
            )
            cur.execute(
                "UPDATE quotas SET used_count = GREATEST(0, used_count - 1) "
                "WHERE clinic_id = %s AND date = %s AND coverage = %s",
                (row["clinic_id"], row["date"], row["coverage"]),
            )


# ── Slots & Quotas ────────────────────────────────────────────────────────────

def get_slots(clinic_id: str, date: str) -> dict:
    """Return slot map: {"09:00": {"capacity": 2, "reserved": 1}, ...}"""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT time, capacity, reserved FROM slots "
                "WHERE clinic_id = %s AND date = %s ORDER BY time",
                (clinic_id, date),
            )
            rows = cur.fetchall()
    return {
        str(r["time"])[:5]: {"capacity": r["capacity"], "reserved": r["reserved"]}
        for r in rows
    }


def get_quota(clinic_id: str, date: str) -> dict:
    """Return quota map: {"cash": {"limit": 10, "used": 3}, ...}"""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT coverage, limit_count, used_count FROM quotas "
                "WHERE clinic_id = %s AND date = %s",
                (clinic_id, date),
            )
            rows = cur.fetchall()
    return {r["coverage"]: {"limit": r["limit_count"], "used": r["used_count"]} for r in rows}


def is_trans_ref_used(trans_ref: str) -> bool:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT 1 FROM bookings WHERE slip_trans_ref = %s AND slip_verified = TRUE LIMIT 1",
                (trans_ref,),
            )
            return cur.fetchone() is not None


def set_quota(clinic_id: str, date: str, data: dict) -> None:
    with get_conn() as conn:
        with cursor(conn) as cur:
            for coverage, info in data.items():
                cur.execute(
                    """
                    INSERT INTO quotas (clinic_id, date, coverage, limit_count, used_count)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (clinic_id, date, coverage)
                    DO UPDATE SET limit_count = EXCLUDED.limit_count
                    """,
                    (clinic_id, date, coverage, info.get("limit", 0), info.get("used", 0)),
                )


def update_quota_limits(clinic_id: str, date: str, cash: int, sso: int, universal: int) -> None:
    with get_conn() as conn:
        with cursor(conn) as cur:
            for coverage, limit in [("cash", cash), ("sso", sso), ("universal", universal)]:
                cur.execute(
                    """
                    INSERT INTO quotas (clinic_id, date, coverage, limit_count, used_count)
                    VALUES (%s, %s, %s, %s, 0)
                    ON CONFLICT (clinic_id, date, coverage)
                    DO UPDATE SET limit_count = EXCLUDED.limit_count
                    """,
                    (clinic_id, date, coverage, limit),
                )


# ── Services ──────────────────────────────────────────────────────────────────

def get_services(clinic_id: str) -> list[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT id::text, name, duration_min, deposit_amount FROM services "
                "WHERE clinic_id = %s ORDER BY name",
                (clinic_id,),
            )
            return [dict(r) for r in cur.fetchall()]


# ── Admin users ───────────────────────────────────────────────────────────────

def get_admin_by_email(email: str) -> Optional[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute("SELECT * FROM admin_users WHERE email = %s", (email,))
            row = cur.fetchone()
    return dict(row) if row else None


# ── Reminder ──────────────────────────────────────────────────────────────────

def get_confirmed_bookings_for_date(clinic_id: str, date: str) -> list[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM bookings "
                "WHERE clinic_id = %s AND date = %s AND status = 'confirmed'",
                (clinic_id, date),
            )
            return [_row_to_booking(dict(r)) for r in cur.fetchall()]


def mark_reminded(booking_id: str) -> None:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "UPDATE bookings SET status = 'reminded', updated_at = NOW() WHERE id = %s",
                (booking_id,),
            )


def get_patient_bookings(patient_line_id: str) -> list[dict]:
    """Return upcoming (confirmed/reminded) bookings for a LINE user, newest first."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM bookings "
                "WHERE patient_line_id = %s AND status IN ('confirmed', 'reminded') "
                "ORDER BY date ASC, time ASC "
                "LIMIT 5",
                (patient_line_id,),
            )
            return [_row_to_booking(dict(r)) for r in cur.fetchall()]


# ── Doctors ───────────────────────────────────────────────────────────────────

def get_doctors(clinic_id: str) -> list[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT id::text, clinic_id, name, specialty, color, initials "
                "FROM doctors WHERE clinic_id = %s ORDER BY created_at",
                (clinic_id,),
            )
            doctors = [dict(r) for r in cur.fetchall()]
            if doctors:
                ids = tuple(d["id"] for d in doctors)
                placeholders = ",".join(["%s"] * len(ids))
                cur.execute(
                    f"SELECT doctor_id::text, day_of_week, morning, afternoon "
                    f"FROM doctor_shifts WHERE doctor_id::text IN ({placeholders})",
                    ids,
                )
                shifts_map: dict[str, list[dict]] = {}
                for s in cur.fetchall():
                    did = s["doctor_id"]
                    shifts_map.setdefault(did, []).append({
                        "day_of_week": s["day_of_week"],
                        "morning": s["morning"],
                        "afternoon": s["afternoon"],
                    })
                for d in doctors:
                    d["shifts"] = shifts_map.get(d["id"], [])
    return doctors


def create_doctor(clinic_id: str, name: str, specialty: str, color: str, initials: str) -> str:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "INSERT INTO doctors (clinic_id, name, specialty, color, initials) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id::text",
                (clinic_id, name, specialty, color, initials),
            )
            row = cur.fetchone()
    return row["id"]


def update_doctor(doctor_id: str, data: dict) -> None:
    allowed = {"name", "specialty", "color", "initials"}
    fields = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        return
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [doctor_id]
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                f"UPDATE doctors SET {set_clause} WHERE id::text = %s",
                values,
            )


def delete_doctor(doctor_id: str) -> None:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute("DELETE FROM doctors WHERE id::text = %s", (doctor_id,))


def upsert_doctor_shifts(doctor_id: str, shifts: list[dict]) -> None:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "DELETE FROM doctor_shifts WHERE doctor_id::text = %s", (doctor_id,)
            )
            for s in shifts:
                cur.execute(
                    "INSERT INTO doctor_shifts (doctor_id, day_of_week, morning, afternoon) "
                    "VALUES (%s::uuid, %s, %s, %s)",
                    (doctor_id, s["day_of_week"], s["morning"], s["afternoon"]),
                )


# ── Admin walk-in booking ─────────────────────────────────────────────────────

def create_admin_booking(
    clinic_id: str,
    date: str,
    time_slot: str,
    coverage: str,
    doc: dict,
) -> str:
    """Insert a walk-in booking created by admin. Sets status=confirmed directly."""
    booking_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT capacity, reserved FROM slots "
                "WHERE clinic_id = %s AND date = %s AND time = %s FOR UPDATE",
                (clinic_id, date, time_slot),
            )
            slot = cur.fetchone()
            if slot is None:
                raise ValueError(f"ไม่มีช่องเวลา {time_slot}")
            if slot["reserved"] >= slot["capacity"]:
                raise ValueError(f"เวลา {time_slot} เต็มแล้ว")

            cur.execute(
                """
                INSERT INTO bookings (
                    id, clinic_id, patient_line_id, patient_name, phone,
                    service_id, service_name, deposit_amount,
                    date, time, coverage, status, created_at, updated_at
                ) VALUES (
                    %s, %s, 'walk-in', %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, 'confirmed', %s, %s
                )
                """,
                (
                    booking_id, doc["clinicId"],
                    doc["patientName"], doc["phone"],
                    doc["serviceId"], doc["serviceName"], doc["depositAmount"],
                    doc["date"], doc["time"], doc["coverage"],
                    now, now,
                ),
            )
            cur.execute(
                "UPDATE slots SET reserved = reserved + 1 "
                "WHERE clinic_id = %s AND date = %s AND time = %s",
                (clinic_id, date, time_slot),
            )

    return booking_id
