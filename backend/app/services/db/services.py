from app.core.db import cursor, get_conn


def get_services(clinic_id: str) -> list[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT id::text, name, duration_min, deposit_amount FROM services "
                "WHERE clinic_id = %s ORDER BY name",
                (clinic_id,),
            )
            return [dict(r) for r in cur.fetchall()]


def create_service(clinic_id: str, name: str, duration_min: int, deposit_amount: float) -> str:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "INSERT INTO services (clinic_id, name, duration_min, deposit_amount) "
                "VALUES (%s, %s, %s, %s) RETURNING id::text",
                (clinic_id, name, duration_min, deposit_amount),
            )
            row = cur.fetchone()
    return row["id"]


def update_service(service_id: str, data: dict) -> None:
    allowed = {"name", "duration_min", "deposit_amount"}
    fields = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        return
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [service_id]
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                f"UPDATE services SET {set_clause} WHERE id::text = %s",
                values,
            )


def delete_service(service_id: str) -> None:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute("DELETE FROM services WHERE id::text = %s", (service_id,))
