import { useEffect, useState } from 'react'
import { getServices, type Service } from '../../api/clinics'
import * as t from '../theme'

interface Props {
  clinicId: string
  onSelect: (service: Service) => void
}

export default function StepService({ clinicId, onSelect }: Props) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getServices(clinicId)
      .then(setServices)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [clinicId])

  if (loading) return <Spinner />
  if (error) return <ErrorMsg message={error} />
  if (services.length === 0)
    return <ErrorMsg message="ไม่มีบริการในขณะนี้ กรุณาติดต่อคลินิก" />

  return (
    <div style={t.section}>
      <p style={{ ...t.small, marginBottom: 12 }}>เลือกบริการที่ต้องการนัดหมาย</p>
      {services.map((s) => (
        <div key={s.id} style={{ ...t.card, cursor: 'pointer' }} onClick={() => onSelect(s)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ ...t.h2, fontSize: 16 }}>{s.name}</p>
              <p style={t.small}>ระยะเวลา {s.duration_min} นาที</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
              <p style={{ fontWeight: 700, color: t.c.primary, fontSize: 16 }}>
                ฿{s.deposit_amount.toLocaleString()}
              </p>
              <p style={{ ...t.small, fontSize: 11 }}>มัดจำ</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: t.c.sub }}>
      กำลังโหลด...
    </div>
  )
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <div style={{ ...t.card, ...t.section, color: t.c.danger, marginTop: 16 }}>
      {message}
    </div>
  )
}
