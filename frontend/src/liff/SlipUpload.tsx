import { useRef, useState } from 'react'
import { uploadSlip, type SlipResult } from '../api/slips'
import * as t from './theme'

interface Props {
  bookingId: string
  depositAmount: number
}

type State = 'idle' | 'uploading' | 'success' | 'error'

export default function SlipUpload({ bookingId, depositAmount }: Props) {
  const [state, setState] = useState<State>('idle')
  const [result, setResult] = useState<SlipResult | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setState('uploading')
    setError('')
    try {
      const res = await uploadSlip(bookingId, file)
      setResult(res)
      setState('success')
    } catch (err) {
      setError((err as Error).message)
      setState('error')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (state === 'success' && result) {
    return (
      <div
        style={{
          background: '#e8f5e9',
          border: '1px solid #a5d6a7',
          borderRadius: 12,
          padding: '14px 16px',
          marginTop: 16,
        }}
      >
        <p style={{ color: '#2e7d32', fontWeight: 700, margin: '0 0 4px', fontSize: 15 }}>
          ✅ ตรวจสอบสลิปสำเร็จ!
        </p>
        <p style={{ fontSize: 13, color: '#388e3c', margin: 0 }}>
          ยอดที่ได้รับ ฿{result.amount.toLocaleString()} — การจองได้รับการยืนยันแล้ว
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {state === 'uploading' ? (
        <div style={{ textAlign: 'center', padding: '14px 0', color: t.c.sub, fontSize: 14 }}>
          กำลังตรวจสอบสลิป...
        </div>
      ) : (
        <button style={t.btn(false)} onClick={() => inputRef.current?.click()}>
          📷 อัปโหลดหลักฐานการโอน ฿{depositAmount.toLocaleString()}
        </button>
      )}

      {state === 'error' && (
        <div
          style={{
            background: '#fff0f0',
            border: `1px solid ${t.c.danger}`,
            borderRadius: 8,
            padding: '10px 12px',
            marginTop: 8,
            fontSize: 13,
            color: t.c.danger,
          }}
        >
          {error}
          <br />
          <span style={{ fontSize: 12, color: t.c.sub }}>กรุณาตรวจสอบสลิปและลองอีกครั้ง</span>
        </div>
      )}
    </div>
  )
}
