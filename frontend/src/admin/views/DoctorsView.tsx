import { useCallback, useEffect, useState } from 'react'
import {
  CalendarCheck2, Clock3, Copy, Pencil, Plus, Save, Stethoscope, Trash2, X,
} from 'lucide-react'
import { TimePicker } from '../ui/TimePicker'
import {
  fetchDoctors, createDoctor as apiCreateDoctor, updateDoctor as apiUpdateDoctor,
  deleteDoctor as apiDeleteDoctor, updateDoctorShifts, getClinicSettings,
  type Doctor as ApiDoctor, type DoctorCreate,
} from '../api'
import { DAYS, DAY_SHORT, DOCTOR_COLORS, type DaySlot, type WeekSchedule } from '../types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeInitials(name: string): string {
  const cleaned = name.replace(/^(นพ\.|พญ\.|ดร\.|ผศ\.ดร\.|รศ\.ดร\.)\s*/u, '').trim()
  return cleaned.substring(0, 2)
}

export function apiShiftsToSchedule(shifts: { day_of_week: number; start: string; end: string }[]): WeekSchedule {
  return shifts.reduce<WeekSchedule>((acc, s) => {
    ;(acc[s.day_of_week] ??= []).push({ start: s.start, end: s.end })
    return acc
  }, {})
}

export function scheduleToApiShifts(schedule: WeekSchedule) {
  return Object.entries(schedule).flatMap(([day, slots]) =>
    slots.map(s => ({ day_of_week: Number(day), start: s.start, end: s.end }))
  )
}

// ── Add Doctor Modal ─────────────────────────────────────────────────────────

function AddDoctorModal({ clinicId, onClose, onCreated }: {
  clinicId: string
  onClose: () => void
  onCreated: (doc: ApiDoctor) => void
}) {
  const [form, setForm] = useState<DoctorCreate>({ name: '', specialty: '', color: DOCTOR_COLORS[0], initials: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const isValid = form.name.trim().length > 0 && form.specialty.trim().length > 0
  const field = 'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/30'
  const preview = form.initials.trim() || (form.name ? computeInitials(form.name) : '?')

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError('')
    try {
      const initials = form.initials.trim() || computeInitials(form.name)
      const newDoc = await apiCreateDoctor(clinicId, { ...form, initials })
      onCreated(newDoc)
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>เพิ่มแพทย์ใหม่</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ชื่อ-นามสกุล <span className="text-destructive">*</span></label>
            <input type="text" placeholder="เช่น นพ. สมชาย ใจดี" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ความเชี่ยวชาญ <span className="text-destructive">*</span></label>
            <input type="text" placeholder="เช่น อายุรกรรม" value={form.specialty}
              onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">อักษรย่อ (ไม่เกิน 2 ตัว)</label>
            <input type="text" placeholder={form.name ? computeInitials(form.name) : 'อก'} value={form.initials}
              onChange={e => setForm(f => ({ ...f, initials: e.target.value.substring(0, 2) }))}
              maxLength={2} className={`${field} w-24 font-mono`} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">สีประจำตัว</label>
            <div className="flex gap-2 flex-wrap">
              {DOCTOR_COLORS.map(color => (
                <button key={color} type="button" onClick={() => setForm(f => ({ ...f, color }))}
                  className={`w-8 h-8 rounded-full ${color} transition-all cursor-pointer ${form.color === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105 opacity-60'}`} />
              ))}
            </div>
          </div>
          {form.name && (
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border">
              <div className={`w-10 h-10 rounded-xl ${form.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>{preview}</div>
              <div>
                <p className="text-sm font-semibold text-foreground">{form.name}</p>
                <p className="text-xs text-muted-foreground">{form.specialty || 'ความเชี่ยวชาญ'}</p>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">ยกเลิก</button>
          <button onClick={handleSubmit} disabled={!isValid || submitting}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer">
            <Plus size={14} />{submitting ? 'กำลังเพิ่ม...' : 'เพิ่มแพทย์'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Doctor Modal ─────────────────────────────────────────────────────────

function EditDoctorModal({ doctor, onClose, onSaved }: {
  doctor: ApiDoctor
  onClose: () => void
  onSaved: (updated: ApiDoctor) => void
}) {
  const [form, setForm] = useState<DoctorCreate>({ name: doctor.name, specialty: doctor.specialty, color: doctor.color, initials: doctor.initials })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const isValid = form.name.trim().length > 0 && form.specialty.trim().length > 0
  const field = 'w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/30'
  const preview = form.initials.trim() || (form.name ? computeInitials(form.name) : '?')

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError('')
    try {
      const initials = form.initials.trim() || computeInitials(form.name)
      await apiUpdateDoctor(doctor.id, { ...form, initials })
      onSaved({ ...doctor, ...form, initials })
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>แก้ไขข้อมูลแพทย์</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ชื่อ-นามสกุล <span className="text-destructive">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">ความเชี่ยวชาญ <span className="text-destructive">*</span></label>
            <input type="text" value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">อักษรย่อ (ไม่เกิน 2 ตัว)</label>
            <input type="text" placeholder={form.name ? computeInitials(form.name) : 'อก'} value={form.initials}
              onChange={e => setForm(f => ({ ...f, initials: e.target.value.substring(0, 2) }))}
              maxLength={2} className={`${field} w-24 font-mono`} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">สีประจำตัว</label>
            <div className="flex gap-2 flex-wrap">
              {DOCTOR_COLORS.map(color => (
                <button key={color} type="button" onClick={() => setForm(f => ({ ...f, color }))}
                  className={`w-8 h-8 rounded-full ${color} transition-all cursor-pointer ${form.color === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105 opacity-60'}`} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border">
            <div className={`w-10 h-10 rounded-xl ${form.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>{preview}</div>
            <div>
              <p className="text-sm font-semibold text-foreground">{form.name || 'ชื่อแพทย์'}</p>
              <p className="text-xs text-muted-foreground">{form.specialty || 'ความเชี่ยวชาญ'}</p>
            </div>
          </div>
          {error && <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">ยกเลิก</button>
          <button onClick={handleSubmit} disabled={!isValid || submitting}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-5 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer">
            <Save size={14} />{submitting ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Doctor Card ───────────────────────────────────────────────────────────────

function DoctorCard({ doctor, schedule, selected, onSelect, onEdit, confirmDelete, onDeleteRequest, onConfirmDelete, onCancelDelete }: {
  doctor: ApiDoctor
  schedule: WeekSchedule
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  confirmDelete: boolean
  onDeleteRequest: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
  const jsDay = new Date().getDay()
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1
  const todaySlots = schedule[todayIdx] ?? []
  const workDays = Object.values(schedule).filter(s => s.length > 0).length

  return (
    <div onClick={onSelect}
      className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:shadow-sm flex flex-col gap-3 ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/30'}`}>
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-xl ${doctor.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
          {doctor.initials || doctor.name.substring(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{doctor.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{doctor.specialty}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors cursor-pointer"><Pencil size={11} /></button>
          <button onClick={onDeleteRequest} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded-lg transition-colors cursor-pointer"><Trash2 size={11} /></button>
        </div>
      </div>

      {confirmDelete && (
        <div onClick={e => e.stopPropagation()} className="flex items-center gap-2 px-2.5 py-2 bg-rose-50 border border-rose-200 rounded-lg">
          <span className="text-xs text-rose-700 flex-1">ลบแพทย์นี้?</span>
          <button onClick={onConfirmDelete} className="text-[10px] font-semibold text-white bg-rose-600 px-2 py-1 rounded hover:bg-rose-700 transition-colors cursor-pointer">ยืนยัน</button>
          <button onClick={onCancelDelete} className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">ยกเลิก</button>
        </div>
      )}

      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
          <Clock3 size={9} />วันนี้
        </p>
        {todaySlots.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {todaySlots.map((slot, i) => (
              <span key={i} className="text-[11px] bg-primary/10 text-primary border border-primary/15 px-1.5 py-0.5 rounded font-medium">
                {slot.start}–{slot.end}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/50">ไม่มีตาราง</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-border">
        <div className="flex gap-1">
          {[0,1,2,3,4,5,6].map(d => {
            const active = (schedule[d] ?? []).length > 0
            return (
              <div key={d} className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-colors ${active ? `${doctor.color} text-white` : 'bg-muted text-muted-foreground/40'}`}>
                {DAY_SHORT[d]}
              </div>
            )
          })}
        </div>
        <span className="text-[11px] text-muted-foreground">{workDays} วัน/สป.</span>
      </div>
    </div>
  )
}

// ── Schedule Editor ───────────────────────────────────────────────────────────

function ScheduleEditor({ doctor, schedule, onSlotsChange, onSave, saving, saved, error, clinicOpenTime = '08:00', clinicCloseTime = '17:00' }: {
  doctor: ApiDoctor
  schedule: WeekSchedule
  onSlotsChange: (day: number, slots: DaySlot[]) => void
  onSave: () => void
  saving: boolean
  saved: boolean
  error: string
  clinicOpenTime?: string
  clinicCloseTime?: string
}) {
  function slotsHaveIssues(slots: DaySlot[]): boolean {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      if (!s.start || !s.end) return true  // incomplete slot blocks save
      if (s.start >= s.end) return true
      if (s.start < clinicOpenTime) return true
      if (s.end > clinicCloseTime) return true
      for (let j = 0; j < slots.length; j++) {
        if (i === j) continue
        const t = slots[j]
        if (!t.start || !t.end) continue
        if (s.start < t.end && s.end > t.start) return true
      }
    }
    return false
  }
  const hasInvalidSlots = Object.values(schedule).some(slotsHaveIssues)

  const [expandedDay, setExpandedDay] = useState<number | null>(null)
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set())
  const [copyDay, setCopyDay] = useState<number | null>(null)
  const [copyTargets, setCopyTargets] = useState<Set<number>>(new Set())
  const [bulkPreset, setBulkPreset] = useState<string>('morning')

  const slotPresets: Record<string, DaySlot[]> = {
    morning:   [{ start: clinicOpenTime, end: '12:00' }],
    afternoon: [{ start: '13:00', end: clinicCloseTime }],
    fullday:   [{ start: clinicOpenTime, end: clinicCloseTime }],
  }
  const presetLabels: Record<string, { th: string; hint: string }> = {
    morning:   { th: 'เช้า',     hint: `${clinicOpenTime}–12:00` },
    afternoon: { th: 'บ่าย',     hint: `13:00–${clinicCloseTime}` },
    fullday:   { th: 'เต็มวัน', hint: `${clinicOpenTime}–${clinicCloseTime}` },
  }

  function toggleSelectDay(day: number) {
    setSelectedDays(prev => { const next = new Set(prev); if (next.has(day)) next.delete(day); else next.add(day); return next })
  }
  function applyBulkPreset() {
    const slots = slotPresets[bulkPreset] ?? []
    selectedDays.forEach(day => onSlotsChange(day, slots.map(s => ({ ...s }))))
    setSelectedDays(new Set())
  }
  function executeCopy() {
    const src = schedule[copyDay!] ?? []
    copyTargets.forEach(t => onSlotsChange(t, src.map(s => ({ ...s }))))
    setCopyDay(null); setCopyTargets(new Set())
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${doctor.color} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
            {doctor.initials || doctor.name.substring(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{doctor.name}</p>
            <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasInvalidSlots && <span className="text-xs text-destructive">ช่วงเวลาไม่ถูกต้อง</span>}
          {!hasInvalidSlots && error && <span className="text-xs text-destructive">{error}</span>}
          <button onClick={onSave} disabled={saving || hasInvalidSlots}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer">
            <Save size={13} />{saving ? 'กำลังบันทึก...' : saved ? 'บันทึกแล้ว ✓' : 'บันทึก'}
          </button>
        </div>
      </div>

      {selectedDays.size > 0 && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-primary/5 border-b border-primary/10 flex-wrap">
          <span className="text-xs font-semibold text-primary">{selectedDays.size} วัน</span>
          <div className="flex gap-1">
            {Object.entries(presetLabels).map(([k, v]) => (
              <button key={k} onClick={() => setBulkPreset(k)}
                className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${bulkPreset === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'}`}>
                {v.th}
              </button>
            ))}
          </div>
          <button onClick={applyBulkPreset} className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">ใช้กับที่เลือก</button>
          <button onClick={() => setSelectedDays(new Set())} className="text-xs text-muted-foreground hover:text-foreground ml-auto cursor-pointer">ยกเลิก</button>
        </div>
      )}

      <div className="divide-y divide-border">
        {DAYS.map((dayName, dayIdx) => {
          const slots = schedule[dayIdx] ?? []
          const isExpanded = expandedDay === dayIdx
          const isSelected = selectedDays.has(dayIdx)
          const isCopySource = copyDay === dayIdx

          return (
            <div key={dayIdx} className={isExpanded ? 'bg-muted/20' : ''}>
              <div className="flex items-center gap-3 px-5 py-3 min-h-[3rem]">
                <input type="checkbox" checked={isSelected} onChange={() => toggleSelectDay(dayIdx)} onClick={e => e.stopPropagation()}
                  className="w-3.5 h-3.5 rounded accent-primary shrink-0 cursor-pointer" />
                <button onClick={() => setExpandedDay(isExpanded ? null : dayIdx)}
                  className="w-20 text-left text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer shrink-0">
                  {dayName}
                </button>
                <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
                  {slots.length > 0 ? slots.map((slot, i) => (
                    <span key={i} className="inline-flex items-center text-[11px] bg-primary/10 text-primary border border-primary/15 px-2 py-0.5 rounded-md font-medium whitespace-nowrap">
                      {slot.start}–{slot.end}
                    </span>
                  )) : <span className="text-xs text-muted-foreground/40">—</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setCopyDay(isCopySource ? null : dayIdx); setCopyTargets(new Set()) }}
                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors cursor-pointer ${isCopySource ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                    <Copy size={10} />คัดลอก
                  </button>
                  <button onClick={() => setExpandedDay(isExpanded ? null : dayIdx)}
                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors cursor-pointer ${isExpanded ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                    <Pencil size={10} />แก้ไข
                  </button>
                </div>
              </div>

              {isCopySource && (
                <div className="px-5 pb-3 flex items-center gap-2 flex-wrap border-t border-border/50 pt-2.5">
                  <span className="text-[11px] text-muted-foreground font-medium">คัดลอกไปที่:</span>
                  {DAYS.map((d, i) => i !== dayIdx && (
                    <button key={i}
                      onClick={() => setCopyTargets(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next })}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${copyTargets.has(i) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/60'}`}>
                      {d}
                    </button>
                  ))}
                  <button onClick={executeCopy} disabled={copyTargets.size === 0}
                    className="text-[11px] font-semibold bg-primary text-primary-foreground px-3 py-0.5 rounded-lg disabled:opacity-40 hover:bg-primary/90 transition-colors cursor-pointer ml-1">
                    คัดลอก
                  </button>
                </div>
              )}

              {isExpanded && (
                <div className="px-5 pb-4 pt-1 border-t border-border/50">
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <span className="text-[11px] text-muted-foreground font-medium mr-0.5">Preset:</span>
                    {Object.entries(presetLabels).map(([k, v]) => (
                      <button key={k} onClick={() => onSlotsChange(dayIdx, slotPresets[k].map(s => ({ ...s })))}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-border hover:border-primary hover:bg-primary/5 hover:text-primary text-muted-foreground transition-colors cursor-pointer">
                        {v.th} <span className="opacity-50">{v.hint}</span>
                      </button>
                    ))}
                    {slots.length > 0 && (
                      <button onClick={() => onSlotsChange(dayIdx, [])}
                        className="ml-auto text-[11px] px-2.5 py-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors cursor-pointer flex items-center gap-1">
                        <X size={10} />ล้าง
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {slots.map((slot, i) => {
                      const invalidRange = Boolean(slot.start && slot.end && slot.start >= slot.end)
                      const outsideClinic = Boolean(
                        (slot.start && slot.start < clinicOpenTime) ||
                        (slot.end && slot.end > clinicCloseTime)
                      )
                      const overlaps = slots.some((t, j) =>
                        j !== i && t.start && t.end && slot.start && slot.end &&
                        slot.start < t.end && slot.end > t.start
                      )
                      const invalid = invalidRange || outsideClinic || overlaps
                      return (
                        <div key={i} className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <TimePicker
                              value={slot.start}
                              onChange={v => { const next = [...slots]; next[i] = { ...slot, start: v }; onSlotsChange(dayIdx, next) }}
                              minTime={clinicOpenTime}
                              minTimeInclusive
                              maxTime={clinicCloseTime}
                              invalid={invalid}
                            />
                            <span className="text-muted-foreground text-xs">–</span>
                            <TimePicker
                              value={slot.end}
                              onChange={v => { const next = [...slots]; next[i] = { ...slot, end: v }; onSlotsChange(dayIdx, next) }}
                              minTime={slot.start || clinicOpenTime}
                              maxTime={clinicCloseTime}
                              invalid={invalid}
                            />
                            <button onClick={() => onSlotsChange(dayIdx, slots.filter((_, j) => j !== i))}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer">
                              <Trash2 size={12} />
                            </button>
                          </div>
                          {invalidRange && (
                            <p className="text-[11px] text-destructive pl-1">เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด</p>
                          )}
                          {!invalidRange && outsideClinic && (
                            <p className="text-[11px] text-destructive pl-1">ต้องอยู่ในเวลาทำการคลินิก ({clinicOpenTime}–{clinicCloseTime})</p>
                          )}
                          {!invalidRange && !outsideClinic && overlaps && (
                            <p className="text-[11px] text-destructive pl-1">ช่วงเวลาซ้อนทับกับช่วงอื่น</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <button onClick={() => onSlotsChange(dayIdx, [...slots, { start: '', end: '' }])}
                    className="mt-2.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                    <Plus size={12} />เพิ่มช่วงเวลา
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-5 py-3 border-t border-border bg-muted/20">
        <p className="text-xs text-muted-foreground">คลิก "แก้ไข" เพื่อตั้งเวลา · ☑ เลือกหลายวันเพื่อแก้ไขพร้อมกัน · "คัดลอก" เพื่อทำซ้ำไปวันอื่น</p>
      </div>
    </div>
  )
}

// ── Doctors View ──────────────────────────────────────────────────────────────

export function DoctorsView({ clinicId }: { clinicId: string }) {
  const [doctorList, setDoctorList] = useState<ApiDoctor[]>([])
  const [schedules, setSchedules] = useState<Record<string, WeekSchedule>>({})
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null)
  const [showAddDoctor, setShowAddDoctor] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [shiftError, setShiftError] = useState('')
  const [editingDoctor, setEditingDoctor] = useState<ApiDoctor | null>(null)
  const [clinicOpenTime, setClinicOpenTime] = useState('08:00')
  const [clinicCloseTime, setClinicCloseTime] = useState('17:00')

  useEffect(() => {
    if (clinicId) {
      getClinicSettings(clinicId).then(s => {
        setClinicOpenTime(s.open_time || '08:00')
        setClinicCloseTime(s.close_time || '17:00')
      }).catch(() => {})
    }
  }, [clinicId])

  const loadDoctors = useCallback(() => {
    if (!clinicId) { setLoadingDoctors(false); return }
    setLoadingDoctors(true)
    fetchDoctors(clinicId)
      .then(docs => {
        setDoctorList(docs)
        const sm: Record<string, WeekSchedule> = {}
        for (const doc of docs) sm[doc.id] = apiShiftsToSchedule(doc.shifts)
        setSchedules(sm)
      })
      .catch(console.error)
      .finally(() => setLoadingDoctors(false))
  }, [clinicId])

  useEffect(() => { loadDoctors() }, [loadDoctors])

  function handleSlotsChange(day: number, slots: DaySlot[]) {
    if (!selectedDoctor) return
    setSchedules(prev => ({ ...prev, [selectedDoctor]: { ...prev[selectedDoctor], [day]: slots } }))
    setSaved(false)
  }

  async function handleSave() {
    if (!selectedDoctor) return
    setSaving(true)
    setShiftError('')
    try {
      await updateDoctorShifts(selectedDoctor, scheduleToApiShifts(schedules[selectedDoctor] ?? {}))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setShiftError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDoctor(doctorId: string) {
    try {
      await apiDeleteDoctor(doctorId)
      setDoctorList(prev => prev.filter(d => d.id !== doctorId))
      setSchedules(prev => { const n = { ...prev }; delete n[doctorId]; return n })
      if (selectedDoctor === doctorId) setSelectedDoctor(null)
    } catch (e) { console.error(e) }
    finally { setConfirmDelete(null) }
  }

  const selectedDoc = doctorList.find(d => d.id === selectedDoctor) ?? null

  return (
    <div className="flex flex-col gap-6">
      {showAddDoctor && (
        <AddDoctorModal clinicId={clinicId} onClose={() => setShowAddDoctor(false)}
          onCreated={newDoc => { setDoctorList(prev => [...prev, newDoc]); setSchedules(prev => ({ ...prev, [newDoc.id]: {} })); setShowAddDoctor(false) }} />
      )}
      {editingDoctor && (
        <EditDoctorModal doctor={editingDoctor} onClose={() => setEditingDoctor(null)}
          onSaved={updated => { setDoctorList(prev => prev.map(d => d.id === updated.id ? updated : d)); setEditingDoctor(null) }} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ตารางงานแพทย์</h1>
          <p className="text-sm text-muted-foreground mt-0.5">จัดการเวลาทำงานของแพทย์รายสัปดาห์</p>
        </div>
        <button onClick={() => setShowAddDoctor(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
          <Plus size={14} />เพิ่มแพทย์
        </button>
      </div>

      {loadingDoctors ? (
        <p className="text-sm text-muted-foreground py-8 text-center">กำลังโหลดข้อมูลแพทย์...</p>
      ) : doctorList.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <Stethoscope size={32} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลแพทย์ กดปุ่ม "เพิ่มแพทย์" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {doctorList.map(doc => (
              <DoctorCard key={doc.id} doctor={doc} schedule={schedules[doc.id] ?? {}}
                selected={selectedDoctor === doc.id}
                onSelect={() => setSelectedDoctor(selectedDoctor === doc.id ? null : doc.id)}
                onEdit={() => setEditingDoctor(doc)}
                confirmDelete={confirmDelete === doc.id}
                onDeleteRequest={() => setConfirmDelete(confirmDelete === doc.id ? null : doc.id)}
                onConfirmDelete={() => handleDeleteDoctor(doc.id)}
                onCancelDelete={() => setConfirmDelete(null)} />
            ))}
          </div>

          {selectedDoc ? (
            <ScheduleEditor doctor={selectedDoc} schedule={schedules[selectedDoc.id] ?? {}}
              onSlotsChange={handleSlotsChange} onSave={handleSave}
              saving={saving} saved={saved} error={shiftError}
              clinicOpenTime={clinicOpenTime} clinicCloseTime={clinicCloseTime} />
          ) : (
            <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
              <CalendarCheck2 size={28} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">เลือกแพทย์เพื่อแก้ไขตารางเวลา</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

