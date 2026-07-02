import { apiFetchForm } from './client'

export interface SlipResult {
  booking_id: string
  status: string
  amount: number
  trans_ref: string
}

export function uploadSlip(bookingId: string, file: File): Promise<SlipResult> {
  const body = new FormData()
  body.append('file', file)
  return apiFetchForm<SlipResult>(`/slips/${bookingId}/verify`, body)
}
