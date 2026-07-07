from app.core.db import cursor, get_conn


def get_slots(clinic_id: str, date: str) -> dict:
    """Return slot map: {"09:00": {"capacity": 2, "reserved": 1}, ...}"""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT time, capacity, reserved FROM slots "
                "WHERE clinic_id = %s AND date = %s ORDER BY time",
                (clinic_id, date),
            )
            rows = cur.fetchall()
    return {
        str(r["time"])[:5]: {"capacity": r["capacity"], "reserved": r["reserved"]}
        for r in rows
    }


def get_quota(clinic_id: str, date: str) -> dict:
    """Return quota map: {"cash": {"limit": 10, "used": 3}, ...}"""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT coverage, limit_count, used_count FROM quotas "
                "WHERE clinic_id = %s AND date = %s",
                (clinic_id, date),
            )
            rows = cur.fetchall()
    return {r["coverage"]: {"limit": r["limit_count"], "used": r["used_count"]} for r in rows}


def set_quota(clinic_id: str, date: str, data: dict) -> None:
    with get_conn() as conn:
        with cursor(conn) as cur:
            for coverage, info in data.items():
                cur.execute(
                    """
                    INSERT INTO quotas (clinic_id, date, coverage, limit_count, used_count)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (clinic_id, date, coverage)
                    DO UPDATE SET limit_count = EXCLUDED.limit_count
                    """,
                    (clinic_id, date, coverage, info.get("limit", 0), info.get("used", 0)),
                )


def update_quota_limits(clinic_id: str, date: str, cash: int, sso: int, universal: int) -> None:
    with get_conn() as conn:
        with cursor(conn) as cur:
            for coverage, limit in [("cash", cash), ("sso", sso), ("universal", universal)]:
                cur.execute(
                    """
                    INSERT INTO quotas (clinic_id, date, coverage, limit_count, used_count)
                    VALUES (%s, %s, %s, %s, 0)
                    ON CONFLICT (clinic_id, date, coverage)
                    DO UPDATE SET limit_count = EXCLUDED.limit_count
                    """,
                    (clinic_id, date, coverage, limit),
                )
