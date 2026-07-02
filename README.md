# หมอนัด (MorNut) — ระบบจัดการคิวอัจฉริยะ

Smart clinic queue management system integrated with LINE.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 + FastAPI |
| Frontend | React 18 + TypeScript + Vite |
| Database | Firebase Firestore (real-time) |
| Auth / Storage | Firebase Auth + Cloud Storage |
| Integrations | LINE Messaging API, LIFF, LINE Notify, SlipOK |
| Deploy | Cloud Run (backend), Firebase Hosting (frontend) |

## Prerequisites

- Python 3.12+
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud SDK (for Cloud Run deploy)
- A LINE Developer account with a Messaging API channel and LIFF app

## Local Setup

### 1. Clone & configure environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your real values

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your real values
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server runs at `http://localhost:5173`.  
API calls to `/api/*` are proxied to `http://localhost:8080`.

## Firebase Setup

```bash
firebase login
firebase use --add          # select your project
firebase deploy --only firestore:rules,firestore:indexes
```

## Deploy

### Backend → Cloud Run

```bash
cd backend
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/mornut-backend
gcloud run deploy mornut-backend \
  --image gcr.io/YOUR_PROJECT_ID/mornut-backend \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars "FIREBASE_PROJECT_ID=YOUR_PROJECT_ID,..."
```

### Frontend → Firebase Hosting

```bash
cd frontend && npm run build
firebase deploy --only hosting
```

## Project Structure

```
mornut/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── core/              # config, security helpers
│   │   ├── routers/           # thin HTTP handlers
│   │   ├── services/          # business logic
│   │   └── models/            # Pydantic schemas
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── liff/              # Patient booking UI (LINE LIFF)
│   │   ├── admin/             # Clinic dashboard
│   │   ├── components/        # Shared components
│   │   ├── hooks/             # Firestore real-time hooks
│   │   └── lib/               # Firebase + LIFF initializers
│   └── vite.config.ts
├── firestore.rules
├── firestore.indexes.json
└── firebase.json
```

## MVP Timeline

| Week | Focus |
|---|---|
| 1 | Project setup, scaffolding, Firebase config |
| 2 | Backend: webhook, booking API, Firestore layer |
| 3 | LIFF patient booking UI |
| 4 | SlipOK integration, slip upload/verify |
| 5 | Admin dashboard real-time + Quota Settings |
| 6 | Reminder scheduler, testing, deploy |
