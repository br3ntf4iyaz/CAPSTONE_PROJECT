import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays, Plus, Edit2, Trash2, Eye, EyeOff, X, Star,
  Users, CheckCircle2, Circle, UserCheck, Hash, PlayCircle, StopCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDateTime, cn, toArray } from '@/utils'

interface Event {
  id: number
  title: string
  event_type: string
  description: string
  location: string
  meeting_link: string
  thumbnail: string | null
  start_datetime: string
  end_datetime: string
  capacity: number | null
  is_published: boolean
  is_featured: boolean
  check_in_active: boolean
  registration_count: number
}

interface AttendanceRecord {
  id: number
  user: number
  user_email: string
  user_full_name: string
  registered_at: string
  attended: boolean
}

const EVENT_TYPES = ['webinar', 'town_hall', 'workshop', 'consultation', 'training', 'other']

const EMPTY_FORM = {
  title: '', event_type: 'webinar', description: '', location: '',
  meeting_link: '', start_datetime: '', end_datetime: '', capacity: '',
  is_featured: false,
}

// ── Attendance Modal ───────────────────────────────────────────────────────────

function AttendanceModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const qc = useQueryClient()
  const [activeCode, setActiveCode] = useState<string | null>(null)
  const [checkInActive, setCheckInActive] = useState(event.check_in_active)

  const { data: records = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['event-attendance', event.id],
    queryFn: () => apiClient.get(`/events/${event.id}/attendance/`).then(r => toArray<AttendanceRecord>(r.data)),
    refetchInterval: checkInActive ? 5000 : false,
  })

  const toggleAttendance = useMutation({
    mutationFn: ({ regId, attended }: { regId: number; attended: boolean }) =>
      apiClient.patch(`/events/${event.id}/attendance/${regId}/`, { attended }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-attendance', event.id] }),
    onError: () => toast.error('Failed to update attendance'),
  })

  const startCheckin = useMutation({
    mutationFn: () => apiClient.post(`/events/${event.id}/start-checkin/`).then(r => r.data as { check_in_code: string }),
    onSuccess: (data) => {
      setActiveCode(data.check_in_code)
      setCheckInActive(true)
      qc.invalidateQueries({ queryKey: ['admin-events-full'] })
    },
    onError: () => toast.error('Failed to start check-in'),
  })

  const endCheckin = useMutation({
    mutationFn: () => apiClient.post(`/events/${event.id}/end-checkin/`),
    onSuccess: () => {
      setActiveCode(null)
      setCheckInActive(false)
      qc.invalidateQueries({ queryKey: ['admin-events-full'] })
    },
    onError: () => toast.error('Failed to end check-in'),
  })

  const attendedCount = records.filter(r => r.attended).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 my-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink-800">Attendance — {event.title}</h2>
            <p className="text-sm text-ink-500 mt-0.5">{attendedCount} / {records.length} attended</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* ── Check-in section ── */}
        <div className={cn(
          'rounded-xl border p-4',
          checkInActive ? 'bg-emerald-50 border-emerald-200' : 'bg-ink-50 border-ink-200'
        )}>
          {checkInActive && activeCode ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Hash size={15} className="text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Check-in active</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-4xl font-extrabold tracking-widest text-emerald-800 select-all">
                  {activeCode}
                </span>
                <span className="text-xs text-emerald-600">Announce this code to attendees</span>
              </div>
              <button
                onClick={() => endCheckin.mutate()}
                disabled={endCheckin.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-800 transition-colors"
              >
                <StopCircle size={14} /> End check-in
              </button>
            </div>
          ) : checkInActive ? (
            <div className="space-y-2">
              <p className="text-xs text-emerald-700 font-semibold">Check-in is active (code was set before this session)</p>
              <button
                onClick={() => endCheckin.mutate()}
                disabled={endCheckin.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-800 transition-colors"
              >
                <StopCircle size={14} /> End check-in
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-700">Event code check-in</p>
                <p className="text-xs text-ink-500 mt-0.5">Generate a 6-digit code for attendees to self-check-in</p>
              </div>
              <button
                onClick={() => startCheckin.mutate()}
                disabled={startCheckin.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors flex-shrink-0"
              >
                <PlayCircle size={14} /> Start check-in
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-ink-400 text-sm">Loading registrations…</div>
        ) : records.length === 0 ? (
          <div className="py-8 text-center text-ink-400 text-sm">
            <Users size={28} className="mx-auto mb-2 opacity-30" />
            No registrations yet.
          </div>
        ) : (
          <div className="divide-y divide-ink-100 max-h-72 overflow-y-auto -mx-6 px-6">
            {records.map(rec => (
              <div key={rec.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-800 truncate">{rec.user_full_name || '—'}</p>
                  <p className="text-xs text-ink-500 truncate">{rec.user_email}</p>
                </div>
                <button
                  onClick={() => toggleAttendance.mutate({ regId: rec.id, attended: !rec.attended })}
                  disabled={toggleAttendance.isPending}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border flex-shrink-0',
                    rec.attended
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  )}
                >
                  {rec.attended
                    ? <><CheckCircle2 size={13} /> Attended</>
                    : <><Circle size={13} /> Mark Attended</>}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="btn-secondary btn-sm">Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminCalendarPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Event | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'featured'>('all')
  const [attendanceEvent, setAttendanceEvent] = useState<Event | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ['admin-events-full'],
    queryFn: () => apiClient.get('/events/').then(r => toArray<Event>(r.data)),
  })

  const buildFormData = () => {
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('event_type', form.event_type)
    fd.append('description', form.description)
    fd.append('location', form.location)
    fd.append('meeting_link', form.meeting_link)
    fd.append('start_datetime', form.start_datetime)
    if (form.end_datetime) fd.append('end_datetime', form.end_datetime)
    if (form.capacity) fd.append('capacity', form.capacity)
    fd.append('is_featured', String(form.is_featured))
    if (thumbnailFile) fd.append('thumbnail', thumbnailFile)
    return fd
  }

  const createEvent = useMutation({
    mutationFn: () => apiClient.post('/events/', buildFormData(), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events-full'] })
      toast.success('Event created')
      closeModal()
    },
    onError: () => toast.error('Failed to create event'),
  })

  const updateEvent = useMutation({
    mutationFn: (id: number) => apiClient.patch(`/events/${id}/`, buildFormData(), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events-full'] })
      toast.success('Event updated')
      closeModal()
    },
    onError: () => toast.error('Failed to update event'),
  })

  const deleteEvent = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/events/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events-full'] })
      toast.success('Event deleted')
    },
    onError: () => toast.error('Failed to delete event'),
  })

  const togglePublished = useMutation({
    mutationFn: ({ id, is_published }: { id: number; is_published: boolean }) =>
      apiClient.patch(`/events/${id}/`, { is_published }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events-full'] })
      toast.success('Published status updated')
    },
    onError: () => toast.error('Failed to update'),
  })

  const toggleFeatured = useMutation({
    mutationFn: ({ id, is_featured }: { id: number; is_featured: boolean }) =>
      apiClient.patch(`/events/${id}/`, { is_featured }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-events-full'] })
      toast.success(vars.is_featured ? 'Marked as featured' : 'Removed from featured')
    },
    onError: () => toast.error('Failed to update'),
  })

  const openCreate = () => {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM })
    setThumbnailFile(null)
    setThumbnailPreview(null)
    setShowModal(true)
  }

  const openEdit = (e: Event) => {
    setEditTarget(e)
    setForm({
      title:          e.title,
      event_type:     e.event_type,
      description:    e.description,
      location:       e.location,
      meeting_link:   e.meeting_link,
      start_datetime: e.start_datetime?.slice(0, 16) ?? '',
      end_datetime:   e.end_datetime?.slice(0, 16) ?? '',
      capacity:       e.capacity?.toString() ?? '',
      is_featured:    e.is_featured,
    })
    setThumbnailFile(null)
    setThumbnailPreview(e.thumbnail ?? null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditTarget(null)
    setForm({ ...EMPTY_FORM })
    setThumbnailFile(null)
    setThumbnailPreview(null)
  }

  const handleThumbnailChange = (file: File | null) => {
    setThumbnailFile(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setThumbnailPreview(url)
    } else {
      setThumbnailPreview(editTarget?.thumbnail ?? null)
    }
  }

  const handleSubmit = () => {
    if (!form.title || !form.start_datetime) {
      toast.error('Title and start date are required')
      return
    }
    if (editTarget) {
      updateEvent.mutate(editTarget.id)
    } else {
      createEvent.mutate()
    }
  }

  if (isLoading) return <PageSpinner />

  const sorted = [...events].sort((a, b) =>
    new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
  )
  const filtered    = filter === 'featured' ? sorted.filter(e => e.is_featured) : sorted
  const featuredCount = events.filter(e => e.is_featured).length
  const isPending   = createEvent.isPending || updateEvent.isPending

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Calendar &amp; Events</h1>
          <p className="page-subtitle">{events.length} total · {featuredCount} featured</p>
        </div>
        <button onClick={openCreate} className="btn-primary btn-sm">
          <Plus size={15} /> Create Event
        </button>
      </div>

      {/* Featured strip */}
      {featuredCount > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-yellow-600 fill-yellow-400" />
            <span className="text-sm font-semibold text-yellow-800">
              Featured Events ({featuredCount}) — displayed on the public home page
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sorted.filter(e => e.is_featured).map(e => (
              <div key={e.id} className="flex items-center gap-2 bg-white border border-yellow-200 rounded-lg px-3 py-1.5 text-xs">
                <span className="font-medium text-gray-800">{e.title}</span>
                <span className="text-gray-400">{formatDateTime(e.start_datetime)}</span>
                <button
                  onClick={() => toggleFeatured.mutate({ id: e.id, is_featured: false })}
                  className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                  title="Remove from featured"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'featured'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === f
                ? 'bg-primary-700 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            )}
          >
            {f === 'all' ? 'All Events' : `Featured (${featuredCount})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No events"
            description={filter === 'featured' ? 'No featured events yet.' : 'Create your first event to get started.'}
            className="py-12"
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Location</th>
                <th>Reg.</th>
                <th>Featured</th>
                <th>Published</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td className="font-medium">
                    <div className="flex items-center gap-2">
                      {e.thumbnail && (
                        <img src={e.thumbnail} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="flex items-center gap-1">
                        {e.is_featured && <Star size={12} className="text-yellow-500 fill-yellow-400 flex-shrink-0" />}
                        {e.title}
                      </div>
                    </div>
                  </td>
                  <td className="capitalize text-xs">{e.event_type.replace('_', ' ')}</td>
                  <td className="text-xs">{formatDateTime(e.start_datetime)}</td>
                  <td className="text-xs">{e.end_datetime ? formatDateTime(e.end_datetime) : '—'}</td>
                  <td className="max-w-[100px] truncate text-xs text-gray-500">{e.location || '—'}</td>
                  <td className="text-sm">{e.registration_count}</td>
                  <td>
                    <button
                      onClick={() => toggleFeatured.mutate({ id: e.id, is_featured: !e.is_featured })}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        e.is_featured
                          ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      )}
                      title={e.is_featured ? 'Remove from featured' : 'Mark as featured'}
                    >
                      <Star size={14} className={e.is_featured ? 'fill-yellow-500' : ''} />
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => togglePublished.mutate({ id: e.id, is_published: !e.is_published })}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        e.is_published
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      )}
                      title={e.is_published ? 'Unpublish' : 'Publish'}
                    >
                      {e.is_published ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setAttendanceEvent(e)}
                        className="btn-secondary btn-sm text-xs p-1.5"
                        title="View attendance"
                      >
                        <UserCheck size={13} />
                      </button>
                      <button onClick={() => openEdit(e)} className="btn-secondary btn-sm text-xs p-1.5">
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Delete "${e.title}"?`)) deleteEvent.mutate(e.id) }}
                        className="btn-danger btn-sm text-xs p-1.5"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={closeModal}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">{editTarget ? 'Edit Event' : 'Create New Event'}</h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100"><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="label">Title *</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Event title"
                />
              </div>

              {/* Type */}
              <div>
                <label className="label">Event Type</label>
                <select
                  className="input"
                  value={form.event_type}
                  onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-[80px]"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Event details…"
                />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.start_datetime}
                    onChange={e => setForm(f => ({ ...f, start_datetime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">End Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.end_datetime}
                    onChange={e => setForm(f => ({ ...f, end_datetime: e.target.value }))}
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="label">Location</label>
                <input
                  className="input"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Physical location"
                />
              </div>

              {/* Meeting link */}
              <div>
                <label className="label">Meeting Link (online)</label>
                <input
                  className="input"
                  type="url"
                  value={form.meeting_link}
                  onChange={e => setForm(f => ({ ...f, meeting_link: e.target.value }))}
                  placeholder="https://meet.google.com/…"
                />
              </div>

              {/* Capacity */}
              <div>
                <label className="label">Capacity (blank = unlimited)</label>
                <input
                  className="input"
                  type="number"
                  value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                  placeholder="e.g. 100"
                  min={1}
                />
              </div>

              {/* Thumbnail */}
              <div>
                <label className="label">Thumbnail Image</label>
                {thumbnailPreview && (
                  <div className="mb-2 relative w-full h-32 rounded-xl overflow-hidden border border-ink-100 bg-ink-50">
                    <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                      className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full p-1 shadow"
                    >
                      <X size={14} className="text-gray-600" />
                    </button>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="input text-sm"
                  onChange={e => handleThumbnailChange(e.target.files?.[0] ?? null)}
                />
                {editTarget?.thumbnail && !thumbnailPreview && (
                  <p className="text-xs text-ink-400 mt-1">Current thumbnail removed. Upload a new one or leave blank to keep existing.</p>
                )}
              </div>

              {/* Featured */}
              <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-dashed border-yellow-300 bg-yellow-50">
                <input
                  type="checkbox"
                  id="is_featured"
                  checked={form.is_featured}
                  onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                />
                <label htmlFor="is_featured" className="cursor-pointer">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-yellow-800">
                    <Star size={14} className="fill-yellow-500 text-yellow-500" />
                    Mark as Featured Event
                  </div>
                  <p className="text-xs text-yellow-700 mt-0.5">
                    Featured events are highlighted on the public home page.
                  </p>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className="btn-secondary btn-sm">Cancel</button>
              <button onClick={handleSubmit} disabled={isPending} className="btn-primary btn-sm">
                {isPending ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {attendanceEvent && (
        <AttendanceModal
          event={attendanceEvent}
          onClose={() => setAttendanceEvent(null)}
        />
      )}
    </div>
  )
}
