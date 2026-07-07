import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

function parseYMD(s: string): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplay(s: string): string {
  const d = parseYMD(s)
  if (!d) return ''
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export interface DatePickerProps {
  value: string              // "YYYY-MM-DD"
  onChange: (val: string) => void
  min?: string               // "YYYY-MM-DD" — dates before this are disabled
  max?: string               // "YYYY-MM-DD" — dates after this are disabled
  placeholder?: string
  className?: string
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'เลือกวันที่',
  className = '',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const parsed = parseYMD(value)
  const [viewYear, setViewYear] = useState(() => (parsed ?? new Date()).getFullYear())
  const [viewMonth, setViewMonth] = useState(() => (parsed ?? new Date()).getMonth())

  // Keep calendar view in sync if controlled value changes externally
  useEffect(() => {
    const d = parseYMD(value)
    if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }
  }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const todayStr = toYMD(new Date())
  const minDate = parseYMD(min ?? '')
  const maxDate = parseYMD(max ?? '')
  const firstDow = new Date(viewYear, viewMonth, 1).getDay() // 0 = Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  function disabled(day: number): boolean {
    const d = new Date(viewYear, viewMonth, day)
    if (minDate && d < minDate) return true
    if (maxDate && d > maxDate) return true
    return false
  }

  function pick(day: number) {
    if (disabled(day)) return
    onChange(toYMD(new Date(viewYear, viewMonth, day)))
    setOpen(false)
  }

  // Leading empty cells + day numbers
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2 text-left hover:border-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-colors cursor-pointer"
      >
        <CalendarDays size={14} className="text-muted-foreground shrink-0" />
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>

      {/* Popover calendar */}
      {open && (
        <div className="absolute z-50 mt-1.5 left-0 bg-card border border-border rounded-xl shadow-xl p-3 w-72 select-none">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-foreground">
              {THAI_MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADERS.map(h => (
              <div key={h} className="text-center text-[11px] font-semibold text-muted-foreground py-1">
                {h}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />
              const dayStr = toYMD(new Date(viewYear, viewMonth, day))
              const isSelected = dayStr === value
              const isToday = dayStr === todayStr
              const isDisabled = disabled(day)
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => pick(day)}
                  className={[
                    'h-8 w-full rounded-lg text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground cursor-pointer'
                      : isToday
                        ? 'ring-1 ring-primary/40 text-primary bg-primary/8 cursor-pointer'
                        : isDisabled
                          ? 'text-muted-foreground/30 cursor-not-allowed'
                          : 'text-foreground hover:bg-muted cursor-pointer',
                  ].join(' ')}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => {
                if (!disabled(new Date().getDate()) || true) {
                  const t = new Date()
                  setViewYear(t.getFullYear())
                  setViewMonth(t.getMonth())
                  if (!disabled(t.getDate())) {
                    onChange(todayStr)
                    setOpen(false)
                  }
                }
              }}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              วันนี้
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
