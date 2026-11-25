import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, MapPin, Users, ExternalLink, ShieldCheck, Lock, UserMinus, Download, Hash, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { formatDateTime, cn, toArray } from '@/utils'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { QueryError } from '@/components/ui/QueryError'
import { EmptyState } from '@/components/ui/EmptyState'
import CalendarIcon from '@/components/ui/CalendarIcon'

interface Event {
  id: number
  title: string
  event_type: string
  description: string
  location?: string
  meeting_link?: string
  thumbnail?: string | null
  start_datetime: string
  end_datetime?: string
  capacity?: number
  registration_count: number
  is_registered?: boolean
  is_attended?: boolean
  check_in_active?: boolean
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  webinar:      'badge-blue',
  town_hall:    'badge-purple',
  workshop:     'badge-green',
  consultation: 'badge-yellow',
  training:     'badge-blue',
  other:        'badge-gray',
}

const ALL_TYPES = ['webinar', 'town_hall', 'workshop', 'consultation', 'training', 'other']

function toICSDate(dateStr: string): string {
  return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function downloadICS(event: Event) {
  const start = toICSDate(event.start_datetime)
  const end   = event.end_datetime ? toICSDate(event.end_datetime) : start
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LYDO//Lucena Youth Portal//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.title}`,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
    event.location    ? `LOCATION:${event.location}` : '',
    event.meeting_link ? `URL:${event.meeting_link}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${event.title.replace(/[^a-z0-9]/gi, '-')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

export default function YouthCalendarPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'all' | 'upcoming' | 'registered'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: events = [], isLoading, isError, refetch } = useQuery<Event[]>({
    queryKey: ['youth-events'],
    queryFn: () => apiClient.get('/events/').then(r => toArray<Event>(r.data)),
  })

  const { data: verification } = useQuery<{ is_verified: boolean }>({
    queryKey: ['verification-status'],
    queryFn: () => apiClient.get('/verification/').then(r => r.data),
  })

  const isVerified = verification?.is_verified ?? false

  const registerMutation = useMutation({
    mutationFn: (eventId: number) => apiClient.post(`/events/${eventId}/register/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['youth-events'] })
      toast.success('Registered successfully!')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Registration failed.'
      toast.error(msg)
    },
  })

  const unregisterMutation = useMutation({
    mutationFn: (eventId: number) => apiClient.post(`/events/${eventId}/unregister/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['youth-events'] })
      toast.success('Unregistered from event.')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to unregister.'
      toast.error(msg)
    },
  })

  const [checkinState, setCheckinState] = useState<{ eventId: number; code: string } | null>(null)

  const checkinMutation = useMutation({
    mutationFn: ({ eventId, code }: { eventId: number; code: string }) =>
      apiClient.post(`/events/${eventId}/checkin/`, { code }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['youth-events'] })
      setCheckinState(null)
      toast.success('Checked in successfully!')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Incorrect code. Try again.'
      toast.error(msg)
    },
  })

  if (isLoading) return <ListSkeleton />
  if (isError) return <QueryError onRetry={() => refetch()} />

  const now = new Date()
  const filteredEvents = events
    .filter(event => {
      const eventDate = new Date(event.start_datetime)
      if (tab === 'upcoming' && eventDate < now) return false
      if (tab === 'registered' && !event.is_registered) return false
      if (typeFilter !== 'all' && event.event_type !== typeFilter) return false
      return true
    })
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())

  return (
    <div className="space-y-6">
      {/* Hero, in the same banner style as the other pages */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-8 sm:p-10">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div aria-hidden className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-accent-400/20 blur-2xl pointer-events-none" />
        <div className="relative max-w-3xl">
          <p className="eyebrow-on-dark mb-3">Events</p>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tighter2 leading-[1.05] mb-3">Calendar &amp; Events</h1>
          <p className="text-primary-100 text-lg leading-relaxed">Stay updated on upcoming events and activities across Lucena City.</p>
        </div>
      </header>

      {/* Verification banner */}
      {!isVerified && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <Lock size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            <span className="font-semibold">Identity verification required</span> — you must verify your ID before registering for events.
          </p>
          <Link
            to="/verify-identity"
            className="btn-sm text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
          >
            Verify now →
          </Link>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all',        label: 'All Events' },
          { key: 'upcoming',   label: 'Upcoming' },
          { key: 'registered', label: 'My Events' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
              tab === key
                ? 'bg-primary-600 text-white border border-primary-600 shadow-md shadow-primary-600/20'
                : 'bg-white text-primary-700 border border-primary-200 hover:bg-primary-50'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Event Type Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTypeFilter('all')}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
            typeFilter === 'all'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-primary-700 border-primary-200 hover:border-primary-400 hover:bg-primary-50'
          )}
        >
          All Types
        </button>
        {ALL_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setTypeFilter(type === typeFilter ? 'all' : type)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors border capitalize',
              typeFilter === type
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-primary-700 border-primary-200 hover:border-primary-400 hover:bg-primary-50'
            )}
          >
            {type.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No events found"
            description={
              tab === 'registered'
                ? "You haven't registered for any events yet."
                : 'No events match your current filter.'
            }
            className="py-12"
          />
        ) : (
          filteredEvents.map(event => {
            const isPast = new Date(event.start_datetime) < now
            const isFull = event.capacity != null && event.registration_count >= event.capacity

            return (
              <div key={event.id}
                role="button"
                tabIndex={0}
                aria-label={`View details of ${event.title}`}
                onClick={e => { if (!(e.target as HTMLElement).closest('a,button,input')) setSelectedId(event.id) }}
                onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) setSelectedId(event.id) }}
                className={cn(
                'cursor-pointer bg-white rounded-2xl border border-l-4 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-primary-600/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                isPast ? 'border-gray-200 border-l-gray-300' : 'border-primary-100 border-l-primary-500 hover:border-primary-300',
                event.is_registered && 'ring-1 ring-emerald-200',
              )}>
                {/* Thumbnail */}
                {event.thumbnail && (
                  <div className="h-40 w-full overflow-hidden bg-ink-100">
                    <img
                      src={event.thumbnail}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <CalendarIcon date={new Date(event.start_datetime)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className={cn('text-lg font-bold', isPast ? 'text-ink-700' : 'text-primary-900')}>{event.title}</h3>
                        <span className={cn('badge', EVENT_TYPE_COLORS[event.event_type] || 'badge-gray')}>
                          {event.event_type.replace('_', ' ')}
                        </span>
                        {event.is_registered && (
                          <span className="badge badge-green flex items-center gap-1">
                            <ShieldCheck size={10} /> Registered
                          </span>
                        )}
                        {isFull && !event.is_registered && (
                          <span className="badge badge-red">Full</span>
                        )}
                      </div>

                      {event.description && (
                        <p className="text-ink-700 mb-4 line-clamp-2">{event.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-sm text-primary-900">
                        <div className="flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1">
                          <CalendarDays size={15} className="text-primary-500" />
                          {formatDateTime(event.start_datetime)}
                          {event.end_datetime && (
                            <span> – {formatDateTime(event.end_datetime)}</span>
                          )}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1">
                            <MapPin size={15} className="text-primary-500" />
                            {event.location}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1">
                          <Users size={15} className="text-primary-500" />
                          {event.capacity
                            ? `${event.registration_count} / ${event.capacity}`
                            : `${event.registration_count} registered`}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {event.meeting_link && (
                        <a
                          href={event.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary btn-sm flex items-center gap-1"
                        >
                          <ExternalLink size={14} /> Join
                        </a>
                      )}

                      {event.is_registered ? (
                        <>
                          <button
                            onClick={() => downloadICS(event)}
                            className="btn-sm text-xs flex items-center gap-1 border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-lg px-3 py-1.5"
                            title="Save to your calendar app"
                          >
                            <Download size={13} /> Add to Calendar
                          </button>
                          {!isPast && (
                            <button
                              className="btn-sm text-xs flex items-center gap-1 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors rounded-lg px-3 py-1.5"
                              disabled={unregisterMutation.isPending}
                              onClick={() => {
                                if (window.confirm('Unregister from this event?')) {
                                  unregisterMutation.mutate(event.id)
                                }
                              }}
                            >
                              <UserMinus size={13} />
                              {unregisterMutation.isPending ? 'Removing…' : 'Unregister'}
                            </button>
                          )}
                        </>
                      ) : isPast ? (
                        <span className="text-xs text-ink-400 font-medium px-3 py-1.5 bg-gray-100 rounded-lg">
                          Event Ended
                        </span>
                      ) : !isVerified ? (
                        <Link
                          to="/verify-identity"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          <Lock size={13} /> Verify to Register
                        </Link>
                      ) : isFull ? (
                        <span className="text-xs text-ink-400 font-medium px-3 py-1.5 bg-gray-100 rounded-lg">
                          Event Full
                        </span>
                      ) : (
                        <button
                          className="btn-primary btn-sm"
                          disabled={registerMutation.isPending}
                          onClick={() => registerMutation.mutate(event.id)}
                        >
                          {registerMutation.isPending ? 'Registering…' : 'Register'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Check-in section ── */}
                  {event.is_registered && event.is_attended && (
                    <div className="mt-4 pt-4 border-t border-emerald-100 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={13} /> Checked in
                    </div>
                  )}
                  {event.is_registered && event.check_in_active && !event.is_attended && (
                    <div className="mt-4 pt-4 border-t border-ink-100">
                      <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
                        <Hash size={12} /> Check-in is open
                      </p>
                      {checkinState?.eventId === event.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={checkinState.code}
                            onChange={e => setCheckinState({ eventId: event.id, code: e.target.value.replace(/\D/g, '') })}
                            placeholder="6-digit code"
                            className="input text-sm w-36"
                            autoFocus
                          />
                          <button
                            onClick={() => checkinMutation.mutate({ eventId: event.id, code: checkinState.code })}
                            disabled={checkinState.code.length !== 6 || checkinMutation.isPending}
                            className="btn-primary btn-sm text-xs"
                          >
                            {checkinMutation.isPending ? 'Checking in…' : 'Submit'}
                          </button>
                          <button
                            onClick={() => setCheckinState(null)}
                            className="text-xs text-ink-500 hover:text-ink-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCheckinState({ eventId: event.id, code: '' })}
                          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors rounded-lg px-3 py-1.5"
                        >
                          <Hash size={12} /> Enter check-in code
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Event details ── */}
      {(() => {
        const ev = events.find(e => e.id === selectedId)
        if (!ev) return null
        const past = new Date(ev.start_datetime) < now
        const full = ev.capacity != null && ev.registration_count >= ev.capacity
        const close = () => setSelectedId(null)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-950/60 backdrop-blur-sm" onClick={close}>
            <div role="dialog" aria-modal="true" aria-label={ev.title} onClick={e => e.stopPropagation()}
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <div className="relative overflow-hidden bg-gradient-to-br from-primary-700 to-primary-900 text-white p-6">
                <div aria-hidden className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div aria-hidden className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full bg-accent-400/20 blur-2xl pointer-events-none" />
                <button onClick={close} aria-label="Close" className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white text-lg leading-none">×</button>
                <div className="relative flex items-center gap-4 pr-8">
                  <CalendarIcon date={new Date(ev.start_datetime)} className="flex" />
                  <div className="min-w-0">
                    <span className="inline-block mb-1 rounded-full bg-white/15 border border-white/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">{ev.event_type.replace('_', ' ')}</span>
                    <h2 className="font-display font-extrabold text-xl leading-tight">{ev.title}</h2>
                  </div>
                </div>
              </div>
              {ev.thumbnail && <img src={ev.thumbnail} alt={ev.title} className="w-full h-44 object-cover" />}
              <div className="p-6 space-y-4">
                {ev.description && <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">{ev.description}</p>}
                <div className="flex flex-col gap-2 text-sm text-primary-900">
                  <div className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2">
                    <CalendarDays size={15} className="text-primary-500 shrink-0" />
                    <span>{formatDateTime(ev.start_datetime)}{ev.end_datetime && <> – {formatDateTime(ev.end_datetime)}</>}</span>
                  </div>
                  {ev.location && (
                    <div className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2">
                      <MapPin size={15} className="text-primary-500 shrink-0" /> {ev.location}
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2">
                    <Users size={15} className="text-primary-500 shrink-0" />
                    {ev.capacity ? `${ev.registration_count} / ${ev.capacity} registered` : `${ev.registration_count} registered`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {ev.meeting_link && (
                    <a href={ev.meeting_link} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm flex items-center gap-1">
                      <ExternalLink size={14} /> Join
                    </a>
                  )}
                  <button onClick={() => downloadICS(ev)} className="btn-sm text-xs flex items-center gap-1 border border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors rounded-lg px-3 py-1.5">
                    <Download size={13} /> Add to Calendar
                  </button>
                  {ev.is_registered ? (
                    !past && (
                      <button
                        className="btn-sm text-xs flex items-center gap-1 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors rounded-lg px-3 py-1.5"
                        disabled={unregisterMutation.isPending}
                        onClick={() => { if (window.confirm('Unregister from this event?')) unregisterMutation.mutate(ev.id) }}
                      >
                        <UserMinus size={13} /> Unregister
                      </button>
                    )
                  ) : past ? (
                    <span className="text-xs text-ink-400 font-medium px-3 py-1.5 bg-gray-100 rounded-lg">Event Ended</span>
                  ) : !isVerified ? (
                    <Link to="/verify-identity" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
                      <Lock size={13} /> Verify to Register
                    </Link>
                  ) : full ? (
                    <span className="text-xs text-ink-400 font-medium px-3 py-1.5 bg-gray-100 rounded-lg">Event Full</span>
                  ) : (
                    <button className="btn-primary btn-sm" disabled={registerMutation.isPending} onClick={() => registerMutation.mutate(ev.id)}>
                      {registerMutation.isPending ? 'Registering…' : 'Register'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
