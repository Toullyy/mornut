import { apiFetch } from '../../lib/api'

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
