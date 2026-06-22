import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays, Plus, Trash2, X, ChevronLeft, ChevronRight, Clock,
} from 'lucide-react'
import apiClient from '@/api/client'
import { cn } from '@/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersonalEvent {
  id: number
  title: string
  description: string
  date: string        // YYYY-MM-DD
  time: string | null // HH:MM:SS or null
  color: string
  created_at: string
}

type EventColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'pink'

const COLOR_DOT: Record<EventColor, string> = {
  blue:   'bg-blue-500',
  green:  'bg-green-500',
  red:    'bg-red-500',
  yellow: 'bg-yellow-400',
  purple: 'bg-purple-500',
  pink:   'bg-pink-500',
}

const COLOR_BADGE: Record<EventColor, string> = {
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  green:  'bg-green-50 text-green-700 border-green-200',
  red:    'bg-red-50 text-red-700 border-red-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  pink:   'bg-pink-50 text-pink-700 border-pink-200',
}

const COLORS: EventColor[] = ['blue', 'green', 'red', 'yellow', 'purple', 'pink']
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa']

const QK = ['personal-calendar']

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({
  events,
  onDayClick,
  selectedDate,
}: {
  events: PersonalEvent[]
  onDayClick: (date: string) => void
  selectedDate: string | null
}) {
  const today = new Date()
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const firstDay    = new Date(cursor.year, cursor.month, 1).getDay()
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()

  const eventDayColors: Record<number, string> = {}
  events.forEach(e => {
    const d = new Date(e.date + 'T00:00:00')
    if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) {
      eventDayColors[d.getDate()] = e.color
    }
  })

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const fmt = (day: number) =>
    `${cursor.year}-${String(cursor.month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 })}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </span>
        <button
          onClick={() => setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 })}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const isToday     = day === today.getDate() && cursor.month === today.getMonth() && cursor.year === today.getFullYear()
          const color       = eventDayColors[day]
          const dateStr     = fmt(day)
          const isSelected  = dateStr === selectedDate
          return (
            <button
              key={i}
              onClick={() => onDayClick(dateStr)}
              className="flex flex-col items-center py-0.5 group"
            >
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                isSelected  ? 'bg-primary-600 text-white font-bold' :
                isToday     ? 'bg-primary-100 text-primary-700 font-bold' :
                              'text-gray-700 hover:bg-gray-100 group-hover:bg-primary-50 group-hover:text-primary-700'
              )}>
                {day}
              </div>
              {color && (
                <div className={cn('w-1.5 h-1.5 rounded-full mt-0.5', COLOR_DOT[color as EventColor] ?? 'bg-primary-500')} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Add / Edit form modal ────────────────────────────────────────────────────

function EventForm({
  initial,
  onClose,
}: {
  initial: { date?: string }
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [title, setTitle]       = useState('')
  const [description, setDesc]  = useState('')
  const [date, setDate]         = useState(initial.date ?? '')
  const [time, setTime]         = useState('')
  const [color, setColor]       = useState<EventColor>('blue')

  const create = useMutation({
    mutationFn: (data: object) => apiClient.post('/auth/personal-events/', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); onClose() },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    create.mutate({ title: title.trim(), description, date, time: time || null, color })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Add Event</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="label">Title *</label>
          <input
            className="input w-full"
            placeholder="e.g. Deadline for report"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input w-full" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" className="input w-full" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Note</label>
          <textarea
            className="input w-full resize-none"
            rows={2}
            placeholder="Optional note..."
            value={description}
            onChange={e => setDesc(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Color</label>
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  'w-7 h-7 rounded-full border-2 transition-all',
                  COLOR_DOT[c],
                  color === c ? 'border-gray-800 scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                )}
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={create.isPending}
          className="btn-primary w-full justify-center"
        >
          {create.isPending ? 'Saving…' : 'Save Event'}
        </button>
      </form>
    </div>
  )
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export default function PersonalCalendarWidget({ className }: { className?: string }) {
  const qc = useQueryClient()
  const [selectedDate, setSelectedDate]   = useState<string | null>(null)
  const [showForm, setShowForm]           = useState(false)
  const [formInitialDate, setFormDate]    = useState<string | undefined>(undefined)

  const { data: events = [], isLoading } = useQuery<PersonalEvent[]>({
    queryKey: QK,
    queryFn: () => apiClient.get('/auth/personal-events/').then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d.results ?? [])
    }),
  })

  const deleteEvent = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/auth/personal-events/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })

  const openAdd = (date?: string) => {
    setFormDate(date ?? undefined)
    setShowForm(true)
  }

  // Events on the selected day
  const dayEvents = selectedDate
    ? events.filter(e => e.date === selectedDate)
    : []

  // Upcoming events (next 30 days)
  const today    = new Date()
  const in30     = new Date(today); in30.setDate(today.getDate() + 30)
  const upcoming = events
    .filter(e => { const d = new Date(e.date + 'T00:00:00'); return d >= today && d <= in30 })
    .slice(0, 5)

  return (
    <>
      <div className={cn('card p-5 space-y-5', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={17} className="text-primary-600" />
            <h3 className="font-semibold text-gray-900 text-sm">My Calendar</h3>
          </div>
          <button
            onClick={() => openAdd()}
            className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800 transition-colors"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {/* Mini calendar */}
        <MiniCalendar
          events={events}
          onDayClick={d => setSelectedDate(prev => prev === d ? null : d)}
          selectedDate={selectedDate}
        />

        {/* Selected day events */}
        {selectedDate && (
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
              <button
                onClick={() => openAdd(selectedDate)}
                className="text-[11px] text-primary-600 font-semibold hover:underline"
              >
                + Add
              </button>
            </div>
            {dayEvents.length === 0 ? (
              <p className="text-xs text-gray-400 py-2 text-center">No events — click "+ Add" to create one.</p>
            ) : (
              <div className="space-y-1.5">
                {dayEvents.map(ev => (
                  <div
                    key={ev.id}
                    className={cn('flex items-start justify-between gap-2 px-3 py-2 rounded-lg border text-xs', COLOR_BADGE[ev.color as EventColor] ?? COLOR_BADGE.blue)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{ev.title}</p>
                      {ev.time && (
                        <p className="flex items-center gap-1 mt-0.5 opacity-70">
                          <Clock size={9} />
                          {ev.time.slice(0, 5)}
                        </p>
                      )}
                      {ev.description && <p className="mt-0.5 opacity-70 line-clamp-2">{ev.description}</p>}
                    </div>
                    <button
                      onClick={() => deleteEvent.mutate(ev.id)}
                      className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity mt-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upcoming */}
        {!selectedDate && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Upcoming (30 days)</p>
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="skeleton h-8 w-full rounded-lg" />)}
              </div>
            ) : upcoming.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No upcoming events.<br/>Tap a day or click "+ Add".</p>
            ) : (
              <div className="space-y-1.5">
                {upcoming.map(ev => {
                  const d = new Date(ev.date + 'T00:00:00')
                  return (
                    <div key={ev.id} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-9 text-center bg-primary-50 rounded-lg py-1">
                        <p className="text-[9px] font-bold text-primary-600 uppercase">{MONTH_NAMES[d.getMonth()].slice(0,3)}</p>
                        <p className="text-sm font-extrabold text-primary-700 leading-none">{d.getDate()}</p>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-xs font-semibold text-gray-800 truncate">{ev.title}</p>
                        {ev.time && (
                          <p className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock size={9} /> {ev.time.slice(0,5)}
                          </p>
                        )}
                      </div>
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', COLOR_DOT[ev.color as EventColor] ?? 'bg-primary-500')} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <EventForm initial={{ date: formInitialDate }} onClose={() => setShowForm(false)} />
      )}
    </>
  )
}
