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

export function updateDoctor(doctorId: string, data: Partial<DoctorCreate>): Promise<void> {
  return apiFetch<void>(`/doctors/${doctorId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
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

export function fetchAllBookings<T>(clinicId: string): Promise<T[]> {
  return apiFetch<T[]>(`/admin/bookings?clinic_id=${clinicId}`)
}

export interface BookingPagedResult<T> {
  items: T[]
  total: number
}

export function fetchBookingHistory<T>(
  clinicId: string,
  page: number,
  pageSize: number,
  search: string,
): Promise<BookingPagedResult<T>> {
  const qs = new URLSearchParams({ clinic_id: clinicId, page: String(page), page_size: String(pageSize) })
  if (search) qs.set('search', search)
  return apiFetch<BookingPagedResult<T>>(`/admin/bookings/paged?${qs}`)
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

// ── Admin services (manage) ──────────────────────────────────────────────────

export interface ServiceCreate {
  name: string
  duration_min: number
  deposit_amount: number
}

export function fetchAdminServices(clinicId: string): Promise<ServiceItem[]> {
  return apiFetch<ServiceItem[]>(`/admin/services?clinic_id=${clinicId}`)
}

export function createService(clinicId: string, data: ServiceCreate): Promise<ServiceItem> {
  return apiFetch<ServiceItem>(`/admin/services?clinic_id=${clinicId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateService(serviceId: string, data: Partial<ServiceCreate>): Promise<void> {
  return apiFetch<void>(`/admin/services/${serviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteService(serviceId: string): Promise<void> {
  return apiFetch<void>(`/admin/services/${serviceId}`, { method: 'DELETE' })
}

// ── Clinic settings ───────────────────────────────────────────────────────────

export interface ClinicSettings {
  clinic_id: string
  name: string
  address: string
  phone: string
}

export function getClinicSettings(clinicId: string): Promise<ClinicSettings> {
  return apiFetch<ClinicSettings>(`/admin/clinic-settings?clinic_id=${clinicId}`)
}

export function updateClinicSettings(
  clinicId: string,
  data: Partial<Omit<ClinicSettings, 'clinic_id'>>,
): Promise<ClinicSettings> {
  return apiFetch<ClinicSettings>(`/admin/clinic-settings?clinic_id=${clinicId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// ── Appointments (multi-day) ─────────────────────────────────────────────────

export interface AppointmentBooking {
  id: string
  patient_name: string
  phone: string
  date: string
  time: string
  service_name: string
  coverage: 'cash' | 'sso' | 'universal'
  status: 'pending_slip' | 'confirmed' | 'reminded' | 'done' | 'no_show' | 'cancelled'
  deposit_amount: number
  clinic_id: string
}

export function fetchAppointmentsRange(
  clinicId: string,
  start: string,
  end: string,
): Promise<AppointmentBooking[]> {
  return apiFetch<AppointmentBooking[]>(
    `/admin/bookings/range?clinic_id=${clinicId}&start=${start}&end=${end}`,
  )
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

// ── Chat (AI / admin-override) ─────────────────────────────────────────────────

export interface ChatConversation {
  line_user_id: string
  display_name: string
  picture_url: string
  mode: 'ai' | 'admin'
  status: 'open' | 'resolved'
  needs_attention: boolean
  last_message_at: string
  last_message_preview: string
  unread_count: number
}

export interface ChatMessage {
  id: string
  direction: 'in' | 'out'
  sender: 'patient' | 'ai' | 'admin'
  text: string
  created_at: string
}

export function fetchChatConversations(clinicId: string): Promise<ChatConversation[]> {
  return apiFetch<ChatConversation[]>(`/admin/chat/conversations?clinic_id=${clinicId}`)
}

export function fetchChatMessages(lineUserId: string): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/admin/chat/conversations/${lineUserId}/messages`)
}

export function sendChatMessage(lineUserId: string, text: string): Promise<ChatConversation> {
  return apiFetch<ChatConversation>(`/admin/chat/conversations/${lineUserId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export function resolveChat(lineUserId: string): Promise<ChatConversation> {
  return apiFetch<ChatConversation>(`/admin/chat/conversations/${lineUserId}/resolve`, {
    method: 'POST',
  })
}

export function setChatMode(lineUserId: string, mode: 'ai' | 'admin'): Promise<ChatConversation> {
  return apiFetch<ChatConversation>(`/admin/chat/conversations/${lineUserId}/mode`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  })
}

// ── Booking reminders (recurring LINE "come back for a checkup" nudges) ────────
// Deliberately no clinical/treatment fields — just enough to identify who to
// remind and when. The patient books their own follow-up via the LINE bot.

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
