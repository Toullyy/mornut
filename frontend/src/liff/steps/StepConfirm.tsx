import { useState } from 'react'
import { createBooking } from '../../api/bookings'
import type { FormData } from '../BookingPage'
import * as t from '../theme'

interface Props {
  form: FormData
  clinicId: string
  lineUserId: string
  onSuccess: (bookingId: string) => void
  onBack: () => void
}

const COVERAGE_LABEL: Record<string, string> = {
  cash: 'ชำระเงินสด',
  sso: 'ประกันสังคม (SSO)',
  universal: 'บัตรทอง (UC)',
}

export default function StepConfirm({ form, clinicId, lineUserId, onSuccess, onBack }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const result = await createBooking({
        clinic_id: clinicId,
        patient_line_id: lineUserId,
        patient_name: form.patientName,
        phone: form.phone,
        service_id: form.serviceId,
        date: form.date,
        time: form.time,
        coverage: form.coverage,
      })
      onSuccess(result.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const rows: [string, string][] = [
    ['บริการ', form.serviceName],
    ['วันที่', form.date],
    ['เวลา', `${form.time} น.`],
    ['สิทธิ์', COVERAGE_LABEL[form.coverage]],
    ['ชื่อ', form.patientName],
    ['เบอร์โทร', form.phone],
    ['ยอดมัดจำ', `฿${form.depositAmount.toLocaleString()}`],
  ]

  return (
    <div style={t.section}>
      <p style={{ ...t.small, marginBottom: 12 }}>ตรวจสอบข้อมูลก่อนยืนยัน</p>

      <div style={t.card}>
        {rows.map(([label, value]) => (
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
            <span style={{ fontWeight: 600, fontSize: 14, textAlign: 'right', maxWidth: '60%' }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ ...t.card, color: t.c.danger, fontSize: 14, marginTop: 0 }}>{error}</div>
      )}

      <button style={t.btn(loading)} disabled={loading} onClick={handleSubmit}>
        {loading ? 'กำลังจอง...' : 'ยืนยันการจอง'}
      </button>
      <button style={t.btnOutline} onClick={onBack} disabled={loading}>
        ย้อนกลับ
      </button>
    </div>
  )
}
