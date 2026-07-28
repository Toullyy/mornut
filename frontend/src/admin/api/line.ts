import { apiFetch } from '../../lib/api'

export interface LineOABot {
  userId: string
  displayName: string
  pictureUrl: string
}

export interface LineOASettings {
  has_credentials: boolean
  connected: boolean
  bot: LineOABot | null
  webhook_url: string
  webhook_active: boolean
  rich_menu_id: string
  masked_token: string
}

export function getLineSettings(clinicId: string): Promise<LineOASettings> {
  return apiFetch<LineOASettings>(`/admin/line-oa/settings?clinic_id=${clinicId}`)
}

export function saveLineCredentials(
  clinicId: string,
  channelSecret: string,
  channelAccessToken: string,
): Promise<LineOASettings> {
  return apiFetch<LineOASettings>('/admin/line-oa/settings', {
    method: 'POST',
    body: JSON.stringify({
      clinic_id: clinicId,
      channel_secret: channelSecret,
      channel_access_token: channelAccessToken,
    }),
  })
}

export function enableWebhook(clinicId: string, webhookUrl: string): Promise<LineOASettings> {
  return apiFetch<LineOASettings>('/admin/line-oa/webhook', {
    method: 'POST',
    body: JSON.stringify({ clinic_id: clinicId, webhook_url: webhookUrl }),
  })
}

export function setupRichMenu(clinicId: string): Promise<LineOASettings> {
  return apiFetch<LineOASettings>('/admin/line-oa/rich-menu', {
    method: 'POST',
    body: JSON.stringify({ clinic_id: clinicId }),
  })
}

export function deleteRichMenu(clinicId: string): Promise<LineOASettings> {
  return apiFetch<LineOASettings>(`/admin/line-oa/rich-menu?clinic_id=${clinicId}`, {
    method: 'DELETE',
  })
}

export interface LineNotifySettings {
  has_token: boolean
  source: 'db' | 'env' | 'none'
  masked: string
}

export function getLineNotifySettings(clinicId: string): Promise<LineNotifySettings> {
  return apiFetch<LineNotifySettings>(`/admin/line-notify-settings?clinic_id=${clinicId}`)
}

export function saveLineNotifyToken(clinicId: string, token: string): Promise<LineNotifySettings> {
  return apiFetch<LineNotifySettings>('/admin/line-notify-settings', {
    method: 'POST',
    body: JSON.stringify({ clinic_id: clinicId, line_notify_token: token }),
  })
}
