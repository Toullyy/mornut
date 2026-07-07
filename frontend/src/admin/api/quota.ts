import { apiFetch } from '../../lib/api'

export interface QuotaLimits {
  cash: number
  sso: number
  universal: number
}

export interface QuotaInfo {
  cash: { limit: number; used: number; remaining: number }
  sso: { limit: number; used: number; remaining: number }
  universal: { limit: number; used: number; remaining: number }
}

export function fetchQuota(clinicId: string, date: string): Promise<QuotaInfo> {
  return apiFetch<QuotaInfo>(`/quotas/${clinicId}/${date}`)
}

export function setQuota(clinicId: string, date: string, limits: QuotaLimits): Promise<void> {
  return apiFetch<void>(`/quotas/${clinicId}/${date}`, {
    method: 'PUT',
    body: JSON.stringify(limits),
  })
}
