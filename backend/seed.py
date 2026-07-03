"""Seed script — creates schema and inserts mock data (10 bookings for today).

Usage:
    cd backend
    python seed.py

Reads DATABASE_URL from backend/.env automatically.
Default admin: admin@clinic.com / admin1234
"""
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

# Load .env before importing app modules
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import psycopg2
from psycopg2.extras import RealDictCursor
from passlib.context import CryptContext

DATABASE_URL = os.environ["DATABASE_URL"]
CLINIC_ID = os.environ.get("CLINIC_ID", "clinic-001")

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

TODAY = date.today().isoformat()

MOCK_BOOKINGS = [
    dict(patient_name="สมหญิง เจริญสุข",   phone="081-234-5678", service_name="ตรวจโรคทั่วไป",   time="08:30", coverage="universal", status="done",         deposit=0),
    dict(patient_name="วิชัย ประทุมชาติ",    phone="086-567-8901", service_name="ฉีดวัคซีน",        time="09:00", coverage="sso",       status="done",         deposit=200),
    dict(patient_name="รัตนา สมบูรณ์วงศ์",  phone="062-345-6789", service_name="ตรวจเลือด",        time="09:30", coverage="cash",      status="confirmed",    deposit=300),
    dict(patient_name="ธนพล มีชัยสิน",      phone="091-456-7890", service_name="ตรวจโรคทั่วไป",   time="10:00", coverage="universal", status="reminded",     deposit=0),
    dict(patient_name="กนกวรรณ อุดมสุข",    phone="083-901-2345", service_name="กายภาพบำบัด",     time="10:30", coverage="sso",       status="confirmed",    deposit=500),
    dict(patient_name="ประยุทธ์ แสงทอง",    phone="089-012-3456", service_name="ตรวจสายตา",        time="11:00", coverage="cash",      status="pending_slip", deposit=250),
    dict(patient_name="นิภา ดีงาม",          phone="084-123-4567", service_name="ตรวจโรคทั่วไป",   time="11:30", coverage="universal", status="confirmed",    deposit=0),
    dict(patient_name="สมชาย โชคดีมาก",     phone="087-234-5678", service_name="ฉีดวัคซีน",        time="13:00", coverage="cash",      status="no_show",      deposit=200),
    dict(patient_name="พิมพ์ชนก วรรณศิลป์", phone="095-345-6789", service_name="กายภาพบำบัด",     time="13:30", coverage="sso",       status="pending_slip", deposit=500),
    dict(patient_name="อนุชา ทองคำ",         phone="092-456-7890", service_name="ตรวจเลือด",        time="14:00", coverage="universal", status="confirmed",    deposit=0),
]

SERVICES = [
    ("ตรวจโรคทั่วไป",  30, 200),
    ("ฉีดวัคซีน",      15, 100),
    ("ตรวจเลือด",      20, 300),
    ("กายภาพบำบัด",   45, 500),
    ("ตรวจสายตา",      20, 250),
]

TIMES = ["08:30","09:00","09:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30"]


def main() -> None:
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # ── Schema ────────────────────────────────────────────────────────────────
    schema = (Path(__file__).parent / "init.sql").read_text()
    cur.execute(schema)

    # ── Admin user ────────────────────────────────────────────────────────────
    admin_email = "admin@clinic.com"
    admin_password = "admin1234"
    cur.execute("SELECT id FROM admin_users WHERE email = %s", (admin_email,))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO admin_users (email, password_hash) VALUES (%s, %s)",
            (admin_email, _pwd.hash(admin_password)),
        )
        print(f"  Created admin user: {admin_email} / {admin_password}")
    else:
        print(f"  Admin user already exists: {admin_email}")

    # ── Services ──────────────────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM services WHERE clinic_id = %s", (CLINIC_ID,))
    if cur.fetchone()["count"] == 0:
        for name, duration_min, deposit_amount in SERVICES:
            cur.execute(
                "INSERT INTO services (clinic_id, name, duration_min, deposit_amount) VALUES (%s,%s,%s,%s)",
                (CLINIC_ID, name, duration_min, deposit_amount),
            )
        print(f"  Inserted {len(SERVICES)} services")

    # ── Slots ─────────────────────────────────────────────────────────────────
    for t in TIMES:
        cur.execute(
            """
            INSERT INTO slots (clinic_id, date, time, capacity, reserved)
            VALUES (%s, %s, %s, 3, 0)
            ON CONFLICT (clinic_id, date, time) DO NOTHING
            """,
            (CLINIC_ID, TODAY, t),
        )

    # ── Quotas ────────────────────────────────────────────────────────────────
    for coverage, limit in [("cash", 10), ("sso", 8), ("universal", 12)]:
        cur.execute(
            """
            INSERT INTO quotas (clinic_id, date, coverage, limit_count, used_count)
            VALUES (%s, %s, %s, %s, 0)
            ON CONFLICT (clinic_id, date, coverage) DO NOTHING
            """,
            (CLINIC_ID, TODAY, coverage, limit),
        )

    # ── Bookings ──────────────────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM bookings WHERE clinic_id = %s AND date = %s", (CLINIC_ID, TODAY))
    if cur.fetchone()["count"] > 0:
        print(f"  Bookings already exist for {TODAY}, skipping.")
    else:
        now = datetime.now(timezone.utc)
        for b in MOCK_BOOKINGS:
            cur.execute(
                """
                INSERT INTO bookings (
                    clinic_id, patient_line_id, patient_name, phone,
                    service_id, service_name, deposit_amount,
                    date, time, coverage, status, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s,
                    'mock-service', %s, %s,
                    %s, %s, %s, %s, %s, %s
                )
                """,
                (
                    CLINIC_ID, f"U_mock_{b['phone'].replace('-','')}",
                    b["patient_name"], b["phone"],
                    b["service_name"], b["deposit"],
                    TODAY, b["time"], b["coverage"], b["status"],
                    now, now,
                ),
            )
        print(f"  Inserted {len(MOCK_BOOKINGS)} mock bookings for {TODAY}")

    conn.commit()
    cur.close()
    conn.close()
    print("\nDone! Seed completed successfully.")
    print(f"  Admin login: {admin_email} / {admin_password}")
    print(f"  Clinic ID  : {CLINIC_ID}")
    print(f"  Bookings   : {TODAY}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
