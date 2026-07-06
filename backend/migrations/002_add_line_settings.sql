-- Migration 002: add line_settings table (per-clinic LINE OA connection)
-- Run: psql $DATABASE_URL -f migrations/002_add_line_settings.sql

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
);
