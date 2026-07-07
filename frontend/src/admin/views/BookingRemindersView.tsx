import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ClipboardList, Plus, Save, X } from 'lucide-react'
import { DatePicker } from '../DatePicker'
import {
  fetchBookingReminders, fetchLinePatients,
  createBookingReminder, updateBookingReminder,
  type BookingReminder, type LinePatient,
} from '../api'

const INTERVAL_PRESETS: { value: '7' | '14' | '30' | 'custom'; label: string }[] = [
  { value: '7', label: 'ทุกสัปดาห์ (7 วัน)' },
  { value: '14', label: 'ทุก 2 สัปดาห์ (14 วัน)' },
  { value: '30', label: 'ทุกเดือน (30 วัน)' },
  { value: 'custom', label: 'กำหนดเอง' },
]

function AddBookingReminderModal({ clinicId, patients, onClose, onCreated }: {
  clinicId: string
  patients: LinePatient[]
  onClose: () => void
  onCreated: (reminder: BookingReminder) => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [intervalPreset, setIntervalPreset] = useState<'7' | '14' | '30' | 'custom'>('30')
  const [customDays, setCustomDays] = useState(30)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const intervalDays = intervalPreset === 'custom' ? customDays : Number(intervalPreset)
  const selected = patients.find(p => p.patient_line_id === selectedId)
  const isValid = !!selected && intervalDays > 0 && startDate.length > 0

  const handleSubmit = async () => {
    if (!isValid || !selected) return
    setSubmitting(true)
    setError('')
    try {
      const reminder = await createBookingReminder({
        patient_line_id: selected.patient_line_id,
        patient_name: selected.patient_name,
        patient_phone: selected.phone,
        interval_days: intervalDays,
        start_date: startDate,
        clinic_id: clinicId,
      })
      onCreated(reminder)
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  const field = 'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/30'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>เพิ่มการแจ้งเตือน</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ผู้ป่วย (ต้องเคยทักไลน์ OA มาก่อน) <span className="text-destructive">*</span></label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={field}>
              <option value="">เลือกผู้ป่วย</option>
              {patients.map(p => <option key={p.patient_line_id} value={p.patient_line_id}>{p.patient_name} ({p.phone})</option>)}
            </select>
            {patients.length === 0 && (
              <p className="text-[11px] text-muted-foreground">ยังไม่มีผู้ป่วยที่ทักไลน์ OA เข้ามา — ต้องมีบัญชี LINE ถึงจะส่งแจ้งเตือนได้</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">วันแจ้งเตือนครั้งแรก <span className="text-destructive">*</span></label>
            <DatePicker value={startDate} onChange={setStartDate} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ความถี่ <span className="text-destructive">*</span></label>
            <select value={intervalPreset} onChange={e => setIntervalPreset(e.target.value as typeof intervalPreset)} className={field}>
              {INTERVAL_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {intervalPreset === 'custom' && (
              <input type="number" min={1} value={customDays}
                onChange={e => setCustomDays(Number(e.target.value))}
                placeholder="จำนวนวัน" className={`${field} font-mono mt-1.5`} />
            )}
          </div>

          {error && <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors">ยกเลิก</button>
          <button onClick={handleSubmit} disabled={!isValid || submitting}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
            <Plus size={14} />{submitting ? 'กำลังเพิ่ม...' : 'เพิ่มการแจ้งเตือน'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function BookingRemindersView({ clinicId }: { clinicId: string }) {
  const [reminders, setReminders] = useState<BookingReminder[]>([])
  const [patients, setPatients] = useState<LinePatient[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editInterval, setEditInterval] = useState(0)

  const load = useCallback(() => {
    if (!clinicId) { setLoading(false); return }
    setLoading(true)
    Promise.all([fetchBookingReminders(clinicId), fetchLinePatients(clinicId)])
      .then(([r, p]) => { setReminders(r); setPatients(p) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clinicId])

  useEffect(() => { load() }, [load])

  async function saveEdit(reminder: BookingReminder) {
    await updateBookingReminder(reminder.id, { interval_days: editInterval })
    setEditingId(null)
    load()
  }

  async function toggleStatus(reminder: BookingReminder) {
    await updateBookingReminder(reminder.id, { status: reminder.status === 'active' ? 'stopped' : 'active' })
    load()
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col gap-6">
      {showAdd && (
        <AddBookingReminderModal clinicId={clinicId} patients={patients}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load() }} />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>แจ้งเตือนนัดหมาย</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ส่งข้อความ LINE เตือนคนไข้ให้กลับมาจองคิวตรวจติดตามผลตามรอบที่กำหนด</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
          <Plus size={14} />เพิ่มการแจ้งเตือน
        </button>
      </div>

      {loading && <p className="text-sm text-muted-foreground py-8 text-center">กำลังโหลด...</p>}
      {!loading && reminders.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <ClipboardList size={32} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน กดปุ่ม "เพิ่มการแจ้งเตือน" เพื่อเริ่มต้น</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {reminders.map(r => {
          const overdue = r.status === 'active' && r.next_reminder_date <= todayStr
          const isEditing = editingId === r.id
          return (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{r.patient_name}</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-foreground/5 text-muted-foreground'}`}>
                      {r.status === 'active' ? 'กำลังแจ้งเตือน' : 'หยุดแล้ว'}
                    </span>
                    {overdue && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700 flex items-center gap-1">
                        <AlertTriangle size={10} />ถึงกำหนดแล้ว
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{r.patient_phone}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span>ทุก {r.interval_days} วัน</span>
                    {r.status === 'active' && (
                      <span>· นัดครั้งถัดไป: {new Date(r.next_reminder_date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', calendar: 'buddhist' })}</span>
                    )}
                    {r.last_reminded_at && (
                      <span>· ส่งล่าสุด: {new Date(r.last_reminded_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', calendar: 'buddhist' })}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { setEditingId(r.id); setEditInterval(r.interval_days) }}
                    className="flex items-center gap-1.5 border border-border text-foreground text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-foreground/5 transition-colors">
                    แก้ไข
                  </button>
                  <button onClick={() => toggleStatus(r)}
                    className={`flex items-center gap-1.5 border text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${r.status === 'active' ? 'border-destructive/30 text-destructive hover:bg-destructive/10' : 'border-border text-foreground hover:bg-foreground/5'}`}>
                    {r.status === 'active' ? 'หยุด' : 'เปิดใช้งาน'}
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="mt-3 pt-3 border-t border-border flex items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">ความถี่ (วัน)</label>
                    <input type="number" min={1} value={editInterval}
                      onChange={e => setEditInterval(Number(e.target.value))}
                      className="text-sm bg-input-background border border-border rounded-lg px-3 py-2 font-mono w-32" />
                  </div>
                  <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors">ยกเลิก</button>
                  <button onClick={() => saveEdit(r)} className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                    <Save size={12} />บันทึก
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
