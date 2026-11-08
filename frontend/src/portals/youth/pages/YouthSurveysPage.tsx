import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, CheckCircle2, ChevronRight, ArrowLeft, Send,
  Star, Lock, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { QueryError } from '@/components/ui/QueryError'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, toArray } from '@/utils'
import { useAuthStore } from '@/store/authStore'

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
  event: number | null
  is_active: boolean
  created_at: string
  response_count: number
  has_responded: boolean
  questions: SurveyQuestion[]
}

type Answers = Record<string, string | number>

// ─── Question input components ────────────────────────────────────────────────

function RatingInput({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`transition-all ${(value ?? 0) >= n ? 'text-amber-400 scale-110' : 'text-gray-200 hover:text-amber-300'}`}
        >
          <Star size={32} fill={(value ?? 0) >= n ? 'currentColor' : 'none'} />
        </button>
      ))}
      {value ? <span className="ml-2 text-sm text-gray-500 font-medium">{value}/5</span> : null}
    </div>
  )
}

function ScaleInput({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-10 h-10 rounded-xl text-sm font-semibold border-2 transition-all ${
              value === n
                ? 'bg-primary text-white border-primary scale-110 shadow-md'
                : 'border-gray-200 text-gray-600 hover:border-primary/50 hover:text-primary'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 px-1">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  )
}

function YesNoInput({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-3">
      {['yes', 'no'].map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all capitalize ${
            value === opt
              ? opt === 'yes'
                ? 'bg-green-500 text-white border-green-500 shadow-md'
                : 'bg-red-400 text-white border-red-400 shadow-md'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          {opt === 'yes' ? '👍 Yes' : '👎 No'}
        </button>
      ))}
    </div>
  )
}

function MultipleChoiceInput({
  choices,
  value,
  onChange,
  questionId,
}: {
  choices: string[]
  value?: string
  onChange: (v: string) => void
  questionId: number
}) {
  return (
    <div className="flex flex-col gap-2">
      {choices.map(opt => (
        <label
          key={opt}
          className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 transition-all ${
            value === opt
              ? 'border-primary bg-primary/5'
              : 'border-gray-100 hover:border-gray-200 bg-white'
          }`}
        >
          <input
            type="radio"
            name={`q_${questionId}`}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="w-4 h-4 text-primary accent-primary"
          />
          <span className={`text-sm ${value === opt ? 'text-primary font-medium' : 'text-gray-700'}`}>{opt}</span>
        </label>
      ))}
    </div>
  )
}

function NumberInput({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      value={value ?? ''}
      onChange={e => {
        const n = parseFloat(e.target.value)
        if (!isNaN(n)) onChange(n)
      }}
      placeholder="Enter a number…"
      className="input w-40 text-lg font-semibold text-center"
    />
  )
}

function TextInput({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <textarea
      rows={3}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder="Write your answer here…"
      className="input w-full resize-none text-sm"
    />
  )
}

// ─── Question renderer ────────────────────────────────────────────────────────

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion
  value: string | number | undefined
  onChange: (val: string | number) => void
}) {
  switch (question.question_type) {
    case 'rating':
      return <RatingInput value={value as number} onChange={onChange} />
    case 'scale':
      return <ScaleInput value={value as number} onChange={onChange} />
    case 'yes_no':
      return <YesNoInput value={value as string} onChange={onChange} />
    case 'multiple_choice':
      return (
        <MultipleChoiceInput
          choices={question.choices}
          value={value as string}
          onChange={onChange}
          questionId={question.id}
        />
      )
    case 'number':
      return <NumberInput value={value as number} onChange={onChange} />
    default:
      return <TextInput value={value as string} onChange={onChange} />
  }
}

// ─── Survey Form (sequential locked questions) ────────────────────────────────

function SurveyForm({ survey, onBack }: { survey: Survey; onBack: () => void }) {
  const qc = useQueryClient()
  const [answers, setAnswers] = useState<Answers>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const questions = survey.questions
  const total = questions.length
  const currentQ = questions[currentIdx]
  const currentAnswer = currentQ ? answers[String(currentQ.id)] : undefined
  const hasAnswer = currentAnswer !== undefined && currentAnswer !== ''

  const submit = useMutation({
    mutationFn: () => apiClient.post(`/events/surveys/${survey.id}/submit/`, { answers }),
    onSuccess: () => {
      setSubmitted(true)
      qc.invalidateQueries({ queryKey: ['youth-surveys'] })
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.non_field_errors?.[0] ??
        err?.response?.data?.detail ??
        'Failed to submit survey.'
      toast.error(msg)
    },
  })

  if (submitted) {
    return (
      <div className="space-y-5 max-w-xl mx-auto text-center">
        <div className="card p-10 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800">Thank you!</h2>
          <p className="text-gray-500 text-sm max-w-xs">
            Your response has been recorded. Your feedback helps improve youth services in Lucena City.
          </p>
          <button onClick={onBack} className="btn-primary mt-2">Back to Surveys</button>
        </div>
      </div>
    )
  }

  const progressPct = total > 0 ? Math.round((currentIdx / total) * 100) : 0

  return (
    <div className="space-y-5 max-w-xl">
      {/* Back */}
      <button onClick={onBack} className="btn-secondary btn-sm">
        <ArrowLeft size={14} /> Back to Surveys
      </button>

      {/* Header card */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold text-gray-800">{survey.title}</h2>
        {survey.description && <p className="text-sm text-gray-500 mt-1">{survey.description}</p>}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Question {currentIdx + 1} of {total}</span>
            <span>{progressPct}% complete</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Current question */}
      {currentQ && (
        <div className="card p-6 space-y-4">
          {/* Answered earlier questions (collapsed) */}
          {currentIdx > 0 && (
            <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
              <CheckCircle2 size={13} />
              {currentIdx} question{currentIdx !== 1 ? 's' : ''} answered
            </div>
          )}

          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
              {currentIdx + 1}
            </span>
            <p className="text-base font-medium text-gray-800 leading-snug pt-1">{currentQ.question}</p>
          </div>

          <div className="ml-11">
            <QuestionInput
              question={currentQ}
              value={currentAnswer}
              onChange={val => setAnswers(prev => ({ ...prev, [String(currentQ.id)]: val }))}
            />
          </div>
        </div>
      )}

      {/* Locked upcoming questions */}
      {questions.slice(currentIdx + 1, currentIdx + 3).map((q, offset) => (
        <div key={q.id} className="card p-4 opacity-50 pointer-events-none">
          <div className="flex items-center gap-3 text-gray-400">
            <Lock size={14} />
            <span className="text-sm">Question {currentIdx + offset + 2}: {q.question.length > 60 ? q.question.slice(0, 60) + '…' : q.question}</span>
          </div>
        </div>
      ))}
      {questions.length > currentIdx + 3 && (
        <p className="text-xs text-gray-400 text-center">
          +{questions.length - currentIdx - 3} more question{questions.length - currentIdx - 3 !== 1 ? 's' : ''} to unlock
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="btn-secondary btn-sm disabled:opacity-40"
        >
          <ArrowLeft size={14} /> Previous
        </button>

        {currentIdx < total - 1 ? (
          <button
            onClick={() => { if (hasAnswer) setCurrentIdx(i => i + 1) }}
            disabled={!hasAnswer}
            className="btn-primary btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title={!hasAnswer ? 'Please answer this question first' : ''}
          >
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={() => submit.mutate()}
            disabled={!hasAnswer || submit.isPending}
            className="btn-primary btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title={!hasAnswer ? 'Please answer this question first' : ''}
          >
            <Send size={14} />
            {submit.isPending ? 'Submitting…' : 'Submit Survey'}
          </button>
        )}
      </div>

      {!hasAnswer && (
        <p className="text-xs text-gray-400 text-center">
          Answer this question to {currentIdx < total - 1 ? 'continue' : 'submit'}.
        </p>
      )}
    </div>
  )
}

// ─── Survey card ──────────────────────────────────────────────────────────────

function SurveyCard({ survey, onSelect }: { survey: Survey; onSelect: () => void }) {
  if (survey.has_responded) {
    return (
      <div className="card p-5 opacity-80 cursor-default">
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={18} className="text-green-600" />
          </div>
          <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            Answered ✓
          </span>
        </div>
        <h3 className="font-semibold text-gray-700 mt-3 text-sm leading-snug">{survey.title}</h3>
        {survey.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{survey.description}</p>
        )}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Users size={11} />{survey.response_count} responses</span>
          <span className="ml-auto">{formatDate(survey.created_at)}</span>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={onSelect}
      className="card p-5 text-left hover:border-primary/30 hover:shadow-md transition-all group w-full"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <ClipboardList size={18} className="text-primary" />
        </div>
        <ChevronRight size={16} className="text-gray-400 group-hover:text-primary transition-colors mt-1 flex-shrink-0" />
      </div>
      <h3 className="font-semibold text-gray-800 mt-3 text-sm leading-snug">{survey.title}</h3>
      {survey.description && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{survey.description}</p>
      )}
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 flex-wrap">
        <span>{survey.questions.length} questions</span>
        <span className="flex items-center gap-1"><Users size={11} />{survey.response_count} responses</span>
        <span className="ml-auto">{formatDate(survey.created_at)}</span>
      </div>
    </button>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function YouthSurveysPage() {
  const [selected, setSelected] = useState<Survey | null>(null)
  const { isAuthenticated } = useAuthStore()

  const { data: surveys = [], isLoading, isError, refetch } = useQuery<Survey[]>({
    queryKey: ['youth-surveys'],
    queryFn: () => apiClient.get('/events/surveys/').then(r => toArray<Survey>(r.data)),
    enabled: isAuthenticated,
  })

  if (isLoading) return <ListSkeleton />
  if (isError) return <QueryError onRetry={() => refetch()} />

  if (selected) return <SurveyForm survey={selected} onBack={() => setSelected(null)} />

  const pending = surveys.filter(s => !s.has_responded)
  const answered = surveys.filter(s => s.has_responded)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Surveys &amp; Feedback</h1>
        <p className="page-subtitle">Share your opinions to help improve youth programs in Lucena City.</p>
      </div>

      {!isAuthenticated && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          <Lock size={16} className="flex-shrink-0" />
          <span>
            Please{' '}
            <Link to="/login" className="font-semibold underline hover:text-blue-900">
              log in
            </Link>{' '}
            to access surveys.
          </span>
        </div>
      )}

      {!isAuthenticated ? null : surveys.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No surveys available"
          description="Check back later for new surveys and feedback forms."
        />
      ) : (
        <>
          {/* Pending surveys */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                Awaiting Your Response ({pending.length})
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {pending.map(s => (
                  <SurveyCard key={s.id} survey={s} onSelect={() => setSelected(s)} />
                ))}
              </div>
            </div>
          )}

          {/* Answered surveys */}
          {answered.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                Already Answered ({answered.length})
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {answered.map(s => (
                  <SurveyCard key={s.id} survey={s} onSelect={() => {}} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
