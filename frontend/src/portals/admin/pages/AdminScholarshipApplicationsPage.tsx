import { useState } from 'react'
import { AccountGroupTabs, inGroup, type AccountGroup } from '../components/AccountGroupTabs'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, Save, FileText, Eye, ChevronDown, Search, Download, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { openPrivateFile, fetchPrivateFile, SecureImage } from '@/components/ui/SecureImage'
import { cn, formatDateTime, toArray } from '@/utils'
import { SCHOLARSHIP_STATUS, apiErrorMessage, type ScholarshipApplication, type ScholarshipAppStatus, type ScholarshipDocument } from '@/portals/youth/scholarshipApps'

const DOC_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Waiting for review', cls: 'bg-gray-100 text-gray-600' },
  verified: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-800' },
  needs_revision: { label: 'Needs revision', cls: 'bg-orange-100 text-orange-800' },
  invalid: { label: 'Invalid', cls: 'bg-red-100 text-red-700' },
}

/** One submitted document: look at it, download it, and decide about it. A copy that was replaced stays visible as history. */
function DocReview({ a, d, closed }: { a: ScholarshipApplication; d: ScholarshipDocument; closed: boolean }) {
  const qc = useQueryClient()
  const [pick, setPick] = useState<'needs_revision' | 'invalid' | null>(null)
  const [note, setNote] = useState('')
  const isId = d.doc_type === 'valid_id'
  const isImage = /\.(jpe?g|png)$/i.test(d.original_name)
  const badge = DOC_BADGE[d.review_status ?? 'pending']
  const decide = useMutation({
    mutationFn: (v: { status: string; note?: string }) => apiClient.post(`/applications/scholarship/${a.id}/documents/${d.id}/review/`, v),
    onSuccess: (_r, v) => {
      toast.success(v.status === 'verified' ? 'Marked as verified.' : 'Saved. The applicant was told what to replace.')
      setPick(null); setNote('')
      qc.invalidateQueries({ queryKey: ['admin-scholarship-applications'] })
    },
    onError: (e: any) => toast.error(apiErrorMessage(e)),
  })
  const download = async () => {
    try {
      const url = await fetchPrivateFile(d.url)
      const el = document.createElement('a')
      el.href = url
      el.download = d.original_name
      el.click()
    } catch { toast.error('Could not download the file.') }
  }
  return (
    <li className={cn('rounded-xl border p-3 space-y-2', isId ? 'border-primary-200 bg-primary-50/30' : 'border-gray-100', d.superseded && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {isId ? <ShieldCheck size={14} className="text-primary-600" /> : <FileText size={14} className="text-primary-600" />}
        <span className="font-semibold text-gray-800">{isId ? 'Applicant Identification Document' : d.label}</span>
        {d.superseded ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Earlier copy (replaced)</span>
          : <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', badge.cls)}>{badge.label}</span>}
      </div>
      {isId && (
        <dl className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
          <div className="flex gap-2"><dt className="text-gray-500">Applicant:</dt><dd className="font-medium text-gray-800">{a.personal.full_name}</dd></div>
          <div className="flex gap-2"><dt className="text-gray-500">ID type:</dt><dd className="font-medium text-gray-800">{d.id_type === 'other_gov' && d.id_type_other ? d.id_type_other : (d.id_type_label || 'Not stated')}</dd></div>
          <div className="flex gap-2"><dt className="text-gray-500">Submitted:</dt><dd className="font-medium text-gray-800">{formatDateTime(d.uploaded_at)}</dd></div>
          <div className="flex gap-2"><dt className="text-gray-500">How:</dt><dd className="font-medium text-gray-800">{d.source === 'camera' ? 'Scanned with the camera' : 'Uploaded file'}</dd></div>
        </dl>
      )}
      {isId && isImage && <SecureImage src={d.url} alt="Submitted ID" className="max-h-56 w-full rounded-lg border border-gray-200 bg-white object-contain" />}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="break-all text-gray-600">{d.original_name}</span>
        <button type="button" className="inline-flex items-center gap-1 text-primary-700 hover:underline" onClick={() => openPrivateFile(d.url).catch(() => toast.error('Could not open the file.'))}><Eye size={12} /> Open in viewer</button>
        <button type="button" className="inline-flex items-center gap-1 text-primary-700 hover:underline" onClick={download}><Download size={12} /> Download</button>
      </div>
      {d.review_note && d.review_status !== 'verified' && <p className="rounded-lg bg-white p-2 text-xs text-gray-700 border border-gray-100"><strong>Remark:</strong> {d.review_note}</p>}
      {!d.superseded && !closed && (
        pick ? (
          <div className="space-y-2">
            <textarea className="input w-full text-sm" rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)}
              placeholder={pick === 'invalid' ? 'Why is this not acceptable? (the applicant reads it)' : 'What must be corrected? e.g. The ID is blurry. Please send a clearer image.'} />
            <div className="flex gap-2">
              <button type="button" disabled={note.trim().length < 5 || decide.isPending} onClick={() => decide.mutate({ status: pick, note })}
                className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{decide.isPending ? 'Saving…' : pick === 'invalid' ? 'Mark invalid and ask for a new copy' : 'Request revision'}</button>
              <button type="button" onClick={() => setPick(null)} className="text-xs font-semibold text-gray-500">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={decide.isPending || d.review_status === 'verified'} onClick={() => decide.mutate({ status: 'verified' })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Mark as verified</button>
            <button type="button" onClick={() => { setPick('needs_revision'); setNote('') }} className="rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-semibold text-orange-700">Needs revision</button>
            <button type="button" onClick={() => { setPick('invalid'); setNote('') }} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">Invalid</button>
          </div>
        )
      )}
    </li>
  )
}

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
            <ul className="space-y-2">
              {[...a.documents].sort((x, y) => Number(y.doc_type === 'valid_id') - Number(x.doc_type === 'valid_id')).map(d => (
                <DocReview key={d.id} a={a} d={d} closed={locked || a.status === 'approved' || a.status === 'rejected'} />
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
  const [group, setGroup] = useState<AccountGroup>('all')
  const { data: everyone = [], isLoading, isError } = useQuery<ScholarshipApplication[]>({
    queryKey: ['admin-scholarship-applications', status, scholarship, q],
    queryFn: () => apiClient.get('/applications/scholarship/', { params: { status: status || undefined, scholarship: scholarship || undefined, q: q || undefined } })
      .then(r => toArray<ScholarshipApplication>(r.data)),
  })

  const data = everyone.filter(a => inGroup(group, a.applicant_type))

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

      <AccountGroupTabs value={group} onChange={setGroup} types={everyone.map(a => a.applicant_type)} />

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
