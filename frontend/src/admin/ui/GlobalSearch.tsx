import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { type Booking } from '../types'
import { StatusBadge } from './StatusBadge'

export function GlobalSearch({ bookings, onSelect, onClose }: {
  bookings: Booking[]
  onSelect: (name: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const results = q.trim().length > 0
    ? bookings.filter(b =>
        b.patient_name.includes(q) || b.phone.includes(q.replace(/\D/g, ''))
      ).slice(0, 8)
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="ค้นหาชื่อผู้ป่วยหรือเบอร์โทร..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {q && (
            <button onClick={() => setQ('')} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
            ESC
          </kbd>
        </div>

        {results.length > 0 ? (
          <div className="py-1.5">
            {results.map(b => (
              <button
                key={b.id}
                onClick={() => onSelect(b.patient_name)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-left transition-colors cursor-pointer">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {b.patient_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{b.patient_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{b.phone} · {b.time} · {b.service_name}</p>
                </div>
                <StatusBadge status={b.status} />
              </button>
            ))}
          </div>
        ) : q.trim().length > 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">ไม่พบผู้ป่วยที่ค้นหา</div>
        ) : (
          <div className="px-4 py-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">คิววันนี้ทั้งหมด</p>
            <p className="text-sm text-muted-foreground">พิมพ์ชื่อหรือเบอร์โทรเพื่อค้นหา</p>
          </div>
        )}

        <div className="px-4 py-2.5 border-t border-border flex items-center gap-3 text-[11px] text-muted-foreground">
          <span><kbd className="bg-muted px-1 rounded font-mono">Enter</kbd> เปิด</span>
          <span><kbd className="bg-muted px-1 rounded font-mono">Esc</kbd> ปิด</span>
        </div>
      </div>
    </div>
  )
}
