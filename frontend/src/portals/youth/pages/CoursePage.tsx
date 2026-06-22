import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, ChevronDown, ChevronRight, Clock, CheckCircle2,
  Lock, PlayCircle, Users, Award, AlertCircle, ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn, toArray } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LessonItem {
  id: number
  title: string
  order: number
  duration_minutes: number | null
  video_url: string
  content: string
}

interface ModuleItem {
  id: number
  title: string
  order: number
  description: string
  lessons: LessonItem[]
}

interface CourseDetail {
  id: number
  title: string
  slug: string
  description: string
  category: string
  thumbnail_url: string | null
  duration_hours: number
  instructor: { id: number; full_name: string; email: string } | null
  enrollment_count: number
  modules: ModuleItem[]
}

interface CourseMini {
  id: number
  title: string
  slug: string
  category: string
  thumbnail_url: string | null
  duration_hours: number
  instructor_name: string | null
  enrollment_count: number
}

interface Enrollment {
  id: number
  course: CourseMini
  enrolled_at: string
  completed_at: string | null
  progress_percent: number
  status: 'enrolled' | 'in_progress' | 'completed'
}

interface LessonProgressItem {
  lesson_id: number
  completed: boolean
  completed_at: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  leadership:    'Leadership',
  governance:    'Governance',
  life_skills:   'Life Skills',
  tech:          'Technology',
  finance:       'Finance',
  communication: 'Communication',
}

function allLessonsOrdered(modules: ModuleItem[]): LessonItem[] {
  return [...modules]
    .sort((a, b) => a.order - b.order)
    .flatMap(m => [...m.lessons].sort((a, b) => a.order - b.order))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const courseQ = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: () =>
      apiClient.get(`/courses/${courseId}/`).then(r => r.data as CourseDetail),
    enabled: !!courseId,
  })

  const enrollmentsQ = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () =>
      apiClient.get('/courses/enrollments/').then(r => toArray<Enrollment>(r.data)).catch(() => []),
  })

  const enrollment = useMemo(
    () => enrollmentsQ.data?.find(e => String(e.course.id) === courseId) ?? null,
    [enrollmentsQ.data, courseId],
  )

  const lessonProgressQ = useQuery({
    queryKey: ['lesson-progress', enrollment?.id],
    queryFn: () =>
      apiClient
        .get(`/courses/enrollments/${enrollment!.id}/lesson-progress/`)
        .then(r => toArray<LessonProgressItem>(r.data)),
    enabled: !!enrollment,
  })

  const enrollMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/courses/enrollments/', { course_id: Number(courseId) }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-enrollments'] })
      toast.success('Enrolled! Start learning now.')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Enrollment failed. Please try again.'),
  })

  const completedLessonIds = useMemo(
    () => new Set((lessonProgressQ.data ?? []).map(p => p.lesson_id)),
    [lessonProgressQ.data],
  )

  const course = courseQ.data

  // Which modules have every lesson completed
  const completedModuleIds = useMemo(() => {
    if (!course) return new Set<number>()
    return new Set(
      course.modules
        .filter(m => m.lessons.length > 0 && m.lessons.every(l => completedLessonIds.has(l.id)))
        .map(m => m.id),
    )
  }, [course, completedLessonIds])

  const firstIncompleteLesson = useMemo(() => {
    if (!course) return null
    const lessons = allLessonsOrdered(course.modules)
    return lessons.find(l => !completedLessonIds.has(l.id)) ?? lessons[lessons.length - 1] ?? null
  }, [course, completedLessonIds])

  if (courseQ.isLoading) return <PageSpinner />

  if (courseQ.isError || !course) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle size={40} className="text-alert-400" />
        <p className="text-ink-600 font-semibold">Could not load course.</p>
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary btn-sm">
          Go back
        </button>
      </div>
    )
  }

  const isEnrolled = !!enrollment
  const isCompleted = enrollment?.status === 'completed'

  return (
    <div className="space-y-6 pb-12">
      {/* Back link */}
      <Link to="/lms" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800 transition-colors">
        <ArrowLeft size={15} /> Back to courses
      </Link>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-7 sm:p-10">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold">
              {CATEGORY_LABELS[course.category] ?? course.category}
            </span>
            {course.duration_hours > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-primary-200">
                <Clock size={12} /> {course.duration_hours}h
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-primary-200">
              <Users size={12} /> {course.enrollment_count} enrolled
            </span>
          </div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight leading-[1.1] mb-2">
            {course.title}
          </h1>
          {course.instructor && (
            <p className="text-primary-200 text-sm">Instructor: {course.instructor.full_name}</p>
          )}
        </div>
      </header>

      {/* ── Two-column layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── Left: description + module accordion ────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6">
            <h2 className="font-display font-bold text-lg text-ink-900 mb-3">About this course</h2>
            <p className="text-sm text-ink-700 leading-relaxed">{course.description}</p>
          </div>

          <div className="space-y-3">
            <h2 className="font-display font-bold text-lg text-ink-900 px-1">Course content</h2>
            {(() => {
              const modulesOrdered = course.modules.slice().sort((a, b) => a.order - b.order)
              return modulesOrdered.map((mod, modIdx) => {
                const lessonsOrdered = [...mod.lessons].sort((a, b) => a.order - b.order)
                const completedInModule = lessonsOrdered.filter(l => completedLessonIds.has(l.id)).length
                // A module is unlocked only if it's the first or the previous module is fully complete
                const isModuleUnlocked = modIdx === 0 || completedModuleIds.has(modulesOrdered[modIdx - 1].id)
                return (
                  <ModuleAccordion
                    key={mod.id}
                    module={mod}
                    lessons={lessonsOrdered}
                    completedLessonIds={completedLessonIds}
                    courseId={courseId!}
                    isEnrolled={isEnrolled}
                    completedCount={completedInModule}
                    isModuleUnlocked={isModuleUnlocked}
                  />
                )
              })
            })()}
          </div>
        </div>

        {/* ── Right: enrollment card ───────────────────────────────── */}
        <aside className="lg:col-span-1 sticky top-4">
          <EnrollmentCard
            course={course}
            enrollment={enrollment}
            isCompleted={isCompleted}
            firstIncompleteLesson={firstIncompleteLesson}
            courseId={courseId!}
            onEnroll={() => enrollMutation.mutate()}
            isEnrolling={enrollMutation.isPending}
          />
        </aside>
      </div>
    </div>
  )
}

// ─── Module Accordion ─────────────────────────────────────────────────────────

function ModuleAccordion({
  module, lessons, completedLessonIds, courseId, isEnrolled, completedCount, isModuleUnlocked,
}: {
  module: ModuleItem
  lessons: LessonItem[]
  completedLessonIds: Set<number>
  courseId: string
  isEnrolled: boolean
  completedCount: number
  isModuleUnlocked: boolean
}) {
  const allLessonsInOrder = useMemo(() => lessons, [lessons])
  // linear lock: module must be unlocked first, then each lesson requires the previous to be complete
  const isLessonUnlocked = (idx: number) => {
    if (!isEnrolled || !isModuleUnlocked) return false
    if (idx === 0) return true
    return completedLessonIds.has(allLessonsInOrder[idx - 1].id)
  }

  return (
    <details className="card overflow-hidden group" open>
      <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none select-none hover:bg-ink-50 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
            {module.order}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-ink-900 truncate">{module.title}</p>
            <p className="text-xs text-ink-500">{completedCount}/{lessons.length} complete</p>
          </div>
        </div>
        <ChevronDown size={16} className="text-ink-400 flex-shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="border-t border-ink-100 divide-y divide-ink-50">
        {allLessonsInOrder.map((lesson, idx) => {
          const completed = completedLessonIds.has(lesson.id)
          const unlocked = isLessonUnlocked(idx)
          return (
            <li key={lesson.id}>
              {unlocked ? (
                <Link
                  to={`/lms/${courseId}/lesson/${lesson.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-primary-50 transition-colors group/row"
                >
                  <LessonIcon completed={completed} />
                  <span className="flex-1 text-sm font-medium text-ink-800 group-hover/row:text-primary-700 min-w-0 truncate">
                    {lesson.title}
                  </span>
                  {lesson.duration_minutes && (
                    <span className="text-xs text-ink-400 flex-shrink-0">{lesson.duration_minutes}m</span>
                  )}
                  <ChevronRight size={14} className="text-ink-300 flex-shrink-0 group-hover/row:text-primary-400" />
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 opacity-50 cursor-not-allowed">
                  <Lock size={16} className="text-ink-400 flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium text-ink-500 min-w-0 truncate">
                    {lesson.title}
                  </span>
                  {lesson.duration_minutes && (
                    <span className="text-xs text-ink-400 flex-shrink-0">{lesson.duration_minutes}m</span>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

function LessonIcon({ completed }: { completed: boolean }) {
  if (completed) return <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
  return <PlayCircle size={16} className="text-primary-400 flex-shrink-0" />
}

// ─── Enrollment Card ──────────────────────────────────────────────────────────

function EnrollmentCard({
  course, enrollment, isCompleted, firstIncompleteLesson, courseId, onEnroll, isEnrolling,
}: {
  course: CourseDetail
  enrollment: Enrollment | null
  isCompleted: boolean
  firstIncompleteLesson: LessonItem | null
  courseId: string
  onEnroll: () => void
  isEnrolling: boolean
}) {
  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0)

  if (!enrollment) {
    return (
      <div className="card p-6 space-y-4">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-primary-50">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
              <BookOpen size={48} className="text-primary-400" />
            </div>
          )}
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-ink-600">
            <span className="flex items-center gap-1.5"><Clock size={14} /> Duration</span>
            <span className="font-semibold text-ink-900">{course.duration_hours}h</span>
          </div>
          <div className="flex justify-between text-ink-600">
            <span className="flex items-center gap-1.5"><BookOpen size={14} /> Lessons</span>
            <span className="font-semibold text-ink-900">{totalLessons}</span>
          </div>
          <div className="flex justify-between text-ink-600">
            <span className="flex items-center gap-1.5"><Users size={14} /> Enrolled</span>
            <span className="font-semibold text-ink-900">{course.enrollment_count}</span>
          </div>
        </div>
        <button
          type="button"
          disabled={isEnrolling}
          onClick={onEnroll}
          className="btn-primary w-full justify-center"
        >
          {isEnrolling ? 'Enrolling…' : 'Enroll now \u2014 it\'s free'}
        </button>
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <Award size={28} className="text-emerald-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-emerald-800 text-sm">Course Complete!</p>
            <p className="text-xs text-emerald-700">You've finished all lessons.</p>
          </div>
        </div>
        {firstIncompleteLesson && (
          <Link
            to={`/lms/${courseId}/lesson/${firstIncompleteLesson.id}`}
            className="btn-secondary w-full justify-center text-sm"
          >
            <PlayCircle size={15} /> Review course
          </Link>
        )}
        <Link to="/certificates" className="btn-primary w-full justify-center text-sm">
          <Award size={15} /> View certificate
        </Link>
      </div>
    )
  }

  // Enrolled + in progress
  const percent = enrollment.progress_percent
  const circumference = 2 * Math.PI * 28
  const strokeDash = circumference - (percent / 100) * circumference

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-4">
        {/* Circular progress ring */}
        <div className="relative flex-shrink-0">
          <svg width="72" height="72" className="-rotate-90">
            <circle cx="36" cy="36" r="28" fill="none" stroke="#e5e7eb" strokeWidth="6" />
            <circle
              cx="36" cy="36" r="28" fill="none"
              stroke="#4f46e5" strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDash}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-ink-900">
            {percent}%
          </span>
        </div>
        <div>
          <p className="font-bold text-ink-900">In progress</p>
          <p className="text-xs text-ink-500 mt-0.5 capitalize">{enrollment.status.replace('_', ' ')}</p>
        </div>
      </div>

      {firstIncompleteLesson && (
        <Link
          to={`/lms/${courseId}/lesson/${firstIncompleteLesson.id}`}
          className="btn-primary w-full justify-center"
        >
          <PlayCircle size={15} /> Continue learning
        </Link>
      )}

      <div className="space-y-2 text-sm pt-2 border-t border-ink-100">
        <div className="flex justify-between text-ink-600">
          <span>Lessons</span>
          <span className="font-semibold text-ink-900">{totalLessons}</span>
        </div>
        <div className="flex justify-between text-ink-600">
          <span>Duration</span>
          <span className="font-semibold text-ink-900">{course.duration_hours}h</span>
        </div>
      </div>
    </div>
  )
}
