import { useEffect, useState } from 'react'
import { clearToken, getToken } from '../lib/api'

export interface AuthUser {
  email: string
}

function decodeToken(token: string): AuthUser | null {
  try {
    // JWT uses base64url — replace url-safe chars before decoding
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64))
    if (!payload.sub) return null
    // Reject already-expired tokens so we don't reach the API just to get 401
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    return { email: payload.sub as string }
  } catch {
    return null
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (token) {
      const u = decodeToken(token)
      if (u) {
        setUser(u)
      } else {
        clearToken()
      }
    }
    setLoading(false)
  }, [])

  function logout() {
    clearToken()
    setUser(null)
    window.location.reload()
  }

  function onLogin(user: AuthUser) {
    setUser(user)
  }

  return { user, loading, logout, onLogin }
}
