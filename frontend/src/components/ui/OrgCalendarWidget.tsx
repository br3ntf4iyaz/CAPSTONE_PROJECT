import { useQuery } from '@tanstack/react-query'
import { CalendarDays, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import apiClient from '@/api/client'
import { cn } from '@/utils'

interface Event {
  id: number
  title: string
  event_type: string
  start_datetime: string
  end_datetime: string
  location: string
  is_published: boolean
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  webinar:      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  town_hall:    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  workshop:     'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  consultation: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  training:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  other:        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa']

function MiniCalendar({ events }: { events: Event[] }) {
  const today = new Date()
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const firstDay = new Date(cursor.year, cursor.month, 1).getDay()
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()

  const eventDays = new Set(
    events
      .filter(e => {
        const d = new Date(e.start_datetime)
        return d.getFullYear() === cursor.year && d.getMonth() === cursor.month
      })
      .map(e => new Date(e.start_datetime).getDate())
  )

  const prev = () => setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 })
  const next = () => setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 })

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </span>
        <button onClick={next} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const isToday = day === today.getDate() && cursor.month === today.getMonth() && cursor.year === today.getFullYear()
          const hasEvent = eventDays.has(day)
          return (
            <div key={i} className="flex flex-col items-center py-0.5">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                isToday ? 'bg-primary-600 text-white font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}>
                {day}
              </div>
              {hasEvent && <div className={cn('w-1.5 h-1.5 rounded-full mt-0.5', isToday ? 'bg-white' : 'bg-primary-500')} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface OrgCalendarWidgetProps {
  title?: string
  className?: string
  /** admin=true fetches all events including unpublished */
  admin?: boolean
}

export default function OrgCalendarWidget({ title = 'Calendar', className, admin }: OrgCalendarWidgetProps) {
  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ['org-calendar-events'],
    queryFn: () => apiClient.get('/events/?ordering=start_datetime&page_size=50').then(r => {
      const raw = r.data
      return Array.isArray(raw) ? raw : (raw.results ?? [])
    }),
    staleTime: 1000 * 60 * 2,
  })

  const now = new Date()
  const upcoming = events
    .filter(e => new Date(e.start_datetime) >= now)
    .slice(0, 5)

  return (
    <div className={cn('card p-5 space-y-5', className)}>
      <div className="flex items-center gap-2">
        <CalendarDays size={17} className="text-primary-600 dark:text-primary-400" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{title}</h3>
      </div>

      {/* Mini calendar */}
      <MiniCalendar events={events} />

      <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Upcoming</p>

        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="skeleton h-10 w-full rounded-lg" />)}
          </div>
        ) : upcoming.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No upcoming events</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(event => {
              const d = new Date(event.start_datetime)
              return (
                <div key={event.id} className="flex gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  {/* Date block */}
                  <div className="flex-shrink-0 w-10 text-center bg-primary-50 dark:bg-primary-900/30 rounded-lg py-1">
                    <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase">
                      {MONTH_NAMES[d.getMonth()].slice(0,3)}
                    </p>
                    <p className="text-base font-extrabold text-primary-700 dark:text-primary-300 leading-none">
                      {d.getDate()}
                    </p>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{event.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', EVENT_TYPE_COLORS[event.event_type] ?? EVENT_TYPE_COLORS.other)}>
                        {event.event_type.replace('_', ' ')}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                          <MapPin size={9} /> {event.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock size={9} />
                        {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
