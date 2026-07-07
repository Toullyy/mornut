import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Bell, CalendarDays, Clock, ClipboardList,
  LayoutDashboard, MapPin, MessageCircle, Search, Settings2,
  ShieldCheck, Stethoscope, UserCheck, Users,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useBookings } from '../hooks/useBookings'
import { updateBookingStatus } from './api'
import AdminLogin from './AdminLogin'
import { type NavItem, type Booking, CLINIC_ID } from './types'
import { GlobalSearch } from './ui/GlobalSearch'
import { DashboardView, AddQueueModal } from './views/DashboardView'
import { QuotaView } from './views/QuotaView'
import { DoctorsView } from './views/DoctorsView'
import { PatientsView } from './views/PatientsView'
import { AppointmentsView } from './views/AppointmentsView'
import { BookingRemindersView } from './views/BookingRemindersView'
import { ChatView } from './views/ChatView'
import { ClinicSettingsView } from './views/ClinicSettingsView'
import { SettingsView } from './views/SettingsView'

function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center items-center min-h-screen text-muted-foreground text-base">
      {children}
    </div>
  )
}

// ── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading: authLoading, logout, onLogin } = useAuth()
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [addQueueModal, setAddQueueModal] = useState<{ prefill?: { patient_name: string; phone: string } } | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [externalSearch, setExternalSearch] = useState<string | undefined>(undefined)

  const constraints = useMemo(() => ({ date, clinicId: CLINIC_ID }), [date])
  const { data: bookings, loading: bLoading, error, refetch } = useBookings<Booking>(constraints)

  // Ctrl+K / Cmd+K opens global search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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

  function handleSearchSelect(name: string) {
    setExternalSearch(name)
    setActiveNav('dashboard')
    setSearchOpen(false)
    // Clear externalSearch after a tick so the DashboardView can pick it up, then own its own search state
    setTimeout(() => setExternalSearch(undefined), 100)
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
      {addQueueModal && (
        <AddQueueModal
          date={date}
          clinicId={CLINIC_ID}
          prefill={addQueueModal.prefill}
          onClose={() => setAddQueueModal(null)}
          onCreated={() => { setAddQueueModal(null); refetch() }}
        />
      )}

      {searchOpen && (
        <GlobalSearch
          bookings={bookings}
          onSelect={handleSearchSelect}
          onClose={() => setSearchOpen(false)}
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

        {/* Compact search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="mx-3 mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 hover:bg-muted border border-border px-3 py-2 rounded-lg transition-colors cursor-pointer">
          <Search size={12} />
          <span className="flex-1 text-left">ค้นหา...</span>
          <kbd className="text-[10px] bg-background px-1 rounded font-mono">⌘K</kbd>
        </button>

        <div className="mx-4 mt-3 mb-2 px-3 py-2.5 bg-secondary rounded-lg border border-border">
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
            <button key={item.id} onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left cursor-pointer ${
                activeNav === item.id ? 'bg-primary text-white font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}>
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
              <button onClick={logout} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer">ออกจากระบบ</button>
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
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground border border-border bg-muted/30 hover:bg-muted px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
              <Search size={12} />ค้นหา
              <kbd className="text-[10px] bg-card px-1 rounded font-mono">⌘K</kbd>
            </button>
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
              externalSearch={externalSearch}
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
