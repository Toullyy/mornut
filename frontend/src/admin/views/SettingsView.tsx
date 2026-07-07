import { useEffect, useState } from 'react'
import {
  AlertCircle, Bell, CheckCircle2, CreditCard, FileText, KeyRound,
  LayoutGrid, Link2, Loader2, MessageCircle, Play, Save, Settings2,
  ShieldCheck, Trash2,
} from 'lucide-react'
import {
  getLineSettings, saveLineCredentials, enableWebhook,
  setupRichMenu, deleteRichMenu, type LineOASettings,
} from '../api'
import {
  getNotificationSettings, saveNotificationSettings, triggerRemindersNow,
  type NotificationSettings,
} from '../api'
import { SettingsSection, SettingsRow } from '../ui/SettingsLayout'
import { Toggle } from '../ui/Toggle'
import { CLINIC_ID } from '../types'

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
        {connected && (
          <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary rounded-lg px-3 py-2">
            <CheckCircle2 size={16} />
            <span>เชื่อมต่อแล้ว: <b>{s?.bot?.displayName || 'LINE OA'}</b></span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Channel Secret <span className="font-normal">(Line Secret ID)</span></label>
          <input type="password" value={secret} onChange={e => setSecret(e.target.value)}
            placeholder={s?.has_credentials ? '•••••••• (บันทึกไว้แล้ว)' : 'LINE channel secret'} className={`${fieldFull} font-mono`} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Channel Access Token <span className="font-normal">(Line Token ID)</span></label>
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
                ต้องเป็น URL สาธารณะแบบ HTTPS (เช่น ngrok หรือ Cloud Run) และลงท้ายด้วย <code>/webhook</code>
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

  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderTime, setReminderTime] = useState('18:00')
  const [reminderDaysBefore, setReminderDaysBefore] = useState('1')
  const [cancelTtl, setCancelTtl] = useState('15')

  useEffect(() => {
    if (!CLINIC_ID) { setLoadingSettings(false); return }
    getNotificationSettings(CLINIC_ID)
      .then(s => {
        setReminderEnabled(s.reminder_enabled)
        setReminderTime(s.reminder_time)
        setReminderDaysBefore(String(s.reminder_days_before))
        setCancelTtl(String(s.cancel_ttl_minutes))
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false))
  }, [])

  async function handleSave() {
    if (!CLINIC_ID) return
    setSaving(true); setSaveError(''); setSaveOk(false)
    try {
      const data: Partial<NotificationSettings> = {
        reminder_enabled: reminderEnabled,
        reminder_time: reminderTime,
        reminder_days_before: Number(reminderDaysBefore),
        cancel_ttl_minutes: Number(cancelTtl),
      }
      await saveNotificationSettings(CLINIC_ID, data)
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
        <div className="pt-2">
          <p className="text-xs text-muted-foreground py-3 text-center">การตั้งค่าสิทธิ์จะเปิดให้ใช้งานในเวอร์ชันถัดไป</p>
        </div>
      </SettingsSection>

      <SettingsSection title="บัตรทอง (Universal Coverage)" icon={<CreditCard size={16} />}>
        <div className="pt-2">
          <p className="text-xs text-muted-foreground py-3 text-center">การตั้งค่าสิทธิ์จะเปิดให้ใช้งานในเวอร์ชันถัดไป</p>
        </div>
      </SettingsSection>

      <SettingsSection title="เงินสด (Cash)" icon={<FileText size={16} />}>
        <div className="pt-2">
          <p className="text-xs text-muted-foreground py-3 text-center">การตั้งค่าสิทธิ์จะเปิดให้ใช้งานในเวอร์ชันถัดไป</p>
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
