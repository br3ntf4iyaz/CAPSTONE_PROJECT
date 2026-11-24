import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Save, Download, Paperclip } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { openPrivateFile } from '@/components/ui/SecureImage'
import { cn, formatDateTime } from '@/utils'

interface Application {
  id: number
  kind: 'job' | 'scholarship'
  title: string
  full_name: string
  email: string
  contact_number: string
  address: string
  birthdate: string | null
  id_type: string
  id_number: string
  message: string
  confirmed_requirements: string[]
  document_url: string | null
  status: 'submitted' | 'under_review' | 'approved' | 'rejected'
  submitted_at: string
  admin_note: string
}

const STATUSES = [
  { value: 'submitted', label: 'Submitted', cls: 'bg-gray-100 text-gray-700' },
  { value: 'under_review', label: 'Under review', cls: 'bg-amber-100 text-amber-800' },
  { value: 'approved', label: 'Approved', cls: 'bg-emerald-100 text-emerald-800' },
  { value: 'rejected', label: 'Not accepted', cls: 'bg-red-100 text-red-700' },
]

function Card({ a }: { a: Application }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(a.status)
  const [note, setNote] = useState(a.admin_note)
  const [open, setOpen] = useState(false)
  const st = STATUSES.find(s => s.value === a.status)!
  const save = useMutation({
    mutationFn: () => apiClient.patch(`/applications/${a.id}/`, { status, admin_note: note }),
    onSuccess: () => {
      toast.success('Application updated. The applicant was notified.')
      qc.invalidateQueries({ queryKey: ['admin-applications'] })
    },
    onError: () => toast.error('Could not update the application'),
  })
  const changed = status !== a.status || note !== a.admin_note

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 break-words">{a.full_name} <span className="font-normal text-gray-500">applied to</span> {a.title}</p>
          <p className="text-xs text-gray-500">
            {a.kind === 'job' ? 'Job' : 'Scholarship'} · {a.email} · {a.contact_number} · {formatDateTime(a.submitted_at)}
          </p>
        </div>
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', st.cls)}>{st.label}</span>
      </div>

      <button type="button" onClick={() => setOpen(o => !o)} className="text-xs font-semibold text-primary-700 hover:text-primary-800">
        {open ? 'Hide details' : 'View details'}
      </button>
      {open && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm rounded-xl bg-gray-50 p-3">
          <div><dt className="text-xs text-gray-500">Address</dt><dd className="break-words">{a.address || '—'}</dd></div>
          <div><dt className="text-xs text-gray-500">Birthdate</dt><dd>{a.birthdate || '—'}</dd></div>
          <div><dt className="text-xs text-gray-500">ID</dt><dd>{a.id_type || '—'} {a.id_number}</dd></div>
          <div>
            <dt className="text-xs text-gray-500">Document</dt>
            <dd>
              {a.document_url
                ? <button type="button" onClick={() => openPrivateFile(a.document_url!).catch(() => toast.error('Could not open the file'))} className="text-primary-700 inline-flex items-center gap-1"><Paperclip size={12} /> Open file</button>
                : '—'}
            </dd>
          </div>
          {a.confirmed_requirements.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-gray-500">Requirements confirmed by applicant</dt>
              <dd><ul className="list-disc pl-5">{a.confirmed_requirements.map(r => <li key={r} className="break-words">{r}</li>)}</ul></dd>
            </div>
          )}
          {a.message && (
            <div className="sm:col-span-2"><dt className="text-xs text-gray-500">Message</dt><dd className="whitespace-pre-wrap break-words">{a.message}</dd></div>
          )}
        </dl>
      )}

      <textarea
        className="input resize-none"
        rows={2}
        maxLength={1000}
        placeholder="Note for the applicant (they will see this)"
        value={note}
        onChange={e => setNote(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value as Application['status'])}>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button type="button" onClick={() => save.mutate()} disabled={!changed || save.isPending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
          <Save size={14} /> Save
        </button>
      </div>
    </div>
  )
}

function csvCell(v: unknown) {
  const s = String(v ?? '').replace(/"/g, '""')
  return /^[=+\-@]/.test(s) ? `"'${s}"` : `"${s}"`
}

export default function AdminApplicationsPage({ embedded = false }: { embedded?: boolean }) {
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const { data = [], isLoading } = useQuery<Application[]>({
    queryKey: ['admin-applications'],
    queryFn: () => apiClient.get('/applications/').then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? [])),
  })

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.filter(a =>
      (!status || a.status === status) &&
      (!kind || a.kind === kind) &&
      (!t || a.full_name.toLowerCase().includes(t) || a.title.toLowerCase().includes(t) || a.email.toLowerCase().includes(t)),
    )
  }, [data, status, kind, q])

  const count = (s: string) => data.filter(a => a.status === s).length

  const exportCsv = () => {
    const head = ['Applicant', 'Email', 'Contact', 'Type', 'Applied to', 'Status', 'Submitted', 'Note']
    const rows = shown.map(a => [a.full_name, a.email, a.contact_number, a.kind, a.title, a.status, a.submitted_at, a.admin_note])
    const csv = [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const el = document.createElement('a')
    el.href = url
    el.download = 'applications.csv'
    el.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white"><ClipboardCheck size={20} /></span>
          <div>
            {embedded
              ? <h2 className="text-lg font-bold text-gray-900">Job applications</h2>
              : <h1 className="text-xl font-bold text-gray-900">Job applications</h1>}
            <p className="text-xs text-gray-500">{count('submitted')} new · {count('under_review')} under review · {data.length} total</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Applications sent by young people for jobs (this also shows any older scholarship applications made before the new scholarship system).
              To add or edit the listings, go to{' '}
              <Link to="/admin/jobs-schools" className="font-semibold text-primary-700 hover:underline">Jobs, Scholarships &amp; Schools</Link>.
            </p>
          </div>
        </div>
        <button type="button" onClick={exportCsv} disabled={shown.length === 0} className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input className="input w-full sm:w-64" placeholder="Search name, email or title" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input w-auto" value={kind} onChange={e => setKind(e.target.value)}>
          <option value="">All types</option>
          <option value="job">Jobs</option>
          <option value="scholarship">Scholarships</option>
        </select>
        {[{ value: '', label: 'All' }, ...STATUSES].map(s => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold', status === s.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
      {!isLoading && shown.length === 0 && <p className="text-sm text-gray-500">No applications match.</p>}
      <div className="space-y-3">{shown.map(a => <Card key={a.id + a.status + a.admin_note} a={a} />)}</div>
    </div>
  )
}
