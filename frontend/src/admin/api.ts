import { apiFetch } from '../lib/api'

export interface QuotaLimits {
  cash: number
  sso: number
  universal: number
}

export function setQuota(clinicId: string, date: string, limits: QuotaLimits): Promise<void> {
  return apiFetch<void>(`/quotas/${clinicId}/${date}`, {
    method: 'PUT',
    body: JSON.stringify(limits),
  })
}

export function updateBookingStatus(bookingId: string, status: 'done' | 'cancelled'): Promise<void> {
  return apiFetch<void>(`/admin/bookings/${bookingId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

// ── Doctor types ──────────────────────────────────────────────────────────────

export interface DoctorShift {
  day_of_week: number
  morning: boolean
  afternoon: boolean
}

export interface Doctor {
  id: string
  clinic_id: string
  name: string
  specialty: string
  color: string
  initials: string
  shifts: DoctorShift[]
}

export interface DoctorCreate {
  name: string
  specialty: string
  color: string
  initials: string
}

// ── Doctor API ────────────────────────────────────────────────────────────────

export function fetchDoctors(clinicId: string): Promise<Doctor[]> {
  return apiFetch<Doctor[]>(`/doctors?clinic_id=${clinicId}`)
}

export function createDoctor(clinicId: string, data: DoctorCreate): Promise<Doctor> {
  return apiFetch<Doctor>(`/doctors?clinic_id=${clinicId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateDoctorShifts(doctorId: string, shifts: DoctorShift[]): Promise<void> {
  return apiFetch<void>(`/doctors/${doctorId}/shifts`, {
    method: 'PUT',
    body: JSON.stringify(shifts),
  })
}

export function deleteDoctor(doctorId: string): Promise<void> {
  return apiFetch<void>(`/doctors/${doctorId}`, { method: 'DELETE' })
}

// ── Admin queue ───────────────────────────────────────────────────────────────

export interface AdminBookingCreate {
  patient_name: string
  phone: string
  service_id: string
  service_name: string
  date: string
  time: string
  coverage: 'cash' | 'sso' | 'universal'
  deposit_amount: number
  clinic_id: string
}

export function createAdminBooking(data: AdminBookingCreate): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/admin/bookings', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ── Clinic resources ──────────────────────────────────────────────────────────

export interface ServiceItem {
  id: string
  name: string
  duration_min: number
  deposit_amount: number
}

export interface SlotItem {
  time: string
  available: number
}

export function fetchServices(clinicId: string): Promise<ServiceItem[]> {
  return apiFetch<ServiceItem[]>(`/clinics/${clinicId}/services`)
}

export function fetchSlots(clinicId: string, date: string): Promise<SlotItem[]> {
  return apiFetch<SlotItem[]>(`/clinics/${clinicId}/slots/${date}`)
}

// ── LINE OA settings ────────────────────────────────────────────────────────────

export interface LineOABot {
  userId: string
  displayName: string
  pictureUrl: string
}

export interface LineOASettings {
  has_credentials: boolean
  connected: boolean
  bot: LineOABot | null
  webhook_url: string
  webhook_active: boolean
  rich_menu_id: string
  masked_token: string
}

export function getLineSettings(clinicId: string): Promise<LineOASettings> {
  return apiFetch<LineOASettings>(`/admin/line-oa/settings?clinic_id=${clinicId}`)
}

export function saveLineCredentials(
  clinicId: string,
  channelSecret: string,
  channelAccessToken: string,
): Promise<LineOASettings> {
  return apiFetch<LineOASettings>('/admin/line-oa/settings', {
    method: 'POST',
    body: JSON.stringify({
      clinic_id: clinicId,
      channel_secret: channelSecret,
      channel_access_token: channelAccessToken,
    }),
  })
}

export function enableWebhook(clinicId: string, webhookUrl: string): Promise<LineOASettings> {
  return apiFetch<LineOASettings>('/admin/line-oa/webhook', {
    method: 'POST',
    body: JSON.stringify({ clinic_id: clinicId, webhook_url: webhookUrl }),
  })
}

export function setupRichMenu(clinicId: string): Promise<LineOASettings> {
  return apiFetch<LineOASettings>('/admin/line-oa/rich-menu', {
    method: 'POST',
    body: JSON.stringify({ clinic_id: clinicId }),
  })
}

export function deleteRichMenu(clinicId: string): Promise<LineOASettings> {
  return apiFetch<LineOASettings>(`/admin/line-oa/rich-menu?clinic_id=${clinicId}`, {
    method: 'DELETE',
  })
}
