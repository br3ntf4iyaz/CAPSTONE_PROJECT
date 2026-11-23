import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Award, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, Lock, Menu, X, AlertCircle,
  ArrowLeft, RotateCcw, ScrollText, FileText, Eye, PenLine, Check, Keyboard,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import LessonVideo, { type VideoKind } from '../components/LessonVideo'
import StudyResources, { type StudyResource } from '../components/StudyResources'
import { apiMessage, toArray, type CourseState, type Enrollment, type StateLesson } from '../lms'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Choice { id: number; text: string; order: number }
interface Question { id: number; text: string; order: number; choices: Choice[] }

interface LessonDetail {
  id: number
  title: string
  content: string
  video_url: string
  video_title: string
  study_resources: StudyResource[]
  video_source: string
  video_kind: VideoKind
  video_required_percent: number
  video_percent: number
  video_watched: boolean
  notes_read: boolean
  requirement_met: boolean
  passing_score: number
  duration_minutes: number | null
  resource_file_url: string | null
  questions: Question[]
  completed: boolean
}

interface ResultAnswer {
  question_id: number
  question_text: string
  selected_choice_id: number
  correct_choice_id: number
  is_correct: boolean
  explanation: string
}

interface QuizResult {
  attempt_id: number
  score: number
  max_score: number
  passed: boolean
  percent: number
  passing_score: number
  answers: ResultAnswer[]
  next_lesson_id: number | null
  course_completed: boolean
  certificate_id: number | null
  progress_percent: number
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** Notes are written by administrators: bold (**text**) and paragraphs only, and everything else is escaped. */
function Notes({ text }: { text: string }) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return (
    <>
      {text.split('\n\n').map((para, i) => (
        <p
          key={i}
          className="mb-3 text-sm text-ink-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: esc(para).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').split('\n').join('<br />') }}
        />
      ))}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LessonPlayerPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showSidebar, setShowSidebar] = useState(false)
  const [videoPercent, setVideoPercent] = useState<number | null>(null)
  const [videoDone, setVideoDone] = useState(false)
  // closed-book mode: while the learner answers, the notes, study links and video are not shown
  const [quizOpen, setQuizOpen] = useState(false)

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

  const lessonQ = useQuery({
    queryKey: ['lesson-detail', lessonId, enrollment?.id],
    queryFn: () => apiClient.get(`/courses/lessons/${lessonId}/`).then(r => r.data as LessonDetail),
    enabled: !!lessonId && !!enrollment,
    retry: false,
  })

  // a different lesson starts with a clean video status
  useEffect(() => { setVideoPercent(null); setVideoDone(false); setQuizOpen(false) }, [lessonId])

  const state = stateQ.data
  const flat: StateLesson[] = useMemo(
    () => (state ? [...state.modules].sort((a, b) => a.order - b.order).flatMap(m => [...m.lessons].sort((a, b) => a.order - b.order)) : []),
    [state],
  )
  const idx = flat.findIndex(l => String(l.id) === lessonId)
  const prev = idx > 0 ? flat[idx - 1] : null
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null
  const here = idx >= 0 ? flat[idx] : null
  const lesson = lessonQ.data

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['course-state', enrollment?.id] })
    qc.invalidateQueries({ queryKey: ['lesson-detail', lessonId, enrollment?.id] })
    qc.invalidateQueries({ queryKey: ['my-enrollments'] })
    qc.invalidateQueries({ queryKey: ['my-certificates'] })
  }

  const confirmVideo = useMutation({
    mutationFn: () => apiClient.post(`/courses/lessons/${lessonId}/watched/`),
    onSuccess: () => { toast.success('Video confirmed.'); refresh() },
    onError: e => toast.error(apiMessage(e)),
  })
  const confirmNotes = useMutation({
    mutationFn: () => apiClient.post(`/courses/lessons/${lessonId}/notes-read/`),
    onSuccess: () => { toast.success('Great. The assessment is open.'); refresh() },
    onError: e => toast.error(apiMessage(e)),
  })

  if (enrollmentsQ.isLoading || stateQ.isLoading) return <PageSpinner />

  if (!enrollment) {
    return (
      <Notice icon={<Lock size={40} className="text-ink-300" />} title="Enroll to open this lesson"
        text="Lessons are available after you enroll in the course." to={`/lms/${courseId}`} action="Go to the course" />
    )
  }

  const lockedByServer = (lessonQ.error as any)?.response?.data?.code === 'locked'
  if (lessonQ.isError && lockedByServer) {
    const current = state?.current_lesson_id
    return (
      <Notice icon={<Lock size={40} className="text-ink-300" />} title="This lesson is locked"
        text="Finish the previous lesson and pass its assessment to unlock this one."
        to={current ? `/lms/${courseId}/lesson/${current}` : `/lms/${courseId}`} action={current ? 'Go to my current lesson' : 'Back to the course'} />
    )
  }
  if (here?.status === 'locked') {
    return (
      <Notice icon={<Lock size={40} className="text-ink-300" />} title="This lesson is locked"
        text="Finish the previous lesson and pass its assessment to unlock this one."
        to={state?.current_lesson_id ? `/lms/${courseId}/lesson/${state.current_lesson_id}` : `/lms/${courseId}`} action="Go to my current lesson" />
    )
  }
  if (lessonQ.isLoading) return <PageSpinner />
  if (lessonQ.isError || !lesson || !state) {
    return <Notice icon={<AlertCircle size={40} className="text-alert-400" />} title="Could not load the lesson" text="Please try again."
      to={`/lms/${courseId}`} action="Back to the course" />
  }

  const requirementMet = lesson.requirement_met || videoDone
  const hasVideo = lesson.video_kind !== 'none'
  const trackable = ['file', 'youtube', 'direct'].includes(lesson.video_kind)
  const pct = videoPercent ?? lesson.video_percent
  const completed = lesson.completed || here?.status === 'completed'

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6">
      {showSidebar && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setShowSidebar(false)} />}

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside className={cn(
        'fixed lg:relative inset-y-0 left-0 z-40 flex flex-col w-72 bg-white border-r border-ink-100 transition-transform duration-200',
        showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        <div className="flex items-center justify-between gap-2 p-4 border-b border-ink-100 flex-shrink-0">
          <Link to={`/lms/${courseId}`} className="flex items-center gap-2 text-xs font-semibold text-ink-500 hover:text-ink-800 min-w-0">
            <ArrowLeft size={14} className="flex-shrink-0" /><span className="truncate">{state.course_title}</span>
          </Link>
          <button type="button" onClick={() => setShowSidebar(false)} className="lg:hidden p-1 rounded-lg hover:bg-ink-100" aria-label="Close menu"><X size={16} /></button>
        </div>
        <div className="px-4 py-3 border-b border-ink-50">
          <div className="flex items-center justify-between text-[11px] font-semibold text-ink-500 mb-1">
            <span>{state.completed_lessons} of {state.total_lessons} lessons</span><span>{state.progress_percent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden"><div className="h-full bg-primary-600 transition-all" style={{ width: `${state.progress_percent}%` }} /></div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2" aria-label="Lessons">
          {[...state.modules].sort((a, b) => a.order - b.order).map(mod => (
            <div key={mod.id}>
              <p className="px-4 py-2 text-[10px] font-bold text-ink-400 uppercase tracking-wider">{mod.title}</p>
              {[...mod.lessons].sort((a, b) => a.order - b.order).map(l => {
                const isHere = String(l.id) === lessonId
                const inner = (
                  <>
                    {l.status === 'completed' ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                      : l.status === 'locked' ? <Lock size={13} className="text-ink-300 flex-shrink-0" />
                      : <span className={cn('w-3.5 h-3.5 rounded-full border-2 flex-shrink-0', isHere ? 'border-primary-600 bg-primary-100' : 'border-primary-400')} />}
                    <span className="truncate leading-tight">{l.title}</span>
                  </>
                )
                return l.status === 'locked' ? (
                  <div key={l.id} aria-disabled="true" title="Locked: finish the previous lesson first"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-400 cursor-not-allowed">{inner}</div>
                ) : (
                  <Link key={l.id} to={`/lms/${courseId}/lesson/${l.id}`} onClick={() => setShowSidebar(false)} aria-current={isHere ? 'page' : undefined}
                    className={cn('flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
                      isHere ? 'bg-primary-50 text-primary-700 font-semibold border-r-2 border-primary-600' : 'text-ink-700 hover:bg-ink-50')}>
                    {inner}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-ink-100 flex-shrink-0">
          <Link to={`/lms/${courseId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800"><ArrowLeft size={13} /> Back to Course</Link>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-100 bg-white lg:hidden flex-shrink-0">
          <button type="button" onClick={() => setShowSidebar(true)} className="p-1.5 rounded-lg hover:bg-ink-100" aria-label="Open lessons menu"><Menu size={18} /></button>
          <p className="font-semibold text-sm text-ink-900 truncate flex-1">{lesson.title}</p>
          <span className="text-xs text-ink-400 flex-shrink-0">{idx + 1}/{flat.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8 pb-24">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary-700 mb-1">Lesson {idx + 1} of {flat.length}</p>
              <h1 className="font-display font-bold text-2xl text-ink-900">{lesson.title}</h1>
              {lesson.duration_minutes && !quizOpen ? <p className="text-sm text-ink-500 mt-1">{lesson.duration_minutes} min</p> : null}
            </div>

            {!quizOpen && (<>

            {lesson.video_title && hasVideo && (
              <p className="-mb-4 text-sm font-semibold text-ink-800">Watch: <span className="font-bold">{lesson.video_title}</span></p>
            )}
            <LessonVideo
              lessonId={lesson.id}
              title={lesson.title}
              durationMinutes={lesson.duration_minutes}
              kind={lesson.video_kind}
              source={lesson.video_source}
              requiredPercent={lesson.video_required_percent}
              onReport={r => { setVideoPercent(r.percent); if (r.watched) { setVideoDone(true); refresh() } }}
            />

            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-3">Lesson Notes</h2>
              <Notes text={lesson.content} />
              {lesson.resource_file_url && (
                <a href={lesson.resource_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline">
                  <FileText size={14} /> Download the lesson handout
                </a>
              )}
            </section>

            <StudyResources items={lesson.study_resources ?? []} heading={hasVideo ? 'More to read' : 'Study materials for this lesson'} />

            {/* ── Requirement before the assessment ───────────────────── */}
            {!completed && !requirementMet && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
                <p className="font-semibold text-amber-900">
                  {hasVideo ? 'Watch the video to unlock the assessment' : 'Read the lesson notes to unlock the assessment'}
                </p>
                {trackable ? (
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-amber-900 mb-1">
                      <span>Video progress</span><span>{pct}% of {lesson.video_required_percent}% needed</span>
                    </div>
                    <div className="h-2 rounded-full bg-white overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-amber-500 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-amber-800">Progress counts only while the video plays. Skipping ahead does not count.</p>
                  </div>
                ) : hasVideo ? (
                  <button type="button" className="btn-primary btn-sm" disabled={confirmVideo.isPending} onClick={() => confirmVideo.mutate()}>
                    <Eye size={14} /> I finished watching the video
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-amber-900">
                      This lesson has no video yet, so it is not marked as watched. Read the notes{(lesson.study_resources ?? []).length ? ' and the study materials' : ''} above, then confirm.
                    </p>
                    <button type="button" className="btn-primary btn-sm" disabled={confirmNotes.isPending} onClick={() => confirmNotes.mutate()}>
                      <BookOpen size={14} /> I have read the lesson notes{(lesson.study_resources ?? []).length ? ' and study materials' : ''}
                    </button>
                  </div>
                )}
              </section>
            )}

            </>)}

            {/* ── Assessment ──────────────────────────────────────────── */}
            {lesson.questions.length > 0 && !completed && requirementMet && !quizOpen && (
              <StartCard count={lesson.questions.length} passing={lesson.passing_score} onStart={() => setQuizOpen(true)} />
            )}
            {lesson.questions.length > 0 && quizOpen && (
              <Assessment
                key={lesson.id}
                lesson={lesson}
                enrollmentId={enrollment.id}
                completed={completed}
                next={next}
                courseId={courseId!}
                certificateName={state.certificate_name}
                onChanged={refresh}
                onExit={() => setQuizOpen(false)}
              />
            )}
            {lesson.questions.length > 0 && completed && !quizOpen && <CompletedBanner next={next} courseId={courseId!} />}
            {lesson.questions.length === 0 && !completed && requirementMet && (
              <NoQuizComplete enrollmentId={enrollment.id} lessonId={lesson.id} onDone={refresh} />
            )}
            {lesson.questions.length === 0 && completed && <CompletedBanner next={next} courseId={courseId!} />}
          </div>
        </div>

        {/* ── Bottom bar ──────────────────────────────────────────────── */}
        <nav className="flex-shrink-0 border-t border-ink-100 bg-white px-4 py-3 flex items-center justify-between gap-4">
          {prev ? (
            <Link to={`/lms/${courseId}/lesson/${prev.id}`} className="btn-secondary btn-sm"><ChevronLeft size={15} /> Previous</Link>
          ) : <div />}
          <span className="text-xs font-semibold text-ink-400 tabular-nums">{idx + 1} / {flat.length}</span>
          {next ? (
            completed ? (
              <Link to={`/lms/${courseId}/lesson/${next.id}`} className="btn-primary btn-sm">Next lesson <ChevronRight size={15} /></Link>
            ) : (
              <button type="button" disabled className="btn-primary btn-sm opacity-40 cursor-not-allowed" title="Pass this lesson's assessment to unlock the next lesson">
                <Lock size={13} /> Next lesson
              </button>
            )
          ) : (
            <button type="button" onClick={() => navigate(`/lms/${courseId}`)} className="btn-secondary btn-sm"><BookOpen size={14} /> Course overview</button>
          )}
        </nav>
      </main>
    </div>
  )
}

// ─── Assessment ───────────────────────────────────────────────────────────────

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const buildOrder = (qs: Question[]): Question[] => shuffled(qs).map(q => ({ ...q, choices: shuffled(q.choices) }))

function StartCard({ count, passing, onStart }: { count: number; passing: number; onStart: () => void }) {
  return (
    <section className="rounded-3xl border-2 border-primary-200 bg-gradient-to-br from-primary-50 to-white p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white"><PenLine size={22} /></span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold text-ink-900">Ready for the assessment?</h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>{count} question{count > 1 ? 's' : ''}. You need <strong>{passing}%</strong> to pass and unlock the next lesson.</li>
            <li><strong>Closed book:</strong> the notes, study links and video are hidden while you answer.</li>
            <li>Questions and choices are shuffled every attempt. You can retake it if you do not pass.</li>
          </ul>
          <button type="button" className="btn-primary mt-4 gap-2" onClick={onStart}>Start Assessment <ChevronRight size={16} /></button>
        </div>
      </div>
    </section>
  )
}

function Assessment({
  lesson, enrollmentId, completed, next, courseId, certificateName, onChanged, onExit,
}: {
  lesson: LessonDetail
  enrollmentId: number
  completed: boolean
  next: StateLesson | null
  courseId: string
  certificateName: string
  onChanged: () => void
  onExit: () => void
}) {
  // fixed for the whole attempt (a background refetch must not reshuffle it); a retake builds a new order
  const [questions, setQuestions] = useState<Question[]>(() => buildOrder(lesson.questions))
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const submit = useMutation({
    mutationFn: () => apiClient.post(`/courses/lessons/${lesson.id}/submit-quiz/`, {
      enrollment_id: enrollmentId,
      lesson_id: lesson.id,
      answers: questions.map(q => ({ question_id: q.id, choice_id: answers[q.id] })),
    }).then(r => r.data as QuizResult),
    onSuccess: r => {
      setResult(r)
      if (r.passed) toast.success(`Passed! ${r.score}/${r.max_score} correct`)
      else toast.error(`${r.percent}%. You need ${r.passing_score}% to pass.`)
      onChanged()
    },
    onError: e => toast.error(apiMessage(e, 'Could not submit the assessment.')),
  })

  const retry = () => { setQuestions(buildOrder(lesson.questions)); setAnswers({}); setStep(0); setResult(null) }

  const q = questions[step]
  const chosen = q ? (answers[q.id] ?? null) : null
  const last = step === questions.length - 1
  const allAnswered = Object.keys(answers).length >= questions.length

  // keep the card in view (nearest: no jump to the top of the page)
  useEffect(() => { cardRef.current?.scrollIntoView({ block: result ? 'start' : 'nearest', behavior: 'smooth' }) }, [step, result])

  // keyboard: A-D to choose, Enter for the next question
  useEffect(() => {
    if (result || !q) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && t.tagName === 'BUTTON') return
      const i = ['a', 'b', 'c', 'd', 'e', 'f'].indexOf(e.key.toLowerCase())
      if (i >= 0 && i < q.choices.length) { setAnswers(p => ({ ...p, [q.id]: q.choices[i].id })); return }
      if (e.key === 'Enter' && chosen !== null && !last) { e.preventDefault(); setStep(x => x + 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, result, chosen, last])

  if (completed && !result) return <CompletedBanner next={next} courseId={courseId} />

  if (result) {
    const showKey = result.passed
    return (
      <section ref={cardRef} className="space-y-5" aria-live="polite">
        <Result result={result} next={next} courseId={courseId} onRetry={retry} onExit={onExit} certificateName={certificateName} />
        <div className="space-y-3">
          <h3 className="font-semibold text-ink-900">{showKey ? 'Your answers' : 'How you did'}</h3>
          {!showKey && <p className="text-sm text-ink-500">Correct answers are shown once you pass. Go back to the lesson, study again, then retake the assessment.</p>}
          {questions.map((qq, i) => {
            const a = result.answers.find(x => x.question_id === qq.id)
            const pickedChoice = qq.choices.find(c => c.id === a?.selected_choice_id)
            return (
              <div key={qq.id} className={cn('rounded-2xl border p-4', a?.is_correct ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40')}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-ink-900">{i + 1}. {qq.text}</p>
                  <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs font-bold', a?.is_correct ? 'text-emerald-700' : 'text-red-700')}>
                    {a?.is_correct ? <CheckCircle2 size={14} /> : <X size={14} />} {a?.is_correct ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
                {showKey ? (
                  <ul className="space-y-1.5">
                    {qq.choices.map((c, ci) => {
                      const picked = a?.selected_choice_id === c.id
                      const right = a?.correct_choice_id === c.id
                      return (
                        <li key={c.id} className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                          right ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : picked ? 'border-red-300 bg-red-50 text-red-800' : 'border-ink-100 bg-white text-ink-600')}>
                          <span className="font-bold">{LETTERS[ci]}.</span><span className="flex-1">{c.text}</span>
                          {right && <span className="text-[11px] font-bold">Correct answer</span>}
                          {picked && <span className="text-[11px] font-bold">Your answer</span>}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-600">Your answer: <span className="font-semibold">{pickedChoice?.text ?? 'none'}</span></p>
                )}
                {showKey && a?.explanation && <p className="mt-2 text-xs text-ink-600"><strong>Explanation:</strong> {a.explanation}</p>}
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  if (!q) return null
  return (
    <section ref={cardRef} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white"><HelpCircle size={18} /></span>
          <div>
            <h2 className="font-display text-lg font-bold leading-tight text-ink-900">Lesson Assessment</h2>
            <p className="text-xs text-ink-500">Closed book · pass with {lesson.passing_score}%</p>
          </div>
        </div>
        <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">{Object.keys(answers).length}/{questions.length} answered</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={step + 1}>
        <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
      </div>

      <fieldset className="overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-sm">
        <legend className="sr-only">Question {step + 1}</legend>
        <div className="border-b border-ink-100 bg-ink-50 p-5">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-primary-700">Question {step + 1} of {questions.length}</p>
          <p className="text-base font-semibold leading-snug text-ink-900">{q.text}</p>
        </div>
        <ul className="space-y-2.5 p-4">
          {q.choices.map((c, ci) => {
            const on = chosen === c.id
            return (
              <li key={c.id}>
                <label className={cn('relative flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-primary-300',
                  on ? 'border-primary-500 bg-primary-50 text-ink-900' : 'border-ink-200 bg-white text-ink-800 hover:border-primary-300 hover:bg-primary-50/60')}>
                  <input type="radio" className="sr-only" name={`q-${q.id}`} checked={on}
                    onChange={() => setAnswers(p => ({ ...p, [q.id]: c.id }))} />
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', on ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-600')}>
                    {on ? <Check size={14} /> : LETTERS[ci]}
                  </span>
                  <span className="flex-1 leading-snug">{c.text}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <div className="flex items-center justify-between gap-3">
        <button type="button" className="btn-secondary btn-sm" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        <div className="hidden items-center gap-1.5 text-[11px] text-ink-400 sm:flex"><Keyboard size={13} /> Press A–D to answer, Enter for next</div>
        {last ? (
          <button type="button" className="btn-primary" disabled={chosen === null || submit.isPending || !allAnswered} onClick={() => submit.mutate()}>
            {submit.isPending ? 'Submitting...' : 'Submit Assessment'}
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={chosen === null} onClick={() => setStep(step + 1)}>Next Question</button>
        )}
      </div>
    </section>
  )
}

function Result({
  result, next, courseId, onRetry, onExit, certificateName,
}: { result: QuizResult; next: StateLesson | null; courseId: string; onRetry: () => void; onExit: () => void; certificateName: string }) {
  if (result.course_completed) {
    return (
      <div className="rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-6 text-center space-y-3">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white"><Award size={28} /></span>
        <h2 className="font-display font-extrabold text-2xl text-emerald-900">Course completed!</h2>
        <p className="text-sm text-emerald-800">You passed the last assessment ({result.score}/{result.max_score}) and finished every lesson.</p>
        <p className="text-sm text-ink-600">Your certificate was issued to <strong>{certificateName}</strong>.</p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {result.certificate_id && <Link to={`/certificates/${result.certificate_id}`} className="btn-primary gap-1.5"><ScrollText size={15} /> View Certificate</Link>}
          <Link to={`/lms/${courseId}/review`} className="btn-secondary gap-1.5"><RotateCcw size={15} /> Review Course</Link>
          <Link to="/lms" className="btn-secondary">My Learning</Link>
        </div>
      </div>
    )
  }
  if (result.passed) {
    return (
      <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 size={22} className="text-white" /></span>
          <div>
            <p className="font-bold text-emerald-800">You passed!</p>
            <p className="text-sm text-emerald-700">{result.score}/{result.max_score} correct ({result.percent}%). Passing score: {result.passing_score}%.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {next && <Link to={`/lms/${courseId}/lesson/${next.id}`} className="btn-primary btn-sm inline-flex gap-1">Next Lesson <ChevronRight size={14} /></Link>}
          <button type="button" onClick={onExit} className="btn-secondary btn-sm gap-1"><BookOpen size={13} /> Back to the lesson</button>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-10 h-10 rounded-full bg-red-400 flex items-center justify-center"><X size={22} className="text-white" /></span>
        <div>
          <p className="font-bold text-red-800">Not quite yet</p>
          <p className="text-sm text-red-700">{result.score}/{result.max_score} correct ({result.percent}%). You need {result.passing_score}% to unlock the next lesson.</p>
        </div>
      </div>
      <p className="text-sm text-red-800 mb-3">Study the lesson again, then retake the assessment. Your earlier attempts are kept.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onExit} className="btn-primary btn-sm gap-1"><BookOpen size={13} /> Review the lesson</button>
        <button type="button" onClick={onRetry} className="btn-secondary btn-sm gap-1"><RotateCcw size={13} /> Retake Assessment</button>
      </div>
    </div>
  )
}

function CompletedBanner({ next, courseId }: { next: StateLesson | null; courseId: string }) {
  return (
    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 flex items-center gap-4">
      <CheckCircle2 size={26} className="text-emerald-500 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-bold text-emerald-800">Lesson completed</p>
        <p className="text-sm text-emerald-700">You already passed this lesson. Use Review Course after finishing the whole course to see your answers.</p>
      </div>
      {next && <Link to={`/lms/${courseId}/lesson/${next.id}`} className="btn-primary btn-sm flex-shrink-0">Next lesson <ChevronRight size={14} /></Link>}
    </div>
  )
}

function NoQuizComplete({ enrollmentId, lessonId, onDone }: { enrollmentId: number; lessonId: number; onDone: () => void }) {
  const done = useMutation({
    mutationFn: () => apiClient.post(`/courses/enrollments/${enrollmentId}/mark_lesson_complete/`, { lesson_id: lessonId }),
    onSuccess: () => { toast.success('Lesson completed.'); onDone() },
    onError: e => toast.error(apiMessage(e)),
  })
  return (
    <section className="rounded-2xl border border-ink-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <p className="font-semibold text-ink-900">This lesson has no assessment</p>
        <p className="text-sm text-ink-500">Complete the lesson to unlock the next one.</p>
      </div>
      <button type="button" className="btn-primary" disabled={done.isPending} onClick={() => done.mutate()}>Complete Lesson</button>
    </section>
  )
}

function Notice({ icon, title, text, to, action }: { icon: React.ReactNode; title: string; text: string; to: string; action: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
      {icon}
      <p className="font-display font-bold text-lg text-ink-900">{title}</p>
      <p className="text-sm text-ink-600 max-w-sm">{text}</p>
      <Link to={to} className="btn-primary btn-sm">{action}</Link>
    </div>
  )
}
