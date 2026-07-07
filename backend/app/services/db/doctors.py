from app.core.db import cursor, get_conn


def get_doctors(clinic_id: str) -> list[dict]:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT id::text, clinic_id, name, specialty, color, initials "
                "FROM doctors WHERE clinic_id = %s ORDER BY created_at",
                (clinic_id,),
            )
            doctors = [dict(r) for r in cur.fetchall()]
            if doctors:
                ids = tuple(d["id"] for d in doctors)
                placeholders = ",".join(["%s"] * len(ids))
                cur.execute(
                    f"SELECT doctor_id::text, day_of_week, "
                    f"to_char(start_time, 'HH24:MI') AS start, "
                    f"to_char(end_time, 'HH24:MI') AS end "
                    f"FROM doctor_time_slots "
                    f"WHERE doctor_id::text IN ({placeholders}) "
                    f"ORDER BY day_of_week, sort_order",
                    ids,
                )
                shifts_map: dict[str, list[dict]] = {}
                for s in cur.fetchall():
                    did = s["doctor_id"]
                    shifts_map.setdefault(did, []).append({
                        "day_of_week": s["day_of_week"],
                        "start": s["start"],
                        "end": s["end"],
                    })
                for d in doctors:
                    d["shifts"] = shifts_map.get(d["id"], [])
    return doctors


def create_doctor(clinic_id: str, name: str, specialty: str, color: str, initials: str) -> str:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "INSERT INTO doctors (clinic_id, name, specialty, color, initials) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id::text",
                (clinic_id, name, specialty, color, initials),
            )
            row = cur.fetchone()
    return row["id"]


def update_doctor(doctor_id: str, data: dict) -> None:
    allowed = {"name", "specialty", "color", "initials"}
    fields = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        return
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [doctor_id]
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                f"UPDATE doctors SET {set_clause} WHERE id::text = %s",
                values,
            )


def delete_doctor(doctor_id: str) -> None:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute("DELETE FROM doctors WHERE id::text = %s", (doctor_id,))


def upsert_doctor_shifts(doctor_id: str, shifts: list[dict]) -> None:
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "DELETE FROM doctor_time_slots WHERE doctor_id::text = %s", (doctor_id,)
            )
            for i, s in enumerate(shifts):
                cur.execute(
                    "INSERT INTO doctor_time_slots "
                    "(doctor_id, day_of_week, start_time, end_time, sort_order) "
                    "VALUES (%s::uuid, %s, %s::time, %s::time, %s)",
                    (doctor_id, s["day_of_week"], s["start"], s["end"], i),
                )
