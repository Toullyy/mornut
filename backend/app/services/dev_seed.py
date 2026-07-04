"""
Auto-seeds clinic-001 with demo data anchored to today's date.
Called on startup when DEBUG_MODE=true so the dashboard always has data.
"""
from datetime import date, timedelta

from app.core.db import cursor, get_conn


def reseed_today() -> dict:
    today = date.today()
    report: dict = {"today": str(today)}

    with get_conn() as conn:
        with cursor(conn) as cur:

            # ── Services ──────────────────────────────────────────────────────
            cur.execute("""
                INSERT INTO services (id, clinic_id, name, duration_min, deposit_amount) VALUES
                  ('00000000-0000-0000-0000-000000000001','clinic-001','ตรวจทั่วไป',30,200.00),
                  ('00000000-0000-0000-0000-000000000002','clinic-001','ตรวจเลือด',45,300.00),
                  ('00000000-0000-0000-0000-000000000003','clinic-001','ฉีดวัคซีน',15,150.00),
                  ('00000000-0000-0000-0000-000000000004','clinic-001','ตรวจสุขภาพประจำปี',60,500.00),
                  ('00000000-0000-0000-0000-000000000005','clinic-001','ปรึกษาแพทย์',20,0.00),
                  ('00000000-0000-0000-0000-000000000006','clinic-001','ตรวจคลื่นไฟฟ้าหัวใจ',30,400.00)
                ON CONFLICT (id) DO NOTHING
            """)

            # ── Doctors ───────────────────────────────────────────────────────
            cur.execute("""
                INSERT INTO doctors (id, clinic_id, name, specialty, color, initials) VALUES
                  ('d0000000-0000-0000-0000-000000000001','clinic-001','นพ. สมศักดิ์ แก้วใส','อายุรกรรม','bg-sky-500','สก'),
                  ('d0000000-0000-0000-0000-000000000002','clinic-001','พญ. วรรณา ทองคำ','กุมารเวชกรรม','bg-violet-500','วท'),
                  ('d0000000-0000-0000-0000-000000000003','clinic-001','นพ. ชัยวัฒน์ ศรีสุข','เวชกรรมทั่วไป','bg-emerald-500','ชว'),
                  ('d0000000-0000-0000-0000-000000000004','clinic-001','พญ. นภาพร รุ่งเรือง','โรคหัวใจ','bg-rose-500','นร')
                ON CONFLICT (id) DO NOTHING
            """)
            report["doctors"] = cur.rowcount

            # ── Doctor shifts ─────────────────────────────────────────────────
            shifts = [
                ('d0000000-0000-0000-0000-000000000001',0,True,True),
                ('d0000000-0000-0000-0000-000000000001',1,True,True),
                ('d0000000-0000-0000-0000-000000000001',2,True,True),
                ('d0000000-0000-0000-0000-000000000001',3,True,True),
                ('d0000000-0000-0000-0000-000000000001',4,True,True),
                ('d0000000-0000-0000-0000-000000000001',5,True,False),
                ('d0000000-0000-0000-0000-000000000001',6,False,False),
                ('d0000000-0000-0000-0000-000000000002',0,True,True),
                ('d0000000-0000-0000-0000-000000000002',1,False,False),
                ('d0000000-0000-0000-0000-000000000002',2,True,True),
                ('d0000000-0000-0000-0000-000000000002',3,False,False),
                ('d0000000-0000-0000-0000-000000000002',4,True,True),
                ('d0000000-0000-0000-0000-000000000002',5,False,False),
                ('d0000000-0000-0000-0000-000000000002',6,False,False),
                ('d0000000-0000-0000-0000-000000000003',0,False,False),
                ('d0000000-0000-0000-0000-000000000003',1,True,True),
                ('d0000000-0000-0000-0000-000000000003',2,False,False),
                ('d0000000-0000-0000-0000-000000000003',3,True,True),
                ('d0000000-0000-0000-0000-000000000003',4,False,False),
                ('d0000000-0000-0000-0000-000000000003',5,True,True),
                ('d0000000-0000-0000-0000-000000000003',6,False,False),
                ('d0000000-0000-0000-0000-000000000004',0,True,False),
                ('d0000000-0000-0000-0000-000000000004',1,True,False),
                ('d0000000-0000-0000-0000-000000000004',2,True,False),
                ('d0000000-0000-0000-0000-000000000004',3,True,False),
                ('d0000000-0000-0000-0000-000000000004',4,True,False),
                ('d0000000-0000-0000-0000-000000000004',5,False,False),
                ('d0000000-0000-0000-0000-000000000004',6,False,False),
            ]
            for s in shifts:
                cur.execute(
                    "INSERT INTO doctor_shifts (doctor_id,day_of_week,morning,afternoon) "
                    "VALUES (%s::uuid,%s,%s,%s) ON CONFLICT (doctor_id,day_of_week) DO NOTHING",
                    s,
                )

            # ── Move ALL existing bookings to today ───────────────────────────
            cur.execute(
                "UPDATE bookings SET date=%s, updated_at=NOW() WHERE clinic_id='clinic-001'",
                (today,),
            )
            report["bookings_moved"] = cur.rowcount

            # ── Slots & quotas: today + 6 days ────────────────────────────────
            times = ['08:00','08:30','09:00','09:30','10:00','10:30',
                     '13:00','13:30','14:00','14:30']
            for offset in range(7):
                d = today + timedelta(days=offset)
                for t in times:
                    cur.execute(
                        "INSERT INTO slots (clinic_id,date,time,capacity,reserved) "
                        "VALUES ('clinic-001',%s,%s,5,0) "
                        "ON CONFLICT (clinic_id,date,time) DO NOTHING",
                        (d, t),
                    )
                for cov, lim in [('cash',10),('sso',8),('universal',12)]:
                    cur.execute(
                        "INSERT INTO quotas (clinic_id,date,coverage,limit_count,used_count) "
                        "VALUES ('clinic-001',%s,%s,%s,0) "
                        "ON CONFLICT (clinic_id,date,coverage) DO NOTHING",
                        (d, cov, lim),
                    )

            # ── Upsert 10 demo bookings for today ─────────────────────────────
            SVC = {
                1:('00000000-0000-0000-0000-000000000001','ตรวจทั่วไป',200.0),
                2:('00000000-0000-0000-0000-000000000002','ตรวจเลือด',300.0),
                3:('00000000-0000-0000-0000-000000000003','ฉีดวัคซีน',150.0),
                4:('00000000-0000-0000-0000-000000000004','ตรวจสุขภาพประจำปี',500.0),
                5:('00000000-0000-0000-0000-000000000005','ปรึกษาแพทย์',0.0),
                6:('00000000-0000-0000-0000-000000000006','ตรวจคลื่นไฟฟ้าหัวใจ',400.0),
            }
            demo_rows = [
                ('2001','08:00','กานดา ลือชา','086-222-0001',1,'cash','confirmed'),
                ('2002','08:30','รัตนา พูลสุข','087-222-0002',2,'sso','pending_slip'),
                ('2003','09:00','ธนา ศิริวงศ์','088-222-0003',3,'universal','confirmed'),
                ('2004','09:00','อนันต์ ชัยชนะ','089-222-0004',4,'cash','reminded'),
                ('2005','09:30','มาลี สุขใจ','090-222-0005',5,'sso','pending_slip'),
                ('2006','10:00','วันชัย ดำรง','091-222-0006',1,'cash','confirmed'),
                ('2007','10:30','พิมพ์ใจ งามดี','092-222-0007',6,'universal','done'),
                ('2008','13:00','สุรชัย บุญมา','093-222-0008',2,'cash','cancelled'),
                ('2009','13:30','ลลิตา เพ็ชรดี','094-222-0009',4,'sso','confirmed'),
                ('2010','14:00','ณัฐพล วงษ์ทอง','095-222-0010',3,'universal','no_show'),
            ]
            for sfx, time, name, phone, svc_k, cov, status in demo_rows:
                sid, sname, dep = SVC[svc_k]
                bid = f'{int(sfx):08d}-0000-0000-0000-000000000000'
                cur.execute("""
                    INSERT INTO bookings
                      (id,clinic_id,patient_line_id,patient_name,phone,
                       service_id,service_name,deposit_amount,date,time,coverage,status)
                    VALUES (%s,'clinic-001',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (id) DO UPDATE
                      SET date=EXCLUDED.date, status=EXCLUDED.status, updated_at=NOW()
                """, (bid,f'Uline{sfx}',name,phone,sid,sname,dep,today,time,cov,status))
            report["demo_bookings"] = len(demo_rows)

    return report
