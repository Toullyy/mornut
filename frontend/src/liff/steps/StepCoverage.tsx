import { useEffect, useState } from 'react'
import { getQuota, type QuotaInfo } from '../../api/clinics'
import type { CoverageType } from '../../api/bookings'
import * as t from '../theme'

interface Props {
  clinicId: string
  date: string
  onSelect: (coverage: CoverageType) => void
  onBack: () => void
}

const OPTIONS: { key: CoverageType; label: string; desc: string }[] = [
  { key: 'cash',      label: 'ชำระเงินสด',       desc: 'จ่ายตามจริง' },
  { key: 'sso',       label: 'ประกันสังคม (SSO)', desc: 'สิทธิประกันสังคม' },
  { key: 'universal', label: 'บัตรทอง (UC)',       desc: 'สิทธิหลักประกันสุขภาพแห่งชาติ' },
]

export default function StepCoverage({ clinicId, date, onSelect, onBack }: Props) {
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CoverageType | null>(null)

  useEffect(() => {
    getQuota(clinicId, date)
      .then(setQuota)
      .catch(() => setQuota(null))
      .finally(() => setLoading(false))
  }, [clinicId, date])

  return (
    <div style={t.section}>
      <p style={{ ...t.small, marginBottom: 12 }}>เลือกสิทธิ์การรักษา</p>

      {loading && <p style={{ color: t.c.sub, fontSize: 14 }}>กำลังโหลดโควตา...</p>}

      {OPTIONS.map((opt) => {
        const remaining = quota?.[opt.key]?.remaining ?? null
        const full = remaining !== null && remaining <= 0
        const isSelected = selected === opt.key

        return (
          <div
            key={opt.key}
            onClick={() => !full && setSelected(opt.key)}
            style={{
              ...t.cardSelectable(isSelected),
              opacity: full ? 0.5 : 1,
              cursor: full ? 'not-allowed' : 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 600, margin: '0 0 2px', fontSize: 15 }}>{opt.label}</p>
                <p style={t.small}>{opt.desc}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                {remaining !== null && (
                  <p style={{ fontSize: 13, color: full ? t.c.danger : t.c.sub }}>
                    {full ? 'เต็มแล้ว' : `เหลือ ${remaining} สิทธิ์`}
                  </p>
                )}
                {isSelected && (
                  <span style={{ color: t.c.primary, fontWeight: 700, fontSize: 18 }}>✓</span>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <button
        style={t.btn(!selected)}
        disabled={!selected}
        onClick={() => selected && onSelect(selected)}
      >
        ถัดไป
      </button>
      <button style={t.btnOutline} onClick={onBack}>ย้อนกลับ</button>
    </div>
  )
}
