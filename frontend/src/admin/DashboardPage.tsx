import { useMemo } from 'react'
import { where } from 'firebase/firestore'
import { useFirestoreCollection } from '../hooks/useFirestore'

interface Booking {
  id: string
  patientName: string
  time: string
  coverage: 'cash' | 'sso' | 'universal'
  status: string
}

export default function DashboardPage() {
  const today = new Date().toISOString().split('T')[0]

  // Memoized so the array reference stays stable between renders
  const constraints = useMemo(() => [where('date', '==', today)], [today])

  const { data: bookings, loading, error } = useFirestoreCollection<Booking>(
    'bookings',
    constraints,
  )

  if (error) return <p style={{ color: 'red' }}>Error: {error.message}</p>
  if (loading) return <p>กำลังโหลด…</p>

  return (
    <main style={{ padding: '1.5rem' }}>
      <h1>Dashboard คลินิก — {today}</h1>
      <p>คิวทั้งหมดวันนี้: {bookings.length} รายการ</p>
      {/* Week 5: full real-time queue table with coverage colour coding */}
    </main>
  )
}
