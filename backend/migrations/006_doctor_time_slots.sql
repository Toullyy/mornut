-- Migration 006: replace morning/afternoon boolean shifts with flexible time slots
-- Run: psql $DATABASE_URL -f migrations/006_doctor_time_slots.sql

CREATE TABLE IF NOT EXISTS doctor_time_slots (
    id          SERIAL PRIMARY KEY,
    doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_time_slots_doctor ON doctor_time_slots(doctor_id, day_of_week);

-- Migrate existing morning/afternoon data into time slots
INSERT INTO doctor_time_slots (doctor_id, day_of_week, start_time, end_time, sort_order)
SELECT doctor_id, day_of_week, '08:00'::time, '12:00'::time, 0
FROM doctor_shifts WHERE morning = TRUE
ON CONFLICT DO NOTHING;

INSERT INTO doctor_time_slots (doctor_id, day_of_week, start_time, end_time, sort_order)
SELECT doctor_id, day_of_week, '13:00'::time, '17:00'::time, 1
FROM doctor_shifts WHERE afternoon = TRUE
ON CONFLICT DO NOTHING;
