import { CalendarDays, ArrowRight, MapPin, Users } from 'lucide-react'
import type { PublicEvent } from './types'

export function EventsSection({ events, isLoading, gated }: { events?: PublicEvent[]; isLoading: boolean; gated: (dest: string) => () => void }) {
  // ── Upcoming Events ──────────────────────────────────────────────
  return (
    <section id="events" className="bg-paper-50 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <p className="eyebrow mb-3">Events Calendar</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-ink-900 tracking-tighter2">
              Upcoming events in Lucena City.
            </h2>
            <p className="text-ink-600 mt-2 max-w-lg">
              Browse what's coming up — sign in to register your spot.
            </p>
          </div>
          <button
            onClick={gated('/calendar')}
            className="btn-secondary self-start sm:self-end whitespace-nowrap"
          >
            View full calendar <ArrowRight size={16} />
          </button>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-40 rounded-2xl bg-ink-100/50 animate-pulse" />
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {events.map(evt => {
              const dt = new Date(evt.start_datetime)
              const mon = dt.toLocaleString('en-US', { month: 'short' }).toUpperCase()
              const day = dt.getDate()
              return (
                <div key={evt.id} className="bg-white border border-ink-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                  {/* Date strip */}
                  <div className="bg-primary-600 text-white text-center py-3">
                    <span className="block text-[10px] font-extrabold tracking-widest">{mon}</span>
                    <span className="block text-3xl font-extrabold leading-tight tabular-nums">{day}</span>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <div>
                      <h3 className="font-bold text-sm text-ink-900 leading-snug line-clamp-2 group-hover:text-primary-700 transition-colors">
                        {evt.title}
                      </h3>
                      {evt.location && (
                        <p className="flex items-center gap-1 text-[11px] text-ink-500 mt-1">
                          <MapPin size={10} /> {evt.location}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-[11px] text-ink-400 flex items-center gap-1">
                        <Users size={10} /> {evt.registration_count} joined
                      </span>
                      <button
                        onClick={gated('/calendar')}
                        className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-0.5 transition-colors"
                      >
                        Register <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-ink-100 p-10 text-center">
            <CalendarDays size={36} className="text-ink-300 mx-auto mb-3" />
            <p className="text-ink-500 text-sm">No upcoming events right now — check back soon.</p>
          </div>
        )}
      </div>
    </section>
  )
}
