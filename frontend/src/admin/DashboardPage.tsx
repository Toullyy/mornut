import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  CalendarDays,
  Settings2,
  Users,
  Bell,
  ChevronDown,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  UserCheck,
  BadgeCheck,
  Filter,
  RefreshCw,
  Plus,
  Activity,
  Stethoscope,
  ShieldCheck,
  Save,
  X,
  ChevronUp,
  CreditCard,
  FileText,
  Trash2,
  MessageCircle,
  Link2,
  LayoutGrid,
  KeyRound,
  Loader2,
  Bot,
  Send,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Pencil,
  MapPin,
  Package,
  Copy,
  Clock3,
  CalendarCheck2,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { apiFetch } from '../lib/api'
import { useBookings } from '../hooks/useBookings'
import { useChatConversations, useChatMessages } from '../hooks/useChat'
import AdminLogin from './AdminLogin'
import { DatePicker } from './DatePicker'
import {
  updateBookingStatus,
  setQuota,
  type QuotaLimits,
  fetchDoctors,
  fetchBookingHistory,
  createDoctor as apiCreateDoctor,
  updateDoctor as apiUpdateDoctor,
  deleteDoctor as apiDeleteDoctor,
  updateDoctorShifts,
  createAdminBooking,
  fetchServices,
  fetchSlots,
  getLineSettings,
  saveLineCredentials,
  enableWebhook,
  setupRichMenu,
  deleteRichMenu,
  sendChatMessage,
  resolveChat,
  setChatMode,
  fetchAppointmentsRange,
  fetchBookingReminders,
  fetchLinePatients,
  createBookingReminder,
  updateBookingReminder,
  getClinicSettings,
  updateClinicSettings,
  fetchAdminServices,
  createService,
  updateService,
  deleteService,
  type Doctor as ApiDoctor,
  type DoctorCreate,
  type ServiceItem,
  type ServiceCreate,
  type SlotItem,
  type LineOASettings,
  type ChatMessage,
  type AppointmentBooking,
  type BookingReminder,
  type LinePatient,
} from './api'

// ── Types ──────────────────────────────────────────────────────────────────
type Coverage = 'cash' | 'sso' | 'universal'
type Status = 'pending_slip' | 'confirmed' | 'reminded' | 'done' | 'no_show' | 'cancelled'
type NavItem = 'dashboard' | 'appointments' | 'quota' | 'patients' | 'doctors' | 'bookingReminders' | 'chat' | 'clinicSettings' | 'settings'

interface Booking {
  id: string
  patient_name: string
  phone: string
  date: string
  time: string
  service_name: string
  coverage: Coverage
  status: Status
  deposit_amount: number
  clinic_id: string
}

type DaySlot = { start: string; end: string }
type WeekSchedule = Record<number, DaySlot[]>  // day_of_week (0=Mon) → slots

const CLINIC_ID =
  new URLSearchParams(window.location.search).get('clinicId') ||
  import.meta.env.VITE_CLINIC_ID ||
  ''

// All color strings here so Tailwind's content scanner includes them in the bundle
const DOCTOR_COLORS = [
  'bg-red-500',
  'bg-rose-500',
  'bg-pink-500',
  'bg-fuchsia-500',
  'bg-purple-500',
  'bg-violet-500',
  'bg-indigo-500',
  'bg-blue-500',
  'bg-sky-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-emerald-500',
  'bg-green-500',
  'bg-lime-500',
  'bg-yellow-500',
  'bg-amber-500',
  'bg-orange-500',
  'bg-slate-500',
]

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']
const DAY_SHORT = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']

// ── Helpers ────────────────────────────────────────────────────────────────
const coverageLabel: Record<Coverage, string> = { cash: 'เงินสด', sso: 'ประกันสังคม', universal: 'บัตรทอง' }
const coverageBadge: Record<Coverage, string> = {
  cash: 'bg-blue-50 text-blue-700 border border-blue-200',
  sso: 'bg-violet-50 text-violet-700 border border-violet-200',
  universal: 'bg-amber-50 text-amber-700 border border-amber-200',
}
const statusConfig: Record<Status, { label: string; className: string; icon: React.ReactNode }> = {
  pending_slip: { label: 'รอสลิป', className: 'bg-yellow-50 text-yellow-700 border border-yellow-200', icon: <Clock size={11} /> },
  confirmed: { label: 'ยืนยันแล้ว', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: <CheckCircle2 size={11} /> },
  reminded: { label: 'แจ้งเตือนแล้ว', className: 'bg-sky-50 text-sky-700 border border-sky-200', icon: <Bell size={11} /> },
  done: { label: 'เสร็จสิ้น', className: 'bg-slate-100 text-slate-500 border border-slate-200', icon: <BadgeCheck size={11} /> },
  no_show: { label: 'ไม่มา', className: 'bg-red-50 text-red-600 border border-red-200', icon: <XCircle size={11} /> },
  cancelled: { label: 'ยกเลิก', className: 'bg-rose-50 text-rose-500 border border-rose-200', icon: <XCircle size={11} /> },
}

function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number
  total: number
  pageSize: number
  onChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  const btn = 'min-w-[2rem] h-8 px-1 flex items-center justify-center rounded-lg text-xs font-medium transition-colors cursor-pointer'

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 flex-wrap gap-2">
      <span className="text-xs text-muted-foreground">
        แสดง {from}–{to} จาก {total} รายการ
      </span>
      {totalPages > 1 && (
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className={`${btn} ${page === 1 ? 'opacity-40' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
        >
          <ChevronLeft size={14} />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="min-w-[2rem] h-8 flex items-center justify-center text-xs text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`${btn} ${p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className={`${btn} ${page === totalPages ? 'opacity-40' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
        >
          <ChevronRight size={14} />
        </button>
      </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const cfg = statusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.className}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function CoverageBadge({ coverage }: { coverage: Coverage }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${coverageBadge[coverage]}`}>
      {coverageLabel[coverage]}
    </span>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function SettingsSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="text-primary">{icon}</div>
          <span className="font-semibold text-foreground text-sm">{title}</span>
        </div>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-border">{children}</div>}
    </div>
  )
}

function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="ml-8 shrink-0">{children}</div>
    </div>
  )
}

// ── Add Queue Modal ────────────────────────────────────────────────────────

function AddQueueModal({
  date: initialDate,
  clinicId,
  prefill,
  onClose,
  onCreated,
}: {
  date: string
  clinicId: string
  prefill?: { patient_name: string; phone: string }
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState(() => {
    const [first_name = '', ...rest] = prefill?.patient_name.trim().split(/\s+/) ?? []
    return {
      first_name,
      last_name: rest.join(' '),
      phone: prefill?.phone ?? '',
      date: initialDate,
      time: '',
      service_id: '',
      service_name: '',
      coverage: 'cash' as Coverage,
      deposit_amount: 0,
    }
  })
  const [services, setServices] = useState<ServiceItem[]>([])
  const [slots, setSlots] = useState<SlotItem[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!clinicId) { setLoadingServices(false); return }
    fetchServices(clinicId)
      .then(setServices)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoadingServices(false))
  }, [clinicId])

  useEffect(() => {
    if (!clinicId || !form.date) return
    setLoadingSlots(true)
    setForm(f => ({ ...f, time: '' }))
    fetchSlots(clinicId, form.date)
      .then(s => setSlots(s.filter(sl => sl.available > 0)))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoadingSlots(false))
  }, [form.date, clinicId])

  useEffect(() => {
    const svc = services.find(s => s.id === form.service_id)
    if (svc) setForm(f => ({ ...f, service_name: svc.name, deposit_amount: svc.deposit_amount }))
  }, [form.service_id, services])

  const isValid =
    form.first_name.trim().length > 0 &&
    form.phone.trim().length === 10 &&
    form.date.length > 0 &&
    form.time.length > 0 &&
    form.service_id.length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError('')
    try {
      const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`.trim()
      await createAdminBooking({
        patient_name: fullName,
        phone: form.phone.trim(),
        service_id: form.service_id,
        service_name: form.service_name,
        date: form.date,
        time: form.time,
        coverage: form.coverage,
        deposit_amount: form.deposit_amount,
        clinic_id: clinicId,
      })
      onCreated()
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  const field = 'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/30'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>เพิ่มคิวใหม่</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">ชื่อ <span className="text-destructive">*</span></label>
              <input
                type="text"
                placeholder="ชื่อ"
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                className={field}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">นามสกุล</label>
              <input
                type="text"
                placeholder="นามสกุล"
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                className={field}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">เบอร์โทร <span className="text-destructive">*</span></label>
            <input
              type="tel"
              placeholder="0812345678"
              value={form.phone}
              maxLength={10}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              className={`${field} font-mono tracking-widest`}
            />
            {form.phone.length > 0 && form.phone.length < 10 && (
              <p className="text-[11px] text-muted-foreground">{form.phone.length}/10 หลัก</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">วันที่</label>
            <DatePicker
              value={form.date}
              onChange={v => setForm(f => ({ ...f, date: v }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">บริการ <span className="text-destructive">*</span></label>
            <select
              value={form.service_id}
              onChange={e => setForm(f => ({ ...f, service_id: e.target.value }))}
              disabled={loadingServices}
              className={field}
            >
              <option value="">{loadingServices ? 'กำลังโหลด...' : 'เลือกบริการ'}</option>
              {services.map(svc => (
                <option key={svc.id} value={svc.id}>{svc.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">เวลา <span className="text-destructive">*</span></label>
              <select
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                disabled={loadingSlots}
                className={`${field} font-mono`}
              >
                <option value="">
                  {loadingSlots ? 'กำลังโหลด...' : slots.length === 0 ? 'ไม่มีช่องว่าง' : 'เลือกเวลา'}
                </option>
                {slots.map(sl => (
                  <option key={sl.time} value={sl.time}>{sl.time} (ว่าง {sl.available})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">สิทธิ์การรักษา</label>
              <select
                value={form.coverage}
                onChange={e => setForm(f => ({ ...f, coverage: e.target.value as Coverage }))}
                className={field}
              >
                <option value="cash">เงินสด</option>
                <option value="sso">ประกันสังคม</option>
                <option value="universal">บัตรทอง</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">มัดจำ (บาท)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
              <input
                type="number"
                value={form.deposit_amount}
                onChange={e => setForm(f => ({ ...f, deposit_amount: Number(e.target.value) }))}
                min={0}
                className={`${field} pl-7 font-mono`}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            {submitting ? 'กำลังเพิ่ม...' : 'เพิ่มคิว'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Doctor Modal ───────────────────────────────────────────────────────

function computeInitials(name: string): string {
  const cleaned = name.replace(/^(นพ\.|พญ\.|ดร\.|ผศ\.ดร\.|รศ\.ดร\.)\s*/u, '').trim()
  return cleaned.substring(0, 2)
}

function AddDoctorModal({
  clinicId,
  onClose,
  onCreated,
}: {
  clinicId: string
  onClose: () => void
  onCreated: (doc: ApiDoctor) => void
}) {
  const [form, setForm] = useState<DoctorCreate>({
    name: '',
    specialty: '',
    color: DOCTOR_COLORS[0],
    initials: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isValid = form.name.trim().length > 0 && form.specialty.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError('')
    try {
      const initials = form.initials.trim() || computeInitials(form.name)
      const newDoc = await apiCreateDoctor(clinicId, { ...form, initials })
      onCreated(newDoc)
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  const field = 'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/30'
  const preview = form.initials.trim() || (form.name ? computeInitials(form.name) : '?')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>เพิ่มแพทย์ใหม่</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ชื่อ-นามสกุล <span className="text-destructive">*</span></label>
            <input
              type="text"
              placeholder="เช่น นพ. สมชาย ใจดี"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={field}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ความเชี่ยวชาญ <span className="text-destructive">*</span></label>
            <input
              type="text"
              placeholder="เช่น อายุรกรรม"
              value={form.specialty}
              onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
              className={field}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">อักษรย่อ (ไม่เกิน 2 ตัว)</label>
            <input
              type="text"
              placeholder={form.name ? computeInitials(form.name) : 'อก'}
              value={form.initials}
              onChange={e => setForm(f => ({ ...f, initials: e.target.value.substring(0, 2) }))}
              maxLength={2}
              className={`${field} w-24 font-mono`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">สีประจำตัว</label>
            <div className="flex gap-2 flex-wrap">
              {DOCTOR_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color }))}
                  className={`w-8 h-8 rounded-full ${color} transition-all cursor-pointer ${
                    form.color === color
                      ? 'ring-2 ring-offset-2 ring-foreground scale-110'
                      : 'hover:scale-105 opacity-60'
                  }`}
                />
              ))}
            </div>
          </div>

          {form.name && (
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border">
              <div className={`w-10 h-10 rounded-xl ${form.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                {preview}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{form.name}</p>
                <p className="text-xs text-muted-foreground">{form.specialty || 'ความเชี่ยวชาญ'}</p>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            {submitting ? 'กำลังเพิ่ม...' : 'เพิ่มแพทย์'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Doctor Modal ──────────────────────────────────────────────────────

function EditDoctorModal({
  doctor,
  onClose,
  onSaved,
}: {
  doctor: ApiDoctor
  onClose: () => void
  onSaved: (updated: ApiDoctor) => void
}) {
  const [form, setForm] = useState<DoctorCreate>({
    name: doctor.name,
    specialty: doctor.specialty,
    color: doctor.color,
    initials: doctor.initials,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isValid = form.name.trim().length > 0 && form.specialty.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError('')
    try {
      const initials = form.initials.trim() || computeInitials(form.name)
      await apiUpdateDoctor(doctor.id, { ...form, initials })
      onSaved({ ...doctor, ...form, initials })
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  const field = 'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/30'
  const preview = form.initials.trim() || (form.name ? computeInitials(form.name) : '?')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>แก้ไขข้อมูลแพทย์</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ชื่อ-นามสกุล <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={field}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ความเชี่ยวชาญ <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={form.specialty}
              onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
              className={field}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">อักษรย่อ (ไม่เกิน 2 ตัว)</label>
            <input
              type="text"
              placeholder={form.name ? computeInitials(form.name) : 'อก'}
              value={form.initials}
              onChange={e => setForm(f => ({ ...f, initials: e.target.value.substring(0, 2) }))}
              maxLength={2}
              className={`${field} w-24 font-mono`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">สีประจำตัว</label>
            <div className="flex gap-2 flex-wrap">
              {DOCTOR_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color }))}
                  className={`w-8 h-8 rounded-full ${color} transition-all cursor-pointer ${
                    form.color === color
                      ? 'ring-2 ring-offset-2 ring-foreground scale-110'
                      : 'hover:scale-105 opacity-60'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border">
            <div className={`w-10 h-10 rounded-xl ${form.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
              {preview}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{form.name || 'ชื่อแพทย์'}</p>
              <p className="text-xs text-muted-foreground">{form.specialty || 'ความเชี่ยวชาญ'}</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Save size={14} />
            {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Doctor schedule helpers ────────────────────────────────────────────────


function apiShiftsToSchedule(shifts: { day_of_week: number; start: string; end: string }[]): WeekSchedule {
  return shifts.reduce<WeekSchedule>((acc, s) => {
    ;(acc[s.day_of_week] ??= []).push({ start: s.start, end: s.end })
    return acc
  }, {})
}

function scheduleToApiShifts(schedule: WeekSchedule) {
  return Object.entries(schedule).flatMap(([day, slots]) =>
    slots.map(s => ({ day_of_week: Number(day), start: s.start, end: s.end }))
  )
}

// ── Doctor Card ────────────────────────────────────────────────────────────

function DoctorCard({
  doctor,
  schedule,
  selected,
  onSelect,
  onEdit,
  confirmDelete,
  onDeleteRequest,
  onConfirmDelete,
  onCancelDelete,
}: {
  doctor: ApiDoctor
  schedule: WeekSchedule
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  confirmDelete: boolean
  onDeleteRequest: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
  const jsDay = new Date().getDay()
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1
  const todaySlots = schedule[todayIdx] ?? []
  const workDays = Object.values(schedule).filter(s => s.length > 0).length

  return (
    <div
      onClick={onSelect}
      className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:shadow-sm flex flex-col gap-3 ${
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/30'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-xl ${doctor.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
          {doctor.initials || doctor.name.substring(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{doctor.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{doctor.specialty}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors cursor-pointer"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={onDeleteRequest}
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div onClick={e => e.stopPropagation()} className="flex items-center gap-2 px-2.5 py-2 bg-rose-50 border border-rose-200 rounded-lg">
          <span className="text-xs text-rose-700 flex-1">ลบแพทย์นี้?</span>
          <button onClick={onConfirmDelete} className="text-[10px] font-semibold text-white bg-rose-600 px-2 py-1 rounded hover:bg-rose-700 transition-colors cursor-pointer">ยืนยัน</button>
          <button onClick={onCancelDelete} className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">ยกเลิก</button>
        </div>
      )}

      {/* Today's schedule */}
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
          <Clock3 size={9} />วันนี้
        </p>
        {todaySlots.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {todaySlots.map((slot, i) => (
              <span key={i} className="text-[11px] bg-primary/10 text-primary border border-primary/15 px-1.5 py-0.5 rounded font-medium">
                {slot.start}–{slot.end}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/50">ไม่มีตาราง</p>
        )}
      </div>

      {/* Week dots */}
      <div className="flex items-center justify-between pt-2.5 border-t border-border">
        <div className="flex gap-1">
          {[0,1,2,3,4,5,6].map(d => {
            const active = (schedule[d] ?? []).length > 0
            return (
              <div key={d} className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-colors ${
                active ? `${doctor.color} text-white` : 'bg-muted text-muted-foreground/40'
              }`}>
                {DAY_SHORT[d]}
              </div>
            )
          })}
        </div>
        <span className="text-[11px] text-muted-foreground">{workDays} วัน/สป.</span>
      </div>
    </div>
  )
}

// ── Schedule Editor ────────────────────────────────────────────────────────

function ScheduleEditor({
  doctor,
  schedule,
  onSlotsChange,
  onSave,
  saving,
  saved,
  error,
  clinicOpenTime = '08:00',
  clinicCloseTime = '17:00',
}: {
  doctor: ApiDoctor
  schedule: WeekSchedule
  onSlotsChange: (day: number, slots: DaySlot[]) => void
  onSave: () => void
  saving: boolean
  saved: boolean
  error: string
  clinicOpenTime?: string
  clinicCloseTime?: string
}) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null)
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set())
  const [copyDay, setCopyDay] = useState<number | null>(null)
  const [copyTargets, setCopyTargets] = useState<Set<number>>(new Set())
  const [bulkPreset, setBulkPreset] = useState<string>('morning')

  const slotPresets: Record<string, DaySlot[]> = {
    morning:   [{ start: clinicOpenTime, end: '12:00' }],
    afternoon: [{ start: '13:00', end: clinicCloseTime }],
    fullday:   [{ start: clinicOpenTime, end: clinicCloseTime }],
  }
  const presetLabels: Record<string, { th: string; hint: string }> = {
    morning:   { th: 'เช้า',     hint: `${clinicOpenTime}–12:00` },
    afternoon: { th: 'บ่าย',     hint: `13:00–${clinicCloseTime}` },
    fullday:   { th: 'เต็มวัน', hint: `${clinicOpenTime}–${clinicCloseTime}` },
  }

  function toggleSelectDay(day: number) {
    setSelectedDays(prev => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  function applyBulkPreset() {
    const slots = slotPresets[bulkPreset] ?? []
    selectedDays.forEach(day => onSlotsChange(day, slots.map(s => ({ ...s }))))
    setSelectedDays(new Set())
  }

  function executeCopy() {
    const src = schedule[copyDay!] ?? []
    copyTargets.forEach(t => onSlotsChange(t, src.map(s => ({ ...s }))))
    setCopyDay(null)
    setCopyTargets(new Set())
  }

  const slotInput = 'text-sm bg-input-background border border-border rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-ring/30 w-28'

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${doctor.color} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
            {doctor.initials || doctor.name.substring(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{doctor.name}</p>
            <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-destructive">{error}</span>}
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Save size={13} />
            {saving ? 'กำลังบันทึก...' : saved ? 'บันทึกแล้ว ✓' : 'บันทึก'}
          </button>
        </div>
      </div>

      {/* ── Bulk bar ── */}
      {selectedDays.size > 0 && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-primary/5 border-b border-primary/10 flex-wrap">
          <span className="text-xs font-semibold text-primary">{selectedDays.size} วัน</span>
          <div className="flex gap-1">
            {Object.entries(presetLabels).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setBulkPreset(k)}
                className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  bulkPreset === k
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                }`}
              >
                {v.th}
              </button>
            ))}
          </div>
          <button
            onClick={applyBulkPreset}
            className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
          >
            ใช้กับที่เลือก
          </button>
          <button
            onClick={() => setSelectedDays(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground ml-auto cursor-pointer"
          >
            ยกเลิก
          </button>
        </div>
      )}

      {/* ── Day rows ── */}
      <div className="divide-y divide-border">
        {DAYS.map((dayName, dayIdx) => {
          const slots = schedule[dayIdx] ?? []
          const isExpanded = expandedDay === dayIdx
          const isSelected = selectedDays.has(dayIdx)
          const isCopySource = copyDay === dayIdx

          return (
            <div key={dayIdx} className={isExpanded ? 'bg-muted/20' : ''}>
              {/* Row */}
              <div className="flex items-center gap-3 px-5 py-3 min-h-[3rem]">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelectDay(dayIdx)}
                  onClick={e => e.stopPropagation()}
                  className="w-3.5 h-3.5 rounded accent-primary shrink-0 cursor-pointer"
                />
                <button
                  onClick={() => setExpandedDay(isExpanded ? null : dayIdx)}
                  className="w-20 text-left text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer shrink-0"
                >
                  {dayName}
                </button>
                <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
                  {slots.length > 0 ? (
                    slots.map((slot, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center text-[11px] bg-primary/10 text-primary border border-primary/15 px-2 py-0.5 rounded-md font-medium whitespace-nowrap"
                      >
                        {slot.start}–{slot.end}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setCopyDay(isCopySource ? null : dayIdx); setCopyTargets(new Set()) }}
                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      isCopySource ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Copy size={10} />คัดลอก
                  </button>
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : dayIdx)}
                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      isExpanded ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Pencil size={10} />แก้ไข
                  </button>
                </div>
              </div>

              {/* Copy target panel */}
              {isCopySource && (
                <div className="px-5 pb-3 flex items-center gap-2 flex-wrap border-t border-border/50 pt-2.5">
                  <span className="text-[11px] text-muted-foreground font-medium">คัดลอกไปที่:</span>
                  {DAYS.map((d, i) => i !== dayIdx && (
                    <button
                      key={i}
                      onClick={() => setCopyTargets(prev => {
                        const next = new Set(prev)
                        if (next.has(i)) next.delete(i)
                        else next.add(i)
                        return next
                      })}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                        copyTargets.has(i)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/60'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    onClick={executeCopy}
                    disabled={copyTargets.size === 0}
                    className="text-[11px] font-semibold bg-primary text-primary-foreground px-3 py-0.5 rounded-lg disabled:opacity-40 hover:bg-primary/90 transition-colors cursor-pointer ml-1"
                  >
                    คัดลอก
                  </button>
                </div>
              )}

              {/* Inline slot editor */}
              {isExpanded && (
                <div className="px-5 pb-4 pt-1 border-t border-border/50">
                  {/* Presets */}
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <span className="text-[11px] text-muted-foreground font-medium mr-0.5">Preset:</span>
                    {Object.entries(presetLabels).map(([k, v]) => (
                      <button
                        key={k}
                        onClick={() => onSlotsChange(dayIdx, slotPresets[k].map(s => ({ ...s })))}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-border hover:border-primary hover:bg-primary/5 hover:text-primary text-muted-foreground transition-colors cursor-pointer"
                      >
                        {v.th} <span className="opacity-50">{v.hint}</span>
                      </button>
                    ))}
                    {slots.length > 0 && (
                      <button
                        onClick={() => onSlotsChange(dayIdx, [])}
                        className="ml-auto text-[11px] px-2.5 py-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <X size={10} />ล้าง
                      </button>
                    )}
                  </div>

                  {/* Slot inputs */}
                  <div className="flex flex-col gap-2">
                    {slots.map((slot, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={slot.start}
                          onChange={e => {
                            const next = [...slots]
                            next[i] = { ...slot, start: e.target.value }
                            onSlotsChange(dayIdx, next)
                          }}
                          className={slotInput}
                        />
                        <span className="text-muted-foreground text-xs">–</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={e => {
                            const next = [...slots]
                            next[i] = { ...slot, end: e.target.value }
                            onSlotsChange(dayIdx, next)
                          }}
                          className={slotInput}
                        />
                        <button
                          onClick={() => onSlotsChange(dayIdx, slots.filter((_, j) => j !== i))}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => onSlotsChange(dayIdx, [...slots, { start: clinicOpenTime, end: clinicCloseTime }])}
                    className="mt-2.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    <Plus size={12} />เพิ่มช่วงเวลา
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border bg-muted/20">
        <p className="text-xs text-muted-foreground">
          คลิก "แก้ไข" เพื่อตั้งเวลา · ☑ เลือกหลายวันเพื่อแก้ไขพร้อมกัน · "คัดลอก" เพื่อทำซ้ำไปวันอื่น
        </p>
      </div>
    </div>
  )
}

// ── Views ──────────────────────────────────────────────────────────────────

function DashboardView({ bookings, loading, error, onAction, actionLoading, date, onDateChange, onAddQueue, onRefresh }: {
  bookings: Booking[]
  loading: boolean
  error: Error | null
  onAction: (id: string, action: 'done' | 'cancelled') => void
  actionLoading: string | null
  date: string
  onDateChange: (d: string) => void
  onAddQueue: () => void
  onRefresh: () => void
}) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all')
  const [filterCoverage, setFilterCoverage] = useState<Coverage | 'all'>('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  const filtered = bookings.filter(b => {
    const matchSearch = b.patient_name.includes(search) || b.phone.includes(search) || b.id.includes(search)
    const matchStatus = filterStatus === 'all' || b.status === filterStatus
    const matchCov = filterCoverage === 'all' || b.coverage === filterCoverage
    return matchSearch && matchStatus && matchCov
  })

  useEffect(() => { setPage(1) }, [search, filterStatus, filterCoverage, date, bookings.length])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    reminded: bookings.filter(b => b.status === 'reminded').length,
    done: bookings.filter(b => b.status === 'done').length,
    pending: bookings.filter(b => b.status === 'pending_slip').length,
    noShow: bookings.filter(b => b.status === 'no_show').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  }

  const todayLabel = new Date(date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', calendar: 'buddhist' })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ตารางคิว</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{todayLabel} · อัปเดตแบบ Real-time</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DatePicker
            value={date}
            onChange={onDateChange}
            className="w-48"
          />
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw size={14} />รีเฟรช
          </button>
          <button
            onClick={onAddQueue}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus size={14} />เพิ่มคิว
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'ทั้งหมด', value: stats.total, accent: 'bg-green-100 text-green-700', icon: <CalendarDays size={16} /> },
          { label: 'ยืนยันแล้ว', value: stats.confirmed, accent: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={16} /> },
          { label: 'แจ้งเตือนแล้ว', value: stats.reminded, accent: 'bg-sky-100 text-sky-700', icon: <Bell size={16} /> },
          { label: 'เสร็จสิ้น', value: stats.done, accent: 'bg-slate-100 text-slate-500', icon: <BadgeCheck size={16} /> },
          { label: 'รอสลิป', value: stats.pending, accent: 'bg-yellow-100 text-yellow-600', icon: <Clock size={16} /> },
          { label: 'ไม่มา', value: stats.noShow, accent: 'bg-red-100 text-red-500', icon: <XCircle size={16} /> },
          { label: 'ยกเลิก', value: stats.cancelled, accent: 'bg-rose-100 text-rose-500', icon: <AlertCircle size={16} /> },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.accent}`}>{s.icon}</div>
            </div>
            <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, เบอร์, รหัสคิว..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as Status | 'all')}
              className="text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="all">สถานะทั้งหมด</option>
              <option value="pending_slip">รอสลิป</option>
              <option value="confirmed">ยืนยันแล้ว</option>
              <option value="reminded">แจ้งเตือนแล้ว</option>
              <option value="done">เสร็จสิ้น</option>
              <option value="no_show">ไม่มา</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
            <select
              value={filterCoverage}
              onChange={e => setFilterCoverage(e.target.value as Coverage | 'all')}
              className="text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="all">สิทธิ์ทั้งหมด</option>
              <option value="cash">เงินสด</option>
              <option value="sso">ประกันสังคม</option>
              <option value="universal">บัตรทอง</option>
            </select>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} รายการ</span>
        </div>

        {loading && <p className="p-5 text-sm text-muted-foreground">กำลังโหลด...</p>}
        {error && <p className="p-5 text-sm text-destructive">ข้อผิดพลาด: {error.message}</p>}

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-border">
          {!loading && filtered.length === 0 && (
            <p className="text-center py-12 text-muted-foreground text-sm">ไม่พบข้อมูลที่ค้นหา</p>
          )}
          {paginated.map(b => {
            const isTerminal = b.status === 'done' || b.status === 'cancelled' || b.status === 'no_show'
            return (
              <div key={b.id} className={`p-4 flex flex-col gap-2 ${isTerminal ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-foreground text-sm">{b.time}</span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="font-semibold text-foreground">{b.patient_name}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-mono">{b.phone}</span>
                  <CoverageBadge coverage={b.coverage} />
                  {b.deposit_amount > 0 && (
                    <span className="text-xs font-mono text-foreground">฿{b.deposit_amount.toLocaleString()}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{b.service_name}</p>
                {!isTerminal && (
                  <div className="flex gap-2 mt-1">
                    {(b.status === 'confirmed' || b.status === 'reminded') && (
                      <button
                        onClick={() => onAction(b.id, 'done')}
                        disabled={actionLoading !== null}
                        className="flex-1 text-xs font-semibold bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {actionLoading === b.id + 'done' ? '...' : 'เสร็จ'}
                      </button>
                    )}
                    <button
                      onClick={() => onAction(b.id, 'cancelled')}
                      disabled={actionLoading !== null}
                      className="flex-1 text-xs font-semibold bg-rose-600 text-white px-3 py-2 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {actionLoading === b.id + 'cancelled' ? '...' : 'ยกเลิก'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">เวลา</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">ชื่อผู้ป่วย</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">บริการ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">สิทธิ์</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">มัดจำ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">สถานะ</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-right">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(b => {
                const isTerminal = b.status === 'done' || b.status === 'cancelled' || b.status === 'no_show'
                return (
                  <tr
                    key={b.id}
                    className={`border-b border-border last:border-0 hover:bg-secondary/50 transition-colors ${isTerminal ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-sm font-medium text-foreground">{b.time}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-foreground">{b.patient_name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{b.phone}</p>
                    </td>
                    <td className="px-4 py-3.5 text-foreground">{b.service_name}</td>
                    <td className="px-4 py-3.5"><CoverageBadge coverage={b.coverage} /></td>
                    <td className="px-4 py-3.5">
                      {b.deposit_amount > 0
                        ? <span className="font-mono text-sm text-foreground">฿{b.deposit_amount.toLocaleString()}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3.5">
                      {!isTerminal && (
                        <div className="flex items-center justify-end gap-2">
                          {(b.status === 'confirmed' || b.status === 'reminded') && (
                            <button
                              onClick={() => onAction(b.id, 'done')}
                              disabled={actionLoading !== null}
                              className="text-xs font-semibold bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              {actionLoading === b.id + 'done' ? '...' : 'เสร็จ'}
                            </button>
                          )}
                          <button
                            onClick={() => onAction(b.id, 'cancelled')}
                            disabled={actionLoading !== null}
                            className="text-xs font-semibold bg-rose-600 text-white px-3 py-1.5 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            {actionLoading === b.id + 'cancelled' ? '...' : 'ยกเลิก'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                    ไม่พบข้อมูลที่ค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>
    </div>
  )
}

function QuotaView({ date }: { date: string }) {
  const [editing, setEditing] = useState(false)
  const [quotaValues, setQuotaValues] = useState<QuotaLimits>({ cash: 10, sso: 8, universal: 12 })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const loadQuota = async () => {
    if (!CLINIC_ID) return
    try {
      const data = await apiFetch<{ cash?: { limit: number }; sso?: { limit: number }; universal?: { limit: number } }>(
        `/quotas/${CLINIC_ID}/${date}`,
      )
      setQuotaValues({
        cash: data.cash?.limit ?? 10,
        sso: data.sso?.limit ?? 8,
        universal: data.universal?.limit ?? 12,
      })
    } catch { /* keep defaults */ }
  }

  const handleSave = async () => {
    if (!CLINIC_ID) return
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await setQuota(CLINIC_ID, date, quotaValues)
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>จัดการโควตา</h1>
        <p className="text-sm text-muted-foreground mt-0.5">ตั้งเพดานจำนวนคิวต่อสิทธิ์รายวัน</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            โควตาวันที่ {new Date(date + 'T12:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </h2>
          {!editing ? (
            <button onClick={() => { loadQuota(); setEditing(true) }} className="text-sm text-primary font-medium hover:underline cursor-pointer">แก้ไข</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">ยกเลิก</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm bg-primary text-primary-foreground font-medium px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={13} />{saving ? 'กำลังบันทึก...' : saved ? 'บันทึกแล้ว' : 'บันทึก'}
              </button>
            </div>
          )}
        </div>

        {!CLINIC_ID && (
          <p className="text-sm text-destructive mb-4">กรุณาระบุ VITE_CLINIC_ID ใน .env.local หรือเพิ่ม ?clinicId=xxx ใน URL</p>
        )}

        <div className="grid grid-cols-3 gap-4">
          {([
            { key: 'cash' as const, label: 'เงินสด', color: 'bg-blue-500', textColor: 'text-blue-600' },
            { key: 'sso' as const, label: 'ประกันสังคม', color: 'bg-violet-500', textColor: 'text-violet-600' },
            { key: 'universal' as const, label: 'บัตรทอง', color: 'bg-amber-500', textColor: 'text-amber-600' },
          ]).map(({ key, label, color, textColor }) => (
            <div key={key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className={`text-sm font-medium ${textColor}`}>{label}</span>
              </div>
              {editing ? (
                <input
                  type="number"
                  value={quotaValues[key]}
                  onChange={e => setQuotaValues(v => ({ ...v, [key]: Math.max(0, Number(e.target.value)) }))}
                  className="text-2xl font-bold bg-input-background border border-border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-ring/30"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  min={0} max={99}
                />
              ) : (
                <p className="text-3xl font-bold text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {quotaValues[key]}<span className="text-sm font-normal text-muted-foreground ml-1">คิว/วัน</span>
                </p>
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive mt-4">{error}</p>}
      </div>
    </div>
  )
}

// ── Doctors View ───────────────────────────────────────────────────────────

function DoctorsView({ clinicId }: { clinicId: string }) {
  const [doctorList, setDoctorList] = useState<ApiDoctor[]>([])
  const [schedules, setSchedules] = useState<Record<string, WeekSchedule>>({})
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null)
  const [showAddDoctor, setShowAddDoctor] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [shiftError, setShiftError] = useState('')
  const [editingDoctor, setEditingDoctor] = useState<ApiDoctor | null>(null)
  const [clinicOpenTime, setClinicOpenTime] = useState('08:00')
  const [clinicCloseTime, setClinicCloseTime] = useState('17:00')

  useEffect(() => {
    if (clinicId) {
      getClinicSettings(clinicId).then(s => {
        setClinicOpenTime(s.open_time || '08:00')
        setClinicCloseTime(s.close_time || '17:00')
      }).catch(() => {})
    }
  }, [clinicId])

  const loadDoctors = useCallback(() => {
    if (!clinicId) { setLoadingDoctors(false); return }
    setLoadingDoctors(true)
    fetchDoctors(clinicId)
      .then(docs => {
        setDoctorList(docs)
        const sm: Record<string, WeekSchedule> = {}
        for (const doc of docs) sm[doc.id] = apiShiftsToSchedule(doc.shifts)
        setSchedules(sm)
      })
      .catch(console.error)
      .finally(() => setLoadingDoctors(false))
  }, [clinicId])

  useEffect(() => { loadDoctors() }, [loadDoctors])

  function handleSlotsChange(day: number, slots: DaySlot[]) {
    if (!selectedDoctor) return
    setSchedules(prev => ({ ...prev, [selectedDoctor]: { ...prev[selectedDoctor], [day]: slots } }))
    setSaved(false)
  }

  async function handleSave() {
    if (!selectedDoctor) return
    setSaving(true)
    setShiftError('')
    try {
      await updateDoctorShifts(selectedDoctor, scheduleToApiShifts(schedules[selectedDoctor] ?? {}))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setShiftError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDoctor(doctorId: string) {
    try {
      await apiDeleteDoctor(doctorId)
      setDoctorList(prev => prev.filter(d => d.id !== doctorId))
      setSchedules(prev => { const n = { ...prev }; delete n[doctorId]; return n })
      if (selectedDoctor === doctorId) setSelectedDoctor(null)
    } catch (e) { console.error(e) }
    finally { setConfirmDelete(null) }
  }

  function handleDoctorCreated(newDoc: ApiDoctor) {
    setDoctorList(prev => [...prev, newDoc])
    setSchedules(prev => ({ ...prev, [newDoc.id]: {} }))
    setShowAddDoctor(false)
  }

  function handleDoctorUpdated(updated: ApiDoctor) {
    setDoctorList(prev => prev.map(d => d.id === updated.id ? updated : d))
    setEditingDoctor(null)
  }

  const selectedDoc = doctorList.find(d => d.id === selectedDoctor) ?? null

  return (
    <div className="flex flex-col gap-6">
      {showAddDoctor && (
        <AddDoctorModal clinicId={clinicId} onClose={() => setShowAddDoctor(false)} onCreated={handleDoctorCreated} />
      )}
      {editingDoctor && (
        <EditDoctorModal doctor={editingDoctor} onClose={() => setEditingDoctor(null)} onSaved={handleDoctorUpdated} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ตารางงานแพทย์</h1>
          <p className="text-sm text-muted-foreground mt-0.5">จัดการเวลาทำงานของแพทย์รายสัปดาห์</p>
        </div>
        <button
          onClick={() => setShowAddDoctor(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Plus size={14} />เพิ่มแพทย์
        </button>
      </div>

      {loadingDoctors ? (
        <p className="text-sm text-muted-foreground py-8 text-center">กำลังโหลดข้อมูลแพทย์...</p>
      ) : doctorList.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <Stethoscope size={32} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลแพทย์ กดปุ่ม "เพิ่มแพทย์" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <>
          {/* Doctor cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {doctorList.map(doc => (
              <DoctorCard
                key={doc.id}
                doctor={doc}
                schedule={schedules[doc.id] ?? {}}
                selected={selectedDoctor === doc.id}
                onSelect={() => setSelectedDoctor(selectedDoctor === doc.id ? null : doc.id)}
                onEdit={() => setEditingDoctor(doc)}
                confirmDelete={confirmDelete === doc.id}
                onDeleteRequest={() => setConfirmDelete(confirmDelete === doc.id ? null : doc.id)}
                onConfirmDelete={() => handleDeleteDoctor(doc.id)}
                onCancelDelete={() => setConfirmDelete(null)}
              />
            ))}
          </div>

          {/* Schedule editor — appears when a doctor is selected */}
          {selectedDoc ? (
            <ScheduleEditor
              doctor={selectedDoc}
              schedule={schedules[selectedDoc.id] ?? {}}
              onSlotsChange={handleSlotsChange}
              onSave={handleSave}
              saving={saving}
              saved={saved}
              error={shiftError}
              clinicOpenTime={clinicOpenTime}
              clinicCloseTime={clinicCloseTime}
            />
          ) : (
            <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
              <CalendarCheck2 size={28} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">เลือกแพทย์เพื่อแก้ไขตารางเวลา</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PatientsView({ bookings, onBookPatient }: {
  bookings: Booking[]
  onBookPatient: (patient: { patient_name: string; phone: string }) => void
}) {
  const [tab, setTab] = useState<'directory' | 'history'>('directory')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dirPage, setDirPage] = useState(1)
  const [histPage, setHistPage] = useState(1)
  const PAGE_SIZE = 20

  // Debounce search for server-side calls
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset pages on tab/search change
  useEffect(() => { setDirPage(1) }, [search, tab])
  useEffect(() => { setHistPage(1) }, [debouncedSearch, tab])

  // ── History tab: server-side paginated ───────────────────────────────────
  const [histItems, setHistItems] = useState<Booking[]>([])
  const [histTotal, setHistTotal] = useState(0)
  const [histLoading, setHistLoading] = useState(false)

  useEffect(() => {
    if (tab !== 'history') return
    setHistLoading(true)
    fetchBookingHistory<Booking>(CLINIC_ID, histPage, PAGE_SIZE, debouncedSearch)
      .then(({ items, total }) => { setHistItems(items); setHistTotal(total) })
      .catch(console.error)
      .finally(() => setHistLoading(false))
  }, [tab, histPage, debouncedSearch])

  // ── Tab 1: unique patient directory (client-side) ─────────────────────────
  const uniquePatients = bookings.reduce((acc, b) => {
    if (!acc.find(p => p.phone === b.phone)) acc.push(b)
    return acc
  }, [] as Booking[])
  const filteredDir = uniquePatients.filter(
    p => p.patient_name.includes(search) || p.phone.includes(search),
  )
  const paginatedDir = filteredDir.slice((dirPage - 1) * PAGE_SIZE, dirPage * PAGE_SIZE)

  const tabBtn = (id: 'directory' | 'history', label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
        tab === id
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ข้อมูลผู้ป่วย</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ผู้ป่วยที่ลงทะเบียนผ่าน LINE OA ทั้งหมด</p>
        </div>
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
          {tabBtn('directory', `รายชื่อผู้ป่วย (${uniquePatients.length})`)}
          {tabBtn('history', `ประวัติการนัด${histTotal > 0 ? ` (${histTotal})` : ''}`)}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือเบอร์โทร..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        {tab === 'directory' ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">ชื่อ-นามสกุล</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">เบอร์โทร</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">สิทธิ์</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">บริการล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDir.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => onBookPatient({ patient_name: p.patient_name, phone: p.phone })}
                    className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                          {p.patient_name[0]}
                        </div>
                        <span className="font-medium text-foreground">{p.patient_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-sm text-muted-foreground">{p.phone}</td>
                    <td className="px-4 py-3.5"><CoverageBadge coverage={p.coverage} /></td>
                    <td className="px-4 py-3.5 text-muted-foreground text-sm">{p.service_name}</td>
                  </tr>
                ))}
                {filteredDir.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-12 text-muted-foreground text-sm">ไม่พบข้อมูล</td></tr>
                )}
              </tbody>
            </table>
            <Pagination page={dirPage} total={filteredDir.length} pageSize={PAGE_SIZE} onChange={setDirPage} />
          </>
        ) : histLoading ? (
          <p className="text-center py-12 text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">วันที่</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">เวลา</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">ชื่อ-นามสกุล</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">บริการ</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">สิทธิ์</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {histItems.map(b => (
                  <tr
                    key={b.id}
                    onClick={() => onBookPatient({ patient_name: b.patient_name, phone: b.phone })}
                    className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 text-sm text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(b.date + 'T12:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-sm font-medium text-foreground">{b.time}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-foreground">{b.patient_name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{b.phone}</p>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{b.service_name}</td>
                    <td className="px-4 py-3.5"><CoverageBadge coverage={b.coverage} /></td>
                    <td className="px-4 py-3.5"><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
                {histTotal === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">ไม่พบข้อมูล</td></tr>
                )}
              </tbody>
            </table>
            <Pagination page={histPage} total={histTotal} pageSize={PAGE_SIZE} onChange={setHistPage} />
          </>
        )}
      </div>
    </div>
  )
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const RANGE_DAYS = 14

function AppointmentsView({ clinicId }: { clinicId: string }) {
  const [rangeStart, setRangeStart] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState<AppointmentBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const rangeEnd = addDays(rangeStart, RANGE_DAYS - 1)

  const load = useCallback(() => {
    if (!clinicId) { setLoading(false); return }
    setLoading(true)
    fetchAppointmentsRange(clinicId, rangeStart, rangeEnd)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clinicId, rangeStart, rangeEnd])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(
    b => b.patient_name.includes(search) || b.phone.includes(search),
  )

  const grouped = filtered.reduce((acc, b) => {
    (acc[b.date] ??= []).push(b)
    return acc
  }, {} as Record<string, AppointmentBooking[]>)
  const dates = Object.keys(grouped).sort()

  const rangeLabel = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', calendar: 'buddhist' })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>การนัดหมาย</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rangeLabel(rangeStart)} – {rangeLabel(rangeEnd)} · ภาพรวมนัดหมายล่วงหน้า {RANGE_DAYS} วัน
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือเบอร์โทร..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <button
            onClick={() => setRangeStart(addDays(rangeStart, -RANGE_DAYS))}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2"
          >
            <ChevronLeft size={14} />ก่อนหน้า
          </button>
          <button
            onClick={() => setRangeStart(new Date().toISOString().split('T')[0])}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2"
          >
            วันนี้
          </button>
          <button
            onClick={() => setRangeStart(addDays(rangeStart, RANGE_DAYS))}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2"
          >
            ถัดไป<ChevronRight size={14} />
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground py-8 text-center">กำลังโหลด...</p>
      )}
      {!loading && dates.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <CalendarDays size={32} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">ไม่มีนัดหมายในช่วงนี้</p>
        </div>
      )}
      {!loading && dates.map(d => (
        <div key={d} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', calendar: 'buddhist' })}
            </span>
            <span className="text-xs text-muted-foreground">{grouped[d].length} คิว</span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {grouped[d].map(b => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-muted-foreground w-20">{b.time}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{b.patient_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{b.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{b.service_name}</td>
                  <td className="px-4 py-3"><CoverageBadge coverage={b.coverage} /></td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

const INTERVAL_PRESETS: { value: '7' | '14' | '30' | 'custom'; label: string }[] = [
  { value: '7', label: 'ทุกสัปดาห์ (7 วัน)' },
  { value: '14', label: 'ทุก 2 สัปดาห์ (14 วัน)' },
  { value: '30', label: 'ทุกเดือน (30 วัน)' },
  { value: 'custom', label: 'กำหนดเอง' },
]

function AddBookingReminderModal({
  clinicId,
  patients,
  onClose,
  onCreated,
}: {
  clinicId: string
  patients: LinePatient[]
  onClose: () => void
  onCreated: (reminder: BookingReminder) => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [intervalPreset, setIntervalPreset] = useState<'7' | '14' | '30' | 'custom'>('30')
  const [customDays, setCustomDays] = useState(30)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const intervalDays = intervalPreset === 'custom' ? customDays : Number(intervalPreset)
  const selected = patients.find(p => p.patient_line_id === selectedId)
  const isValid = !!selected && intervalDays > 0 && startDate.length > 0

  const handleSubmit = async () => {
    if (!isValid || !selected) return
    setSubmitting(true)
    setError('')
    try {
      const reminder = await createBookingReminder({
        patient_line_id: selected.patient_line_id,
        patient_name: selected.patient_name,
        patient_phone: selected.phone,
        interval_days: intervalDays,
        start_date: startDate,
        clinic_id: clinicId,
      })
      onCreated(reminder)
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  const field = 'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/30'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>เพิ่มการแจ้งเตือน</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ผู้ป่วย (ต้องเคยทักไลน์ OA มาก่อน) <span className="text-destructive">*</span></label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={field}>
              <option value="">เลือกผู้ป่วย</option>
              {patients.map(p => (
                <option key={p.patient_line_id} value={p.patient_line_id}>{p.patient_name} ({p.phone})</option>
              ))}
            </select>
            {patients.length === 0 && (
              <p className="text-[11px] text-muted-foreground">ยังไม่มีผู้ป่วยที่ทักไลน์ OA เข้ามา — ต้องมีบัญชี LINE ถึงจะส่งแจ้งเตือนได้</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">วันแจ้งเตือนครั้งแรก <span className="text-destructive">*</span></label>
            <DatePicker value={startDate} onChange={setStartDate} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ความถี่ <span className="text-destructive">*</span></label>
            <select
              value={intervalPreset}
              onChange={e => setIntervalPreset(e.target.value as typeof intervalPreset)}
              className={field}
            >
              {INTERVAL_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {intervalPreset === 'custom' && (
              <input
                type="number" min={1} value={customDays}
                onChange={e => setCustomDays(Number(e.target.value))}
                placeholder="จำนวนวัน"
                className={`${field} font-mono mt-1.5`}
              />
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Plus size={14} />
            {submitting ? 'กำลังเพิ่ม...' : 'เพิ่มการแจ้งเตือน'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BookingRemindersView({ clinicId }: { clinicId: string }) {
  const [reminders, setReminders] = useState<BookingReminder[]>([])
  const [patients, setPatients] = useState<LinePatient[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editInterval, setEditInterval] = useState(0)

  const load = useCallback(() => {
    if (!clinicId) { setLoading(false); return }
    setLoading(true)
    Promise.all([fetchBookingReminders(clinicId), fetchLinePatients(clinicId)])
      .then(([r, p]) => { setReminders(r); setPatients(p) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clinicId])

  useEffect(() => { load() }, [load])

  function startEdit(reminder: BookingReminder) {
    setEditingId(reminder.id)
    setEditInterval(reminder.interval_days)
  }

  async function saveEdit(reminder: BookingReminder) {
    await updateBookingReminder(reminder.id, { interval_days: editInterval })
    setEditingId(null)
    load()
  }

  async function toggleStatus(reminder: BookingReminder) {
    await updateBookingReminder(reminder.id, { status: reminder.status === 'active' ? 'stopped' : 'active' })
    load()
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col gap-6">
      {showAdd && (
        <AddBookingReminderModal
          clinicId={clinicId}
          patients={patients}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load() }}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>แจ้งเตือนนัดหมาย</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ส่งข้อความ LINE เตือนคนไข้ให้กลับมาจองคิวตรวจติดตามผลตามรอบที่กำหนด</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />เพิ่มการแจ้งเตือน
        </button>
      </div>

      {loading && <p className="text-sm text-muted-foreground py-8 text-center">กำลังโหลด...</p>}
      {!loading && reminders.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <ClipboardList size={32} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน กดปุ่ม "เพิ่มการแจ้งเตือน" เพื่อเริ่มต้น</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {reminders.map(r => {
          const overdue = r.status === 'active' && r.next_reminder_date <= todayStr
          const isEditing = editingId === r.id
          return (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{r.patient_name}</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-foreground/5 text-muted-foreground'}`}>
                      {r.status === 'active' ? 'กำลังแจ้งเตือน' : 'หยุดแล้ว'}
                    </span>
                    {overdue && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700 flex items-center gap-1">
                        <AlertTriangle size={10} />ถึงกำหนดแล้ว
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{r.patient_phone}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span>ทุก {r.interval_days} วัน</span>
                    {r.status === 'active' && (
                      <span>
                        · นัดครั้งถัดไป: {new Date(r.next_reminder_date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', calendar: 'buddhist' })}
                      </span>
                    )}
                    {r.last_reminded_at && (
                      <span>
                        · ส่งล่าสุด: {new Date(r.last_reminded_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', calendar: 'buddhist' })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(r)}
                    className="flex items-center gap-1.5 border border-border text-foreground text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-foreground/5 transition-colors"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => toggleStatus(r)}
                    className={`flex items-center gap-1.5 border text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      r.status === 'active'
                        ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                        : 'border-border text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    {r.status === 'active' ? 'หยุด' : 'เปิดใช้งาน'}
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="mt-3 pt-3 border-t border-border flex items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">ความถี่ (วัน)</label>
                    <input
                      type="number" min={1} value={editInterval}
                      onChange={e => setEditInterval(Number(e.target.value))}
                      className="text-sm bg-input-background border border-border rounded-lg px-3 py-2 font-mono w-32"
                    />
                  </div>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => saveEdit(r)}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Save size={12} />บันทึก
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LineOAConnectSection() {
  const fieldFull =
    'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30'
  const [s, setS] = useState<LineOASettings | null>(null)
  const [secret, setSecret] = useState('')
  const [token, setToken] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState<null | 'connect' | 'webhook' | 'richmenu' | 'delrich'>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    getLineSettings(CLINIC_ID)
      .then(res => {
        setS(res)
        if (res.webhook_url) setWebhookUrl(res.webhook_url)
      })
      .catch(() => { /* not fatal — section still usable */ })
  }, [])

  async function run(
    key: 'connect' | 'webhook' | 'richmenu' | 'delrich',
    fn: () => Promise<LineOASettings>,
    okMsg: string,
  ) {
    setLoading(key)
    setError('')
    setNotice('')
    try {
      const res = await fn()
      setS(res)
      setNotice(okMsg)
      if (key === 'connect') { setSecret(''); setToken('') }
      if (res.webhook_url) setWebhookUrl(res.webhook_url)
    } catch (err) {
      setError((err as Error).message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(null)
    }
  }

  const connected = !!s?.connected
  const chip = (text: string, on: boolean) => (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${on ? 'bg-primary/10 text-primary' : 'bg-foreground/5 text-muted-foreground'}`}>
      {text}
    </span>
  )

  return (
    <SettingsSection title="เชื่อมต่อ LINE OA" icon={<MessageCircle size={16} />}>
      <div className="pt-2 flex flex-col gap-4">
        {connected && (
          <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary rounded-lg px-3 py-2">
            <CheckCircle2 size={16} />
            <span>เชื่อมต่อแล้ว: <b>{s?.bot?.displayName || 'LINE OA'}</b></span>
          </div>
        )}

        {/* Credentials */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
            Channel Secret <span className="font-normal">(Line Secret ID)</span>
          </label>
          <input
            type="password" value={secret} onChange={e => setSecret(e.target.value)}
            placeholder={s?.has_credentials ? '•••••••• (บันทึกไว้แล้ว)' : 'LINE channel secret'}
            className={`${fieldFull} font-mono`}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
            Channel Access Token <span className="font-normal">(Line Token ID)</span>
          </label>
          <input
            type="password" value={token} onChange={e => setToken(e.target.value)}
            placeholder={s?.has_credentials ? s.masked_token || '•••••••• (บันทึกไว้แล้ว)' : 'LINE channel access token'}
            className={`${fieldFull} font-mono`}
          />
        </div>
        <div>
          <button
            onClick={() => run('connect', () => saveLineCredentials(CLINIC_ID, secret, token), 'เชื่อมต่อสำเร็จ')}
            disabled={loading === 'connect' || (!secret && !token)}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm cursor-pointer"
          >
            {loading === 'connect' ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            บันทึกและเชื่อมต่อ
          </button>
        </div>

        {/* Webhook — revealed after connecting */}
        {connected && (
          <div className="border-t border-border pt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Link2 size={15} className="text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">Webhook</h4>
              {chip(s?.webhook_active ? 'ใช้งานอยู่' : 'ยังไม่ได้ตั้งค่า', !!s?.webhook_active)}
            </div>
            <div>
              <input
                type="text" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://your-backend/webhook"
                className={`${fieldFull} font-mono`}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                ต้องเป็น URL สาธารณะแบบ HTTPS (เช่น ngrok หรือ Cloud Run) และลงท้ายด้วย <code>/webhook</code>
              </p>
            </div>
            <div>
              <button
                onClick={() => run('webhook', () => enableWebhook(CLINIC_ID, webhookUrl.trim()), 'ตั้งค่า Webhook สำเร็จ')}
                disabled={loading === 'webhook' || !webhookUrl.trim()}
                className="flex items-center gap-2 border border-border text-foreground font-medium px-4 py-2 rounded-lg hover:bg-foreground/5 disabled:opacity-50 transition-colors text-sm cursor-pointer"
              >
                {loading === 'webhook' ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                ใช้ webhook
              </button>
            </div>
          </div>
        )}

        {/* Rich menu — special feature */}
        {connected && (
          <div className="border-t border-border pt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <LayoutGrid size={15} className="text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">Rich Menu</h4>
              {chip('ฟีเจอร์พิเศษ', true)}
              {s?.rich_menu_id ? chip('สร้างแล้ว', true) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              สร้างเมนูลัดอัตโนมัติใน LINE OA: จองคิว · คิวของฉัน · ติดต่อคลินิก
            </p>
            {s?.rich_menu_id && (
              <p className="font-mono text-[11px] text-muted-foreground break-all">ID: {s.rich_menu_id}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => run('richmenu', () => setupRichMenu(CLINIC_ID), 'ตั้งค่า Rich Menu สำเร็จ')}
                disabled={loading === 'richmenu'}
                className="flex items-center gap-2 border border-border text-foreground font-medium px-4 py-2 rounded-lg hover:bg-foreground/5 disabled:opacity-50 transition-colors text-sm cursor-pointer"
              >
                {loading === 'richmenu' ? <Loader2 size={14} className="animate-spin" /> : <LayoutGrid size={14} />}
                {s?.rich_menu_id ? 'สร้างใหม่' : 'ตั้งค่า Rich Menu'}
              </button>
              {s?.rich_menu_id && (
                <button
                  onClick={() => run('delrich', () => deleteRichMenu(CLINIC_ID), 'ลบ Rich Menu แล้ว')}
                  disabled={loading === 'delrich'}
                  className="flex items-center gap-2 border border-destructive/30 text-destructive font-medium px-4 py-2 rounded-lg hover:bg-destructive/10 disabled:opacity-50 transition-colors text-sm cursor-pointer"
                >
                  {loading === 'delrich' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  ลบ
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>
        )}
        {notice && !error && <p className="text-sm text-primary">{notice}</p>}
      </div>
    </SettingsSection>
  )
}

function ChatView({ clinicId }: { clinicId: string }) {
  const { data: conversations, loading: listLoading } = useChatConversations(clinicId)
  const [selected, setSelected] = useState<string | null>(null)
  const { data: messages, loading: msgLoading, refetch } = useChatMessages(selected)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [actionLoading, setActionLoading] = useState<null | 'resolve' | 'handback'>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!selected && conversations.length > 0) setSelected(conversations[0].line_user_id)
  }, [conversations, selected])

  const selectedConvo = conversations.find(c => c.line_user_id === selected) || null

  async function handleSend() {
    const text = draft.trim()
    if (!text || !selected) return
    setSending(true)
    setError('')
    try {
      await sendChatMessage(selected, text)
      setDraft('')
      await refetch()
    } catch (err) {
      setError((err as Error).message || 'ส่งข้อความไม่สำเร็จ')
    } finally {
      setSending(false)
    }
  }

  async function handleResolve() {
    if (!selected) return
    setActionLoading('resolve')
    try {
      await resolveChat(selected)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleHandback() {
    if (!selected) return
    setActionLoading('handback')
    try {
      await setChatMode(selected, 'ai')
    } finally {
      setActionLoading(null)
    }
  }

  function bubbleStyle(sender: ChatMessage['sender']) {
    if (sender === 'patient') return 'bg-muted text-foreground self-start'
    if (sender === 'admin') return 'bg-primary text-primary-foreground self-end'
    return 'bg-sky-50 text-sky-900 border border-sky-200 self-end'
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>แชท LINE OA</h1>
        <p className="text-sm text-muted-foreground mt-0.5">AI ตอบอัตโนมัติ — แอดมินสามารถเข้าคุมการสนทนาได้ทุกเมื่อ</p>
      </div>

      <div
        className="flex-1 flex min-h-0 bg-card border border-border rounded-xl overflow-hidden"
        style={{ height: 'calc(100vh - 220px)' }}
      >
        {/* Conversation list */}
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto">
          {listLoading && conversations.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">กำลังโหลด...</p>
          )}
          {!listLoading && conversations.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">ยังไม่มีการสนทนา</p>
          )}
          {conversations.map(c => (
            <button
              key={c.line_user_id}
              onClick={() => setSelected(c.line_user_id)}
              className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                selected === c.line_user_id ? 'bg-secondary' : 'hover:bg-secondary/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-foreground truncate">
                  {c.display_name || c.line_user_id}
                </span>
                {c.unread_count > 0 && (
                  <span className="text-[10px] bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                    {c.unread_count}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message_preview}</p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${c.mode === 'admin' ? 'bg-primary/10 text-primary' : 'bg-sky-50 text-sky-700'}`}>
                  {c.mode === 'admin' ? 'แอดมิน' : 'AI'}
                </span>
                {c.status === 'resolved' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-foreground/5 text-muted-foreground">ปิดแล้ว</span>
                )}
                {c.needs_attention && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-yellow-50 text-yellow-700 flex items-center gap-0.5">
                    <AlertTriangle size={9} />ต้องการเจ้าหน้าที่
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedConvo ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              เลือกการสนทนาทางซ้ายเพื่อดูข้อความ
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <p className="font-semibold text-sm text-foreground">{selectedConvo.display_name || selectedConvo.line_user_id}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedConvo.mode === 'admin' ? 'แอดมินกำลังตอบ' : 'AI กำลังตอบอัตโนมัติ'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedConvo.mode === 'admin' && (
                    <button
                      onClick={handleHandback}
                      disabled={actionLoading === 'handback'}
                      className="flex items-center gap-1.5 border border-border text-foreground text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-foreground/5 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === 'handback' ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                      คืนให้ AI
                    </button>
                  )}
                  {selectedConvo.status !== 'resolved' && (
                    <button
                      onClick={handleResolve}
                      disabled={actionLoading === 'resolve'}
                      className="flex items-center gap-1.5 border border-border text-foreground text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-foreground/5 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === 'resolve' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      ปิดการสนทนา
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
                {msgLoading && messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
                )}
                {messages.map(m => (
                  <div key={m.id} className={`max-w-[75%] rounded-xl px-3 py-2 text-sm flex flex-col ${bubbleStyle(m.sender)}`}>
                    {m.sender !== 'patient' && (
                      <span className="text-[10px] opacity-70 font-medium mb-0.5">
                        {m.sender === 'admin' ? 'แอดมิน' : 'AI'}
                      </span>
                    )}
                    <span className="whitespace-pre-wrap">{m.text}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border p-3 flex flex-col gap-2">
                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1.5"><AlertCircle size={12} />{error}</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !sending) handleSend() }}
                    placeholder="พิมพ์ข้อความตอบกลับ..."
                    className="flex-1 text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    ส่ง
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">การส่งข้อความจะเปลี่ยนโหมดเป็น "แอดมิน" ทันที</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ClinicInfoSection() {
  const fieldFull =
    'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30'
  const timeInput =
    'text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 font-mono'
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [openTime, setOpenTime] = useState('08:00')
  const [closeTime, setCloseTime] = useState('17:00')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    getClinicSettings(CLINIC_ID)
      .then(s => {
        setName(s.name)
        setAddress(s.address)
        setPhone(s.phone)
        setOpenTime(s.open_time || '08:00')
        setCloseTime(s.close_time || '17:00')
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (openTime >= closeTime) {
      setError('เวลาเปิดต้องน้อยกว่าเวลาปิด')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await updateClinicSettings(CLINIC_ID, { name, address, phone, open_time: openTime, close_time: closeTime })
      setNotice('บันทึกแล้ว')
    } catch (e) {
      setError((e as Error).message || 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection title="ข้อมูลคลินิก" icon={<MapPin size={16} />}>
      <div className="pt-2 flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">ชื่อคลินิก</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className={fieldFull} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">ที่อยู่</label>
              <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className={fieldFull} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">เบอร์โทรคลินิก</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={`${fieldFull} font-mono`} />
            </div>

            {/* Opening hours */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">เวลาทำการ</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Clock3 size={14} className="text-muted-foreground shrink-0" />
                  <input
                    type="time"
                    value={openTime}
                    onChange={e => setOpenTime(e.target.value)}
                    className={timeInput}
                  />
                </div>
                <span className="text-sm text-muted-foreground">ถึง</span>
                <input
                  type="time"
                  value={closeTime}
                  onChange={e => setCloseTime(e.target.value)}
                  className={timeInput}
                />
              </div>
              {openTime >= closeTime && openTime && closeTime && (
                <p className="text-xs text-destructive mt-1.5">เวลาเปิดต้องน้อยกว่าเวลาปิด</p>
              )}
            </div>

            <div>
              <button
                onClick={handleSave}
                disabled={saving || (openTime >= closeTime && Boolean(openTime && closeTime))}
                className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                บันทึก
              </button>
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>
            )}
            {notice && !error && <p className="text-sm text-primary">{notice}</p>}
          </>
        )}
      </div>
    </SettingsSection>
  )
}

function AddEditServiceModal({
  service,
  onClose,
  onSaved,
}: {
  service?: ServiceItem
  onClose: () => void
  onSaved: (service: ServiceItem) => void
}) {
  const [form, setForm] = useState<ServiceCreate>({
    name: service?.name ?? '',
    duration_min: service?.duration_min ?? 30,
    deposit_amount: service?.deposit_amount ?? 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isValid = form.name.trim().length > 0 && form.duration_min > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError('')
    try {
      if (service) {
        await updateService(service.id, form)
        onSaved({ ...service, ...form })
      } else {
        const created = await createService(CLINIC_ID, form)
        onSaved(created)
      }
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  const field = 'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/30'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {service ? 'แก้ไขบริการ' : 'เพิ่มบริการใหม่'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ชื่อบริการ <span className="text-destructive">*</span></label>
            <input
              type="text"
              placeholder="เช่น ตรวจสุขภาพทั่วไป"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">ระยะเวลา (นาที) <span className="text-destructive">*</span></label>
              <input
                type="number"
                min={5}
                value={form.duration_min}
                onChange={e => setForm(f => ({ ...f, duration_min: Number(e.target.value) }))}
                className={`${field} font-mono`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">มัดจำ (บาท)</label>
              <input
                type="number"
                min={0}
                value={form.deposit_amount}
                onChange={e => setForm(f => ({ ...f, deposit_amount: Number(e.target.value) }))}
                className={`${field} font-mono`}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm cursor-pointer"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}

function ServicesSection() {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingService, setEditingService] = useState<ServiceItem | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadServices = useCallback(() => {
    setLoading(true)
    fetchAdminServices(CLINIC_ID)
      .then(setServices)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadServices() }, [loadServices])

  const handleDelete = async (serviceId: string) => {
    try {
      await deleteService(serviceId)
      setServices(prev => prev.filter(s => s.id !== serviceId))
    } catch (e) {
      console.error(e)
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <SettingsSection title="บริการ" icon={<Package size={16} />}>
      {showAdd && (
        <AddEditServiceModal
          onClose={() => setShowAdd(false)}
          onSaved={created => { setServices(prev => [...prev, created]); setShowAdd(false) }}
        />
      )}
      {editingService && (
        <AddEditServiceModal
          service={editingService}
          onClose={() => setEditingService(null)}
          onSaved={updated => {
            setServices(prev => prev.map(s => s.id === updated.id ? updated : s))
            setEditingService(null)
          }}
        />
      )}

      <div className="pt-2 flex flex-col gap-3">
        <div className="flex justify-end">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus size={14} />เพิ่มบริการ
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">กำลังโหลด...</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">ยังไม่มีบริการ กดปุ่ม "เพิ่มบริการ" เพื่อเริ่มต้น</p>
        ) : (
          services.map(s => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.duration_min} นาที · มัดจำ ฿{s.deposit_amount.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {confirmDelete === s.id ? (
                  <>
                    <span className="text-xs text-muted-foreground mr-1">ลบบริการนี้?</span>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-xs font-medium text-destructive hover:bg-destructive/10 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      ยืนยัน
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-xs text-muted-foreground hover:bg-muted px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditingService(s)}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors cursor-pointer"
                      title="แก้ไข"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(s.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded-lg transition-colors cursor-pointer"
                      title="ลบ"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </SettingsSection>
  )
}

function ClinicSettingsView() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ตั้งค่าคลินิก</h1>
        <p className="text-sm text-muted-foreground mt-0.5">ข้อมูลคลินิกและบริการที่เปิดให้บริการ</p>
      </div>

      <ClinicInfoSection />

      <ServicesSection />
    </div>
  )
}

function SettingsView() {
  const [ssoEnabled, setSsoEnabled] = useState(true)
  const [ssoDepositRequired, setSsoDepositRequired] = useState(true)
  const [ssoDeposit, setSsoDeposit] = useState('200')
  const [univEnabled, setUnivEnabled] = useState(true)
  const [univDepositRequired, setUnivDepositRequired] = useState(false)
  const [univDeposit, setUnivDeposit] = useState('0')
  const [univRequireIdCard, setUnivRequireIdCard] = useState(true)
  const [cashDepositRequired, setCashDepositRequired] = useState(true)
  const [cashDeposit, setCashDeposit] = useState('300')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderTime, setReminderTime] = useState('18:00')
  const [reminderDaysBefore, setReminderDaysBefore] = useState('1')
  const [cancelTtl, setCancelTtl] = useState('15')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ตั้งค่าระบบ</h1>
        <p className="text-sm text-muted-foreground mt-0.5">จัดการสิทธิ์การรักษา, มัดจำ และการแจ้งเตือน</p>
      </div>

      <LineOAConnectSection />

      <SettingsSection title="ประกันสังคม (SSO)" icon={<ShieldCheck size={16} />}>
        <div className="pt-2">
          <SettingsRow label="เปิดรับสิทธิ์ประกันสังคม" hint="อนุญาตให้ผู้ป่วยสิทธิ์ประกันสังคมจองคิวได้">
            <Toggle checked={ssoEnabled} onChange={setSsoEnabled} />
          </SettingsRow>
          <SettingsRow label="เก็บมัดจำ" hint="กำหนดให้ผู้ป่วยประกันสังคมต้องชำระมัดจำก่อนยืนยัน">
            <Toggle checked={ssoDepositRequired} onChange={setSsoDepositRequired} />
          </SettingsRow>
          {ssoDepositRequired && (
            <SettingsRow label="จำนวนมัดจำ (บาท)" hint="ยอดที่ต้องโอนเพื่อล็อกคิว">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">฿</span>
                <input type="number" value={ssoDeposit} onChange={e => setSsoDeposit(e.target.value)} min={0}
                  className="w-24 text-sm font-mono bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 text-right" />
              </div>
            </SettingsRow>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="บัตรทอง (Universal Coverage)" icon={<CreditCard size={16} />}>
        <div className="pt-2">
          <SettingsRow label="เปิดรับสิทธิ์บัตรทอง" hint="อนุญาตให้ผู้ป่วยสิทธิ์บัตรทองจองคิวได้">
            <Toggle checked={univEnabled} onChange={setUnivEnabled} />
          </SettingsRow>
          <SettingsRow label="เก็บมัดจำ" hint="บัตรทองปกติไม่เก็บมัดจำ แต่สามารถเปิดใช้ได้">
            <Toggle checked={univDepositRequired} onChange={setUnivDepositRequired} />
          </SettingsRow>
          {univDepositRequired && (
            <SettingsRow label="จำนวนมัดจำ (บาท)">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">฿</span>
                <input type="number" value={univDeposit} onChange={e => setUnivDeposit(e.target.value)} min={0}
                  className="w-24 text-sm font-mono bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 text-right" />
              </div>
            </SettingsRow>
          )}
          <SettingsRow label="กำหนดให้แนบบัตรประชาชน" hint="ขอภาพบัตรประชาชนเพื่อยืนยันสิทธิ์">
            <Toggle checked={univRequireIdCard} onChange={setUnivRequireIdCard} />
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection title="เงินสด (Cash)" icon={<FileText size={16} />}>
        <div className="pt-2">
          <SettingsRow label="เก็บมัดจำ" hint="กำหนดมัดจำสำหรับผู้ป่วยชำระเงินสด">
            <Toggle checked={cashDepositRequired} onChange={setCashDepositRequired} />
          </SettingsRow>
          {cashDepositRequired && (
            <SettingsRow label="จำนวนมัดจำ (บาท)">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">฿</span>
                <input type="number" value={cashDeposit} onChange={e => setCashDeposit(e.target.value)} min={0}
                  className="w-24 text-sm font-mono bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 text-right" />
              </div>
            </SettingsRow>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="อื่นๆ" icon={<Settings2 size={16} />}>
        <div className="pt-2">
          <SettingsRow label="แจ้งเตือนผู้ป่วยล่วงหน้า" hint="ส่ง LINE ข้อความเตือนก่อนวันนัด">
            <Toggle checked={reminderEnabled} onChange={setReminderEnabled} />
          </SettingsRow>
          {reminderEnabled && (
            <>
              <SettingsRow label="เวลาส่งแจ้งเตือน" hint="เวลาที่ระบบจะส่งข้อความเตือนทุกวัน">
                <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                  className="text-sm font-mono bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </SettingsRow>
              <SettingsRow label="แจ้งเตือนล่วงหน้า (วัน)">
                <select value={reminderDaysBefore} onChange={e => setReminderDaysBefore(e.target.value)}
                  className="text-sm bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30">
                  <option value="1">1 วันก่อน</option>
                  <option value="2">2 วันก่อน</option>
                  <option value="3">3 วันก่อน</option>
                </select>
              </SettingsRow>
            </>
          )}
          <SettingsRow label="ยกเลิกคิวอัตโนมัติ (นาที)" hint="ยกเลิกคิวที่ค้างสถานะ 'รอสลิป' เกินเวลาที่กำหนด">
            <div className="flex items-center gap-1.5">
              <input type="number" value={cancelTtl} onChange={e => setCancelTtl(e.target.value)} min={5} max={60}
                className="w-20 text-sm font-mono bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 text-right" />
              <span className="text-sm text-muted-foreground">นาที</span>
            </div>
          </SettingsRow>
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <button className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm cursor-pointer">
          <Save size={14} />บันทึกการตั้งค่าทั้งหมด
        </button>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading: authLoading, logout, onLogin } = useAuth()
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [addQueueModal, setAddQueueModal] = useState<{ prefill?: { patient_name: string; phone: string } } | null>(null)

  const constraints = useMemo(() => ({ date, clinicId: CLINIC_ID }), [date])

  const { data: bookings, loading: bLoading, error, refetch } = useBookings<Booking>(constraints)

  if (authLoading) return <FullPage>กำลังโหลด...</FullPage>
  if (!user) return <AdminLogin onLogin={(u) => { onLogin(u); refetch() }} />

  async function handleAction(bookingId: string, action: 'done' | 'cancelled') {
    setActionLoading(bookingId + action)
    try {
      await updateBookingStatus(bookingId, action)
      refetch()
    } finally {
      setActionLoading(null)
    }
  }

  const pendingCount = bookings.filter(b => b.status === 'pending_slip').length
  const confirmedCount = bookings.filter(b => b.status === 'confirmed' || b.status === 'reminded').length
  const remindedCount = bookings.filter(b => b.status === 'reminded').length

  const navItems: { id: NavItem; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'ภาพรวมคิว', icon: <LayoutDashboard size={16} /> },
    { id: 'appointments', label: 'การนัดหมาย', icon: <CalendarDays size={16} /> },
    { id: 'doctors', label: 'ตารางแพทย์', icon: <Stethoscope size={16} /> },
    { id: 'quota', label: 'จัดการโควตา', icon: <Settings2 size={16} /> },
    { id: 'patients', label: 'ผู้ป่วย', icon: <Users size={16} /> },
    { id: 'bookingReminders', label: 'แจ้งเตือนนัดหมาย', icon: <ClipboardList size={16} /> },
    { id: 'chat', label: 'แชท', icon: <MessageCircle size={16} /> },
    { id: 'clinicSettings', label: 'ตั้งค่าคลินิก', icon: <MapPin size={16} /> },
    { id: 'settings', label: 'ตั้งค่าระบบ', icon: <ShieldCheck size={16} /> },
  ]

  return (
    <div className="min-h-screen bg-background flex" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Add Queue Modal */}
      {addQueueModal && (
        <AddQueueModal
          date={date}
          clinicId={CLINIC_ID}
          prefill={addQueueModal.prefill}
          onClose={() => setAddQueueModal(null)}
          onCreated={() => { setAddQueueModal(null); refetch() }}
        />
      )}

      {/* Sidebar */}
      <aside className="w-56 bg-card border-r border-border flex flex-col shrink-0 h-screen sticky top-0">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Activity size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>MorNut</p>
              <p className="text-[10px] text-muted-foreground leading-tight">ระบบจัดการคิวคลินิก</p>
            </div>
          </div>
        </div>

        <div className="mx-4 mt-4 mb-2 px-3 py-2.5 bg-secondary rounded-lg border border-border">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">วันที่เลือก</p>
          <p className="text-xs font-semibold text-foreground mt-0.5">
            {new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', calendar: 'buddhist' })}
          </p>
          <div className="flex items-center gap-1 mt-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-emerald-600 font-medium">Real-time</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left cursor-pointer ${
                activeNav === item.id ? 'bg-primary text-white font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {item.icon}{item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs">
              {user.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{user.email ?? 'แอดมิน'}</p>
              <button
                onClick={logout}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            {navItems.find(n => n.id === activeNav)?.icon}
            <span className="text-sm">{navItems.find(n => n.id === activeNav)?.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2">
              {pendingCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2.5 py-1 rounded-full font-medium">
                  <Clock size={11} />รอสลิป {pendingCount}
                </span>
              )}
              {confirmedCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
                  <UserCheck size={11} />ยืนยัน {confirmedCount - remindedCount}
                </span>
              )}
              {remindedCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-1 rounded-full font-medium">
                  <Bell size={11} />แจ้งเตือนแล้ว {remindedCount}
                </span>
              )}
            </div>
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer">
              <Bell size={16} />
              {pendingCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-yellow-500 rounded-full" />}
            </button>
          </div>
        </header>

        <div className="flex-1 p-6">
          {activeNav === 'dashboard' && (
            <DashboardView
              bookings={bookings}
              loading={bLoading}
              error={error}
              onAction={handleAction}
              actionLoading={actionLoading}
              date={date}
              onDateChange={setDate}
              onAddQueue={() => setAddQueueModal({})}
              onRefresh={refetch}
            />
          )}
          {activeNav === 'appointments' && <AppointmentsView clinicId={CLINIC_ID} />}
          {activeNav === 'doctors' && <DoctorsView clinicId={CLINIC_ID} />}
          {activeNav === 'quota' && <QuotaView date={date} />}
          {activeNav === 'patients' && (
            <PatientsView
              bookings={bookings}
              onBookPatient={patient => setAddQueueModal({ prefill: patient })}
            />
          )}
          {activeNav === 'bookingReminders' && <BookingRemindersView clinicId={CLINIC_ID} />}
          {activeNav === 'chat' && <ChatView clinicId={CLINIC_ID} />}
          {activeNav === 'clinicSettings' && <ClinicSettingsView />}
          {activeNav === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  )
}

function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center items-center min-h-screen text-muted-foreground text-base">
      {children}
    </div>
  )
}
