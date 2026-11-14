import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LifeBuoy, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn, formatDateTime } from '@/utils'

interface Ticket {
  id: number; name: string; email: string; subject: string; message: string
  status: string; status_display: string; priority: string; admin_response: string; created_at: string
}

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

function TicketCard({ t }: { t: Ticket }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(t.status)
  const [reply, setReply] = useState(t.admin_response)
  const save = useMutation({
    mutationFn: () => apiClient.patch(`/support/tickets/${t.id}/`, { status, admin_response: reply }),
    onSuccess: () => { toast.success('Ticket updated'); qc.invalidateQueries({ queryKey: ['admin-tickets'] }) },
    onError: () => toast.error('Could not update the ticket'),
  })
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 break-words">{t.subject}</p>
          <p className="text-xs text-gray-500">{t.name} · {t.email} · {formatDateTime(t.created_at)}</p>
        </div>
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', t.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600')}>
          {t.status_display}
        </span>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{t.message}</p>
      <textarea className="input resize-none" rows={3} placeholder="Reply to the user (they will see this)" value={reply} onChange={e => setReply(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.filter(s => s.value).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
          <Save size={14} /> Save
        </button>
      </div>
    </div>
  )
}

export default function AdminSupportPage() {
  const [filter, setFilter] = useState('')
  const { data = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ['admin-tickets', filter],
    queryFn: () =>
      apiClient.get('/support/tickets/', { params: filter ? { status: filter } : {} })
        .then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? [])),
  })
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white"><LifeBuoy size={20} /></span>
        <h1 className="text-xl font-bold text-gray-900">Support Inbox</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => (
          <button
            key={s.value}
            type="button"
            onClick={() => setFilter(s.value)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold', filter === s.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            {s.label}
          </button>
        ))}
      </div>
      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
      {!isLoading && data.length === 0 && <p className="text-sm text-gray-500">No tickets.</p>}
      <div className="space-y-3">{data.map(t => <TicketCard key={t.id + t.status + t.admin_response} t={t} />)}</div>
    </div>
  )
}
