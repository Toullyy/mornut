import { auth } from '../lib/firebase'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { detail?: string }).detail ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface QuotaLimits {
  cash: number
  sso: number
  universal: number
}

export function setQuota(clinicId: string, date: string, limits: QuotaLimits): Promise<void> {
  return adminFetch<void>(`/quotas/${clinicId}/${date}`, {
    method: 'PUT',
    body: JSON.stringify(limits),
  })
}

export function updateBookingStatus(bookingId: string, status: 'done' | 'cancelled'): Promise<void> {
  return adminFetch<void>(`/admin/bookings/${bookingId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
