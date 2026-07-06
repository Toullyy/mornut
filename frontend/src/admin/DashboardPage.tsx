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
  Pencil,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { apiFetch } from '../lib/api'
import { useBookings } from '../hooks/useBookings'
import AdminLogin from './AdminLogin'
import {
  updateBookingStatus,
  setQuota,
  type QuotaLimits,
  fetchDoctors,
  fetchAllBookings,
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
  type Doctor as ApiDoctor,
  type DoctorCreate,
  type ServiceItem,
  type SlotItem,
  type LineOASettings,
} from './api'

// ── Types ──────────────────────────────────────────────────────────────────
type Coverage = 'cash' | 'sso' | 'universal'
type Status = 'pending_slip' | 'confirmed' | 'reminded' | 'done' | 'no_show' | 'cancelled'
type NavItem = 'dashboard' | 'appointments' | 'quota' | 'patients' | 'doctors' | 'settings'

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

type ShiftState = { doctorId: string; day: string; morning: boolean; afternoon: boolean }

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
  if (totalPages <= 1) return null

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
  onClose,
  onCreated,
}: {
  date: string
  clinicId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    date: initialDate,
    time: '',
    service_id: '',
    service_name: '',
    coverage: 'cash' as Coverage,
    deposit_amount: 0,
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
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className={field}
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
          <input
            type="date"
            value={date}
            onChange={e => onDateChange(e.target.value)}
            className="text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30"
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
  const [shifts, setShifts] = useState<ShiftState[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null)
  const [showAddDoctor, setShowAddDoctor] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [savingShifts, setSavingShifts] = useState(false)
  const [shiftsSaved, setShiftsSaved] = useState(false)
  const [shiftError, setShiftError] = useState('')
  const [confirmSave, setConfirmSave] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState<ApiDoctor | null>(null)

  const loadDoctors = useCallback(() => {
    if (!clinicId) { setLoadingDoctors(false); return }
    setLoadingDoctors(true)
    fetchDoctors(clinicId)
      .then(apiDoctors => {
        setDoctorList(apiDoctors)
        const localShifts: ShiftState[] = apiDoctors.flatMap(doc =>
          DAYS.map((day, idx) => {
            const s = doc.shifts.find(sh => sh.day_of_week === idx)
            return { doctorId: doc.id, day, morning: s?.morning ?? false, afternoon: s?.afternoon ?? false }
          })
        )
        setShifts(localShifts)
      })
      .catch(console.error)
      .finally(() => setLoadingDoctors(false))
  }, [clinicId])

  useEffect(() => { loadDoctors() }, [loadDoctors])

  const getShift = (doctorId: string, day: string) =>
    shifts.find(s => s.doctorId === doctorId && s.day === day)

  const toggleShift = (doctorId: string, day: string, period: 'morning' | 'afternoon') => {
    setShifts(prev =>
      prev.map(s => s.doctorId === doctorId && s.day === day ? { ...s, [period]: !s[period] } : s)
    )
    setShiftsSaved(false)
  }

  const handleSaveShifts = async () => {
    setConfirmSave(false)
    setSavingShifts(true)
    setShiftError('')
    try {
      for (const doc of doctorList) {
        const apiShifts = DAYS.map((day, idx) => {
          const s = shifts.find(sh => sh.doctorId === doc.id && sh.day === day)
          return { day_of_week: idx, morning: s?.morning ?? false, afternoon: s?.afternoon ?? false }
        })
        await updateDoctorShifts(doc.id, apiShifts)
      }
      setShiftsSaved(true)
      setTimeout(() => setShiftsSaved(false), 2500)
    } catch (e) {
      setShiftError((e as Error).message)
    } finally {
      setSavingShifts(false)
    }
  }

  const handleDeleteDoctor = async (doctorId: string) => {
    try {
      await apiDeleteDoctor(doctorId)
      setDoctorList(prev => prev.filter(d => d.id !== doctorId))
      setShifts(prev => prev.filter(s => s.doctorId !== doctorId))
      if (selectedDoctor === doctorId) setSelectedDoctor(null)
    } catch (e) {
      console.error(e)
    } finally {
      setConfirmDelete(null)
    }
  }

  const handleDoctorUpdated = (updated: ApiDoctor) => {
    setDoctorList(prev => prev.map(d => d.id === updated.id ? updated : d))
    setEditingDoctor(null)
  }

  const handleDoctorCreated = (newDoc: ApiDoctor) => {
    setDoctorList(prev => [...prev, newDoc])
    setShifts(prev => [
      ...prev,
      ...DAYS.map(day => ({ doctorId: newDoc.id, day, morning: false, afternoon: false })),
    ])
    setShowAddDoctor(false)
  }

  const filteredDoctors = selectedDoctor ? doctorList.filter(d => d.id === selectedDoctor) : doctorList

  return (
    <div className="flex flex-col gap-6">
      {showAddDoctor && (
        <AddDoctorModal
          clinicId={clinicId}
          onClose={() => setShowAddDoctor(false)}
          onCreated={handleDoctorCreated}
        />
      )}
      {editingDoctor && (
        <EditDoctorModal
          doctor={editingDoctor}
          onClose={() => setEditingDoctor(null)}
          onSaved={handleDoctorUpdated}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ตารางงานแพทย์</h1>
          <p className="text-sm text-muted-foreground mt-0.5">จัดการตารางกะและวันทำงานของแพทย์รายสัปดาห์</p>
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {doctorList.map(doc => {
              const workDays = DAYS.filter(d => { const s = getShift(doc.id, d); return s && (s.morning || s.afternoon) }).length
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoctor(selectedDoctor === doc.id ? null : doc.id)}
                  className={`bg-card border rounded-xl p-4 text-left transition-all hover:shadow-sm cursor-pointer ${selectedDoctor === doc.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-9 h-9 rounded-xl ${doc.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {doc.initials || doc.name.substring(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate leading-tight">{doc.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.specialty}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setEditingDoctor(doc) }}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors cursor-pointer"
                        title="แก้ไข"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(confirmDelete === doc.id ? null : doc.id) }}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded-lg transition-colors cursor-pointer"
                        title="ลบ"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  {confirmDelete === doc.id && (
                    <div
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-2 mb-3 px-2.5 py-2 bg-rose-50 border border-rose-200 rounded-lg"
                    >
                      <span className="text-xs text-rose-700 flex-1">ลบแพทย์นี้?</span>
                      <button
                        onClick={() => handleDeleteDoctor(doc.id)}
                        className="text-[10px] font-semibold text-white bg-rose-600 px-2 py-1 rounded hover:bg-rose-700 transition-colors cursor-pointer"
                      >
                        ยืนยัน
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    {DAY_SHORT.map((d, i) => {
                      const s = getShift(doc.id, DAYS[i])
                      const active = s && (s.morning || s.afternoon)
                      const both = s && s.morning && s.afternoon
                      return (
                        <div key={d} className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-colors ${
                          both ? `${doc.color} text-white` : active ? `${doc.color} text-white opacity-60` : 'bg-muted text-muted-foreground'
                        }`}>
                          {d}
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{workDays} วัน/สัปดาห์</p>
                </div>
              )
            })}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3">
              <h2 className="font-semibold text-foreground text-sm">
                {selectedDoctor
                  ? `ตารางงาน — ${doctorList.find(d => d.id === selectedDoctor)?.name}`
                  : 'ตารางงานทั้งหมด (รายสัปดาห์)'}
              </h2>
              <div className="flex items-center gap-2">
                {selectedDoctor && (
                  <button onClick={() => setSelectedDoctor(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer">
                    <X size={12} />ดูทั้งหมด
                  </button>
                )}
                {confirmSave ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">บันทึกตารางนี้?</span>
                    <button
                      onClick={handleSaveShifts}
                      className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
                    >
                      ยืนยัน
                    </button>
                    <button
                      onClick={() => setConfirmSave(false)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmSave(true)}
                    disabled={savingShifts}
                    className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground font-medium px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <Save size={13} />
                    {savingShifts ? 'กำลังบันทึก...' : shiftsSaved ? 'บันทึกแล้ว ✓' : 'บันทึกตาราง'}
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground w-52">แพทย์</th>
                    {DAYS.map(day => (
                      <th key={day} className="text-center px-2 py-3 text-xs font-semibold text-muted-foreground min-w-24">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map(doc => (
                    <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg ${doc.color} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                            {doc.initials || doc.name.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{doc.name}</p>
                            <p className="text-[10px] text-muted-foreground">{doc.specialty}</p>
                          </div>
                        </div>
                      </td>
                      {DAYS.map(day => {
                        const s = getShift(doc.id, day)
                        return (
                          <td key={day} className="px-2 py-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {(['morning', 'afternoon'] as const).map(period => (
                                <button
                                  key={period}
                                  onClick={() => toggleShift(doc.id, day, period)}
                                  className={`w-10 h-7 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                                    s?.[period]
                                      ? `${doc.color} text-white`
                                      : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                                  }`}
                                >
                                  {period === 'morning' ? 'เช้า' : 'บ่าย'}
                                </button>
                              ))}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center gap-4 flex-wrap">
              {shiftError && <p className="text-xs text-destructive">{shiftError}</p>}
              <p className="ml-auto text-xs text-muted-foreground">คลิกที่ช่องเช้า/บ่ายเพื่อแก้ไข แล้วกด "บันทึกตาราง"</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PatientsView({ bookings }: { bookings: Booking[] }) {
  const [tab, setTab] = useState<'directory' | 'history'>('directory')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [histLoading, setHistLoading] = useState(false)

  useEffect(() => { setPage(1) }, [search, tab])

  useEffect(() => {
    if (tab !== 'history') return
    setHistLoading(true)
    fetchAllBookings<Booking>(CLINIC_ID)
      .then(setAllBookings)
      .catch(console.error)
      .finally(() => setHistLoading(false))
  }, [tab])

  // ── Tab 1: unique patient directory ──────────────────────────────────────
  const uniquePatients = bookings.reduce((acc, b) => {
    if (!acc.find(p => p.phone === b.phone)) acc.push(b)
    return acc
  }, [] as Booking[])
  const filteredDir = uniquePatients.filter(
    p => p.patient_name.includes(search) || p.phone.includes(search),
  )
  const paginatedDir = filteredDir.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Tab 2: all bookings, newest first ────────────────────────────────────
  const filteredHist = allBookings.filter(
    b => b.patient_name.includes(search) || b.phone.includes(search),
  )
  const paginatedHist = filteredHist.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
          {tabBtn('history', `ประวัติการนัด (${bookings.length})`)}
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
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
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
            <Pagination page={page} total={filteredDir.length} pageSize={PAGE_SIZE} onChange={setPage} />
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
                {paginatedHist.map(b => (
                  <tr key={b.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
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
                {filteredHist.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">ไม่พบข้อมูล</td></tr>
                )}
              </tbody>
            </table>
            <Pagination page={page} total={filteredHist.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )}
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
  const [clinicName, setClinicName] = useState('คลินิกสุขภาพดี')
  const [clinicPhone, setClinicPhone] = useState('02-123-4567')

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
          <SettingsRow label="ชื่อคลินิก">
            <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)}
              className="text-sm bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 w-52" />
          </SettingsRow>
          <SettingsRow label="เบอร์โทรคลินิก">
            <input type="text" value={clinicPhone} onChange={e => setClinicPhone(e.target.value)}
              className="text-sm font-mono bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 w-36" />
          </SettingsRow>
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
  const [showAddQueue, setShowAddQueue] = useState(false)

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
    { id: 'settings', label: 'ตั้งค่า', icon: <ShieldCheck size={16} /> },
  ]

  return (
    <div className="min-h-screen bg-background flex" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Add Queue Modal */}
      {showAddQueue && (
        <AddQueueModal
          date={date}
          clinicId={CLINIC_ID}
          onClose={() => setShowAddQueue(false)}
          onCreated={() => { setShowAddQueue(false); refetch() }}
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
          {(activeNav === 'dashboard' || activeNav === 'appointments') && (
            <DashboardView
              bookings={bookings}
              loading={bLoading}
              error={error}
              onAction={handleAction}
              actionLoading={actionLoading}
              date={date}
              onDateChange={setDate}
              onAddQueue={() => setShowAddQueue(true)}
              onRefresh={refetch}
            />
          )}
          {activeNav === 'doctors' && <DoctorsView clinicId={CLINIC_ID} />}
          {activeNav === 'quota' && <QuotaView date={date} />}
          {activeNav === 'patients' && <PatientsView bookings={bookings} />}
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
