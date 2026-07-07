import { BadgeCheck, Bell, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { type Coverage, type Status, statusClassName, statusLabel } from '../types'

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

// Coverage uses compact icons instead of colorful badges to reduce visual noise
const coverageIcon: Record<Coverage, string> = {
  cash: '💵',
  sso: '🏥',
  universal: '🪪',
}

const coverageText: Record<Coverage, string> = {
  cash: 'เงินสด',
  sso: 'ประกันสังคม',
  universal: 'บัตรทอง',
}

export function CoverageBadge({ coverage }: { coverage: Coverage }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span>{coverageIcon[coverage]}</span>
      <span>{coverageText[coverage]}</span>
    </span>
  )
}
