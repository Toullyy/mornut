from app.core.db import cursor, get_conn


def ensure_schema() -> None:
    """Idempotently create tables that may be missing on an already-initialised DB.

    init.sql runs only on a fresh Postgres volume, so newer tables are created here
    at startup to avoid requiring a manual migration on existing volumes.
    """
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS clinic_settings (
                    clinic_id             TEXT PRIMARY KEY,
                    name                  TEXT    NOT NULL DEFAULT '',
                    address               TEXT    NOT NULL DEFAULT '',
                    phone                 TEXT    NOT NULL DEFAULT '',
                    open_time             TEXT    NOT NULL DEFAULT '08:00',
                    close_time            TEXT    NOT NULL DEFAULT '17:00',
                    reminder_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
                    reminder_days_before  INT     NOT NULL DEFAULT 1,
                    reminder_time         TEXT    NOT NULL DEFAULT '18:00',
                    cancel_ttl_minutes    INT     NOT NULL DEFAULT 15,
                    sso_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
                    sso_deposit_required  BOOLEAN NOT NULL DEFAULT FALSE,
                    sso_deposit_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
                    universal_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
                    universal_deposit_required BOOLEAN NOT NULL DEFAULT FALSE,
                    universal_deposit_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
                    cash_deposit_required BOOLEAN NOT NULL DEFAULT FALSE,
                    cash_deposit_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
                    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            for col, definition in [
                ("reminder_enabled",     "BOOLEAN NOT NULL DEFAULT TRUE"),
                ("reminder_days_before", "INT     NOT NULL DEFAULT 1"),
                ("reminder_time",        "TEXT    NOT NULL DEFAULT '18:00'"),
                ("cancel_ttl_minutes",   "INT     NOT NULL DEFAULT 15"),
                ("sso_enabled",          "BOOLEAN NOT NULL DEFAULT TRUE"),
                ("sso_deposit_required", "BOOLEAN NOT NULL DEFAULT FALSE"),
                ("sso_deposit_amount",   "NUMERIC(10,2) NOT NULL DEFAULT 0"),
                ("universal_enabled",    "BOOLEAN NOT NULL DEFAULT TRUE"),
                ("universal_deposit_required", "BOOLEAN NOT NULL DEFAULT FALSE"),
                ("universal_deposit_amount",   "NUMERIC(10,2) NOT NULL DEFAULT 0"),
                ("cash_deposit_required","BOOLEAN NOT NULL DEFAULT FALSE"),
                ("cash_deposit_amount",  "NUMERIC(10,2) NOT NULL DEFAULT 0"),
            ]:
                cur.execute(
                    f"ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS {col} {definition}"
                )
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
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS doctor_time_slots (
                    id          SERIAL PRIMARY KEY,
                    doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
                    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
                    start_time  TIME NOT NULL,
                    end_time    TIME NOT NULL,
                    sort_order  INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_time_slots_doctor "
                "ON doctor_time_slots(doctor_id, day_of_week)"
            )
            cur.execute(
                "ALTER TABLE clinic_settings "
                "ADD COLUMN IF NOT EXISTS open_time  TEXT NOT NULL DEFAULT '08:00', "
                "ADD COLUMN IF NOT EXISTS close_time TEXT NOT NULL DEFAULT '17:00'"
            )
            # One-time migration: copy morning/afternoon rows → time slots
            cur.execute(
                """
                INSERT INTO doctor_time_slots (doctor_id, day_of_week, start_time, end_time, sort_order)
                SELECT doctor_id, day_of_week, '08:00'::time, '12:00'::time, 0
                FROM doctor_shifts ds
                WHERE ds.morning = TRUE
                  AND NOT EXISTS (
                    SELECT 1 FROM doctor_time_slots ts
                    WHERE ts.doctor_id = ds.doctor_id
                      AND ts.day_of_week = ds.day_of_week
                  )
                """
            )
            cur.execute(
                """
                INSERT INTO doctor_time_slots (doctor_id, day_of_week, start_time, end_time, sort_order)
                SELECT doctor_id, day_of_week, '13:00'::time, '17:00'::time, 1
                FROM doctor_shifts ds
                WHERE ds.afternoon = TRUE
                  AND NOT EXISTS (
                    SELECT 1 FROM doctor_time_slots ts
                    WHERE ts.doctor_id = ds.doctor_id
                      AND ts.day_of_week = ds.day_of_week
                      AND ts.start_time = '13:00'::time
                  )
                """
            )
