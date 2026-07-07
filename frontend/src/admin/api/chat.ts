import { apiFetch } from '../../lib/api'

export interface ChatConversation {
  line_user_id: string
  display_name: string
  picture_url: string
  mode: 'ai' | 'admin'
  status: 'open' | 'resolved'
  needs_attention: boolean
  last_message_at: string
  last_message_preview: string
  unread_count: number
}

export interface ChatMessage {
  id: string
  direction: 'in' | 'out'
  sender: 'patient' | 'ai' | 'admin'
  text: string
  created_at: string
}

export function fetchChatConversations(clinicId: string): Promise<ChatConversation[]> {
  return apiFetch<ChatConversation[]>(`/admin/chat/conversations?clinic_id=${clinicId}`)
}

export function fetchChatMessages(lineUserId: string): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/admin/chat/conversations/${lineUserId}/messages`)
}

export function sendChatMessage(lineUserId: string, text: string): Promise<ChatConversation> {
  return apiFetch<ChatConversation>(`/admin/chat/conversations/${lineUserId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export function resolveChat(lineUserId: string): Promise<ChatConversation> {
  return apiFetch<ChatConversation>(`/admin/chat/conversations/${lineUserId}/resolve`, {
    method: 'POST',
  })
}

export function setChatMode(lineUserId: string, mode: 'ai' | 'admin'): Promise<ChatConversation> {
  return apiFetch<ChatConversation>(`/admin/chat/conversations/${lineUserId}/mode`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  })
}
