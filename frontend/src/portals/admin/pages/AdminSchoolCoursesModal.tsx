import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, BadgeCheck, Clock, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { FIELD_LABELS, PROGRAM_TYPE_LABELS } from '@/portals/youth/pages/schools/constants'

interface Row {
  id: number
  program: { id: number; name: string; program_type: string; field_of_study: string }
  source_url: string
  verification_status: 'verified' | 'pending'
  is_active: boolean
}

interface Props {
  school: { id: number; name: string }
  onClose: () => void
}

const EMPTY = { name: '', program_type: 'bachelor', field_of_study: 'other', source_url: '', verification_status: 'pending' }

export default function AdminSchoolCoursesModal({ school, onClose }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ ...EMPTY })
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all')

  const key = ['admin-school-courses', school.id]
  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: key,
    queryFn: () =>
      apiClient.get('/schools/school-programs/', { params: { school: school.id } })
        .then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? [])),
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key })
    qc.invalidateQueries({ queryKey: ['admin-schools'] })
  }
  const errMsg = (e: any) => {
    const d = e?.response?.data
    return String((d && Object.values(d).flat()[0]) ?? 'Request failed')
  }

  const add = useMutation({
    mutationFn: () => apiClient.post('/schools/school-programs/', { ...form, school: school.id }),
    onSuccess: () => { toast.success('Course saved'); setForm({ ...EMPTY }); refresh() },
    onError: e => toast.error(errMsg(e)),
  })
  const patch = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiClient.patch(`/schools/school-programs/${id}/`, data),
    onSuccess: refresh,
    onError: e => toast.error(errMsg(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/schools/school-programs/${id}/`),
    onSuccess: () => { toast.success('Course removed'); refresh() },
    onError: e => toast.error(errMsg(e)),
  })

  const shown = rows.filter(r => filter === 'all' || r.verification_status === filter)
  const nVer = rows.filter(r => r.verification_status === 'verified').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold break-words">Courses &middot; {school.name}</h2>
            <p className="text-xs text-gray-500">{nVer} verified, {rows.length - nVer} pending. Only verified courses appear in the Youth Portal.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Add course */}
          <form
            className="rounded-xl border border-gray-200 p-3 space-y-2"
            onSubmit={e => { e.preventDefault(); if (form.name.trim()) add.mutate() }}
          >
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><Plus size={14} /> Add a course</p>
            <input className="input" placeholder="Official course / program name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select className="input" value={form.program_type} onChange={e => setForm(f => ({ ...f, program_type: e.target.value }))}>
                {Object.entries(PROGRAM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="input" value={form.field_of_study} onChange={e => setForm(f => ({ ...f, field_of_study: e.target.value }))}>
                {Object.entries(FIELD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <input className="input" type="url" placeholder="Official source URL (required to mark verified)" value={form.source_url} onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))} />
            <div className="flex flex-wrap items-center gap-3">
              <select className="input w-auto" value={form.verification_status} onChange={e => setForm(f => ({ ...f, verification_status: e.target.value }))}>
                <option value="pending">Pending verification</option>
                <option value="verified">Verified</option>
              </select>
              <button type="submit" disabled={add.isPending} className="btn-primary btn-sm disabled:opacity-50">Save course</button>
            </div>
          </form>

          {/* Filter */}
          <div className="flex gap-2">
            {(['all', 'verified', 'pending'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn('px-3 py-1 rounded-lg text-xs font-semibold capitalize', filter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
              >
                {f}
              </button>
            ))}
          </div>

          {/* List */}
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-gray-500">No courses{filter !== 'all' ? ` marked ${filter}` : ''}. Course information currently unavailable &ndash; verification required.</p>
          ) : (
            <ul className="space-y-2">
              {shown.map(r => (
                <li key={r.id} className="rounded-lg border border-gray-200 p-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">{r.program.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {PROGRAM_TYPE_LABELS[r.program.program_type] ?? r.program.program_type} &middot; {FIELD_LABELS[r.program.field_of_study] ?? r.program.field_of_study}
                    </p>
                    {r.source_url && (
                      <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 break-all">
                        {r.source_url} <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.verification_status === 'verified' ? (
                      <button
                        onClick={() => patch.mutate({ id: r.id, data: { verification_status: 'pending' } })}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg"
                        title="Click to mark pending"
                      >
                        <BadgeCheck size={13} /> Verified
                      </button>
                    ) : (
                      <button
                        onClick={() => patch.mutate({ id: r.id, data: { verification_status: 'verified' } })}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg"
                        title="Click to mark verified (needs a source URL)"
                      >
                        <Clock size={13} /> Pending
                      </button>
                    )}
                    <button
                      onClick={() => { if (window.confirm(`Remove "${r.program.name}" from ${school.name}?`)) remove.mutate(r.id) }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                      aria-label="Remove course"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
