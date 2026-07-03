# MorNut — Manual Setup Guide

Everything in this file must be done **by hand** before the app works end-to-end.
Code is already written; this is purely accounts, credentials, and seed data.

---

## 1. PostgreSQL Database

### 1.1 Install PostgreSQL
- **Local dev (Windows)**: Download from https://www.postgresql.org/download/windows/
- **Local dev (Mac)**: `brew install postgresql@16`
- **Production**: Use [Supabase](https://supabase.com) (free tier) or any managed PostgreSQL provider (Railway, Neon, Render, Cloud SQL)

### 1.2 Create database & user
```sql
-- Run as postgres superuser
CREATE USER mornut WITH PASSWORD 'mornut';
CREATE DATABASE mornut OWNER mornut;
```

### 1.3 Set DATABASE_URL in `backend/.env`
```env
DATABASE_URL=postgresql://mornut:mornut@localhost:5432/mornut
```

For Supabase or other providers, copy the connection string from the dashboard.

### 1.4 Run schema + seed data
```bash
cd backend

# Option A — seed script (creates schema + admin user + 10 mock bookings for today)
python seed.py

# Option B — schema only, then seed manually
psql $DATABASE_URL -f init.sql
```

The seed script creates:
- Admin user: `admin@clinic.com` / `admin1234` (change after first login)
- 5 services (ตรวจทั่วไป, ฉีดวัคซีน, ตรวจเลือด, กายภาพบำบัด, ตรวจสายตา)
- Time slots and quotas for today
- 10 mock bookings for today across all statuses

### 1.5 Change the admin password
After first login, update the password hash directly in the database or add a change-password endpoint:
```python
# One-time script to reset password
from passlib.context import CryptContext
pwd = CryptContext(schemes=["bcrypt"])
print(pwd.hash("your-new-password"))
# Then: UPDATE admin_users SET password_hash = '<output>' WHERE email = 'admin@clinic.com';
```

---

## 2. LINE Developers

### 2.1 Create provider & Messaging API channel
1. Go to https://developers.line.biz
2. **Create provider** (e.g. `MorNut Clinic`)
3. **Create channel** → Messaging API
4. Fill in channel name, description, category

### 2.2 Get credentials
From the channel's **Basic settings** tab:
- `LINE_CHANNEL_SECRET` → Channel secret

From the **Messaging API** tab:
- `LINE_CHANNEL_ACCESS_TOKEN` → Issue a long-lived token

### 2.3 Set webhook URL
In the Messaging API tab:
- **Webhook URL**: `https://<your-backend-url>/webhook`
- Enable **Use webhook**
- Disable **Auto-reply messages** and **Greeting messages**

### 2.4 Create LIFF app
1. In the same channel → **LIFF** tab → Add
2. Size: **Full**
3. Endpoint URL: `https://<your-frontend-url>/book`
4. Scope: `profile openid`
5. Copy the **LIFF ID** (format: `1234567890-xxxxxxxx`)
6. Set `VITE_LIFF_ID=<LIFF ID>` in `frontend/.env.local`
7. Set `LIFF_URL=https://liff.line.me/<LIFF ID>` in `backend/.env`

### 2.5 LINE Notify (nurse group notifications)
1. Go to https://notify-bot.line.me → **My page** → Generate token
2. Choose the nurse group LINE chat
3. Copy the token → set `LINE_NOTIFY_TOKEN` in `backend/.env`

> **Note**: LINE Notify was discontinued March 31, 2025. If it no longer works, replace `send_line_notify()` in `backend/app/services/line.py` with a Messaging API push to a group chat ID instead.

---

## 3. SlipOK

1. Register at https://slipok.com
2. Get your **API key** from the dashboard
3. Set in `backend/.env`:
```
SLIPOK_API_KEY=<your key>
SLIPOK_ENDPOINT=https://api.slipok.com/api/line/apikey/<your key>
```

---

## 4. JWT Secret

Generate a secure random secret for signing admin tokens:
```bash
# Mac/Linux
openssl rand -hex 32

# Python
python -c "import secrets; print(secrets.token_hex(32))"
```

Set as `JWT_SECRET` in `backend/.env`.

---

## 5. Environment Variables

### 5.1 `backend/.env` (copy from `.env.example`)
```env
# LINE Messaging API
LINE_CHANNEL_SECRET=<from Step 2.2>
LINE_CHANNEL_ACCESS_TOKEN=<from Step 2.2>

# LINE Notify
LINE_NOTIFY_TOKEN=<from Step 2.5>

# SlipOK
SLIPOK_API_KEY=<from Step 3>
SLIPOK_ENDPOINT=https://api.slipok.com/api/line/apikey/<your key>

# PostgreSQL
DATABASE_URL=postgresql://mornut:mornut@localhost:5432/mornut

# JWT
JWT_SECRET=<from Step 4>
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24

# Clinic
CLINIC_ID=clinic-001
LIFF_URL=https://liff.line.me/<LIFF ID from Step 2.4>

# Scheduler shared secret (generate any random string)
SCHEDULER_SECRET=<random 32-char string>
```

### 5.2 `frontend/.env.local` (create this file)
```env
VITE_LIFF_ID=<LIFF ID from Step 2.4>
VITE_API_BASE_URL=     # leave empty in dev (Vite proxy forwards /api → localhost:8080)
VITE_CLINIC_ID=clinic-001
```

---

## 6. Running locally

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# First time only — create schema + seed mock data
python seed.py

uvicorn app.main:app --reload --port 8080
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
# /admin → admin dashboard (login: admin@clinic.com / admin1234)
# /book  → LIFF booking page
```

---

## 7. Slip Image Storage

Slip images uploaded by patients are saved to `backend/uploads/slips/`.
In production, mount a persistent volume or replace `backend/app/services/storage.py`
with an S3-compatible implementation (AWS S3, Supabase Storage, Cloudflare R2).

---

## 8. Production Deployment

### Backend (Cloud Run / Railway / Render)
Set all environment variables from Step 5.1 in the deployment platform.

```bash
# Cloud Run example
gcloud run services update mornut-backend \
  --region asia-southeast1 \
  --set-env-vars "\
LINE_CHANNEL_SECRET=xxx,\
LINE_CHANNEL_ACCESS_TOKEN=xxx,\
LINE_NOTIFY_TOKEN=xxx,\
SLIPOK_API_KEY=xxx,\
SLIPOK_ENDPOINT=xxx,\
DATABASE_URL=postgresql://...,\
JWT_SECRET=xxx,\
CLINIC_ID=clinic-001,\
LIFF_URL=https://liff.line.me/xxx,\
SCHEDULER_SECRET=xxx"
```

### Frontend (Firebase Hosting / Vercel / Netlify)
```bash
cd frontend
npm run build
# Deploy dist/ to your hosting provider
```

### Database migration on first deploy
```bash
# Run once after deploying backend
psql $DATABASE_URL -f backend/init.sql
# Then add admin user and seed data via seed.py or manually
```

---

## 9. Cloud Scheduler — Daily Reminder Job

Run this **once** after the backend is live:
```bash
export BACKEND_URL=https://mornut-backend-xxx-run.app
export CLINIC_ID=clinic-001
export SCHEDULER_SECRET=<same as above>
bash scheduler.sh
```

This creates a Cloud Scheduler job that calls `POST /internal/remind/{CLINIC_ID}` every day at **18:00 Bangkok time**.

---

## 10. Deploy Checklist

- [ ] PostgreSQL database created (Step 1.1–1.2)
- [ ] Schema initialized: `python seed.py` (Step 1.4)
- [ ] Admin password changed from default (Step 1.5)
- [ ] LINE Messaging API channel created (Step 2.1–2.3)
- [ ] LIFF app created and endpoint URL set (Step 2.4)
- [ ] LINE Notify token generated (Step 2.5)
- [ ] SlipOK account and API key obtained (Step 3)
- [ ] JWT secret generated (Step 4)
- [ ] `backend/.env` filled in (Step 5.1)
- [ ] `frontend/.env.local` filled in (Step 5.2)
- [ ] Backend running: `uvicorn app.main:app --reload --port 8080`
- [ ] Frontend running: `npm run dev`
- [ ] Admin login works at `/admin`
- [ ] 10 mock bookings visible in dashboard
- [ ] Backend deployed to production (Step 8)
- [ ] Frontend deployed to production (Step 8)
- [ ] LINE webhook URL updated to production backend URL (Step 2.3)
- [ ] LIFF endpoint URL updated to production frontend URL (Step 2.4)
- [ ] Cloud Scheduler job created (Step 9)
- [ ] End-to-end test: open LIFF → book → upload slip → check admin dashboard
