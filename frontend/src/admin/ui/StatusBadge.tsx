import { BadgeCheck, Bell, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { type Coverage, type Status, coverageBadge, coverageLabel, statusClassName, statusLabel } from '../types'

const statusIcon: Record<Status, React.ReactNode> = {
  pending_slip: <Clock size={11} />,
  confirmed: <CheckCircle2 size={11} />,
  reminded: <Bell size={11} />,
  done: <BadgeCheck size={11} />,
  no_show: <XCircle size={11} />,
  cancelled: <XCircle size={11} />,
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusClassName[status]}`}>
      {statusIcon[status]}{statusLabel[status]}
    </span>
  )
}

export function CoverageBadge({ coverage }: { coverage: Coverage }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${coverageBadge[coverage]}`}>
      {coverageLabel[coverage]}
    </span>
  )
}
