import { Link } from 'react-router-dom'
import { CheckCircle2, RefreshCw, MessageSquare } from 'lucide-react'
import { cn } from '@/utils'
import { APPLICATION_STATUS, useMyApplications, type MyApplication } from '../pages/MyApplicationsPage'

/** The current user's application to this job/scholarship, if any. */
export function useApplied(kind: 'job' | 'scholarship', objectId: number): MyApplication | undefined {
  const { data } = useMyApplications()
  return data?.find(a => a.kind === kind && a.object_id === objectId)
}

/** Small chip for list cards. Renders nothing when the user has not applied. */
export function AppliedBadge({ kind, objectId }: { kind: 'job' | 'scholarship'; objectId: number }) {
  const app = useApplied(kind, objectId)
  if (!app) return null
  const st = APPLICATION_STATUS[app.status]
  return (
    <span className={cn('absolute bottom-3 right-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full', st.cls)}>
      <CheckCircle2 size={11} /> Applied · {st.label}
    </span>
  )
}

/** Replaces the Apply button in a detail drawer once the user has applied. */
export function AppliedNotice({ kind, objectId, onResubmit }: { kind: 'job' | 'scholarship'; objectId: number; onResubmit?: () => void }) {
  const app = useApplied(kind, objectId)
  if (!app) return null
  const st = APPLICATION_STATUS[app.status]
  if (app.status === 'rejected' && kind === 'job' && onResubmit) {
    return (
      <div className="space-y-3 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3 text-sm">
        <p className="text-center text-ink-700">Status: <span className={cn('font-semibold px-2 py-0.5 rounded-full text-xs', st.cls)}>{st.label}</span></p>
        {app.admin_note && (
          <p className="flex gap-2 rounded-lg bg-white p-2.5 text-ink-800"><MessageSquare size={15} className="mt-0.5 shrink-0 text-red-500" /><span className="whitespace-pre-wrap break-words"><strong>Reason from LYDO:</strong> {app.admin_note}</span></p>
        )}
        <p className="text-xs text-ink-600">Maybe a requirement was sent wrongly. You can fix it and send your application again.</p>
        <button type="button" onClick={onResubmit} className="btn-primary w-full inline-flex items-center justify-center gap-2"><RefreshCw size={15} /> Fix and send again</button>
        <Link to="/my-applications" className="block text-center text-xs font-semibold text-primary-700 hover:text-primary-800">Track my applications →</Link>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50 px-4 py-3 text-sm text-center space-y-1">
      <p className="font-semibold text-ink-800 flex items-center justify-center gap-1.5">
        <CheckCircle2 size={15} className="text-emerald-600" /> You applied to this {kind}
      </p>
      <p className="text-ink-600">Status: <span className={cn('font-semibold px-2 py-0.5 rounded-full text-xs', st.cls)}>{st.label}</span></p>
      <Link to="/my-applications" className="text-xs font-semibold text-primary-700 hover:text-primary-800">Track my applications →</Link>
    </div>
  )
}
