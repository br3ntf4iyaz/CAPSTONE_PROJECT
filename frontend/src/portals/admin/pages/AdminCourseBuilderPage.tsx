import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Trash2, Edit2, ChevronDown, ChevronRight,
  Video, FileText, HelpCircle, CheckCircle2, Circle, GripVertical,
  Save, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { cn } from '@/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Choice { id?: number; text: string; is_correct: boolean; order: number }
interface Question { id: number; text: string; order: number; explanation: string; choices: Choice[] }
interface Lesson { id: number; title: string; order: number; content: string; video_url: string; duration_minutes: number | null; questions: Question[] }
interface Module { id: number; title: string; order: number; description: string; lessons: Lesson[] }
interface CourseDetail { id: number; title: string; category: string; description: string }

const BASE = (id: number) => `/courses/admin/courses/${id}`

// ─── Inline editable text ────────────────────────────────────────────────────
function InlineEdit({ value, onSave, placeholder, className = '' }: {
  value: string; onSave: (v: string) => void; placeholder?: string; className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (!editing) return (
    <span
      className={cn('cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 transition-colors', className)}
      onClick={() => { setDraft(value); setEditing(true) }}
      title="Click to edit"
    >{value || <span className="text-gray-400 italic">{placeholder}</span>}</span>
  )
  return (
    <span className="flex items-center gap-1">
      <input
        autoFocus
        className="border border-primary-400 rounded px-1 py-0.5 text-sm outline-none min-w-0 flex-1"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(draft); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
      />
      <button onClick={() => { onSave(draft); setEditing(false) }} className="text-primary-700 hover:text-primary-900"><Save size={13} /></button>
      <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
    </span>
  )
}

// ─── Question editor ─────────────────────────────────────────────────────────
function QuestionEditor({ question, courseId, moduleId, lessonId, onDelete }: {
  question: Question; courseId: number; moduleId: number; lessonId: number; onDelete: () => void
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Question>({ ...question, choices: question.choices.map(c => ({ ...c })) })

  const save = useMutation({
    mutationFn: () => apiClient.patch(
      `${BASE(courseId)}/modules/${moduleId}/lessons/${lessonId}/questions/${question.id}/`,
      draft
    ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['builder', courseId] }); toast.success('Question saved') },
    onError: () => toast.error('Failed to save question'),
  })

  const del = useMutation({
    mutationFn: () => apiClient.delete(
      `${BASE(courseId)}/modules/${moduleId}/lessons/${lessonId}/questions/${question.id}/`
    ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['builder', courseId] }); onDelete() },
    onError: () => toast.error('Failed to delete question'),
  })

  const setCorrect = (idx: number) => {
    setDraft(d => ({ ...d, choices: d.choices.map((c, i) => ({ ...c, is_correct: i === idx })) }))
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <HelpCircle size={13} className="text-purple-500 flex-shrink-0" />
        {open ? <ChevronDown size={13} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={13} className="text-gray-400 flex-shrink-0" />}
        <span className="text-sm font-medium flex-1 truncate">{draft.text || 'New question'}</span>
        <button
          onClick={e => { e.stopPropagation(); if (window.confirm('Delete this question?')) del.mutate() }}
          className="text-red-400 hover:text-red-600 p-1"
        ><Trash2 size={12} /></button>
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-200 pt-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Question text</label>
            <textarea
              className="input text-sm min-h-[60px] w-full"
              value={draft.text}
              onChange={e => setDraft(d => ({ ...d, text: e.target.value }))}
              placeholder="Enter question…"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Choices <span className="text-gray-400 font-normal">(click circle to mark correct)</span></label>
            <div className="space-y-1.5">
              {draft.choices.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button onClick={() => setCorrect(i)} className="flex-shrink-0">
                    {c.is_correct
                      ? <CheckCircle2 size={16} className="text-green-600" />
                      : <Circle size={16} className="text-gray-300 hover:text-gray-400" />}
                  </button>
                  <input
                    className="input text-sm flex-1 py-1"
                    value={c.text}
                    onChange={e => setDraft(d => ({
                      ...d,
                      choices: d.choices.map((ch, j) => j === i ? { ...ch, text: e.target.value } : ch)
                    }))}
                    placeholder={`Choice ${String.fromCharCode(65 + i)}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Explanation <span className="text-gray-400 font-normal">(shown after answering)</span></label>
            <textarea
              className="input text-sm min-h-[48px] w-full"
              value={draft.explanation}
              onChange={e => setDraft(d => ({ ...d, explanation: e.target.value }))}
              placeholder="Why is the correct answer correct?"
            />
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="btn-primary btn-sm text-xs"
          >
            {save.isPending ? 'Saving…' : 'Save Question'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Lesson editor ────────────────────────────────────────────────────────────
function LessonEditor({ lesson, courseId, moduleId, onDelete }: {
  lesson: Lesson; courseId: number; moduleId: number; onDelete: () => void
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Omit<Lesson, 'id' | 'questions'>>({
    title: lesson.title, order: lesson.order, content: lesson.content,
    video_url: lesson.video_url, duration_minutes: lesson.duration_minutes,
  })

  const saveLesson = useMutation({
    mutationFn: () => apiClient.patch(`${BASE(courseId)}/modules/${moduleId}/lessons/${lesson.id}/`, draft),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['builder', courseId] }); toast.success('Lesson saved') },
    onError: () => toast.error('Failed to save lesson'),
  })

  const delLesson = useMutation({
    mutationFn: () => apiClient.delete(`${BASE(courseId)}/modules/${moduleId}/lessons/${lesson.id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['builder', courseId] }); onDelete() },
    onError: () => toast.error('Failed to delete lesson'),
  })

  const addQuestion = useMutation({
    mutationFn: () => apiClient.post(
      `${BASE(courseId)}/modules/${moduleId}/lessons/${lesson.id}/questions/`,
      { text: 'New question', order: lesson.questions.length, explanation: '', choices: [
        { text: '', is_correct: true, order: 0 },
        { text: '', is_correct: false, order: 1 },
        { text: '', is_correct: false, order: 2 },
        { text: '', is_correct: false, order: 3 },
      ] }
    ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['builder', courseId] }); setOpen(true) },
    onError: () => toast.error('Failed to add question'),
  })

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
        <FileText size={14} className="text-blue-500 flex-shrink-0" />
        {open ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
        <span className="text-sm font-semibold flex-1">{lesson.title || 'Untitled Lesson'}</span>
        {lesson.video_url && <Video size={13} className="text-indigo-400" />}
        <span className="text-xs text-gray-400">{lesson.questions.length} Q</span>
        <button
          onClick={e => { e.stopPropagation(); if (window.confirm('Delete this lesson?')) delLesson.mutate() }}
          className="text-red-400 hover:text-red-600 p-1"
        ><Trash2 size={13} /></button>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Lesson Title</label>
              <input className="input text-sm" value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs">Duration (minutes)</label>
              <input type="number" className="input text-sm" value={draft.duration_minutes ?? ''}
                onChange={e => setDraft(d => ({ ...d, duration_minutes: e.target.value ? Number(e.target.value) : null }))}
                placeholder="e.g. 15" min={0} />
            </div>
          </div>

          <div>
            <label className="label text-xs flex items-center gap-1"><Video size={12} /> Video URL</label>
            <input className="input text-sm" value={draft.video_url}
              onChange={e => setDraft(d => ({ ...d, video_url: e.target.value }))}
              placeholder="https://youtube.com/watch?v=… or embed URL" />
          </div>

          <div>
            <label className="label text-xs">Lesson Content / Notes</label>
            <textarea className="input text-sm min-h-[100px]" value={draft.content}
              onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
              placeholder="Write lesson text, notes, or reading material…" />
          </div>

          <button
            onClick={() => saveLesson.mutate()}
            disabled={saveLesson.isPending}
            className="btn-primary btn-sm text-xs"
          >
            {saveLesson.isPending ? 'Saving…' : 'Save Lesson'}
          </button>

          {/* Quiz Questions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Quiz Questions</span>
              <button
                onClick={() => addQuestion.mutate()}
                disabled={addQuestion.isPending}
                className="btn-secondary btn-sm text-xs flex items-center gap-1"
              >
                <Plus size={11} /> Add Question
              </button>
            </div>
            {lesson.questions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No quiz questions yet. Add one above.</p>
            ) : (
              <div className="space-y-2">
                {lesson.questions.map(q => (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    courseId={courseId}
                    moduleId={moduleId}
                    lessonId={lesson.id}
                    onDelete={() => qc.invalidateQueries({ queryKey: ['builder', courseId] })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Module block ─────────────────────────────────────────────────────────────
function ModuleBlock({ module, courseId }: { module: Module; courseId: number }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(true)

  const updateModule = useMutation({
    mutationFn: (data: Partial<Module>) =>
      apiClient.patch(`${BASE(courseId)}/modules/${module.id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['builder', courseId] }),
    onError: () => toast.error('Failed to update module'),
  })

  const delModule = useMutation({
    mutationFn: () => apiClient.delete(`${BASE(courseId)}/modules/${module.id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['builder', courseId] }),
    onError: () => toast.error('Failed to delete module'),
  })

  const addLesson = useMutation({
    mutationFn: () => apiClient.post(`${BASE(courseId)}/modules/${module.id}/lessons/`, {
      title: 'New Lesson', order: module.lessons.length, content: '', video_url: '',
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['builder', courseId] }); setOpen(true) },
    onError: () => toast.error('Failed to add lesson'),
  })

  return (
    <div className="card shadow-sm">
      {/* Module header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
        <button onClick={() => setOpen(o => !o)} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Module</span>
            <InlineEdit
              value={module.title}
              onSave={v => updateModule.mutate({ title: v })}
              placeholder="Module title"
              className="text-sm font-semibold text-gray-800"
            />
          </div>
          {module.description && (
            <InlineEdit
              value={module.description}
              onSave={v => updateModule.mutate({ description: v })}
              placeholder="Add description"
              className="text-xs text-gray-500 mt-0.5"
            />
          )}
        </div>
        <span className="text-xs text-gray-400">{module.lessons.length} lesson{module.lessons.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => { if (window.confirm(`Delete module "${module.title}"?`)) delModule.mutate() }}
          className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"
        ><Trash2 size={14} /></button>
      </div>

      {/* Lessons */}
      {open && (
        <div className="px-5 py-4 space-y-3">
          {module.lessons.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No lessons yet.</p>
          ) : (
            module.lessons.map(lesson => (
              <LessonEditor
                key={lesson.id}
                lesson={lesson}
                courseId={courseId}
                moduleId={module.id}
                onDelete={() => qc.invalidateQueries({ queryKey: ['builder', courseId] })}
              />
            ))
          )}
          <button
            onClick={() => addLesson.mutate()}
            disabled={addLesson.isPending}
            className="btn-secondary btn-sm text-xs flex items-center gap-1.5 w-full justify-center border-dashed"
          >
            <Plus size={13} /> Add Lesson
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminCourseBuilderPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const id = Number(courseId)
  const qc = useQueryClient()

  const courseQ = useQuery<CourseDetail>({
    queryKey: ['admin-course-detail', id],
    queryFn: () => apiClient.get(`${BASE(id)}/`).then(r => r.data),
  })

  const modulesQ = useQuery<Module[]>({
    queryKey: ['builder', id],
    queryFn: () => apiClient.get(`${BASE(id)}/modules/`).then(r => r.data),
  })

  const addModule = useMutation({
    mutationFn: () => apiClient.post(`${BASE(id)}/modules/`, {
      title: 'New Module', order: (modulesQ.data?.length ?? 0), description: '',
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['builder', id] }),
    onError: () => toast.error('Failed to add module'),
  })

  if (courseQ.isLoading || modulesQ.isLoading) return <PageSpinner />

  const course = courseQ.data!
  const modules = modulesQ.data ?? []

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/admin/lms" className="btn-secondary btn-sm flex items-center gap-1.5">
          <ArrowLeft size={14} /> Courses
        </Link>
        <div>
          <h1 className="page-title">{course.title}</h1>
          <p className="page-subtitle capitalize text-xs">{course.category.replace('_', ' ')} — Course Builder</p>
        </div>
      </div>

      {/* Builder */}
      <div className="space-y-4">
        {modules.length === 0 ? (
          <div className="card p-10 text-center">
            <FileText size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="font-semibold text-gray-700 mb-1">No modules yet</p>
            <p className="text-sm text-gray-500 mb-4">Add your first module to start building the course.</p>
            <button onClick={() => addModule.mutate()} disabled={addModule.isPending} className="btn-primary btn-sm mx-auto">
              <Plus size={14} /> Add First Module
            </button>
          </div>
        ) : (
          <>
            {modules.map(m => (
              <ModuleBlock key={m.id} module={m} courseId={id} />
            ))}
            <button
              onClick={() => addModule.mutate()}
              disabled={addModule.isPending}
              className="btn-secondary btn-sm flex items-center gap-1.5 border-dashed w-full justify-center"
            >
              <Plus size={14} /> Add Module
            </button>
          </>
        )}
      </div>
    </div>
  )
}
