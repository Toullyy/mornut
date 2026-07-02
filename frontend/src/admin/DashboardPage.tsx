import { useMemo, useState } from 'react'
import { signOut } from 'firebase/auth'
import { orderBy, where } from 'firebase/firestore'
import { auth } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'
import { useFirestoreCollection } from '../hooks/useFirestore'
import AdminLogin from './AdminLogin'
import QuotaPanel from './QuotaPanel'
import { updateBookingStatus } from './api'

interface Booking {
  id: string
  patientName: string
  phone: string
  time: string
  serviceName: string
  coverage: 'cash' | 'sso' | 'universal'
  status: 'pending_slip' | 'confirmed' | 'done' | 'cancelled'
  depositAmount: number
  clinicId: string
}

// Read clinicId from URL (?clinicId=xxx) or VITE_CLINIC_ID env var
const CLINIC_ID =
  new URLSearchParams(window.location.search).get('clinicId') ||
  import.meta.env.VITE_CLINIC_ID ||
  ''

const COVERAGE_COLOR: Record<string, string> = {
  cash: '#1565C0',
  sso: '#2E7D32',
  universal: '#E65100',
}
const COVERAGE_BG: Record<string, string> = {
  cash: '#E3F2FD',
  sso: '#E8F5E9',
  universal: '#FFF3E0',
}
const COVERAGE_LABEL: Record<string, string> = {
  cash: 'เงินสด',
  sso: 'SSO',
  universal: 'UC',
}
const STATUS_COLOR: Record<string, string> = {
  pending_slip: '#E65100',
  confirmed: '#2E7D32',
  done: '#757575',
  cancelled: '#C62828',
}
const STATUS_BG: Record<string, string> = {
  pending_slip: '#FFF3E0',
  confirmed: '#E8F5E9',
  done: '#F5F5F5',
  cancelled: '#FFEBEE',
}
const STATUS_LABEL: Record<string, string> = {
  pending_slip: 'รอสลิป',
  confirmed: 'ยืนยันแล้ว',
  done: 'เสร็จแล้ว',
  cancelled: 'ยกเลิก',
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showQuota, setShowQuota] = useState(false)

  // Stable constraint reference; re-creates only when date changes
  const constraints = useMemo(
    () => [where('date', '==', date), orderBy('time', 'asc')],
    [date],
  )

  const { data: bookings, loading: bLoading, error } = useFirestoreCollection<Booking>(
    'bookings',
    constraints,
  )

  if (authLoading) return <FullPage>กำลังโหลด...</FullPage>
  if (!user) return <AdminLogin />

  const total = bookings.length
  const confirmed = bookings.filter((b) => b.status === 'confirmed').length
  const pending = bookings.filter((b) => b.status === 'pending_slip').length
  const done = bookings.filter((b) => b.status === 'done').length

  async function handleAction(bookingId: string, action: 'done' | 'cancelled') {
    setActionLoading(bookingId + action)
    try {
      await updateBookingStatus(bookingId, action)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div
        style={{
          background: '#06C755',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, flex: 1 }}>
          หมอนัด Admin
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        />
        <button
          onClick={() => signOut(auth)}
          style={{
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 8,
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ออกจากระบบ
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>
        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'ทั้งหมด', value: total, color: '#1976D2' },
            { label: 'ยืนยันแล้ว', value: confirmed, color: '#2E7D32' },
            { label: 'รอสลิป', value: pending, color: '#E65100' },
            { label: 'เสร็จแล้ว', value: done, color: '#757575' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: '#fff',
                borderRadius: 10,
                padding: '12px 20px',
                flex: '1 1 110px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              }}
            >
              <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Bookings table */}
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            overflow: 'auto',
          }}
        >
          {bLoading && <p style={{ padding: 20, color: '#888', margin: 0 }}>กำลังโหลด...</p>}
          {error && (
            <p style={{ padding: 20, color: '#d32f2f', margin: 0 }}>
              ข้อผิดพลาด: {error.message}
            </p>
          )}
          {!bLoading && !error && bookings.length === 0 && (
            <p style={{ padding: 20, color: '#888', margin: 0 }}>ไม่มีคิวในวันที่เลือก</p>
          )}
          {!bLoading && bookings.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr style={{ background: '#F8F9FA', borderBottom: '2px solid #E8E8E8' }}>
                  {['เวลา', 'ผู้ป่วย', 'บริการ', 'สิทธิ์', 'สถานะ', 'การดำเนินการ'].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 14px',
                          textAlign: 'left',
                          fontSize: 12,
                          color: '#666',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const isTerminal = b.status === 'done' || b.status === 'cancelled'
                  return (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: '1px solid #F0F0F0',
                        opacity: isTerminal ? 0.65 : 1,
                      }}
                    >
                      {/* Time */}
                      <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 15, color: '#222' }}>
                        {b.time}
                      </td>

                      {/* Patient */}
                      <td style={{ padding: '10px 14px' }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#222' }}>
                          {b.patientName}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: '#999' }}>{b.phone}</p>
                      </td>

                      {/* Service */}
                      <td style={{ padding: '10px 14px', fontSize: 14, color: '#444' }}>
                        {b.serviceName}
                      </td>

                      {/* Coverage badge */}
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            background: COVERAGE_BG[b.coverage],
                            color: COVERAGE_COLOR[b.coverage],
                            fontWeight: 700,
                            fontSize: 12,
                            padding: '3px 9px',
                            borderRadius: 20,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {COVERAGE_LABEL[b.coverage]}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            background: STATUS_BG[b.status],
                            color: STATUS_COLOR[b.status],
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 20,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {STATUS_LABEL[b.status]}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td style={{ padding: '10px 14px' }}>
                        {!isTerminal && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {b.status === 'confirmed' && (
                              <button
                                onClick={() => handleAction(b.id, 'done')}
                                disabled={actionLoading !== null}
                                style={actionBtn('#2E7D32')}
                              >
                                {actionLoading === b.id + 'done' ? '...' : 'เสร็จ'}
                              </button>
                            )}
                            <button
                              onClick={() => handleAction(b.id, 'cancelled')}
                              disabled={actionLoading !== null}
                              style={actionBtn('#C62828')}
                            >
                              {actionLoading === b.id + 'cancelled' ? '...' : 'ยกเลิก'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Quota settings — collapsible */}
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setShowQuota((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
              color: '#555',
              padding: '6px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {showQuota ? '▲' : '▼'} ตั้งค่าโควตา
          </button>

          {showQuota && CLINIC_ID && <QuotaPanel clinicId={CLINIC_ID} date={date} />}
          {showQuota && !CLINIC_ID && (
            <p style={{ color: '#d32f2f', fontSize: 13, marginTop: 8 }}>
              กรุณาระบุ VITE_CLINIC_ID ใน .env.local หรือเพิ่ม ?clinicId=xxx ใน URL
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function actionBtn(color: string): React.CSSProperties {
  return {
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '5px 11px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
  }
}

function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        color: '#888',
        fontSize: 16,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  )
}
