import { useState } from 'react'
import { Save } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { setQuota, type QuotaLimits } from '../api'
import { CLINIC_ID } from '../types'

export function QuotaView({ date }: { date: string }) {
  const [editing, setEditing] = useState(false)
  const [quotaValues, setQuotaValues] = useState<QuotaLimits>({ cash: 10, sso: 8, universal: 12 })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const loadQuota = async () => {
    if (!CLINIC_ID) return
    try {
      const data = await apiFetch<{ cash?: { limit: number }; sso?: { limit: number }; universal?: { limit: number } }>(
        `/quotas/${CLINIC_ID}/${date}`,
      )
      setQuotaValues({
        cash: data.cash?.limit ?? 10,
        sso: data.sso?.limit ?? 8,
        universal: data.universal?.limit ?? 12,
      })
    } catch { /* keep defaults */ }
  }

  const handleSave = async () => {
    if (!CLINIC_ID) return
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await setQuota(CLINIC_ID, date, quotaValues)
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>จัดการโควตา</h1>
        <p className="text-sm text-muted-foreground mt-0.5">ตั้งเพดานจำนวนคิวต่อสิทธิ์รายวัน</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            โควตาวันที่ {new Date(date + 'T12:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </h2>
          {!editing ? (
            <button onClick={() => { loadQuota(); setEditing(true) }} className="text-sm text-primary font-medium hover:underline cursor-pointer">แก้ไข</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving}
                className="text-sm bg-primary text-primary-foreground font-medium px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer">
                <Save size={13} />{saving ? 'กำลังบันทึก...' : saved ? 'บันทึกแล้ว' : 'บันทึก'}
              </button>
            </div>
          )}
        </div>

        {!CLINIC_ID && (
          <p className="text-sm text-destructive mb-4">กรุณาระบุ VITE_CLINIC_ID ใน .env.local หรือเพิ่ม ?clinicId=xxx ใน URL</p>
        )}

        <div className="grid grid-cols-3 gap-4">
          {([
            { key: 'cash' as const, label: 'เงินสด', color: 'bg-blue-500', textColor: 'text-blue-600' },
            { key: 'sso' as const, label: 'ประกันสังคม', color: 'bg-violet-500', textColor: 'text-violet-600' },
            { key: 'universal' as const, label: 'บัตรทอง', color: 'bg-amber-500', textColor: 'text-amber-600' },
          ]).map(({ key, label, color, textColor }) => (
            <div key={key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className={`text-sm font-medium ${textColor}`}>{label}</span>
              </div>
              {editing ? (
                <input type="number" value={quotaValues[key]}
                  onChange={e => setQuotaValues(v => ({ ...v, [key]: Math.max(0, Number(e.target.value)) }))}
                  className="text-2xl font-bold bg-input-background border border-border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-ring/30"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }} min={0} max={99} />
              ) : (
                <p className="text-3xl font-bold text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {quotaValues[key]}<span className="text-sm font-normal text-muted-foreground ml-1">คิว/วัน</span>
                </p>
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive mt-4">{error}</p>}
      </div>
    </div>
  )
}
