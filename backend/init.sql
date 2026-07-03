-- MorNut PostgreSQL schema
-- Run once: psql $DATABASE_URL -f init.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS admin_users (
    id          SERIAL PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id    TEXT NOT NULL,
    name         TEXT NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 30,
    deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS slots (
    id        SERIAL PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    date      DATE NOT NULL,
    time      TIME NOT NULL,
    capacity  INTEGER NOT NULL DEFAULT 2,
    reserved  INTEGER NOT NULL DEFAULT 0,
    UNIQUE (clinic_id, date, time)
);

CREATE TABLE IF NOT EXISTS quotas (
    id          SERIAL PRIMARY KEY,
    clinic_id   TEXT NOT NULL,
    date        DATE NOT NULL,
    coverage    TEXT NOT NULL CHECK (coverage IN ('cash', 'sso', 'universal')),
    limit_count INTEGER NOT NULL DEFAULT 0,
    used_count  INTEGER NOT NULL DEFAULT 0,
    UNIQUE (clinic_id, date, coverage)
);

CREATE TABLE IF NOT EXISTS bookings (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id        TEXT NOT NULL,
    patient_line_id  TEXT NOT NULL,
    patient_name     TEXT NOT NULL,
    phone            TEXT NOT NULL,
    service_id       TEXT NOT NULL,
    service_name     TEXT NOT NULL DEFAULT '',
    deposit_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
    date             DATE NOT NULL,
    time             TIME NOT NULL,
    coverage         TEXT NOT NULL CHECK (coverage IN ('cash', 'sso', 'universal')),
    status           TEXT NOT NULL DEFAULT 'pending_slip'
                         CHECK (status IN ('pending_slip','confirmed','reminded','done','no_show','cancelled')),
    slip_url         TEXT,
    slip_verified    BOOLEAN DEFAULT FALSE,
    slip_amount      DECIMAL(10,2),
    slip_trans_ref   TEXT,
    slip_verified_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_date        ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_clinic_date ON bookings(clinic_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_trans_ref   ON bookings(slip_trans_ref)
    WHERE slip_trans_ref IS NOT NULL;

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
