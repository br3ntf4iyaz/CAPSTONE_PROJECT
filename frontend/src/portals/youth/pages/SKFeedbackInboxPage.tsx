import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, ChevronDown, MapPin, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { skFeedbackApi, SKFeedbackItem } from '@/api/skFeedback'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils'
import { QueryError } from '@/components/ui/QueryError'

const CATEGORY_COLORS: Record<string, string> = {
  concern:    'bg-red-100 text-red-700',
  suggestion: 'bg-blue-100 text-blue-700',
  praise:     'bg-green-100 text-green-700',
}

const STATUS_COLORS: Record<string, string> = {
  received:     'bg-amber-100 text-amber-700',
  acknowledged: 'bg-blue-100 text-blue-700',
  resolved:     'bg-green-100 text-green-700',
}

const STATUS_TABS = [
  { key: 'all',          label: 'All' },
  { key: 'received',     label: 'New' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'resolved',     label: 'Resolved' },
] as const

type StatusFilter = typeof STATUS_TABS[number]['key']

function FeedbackCard({ fb, onStatusChange }: { fb: SKFeedbackItem; onStatusChange: (id: number, s: 'received' | 'acknowledged' | 'resolved') => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn('bg-white rounded-2xl border overflow-hidden transition-shadow', fb.status === 'received' ? 'border-primary-200 shadow-sm' : 'border-ink-200')}>
      {/* Header */}
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-paper-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Unread dot */}
        {fb.status === 'received' && (
          <span className="mt-1.5 w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', CATEGORY_COLORS[fb.category])}>
              {fb.category_display}
            </span>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[fb.status])}>
              {fb.status_display}
            </span>
            {fb.rating != null && (
              <span className="flex items-center gap-0.5 text-xs text-amber-500 font-semibold">
                <Star size={11} className="fill-current" />{fb.rating}/5
              </span>
            )}
          </div>
          <p className={cn('text-sm', fb.status === 'received' ? 'font-bold text-ink-900' : 'font-semibold text-ink-800')}>
            {fb.subject}
          </p>
          <p className="text-xs text-ink-500 mt-0.5">
            From {fb.submitter_name} · {new Date(fb.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <ChevronDown size={16} className={cn('text-ink-400 flex-shrink-0 mt-1 transition-transform', expanded && 'rotate-180')} />
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-ink-100 pt-3">
          <p className="text-sm text-ink-800 leading-relaxed whitespace-pre-line">{fb.message}</p>

          {fb.image_url && (
            <a href={fb.image_url} target="_blank" rel="noopener noreferrer">
              <img
                src={fb.image_url}
                alt="attachment"
                className="w-full max-h-64 object-cover rounded-xl border border-ink-200 hover:opacity-90 transition-opacity"
              />
            </a>
          )}

          {/* Status actions */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-xs font-medium text-ink-500">Mark as:</span>
            {fb.status !== 'acknowledged' && (
              <button
                onClick={() => onStatusChange(fb.id, 'acknowledged')}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
              >
                Acknowledged
              </button>
            )}
            {fb.status !== 'resolved' && (
              <button
                onClick={() => onStatusChange(fb.id, 'resolved')}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
              >
                Resolved
              </button>
            )}
            {fb.status !== 'received' && (
              <button
                onClick={() => onStatusChange(fb.id, 'received')}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-ink-50 text-ink-500 hover:bg-ink-100 border border-ink-200 transition-colors"
              >
                Mark as New
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SKFeedbackInboxPage() {
  const auth = useAuthStore()
  const qc = useQueryClient()
  const userBarangay = (auth.user?.profile?.barangay ?? '').trim()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const { data: allFeedback = [], isLoading, isError, refetch } = useQuery<SKFeedbackItem[]>({
    queryKey: ['sk-feedback-inbox'],
    queryFn: () => skFeedbackApi.list(),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'received' | 'acknowledged' | 'resolved' }) =>
      skFeedbackApi.updateStatus(id, status),
    onSuccess: (updated) => {
      qc.setQueryData(['sk-feedback-inbox'], (old: SKFeedbackItem[] = []) =>
        old.map(f => f.id === updated.id ? updated : f)
      )
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update'),
  })

  const filtered = statusFilter === 'all'
    ? allFeedback
    : allFeedback.filter(f => f.status === statusFilter)

  const newCount = allFeedback.filter(f => f.status === 'received').length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Feedback Inbox</h1>
          <p className="page-subtitle flex items-center gap-1.5">
            <MapPin size={13} className="text-primary-500" />
            SK {userBarangay}
          </p>
        </div>
        {newCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-primary-500" />
            {newCount} new
          </span>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-ink-200">
        {STATUS_TABS.map(tab => {
          const count = tab.key === 'all' ? allFeedback.length : allFeedback.filter(f => f.status === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
                statusFilter === tab.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-ink-500 hover:text-ink-700',
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'text-xs font-bold px-1.5 py-0.5 rounded-full',
                  statusFilter === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-ink-100 text-ink-500',
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-ink-400">
          <MessageSquare size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No feedback here yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(fb => (
            <FeedbackCard
              key={fb.id}
              fb={fb}
              onStatusChange={(id, s) => updateStatus.mutate({ id, status: s })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
