import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Plus,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trophy,
  Edit3,
  Search,
} from 'lucide-react'
import { submissionsApi, type Submission, type SubmissionStatus } from '@/api/submissions'
import PersonalCalendarWidget from '@/components/ui/PersonalCalendarWidget'
import { formatDate, cn } from '@/utils'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { QueryError } from '@/components/ui/QueryError'

const STATUS_COLORS: Record<string, string> = {
  draft: 'badge-gray',
  pending: 'badge-yellow',
  revision_requested: 'bg-orange-100 text-orange-700',
  approved: 'badge-green',
  completed: 'bg-emerald-100 text-emerald-700',
  rejected: 'badge-red',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  draft: <Edit3 size={14} className="text-gray-400" />,
  pending: <Clock size={14} className="text-yellow-500" />,
  revision_requested: <AlertCircle size={14} className="text-orange-500" />,
  approved: <CheckCircle2 size={14} className="text-green-500" />,
  completed: <Trophy size={14} className="text-emerald-500" />,
  rejected: <XCircle size={14} className="text-red-500" />,
}

// Simplified status flow for accomplishment reports (work is already done before submitting)
const REVIEW_STEPS = ['Submitted', 'Under Review', 'Acknowledged']

type TabFilter = 'all' | SubmissionStatus

const TABS: { key: TabFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'pending', label: 'Pending Review' },
  { key: 'revision_requested', label: 'Revision Needed' },
  { key: 'approved', label: 'Acknowledged' },
  { key: 'rejected', label: 'Rejected' },
]

function ReviewStatusBar({ status }: { status: string }) {
  const stepIdx =
    status === 'draft'
      ? -1
      : status === 'pending' || status === 'revision_requested'
      ? 0
      : status === 'approved' || status === 'completed'
      ? 2
      : status === 'rejected'
      ? 0
      : 0

  const isRejected = status === 'rejected'
  const isDraft = status === 'draft'

  if (isDraft) return null

  return (
    <div className="mt-3">
      <div className="flex items-center gap-0">
        {REVIEW_STEPS.map((label, idx) => {
          const isCompleted = idx < stepIdx
          const isCurrent = idx === stepIdx
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div
                className={cn(
                  'w-3 h-3 rounded-full flex-shrink-0 border-2 transition-all',
                  isRejected && isCurrent
                    ? 'border-red-500 bg-red-500'
                    : isCompleted
                    ? 'border-primary-600 bg-primary-600'
                    : isCurrent
                    ? 'border-primary-600 bg-white'
                    : 'border-gray-200 bg-gray-200',
                )}
              />
              {idx < REVIEW_STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 transition-all',
                    isCompleted ? 'bg-primary-600' : 'bg-gray-200',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1">
        {REVIEW_STEPS.map(label => (
          <span key={label} className="text-[9px] text-ink-400 leading-none">
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function SubmissionCard({ submission }: { submission: Submission }) {
  const navigate = useNavigate()
  const iconNode = STATUS_ICON[submission.status] ?? <FileText size={14} className="text-gray-400" />
  const colorClass = STATUS_COLORS[submission.status] ?? 'badge-gray'
  const hasRevisionNotes = submission.status === 'revision_requested' && submission.revision_notes

  return (
    <div
      className={cn(
        'card p-5 hover:shadow-md transition-shadow border hover:border-primary-100',
        hasRevisionNotes ? 'border-orange-200 bg-orange-50/30' : 'border-transparent',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
            {iconNode}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-ink-900 truncate">{submission.title}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={cn('badge text-[10px]', colorClass)}>
                {submission.status_display}
              </span>
              {submission.category_display && (
                <span className="badge badge-gray text-[10px]">{submission.category_display}</span>
              )}
              <span className="badge badge-gray text-[10px]">
                {submission.submitter_type === 'sk' ? 'SK' : 'Youth Org'}
              </span>
              <span className="text-[10px] text-ink-400">Submitted {formatDate(submission.submitted_at)}</span>
              {submission.updated_at !== submission.submitted_at && (
                <span className="text-[10px] text-ink-400">· Updated {formatDate(submission.updated_at)}</span>
              )}
            </div>
            {hasRevisionNotes && (
              <p className="mt-2 text-xs text-orange-700 line-clamp-2 leading-snug">
                <span className="font-semibold">Revision needed:</span> {submission.revision_notes}
              </p>
            )}
            <ReviewStatusBar status={submission.status} />
          </div>
        </div>
        <button
          onClick={() => navigate(`/submissions/${submission.id}`)}
          className="flex-shrink-0 btn-secondary btn-sm text-xs flex items-center gap-1"
        >
          View <ChevronRight size={12} />
        </button>
      </div>
    </div>
  )
}

const CATEGORY_OPTS = [
  { value: '', label: 'All Categories' },
  { value: 'social_inclusion', label: 'Social Inclusion' },
  { value: 'health', label: 'Health' },
  { value: 'active_citizenship', label: 'Active Citizenship' },
  { value: 'peace_building', label: 'Peace Building' },
  { value: 'education', label: 'Education' },
  { value: 'environment', label: 'Environment' },
  { value: 'governance', label: 'Governance' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'global_mobility', label: 'Global Mobility' },
  { value: 'economic', label: 'Economic' },
]

export default function SubmissionsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const { data: submissions = [], isLoading, isError, refetch } = useQuery<Submission[]>({
    queryKey: ['my-submissions'],
    queryFn: () => submissionsApi.list(),
  })

  const filtered = submissions
    .filter(s => activeTab === 'all' || s.status === activeTab)
    .filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()))
    .filter(s => !categoryFilter || (s as any).category === categoryFilter)

  if (isLoading) return <ListSkeleton />
  if (isError) return <QueryError onRetry={() => refetch()} />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Accomplishment Reports</h1>
          <p className="page-subtitle">Submit and track completed activities and programs for review</p>
        </div>
        <button
          onClick={() => navigate('/submissions/new')}
          className="btn-primary btn-sm flex-shrink-0 flex items-center gap-1.5"
        >
          <Plus size={15} />
          New Report
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left: Submissions ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Search + category filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                placeholder="Search reports…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-8 py-2 text-sm"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="input py-2 text-sm sm:w-48"
            >
              {CATEGORY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  activeTab === tab.key
                    ? 'bg-primary-600 text-white'
                    : 'bg-paper-100 text-ink-600 hover:bg-paper-200',
                )}
              >
                {tab.label}
                {tab.key !== 'all' && (
                  <span className="ml-1 opacity-70">
                    ({submissions.filter(s => s.status === tab.key).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Submissions list */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="card p-12 text-center text-ink-400">
                <FileText size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium text-ink-600">
                  {activeTab === 'all' ? 'No reports submitted yet' : `No ${activeTab.replace('_', ' ')} reports`}
                </p>
                <p className="text-sm mt-1">
                  {activeTab === 'all'
                    ? 'Click "New Report" to submit an accomplishment report'
                    : 'Try a different filter tab'}
                </p>
              </div>
            ) : (
              filtered.map(s => <SubmissionCard key={s.id} submission={s} />)
            )}
          </div>
        </div>

        {/* ── Right: Calendar widget ───────────────────────────────── */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <PersonalCalendarWidget />
        </div>
      </div>
    </div>
  )
}
