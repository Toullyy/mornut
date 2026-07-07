import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, Bot, CheckCircle2, Loader2, Send } from 'lucide-react'
import { useChatConversations, useChatMessages } from '../../hooks/useChat'
import { resolveChat, sendChatMessage, setChatMode, type ChatMessage } from '../api'

export function ChatView({ clinicId }: { clinicId: string }) {
  const { data: conversations, loading: listLoading } = useChatConversations(clinicId)
  const [selected, setSelected] = useState<string | null>(null)
  const { data: messages, loading: msgLoading, refetch } = useChatMessages(selected)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [actionLoading, setActionLoading] = useState<null | 'resolve' | 'handback'>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!selected && conversations.length > 0) setSelected(conversations[0].line_user_id)
  }, [conversations, selected])

  const selectedConvo = conversations.find(c => c.line_user_id === selected) || null

  async function handleSend() {
    const text = draft.trim()
    if (!text || !selected) return
    setSending(true)
    setError('')
    try {
      await sendChatMessage(selected, text)
      setDraft('')
      await refetch()
    } catch (err) {
      setError((err as Error).message || 'ส่งข้อความไม่สำเร็จ')
    } finally {
      setSending(false)
    }
  }

  async function handleResolve() {
    if (!selected) return
    setActionLoading('resolve')
    try { await resolveChat(selected) } finally { setActionLoading(null) }
  }

  async function handleHandback() {
    if (!selected) return
    setActionLoading('handback')
    try { await setChatMode(selected, 'ai') } finally { setActionLoading(null) }
  }

  function bubbleStyle(sender: ChatMessage['sender']) {
    if (sender === 'patient') return 'bg-muted text-foreground self-start'
    if (sender === 'admin') return 'bg-primary text-primary-foreground self-end'
    return 'bg-sky-50 text-sky-900 border border-sky-200 self-end'
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>แชท LINE OA</h1>
        <p className="text-sm text-muted-foreground mt-0.5">AI ตอบอัตโนมัติ — แอดมินสามารถเข้าคุมการสนทนาได้ทุกเมื่อ</p>
      </div>

      <div className="flex-1 flex min-h-0 bg-card border border-border rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Conversation list */}
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto">
          {listLoading && conversations.length === 0 && <p className="p-4 text-sm text-muted-foreground">กำลังโหลด...</p>}
          {!listLoading && conversations.length === 0 && <p className="p-4 text-sm text-muted-foreground">ยังไม่มีการสนทนา</p>}
          {conversations.map(c => (
            <button key={c.line_user_id} onClick={() => setSelected(c.line_user_id)}
              className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${selected === c.line_user_id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-foreground truncate">{c.display_name || c.line_user_id}</span>
                {c.unread_count > 0 && (
                  <span className="text-[10px] bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center shrink-0">{c.unread_count}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message_preview}</p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${c.mode === 'admin' ? 'bg-primary/10 text-primary' : 'bg-sky-50 text-sky-700'}`}>
                  {c.mode === 'admin' ? 'แอดมิน' : 'AI'}
                </span>
                {c.status === 'resolved' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-foreground/5 text-muted-foreground">ปิดแล้ว</span>
                )}
                {c.needs_attention && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-yellow-50 text-yellow-700 flex items-center gap-0.5">
                    <AlertTriangle size={9} />ต้องการเจ้าหน้าที่
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedConvo ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">เลือกการสนทนาทางซ้ายเพื่อดูข้อความ</div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <p className="font-semibold text-sm text-foreground">{selectedConvo.display_name || selectedConvo.line_user_id}</p>
                  <p className="text-[11px] text-muted-foreground">{selectedConvo.mode === 'admin' ? 'แอดมินกำลังตอบ' : 'AI กำลังตอบอัตโนมัติ'}</p>
                </div>
                <div className="flex gap-2">
                  {selectedConvo.mode === 'admin' && (
                    <button onClick={handleHandback} disabled={actionLoading === 'handback'}
                      className="flex items-center gap-1.5 border border-border text-foreground text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-foreground/5 disabled:opacity-50 transition-colors">
                      {actionLoading === 'handback' ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}คืนให้ AI
                    </button>
                  )}
                  {selectedConvo.status !== 'resolved' && (
                    <button onClick={handleResolve} disabled={actionLoading === 'resolve'}
                      className="flex items-center gap-1.5 border border-border text-foreground text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-foreground/5 disabled:opacity-50 transition-colors">
                      {actionLoading === 'resolve' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}ปิดการสนทนา
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
                {msgLoading && messages.length === 0 && <p className="text-sm text-muted-foreground">กำลังโหลด...</p>}
                {messages.map(m => (
                  <div key={m.id} className={`max-w-[75%] rounded-xl px-3 py-2 text-sm flex flex-col ${bubbleStyle(m.sender)}`}>
                    {m.sender !== 'patient' && (
                      <span className="text-[10px] opacity-70 font-medium mb-0.5">{m.sender === 'admin' ? 'แอดมิน' : 'AI'}</span>
                    )}
                    <span className="whitespace-pre-wrap">{m.text}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border p-3 flex flex-col gap-2">
                {error && <p className="text-xs text-destructive flex items-center gap-1.5"><AlertCircle size={12} />{error}</p>}
                <div className="flex gap-2">
                  <input type="text" value={draft} onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !sending) handleSend() }}
                    placeholder="พิมพ์ข้อความตอบกลับ..."
                    className="flex-1 text-sm bg-input-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                  <button onClick={handleSend} disabled={sending || !draft.trim()}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm">
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}ส่ง
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">การส่งข้อความจะเปลี่ยนโหมดเป็น "แอดมิน" ทันที</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
