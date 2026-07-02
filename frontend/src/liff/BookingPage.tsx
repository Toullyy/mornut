import { useEffect, useState } from 'react'
import type { CoverageType } from '../api/bookings'
import { initLiff, liff } from '../lib/liff'
import BookingSuccess from './BookingSuccess'
import StepCoverage from './steps/StepCoverage'
import StepDateTime from './steps/StepDateTime'
import StepConfirm from './steps/StepConfirm'
import StepPatientInfo from './steps/StepPatientInfo'
import StepService from './steps/StepService'
import * as t from './theme'
import type { Service } from '../api/clinics'

// Exported so step components can import the shape
export interface FormData {
  serviceId: string
  serviceName: string
  durationMin: number
  depositAmount: number
  date: string
  time: string
  patientName: string
  phone: string
  coverage: CoverageType
}

type Step = 'service' | 'datetime' | 'patient' | 'coverage' | 'confirm' | 'success'

const STEPS: Exclude<Step, 'success'>[] = ['service', 'datetime', 'patient', 'coverage', 'confirm']
const STEP_LABEL: Record<Step, string> = {
  service:  'เลือกบริการ',
  datetime: 'วันและเวลา',
  patient:  'ข้อมูลผู้ป่วย',
  coverage: 'เลือกสิทธิ์',
  confirm:  'ยืนยัน',
  success:  '',
}

interface Profile {
  userId: string
  displayName: string
}

export default function BookingPage() {
  const [liffReady, setLiffReady] = useState(false)
  const [liffError, setLiffError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [step, setStep] = useState<Step>('service')
  const [form, setForm] = useState<Partial<FormData>>({})
  const [bookingId, setBookingId] = useState('')

  // clinicId comes from the LIFF URL query: ?clinicId=xxx
  const clinicId = new URLSearchParams(window.location.search).get('clinicId') ?? ''

  useEffect(() => {
    initLiff()
      .then(async () => {
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }
        const p = await liff.getProfile()
        setProfile({ userId: p.userId, displayName: p.displayName })
        setForm((f) => ({ ...f, patientName: p.displayName }))
        setLiffReady(true)
      })
      .catch((e: Error) => setLiffError(e.message))
  }, [])

  if (liffError) return <FullPageMsg color={t.c.danger}>{liffError}</FullPageMsg>
  if (!liffReady) return <FullPageMsg>{null}</FullPageMsg>
  if (!clinicId)
    return (
      <FullPageMsg color={t.c.danger}>
        ไม่พบ clinicId — กรุณาติดต่อคลินิกเพื่อรับลิงก์ที่ถูกต้อง
      </FullPageMsg>
    )

  if (step === 'success') {
    return <BookingSuccess bookingId={bookingId} form={form as FormData} />
  }

  const stepIndex = STEPS.indexOf(step as Exclude<Step, 'success'>)

  return (
    <div style={t.page}>
      {/* Header */}
      <div style={{ background: t.c.primary, padding: '16px 16px 12px', color: t.c.white }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 17 }}>หมอนัด — จองคิวแพทย์</p>
        <p style={{ margin: '2px 0 10px', fontSize: 13, opacity: 0.85 }}>
          ขั้นตอน {stepIndex + 1}/{STEPS.length} — {STEP_LABEL[step]}
        </p>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 4 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i <= stepIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div style={{ padding: '12px 0 32px' }}>
        {step === 'service' && (
          <StepService
            clinicId={clinicId}
            onSelect={(s: Service) => {
              setForm((f) => ({
                ...f,
                serviceId: s.id,
                serviceName: s.name,
                durationMin: s.duration_min,
                depositAmount: s.deposit_amount,
              }))
              setStep('datetime')
            }}
          />
        )}

        {step === 'datetime' && (
          <StepDateTime
            clinicId={clinicId}
            onSelect={(date, time) => {
              setForm((f) => ({ ...f, date, time }))
              setStep('patient')
            }}
            onBack={() => setStep('service')}
          />
        )}

        {step === 'patient' && (
          <StepPatientInfo
            defaultName={profile?.displayName ?? ''}
            onNext={(name, phone) => {
              setForm((f) => ({ ...f, patientName: name, phone }))
              setStep('coverage')
            }}
            onBack={() => setStep('datetime')}
          />
        )}

        {step === 'coverage' && (
          <StepCoverage
            clinicId={clinicId}
            date={form.date!}
            onSelect={(coverage) => {
              setForm((f) => ({ ...f, coverage }))
              setStep('confirm')
            }}
            onBack={() => setStep('patient')}
          />
        )}

        {step === 'confirm' && (
          <StepConfirm
            form={form as FormData}
            clinicId={clinicId}
            lineUserId={profile!.userId}
            onSuccess={(id) => {
              setBookingId(id)
              setStep('success')
            }}
            onBack={() => setStep('coverage')}
          />
        )}
      </div>
    </div>
  )
}

function FullPageMsg({
  children,
  color = t.c.sub,
}: {
  children: React.ReactNode
  color?: string
}) {
  return (
    <div
      style={{
        ...t.page,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        padding: 24,
        textAlign: 'center',
        fontSize: 15,
      }}
    >
      {children ?? 'กำลังโหลด...'}
    </div>
  )
}
