import { useMemo, useState } from 'react'
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
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useFirestoreCollection } from '../hooks/useFirestore'
import AdminLogin from './AdminLogin'
import { updateBookingStatus, setQuota, type QuotaLimits } from './api'

// ── Types ──────────────────────────────────────────────────────────────────
type Coverage = 'cash' | 'sso' | 'universal'
type Status = 'pending_slip' | 'confirmed' | 'reminded' | 'done' | 'no_show' | 'cancelled'
type NavItem = 'dashboard' | 'appointments' | 'quota' | 'patients' | 'doctors' | 'settings'

interface Booking {
  id: string
  patientName: string
  phone: string
  time: string
  serviceName: string
  coverage: Coverage
  status: Status
  depositAmount: number
  clinicId: string
}

const CLINIC_ID =
  new URLSearchParams(window.location.search).get('clinicId') ||
  import.meta.env.VITE_CLINIC_ID ||
  ''

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
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
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
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
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

// ── Doctor Schedule (UI mock — backend not yet implemented) ────────────────
const doctors = [
  { id: 'D1', name: 'นพ. อรรถพล สุวรรณรัตน์', specialty: 'อายุรกรรม', color: 'bg-sky-500', initials: 'อร' },
  { id: 'D2', name: 'พญ. ปริยา มหาสวัสดิ์', specialty: 'กุมารเวช', color: 'bg-violet-500', initials: 'ปร' },
  { id: 'D3', name: 'นพ. ธนิต ชัยประเสริฐ', specialty: 'กายภาพบำบัด', color: 'bg-amber-500', initials: 'ธน' },
  { id: 'D4', name: 'พญ. สุภาพร วงศ์วิไล', specialty: 'จักษุ', color: 'bg-rose-500', initials: 'สภ' },
]
const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']
const DAY_SHORT = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']

type DoctorShift = { doctorId: string; day: string; morning: boolean; afternoon: boolean }
const initialShifts: DoctorShift[] = DAYS.flatMap(day =>
  doctors.map(d => ({ doctorId: d.id, day, morning: Math.random() > 0.4, afternoon: Math.random() > 0.5 }))
)

// ── Views ──────────────────────────────────────────────────────────────────

function DashboardView({ bookings, loading, error, onAction, actionLoading, date, onDateChange }: {
  bookings: Booking[]
  loading: boolean
  error: Error | null
  onAction: (id: string, action: 'done' | 'cancelled') => void
  actionLoading: string | null
  date: string
  onDateChange: (d: string) => void
}) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all')
  const [filterCoverage, setFilterCoverage] = useState<Coverage | 'all'>('all')

  const filtered = bookings.filter(b => {
    const matchSearch = b.patientName.includes(search) || b.phone.includes(search) || b.id.includes(search)
    const matchStatus = filterStatus === 'all' || b.status === filterStatus
    const matchCov = filterCoverage === 'all' || b.coverage === filterCoverage
    return matchSearch && matchStatus && matchCov
  })

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed' || b.status === 'reminded').length,
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
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={14} />รีเฟรช
          </button>
          <button className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
            <Plus size={14} />เพิ่มคิว
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          { label: 'ทั้งหมด', value: stats.total, accent: 'bg-green-100 text-green-700', icon: <CalendarDays size={16} /> },
          { label: 'ยืนยันแล้ว', value: stats.confirmed, accent: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={16} /> },
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

        <div className="overflow-x-auto">
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
              {filtered.map(b => {
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
                      <p className="font-medium text-foreground">{b.patientName}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{b.phone}</p>
                    </td>
                    <td className="px-4 py-3.5 text-foreground">{b.serviceName}</td>
                    <td className="px-4 py-3.5"><CoverageBadge coverage={b.coverage} /></td>
                    <td className="px-4 py-3.5">
                      {b.depositAmount > 0
                        ? <span className="font-mono text-sm text-foreground">฿{b.depositAmount.toLocaleString()}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3.5">
                      {!isTerminal && (
                        <div className="flex items-center justify-end gap-2">
                          {b.status === 'confirmed' && (
                            <button
                              onClick={() => onAction(b.id, 'done')}
                              disabled={actionLoading !== null}
                              className="text-xs font-semibold bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === b.id + 'done' ? '...' : 'เสร็จ'}
                            </button>
                          )}
                          <button
                            onClick={() => onAction(b.id, 'cancelled')}
                            disabled={actionLoading !== null}
                            className="text-xs font-semibold bg-rose-600 text-white px-3 py-1.5 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
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

  const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

  const loadQuota = async () => {
    if (!CLINIC_ID) return
    try {
      const res = await fetch(`${BASE}/quotas/${CLINIC_ID}/${date}`)
      if (res.ok) {
        const data = await res.json()
        setQuotaValues({
          cash: data.cash?.limit ?? 10,
          sso: data.sso?.limit ?? 8,
          universal: data.universal?.limit ?? 12,
        })
      }
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
            โควตาวันที่ {date}
          </h2>
          {!editing ? (
            <button onClick={() => { loadQuota(); setEditing(true) }} className="text-sm text-primary font-medium hover:underline">แก้ไข</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-sm text-muted-foreground hover:text-foreground">ยกเลิก</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm bg-primary text-primary-foreground font-medium px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
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

function DoctorsView() {
  const [shifts, setShifts] = useState<DoctorShift[]>(initialShifts)
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null)

  const getShift = (doctorId: string, day: string) =>
    shifts.find(s => s.doctorId === doctorId && s.day === day)

  const toggleShift = (doctorId: string, day: string, period: 'morning' | 'afternoon') => {
    setShifts(prev =>
      prev.map(s => s.doctorId === doctorId && s.day === day ? { ...s, [period]: !s[period] } : s)
    )
  }

  const filteredDoctors = selectedDoctor ? doctors.filter(d => d.id === selectedDoctor) : doctors

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ตารางงานแพทย์</h1>
          <p className="text-sm text-muted-foreground mt-0.5">จัดการตารางกะและวันทำงานของแพทย์รายสัปดาห์</p>
        </div>
        <button className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
          <Plus size={14} />เพิ่มแพทย์
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {doctors.map(doc => {
          const workDays = DAYS.filter(d => { const s = getShift(doc.id, d); return s && (s.morning || s.afternoon) }).length
          return (
            <button
              key={doc.id}
              onClick={() => setSelectedDoctor(selectedDoctor === doc.id ? null : doc.id)}
              className={`bg-card border rounded-xl p-4 text-left transition-all hover:shadow-sm ${selectedDoctor === doc.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl ${doc.color} flex items-center justify-center text-white font-bold text-sm`}>{doc.initials}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate leading-tight">{doc.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.specialty}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {DAY_SHORT.map((d, i) => {
                  const s = getShift(doc.id, DAYS[i])
                  const active = s && (s.morning || s.afternoon)
                  const both = s && s.morning && s.afternoon
                  return (
                    <div key={d} className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-colors ${
                      both ? `${doc.color} text-white` : active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {d}
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{workDays} วัน/สัปดาห์</p>
            </button>
          )
        })}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm">
            {selectedDoctor ? `ตารางงาน — ${doctors.find(d => d.id === selectedDoctor)?.name}` : 'ตารางงานทั้งหมด (รายสัปดาห์)'}
          </h2>
          {selectedDoctor && (
            <button onClick={() => setSelectedDoctor(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X size={12} />ดูทั้งหมด
            </button>
          )}
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
                      <div className={`w-7 h-7 rounded-lg ${doc.color} flex items-center justify-center text-white font-bold text-xs shrink-0`}>{doc.initials}</div>
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
                              className={`w-10 h-7 rounded text-[10px] font-medium transition-colors ${
                                s?.[period] ? `${doc.color} text-white` : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
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
          <p className="ml-auto text-xs text-muted-foreground">คลิกที่ช่องเช้า/บ่ายเพื่อแก้ไขตาราง</p>
        </div>
      </div>
    </div>
  )
}

function PatientsView({ bookings }: { bookings: Booking[] }) {
  const [search, setSearch] = useState('')
  const uniquePatients = bookings.reduce((acc, b) => {
    if (!acc.find(p => p.phone === b.phone)) acc.push(b)
    return acc
  }, [] as Booking[])
  const filtered = uniquePatients.filter(p => p.patientName.includes(search) || p.phone.includes(search))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ข้อมูลผู้ป่วย</h1>
        <p className="text-sm text-muted-foreground mt-0.5">ผู้ป่วยที่ลงทะเบียนผ่าน LINE OA ทั้งหมด</p>
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
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors cursor-pointer">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {p.patientName[0]}
                    </div>
                    <span className="font-medium text-foreground">{p.patientName}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 font-mono text-sm text-muted-foreground">{p.phone}</td>
                <td className="px-4 py-3.5"><CoverageBadge coverage={p.coverage} /></td>
                <td className="px-4 py-3.5 text-muted-foreground text-sm">{p.serviceName}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="text-center py-12 text-muted-foreground text-sm">ไม่พบข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
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
  const [clinicName, setClinicName] = useState('คลินิกสุขภาพดี')
  const [clinicPhone, setClinicPhone] = useState('02-123-4567')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ตั้งค่าระบบ</h1>
        <p className="text-sm text-muted-foreground mt-0.5">จัดการสิทธิ์การรักษา, มัดจำ และการแจ้งเตือน</p>
      </div>

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
        <button className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm">
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

  const constraints = useMemo(() => ({ date }), [date])

  const { data: bookings, loading: bLoading, error } = useFirestoreCollection<Booking>(
    'bookings',
    constraints,
  )

  if (authLoading) return <FullPage>กำลังโหลด...</FullPage>
  if (!user) return <AdminLogin onLogin={onLogin} />

  async function handleAction(bookingId: string, action: 'done' | 'cancelled') {
    setActionLoading(bookingId + action)
    try {
      await updateBookingStatus(bookingId, action)
    } finally {
      setActionLoading(null)
    }
  }

  const pendingCount = bookings.filter(b => b.status === 'pending_slip').length
  const confirmedCount = bookings.filter(b => b.status === 'confirmed' || b.status === 'reminded').length

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
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
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
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
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
                  <UserCheck size={11} />ยืนยัน {confirmedCount}
                </span>
              )}
            </div>
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
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
            />
          )}
          {activeNav === 'doctors' && <DoctorsView />}
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
