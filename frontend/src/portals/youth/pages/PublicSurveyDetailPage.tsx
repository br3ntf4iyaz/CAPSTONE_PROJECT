import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, Star, Users, ArrowRight, ArrowLeft,
  CheckCircle2, Lock, Send, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SurveyQuestion {
  id: number
  question: string
  question_type: 'text' | 'rating' | 'scale' | 'multiple_choice' | 'yes_no' | 'number'
  choices: string[]
  order: number
}

interface Survey {
  id: number
  title: string
  description: string
  is_active: boolean
  created_at: string
  response_count: number
  has_responded: boolean
  questions: SurveyQuestion[]
}

type Answers = Record<string, string | number>

// ─── Input Components ─────────────────────────────────────────────────────────

function RatingInput({ value, onChange, disabled }: { value?: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={cn(
            'transition-all',
            disabled ? 'cursor-not-allowed opacity-50' : '',
            (value ?? 0) >= n ? 'text-amber-400 scale-110' : 'text-gray-200 hover:text-amber-300',
          )}
        >
          <Star size={30} fill={(value ?? 0) >= n ? 'currentColor' : 'none'} />
        </button>
      ))}
      {value ? <span className="ml-1 text-sm text-gray-500 font-medium">{value}/5</span> : null}
    </div>
  )
}

function ScaleInput({ value, onChange, disabled }: { value?: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              'w-10 h-10 rounded-xl text-sm font-semibold border-2 transition-all',
              disabled ? 'cursor-not-allowed opacity-50' : '',
              value === n
                ? 'bg-primary-600 text-white border-primary-600 scale-110 shadow-md'
                : 'border-gray-200 text-gray-600 hover:border-primary-400 hover:text-primary-600',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 px-1">
        <span>Low</span><span>High</span>
      </div>
    </div>
  )
}

function YesNoInput({ value, onChange, disabled }: { value?: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-3">
      {['yes', 'no'].map(opt => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={cn(
            'flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all capitalize',
            disabled ? 'cursor-not-allowed opacity-50' : '',
            value === opt
              ? opt === 'yes'
                ? 'bg-green-500 text-white border-green-500 shadow-md'
                : 'bg-red-400 text-white border-red-400 shadow-md'
              : 'border-gray-200 text-gray-600 hover:border-gray-300',
          )}
        >
          {opt === 'yes' ? '👍 Yes' : '👎 No'}
        </button>
      ))}
    </div>
  )
}

function MultipleChoiceInput({
  choices, value, onChange, questionId, disabled,
}: {
  choices: string[]; value?: string; onChange: (v: string) => void; questionId: number; disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      {choices.map(opt => (
        <label
          key={opt}
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            value === opt
              ? 'border-primary-600 bg-primary-50'
              : 'border-gray-100 hover:border-gray-200 bg-white',
          )}
        >
          <input
            type="radio"
            name={`q_${questionId}`}
            value={opt}
            checked={value === opt}
            disabled={disabled}
            onChange={() => !disabled && onChange(opt)}
            className="w-4 h-4 accent-primary-600"
          />
          <span className={cn('text-sm', value === opt ? 'text-primary-700 font-medium' : 'text-gray-700')}>
            {opt}
          </span>
        </label>
      ))}
    </div>
  )
}

function TextInput({ value, onChange, disabled }: { value?: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <textarea
      rows={3}
      value={value ?? ''}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      placeholder={disabled ? 'Sign in to answer…' : 'Write your answer here…'}
      className={cn(
        'w-full rounded-xl border border-ink-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400',
        disabled ? 'bg-ink-50 cursor-not-allowed text-ink-400' : 'bg-white',
      )}
    />
  )
}

function NumberInput({ value, onChange, disabled }: { value?: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <input
      type="number"
      min={0}
      value={value ?? ''}
      disabled={disabled}
      onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(n) }}
      placeholder={disabled ? 'Sign in to answer…' : 'Enter a number…'}
      className={cn(
        'rounded-xl border border-ink-200 px-4 py-3 w-40 text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-primary-400',
        disabled ? 'bg-ink-50 cursor-not-allowed text-ink-400' : 'bg-white',
      )}
    />
  )
}

function QuestionCard({
  question, index, total, value, onChange, disabled,
}: {
  question: SurveyQuestion
  index: number
  total: number
  value: string | number | undefined
  onChange: (v: string | number) => void
  disabled?: boolean
}) {
  const TYPE_LABELS: Record<string, string> = {
    rating: '⭐ Rating',
    scale: '📊 Scale 1–10',
    yes_no: '✅ Yes / No',
    multiple_choice: '🔘 Multiple Choice',
    text: '✏️ Open-ended',
    number: '🔢 Number',
  }

  const renderInput = () => {
    switch (question.question_type) {
      case 'rating':
        return <RatingInput value={value as number} onChange={onChange} disabled={disabled} />
      case 'scale':
        return <ScaleInput value={value as number} onChange={onChange} disabled={disabled} />
      case 'yes_no':
        return <YesNoInput value={value as string} onChange={onChange} disabled={disabled} />
      case 'multiple_choice':
        return (
          <MultipleChoiceInput
            choices={question.choices}
            value={value as string}
            onChange={onChange}
            questionId={question.id}
            disabled={disabled}
          />
        )
      case 'number':
        return <NumberInput value={value as number} onChange={onChange} disabled={disabled} />
      default:
        return <TextInput value={value as string} onChange={onChange} disabled={disabled} />
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-ink-100 p-6 shadow-sm">
      {/* Question header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3 flex-1">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <p className="text-base font-semibold text-ink-900 leading-snug pt-1">
            {question.question}
          </p>
        </div>
        <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-ink-400 bg-ink-50 px-2 py-1 rounded-full">
          {TYPE_LABELS[question.question_type] ?? question.question_type}
        </span>
      </div>

      {/* Input */}
      <div className="ml-11">
        {renderInput()}
      </div>
    </div>
  )
}

// ─── Submitted screen ─────────────────────────────────────────────────────────

function SubmittedScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 size={40} className="text-green-500" />
      </div>
      <h2 className="font-display font-extrabold text-2xl text-ink-900 mb-3">Thank you!</h2>
      <p className="text-ink-500 leading-relaxed mb-8">
        Your response has been recorded. Your feedback helps improve youth services in Lucena City.
      </p>
      <button onClick={onBack} className="btn-primary">
        <ArrowLeft size={16} /> Back to surveys
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicSurveyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const qc = useQueryClient()

  const [answers, setAnswers] = useState<Answers>({})
  const [submitted, setSubmitted] = useState(false)

  const surveyQ = useQuery<Survey>({
    queryKey: ['public-survey-detail', id],
    queryFn: () => apiClient.get(`/events/surveys/${id}/`).then(r => r.data),
    enabled: !!id,
  })

  const submitMutation = useMutation({
    mutationFn: () => apiClient.post(`/events/surveys/${id}/submit/`, { answers }),
    onSuccess: () => {
      setSubmitted(true)
      qc.invalidateQueries({ queryKey: ['youth-surveys'] })
      qc.invalidateQueries({ queryKey: ['public-surveys-home'] })
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.non_field_errors?.[0] ??
        err?.response?.data?.detail ??
        'Failed to submit. Please try again.'
      toast.error(msg)
    },
  })

  const setAnswer = (questionId: number, value: string | number) => {
    setAnswers(prev => ({ ...prev, [String(questionId)]: value }))
  }

  if (surveyQ.isLoading) return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <PageSpinner />
    </div>
  )

  if (!surveyQ.data) return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-center">
      <ClipboardList size={48} className="text-ink-200 mx-auto mb-4" />
      <p className="text-ink-500">Survey not found.</p>
      <Link to="/participate" className="btn-primary mt-4 inline-flex">Back to surveys</Link>
    </div>
  )

  const survey = surveyQ.data
  const questions = survey.questions.slice().sort((a, b) => a.order - b.order)
  const answeredCount = Object.keys(answers).length
  const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <SubmittedScreen onBack={() => navigate('/participate')} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

      {/* Back */}
      <Link
        to="/participate"
        className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-800 mb-8 transition-colors"
      >
        <ArrowLeft size={15} /> Back to surveys
      </Link>

      {/* Survey header */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-7 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            <ClipboardList size={22} className="text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-extrabold text-2xl text-ink-900 leading-tight mb-2">
              {survey.title}
            </h1>
            {survey.description && (
              <p className="text-ink-600 text-sm leading-relaxed">{survey.description}</p>
            )}
            <div className="flex items-center gap-4 mt-4 text-sm text-ink-400">
              <span className="flex items-center gap-1.5">
                <ClipboardList size={13} /> {questions.length} questions
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={13} /> {survey.response_count} responses
              </span>
              {survey.has_responded && (
                <span className="flex items-center gap-1.5 text-green-600 font-semibold">
                  <CheckCircle2 size={13} /> You've responded
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar (only if authenticated) */}
        {isAuthenticated && questions.length > 0 && (
          <div className="mt-5 pt-5 border-t border-ink-100">
            <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
              <span>{answeredCount} of {questions.length} answered</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Questions */}
      {questions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-ink-100 p-10 text-center">
          <p className="text-ink-500 text-sm">This survey has no questions yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              total={questions.length}
              value={answers[String(q.id)]}
              onChange={val => setAnswer(q.id, val)}
              disabled={!isAuthenticated || survey.has_responded}
            />
          ))}
        </div>
      )}

      {/* Login wall / Submit area */}
      <div className="mt-8">
        {!isAuthenticated ? (
          /* Not logged in — login wall */
          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-7 text-center">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <Lock size={22} className="text-primary-600" />
            </div>
            <h3 className="font-display font-bold text-lg text-ink-900 mb-2">
              Sign in to submit your answers
            </h3>
            <p className="text-ink-500 text-sm mb-6 max-w-sm mx-auto">
              You can browse the questions freely. Create a free account or sign in to record your response.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to={`/login?next=/surveys/${id}`}
                className="btn-primary"
              >
                Sign in <ArrowRight size={15} />
              </Link>
              <Link to="/register" className="btn-secondary">
                Create free account
              </Link>
            </div>
          </div>
        ) : survey.has_responded ? (
          /* Already submitted */
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle2 size={28} className="text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-green-800 mb-1">You've already submitted a response.</p>
            <p className="text-green-600 text-sm">Thank you for participating in this survey.</p>
          </div>
        ) : (
          /* Authenticated — submit button */
          <div className="bg-white border border-ink-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-ink-900 text-sm">Ready to submit?</p>
              <p className="text-xs text-ink-500 mt-0.5">
                {answeredCount === 0
                  ? 'Answer at least one question to submit.'
                  : `You've answered ${answeredCount} of ${questions.length} questions.`}
              </p>
            </div>
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || answeredCount === 0}
              className="btn-primary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Submitting…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send size={15} /> Submit response
                </span>
              )}
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
