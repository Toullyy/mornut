"""
Dev seed script — inserts mock data using the same DB connection as the app.
Run from the backend directory:  python seed.py
"""
import sys
from datetime import date, timedelta

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env")
    sys.exit(1)

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = False
cur = conn.cursor(cursor_factory=RealDictCursor)

today = date.today()

try:
    print(f"Connected. Seeding clinic-001 (today = {today})...")

    # ── Services ──────────────────────────────────────────────────────────────
    cur.execute("""
        INSERT INTO services (id, clinic_id, name, duration_min, deposit_amount) VALUES
          ('00000000-0000-0000-0000-000000000001','clinic-001','ตรวจทั่วไป',            30, 200.00),
          ('00000000-0000-0000-0000-000000000002','clinic-001','ตรวจเลือด',             45, 300.00),
          ('00000000-0000-0000-0000-000000000003','clinic-001','ฉีดวัคซีน',            15, 150.00),
          ('00000000-0000-0000-0000-000000000004','clinic-001','ตรวจสุขภาพประจำปี',    60, 500.00),
          ('00000000-0000-0000-0000-000000000005','clinic-001','ปรึกษาแพทย์',          20,   0.00),
          ('00000000-0000-0000-0000-000000000006','clinic-001','ตรวจคลื่นไฟฟ้าหัวใจ', 30, 400.00)
        ON CONFLICT (id) DO NOTHING
    """)
    print("  services OK")

    # ── Doctors ───────────────────────────────────────────────────────────────
    cur.execute("""
        INSERT INTO doctors (id, clinic_id, name, specialty, color, initials) VALUES
          ('d0000000-0000-0000-0000-000000000001','clinic-001','นพ. สมศักดิ์ แก้วใส', 'อายุรกรรม',      'bg-sky-500',    'สก'),
          ('d0000000-0000-0000-0000-000000000002','clinic-001','พญ. วรรณา ทองคำ',      'กุมารเวชกรรม',   'bg-violet-500', 'วท'),
          ('d0000000-0000-0000-0000-000000000003','clinic-001','นพ. ชัยวัฒน์ ศรีสุข','เวชกรรมทั่วไป',  'bg-emerald-500','ชว'),
          ('d0000000-0000-0000-0000-000000000004','clinic-001','พญ. นภาพร รุ่งเรือง','โรคหัวใจ',       'bg-rose-500',   'นร')
        ON CONFLICT (id) DO NOTHING
    """)
    print("  doctors OK")

    # ── Doctor shifts ─────────────────────────────────────────────────────────
    shifts = [
        ('d0000000-0000-0000-0000-000000000001', 0, True,  True),
        ('d0000000-0000-0000-0000-000000000001', 1, True,  True),
        ('d0000000-0000-0000-0000-000000000001', 2, True,  True),
        ('d0000000-0000-0000-0000-000000000001', 3, True,  True),
        ('d0000000-0000-0000-0000-000000000001', 4, True,  True),
        ('d0000000-0000-0000-0000-000000000001', 5, True,  False),
        ('d0000000-0000-0000-0000-000000000001', 6, False, False),
        ('d0000000-0000-0000-0000-000000000002', 0, True,  True),
        ('d0000000-0000-0000-0000-000000000002', 1, False, False),
        ('d0000000-0000-0000-0000-000000000002', 2, True,  True),
        ('d0000000-0000-0000-0000-000000000002', 3, False, False),
        ('d0000000-0000-0000-0000-000000000002', 4, True,  True),
        ('d0000000-0000-0000-0000-000000000002', 5, False, False),
        ('d0000000-0000-0000-0000-000000000002', 6, False, False),
        ('d0000000-0000-0000-0000-000000000003', 0, False, False),
        ('d0000000-0000-0000-0000-000000000003', 1, True,  True),
        ('d0000000-0000-0000-0000-000000000003', 2, False, False),
        ('d0000000-0000-0000-0000-000000000003', 3, True,  True),
        ('d0000000-0000-0000-0000-000000000003', 4, False, False),
        ('d0000000-0000-0000-0000-000000000003', 5, True,  True),
        ('d0000000-0000-0000-0000-000000000003', 6, False, False),
        ('d0000000-0000-0000-0000-000000000004', 0, True,  False),
        ('d0000000-0000-0000-0000-000000000004', 1, True,  False),
        ('d0000000-0000-0000-0000-000000000004', 2, True,  False),
        ('d0000000-0000-0000-0000-000000000004', 3, True,  False),
        ('d0000000-0000-0000-0000-000000000004', 4, True,  False),
        ('d0000000-0000-0000-0000-000000000004', 5, False, False),
        ('d0000000-0000-0000-0000-000000000004', 6, False, False),
    ]
    for s in shifts:
        cur.execute("""
            INSERT INTO doctor_shifts (doctor_id, day_of_week, morning, afternoon)
            VALUES (%s::uuid, %s, %s, %s)
            ON CONFLICT (doctor_id, day_of_week) DO NOTHING
        """, s)
    print("  doctor_shifts OK")

    # ── Slots & Quotas: yesterday through +6 days ─────────────────────────────
    times = ['08:00','08:30','09:00','09:30','10:00','10:30','13:00','13:30','14:00','14:30']
    for offset in range(-1, 7):
        d = today + timedelta(days=offset)
        for t in times:
            cur.execute("""
                INSERT INTO slots (clinic_id, date, time, capacity, reserved)
                VALUES ('clinic-001', %s, %s, 5, 0)
                ON CONFLICT (clinic_id, date, time) DO NOTHING
            """, (d, t))
        for coverage, limit in [('cash', 10), ('sso', 8), ('universal', 12)]:
            cur.execute("""
                INSERT INTO quotas (clinic_id, date, coverage, limit_count, used_count)
                VALUES ('clinic-001', %s, %s, %s, 0)
                ON CONFLICT (clinic_id, date, coverage) DO NOTHING
            """, (d, coverage, limit))
    print("  slots & quotas OK (8 days)")

    # ── Bookings ──────────────────────────────────────────────────────────────
    SVC = {
        1: ('00000000-0000-0000-0000-000000000001', 'ตรวจทั่วไป',            200.00),
        2: ('00000000-0000-0000-0000-000000000002', 'ตรวจเลือด',             300.00),
        3: ('00000000-0000-0000-0000-000000000003', 'ฉีดวัคซีน',            150.00),
        4: ('00000000-0000-0000-0000-000000000004', 'ตรวจสุขภาพประจำปี',    500.00),
        5: ('00000000-0000-0000-0000-000000000005', 'ปรึกษาแพทย์',            0.00),
        6: ('00000000-0000-0000-0000-000000000006', 'ตรวจคลื่นไฟฟ้าหัวใจ', 400.00),
    }

    # (id_suffix, day_offset, time, name, phone, svc, coverage, status)
    rows = [
        # Yesterday — terminal statuses
        ('1001', -1, '08:00', 'สมชาย ใจดี',         '081-111-0001', 1, 'cash',      'done'),
        ('1002', -1, '08:30', 'สมหญิง รักดี',       '082-111-0002', 2, 'sso',       'done'),
        ('1003', -1, '09:00', 'วิชัย มั่นคง',       '083-111-0003', 4, 'cash',      'done'),
        ('1004', -1, '09:30', 'นภา สวัสดี',         '084-111-0004', 3, 'universal', 'no_show'),
        ('1005', -1, '10:00', 'ประสิทธิ์ ทองดี',   '085-111-0005', 1, 'sso',       'cancelled'),
        # Today — all 6 statuses
        ('2001', 0,  '08:00', 'กานดา ลือชา',        '086-222-0001', 1, 'cash',      'confirmed'),
        ('2002', 0,  '08:00', 'รัตนา พูลสุข',      '087-222-0002', 2, 'sso',       'pending_slip'),
        ('2003', 0,  '08:30', 'ธนา ศิริวงศ์',      '088-222-0003', 3, 'universal', 'confirmed'),
        ('2004', 0,  '09:00', 'อนันต์ ชัยชนะ',    '089-222-0004', 4, 'cash',      'reminded'),
        ('2005', 0,  '09:00', 'มาลี สุขใจ',        '090-222-0005', 5, 'sso',       'pending_slip'),
        ('2006', 0,  '09:30', 'วันชัย ดำรง',       '091-222-0006', 1, 'cash',      'confirmed'),
        ('2007', 0,  '10:00', 'พิมพ์ใจ งามดี',    '092-222-0007', 6, 'universal', 'done'),
        ('2008', 0,  '10:30', 'สุรชัย บุญมา',      '093-222-0008', 2, 'cash',      'cancelled'),
        ('2009', 0,  '13:00', 'ลลิตา เพ็ชรดี',    '094-222-0009', 4, 'sso',       'confirmed'),
        ('2010', 0,  '14:00', 'ณัฐพล วงษ์ทอง',    '095-222-0010', 3, 'universal', 'no_show'),
        # Tomorrow
        ('3001', 1,  '08:00', 'ชุติมา สว่างใจ',    '081-333-0001', 1, 'cash',      'confirmed'),
        ('3002', 1,  '08:30', 'เกรียงศักดิ์ นาดี', '082-333-0002', 5, 'sso',       'pending_slip'),
        ('3003', 1,  '09:00', 'ภัทราภรณ์ ทวีสุข', '083-333-0003', 2, 'universal', 'confirmed'),
        ('3004', 1,  '09:30', 'อภิชาติ รุ่งโรจน์', '084-333-0004', 4, 'cash',      'pending_slip'),
        ('3005', 1,  '10:00', 'จิราภรณ์ แสงทอง',  '085-333-0005', 3, 'sso',       'confirmed'),
        ('3006', 1,  '13:00', 'ธีระพงษ์ ดำรงค์',   '086-333-0006', 6, 'universal', 'pending_slip'),
        ('3007', 1,  '13:30', 'สิริมา พงษ์ไพร',   '087-333-0007', 1, 'cash',      'confirmed'),
        ('3008', 1,  '14:00', 'ไพโรจน์ สุขสันต์',  '088-333-0008', 2, 'sso',       'pending_slip'),
        # +2 days
        ('4001', 2,  '08:00', 'ปิยะ อ่อนน้อม',      '081-444-0001', 1, 'cash',      'confirmed'),
        ('4002', 2,  '09:00', 'นัทธมน วงศ์ดี',      '082-444-0002', 4, 'sso',       'pending_slip'),
        ('4003', 2,  '09:30', 'กิตติพงษ์ เจริญ',   '083-444-0003', 3, 'universal', 'confirmed'),
        ('4004', 2,  '13:00', 'อรวรรณ ลาภมา',      '084-444-0004', 5, 'cash',      'pending_slip'),
        ('4005', 2,  '14:00', 'เมธา โชคดี',         '085-444-0005', 2, 'sso',       'confirmed'),
        # +3 days
        ('5001', 3,  '08:30', 'ศิริพร คุ้มดี',      '081-555-0001', 6, 'cash',      'confirmed'),
        ('5002', 3,  '09:00', 'วุฒิชัย ก้าวหน้า',   '082-555-0002', 1, 'sso',       'pending_slip'),
        ('5003', 3,  '10:00', 'ธิดารัตน์ สมบูรณ์', '083-555-0003', 2, 'universal', 'confirmed'),
        ('5004', 3,  '13:30', 'ประภาส ดีงาม',       '084-555-0004', 4, 'cash',      'pending_slip'),
    ]

    for r in rows:
        suffix, offset, time, name, phone, svc_key, coverage, status = r
        svc_id, svc_name, deposit = SVC[svc_key]
        bdate = today + timedelta(days=offset)
        # UUID first segment must be exactly 8 hex chars: pad suffix to 8 digits
        booking_id = f'{int(suffix):08d}-0000-0000-0000-000000000000'
        line_id    = f'Uline{suffix}'
        cur.execute("""
            INSERT INTO bookings (
                id, clinic_id, patient_line_id, patient_name, phone,
                service_id, service_name, deposit_amount,
                date, time, coverage, status
            ) VALUES (%s, 'clinic-001', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (booking_id, line_id, name, phone,
              svc_id, svc_name, deposit,
              bdate, time, coverage, status))

    print(f"  bookings OK ({len(rows)} records across 5 days)")

    conn.commit()

    # ── Verify ────────────────────────────────────────────────────────────────
    print("\nVerification:")
    for table in ('services', 'doctors', 'doctor_shifts', 'slots', 'quotas', 'bookings'):
        cur.execute(f"SELECT COUNT(*) AS n FROM {table}")
        n = cur.fetchone()['n']
        print(f"  {table}: {n} rows")

    cur.execute(
        "SELECT date, COUNT(*) AS n FROM bookings GROUP BY date ORDER BY date"
    )
    print("\n  Bookings by date:")
    for row in cur.fetchall():
        print(f"    {row['date']}  →  {row['n']} bookings")

except Exception as e:
    conn.rollback()
    print(f"\nERROR (rolled back): {e}")
    import traceback; traceback.print_exc()
    sys.exit(1)
finally:
    cur.close()
    conn.close()
