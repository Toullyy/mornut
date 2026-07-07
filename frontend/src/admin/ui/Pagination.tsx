import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  total: number
  pageSize: number
  onChange: (p: number) => void
}

export function Pagination({ page, total, pageSize, onChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  const btn = 'min-w-[2rem] h-8 px-1 flex items-center justify-center rounded-lg text-xs font-medium transition-colors cursor-pointer'

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 flex-wrap gap-2">
      <span className="text-xs text-muted-foreground">แสดง {from}–{to} จาก {total} รายการ</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange(page - 1)}
            disabled={page === 1}
            className={`${btn} ${page === 1 ? 'opacity-40' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            <ChevronLeft size={14} />
          </button>
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="min-w-[2rem] h-8 flex items-center justify-center text-xs text-muted-foreground">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p as number)}
                className={`${btn} ${p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onChange(page + 1)}
            disabled={page === totalPages}
            className={`${btn} ${page === totalPages ? 'opacity-40' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
