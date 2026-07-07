-- Migration 005: add clinic_settings table (per-clinic display info)
-- Run: psql $DATABASE_URL -f migrations/005_add_clinic_settings.sql

CREATE TABLE IF NOT EXISTS clinic_settings (
    clinic_id  TEXT PRIMARY KEY,
    name       TEXT NOT NULL DEFAULT '',
    address    TEXT NOT NULL DEFAULT '',
    phone      TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
