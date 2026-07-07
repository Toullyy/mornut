from typing import Optional

from app.core.db import cursor, get_conn

_LINE_SETTINGS_FIELDS = (
    "channel_secret",
    "channel_access_token",
    "bot_user_id",
    "bot_display_name",
    "bot_picture_url",
    "webhook_url",
    "webhook_active",
    "rich_menu_id",
)


def get_line_settings(clinic_id: str) -> Optional[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute("SELECT * FROM line_settings WHERE clinic_id = %s", (clinic_id,))
            row = cur.fetchone()
    return dict(row) if row else None


def upsert_line_settings(clinic_id: str, **fields) -> dict:
    cols = [f for f in fields if f in _LINE_SETTINGS_FIELDS]
    values = [fields[c] for c in cols]

    insert_cols = ["clinic_id", *cols]
    placeholders = ", ".join(["%s"] * len(insert_cols))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols)
    update_clause = f"{updates}, updated_at = NOW()" if updates else "updated_at = NOW()"

    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                f"INSERT INTO line_settings ({', '.join(insert_cols)}) "
                f"VALUES ({placeholders}) "
                f"ON CONFLICT (clinic_id) DO UPDATE SET {update_clause} "
                f"RETURNING *",
                [clinic_id, *values],
            )
            row = cur.fetchone()
    return dict(row)
