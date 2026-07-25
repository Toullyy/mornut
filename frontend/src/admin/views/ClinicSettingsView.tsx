import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertCircle, AlertTriangle, Bot, Check, Clock3, HelpCircle, Loader2, MapPin, Package, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { TimePicker } from '../ui/TimePicker'
import {
  getClinicSettings, updateClinicSettings, rebuildRag,
  fetchUnansweredQuestions, submitAnswer,
  fetchAiHealth,
  fetchAdminServices, createService, updateService, deleteService,
  fetchDoctors, updateDoctorShifts,
  type ServiceItem, type ServiceCreate, type UnansweredQuestion, type AiHealthStats,
} from '../api'
import { SettingsSection } from '../ui/SettingsLayout'
import { CLINIC_ID, type DaySlot, type WeekSchedule } from '../types'
import { apiShiftsToSchedule, scheduleToApiShifts } from './DoctorsView'

// ── Clinic Info Section ───────────────────────────────────────────────────────

type ConflictDoctor = { id: string; name: string; fixed: WeekSchedule }

function clipSchedule(schedule: WeekSchedule, open: string, close: string): WeekSchedule {
  const result: WeekSchedule = {}
  for (const [day, slots] of Object.entries(schedule)) {
    const clipped: DaySlot[] = []
    for (const s of slots) {
      const start = s.start < open ? open : s.start
      const end = s.end > close ? close : s.end
      if (start < end) clipped.push({ start, end })
    }
    result[Number(day)] = clipped
  }
  return result
}

function ClinicInfoSection() {
  const fieldFull = 'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30'
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [openTime, setOpenTime] = useState('08:00')
  const [closeTime, setCloseTime] = useState('17:00')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [conflicts, setConflicts] = useState<ConflictDoctor[]>([])
  const [fixing, setFixing] = useState(false)

  useEffect(() => {
    getClinicSettings(CLINIC_ID)
      .then(s => {
        setName(s.name)
        setAddress(s.address)
        setPhone(s.phone)
        setOpenTime(s.open_time || '08:00')
        setCloseTime(s.close_time || '17:00')
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (openTime >= closeTime) { setError('เวลาเปิดต้องน้อยกว่าเวลาปิด'); return }
    setSaving(true); setError(''); setNotice(''); setConflicts([])
    try {
      await updateClinicSettings(CLINIC_ID, { name, address, phone, open_time: openTime, close_time: closeTime })
      // Check if any doctor schedules fall outside the new hours
      const doctors = await fetchDoctors(CLINIC_ID)
      const found: ConflictDoctor[] = []
      for (const doc of doctors) {
        const schedule = apiShiftsToSchedule(doc.shifts ?? [])
        const hasConflict = Object.values(schedule).some(slots =>
          slots.some(s => s.start < openTime || s.end > closeTime)
        )
        if (hasConflict) {
          found.push({ id: doc.id, name: doc.name, fixed: clipSchedule(schedule, openTime, closeTime) })
        }
      }
      setConflicts(found)
      setNotice(found.length > 0 ? '' : 'บันทึกแล้ว')
    } catch (e) {
      setError((e as Error).message || 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  async function handleAutoFix() {
    setFixing(true)
    try {
      await Promise.all(conflicts.map(c => updateDoctorShifts(c.id, scheduleToApiShifts(c.fixed))))
      setConflicts([])
      setNotice('บันทึกแล้ว และปรับตารางแพทย์เรียบร้อย')
    } catch (e) {
      setError((e as Error).message || 'ปรับตารางแพทย์ไม่สำเร็จ')
    } finally {
      setFixing(false)
    }
  }

  return (
    <SettingsSection title="ข้อมูลคลินิก" icon={<MapPin size={16} />}>
      <div className="pt-2 flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">ชื่อคลินิก</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className={fieldFull} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">ที่อยู่</label>
              <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className={fieldFull} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">เบอร์โทรคลินิก</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={`${fieldFull} font-mono`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">เวลาทำการ</label>
              <div className="flex items-center gap-3">
                <Clock3 size={14} className="text-muted-foreground shrink-0" />
                <TimePicker
                  value={openTime}
                  onChange={setOpenTime}
                  invalid={Boolean(openTime && closeTime && openTime >= closeTime)}
                />
                <span className="text-sm text-muted-foreground">ถึง</span>
                <TimePicker
                  value={closeTime}
                  onChange={setCloseTime}
                  minTime={openTime || undefined}
                  invalid={Boolean(openTime && closeTime && openTime >= closeTime)}
                />
              </div>
              {openTime >= closeTime && openTime && closeTime && (
                <p className="text-xs text-destructive mt-1.5">เวลาเปิดต้องน้อยกว่าเวลาปิด</p>
              )}
            </div>
            <div>
              <button onClick={handleSave}
                disabled={saving || (openTime >= closeTime && Boolean(openTime && closeTime))}
                className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm cursor-pointer">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}บันทึก
              </button>
            </div>

            {/* Doctor schedule conflict warning */}
            {conflicts.length > 0 && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="text-yellow-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-800">ตารางแพทย์ไม่ตรงกับเวลาทำการใหม่</p>
                    <p className="text-xs text-yellow-700 mt-0.5">แพทย์ต่อไปนี้มีช่วงเวลาทำงานนอกเหนือเวลา {openTime}–{closeTime}</p>
                  </div>
                </div>
                <ul className="flex flex-col gap-1 pl-5">
                  {conflicts.map(c => (
                    <li key={c.id} className="text-sm text-yellow-800 font-medium list-disc">{c.name}</li>
                  ))}
                </ul>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={handleAutoFix} disabled={fixing}
                    className="flex items-center gap-1.5 bg-yellow-600 text-white text-sm font-medium px-3.5 py-1.5 rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors cursor-pointer">
                    {fixing ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    ปรับตารางแพทย์อัตโนมัติ
                  </button>
                  <button onClick={() => { setConflicts([]); setNotice('บันทึกแล้ว') }}
                    className="text-sm text-yellow-700 hover:text-yellow-900 px-3 py-1.5 rounded-lg hover:bg-yellow-100 transition-colors cursor-pointer">
                    ข้าม (แก้ทีหลัง)
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>}
            {notice && !error && <p className="text-sm text-primary">{notice}</p>}
          </>
        )}
      </div>
    </SettingsSection>
  )
}

// ── Add/Edit Service Modal ────────────────────────────────────────────────────

function AddEditServiceModal({ service, onClose, onSaved }: {
  service?: ServiceItem
  onClose: () => void
  onSaved: (service: ServiceItem) => void
}) {
  const [form, setForm] = useState<ServiceCreate>({
    name: service?.name ?? '',
    duration_min: service?.duration_min ?? 30,
    deposit_amount: service?.deposit_amount ?? 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const isValid = form.name.trim().length > 0 && form.duration_min > 0
  const field = 'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/30'

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true); setError('')
    try {
      if (service) {
        await updateService(service.id, form)
        onSaved({ ...service, ...form })
      } else {
        const created = await createService(CLINIC_ID, form)
        onSaved(created)
      }
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {service ? 'แก้ไขบริการ' : 'เพิ่มบริการใหม่'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ชื่อบริการ <span className="text-destructive">*</span></label>
            <input type="text" placeholder="เช่น ตรวจสุขภาพทั่วไป" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={field} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">ระยะเวลา (นาที) <span className="text-destructive">*</span></label>
              <input type="number" min={5} value={form.duration_min}
                onChange={e => setForm(f => ({ ...f, duration_min: Number(e.target.value) }))} className={`${field} font-mono`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">มัดจำ (บาท)</label>
              <input type="number" min={0} value={form.deposit_amount}
                onChange={e => setForm(f => ({ ...f, deposit_amount: Number(e.target.value) }))} className={`${field} font-mono`} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">ยกเลิก</button>
          <button onClick={handleSubmit} disabled={!isValid || submitting}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm cursor-pointer">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Services Section ──────────────────────────────────────────────────────────

function ServicesSection() {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingService, setEditingService] = useState<ServiceItem | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadServices = useCallback(() => {
    setLoading(true)
    fetchAdminServices(CLINIC_ID)
      .then(setServices)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadServices() }, [loadServices])

  const handleDelete = async (serviceId: string) => {
    try {
      await deleteService(serviceId)
      setServices(prev => prev.filter(s => s.id !== serviceId))
    } catch (e) { console.error(e) }
    finally { setConfirmDelete(null) }
  }

  return (
    <SettingsSection title="บริการ" icon={<Package size={16} />}>
      {showAdd && (
        <AddEditServiceModal onClose={() => setShowAdd(false)}
          onSaved={created => { setServices(prev => [...prev, created]); setShowAdd(false) }} />
      )}
      {editingService && (
        <AddEditServiceModal service={editingService} onClose={() => setEditingService(null)}
          onSaved={updated => { setServices(prev => prev.map(s => s.id === updated.id ? updated : s)); setEditingService(null) }} />
      )}

      <div className="pt-2 flex flex-col gap-3">
        <div className="flex justify-end">
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
            <Plus size={14} />เพิ่มบริการ
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">กำลังโหลด...</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">ยังไม่มีบริการ กดปุ่ม "เพิ่มบริการ" เพื่อเริ่มต้น</p>
        ) : services.map(s => (
          <div key={s.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {s.duration_min} นาที · {s.deposit_amount > 0 ? `มัดจำ ฿${s.deposit_amount.toLocaleString()}` : 'ไม่มีมัดจำ'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {confirmDelete === s.id ? (
                <>
                  <span className="text-xs text-muted-foreground mr-1">ลบบริการนี้?</span>
                  <button onClick={() => handleDelete(s.id)}
                    className="text-xs font-medium text-destructive hover:bg-destructive/10 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">ยืนยัน</button>
                  <button onClick={() => setConfirmDelete(null)}
                    className="text-xs text-muted-foreground hover:bg-muted px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">ยกเลิก</button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditingService(s)}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors cursor-pointer" title="แก้ไข">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setConfirmDelete(s.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded-lg transition-colors cursor-pointer" title="ลบ">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </SettingsSection>
  )
}

// ── Clinic Settings View ──────────────────────────────────────────────────────

function AiKnowledgeSection() {
  const fieldFull = 'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30'
  const [knowledge, setKnowledge] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    getClinicSettings(CLINIC_ID)
      .then(s => setKnowledge(s.ai_knowledge || ''))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true); setError(''); setNotice('')
    try {
      await updateClinicSettings(CLINIC_ID, { ai_knowledge: knowledge })
      setNotice('บันทึกแล้ว')
    } catch (e) {
      setError((e as Error).message || 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  async function handleRebuild() {
    setRebuilding(true); setError(''); setNotice('')
    try {
      const result = await rebuildRag(CLINIC_ID)
      setNotice(result.message)
    } catch (e) {
      setError((e as Error).message || 'อัปเดต AI Index ไม่สำเร็จ')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <SettingsSection title="คลังความรู้ AI" icon={<Bot size={16} />}>
      <div className="pt-2 flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">
              ใส่ข้อมูลคลินิกที่ต้องการให้ AI ใช้ตอบคำถามผู้ป่วย เช่น เวลาทำการ ราคาบริการ ที่จอดรถ
              คำถามที่พบบ่อย ฯลฯ — AI จะดึงเฉพาะส่วนที่เกี่ยวข้องมาตอบ (RAG)
            </p>
            <textarea
              value={knowledge}
              onChange={e => setKnowledge(e.target.value)}
              rows={8}
              placeholder={`ตัวอย่าง:\nเวลาทำการ: จันทร์-ศุกร์ 08:00-17:00 น., เสาร์ 08:00-12:00 น.\nที่จอดรถ: มีที่จอดรถฟรีด้านหน้าอาคาร\nค่าตรวจทั่วไป: 200 บาท\nนำบัตรประชาชนมาด้วยทุกครั้ง`}
              className={fieldFull}
              style={{ resize: 'vertical', minHeight: '160px' }}
            />
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleSave} disabled={saving || rebuilding}
                className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm cursor-pointer">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}บันทึก
              </button>
              <button onClick={handleRebuild} disabled={saving || rebuilding}
                className="flex items-center gap-2 border border-border text-foreground font-medium px-4 py-2 rounded-lg hover:bg-accent disabled:opacity-50 transition-colors text-sm cursor-pointer">
                {rebuilding ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}อัปเดต AI Index
              </button>
              {notice && !error && <p className="text-sm text-primary">{notice}</p>}
            </div>
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>}
          </>
        )}
      </div>
    </SettingsSection>
  )
}

// ── AI Health Card ───────────────────────────────────────────────────────────

function AiHealthCard() {
  const [stats, setStats] = useState<AiHealthStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true); setError('')
    fetchAiHealth(CLINIC_ID, days)
      .then(setStats)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [days])

  const bar = (pct: number, color: string) => (
    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )

  return (
    <SettingsSection title="AI Health" icon={<Activity size={16} />}>
      <div className="pt-2 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {([7, 14, 30] as const).map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                days === d
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}>
              {d} วัน
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : error ? (
          <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>
        ) : stats && stats.total === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล AI interactions ใน {days} วันที่ผ่านมา</p>
        ) : stats ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">รวม {stats.total} interactions ใน {stats.period_days} วันที่ผ่านมา</p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: 'ตอบได้', value: stats.handled, color: 'bg-primary' },
                { label: 'ไม่มีข้อมูล', value: stats.unknown, color: 'bg-yellow-400' },
                { label: 'นอกเรื่อง', value: stats.offtopic, color: 'bg-muted-foreground' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{label}</span>
                    <span className="text-muted-foreground">{value.count} ({value.pct}%)</span>
                  </div>
                  {bar(value.pct, color)}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground border-t border-border">
              {stats.avg_prompt_tokens > 0 && (
                <span>avg prompt: {stats.avg_prompt_tokens} tokens</span>
              )}
              {stats.avg_completion_tokens > 0 && (
                <span>avg reply: {stats.avg_completion_tokens} tokens</span>
              )}
              {stats.errors > 0 && (
                <span className="text-destructive">{stats.errors} errors</span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </SettingsSection>
  )
}

// ── Unanswered Questions Section ─────────────────────────────────────────────

function UnansweredSection() {
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUnansweredQuestions(CLINIC_ID)
      .then(setQuestions)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  async function handleAnswer(id: string) {
    const answer = answers[id]?.trim()
    if (!answer) return
    setSaving(prev => ({ ...prev, [id]: true }))
    try {
      await submitAnswer(id, answer)
      setQuestions(prev => prev.filter(q => q.id !== id))
      setSaved(prev => ({ ...prev, [id]: true }))
    } catch (e) {
      setError((e as Error).message || 'บันทึกคำตอบไม่สำเร็จ')
    } finally {
      setSaving(prev => ({ ...prev, [id]: false }))
    }
  }

  return (
    <SettingsSection title="คำถามที่ AI ตอบไม่ได้" icon={<HelpCircle size={16} />}>
      <div className="pt-2 flex flex-col gap-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          คำถามจากผู้ป่วยที่ AI ไม่มีข้อมูลตอบ — ใส่คำตอบเพื่อสอน AI และอัปเดต Knowledge Base อัตโนมัติ
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Check size={14} className="text-primary" />ยังไม่มีคำถามที่รอคำตอบ
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {questions.map(q => (
              <div key={q.id} className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">"{q.question}"</p>
                  {q.asked_count > 1 && (
                    <span className="text-xs text-muted-foreground shrink-0">ถามซ้ำ {q.asked_count} ครั้ง</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="พิมพ์คำตอบ..."
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAnswer(q.id)}
                    className="flex-1 text-sm bg-input-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  <button
                    onClick={() => handleAnswer(q.id)}
                    disabled={!answers[q.id]?.trim() || saving[q.id]}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer shrink-0">
                    {saving[q.id] ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    บันทึก
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>}
      </div>
    </SettingsSection>
  )
}

export function ClinicSettingsView() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ตั้งค่าคลินิก</h1>
        <p className="text-sm text-muted-foreground mt-0.5">ข้อมูลคลินิกและบริการที่เปิดให้บริการ</p>
      </div>
      <ClinicInfoSection />
      <AiKnowledgeSection />
      <AiHealthCard />
      <UnansweredSection />
      <ServicesSection />
    </div>
  )
}
