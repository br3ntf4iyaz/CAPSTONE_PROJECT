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
import { confirmDeletion } from '@/components/ui/ConfirmDialog'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Choice { id?: number; text: string; is_correct: boolean; order: number }
interface Question { id: number; text: string; order: number; explanation: string; choices: Choice[] }
interface Lesson {
  id: number; title: string; order: number; content: string; video_url: string; video_file_url?: string | null
  video_required_percent?: number; passing_score?: number | null; duration_minutes: number | null; questions: Question[]
  video_title?: string; video_manual_confirm?: boolean; study_resources?: { title: string; url: string; source?: string }[]
}
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
    onError: (e: any) => toast.error(e?.response?.data?.choices?.[0] ?? 'Failed to save question'),
  })

  const del = useMutation({
    mutationFn: () => apiClient.delete(
      `${BASE(courseId)}/modules/${moduleId}/lessons/${lessonId}/questions/${question.id}/`
    ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['builder', courseId] }); onDelete() },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to delete question'),
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
          onClick={async e => { e.stopPropagation(); if (await confirmDeletion({ what: 'question' })) del.mutate() }}
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
    video_required_percent: lesson.video_required_percent ?? 80, passing_score: lesson.passing_score ?? null,
    video_title: lesson.video_title ?? '', video_manual_confirm: lesson.video_manual_confirm ?? false,
    study_resources: (lesson.study_resources ?? []) as { title: string; url: string; source?: string }[],
  })

  const uploadVideo = useMutation({
    mutationFn: (file: File | null) => {
      if (file === null) return apiClient.patch(`${BASE(courseId)}/modules/${moduleId}/lessons/${lesson.id}/`, { video_file: null })
      const fd = new FormData()
      fd.append('video_file', file)
      return apiClient.patch(`${BASE(courseId)}/modules/${moduleId}/lessons/${lesson.id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['builder', courseId] }); toast.success('Video updated') },
    onError: (e: any) => toast.error(e?.response?.data?.video_file?.[0] ?? 'Could not save the video'),
  })

  const saveLesson = useMutation({
    mutationFn: () => apiClient.patch(`${BASE(courseId)}/modules/${moduleId}/lessons/${lesson.id}/`, draft),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['builder', courseId] }); toast.success('Lesson saved') },
    onError: (e: any) => {
      const d = e?.response?.data
      toast.error(d?.video_url?.[0] ?? d?.study_resources?.[0] ?? d?.video_required_percent?.[0] ?? d?.passing_score?.[0] ?? 'Failed to save lesson')
    },
  })

  const delLesson = useMutation({
    mutationFn: () => apiClient.delete(`${BASE(courseId)}/modules/${moduleId}/lessons/${lesson.id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['builder', courseId] }); onDelete() },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to delete lesson'),
  })

  const addQuestion = useMutation({
    mutationFn: () => apiClient.post(
      `${BASE(courseId)}/modules/${moduleId}/lessons/${lesson.id}/questions/`,
      { text: 'New question (edit me)', order: lesson.questions.length, explanation: '', choices: [
        { text: 'Choice A (edit me)', is_correct: true, order: 0 },
        { text: 'Choice B (edit me)', is_correct: false, order: 1 },
        { text: 'Choice C (edit me)', is_correct: false, order: 2 },
        { text: 'Choice D (edit me)', is_correct: false, order: 3 },
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
        {(lesson.video_url || lesson.video_file_url) ? <Video size={13} className="text-indigo-400" /> : <span className="text-[10px] font-semibold text-amber-600">no video</span>}
        <span className="text-xs text-gray-400">{lesson.questions.length} Q</span>
        <button
          onClick={async e => { e.stopPropagation(); if (await confirmDeletion({ what: 'lesson', note: 'Its questions will be removed too.' })) delLesson.mutate() }}
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

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1"><Video size={12} /> Lesson video</p>
            <div>
              <label className="label text-xs">Topic of the video <span className="text-gray-400 font-normal">(what learners should watch)</span></label>
              <input className="input text-sm" value={draft.video_title ?? ''} maxLength={255}
                onChange={e => setDraft(d => ({ ...d, video_title: e.target.value }))}
                placeholder="e.g. How the SK budget cycle works" />
            </div>
            <div>
              <label className="label text-xs">Video link</label>
              <input className="input text-sm" value={draft.video_url}
                onChange={e => setDraft(d => ({ ...d, video_url: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=… (leave empty if there is no video yet)" />
              <p className="mt-1 text-[11px] text-gray-500">
                YouTube links and uploaded files are tracked automatically (the learner must play the required share). Other links
                (for example Vimeo or Facebook) cannot be tracked, so the learner confirms by hand. Only add a link you have checked.
              </p>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-700">
              <input type="checkbox" className="mt-0.5" checked={!!draft.video_manual_confirm}
                onChange={e => setDraft(d => ({ ...d, video_manual_confirm: e.target.checked }))} />
              <span>The video opens on another site (it cannot play inside the page). Learners watch it there and confirm by hand.</span>
            </label>
            <div>
              <label className="label text-xs">Or upload a video file <span className="text-gray-400 font-normal">(MP4, WebM, OGG or MOV, up to 150 MB)</span></label>
              <div className="flex flex-wrap items-center gap-2">
                <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" className="text-xs"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadVideo.mutate(f); e.target.value = '' }} />
                {lesson.video_file_url && (
                  <>
                    <a href={lesson.video_file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-700 hover:underline">Current file</a>
                    <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => uploadVideo.mutate(null)}>Remove file</button>
                  </>
                )}
                {uploadVideo.isPending && <span className="text-xs text-gray-500">Uploading...</span>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Video completion required (%)</label>
                <input type="number" min={1} max={100} className="input text-sm" value={draft.video_required_percent ?? 80}
                  onChange={e => setDraft(d => ({ ...d, video_required_percent: Number(e.target.value) || 80 }))} />
              </div>
              <div>
                <label className="label text-xs">Passing score for this lesson (%)</label>
                <input type="number" min={1} max={100} className="input text-sm" value={draft.passing_score ?? ''}
                  onChange={e => setDraft(d => ({ ...d, passing_score: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="Course default" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Study materials <span className="font-normal text-gray-500">(reading links learners can open for this lesson, useful when there is no video)</span></p>
            {(draft.study_resources ?? []).map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.3fr_0.8fr_auto]">
                <input className="input text-sm" placeholder="Title" value={r.title}
                  onChange={e => setDraft(d => ({ ...d, study_resources: (d.study_resources ?? []).map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))} />
                <input className="input text-sm" placeholder="https://…" value={r.url}
                  onChange={e => setDraft(d => ({ ...d, study_resources: (d.study_resources ?? []).map((x, j) => j === i ? { ...x, url: e.target.value } : x) }))} />
                <input className="input text-sm" placeholder="Source (optional)" value={r.source ?? ''}
                  onChange={e => setDraft(d => ({ ...d, study_resources: (d.study_resources ?? []).map((x, j) => j === i ? { ...x, source: e.target.value } : x) }))} />
                <button type="button" className="text-red-500 hover:text-red-700 text-xs px-2"
                  onClick={() => setDraft(d => ({ ...d, study_resources: (d.study_resources ?? []).filter((_, j) => j !== i) }))}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn-secondary btn-sm text-xs"
              onClick={() => setDraft(d => ({ ...d, study_resources: [...(d.study_resources ?? []), { title: '', url: '', source: '' }] }))}>
              <Plus size={11} /> Add a study link
            </button>
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
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Lesson assessment</span>
              <button
                onClick={() => addQuestion.mutate()}
                disabled={addQuestion.isPending}
                className="btn-secondary btn-sm text-xs flex items-center gap-1"
              >
                <Plus size={11} /> Add Question
              </button>
            </div>
            {lesson.questions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No assessment yet. Each question needs four choices and one correct answer.</p>
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
          onClick={async () => { if (await confirmDeletion({ what: 'module', name: module.title, note: 'Its lessons and questions will be removed too.' })) delModule.mutate() }}
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
