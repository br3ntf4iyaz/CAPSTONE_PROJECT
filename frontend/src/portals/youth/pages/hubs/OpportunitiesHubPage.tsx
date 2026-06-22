import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Briefcase, Award, School, ArrowRight, MapPin,
  Clock, Star, Building2, AlertCircle, TrendingUp,
  BookOpen, GraduationCap, DollarSign, Calendar,
} from 'lucide-react'
import apiClient from '@/api/client'
import { formatDate, cn, toArray } from '@/utils'
const ROLLING_DEADLINES = new Set(['Rolling', 'Per semester', 'Per batch', 'Rolling — anytime'])

function isDeadlinePassed(deadline: string): boolean {
  if (!deadline || ROLLING_DEADLINES.has(deadline)) return false
  return new Date(deadline).getTime() < Date.now()
}

function isDeadlineSoon(deadline: string): boolean {
  if (!deadline || ROLLING_DEADLINES.has(deadline)) return false
  const diff = new Date(deadline).getTime() - Date.now()
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Job {
  id: number
  title: string
  company_or_org: string
  location: string
  job_type: string
  job_type_display: string
  industry: string
  salary_range?: string
  application_deadline?: string
  is_featured: boolean
  deadline_status: 'open' | 'soon' | 'closed' | 'none'
}

interface School {
  id: number
  name: string
  school_type: string
  program_count: number
}

interface Scholarship {
  id: number
  title: string
  provider: string
  provider_type: string
  amount: string
  deadline: string
  category: string
  is_featured: boolean
}

const JOB_TYPE_COLORS: Record<string, string> = {
  full_time:  'bg-emerald-100 text-emerald-800',
  part_time:  'bg-blue-100 text-blue-800',
  contract:   'bg-amber-100 text-amber-800',
  internship: 'bg-purple-100 text-purple-800',
}

const INDUSTRY_ICONS: Record<string, string> = {
  government: '🏛️', private: '🏢', ngo: '🤝',
  education: '🎓', health: '🏥', tech: '💻', other: '📋',
}

const TYPE_COLORS: Record<string, string> = {
  government:       'bg-primary-100 text-primary-800',
  local_government: 'bg-green-100 text-green-800',
  private:          'bg-purple-100 text-purple-800',
}

const TYPE_LABELS: Record<string, string> = {
  government:       'Government',
  local_government: 'Local Gov.',
  private:          'Private',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OpportunitiesHubPage() {
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['opp-hub-jobs'],
    queryFn: () => apiClient.get('/jobs/?page_size=6').then(r => toArray<Job>(r.data)),
  })

  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['opp-hub-schools'],
    queryFn: () => apiClient.get('/schools/').then(r => toArray<School>(r.data)).catch(() => []),
  })

  const { data: scholarships = [] } = useQuery<Scholarship[]>({
    queryKey: ['opp-hub-scholarships'],
    queryFn: () => apiClient.get('/scholarships/').then(r => toArray<Scholarship>(r.data)).catch(() => []),
  })

  const openJobs      = jobs.filter(j => j.deadline_status !== 'closed')
  const closingSoonJobs = jobs.filter(j => j.deadline_status === 'soon')
  const featured      = openJobs.filter(j => j.is_featured).slice(0, 3)
  const recent        = openJobs.filter(j => !j.is_featured).slice(0, 3)
  const previewJobs   = featured.length > 0 ? featured : recent

  const closingSoonScholarships = scholarships.filter(s => isDeadlineSoon(s.deadline) && !isDeadlinePassed(s.deadline))
  const openScholarships        = scholarships.filter(s => !isDeadlinePassed(s.deadline))
  const previewScholarships     = scholarships.filter(s => s.is_featured && !isDeadlinePassed(s.deadline)).slice(0, 3)

  const hasJobAlert         = closingSoonJobs.length > 0
  const hasScholarshipAlert = closingSoonScholarships.length > 0

  return (
    <div className="space-y-10 pb-12">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-8 sm:p-10">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div aria-hidden className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-accent-400/20 blur-2xl pointer-events-none" />

        <div className="relative max-w-2xl">
          <p className="eyebrow-on-dark mb-3">Opportunities</p>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tighter2 leading-[1.05] mb-4">
            Doors that open here.
          </h1>
          <p className="text-primary-100 text-lg leading-relaxed mb-6">
            From your first job to your next degree — a single place to find what is open to Lucena youth right now.
          </p>
          {/* Live stats */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-white/80">
              <Briefcase size={14} className="text-accent-300" />
              <span className="font-bold text-white">{openJobs.length}</span> open jobs
            </span>
            <span className="flex items-center gap-1.5 text-white/80">
              <Award size={14} className="text-accent-300" />
              <span className="font-bold text-white">{openScholarships.length}</span> scholarships
            </span>
            {schools.length > 0 && (
              <span className="flex items-center gap-1.5 text-white/80">
                <School size={14} className="text-accent-300" />
                <span className="font-bold text-white">{schools.length}</span> schools
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Urgency alerts ──────────────────────────────────────────────── */}
      {(hasJobAlert || hasScholarshipAlert) && (
        <div className="space-y-3">
          {hasJobAlert && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">
                  {closingSoonJobs.length} job{closingSoonJobs.length !== 1 ? 's' : ''} closing within 7 days
                </p>
                <p className="text-xs text-amber-700 mt-0.5 line-clamp-1">
                  {closingSoonJobs.map(j => j.title).join(' · ')}
                </p>
              </div>
              <Link to="/jobs" className="btn-sm text-amber-700 bg-amber-100 hover:bg-amber-200 border-0 flex-shrink-0 font-semibold text-xs px-3 py-1.5 rounded-lg">
                View all
              </Link>
            </div>
          )}
          {hasScholarshipAlert && (
            <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-2xl">
              <AlertCircle size={18} className="text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-purple-800">
                  {closingSoonScholarships.length} scholarship{closingSoonScholarships.length !== 1 ? 's' : ''} closing within 30 days
                </p>
                <p className="text-xs text-purple-700 mt-0.5 line-clamp-1">
                  {closingSoonScholarships.map(s => s.title).join(' · ')}
                </p>
              </div>
              <Link to="/scholarships" className="btn-sm text-purple-700 bg-purple-100 hover:bg-purple-200 border-0 flex-shrink-0 font-semibold text-xs px-3 py-1.5 rounded-lg">
                View all
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Hub cards ───────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="section-title !mb-0">Explore by category</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <HubCard
            title="Jobs"
            description="Local listings from LYDO partners — government, private sector, and NGOs open to Lucena youth."
            icon={Briefcase}
            to="/jobs"
            accent="primary"
            badge={openJobs.length > 0 ? `${openJobs.length} open` : undefined}
            samples={['Full-time & part-time roles', 'Internships & OJT', 'Government & private sector']}
          />
          <HubCard
            title="Scholarships"
            description="City, provincial, and national grants — CHED, DOST, TESDA, Lucena City, and private providers."
            icon={Award}
            to="/scholarships"
            accent="accent"
            badge={openScholarships.length > 0 ? `${openScholarships.length} available` : undefined}
            samples={['CHED UniFAST · DOST-SEI', 'Lucena City scholarships', 'Private & NGO grants']}
          />
          <HubCard
            title="School Finder"
            description="Compare colleges, programs, and admission paths in Lucena and nearby cities."
            icon={School}
            to="/schools"
            accent="neutral"
            badge={schools.length > 0 ? `${schools.length} schools` : undefined}
            samples={['College & university programs', 'TESDA tech-voc courses', 'Admission requirements']}
          />
        </div>
      </section>

      {/* ── Job preview ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h2 className="section-title !mb-0 flex items-center gap-2">
              {featured.length > 0
                ? <><Star size={16} className="text-amber-500" fill="currentColor" /> Featured Positions</>
                : <><TrendingUp size={16} className="text-primary-700" /> Latest Openings</>}
            </h2>
            <p className="text-xs text-ink-500 mt-1">Click any listing to see full details and apply</p>
          </div>
          <Link to="/jobs" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1 flex-shrink-0">
            All jobs <ArrowRight size={12} />
          </Link>
        </div>

        {jobsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <div key={i} className="h-28 bg-ink-50 rounded-2xl animate-pulse" />)}
          </div>
        ) : previewJobs.length === 0 ? (
          <div className="text-center py-10 text-ink-400">
            <Briefcase size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No open positions right now — check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {previewJobs.map(job => <JobPreviewCard key={job.id} job={job} />)}
          </div>
        )}
      </section>

      {/* ── Scholarship preview ─────────────────────────────────────────── */}
      {previewScholarships.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <h2 className="section-title !mb-0 flex items-center gap-2">
                <Award size={16} className="text-primary-700" /> Featured Scholarships
              </h2>
              <p className="text-xs text-ink-500 mt-1">Tap to see requirements and apply</p>
            </div>
            <Link to="/scholarships" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1 flex-shrink-0">
              All scholarships <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {previewScholarships.map(s => <ScholarshipPreviewCard key={s.id} s={s} />)}
          </div>
        </section>
      )}

      {/* ── Quick tips ──────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TipCard
          icon={BookOpen}
          title="Prepare your resume"
          body="LYDO's library has resume templates and cover letter guides for fresh graduates and first-time applicants."
          to="/library"
          linkLabel="Browse resources"
        />
        <TipCard
          icon={GraduationCap}
          title="Need a scholarship?"
          body="Financial aid deadlines move fast. Bookmark the scholarships you're interested in so you don't miss them."
          to="/scholarships"
          linkLabel="See scholarships"
        />
        <TipCard
          icon={TrendingUp}
          title="Stay ahead"
          body="New jobs and opportunities are posted regularly. Check back often — listings update as LYDO receives them from partners."
          to="/jobs"
          linkLabel="View all jobs"
        />
      </section>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function HubCard({
  title, description, icon: Icon, to, accent = 'primary', badge, samples,
}: {
  title: string
  description: string
  icon: React.ElementType
  to: string
  accent?: 'primary' | 'accent' | 'neutral'
  badge?: string
  samples?: string[]
}) {
  const iconCls = {
    primary: 'bg-primary-600 text-white group-hover:bg-primary-700',
    accent:  'bg-accent-400 text-primary-900 group-hover:bg-accent-500',
    neutral: 'bg-ink-100 text-ink-700 group-hover:bg-primary-100 group-hover:text-primary-700',
  }[accent]

  return (
    <Link
      to={to}
      className="group bg-white rounded-3xl border border-ink-100 hover:border-primary-300 hover:shadow-lg hover:-translate-y-0.5 p-6 flex flex-col transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-5">
        <span className={cn('inline-flex items-center justify-center w-12 h-12 rounded-2xl transition-colors', iconCls)}>
          <Icon size={22} strokeWidth={2.2} />
        </span>
        {badge && (
          <span className="chip bg-primary-50 text-primary-700 text-[10px] font-bold uppercase tracking-wide border border-primary-200">
            {badge}
          </span>
        )}
      </div>
      <h3 className="font-display font-bold text-xl text-ink-900 leading-tight mb-2">{title}</h3>
      <p className="text-sm text-ink-600 leading-relaxed">{description}</p>
      {samples && (
        <ul className="mt-3 space-y-1.5">
          {samples.map(s => (
            <li key={s} className="flex items-start gap-2 text-xs text-ink-500">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-ink-300 flex-shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 group-hover:text-primary-800 group-hover:gap-2 transition-all">
        Open <ArrowRight size={14} />
      </div>
    </Link>
  )
}

function JobPreviewCard({ job }: { job: Job }) {
  const dl = job.deadline_status
  return (
    <Link
      to="/jobs"
      className={cn(
        'group bg-white rounded-2xl border p-4 flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:shadow-md',
        job.is_featured
          ? 'border-amber-200 bg-gradient-to-br from-amber-50/50 to-white hover:border-amber-300'
          : 'border-ink-100 hover:border-primary-300',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-ink-50 flex items-center justify-center text-base flex-shrink-0">
          {INDUSTRY_ICONS[job.industry] ?? '📋'}
        </div>
        <div className="flex-1 min-w-0">
          {job.is_featured && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-0.5 mb-0.5">
              <Star size={8} fill="currentColor" /> Featured
            </span>
          )}
          <p className="font-semibold text-sm text-ink-900 leading-snug line-clamp-2 group-hover:text-primary-700 transition-colors">
            {job.title}
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-ink-500 flex items-center gap-1">
          <Building2 size={10} className="flex-shrink-0" /> {job.company_or_org}
        </p>
        <p className="text-xs text-ink-400 flex items-center gap-1">
          <MapPin size={10} className="flex-shrink-0" /> {job.location}
        </p>
      </div>
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-ink-50">
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', JOB_TYPE_COLORS[job.job_type] ?? 'bg-gray-100 text-gray-700')}>
          {job.job_type_display}
        </span>
        {job.application_deadline && (
          <span className={cn('text-[10px] flex items-center gap-0.5', dl === 'soon' ? 'text-amber-600 font-semibold' : 'text-ink-400')}>
            <Clock size={9} />
            {dl === 'soon' ? 'Closing soon' : `Due ${formatDate(job.application_deadline)}`}
          </span>
        )}
      </div>
    </Link>
  )
}

function ScholarshipPreviewCard({ s }: { s: Scholarship }) {
  const soon   = isDeadlineSoon(s.deadline)
  const passed = isDeadlinePassed(s.deadline)

  return (
    <Link
      to="/scholarships"
      className={cn(
        'group bg-white rounded-2xl border p-4 flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:shadow-md',
        soon ? 'border-amber-200 bg-amber-50/20 hover:border-amber-300' : 'border-ink-100 hover:border-primary-300',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          <Award size={16} className="text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          {s.is_featured && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-0.5 mb-0.5">
              <Star size={8} fill="currentColor" /> Featured
            </span>
          )}
          <p className="font-semibold text-sm text-ink-900 leading-snug line-clamp-2 group-hover:text-primary-700 transition-colors">
            {s.title}
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-ink-500 line-clamp-1">{s.provider}</p>
        <p className="text-xs text-green-700 flex items-center gap-1 font-medium">
          <DollarSign size={10} /> {s.amount}
        </p>
      </div>
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-ink-50">
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', TYPE_COLORS[s.provider_type] ?? 'bg-gray-100 text-gray-700')}>
          {TYPE_LABELS[s.provider_type] ?? s.provider_type}
        </span>
        <span className={cn('text-[10px] flex items-center gap-0.5', soon ? 'text-amber-600 font-semibold' : 'text-ink-400')}>
          <Calendar size={9} />
          {soon ? 'Closing soon' : passed ? 'Closed' : s.deadline ? `Due ${s.deadline}` : 'Rolling'}
        </span>
      </div>
    </Link>
  )
}

function TipCard({
  icon: Icon, title, body, to, linkLabel,
}: {
  icon: React.ElementType
  title: string
  body: string
  to: string
  linkLabel: string
}) {
  return (
    <div className="bg-ink-50/60 rounded-2xl border border-ink-100 p-5 flex flex-col gap-3">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-ink-100 text-primary-700">
        <Icon size={16} />
      </span>
      <div>
        <p className="font-semibold text-sm text-ink-900 mb-1">{title}</p>
        <p className="text-xs text-ink-500 leading-relaxed">{body}</p>
      </div>
      <Link to={to} className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1 mt-auto">
        {linkLabel} <ArrowRight size={11} />
      </Link>
    </div>
  )
}
