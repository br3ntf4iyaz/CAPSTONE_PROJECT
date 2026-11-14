import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCheck, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { QueryError } from '@/components/ui/QueryError'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn, formatDate, toArray } from '@/utils'

interface YouthUser {
  id: number
  email: string
  first_name: string
  last_name: string
}

interface ParticipationRecord {
  id: number
  user: number
  user_name: string | null
  record_type: string
  record_type_display: string
  value: number
  description: string
  recorded_at: string
  recorded_by_name: string | null
}

const RECORD_TYPES = [
  { value: 'governance_participation', label: 'Governance participation', hint: 'e.g. Attended the Barangay 3 council meeting' },
  { value: 'event_attendance', label: 'Event attendance', hint: 'e.g. Attended the Youth Summit 2026' },
  { value: 'volunteer_activity', label: 'Volunteer activity', hint: 'e.g. Joined the river clean-up drive' },
  { value: 'project_contribution', label: 'Project contribution', hint: 'e.g. Helped organize the Linggo ng Kabataan' },
  { value: 'course_completion', label: 'Course completion', hint: 'e.g. Completed Youth Governance 101' },
  { value: 'internship_completion', label: 'Internship completion', hint: 'e.g. Completed the City Youth Affairs internship' },
]

const today = () => new Date().toISOString().slice(0, 10)
const fullName = (u: YouthUser) => `${u.first_name} ${u.last_name}`.trim() || u.email

/** Admins record who took part in governance activities and other youth programs. */
export default function AdminParticipationPage() {
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<YouthUser | null>(null)
  const [recordType, setRecordType] = useState('governance_participation')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today())
  const [credits, setCredits] = useState('1')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)

  const hint = RECORD_TYPES.find(t => t.value === recordType)?.hint ?? ''

  const search = useQuery<YouthUser[]>({
    queryKey: ['participation-user-search', query],
    queryFn: () =>
      apiClient.get('/auth/admin/users/', { params: { search: query, role: 'youth' } })
        .then(r => toArray<YouthUser>(r.data).slice(0, 8)),
    enabled: query.trim().length >= 2 && !picked,
  })

  const records = useQuery<{ results: ParticipationRecord[]; count: number; next: string | null; previous: string | null }>({
    queryKey: ['participation-records', typeFilter, page],
    queryFn: () =>
      apiClient.get('/compliance/records/', { params: { record_type: typeFilter || undefined, page } }).then(r => {
        const d = r.data
        return Array.isArray(d)
          ? { results: d, count: d.length, next: null, previous: null }
          : { results: d.results ?? [], count: d.count ?? 0, next: d.next ?? null, previous: d.previous ?? null }
      }),
  })

  const create = useMutation({
    mutationFn: () =>
      apiClient.post('/compliance/records/', {
        user: picked!.id,
        record_type: recordType,
        value: Math.max(1, Number(credits) || 1),
        description: `${description.trim()} (${date})`,
      }),
    onSuccess: () => {
      toast.success(`Recorded for ${picked ? fullName(picked) : 'the youth'}.`)
      setDescription('')
      setCredits('1')
      setPage(1)
      qc.invalidateQueries({ queryKey: ['participation-records'] })
      qc.invalidateQueries({ queryKey: ['compliance-summary'] })
    },
    onError: (err: any) => {
      const d = err?.response?.data
      toast.error(d?.description?.[0] ?? d?.user?.[0] ?? d?.detail ?? 'Could not save the record.')
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/compliance/records/${id}/`),
    onSuccess: () => {
      toast.success('Record deleted.')
      qc.invalidateQueries({ queryKey: ['participation-records'] })
    },
    onError: () => toast.error('Could not delete the record.'),
  })

  const canSave = !!picked && description.trim().length >= 3 && !create.isPending

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title flex items-center gap-2"><UserCheck size={22} className="text-primary-700" /> Youth Participation</h1>
        <p className="page-subtitle">Record attendance at barangay council meetings, events, and other youth activities.</p>
      </div>

      {/* New record */}
      <form
        className="card p-5 space-y-4"
        onSubmit={e => { e.preventDefault(); if (canSave) create.mutate() }}
      >
        <p className="font-medium text-gray-800">Add a record</p>

        <div>
          <label className="label" htmlFor="part-user">Youth *</label>
          {picked ? (
            <div className="flex items-center justify-between gap-2 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 text-sm">
              <span className="min-w-0 truncate"><strong>{fullName(picked)}</strong> <span className="text-gray-500">{picked.email}</span></span>
              <button type="button" onClick={() => { setPicked(null); setQuery('') }} aria-label="Choose a different youth" className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
            </div>
          ) : (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                id="part-user"
                className="input pl-9 w-full"
                placeholder="Search by name or email…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoComplete="off"
              />
              {query.trim().length >= 2 && (
                <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {search.isLoading && <li className="px-3 py-2 text-xs text-gray-400">Searching…</li>}
                  {search.isError && <li className="px-3 py-2 text-xs text-red-500">Search failed.</li>}
                  {!search.isLoading && !search.isError && (search.data ?? []).length === 0 && (
                    <li className="px-3 py-2 text-xs text-gray-400">No youth found.</li>
                  )}
                  {(search.data ?? []).map(u => (
                    <li key={u.id}>
                      <button type="button" onClick={() => { setPicked(u); setQuery('') }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                        <span className="font-medium">{fullName(u)}</span> <span className="text-xs text-gray-400">{u.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="part-type">Activity type *</label>
            <select id="part-type" className="input w-full" value={recordType} onChange={e => setRecordType(e.target.value)}>
              {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="part-date">Date *</label>
              <input id="part-date" type="date" className="input w-full" value={date} max={today()} onChange={e => setDate(e.target.value || today())} />
            </div>
            <div>
              <label className="label" htmlFor="part-credits">Credits</label>
              <input id="part-credits" type="number" min={1} max={100} className="input w-full" value={credits} onChange={e => setCredits(e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="part-desc">What did they take part in? *</label>
          <input
            id="part-desc"
            className="input w-full"
            value={description}
            maxLength={450}
            onChange={e => setDescription(e.target.value)}
            placeholder={hint}
          />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={!canSave} className="btn-primary btn-sm disabled:opacity-50">
            {create.isPending ? 'Saving…' : 'Save record'}
          </button>
        </div>
      </form>

      {/* Records */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-medium text-gray-800">
          Recent records {records.data ? <span className="text-sm font-normal text-gray-400">({records.data.count})</span> : null}
        </p>
        <select
          className="input w-auto text-sm"
          aria-label="Filter by activity type"
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
        >
          <option value="">All types</option>
          {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {records.isLoading ? (
        <PageSpinner />
      ) : records.isError ? (
        <QueryError onRetry={() => records.refetch()} />
      ) : (records.data?.results.length ?? 0) === 0 ? (
        <EmptyState icon={UserCheck} title="No records yet" description="Records you add above will appear here." />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {records.data!.results.map(r => (
              <li key={r.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 break-words">{r.user_name ?? 'Unknown user'}</p>
                  <p className="text-sm text-gray-600 break-words">{r.description || '—'}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    <span className={cn('inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 mr-2')}>{r.record_type_display}</span>
                    {r.value > 1 ? `${r.value} credits · ` : ''}
                    recorded {formatDate(r.recorded_at)}{r.recorded_by_name ? ` by ${r.recorded_by_name}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => { if (window.confirm('Delete this participation record?')) remove.mutate(r.id) }}
                  disabled={remove.isPending}
                  aria-label="Delete record"
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
          {(records.data?.next || records.data?.previous) && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
              <button className="btn-secondary btn-sm" disabled={!records.data?.previous} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
              <span className="text-gray-400">Page {page}</span>
              <button className="btn-secondary btn-sm" disabled={!records.data?.next} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
