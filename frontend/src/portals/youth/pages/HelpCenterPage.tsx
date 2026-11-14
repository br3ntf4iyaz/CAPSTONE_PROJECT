import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LifeBuoy, Send, CheckCircle2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils'

interface FAQ { id: number; question: string; answer: string; category: string }
interface Ticket {
  id: number; subject: string; message: string; status: string; status_display: string
  admin_response: string; created_at: string
}

const list = <T,>(d: any): T[] => (Array.isArray(d) ? d : d?.results ?? [])

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-gray-100 text-gray-600',
}

export default function HelpCenterPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [open, setOpen] = useState<number | null>(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const faqs = useQuery({ queryKey: ['faqs'], queryFn: () => apiClient.get('/support/faqs/').then(r => list<FAQ>(r.data)) })
  const tickets = useQuery({ queryKey: ['my-tickets'], queryFn: () => apiClient.get('/support/tickets/').then(r => list<Ticket>(r.data)) })

  const send = useMutation({
    mutationFn: () =>
      apiClient.post('/support/tickets/', {
        name: user?.full_name ?? 'Youth user',
        email: user?.email ?? '',
        subject,
        message,
      }),
    onSuccess: () => {
      toast.success('Your concern was sent to LYDO.')
      setSubject(''); setMessage('')
      qc.invalidateQueries({ queryKey: ['my-tickets'] })
    },
    onError: () => toast.error('Could not send your concern. Please try again.'),
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-600 text-white"><LifeBuoy size={24} /></span>
          <div>
            <p className="eyebrow">Help Center</p>
            <h1 className="font-display font-extrabold text-2xl text-ink-900">How can we help?</h1>
          </div>
        </div>
        <p className="text-ink-600">Read the answers below, or report a problem and a LYDO staffer will look into it.</p>
      </header>

      <section className="space-y-2">
        <h2 className="font-display font-bold text-lg text-ink-900">Frequently asked questions</h2>
        {faqs.isLoading && <p className="text-sm text-ink-500">Loading...</p>}
        {faqs.data?.length === 0 && <p className="text-sm text-ink-500">No FAQs yet.</p>}
        {faqs.data?.map(f => (
          <div key={f.id} className="rounded-xl border border-ink-100 bg-white">
            <button
              type="button"
              onClick={() => setOpen(open === f.id ? null : f.id)}
              className="w-full flex items-center justify-between gap-3 text-left px-4 py-3"
            >
              <span className="text-sm font-semibold text-ink-800 break-words">{f.question}</span>
              <ChevronDown size={16} className={cn('flex-shrink-0 transition-transform', open === f.id && 'rotate-180')} />
            </button>
            {open === f.id && (
              <div className="px-4 pb-4 text-sm text-ink-600 break-words" dangerouslySetInnerHTML={{ __html: f.answer }} />
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-bold text-lg text-ink-900">Report a problem or ask for help</h2>
        <form
          className="space-y-3 rounded-2xl border border-ink-100 bg-white p-4"
          onSubmit={e => { e.preventDefault(); if (subject.trim() && message.trim()) send.mutate() }}
        >
          <input className="input" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} required />
          <textarea className="input resize-none" rows={4} placeholder="Describe the problem" value={message} onChange={e => setMessage(e.target.value)} required />
          <button type="submit" disabled={send.isPending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
            <Send size={15} /> {send.isPending ? 'Sending...' : 'Send to LYDO'}
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="font-display font-bold text-lg text-ink-900">My concerns</h2>
        {tickets.data?.length === 0 && <p className="text-sm text-ink-500">You have not sent any concern yet.</p>}
        {tickets.data?.map(t => (
          <div key={t.id} className="rounded-xl border border-ink-100 bg-white p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-sm text-ink-900 break-words">{t.subject}</p>
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0', STATUS_STYLE[t.status] ?? STATUS_STYLE.closed)}>
                {t.status_display}
              </span>
            </div>
            <p className="text-sm text-ink-600 whitespace-pre-wrap break-words">{t.message}</p>
            {t.admin_response ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-900">
                <p className="flex items-center gap-1.5 font-semibold mb-1"><CheckCircle2 size={14} /> Reply from LYDO</p>
                <p className="whitespace-pre-wrap break-words">{t.admin_response}</p>
              </div>
            ) : (
              <p className="text-xs text-ink-400 flex items-center gap-1"><Clock size={12} /> Waiting for LYDO</p>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
