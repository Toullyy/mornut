import { collection, onSnapshot, query, QueryConstraint } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'

interface UseCollectionResult<T> {
  data: T[]
  loading: boolean
  error: Error | null
}

/**
 * Real-time Firestore collection listener.
 * Re-subscribes whenever `collectionName` changes.
 * Pass stable `constraints` (memoised with useMemo) to avoid churn.
 */
export function useFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): UseCollectionResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const q = query(collection(db, collectionName), ...constraints)
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T))
        setLoading(false)
      },
      (err) => {
        setError(err as Error)
        setLoading(false)
      },
    )
    return unsubscribe
    // constraints MUST be memoised by the caller (useMemo) so this dep is stable
  }, [collectionName, constraints])

  return { data, loading, error }
}
