import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
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
export function AppliedNotice({ kind, objectId }: { kind: 'job' | 'scholarship'; objectId: number }) {
  const app = useApplied(kind, objectId)
  if (!app) return null
  const st = APPLICATION_STATUS[app.status]
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
