import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Bot, Send, RotateCcw, User, Sparkles, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import apiClient from '@/api/client'
import { cn, toArray } from '@/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface FAQ {
  id: number
  question: string
  answer: string
  category: string
}

const SUGGESTIONS = [
  'What SK programs are available for youth?',
  'How do I register my youth organization?',
  'What are the requirements for CBYDP?',
  'What events are coming up this month?',
  'How can I get a scholarship from Lucena City?',
]

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Bot size={14} className="text-primary" />
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────

function FAQSection({ onAsk }: { onAsk: (q: string) => void }) {
  const [open, setOpen] = useState<number | null>(null)

  const { data: faqs = [] } = useQuery<FAQ[]>({
    queryKey: ['faqs'],
    queryFn: () => apiClient.get('/support/faqs/').then(r => toArray<FAQ>(r.data)),
  })

  if (faqs.length === 0) return null

  return (
    <div className="mt-4 flex-shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <HelpCircle size={13} className="text-gray-400" />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Frequently Asked</p>
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {faqs.map(faq => (
          <div key={faq.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(open === faq.id ? null : faq.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700 leading-snug">{faq.question}</span>
              {open === faq.id
                ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
                : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
              }
            </button>
            {open === faq.id && (
              <div className="px-4 pb-3 border-t border-gray-50">
                <p className="text-sm text-gray-600 leading-relaxed mt-2">{faq.answer}</p>
                <button
                  onClick={() => onAsk(faq.question)}
                  className="mt-2 text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
                >
                  <Bot size={11} /> Ask AI for more details
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your Lucena City Youth Portal assistant. I can help you with questions about SK programs, youth organization registration, events, scholarships, and more. How can I help you today?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiClient.post('/chatbot/', {
        message,
        ...(sessionKey ? { session_key: sessionKey } : {}),
      })
      return res.data as { reply: string; session_key: string }
    },
    onSuccess: (data) => {
      if (!sessionKey) setSessionKey(data.session_key)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply, timestamp: new Date() },
      ])
    },
    onError: () => {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        },
      ])
    },
  })

  const handleSend = () => {
    const text = input.trim()
    if (!text || sendMessage.isPending) return
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date() }])
    setInput('')
    sendMessage.mutate(text)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleReset = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Hi! I'm your Lucena City Youth Portal assistant. I can help you with questions about SK programs, youth organization registration, events, scholarships, and more. How can I help you today?",
        timestamp: new Date(),
      },
    ])
    setSessionKey(null)
    setInput('')
  }

  const handleSuggestionOrFAQ = (text: string) => {
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date() }])
    sendMessage.mutate(text)
    // Scroll chat into view
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const showSuggestions = messages.length === 1

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="page-title leading-none mb-0.5">Youth Assistant</h1>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Powered by AI · Lucena City Youth Portal
            </p>
          </div>
        </div>
        <button onClick={handleReset} className="btn-secondary btn-sm" title="New conversation">
          <RotateCcw size={13} /> New Chat
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-2xl p-4 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex items-end gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
          >
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
              msg.role === 'user' ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
            )}>
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>

            <div className={cn(
              'max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm',
              msg.role === 'user'
                ? 'bg-primary text-white rounded-br-sm'
                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
            )}>
              {msg.content.split('\n').map((line, j) => (
                <span key={j}>
                  {line}
                  {j < msg.content.split('\n').length - 1 && <br />}
                </span>
              ))}
              <div className={cn(
                'text-[10px] mt-1 opacity-60 text-right',
                msg.role === 'user' ? 'text-white/70' : 'text-gray-400'
              )}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {sendMessage.isPending && <TypingIndicator />}

        {showSuggestions && !sendMessage.isPending && (
          <div className="pt-2">
            <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
              <Sparkles size={11} /> Suggested questions
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestionOrFAQ(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex-shrink-0">
        <div className="flex items-end gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about youth programs, SK, events…"
            className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder-gray-400 bg-transparent overflow-hidden"
            style={{ maxHeight: '120px' }}
            disabled={sendMessage.isPending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
              input.trim() && !sendMessage.isPending
                ? 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">
          AI responses may not always be accurate. Verify important information with official sources.
        </p>
      </div>

      {/* FAQ section */}
      <FAQSection onAsk={handleSuggestionOrFAQ} />
    </div>
  )
}
