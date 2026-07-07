import uuid
from datetime import datetime, timezone
from typing import Optional

from app.core.db import cursor, get_conn


def _row_to_booking(row: dict) -> dict:
    r = dict(row)
    r["date"] = str(r["date"])
    r["time"] = str(r["time"])[:5]
    return r


def _reserve_slot_and_quota(cur, clinic_id: str, date: str, time_slot: str, coverage: str) -> None:
    """Check capacity and quota, then increment counters. Must be called inside an open cursor."""
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
        "SELECT limit_count, used_count FROM quotas "
        "WHERE clinic_id = %s AND date = %s AND coverage = %s FOR UPDATE",
        (clinic_id, date, coverage),
    )
    quota = cur.fetchone()
    if quota is None:
        raise ValueError(f"ไม่มีโควตาสำหรับสิทธิ์ {coverage}")
    if quota["used_count"] >= quota["limit_count"]:
        raise ValueError(f"สิทธิ์ {coverage} เต็มในวันนี้")

    cur.execute(
        "UPDATE slots SET reserved = reserved + 1 "
        "WHERE clinic_id = %s AND date = %s AND time = %s",
        (clinic_id, date, time_slot),
    )
    cur.execute(
        "UPDATE quotas SET used_count = used_count + 1 "
        "WHERE clinic_id = %s AND date = %s AND coverage = %s",
        (clinic_id, date, coverage),
    )


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


def list_bookings_range(clinic_id: str, start_date: str, end_date: str) -> list[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM bookings WHERE clinic_id = %s AND date BETWEEN %s AND %s "
                "ORDER BY date ASC, time ASC",
                (clinic_id, start_date, end_date),
            )
            rows = cur.fetchall()
    return [_row_to_booking(dict(r)) for r in rows]


def list_all_bookings(clinic_id: str) -> list[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM bookings WHERE clinic_id = %s ORDER BY date DESC, time DESC",
                (clinic_id,),
            )
            rows = cur.fetchall()
    return [_row_to_booking(dict(r)) for r in rows]


def list_all_bookings_paged(
    clinic_id: str, search: str, page: int, page_size: int
) -> tuple[list[dict], int]:
    offset = (page - 1) * page_size
    with get_conn() as conn:
        with cursor(conn) as cur:
            if search:
                like = f"%{search}%"
                cur.execute(
                    "SELECT COUNT(*) AS n FROM bookings WHERE clinic_id = %s "
                    "AND (patient_name ILIKE %s OR phone ILIKE %s)",
                    (clinic_id, like, like),
                )
                total = cur.fetchone()["n"]
                cur.execute(
                    "SELECT * FROM bookings WHERE clinic_id = %s "
                    "AND (patient_name ILIKE %s OR phone ILIKE %s) "
                    "ORDER BY date DESC, time DESC LIMIT %s OFFSET %s",
                    (clinic_id, like, like, page_size, offset),
                )
            else:
                cur.execute(
                    "SELECT COUNT(*) AS n FROM bookings WHERE clinic_id = %s",
                    (clinic_id,),
                )
                total = cur.fetchone()["n"]
                cur.execute(
                    "SELECT * FROM bookings WHERE clinic_id = %s "
                    "ORDER BY date DESC, time DESC LIMIT %s OFFSET %s",
                    (clinic_id, page_size, offset),
                )
            rows = cur.fetchall()
    return [_row_to_booking(dict(r)) for r in rows], total


def create_booking(
    clinic_id: str,
    date: str,
    time_slot: str,
    coverage: str,
    doc: dict,
    initial_status: str = "pending_slip",
) -> str:
    """Insert a booking with slot+quota guard inside a single transaction.

    Raises ValueError if the slot is full or coverage quota is exhausted.
    """
    booking_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    with get_conn() as conn:
        with cursor(conn) as cur:
            _reserve_slot_and_quota(cur, clinic_id, date, time_slot, coverage)
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
                    doc["clinic_id"],
                    doc["patient_line_id"],
                    doc["patient_name"],
                    doc["phone"],
                    doc["service_id"],
                    doc["service_name"],
                    doc["deposit_amount"],
                    doc["date"],
                    doc["time"],
                    doc["coverage"],
                    now, now,
                ),
            )
    return booking_id


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
            _reserve_slot_and_quota(cur, clinic_id, date, time_slot, coverage)
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
                    booking_id, doc["clinic_id"],
                    doc["patient_name"], doc["phone"],
                    doc["service_id"], doc["service_name"], doc["deposit_amount"],
                    doc["date"], doc["time"], doc["coverage"],
                    now, now,
                ),
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
    """Cancel a booking and release its slot + quota counter atomically."""
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


def is_trans_ref_used(trans_ref: str) -> bool:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT 1 FROM bookings WHERE slip_trans_ref = %s AND slip_verified = TRUE LIMIT 1",
                (trans_ref,),
            )
            return cur.fetchone() is not None


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
    """Return upcoming (confirmed/reminded) bookings for a LINE user."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM bookings "
                "WHERE patient_line_id = %s AND status IN ('confirmed', 'reminded') "
                "ORDER BY date ASC, time ASC LIMIT 5",
                (patient_line_id,),
            )
            return [_row_to_booking(dict(r)) for r in cur.fetchall()]
