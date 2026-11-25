import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Award, ClipboardList, MessageSquare } from 'lucide-react'
import apiClient from '@/api/client'
import { cn, formatDate } from '@/utils'
import ScholarshipApplicationCard from '../components/ScholarshipApplicationCard'
import { SCHOLARSHIP_STATUS, type ScholarshipApplication } from '../scholarshipApps'

export interface MyApplication {
  id: number
  kind: 'job' | 'scholarship'
  object_id: number
  title: string
  status: 'submitted' | 'under_review' | 'for_compliance' | 'approved' | 'rejected' | 'revoked' | 'withdrawn'
  submitted_at: string
  admin_note?: string
  reviewed_at?: string | null
  scholarship_app?: ScholarshipApplication  // set for applications made with the full scholarship form
}

export const APPLICATION_STATUS: Record<MyApplication['status'], { label: string; cls: string; hint: string }> = {
  submitted:    { label: 'Submitted',    cls: 'bg-ink-100 text-ink-700',         hint: 'Received. A LYDO staff member will review it.' },
  under_review: { label: 'Under review', cls: 'bg-amber-100 text-amber-800',     hint: 'Your application is being reviewed.' },
  approved:     { label: 'Approved',     cls: 'bg-emerald-100 text-emerald-800', hint: 'Congratulations! Check the note below for next steps.' },
  rejected:     { label: 'Not accepted', cls: 'bg-red-100 text-red-700',         hint: 'This application was not accepted this time.' },
  for_compliance: { label: SCHOLARSHIP_STATUS.for_compliance.label, cls: SCHOLARSHIP_STATUS.for_compliance.cls, hint: SCHOLARSHIP_STATUS.for_compliance.hint },
  revoked:      { label: 'Approval revoked', cls: 'bg-orange-100 text-orange-800', hint: 'LYDO took back the approval. The reason is shown below.' },
  withdrawn:    { label: 'Withdrawn',    cls: 'bg-ink-100 text-ink-500',         hint: 'You withdrew this application.' },
}

const STEPS: MyApplication['status'][] = ['submitted', 'under_review']

export function useMyApplications() {
  return useQuery<MyApplication[]>({
    queryKey: ['my-applications'],
    queryFn: async () => {
      const list = (r: { data: any }) => (Array.isArray(r.data) ? r.data : r.data.results ?? [])
      const [legacy, full] = await Promise.all([apiClient.get('/applications/'), apiClient.get('/applications/scholarship/')])
      const mapped: MyApplication[] = list(full).map((a: ScholarshipApplication) => ({
        id: -a.id, kind: 'scholarship' as const, object_id: a.scholarship, title: a.scholarship_title, status: a.status,
        submitted_at: a.submitted_at, admin_note: a.admin_remarks, reviewed_at: a.reviewed_at, scholarship_app: a,
      }))
      return [...mapped, ...list(legacy)].sort((x, y) => +new Date(y.submitted_at) - +new Date(x.submitted_at))
    },
  })
}

function Progress({ status }: { status: MyApplication['status'] }) {
  const done = status === 'approved' || status === 'rejected' || status === 'revoked'
  const idx = done ? 2 : STEPS.indexOf(status)
  const labels = ['Submitted', 'Under review', status === 'rejected' ? 'Not accepted' : status === 'revoked' ? 'Approval revoked' : 'Decision']
  return (
    <ol className="flex items-center gap-1.5 text-[11px] font-semibold" aria-label="Application progress">
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-1.5">
          <span
            className={cn(
              'px-2 py-0.5 rounded-full',
              i <= idx
                ? (i === 2 && (status === 'rejected' || status === 'revoked') ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-700')
                : 'bg-ink-50 text-ink-400',
            )}
          >
            {l}
          </span>
          {i < labels.length - 1 && <span className="text-ink-300">›</span>}
        </li>
      ))}
    </ol>
  )
}

export default function MyApplicationsPage() {
  const { data = [], isLoading, isError } = useMyApplications()
  const open = data.filter(a => ['submitted', 'under_review', 'for_compliance'].includes(a.status)).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">My Applications</h1>
        <p className="page-subtitle">Track the jobs and scholarships you applied to.{data.length > 0 && ` ${open} still waiting for a decision.`}</p>
      </div>

      {isLoading && <p className="text-sm text-ink-500">Loading...</p>}
      {isError && <p className="text-sm text-red-600">Could not load your applications. Please try again.</p>}

      {!isLoading && !isError && data.length === 0 && (
        <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center space-y-3">
          <ClipboardList className="mx-auto text-ink-300" size={36} />
          <p className="font-semibold text-ink-800">No applications yet.</p>
          <p className="text-sm text-ink-500">When you apply to a job or scholarship, you can follow its status here.</p>
          <div className="flex justify-center gap-2">
            <Link to="/jobs" className="btn-primary btn-sm">Browse jobs</Link>
            <Link to="/scholarships" className="btn-secondary btn-sm">Browse scholarships</Link>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {data.map(a => {
          if (a.scholarship_app) return <ScholarshipApplicationCard key={`s${a.id}`} app={a.scholarship_app} />
          const st = APPLICATION_STATUS[a.status]
          const Icon = a.kind === 'job' ? Briefcase : Award
          return (
            <article key={a.id} className="rounded-2xl border border-ink-100 bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary-50 text-primary-700 shrink-0">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-ink-900 break-words">{a.title}</h2>
                    <p className="text-xs text-ink-500">
                      {a.kind === 'job' ? 'Job' : 'Scholarship'} · Applied {formatDate(a.submitted_at)}
                    </p>
                  </div>
                </div>
                <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', st.cls)}>{st.label}</span>
              </div>
              <Progress status={a.status} />
              <p className="text-sm text-ink-600">{st.hint}</p>
              {a.admin_note && (
                <div className="rounded-xl bg-primary-50 border border-primary-100 p-3 text-sm text-ink-800 flex gap-2">
                  <MessageSquare size={15} className="mt-0.5 text-primary-600 shrink-0" />
                  <span className="whitespace-pre-wrap break-words"><strong>Note from LYDO:</strong> {a.admin_note}</span>
                </div>
              )}
              {a.status === 'rejected' && a.kind === 'job' && (
                <p className="text-xs text-ink-600">Maybe a requirement was sent wrongly. Open the job and choose <b>Fix and send again</b>.</p>
              )}
              <Link to={a.kind === 'job' ? '/jobs' : '/scholarships'} className="text-xs font-semibold text-primary-700 hover:text-primary-800">
                {a.status === 'rejected' && a.kind === 'job' ? 'Open the job and send again →' : 'View listing →'}
              </Link>
            </article>
          )
        })}
      </div>
    </div>
  )
}
