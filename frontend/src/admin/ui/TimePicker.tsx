import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'

interface Props {
  value: string            // "HH:MM"
  onChange: (v: string) => void
  minHour?: number         // earliest hour shown (default 6)
  maxHour?: number         // latest hour shown (default 22)
  minTime?: string         // "HH:MM" lower bound (exclusive by default)
  minTimeInclusive?: boolean // if true, minTime itself is selectable (default false)
  maxTime?: string         // "HH:MM" upper bound (inclusive)
  invalid?: boolean        // show red border
}

const MINUTES = ['00', '30']

function parseHM(t: string): [number, number] {
  const [h, m] = t.split(':')
  return [parseInt(h, 10), parseInt(m, 10)]
}

export function TimePicker({
  value, onChange,
  minHour = 6, maxHour = 22,
  minTime, minTimeInclusive = false,
  maxTime, invalid,
}: Props) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})

  const [selHour, selMin] = value
    ? [parseInt(value.split(':')[0], 10), value.split(':')[1]]
    : [null, null]

  const [minH, minM] = minTime ? parseHM(minTime) : [minHour, minTimeInclusive ? 0 : -1]
  const [maxH, maxM] = maxTime ? parseHM(maxTime) : [maxHour, 60]

  const [draftHour, setDraftHour] = useState<number | null>(selHour)

  // Keep draftHour in sync when value changes externally
  useEffect(() => {
    setDraftHour(value ? parseInt(value.split(':')[0], 10) : null)
  }, [value])

  // Reset draftHour when minTime/maxTime change so stale hours don't freeze the minute section
  useEffect(() => {
    setDraftHour(prev => {
      if (prev === null) return prev
      if (prev < minH || prev > maxH) return null
      return prev
    })
  }, [minH, maxH, minM, maxM])

  // Position popover below (or above if no room) the trigger button
  useEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const popoverH = 270
    const top = spaceBelow >= popoverH ? r.bottom + 6 : r.top - popoverH - 6
    setPopoverStyle({ position: 'fixed', top, left: r.left, width: 220, zIndex: 9999 })
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    function onScroll() { setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function isHourDisabled(h: number): boolean {
    return h < minH || h > maxH
  }

  function isMinuteDisabled(m: string): boolean {
    const activeH = draftHour ?? selHour ?? minH
    const mInt = parseInt(m, 10)
    if (activeH < minH) return true
    if (activeH === minH) {
      // minTimeInclusive → allow the exact minute; otherwise block it
      if (minTimeInclusive ? mInt < minM : mInt <= minM) return true
    }
    if (activeH > maxH) return true
    if (activeH === maxH && mInt > maxM) return true
    return false
  }

  function pickHour(h: number) {
    if (isHourDisabled(h)) return
    setDraftHour(h)
    // auto-commit if the current minute is still valid with the new hour
    if (selMin !== null && !isMinuteDisabledForHour(h, selMin)) {
      onChange(`${String(h).padStart(2, '0')}:${selMin}`)
    }
  }

  // isMinuteDisabled variant that uses a specific hour (not draftHour)
  function isMinuteDisabledForHour(h: number, m: string): boolean {
    const mInt = parseInt(m, 10)
    if (h < minH) return true
    if (h === minH) {
      if (minTimeInclusive ? mInt < minM : mInt <= minM) return true
    }
    if (h > maxH) return true
    if (h === maxH && mInt > maxM) return true
    return false
  }

  function pickMinute(m: string) {
    if (isMinuteDisabled(m)) return
    const h = draftHour ?? selHour ?? minH
    onChange(`${String(h).padStart(2, '0')}:${m}`)
    setOpen(false)
  }

  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i)
  const needsMinutePick = draftHour !== null && (
    selHour !== draftHour || selMin === null
  )

  const display = value
    ? `${String(selHour).padStart(2, '0')}:${selMin}`
    : 'เลือกเวลา'

  const popover = open ? createPortal(
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="bg-card border border-border rounded-xl shadow-xl p-3 select-none"
    >
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

      {needsMinutePick && (
        <p className="text-center text-xs text-muted-foreground mt-2.5">
          {String(draftHour).padStart(2, '0')}:__ &nbsp;→&nbsp; เลือกนาทีด้านบน
        </p>
      )}
    </div>,
    document.body
  ) : null

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
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
      {popover}
    </div>
  )
}
