import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, CheckCircle2, Circle, Clock, Eye, FileUp, Info, Pencil, RotateCcw, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { openPrivateFile } from '@/components/ui/SecureImage'
import { cn } from '@/utils'

/** The state of one SK requirement, as the server decides it. Only "verified" means completed. */
export type ReqState = 'not_submitted' | 'draft' | 'submitted' | 'returned' | 'verified' | 'overdue'

export const REQ_STATE: Record<ReqState, { label: string; cls: string; Icon: typeof Clock }> = {
  verified: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  submitted: { label: 'Waiting for LYDO', cls: 'bg-sky-50 text-sky-800 border-sky-200', Icon: Clock },
  returned: { label: 'Returned for correction', cls: 'bg-amber-50 text-amber-900 border-amber-300', Icon: RotateCcw },
  overdue: { label: 'Overdue', cls: 'bg-red-50 text-red-700 border-red-200', Icon: AlertTriangle },
  not_submitted: { label: 'Not Yet Submitted', cls: 'bg-ink-50 text-ink-600 border-ink-200', Icon: Circle },
  draft: { label: 'Draft', cls: 'bg-yellow-50 text-yellow-800 border-yellow-300', Icon: Pencil },
}

export function StateBadge({ state }: { state: string }) {
  const s = REQ_STATE[state as ReqState] ?? REQ_STATE.not_submitted
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', s.cls)}><s.Icon size={11} /> {s.label}</span>
}

export interface MyRequirement {
  id: number | null
  type: string
  label: string
  status: ReqState
  detail: string
  submitted_at: string | null
  due_date: string | null
  monitored: boolean
  remarks: string
  sk_remarks: string
  description: string
  instructions: string
  period_year: number | null
  period_label: string
  has_file: boolean
  can_submit: boolean
}
export interface MyChecklist {
  barangay: { id: number; name: string }
  summary: { completed: number; awaiting: number; returned: number; overdue: number; total: number; drafts: number; not_submitted: number }
  requirements: MyRequirement[]
}

export function useMyChecklist(enabled = true) {
  return useQuery<MyChecklist>({
    queryKey: ['sk-requirements-mine'],
    queryFn: () => apiClient.get('/sk-requirements/requirements/mine/').then(r => r.data),
    retry: false,
    enabled,
  })
}

const MAX_BYTES = 10 * 1024 * 1024

/** The submission form: what to submit (LYDO's guidance), the reporting period, the file, remarks. Save a draft or submit for verification. */
export function SubmitDocumentModal({ item, onClose }: { item: MyRequirement; onClose: () => void }) {
  const qc = useQueryClient()
  const thisYear = new Date().getFullYear()
  const [file, setFile] = useState<File | null>(null)
  const [remarks, setRemarks] = useState(item.sk_remarks ?? '')
  const [year, setYear] = useState<string>(item.period_year ? String(item.period_year) : String(thisYear))
  const [label, setLabel] = useState(item.period_label ?? '')
  const [review, setReview] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resubmit = item.status === 'returned'
  const hasDraftFile = item.status === 'draft' && item.has_file
  const pdfOnly = ['cbydp', 'abyip', 'annual_budget'].includes(item.type)

  const send = useMutation({
    mutationFn: (action: 'draft' | 'submit') => {
      const fd = new FormData()
      if (file) fd.append('file', file)
      fd.append('action', action)
      fd.append('remarks', remarks)
      fd.append('period_year', year)
      fd.append('period_label', label)
      return apiClient.post(`/sk-requirements/requirements/${item.id}/upload/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (_r, action) => {
      toast.success(action === 'draft' ? 'Draft saved. It is not sent to LYDO yet.' : 'Submitted. LYDO will review it.')
      qc.invalidateQueries({ queryKey: ['sk-requirements-mine'] })
      qc.invalidateQueries({ queryKey: ['sk-barangays-directory'] })
      qc.invalidateQueries({ queryKey: ['sk-compliance-overview'] })
      onClose()
    },
    onError: (err: any) => {
      const d = err?.response?.data
      toast.error(d?.file?.[0] ?? d?.detail ?? 'Could not save. Please try again.')
    },
  })
  const discard = useMutation({
    mutationFn: () => apiClient.post(`/sk-requirements/requirements/${item.id}/discard-draft/`),
    onSuccess: () => { toast.success('Draft deleted.'); qc.invalidateQueries({ queryKey: ['sk-requirements-mine'] }); onClose() },
    onError: () => toast.error('Could not delete the draft.'),
  })

  const pick = (f: File | undefined) => {
    if (!f) return
    if (f.size > MAX_BYTES) { toast.error('The file must be 10 MB or smaller.'); return }
    setFile(f)
  }
  const canSubmit = !!file || (hasDraftFile && !resubmit)
  const fileName = file?.name ?? (hasDraftFile ? 'The file saved in your draft' : null)

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-primary-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Submit ${item.label}`} onClick={onClose}>
      <div className="relative my-auto w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* header in the LYDOP blue */}
        <div className="relative bg-gradient-to-br from-primary-600 to-primary-800 px-5 pb-5 pt-5 text-white sm:px-6">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent-400/25 blur-2xl" />
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><X size={16} /></button>
          <p className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-50">
            <FileUp size={12} /> {resubmit ? 'Resubmit' : item.status === 'draft' ? 'Edit draft' : 'Submit document'}
          </p>
          <h3 className="relative mt-2 pr-8 font-display text-xl font-extrabold leading-tight">{item.label}</h3>
          {item.description && <p className="relative mt-1 text-sm text-primary-100">{item.description}</p>}
        </div>
        <div className="ph-stripe h-1 w-full" />

        <div className="space-y-4 p-5 sm:p-6">
          {item.instructions && (
            <div className="flex gap-3 rounded-2xl border border-primary-100 border-l-4 border-l-primary-500 bg-primary-50 p-3.5">
              <Info size={18} className="mt-0.5 shrink-0 text-primary-600" />
              <p className="text-sm leading-relaxed text-primary-900"><strong>What to submit:</strong> {item.instructions}</p>
            </div>
          )}
          {resubmit && item.remarks && (
            <div className="flex gap-3 rounded-2xl border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50 p-3.5">
              <RotateCcw size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-sm leading-relaxed text-amber-900"><strong>LYDO asked you to correct:</strong> {item.remarks}</p>
            </div>
          )}

          {!review ? (
            <>
              <div className="grid gap-3 rounded-2xl border border-primary-100 bg-primary-50/40 p-3.5 sm:grid-cols-3">
                <label className="block text-sm"><span className="flex items-center gap-1.5 font-semibold text-primary-900"><CalendarDays size={14} /> Reporting year</span>
                  <select className="input mt-1 border-primary-200 bg-white" value={year} onChange={e => setYear(e.target.value)}>
                    {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
                  </select></label>
                <label className="block text-sm sm:col-span-2"><span className="font-semibold text-primary-900">Period or details <span className="font-normal text-ink-500">(optional)</span></span>
                  <input className="input mt-1 border-primary-200 bg-white" maxLength={120} value={label} onChange={e => setLabel(e.target.value)} placeholder="For example: March 2026 regular meeting" /></label>
              </div>

              <input ref={inputRef} type="file" className="sr-only" accept={pdfOnly ? 'application/pdf,.pdf' : '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp'} onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
              <button type="button" onClick={() => inputRef.current?.click()}
                className={cn('group flex w-full items-center gap-4 rounded-2xl border-2 border-dashed px-4 py-5 text-left transition-colors',
                  fileName ? 'border-emerald-300 bg-emerald-50 hover:border-emerald-400' : 'border-primary-300 bg-gradient-to-br from-primary-50 to-white hover:border-primary-500 hover:from-primary-100')}>
                <span className={cn('inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md', fileName ? 'bg-emerald-500' : 'bg-gradient-to-br from-primary-500 to-primary-700')}>
                  {fileName ? <CheckCircle2 size={24} /> : <FileUp size={24} />}
                </span>
                <span className="min-w-0">
                  {fileName ? (<><span className="block truncate text-sm font-bold text-ink-900">{fileName}</span><span className="text-xs text-emerald-800">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ` : ''}ready. Click to choose another.</span></>)
                    : (<><span className="block text-sm font-bold text-primary-800">Choose the file</span><span className="text-xs text-ink-500">{pdfOnly ? 'PDF' : 'PDF, Word or picture'}, up to 10 MB</span></>)}
                </span>
              </button>

              <label className="block text-sm"><span className="font-semibold text-primary-900">Remarks <span className="font-normal text-ink-500">(optional)</span></span>
                <textarea className="input mt-1 resize-none border-primary-200" rows={2} maxLength={500} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Anything LYDO should know about this document" /></label>

              <div className="flex flex-wrap gap-2 border-t border-primary-100 pt-4">
                <button type="button" disabled={!canSubmit} onClick={() => setReview(true)} className="btn-primary flex-1 shadow-md shadow-primary-600/20 disabled:opacity-50"><Upload size={15} /> {resubmit ? 'Review and resubmit' : 'Review and submit'}</button>
                {!resubmit && (
                  <button type="button" disabled={send.isPending} onClick={() => send.mutate('draft')} className="inline-flex items-center gap-1.5 rounded-xl border-2 border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-700 hover:border-primary-400 hover:bg-primary-50"><Pencil size={14} /> Save as draft</button>
                )}
                {item.status === 'draft' && (
                  <button type="button" disabled={discard.isPending} onClick={() => { if (window.confirm('Delete this draft and its file?')) discard.mutate() }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 size={14} /> Delete draft</button>
                )}
              </div>
              {!canSubmit && <p className="text-xs text-ink-500">Choose the file to submit. You can also save what you have as a draft and finish later.</p>}
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm font-bold text-primary-900"><ShieldCheck size={16} className="text-primary-600" /> Check before you send it to LYDO</p>
              <dl className="divide-y divide-primary-100 overflow-hidden rounded-2xl border border-primary-100 bg-primary-50/40 text-sm">
                {([
                  ['Requirement', item.label], ['Reporting year', year], ['Period', label], ['File', fileName], ['Remarks', remarks],
                ] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-3.5 py-2.5"><dt className="text-ink-500">{k}</dt><dd className="min-w-0 break-words text-right font-semibold text-ink-900">{v}</dd></div>
                ))}
              </dl>
              <p className="text-xs text-ink-500">After you submit, it waits for LYDO. It counts as completed only after LYDO verifies it.</p>
              <div className="flex gap-2">
                <button type="button" disabled={send.isPending} onClick={() => send.mutate('submit')} className="btn-primary flex-1 shadow-md shadow-primary-600/20 disabled:opacity-50">{send.isPending ? 'Submitting...' : 'Submit for verification'}</button>
                <button type="button" onClick={() => setReview(false)} className="inline-flex items-center rounded-xl border-2 border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50">Back</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** The action buttons of one requirement, for the SK of that barangay. */
export function RequirementActions({ item, onSubmit }: { item: MyRequirement; onSubmit: (i: MyRequirement) => void }) {
  const periodic = item.type === 'quarterly_cash' || item.type === 'monthly_pr'
  const view = () => item.id && openPrivateFile(`/api/sk-requirements/requirements/${item.id}/file/`).catch(() => toast.error('Could not open the file'))
  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.can_submit && (
        <button type="button" onClick={() => onSubmit(item)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
          {item.status === 'draft' ? <Pencil size={12} /> : <Upload size={12} />} {item.status === 'returned' ? 'Resubmit' : item.status === 'draft' ? 'Edit draft' : 'Submit Document'}
        </button>
      )}
      {periodic && (
        <Link to="/sk-compliance" className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50">Open in SK Compliance</Link>
      )}
      {item.has_file && item.id && (
        <button type="button" onClick={view} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"><Eye size={12} /> View file</button>
      )}
    </div>
  )
}
