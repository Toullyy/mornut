import { apiFetch } from '../../lib/api'
import type { Coverage } from '../types'

export interface AdminBookingCreate {
  patient_name: string
  phone: string
  service_id: string
  service_name: string
  date: string
  time: string
  coverage: Coverage
  deposit_amount: number
  clinic_id: string
}

export interface BookingPagedResult<T> {
  items: T[]
  total: number
}

export interface AppointmentBooking {
  id: string
  patient_name: string
  phone: string
  date: string
  time: string
  service_name: string
  coverage: Coverage
  status: 'pending_slip' | 'confirmed' | 'reminded' | 'done' | 'no_show' | 'cancelled'
  deposit_amount: number
  clinic_id: string
}

export function updateBookingStatus(bookingId: string, status: 'done' | 'cancelled'): Promise<void> {
  return apiFetch<void>(`/admin/bookings/${bookingId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function fetchAllBookings<T>(clinicId: string): Promise<T[]> {
  return apiFetch<T[]>(`/admin/bookings?clinic_id=${clinicId}`)
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

export function fetchAppointmentsRange(
  clinicId: string,
  start: string,
  end: string,
): Promise<AppointmentBooking[]> {
  return apiFetch<AppointmentBooking[]>(
    `/admin/bookings/range?clinic_id=${clinicId}&start=${start}&end=${end}`,
  )
}
