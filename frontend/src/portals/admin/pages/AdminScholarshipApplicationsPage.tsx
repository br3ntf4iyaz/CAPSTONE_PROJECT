import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, Save, FileText, Eye, ChevronDown, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { openPrivateFile } from '@/components/ui/SecureImage'
import { cn, formatDateTime, toArray } from '@/utils'
import { SCHOLARSHIP_STATUS, apiErrorMessage, type ScholarshipApplication, type ScholarshipAppStatus } from '@/portals/youth/scholarshipApps'

const REVIEW_STATUSES: ScholarshipAppStatus[] = ['submitted', 'under_review', 'for_compliance', 'approved', 'rejected']

function Section({ title, data }: { title: string; data: Record<string, string> }) {
  const rows = Object.entries(data).filter(([, v]) => v)
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{title}</p>
      <dl className="rounded-xl border border-gray-100 divide-y divide-gray-50">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-3 py-1.5 text-sm">
            <dt className="text-gray-500">{k.replace(/_/g, ' ')}</dt>
            <dd className="font-medium text-gray-800 text-right break-words max-w-[65%]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Row({ a }: { a: ScholarshipApplication }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<ScholarshipAppStatus>(a.status)
  const [remarks, setRemarks] = useState(a.admin_remarks)
  const st = SCHOLARSHIP_STATUS[a.status]
  const locked = a.status === 'withdrawn'

  const save = useMutation({
    mutationFn: () => apiClient.patch(`/applications/scholarship/${a.id}/review/`, { status, admin_remarks: remarks }),
    onSuccess: () => { toast.success('Saved. The applicant has been notified.'); qc.invalidateQueries({ queryKey: ['admin-scholarship-applications'] }) },
    onError: (e: any) => toast.error(apiErrorMessage(e)),
  })

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex flex-wrap items-start justify-between gap-2 text-left">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 break-words">{a.personal.full_name || a.applicant_email}</p>
          <p className="text-xs text-gray-500 break-words">{a.scholarship_title} · {a.personal.barangay}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            <span className="font-mono font-semibold text-gray-600">{a.reference_number}</span> · {formatDateTime(a.submitted_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', st.cls)}>{st.label}</span>
          <ChevronDown size={16} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-100 pt-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Section title="Personal" data={a.personal} />
            <Section title="Education" data={a.education} />
            <Section title="Family & finance" data={a.family} />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Documents ({a.documents.length})</p>
            {a.documents.length === 0 && <p className="text-sm text-gray-500">No documents uploaded.</p>}
            <ul className="space-y-1">
              {a.documents.map(d => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <FileText size={14} className="text-primary-600" />
                  <span className="text-gray-500">{d.label}:</span>
                  <span className="font-medium text-gray-800 break-all">{d.original_name}</span>
                  <button type="button" className="text-primary-700 hover:underline inline-flex items-center gap-1 text-xs"
                    onClick={() => openPrivateFile(d.url).catch(() => toast.error('Could not open the file.'))}>
                    <Eye size={12} /> View
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {a.applicant_message && (
            <p className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-gray-800 whitespace-pre-wrap">
              <strong>Applicant&apos;s reply:</strong> {a.applicant_message}
            </p>
          )}

          {locked ? (
            <p className="text-sm text-gray-500">The applicant withdrew this application.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
              <div>
                <label className="label" htmlFor={`st-${a.id}`}>Status</label>
                <select id={`st-${a.id}`} className="input" value={status} onChange={e => setStatus(e.target.value as ScholarshipAppStatus)}>
                  {REVIEW_STATUSES.map(s => <option key={s} value={s}>{SCHOLARSHIP_STATUS[s].label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`rm-${a.id}`}>
                  Remarks to the applicant {(status === 'for_compliance' || status === 'rejected') && <span className="text-red-500">*</span>}
                </label>
                <textarea id={`rm-${a.id}`} className="input min-h-[60px]" maxLength={1500} value={remarks} onChange={e => setRemarks(e.target.value)}
                  placeholder={status === 'for_compliance' ? 'Say exactly which document or correction is needed' : 'Optional note shown to the applicant'} />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button className="btn-primary btn-sm gap-1.5" disabled={save.isPending || (status === a.status && remarks === a.admin_remarks)} onClick={() => save.mutate()}>
                  <Save size={14} /> {save.isPending ? 'Saving...' : 'Save and notify'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export default function AdminScholarshipApplicationsPage({ embedded = false }: { embedded?: boolean }) {
  const [status, setStatus] = useState('')
  const [scholarship, setScholarship] = useState('')
  const [q, setQ] = useState('')

  const { data: scholarships = [] } = useQuery<{ id: number; title: string }[]>({
    queryKey: ['admin-scholarships-list'],
    queryFn: () => apiClient.get('/scholarships/').then(r => toArray(r.data)),
  })
  const { data = [], isLoading, isError } = useQuery<ScholarshipApplication[]>({
    queryKey: ['admin-scholarship-applications', status, scholarship, q],
    queryFn: () => apiClient.get('/applications/scholarship/', { params: { status: status || undefined, scholarship: scholarship || undefined, q: q || undefined } })
      .then(r => toArray<ScholarshipApplication>(r.data)),
  })

  return (
    <div className="space-y-5">
      <div>
        {embedded
          ? <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><GraduationCap size={18} className="text-primary-700" /> Scholarship applications</h2>
          : <h1 className="page-title flex items-center gap-2"><GraduationCap size={22} className="text-primary-700" /> Scholarship applications</h1>}
        <p className={embedded ? 'text-sm text-gray-500' : 'page-subtitle'}>
          Applications sent by young people for a scholarship: review them, check the documents and update the status. Every change notifies the applicant.
          To add or edit the scholarships themselves, go to{' '}
          <Link to="/admin/jobs-schools" className="font-semibold text-primary-700 hover:underline">Jobs, Scholarships &amp; Schools</Link>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search name, email or reference number" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input !w-auto" value={scholarship} onChange={e => setScholarship(e.target.value)} aria-label="Scholarship">
          <option value="">All scholarships</option>
          {scholarships.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <select className="input !w-auto" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(SCHOLARSHIP_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
      {isError && <p className="text-sm text-red-600">Could not load the applications.</p>}
      {!isLoading && !isError && data.length === 0 && <p className="text-sm text-gray-500 rounded-2xl border border-gray-100 bg-white p-8 text-center">No applications found.</p>}
      <div className="space-y-3">{data.map(a => <Row key={a.id} a={a} />)}</div>
    </div>
  )
}
