import { useState } from 'react'
import * as t from '../theme'

interface Props {
  defaultName: string
  onNext: (name: string, phone: string) => void
  onBack: () => void
}

export default function StepPatientInfo({ defaultName, onNext, onBack }: Props) {
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState('')
  const [touched, setTouched] = useState(false)

  const phoneValid = /^[0-9]{9,10}$/.test(phone.replace(/[-\s]/g, ''))
  const nameValid = name.trim().length >= 2
  const canProceed = nameValid && phoneValid

  function handleNext() {
    setTouched(true)
    if (canProceed) onNext(name.trim(), phone.replace(/[-\s]/g, ''))
  }

  return (
    <div style={t.section}>
      <p style={{ ...t.small, marginBottom: 4 }}>กรุณากรอกข้อมูลผู้รับบริการ</p>

      <span style={t.label}>ชื่อ-นามสกุล</span>
      <input
        style={{ ...t.input, borderColor: touched && !nameValid ? t.c.danger : t.c.border }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ชื่อ นามสกุล"
      />
      {touched && !nameValid && (
        <p style={{ color: t.c.danger, fontSize: 12, marginTop: 4 }}>กรุณากรอกชื่อ</p>
      )}

      <span style={t.label}>เบอร์โทรศัพท์</span>
      <input
        style={{ ...t.input, borderColor: touched && !phoneValid ? t.c.danger : t.c.border }}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="08X-XXX-XXXX"
        inputMode="tel"
        type="tel"
      />
      {touched && !phoneValid && (
        <p style={{ color: t.c.danger, fontSize: 12, marginTop: 4 }}>
          กรุณากรอกเบอร์โทรที่ถูกต้อง (9-10 หลัก)
        </p>
      )}

      <button style={t.btn(false)} onClick={handleNext}>ถัดไป</button>
      <button style={t.btnOutline} onClick={onBack}>ย้อนกลับ</button>
    </div>
  )
}
