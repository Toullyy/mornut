import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'

interface Props {
  value: string          // "HH:MM"
  onChange: (v: string) => void
  minHour?: number       // earliest selectable hour (default 6)
  maxHour?: number       // latest selectable hour (default 22)
  minTime?: string       // "HH:MM" — no time at or before this is selectable
  invalid?: boolean      // show red border
}

const MINUTES = ['00', '30']

function parseHM(t: string): [number, number] {
  const [h, m] = t.split(':')
  return [parseInt(h, 10), parseInt(m, 10)]
}

export function TimePicker({ value, onChange, minHour = 6, maxHour = 22, minTime, invalid }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const [selHour, selMin] = value
    ? [parseInt(value.split(':')[0], 10), value.split(':')[1]]
    : [null, null]

  const [draftHour, setDraftHour] = useState<number | null>(selHour)

  const [minH, minM] = minTime ? parseHM(minTime) : [minHour, -1]

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

  function isHourDisabled(h: number): boolean {
    return h < minH
  }

  function isMinuteDisabled(m: string): boolean {
    const activeH = draftHour ?? selHour ?? minH
    if (activeH > minH) return false
    if (activeH < minH) return true
    return parseInt(m, 10) <= minM
  }

  function pickHour(h: number) {
    if (isHourDisabled(h)) return
    setDraftHour(h)
    if (selMin && !isMinuteDisabled(selMin)) {
      onChange(`${String(h).padStart(2, '0')}:${selMin}`)
    } else if (selMin && isMinuteDisabled(selMin)) {
      // current minute is no longer valid — clear minute by keeping draft only
    } else if (selMin) {
      onChange(`${String(h).padStart(2, '0')}:${selMin}`)
    }
  }

  function pickMinute(m: string) {
    if (isMinuteDisabled(m)) return
    const h = draftHour ?? selHour ?? minH
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
        className={[
          'flex items-center gap-2 text-sm bg-input-background border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-colors cursor-pointer min-w-[90px]',
          invalid
            ? 'border-destructive focus:ring-destructive/30'
            : 'border-border hover:border-muted-foreground/40 focus:ring-ring/30',
        ].join(' ')}
      >
        <Clock size={13} className={invalid ? 'text-destructive shrink-0' : 'text-muted-foreground shrink-0'} />
        <span className={`font-mono font-medium ${value ? (invalid ? 'text-destructive' : 'text-foreground') : 'text-muted-foreground'}`}>
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
              const disabled = isHourDisabled(h)
              return (
                <button
                  key={h}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickHour(h)}
                  className={[
                    'h-8 rounded-lg text-sm font-mono font-medium transition-colors',
                    disabled
                      ? 'text-muted-foreground/30 cursor-not-allowed'
                      : isSelected
                        ? 'bg-primary text-primary-foreground cursor-pointer'
                        : 'text-foreground hover:bg-muted cursor-pointer',
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
              const disabled = isMinuteDisabled(m)
              return (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickMinute(m)}
                  className={[
                    'flex-1 h-9 rounded-lg text-sm font-mono font-semibold transition-colors',
                    disabled
                      ? 'bg-muted text-muted-foreground/30 cursor-not-allowed'
                      : isSelected
                        ? 'bg-primary text-primary-foreground cursor-pointer'
                        : 'bg-muted text-foreground hover:bg-muted-foreground/20 cursor-pointer',
                  ].join(' ')}
                >
                  :{m}
                </button>
              )
            })}
          </div>

          {draftHour !== null && !selMin && (
            <p className="text-center text-xs text-muted-foreground mt-2.5">
              {String(draftHour).padStart(2, '0')}:__ &nbsp;→&nbsp; เลือกนาทีด้านบน
            </p>
          )}
        </div>
      )}
    </div>
  )
}
