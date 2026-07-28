import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, LayoutList, Search } from 'lucide-react'
import { fetchAppointmentsRange, type AppointmentBooking } from '../api'
import { StatusBadge, CoverageBadge } from '../ui/StatusBadge'
import { statusClassName } from '../types'

// Format a Date to YYYY-MM-DD using LOCAL fields. toISOString() converts to
// UTC first, which shifts the calendar day by one in TZ ahead of UTC (e.g. +07).
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr(): string {
  return toDateStr(new Date())
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay() // 0=Sun
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return toDateStr(d)
}

const DAY_SHORT_TH = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

// ── Week Calendar ─────────────────────────────────────────────────────────────

function WeekCalendar({ weekStart, items }: { weekStart: string; items: AppointmentBooking[] }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = todayStr()

  const grouped = items.reduce((acc, b) => {
    const key = `${b.date}|${b.time}`
    ;(acc[key] ??= []).push(b)
    return acc
  }, {} as Record<string, AppointmentBooking[]>)

  // Only render time rows that have at least one booking this week
  const usedTimes = [...new Set(items.map(b => b.time))].sort()

  if (usedTimes.length === 0) {
    return (
      <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
        <CalendarDays size={32} className="mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">ไม่มีนัดหมายในสัปดาห์นี้</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm border-collapse">
        <thead>
          <tr>
            <th className="w-16 px-2 py-2.5 text-xs text-muted-foreground font-medium border-b border-r border-border bg-muted/30" />
            {days.map((d, i) => {
              const isToday = d === today
              const label = new Date(d + 'T00:00:00').getDate()
              return (
                <th key={d}
                  className={`px-2 py-2.5 text-center border-b border-border font-medium ${i < 6 ? 'border-r' : ''} ${isToday ? 'bg-primary/5' : 'bg-muted/30'}`}>
                  <span className={`block text-[11px] ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{DAY_SHORT_TH[i]}</span>
                  <span className={`block text-sm ${isToday ? 'text-primary font-bold' : 'text-foreground'}`}>{label}</span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {usedTimes.map((time, ri) => (
            <tr key={time} className={ri % 2 === 0 ? '' : 'bg-muted/20'}>
              <td className="px-2 py-1 text-center font-mono text-[11px] text-muted-foreground border-r border-border align-top pt-2">
                {time.slice(0, 5)}
              </td>
              {days.map((d, ci) => {
                const cell = grouped[`${d}|${time}`] ?? []
                return (
                  <td key={d} className={`px-1 py-1 align-top ${ci < 6 ? 'border-r border-border' : ''}`}>
                    {cell.map(b => (
                      <div key={b.id}
                        className={`mb-1 px-1.5 py-1 rounded text-[11px] leading-tight ${statusClassName[b.status]}`}>
                        <p className="font-medium truncate">{b.patient_name}</p>
                        <p className="truncate opacity-75">{b.service_name}</p>
                      </div>
                    ))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

const RANGE_DAYS = 14

export function AppointmentsView({ clinicId }: { clinicId: string }) {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [rangeStart, setRangeStart] = useState(todayStr())
  const [items, setItems] = useState<AppointmentBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const weekStart = getMondayOf(rangeStart)
  const listEnd = addDays(rangeStart, RANGE_DAYS - 1)
  const weekEnd = addDays(weekStart, 6)
  const fetchStart = viewMode === 'calendar' ? weekStart : rangeStart
  const fetchEnd = viewMode === 'calendar' ? weekEnd : listEnd

  const load = useCallback(() => {
    if (!clinicId) { setLoading(false); return }
    setLoading(true)
    fetchAppointmentsRange(clinicId, fetchStart, fetchEnd)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clinicId, fetchStart, fetchEnd])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(b =>
    !search || b.patient_name.includes(search) || b.phone.includes(search)
  )

  // List view data
  const grouped = filtered.reduce((acc, b) => {
    ;(acc[b.date] ??= []).push(b)
    return acc
  }, {} as Record<string, AppointmentBooking[]>)
  const dates = Object.keys(grouped).sort()

  const rangeLabel = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric', calendar: 'buddhist',
    })

  function navPrev() {
    if (viewMode === 'calendar') setRangeStart(addDays(weekStart, -7))
    else setRangeStart(addDays(rangeStart, -RANGE_DAYS))
  }
  function navNext() {
    if (viewMode === 'calendar') setRangeStart(addDays(weekStart, 7))
    else setRangeStart(addDays(rangeStart, RANGE_DAYS))
  }
  function navToday() { setRangeStart(todayStr()) }

  const subtitle = viewMode === 'calendar'
    ? `${rangeLabel(weekStart)} – ${rangeLabel(weekEnd)}`
    : `${rangeLabel(rangeStart)} – ${rangeLabel(listEnd)} · ${RANGE_DAYS} วัน`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>การนัดหมาย</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === 'list' && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="ค้นหาชื่อ หรือเบอร์โทร..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
          )}

          {/* View toggle — clear search on switch so a hidden term can't silently filter */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              <LayoutList size={13} />รายการ
            </button>
            <button onClick={() => { setViewMode('calendar'); setSearch('') }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border-l border-border transition-colors cursor-pointer ${viewMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              <CalendarDays size={13} />ปฏิทิน
            </button>
          </div>

          <button onClick={navPrev}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2 cursor-pointer">
            <ChevronLeft size={14} />ก่อนหน้า
          </button>
          <button onClick={navToday}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2 cursor-pointer">
            วันนี้
          </button>
          <button onClick={navNext}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2 cursor-pointer">
            ถัดไป<ChevronRight size={14} />
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground py-8 text-center">กำลังโหลด...</p>}

      {!loading && viewMode === 'calendar' && (
        <WeekCalendar weekStart={weekStart} items={filtered} />
      )}

      {!loading && viewMode === 'list' && dates.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <CalendarDays size={32} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">ไม่มีนัดหมายในช่วงนี้</p>
        </div>
      )}

      {!loading && viewMode === 'list' && dates.map(d => (
        <div key={d} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {new Date(d + 'T00:00:00').toLocaleDateString('th-TH', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', calendar: 'buddhist',
              })}
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
