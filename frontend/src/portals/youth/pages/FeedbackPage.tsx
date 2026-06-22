import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Star, Send, CheckCircle2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'

interface FeedbackEntry {
  id: number
  event: number | null
  rating: number
  comment: string
  submitted_at: string
}

interface Event {
  id: number
  title: string
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110 focus:outline-none"
        >
          <Star
            size={28}
            className={cn(
              'transition-colors',
              (hovered || value) >= n ? 'fill-amber-400 text-amber-400' : 'text-ink-300'
            )}
          />
        </button>
      ))}
    </div>
  )
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
}

export default function FeedbackPage() {
  const qc = useQueryClient()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [eventId, setEventId] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const { data: myFeedback = [], isLoading } = useQuery<FeedbackEntry[]>({
    queryKey: ['my-feedback'],
    queryFn: () => apiClient.get('/feedback/').then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d.results ?? [])
    }),
  })

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['youth-events-brief'],
    queryFn: () => apiClient.get('/events/').then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d.results ?? [])
    }).catch(() => []),
  })

  const submitMutation = useMutation({
    mutationFn: () => apiClient.post('/feedback/', {
      rating,
      comment: comment.trim(),
      ...(eventId ? { event: eventId } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-feedback'] })
      setRating(0)
      setComment('')
      setEventId(null)
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 4000)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.comment?.[0]
        ?? err?.response?.data?.rating?.[0]
        ?? err?.response?.data?.detail
        ?? 'Could not submit feedback.'
      toast.error(msg)
    },
  })

  const canSubmit = rating > 0 && comment.trim().length >= 5

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Feedback</h1>
        <p className="page-subtitle">Help us improve LYDO programs and services</p>
      </div>

      {/* Submit form */}
      <div className="card p-6 space-y-5">
        <h2 className="font-semibold text-ink-900 text-base">Share your feedback</h2>

        {/* Optional event selector */}
        {events.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink-700">
              Related event <span className="text-ink-400 font-normal">(optional)</span>
            </label>
            <select
              value={eventId ?? ''}
              onChange={e => setEventId(e.target.value ? Number(e.target.value) : null)}
              className="input"
            >
              <option value="">General feedback / portal</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Star rating */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-ink-700">Your rating</label>
          <div className="flex items-center gap-3">
            <StarRating value={rating} onChange={setRating} />
            {rating > 0 && (
              <span className="text-sm font-semibold text-amber-600">{RATING_LABELS[rating]}</span>
            )}
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink-700">Your message</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Tell us what you think — what worked well, what could be improved..."
            rows={4}
            className="input resize-none"
          />
          <p className="text-xs text-ink-400 text-right">{comment.length} chars</p>
        </div>

        {submitted ? (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-semibold">
            <CheckCircle2 size={16} /> Thank you! Your feedback was submitted.
          </div>
        ) : (
          <button
            type="button"
            disabled={!canSubmit || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
            className="btn-primary w-full sm:w-auto"
          >
            <Send size={15} />
            {submitMutation.isPending ? 'Submitting…' : 'Submit Feedback'}
          </button>
        )}
      </div>

      {/* Past submissions */}
      {myFeedback.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-ink-900">Your past submissions</h2>
          {myFeedback.map(fb => (
            <div key={fb.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <Star
                      key={n}
                      size={14}
                      className={cn(
                        fb.rating >= n ? 'fill-amber-400 text-amber-400' : 'text-ink-200'
                      )}
                    />
                  ))}
                  <span className="ml-2 text-xs font-semibold text-ink-600">{RATING_LABELS[fb.rating]}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-ink-400">
                  <Clock size={11} />
                  {new Date(fb.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <p className="text-sm text-ink-700 leading-relaxed">{fb.comment}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
