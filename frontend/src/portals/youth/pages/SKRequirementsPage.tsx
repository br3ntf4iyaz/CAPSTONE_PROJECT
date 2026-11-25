import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import { PageSpinner } from '@/components/ui/Spinner'
import { QueryError } from '@/components/ui/QueryError'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/utils'
import { RequirementActions, StateBadge, SubmitDocumentModal, useMyChecklist, type MyRequirement } from '../components/RequirementSubmit'

/** SK officials submit their council's documents to LYDO here, and see what LYDO verified, returned or is still checking. */
export default function SKRequirementsPage() {
  const [submitting, setSubmitting] = useState<MyRequirement | null>(null)
  const { data, isLoading, isError, error, refetch } = useMyChecklist()

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
  const pct = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link to="/sk-compliance" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800">
        ← Back to SK Compliance Monitoring
      </Link>
      <header>
        <h1 className="page-title flex items-center gap-2">
          <ClipboardCheck size={22} className="text-primary-700" /> SK Requirements
        </h1>
        <p className="page-subtitle">
          Documents your council submits to LYDO. Submit each one as a file (up to 10 MB). LYDO checks it, then verifies it or returns it with remarks you can correct.
          A requirement counts as completed only after LYDO verifies it. The RCB and MIL are submitted for each quarter or month in SK Compliance.
        </p>
      </header>

      <div className="card p-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <p className="font-semibold text-ink-900">{/^barangay/i.test(barangay.name) ? barangay.name : `Barangay ${barangay.name}`}</p>
          <p className="text-sm text-ink-500">{summary.completed} of {summary.total} verified</p>
        </div>
        <div className="h-2 bg-ink-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-ink-500 mt-3">
          {summary.awaiting > 0 && <span className="mr-3 font-semibold text-sky-700">{summary.awaiting} waiting for LYDO</span>}
          {summary.returned > 0 && <span className="mr-3 font-semibold text-amber-700">{summary.returned} returned for correction</span>}
          {summary.overdue > 0 && <span className="font-semibold text-red-700">{summary.overdue} overdue</span>}
          {summary.awaiting + summary.returned + summary.overdue === 0 && summary.completed < summary.total && 'Nothing submitted yet for the rest.'}
          {summary.completed === summary.total && 'All requirements are verified. Thank you!'}
        </p>
      </div>

      <ul className="space-y-3">
        {requirements.map(r => (
          <li key={r.type} className="card p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-ink-900">{r.label}</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {r.detail ? `${r.detail} · ` : ''}
                  {r.submitted_at && (r.status === 'submitted' || r.status === 'verified')
                    ? `Submitted ${formatDate(r.submitted_at)}`
                    : r.due_date ? `Due ${formatDate(r.due_date)}` : 'No due date set'}
                </p>
              </div>
              <StateBadge state={r.status} />
            </div>

            {r.status === 'returned' && r.remarks && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"><strong>LYDO asked you to correct:</strong> {r.remarks}</p>
            )}
            {r.status === 'verified' && r.remarks && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900"><strong>LYDO:</strong> {r.remarks}</p>}
            {r.sk_remarks && r.status !== 'not_submitted' && <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600"><strong>Your remarks:</strong> {r.sk_remarks}</p>}
            {r.status === 'submitted' && <p className="text-xs text-ink-500">Waiting for LYDO to review it. You can open the file you sent while you wait.</p>}
            {r.status === 'verified' && <p className="text-xs text-ink-500">Verified and locked. To change it, ask LYDO to reopen it.</p>}

            <RequirementActions item={r} onSubmit={setSubmitting} />
          </li>
        ))}
      </ul>

      {submitting && <SubmitDocumentModal item={submitting} onClose={() => setSubmitting(null)} />}
    </div>
  )
}
