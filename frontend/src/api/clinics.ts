import { apiFetch } from './client'

export interface Service {
  id: string
  name: string
  duration_min: number
  deposit_amount: number
}

export interface Slot {
  time: string
  available: number
}

export interface CoverageQuota {
  limit: number
  used: number
  remaining: number
}

export interface QuotaInfo {
  cash: CoverageQuota
  sso: CoverageQuota
  universal: CoverageQuota
}

export const getServices = (clinicId: string) =>
  apiFetch<Service[]>(`/clinics/${clinicId}/services`)

export const getSlots = (clinicId: string, date: string) =>
  apiFetch<Slot[]>(`/clinics/${clinicId}/slots/${date}`)

export const getQuota = (clinicId: string, date: string) =>
  apiFetch<QuotaInfo>(`/clinics/${clinicId}/quotas/${date}`)
