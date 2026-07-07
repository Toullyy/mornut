import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'

interface Props {
  value: string          // "HH:MM"
  onChange: (v: string) => void
  minHour?: number       // earliest selectable hour (default 6)
  maxHour?: number       // latest selectable hour (default 22)
}

const MINUTES = ['00', '30']

export function TimePicker({ value, onChange, minHour = 6, maxHour = 22 }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const [selHour, selMin] = value
    ? [parseInt(value.split(':')[0], 10), value.split(':')[1]]
    : [null, null]

  const [draftHour, setDraftHour] = useState<number | null>(selHour)

  // sync draft when external value changes
  useEffect(() => {
    if (value) setDraftHour(parseInt(value.split(':')[0], 10))
  }, [value])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function pickHour(h: number) {
    setDraftHour(h)
    // if minute already chosen, commit immediately; otherwise wait for minute
    if (selMin) {
      onChange(`${String(h).padStart(2, '0')}:${selMin}`)
    }
  }

  function pickMinute(m: string) {
    const h = draftHour ?? selHour ?? minHour
    onChange(`${String(h).padStart(2, '0')}:${m}`)
    setOpen(false)
  }

  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i)

  const display = value
    ? `${String(selHour).padStart(2, '0')}:${selMin}`
    : 'เลือกเวลา'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm bg-input-background border border-border rounded-lg px-3 py-2 hover:border-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-colors cursor-pointer min-w-[90px]"
      >
        <Clock size={13} className="text-muted-foreground shrink-0" />
        <span className={`font-mono font-medium ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {display}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 left-0 bg-card border border-border rounded-xl shadow-xl p-3 select-none" style={{ width: 220 }}>
          {/* Hour grid */}
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">ชั่วโมง</p>
          <div className="grid grid-cols-4 gap-1 mb-3">
            {hours.map(h => {
              const isSelected = draftHour === h
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => pickHour(h)}
                  className={[
                    'h-8 rounded-lg text-sm font-mono font-medium transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted',
                  ].join(' ')}
                >
                  {String(h).padStart(2, '0')}
                </button>
              )
            })}
          </div>

          {/* Minute row */}
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">นาที</p>
          <div className="flex gap-2">
            {MINUTES.map(m => {
              const isSelected = selMin === m && draftHour === selHour
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => pickMinute(m)}
                  className={[
                    'flex-1 h-9 rounded-lg text-sm font-mono font-semibold transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground hover:bg-muted-foreground/20',
                  ].join(' ')}
                >
                  :{m}
                </button>
              )
            })}
          </div>

          {/* Current selection hint */}
          {draftHour !== null && (
            <p className="text-center text-xs text-muted-foreground mt-2.5">
              {String(draftHour).padStart(2, '0')}:__ &nbsp;→&nbsp; เลือกนาทีด้านบน
            </p>
          )}
        </div>
      )}
    </div>
  )
}
