import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Save, Download, Paperclip, CreditCard, FileText, CheckCircle2, XCircle, PlayCircle, ShieldCheck } from 'lucide-react'
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
  id_document_url: string | null
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
  const [note, setNote] = useState(a.admin_note)
  const [open, setOpen] = useState(a.status === 'submitted' || a.status === 'under_review')
  const [idSeen, setIdSeen] = useState(false)
  const [resumeSeen, setResumeSeen] = useState(false)
  const [idOk, setIdOk] = useState(false)
  const [resumeOk, setResumeOk] = useState(false)
  const st = STATUSES.find(s => s.value === a.status)!
  const isJob = a.kind === 'job'
  const needsId = !!a.id_document_url      // older applications were made before the ID photo was required
  const needsResume = !!a.document_url

  const send = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.patch(`/applications/${a.id}/`, body),
    onSuccess: () => {
      toast.success('Saved. The applicant was notified.')
      qc.invalidateQueries({ queryKey: ['admin-applications'] })
    },
    onError: (err: any) => toast.error(String(err?.response?.data?.detail ?? 'Could not update the application')),
  })

  const open_ = (url: string | null, seen: (v: boolean) => void) => {
    if (!url) return
    openPrivateFile(url).then(() => seen(true)).catch(() => toast.error('Could not open the file'))
  }

  const checked = (!needsId || idOk) && (!needsResume || resumeOk)
  const canCheckId = !needsId || idSeen
  const canCheckResume = !needsResume || resumeSeen
  const decide = (status: 'approved' | 'rejected') => send.mutate({ status, admin_note: note, documents_checked: true })

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 break-words">{a.full_name} <span className="font-normal text-gray-500">applied to</span> {a.title}</p>
          <p className="text-xs text-gray-500">
            {isJob ? 'Job' : 'Scholarship'} · {a.email} · {a.contact_number} · {formatDateTime(a.submitted_at)}
          </p>
        </div>
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', st.cls)}>{st.label}</span>
      </div>

      <button type="button" onClick={() => setOpen(o => !o)} className="text-xs font-semibold text-primary-700 hover:text-primary-800">
        {open ? 'Hide details' : 'View details'}
      </button>
      {open && (
        <div className="space-y-3 rounded-xl bg-gray-50 p-3">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-xs text-gray-500">Full name</dt><dd className="break-words">{a.full_name}</dd></div>
            <div><dt className="text-xs text-gray-500">Birthdate</dt><dd>{a.birthdate || '—'}</dd></div>
            <div><dt className="text-xs text-gray-500">Contact</dt><dd className="break-words">{a.contact_number} · {a.email}</dd></div>
            <div><dt className="text-xs text-gray-500">Address</dt><dd className="break-words">{a.address || '—'}</dd></div>
            <div><dt className="text-xs text-gray-500">Valid ID given</dt><dd className="break-words">{a.id_type || '—'} · {a.id_number || '—'}</dd></div>
            {a.confirmed_requirements.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">Requirements confirmed by the applicant</dt>
                <dd><ul className="list-disc pl-5">{a.confirmed_requirements.map(r => <li key={r} className="break-words">{r}</li>)}</ul></dd>
              </div>
            )}
            {a.message && (
              <div className="sm:col-span-2"><dt className="text-xs text-gray-500">Message from the applicant</dt><dd className="whitespace-pre-wrap break-words">{a.message}</dd></div>
            )}
          </dl>

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={!a.id_document_url} onClick={() => open_(a.id_document_url, setIdSeen)}
              className={cn('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold', idSeen ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-800 hover:border-primary-300', !a.id_document_url && 'opacity-60')}>
              {idSeen ? <CheckCircle2 size={16} /> : <CreditCard size={16} />}
              <span>{a.id_document_url ? (idSeen ? 'ID photo opened' : 'Open the ID photo') : 'No ID photo (older application)'}</span>
            </button>
            <button type="button" disabled={!a.document_url} onClick={() => open_(a.document_url, setResumeSeen)}
              className={cn('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold', resumeSeen ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-800 hover:border-primary-300', !a.document_url && 'opacity-60')}>
              {resumeSeen ? <CheckCircle2 size={16} /> : <FileText size={16} />}
              <span>{a.document_url ? (resumeSeen ? 'Resume opened' : isJob ? 'Open the resume' : 'Open the document') : isJob ? 'No resume uploaded' : 'No document'}</span>
            </button>
          </div>
        </div>
      )}

      {a.status === 'submitted' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex-1 text-sm text-amber-900">Read the details and open the ID and resume. Then start the review. An application cannot be approved or refused straight from Submitted.</p>
          <button type="button" onClick={() => send.mutate({ status: 'under_review' })} disabled={send.isPending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
            <PlayCircle size={15} /> Start review
          </button>
        </div>
      )}

      {a.status === 'under_review' && (
        <div className="space-y-3 rounded-xl border border-primary-200 bg-primary-50/50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary-900"><ShieldCheck size={16} /> Your decision</p>
          <div className="space-y-1.5 text-sm">
            {needsId && (
              <label className={cn('flex items-center gap-2', !canCheckId && 'opacity-50')}>
                <input type="checkbox" disabled={!canCheckId} checked={idOk} onChange={e => setIdOk(e.target.checked)} />
                I opened the ID photo and it matches the applicant
                {!canCheckId && <span className="text-xs text-gray-500">(open it first)</span>}
              </label>
            )}
            {needsResume && (
              <label className={cn('flex items-center gap-2', !canCheckResume && 'opacity-50')}>
                <input type="checkbox" disabled={!canCheckResume} checked={resumeOk} onChange={e => setResumeOk(e.target.checked)} />
                I read the resume
                {!canCheckResume && <span className="text-xs text-gray-500">(open it first)</span>}
              </label>
            )}
            {!needsId && !needsResume && (
              <label className="flex items-center gap-2"><input type="checkbox" checked={idOk} onChange={e => { setIdOk(e.target.checked); setResumeOk(e.target.checked) }} /> I read the application</label>
            )}
          </div>
          <textarea className="input resize-none" rows={2} maxLength={1000} placeholder="Note for the applicant (required if you do not accept; they will see this)" value={note} onChange={e => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => decide('approved')} disabled={!checked || send.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
              <CheckCircle2 size={15} /> Approve
            </button>
            <button type="button" onClick={() => decide('rejected')} disabled={!checked || note.trim().length < 5 || send.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              title={note.trim().length < 5 ? 'Write the reason first' : ''}>
              <XCircle size={15} /> Not accepted
            </button>
          </div>
        </div>
      )}

      {(a.status === 'approved' || a.status === 'rejected') && (
        <div className="space-y-2">
          <textarea className="input resize-none" rows={2} maxLength={1000} placeholder="Note for the applicant (they will see this)" value={note} onChange={e => setNote(e.target.value)} />
          <button type="button" onClick={() => send.mutate({ admin_note: note })} disabled={note === a.admin_note || send.isPending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
            <Save size={14} /> Save note
          </button>
        </div>
      )}
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
      <div className="space-y-3">{shown.map(a => <Card key={a.id} a={a} />)}</div>
    </div>
  )
}
