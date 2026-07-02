import { useEffect, useState } from 'react'
import { initLiff } from '../lib/liff'

export default function BookingPage() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initLiff()
      .then(() => setReady(true))
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) return <p style={{ color: 'red' }}>LIFF error: {error}</p>
  if (!ready) return <p>กำลังโหลด LINE LIFF…</p>

  return (
    <main style={{ padding: '1rem' }}>
      <h1>จองคิวหมอนัด</h1>
      {/* Week 3: service picker → time picker → coverage selector → slip upload */}
    </main>
  )
}
