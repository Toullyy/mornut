import uuid
from typing import Optional

from app.core.db import cursor, get_conn

_BOOKING_REMINDER_FIELDS = ("interval_days", "next_reminder_date", "status")


def create_booking_reminder(
    clinic_id: str,
    patient_line_id: str,
    patient_name: str,
    patient_phone: str,
    interval_days: int,
    start_date: str,
) -> dict:
    reminder_id = str(uuid.uuid4())
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                """
                INSERT INTO booking_reminders (
                    id, clinic_id, patient_line_id, patient_name, patient_phone,
                    interval_days, next_reminder_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (reminder_id, clinic_id, patient_line_id, patient_name, patient_phone, interval_days, start_date),
            )
            row = cur.fetchone()
    return dict(row)


def list_booking_reminders(clinic_id: str) -> list[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM booking_reminders WHERE clinic_id = %s "
                "ORDER BY (status = 'active') DESC, next_reminder_date ASC",
                (clinic_id,),
            )
            return [dict(r) for r in cur.fetchall()]


def get_booking_reminder(reminder_id: str) -> Optional[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute("SELECT * FROM booking_reminders WHERE id = %s", (reminder_id,))
            row = cur.fetchone()
    return dict(row) if row else None


def update_booking_reminder(reminder_id: str, **fields) -> dict:
    cols = [f for f in fields if f in _BOOKING_REMINDER_FIELDS]
    values = [fields[c] for c in cols]
    set_clause = ", ".join(f"{c} = %s" for c in cols) + ", updated_at = NOW()" if cols else "updated_at = NOW()"

    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                f"UPDATE booking_reminders SET {set_clause} WHERE id = %s RETURNING *",
                [*values, reminder_id],
            )
            row = cur.fetchone()
    return dict(row)


def list_due_reminders(clinic_id: str) -> list[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM booking_reminders "
                "WHERE clinic_id = %s AND status = 'active' AND next_reminder_date <= CURRENT_DATE",
                (clinic_id,),
            )
            return [dict(r) for r in cur.fetchall()]


def mark_reminder_sent(reminder_id: str) -> dict:
    """Record a successful send and advance next_reminder_date by interval."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                """
                UPDATE booking_reminders SET
                    last_reminded_at = NOW(),
                    next_reminder_date = (next_reminder_date + (interval_days || ' days')::INTERVAL)::DATE,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
                """,
                (reminder_id,),
            )
            row = cur.fetchone()
    return dict(row)


def list_line_patients(clinic_id: str) -> list[dict]:
    """Distinct patients with a real LINE account (excludes walk-ins)."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (patient_line_id) patient_line_id, patient_name, phone
                FROM bookings
                WHERE clinic_id = %s AND patient_line_id <> 'walk-in'
                ORDER BY patient_line_id, created_at DESC
                """,
                (clinic_id,),
            )
            return [dict(r) for r in cur.fetchall()]
