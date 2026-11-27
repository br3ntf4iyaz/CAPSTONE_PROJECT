import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Award, ChevronDown, FileText, MessageSquare, Paperclip, Send, AlertCircle, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn, formatDate } from '@/utils'
import { fetchPrivateFile } from '@/components/ui/SecureImage'
import { SCHOLARSHIP_STATUS, apiErrorMessage, type ScholarshipApplication } from '../scholarshipApps'
import IdDocumentInput, { EMPTY_ID, appendIdFields, type IdDoc } from './IdDocumentInput'

const REVIEW_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Waiting for review', cls: 'bg-ink-100 text-ink-600' },
  verified: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-800' },
  needs_revision: { label: 'Needs revision', cls: 'bg-orange-100 text-orange-800' },
  invalid: { label: 'Invalid', cls: 'bg-red-100 text-red-700' },
}

const STEPS = ['Submitted', 'Under review', 'Decision']

function Progress({ status }: { status: ScholarshipApplication['status'] }) {
  if (status === 'withdrawn') return null
  const idx = status === 'submitted' ? 0 : status === 'under_review' || status === 'for_compliance' ? 1 : 2
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold" aria-label="Application progress">
      {STEPS.map((l, i) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className={cn('px-2 py-0.5 rounded-full',
            i <= idx ? (i === 2 && status === 'rejected' ? 'bg-red-100 text-red-700' : i === 1 && status === 'for_compliance' ? 'bg-orange-100 text-orange-800' : 'bg-primary-100 text-primary-700') : 'bg-ink-50 text-ink-400')}>
            {i === 1 && status === 'for_compliance' ? 'For compliance' : i === 2 && status === 'rejected' ? 'Rejected' : l}
          </span>
          {i < STEPS.length - 1 && <span className="text-ink-300">›</span>}
        </li>
      ))}
    </ol>
  )
}

async function openDocument(url: string) {
  try {
    window.open(await fetchPrivateFile(url), '_blank', 'noopener')
  } catch {
    toast.error('Could not open the file.')
  }
}

export default function ScholarshipApplicationCard({ app }: { app: ScholarshipApplication }) {
  const qc = useQueryClient()
  const st = SCHOLARSHIP_STATUS[app.status]
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [message, setMessage] = useState('')
  const [idDoc, setIdDoc] = useState<IdDoc>(EMPTY_ID)
  const [error, setError] = useState('')
  // the current valid ID, when LYDO asked for a better copy of it
  const idToFix = app.documents.find(d => d.doc_type === 'valid_id' && !d.superseded && (d.review_status === 'needs_revision' || d.review_status === 'invalid'))
  const fileRef = useRef<HTMLInputElement>(null)
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['my-scholarship-applications'] })
    qc.invalidateQueries({ queryKey: ['my-applications'] })
  }

  const comply = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      files.forEach(f => fd.append('doc_other', f))
      appendIdFields(fd, idDoc)
      fd.append('message', message)
      return apiClient.post(`/applications/scholarship/${app.id}/comply/`, fd, { headers: { 'Content-Type': undefined as unknown as string } })
    },
    onSuccess: () => { toast.success('Sent to LYDO. Your application is back under review.'); setFiles([]); setMessage(''); setIdDoc(EMPTY_ID); setError(''); refresh() },
    onError: (e: any) => setError(apiErrorMessage(e)),
  })
  const withdraw = useMutation({
    mutationFn: () => apiClient.post(`/applications/scholarship/${app.id}/withdraw/`),
    onSuccess: () => { toast.success('Application withdrawn'); refresh() },
    onError: (e: any) => toast.error(apiErrorMessage(e)),
  })

  const addFile = (f?: File) => {
    if (!f) return
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) return toast.error('Only PDF, JPG or PNG files are allowed.')
    if (f.size > 5 * 1024 * 1024) return toast.error('Each file must be under 5 MB.')
    setFiles(prev => [...prev, f])
  }

  return (
    <article className="rounded-2xl border border-ink-100 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary-50 text-primary-700 shrink-0"><Award size={18} /></span>
          <div className="min-w-0">
            <h2 className="font-semibold text-ink-900 break-words">{app.scholarship_title}</h2>
            <p className="text-xs text-ink-500">
              Ref. <span className="font-mono font-semibold text-ink-700 select-all">{app.reference_number}</span> · Submitted {formatDate(app.submitted_at)}
            </p>
          </div>
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', st.cls)}>{st.label}</span>
      </div>

      <Progress status={app.status} />
      <p className="text-sm text-ink-600">{st.hint}</p>

      {app.admin_remarks && (
        <div className={cn('rounded-xl border p-3 text-sm text-ink-800 flex gap-2',
          app.status === 'for_compliance' ? 'bg-orange-50 border-orange-200' : 'bg-primary-50 border-primary-100')}>
          <MessageSquare size={15} className="mt-0.5 text-primary-600 shrink-0" />
          <span className="whitespace-pre-wrap break-words"><strong>Remarks from LYDO:</strong> {app.admin_remarks}</span>
        </div>
      )}

      {app.status === 'for_compliance' && (
        <div className="rounded-xl border border-orange-200 bg-white p-3 space-y-2.5">
          <p className="text-sm font-semibold text-ink-800">{idToFix ? 'Replace your ID' : 'Send the missing documents'}</p>
          {idToFix && (
            <>
              <p className="text-xs text-ink-600">You only need to replace the ID. The rest of your application stays as it is, and your earlier copy is kept in the history.</p>
              <IdDocumentInput required value={idDoc} onChange={setIdDoc} hint="Take a clear photo of the whole ID, or upload a better copy." />
            </>
          )}
          <textarea className="input w-full" rows={2} placeholder="Message to LYDO (optional)" value={message} onChange={e => setMessage(e.target.value)} maxLength={1000} />
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs">
              <FileText size={13} className="text-primary-600" /> <span className="flex-1 truncate">{f.name}</span>
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-red-600 hover:underline">Remove</button>
            </div>
          ))}
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" aria-label="Attach a file"
            onChange={e => { addFile(e.target.files?.[0]); e.target.value = '' }} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm gap-1.5" onClick={() => fileRef.current?.click()}><Paperclip size={13} /> Attach file</button>
            <button type="button" className="btn-primary btn-sm gap-1.5" disabled={comply.isPending || (!files.length && !message.trim() && !idDoc.file) || (!!idDoc.file && !idDoc.confirmed)} onClick={() => { setError(''); comply.mutate() }}>
              <Send size={13} /> {comply.isPending ? 'Sending...' : 'Send to LYDO'}
            </button>
          </div>
          {error && <p className="flex items-start gap-1.5 text-xs text-red-600" role="alert"><AlertCircle size={13} className="mt-0.5" /> {error}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="text-xs font-semibold text-primary-700 hover:text-primary-800 inline-flex items-center gap-1">
          {open ? 'Hide details' : 'View application details'} <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
        {['submitted', 'under_review', 'for_compliance'].includes(app.status) && (
          <button type="button" disabled={withdraw.isPending}
            onClick={() => { if (window.confirm('Withdraw this application? You will not be able to apply to this scholarship again.')) withdraw.mutate() }}
            className="text-xs font-semibold text-red-600 hover:text-red-700">
            Withdraw application
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-3 border-t border-ink-100 pt-3 text-sm">
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {[['Name', app.personal.full_name], ['Barangay', app.personal.barangay], ['School', app.education.school_name],
              ['Course / strand', app.education.course], ['Year level', app.education.year_level]].map(([k, v]) => (
              <p key={k} className="flex justify-between gap-3"><span className="text-ink-500">{k}</span><span className="font-medium text-ink-800 text-right">{v || '-'}</span></p>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-1">Submitted documents</p>
            {app.documents.length === 0 && <p className="text-ink-500 text-xs">No documents.</p>}
            <ul className="space-y-1.5">
              {app.documents.map(d => {
                const rb = REVIEW_BADGE[d.review_status ?? 'pending']
                return (
                  <li key={d.id} className={cn('text-xs', d.superseded && 'opacity-70')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText size={13} className="text-primary-600" />
                      <span className="text-ink-500">{d.label}{d.id_type_label ? ` (${d.id_type === 'other_gov' && d.id_type_other ? d.id_type_other : d.id_type_label})` : ''}:</span>
                      <span className="font-medium text-ink-800 break-all">{d.original_name}</span>
                      <button type="button" onClick={() => openDocument(d.url)} className="text-primary-700 hover:underline inline-flex items-center gap-1"><Eye size={12} /> View</button>
                      {d.superseded ? <span className="rounded-full bg-ink-100 px-2 py-0.5 font-semibold text-ink-500">Earlier copy</span> : <span className={cn('rounded-full px-2 py-0.5 font-semibold', rb.cls)}>{rb.label}</span>}
                    </div>
                    {d.review_note && d.review_status !== 'verified' && <p className="ml-5 mt-0.5 text-ink-600">LYDO: {d.review_note}</p>}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </article>
  )
}
