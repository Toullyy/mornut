-- Migration 003: add chat_conversations + chat_messages (AI / admin-override chat)
-- Run: psql $DATABASE_URL -f migrations/003_add_chat_tables.sql

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
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_clinic ON chat_conversations(clinic_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
    id           UUID PRIMARY KEY,
    line_user_id TEXT NOT NULL REFERENCES chat_conversations(line_user_id) ON DELETE CASCADE,
    direction    TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    sender       TEXT NOT NULL CHECK (sender IN ('patient', 'ai', 'admin')),
    text         TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(line_user_id, created_at);
