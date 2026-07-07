import uuid
from typing import Optional

from app.core.db import cursor, get_conn

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
    add_message(line_user_id, "out", sender, text)


def set_conversation_admin_reply(line_user_id: str) -> dict:
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
