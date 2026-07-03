import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'

interface UseCollectionResult<T> {
  data: T[]
  loading: boolean
  error: Error | null
}

/**
 * Polls GET /admin/bookings?date=... every 30 seconds.
 * Drop-in replacement for the old useFirestoreCollection hook.
 */
export function useFirestoreCollection<T extends { id: string }>(
  _collectionName: string,
  constraints: { date?: string; clinicId?: string } = {},
): UseCollectionResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const cancelledRef = useRef(false)

  const date = constraints.date ?? new Date().toISOString().split('T')[0]
  const clinicId = constraints.clinicId ?? ''

  useEffect(() => {
    cancelledRef.current = false

    async function fetchData() {
      try {
        const qs = clinicId ? `date=${date}&clinic_id=${clinicId}` : `date=${date}`
        const items = await apiFetch<T[]>(`/admin/bookings?${qs}`)
        if (!cancelledRef.current) {
          setData(items)
          setLoading(false)
          setError(null)
        }
      } catch (e) {
        if (!cancelledRef.current) {
          setError(e as Error)
          setLoading(false)
        }
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => {
      cancelledRef.current = true
      clearInterval(interval)
    }
  }, [date, clinicId])

  return { data, loading, error }
}
