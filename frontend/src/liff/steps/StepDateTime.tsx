import { useEffect, useState } from 'react'
import { getSlots, type Slot } from '../../api/clinics'
import * as t from '../theme'

interface Props {
  clinicId: string
  onSelect: (date: string, time: string) => void
  onBack: () => void
}

const today = new Date().toISOString().split('T')[0]
const maxDate = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0]

export default function StepDateTime({ clinicId, onSelect, onBack }: Props) {
  const [date, setDate] = useState(today)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotError, setSlotError] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState('')

  useEffect(() => {
    if (!date) return
    setSlots([])
    setSelectedTime('')
    setSlotError(null)
    setLoadingSlots(true)
    getSlots(clinicId, date)
      .then(setSlots)
      .catch((e: Error) => setSlotError(e.message))
      .finally(() => setLoadingSlots(false))
  }, [clinicId, date])

  const canProceed = Boolean(date && selectedTime)

  return (
    <div style={t.section}>
      {/* Date picker */}
      <span style={t.label}>เลือกวันนัดหมาย</span>
      <input
        type="date"
        min={today}
        max={maxDate}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={t.input}
      />

      {/* Time slots */}
      {date && (
        <div style={{ marginTop: 18 }}>
          <p style={t.label}>เลือกเวลา</p>
          {loadingSlots && <p style={{ color: t.c.sub, fontSize: 14 }}>กำลังโหลด...</p>}
          {slotError && <p style={{ color: t.c.danger, fontSize: 14 }}>{slotError}</p>}
          {!loadingSlots && !slotError && slots.length === 0 && (
            <p style={{ color: t.c.sub, fontSize: 14 }}>ไม่มีช่วงเวลาสำหรับวันที่เลือก</p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {slots.map((s) => {
              const disabled = s.available === 0
              const selected = selectedTime === s.time
              return (
                <button
                  key={s.time}
                  disabled={disabled}
                  onClick={() => setSelectedTime(s.time)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: `2px solid ${selected ? t.c.primary : disabled ? t.c.border : t.c.border}`,
                    background: selected ? t.c.primary : disabled ? '#f5f5f5' : t.c.white,
                    color: selected ? t.c.white : disabled ? t.c.muted : t.c.text,
                    fontWeight: selected ? 700 : 400,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: 15,
                    minWidth: 72,
                  }}
                >
                  {s.time}
                  {disabled && <span style={{ display: 'block', fontSize: 10 }}>เต็ม</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <button style={t.btn(!canProceed)} disabled={!canProceed} onClick={() => onSelect(date, selectedTime)}>
        ถัดไป
      </button>
      <button style={t.btnOutline} onClick={onBack}>ย้อนกลับ</button>
    </div>
  )
}
