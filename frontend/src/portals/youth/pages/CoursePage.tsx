import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, ChevronDown, ChevronRight, Clock, CheckCircle2, Lock, PlayCircle, Users, Award,
  AlertCircle, ArrowLeft, Target, Pencil, Check, X, RotateCcw, Video,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import EnrollModal from '../components/EnrollModal'
import CourseCover from '../components/CourseCover'
import {
  AUDIENCE_STYLE, CATEGORY_LABELS, apiMessage, toArray,
  type CourseMini, type CourseState, type Enrollment,
} from '../lms'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OutlineLesson { id: number; title: string; order: number; duration_minutes: number | null; has_video: boolean }
interface OutlineModule { id: number; title: string; order: number; description: string; lessons: OutlineLesson[] }
interface CourseDetail extends CourseMini {
  instructor: { id: number; full_name: string; email: string } | null
  modules: OutlineModule[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [enrolling, setEnrolling] = useState(false)

  const courseQ = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: () => apiClient.get(`/courses/${courseId}/`).then(r => r.data as CourseDetail),
    enabled: !!courseId,
  })

  const enrollmentsQ = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () => apiClient.get('/courses/enrollments/').then(r => toArray<Enrollment>(r.data)).catch(() => []),
  })

  const enrollment = useMemo(
    () => enrollmentsQ.data?.find(e => String(e.course.id) === courseId) ?? null,
    [enrollmentsQ.data, courseId],
  )

  const stateQ = useQuery({
    queryKey: ['course-state', enrollment?.id],
    queryFn: () => apiClient.get(`/courses/enrollments/${enrollment!.id}/state/`).then(r => r.data as CourseState),
    enabled: !!enrollment,
  })

  if (courseQ.isLoading) return <PageSpinner />
  const course = courseQ.data
  if (courseQ.isError || !course) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle size={40} className="text-alert-400" />
        <p className="text-ink-600 font-semibold">Could not load course.</p>
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary btn-sm">Go back</button>
      </div>
    )
  }

  const state = stateQ.data
  const isCompleted = enrollment?.status === 'completed'
  const outcomes = course.learning_outcomes ?? []

  return (
    <div className="space-y-6 pb-12">
      <Link to="/lms" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800 transition-colors">
        <ArrowLeft size={15} /> Back to courses
      </Link>

      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-7 sm:p-10">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold">
              {CATEGORY_LABELS[course.category] ?? course.category}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-primary-800 text-xs font-semibold">
              <Users size={11} /> {course.audience_display}
            </span>
            {course.duration_hours > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-primary-200"><Clock size={12} /> {course.duration_hours}h</span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-primary-200"><Users size={12} /> {course.enrollment_count} enrolled</span>
          </div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight leading-[1.1] mb-2">{course.title}</h1>
          {course.instructor && <p className="text-primary-200 text-sm">Instructor: {course.instructor.full_name}</p>}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-2">About this course</h2>
              <p className="text-sm text-ink-700 leading-relaxed">{course.description?.replace(/<[^>]+>/g, '')}</p>
            </div>
            {outcomes.length > 0 && (
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink-900 mb-2"><Target size={14} className="text-primary-600" /> What you will learn</h3>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {outcomes.map(o => (
                    <li key={o} className="flex items-start gap-2 text-sm text-ink-700">
                      <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" /> <span className="first-letter:uppercase">{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-ink-500 border-t border-ink-100 pt-3">
              Finish each lesson in order: watch the video, read the notes, then pass the assessment ({course.passing_score ?? 75}% or higher) to unlock the next lesson.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="font-display font-bold text-lg text-ink-900 px-1">Course content</h2>
            {enrollment && state ? (
              [...state.modules].sort((a, b) => a.order - b.order).map(mod => (
                <details key={mod.id} className="card overflow-hidden group" open>
                  <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none select-none hover:bg-ink-50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-ink-900 truncate">{mod.title}</p>
                      <p className="text-xs text-ink-500">{mod.lessons.filter(l => l.status === 'completed').length}/{mod.lessons.length} complete</p>
                    </div>
                    <ChevronDown size={16} className="text-ink-400 flex-shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="border-t border-ink-100 divide-y divide-ink-50">
                    {[...mod.lessons].sort((a, b) => a.order - b.order).map(l => (
                      <li key={l.id}>
                        {l.status === 'locked' ? (
                          <div className="flex items-center gap-3 px-4 py-3 opacity-60 cursor-not-allowed" aria-disabled="true" title="Finish the previous lesson to unlock this one">
                            <Lock size={16} className="text-ink-400 flex-shrink-0" />
                            <span className="flex-1 text-sm font-medium text-ink-500 min-w-0 truncate">{l.title}</span>
                            <span className="text-[11px] text-ink-400">Locked</span>
                          </div>
                        ) : (
                          <Link to={`/lms/${courseId}/lesson/${l.id}`}
                            className={cn('flex items-center gap-3 px-4 py-3 hover:bg-primary-50 transition-colors group/row', l.status === 'current' && 'bg-primary-50/60')}>
                            {l.status === 'completed'
                              ? <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                              : <PlayCircle size={16} className="text-primary-500 flex-shrink-0" />}
                            <span className="flex-1 text-sm font-medium text-ink-800 group-hover/row:text-primary-700 min-w-0 truncate">{l.title}</span>
                            {l.status === 'current' && <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold text-white">Current</span>}
                            {l.status === 'completed' && l.score !== null && l.max_score ? (
                              <span className="text-[11px] font-semibold text-emerald-700">{Math.round((l.score / l.max_score) * 100)}%</span>
                            ) : null}
                            {l.duration_minutes ? <span className="text-xs text-ink-400 flex-shrink-0">{l.duration_minutes}m</span> : null}
                            <ChevronRight size={14} className="text-ink-300 flex-shrink-0 group-hover/row:text-primary-400" />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              ))
            ) : (
              [...course.modules].sort((a, b) => a.order - b.order).map(mod => (
                <details key={mod.id} className="card overflow-hidden group" open>
                  <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none select-none hover:bg-ink-50 transition-colors">
                    <p className="font-semibold text-sm text-ink-900 truncate">{mod.title}</p>
                    <ChevronDown size={16} className="text-ink-400 flex-shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="border-t border-ink-100 divide-y divide-ink-50">
                    {[...mod.lessons].sort((a, b) => a.order - b.order).map(l => (
                      <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                        <Lock size={15} className="text-ink-300 flex-shrink-0" />
                        <span className="flex-1 text-sm text-ink-600 min-w-0 truncate">{l.title}</span>
                        {l.has_video && <Video size={13} className="text-ink-300" />}
                        {l.duration_minutes ? <span className="text-xs text-ink-400">{l.duration_minutes}m</span> : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ))
            )}
            {course.modules.length === 0 && <p className="card p-6 text-sm text-ink-500">Lessons for this course are not ready yet. Please check back soon.</p>}
          </div>
        </div>

        <aside className="lg:col-span-1 lg:sticky lg:top-4">
          <SideCard
            course={course}
            enrollment={enrollment}
            state={state}
            isCompleted={isCompleted}
            courseId={courseId!}
            onEnroll={() => setEnrolling(true)}
          />
        </aside>
      </div>

      {enrolling && <EnrollModal courseId={course.id} courseTitle={course.title} onClose={() => setEnrolling(false)} />}
    </div>
  )
}

// ─── Side card ────────────────────────────────────────────────────────────────

function SideCard({
  course, enrollment, state, isCompleted, courseId, onEnroll,
}: {
  course: CourseDetail
  enrollment: Enrollment | null
  state: CourseState | undefined
  isCompleted: boolean
  courseId: string
  onEnroll: () => void
}) {
  const totalLessons = course.total_lessons ?? course.modules.reduce((n, m) => n + m.lessons.length, 0)

  if (!enrollment) {
    return (
      <div className="card p-6 space-y-4">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-primary-50">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            <CourseCover category={course.category} audience={course.audience} />
          )}
        </div>
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', AUDIENCE_STYLE[course.audience])}>
          <Users size={11} /> For {course.audience_display}
        </span>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-ink-600"><span className="flex items-center gap-1.5"><BookOpen size={14} /> Lessons</span><span className="font-semibold text-ink-900">{totalLessons}</span></div>
          <div className="flex justify-between text-ink-600"><span className="flex items-center gap-1.5"><Users size={14} /> Enrolled</span><span className="font-semibold text-ink-900">{course.enrollment_count}</span></div>
        </div>
        <button type="button" disabled={totalLessons === 0} onClick={onEnroll} className="btn-primary w-full justify-center">
          {totalLessons === 0 ? 'Lessons coming soon' : 'Enroll now — it\'s free'}
        </button>
        <p className="text-[11px] text-ink-400 text-center">Open to everyone, whatever your role.</p>
      </div>
    )
  }

  const percent = state?.progress_percent ?? enrollment.progress_percent
  const done = state?.completed_lessons ?? enrollment.completed_lessons
  const total = state?.total_lessons ?? enrollment.total_lessons
  const current = state?.current_lesson_id ?? enrollment.current_lesson_id
  const circumference = 2 * Math.PI * 28
  const dash = circumference - (percent / 100) * circumference

  return (
    <div className="card p-6 space-y-4">
      {isCompleted ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <Award size={28} className="text-emerald-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-emerald-800 text-sm">Course Completed!</p>
            <p className="text-xs text-emerald-700">You finished every lesson and assessment.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <svg width="72" height="72" className="-rotate-90">
              <circle cx="36" cy="36" r="28" fill="none" stroke="#e5e7eb" strokeWidth="6" />
              <circle cx="36" cy="36" r="28" fill="none" stroke="#0038a8" strokeWidth="6" strokeDasharray={circumference}
                strokeDashoffset={dash} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-ink-900">{percent}%</span>
          </div>
          <div>
            <p className="font-bold text-ink-900">{done === 0 ? 'Not started' : 'In progress'}</p>
            <p className="text-xs text-ink-500 mt-0.5">{done} of {total} lessons completed</p>
          </div>
        </div>
      )}

      {isCompleted ? (
        <div className="space-y-2">
          <Link to={`/lms/${courseId}/review`} className="btn-secondary w-full justify-center text-sm"><RotateCcw size={15} /> Review Course</Link>
          {enrollment.certificate_id && (
            <Link to={`/certificates/${enrollment.certificate_id}`} className="btn-primary w-full justify-center text-sm"><Award size={15} /> View certificate</Link>
          )}
        </div>
      ) : current ? (
        <Link to={`/lms/${courseId}/lesson/${current}`} className="btn-primary w-full justify-center">
          <PlayCircle size={15} /> {done === 0 ? 'Start learning' : 'Continue learning'}
        </Link>
      ) : null}

      <CertificateName enrollment={enrollment} locked={isCompleted} />

      <div className="space-y-2 text-sm pt-2 border-t border-ink-100">
        <div className="flex justify-between text-ink-600"><span>Lessons</span><span className="font-semibold text-ink-900">{total}</span></div>
        <div className="flex justify-between text-ink-600"><span>Passing score</span><span className="font-semibold text-ink-900">{course.passing_score ?? 75}%</span></div>
      </div>
    </div>
  )
}

/** The name printed on the certificate. It can be corrected until the certificate is issued. */
function CertificateName({ enrollment, locked }: { enrollment: Enrollment; locked: boolean }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(enrollment.certificate_name)
  const save = useMutation({
    mutationFn: () => apiClient.patch(`/courses/enrollments/${enrollment.id}/certificate-name/`, { certificate_name: name }).then(r => r.data),
    onSuccess: d => {
      toast.success('Certificate name updated.')
      setName(d.certificate_name)
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['my-enrollments'] })
    },
    onError: (e: any) => toast.error(apiMessage(e)),
  })
  return (
    <div className="rounded-xl bg-ink-50 p-3 text-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-1">Name on your certificate</p>
      {editing ? (
        <div className="space-y-2">
          <input className="input w-full text-sm" value={name} maxLength={150} onChange={e => setName(e.target.value)} aria-label="Name on your certificate" autoFocus />
          <div className="flex gap-2">
            <button type="button" className="btn-primary btn-sm gap-1" disabled={save.isPending} onClick={() => save.mutate()}><Check size={13} /> Save</button>
            <button type="button" className="btn-secondary btn-sm gap-1" onClick={() => { setName(enrollment.certificate_name); setEditing(false) }}><X size={13} /> Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-ink-900 break-words min-w-0">{enrollment.certificate_name || '—'}</span>
          {!locked && (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 shrink-0">
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>
      )}
      {locked && <p className="mt-1 text-[11px] text-ink-400">The certificate was issued with this name.</p>}
    </div>
  )
}
