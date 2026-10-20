import { Bot, Send, Sparkles, User } from 'lucide-react'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Feedback'
import { api, errorMessage } from '@/lib/api'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = ['What should I study today?', 'What should I revise?', 'How ready am I?', 'Give me practice questions.']

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: "Hi! I'm your PrepPilot assistant. Ask me what to study, what to revise, or how ready you are — I'll answer from your real progress." }])
  const [input, setInput] = useState('')
  const [error, setError] = useState<string>()

  const chat = useMutation({
    mutationFn: (history: ChatMessage[]) => api<{ reply: string; source: 'AI' | 'FALLBACK_BANK' }>('/assistant/chat', { method: 'POST', body: { messages: history } }),
  })

  async function send(content: string) {
    if (!content.trim() || chat.isPending) return
    setError(undefined)
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next)
    setInput('')
    try {
      const res = await chat.mutateAsync(next)
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }])
    } catch (err) {
      setError(errorMessage(err, 'The assistant could not respond. Please try again.'))
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">Ask about your study plan, priorities, revision, or interview readiness.</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {m.role === 'user' ? <User className="size-4" aria-hidden="true" /> : <Bot className="size-4" aria-hidden="true" />}
            </div>
            <Card className={`max-w-[80%] p-3 text-sm ${m.role === 'user' ? 'bg-primary-soft' : ''}`}>{m.content}</Card>
          </div>
        ))}
        {chat.isPending && (
          <div className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"><Bot className="size-4" aria-hidden="true" /></div>
            <Card className="p-3 text-sm text-muted-foreground">Thinking…</Card>
          </div>
        )}
      </div>

      {error && <Alert tone="error" className="mb-3">{error}</Alert>}

      {messages.length <= 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => void send(s)} className="rounded-full border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <Sparkles className="mr-1 inline size-3" aria-hidden="true" />{s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); void send(input) }} className="flex gap-2">
        <label htmlFor="assistant-input" className="sr-only">Message the assistant</label>
        <input id="assistant-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question..." className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-base sm:text-sm" />
        <Button type="submit" disabled={!input.trim() || chat.isPending} aria-label="Send message"><Send className="size-4" aria-hidden="true" /></Button>
      </form>
    </div>
  )
}
