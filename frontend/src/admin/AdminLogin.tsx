import { useState } from 'react'
import { Activity } from 'lucide-react'
import { apiFetch, setToken } from '../lib/api'
import type { AuthUser } from '../hooks/useAuth'

interface Props {
  onLogin: (user: AuthUser) => void
}

const IS_DEV = import.meta.env.DEV

export default function AdminLogin({ onLogin }: Props) {
  const [channelSecret, setChannelSecret] = useState('')
  const [channelToken, setChannelToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<{ access_token: string; bot: { userId: string } }>(
        '/admin/line-oa/connect',
        {
          method: 'POST',
          body: JSON.stringify({
            channel_secret: channelSecret,
            channel_access_token: channelToken,
          }),
        },
      )
      setToken(res.access_token)
      onLogin({ email: res.bot.userId })
    } catch (err) {
      setError((err as Error).message || 'ข้อมูลไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  async function handleDevLogin() {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<{ access_token: string; bot: { userId: string } }>(
        '/admin/line-oa/dev-connect',
        {
          method: 'POST',
          body: JSON.stringify({ channel_secret: 'dev', channel_access_token: 'dev' }),
        },
      )
      setToken(res.access_token)
      onLogin({ email: 'dev-admin' })
    } catch (err) {
      setError((err as Error).message || 'Dev bypass ไม่ทำงาน — ตรวจสอบ DEBUG_MODE=true ใน .env')
    } finally {
      setLoading(false)
    }
  }

  const field =
    'w-full px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30 font-mono'

  return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      <div className="bg-card border border-border rounded-2xl p-9 w-96 shadow-lg">
        <div className="flex items-center gap-2.5 mb-7">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-foreground text-lg leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              MorNut Admin
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">เชื่อมต่อด้วย LINE OA</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Channel Secret
            </label>
            <input
              type="password"
              value={channelSecret}
              onChange={e => setChannelSecret(e.target.value)}
              placeholder="LINE channel secret"
              required
              className={field}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Channel Access Token
            </label>
            <input
              type="password"
              value={channelToken}
              onChange={e => setChannelToken(e.target.value)}
              placeholder="LINE channel access token"
              required
              className={field}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm mt-1"
          >
            {loading ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ LINE OA'}
          </button>
        </form>

        {IS_DEV && (
          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={handleDevLogin}
              disabled={loading}
              className="w-full text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg py-2.5 transition-colors disabled:opacity-50"
            >
              Dev bypass (local only)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
