import { useEffect, useState } from 'react'
import { clearToken, getToken } from '../lib/api'

export interface AuthUser {
  email: string
}

function decodeToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.sub) return null
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
