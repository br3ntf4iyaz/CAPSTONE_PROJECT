import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, CheckCircle2, ChevronLeft, ChevronRight, HelpCircle,
  Menu, PlayCircle, X, AlertCircle, ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn, toArray } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Choice {
  id: number
  text: string
  order: number
}

interface Question {
  id: number
  text: string
  order: number
  choices: Choice[]
}

interface LessonDetail {
  id: number
  title: string
  order: number
  content: string
  video_url: string
  resource_file_url: string | null
  duration_minutes: number | null
  questions: Question[]
}

interface LessonItem {
  id: number
  title: string
  order: number
  duration_minutes: number | null
  video_url: string
}

interface ModuleItem {
  id: number
  title: string
  order: number
  lessons: LessonItem[]
}

interface CourseDetail {
  id: number
  title: string
  modules: ModuleItem[]
}

interface CourseMini {
  id: number
  title: string
}

interface Enrollment {
  id: number
  course: CourseMini
  progress_percent: number
  status: string
}

interface LessonProgressItem {
  lesson_id: number
  completed: boolean
  completed_at: string | null
}

interface QuizResultAnswer {
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
  answers: QuizResultAnswer[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getYouTubeId(url: string): string | null {
  const regexps = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?&#]+)/,
    /youtube\.com\/embed\/([^?&#]+)/,
  ]
  for (const re of regexps) {
    const match = url.match(re)
    if (match) return match[1]
  }
  return null
}

/**
 * Minimal markdown renderer: bold (**text**) + paragraphs + line breaks.
 * NOTE: content is admin-entered, not user-generated. dangerouslySetInnerHTML
 * is intentional here. Do not use this pattern for user-submitted content.
 */
function renderContent(text: string) {
  return text.split('\n\n').map((para, i) => {
    const html = para
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .split('\n').join('<br />')
    return (
      <p
        key={i}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
        className="mb-3 text-sm text-ink-700 leading-relaxed"
      />
    )
  })
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function allLessonsFlat(modules: ModuleItem[]): LessonItem[] {
  return [...modules]
    .sort((a, b) => a.order - b.order)
    .flatMap(m => [...m.lessons].sort((a, b) => a.order - b.order))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LessonPlayerPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [showSidebar, setShowSidebar] = useState(false)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizStep, setQuizStep] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([])

  // Pre-test state
  const [preTestDone, setPreTestDone] = useState(false)
  const [preTestStep, setPreTestStep] = useState(0)
  const [preTestAnswers, setPreTestAnswers] = useState<Record<number, number>>({})
  const [preTestSubmitted, setPreTestSubmitted] = useState(false)

  // ── Fetch course structure (for sidebar) ──────────────────────────────────
  const courseQ = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: () =>
      apiClient.get(`/courses/${courseId}/`).then(r => r.data as CourseDetail),
    enabled: !!courseId,
  })

  // ── Fetch lesson detail with questions ────────────────────────────────────
  const lessonQ = useQuery({
    queryKey: ['lesson-detail', lessonId],
    queryFn: () =>
      apiClient.get(`/courses/lessons/${lessonId}/`).then(r => r.data as LessonDetail),
    enabled: !!lessonId,
  })

  // ── Fetch enrollments ─────────────────────────────────────────────────────
  const enrollmentsQ = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () =>
      apiClient.get('/courses/enrollments/').then(r => toArray<Enrollment>(r.data)).catch(() => []),
  })

  const enrollment = useMemo(
    () => enrollmentsQ.data?.find(e => String(e.course.id) === courseId) ?? null,
    [enrollmentsQ.data, courseId],
  )

  // ── Fetch lesson progress ─────────────────────────────────────────────────
  const lessonProgressQ = useQuery({
    queryKey: ['lesson-progress', enrollment?.id],
    queryFn: () =>
      apiClient
        .get(`/courses/enrollments/${enrollment!.id}/lesson-progress/`)
        .then(r => toArray<LessonProgressItem>(r.data)),
    enabled: !!enrollment,
  })

  const completedLessonIds = useMemo(
    () => new Set((lessonProgressQ.data ?? []).map(p => p.lesson_id)),
    [lessonProgressQ.data],
  )

  // ── Navigation helpers ────────────────────────────────────────────────────
  const allLessons = useMemo(
    () => (courseQ.data ? allLessonsFlat(courseQ.data.modules) : []),
    [courseQ.data],
  )
  const currentIdx = allLessons.findIndex(l => String(l.id) === lessonId)
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null
  const isLastLesson = currentIdx === allLessons.length - 1

  const lesson = lessonQ.data
  const course = courseQ.data
  const isAlreadyPassed = !!lesson && completedLessonIds.has(lesson.id)
  const hasQuestions = !!lesson?.questions?.length

  // ── Quiz submit mutation ──────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: (payload: { enrollment_id: number; lesson_id: number; answers: { question_id: number; choice_id: number }[] }) =>
      apiClient.post(`/courses/lessons/${lessonId}/submit-quiz/`, payload).then(r => r.data as QuizResult),
    onSuccess: (result) => {
      setQuizResult(result)
      setQuizSubmitted(true)
      if (result.passed) {
        toast.success(`Passed! ${result.score}/${result.max_score} correct`)
        qc.invalidateQueries({ queryKey: ['lesson-progress', enrollment?.id] })
        qc.invalidateQueries({ queryKey: ['my-enrollments'] })
      } else {
        toast.error(`${result.score}/${result.max_score} \u2014 need 70% to pass`)
      }
    },
    onError: () => toast.error('Failed to submit quiz. Please try again.'),
  })

  // Initialise shuffledQuestions once lesson data arrives; reset pre-test for new lesson
  useEffect(() => {
    if (lesson?.questions?.length) {
      setShuffledQuestions(shuffle(lesson.questions))
    }
    setPreTestDone(false)
    setPreTestStep(0)
    setPreTestAnswers({})
    setPreTestSubmitted(false)
  }, [lesson?.id])

  const handleTimeUp = useCallback(() => {
    if (!lesson) return
    const questions = shuffledQuestions.length ? shuffledQuestions : (lesson.questions ?? [])
    if (quizStep >= questions.length - 1) {
      // Last question — auto-submit
      setQuizSubmitted(true)
      if (enrollment) {
        const answers = questions.map(q => ({
          question_id: q.id,
          choice_id: selectedAnswers[q.id],
        }))
        submitMutation.mutate({ enrollment_id: enrollment.id, lesson_id: lesson.id, answers })
      }
    } else {
      setQuizStep(prev => prev + 1)
    }
  }, [quizStep, shuffledQuestions, lesson, selectedAnswers, enrollment, submitMutation])

  useEffect(() => {
    if (!hasQuestions || quizSubmitted) return
    setTimeLeft(60)
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          handleTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [quizStep, quizSubmitted, hasQuestions])

  // ── Mark complete (no-quiz lessons) ──────────────────────────────────────
  const markCompleteMutation = useMutation({
    mutationFn: () =>
      apiClient
        .post(`/courses/enrollments/${enrollment!.id}/mark_lesson_complete/`, { lesson_id: Number(lessonId) })
        .then(r => r.data),
    onSuccess: () => {
      toast.success('Lesson marked complete!')
      qc.invalidateQueries({ queryKey: ['lesson-progress', enrollment?.id] })
      qc.invalidateQueries({ queryKey: ['my-enrollments'] })
    },
    onError: () => toast.error('Could not mark lesson complete.'),
  })

  function handleSubmitQuiz() {
    if (!enrollment || !lesson) return
    const questions = shuffledQuestions.length ? shuffledQuestions : lesson.questions
    const answers = questions.map(q => ({
      question_id: q.id,
      choice_id: selectedAnswers[q.id],
    }))
    submitMutation.mutate({
      enrollment_id: enrollment.id,
      lesson_id: lesson.id,
      answers,
    })
  }

  function handleRetryQuiz() {
    setSelectedAnswers({})
    setQuizResult(null)
    setQuizSubmitted(false)
    setQuizStep(0)
    setShuffledQuestions(shuffle(lesson?.questions ?? []))
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (lessonQ.isLoading || courseQ.isLoading) return <PageSpinner />

  if (lessonQ.isError || !lesson || courseQ.isError || !course) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle size={40} className="text-alert-400" />
        <p className="text-ink-600 font-semibold">Could not load lesson.</p>
        <Link to={`/lms/${courseId}`} className="btn-secondary btn-sm">Back to course</Link>
      </div>
    )
  }

  const videoId = lesson.video_url ? getYouTubeId(lesson.video_url) : null

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6">

      {/* ── Sidebar overlay on mobile ──────────────────────────────────────── */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed lg:relative inset-y-0 left-0 z-40 flex flex-col w-72 bg-white border-r border-ink-100 transition-transform duration-200',
          showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between gap-2 p-4 border-b border-ink-100 flex-shrink-0">
          <Link
            to={`/lms/${courseId}`}
            className="flex items-center gap-2 text-xs font-semibold text-ink-500 hover:text-ink-800 transition-colors min-w-0"
          >
            <ArrowLeft size={14} className="flex-shrink-0" />
            <span className="truncate">{course.title}</span>
          </Link>
          <button type="button" onClick={() => setShowSidebar(false)} className="lg:hidden p-1 rounded-lg hover:bg-ink-100">
            <X size={16} />
          </button>
        </div>

        {/* Module + lesson list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {[...course.modules]
            .sort((a, b) => a.order - b.order)
            .map(mod => (
              <div key={mod.id}>
                <p className="px-4 py-2 text-[10px] font-bold text-ink-400 uppercase tracking-wider">
                  {mod.title}
                </p>
                {[...mod.lessons]
                  .sort((a, b) => a.order - b.order)
                  .map((l, idx, arr) => {
                    const isCurrentLesson = String(l.id) === lessonId
                    const isCompleted = completedLessonIds.has(l.id)
                    return (
                      <Link
                        key={l.id}
                        to={`/lms/${courseId}/lesson/${l.id}`}
                        onClick={() => setShowSidebar(false)}
                        className={cn(
                          'flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
                          isCurrentLesson
                            ? 'bg-primary-50 text-primary-700 font-semibold border-r-2 border-primary-600'
                            : 'text-ink-700 hover:bg-ink-50',
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                        ) : (
                          <span className={cn(
                            'w-3.5 h-3.5 rounded-full border-2 flex-shrink-0',
                            isCurrentLesson ? 'border-primary-600' : 'border-ink-300',
                          )} />
                        )}
                        <span className="truncate leading-tight">{l.title}</span>
                      </Link>
                    )
                  })}
              </div>
            ))}
        </nav>

        {/* Back link at bottom */}
        <div className="p-4 border-t border-ink-100 flex-shrink-0">
          <Link
            to={`/lms/${courseId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800 transition-colors"
          >
            <ArrowLeft size={13} /> Back to Course
          </Link>
        </div>
      </aside>

      {/* ── Main panel ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-100 bg-white lg:hidden flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowSidebar(true)}
            className="p-1.5 rounded-lg hover:bg-ink-100"
          >
            <Menu size={18} />
          </button>
          <p className="font-semibold text-sm text-ink-900 truncate flex-1">{lesson.title}</p>
          <span className="text-xs text-ink-400 flex-shrink-0">
            {currentIdx + 1}/{allLessons.length}
          </span>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8 pb-24">

            {/* ── Pre-test ──────────────────────────────────────────────── */}
            {hasQuestions && !preTestDone && (
              <section className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <HelpCircle size={20} className="text-amber-500" />
                      <h2 className="font-display font-bold text-lg text-ink-900">Pre-Lesson Check</h2>
                    </div>
                    <p className="text-sm text-ink-500">
                      Before watching this lesson, let's check what you already know.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreTestDone(true)}
                    className="btn-secondary btn-sm flex-shrink-0 text-xs"
                  >
                    Skip Pre-test
                  </button>
                </div>

                {preTestSubmitted ? (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-center space-y-4">
                    <p className="font-semibold text-amber-800">Thank you! You can now watch the lesson.</p>
                    <button
                      type="button"
                      onClick={() => setPreTestDone(true)}
                      className="btn-primary"
                    >
                      Continue to Lesson
                    </button>
                  </div>
                ) : (
                  (() => {
                    const questions = lesson.questions
                    const total = questions.length
                    const q = questions[preTestStep]
                    if (!q) return null
                    const isLastQuestion = preTestStep === total - 1
                    const currentAnswer = preTestAnswers[q.id] ?? null

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
                            Question {preTestStep + 1} of {total}
                          </span>
                        </div>

                        <QuestionCard
                          question={q}
                          questionNumber={preTestStep + 1}
                          selectedChoiceId={currentAnswer}
                          submitted={false}
                          resultAnswer={null}
                          onSelect={(choiceId) => {
                            setPreTestAnswers(prev => ({ ...prev, [q.id]: choiceId }))
                          }}
                        />

                        <button
                          type="button"
                          disabled={currentAnswer === null}
                          onClick={() => {
                            if (isLastQuestion) {
                              setPreTestSubmitted(true)
                            } else {
                              setPreTestStep(prev => prev + 1)
                            }
                          }}
                          className={cn(
                            'mt-2 w-full btn-primary justify-center',
                            currentAnswer === null && 'opacity-50 cursor-not-allowed',
                          )}
                        >
                          {isLastQuestion ? 'Finish Pre-test' : 'Next'}
                        </button>
                      </div>
                    )
                  })()
                )}
              </section>
            )}

            {/* Lesson content — shown after pre-test (or when no questions) */}
            {(!hasQuestions || preTestDone) && (
              <>

            {/* Lesson title */}
            <div>
              <h1 className="font-display font-bold text-2xl text-ink-900">{lesson.title}</h1>
              {lesson.duration_minutes && (
                <p className="text-sm text-ink-500 mt-1">{lesson.duration_minutes} min</p>
              )}
            </div>

            {/* ── Video Player ──────────────────────────────────────────── */}
            <section>
              {videoId ? (
                <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-lg" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                    title={lesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="relative w-full rounded-2xl overflow-hidden bg-ink-100 flex flex-col items-center justify-center py-16 gap-3" style={{ aspectRatio: '16/9' }}>
                  <PlayCircle size={48} className="text-ink-300" />
                  <p className="text-sm text-ink-500 font-medium">No video for this lesson</p>
                </div>
              )}
            </section>

            {/* ── Lesson Notes ──────────────────────────────────────────── */}
            <section>
              <h2 className="font-display font-bold text-lg text-ink-900 mb-4">Lesson Notes</h2>
              <div className="prose-sm">{renderContent(lesson.content)}</div>
            </section>

            {/* ── Quiz / Knowledge Check ────────────────────────────────── */}
            {hasQuestions ? (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <HelpCircle size={20} className="text-primary-600" />
                  <h2 className="font-display font-bold text-lg text-ink-900">Knowledge Check</h2>
                </div>

                {/* Already passed banner */}
                {isAlreadyPassed && !quizSubmitted ? (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 flex items-center gap-4">
                    <CheckCircle2 size={28} className="text-emerald-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-emerald-800">Lesson Complete!</p>
                      <p className="text-sm text-emerald-700">You've already passed this lesson's quiz.</p>
                    </div>
                    {nextLesson && (
                      <Link
                        to={`/lms/${courseId}/lesson/${nextLesson.id}`}
                        className="btn-primary btn-sm flex-shrink-0"
                      >
                        Next lesson <ChevronRight size={14} />
                      </Link>
                    )}
                  </div>
                ) : quizSubmitted && quizResult ? (
                  /* Results only — hide question UI entirely */
                  <ResultBanner
                    result={quizResult}
                    isLastLesson={isLastLesson}
                    nextLessonId={nextLesson?.id ?? null}
                    courseId={courseId!}
                    onRetry={handleRetryQuiz}
                  />
                ) : (
                  <>
                    {/* Instructions */}
                    <p className="text-sm text-ink-500 mb-5 bg-ink-50 rounded-xl px-4 py-3">
                      Answer each question to proceed. You need <strong>70%</strong> to pass and unlock the next lesson.
                    </p>

                    {/* Sequential question */}
                    {(() => {
                      const questions = shuffledQuestions.length ? shuffledQuestions : lesson.questions
                      const total = questions.length
                      const q = questions[quizStep]
                      if (!q) return null
                      const isLastQuestion = quizStep === total - 1
                      const currentAnswer = selectedAnswers[q.id] ?? null

                      return (
                        <div className="space-y-4">
                          {/* Progress + timer row */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
                              Question {quizStep + 1} of {total}
                            </span>
                            <span className={cn(
                              'text-sm font-bold tabular-nums',
                              timeLeft <= 10 ? 'text-red-500' : 'text-ink-500',
                            )}>
                              ⏱ {timeLeft}s remaining
                            </span>
                          </div>

                          <QuestionCard
                            question={q}
                            questionNumber={quizStep + 1}
                            selectedChoiceId={currentAnswer}
                            submitted={false}
                            resultAnswer={null}
                            onSelect={(choiceId) => {
                              setSelectedAnswers(prev => ({ ...prev, [q.id]: choiceId }))
                            }}
                          />

                          {/* Next / Submit button */}
                          <button
                            type="button"
                            disabled={currentAnswer === null || submitMutation.isPending}
                            onClick={() => {
                              if (isLastQuestion) {
                                handleSubmitQuiz()
                              } else {
                                setQuizStep(prev => prev + 1)
                              }
                            }}
                            className={cn(
                              'mt-2 w-full btn-primary justify-center',
                              (currentAnswer === null || submitMutation.isPending) && 'opacity-50 cursor-not-allowed',
                            )}
                          >
                            {submitMutation.isPending
                              ? 'Submitting…'
                              : isLastQuestion
                                ? 'Submit Quiz'
                                : 'Next'}
                          </button>
                        </div>
                      )
                    })()}
                  </>
                )}
              </section>
            ) : (
              /* No quiz \u2014 show Mark as Complete */
              <section>
                {isAlreadyPassed ? (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 flex items-center gap-4">
                    <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0" />
                    <p className="font-semibold text-emerald-800 flex-1">Lesson Complete!</p>
                    {nextLesson && (
                      <Link
                        to={`/lms/${courseId}/lesson/${nextLesson.id}`}
                        className="btn-primary btn-sm flex-shrink-0"
                      >
                        Next lesson <ChevronRight size={14} />
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-ink-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-ink-900">Done watching?</p>
                      <p className="text-sm text-ink-500">Mark this lesson complete to unlock the next one.</p>
                    </div>
                    <button
                      type="button"
                      disabled={markCompleteMutation.isPending || !enrollment}
                      onClick={() => markCompleteMutation.mutate()}
                      className="btn-primary flex-shrink-0 justify-center"
                    >
                      {markCompleteMutation.isPending ? 'Saving…' : 'Mark as Complete'}
                    </button>
                  </div>
                )}
              </section>
            )}
              </>
            )}

          </div>
        </div>

        {/* ── Bottom navigation bar ─────────────────────────────────────── */}
        <nav className="flex-shrink-0 border-t border-ink-100 bg-white px-4 py-3 flex items-center justify-between gap-4">
          {prevLesson ? (
            <Link
              to={`/lms/${courseId}/lesson/${prevLesson.id}`}
              className="btn-secondary btn-sm"
            >
              <ChevronLeft size={15} /> Previous
            </Link>
          ) : (
            <div />
          )}

          <span className="text-xs font-semibold text-ink-400 tabular-nums">
            {currentIdx + 1} / {allLessons.length}
          </span>

          {nextLesson ? (
            <Link
              to={`/lms/${courseId}/lesson/${nextLesson.id}`}
              className={cn(
                'btn-primary btn-sm',
                hasQuestions && !isAlreadyPassed && !(quizResult?.passed) && 'opacity-40 pointer-events-none',
              )}
            >
              Next <ChevronRight size={15} />
            </Link>
          ) : (
            <Link to={`/lms/${courseId}`} className="btn-secondary btn-sm">
              <BookOpen size={14} /> Course overview
            </Link>
          )}
        </nav>
      </main>
    </div>
  )
}

// ─── Question Card ────────────────────────────────────────────────────────────

function QuestionCard({
  question, questionNumber, selectedChoiceId, submitted, resultAnswer, onSelect,
}: {
  question: Question
  questionNumber: number
  selectedChoiceId: number | null
  submitted: boolean
  resultAnswer: QuizResultAnswer | null
  onSelect: (choiceId: number) => void
}) {
  return (
    <div className="rounded-2xl border border-ink-200 overflow-hidden">
      <div className="p-4 bg-ink-50 border-b border-ink-100">
        <p className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-1">
          Question {questionNumber}
        </p>
        <p className="font-semibold text-ink-900 text-sm leading-snug">{question.text}</p>
      </div>
      <ul className="p-3 space-y-2">
        {question.choices.map(choice => {
          const isSelected = selectedChoiceId === choice.id
          const isCorrectChoice = resultAnswer?.correct_choice_id === choice.id
          const isWrongSelection = submitted && isSelected && !resultAnswer?.is_correct

          let choiceStyle = 'bg-white border-ink-200 hover:border-primary-300 hover:bg-primary-50'
          if (!submitted && isSelected) {
            choiceStyle = 'bg-primary-50 border-primary-500'
          } else if (submitted) {
            if (isCorrectChoice) {
              choiceStyle = 'bg-emerald-50 border-emerald-400'
            } else if (isWrongSelection) {
              choiceStyle = 'bg-red-50 border-red-400'
            } else {
              choiceStyle = 'bg-white border-ink-100 opacity-60'
            }
          }

          return (
            <li key={choice.id}>
              <button
                type="button"
                disabled={submitted}
                onClick={() => onSelect(choice.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors text-sm font-medium',
                  choiceStyle,
                  !submitted && 'cursor-pointer',
                  submitted && 'cursor-default',
                )}
              >
                {/* State indicator dot / icon */}
                <span className={cn(
                  'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                  !submitted && isSelected ? 'border-primary-500 bg-primary-500' : '',
                  !submitted && !isSelected ? 'border-ink-300' : '',
                  submitted && isCorrectChoice ? 'border-emerald-500 bg-emerald-500' : '',
                  submitted && isWrongSelection ? 'border-red-400 bg-red-400' : '',
                  submitted && !isCorrectChoice && !isWrongSelection ? 'border-ink-200' : '',
                )}>
                  {submitted && isCorrectChoice && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {submitted && isWrongSelection && (
                    <X size={8} className="text-white" />
                  )}
                </span>
                <span className={cn(
                  submitted && isCorrectChoice ? 'text-emerald-800 font-semibold' : '',
                  submitted && isWrongSelection ? 'text-red-700' : '',
                )}>
                  {choice.text}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {/* Explanation (shown after submit) */}
      {submitted && resultAnswer?.explanation && (
        <div className="px-4 pb-4">
          <div className={cn(
            'rounded-xl px-4 py-3 text-sm',
            resultAnswer.is_correct ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800',
          )}>
            <span className="font-semibold">Explanation: </span>
            {resultAnswer.explanation}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Result Banner ────────────────────────────────────────────────────────────

function ResultBanner({
  result, isLastLesson, nextLessonId, courseId, onRetry,
}: {
  result: QuizResult
  isLastLesson: boolean
  nextLessonId: number | null
  courseId: string
  onRetry: () => void
}) {
  if (result.passed) {
    return (
      <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={22} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-emerald-800 text-base">You passed!</p>
            <p className="text-sm text-emerald-700">
              {result.score}/{result.max_score} correct ({result.percent}%)
            </p>
          </div>
        </div>
        {isLastLesson ? (
          <Link to={`/lms/${courseId}`} className="inline-flex items-center gap-2 btn-primary btn-sm">
            <BookOpen size={14} /> Course Complete &mdash; View Overview
          </Link>
        ) : nextLessonId ? (
          <Link
            to={`/lms/${courseId}/lesson/${nextLessonId}`}
            className="inline-flex items-center gap-2 btn-primary btn-sm"
          >
            Next Lesson <ChevronRight size={14} />
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-red-400 flex items-center justify-center flex-shrink-0">
          <X size={22} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-red-800 text-base">Not quite!</p>
          <p className="text-sm text-red-700">
            {result.score}/{result.max_score} correct ({result.percent}%) &mdash; Need 70% to pass
          </p>
        </div>
      </div>
      <button type="button" onClick={onRetry} className="btn-secondary btn-sm">
        Try Again
      </button>
    </div>
  )
}
