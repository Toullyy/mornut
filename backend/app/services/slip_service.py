import asyncio
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, UploadFile

from app.services import firestore as repo
from app.services import line as line_svc
from app.services import slipok
from app.services import storage as storage_svc

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


async def verify(booking_id: str, file: UploadFile) -> dict:
    # ── 1. Validate file ────────────────────────────────────────────────────
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(415, "รองรับเฉพาะไฟล์รูปภาพ (JPEG, PNG, WEBP)")

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_BYTES:
        raise HTTPException(413, "ไฟล์ขนาดใหญ่เกินไป (สูงสุด 10 MB)")

    # ── 2. Load booking ─────────────────────────────────────────────────────
    raw = await asyncio.to_thread(repo.get_booking, booking_id)
    if not raw:
        raise HTTPException(404, "ไม่พบรายการจอง")
    if raw.get("status") != "pending_slip":
        raise HTTPException(
            409, f"สถานะการจองคือ '{raw.get('status')}' ไม่สามารถยืนยันสลิปได้"
        )

    deposit = float(raw.get("depositAmount", 0))

    # ── 3. Call SlipOK ──────────────────────────────────────────────────────
    filename = file.filename or "slip.jpg"
    content_type = file.content_type or "image/jpeg"
    try:
        result = await slipok.verify_slip_file(file_bytes, filename, content_type)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"SlipOK ตอบกลับ {exc.response.status_code}") from exc
    except httpx.RequestError as exc:
        raise HTTPException(502, "ไม่สามารถเชื่อมต่อ SlipOK ได้") from exc

    # ── 4. Validate SlipOK result ───────────────────────────────────────────
    if not result.get("success"):
        raise HTTPException(422, "สลิปไม่ถูกต้องหรืออาจเป็นสลิปปลอม")

    data = result.get("data") or {}
    amount = float(data.get("amount", 0))
    trans_ref: str = str(data.get("transRef", ""))

    if amount < deposit:
        raise HTTPException(
            422,
            f"ยอดเงินไม่ถึงยอดมัดจำ (ต้องการ ฿{deposit:,.0f} แต่ได้รับ ฿{amount:,.0f})",
        )

    if trans_ref and await asyncio.to_thread(repo.is_trans_ref_used, trans_ref):
        raise HTTPException(422, "สลิปนี้ถูกใช้ไปแล้ว กรุณาส่งสลิปใหม่")

    # ── 5. Upload slip image to Firebase Storage ────────────────────────────
    storage_path = await storage_svc.upload_slip(booking_id, file_bytes, content_type)

    # ── 6. Update booking → confirmed ───────────────────────────────────────
    await asyncio.to_thread(
        repo.update_booking,
        booking_id,
        {
            "status": "confirmed",
            "slip.url": storage_path,
            "slip.verified": True,
            "slip.amount": amount,
            "slip.transRef": trans_ref,
            "slip.verifiedAt": datetime.now(timezone.utc),
        },
    )

    # ── 7. Notify patient + nurses concurrently ─────────────────────────────
    await asyncio.gather(
        line_svc.push_booking_confirmed(
            user_id=raw.get("patientLineId", ""),
            booking_id=booking_id,
            patient_name=raw.get("patientName", ""),
            date=raw.get("date", ""),
            time=raw.get("time", ""),
            service_name=raw.get("serviceName", ""),
        ),
        line_svc.send_line_notify(
            f"\n✅ จองยืนยันแล้ว\n"
            f"ชื่อ: {raw.get('patientName', '')}\n"
            f"บริการ: {raw.get('serviceName', '')}\n"
            f"วันที่: {raw.get('date', '')} เวลา: {raw.get('time', '')} น.\n"
            f"มัดจำ: ฿{amount:,.0f}\n"
            f"รหัส: ...{booking_id[-8:].upper()}"
        ),
        return_exceptions=True,  # booking is confirmed even if LINE push fails
    )

    return {"booking_id": booking_id, "status": "confirmed", "amount": amount, "trans_ref": trans_ref}
