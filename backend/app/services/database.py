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
            cur.execute(
                "UPDATE quotas SET used_count = used_count + 1 "
                "WHERE clinic_id = %s AND date = %s AND coverage = %s",
                (clinic_id, date, coverage),
            )

    return booking_id


# ── LINE OA settings ──────────────────────────────────────────────────────────

# Columns clients are allowed to upsert (clinic_id is the key, updated_at is set automatically).
_LINE_SETTINGS_FIELDS = (
    "channel_secret",
    "channel_access_token",
    "bot_user_id",
    "bot_display_name",
    "bot_picture_url",
    "webhook_url",
    "webhook_active",
    "rich_menu_id",
)


def ensure_schema() -> None:
    """Idempotently create tables that may be missing on an already-initialised DB.

    init.sql runs only on a fresh Postgres volume, so newer tables (e.g. line_settings)
    are created here at startup to avoid requiring a manual migration on existing volumes.
    """
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS line_settings (
                    clinic_id            TEXT PRIMARY KEY,
                    channel_secret       TEXT NOT NULL DEFAULT '',
                    channel_access_token TEXT NOT NULL DEFAULT '',
                    bot_user_id          TEXT NOT NULL DEFAULT '',
                    bot_display_name     TEXT NOT NULL DEFAULT '',
                    bot_picture_url      TEXT NOT NULL DEFAULT '',
                    webhook_url          TEXT NOT NULL DEFAULT '',
                    webhook_active       BOOLEAN NOT NULL DEFAULT FALSE,
                    rich_menu_id         TEXT NOT NULL DEFAULT '',
                    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_conversations (
                    line_user_id        TEXT PRIMARY KEY,
                    clinic_id           TEXT NOT NULL,
                    display_name        TEXT NOT NULL DEFAULT '',
                    picture_url         TEXT NOT NULL DEFAULT '',
                    mode                TEXT NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai', 'admin')),
                    status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
                    needs_attention     BOOLEAN NOT NULL DEFAULT FALSE,
                    last_admin_reply_at TIMESTAMPTZ,
                    last_message_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_message_preview TEXT NOT NULL DEFAULT '',
                    unread_count        INTEGER NOT NULL DEFAULT 0,
                    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_chat_conversations_clinic "
                "ON chat_conversations(clinic_id, last_message_at DESC)"
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id           UUID PRIMARY KEY,
                    line_user_id TEXT NOT NULL REFERENCES chat_conversations(line_user_id) ON DELETE CASCADE,
                    direction    TEXT NOT NULL CHECK (direction IN ('in', 'out')),
                    sender       TEXT NOT NULL CHECK (sender IN ('patient', 'ai', 'admin')),
                    text         TEXT NOT NULL,
                    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation "
                "ON chat_messages(line_user_id, created_at)"
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS booking_reminders (
                    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    clinic_id          TEXT NOT NULL,
                    patient_line_id    TEXT NOT NULL,
                    patient_name       TEXT NOT NULL,
                    patient_phone      TEXT NOT NULL DEFAULT '',
                    interval_days      INTEGER NOT NULL CHECK (interval_days > 0),
                    next_reminder_date DATE NOT NULL,
                    status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stopped')),
                    last_reminded_at   TIMESTAMPTZ,
                    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_booking_reminders_clinic "
                "ON booking_reminders(clinic_id, next_reminder_date)"
            )


def get_line_settings(clinic_id: str) -> Optional[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute("SELECT * FROM line_settings WHERE clinic_id = %s", (clinic_id,))
            row = cur.fetchone()
    return dict(row) if row else None


def upsert_line_settings(clinic_id: str, **fields) -> dict:
    """Insert or update a clinic's LINE settings. Only known columns are written."""
    cols = [f for f in fields if f in _LINE_SETTINGS_FIELDS]
    values = [fields[c] for c in cols]

    insert_cols = ["clinic_id", *cols]
    placeholders = ", ".join(["%s"] * len(insert_cols))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols)
    update_clause = f"{updates}, updated_at = NOW()" if updates else "updated_at = NOW()"

    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                f"INSERT INTO line_settings ({', '.join(insert_cols)}) "
                f"VALUES ({placeholders}) "
                f"ON CONFLICT (clinic_id) DO UPDATE SET {update_clause} "
                f"RETURNING *",
                [clinic_id, *values],
            )
            row = cur.fetchone()
    return dict(row)


# ── Chat (AI / admin-override) ─────────────────────────────────────────────────

_MESSAGE_PREVIEW_LEN = 80


def get_conversation(line_user_id: str) -> Optional[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM chat_conversations WHERE line_user_id = %s", (line_user_id,)
            )
            row = cur.fetchone()
    return dict(row) if row else None


def get_or_create_conversation(
    line_user_id: str, clinic_id: str, display_name: str = "", picture_url: str = ""
) -> dict:
    """Fetch a conversation, creating it (as a fresh AI-mode thread) if it's new."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                """
                INSERT INTO chat_conversations (line_user_id, clinic_id, display_name, picture_url)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (line_user_id) DO NOTHING
                """,
                (line_user_id, clinic_id, display_name, picture_url),
            )
            cur.execute(
                "SELECT * FROM chat_conversations WHERE line_user_id = %s", (line_user_id,)
            )
            row = cur.fetchone()
    return dict(row)


def list_conversations(clinic_id: str) -> list[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM chat_conversations WHERE clinic_id = %s "
                "ORDER BY last_message_at DESC",
                (clinic_id,),
            )
            return [dict(r) for r in cur.fetchall()]


def get_messages(line_user_id: str, limit: int = 100) -> list[dict]:
    """Return up to `limit` most recent messages, oldest first."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM chat_messages WHERE line_user_id = %s "
                "ORDER BY created_at DESC LIMIT %s",
                (line_user_id, limit),
            )
            rows = cur.fetchall()
    return [dict(r) for r in reversed(rows)]


def get_last_inbound_message(line_user_id: str) -> Optional[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM chat_messages WHERE line_user_id = %s AND direction = 'in' "
                "ORDER BY created_at DESC LIMIT 1",
                (line_user_id,),
            )
            row = cur.fetchone()
    return dict(row) if row else None


def add_message(line_user_id: str, direction: str, sender: str, text: str) -> dict:
    message_id = str(uuid.uuid4())
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "INSERT INTO chat_messages (id, line_user_id, direction, sender, text) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING *",
                (message_id, line_user_id, direction, sender, text),
            )
            row = cur.fetchone()
    return dict(row)


def record_inbound_message(line_user_id: str, text: str) -> None:
    """Log an inbound patient message and bump the conversation's last-message bookkeeping."""
    add_message(line_user_id, "in", "patient", text)
    preview = text.strip()[:_MESSAGE_PREVIEW_LEN]
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "UPDATE chat_conversations SET "
                "last_message_at = NOW(), last_message_preview = %s, "
                "unread_count = unread_count + 1, updated_at = NOW() "
                "WHERE line_user_id = %s",
                (preview, line_user_id),
            )


def record_outbound_message(line_user_id: str, sender: str, text: str) -> None:
    """Log an AI/admin reply. Does not touch last_message_at (that tracks patient activity)."""
    add_message(line_user_id, "out", sender, text)


def set_conversation_admin_reply(line_user_id: str) -> dict:
    """Admin sent a manual reply: take over from AI and clear unread/attention flags."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "UPDATE chat_conversations SET "
                "mode = 'admin', status = 'open', needs_attention = FALSE, "
                "last_admin_reply_at = NOW(), unread_count = 0, updated_at = NOW() "
                "WHERE line_user_id = %s RETURNING *",
                (line_user_id,),
            )
            row = cur.fetchone()
    return dict(row)


def set_conversation_mode(line_user_id: str, mode: str) -> dict:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "UPDATE chat_conversations SET mode = %s, updated_at = NOW() "
                "WHERE line_user_id = %s RETURNING *",
                (mode, line_user_id),
            )
            row = cur.fetchone()
    return dict(row)


def resolve_conversation(line_user_id: str) -> dict:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "UPDATE chat_conversations SET status = 'resolved', updated_at = NOW() "
                "WHERE line_user_id = %s RETURNING *",
                (line_user_id,),
            )
            row = cur.fetchone()
    return dict(row)


def reopen_conversation_as_ai(line_user_id: str) -> dict:
    """Used both when a resolved thread gets a new message and when an admin-mode
    conversation times out — either way, AI takes over a fresh/open thread."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "UPDATE chat_conversations SET mode = 'ai', status = 'open', updated_at = NOW() "
                "WHERE line_user_id = %s RETURNING *",
                (line_user_id,),
            )
            row = cur.fetchone()
    return dict(row)


def set_needs_attention(line_user_id: str, flag: bool) -> None:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "UPDATE chat_conversations SET needs_attention = %s, updated_at = NOW() "
                "WHERE line_user_id = %s",
                (flag, line_user_id),
            )


def list_timed_out_admin_conversations(timeout_minutes: int) -> list[dict]:
    """Conversations stuck in admin mode with an inbound message the admin never
    answered, older than the timeout window."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                """
                SELECT * FROM chat_conversations
                WHERE mode = 'admin' AND status = 'open'
                  AND last_message_at < NOW() - (%s || ' minutes')::INTERVAL
                  AND (last_admin_reply_at IS NULL OR last_admin_reply_at < last_message_at)
                """,
                (timeout_minutes,),
            )
            return [dict(r) for r in cur.fetchall()]


# ── Booking reminders (recurring LINE "come back for a checkup" nudges) ────────

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
    """Push succeeded: record it and push next_reminder_date forward by the
    interval. Reminders run indefinitely until an admin stops them."""
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
    """Distinct patients who have a real LINE account on file (excludes admin-
    created walk-ins, which all share the literal patient_line_id='walk-in'
    and so have no LINE account to push a reminder to)."""
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
