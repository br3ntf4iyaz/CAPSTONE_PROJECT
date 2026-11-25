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
          <p className="text-sm font-bold text-ink-800">{pct}% compliance</p>
        </div>
        <div className="h-2 bg-ink-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
          {[
            ['Total', summary.total, 'text-ink-900'],
            ['Verified', summary.completed, 'text-emerald-700'],
            ['Waiting for LYDO', summary.awaiting, 'text-sky-700'],
            ['Need correction', summary.returned, 'text-amber-700'],
            ['Not yet submitted', summary.not_submitted, 'text-ink-600'],
          ].map(([label, value, cls]) => (
            <div key={label as string} className="rounded-xl bg-ink-50 px-2 py-2.5">
              <dd className={`text-xl font-extrabold tabular-nums ${cls}`}>{value}</dd>
              <dt className="text-[11px] font-semibold text-ink-500">{label}</dt>
            </div>
          ))}
        </dl>
        {summary.drafts > 0 && <p className="mt-3 text-xs font-semibold text-yellow-700">{summary.drafts} draft{summary.drafts === 1 ? '' : 's'} saved. Drafts are not sent to LYDO and do not count.</p>}
        {summary.overdue > 0 && <p className="mt-1 text-xs font-semibold text-red-700">{summary.overdue} past an official deadline.</p>}
      </div>

      <ul className="space-y-3">
        {requirements.map(r => (
          <li key={r.type} className="card p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-ink-900">{r.label}</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {r.detail ? `${r.detail} · ` : ''}{r.period_year ? `For ${r.period_year}${r.period_label ? `, ${r.period_label}` : ''} · ` : ''}
                  {r.submitted_at && (r.status === 'submitted' || r.status === 'verified')
                    ? `Submitted ${formatDate(r.submitted_at)}`
                    : r.due_date ? `Deadline ${formatDate(r.due_date)}` : 'No deadline has been set yet'}
                </p>
              </div>
              <StateBadge state={r.status} />
            </div>

            {r.description && <p className="text-xs text-ink-600">{r.description}</p>}
            {r.instructions && r.status !== 'verified' && <p className="rounded-lg bg-primary-50/70 px-3 py-2 text-xs text-primary-900"><strong>What to submit:</strong> {r.instructions}</p>}
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
