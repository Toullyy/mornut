from typing import Optional

from app.core.db import cursor, get_conn

_CLINIC_SETTINGS_FIELDS = (
    "name", "address", "phone", "open_time", "close_time",
    "reminder_enabled", "reminder_days_before", "reminder_time", "cancel_ttl_minutes",
    "sso_enabled", "sso_deposit_required", "sso_deposit_amount",
    "universal_enabled", "universal_deposit_required", "universal_deposit_amount",
    "cash_deposit_required", "cash_deposit_amount",
)


def get_admin_by_email(email: str) -> Optional[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute("SELECT * FROM admin_users WHERE email = %s", (email,))
            row = cur.fetchone()
    return dict(row) if row else None


def get_clinic_settings(clinic_id: str) -> Optional[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute("SELECT * FROM clinic_settings WHERE clinic_id = %s", (clinic_id,))
            row = cur.fetchone()
    return dict(row) if row else None


def upsert_clinic_settings(clinic_id: str, **fields) -> dict:
    cols = [f for f in fields if f in _CLINIC_SETTINGS_FIELDS]
    values = [fields[c] for c in cols]

    insert_cols = ["clinic_id", *cols]
    placeholders = ", ".join(["%s"] * len(insert_cols))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols)
    update_clause = f"{updates}, updated_at = NOW()" if updates else "updated_at = NOW()"

    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                f"INSERT INTO clinic_settings ({', '.join(insert_cols)}) "
                f"VALUES ({placeholders}) "
                f"ON CONFLICT (clinic_id) DO UPDATE SET {update_clause} "
                f"RETURNING *",
                [clinic_id, *values],
            )
            row = cur.fetchone()
    return dict(row)
