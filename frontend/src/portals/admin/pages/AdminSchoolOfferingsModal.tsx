import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, BadgeCheck, Clock, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { confirmDeletion } from '@/components/ui/ConfirmDialog'

interface Row {
  id: number
  kind: 'strand' | 'tesda'
  name: string
  code: string
  note: string
  source_url: string
  source_note: string
  verification_status: 'verified' | 'pending'
}

const EMPTY = { kind: 'strand', name: '', code: '', note: '', source_url: '', source_note: '', verification_status: 'pending' }

/** The Senior High strands and the TESDA qualifications of a school. They are two separate lists. Only verified ones are shown to the public. */
export default function AdminSchoolOfferingsModal({ school, onClose }: { school: { id: number; name: string }; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ ...EMPTY })
  const key = ['admin-school-offerings', school.id]
  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: key,
    queryFn: () => apiClient.get('/schools/offerings/', { params: { school: school.id } }).then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? [])),
  })
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['admin-schools'] }); qc.invalidateQueries({ queryKey: ['youth-schools'] }) }
  const fail = (e: any) => toast.error(e?.response?.data?.detail || (e?.response?.data && JSON.stringify(e.response.data).slice(0, 120)) || 'Could not save')

  const add = useMutation({
    mutationFn: () => apiClient.post('/schools/offerings/', { ...form, school: school.id }),
    onSuccess: () => { toast.success('Added'); setForm({ ...EMPTY, kind: form.kind }); refresh() },
    onError: fail,
  })
  const setStatus = useMutation({
    mutationFn: ({ id, verification_status }: { id: number; verification_status: string }) => apiClient.patch(`/schools/offerings/${id}/`, { verification_status }),
    onSuccess: refresh, onError: fail,
  })
  const remove = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/schools/offerings/${id}/`),
    onSuccess: () => { toast.success('Removed'); refresh() }, onError: fail,
  })

  const group = (kind: 'strand' | 'tesda', title: string, empty: string) => {
    const list = rows.filter(r => r.kind === kind)
    return (
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-primary-800 mb-1.5">{title} <span className="font-normal text-gray-400">({list.length})</span></p>
        {list.length === 0 ? <p className="text-xs text-gray-500 rounded-lg bg-gray-50 px-3 py-2">{empty}</p> : (
          <ul className="space-y-1.5">
            {list.map(r => (
              <li key={r.id} className="flex items-start justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 break-words">{r.name}{r.code ? <span className="ml-1 text-xs text-gray-500">({r.code})</span> : null}</p>
                  {r.note && <p className="text-[11px] text-gray-500">{r.note}</p>}
                  {(r.source_url || r.source_note) && (
                    <p className="text-[11px] text-gray-500">
                      {r.source_url ? <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-700 hover:underline">Source <ExternalLink size={10} /></a> : r.source_note}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button type="button" onClick={() => setStatus.mutate({ id: r.id, verification_status: r.verification_status === 'verified' ? 'pending' : 'verified' })}
                    className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold border', r.verification_status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}
                    title="Click to change">
                    {r.verification_status === 'verified' ? <><BadgeCheck size={11} /> Verified</> : <><Clock size={11} /> Pending</>}
                  </button>
                  <button type="button" aria-label="Remove" className="p-1.5 rounded hover:bg-red-50 text-red-600"
                    onClick={async () => { if (await confirmDeletion({ what: 'entry', name: r.name, verb: 'remove' })) remove.mutate(r.id) }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Senior High strands and TESDA qualifications</h2>
            <p className="text-xs text-gray-500">{school.name}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-5">
          <p className="rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-900">
            Only <b>Verified</b> entries are shown to the public. Add an entry only when it was read from a reliable source (the school, DepEd or TESDA) and write that source. A strand is not a TESDA qualification: keep them in their own list.
          </p>
          {isLoading ? <p className="text-sm text-gray-400">Loading…</p> : (
            <>
              {group('strand', 'Senior High School strands', 'None yet. The finder shows "Strand information not yet available."')}
              {group('tesda', 'TESDA qualifications (NC II, NC III…)', 'None yet.')}
            </>
          )}
          <div className="rounded-xl border border-primary-100 p-3 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-primary-800">Add an entry</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Kind</label>
                <select className="input" value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}>
                  <option value="strand">SHS strand</option>
                  <option value="tesda">TESDA qualification</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={form.kind === 'tesda' ? 'e.g., Cookery' : 'e.g., Humanities and Social Sciences'} />
              </div>
              <div>
                <label className="label">{form.kind === 'tesda' ? 'Level' : 'Code'}</label>
                <input className="input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder={form.kind === 'tesda' ? 'NC II' : 'HUMSS'} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Note (e.g. the campus)</label>
                <input className="input" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Source link</label>
                <input type="url" className="input" value={form.source_url} onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))} placeholder="https://…" />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.verification_status} onChange={e => setForm(f => ({ ...f, verification_status: e.target.value }))}>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="label">Source note (if there is no web page)</label>
                <input className="input" value={form.source_note} onChange={e => setForm(f => ({ ...f, source_note: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end">
              <button className="btn-primary btn-sm flex items-center gap-1.5" disabled={!form.name.trim() || add.isPending} onClick={() => add.mutate()}>
                <Plus size={14} /> {add.isPending ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
