import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, AlertTriangle, Upload, ClipboardCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { QueryError } from '@/components/ui/QueryError'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn, formatDate } from '@/utils'

interface SKRequirementItem {
  id: number
  type: string
  label: string
  status: 'submitted' | 'pending' | 'overdue'
  submitted_at: string | null
  due_date: string | null
  notes: string
  has_file: boolean
}

interface MineResponse {
  barangay: { id: number; name: string }
  summary: { submitted: number; total: number }
  requirements: SKRequirementItem[]
}

const MAX_BYTES = 10 * 1024 * 1024

const STATUS_STYLE = {
  submitted: { label: 'Submitted', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  overdue: { label: 'Overdue', cls: 'bg-red-50 text-red-700 border-red-200', Icon: AlertTriangle },
} as const

/** SK officials upload their council's required documents (CBYDP, ABYIP, ...) and see what is still missing. */
export default function SKRequirementsPage() {
  const qc = useQueryClient()
  const [uploadingId, setUploadingId] = useState<number | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery<MineResponse>({
    queryKey: ['sk-requirements-mine'],
    queryFn: () => apiClient.get('/sk-requirements/requirements/mine/').then(r => r.data),
    retry: false,
  })

  const upload = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiClient.post(`/sk-requirements/requirements/${id}/upload/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onMutate: ({ id }) => setUploadingId(id),
    onSuccess: () => {
      toast.success('Document submitted.')
      qc.invalidateQueries({ queryKey: ['sk-requirements-mine'] })
    },
    onError: (err: any) => {
      const d = err?.response?.data
      toast.error(d?.file?.[0] ?? d?.detail ?? 'Upload failed. Please try again.')
    },
    onSettled: () => setUploadingId(null),
  })

  if (isLoading) return <PageSpinner />

  if (isError) {
    const status = (error as any)?.response?.status
    if (status === 403) {
      return (
        <div className="max-w-3xl mx-auto px-4 py-10">
          <EmptyState
            icon={ClipboardCheck}
            title="No SK council found for your profile"
            description="Add your barangay to your profile so we can show your council's requirements."
          />
        </div>
      )
    }
    return <QueryError onRetry={() => refetch()} />
  }

  const { barangay, summary, requirements } = data!
  const pct = summary.total ? Math.round((summary.submitted / summary.total) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="page-title flex items-center gap-2">
          <ClipboardCheck size={22} className="text-primary-700" /> SK Requirements
        </h1>
        <p className="page-subtitle">
          Documents your council submits to LYDO. Upload each one as a PDF (up to 10 MB).
        </p>
      </header>

      <div className="card p-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <p className="font-semibold text-ink-900">{/^barangay/i.test(barangay.name) ? barangay.name : `Barangay ${barangay.name}`}</p>
          <p className="text-sm text-ink-500">{summary.submitted} of {summary.total} submitted</p>
        </div>
        <div className="h-2 bg-ink-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        {summary.submitted === summary.total ? (
          <p className="text-sm text-emerald-700 mt-3">All requirements are complete. Thank you!</p>
        ) : (
          <p className="text-sm text-ink-500 mt-3">{summary.total - summary.submitted} still needed.</p>
        )}
      </div>

      <ul className="space-y-3">
        {requirements.map(r => {
          const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending
          const busy = uploadingId === r.id
          return (
            <li key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-ink-900">{r.label}</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {r.status === 'submitted' && r.submitted_at
                      ? `Submitted ${formatDate(r.submitted_at)}`
                      : r.due_date
                        ? `Due ${formatDate(r.due_date)}`
                        : 'No due date set'}
                  </p>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold border px-2.5 py-1 rounded-full flex-shrink-0', st.cls)}>
                  <st.Icon size={12} /> {st.label}
                </span>
              </div>

              {r.notes && (
                <p className="text-xs text-ink-600 bg-ink-50 rounded-lg px-3 py-2 mt-3">{r.notes}</p>
              )}

              <label className={cn('btn-secondary btn-sm text-xs cursor-pointer mt-3 inline-flex', busy && 'opacity-60 pointer-events-none')}>
                <Upload size={13} />
                {busy ? 'Uploading…' : r.has_file ? 'Replace PDF' : 'Upload PDF'}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    if (file.size > MAX_BYTES) { toast.error('File must be 10 MB or smaller.'); return }
                    upload.mutate({ id: r.id, file })
                  }}
                />
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
