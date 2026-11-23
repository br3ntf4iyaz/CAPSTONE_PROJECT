import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, AlertCircle, CheckCircle2, XCircle, ChevronDown, Award, Lock } from 'lucide-react'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import LessonVideo, { type VideoKind } from '../components/LessonVideo'
import { toArray, type Enrollment } from '../lms'

interface ReviewChoice { id: number; text: string; is_correct: boolean }
interface ReviewAnswer {
  question_id: number
  text: string
  explanation: string
  selected_choice_id: number | null
  is_correct: boolean
  choices: ReviewChoice[]
}
interface Attempt {
  id: number
  score: number
  max_score: number
  passed: boolean
  percent: number
  attempted_at: string
  answers: ReviewAnswer[]
}
interface ReviewLesson {
  id: number
  title: string
  module_id: number
  module_title: string
  content: string
  video_source: string
  video_kind: VideoKind
  duration_minutes: number | null
  passing_score: number
  original_score: number | null
  original_max_score: number | null
  original_percent: number | null
  counted_attempt_id: number | null
  attempts: Attempt[]
}
interface Review {
  enrollment_id: number
  course_id: number
  course_title: string
  completed_at: string | null
  certificate_id: number | null
  certificate_name: string
  lessons: ReviewLesson[]
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })

function Notes({ text }: { text: string }) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return (
    <>
      {text.split('\n\n').map((para, i) => (
        <p key={i} className="mb-3 text-sm text-ink-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: esc(para).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').split('\n').join('<br />') }} />
      ))}
    </>
  )
}

/** Look back at a COMPLETED course. Everything here is read-only: it never changes progress, answers or the certificate. */
export default function ReviewCoursePage() {
  const { courseId } = useParams<{ courseId: string }>()

  const enrollmentsQ = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () => apiClient.get('/courses/enrollments/').then(r => toArray<Enrollment>(r.data)).catch(() => []),
  })
  const enrollment = useMemo(
    () => enrollmentsQ.data?.find(e => String(e.course.id) === courseId) ?? null,
    [enrollmentsQ.data, courseId],
  )

  const reviewQ = useQuery({
    queryKey: ['course-review', enrollment?.id],
    queryFn: () => apiClient.get(`/courses/enrollments/${enrollment!.id}/review/`).then(r => r.data as Review),
    enabled: !!enrollment && enrollment.status === 'completed',
    retry: false,
  })

  if (enrollmentsQ.isLoading || reviewQ.isLoading) return <PageSpinner />

  if (!enrollment || enrollment.status !== 'completed') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
        <Lock size={40} className="text-ink-300" />
        <p className="font-display font-bold text-lg text-ink-900">Review opens after you complete the course</p>
        <p className="text-sm text-ink-600 max-w-sm">Finish every lesson and pass every assessment first.</p>
        <Link to={`/lms/${courseId}`} className="btn-primary btn-sm">Back to the course</Link>
      </div>
    )
  }
  const review = reviewQ.data
  if (reviewQ.isError || !review) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <AlertCircle size={40} className="text-alert-400" />
        <p className="font-semibold text-ink-700">Could not load the review.</p>
        <Link to={`/lms/${courseId}`} className="btn-secondary btn-sm">Back to the course</Link>
      </div>
    )
  }

  const modules = review.lessons.reduce<{ id: number; title: string; lessons: ReviewLesson[] }[]>((acc, l) => {
    const m = acc.find(x => x.id === l.module_id)
    if (m) m.lessons.push(l)
    else acc.push({ id: l.module_id, title: l.module_title, lessons: [l] })
    return acc
  }, [])

  return (
    <div className="space-y-6 pb-12">
      <Link to={`/lms/${courseId}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800"><ArrowLeft size={15} /> Back to the course</Link>

      <header className="rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 p-7 text-white sm:p-9">
        <p className="eyebrow-on-dark mb-2">Review course</p>
        <h1 className="font-display text-3xl font-extrabold leading-tight">{review.course_title}</h1>
        <p className="mt-2 text-sm text-primary-100">
          Completed{review.completed_at ? ` on ${fmtDate(review.completed_at)}` : ''}. Reviewing does not change your progress, scores or certificate.
        </p>
        {review.certificate_id && (
          <Link to={`/certificates/${review.certificate_id}`} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-50">
            <Award size={15} /> View certificate for {review.certificate_name}
          </Link>
        )}
      </header>

      {modules.map(m => (
        <section key={m.id} className="space-y-3">
          <h2 className="px-1 font-display text-lg font-bold text-ink-900">{m.title}</h2>
          {m.lessons.map(l => <LessonReview key={l.id} lesson={l} />)}
        </section>
      ))}
    </div>
  )
}

function LessonReview({ lesson }: { lesson: ReviewLesson }) {
  const [attemptId, setAttemptId] = useState<number | null>(lesson.counted_attempt_id ?? lesson.attempts[lesson.attempts.length - 1]?.id ?? null)
  const attempt = lesson.attempts.find(a => a.id === attemptId) ?? null
  const wrong = attempt ? attempt.answers.filter(a => !a.is_correct).length : 0

  return (
    <details className="card overflow-hidden group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 hover:bg-ink-50 select-none">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{lesson.title}</p>
          <p className="text-xs text-ink-500">
            {lesson.original_percent !== null ? `Original score: ${lesson.original_percent}% (${lesson.original_score}/${lesson.original_max_score})` : 'No assessment record'}
            {lesson.attempts.length > 1 ? ` · ${lesson.attempts.length} attempts` : ''}
          </p>
        </div>
        <ChevronDown size={16} className="shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-6 border-t border-ink-100 p-4 sm:p-5">
        <LessonVideo lessonId={lesson.id} title={lesson.title} durationMinutes={lesson.duration_minutes} kind={lesson.video_kind}
          source={lesson.video_source} requiredPercent={0} track={false} onReport={() => undefined} />

        <div>
          <h3 className="mb-2 font-display text-base font-bold text-ink-900">Lesson notes</h3>
          <Notes text={lesson.content} />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-ink-900">Assessment history</h3>
            <span className="text-xs text-ink-500">Passing score: {lesson.passing_score}%</span>
          </div>

          {lesson.attempts.length === 0 ? (
            <p className="text-sm text-ink-500">No saved answers for this lesson.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Attempts">
                {lesson.attempts.map((a, i) => (
                  <button key={a.id} type="button" role="tab" aria-selected={a.id === attemptId} onClick={() => setAttemptId(a.id)}
                    className={cn('rounded-full border px-3 py-1 text-xs font-semibold',
                      a.id === attemptId ? 'border-primary-600 bg-primary-600 text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-primary-300')}>
                    Attempt {i + 1}: {a.percent}% {a.passed ? '✓' : ''}{a.id === lesson.counted_attempt_id ? ' (counted)' : ''}
                  </button>
                ))}
              </div>

              {attempt && (
                <>
                  <div className={cn('flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm', attempt.passed ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900')}>
                    <span className="font-bold">{attempt.score}/{attempt.max_score} correct ({attempt.percent}%)</span>
                    <span>{attempt.passed ? 'Passed' : 'Not passed'}</span>
                    <span className="text-xs opacity-80">{fmtDate(attempt.attempted_at)}{wrong ? ` · ${wrong} mistake${wrong > 1 ? 's' : ''} to review` : ''}</span>
                  </div>

                  {attempt.answers.map((a, i) => {
                    const picked = a.choices.findIndex(c => c.id === a.selected_choice_id)
                    const right = a.choices.findIndex(c => c.is_correct)
                    return (
                      <div key={a.question_id} className={cn('rounded-2xl border p-4', a.is_correct ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40')}>
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-ink-900">Question {i + 1}: {a.text}</p>
                          <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs font-bold', a.is_correct ? 'text-emerald-700' : 'text-red-700')}>
                            {a.is_correct ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {a.is_correct ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>
                        <ul className="space-y-1.5">
                          {a.choices.map((c, ci) => (
                            <li key={c.id} className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                              c.is_correct ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                : ci === picked ? 'border-red-300 bg-red-50 text-red-800' : 'border-ink-100 bg-white text-ink-600')}>
                              <span className="font-bold">{LETTERS[ci]}.</span><span className="flex-1">{c.text}</span>
                              {ci === picked && <span className="text-[11px] font-bold">Your answer</span>}
                              {c.is_correct && <span className="text-[11px] font-bold">Correct answer</span>}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-ink-700">
                          <strong>Your previous answer:</strong> {picked >= 0 ? LETTERS[picked] : 'none'}
                          {!a.is_correct && right >= 0 && <> · <strong>Correct answer:</strong> {LETTERS[right]}</>}
                          {' '}· <strong>Status:</strong> {a.is_correct ? 'Correct' : 'Incorrect'}
                        </p>
                        {a.explanation && <p className="mt-1 text-xs text-ink-600"><strong>Explanation:</strong> {a.explanation}</p>}
                      </div>
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </details>
  )
}
