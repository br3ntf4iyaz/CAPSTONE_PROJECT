import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Circle, Clock, Eye, FileUp, RotateCcw, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { openPrivateFile } from '@/components/ui/SecureImage'
import { cn } from '@/utils'

/** The state of one SK requirement, as the server decides it. Only "verified" means completed. */
export type ReqState = 'not_submitted' | 'submitted' | 'returned' | 'verified' | 'overdue'

export const REQ_STATE: Record<ReqState, { label: string; cls: string; Icon: typeof Clock }> = {
  verified: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  submitted: { label: 'Waiting for LYDO', cls: 'bg-sky-50 text-sky-800 border-sky-200', Icon: Clock },
  returned: { label: 'Returned for correction', cls: 'bg-amber-50 text-amber-900 border-amber-300', Icon: RotateCcw },
  overdue: { label: 'Overdue', cls: 'bg-red-50 text-red-700 border-red-200', Icon: AlertTriangle },
  not_submitted: { label: 'Not Yet Submitted', cls: 'bg-ink-50 text-ink-600 border-ink-200', Icon: Circle },
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
  has_file: boolean
  can_submit: boolean
}
export interface MyChecklist {
  barangay: { id: number; name: string }
  summary: { completed: number; awaiting: number; returned: number; overdue: number; total: number }
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

/** Choose the file, check it, add remarks, then submit it for LYDO to verify. Nothing is counted as done until LYDO verifies it. */
export function SubmitDocumentModal({ item, onClose }: { item: MyRequirement; onClose: () => void }) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [remarks, setRemarks] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const resubmit = item.status === 'returned'
  const pdfOnly = ['cbydp', 'abyip', 'annual_budget'].includes(item.type)

  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('file', file as File)
      fd.append('remarks', remarks)
      return apiClient.post(`/sk-requirements/requirements/${item.id}/upload/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      toast.success('Submitted. LYDO will review it.')
      qc.invalidateQueries({ queryKey: ['sk-requirements-mine'] })
      qc.invalidateQueries({ queryKey: ['sk-barangays-directory'] })
      onClose()
    },
    onError: (err: any) => {
      const d = err?.response?.data
      toast.error(d?.file?.[0] ?? d?.detail ?? 'Could not submit. Please try again.')
    },
  })

  const pick = (f: File | undefined) => {
    if (!f) return
    if (f.size > MAX_BYTES) { toast.error('The file must be 10 MB or smaller.'); return }
    setFile(f)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`Submit ${item.label}`} onClick={onClose}>
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-full p-1.5 text-ink-500 hover:bg-ink-100"><X size={16} /></button>
        <h3 className="pr-8 font-display text-lg font-extrabold text-ink-900">{resubmit ? 'Resubmit' : 'Submit'}: {item.label}</h3>
        {resubmit && item.remarks && (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><strong>LYDO asked you to correct:</strong> {item.remarks}</p>
        )}
        <p className="mt-3 text-sm text-ink-600">
          {pdfOnly ? 'Choose a PDF file (up to 10 MB).' : 'Choose a PDF, Word or picture file (up to 10 MB).'} LYDO will check it. It counts as completed only after LYDO verifies it.
        </p>

        <input ref={inputRef} type="file" className="sr-only" accept={pdfOnly ? 'application/pdf,.pdf' : '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp'} onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-3 flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/50 px-4 py-4 text-left hover:border-primary-400">
          <FileUp size={22} className="shrink-0 text-primary-600" />
          <span className="min-w-0">
            {file ? (<><span className="block truncate text-sm font-semibold text-ink-900">{file.name}</span><span className="text-xs text-ink-500">{(file.size / 1024 / 1024).toFixed(2)} MB · click to choose another</span></>)
              : <span className="text-sm font-semibold text-primary-700">Choose the file</span>}
          </span>
        </button>

        <label className="mt-3 block text-sm">
          <span className="font-semibold text-ink-800">Remarks (optional)</span>
          <textarea className="input mt-1 resize-none" rows={2} maxLength={500} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Anything LYDO should know about this document" />
        </label>

        <div className="mt-4 flex gap-2">
          <button type="button" disabled={!file || submit.isPending} onClick={() => submit.mutate()} className="btn-primary flex-1 disabled:opacity-50">
            <Upload size={15} /> {submit.isPending ? 'Submitting...' : resubmit ? 'Resubmit for review' : 'Submit for review'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
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
          <Upload size={12} /> {item.status === 'returned' ? 'Resubmit' : 'Submit'}
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
