import { apiFetch } from './client'

export type CoverageType = 'cash' | 'sso' | 'universal'

export interface BookingPayload {
  clinic_id: string
  patient_line_id: string
  patient_name: string
  phone: string
  service_id: string
  service_name: string
  deposit_amount: number
  date: string
  time: string
  coverage: CoverageType
}

export interface BookingResult {
  id: string
  status: string
  date: string
  time: string
  coverage: CoverageType
  patient_name: string
  patient_line_id: string
  clinic_id: string
  service_id: string
  service_name: string
  deposit_amount: number
  phone: string
  created_at: string
  updated_at: string
}

export const createBooking = (payload: BookingPayload) =>
  apiFetch<BookingResult>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
