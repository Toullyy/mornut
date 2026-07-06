import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, getToken } from '../lib/api'

interface UseBookingsResult<T> {
  data: T[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useBookings<T extends { id: string }>(
  constraints: { date?: string; clinicId?: string } = {},
): UseBookingsResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const cancelledRef = useRef(false)
  const [tick, setTick] = useState(0)

  const date = constraints.date ?? new Date().toISOString().split('T')[0]
  const clinicId = constraints.clinicId ?? ''

  useEffect(() => {
    cancelledRef.current = false
    setLoading(true)

    async function fetchData() {
      if (!getToken()) {
        setLoading(false)
        return
      }
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
  }, [date, clinicId, tick])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return { data, loading, error, refetch }
}
