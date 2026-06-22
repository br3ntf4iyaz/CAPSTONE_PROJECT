import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, Plus, BarChart2, X, ChevronDown, ChevronUp,
  Users, Star, ToggleLeft, Hash, AlignLeft, Sliders,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, toArray } from '@/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Survey {
  id: number
  title: string
  description: string
  is_active: boolean
  created_at: string
  response_count: number
  has_responded: boolean
  questions: {
    id: number
    question: string
    question_type: 'text' | 'rating' | 'scale' | 'multiple_choice' | 'yes_no' | 'number'
    choices: string[]
    order: number
  }[]
}

interface AnalyticsBreakdown {
  choice: string
  count: number
  pct: number
}

interface AnalyticsQuestion {
  question_id: number
  question: string
  question_type: string
  response_count: number
  average?: number
  breakdown: AnalyticsBreakdown[]
}

interface Analytics {
  survey_id: number
  title: string
  total_responses: number
  questions: AnalyticsQuestion[]
}

interface QForm {
  question: string
  type: 'text' | 'rating' | 'scale' | 'multiple_choice' | 'yes_no' | 'number'
  choices: string[]
}

const INITIAL_Q: QForm = { question: '', type: 'multiple_choice', choices: ['', ''] }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  rating: 'Rating 1–5',
  scale: 'Scale 1–10',
  yes_no: 'Yes / No',
  number: 'Number',
  text: 'Open Text',
}

function typeIcon(t: string) {
  if (t === 'rating') return <Star size={13} className="text-amber-500" />
  if (t === 'scale') return <Sliders size={13} className="text-blue-500" />
  if (t === 'yes_no') return <ToggleLeft size={13} className="text-green-500" />
  if (t === 'number') return <Hash size={13} className="text-purple-500" />
  if (t === 'multiple_choice') return <ClipboardList size={13} className="text-primary" />
  return <AlignLeft size={13} className="text-gray-400" />
}

// ─── Bar chart row ─────────────────────────────────────────────────────────────

function BarRow({ label, count, pct, max }: { label: string; count: number; pct: number; max: number }) {
  const barPct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="grid grid-cols-[130px_1fr_40px_36px] items-center gap-2 text-xs">
      <span className="text-gray-700 truncate" title={label}>{label}</span>
      <div className="h-5 bg-gray-100 rounded overflow-hidden">
        <div
          className="h-full bg-primary/70 rounded transition-all duration-500"
          style={{ width: `${barPct}%` }}
        />
      </div>
      <span className="text-right text-gray-600 font-medium">{count}</span>
      <span className="text-right text-gray-400">{pct}%</span>
    </div>
  )
}

// ─── Per-question analytics card ──────────────────────────────────────────────

function QuestionChart({ q }: { q: AnalyticsQuestion }) {
  const maxCount = Math.max(...q.breakdown.map(b => b.count), 1)

  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 mt-0.5">{typeIcon(q.question_type)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 leading-snug">{q.question}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>{TYPE_LABELS[q.question_type] ?? q.question_type}</span>
            <span>{q.response_count} response{q.response_count !== 1 ? 's' : ''}</span>
            {q.average !== undefined && q.average !== null && (
              <span className="text-primary font-semibold">avg {q.average}</span>
            )}
          </div>
        </div>
      </div>

      {q.question_type === 'text' ? (
        <div className="space-y-1 pl-5">
          {q.breakdown.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No text responses yet.</p>
          ) : (
            q.breakdown.slice(0, 5).map((b, i) => (
              <p key={i} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">"{b.choice}"</p>
            ))
          )}
          {q.breakdown.length > 5 && (
            <p className="text-xs text-gray-400 pl-2">+{q.breakdown.length - 5} more…</p>
          )}
        </div>
      ) : (
        <div className="pl-5 space-y-1.5">
          {q.breakdown.map((b, i) => (
            <BarRow key={i} label={b.choice} count={b.count} pct={b.pct} max={maxCount} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Analytics panel ──────────────────────────────────────────────────────────

function AnalyticsPanel({ surveyId, onClose }: { surveyId: number; onClose: () => void }) {
  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ['survey-analytics', surveyId],
    queryFn: () => apiClient.get(`/events/surveys/${surveyId}/analytics/`).then(r => r.data),
  })

  return (
    <div className="card p-5 border-l-4 border-primary/50 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-primary" />
          <h3 className="font-semibold text-gray-800">{data?.title ?? 'Analytics'}</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8 text-gray-400 text-sm">Loading analytics…</div>
      ) : !data ? (
        <p className="text-sm text-gray-400">No data available.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-primary/5 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{data.total_responses}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Responses</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{data.questions.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Questions</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {data.questions.length > 0
                  ? Math.round(data.questions.reduce((a, q) => a + q.response_count, 0) / data.questions.length)
                  : 0}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Avg Answers/Q</p>
            </div>
          </div>

          <div className="space-y-3">
            {data.questions.map(q => (
              <QuestionChart key={q.question_id} q={q} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Create Survey Modal ───────────────────────────────────────────────────────

function CreateSurveyModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<QForm[]>([{ ...INITIAL_Q, choices: ['', ''] }])
  const [saving, setSaving] = useState(false)

  const addQ = () => setQuestions(qs => [...qs, { question: '', type: 'multiple_choice', choices: ['', ''] }])
  const removeQ = (i: number) => setQuestions(qs => qs.filter((_, idx) => idx !== i))
  const updateQ = (i: number, field: keyof QForm, value: any) =>
    setQuestions(qs => qs.map((q, idx) => {
      if (idx !== i) return q
      if (field === 'type' && value === 'multiple_choice' && (!q.choices || q.choices.length === 0)) {
        return { ...q, type: value, choices: ['', ''] }
      }
      return { ...q, [field]: value }
    }))
  const addChoice = (qi: number) =>
    setQuestions(qs => qs.map((q, idx) => idx === qi ? { ...q, choices: [...q.choices, ''] } : q))
  const removeChoice = (qi: number, ci: number) =>
    setQuestions(qs => qs.map((q, idx) => idx === qi ? { ...q, choices: q.choices.filter((_, i) => i !== ci) } : q))
  const updateChoice = (qi: number, ci: number, val: string) =>
    setQuestions(qs => qs.map((q, idx) => idx === qi ? { ...q, choices: q.choices.map((c, i) => i === ci ? val : c) } : q))

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Survey title is required.'); return }
    const invalidQ = questions.findIndex(q => !q.question.trim())
    if (invalidQ !== -1) { toast.error(`Question ${invalidQ + 1} is empty.`); return }
    setSaving(true)
    try {
      // 1. Create survey
      const res = await apiClient.post('/events/surveys/', { title, description, is_active: true })
      const surveyId = res.data.id
      // 2. Add questions one by one
      for (const q of questions) {
        const choices = q.type === 'multiple_choice' ? q.choices.filter(c => c.trim()) : []
        await apiClient.post(`/events/surveys/${surveyId}/add-question/`, {
          question: q.question.trim(),
          type: q.type,
          choices,
        })
      }
      qc.invalidateQueries({ queryKey: ['admin-surveys'] })
      toast.success('Survey created!')
      onClose()
    } catch {
      toast.error('Failed to create survey.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Create Survey</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Survey Title *</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Youth Satisfaction Survey 2025" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[56px] resize-none" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description shown to respondents…" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Questions</label>
              <button onClick={addQ} className="text-xs text-primary-700 font-medium hover:underline flex items-center gap-1">
                <Plus size={13} /> Add Question
              </button>
            </div>
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-1">{i + 1}</span>
                    <div className="flex-1 space-y-2">
                      <input
                        className="input text-sm"
                        value={q.question}
                        onChange={e => updateQ(i, 'question', e.target.value)}
                        placeholder={`Question ${i + 1}`}
                      />
                      <select
                        className="input text-xs"
                        value={q.type}
                        onChange={e => updateQ(i, 'type', e.target.value)}
                      >
                        <option value="multiple_choice">Multiple Choice (select one)</option>
                        <option value="rating">Rating (1–5 stars)</option>
                        <option value="scale">Scale (1–10)</option>
                        <option value="yes_no">Yes / No</option>
                        <option value="number">Number</option>
                        <option value="text">Open-ended text</option>
                      </select>
                    </div>
                    {questions.length > 1 && (
                      <button onClick={() => removeQ(i)} className="text-gray-400 hover:text-red-500 mt-1">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {q.type === 'multiple_choice' && (
                    <div className="pl-7 space-y-1.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Choices</p>
                      {q.choices.map((c, ci) => (
                        <div key={ci} className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full border-2 border-gray-300 flex-shrink-0" />
                          <input
                            className="input text-xs py-1 flex-1"
                            value={c}
                            onChange={e => updateChoice(i, ci, e.target.value)}
                            placeholder={`Option ${ci + 1}`}
                          />
                          {q.choices.length > 2 && (
                            <button onClick={() => removeChoice(i, ci)} className="text-gray-300 hover:text-red-500">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addChoice(i)}
                        className="text-xs text-primary-600 font-medium flex items-center gap-1 mt-1 hover:underline"
                      >
                        <Plus size={11} /> Add option
                      </button>
                    </div>
                  )}

                  {q.type === 'rating' && (
                    <p className="pl-7 text-xs text-gray-400">Respondents will tap 1–5 stars.</p>
                  )}
                  {q.type === 'scale' && (
                    <p className="pl-7 text-xs text-gray-400">Respondents will pick a number from 1 to 10.</p>
                  )}
                  {q.type === 'yes_no' && (
                    <p className="pl-7 text-xs text-gray-400">Respondents will choose Yes or No.</p>
                  )}
                  {q.type === 'number' && (
                    <p className="pl-7 text-xs text-gray-400">Respondents will enter a numeric value.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="btn-primary btn-sm"
          >
            {saving ? 'Saving…' : 'Create Survey'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AdminSurveysPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [openAnalytics, setOpenAnalytics] = useState<number | null>(null)

  const { data: surveys = [], isLoading } = useQuery<Survey[]>({
    queryKey: ['admin-surveys'],
    queryFn: () => apiClient.get('/events/surveys/').then(r => toArray<Survey>(r.data)),
  })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Surveys</h1>
          <p className="page-subtitle">Create quantitative surveys and view response analytics.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
          <Plus size={15} /> Create Survey
        </button>
      </div>

      {/* Summary stats */}
      {surveys.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{surveys.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Surveys</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-primary">{surveys.reduce((a, s) => a + (s.response_count ?? 0), 0)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Responses</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{surveys.filter(s => s.is_active).length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Active Surveys</p>
          </div>
        </div>
      )}

      {/* Survey list */}
      {surveys.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No surveys yet"
          description="Create your first survey to start collecting quantitative data from youth."
          className="py-16"
        />
      ) : (
        <div className="space-y-3">
          {surveys.map(s => (
            <div key={s.id} className="card p-0 overflow-hidden">
              {/* Survey row */}
              <div className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ClipboardList size={18} className="text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800 text-sm truncate">{s.title}</h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.is_active ? 'Active' : 'Closed'}
                    </span>
                  </div>
                  {s.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{s.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1"><ClipboardList size={11} />{s.questions.length} questions</span>
                    <span className="flex items-center gap-1"><Users size={11} />{s.response_count ?? 0} responses</span>
                    <span>{formatDate(s.created_at)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setOpenAnalytics(openAnalytics === s.id ? null : s.id)}
                  className={`btn-sm flex items-center gap-1.5 text-xs flex-shrink-0 transition-colors ${openAnalytics === s.id ? 'btn-primary' : 'btn-secondary'}`}
                >
                  <BarChart2 size={13} />
                  Analytics
                  {openAnalytics === s.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {/* Inline analytics */}
              {openAnalytics === s.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <AnalyticsPanel surveyId={s.id} onClose={() => setOpenAnalytics(null)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && <CreateSurveyModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
