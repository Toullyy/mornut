import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { fetchBookingHistory } from '../api'
import { Pagination } from '../ui/Pagination'
import { StatusBadge, CoverageBadge } from '../ui/StatusBadge'
import { type Booking, CLINIC_ID } from '../types'

export function PatientsView({ bookings, onBookPatient }: {
  bookings: Booking[]
  onBookPatient: (patient: { patient_name: string; phone: string }) => void
}) {
  const [tab, setTab] = useState<'directory' | 'history'>('directory')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dirPage, setDirPage] = useState(1)
  const [histPage, setHistPage] = useState(1)
  const [dirSort, setDirSort] = useState<{ key: 'name' | 'phone' | 'service'; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })
  const PAGE_SIZE = 20

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setDirPage(1) }, [search, tab])
  useEffect(() => { setHistPage(1) }, [debouncedSearch, tab])

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

  const uniquePatients = bookings.reduce((acc, b) => {
    if (!acc.find(p => p.phone === b.phone)) acc.push(b)
    return acc
  }, [] as Booking[])
  const filteredDir = uniquePatients.filter(p => p.patient_name.includes(search) || p.phone.includes(search))
  const sortedDir = [...filteredDir].sort((a, b) => {
    let cmp = 0
    if (dirSort.key === 'name') cmp = a.patient_name.localeCompare(b.patient_name, 'th')
    else if (dirSort.key === 'phone') cmp = a.phone.localeCompare(b.phone)
    else if (dirSort.key === 'service') cmp = a.service_name.localeCompare(b.service_name, 'th')
    return dirSort.dir === 'asc' ? cmp : -cmp
  })
  const paginatedDir = sortedDir.slice((dirPage - 1) * PAGE_SIZE, dirPage * PAGE_SIZE)

  function toggleDirSort(key: typeof dirSort.key) {
    setDirSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
    setDirPage(1)
  }

  function DirSortIcon({ col }: { col: typeof dirSort.key }) {
    if (dirSort.key !== col) return <ChevronUp size={11} className="opacity-20 ml-0.5" />
    return dirSort.dir === 'asc'
      ? <ChevronUp size={11} className="text-primary ml-0.5" />
      : <ChevronDown size={11} className="text-primary ml-0.5" />
  }

  const tabBtn = (id: 'directory' | 'history', label: string) => (
    <button onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
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
            <input type="text" placeholder="ค้นหาชื่อ หรือเบอร์โทร..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
        </div>

        {tab === 'directory' ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th onClick={() => toggleDirSort('name')}
                    className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                    <span className="inline-flex items-center">ชื่อ-นามสกุล<DirSortIcon col="name" /></span>
                  </th>
                  <th onClick={() => toggleDirSort('phone')}
                    className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                    <span className="inline-flex items-center">เบอร์โทร<DirSortIcon col="phone" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">สิทธิ์</th>
                  <th onClick={() => toggleDirSort('service')}
                    className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                    <span className="inline-flex items-center">บริการล่าสุด<DirSortIcon col="service" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedDir.map(p => (
                  <tr key={p.id} onClick={() => onBookPatient({ patient_name: p.patient_name, phone: p.phone })}
                    className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors cursor-pointer">
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
                  <tr key={b.id} onClick={() => onBookPatient({ patient_name: b.patient_name, phone: b.phone })}
                    className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors cursor-pointer">
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
