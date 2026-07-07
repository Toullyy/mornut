import { apiFetch } from '../../lib/api'

export interface BookingReminder {
  id: string
  clinic_id: string
  patient_line_id: string
  patient_name: string
  patient_phone: string
  interval_days: number
  next_reminder_date: string
  status: 'active' | 'stopped'
  last_reminded_at: string | null
  created_at: string
  updated_at: string
}

export interface LinePatient {
  patient_line_id: string
  patient_name: string
  phone: string
}

export interface BookingReminderCreate {
  patient_line_id: string
  patient_name: string
  patient_phone?: string
  interval_days: number
  start_date: string
  clinic_id?: string
}

export interface BookingReminderUpdate {
  interval_days?: number
  next_reminder_date?: string
  status?: 'active' | 'stopped'
}

export function fetchBookingReminders(clinicId: string): Promise<BookingReminder[]> {
  return apiFetch<BookingReminder[]>(`/admin/booking-reminders?clinic_id=${clinicId}`)
}

export function fetchLinePatients(clinicId: string): Promise<LinePatient[]> {
  return apiFetch<LinePatient[]>(`/admin/booking-reminders/patients?clinic_id=${clinicId}`)
}

export function createBookingReminder(data: BookingReminderCreate): Promise<BookingReminder> {
  return apiFetch<BookingReminder>('/admin/booking-reminders', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateBookingReminder(
  reminderId: string,
  data: BookingReminderUpdate,
): Promise<BookingReminder> {
  return apiFetch<BookingReminder>(`/admin/booking-reminders/${reminderId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export interface NotificationSettings {
  reminder_enabled: boolean
  reminder_days_before: number
  reminder_time: string
  cancel_ttl_minutes: number
}

export function getNotificationSettings(clinicId: string): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>(`/admin/notification-settings?clinic_id=${clinicId}`)
}

export function saveNotificationSettings(
  clinicId: string,
  data: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>(`/admin/notification-settings?clinic_id=${clinicId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function triggerRemindersNow(clinicId: string): Promise<{ reminders_sent: number }> {
  return apiFetch<{ reminders_sent: number }>(
    `/admin/reminders/trigger-now?clinic_id=${clinicId}`,
    { method: 'POST' },
  )
}

export interface CoverageSettings {
  sso_enabled: boolean
  sso_deposit_required: boolean
  sso_deposit_amount: number
  universal_enabled: boolean
  universal_deposit_required: boolean
  universal_deposit_amount: number
  cash_deposit_required: boolean
  cash_deposit_amount: number
}

export function getCoverageSettings(clinicId: string): Promise<CoverageSettings> {
  return apiFetch<CoverageSettings>(`/admin/coverage-settings?clinic_id=${clinicId}`)
}

export function saveCoverageSettings(
  clinicId: string,
  data: Partial<CoverageSettings>,
): Promise<CoverageSettings> {
  return apiFetch<CoverageSettings>(`/admin/coverage-settings?clinic_id=${clinicId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
