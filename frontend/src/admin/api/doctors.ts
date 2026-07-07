import { apiFetch } from '../../lib/api'

export interface DoctorTimeSlot {
  day_of_week: number
  start: string
  end: string
}

export interface Doctor {
  id: string
  clinic_id: string
  name: string
  specialty: string
  color: string
  initials: string
  shifts: DoctorTimeSlot[]
}

export interface DoctorCreate {
  name: string
  specialty: string
  color: string
  initials: string
}

export function fetchDoctors(clinicId: string): Promise<Doctor[]> {
  return apiFetch<Doctor[]>(`/doctors?clinic_id=${clinicId}`)
}

export function createDoctor(clinicId: string, data: DoctorCreate): Promise<Doctor> {
  return apiFetch<Doctor>(`/doctors?clinic_id=${clinicId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateDoctorShifts(doctorId: string, slots: DoctorTimeSlot[]): Promise<void> {
  return apiFetch<void>(`/doctors/${doctorId}/shifts`, {
    method: 'PUT',
    body: JSON.stringify(slots),
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
