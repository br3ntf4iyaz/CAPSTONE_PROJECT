import { Link } from 'react-router-dom'
import { Bot, Send } from 'lucide-react'
import { cn } from '@/utils'

export function ChatbotPromoSection({ gated }: { gated: (dest: string) => () => void }) {
  // ── AI Chatbot ───────────────────────────────────────────────────
  return (
    <section className="bg-paper-50 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Left: copy */}
          <div>
            <p className="eyebrow mb-3">AI Youth Assistant</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-ink-900 tracking-tighter2 mb-4">
              Ask anything about<br />youth services in Lucena.
            </h2>
            <p className="text-ink-600 leading-relaxed mb-6">
              Scholarships, SK governance, youth rights, program requirements — our AI assistant knows Lucena City's youth ecosystem and answers instantly.
            </p>
            <button
              onClick={gated('/chatbot')}
              className="btn-primary"
            >
              <Bot size={16} /> Start chatting
            </button>
          </div>

          {/* Right: interactive chat preview */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-lg overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-primary-600 text-white">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold">LYDO AI Assistant</p>
                <p className="text-[10px] text-primary-200">Powered by AI · Youth expertise</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-primary-200">Online</span>
              </div>
            </div>

            {/* Chat messages */}
            <div className="p-4 space-y-3 min-h-[200px]">
              {[
                { from: 'user', text: 'What scholarships are available for college students in Lucena?' },
                { from: 'ai', text: 'Great question! There are several scholarships available for Lucena City youth, including the City Government Scholarship, CHED UniFAST, and DOST-SEI. Would you like details on requirements for any of these?' },
                { from: 'user', text: 'What are the SK chairperson requirements?' },
              ].map((msg, i) => (
                <div key={i} className={cn('flex', msg.from === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed',
                    msg.from === 'user'
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-ink-50 text-ink-800 rounded-bl-sm'
                  )}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {/* Typing indicator */}
              <div className="flex justify-start">
                <div className="bg-ink-50 px-4 py-3 rounded-xl rounded-bl-sm flex items-center gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-ink-300 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Input bar — clicking redirects to login */}
            <div className="border-t border-ink-100 p-3">
              <button
                onClick={gated('/chatbot')}
                className="w-full flex items-center gap-3 bg-ink-50 hover:bg-primary-50 border border-ink-200 hover:border-primary-300 rounded-xl px-4 py-3 text-left transition-all group"
              >
                <span className="flex-1 text-sm text-ink-400 group-hover:text-ink-600">
                  Ask about youth programs, scholarships, events…
                </span>
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">
                  <Send size={14} />
                </span>
              </button>
              <p className="text-center text-[11px] text-ink-400 mt-2">
                <button onClick={gated('/chatbot')} className="text-primary-600 font-semibold hover:underline">Sign in</button> or <Link to="/register" className="text-primary-600 font-semibold hover:underline">create a free account</Link> to start chatting
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
