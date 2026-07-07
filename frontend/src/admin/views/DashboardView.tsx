import { useEffect, useState } from 'react'
import {
  AlertCircle, BadgeCheck, Bell, CalendarDays, CheckCircle2,
  Clock, Filter, Plus, RefreshCw, Search, XCircle,
} from 'lucide-react'
import { DatePicker } from '../DatePicker'
import {
  createAdminBooking, fetchServices, fetchSlots,
  type ServiceItem, type SlotItem,
} from '../api'
import { Pagination } from '../ui/Pagination'
import { StatusBadge, CoverageBadge } from '../ui/StatusBadge'
import { type Booking, type Coverage, type Status } from '../types'

// ── Add Queue Modal ──────────────────────────────────────────────────────────

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
            <XCircle size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">ชื่อ <span className="text-destructive">*</span></label>
              <input type="text" placeholder="ชื่อ" value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className={field} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">นามสกุล</label>
              <input type="text" placeholder="นามสกุล" value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className={field} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">เบอร์โทร <span className="text-destructive">*</span></label>
            <input type="tel" placeholder="0812345678" value={form.phone} maxLength={10}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              className={`${field} font-mono tracking-widest`} />
            {form.phone.length > 0 && form.phone.length < 10 && (
              <p className="text-[11px] text-muted-foreground">{form.phone.length}/10 หลัก</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">วันที่</label>
            <DatePicker value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">บริการ <span className="text-destructive">*</span></label>
            <select value={form.service_id} onChange={e => setForm(f => ({ ...f, service_id: e.target.value }))}
              disabled={loadingServices} className={field}>
              <option value="">{loadingServices ? 'กำลังโหลด...' : 'เลือกบริการ'}</option>
              {services.map(svc => <option key={svc.id} value={svc.id}>{svc.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">เวลา <span className="text-destructive">*</span></label>
              <select value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                disabled={loadingSlots} className={`${field} font-mono`}>
                <option value="">{loadingSlots ? 'กำลังโหลด...' : slots.length === 0 ? 'ไม่มีช่องว่าง' : 'เลือกเวลา'}</option>
                {slots.map(sl => <option key={sl.time} value={sl.time}>{sl.time} (ว่าง {sl.available})</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">สิทธิ์การรักษา</label>
              <select value={form.coverage} onChange={e => setForm(f => ({ ...f, coverage: e.target.value as Coverage }))} className={field}>
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
              <input type="number" value={form.deposit_amount}
                onChange={e => setForm(f => ({ ...f, deposit_amount: Number(e.target.value) }))}
                min={0} className={`${field} pl-7 font-mono`} />
            </div>
          </div>

          {error && <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">ยกเลิก</button>
          <button onClick={handleSubmit} disabled={!isValid || submitting}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer">
            <Plus size={14} />{submitting ? 'กำลังเพิ่ม...' : 'เพิ่มคิว'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard View ───────────────────────────────────────────────────────────

export interface DashboardViewProps {
  bookings: Booking[]
  loading: boolean
  error: Error | null
  onAction: (id: string, action: 'done' | 'cancelled') => void
  actionLoading: string | null
  date: string
  onDateChange: (d: string) => void
  onAddQueue: () => void
  onRefresh: () => void
}

export function DashboardView({ bookings, loading, error, onAction, actionLoading, date, onDateChange, onAddQueue, onRefresh }: DashboardViewProps) {
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
          <DatePicker value={date} onChange={onDateChange} className="w-48" />
          <button onClick={onRefresh} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <RefreshCw size={14} />รีเฟรช
          </button>
          <button onClick={onAddQueue} className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
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
            <input type="text" placeholder="ค้นหาชื่อ, เบอร์, รหัสคิว..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-muted-foreground" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as Status | 'all')}
              className="text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="all">สถานะทั้งหมด</option>
              <option value="pending_slip">รอสลิป</option>
              <option value="confirmed">ยืนยันแล้ว</option>
              <option value="reminded">แจ้งเตือนแล้ว</option>
              <option value="done">เสร็จสิ้น</option>
              <option value="no_show">ไม่มา</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
            <select value={filterCoverage} onChange={e => setFilterCoverage(e.target.value as Coverage | 'all')}
              className="text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
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
                  {b.deposit_amount > 0 && <span className="text-xs font-mono text-foreground">฿{b.deposit_amount.toLocaleString()}</span>}
                </div>
                <p className="text-xs text-muted-foreground">{b.service_name}</p>
                {!isTerminal && (
                  <div className="flex gap-2 mt-1">
                    {(b.status === 'confirmed' || b.status === 'reminded') && (
                      <button onClick={() => onAction(b.id, 'done')} disabled={actionLoading !== null}
                        className="flex-1 text-xs font-semibold bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
                        {actionLoading === b.id + 'done' ? '...' : 'เสร็จ'}
                      </button>
                    )}
                    <button onClick={() => onAction(b.id, 'cancelled')} disabled={actionLoading !== null}
                      className="flex-1 text-xs font-semibold bg-rose-600 text-white px-3 py-2 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer">
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
                  <tr key={b.id} className={`border-b border-border last:border-0 hover:bg-secondary/50 transition-colors ${isTerminal ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3.5"><span className="font-mono text-sm font-medium text-foreground">{b.time}</span></td>
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
                            <button onClick={() => onAction(b.id, 'done')} disabled={actionLoading !== null}
                              className="text-xs font-semibold bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
                              {actionLoading === b.id + 'done' ? '...' : 'เสร็จ'}
                            </button>
                          )}
                          <button onClick={() => onAction(b.id, 'cancelled')} disabled={actionLoading !== null}
                            className="text-xs font-semibold bg-rose-600 text-white px-3 py-1.5 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer">
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
                  <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">ไม่พบข้อมูลที่ค้นหา</td>
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

export { AddQueueModal }
