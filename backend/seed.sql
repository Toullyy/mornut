-- =============================================================================
-- MorNut dev seed — all tables, realistic Thai clinic data
-- Safe to re-run (ON CONFLICT DO NOTHING / DO UPDATE throughout)
-- Run: psql $DATABASE_URL -f seed.sql
-- =============================================================================

-- ── Services ──────────────────────────────────────────────────────────────────
INSERT INTO services (id, clinic_id, name, duration_min, deposit_amount) VALUES
  ('00000000-0000-0000-0000-000000000001', 'clinic-001', 'ตรวจทั่วไป',          30, 200.00),
  ('00000000-0000-0000-0000-000000000002', 'clinic-001', 'ตรวจเลือด',           45, 300.00),
  ('00000000-0000-0000-0000-000000000003', 'clinic-001', 'ฉีดวัคซีน',          15, 150.00),
  ('00000000-0000-0000-0000-000000000004', 'clinic-001', 'ตรวจสุขภาพประจำปี',  60, 500.00),
  ('00000000-0000-0000-0000-000000000005', 'clinic-001', 'ปรึกษาแพทย์',        20,   0.00),
  ('00000000-0000-0000-0000-000000000006', 'clinic-001', 'ตรวจคลื่นไฟฟ้าหัวใจ', 30, 400.00)
ON CONFLICT (id) DO NOTHING;

-- ── Doctors ───────────────────────────────────────────────────────────────────
INSERT INTO doctors (id, clinic_id, name, specialty, color, initials) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'clinic-001', 'นพ. สมศักดิ์ แก้วใส',    'อายุรกรรม',        'bg-sky-500',     'สก'),
  ('d0000000-0000-0000-0000-000000000002', 'clinic-001', 'พญ. วรรณา ทองคำ',         'กุมารเวชกรรม',     'bg-violet-500',  'วท'),
  ('d0000000-0000-0000-0000-000000000003', 'clinic-001', 'นพ. ชัยวัฒน์ ศรีสุข',    'เวชกรรมทั่วไป',   'bg-emerald-500', 'ชว'),
  ('d0000000-0000-0000-0000-000000000004', 'clinic-001', 'พญ. นภาพร รุ่งเรือง',    'โรคหัวใจ',         'bg-rose-500',    'นร')
ON CONFLICT (id) DO NOTHING;

-- ── Doctor shifts ─────────────────────────────────────────────────────────────
-- Doctor 1 (สมศักดิ์): Mon-Fri morning+afternoon, Sat morning only
-- Doctor 2 (วรรณา):    Mon/Wed/Fri morning+afternoon
-- Doctor 3 (ชัยวัฒน์): Tue/Thu morning+afternoon, Sat morning+afternoon
-- Doctor 4 (นภาพร):    Mon-Fri morning only

INSERT INTO doctor_shifts (doctor_id, day_of_week, morning, afternoon) VALUES
  -- Doctor 1: Mon(0)–Fri(4) both, Sat(5) morning
  ('d0000000-0000-0000-0000-000000000001', 0, TRUE,  TRUE),
  ('d0000000-0000-0000-0000-000000000001', 1, TRUE,  TRUE),
  ('d0000000-0000-0000-0000-000000000001', 2, TRUE,  TRUE),
  ('d0000000-0000-0000-0000-000000000001', 3, TRUE,  TRUE),
  ('d0000000-0000-0000-0000-000000000001', 4, TRUE,  TRUE),
  ('d0000000-0000-0000-0000-000000000001', 5, TRUE,  FALSE),
  ('d0000000-0000-0000-0000-000000000001', 6, FALSE, FALSE),
  -- Doctor 2: Mon/Wed/Fri both
  ('d0000000-0000-0000-0000-000000000002', 0, TRUE,  TRUE),
  ('d0000000-0000-0000-0000-000000000002', 1, FALSE, FALSE),
  ('d0000000-0000-0000-0000-000000000002', 2, TRUE,  TRUE),
  ('d0000000-0000-0000-0000-000000000002', 3, FALSE, FALSE),
  ('d0000000-0000-0000-0000-000000000002', 4, TRUE,  TRUE),
  ('d0000000-0000-0000-0000-000000000002', 5, FALSE, FALSE),
  ('d0000000-0000-0000-0000-000000000002', 6, FALSE, FALSE),
  -- Doctor 3: Tue/Thu both, Sat both
  ('d0000000-0000-0000-0000-000000000003', 0, FALSE, FALSE),
  ('d0000000-0000-0000-0000-000000000003', 1, TRUE,  TRUE),
  ('d0000000-0000-0000-0000-000000000003', 2, FALSE, FALSE),
  ('d0000000-0000-0000-0000-000000000003', 3, TRUE,  TRUE),
  ('d0000000-0000-0000-0000-000000000003', 4, FALSE, FALSE),
  ('d0000000-0000-0000-0000-000000000003', 5, TRUE,  TRUE),
  ('d0000000-0000-0000-0000-000000000003', 6, FALSE, FALSE),
  -- Doctor 4: Mon–Fri morning only
  ('d0000000-0000-0000-0000-000000000004', 0, TRUE,  FALSE),
  ('d0000000-0000-0000-0000-000000000004', 1, TRUE,  FALSE),
  ('d0000000-0000-0000-0000-000000000004', 2, TRUE,  FALSE),
  ('d0000000-0000-0000-0000-000000000004', 3, TRUE,  FALSE),
  ('d0000000-0000-0000-0000-000000000004', 4, TRUE,  FALSE),
  ('d0000000-0000-0000-0000-000000000004', 5, FALSE, FALSE),
  ('d0000000-0000-0000-0000-000000000004', 6, FALSE, FALSE)
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

-- ── Slots: 10 time slots × (yesterday + today + 6 future days) ───────────────
INSERT INTO slots (clinic_id, date, time, capacity, reserved)
SELECT
  'clinic-001',
  CURRENT_DATE + i,
  t::time,
  5,
  0
FROM generate_series(-1, 6) AS i,
     unnest(ARRAY['08:00','08:30','09:00','09:30','10:00','10:30','13:00','13:30','14:00','14:30']) AS t
ON CONFLICT (clinic_id, date, time) DO NOTHING;

-- ── Quotas: 3 coverages × (yesterday + today + 6 future days) ────────────────
INSERT INTO quotas (clinic_id, date, coverage, limit_count, used_count)
SELECT
  'clinic-001',
  CURRENT_DATE + i,
  c,
  lim,
  0
FROM generate_series(-1, 6) AS i,
     (VALUES ('cash'::text, 10), ('sso', 8), ('universal', 12)) AS q(c, lim)
ON CONFLICT (clinic_id, date, coverage) DO NOTHING;

-- ── Bookings ──────────────────────────────────────────────────────────────────
-- Yesterday (5 records — mostly done/no_show/cancelled)
INSERT INTO bookings (
  id, clinic_id, patient_line_id, patient_name, phone,
  service_id, service_name, deposit_amount,
  date, time, coverage, status
) VALUES
  ('b1000000-0000-0000-0000-000000000001','clinic-001','Uline0000000000001','สมชาย ใจดี',        '081-111-0001','00000000-0000-0000-0000-000000000001','ตรวจทั่วไป',         200.00, CURRENT_DATE - 1, '08:00', 'cash',      'done'),
  ('b1000000-0000-0000-0000-000000000002','clinic-001','Uline0000000000002','สมหญิง รักดี',      '082-111-0002','00000000-0000-0000-0000-000000000002','ตรวจเลือด',          300.00, CURRENT_DATE - 1, '08:30', 'sso',       'done'),
  ('b1000000-0000-0000-0000-000000000003','clinic-001','Uline0000000000003','วิชัย มั่นคง',      '083-111-0003','00000000-0000-0000-0000-000000000004','ตรวจสุขภาพประจำปี', 500.00, CURRENT_DATE - 1, '09:00', 'cash',      'done'),
  ('b1000000-0000-0000-0000-000000000004','clinic-001','Uline0000000000004','นภา สวัสดี',        '084-111-0004','00000000-0000-0000-0000-000000000003','ฉีดวัคซีน',         150.00, CURRENT_DATE - 1, '09:30', 'universal', 'no_show'),
  ('b1000000-0000-0000-0000-000000000005','clinic-001','Uline0000000000005','ประสิทธิ์ ทองดี',  '085-111-0005','00000000-0000-0000-0000-000000000001','ตรวจทั่วไป',         200.00, CURRENT_DATE - 1, '10:00', 'sso',       'cancelled')
ON CONFLICT (id) DO NOTHING;

-- Today (10 records — all statuses)
INSERT INTO bookings (
  id, clinic_id, patient_line_id, patient_name, phone,
  service_id, service_name, deposit_amount,
  date, time, coverage, status
) VALUES
  ('b2000000-0000-0000-0000-000000000001','clinic-001','Uline0000000000011','กานดา ลือชา',       '086-222-0001','00000000-0000-0000-0000-000000000001','ตรวจทั่วไป',         200.00, CURRENT_DATE, '08:00', 'cash',      'confirmed'),
  ('b2000000-0000-0000-0000-000000000002','clinic-001','Uline0000000000012','รัตนา พูลสุข',     '087-222-0002','00000000-0000-0000-0000-000000000002','ตรวจเลือด',          300.00, CURRENT_DATE, '08:00', 'sso',       'pending_slip'),
  ('b2000000-0000-0000-0000-000000000003','clinic-001','Uline0000000000013','ธนา ศิริวงศ์',     '088-222-0003','00000000-0000-0000-0000-000000000003','ฉีดวัคซีน',         150.00, CURRENT_DATE, '08:30', 'universal', 'confirmed'),
  ('b2000000-0000-0000-0000-000000000004','clinic-001','Uline0000000000014','อนันต์ ชัยชนะ',   '089-222-0004','00000000-0000-0000-0000-000000000004','ตรวจสุขภาพประจำปี', 500.00, CURRENT_DATE, '09:00', 'reminded'),
  ('b2000000-0000-0000-0000-000000000005','clinic-001','Uline0000000000015','มาลี สุขใจ',       '090-222-0005','00000000-0000-0000-0000-000000000005','ปรึกษาแพทย์',          0.00, CURRENT_DATE, '09:00', 'sso',       'pending_slip'),
  ('b2000000-0000-0000-0000-000000000006','clinic-001','Uline0000000000016','วันชัย ดำรง',      '091-222-0006','00000000-0000-0000-0000-000000000001','ตรวจทั่วไป',         200.00, CURRENT_DATE, '09:30', 'cash',      'confirmed'),
  ('b2000000-0000-0000-0000-000000000007','clinic-001','Uline0000000000017','พิมพ์ใจ งามดี',   '092-222-0007','00000000-0000-0000-0000-000000000006','ตรวจคลื่นไฟฟ้าหัวใจ',400.00, CURRENT_DATE, '10:00', 'universal', 'done'),
  ('b2000000-0000-0000-0000-000000000008','clinic-001','Uline0000000000018','สุรชัย บุญมา',     '093-222-0008','00000000-0000-0000-0000-000000000002','ตรวจเลือด',          300.00, CURRENT_DATE, '10:30', 'cash',      'cancelled'),
  ('b2000000-0000-0000-0000-000000000009','clinic-001','Uline0000000000019','ลลิตา เพ็ชรดี',   '094-222-0009','00000000-0000-0000-0000-000000000004','ตรวจสุขภาพประจำปี', 500.00, CURRENT_DATE, '13:00', 'sso',       'confirmed'),
  ('b2000000-0000-0000-0000-000000000010','clinic-001','Uline0000000000020','ณัฐพล วงษ์ทอง',   '095-222-0010','00000000-0000-0000-0000-000000000003','ฉีดวัคซีน',         150.00, CURRENT_DATE, '14:00', 'universal', 'no_show')
ON CONFLICT (id) DO NOTHING;

-- Tomorrow (8 records — pending/confirmed only)
INSERT INTO bookings (
  id, clinic_id, patient_line_id, patient_name, phone,
  service_id, service_name, deposit_amount,
  date, time, coverage, status
) VALUES
  ('b3000000-0000-0000-0000-000000000001','clinic-001','Uline0000000000021','ชุติมา สว่างใจ',   '081-333-0001','00000000-0000-0000-0000-000000000001','ตรวจทั่วไป',         200.00, CURRENT_DATE + 1, '08:00', 'cash',      'confirmed'),
  ('b3000000-0000-0000-0000-000000000002','clinic-001','Uline0000000000022','เกรียงศักดิ์ นาดี','082-333-0002','00000000-0000-0000-0000-000000000005','ปรึกษาแพทย์',          0.00, CURRENT_DATE + 1, '08:30', 'sso',       'pending_slip'),
  ('b3000000-0000-0000-0000-000000000003','clinic-001','Uline0000000000023','ภัทราภรณ์ ทวีสุข','083-333-0003','00000000-0000-0000-0000-000000000002','ตรวจเลือด',          300.00, CURRENT_DATE + 1, '09:00', 'universal', 'confirmed'),
  ('b3000000-0000-0000-0000-000000000004','clinic-001','Uline0000000000024','อภิชาติ รุ่งโรจน์','084-333-0004','00000000-0000-0000-0000-000000000004','ตรวจสุขภาพประจำปี', 500.00, CURRENT_DATE + 1, '09:30', 'cash',      'pending_slip'),
  ('b3000000-0000-0000-0000-000000000005','clinic-001','Uline0000000000025','จิราภรณ์ แสงทอง', '085-333-0005','00000000-0000-0000-0000-000000000003','ฉีดวัคซีน',         150.00, CURRENT_DATE + 1, '10:00', 'sso',       'confirmed'),
  ('b3000000-0000-0000-0000-000000000006','clinic-001','Uline0000000000026','ธีระพงษ์ ดำรงค์',  '086-333-0006','00000000-0000-0000-0000-000000000006','ตรวจคลื่นไฟฟ้าหัวใจ',400.00, CURRENT_DATE + 1, '13:00', 'universal', 'pending_slip'),
  ('b3000000-0000-0000-0000-000000000007','clinic-001','Uline0000000000027','สิริมา พงษ์ไพร',  '087-333-0007','00000000-0000-0000-0000-000000000001','ตรวจทั่วไป',         200.00, CURRENT_DATE + 1, '13:30', 'cash',      'confirmed'),
  ('b3000000-0000-0000-0000-000000000008','clinic-001','Uline0000000000028','ไพโรจน์ สุขสันต์', '088-333-0008','00000000-0000-0000-0000-000000000002','ตรวจเลือด',          300.00, CURRENT_DATE + 1, '14:00', 'sso',       'pending_slip')
ON CONFLICT (id) DO NOTHING;

-- Day +2 (5 records)
INSERT INTO bookings (
  id, clinic_id, patient_line_id, patient_name, phone,
  service_id, service_name, deposit_amount,
  date, time, coverage, status
) VALUES
  ('b4000000-0000-0000-0000-000000000001','clinic-001','Uline0000000000031','ปิยะ อ่อนน้อม',     '081-444-0001','00000000-0000-0000-0000-000000000001','ตรวจทั่วไป',         200.00, CURRENT_DATE + 2, '08:00', 'cash',      'confirmed'),
  ('b4000000-0000-0000-0000-000000000002','clinic-001','Uline0000000000032','นัทธมน วงศ์ดี',     '082-444-0002','00000000-0000-0000-0000-000000000004','ตรวจสุขภาพประจำปี', 500.00, CURRENT_DATE + 2, '09:00', 'sso',       'pending_slip'),
  ('b4000000-0000-0000-0000-000000000003','clinic-001','Uline0000000000033','กิตติพงษ์ เจริญ',  '083-444-0003','00000000-0000-0000-0000-000000000003','ฉีดวัคซีน',         150.00, CURRENT_DATE + 2, '09:30', 'universal', 'confirmed'),
  ('b4000000-0000-0000-0000-000000000004','clinic-001','Uline0000000000034','อรวรรณ ลาภมา',     '084-444-0004','00000000-0000-0000-0000-000000000005','ปรึกษาแพทย์',          0.00, CURRENT_DATE + 2, '13:00', 'cash',      'pending_slip'),
  ('b4000000-0000-0000-0000-000000000005','clinic-001','Uline0000000000035','เมธา โชคดี',        '085-444-0005','00000000-0000-0000-0000-000000000002','ตรวจเลือด',          300.00, CURRENT_DATE + 2, '14:00', 'sso',       'confirmed')
ON CONFLICT (id) DO NOTHING;

-- Day +3 (4 records)
INSERT INTO bookings (
  id, clinic_id, patient_line_id, patient_name, phone,
  service_id, service_name, deposit_amount,
  date, time, coverage, status
) VALUES
  ('b5000000-0000-0000-0000-000000000001','clinic-001','Uline0000000000041','ศิริพร คุ้มดี',     '081-555-0001','00000000-0000-0000-0000-000000000006','ตรวจคลื่นไฟฟ้าหัวใจ',400.00, CURRENT_DATE + 3, '08:30', 'cash',      'confirmed'),
  ('b5000000-0000-0000-0000-000000000002','clinic-001','Uline0000000000042','วุฒิชัย ก้าวหน้า',  '082-555-0002','00000000-0000-0000-0000-000000000001','ตรวจทั่วไป',         200.00, CURRENT_DATE + 3, '09:00', 'sso',       'pending_slip'),
  ('b5000000-0000-0000-0000-000000000003','clinic-001','Uline0000000000043','ธิดารัตน์ สมบูรณ์','083-555-0003','00000000-0000-0000-0000-000000000002','ตรวจเลือด',          300.00, CURRENT_DATE + 3, '10:00', 'universal', 'confirmed'),
  ('b5000000-0000-0000-0000-000000000004','clinic-001','Uline0000000000044','ประภาส ดีงาม',      '084-555-0004','00000000-0000-0000-0000-000000000004','ตรวจสุขภาพประจำปี', 500.00, CURRENT_DATE + 3, '13:30', 'cash',      'pending_slip')
ON CONFLICT (id) DO NOTHING;

-- ── Update slot reserved counts to match bookings ─────────────────────────────
-- Yesterday
UPDATE slots SET reserved = 4 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE - 1 AND time = '08:00';
UPDATE slots SET reserved = 1 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE - 1 AND time = '08:30';
UPDATE slots SET reserved = 1 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE - 1 AND time = '09:00';
-- Today
UPDATE slots SET reserved = 2 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE AND time = '08:00';
UPDATE slots SET reserved = 1 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE AND time = '08:30';
UPDATE slots SET reserved = 2 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE AND time = '09:00';
UPDATE slots SET reserved = 1 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE AND time = '09:30';
UPDATE slots SET reserved = 1 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE AND time = '10:00';
UPDATE slots SET reserved = 1 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE AND time = '13:00';
UPDATE slots SET reserved = 1 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE AND time = '14:00';

-- ── Update quota used counts to reflect active bookings ───────────────────────
-- Today: cash=3, sso=3, universal=3 (excludes cancelled/no_show)
UPDATE quotas SET used_count = 3 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE AND coverage = 'cash';
UPDATE quotas SET used_count = 3 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE AND coverage = 'sso';
UPDATE quotas SET used_count = 2 WHERE clinic_id = 'clinic-001' AND date = CURRENT_DATE AND coverage = 'universal';
