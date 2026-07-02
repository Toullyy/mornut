# MorNut — Manual Setup Guide

Everything in this file must be done **by hand** before the app works end-to-end.
Code is already written; this is purely accounts, credentials, and seed data.

---

## 1. Firebase Project

### 1.1 Create project
1. Go to https://console.firebase.google.com
2. Click **Add project** → name it (e.g. `mornut-prod`)
3. Disable Google Analytics (optional for MVP)

### 1.2 Enable services
| Service | How |
|---|---|
| **Firestore** | Build → Firestore Database → Create database → Production mode → choose region (e.g. `asia-southeast1`) |
| **Authentication** | Build → Authentication → Get started → Enable **Email/Password** provider |
| **Storage** | Build → Storage → Get started → Production mode → same region as Firestore |
| **Hosting** | Build → Hosting → Get started (follow wizard, no need to deploy yet) |

### 1.3 Service account (for backend / Cloud Run)
1. Project Settings (gear icon) → **Service accounts**
2. Click **Generate new private key** → download JSON
3. **Local dev**: save the JSON anywhere, set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json` in `backend/.env`
4. **Cloud Run**: upload the JSON as a Secret in Secret Manager and mount it, OR grant the Cloud Run service account the roles below directly (recommended — no JSON needed on Cloud Run)

Required IAM roles for the Cloud Run service account:
- `Cloud Datastore User` (Firestore)
- `Firebase Authentication Admin`
- `Storage Object Admin`

### 1.4 Web app config (for frontend)
1. Project Settings → **Your apps** → Add app → Web (`</>`)
2. Register app name (e.g. `mornut-web`)
3. Copy the `firebaseConfig` object — it looks like:
```js
{
  apiKey: "AIza...",
  authDomain: "mornut-prod.firebaseapp.com",
  projectId: "mornut-prod",
  storageBucket: "mornut-prod.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
}
```
4. Stringify it and set as `VITE_FIREBASE_CONFIG` in `frontend/.env.local`

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
- **Webhook URL**: `https://<your-cloud-run-url>/webhook`
- Enable **Use webhook**
- Disable **Auto-reply messages** and **Greeting messages**

### 2.4 Create LIFF app
1. In the same channel → **LIFF** tab → Add
2. Size: **Full**
3. Endpoint URL: `https://<your-firebase-hosting-url>/book`
4. Scope: `profile openid`
5. Copy the **LIFF ID** (format: `1234567890-xxxxxxxx`)
6. Set `VITE_LIFF_ID=<LIFF ID>` in `frontend/.env.local`
7. Set `LIFF_URL=https://liff.line.me/<LIFF ID>` in `backend/.env`

### 2.5 LINE Notify (nurse group notifications)
1. Go to https://notify-bot.line.me → **My page** → Generate token
2. Choose the nurse group LINE chat
3. Copy the token → set `LINE_NOTIFY_TOKEN` in `backend/.env`

> **Note**: LINE Notify was officially discontinued March 31, 2025. If it no longer works, replace `send_line_notify()` in `backend/app/services/line.py` with a Messaging API push to a group chat ID instead.

---

## 3. SlipOK

1. Register at https://slipok.com
2. Get your **API key** from the dashboard
3. Your endpoint will be: `https://api.slipok.com/api/line/apikey/<YOUR_KEY>`
4. Set in `backend/.env`:
```
SLIPOK_API_KEY=<your key>
SLIPOK_ENDPOINT=https://api.slipok.com/api/line/apikey/<your key>
```

---

## 4. Environment Variables

### 4.1 `backend/.env` (copy from `.env.example`)
```env
# LINE Messaging API
LINE_CHANNEL_SECRET=<from Step 2.2>
LINE_CHANNEL_ACCESS_TOKEN=<from Step 2.2>

# LINE Notify
LINE_NOTIFY_TOKEN=<from Step 2.5>

# SlipOK
SLIPOK_API_KEY=<from Step 3>
SLIPOK_ENDPOINT=https://api.slipok.com/api/line/apikey/<your key>

# Firebase
FIREBASE_PROJECT_ID=mornut-prod
FIREBASE_STORAGE_BUCKET=mornut-prod.appspot.com
# Local dev only — leave blank on Cloud Run
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json

# Clinic
CLINIC_ID=<chosen by you, e.g. "clinic-001">
LIFF_URL=https://liff.line.me/<LIFF ID from Step 2.4>

# Scheduler shared secret (generate any random string)
SCHEDULER_SECRET=<random 32-char string>
```

### 4.2 `frontend/.env.local` (create this file)
```env
VITE_LIFF_ID=<LIFF ID from Step 2.4>
VITE_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}
VITE_API_BASE_URL=/api
VITE_CLINIC_ID=<same value as CLINIC_ID in backend>
```

> Paste the entire `firebaseConfig` JSON as a single line string for `VITE_FIREBASE_CONFIG`.

---

## 5. Firestore Security Rules

Deploy the pre-written rules from the repo root:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

If the deploy command fails, paste `firestore.rules` content manually in:
Firebase Console → Firestore → **Rules** tab

---

## 6. Firestore Seed Data

The app reads clinic configuration from Firestore. Create these documents manually in the Firebase Console or via the Firebase Admin SDK.

### 6.1 Services sub-collection
Path: `clinics/{CLINIC_ID}/services/{serviceId}`

Create one document per service:
```json
{
  "name": "ตรวจโรคทั่วไป",
  "durationMin": 30,
  "depositAmount": 200
}
```
```json
{
  "name": "ฉีดวัคซีน",
  "durationMin": 15,
  "depositAmount": 100
}
```

### 6.2 Slots document (per date)
Path: `clinics/{CLINIC_ID}/slots/{YYYY-MM-DD}`

```json
{
  "09:00": { "capacity": 2, "reserved": 0 },
  "09:30": { "capacity": 2, "reserved": 0 },
  "10:00": { "capacity": 2, "reserved": 0 },
  "10:30": { "capacity": 2, "reserved": 0 },
  "13:00": { "capacity": 2, "reserved": 0 },
  "13:30": { "capacity": 2, "reserved": 0 }
}
```

> You need to create a slot document for every date the clinic is open.
> Consider writing a small script to pre-generate 30 days of slot documents.

### 6.3 Quotas document (per date)
Path: `clinics/{CLINIC_ID}/quotas/{YYYY-MM-DD}`

```json
{
  "cash":      { "limit": 10, "used": 0 },
  "sso":       { "limit": 5,  "used": 0 },
  "universal": { "limit": 5,  "used": 0 }
}
```

> After deploying, the admin can change limits any day via the Dashboard → **ตั้งค่าโควตา** panel without touching Firestore directly.

---

## 7. Firebase Auth — Admin User

1. Firebase Console → Authentication → **Users** tab → **Add user**
2. Enter the admin's email and a strong password
3. This account is used to log in at `https://<your-domain>/admin`

---

## 8. Cloud Run — Set Environment Variables

After deploying the backend with `deploy.sh`, set the production env vars:
```bash
gcloud run services update mornut-backend \
  --region asia-southeast1 \
  --set-env-vars "\
LINE_CHANNEL_SECRET=xxx,\
LINE_CHANNEL_ACCESS_TOKEN=xxx,\
LINE_NOTIFY_TOKEN=xxx,\
SLIPOK_API_KEY=xxx,\
SLIPOK_ENDPOINT=xxx,\
FIREBASE_PROJECT_ID=mornut-prod,\
FIREBASE_STORAGE_BUCKET=mornut-prod.appspot.com,\
CLINIC_ID=clinic-001,\
LIFF_URL=https://liff.line.me/xxx,\
SCHEDULER_SECRET=xxx"
```

Or set them via the Cloud Run Console: Cloud Run → `mornut-backend` → **Edit & Deploy new revision** → **Variables & Secrets** tab.

---

## 9. Cloud Scheduler — Daily Reminder Job

Run this **once** after the backend is live:
```bash
export BACKEND_URL=https://mornut-backend-xxx-run.app
export CLINIC_ID=clinic-001
export SCHEDULER_SECRET=<same as above>
bash scheduler.sh
```

This creates a Cloud Scheduler job that calls `POST /internal/remind/{CLINIC_ID}` every day at **18:00 Bangkok time** to send appointment reminders to confirmed patients.

To test it immediately without waiting:
```bash
gcloud scheduler jobs run mornut-daily-reminder --location=asia-southeast1
```

---

## 10. Deploy Checklist

Run through this in order:

- [ ] Firebase project created (Step 1.1)
- [ ] Firestore, Auth, Storage, Hosting enabled (Step 1.2)
- [ ] Service account credentials obtained (Step 1.3)
- [ ] Firebase web app config copied (Step 1.4)
- [ ] LINE Messaging API channel created (Step 2.1–2.3)
- [ ] LIFF app created and endpoint URL set (Step 2.4)
- [ ] LINE Notify token generated (Step 2.5)
- [ ] SlipOK account and API key obtained (Step 3)
- [ ] `backend/.env` filled in (Step 4.1)
- [ ] `frontend/.env.local` filled in (Step 4.2)
- [ ] Firestore rules & indexes deployed (Step 5)
- [ ] Services, slots, quotas seed data created (Step 6)
- [ ] Admin Firebase Auth user created (Step 7)
- [ ] `bash deploy.sh` run successfully (deploys backend + frontend)
- [ ] Cloud Run env vars set (Step 8)
- [ ] `bash scheduler.sh` run (Step 9)
- [ ] LINE webhook URL updated to Cloud Run URL (Step 2.3)
- [ ] LIFF endpoint URL updated to Firebase Hosting URL (Step 2.4)
- [ ] End-to-end test: open LIFF → book → upload slip → check admin dashboard
