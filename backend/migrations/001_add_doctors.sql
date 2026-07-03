-- Migration 001: add doctors and doctor_shifts tables
-- Run: psql $DATABASE_URL -f migrations/001_add_doctors.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS doctors (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    specialty   TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT 'bg-sky-500',
    initials    TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctors_clinic ON doctors(clinic_id);

CREATE TABLE IF NOT EXISTS doctor_shifts (
    id          SERIAL PRIMARY KEY,
    doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    morning     BOOLEAN NOT NULL DEFAULT FALSE,
    afternoon   BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (doctor_id, day_of_week)
);
