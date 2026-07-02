import { liff } from '../lib/liff'
import type { FormData } from './BookingPage'
import * as t from './theme'

interface Props {
  bookingId: string
  form: FormData
}

const COVERAGE_LABEL: Record<string, string> = {
  cash: 'ชำระเงินสด',
  sso: 'ประกันสังคม (SSO)',
  universal: 'บัตรทอง (UC)',
}

export default function BookingSuccess({ bookingId, form }: Props) {
  const shortId = bookingId.slice(-8).toUpperCase()

  return (
    <div style={{ ...t.page, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      {/* Success icon */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: t.c.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 36,
          color: t.c.white,
          marginBottom: 16,
        }}
      >
        ✓
      </div>

      <h2 style={{ ...t.h2, marginBottom: 4 }}>จองคิวสำเร็จ!</h2>
      <p style={{ ...t.small, marginBottom: 24 }}>รหัสการจอง: {shortId}</p>

      {/* Booking summary */}
      <div style={{ ...t.card, width: '100%' }}>
        {(
          [
            ['บริการ', form.serviceName],
            ['วันที่', form.date],
            ['เวลา', `${form.time} น.`],
            ['สิทธิ์', COVERAGE_LABEL[form.coverage]],
            ['ยอดมัดจำ', `฿${form.depositAmount.toLocaleString()}`],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '7px 0',
              borderBottom: `1px solid ${t.c.border}`,
            }}
          >
            <span style={{ color: t.c.sub, fontSize: 14 }}>{label}</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Deposit instructions */}
      <div
        style={{
          width: '100%',
          background: '#fff8e1',
          border: `1px solid ${t.c.warn}`,
          borderRadius: 12,
          padding: 14,
          marginTop: 4,
          fontSize: 14,
          lineHeight: 1.6,
          color: '#5d4037',
        }}
      >
        <strong>⚠️ กรุณาชำระมัดจำ ฿{form.depositAmount.toLocaleString()} ภายใน 15 นาที</strong>
        <br />
        หลังชำระเงินกรุณาส่งหลักฐานการโอนในแชทนี้
        <br />
        <span style={{ fontSize: 12, color: t.c.sub }}>
          (ฟังก์ชันอัปโหลดสลิปจะเปิดให้บริการเร็วๆ นี้)
        </span>
      </div>

      <button
        style={{ ...t.btn(false), marginTop: 24 }}
        onClick={() => {
          try {
            liff.closeWindow()
          } catch {
            window.close()
          }
        }}
      >
        ปิดหน้าต่างนี้
      </button>
    </div>
  )
}
