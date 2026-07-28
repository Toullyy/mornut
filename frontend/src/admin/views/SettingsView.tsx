import { useEffect, useState } from 'react'
import {
  AlertCircle, Bell, CheckCircle2, CreditCard, ExternalLink, FileText, KeyRound,
  LayoutGrid, Link2, Loader2, MessageCircle, Play, Save, Settings2,
  ShieldCheck, Trash2,
} from 'lucide-react'
import {
  getLineSettings, saveLineCredentials, enableWebhook,
  setupRichMenu, deleteRichMenu, type LineOASettings,
} from '../api'
import {
  getNotificationSettings, saveNotificationSettings, triggerRemindersNow,
  getCoverageSettings, saveCoverageSettings,
  type NotificationSettings, type CoverageSettings,
} from '../api'
import { SettingsSection, SettingsRow } from '../ui/SettingsLayout'
import { Toggle } from '../ui/Toggle'
import { CLINIC_ID } from '../types'

// ── LINE OA Setup Guide ───────────────────────────────────────────────────────

const _LS_KEY = 'mornut_line_setup_manual'

function _loadManual(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(_LS_KEY) || '{}') } catch { return {} }
}

function LineOASetupGuide({ settings: s }: { settings: LineOASettings | null }) {
  // Steps 'create' and 'liff' have no backend signal — user marks them done manually.
  const [manual, setManual] = useState<Record<string, boolean>>(_loadManual)

  function toggleManual(id: string) {
    setManual(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(_LS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const ManualCheck = ({ id }: { id: string }) => (
    <button
      onClick={e => { e.stopPropagation(); toggleManual(id) }}
      className={`text-[11px] px-2 py-0.5 rounded border font-medium transition-colors ${manual[id] ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`}>
      {manual[id] ? 'ยกเลิก' : 'ทำแล้ว ✓'}
    </button>
  )

  const steps = [
    {
      id: 'create',
      // Auto-advances when credentials are saved; also manually checkable before that.
      done: !!s?.has_credentials || !!manual['create'],
      label: 'สร้าง LINE OA',
      detail: 'สร้าง Messaging API Channel บน LINE Developers Console',
      action: (
        <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
          เปิด Console <ExternalLink size={11} />
        </a>
      ),
      how: (
        <div className="space-y-2">
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>เข้าไปที่ <b>developers.line.biz</b> แล้ว login ด้วยบัญชี LINE</li>
            <li>กด <b>Create a Provider</b> ตั้งชื่อ (เช่น ชื่อคลินิก)</li>
            <li>กด <b>Create a new channel</b> → เลือก <b>Messaging API</b></li>
            <li>กรอก Channel name, Category (<em>Healthcare</em>), Subcategory</li>
            <li>กด <b>Create</b> แล้วไปที่แท็บ <b>Messaging API</b></li>
            <li>คัดลอก <b>Channel secret</b> (จาก Basic settings) และ <b>Channel access token</b> (กด Issue)</li>
          </ol>
          {!s?.has_credentials && <ManualCheck id="create" />}
        </div>
      ),
    },
    {
      id: 'connect',
      done: !!s?.connected,
      label: 'เชื่อมต่อ credentials',
      detail: 'กรอก Channel secret + Access token ในช่อง "เชื่อมต่อ LINE OA" ด้านล่าง',
      action: null,
      how: (
        <p className="text-xs text-muted-foreground">
          นำ Channel secret และ Channel access token จากขั้นตอนก่อนหน้ามากรอกในส่วน <b>เชื่อมต่อ LINE OA</b> ด้านล่างนี้ แล้วกด <b>บันทึกและเชื่อมต่อ</b>
        </p>
      ),
    },
    {
      id: 'webhook',
      done: !!s?.webhook_active,
      label: 'ตั้งค่า Webhook',
      detail: 'ชี้ LINE ไปยัง backend ของคุณ ต้องเป็น HTTPS สาธารณะ',
      action: (
        <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
          LINE Console <ExternalLink size={11} />
        </a>
      ),
      how: (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">กรอก Webhook URL ในช่อง <b>Webhook</b> ด้านล่าง (รูปแบบ <code className="bg-muted px-1 rounded">https://your-backend.com/webhook</code>) แล้วกด <b>ใช้ webhook</b></p>
          <p className="text-xs text-muted-foreground">หาก deploy บน local ให้ใช้ ngrok:</p>
          <pre className="text-[11px] bg-muted rounded px-3 py-2 overflow-x-auto font-mono">ngrok http 8080</pre>
          <p className="text-xs text-muted-foreground">แล้วใช้ URL จาก ngrok เช่น <code className="bg-muted px-1 rounded">https://xxxx.ngrok-free.app/webhook</code></p>
          <p className="text-xs text-amber-600 font-medium">⚠️ ต้องปิด Auto-reply ใน LINE OA Manager ด้วย ไม่งั้น bot ตอบซ้อน</p>
        </div>
      ),
    },
    {
      id: 'liff',
      // No backend signal for LIFF — user marks it done manually after adding env var.
      done: !!manual['liff'],
      label: 'สร้าง LIFF (หน้าจอง)',
      detail: 'LIFF = หน้าเว็บที่เปิดในแอป LINE ใช้สำหรับหน้าจองคิว',
      action: (
        <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
          LINE Console <ExternalLink size={11} />
        </a>
      ),
      how: (
        <div className="space-y-2">
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>ใน LINE Developers Console → Channel → แท็บ <b>LIFF</b> → <b>Add</b></li>
            <li>LIFF name: <em>จองคิว</em>, Size: <b>Full</b></li>
            <li>Endpoint URL: <code className="bg-muted px-1 rounded">https://your-frontend.com/book</code></li>
            <li>Scopes: เปิด <b>profile</b>, กด <b>Add</b></li>
            <li>คัดลอก <b>LIFF ID</b> ที่ได้</li>
          </ol>
          <p className="text-xs text-muted-foreground">จากนั้นใส่ใน env:</p>
          <pre className="text-[11px] bg-muted rounded px-3 py-2 font-mono">{
`# frontend/.env.local
VITE_LIFF_ID=<LIFF ID ที่ได้>

# backend/.env
LIFF_URL=https://liff.line.me/<LIFF ID ที่ได้>`}</pre>
          <ManualCheck id="liff" />
        </div>
      ),
    },
    {
      id: 'richmenu',
      done: !!s?.rich_menu_id,
      label: 'สร้าง Rich Menu',
      detail: 'เมนูลัดด้านล่างแชท — จองคิว · คิวของฉัน · ติดต่อคลินิก',
      action: null,
      how: (
        <p className="text-xs text-muted-foreground">
          ตั้งค่า LIFF URL ในไฟล์ .env ก่อน แล้วมาคลิก <b>ตั้งค่า Rich Menu</b> ในส่วนด้านล่าง (ต้องทำหลัง step LIFF เสร็จ)
        </p>
      ),
    },
  ]

  const [openStep, setOpenStep] = useState<string | null>(null)
  const doneCount = steps.filter(step => step.done).length

  if (doneCount === steps.length) return null

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={15} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">คู่มือเชื่อม LINE OA</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{doneCount}/{steps.length} ขั้นตอน</span>
      </div>
      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <div className="flex flex-col gap-1.5">
        {steps.map((step, i) => (
          <div key={step.id}
            className={`rounded-lg border transition-colors ${step.done ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'}`}>
            <button
              onClick={() => setOpenStep(openStep === step.id ? null : step.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${step.done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {step.done ? '✓' : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.done ? 'text-primary line-through' : 'text-foreground'}`}>{step.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{step.detail}</p>
              </div>
              {step.action && <div onClick={e => e.stopPropagation()}>{step.action}</div>}
            </button>
            {openStep === step.id && (
              <div className="px-3 pb-3 border-t border-border/50 pt-2.5">
                {step.how}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── LINE OA Connect Section ───────────────────────────────────────────────────

function LineOAConnectSection() {
  const fieldFull = 'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30'
  const [s, setS] = useState<LineOASettings | null>(null)
  const [secret, setSecret] = useState('')
  const [token, setToken] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState<null | 'connect' | 'webhook' | 'richmenu' | 'delrich'>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    getLineSettings(CLINIC_ID)
      .then(res => { setS(res); if (res.webhook_url) setWebhookUrl(res.webhook_url) })
      .catch(() => {})
  }, [])

  async function run(key: 'connect' | 'webhook' | 'richmenu' | 'delrich', fn: () => Promise<LineOASettings>, okMsg: string) {
    setLoading(key); setError(''); setNotice('')
    try {
      const res = await fn()
      setS(res); setNotice(okMsg)
      if (key === 'connect') { setSecret(''); setToken('') }
      if (res.webhook_url) setWebhookUrl(res.webhook_url)
    } catch (err) {
      setError((err as Error).message || 'เกิดข้อผิดพลาด')
    } finally { setLoading(null) }
  }

  const connected = !!s?.connected
  const chip = (text: string, on: boolean) => (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${on ? 'bg-primary/10 text-primary' : 'bg-foreground/5 text-muted-foreground'}`}>{text}</span>
  )

  return (
    <SettingsSection title="เชื่อมต่อ LINE OA" icon={<MessageCircle size={16} />}>
      <div className="pt-2 flex flex-col gap-4">
        <LineOASetupGuide settings={s} />
        {connected && (
          <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary rounded-lg px-3 py-2">
            <CheckCircle2 size={16} />
            <span>เชื่อมต่อแล้ว: <b>{s?.bot?.displayName || 'LINE OA'}</b></span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Channel Secret</label>
          <input type="password" value={secret} onChange={e => setSecret(e.target.value)}
            placeholder={s?.has_credentials ? '•••••••• (บันทึกไว้แล้ว)' : 'LINE channel secret'} className={`${fieldFull} font-mono`} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Channel Access Token</label>
          <input type="password" value={token} onChange={e => setToken(e.target.value)}
            placeholder={s?.has_credentials ? s.masked_token || '•••••••• (บันทึกไว้แล้ว)' : 'LINE channel access token'} className={`${fieldFull} font-mono`} />
        </div>
        <div>
          <button onClick={() => run('connect', () => saveLineCredentials(CLINIC_ID, secret, token), 'เชื่อมต่อสำเร็จ')}
            disabled={loading === 'connect' || (!secret && !token)}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm cursor-pointer">
            {loading === 'connect' ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}บันทึกและเชื่อมต่อ
          </button>
        </div>

        {connected && (
          <div className="border-t border-border pt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Link2 size={15} className="text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">Webhook</h4>
              {chip(s?.webhook_active ? 'ใช้งานอยู่' : 'ยังไม่ได้ตั้งค่า', !!s?.webhook_active)}
            </div>
            <div>
              <input type="text" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://your-backend/webhook" className={`${fieldFull} font-mono`} />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                ต้องเป็น URL สาธารณะแบบ HTTPS และลงท้ายด้วย <code>/webhook</code>
              </p>
            </div>
            <div>
              <button onClick={() => run('webhook', () => enableWebhook(CLINIC_ID, webhookUrl.trim()), 'ตั้งค่า Webhook สำเร็จ')}
                disabled={loading === 'webhook' || !webhookUrl.trim()}
                className="flex items-center gap-2 border border-border text-foreground font-medium px-4 py-2 rounded-lg hover:bg-foreground/5 disabled:opacity-50 transition-colors text-sm cursor-pointer">
                {loading === 'webhook' ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}ใช้ webhook
              </button>
            </div>
          </div>
        )}

        {connected && (
          <div className="border-t border-border pt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <LayoutGrid size={15} className="text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">Rich Menu</h4>
              {chip('ฟีเจอร์พิเศษ', true)}
              {s?.rich_menu_id ? chip('สร้างแล้ว', true) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">สร้างเมนูลัดอัตโนมัติใน LINE OA: จองคิว · คิวของฉัน · ติดต่อคลินิก</p>
            {s?.rich_menu_id && <p className="font-mono text-[11px] text-muted-foreground break-all">ID: {s.rich_menu_id}</p>}
            <div className="flex gap-2">
              <button onClick={() => run('richmenu', () => setupRichMenu(CLINIC_ID), 'ตั้งค่า Rich Menu สำเร็จ')}
                disabled={loading === 'richmenu'}
                className="flex items-center gap-2 border border-border text-foreground font-medium px-4 py-2 rounded-lg hover:bg-foreground/5 disabled:opacity-50 transition-colors text-sm cursor-pointer">
                {loading === 'richmenu' ? <Loader2 size={14} className="animate-spin" /> : <LayoutGrid size={14} />}
                {s?.rich_menu_id ? 'สร้างใหม่' : 'ตั้งค่า Rich Menu'}
              </button>
              {s?.rich_menu_id && (
                <button onClick={() => run('delrich', () => deleteRichMenu(CLINIC_ID), 'ลบ Rich Menu แล้ว')}
                  disabled={loading === 'delrich'}
                  className="flex items-center gap-2 border border-destructive/30 text-destructive font-medium px-4 py-2 rounded-lg hover:bg-destructive/10 disabled:opacity-50 transition-colors text-sm cursor-pointer">
                  {loading === 'delrich' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}ลบ
                </button>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>}
        {notice && !error && <p className="text-sm text-primary">{notice}</p>}
      </div>
    </SettingsSection>
  )
}

// ── Settings View ─────────────────────────────────────────────────────────────

export function SettingsView() {
  const numInput = 'w-24 text-sm font-mono bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 text-right'

  const [loadingSettings, setLoadingSettings] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState(false)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerResult, setTriggerResult] = useState<string | null>(null)

  // Notification settings
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderTime, setReminderTime] = useState('18:00')
  const [reminderDaysBefore, setReminderDaysBefore] = useState('1')
  const [cancelTtl, setCancelTtl] = useState('15')

  // Coverage settings
  const [ssoEnabled, setSsoEnabled] = useState(true)
  const [ssoDepositRequired, setSsoDepositRequired] = useState(false)
  const [ssoDepositAmount, setSsoDepositAmount] = useState('0')
  const [universalEnabled, setUniversalEnabled] = useState(true)
  const [universalDepositRequired, setUniversalDepositRequired] = useState(false)
  const [universalDepositAmount, setUniversalDepositAmount] = useState('0')
  const [cashDepositRequired, setCashDepositRequired] = useState(false)
  const [cashDepositAmount, setCashDepositAmount] = useState('0')

  useEffect(() => {
    if (!CLINIC_ID) { setLoadingSettings(false); return }
    Promise.all([
      getNotificationSettings(CLINIC_ID),
      getCoverageSettings(CLINIC_ID),
    ])
      .then(([notif, cov]: [NotificationSettings, CoverageSettings]) => {
        setReminderEnabled(notif.reminder_enabled)
        setReminderTime(notif.reminder_time)
        setReminderDaysBefore(String(notif.reminder_days_before))
        setCancelTtl(String(notif.cancel_ttl_minutes))
        setSsoEnabled(cov.sso_enabled)
        setSsoDepositRequired(cov.sso_deposit_required)
        setSsoDepositAmount(String(cov.sso_deposit_amount))
        setUniversalEnabled(cov.universal_enabled)
        setUniversalDepositRequired(cov.universal_deposit_required)
        setUniversalDepositAmount(String(cov.universal_deposit_amount))
        setCashDepositRequired(cov.cash_deposit_required)
        setCashDepositAmount(String(cov.cash_deposit_amount))
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false))
  }, [])

  async function handleSave() {
    if (!CLINIC_ID) return
    setSaving(true); setSaveError(''); setSaveOk(false)
    try {
      await Promise.all([
        saveNotificationSettings(CLINIC_ID, {
          reminder_enabled: reminderEnabled,
          reminder_time: reminderTime,
          reminder_days_before: Number(reminderDaysBefore),
          cancel_ttl_minutes: Number(cancelTtl),
        }),
        saveCoverageSettings(CLINIC_ID, {
          sso_enabled: ssoEnabled,
          sso_deposit_required: ssoDepositRequired,
          sso_deposit_amount: Number(ssoDepositAmount),
          universal_enabled: universalEnabled,
          universal_deposit_required: universalDepositRequired,
          universal_deposit_amount: Number(universalDepositAmount),
          cash_deposit_required: cashDepositRequired,
          cash_deposit_amount: Number(cashDepositAmount),
        }),
      ])
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 3000)
    } catch (e) {
      setSaveError((e as Error).message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleTriggerNow() {
    if (!CLINIC_ID) return
    setTriggerLoading(true); setTriggerResult(null)
    try {
      const res = await triggerRemindersNow(CLINIC_ID)
      setTriggerResult(`ส่งแจ้งเตือนสำเร็จ ${res.reminders_sent} ราย`)
    } catch (e) {
      setTriggerResult(`เกิดข้อผิดพลาด: ${(e as Error).message}`)
    } finally {
      setTriggerLoading(false)
    }
  }

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
        <Loader2 size={16} className="animate-spin" />กำลังโหลด...
      </div>
    )
  }

  const depositInput = (value: string, onChange: (v: string) => void) => (
    <div className="flex items-center gap-1.5">
      <span className="text-sm text-muted-foreground">฿</span>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} min={0}
        className={`${numInput} w-28`} />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ตั้งค่าระบบ</h1>
        <p className="text-sm text-muted-foreground mt-0.5">จัดการสิทธิ์การรักษา, มัดจำ และการแจ้งเตือน</p>
      </div>

      <LineOAConnectSection />

      <SettingsSection title="การแจ้งเตือนนัดหมาย" icon={<Bell size={16} />}>
        <div className="pt-2 flex flex-col gap-1">
          <SettingsRow label="เปิดแจ้งเตือนผู้ป่วยล่วงหน้า" hint="ส่ง LINE ข้อความเตือนก่อนวันนัด">
            <Toggle checked={reminderEnabled} onChange={setReminderEnabled} />
          </SettingsRow>
          {reminderEnabled && (
            <>
              <SettingsRow label="แจ้งเตือนล่วงหน้า (วัน)" hint="ระบบจะส่งแจ้งเตือนก่อนวันนัดกี่วัน">
                <select value={reminderDaysBefore} onChange={e => setReminderDaysBefore(e.target.value)}
                  className="text-sm bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30">
                  <option value="1">1 วันก่อน</option>
                  <option value="2">2 วันก่อน</option>
                  <option value="3">3 วันก่อน</option>
                </select>
              </SettingsRow>
              <SettingsRow label="เวลาส่งแจ้งเตือน" hint="Cloud Scheduler จะเรียก API ตามเวลานี้ทุกวัน">
                <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                  className="text-sm font-mono bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </SettingsRow>
              <SettingsRow label="ส่งแจ้งเตือนตอนนี้" hint="ส่งข้อความ LINE ให้ผู้ป่วยที่มีนัดตาม window ที่กำหนดทันที">
                <div className="flex items-center gap-2">
                  <button onClick={handleTriggerNow} disabled={triggerLoading}
                    className="flex items-center gap-1.5 border border-border text-foreground text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-muted disabled:opacity-50 transition-colors cursor-pointer">
                    {triggerLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}ส่งเลย
                  </button>
                  {triggerResult && (
                    <span className={`text-xs ${triggerResult.startsWith('เกิด') ? 'text-destructive' : 'text-primary'}`}>
                      {triggerResult}
                    </span>
                  )}
                </div>
              </SettingsRow>
            </>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="ประกันสังคม (SSO)" icon={<ShieldCheck size={16} />}>
        <div className="pt-2 flex flex-col gap-1">
          <SettingsRow label="เปิดรับสิทธิ์ประกันสังคม" hint="ผู้ป่วยสามารถเลือกสิทธิ์นี้เมื่อจองคิว">
            <Toggle checked={ssoEnabled} onChange={setSsoEnabled} />
          </SettingsRow>
          {ssoEnabled && (
            <>
              <SettingsRow label="เรียกเก็บมัดจำ" hint="กำหนดให้ผู้ป่วยสิทธิ์นี้ต้องชำระมัดจำ">
                <Toggle checked={ssoDepositRequired} onChange={setSsoDepositRequired} />
              </SettingsRow>
              {ssoDepositRequired && (
                <SettingsRow label="จำนวนมัดจำ (บาท)" hint="ยอดมัดจำที่ต้องชำระผ่านสลิป">
                  {depositInput(ssoDepositAmount, setSsoDepositAmount)}
                </SettingsRow>
              )}
            </>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="บัตรทอง (Universal Coverage)" icon={<CreditCard size={16} />}>
        <div className="pt-2 flex flex-col gap-1">
          <SettingsRow label="เปิดรับสิทธิ์บัตรทอง" hint="ผู้ป่วยสามารถเลือกสิทธิ์นี้เมื่อจองคิว">
            <Toggle checked={universalEnabled} onChange={setUniversalEnabled} />
          </SettingsRow>
          {universalEnabled && (
            <>
              <SettingsRow label="เรียกเก็บมัดจำ" hint="กำหนดให้ผู้ป่วยสิทธิ์นี้ต้องชำระมัดจำ">
                <Toggle checked={universalDepositRequired} onChange={setUniversalDepositRequired} />
              </SettingsRow>
              {universalDepositRequired && (
                <SettingsRow label="จำนวนมัดจำ (บาท)" hint="ยอดมัดจำที่ต้องชำระผ่านสลิป">
                  {depositInput(universalDepositAmount, setUniversalDepositAmount)}
                </SettingsRow>
              )}
            </>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="เงินสด (Cash)" icon={<FileText size={16} />}>
        <div className="pt-2 flex flex-col gap-1">
          <SettingsRow label="เรียกเก็บมัดจำสำหรับเงินสด" hint="กำหนดให้ผู้ป่วยชำระเงินสดต้องส่งสลิปมัดจำ">
            <Toggle checked={cashDepositRequired} onChange={setCashDepositRequired} />
          </SettingsRow>
          {cashDepositRequired && (
            <SettingsRow label="จำนวนมัดจำ (บาท)" hint="ยอดมัดจำสำหรับเงินสด">
              {depositInput(cashDepositAmount, setCashDepositAmount)}
            </SettingsRow>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="อื่นๆ" icon={<Settings2 size={16} />}>
        <div className="pt-2">
          <SettingsRow label="ยกเลิกคิวอัตโนมัติ (นาที)" hint="ยกเลิกคิวที่ค้างสถานะ 'รอสลิป' เกินเวลาที่กำหนด">
            <div className="flex items-center gap-1.5">
              <input type="number" value={cancelTtl} onChange={e => setCancelTtl(e.target.value)} min={5} max={60}
                className={`${numInput} w-20`} />
              <span className="text-sm text-muted-foreground">นาที</span>
            </div>
          </SettingsRow>
        </div>
      </SettingsSection>

      {saveError && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle size={14} />{saveError}
        </p>
      )}

      <div className="flex justify-end items-center gap-3">
        {saveOk && (
          <p className="text-sm text-primary flex items-center gap-1.5">
            <CheckCircle2 size={14} />บันทึกแล้ว
          </p>
        )}
        <button onClick={handleSave} disabled={saving || !CLINIC_ID}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-5 py-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm cursor-pointer">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>
      </div>
    </div>
  )
}
