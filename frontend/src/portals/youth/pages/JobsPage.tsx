import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Briefcase, MapPin, Clock, DollarSign, Search,
  Star, ExternalLink, X, Calendar, ChevronRight,
  Building2, Filter, Bookmark, BookmarkCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { formatDate, cn, toArray } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { QueryError } from '@/components/ui/QueryError'
import { EmptyState } from '@/components/ui/EmptyState'

interface Job {
  id: number
  title: string
  company_or_org: string
  location: string
  job_type: string
  job_type_display: string
  industry: string
  industry_display: string
  description?: string
  requirements?: string
  salary_range?: string
  application_deadline?: string
  application_link?: string
  contact_email?: string
  is_featured: boolean
  is_saved: boolean
  deadline_status: 'open' | 'soon' | 'closed' | 'none'
  created_at: string
}

const JOB_TYPE_CHIPS = [
  { value: '', label: 'All' },
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: '__saved__', label: '🔖 Saved' },
]

const INDUSTRIES = [
  { value: '', label: 'All Industries' },
  { value: 'government', label: 'Government' },
  { value: 'private', label: 'Private Sector' },
  { value: 'ngo', label: 'NGO/Non-Profit' },
  { value: 'education', label: 'Education' },
  { value: 'health', label: 'Health' },
  { value: 'tech', label: 'Technology' },
  { value: 'other', label: 'Other' },
]

const JOB_TYPE_COLORS: Record<string, string> = {
  full_time:  'bg-emerald-100 text-emerald-800',
  part_time:  'bg-blue-100 text-blue-800',
  contract:   'bg-amber-100 text-amber-800',
  internship: 'bg-purple-100 text-purple-800',
}

const INDUSTRY_ICONS: Record<string, string> = {
  government: '🏛️',
  private:    '🏢',
  ngo:        '🤝',
  education:  '🎓',
  health:     '🏥',
  tech:       '💻',
  other:      '📋',
}

// Prefer backend deadline_status; fall back to client-side computation when not available
function getDeadlineStatus(job: Pick<Job, 'deadline_status' | 'application_deadline'>): 'open' | 'soon' | 'closed' | 'none' {
  if (job.deadline_status) return job.deadline_status
  if (!job.application_deadline) return 'none'
  const ms = new Date(job.application_deadline).getTime() - Date.now()
  if (ms < 0) return 'closed'
  if (ms < 7 * 86_400_000) return 'soon'
  return 'open'
}

// ─── Bookmark button ─────────────────────────────────────────────────────────

function BookmarkButton({ job, size = 16 }: { job: Job; size?: number }) {
  const qc = useQueryClient()
  const toggle = useMutation({
    mutationFn: () => apiClient.post(`/jobs/${job.id}/save-toggle/`),
    onSuccess: (res) => {
      const saved: boolean = res.data.saved
      toast.success(saved ? 'Job saved!' : 'Removed from saved.')
      qc.invalidateQueries({ queryKey: ['youth-jobs'] })
      qc.invalidateQueries({ queryKey: ['youth-saved-jobs'] })
    },
    onError: () => toast.error('Could not save job. Please log in.'),
  })
  return (
    <button
      onClick={e => { e.stopPropagation(); toggle.mutate() }}
      disabled={toggle.isPending}
      title={job.is_saved ? 'Remove from saved' : 'Save for later'}
      className={cn(
        'p-1.5 rounded-lg transition-all duration-150',
        job.is_saved
          ? 'text-primary bg-primary/10 hover:bg-primary/20'
          : 'text-ink-400 hover:text-primary hover:bg-ink-100',
      )}
    >
      {job.is_saved
        ? <BookmarkCheck size={size} />
        : <Bookmark size={size} />}
    </button>
  )
}

// ─── Detail Drawer ──────────────────────────────────────────────────────────

function JobDetailDrawer({ job, onClose }: { job: Job; onClose: () => void }) {
  const { data: detail } = useQuery<Job>({
    queryKey: ['job-detail', job.id],
    queryFn: () => apiClient.get(`/jobs/${job.id}/`).then(r => r.data),
  })

  const j = detail ?? job
  const dl = getDeadlineStatus(j)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:rounded-2xl sm:max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl text-ink-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-ink-100 px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {j.is_featured && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <Star size={9} fill="currentColor" /> Featured
                </span>
              )}
              <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', JOB_TYPE_COLORS[j.job_type] ?? 'bg-ink-100 text-ink-700')}>
                {j.job_type_display}
              </span>
            </div>
            <h2 className="text-lg font-bold text-ink-900 leading-snug">{j.title}</h2>
            <p className="text-sm text-ink-500 mt-0.5 flex items-center gap-1.5">
              <span>{INDUSTRY_ICONS[j.industry] ?? '📋'}</span>
              {j.company_or_org} · {j.industry_display}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <BookmarkButton job={j} size={18} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Meta pills */}
        <div className="px-6 pt-4 pb-3 flex flex-wrap gap-2 border-b border-ink-100">
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-600 bg-ink-50 px-3 py-1.5 rounded-full border border-ink-200">
            <MapPin size={11} className="text-ink-400" /> {j.location}
          </span>
          {j.salary_range && (
            <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
              <DollarSign size={11} /> {j.salary_range}
            </span>
          )}
          {j.application_deadline && (
            <span className={cn(
              'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border',
              dl === 'closed' ? 'text-red-700 bg-red-50 border-red-200' :
              dl === 'soon'   ? 'text-amber-700 bg-amber-50 border-amber-200' :
                                'text-ink-600 bg-ink-50 border-ink-200'
            )}>
              <Calendar size={11} />
              {dl === 'closed' ? 'Closed' : dl === 'soon' ? 'Closing soon' : 'Deadline'}: {formatDate(j.application_deadline)}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {j.description && (
            <div>
              <h3 className="text-sm font-semibold text-ink-800 mb-2">About this role</h3>
              <p className="text-sm text-ink-600 leading-relaxed whitespace-pre-line">{j.description}</p>
            </div>
          )}
          {j.requirements && (
            <div>
              <h3 className="text-sm font-semibold text-ink-800 mb-2">Requirements</h3>
              <p className="text-sm text-ink-600 leading-relaxed whitespace-pre-line">{j.requirements}</p>
            </div>
          )}
          {j.contact_email && (
            <div className="text-sm text-ink-600">
              <span className="font-medium">Contact: </span>
              <a href={`mailto:${j.contact_email}`} className="text-primary hover:underline">{j.contact_email}</a>
            </div>
          )}
          <div className="text-sm text-ink-500 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            For inquiries and application assistance, please contact the Public Employment Service Office (PESO).
          </div>
        </div>

        {/* CTA */}
        <div className="sticky bottom-0 bg-white border-t border-ink-100 px-6 py-4">
          {dl === 'closed' ? (
            <p className="text-sm text-center text-ink-400 py-1">This position is no longer accepting applications.</p>
          ) : j.application_link ? (
            <a href={j.application_link} target="_blank" rel="noopener noreferrer"
              className="btn-primary w-full flex items-center justify-center gap-2">
              Apply Now <ExternalLink size={14} />
            </a>
          ) : j.contact_email ? (
            <a href={`mailto:${j.contact_email}?subject=Application for ${encodeURIComponent(j.title)}`}
              className="btn-primary w-full flex items-center justify-center gap-2">
              Apply via Email <ExternalLink size={14} />
            </a>
          ) : (
            <p className="text-sm text-center text-ink-400 py-1">
              Contact <span className="font-medium">{j.company_or_org}</span> directly to apply.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Job Card ────────────────────────────────────────────────────────────────

function JobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  const dl = getDeadlineStatus(job)

  return (
    <div
      className={cn(
        'bg-white rounded-xl border transition-all duration-200 p-4 group relative',
        dl === 'closed'
          ? 'border-ink-200 opacity-55'
          : job.is_featured
          ? 'border-amber-200 bg-gradient-to-r from-amber-50/60 to-white hover:border-amber-300 hover:shadow-md hover:shadow-amber-50'
          : 'border-ink-200 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'
      )}
    >
    <button
      onClick={onClick}
      className="w-full text-left"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-ink-100 flex items-center justify-center text-lg">
          {INDUSTRY_ICONS[job.industry] ?? '📋'}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                {job.is_featured && dl !== 'closed' && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-0.5">
                    <Star size={8} fill="currentColor" /> Featured
                  </span>
                )}
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', JOB_TYPE_COLORS[job.job_type] ?? 'bg-ink-100 text-ink-700')}>
                  {job.job_type_display}
                </span>
              </div>
              <h3 className="font-semibold text-ink-900 text-sm leading-snug group-hover:text-primary transition-colors line-clamp-1">
                {job.title}
              </h3>
            </div>
            <ChevronRight size={15} className="text-ink-300 group-hover:text-primary/50 flex-shrink-0 mt-0.5 transition-colors" />
          </div>

          {/* Company */}
          <p className="text-xs text-ink-500 mb-2 flex items-center gap-1">
            <Building2 size={10} className="flex-shrink-0" /> {job.company_or_org}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-400">
            <span className="flex items-center gap-1">
              <MapPin size={10} /> {job.location}
            </span>
            {job.salary_range && (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <DollarSign size={10} /> {job.salary_range}
              </span>
            )}
            {job.application_deadline && (
              <span className={cn(
                'flex items-center gap-1',
                dl === 'closed' ? 'text-red-400' :
                dl === 'soon'   ? 'text-amber-500 font-medium' : ''
              )}>
                <Clock size={10} />
                {dl === 'closed' ? 'Closed'
                  : dl === 'soon' ? `Closes ${formatDate(job.application_deadline)}`
                  : `Due ${formatDate(job.application_deadline)}`}
              </span>
            )}
            {dl === 'soon' && (
              <span className="flex items-center gap-1 text-amber-600 font-semibold animate-pulse">
                ⚠ Closing Soon
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
    {/* Bookmark — outside the click-through button to avoid event bubbling issues */}
    <div className="absolute top-3 right-3">
      <BookmarkButton job={job} size={14} />
    </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [jobType, setJobType] = useState('')
  const [industry, setIndustry] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<Job | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const showSaved = jobType === '__saved__'

  // All / filtered jobs — search sent to backend, other filters local
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['youth-jobs', jobType, industry, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams()
      if (jobType && !showSaved) params.set('job_type', jobType)
      if (industry) params.set('industry', industry)
      if (debouncedSearch) params.set('search', debouncedSearch)
      return apiClient.get(`/jobs/?${params.toString()}`).then(r => toArray<Job>(r.data))
    },
    enabled: !showSaved,
  })

  // Saved jobs
  const { data: savedData, isLoading: savedLoading } = useQuery({
    queryKey: ['youth-saved-jobs'],
    queryFn: () => apiClient.get('/jobs/saved/').then(r => toArray<Job>(r.data)),
    enabled: showSaved,
  })

  const jobs = showSaved ? (savedData ?? []) : (data ?? [])
  const isLoading_ = showSaved ? savedLoading : isLoading

  // Saved jobs are client-side filtered; all others are pre-filtered by backend
  const filtered = showSaved && search
    ? jobs.filter(j =>
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.company_or_org.toLowerCase().includes(search.toLowerCase()) ||
        j.location.toLowerCase().includes(search.toLowerCase())
      )
    : jobs

  const featured   = filtered.filter(j => j.is_featured && getDeadlineStatus(j) !== 'closed')
  const open       = filtered.filter(j => !j.is_featured && getDeadlineStatus(j) !== 'closed')
  const closed     = filtered.filter(j => getDeadlineStatus(j) === 'closed')
  const hasFilters = !!(jobType || industry)

  // Type counts for chips
  const typeCounts: Record<string, number> = {}
  jobs.forEach(j => { typeCounts[j.job_type] = (typeCounts[j.job_type] ?? 0) + 1 })

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Briefcase size={22} className="text-primary" /> Jobs &amp; Opportunities
        </h1>
        <p className="page-subtitle">
          Local listings from LYDO partners &mdash; open to Lucena City youth
          {!isLoading_ && jobs.length > 0 && (
            <span className="ml-1 text-primary font-medium">· {jobs.length} open</span>
          )}
        </p>
      </div>

      {/* Type chips */}
      <div className="flex flex-wrap gap-2">
        {JOB_TYPE_CHIPS.map(t => (
          <button
            key={t.value}
            onClick={() => setJobType(t.value)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border font-medium transition-all duration-150',
              jobType === t.value
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white text-ink-600 border-ink-200 hover:border-primary/40 hover:text-primary'
            )}
          >
            {t.label}
            {t.value && typeCounts[t.value] ? (
              <span className={cn('ml-1.5', jobType === t.value ? 'opacity-70' : 'opacity-50')}>
                ({typeCounts[t.value]})
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Search + industry filter */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              className="input pl-9 w-full"
              placeholder="Search jobs, companies, locations…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn('btn-secondary btn-sm gap-1.5 flex-shrink-0', showFilters && 'bg-primary/5 text-primary border-primary/30')}
          >
            <Filter size={13} /> Industry
            {industry && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 bg-ink-50 rounded-xl border border-ink-200">
            {INDUSTRIES.map(ind => (
              <button
                key={ind.value}
                onClick={() => setIndustry(ind.value === industry ? '' : ind.value)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full border transition-all duration-150 font-medium',
                  industry === ind.value
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-ink-600 border-ink-200 hover:border-primary/30 hover:text-primary'
                )}
              >
                {ind.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={() => { setJobType(''); setIndustry('') }}
          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 -mt-2"
        >
          <X size={11} /> Clear filters
        </button>
      )}

      {/* Results */}
      {isLoading_ ? (
        <PageSpinner />
      ) : isError && !showSaved ? (
        <QueryError onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs found"
          description={search || hasFilters ? 'Try adjusting your search or filters.' : 'Check back soon for new listings.'}
          className="py-16"
        />
      ) : (
        <div className="space-y-6">
          {/* Featured */}
          {featured.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600 flex items-center gap-1.5">
                <Star size={10} fill="currentColor" /> Featured
              </p>
              <div className="space-y-2">
                {featured.map(j => <JobCard key={j.id} job={j} onClick={() => setSelected(j)} />)}
              </div>
            </section>
          )}

          {/* Open */}
          {open.length > 0 && (
            <section className="space-y-2">
              {featured.length > 0 && (
                <p className="text-xs font-bold uppercase tracking-widest text-ink-400">All Open Positions</p>
              )}
              <div className="space-y-2">
                {open.map(j => <JobCard key={j.id} job={j} onClick={() => setSelected(j)} />)}
              </div>
            </section>
          )}

          {/* Closed */}
          {closed.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold text-ink-400 hover:text-ink-600 select-none list-none flex items-center gap-1.5 py-1">
                <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                {closed.length} closed position{closed.length !== 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-2">
                {closed.map(j => <JobCard key={j.id} job={j} onClick={() => setSelected(j)} />)}
              </div>
            </details>
          )}

          <p className="text-xs text-center text-ink-400 pt-1">
            {filtered.length} listing{filtered.length !== 1 ? 's' : ''}
            {(jobType || industry || search) ? ' matching your filters' : ' total'}
          </p>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <JobDetailDrawer job={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
