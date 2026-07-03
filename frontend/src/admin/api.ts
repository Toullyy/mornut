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
