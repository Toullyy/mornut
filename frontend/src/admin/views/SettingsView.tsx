import { useEffect, useState } from 'react'
import {
  AlertCircle, CheckCircle2, CreditCard, FileText, KeyRound,
  LayoutGrid, Link2, Loader2, MessageCircle, Save, Settings2,
  ShieldCheck, Trash2,
} from 'lucide-react'
import {
  getLineSettings, saveLineCredentials, enableWebhook,
  setupRichMenu, deleteRichMenu, type LineOASettings,
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
  const [ssoEnabled, setSsoEnabled] = useState(true)
  const [ssoDepositRequired, setSsoDepositRequired] = useState(true)
  const [ssoDeposit, setSsoDeposit] = useState('200')
  const [univEnabled, setUnivEnabled] = useState(true)
  const [univDepositRequired, setUnivDepositRequired] = useState(false)
  const [univDeposit, setUnivDeposit] = useState('0')
  const [univRequireIdCard, setUnivRequireIdCard] = useState(true)
  const [cashDepositRequired, setCashDepositRequired] = useState(true)
  const [cashDeposit, setCashDeposit] = useState('300')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderTime, setReminderTime] = useState('18:00')
  const [reminderDaysBefore, setReminderDaysBefore] = useState('1')
  const [cancelTtl, setCancelTtl] = useState('15')

  const numInput = 'w-24 text-sm font-mono bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 text-right'

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ตั้งค่าระบบ</h1>
        <p className="text-sm text-muted-foreground mt-0.5">จัดการสิทธิ์การรักษา, มัดจำ และการแจ้งเตือน</p>
      </div>

      <LineOAConnectSection />

      <SettingsSection title="ประกันสังคม (SSO)" icon={<ShieldCheck size={16} />}>
        <div className="pt-2">
          <SettingsRow label="เปิดรับสิทธิ์ประกันสังคม" hint="อนุญาตให้ผู้ป่วยสิทธิ์ประกันสังคมจองคิวได้">
            <Toggle checked={ssoEnabled} onChange={setSsoEnabled} />
          </SettingsRow>
          <SettingsRow label="เก็บมัดจำ" hint="กำหนดให้ผู้ป่วยประกันสังคมต้องชำระมัดจำก่อนยืนยัน">
            <Toggle checked={ssoDepositRequired} onChange={setSsoDepositRequired} />
          </SettingsRow>
          {ssoDepositRequired && (
            <SettingsRow label="จำนวนมัดจำ (บาท)" hint="ยอดที่ต้องโอนเพื่อล็อกคิว">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">฿</span>
                <input type="number" value={ssoDeposit} onChange={e => setSsoDeposit(e.target.value)} min={0} className={numInput} />
              </div>
            </SettingsRow>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="บัตรทอง (Universal Coverage)" icon={<CreditCard size={16} />}>
        <div className="pt-2">
          <SettingsRow label="เปิดรับสิทธิ์บัตรทอง" hint="อนุญาตให้ผู้ป่วยสิทธิ์บัตรทองจองคิวได้">
            <Toggle checked={univEnabled} onChange={setUnivEnabled} />
          </SettingsRow>
          <SettingsRow label="เก็บมัดจำ" hint="บัตรทองปกติไม่เก็บมัดจำ แต่สามารถเปิดใช้ได้">
            <Toggle checked={univDepositRequired} onChange={setUnivDepositRequired} />
          </SettingsRow>
          {univDepositRequired && (
            <SettingsRow label="จำนวนมัดจำ (บาท)">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">฿</span>
                <input type="number" value={univDeposit} onChange={e => setUnivDeposit(e.target.value)} min={0} className={numInput} />
              </div>
            </SettingsRow>
          )}
          <SettingsRow label="กำหนดให้แนบบัตรประชาชน" hint="ขอภาพบัตรประชาชนเพื่อยืนยันสิทธิ์">
            <Toggle checked={univRequireIdCard} onChange={setUnivRequireIdCard} />
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection title="เงินสด (Cash)" icon={<FileText size={16} />}>
        <div className="pt-2">
          <SettingsRow label="เก็บมัดจำ" hint="กำหนดมัดจำสำหรับผู้ป่วยชำระเงินสด">
            <Toggle checked={cashDepositRequired} onChange={setCashDepositRequired} />
          </SettingsRow>
          {cashDepositRequired && (
            <SettingsRow label="จำนวนมัดจำ (บาท)">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">฿</span>
                <input type="number" value={cashDeposit} onChange={e => setCashDeposit(e.target.value)} min={0} className={numInput} />
              </div>
            </SettingsRow>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="อื่นๆ" icon={<Settings2 size={16} />}>
        <div className="pt-2">
          <SettingsRow label="แจ้งเตือนผู้ป่วยล่วงหน้า" hint="ส่ง LINE ข้อความเตือนก่อนวันนัด">
            <Toggle checked={reminderEnabled} onChange={setReminderEnabled} />
          </SettingsRow>
          {reminderEnabled && (
            <>
              <SettingsRow label="เวลาส่งแจ้งเตือน" hint="เวลาที่ระบบจะส่งข้อความเตือนทุกวัน">
                <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                  className="text-sm font-mono bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </SettingsRow>
              <SettingsRow label="แจ้งเตือนล่วงหน้า (วัน)">
                <select value={reminderDaysBefore} onChange={e => setReminderDaysBefore(e.target.value)}
                  className="text-sm bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30">
                  <option value="1">1 วันก่อน</option>
                  <option value="2">2 วันก่อน</option>
                  <option value="3">3 วันก่อน</option>
                </select>
              </SettingsRow>
            </>
          )}
          <SettingsRow label="ยกเลิกคิวอัตโนมัติ (นาที)" hint="ยกเลิกคิวที่ค้างสถานะ 'รอสลิป' เกินเวลาที่กำหนด">
            <div className="flex items-center gap-1.5">
              <input type="number" value={cancelTtl} onChange={e => setCancelTtl(e.target.value)} min={5} max={60}
                className="w-20 text-sm font-mono bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 text-right" />
              <span className="text-sm text-muted-foreground">นาที</span>
            </div>
          </SettingsRow>
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <button className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm cursor-pointer">
          <Save size={14} />บันทึกการตั้งค่าทั้งหมด
        </button>
      </div>
    </div>
  )
}
