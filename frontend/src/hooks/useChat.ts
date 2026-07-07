import { useCallback, useEffect, useRef, useState } from 'react'
import { getToken } from '../lib/api'
import {
  fetchChatConversations,
  fetchChatMessages,
  type ChatConversation,
  type ChatMessage,
} from '../admin/api'

/** Polls the chat inbox list every 5s, following the pattern in hooks/useFirestore.ts. */
export function useChatConversations(clinicId: string) {
  const [data, setData] = useState<ChatConversation[]>([])
  const [loading, setLoading] = useState(true)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    async function fetchData() {
      if (!getToken()) {
        setLoading(false)
        return
      }
      try {
        const items = await fetchChatConversations(clinicId)
        if (!cancelledRef.current) {
          setData(items)
          setLoading(false)
        }
      } catch {
        if (!cancelledRef.current) setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5_000)
    return () => {
      cancelledRef.current = true
      clearInterval(interval)
    }
  }, [clinicId])

  return { data, loading }
}

/** Polls a single conversation's messages every 3s while a thread is open. */
export function useChatMessages(lineUserId: string | null) {
  const [data, setData] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const cancelledRef = useRef(false)

  const refetch = useCallback(async () => {
    if (!lineUserId || !getToken()) return
    try {
      const items = await fetchChatMessages(lineUserId)
      if (!cancelledRef.current) setData(items)
    } catch {
      /* keep last known messages on transient errors */
    }
  }, [lineUserId])

  useEffect(() => {
    cancelledRef.current = false
    setData([])
    if (!lineUserId) {
      setLoading(false)
      return
    }
    setLoading(true)

    async function fetchData() {
      await refetch()
      if (!cancelledRef.current) setLoading(false)
    }

    fetchData()
    const interval = setInterval(refetch, 3_000)
    return () => {
      cancelledRef.current = true
      clearInterval(interval)
    }
  }, [lineUserId, refetch])

  return { data, loading, refetch }
}
