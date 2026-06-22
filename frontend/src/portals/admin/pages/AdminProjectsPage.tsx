import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, CheckCircle2, XCircle, AlertCircle, RotateCcw, X, Eye,
  Trophy, Download, Users, FileText, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { submissionsApi, type Submission } from '@/api/submissions'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatDateTime, cn } from '@/utils'

// ── Status helpers ─────────────────────────────────────────────────────────────

const SUBMISSION_STATUS_COLORS: Record<string, string> = {
  draft:                'badge-gray',
  pending:              'badge-yellow',
  revision_requested:   'bg-orange-100 text-orange-700',
  approved:             'badge-green',
  in_progress:          'bg-blue-100 text-blue-700',
  completion_submitted: 'bg-purple-100 text-purple-700',
  completed:            'bg-emerald-100 text-emerald-700',
  rejected:             'badge-red',
}

// ── Review Modal ───────────────────────────────────────────────────────────────

interface ReviewModalProps {
  submission: Submission
  onClose: () => void
  onAction: () => void
}

const LOG_ACTION_COLORS: Record<string, string> = {
  submitted:           'text-blue-600',
  approved:            'text-emerald-600',
  rejected:            'text-red-600',
  revision_requested:  'text-amber-600',
  in_progress_marked:  'text-indigo-600',
  completion_submitted:'text-purple-600',
  completed:           'text-emerald-700',
}

function ReviewModal({ submission, onClose, onAction }: ReviewModalProps) {
  const [notes, setNotes] = useState('')
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  // Fetch full detail for review logs (list endpoint returns compact serializer)
  const { data: detail } = useQuery<Submission>({
    queryKey: ['submission-detail', submission.id],
    queryFn: () => submissionsApi.get(submission.id),
  })
  const reviewLogs = detail?.review_logs ?? []

  const mutation = useMutation({
    mutationFn: async (action: string) => {
      switch (action) {
        case 'approve':           return submissionsApi.approve(submission.id, notes)
        case 'reject':            return submissionsApi.reject(submission.id, notes)
        case 'request_revision':  return submissionsApi.requestRevision(submission.id, notes)
        case 'complete':          return submissionsApi.complete(submission.id, notes)
        default: throw new Error('Unknown action')
      }
    },
    onSuccess: () => {
      toast.success('Action completed successfully')
      onAction()
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Action failed'
      toast.error(msg)
    },
  })

  const canAcknowledge     = submission.status === 'pending' || submission.status === 'revision_requested'
  const canReject          = submission.status === 'pending' || submission.status === 'revision_requested'
  const canRequestRevision = submission.status === 'pending'
  const canComplete        = submission.status === 'completion_submitted'
  const isCompleted        = submission.status === 'completed'

  const isCompletionView = canComplete || isCompleted

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-5 my-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-800 truncate">{submission.title}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={cn('badge text-xs', SUBMISSION_STATUS_COLORS[submission.status] ?? 'badge-gray')}>
                {submission.status_display}
              </span>
              {submission.category_display && (
                <span className="badge badge-gray text-xs">{submission.category_display}</span>
              )}
              <span className="badge badge-gray text-xs">
                {submission.submitter_type === 'sk' ? 'SK' : 'Youth Org'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Submitter / dates */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="font-medium text-ink-500">Submitted by:</span> {submission.submitted_by_name || '—'}</div>
          <div><span className="font-medium text-ink-500">Email:</span> {submission.submitted_by_email || '—'}</div>
          <div><span className="font-medium text-ink-500">Submitted:</span> {formatDateTime(submission.submitted_at)}</div>
          {submission.start_date && (
            <div>
              <span className="font-medium text-ink-500">Activity Date:</span>{' '}
              {formatDate(submission.start_date)}{submission.end_date ? ` – ${formatDate(submission.end_date)}` : ''}
            </div>
          )}
          {submission.location && (
            <div><span className="font-medium text-ink-500">Venue:</span> {submission.location}</div>
          )}
          {submission.expected_participants !== null && (
            <div><span className="font-medium text-ink-500">Planned Participants:</span> {submission.expected_participants}</div>
          )}
          {submission.estimated_budget && (
            <div><span className="font-medium text-ink-500">Budget Used:</span> ₱{Number(submission.estimated_budget).toLocaleString()}</div>
          )}
        </div>

        {submission.description && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase mb-1">Description</p>
            <p className="text-sm text-ink-700 line-clamp-4">{submission.description}</p>
          </div>
        )}

        {submission.objectives && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase mb-1">Outcomes / Objectives Achieved</p>
            <p className="text-sm text-ink-700 line-clamp-4">{submission.objectives}</p>
          </div>
        )}

        {submission.target_beneficiaries && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase mb-1">Beneficiaries Served</p>
            <p className="text-sm text-ink-700 line-clamp-3">{submission.target_beneficiaries}</p>
          </div>
        )}

        {/* Main proposal file */}
        {submission.file && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase mb-1">Accomplishment Report</p>
            <a
              href={submission.file}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline"
            >
              <FileText size={14} /> View Document
            </a>
          </div>
        )}

        {/* ── Completion report section ─────────────────────────────────── */}
        {isCompletionView && (
          <div className={cn(
            'rounded-xl border p-4 space-y-3',
            canComplete ? 'bg-purple-50 border-purple-200' : 'bg-emerald-50 border-emerald-200',
          )}>
            <p className={cn(
              'text-xs font-semibold uppercase tracking-wide',
              canComplete ? 'text-purple-700' : 'text-emerald-700',
            )}>
              {canComplete ? 'Completion Report — Awaiting Final Review' : 'Completion Report'}
            </p>

            {submission.actual_participants !== null && (
              <div className="flex items-center gap-2 text-sm">
                <Users size={14} className="text-ink-400 flex-shrink-0" />
                <span className="font-medium text-ink-600">Actual Participants:</span>
                <span className="text-ink-800 font-semibold">{submission.actual_participants}</span>
                {submission.expected_participants !== null && (
                  <span className="text-xs text-ink-400">
                    (planned: {submission.expected_participants})
                  </span>
                )}
              </div>
            )}

            {submission.outcomes_narrative && (
              <div>
                <p className="text-xs font-semibold text-ink-500 uppercase mb-1">Outcomes Narrative</p>
                <p className="text-sm text-ink-700 whitespace-pre-wrap">{submission.outcomes_narrative}</p>
              </div>
            )}

            {submission.completion_report_file && (
              <a
                href={submission.completion_report_file}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline font-medium"
              >
                <Download size={14} /> Download Completion Report
              </a>
            )}

            {isCompleted && submission.completed_at && (
              <p className="text-xs text-emerald-600">
                Marked complete on {formatDate(submission.completed_at)}
                {submission.admin_notes && ` · Note: ${submission.admin_notes}`}
              </p>
            )}
          </div>
        )}

        {/* Review history timeline */}
        {reviewLogs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase mb-3 flex items-center gap-1.5">
              <Clock size={12} /> Review History
            </p>
            <div className="relative space-y-3 pl-5 before:absolute before:left-[7px] before:top-0 before:bottom-0 before:w-px before:bg-gray-200">
              {reviewLogs.map(log => (
                <div key={log.id} className="relative flex flex-col gap-0.5">
                  <div className="absolute -left-5 top-1.5 w-3 h-3 rounded-full bg-white border-2 border-gray-300" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs font-semibold', LOG_ACTION_COLORS[log.action] ?? 'text-ink-600')}>
                      {log.action_display}
                    </span>
                    <span className="text-xs text-ink-400">{formatDateTime(log.created_at)}</span>
                    {log.actor_name && (
                      <span className="text-xs text-ink-400">by {log.actor_name}</span>
                    )}
                  </div>
                  {log.notes && (
                    <p className="text-xs text-ink-600 leading-relaxed">{log.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review notes */}
        {(canAcknowledge || canReject || canRequestRevision || canComplete) && (
          <div>
            <label className="label">Notes / Comments</label>
            <textarea
              className="input min-h-[80px]"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={
                pendingAction === 'request_revision'
                  ? 'Describe what needs to be revised or clarified…'
                  : pendingAction === 'reject'
                  ? 'State the reason for rejection…'
                  : pendingAction === 'complete'
                  ? 'Optional closing notes for the submitter…'
                  : 'Optional notes for the submitter…'
              }
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 justify-end pt-1">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>

          {canRequestRevision && (
            <button
              onClick={() => { setPendingAction('request_revision'); mutation.mutate('request_revision') }}
              disabled={mutation.isPending}
              className="btn-sm bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 flex items-center gap-1"
            >
              <RotateCcw size={13} />
              {mutation.isPending && pendingAction === 'request_revision' ? 'Requesting…' : 'Request Revision'}
            </button>
          )}

          {canReject && (
            <button
              onClick={() => { setPendingAction('reject'); mutation.mutate('reject') }}
              disabled={mutation.isPending}
              className="btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center gap-1"
            >
              <XCircle size={13} />
              {mutation.isPending && pendingAction === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          )}

          {canAcknowledge && (
            <button
              onClick={() => { setPendingAction('approve'); mutation.mutate('approve') }}
              disabled={mutation.isPending}
              className="btn-primary btn-sm flex items-center gap-1"
            >
              <CheckCircle2 size={13} />
              {mutation.isPending && pendingAction === 'approve' ? 'Acknowledging…' : 'Acknowledge'}
            </button>
          )}

          {canComplete && (
            <button
              onClick={() => { setPendingAction('complete'); mutation.mutate('complete') }}
              disabled={mutation.isPending}
              className="btn-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
            >
              <Trophy size={13} />
              {mutation.isPending && pendingAction === 'complete' ? 'Completing…' : 'Mark as Complete'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SubTab = 'all' | 'pending' | 'revision_requested' | 'approved' | 'completion_submitted' | 'completed' | 'rejected'

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'all',                  label: 'All' },
  { key: 'pending',              label: 'Pending Review' },
  { key: 'revision_requested',   label: 'Revision Requested' },
  { key: 'approved',             label: 'Acknowledged' },
  { key: 'completion_submitted', label: 'Awaiting Completion Review' },
  { key: 'completed',            label: 'Completed' },
  { key: 'rejected',             label: 'Rejected' },
]

export default function AdminProjectsPage() {
  const qc = useQueryClient()
  const [subTab, setSubTab] = useState<SubTab>('all')
  const [reviewSubmission, setReviewSubmission] = useState<Submission | null>(null)

  const exportCSV = (submissions: Submission[]) => {
    const headers = ['ID', 'Title', 'Submitted By', 'Type', 'Category', 'Status', 'Activity Date', 'Submitted At']
    const rows = submissions.map(s => [
      s.id, s.title,
      s.submitted_by_name || s.submitted_by_email || '—',
      s.submitter_type === 'sk' ? 'SK' : 'Youth Org',
      s.category_display || '—',
      s.status_display,
      s.start_date ? formatDate(s.start_date) : '—',
      formatDate(s.submitted_at),
    ])
    const escape = (v: any) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `submissions-${subTab}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const params = subTab !== 'all' ? { status: subTab } : undefined

  const { data: submissions = [], isLoading } = useQuery<Submission[]>({
    queryKey: ['admin-submissions', subTab],
    queryFn: () => submissionsApi.list(params),
  })

  // Badge counts for tabs that need attention
  const { data: allSubmissions = [] } = useQuery<Submission[]>({
    queryKey: ['admin-submissions', 'all'],
    queryFn: () => submissionsApi.list(),
  })

  const pendingCount     = allSubmissions.filter(s => s.status === 'pending').length
  const completionCount  = allSubmissions.filter(s => s.status === 'completion_submitted').length
  const revisionCount    = allSubmissions.filter(s => s.status === 'revision_requested').length

  const tabBadge: Partial<Record<SubTab, number>> = {
    pending:              pendingCount,
    completion_submitted: completionCount,
    revision_requested:   revisionCount,
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Accomplishment Reports</h1>
          <p className="page-subtitle">Review submitted activity and program reports from SK and youth organizations</p>
        </div>
        <button
          onClick={() => exportCSV(submissions)}
          className="btn-secondary btn-sm flex items-center gap-1.5"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap">
        {SUB_TABS.map(tab => {
          const badge = tabBadge[tab.key]
          return (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                subTab === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-paper-100 text-ink-600 hover:bg-paper-200',
              )}
            >
              {tab.label}
              {badge != null && badge > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold',
                  subTab === tab.key ? 'bg-white/30 text-white' : 'bg-red-500 text-white',
                )}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="table-wrap">
        {submissions.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No reports found"
            description={subTab === 'all'
              ? 'No accomplishment reports have been submitted yet.'
              : `No ${subTab.replace(/_/g, ' ')} reports.`}
            className="py-12"
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Submitted By</th>
                <th>Type</th>
                <th>Category</th>
                <th>Activity Date</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(sub => (
                <tr key={sub.id}>
                  <td className="font-medium max-w-[200px] truncate">{sub.title}</td>
                  <td className="text-sm text-ink-600">{sub.submitted_by_name || sub.submitted_by_email || '—'}</td>
                  <td>
                    <span className="badge badge-gray text-xs">
                      {sub.submitter_type === 'sk' ? 'SK' : 'Youth Org'}
                    </span>
                  </td>
                  <td className="text-sm">{sub.category_display || '—'}</td>
                  <td className="text-sm text-ink-500">{sub.start_date ? formatDate(sub.start_date) : '—'}</td>
                  <td>
                    <span className={cn('badge text-xs', SUBMISSION_STATUS_COLORS[sub.status] ?? 'badge-gray')}>
                      {sub.status_display}
                    </span>
                  </td>
                  <td className="text-sm text-ink-500">{formatDate(sub.submitted_at)}</td>
                  <td>
                    <button
                      onClick={() => setReviewSubmission(sub)}
                      className="btn-secondary btn-sm text-xs flex items-center gap-1"
                    >
                      <Eye size={12} /> Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Review modal */}
      {reviewSubmission && (
        <ReviewModal
          submission={reviewSubmission}
          onClose={() => setReviewSubmission(null)}
          onAction={() => {
            qc.invalidateQueries({ queryKey: ['admin-submissions'] })
          }}
        />
      )}
    </div>
  )
}
