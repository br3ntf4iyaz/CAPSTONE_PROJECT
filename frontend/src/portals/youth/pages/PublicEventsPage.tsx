import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, MapPin, Users, ArrowRight, Clock } from 'lucide-react'
import apiClient from '@/api/client'
import { toArray, cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/authStore'

interface PublicEvent {
  id: number
  title: string
  description: string
  location: string
  start_datetime: string
  end_datetime: string
  is_featured: boolean
  registration_count: number
}

export default function PublicEventsPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [pendingDest, setPendingDest] = useState<string>('/calendar')

  const gated = (dest: string) => () => {
    if (isAuthenticated) navigate(dest)
    else {
      setPendingDest(dest)
      setShowLoginModal(true)
    }
  }

  const eventsQ = useQuery({
    queryKey: ['public-events-page'],
    queryFn: () =>
      apiClient.get('/events/?ordering=start_datetime')
        .then(r => toArray<PublicEvent>(r.data))
        .catch(() => []),
  })

  const events = eventsQ.data ?? []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <header className="mb-10">
        <p className="eyebrow mb-3">Events Calendar</p>
        <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-ink-900 tracking-tighter2 mb-3">
          Upcoming events in Lucena City.
        </h1>
        <p className="text-ink-600 text-lg max-w-xl">
          Browse what's coming up — <button onClick={gated('/calendar')} className="text-primary-600 font-semibold hover:underline">sign in</button> to register your spot.
        </p>
      </header>

      {eventsQ.isLoading ? (
        <PageSpinner />
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-ink-100 p-16 text-center">
          <CalendarDays size={48} className="text-ink-200 mx-auto mb-4" />
          <p className="text-ink-500">No upcoming events right now — check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map(evt => {
            const dt = new Date(evt.start_datetime)
            const mon = dt.toLocaleString('en-US', { month: 'short' }).toUpperCase()
            const day = dt.getDate()
            const time = dt.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
            return (
              <div key={evt.id} className={cn(
                'bg-white border border-ink-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col',
                evt.is_featured && 'ring-2 ring-accent-400'
              )}>
                {/* Date strip */}
                <div className="bg-primary-600 text-white text-center py-4">
                  <span className="block text-[10px] font-extrabold tracking-widest">{mon}</span>
                  <span className="block text-4xl font-extrabold leading-tight tabular-nums">{day}</span>
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  {evt.is_featured && (
                    <span className="chip bg-accent-100 text-accent-800 self-start text-[10px]">Featured</span>
                  )}
                  <h3 className="font-bold text-base text-ink-900 leading-snug group-hover:text-primary-700 transition-colors">
                    {evt.title}
                  </h3>
                  {evt.description && (
                    <p className="text-sm text-ink-500 line-clamp-2">{evt.description}</p>
                  )}
                  <div className="space-y-1 text-xs text-ink-400 mt-auto">
                    {evt.location && (
                      <p className="flex items-center gap-1.5"><MapPin size={11} /> {evt.location}</p>
                    )}
                    <p className="flex items-center gap-1.5"><Clock size={11} /> {time}</p>
                    <p className="flex items-center gap-1.5"><Users size={11} /> {evt.registration_count} registered</p>
                  </div>
                  <button
                    onClick={gated('/calendar')}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
                  >
                    Register <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CTA to full calendar when logged in */}
      <div className="mt-10 text-center">
        <button
          onClick={gated('/calendar')}
          className="btn-secondary"
        >
          <CalendarDays size={16} /> View full calendar
        </button>
      </div>

      {/* Login explanation modal */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="font-display font-bold text-lg text-ink-900">Log in to register</h2>
            <p className="text-sm text-ink-600 leading-relaxed">
              You need to log in to register for this event. Logging in lets us confirm your attendance and send you reminders.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowLoginModal(false); navigate(`/login?next=${pendingDest}`) }}
                className="btn-primary flex-1"
              >
                Log In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
