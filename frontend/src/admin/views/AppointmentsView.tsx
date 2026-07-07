import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { fetchAppointmentsRange, type AppointmentBooking } from '../api'
import { StatusBadge, CoverageBadge } from '../ui/StatusBadge'

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const RANGE_DAYS = 14

export function AppointmentsView({ clinicId }: { clinicId: string }) {
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

  const filtered = items.filter(b => b.patient_name.includes(search) || b.phone.includes(search))
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
            <input type="text" placeholder="ค้นหาชื่อ หรือเบอร์โทร..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <button onClick={() => setRangeStart(addDays(rangeStart, -RANGE_DAYS))}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2">
            <ChevronLeft size={14} />ก่อนหน้า
          </button>
          <button onClick={() => setRangeStart(new Date().toISOString().split('T')[0])}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2">
            วันนี้
          </button>
          <button onClick={() => setRangeStart(addDays(rangeStart, RANGE_DAYS))}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2">
            ถัดไป<ChevronRight size={14} />
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground py-8 text-center">กำลังโหลด...</p>}
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
