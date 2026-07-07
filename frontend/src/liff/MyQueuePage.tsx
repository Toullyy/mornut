import { useEffect, useState } from 'react'
import { liff } from '../lib/liff'
import { apiFetch } from '../api/client'
import * as t from './theme'

interface Booking {
  id: string
  clinic_id: string
  patient_name: string
  service_name: string
  date: string
  time: string
  coverage: string
  status: string
  deposit_amount: number
}

const COVERAGE_TH: Record<string, string> = {
  cash: 'เงินสด',
  sso: 'ประกันสังคม (SSO)',
  universal: 'บัตรทอง (UC)',
}

const STATUS_TH: Record<string, string> = {
  confirmed: 'ยืนยันแล้ว',
  reminded: 'แจ้งเตือนแล้ว',
  pending_slip: 'รอสลิป',
}

const STATUS_COLOR: Record<string, string> = {
  confirmed: t.c.primary,
  reminded: '#3B82F6',
  pending_slip: t.c.warn,
}

export default function MyQueuePage() {
  const [inited, setInited] = useState(false)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    liff.init({ liffId: import.meta.env.VITE_LIFF_ID || '' })
      .then(() => {
        if (!liff.isLoggedIn()) liff.login()
        else setInited(true)
      })
      .catch(() => setError('ไม่สามารถเปิดใน LINE ได้'))
  }, [])

  useEffect(() => {
    if (!inited) return
    apiFetch<Booking[]>('/bookings/mine')
      .then(setBookings)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [inited])

  async function handleCancel(id: string) {
    if (!window.confirm('ต้องการยกเลิกการนัดนี้ใช่ไหม?')) return
    setCancellingId(id)
    try {
      await apiFetch<void>(`/bookings/${id}`, { method: 'DELETE' })
      setBookings(prev => prev.filter(b => b.id !== id))
    } catch (e) {
      alert(`ยกเลิกไม่สำเร็จ: ${(e as Error).message}`)
    } finally {
      setCancellingId(null)
    }
  }

  if (error) {
    return (
      <div style={{ ...t.page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ ...t.card, textAlign: 'center' }}>
          <p style={{ color: t.c.danger, fontWeight: 700 }}>เกิดข้อผิดพลาด</p>
          <p style={{ color: t.c.sub, fontSize: 14, marginTop: 6 }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={t.page}>
      {/* Header */}
      <div style={{
        background: t.c.primary, padding: '20px 16px 16px',
        color: '#fff',
      }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>คิวของฉัน</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.85 }}>นัดหมายที่กำลังรอรับบริการ</p>
      </div>

      <div style={t.section}>
        {loading && (
          <p style={{ color: t.c.sub, fontSize: 14, marginTop: 20, textAlign: 'center' }}>กำลังโหลด...</p>
        )}

        {!loading && bookings.length === 0 && (
          <div style={{ ...t.card, textAlign: 'center', marginTop: 20 }}>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>ไม่มีนัดหมายที่รอรับบริการ</p>
            <p style={{ fontSize: 13, color: t.c.sub }}>พิมพ์ 'จอง' ในแชทเพื่อจองคิวใหม่</p>
          </div>
        )}

        {bookings.map(b => (
          <div key={b.id} style={t.card}>
            {/* Status badge */}
            <div style={{ marginBottom: 10 }}>
              <span style={{
                display: 'inline-block',
                background: `${STATUS_COLOR[b.status] ?? t.c.primary}18`,
                color: STATUS_COLOR[b.status] ?? t.c.primary,
                fontSize: 12,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 20,
              }}>
                {STATUS_TH[b.status] ?? b.status}
              </span>
            </div>

            {/* Details */}
            {[
              ['บริการ', b.service_name],
              ['วันที่', b.date],
              ['เวลา', `${b.time} น.`],
              ['สิทธิ์', COVERAGE_TH[b.coverage] ?? b.coverage],
              ['มัดจำ', b.deposit_amount > 0 ? `฿${b.deposit_amount.toLocaleString()}` : 'ไม่มีมัดจำ'],
              ['รหัส', `...${b.id.slice(-8).toUpperCase()}`],
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: `1px solid ${t.c.border}`,
              }}>
                <span style={{ color: t.c.sub, fontSize: 13 }}>{label}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{value}</span>
              </div>
            ))}

            {/* Cancel button */}
            <button
              onClick={() => handleCancel(b.id)}
              disabled={cancellingId === b.id}
              style={{
                ...t.btnOutline,
                marginTop: 14,
                color: t.c.danger,
                borderColor: `${t.c.danger}40`,
                opacity: cancellingId === b.id ? 0.5 : 1,
              }}
            >
              {cancellingId === b.id ? 'กำลังยกเลิก...' : 'ยกเลิกการนัด'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
