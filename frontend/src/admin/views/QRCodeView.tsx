import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Printer, QrCode, RefreshCw } from 'lucide-react'
import { CLINIC_ID } from '../types'

const LIFF_ID = import.meta.env.VITE_LIFF_ID as string | undefined

function buildBookingUrl(): string {
  if (!LIFF_ID) return ''
  const base = `https://liff.line.me/${LIFF_ID}`
  return CLINIC_ID ? `${base}?clinicId=${CLINIC_ID}` : base
}

export function QRCodeView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const printCanvasRef = useRef<HTMLCanvasElement>(null)
  const [url, setUrl] = useState(buildBookingUrl)
  const [customUrl, setCustomUrl] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [error, setError] = useState('')

  const activeUrl = useCustom && customUrl.trim() ? customUrl.trim() : url

  useEffect(() => {
    if (!activeUrl || !canvasRef.current) return
    setError('')
    QRCode.toCanvas(canvasRef.current, activeUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#166534', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    }).catch(e => setError(e.message))

    if (printCanvasRef.current) {
      QRCode.toCanvas(printCanvasRef.current, activeUrl, {
        width: 600,
        margin: 3,
        color: { dark: '#166534', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      }).catch(() => {})
    }
  }, [activeUrl])

  function handleDownload() {
    if (!canvasRef.current || !activeUrl) return
    const link = document.createElement('a')
    link.download = 'mornut-booking-qr.png'
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  function handlePrint() {
    if (!printCanvasRef.current || !activeUrl) return
    const dataUrl = printCanvasRef.current.toDataURL('image/png')
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>QR Code จองคิว — MorNut</title>
          <style>
            body { margin: 0; display: flex; flex-direction: column; align-items: center;
                   justify-content: center; min-height: 100vh; font-family: sans-serif;
                   background: #fff; padding: 40px; box-sizing: border-box; }
            img  { width: 300px; height: 300px; }
            h1   { font-size: 22px; font-weight: 700; color: #166534; margin: 20px 0 6px; }
            p    { font-size: 13px; color: #6b7280; margin: 0 0 4px; text-align: center; }
            small { font-size: 10px; color: #9ca3af; word-break: break-all; text-align: center; display: block; margin-top: 12px; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" />
          <h1>จองคิวออนไลน์</h1>
          <p>สแกน QR Code ด้านบน เพื่อจองคิวผ่าน LINE</p>
          <p>ไม่ต้องรอต่อคิวที่คลินิก — จองได้ทุกที่ทุกเวลา</p>
          <small>${activeUrl}</small>
          <script>window.onload = () => { window.print(); window.close() }</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  const hasLiff = !!LIFF_ID
  const hasClinic = !!CLINIC_ID

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>QR Code จองคิว</h1>
        <p className="text-sm text-muted-foreground mt-0.5">ให้ผู้ป่วยสแกนเพื่อเปิดหน้าจองคิวผ่าน LINE ได้ทันที</p>
      </div>

      {(!hasLiff || !hasClinic) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800 flex flex-col gap-1">
          {!hasLiff && <p>⚠️ ยังไม่ได้ตั้งค่า <code className="font-mono text-xs bg-yellow-100 px-1 rounded">VITE_LIFF_ID</code> ใน .env.local</p>}
          {!hasClinic && <p>⚠️ ยังไม่ได้ตั้งค่า <code className="font-mono text-xs bg-yellow-100 px-1 rounded">VITE_CLINIC_ID</code> ใน .env.local</p>}
          <p className="text-yellow-700 text-xs mt-1">สามารถใช้ลิงก์กำหนดเองด้านล่างแทนได้</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Display */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-5">
          {activeUrl ? (
            <>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
                <canvas ref={canvasRef} />
              </div>
              <p className="text-xs text-muted-foreground text-center break-all max-w-[280px] font-mono">{activeUrl}</p>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-3 w-full">
                <button onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 border border-border text-foreground text-sm font-medium py-2.5 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                  <Download size={15} />บันทึกรูปภาพ
                </button>
                <button onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
                  <Printer size={15} />พิมพ์
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <QrCode size={40} className="opacity-30" />
              <p className="text-sm">กรุณาตั้งค่า LIFF ID ก่อนสร้าง QR Code</p>
            </div>
          )}
        </div>

        {/* Config panel */}
        <div className="flex flex-col gap-4">
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-foreground text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>การตั้งค่า</h2>

            {/* Auto URL */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">URL อัตโนมัติ (จาก LIFF ID)</label>
              <div className="flex items-center gap-2">
                <input readOnly value={url}
                  className="flex-1 text-xs font-mono bg-muted/50 border border-border rounded-lg px-3 py-2 text-muted-foreground" />
                <button onClick={() => { setUrl(buildBookingUrl()); setUseCustom(false) }}
                  className="p-2 border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            {/* Custom URL */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">ใช้ลิงก์กำหนดเอง</label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={useCustom} onChange={e => setUseCustom(e.target.checked)}
                    className="w-4 h-4 accent-primary" />
                  <span className="text-xs text-muted-foreground">เปิดใช้</span>
                </label>
              </div>
              <input
                type="url"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                disabled={!useCustom}
                placeholder="https://liff.line.me/..."
                className="text-xs font-mono bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-40 disabled:cursor-not-allowed" />
            </div>
          </div>

          {/* Usage guide */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
            <h2 className="font-semibold text-foreground text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>วิธีใช้งาน</h2>
            <ol className="flex flex-col gap-2">
              {[
                'พิมพ์ QR Code แล้วติดที่หน้าเคาน์เตอร์หรือห้องรอ',
                'ผู้ป่วยสแกน QR ด้วยกล้องมือถือหรือแอป LINE',
                'ระบบจะเปิดหน้าจองคิวผ่าน LINE LIFF ทันที',
                'ผู้ป่วยเลือกบริการ วันเวลา และยืนยันการจอง',
                'แอดมินเห็นคิวใหม่ในหน้าภาพรวมแบบ Real-time',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Hidden high-res canvas for print */}
      <canvas ref={printCanvasRef} className="hidden" />
    </div>
  )
}
