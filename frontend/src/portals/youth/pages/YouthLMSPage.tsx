import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen, Clock, Users, ArrowRight, CheckCircle2, PlayCircle,
  Award, Sparkles, AlertCircle, RefreshCw, Search, Layers, ScrollText, RotateCcw,
} from 'lucide-react'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import EnrollModal from '../components/EnrollModal'
import {
  AUDIENCES, AUDIENCE_STYLE, CATEGORY_LABELS, LEARNING_STATUS, toArray,
  type Audience, type CourseMini, type Enrollment,
} from '../lms'

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS)

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function YouthLMSPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [audience, setAudience] = useState<Audience | null>(null)
  const [enrollTarget, setEnrollTarget] = useState<CourseMini | null>(null)

  const enrollmentsQ = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () =>
      apiClient.get('/courses/enrollments/').then(r => toArray<Enrollment>(r.data)).catch(() => []),
  })

  const coursesQ = useQuery({
    queryKey: ['courses-catalog', category, audience, search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      if (audience) params.set('audience', audience)
      if (search.trim()) params.set('search', search.trim())
      return apiClient.get(`/courses/?${params.toString()}`).then(r => toArray<CourseMini>(r.data)).catch(() => [])
    },
  })

  const enrollments = enrollmentsQ.data ?? []
  const courses = coursesQ.data ?? []

  const enrolledCourseIds = useMemo(
    () => new Set(enrollments.map(e => e.course.id)),
    [enrollments],
  )

  const ongoing = enrollments.filter(e => e.status !== 'completed')
  const completed = enrollments.filter(e => e.status === 'completed')

  return (
    <div className="space-y-8">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-8 sm:p-10">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div aria-hidden className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-accent-400/20 blur-2xl" />
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
          <div>
            <p className="eyebrow-on-dark mb-3">Learn · Courses</p>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tighter2 leading-[1.05] mb-3">
              Your courses, your pace.
            </h1>
            <p className="text-primary-100 text-lg max-w-xl leading-relaxed">
              Self-paced learning built for Lucena youth. Earn certificates and badges as you progress.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link to="/badges" className="btn-on-dark text-sm">
              <Award size={16} /> My badges
            </Link>
            <Link to="/certificates" className="btn-ghost-on-dark text-sm">
              Certificates
            </Link>
          </div>
        </div>
      </header>

      {/* ── My learning ─────────────────────────────────────────────── */}
      <section>
        <header className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-accent-100 text-accent-800">
              <Sparkles size={18} />
            </span>
            <h2 className="section-title !mb-0">My learning</h2>
          </div>
          <span className="text-xs font-semibold text-ink-500">
            {ongoing.length} ongoing · {completed.length} completed
          </span>
        </header>

        {enrollmentsQ.isError ? (
          <ErrorBlock onRetry={() => enrollmentsQ.refetch()}>
            Couldn't load your enrollments.
          </ErrorBlock>
        ) : enrollments.length === 0 ? (
          <div className="bg-white rounded-3xl border border-ink-100 p-8 text-center">
            <p className="font-display font-bold text-lg text-ink-900 mb-1">No courses yet.</p>
            <p className="text-sm text-ink-600">Browse the catalog below and enroll in your first course.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrollments.map(en => <EnrollmentCard key={en.id} enrollment={en} />)}
          </div>
        )}
      </section>

      {/* ── Catalog ─────────────────────────────────────────────────── */}
      <section>
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary-600 text-white">
              <BookOpen size={18} />
            </span>
            <h2 className="section-title !mb-0">Course catalog</h2>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search courses…"
              className="input pl-10 py-2.5 text-sm"
            />
          </div>
        </header>

        {/* Audience filter: it only filters the list. Everyone can still enroll in any course. */}
        <div className="mb-3" role="group" aria-label="Filter by audience">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">Who is it for?</p>
          <div className="flex flex-wrap gap-2">
            {[{ value: null, label: 'All Courses' }, ...AUDIENCES.map(a => ({ value: a.value as Audience | null, label: a.label }))].map(a => (
              <button
                key={a.label}
                type="button"
                aria-pressed={audience === a.value}
                onClick={() => setAudience(a.value)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border',
                  audience === a.value
                    ? 'bg-primary-700 text-white border-primary-700'
                    : 'bg-white border-ink-200 text-ink-700 hover:border-primary-300 hover:text-primary-700',
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors',
              category === null
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-ink-200 text-ink-700 hover:border-primary-300 hover:text-primary-700',
            )}
          >
            All
          </button>
          {ALL_CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors',
                category === c
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-ink-200 text-ink-700 hover:border-primary-300 hover:text-primary-700',
              )}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {coursesQ.isError ? (
          <ErrorBlock onRetry={() => coursesQ.refetch()}>
            Couldn't load courses.
          </ErrorBlock>
        ) : coursesQ.isLoading ? (
          <SkeletonGrid />
        ) : courses.length === 0 ? (
          <div className="bg-white rounded-3xl border border-ink-100 p-8 text-center">
            <p className="font-display font-bold text-lg text-ink-900 mb-1">
              {search.trim() || category || audience ? 'No matches.' : 'Catalog empty.'}
            </p>
            <p className="text-sm text-ink-600">
              {search.trim() || category || audience
                ? 'Try a different keyword, category or audience.'
                : 'New courses are published regularly. Check back soon.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                isEnrolled={enrolledCourseIds.has(course.id)}
                onEnroll={() => setEnrollTarget(course)}
              />
            ))}
          </div>
        )}
      </section>

      {enrollTarget && (
        <EnrollModal courseId={enrollTarget.id} courseTitle={enrollTarget.title} onClose={() => setEnrollTarget(null)} />
      )}
    </div>
  )
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function EnrollmentCard({ enrollment }: { enrollment: Enrollment }) {
  const isComplete = enrollment.learning_status === 'completed'
  const st = LEARNING_STATUS[enrollment.learning_status]
  const course = enrollment.course
  const continueTo = enrollment.current_lesson_id
    ? `/lms/${course.id}/lesson/${enrollment.current_lesson_id}`
    : `/lms/${course.id}`
  return (
    <article className="bg-white rounded-2xl border border-ink-100 overflow-hidden hover:border-primary-300 hover:shadow-lg transition-all flex flex-col">
      <Link to={`/lms/${course.id}`} className="block relative aspect-[16/9] bg-primary-50">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
            <BookOpen size={36} className="text-primary-400" />
          </div>
        )}
        <span className={cn('absolute top-3 left-3 chip text-[11px]', isComplete ? 'bg-emerald-500 text-white' : st.cls)}>
          {isComplete && <CheckCircle2 size={11} className="mr-1" />} {st.label}
        </span>
      </Link>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className="chip-primary text-[10px]">{CATEGORY_LABELS[course.category] ?? course.category}</span>
          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', AUDIENCE_STYLE[course.audience])}>
            {course.audience_display}
          </span>
        </div>
        <h3 className="font-display font-bold text-base text-ink-900 leading-tight line-clamp-2 mb-1">{course.title}</h3>
        {course.description && (
          <p className="text-xs text-ink-500 leading-relaxed line-clamp-2 mb-3">{course.description.replace(/<[^>]+>/g, '')}</p>
        )}
        <div className="space-y-2 mt-auto">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-500 font-semibold">{enrollment.completed_lessons} of {enrollment.total_lessons} lessons</span>
            <span className="text-ink-900 font-bold tabular-nums">{enrollment.progress_percent}%</span>
          </div>
          <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={enrollment.progress_percent} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn('h-full rounded-full transition-all', isComplete ? 'bg-emerald-500' : 'bg-primary-600')} style={{ width: `${enrollment.progress_percent}%` }} />
          </div>
          {!isComplete && enrollment.current_lesson_title && (
            <p className="text-[11px] text-ink-500 truncate">Up next: <span className="font-semibold text-ink-700">{enrollment.current_lesson_title}</span></p>
          )}
        </div>
        {isComplete ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/lms/${course.id}/review`} className="btn-secondary btn-sm gap-1.5"><RotateCcw size={13} /> Review Course</Link>
            {enrollment.certificate_id && (
              <Link to={`/certificates/${enrollment.certificate_id}`} className="btn-primary btn-sm gap-1.5"><ScrollText size={13} /> Certificate</Link>
            )}
          </div>
        ) : (
          <Link to={continueTo} className="mt-4 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800 group">
            <PlayCircle size={16} /> {enrollment.learning_status === 'not_started' ? 'Start Learning' : 'Continue Learning'}
            <ArrowRight size={14} className="ml-auto group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>
    </article>
  )
}

function CourseCard({
  course, isEnrolled, onEnroll,
}: {
  course: CourseMini
  isEnrolled: boolean
  onEnroll: () => void
}) {
  return (
    <article className="bg-white rounded-2xl border border-ink-100 overflow-hidden hover:border-primary-300 hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col">
      <Link to={`/lms/${course.id}`} className="block relative aspect-[16/10] bg-primary-50">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
            <BookOpen size={40} className="text-primary-400" />
          </div>
        )}
        <span className="absolute top-3 left-3 chip-primary bg-white/95 backdrop-blur-sm">
          {CATEGORY_LABELS[course.category] ?? course.category}
        </span>
        {/* Price badge — only shown for paid courses */}
        {course.price && Number(course.price) > 0 && (
          <span className="absolute top-3 right-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-sm">
            ₱{Number(course.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        )}
      </Link>
      <div className="p-5 flex-1 flex flex-col">
        <Link to={`/lms/${course.id}`}>
          <h3 className="font-display font-bold text-lg text-ink-900 leading-tight line-clamp-2 mb-2 hover:text-primary-700 transition-colors">
            {course.title}
          </h3>
        </Link>
        <span className={cn('self-start inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold mb-2', AUDIENCE_STYLE[course.audience])}>
          <Users size={11} /> {course.audience_display}
        </span>
        {course.description && (
          <p className="text-xs text-ink-600 leading-relaxed line-clamp-2 mb-2">{course.description.replace(/<[^>]+>/g, '')}</p>
        )}
        {course.instructor_name && (
          <p className="text-xs text-ink-500 mb-3">By {course.instructor_name}</p>
        )}
        <div className="flex items-center gap-4 text-xs font-semibold text-ink-500 mt-auto pt-3 border-t border-ink-100">
          {course.duration_hours > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> {course.duration_hours}h
            </span>
          )}
          {!!course.total_lessons && (
            <span className="inline-flex items-center gap-1">
              <Layers size={12} /> {course.total_lessons} lessons
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users size={12} /> {course.enrollment_count} enrolled
          </span>
        </div>
        <button
          type="button"
          disabled={isEnrolled}
          onClick={isEnrolled ? undefined : onEnroll}
          className={cn(
            'mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            isEnrolled
              ? 'bg-emerald-50 text-emerald-700 cursor-default focus-visible:ring-emerald-400'
              : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm focus-visible:ring-primary-400',
          )}
        >
          {isEnrolled ? (
            <><CheckCircle2 size={14} /> Enrolled</>
          ) : (
            <>Enroll <ArrowRight size={14} /></>
          )}
        </button>
      </div>
    </article>
  )
}

function ErrorBlock({ onRetry, children }: { onRetry: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-alert-200 p-6">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-alert-700 mb-2">
        <AlertCircle size={14} /> {children}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 px-3 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors"
      >
        <RefreshCw size={12} /> Try again
      </button>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[0, 1, 2].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
          <div className="aspect-[16/10] skeleton" />
          <div className="p-5 space-y-3">
            <div className="h-5 skeleton w-3/4" />
            <div className="h-3 skeleton w-1/2" />
            <div className="h-9 skeleton mt-4" />
          </div>
        </div>
      ))}
    </div>
  )
}
