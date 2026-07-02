import { useEffect, useState } from 'react'
import { setQuota, type QuotaLimits } from './api'

interface Props {
  clinicId: string
  date: string
}

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const COVERAGE = [
  { key: 'cash' as const, label: 'เงินสด', color: '#1565C0' },
  { key: 'sso' as const, label: 'ประกันสังคม', color: '#2E7D32' },
  { key: 'universal' as const, label: 'บัตรทอง', color: '#E65100' },
]

export default function QuotaPanel({ clinicId, date }: Props) {
  const [limits, setLimits] = useState<QuotaLimits>({ cash: 0, sso: 0, universal: 0 })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Fetch current limits whenever date changes
  useEffect(() => {
    fetch(`${BASE}/quotas/${clinicId}/${date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setLimits({
            cash: data.cash?.limit ?? 0,
            sso: data.sso?.limit ?? 0,
            universal: data.universal?.limit ?? 0,
          })
        }
      })
      .catch(() => {/* network error — keep zero defaults */})
  }, [clinicId, date])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await setQuota(clinicId, date, limits)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        background: '#FAFAFA',
        border: '1px solid #E0E0E0',
        borderRadius: 12,
        padding: '16px 20px',
        marginTop: 12,
      }}
    >
      <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: 14, color: '#444' }}>
        โควตาวันที่ {date}
      </p>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {COVERAGE.map(({ key, label, color }) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color, fontWeight: 700 }}>{label}</span>
            <input
              type="number"
              min={0}
              max={999}
              value={limits[key]}
              onChange={(e) =>
                setLimits((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value)) }))
              }
              style={{
                width: 68,
                padding: '7px 8px',
                border: `1.5px solid ${color}`,
                borderRadius: 8,
                fontSize: 16,
                textAlign: 'center',
                fontWeight: 700,
                color,
                outline: 'none',
              }}
            />
          </div>
        ))}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saved ? '#2E7D32' : '#06C755',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '9px 22px',
            fontSize: 14,
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-end',
          }}
        >
          {saving ? 'กำลังบันทึก...' : saved ? '✓ บันทึกแล้ว' : 'บันทึก'}
        </button>
      </div>

      {error && (
        <p style={{ color: '#d32f2f', fontSize: 13, marginTop: 10 }}>{error}</p>
      )}
    </div>
  )
}
