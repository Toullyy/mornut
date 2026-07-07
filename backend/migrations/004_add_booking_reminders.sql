-- Migration 004: add booking_reminders (recurring LINE "come back for a checkup" nudges)
-- Run: psql $DATABASE_URL -f migrations/004_add_booking_reminders.sql

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
);

CREATE INDEX IF NOT EXISTS idx_booking_reminders_clinic ON booking_reminders(clinic_id, next_reminder_date);
