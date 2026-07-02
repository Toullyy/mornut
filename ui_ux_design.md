# MorNut — Complete UI/UX Design Document

---

## 1. Design System

### Color Palette

**Brand**
| Token | Hex | Usage |
|---|---|---|
| `brand.primary` | `#06C755` | LINE Green — buttons, active states, progress bars |
| `brand.primaryDark` | `#05A847` | Hover states |
| `brand.primaryLight` | `#E8F9EF` | Selected backgrounds, highlights |
| `brand.primarySubtle` | `#F0FDF4` | Page tint backgrounds |

**Neutral Scale**
| Token | Hex | Usage |
|---|---|---|
| `neutral.900` | `#0F172A` | Primary text |
| `neutral.700` | `#374151` | Secondary text |
| `neutral.500` | `#6B7280` | Tertiary text, placeholders |
| `neutral.400` | `#9CA3AF` | Disabled text |
| `neutral.300` | `#D1D5DB` | Borders |
| `neutral.200` | `#E5E7EB` | Dividers |
| `neutral.100` | `#F3F4F6` | Input backgrounds |
| `neutral.50` | `#F9FAFB` | Page backgrounds |
| `neutral.0` | `#FFFFFF` | Card backgrounds |

**Semantic**
| Token | Hex | Pair (text on light bg) |
|---|---|---|
| `success` | `#10B981` | `#065F46` on `#D1FAE5` |
| `warning` | `#F59E0B` | `#92400E` on `#FEF3C7` |
| `error` | `#EF4444` | `#7F1D1D` on `#FEE2E2` |
| `info` | `#3B82F6` | `#1E3A8A` on `#DBEAFE` |

**Coverage — distinct colors for instant scanning**
| Coverage | Dot/Badge color | Light Background |
|---|---|---|
| เงินสด (Cash) | `#2563EB` blue | `#EFF6FF` |
| ประกันสังคม (SSO) | `#059669` emerald | `#ECFDF5` |
| บัตรทอง (UC) | `#D97706` amber | `#FFFBEB` |

**Status Badges**
| Status | Badge Text | Badge Background |
|---|---|---|
| pending_slip | `#92400E` | `#FEF3C7` |
| confirmed | `#065F46` | `#D1FAE5` |
| reminded | `#1E3A8A` | `#DBEAFE` |
| done | `#374151` | `#F3F4F6` |
| cancelled | `#7F1D1D` | `#FEE2E2` |

---

### Typography

**Font Stack**
```
Primary:    'Noto Sans Thai', 'Inter', system-ui, sans-serif
Monospace:  'JetBrains Mono', 'Fira Code', monospace  (booking IDs, codes)
```

**Type Scale**
| Name | Size | Line Height | Weight | Usage |
|---|---|---|---|---|
| Display | 36px | 44px | 700 | Hero headings |
| H1 | 28px | 36px | 700 | Page titles |
| H2 | 22px | 30px | 600 | Section headers |
| H3 | 18px | 26px | 600 | Card titles |
| H4 | 16px | 24px | 600 | Sub-section labels |
| Body L | 16px | 25px | 400 | Primary body — LIFF |
| Body M | 14px | 22px | 400 | Admin body text |
| Body S | 13px | 20px | 400 | Captions, hints |
| Body XS | 12px | 18px | 600 | Badges, metadata |
| Mono | 13px | 20px | 500 | Booking IDs |

Minimum for LIFF (elderly): 15px body text, never below 13px for any label.

---

### Spacing Scale (4px base)
```
1 → 4px     2 → 8px     3 → 12px    4 → 16px
5 → 20px    6 → 24px    8 → 32px    10 → 40px
12 → 48px   16 → 64px   20 → 80px   24 → 96px
```

---

### Border Radius
| Token | Value | Usage |
|---|---|---|
| `xs` | 4px | Tiny badges |
| `s` | 6px | Small buttons |
| `m` | 8px | Standard buttons, inputs |
| `l` | 12px | Cards |
| `xl` | 16px | Modals, large cards |
| `2xl` | 24px | LIFF hero cards |
| `full` | 9999px | Pills, avatars, status badges |

---

### Shadows
```
xs:    0 1px 2px  rgba(0,0,0,0.05)    subtle lift
s:     0 1px 4px  rgba(0,0,0,0.08)    card default
m:     0 4px 12px rgba(0,0,0,0.10)    card hover, dropdowns
l:     0 8px 24px rgba(0,0,0,0.12)    modals
xl:    0 16px 48px rgba(0,0,0,0.14)   overlays
focus: 0 0 0 3px  rgba(6,199,85,0.25) keyboard focus ring
```

---

### Buttons

**Variants**
| Variant | Background | Text | Border | Usage |
|---|---|---|---|---|
| Primary | `#06C755` | White | none | Main CTA |
| Secondary | White | `#374151` | `#D1D5DB` | Secondary action |
| Destructive | `#EF4444` | White | none | Delete, cancel |
| Ghost | Transparent | `#06C755` | none | Tertiary action |
| Link | Transparent | `#06C755` | none (underline) | Navigation |

**Sizes**
| Size | Height | Padding X | Font | Usage |
|---|---|---|---|---|
| XS | 28px | 12px | 12px | Table inline actions |
| S | 32px | 16px | 13px | Secondary table actions |
| M | 40px | 20px | 14px | Admin standard |
| L | 48px | 24px | 15px | LIFF standard |
| XL | 56px | 32px | 16px | LIFF primary CTA |

States: Default → Hover (5% darker) → Active (10% darker) → Disabled (40% opacity) → Loading (spinner + disabled)

---

### Cards
- Background: `#FFFFFF`
- Border: `1px solid #E5E7EB`
- Border Radius: 12px
- Shadow: Shadow S
- Padding: 20px desktop / 16px mobile
- Hover (interactive): Shadow M + border `#D1FAE5`

---

### Form Inputs
- Height: 40px (admin) / 48px (LIFF — elderly)
- Border: `1px solid #D1D5DB`
- Border Radius: 8px
- Font: 15px LIFF / 14px admin
- Focus ring: border `#06C755` + shadow focus
- Error: border `#EF4444` + light red shadow
- Disabled: background `#F3F4F6` + text `#9CA3AF`

---

### Status Badges
- Height: 22px, border-radius: full
- Padding: 2px 8px
- Font: 12px, 600 weight
- Always pair color with a text label — never color alone

---

### Loading States
1. **Skeleton** — gray animated pulse for content areas
2. **Spinner** — 20px circular spinner inside buttons
3. **Page Loader** — centered spinner for route transitions
4. **Inline Dots** — 3 pulsing dots for real-time data refresh

---

### Empty States
```
     [Simple line-art illustration]
     ยังไม่มีคิววันนี้
     เลือกวันอื่นหรือรอการจองใหม่
     [ดูวันอื่น]  (optional CTA)
```

---

### Error States
- **Field error**: Red text 12px below the input, with warning icon
- **API error**: Toast notification, top-right desktop / top-center mobile, auto-dismiss 4s
- **Page error**: Centered card with message + [ลองอีกครั้ง] button
- **Network offline**: Yellow banner at page top, persists until reconnected

---

## 2. Information Architecture

### Patient (LIFF) — Single-page stepper

```
LINE Chat
  └── User types "จอง"
  └── Bot sends LIFF link → liff.line.me/{id}?clinicId=xxx
        └── LIFF opens in LINE in-app browser
              └── /book?clinicId=xxx
                    ├── Loading / Auth check
                    ├── Step 1: Select Service
                    ├── Step 2: Select Date & Time
                    ├── Step 3: Patient Info
                    ├── Step 4: Coverage Selection
                    ├── Step 5: Review & Confirm
                    └── Success
                          └── Slip Upload
                                ├── Verifying...
                                ├── Confirmed
                                └── Retry
```

LINE Touchpoints (outside LIFF):
- Booking confirmation → Flex Message in chat
- Day-before reminder → Push message
- Admin cancellation → Push message

---

### Admin — Web Dashboard

```
/admin
├── Dashboard (default view — today's queue + stats)
│     ├── Date picker → changes viewed date
│     └── Quota Settings panel (collapsible)
└── [Future]
      ├── /admin/bookings  (full booking history, search, filter)
      ├── /admin/calendar  (monthly calendar view)
      ├── /admin/services  (manage services, durations, deposits)
      └── /admin/settings  (clinic profile, working hours)
```

**Admin Sidebar Navigation**
```
[Logo] หมอนัด
─────────────
Dashboard
รายการจอง
ปฏิทิน
โควตา
บริการ
─────────────
[Avatar] ชื่อแอดมิน
[ออกจากระบบ]
```

---

## 3. Screen Wireframes

### LIFF-01 — Loading / LIFF Init
**Purpose**: Initialize LIFF, verify LINE auth

```
┌──────────────────────┐
│                      │
│   [Green circle]     │
│        M             │
│                      │
│      หมอนัด          │
│                      │
│   ⟳  กำลังโหลด...   │
│                      │
└──────────────────────┘
```

Behavior: Auto-advances on success. On auth failure → calls `liff.login()`. On LIFF init error → shows error message with clinic phone number.

---

### LIFF-02 — Step 1: Select Service
**Purpose**: Choose the type of medical service

```
┌──────────────────────┐
│ ██████░░░░░ 1/5      │
│ เลือกบริการ           │
├──────────────────────┤
│                      │
│ ┌────────────────┐   │
│ │ ตรวจโรคทั่วไป  │   │
│ │ 30 นาที        │   │
│ │ มัดจำ 200 บาท  │   │
│ └────────────────┘   │
│                      │
│ ┌────────────────┐   │
│ │ ฉีดวัคซีน      │   │
│ │ 15 นาที        │   │
│ │ มัดจำ 100 บาท  │   │
│ └────────────────┘   │
│                      │
└──────────────────────┘
```

Interaction: Tap card → green border + checkmark → auto-advance to Step 2 (200ms)
Empty state: "ไม่มีบริการในขณะนี้ กรุณาติดต่อคลินิก"

---

### LIFF-03 — Step 2: Select Date & Time
**Purpose**: Pick available appointment date and time slot

```
┌──────────────────────┐
│ ████████░░░ 2/5      │
│ เลือกวันและเวลา       │
├──────────────────────┤
│ [ย้อนกลับ]            │
│                      │
│  วันที่               │
│ [  10 กรกฎาคม 2569  ]│
│                      │
│  เวลาที่ว่าง          │
│                      │
│ [09:00] [09:30]      │
│ [10:00] [เต็ม]       │
│ [13:00] [13:30]      │
│                      │
│  [ถัดไป]  (disabled  │
│      until selected) │
└──────────────────────┘
```

Slot States: Available (white, green border on hover), Selected (filled green, white text), Full (gray, "เต็ม", disabled)
Behavior: Changing date → show skeleton → re-fetch → render new slots

---

### LIFF-04 — Step 3: Patient Info
**Purpose**: Confirm identity and enter phone

```
┌──────────────────────┐
│ ██████████░ 3/5      │
│ ข้อมูลผู้ป่วย         │
├──────────────────────┤
│ [ย้อนกลับ]            │
│                      │
│ ชื่อ-นามสกุล          │
│ ┌──────────────────┐ │
│ │ สมชาย ใจดี       │ │  pre-filled from LINE
│ └──────────────────┘ │
│                      │
│ เบอร์โทรศัพท์        │
│ ┌──────────────────┐ │
│ │ 08X-XXX-XXXX     │ │  tel input
│ └──────────────────┘ │
│   9-10 หลัก          │  inline error
│                      │
│      [ถัดไป]         │
└──────────────────────┘
```

Validation: Inline on blur. Name >= 2 chars, phone regex `^\d{9,10}$`
Input height: 48px for elderly users

---

### LIFF-05 — Step 4: Coverage Selection
**Purpose**: Choose insurance/payment type

```
┌──────────────────────┐
│ ████████████░ 4/5    │
│ เลือกสิทธิ์การรักษา  │
├──────────────────────┤
│ [ย้อนกลับ]            │
│                      │
│ ┌──────────────────┐ │
│ │ ชำระเงินสด       │ │  selectable
│ │ จ่ายตามจริง       │ │
│ │       เหลือ 7    │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ ประกันสังคม      │ │
│ │       เหลือ 4    │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ บัตรทอง  (dim)   │ │  disabled, quota = 0
│ │   เต็มแล้ว       │ │
│ └──────────────────┘ │
│                      │
│      [ถัดไป]         │
└──────────────────────┘
```

Selection: Green border + checkmark on selected card
Quota = 0: 50% opacity, "เต็มแล้ว" badge, not clickable

---

### LIFF-06 — Step 5: Review & Confirm
**Purpose**: Final check before creating booking

```
┌──────────────────────┐
│ ████████████████ 5/5 │
│ ยืนยันการจอง         │
├──────────────────────┤
│ [ย้อนกลับ]            │
│                      │
│ ┌──────────────────┐ │
│ │ บริการ  ตรวจทั่วไป│ │
│ │ วันที่  10 ก.ค.  │ │
│ │ เวลา    09:00 น. │ │
│ │ สิทธิ์  เงินสด   │ │
│ │ ชื่อ    สมชาย... │ │
│ │ โทร.    081-234  │ │
│ │ มัดจำ   200 บาท  │ │
│ └──────────────────┘ │
│                      │
│  [ยืนยันการจอง]      │
└──────────────────────┘
```

Loading state: button shows spinner + "กำลังจอง..."
Error state: Red card below summary with error message + retry

---

### LIFF-07 — Booking Success + Slip Upload
**Purpose**: Confirm booking, prompt deposit payment + slip upload

```
┌──────────────────────┐
│                      │
│  [ ✓ ]  72px circle  │
│                      │
│  จองคิวสำเร็จ!       │
│  รหัส: ...ABCD1234   │  monospace
│                      │
│ ┌──────────────────┐ │
│ │ summary table    │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ ชำระมัดจำ 200 บาท│ │  yellow warning box
│ │ ภายใน 15 นาที    │ │
│ └──────────────────┘ │
│                      │
│ [อัปโหลดสลิป]        │  primary button
│ [ปิดหน้าต่าง]        │  ghost button
└──────────────────────┘
```

Slip Upload sub-states:
```
Uploading:
  [⟳ กำลังตรวจสอบสลิป...]

Success:
  ┌──────────────────┐
  │ ตรวจสอบสำเร็จ!   │  green background
  │ ยอดที่ได้รับ ฿200 │
  └──────────────────┘

Error:
  ┌──────────────────┐
  │ สลิปไม่ถูกต้อง...│  red background
  │ [ลองอีกครั้ง]    │
  └──────────────────┘
```

---

### ADMIN-01 — Login
**Purpose**: Firebase Auth email/password

```
        ┌─────────────────────┐
        │  [M]  หมอนัด Admin  │
        ├─────────────────────┤
        │                     │
        │ อีเมล               │
        │ [________________]  │
        │                     │
        │ รหัสผ่าน            │
        │ [________________]  │
        │                     │
        │  [  เข้าสู่ระบบ  ] │
        └─────────────────────┘
```

Centered card, max-width 400px on desktop. Error shown inline below button.

---

### ADMIN-02 — Dashboard (Main)
**Purpose**: Real-time overview of clinic operations for selected date

**Desktop Layout (1024px+)**:
```
┌──────────┬──────────────────────────────────────────────┐
│          │  Dashboard      [10 ก.ค. 2569 ▼]  [ออก]    │
│ Sidebar  ├──────────────────────────────────────────────┤
│  240px   │                                              │
│          │  [  8 ทั้งหมด ] [ 5 ยืนยัน ] [2 รอ] [1 เสร็จ]│
│ Logo     │                                              │
│ ──────── │  คิววันนี้              [ค้นหา] [กรอง]       │
│ Dashboard│  ┌────────────────────────────────────────┐  │
│ รายการ   │  │Time│Patient│Service│Coverage│Status│Act│  │
│ ปฏิทิน   │  ├────┼───────┼───────┼────────┼──────┼───┤  │
│ โควตา    │  │9:00│สมชาย  │ตรวจ   │[Cash]  │ยืนยัน│⋯ │  │
│ บริการ   │  │9:30│สมหญิง │ฉีด    │[SSO]   │รอสลิป│⋯ │  │
│ ตั้งค่า  │  └────────────────────────────────────────┘  │
│          │                                              │
│          │  ▼ ตั้งค่าโควตา  (collapsed)                │
└──────────┴──────────────────────────────────────────────┘
```

**Tablet Layout (768–1023px)**:
```
┌────┬─────────────────────────────────────────┐
│Icon│ Dashboard     [date]  [search]  [out]   │
│Rail│                                         │
│48px│ [stat][stat][stat][stat]  scrollable    │
│    ├─────────────────────────────────────────┤
│    │ คิววันนี้                                │
│    │ [ table, horizontal scroll if needed ]  │
│    │ ▼ โควตา                                 │
└────┴─────────────────────────────────────────┘
```

**Mobile Layout (< 768px)**:
```
┌──────────────────────────────┐
│ หมอนัด    [10 ก.ค.]   [ออก] │
├──────────────────────────────┤
│ [ 8 ทั้งหมด ] [ 5 ยืนยัน ]  │
│ [ 2 รอสลิป ] [ 1 เสร็จแล้ว]  │
├──────────────────────────────┤
│ ┌────────────────────────┐   │
│ │ 09:00  สมชาย ใจดี     │   │
│ │ ตรวจทั่วไป · Cash      │   │
│ │ [ยืนยันแล้ว]           │   │
│ │            [เสร็จ][✕]  │   │
│ └────────────────────────┘   │
│ ┌────────────────────────┐   │
│ │ 09:30  สมหญิง รักดี    │   │
│ │ ฉีดวัคซีน · SSO        │   │
│ │ [รอสลิป]               │   │
│ │                    [✕] │   │
│ └────────────────────────┘   │
├──────────────────────────────┤
│ [Dashboard][จอง][ปฏิทิน][⚙️] │  bottom nav
└──────────────────────────────┘
```

---

### ADMIN-03 — Quota Settings Panel
**Purpose**: Admin sets daily booking limits per coverage type

```
┌─────────────────────────────────────────┐
│ ▼ ตั้งค่าโควตา — 10 กรกฎาคม 2569      │
├─────────────────────────────────────────┤
│                                         │
│  เงินสด        SSO          บัตรทอง    │
│  (blue border) (green)      (amber)     │
│  [ 12    ]     [ 6    ]     [ 6    ]   │
│                                         │
│                          [บันทึก]       │
└─────────────────────────────────────────┘
```

Save feedback: button changes to "บันทึกแล้ว" for 2.5s then resets.

---

## 4. Responsive Layout

### Breakpoints
```
xs:  320px   (smallest phone)
sm:  375px   (iPhone standard)
md:  768px   (tablet portrait)
lg:  1024px  (tablet landscape / small desktop)
xl:  1280px  (desktop)
2xl: 1440px  (wide desktop)
```

### Grid System
| Breakpoint | Columns | Gutter | Margin |
|---|---|---|---|
| < 768px | 4 | 16px | 16px |
| 768–1023px | 8 | 20px | 24px |
| >= 1024px | 12 | 24px | 32px |

### Sidebar Behavior
| Breakpoint | State | Width |
|---|---|---|
| < 768px | Bottom navigation bar | Full width, 56px tall |
| 768–1023px | Icon rail, hover tooltip | 48px |
| >= 1024px | Full sidebar, icons + labels | 240px |

Transition: `width 200ms ease-in-out`

### Table Overflow Handling
- Desktop: full table, all columns visible
- Tablet: horizontal scroll with sticky first column (time)
- Mobile: cards instead of table rows

### Stat Cards Grid
- Desktop: 4-across row
- Tablet: 2x2 grid
- Mobile: 2x2 grid (smaller padding)

---

## 5. Component Library

### Navigation
| Component | Description |
|---|---|
| `Sidebar` | Left nav: logo, links, user info, logout |
| `BottomNav` | Mobile 5-tab fixed bar with active indicator |
| `IconRail` | Tablet collapsed sidebar with tooltips |
| `TopBar` | LIFF / mobile header: back button + title |

### Buttons
| Component | Description |
|---|---|
| `Button` | All variants (primary/secondary/destructive/ghost/link) + all sizes |
| `IconButton` | Icon-only with required aria-label + tooltip |
| `LoadingButton` | Extends Button: spinner + disabled during async |

### Forms
| Component | Description |
|---|---|
| `TextInput` | Label + input + hint + error message |
| `PhoneInput` | TextInput + `inputMode="tel"` + formatter |
| `DateInput` | Native date + min/max guard |
| `SelectInput` | Custom accessible dropdown |
| `NumberInput` | Spin buttons for quota settings |
| `FileUpload` | Hidden file input + styled trigger + camera capture |

### Cards
| Component | Description |
|---|---|
| `StatCard` | Large number + label + accent color |
| `ServiceCard` | Icon + name + duration + deposit badge (LIFF step 1) |
| `SlotButton` | Time slot: available / full / selected states |
| `CoverageCard` | Option card with label + remaining quota (LIFF step 4) |
| `BookingCard` | Mobile replacement for table row |
| `BookingSummaryCard` | Review table (LIFF step 5 + success screen) |
| `QuotaCard` | Used/remaining bar per coverage type |

### Status & Labels
| Component | Props |
|---|---|
| `StatusBadge` | `status: 'pending_slip' \| 'confirmed' \| 'reminded' \| 'done' \| 'cancelled'` |
| `CoverageBadge` | `type: 'cash' \| 'sso' \| 'universal'` — colored dot + label |
| `QuotaBar` | `used, limit, type` — visual fill bar |

### Feedback
| Component | Description |
|---|---|
| `Toast` | Auto-dismiss 4s, 4 variants |
| `Alert` | Inline: info / warning / error / success |
| `Modal` | Centered overlay, focus trap, Esc to close |
| `ConfirmDialog` | Confirm/cancel with destructive action |
| `Tooltip` | Appears on hover + focus, 150ms delay |
| `Drawer` | Right drawer (desktop), bottom sheet (mobile) |

### Data Display
| Component | Description |
|---|---|
| `DataTable` | Sortable, sticky header, horizontal scroll on mobile |
| `EmptyState` | Illustration + heading + subtext + optional CTA |
| `SkeletonCard` | Animated gray placeholder (card shape) |
| `SkeletonTable` | Animated gray table row placeholders |
| `Avatar` | Photo or initials fallback, 3 sizes |

### Booking-Specific
| Component | Description |
|---|---|
| `ProgressBar` | LIFF top stepper: filled green segments, current step label |
| `TimeSlotGrid` | Responsive grid of SlotButtons, 2-up mobile / 3-up tablet |
| `SlipUploadWidget` | Full slip upload UI with all states embedded |

---

## 6. Dashboard UX

### Information Hierarchy (visual weight order)
1. **Date picker** (top) — changes entire view context
2. **Stats row** — instant snapshot (total, confirmed, pending, done)
3. **Booking table / cards** — primary work surface
4. **Quota panel** — secondary, collapsed by default

### Stat Card Design Rationale
Numbers are 28px bold because clinic staff check them at a glance from across a desk. Color-coded to match status badges for pattern recognition.

### Queue Table — Column Priority
Ordered by importance for nurse workflow:
1. **Time** — when to prepare (sticky on mobile scroll)
2. **Patient** — who is coming
3. **Coverage** — billing workflow differs by type
4. **Status** — action required or not
5. **Actions** — one-click workflow completion

### Action Button Context Rules
```
pending_slip  →  [ยกเลิก] only
confirmed     →  [เสร็จ] + [ยกเลิก]
done          →  (none) — row at 65% opacity
cancelled     →  (none) — row at 65% opacity
```

### Real-time Updates
Firestore `onSnapshot` listener fires on any change. Changed rows get a 1-second green background flash then fade to white.

### Coverage Distribution (Quota Panel)
```
เงินสด     ████████░░  8 / 10
SSO        ████░░░░░░  4 / 5
บัตรทอง   ██████░░░░  3 / 5
```

---

## 7. Booking Flow UX

### Journey Map

```
LINE Chat
    user types "จอง"
    bot sends LIFF URL
LIFF Opens
    liff.init()
    LINE auth check → not logged in → liff.login()

STEP 1: Service Selection
  Fetch services from /clinics/{id}/services
  Tap service card → auto-advance to Step 2

STEP 2: Date & Time
  Pick date → fetch slots → show grid
  Tap available slot → enable Next

STEP 3: Patient Info
  Name pre-filled from LINE profile
  Enter phone, validate on blur

STEP 4: Coverage
  Fetch quotas → show 3 options with remaining
  Full options disabled

STEP 5: Review & Confirm
  Summary table
  Tap "ยืนยันการจอง" → POST /bookings
    409 slot full → show error + back
    201 created → success screen

SUCCESS SCREEN
  Show booking ID + summary
  If depositAmount > 0 → show deposit notice
  [อัปโหลดสลิป] button

SLIP UPLOAD
  Camera capture or gallery pick
  POST /slips/{id}/verify
    Fake slip → error + retry
    Low amount → error + retry
    Duplicate → error + retry
    Pass → booking confirmed
      Patient receives Flex Message
      Nurses receive LINE Notify

[ปิดหน้าต่าง] → back to LINE chat

Next evening: reminder push
Day of visit: nurse taps [เสร็จ] → done
```

### Key UX Principles
1. **One decision per screen** — no decision fatigue
2. **Progress always visible** — green bar at top
3. **Pre-fill everything possible** — name from LINE, date defaults to today
4. **Instant feedback** — slot availability on date change, validation on blur
5. **Large tap targets** — minimum 48x48px throughout
6. **Error recovery** — every error state includes a clear retry path
7. **Thai language only** — no English in patient-facing UI

---

## 8. Accessibility

### Touch Targets
- LIFF: minimum 48x48px for all interactive elements
- Admin: minimum 44x44px
- Spacing between adjacent targets: minimum 8px

### Typography Accessibility
- Body text: 15px minimum in LIFF, 14px in admin
- Line height: 1.5–1.6 throughout
- Maximum paragraph width: 65ch

### WCAG AA Color Contrast
- Normal text: 4.5:1 minimum
- Large text (18px+ bold): 3:1 minimum
- All status badge text+background pairs pre-verified

### Color Blindness Safety
- Never color alone — always add icon + text label
- Status badges: dot + text
- Coverage types: icon + label + color (triple redundancy)
- Progress bar: shows "ขั้นตอน 2/5" text alongside color

### Keyboard Navigation (Admin)
- Tab order: logical, top-to-bottom, left-to-right
- Focus ring: 3px green with box-shadow, never hidden
- Modal: focus trapped inside; Esc closes
- Table rows: Enter activates primary action

### Screen Reader Support
- Icons: `aria-hidden="true"` with adjacent text, OR `aria-label`
- Status badges: `role="status"` for live-updating content
- Progress bar: `role="progressbar"` with `aria-valuenow/min/max`
- Form fields: `<label htmlFor>` always explicit
- Loading states: `aria-live="polite"` region

---

## 9. Design Tokens

```json
{
  "color": {
    "brand": {
      "primary":        "#06C755",
      "primaryDark":    "#05A847",
      "primaryLight":   "#E8F9EF",
      "primarySubtle":  "#F0FDF4"
    },
    "neutral": {
      "900": "#0F172A",
      "700": "#374151",
      "500": "#6B7280",
      "400": "#9CA3AF",
      "300": "#D1D5DB",
      "200": "#E5E7EB",
      "100": "#F3F4F6",
      "50":  "#F9FAFB",
      "0":   "#FFFFFF"
    },
    "semantic": {
      "successText":    "#065F46",
      "successBg":      "#D1FAE5",
      "success":        "#10B981",
      "warningText":    "#92400E",
      "warningBg":      "#FEF3C7",
      "warning":        "#F59E0B",
      "errorText":      "#7F1D1D",
      "errorBg":        "#FEE2E2",
      "error":          "#EF4444",
      "infoText":       "#1E3A8A",
      "infoBg":         "#DBEAFE",
      "info":           "#3B82F6"
    },
    "coverage": {
      "cash":           "#2563EB",
      "cashBg":         "#EFF6FF",
      "sso":            "#059669",
      "ssoBg":          "#ECFDF5",
      "universal":      "#D97706",
      "universalBg":    "#FFFBEB"
    },
    "status": {
      "pendingSlip":    "#F59E0B",
      "pendingSlipBg":  "#FEF3C7",
      "pendingSlipText":"#92400E",
      "confirmed":      "#10B981",
      "confirmedBg":    "#D1FAE5",
      "confirmedText":  "#065F46",
      "reminded":       "#3B82F6",
      "remindedBg":     "#DBEAFE",
      "remindedText":   "#1E3A8A",
      "done":           "#6B7280",
      "doneBg":         "#F3F4F6",
      "doneText":       "#374151",
      "cancelled":      "#EF4444",
      "cancelledBg":    "#FEE2E2",
      "cancelledText":  "#7F1D1D"
    }
  },
  "font": {
    "family": {
      "sans": "'Noto Sans Thai', 'Inter', system-ui, sans-serif",
      "mono": "'JetBrains Mono', 'Fira Code', monospace"
    },
    "size": {
      "display": "2.25rem",
      "h1":      "1.75rem",
      "h2":      "1.375rem",
      "h3":      "1.125rem",
      "h4":      "1rem",
      "bodyLg":  "1rem",
      "bodyMd":  "0.875rem",
      "bodySm":  "0.8125rem",
      "bodyXs":  "0.75rem"
    },
    "weight": {
      "regular":  "400",
      "medium":   "500",
      "semibold": "600",
      "bold":     "700"
    },
    "lineHeight": {
      "tight":   "1.25",
      "snug":    "1.375",
      "normal":  "1.5",
      "relaxed": "1.625"
    }
  },
  "spacing": {
    "0":  "0px",   "1": "4px",   "2": "8px",
    "3":  "12px",  "4": "16px",  "5": "20px",
    "6":  "24px",  "8": "32px",  "10": "40px",
    "12": "48px",  "16": "64px", "20": "80px",
    "24": "96px"
  },
  "radius": {
    "none": "0px",   "xs":   "4px",    "sm":  "6px",
    "md":   "8px",   "lg":   "12px",   "xl":  "16px",
    "2xl":  "24px",  "full": "9999px"
  },
  "shadow": {
    "xs":    "0 1px 2px rgba(0,0,0,0.05)",
    "sm":    "0 1px 4px rgba(0,0,0,0.08)",
    "md":    "0 4px 12px rgba(0,0,0,0.10)",
    "lg":    "0 8px 24px rgba(0,0,0,0.12)",
    "xl":    "0 16px 48px rgba(0,0,0,0.14)",
    "focus": "0 0 0 3px rgba(6,199,85,0.25)"
  },
  "container": {
    "sm":              "640px",
    "md":              "768px",
    "lg":              "1024px",
    "xl":              "1280px",
    "2xl":             "1440px",
    "sidebar":         "240px",
    "sidebarCollapsed":"48px"
  },
  "breakpoint": {
    "xs":  "320px",
    "sm":  "375px",
    "md":  "768px",
    "lg":  "1024px",
    "xl":  "1280px",
    "2xl": "1440px"
  },
  "transition": {
    "fast":   "100ms ease",
    "normal": "200ms ease",
    "slow":   "300ms ease-in-out"
  },
  "zIndex": {
    "base":     "0",
    "raised":   "10",
    "dropdown": "100",
    "sticky":   "200",
    "overlay":  "300",
    "modal":    "400",
    "toast":    "500"
  }
}
```

---

## 10. Implementation Recommendations

### CSS Strategy
Adopt **Tailwind CSS v3** and convert design tokens above to `tailwind.config.ts`. This replaces current inline `CSSProperties` (which cannot handle hover, focus, responsive variants without JavaScript). Keep `theme.ts` only for dynamic runtime values (coverage color derived from booking data).

Migration priority:
1. `tailwind.config.ts` — define all tokens
2. Admin Dashboard — most complex layout, biggest payoff
3. LIFF steps — refactor with component library
4. Shared components — Button, Badge, Input, Card

### Headless Components for Accessibility
Use **Radix UI primitives** — they handle all ARIA, keyboard, focus management:
- `@radix-ui/react-dialog` → Modal, ConfirmDialog
- `@radix-ui/react-toast` → Toast notification system
- `@radix-ui/react-select` → SelectInput
- `@radix-ui/react-accordion` → Quota Settings collapsible panel
- `@radix-ui/react-tooltip` → Tooltips on icon buttons

### Icons
**Lucide React** — 1.5px stroke, consistent visual weight, tree-shakeable:
```bash
npm install lucide-react
```

### Fonts
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Recommended File Structure
```
frontend/src/
├── design-system/
│   ├── tokens.ts          all design tokens as TS constants
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── CoverageBadge.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   └── SkeletonLoader.tsx
│   └── index.ts           barrel export
├── liff/                  patient booking (existing)
├── admin/                 admin dashboard (existing)
├── hooks/                 existing
├── api/                   existing
└── lib/                   existing
```

### Animation Guidelines
- Card hover: `translateY(-2px)` + shadow increase, 150ms
- Button active: `scale(0.97)`, 100ms
- Page transitions: opacity fade, 200ms
- Slot grid: skeleton fade-in, 200ms
- Toast: slide in from right (desktop) / slide down from top (mobile), 250ms
- Row update (real-time): background flash `#D1FAE5` to transparent, 1000ms
- Skeleton: `animate-pulse` (Tailwind built-in)
