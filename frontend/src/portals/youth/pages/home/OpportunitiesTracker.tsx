import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ClipboardList, Clock } from 'lucide-react'
import apiClient from '@/api/client'
import { cn, formatDate } from '@/utils'
import { APPLICATION_STATUS, useMyApplications } from '../MyApplicationsPage'

interface SavedJob {
  id: number
  title: string
  company_or_org: string
  application_deadline?: string
  deadline_status?: 'open' | 'soon' | 'closed' | 'none'
}

interface Scholarship { id: number; title: string; provider: string; deadline: string }

const DAY = 24 * 60 * 60 * 1000

/** Dashboard card: latest application statuses + saved jobs that close soon. */
export default function OpportunitiesTracker() {
  const apps = useMyApplications()
  const saved = useQuery<SavedJob[]>({
    queryKey: ['saved-jobs-dashboard'],
    queryFn: () => apiClient.get('/jobs/saved/').then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? [])),
    retry: false,
  })

  const schol = useQuery<Scholarship[]>({
    queryKey: ['scholarships-dashboard'],
    queryFn: () => apiClient.get('/scholarships/').then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? [])),
    retry: false,
  })

  const appliedSch = new Set((apps.data ?? []).filter(a => a.kind === 'scholarship').map(a => a.object_id))
  const closingSch = (schol.data ?? [])
    .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.deadline) && !appliedSch.has(x.id))
    .map(x => ({ ...x, ms: new Date(x.deadline).getTime() - Date.now() }))
    .filter(x => x.ms > 0 && x.ms < 30 * DAY)
    .sort((a, b) => a.ms - b.ms)
    .slice(0, 3)

  const applied = new Set((apps.data ?? []).filter(a => a.kind === 'job').map(a => a.object_id))
  const latest = (apps.data ?? []).slice(0, 3)
  const closing = (saved.data ?? []).filter(j => j.deadline_status === 'soon' && !applied.has(j.id)).slice(0, 3)

  if (latest.length === 0 && closing.length === 0 && closingSch.length === 0) return null

  return (
    <section className="card p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary-50 text-primary-700">
            <ClipboardList size={18} />
          </span>
          <h2 className="section-title !mb-0">Your opportunities</h2>
        </div>
        <Link to="/my-applications" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1">
          My applications <ArrowRight size={12} />
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {latest.length > 0 && (
          <div className="space-y-2">
            <p className="eyebrow">Application status</p>
            {latest.map(a => {
              const st = APPLICATION_STATUS[a.status]
              return (
                <Link key={a.id} to="/my-applications" className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3 hover:bg-ink-50/60">
                  <span className="text-sm font-medium text-ink-900 truncate">{a.title}</span>
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0', st.cls)}>{st.label}</span>
                </Link>
              )
            })}
          </div>
        )}
        {closing.length > 0 && (
          <div className="space-y-2">
            <p className="eyebrow">Saved jobs closing soon</p>
            {closing.map(j => (
              <Link key={j.id} to="/jobs" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 hover:bg-amber-50">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink-900 truncate">{j.title}</span>
                  <span className="block text-xs text-ink-500 truncate">{j.company_or_org}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 shrink-0">
                  <Clock size={12} /> {j.application_deadline ? formatDate(j.application_deadline) : 'Soon'}
                </span>
              </Link>
            ))}
          </div>
        )}
        {closingSch.length > 0 && (
          <div className="space-y-2">
            <p className="eyebrow">Scholarships closing soon</p>
            {closingSch.map(x => (
              <Link key={x.id} to="/scholarships" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 hover:bg-amber-50">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink-900 truncate">{x.title}</span>
                  <span className="block text-xs text-ink-500 truncate">{x.provider}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 shrink-0">
                  <Clock size={12} /> {formatDate(x.deadline)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
