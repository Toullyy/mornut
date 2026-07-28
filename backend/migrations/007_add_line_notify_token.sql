-- Migration 007: store LINE Notify token per-clinic in clinic_settings
-- Run: psql $DATABASE_URL -f migrations/007_add_line_notify_token.sql

ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS line_notify_token TEXT;
