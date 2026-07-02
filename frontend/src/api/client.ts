import { liff } from '../lib/liff'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

function getToken(): string | null {
  try {
    return liff.getAccessToken()
  } catch {
    return null
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { detail?: string }).detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}
