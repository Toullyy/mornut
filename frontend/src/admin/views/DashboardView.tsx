import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle, CalendarDays, CheckCircle2,
  ChevronRight, ChevronUp, ChevronDown, Clock, Phone, Plus, RefreshCw, Search, X, XCircle,
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
                <option value="cash">💵 เงินสด</option>
                <option value="sso">🏥 ประกันสังคม</option>
                <option value="universal">🪪 บัตรทอง</option>
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

// ── Booking Detail Drawer ────────────────────────────────────────────────────

function BookingDrawer({ booking, onClose, onAction, actionLoading }: {
  booking: Booking
  onClose: () => void
  onAction: (id: string, action: 'done' | 'cancelled') => void
  actionLoading: string | null
}) {
  const isTerminal = ['done', 'cancelled', 'no_show'].includes(booking.status)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const dateLabel = new Date(booking.date + 'T00:00:00').toLocaleDateString('th-TH', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', calendar: 'buddhist',
  })

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  )

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-50 w-80 bg-card border-l border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <p className="font-semibold text-sm text-foreground">รายละเอียดการนัด</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Patient header */}
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {booking.patient_name[0]}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{booking.patient_name}</p>
                <a href={`tel:${booking.phone}`}
                  className="text-sm text-muted-foreground font-mono flex items-center gap-1 hover:text-primary transition-colors">
                  <Phone size={11} />{booking.phone}
                </a>
              </div>
            </div>
          </div>

          {/* Detail rows */}
          <div className="px-5 py-3">
            {row('วันที่', <span className="font-medium text-foreground">{dateLabel}</span>)}
            {row('เวลา', <span className="font-mono font-semibold text-foreground">{booking.time}</span>)}
            {row('บริการ', <span className="font-medium text-foreground">{booking.service_name}</span>)}
            {row('สิทธิ์', <CoverageBadge coverage={booking.coverage} />)}
            {row('มัดจำ', (
              <span className="font-mono font-medium text-foreground">
                {booking.deposit_amount > 0 ? `฿${booking.deposit_amount.toLocaleString()}` : '—'}
              </span>
            ))}
            {row('สถานะ', <StatusBadge status={booking.status} />)}
          </div>
        </div>

        {/* Actions */}
        {!isTerminal ? (
          <div className="p-4 border-t border-border flex flex-col gap-2 shrink-0">
            {(booking.status === 'confirmed' || booking.status === 'reminded') && (
              <button
                onClick={() => { onAction(booking.id, 'done'); onClose() }}
                disabled={actionLoading !== null}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
                <CheckCircle2 size={15} />เสร็จสิ้น
              </button>
            )}
            <button
              onClick={() => { onAction(booking.id, 'cancelled'); onClose() }}
              disabled={actionLoading !== null}
              className="w-full flex items-center justify-center gap-2 border border-border text-muted-foreground text-sm font-medium py-2.5 rounded-lg hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 disabled:opacity-50 transition-colors cursor-pointer">
              ยกเลิกการนัด
            </button>
          </div>
        ) : (
          <div className="p-4 border-t border-border shrink-0">
            <p className="text-xs text-center text-muted-foreground">
              {booking.status === 'done'
                ? 'การนัดเสร็จสิ้นแล้ว'
                : booking.status === 'cancelled'
                  ? 'การนัดถูกยกเลิกแล้ว'
                  : 'ผู้ป่วยไม่มาตามนัด'}
            </p>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}

// ── Table Skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 9 }).map((_, i) => (
        <tr key={i} className="border-b border-border animate-pulse">
          <td className="px-4 py-3.5"><div className="h-4 w-14 bg-muted rounded" /></td>
          <td className="px-4 py-3.5"><div className="h-4 w-36 bg-muted rounded" /></td>
          <td className="px-4 py-3.5"><div className="h-4 w-28 bg-muted rounded" /></td>
          <td className="px-4 py-3.5"><div className="h-5 w-20 bg-muted rounded-full" /></td>
          <td className="px-4 py-3.5 text-right"><div className="h-7 w-16 bg-muted rounded-lg ml-auto" /></td>
        </tr>
      ))}
    </>
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
  externalSearch?: string
}

type FilterStatus = Status | 'all'
type SortKey = 'time' | 'name' | 'status'
type SortDir = 'asc' | 'desc'

export function DashboardView({
  bookings, loading, error, onAction, actionLoading,
  date, onDateChange, onAddQueue, onRefresh, externalSearch,
}: DashboardViewProps) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [page, setPage] = useState(1)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('time')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const searchRef = useRef<HTMLInputElement>(null)
  const PAGE_SIZE = 20

  // Accept external search from global Ctrl+K
  useEffect(() => {
    if (externalSearch !== undefined) {
      setSearch(externalSearch)
      setFilterStatus('all')
      setPage(1)
      searchRef.current?.focus()
    }
  }, [externalSearch])

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending_slip').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    reminded: bookings.filter(b => b.status === 'reminded').length,
    done: bookings.filter(b => b.status === 'done').length,
    noShow: bookings.filter(b => b.status === 'no_show').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  }

  const STATUS_PILLS: { key: FilterStatus; label: string; count: number; urgent?: boolean }[] = [
    { key: 'all', label: 'ทั้งหมด', count: stats.total },
    { key: 'pending_slip', label: 'รอสลิป', count: stats.pending, urgent: true },
    { key: 'confirmed', label: 'ยืนยัน', count: stats.confirmed },
    { key: 'reminded', label: 'แจ้งเตือน', count: stats.reminded },
    { key: 'done', label: 'เสร็จ', count: stats.done },
    { key: 'no_show', label: 'ไม่มา', count: stats.noShow },
    { key: 'cancelled', label: 'ยกเลิก', count: stats.cancelled },
  ]

  const filtered = bookings.filter(b => {
    const matchSearch = !search || b.patient_name.includes(search) || b.phone.includes(search)
    const matchStatus = filterStatus === 'all' || b.status === filterStatus
    return matchSearch && matchStatus
  })

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'time') cmp = a.time.localeCompare(b.time)
    else if (sortKey === 'name') cmp = a.patient_name.localeCompare(b.patient_name, 'th')
    else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
    return sortDir === 'asc' ? cmp : -cmp
  })

  useEffect(() => { setPage(1) }, [search, filterStatus, date, bookings.length])
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp size={11} className="opacity-20 ml-0.5" />
    return sortDir === 'asc'
      ? <ChevronUp size={11} className="text-primary ml-0.5" />
      : <ChevronDown size={11} className="text-primary ml-0.5" />
  }

  const isToday = date === new Date().toISOString().split('T')[0]
  const emptyQueueMsg = search || filterStatus !== 'all'
    ? 'ไม่พบคิวที่ค้นหา'
    : isToday ? 'ไม่มีคิววันนี้' : 'ไม่มีคิวในวันที่เลือก'

  const todayLabel = new Date(date).toLocaleDateString('th-TH', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', calendar: 'buddhist',
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            ตารางคิว
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{todayLabel} · Real-time</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DatePicker value={date} onChange={onDateChange} className="w-52" />
          <button onClick={onRefresh}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border px-3 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
            <RefreshCw size={13} />รีเฟรช
          </button>
          <button onClick={onAddQueue}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
            <Plus size={14} />เพิ่มคิว
          </button>
        </div>
      </div>

      {/* Attention banner — only when pending slips need action */}
      {!loading && stats.pending > 0 && (
        <button
          onClick={() => setFilterStatus(filterStatus === 'pending_slip' ? 'all' : 'pending_slip')}
          className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors cursor-pointer w-full
            ${filterStatus === 'pending_slip'
              ? 'bg-yellow-100 border-yellow-300'
              : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'}`}>
          <div className="flex items-center gap-2.5">
            <Clock size={15} className="text-yellow-600 shrink-0" />
            <span className="text-sm font-semibold text-yellow-800">
              {stats.pending} รายการรอยืนยันสลิป — ต้องดำเนินการ
            </span>
          </div>
          <ChevronRight size={14} className="text-yellow-600 shrink-0" />
        </button>
      )}

      {/* No-show warning */}
      {!loading && stats.noShow > 0 && (
        <button
          onClick={() => setFilterStatus(filterStatus === 'no_show' ? 'all' : 'no_show')}
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-left transition-colors cursor-pointer w-full">
          <XCircle size={15} className="text-red-500 shrink-0" />
          <span className="text-sm font-semibold text-red-700">{stats.noShow} รายการไม่มา</span>
        </button>
      )}

      {/* Main table card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Filter area */}
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_PILLS.map(pill => {
              const isActive = filterStatus === pill.key
              const showUrgent = pill.urgent && pill.count > 0 && !isActive
              return (
                <button
                  key={pill.key}
                  onClick={() => setFilterStatus(pill.key)}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : showUrgent
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-100'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground',
                  ].join(' ')}>
                  {showUrgent && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />}
                  {pill.label}
                  <span className={`font-semibold ${isActive ? 'text-primary-foreground' : 'text-foreground'}`}>
                    {pill.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="ค้นหาชื่อหรือเบอร์โทร..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-3 flex items-center gap-2 text-sm text-destructive bg-destructive/5 border-b border-border">
            <AlertCircle size={14} />ไม่สามารถโหลดข้อมูลได้ กรุณารีเฟรช
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th onClick={() => toggleSort('time')}
                  className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-20 cursor-pointer hover:text-foreground select-none">
                  <span className="inline-flex items-center">เวลา<SortIcon col="time" /></span>
                </th>
                <th onClick={() => toggleSort('name')}
                  className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none">
                  <span className="inline-flex items-center">ชื่อผู้ป่วย<SortIcon col="name" /></span>
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">บริการ</th>
                <th onClick={() => toggleSort('status')}
                  className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none">
                  <span className="inline-flex items-center">สถานะ<SortIcon col="status" /></span>
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : paginated.length === 0 ? null : (
                paginated.map(b => {
                  const isTerminal = b.status === 'done' || b.status === 'cancelled' || b.status === 'no_show'
                  return (
                    <tr
                      key={b.id}
                      onClick={() => setSelectedBooking(b)}
                      className={`border-b border-border last:border-0 hover:bg-secondary/40 transition-colors cursor-pointer group ${isTerminal ? 'opacity-55' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-semibold text-foreground">{b.time}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">{b.patient_name}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{b.service_name}</td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {!isTerminal && (
                          <div className="flex items-center justify-end gap-1.5">
                            {(b.status === 'confirmed' || b.status === 'reminded') && (
                              <button
                                onClick={() => onAction(b.id, 'done')}
                                disabled={actionLoading !== null}
                                className="flex items-center gap-1 text-xs font-semibold bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
                                <CheckCircle2 size={11} />เสร็จ
                              </button>
                            )}
                            <button
                              onClick={() => onAction(b.id, 'cancelled')}
                              disabled={actionLoading !== null}
                              className="text-xs font-medium text-muted-foreground border border-border px-2.5 py-1.5 rounded-lg hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 disabled:opacity-50 transition-colors cursor-pointer">
                              ยกเลิก
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <CalendarDays size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">{emptyQueueMsg}</p>
                    {!search && filterStatus === 'all' && (
                      <button onClick={onAddQueue}
                        className="mt-3 text-sm text-primary hover:underline cursor-pointer">
                        + เพิ่มคิวใหม่
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-border">
          {loading && (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="w-14 h-4 bg-muted rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted/60 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="py-16 text-center">
              <CalendarDays size={28} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{emptyQueueMsg}</p>
            </div>
          )}
          {paginated.map(b => {
            const isTerminal = b.status === 'done' || b.status === 'cancelled' || b.status === 'no_show'
            return (
              <div key={b.id} onClick={() => setSelectedBooking(b)}
                className={`p-4 flex flex-col gap-2 cursor-pointer hover:bg-secondary/30 transition-colors ${isTerminal ? 'opacity-55' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-foreground text-sm">{b.time}</span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="font-semibold text-foreground">{b.patient_name}</p>
                <p className="text-xs text-muted-foreground">{b.service_name}</p>
                {!isTerminal && (
                  <div className="flex gap-2 mt-1" onClick={e => e.stopPropagation()}>
                    {(b.status === 'confirmed' || b.status === 'reminded') && (
                      <button onClick={() => onAction(b.id, 'done')} disabled={actionLoading !== null}
                        className="flex-1 text-xs font-semibold bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
                        {actionLoading === b.id + 'done' ? '...' : 'เสร็จ'}
                      </button>
                    )}
                    <button onClick={() => onAction(b.id, 'cancelled')} disabled={actionLoading !== null}
                      className="flex-1 text-xs font-medium border border-border text-muted-foreground px-3 py-2 rounded-lg hover:bg-destructive/5 hover:text-destructive disabled:opacity-50 transition-colors cursor-pointer">
                      {actionLoading === b.id + 'cancelled' ? '...' : 'ยกเลิก'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {/* Booking detail drawer */}
      {selectedBooking && (
        <BookingDrawer
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onAction={onAction}
          actionLoading={actionLoading}
        />
      )}
    </div>
  )
}

export { AddQueueModal }
