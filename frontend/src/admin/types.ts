export type Coverage = 'cash' | 'sso' | 'universal'
export type Status = 'pending_slip' | 'confirmed' | 'reminded' | 'done' | 'no_show' | 'cancelled'
export type NavItem =
  | 'dashboard'
  | 'appointments'
  | 'quota'
  | 'patients'
  | 'doctors'
  | 'bookingReminders'
  | 'chat'
  | 'clinicSettings'
  | 'settings'
  | 'qrcode'

export interface Booking {
  id: string
  patient_name: string
  phone: string
  date: string
  time: string
  service_name: string
  coverage: Coverage
  status: Status
  deposit_amount: number
  clinic_id: string
}

export type DaySlot = { start: string; end: string }
export type WeekSchedule = Record<number, DaySlot[]>

export const CLINIC_ID =
  new URLSearchParams(window.location.search).get('clinicId') ||
  import.meta.env.VITE_CLINIC_ID ||
  ''

export const DOCTOR_COLORS = [
  'bg-red-500', 'bg-rose-500', 'bg-pink-500', 'bg-fuchsia-500',
  'bg-purple-500', 'bg-violet-500', 'bg-indigo-500', 'bg-blue-500',
  'bg-sky-500', 'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500',
  'bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-amber-500',
  'bg-orange-500', 'bg-slate-500',
]

export const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']
export const DAY_SHORT = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']

export const coverageLabel: Record<Coverage, string> = {
  cash: 'เงินสด',
  sso: 'ประกันสังคม',
  universal: 'บัตรทอง',
}

export const coverageBadge: Record<Coverage, string> = {
  cash: 'bg-blue-50 text-blue-700 border border-blue-200',
  sso: 'bg-violet-50 text-violet-700 border border-violet-200',
  universal: 'bg-amber-50 text-amber-700 border border-amber-200',
}

export const statusClassName: Record<Status, string> = {
  pending_slip: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  reminded: 'bg-sky-50 text-sky-700 border border-sky-200',
  done: 'bg-slate-100 text-slate-500 border border-slate-200',
  no_show: 'bg-red-50 text-red-600 border border-red-200',
  cancelled: 'bg-rose-50 text-rose-500 border border-rose-200',
}

export const statusLabel: Record<Status, string> = {
  pending_slip: 'รอสลิป',
  confirmed: 'ยืนยันแล้ว',
  reminded: 'แจ้งเตือนแล้ว',
  done: 'เสร็จสิ้น',
  no_show: 'ไม่มา',
  cancelled: 'ยกเลิก',
}
