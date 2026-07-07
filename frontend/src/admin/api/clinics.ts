import { apiFetch } from '../../lib/api'

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

export interface ServiceCreate {
  name: string
  duration_min: number
  deposit_amount: number
}

export interface ClinicSettings {
  clinic_id: string
  name: string
  address: string
  phone: string
  open_time: string
  close_time: string
}

export function fetchServices(clinicId: string): Promise<ServiceItem[]> {
  return apiFetch<ServiceItem[]>(`/clinics/${clinicId}/services`)
}

export function fetchSlots(clinicId: string, date: string): Promise<SlotItem[]> {
  return apiFetch<SlotItem[]>(`/clinics/${clinicId}/slots/${date}`)
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

export function getClinicSettings(clinicId: string): Promise<ClinicSettings> {
  return apiFetch<ClinicSettings>(`/admin/clinic-settings?clinic_id=${clinicId}`)
}

export function updateClinicSettings(
  clinicId: string,
  data: Partial<Omit<ClinicSettings, 'clinic_id' | 'open_time' | 'close_time'>> & { open_time?: string; close_time?: string },
): Promise<ClinicSettings> {
  return apiFetch<ClinicSettings>(`/admin/clinic-settings?clinic_id=${clinicId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
