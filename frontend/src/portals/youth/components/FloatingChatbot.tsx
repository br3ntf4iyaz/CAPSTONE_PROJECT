import { useState, useRef, useEffect } from 'react'
import { X, Send, Sparkles, ChevronDown } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { chatbotApi } from '@/api'
import { cn } from '@/utils'
import { ChatMarkdown } from './ChatMarkdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Anong mga scholarship ang bukas ngayon?',
  'Ano ang mga upcoming events?',
  'Paano mag-register ng youth organization (YORP)?',
  'Ano ang mga bukas na trabaho?',
]

const STORAGE_KEY = 'lydo_chatbot_v1'
const GREETING: Message = {
  role: 'assistant',
  content: "Hi! I'm the LYDO AI assistant. Ask me anything about youth programs, SK, scholarships, and more.",
}

/** Restore the previous conversation (per browser) so a reload doesn't wipe it. */
function loadSaved(): { key: string; messages: Message[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.key && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        return { key: parsed.key, messages: parsed.messages.slice(-30) }
      }
    }
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return { key: `chatbot_${Math.random().toString(36).slice(2)}`, messages: [GREETING] }
}

function FloatingChatbotInner() {
  const [open, setOpen] = useState(false)
  const [saved] = useState(loadSaved)
  const sessionKey = saved.key
  const [messages, setMessages] = useState<Message[]>(saved.messages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ key: sessionKey, messages: messages.slice(-30) }))
    } catch { /* ignore quota/private-mode errors */ }
  }, [messages, sessionKey])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  const handleSend = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      const res = await chatbotApi.send(text, sessionKey)
      const reply = (res.data as any).reply ?? "Sorry, I couldn't process that."
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err: any) {
      const tooMany = err?.response?.status === 429
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: tooMany
          ? "You're sending messages too quickly. Please wait a minute and try again."
          : "I'm having trouble connecting. Please try again.",
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <>
      {/* ── Chat Window ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed bottom-24 right-4 md:bottom-24 md:right-6 z-50',
          'w-[340px] max-w-[calc(100vw-2rem)] flex flex-col',
          'rounded-2xl overflow-hidden',
          'transition-all duration-300 ease-out origin-bottom-right',
          open
            ? 'opacity-100 scale-100 pointer-events-auto shadow-2xl'
            : 'opacity-0 scale-90 pointer-events-none shadow-none',
        )}
        style={{ height: '480px' }}
      >
        {/* Header &mdash; Meta AI style gradient */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0084ff 0%, #a259ff 60%, #ff6b6b 100%)' }}
        >
          <div className="flex items-center gap-2.5">
            {/* Gradient orb avatar */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-sm border border-white/30">
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">LYDO Assistant</p>
              <p className="text-[10px] text-white/70 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-300 inline-block" />
                AI · Powered by Groq
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
            aria-label="Close"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-white px-3 py-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-2 items-end', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              {/* Assistant avatar */}
              {msg.role === 'assistant' && (
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mb-0.5"
                  style={{ background: 'linear-gradient(135deg, #0084ff, #a259ff)' }}
                >
                  <Sparkles size={11} className="text-white" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[78%] px-3 py-2 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'rounded-2xl rounded-br-sm text-white'
                    : 'rounded-2xl rounded-bl-sm bg-gray-100 text-gray-800',
                )}
                style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #0084ff, #a259ff)' } : {}}
              >
                {msg.role === 'assistant' ? <ChatMarkdown text={msg.content} /> : msg.content}
              </div>
            </div>
          ))}

          {/* Quick suggestions: only before the first user message */}
          {messages.length === 1 && !loading && (
            <div className="flex flex-wrap gap-1.5 pl-8">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-2 items-end">
              <div
                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #0084ff, #a259ff)' }}
              >
                <Sparkles size={11} className="text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-100 px-3 py-2.5 flex items-center gap-2 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask me anything…"
            className="flex-1 text-sm bg-gray-50 rounded-full px-4 py-2 outline-none text-gray-800 placeholder-gray-400 border border-gray-200 focus:border-blue-300 transition-colors"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            aria-label="Send"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #0084ff, #a259ff)' }}
          >
            <Send size={13} className="text-white translate-x-px" />
          </button>
        </div>
      </div>

      {/* ── Floating Button &mdash; Meta AI style ─────────────────────────────── */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close assistant' : 'Open AI assistant'}
        aria-expanded={open}
        className={cn(
          'fixed bottom-[72px] right-4 md:bottom-6 md:right-6 z-50',
          'w-14 h-14 rounded-full flex items-center justify-center',
          'shadow-lg hover:shadow-xl hover:scale-110 active:scale-95',
          'transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400',
        )}
        style={{ background: open ? '#1f2937' : 'linear-gradient(135deg, #0084ff 0%, #a259ff 60%, #ff6b6b 100%)' }}
      >
        {/* Shimmer ring */}
        {!open && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: 'linear-gradient(135deg, #0084ff, #a259ff)' }}
          />
        )}
        {open
          ? <X size={20} className="text-white" />
          : <Sparkles size={22} className="text-white" />
        }
      </button>
    </>
  )
}

// Wrapper: route check before any hooks &mdash; fixes "fewer hooks" error
export default function FloatingChatbot() {
  const location = useLocation()
  if (location.pathname === '/chatbot') return null
  return <FloatingChatbotInner />
}
