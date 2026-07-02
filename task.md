# MorNut — Fix Task List

Generated from gap analysis. Work through in order — critical bugs first.

---

## 🔴 Critical (will break in production)

### TASK-01 — Admin dashboard shows ALL clinics' bookings
**File**: `frontend/src/admin/DashboardPage.tsx` line 71
**Problem**: Firestore query has no `clinicId` filter, so every clinic's bookings for that date are returned.
**Fix**: Add `where('clinicId', '==', CLINIC_ID)` to the `constraints` useMemo.
```ts
// Change from:
const constraints = useMemo(
  () => [where('date', '==', date), orderBy('time', 'asc')],
  [date],
)

// Change to:
const constraints = useMemo(
  () => [
    where('clinicId', '==', CLINIC_ID),
    where('date', '==', date),
    orderBy('time', 'asc'),
  ],
  [date],
)
```
- [ ] Done

---

### TASK-02 — Admin dashboard gets permission denied from Firestore
**Files**: `firestore.rules`, `setup_config.md`
**Problem**: The `isAdminOf()` rule checks for a document at `clinics/{clinicId}/admins/{uid}` but this document is never created. The Firebase client SDK `onSnapshot` in the dashboard always gets permission denied.
**Fix (two parts)**:

Part A — Simplify the Firestore rule for bookings to allow any authenticated Firebase user to read (admin-only dashboard is protected by Firebase Auth login):
```js
// In firestore.rules, change the bookings read rule from:
allow read, write: if request.auth != null && isAdminOf(resource.data.clinicId);

// To:
allow read: if request.auth != null;
allow write: if request.auth != null && isAdminOf(resource.data.clinicId);
```

Part B — Add missing step to `setup_config.md` under Section 7:
After creating the Firebase Auth admin user, also create this Firestore document:
```
Path: clinics/{CLINIC_ID}/admins/{ADMIN_UID}
Fields: { "email": "admin@example.com" }   (any field, existence is what matters)
```
- [ ] Done

---

### TASK-03 — Missing Firestore composite index for dashboard query
**File**: `firestore.indexes.json`
**Problem**: After TASK-01 fix, the query uses `(clinicId == x AND date == y)` ordered by `time`. This 3-field combination has no composite index and Firestore will reject it.
**Fix**: Add index to `firestore.indexes.json`:
```json
{
  "collectionGroup": "bookings",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "clinicId", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "ASCENDING" },
    { "fieldPath": "time", "order": "ASCENDING" }
  ]
}
```
Then deploy: `firebase deploy --only firestore:indexes`
- [ ] Done

---

### TASK-04 — `reminded` and `no_show` statuses render broken badges
**File**: `frontend/src/admin/DashboardPage.tsx` lines 44–61
**Problem**: `STATUS_COLOR`, `STATUS_BG`, `STATUS_LABEL` only define 4 statuses. After the daily reminder runs, bookings flip to `reminded` — badge renders with `undefined` color and blank label.
**Fix**: Add the missing statuses to all three maps:
```ts
const STATUS_COLOR: Record<string, string> = {
  pending_slip: '#E65100',
  confirmed:    '#2E7D32',
  reminded:     '#1565C0',   // add
  done:         '#757575',
  cancelled:    '#C62828',
  no_show:      '#6A1B9A',   // add
}
const STATUS_BG: Record<string, string> = {
  pending_slip: '#FFF3E0',
  confirmed:    '#E8F5E9',
  reminded:     '#E3F2FD',   // add
  done:         '#F5F5F5',
  cancelled:    '#FFEBEE',
  no_show:      '#F3E5F5',   // add
}
const STATUS_LABEL: Record<string, string> = {
  pending_slip: 'รอสลิป',
  confirmed:    'ยืนยันแล้ว',
  reminded:     'แจ้งเตือนแล้ว',  // add
  done:         'เสร็จแล้ว',
  cancelled:    'ยกเลิก',
  no_show:      'ไม่มา',          // add
}
```
- [ ] Done

---

## 🟡 Medium (incomplete features)

### TASK-05 — `BookingResult` interface missing fields
**File**: `frontend/src/api/bookings.ts`
**Problem**: `BookingResult` is missing fields that `BookingOut` (backend) returns, causing wrong TypeScript types.
**Fix**: Extend `BookingResult`:
```ts
export interface BookingResult {
  id: string
  status: string
  date: string
  time: string
  coverage: CoverageType
  patient_name: string
  patient_line_id: string     // add
  clinic_id: string
  service_id: string
  service_name: string        // add
  deposit_amount: number      // add
  phone: string               // add
  created_at: string
  updated_at: string          // add
}
```
- [ ] Done

---

### TASK-06 — `reminded` bookings invisible in stats bar
**File**: `frontend/src/admin/DashboardPage.tsx` lines 83–87
**Problem**: Stats count `confirmed`, `pending_slip`, `done`. After reminders run, those bookings flip to `reminded` and disappear from all named buckets, making numbers not add up.
**Fix**: Add `reminded` to the stats row:
```ts
const reminded = bookings.filter((b) => b.status === 'reminded').length

// And add a 5th stat card:
{ label: 'แจ้งเตือนแล้ว', value: reminded, color: '#1565C0' },
```
- [ ] Done

---

### TASK-07 — "สถานะ" webhook command is stubbed
**File**: `backend/app/services/webhook_handler.py` line 41
**Problem**: When patient types "สถานะ", bot replies with a generic message instead of fetching their bookings.
**Fix**: Query Firestore for the patient's upcoming bookings and format them as a reply message:
```python
elif lower in ("สถานะ", "status", "คิว", "ดูคิว"):
    # Query confirmed/reminded bookings for this LINE user
    # Reply with booking date, time, service
```
Requires: Firestore query `patientLineId == event.source.user_id AND status in [confirmed, reminded]`
- [ ] Done

---

### TASK-08 — Admin dashboard has no search or status filter
**File**: `frontend/src/admin/DashboardPage.tsx`
**Problem**: Staff cannot search by patient name or filter by status. Must scroll to find a patient.
**Fix**: Add above the table:
- Text search input — filter `bookings` in-memory by `patientName` or `phone`
- Status filter chips: ทั้งหมด / รอสลิป / ยืนยัน / แจ้งเตือน / เสร็จ / ยกเลิก
Both filters should work client-side on the already-loaded `bookings` array (no extra Firestore calls).
- [ ] Done

---

### TASK-09 — `setup_config.md` missing admins sub-collection step
**File**: `setup_config.md` Section 7
**Problem**: Section 7 only says "Create Firebase Auth user" but the security rule `isAdminOf()` also needs a Firestore document at `clinics/{CLINIC_ID}/admins/{UID}`.
**Fix**: Add to Section 7 of `setup_config.md`:
```
4. In Firebase Console → Firestore → clinics → {CLINIC_ID} → admins
   → Add document with Document ID = the admin's Firebase Auth UID
   → Add any field, e.g. { "email": "admin@example.com" }
   (The rule only checks for document existence, not field values)
```
- [ ] Done

---

## 🟢 Minor (polish)

### TASK-10 — Date picker starts blank in booking flow
**File**: `frontend/src/liff/steps/StepDateTime.tsx` line 17
**Problem**: `const [date, setDate] = useState('')` — user must open the date picker and manually select today before seeing any slots.
**Fix**:
```ts
const [date, setDate] = useState(today)
```
The `today` constant is already defined on line 11.
- [ ] Done

---

### TASK-11 — Dead `/patients` Firestore rule
**File**: `firestore.rules` lines 47–50
**Problem**: No backend code ever reads or writes the `patients` collection. The rule is dead code.
**Fix**: Remove the `match /patients/{lineId}` block, or keep as future placeholder with a comment.
- [ ] Done

---

### TASK-12 — CORS wildcard in production
**File**: `backend/app/main.py` line 9
**Problem**: `allow_origins=["*"]` allows any origin. Should be locked to the Firebase Hosting domain before going live.
**Fix**:
```python
allow_origins=[
    "https://<your-project-id>.web.app",
    "https://<your-project-id>.firebaseapp.com",
    "http://localhost:5173",  # local dev
],
```
Replace `<your-project-id>` with the actual Firebase project ID.
- [ ] Done

---

### TASK-13 — No mobile card stacking in admin dashboard
**File**: `frontend/src/admin/DashboardPage.tsx`
**Problem**: On mobile the booking table just scrolls horizontally (minWidth: 620). Design doc specifies cards on mobile.
**Fix**: Detect narrow viewport and render booking cards instead of table rows on < 768px width. Use `window.innerWidth` or a CSS media query approach via a custom hook.
- [ ] Done

---

## Order of attack (recommended)

1. TASK-01 → TASK-03 → TASK-04 (fixes the dashboard so it actually works)
2. TASK-02 + TASK-09 (Firestore rules + setup doc in one pass)
3. TASK-05 → TASK-06 (TypeScript cleanup + stats bar)
4. TASK-10 (quick 1-line fix)
5. TASK-07 → TASK-08 (new features, more work)
6. TASK-11 → TASK-12 → TASK-13 (polish, do before launch)
