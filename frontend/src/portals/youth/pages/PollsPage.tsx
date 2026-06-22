import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart3, CheckCircle2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'

interface PollOption {
  id: number
  text: string
  order: number
  vote_count: number
}

interface Poll {
  id: number
  question: string
  is_active: boolean
  ends_at: string | null
  options: PollOption[]
  user_vote: number | null
  total_votes: number
}

function PollCard({ poll }: { poll: Poll }) {
  const qc = useQueryClient()
  const voted = poll.user_vote !== null
  const total = poll.total_votes || 0

  const voteMutation = useMutation({
    mutationFn: (optionId: number) =>
      apiClient.post(`/events/polls/${poll.id}/vote/`, { option: optionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['polls'] })
      toast.success('Vote recorded!')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.non_field_errors?.[0] ?? 'Could not record vote.')
    },
  })

  const timeLeft = poll.ends_at ? (() => {
    const diff = new Date(poll.ends_at).getTime() - Date.now()
    if (diff <= 0) return 'Ended'
    const days = Math.floor(diff / 86400000)
    if (days > 0) return `${days}d left`
    const hours = Math.floor(diff / 3600000)
    return `${hours}h left`
  })() : null

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-ink-900 text-base leading-snug flex-1">{poll.question}</h3>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {timeLeft && (
            <span className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full',
              timeLeft === 'Ended' ? 'bg-ink-100 text-ink-500' : 'bg-primary-50 text-primary-700'
            )}>
              <Clock size={11} /> {timeLeft}
            </span>
          )}
          <span className="text-xs text-ink-400">{total} vote{total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {poll.options.map(opt => {
          const pct = total > 0 ? Math.round((opt.vote_count / total) * 100) : 0
          const isMyVote = poll.user_vote === opt.id

          return (
            <button
              key={opt.id}
              disabled={voted || voteMutation.isPending}
              onClick={() => !voted && voteMutation.mutate(opt.id)}
              className={cn(
                'w-full relative rounded-xl border text-left transition-all overflow-hidden',
                voted
                  ? isMyVote
                    ? 'border-primary-300 bg-primary-50 cursor-default'
                    : 'border-ink-100 bg-white cursor-default'
                  : 'border-ink-200 bg-white hover:border-primary-300 hover:bg-primary-50 cursor-pointer'
              )}
            >
              {/* Progress bar background */}
              {voted && (
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 transition-all rounded-xl',
                    isMyVote ? 'bg-primary-100' : 'bg-ink-50'
                  )}
                  style={{ width: `${pct}%` }}
                />
              )}

              <div className="relative flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {voted && isMyVote && (
                    <CheckCircle2 size={15} className="text-primary-600 flex-shrink-0" />
                  )}
                  <span className={cn(
                    'text-sm font-medium truncate',
                    isMyVote ? 'text-primary-800' : 'text-ink-700'
                  )}>
                    {opt.text}
                  </span>
                </div>
                {voted && (
                  <span className={cn(
                    'text-xs font-bold flex-shrink-0',
                    isMyVote ? 'text-primary-700' : 'text-ink-500'
                  )}>
                    {pct}%
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {voted && (
        <p className="text-xs text-ink-400 text-center">You've already voted on this poll.</p>
      )}
    </div>
  )
}

export default function PollsPage() {
  const { data: polls = [], isLoading } = useQuery<Poll[]>({
    queryKey: ['polls'],
    queryFn: () => apiClient.get('/events/polls/').then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d.results ?? [])
    }),
  })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Polls</h1>
        <p className="page-subtitle">Make your stance heard on live LYDO decisions</p>
      </div>

      {polls.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No active polls"
          description="Check back soon — new polls are posted regularly."
          className="py-16"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {polls.map(poll => <PollCard key={poll.id} poll={poll} />)}
        </div>
      )}
    </div>
  )
}
