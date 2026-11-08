import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlayCircle,
  Send,
  Trophy,
  XCircle,
  X,
  Edit3,
  Download,
  Paperclip,
  FileText,
  User,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  ExternalLink,
  Trash2,
  Plus,
  Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { submissionsApi, type Submission, type SubmissionStatus } from '@/api/submissions'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatDate, formatDateTime, cn } from '@/utils'
import { IntegrityBadge } from '@/components/ui/IntegrityBadge'
import { useReviewLogIntegrity, useSubmissionContentIntegrity } from '@/api/ledger'

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<SubmissionStatus, string> = {
  draft: 'badge-gray',
  pending: 'badge-yellow',
  revision_requested: 'bg-orange-100 text-orange-700',
  approved: 'badge-green',
  in_progress: 'badge-blue',
  completion_submitted: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-700',
  rejected: 'badge-red',
}

const STATUS_ICON: Record<SubmissionStatus, React.ReactNode> = {
  draft: <Edit3 size={14} />,
  pending: <Clock size={14} />,
  revision_requested: <AlertCircle size={14} />,
  approved: <CheckCircle2 size={14} />,
  in_progress: <PlayCircle size={14} />,
  completion_submitted: <Send size={14} />,
  completed: <Trophy size={14} />,
  rejected: <XCircle size={14} />,
}

// ── Timeline steps ─────────────────────────────────────────────────────────────

interface TimelineStep {
  key: SubmissionStatus
  label: string
  icon: React.ReactNode
  timestampKey?: keyof Submission
}

const TIMELINE_STEPS: TimelineStep[] = [
  { key: 'pending', label: 'Submitted', icon: <Send size={16} />, timestampKey: 'submitted_at' },
  { key: 'approved', label: 'Approved', icon: <CheckCircle2 size={16} />, timestampKey: 'approved_at' },
  { key: 'in_progress', label: 'In Progress', icon: <PlayCircle size={16} /> },
  { key: 'completion_submitted', label: 'Completion Filed', icon: <FileText size={16} /> },
  { key: 'completed', label: 'Completed', icon: <Trophy size={16} />, timestampKey: 'completed_at' },
]

const STATUS_TIMELINE_INDEX: Partial<Record<SubmissionStatus, number>> = {
  draft: -1,
  pending: 0,
  revision_requested: 0,
  approved: 1,
  in_progress: 2,
  completion_submitted: 3,
  completed: 4,
  rejected: 0,
}

// ── Completion modal ───────────────────────────────────────────────────────────

interface CompletionModalProps {
  submission: Submission
  onClose: () => void
  onSuccess: () => void
}

function CompletionModal({ submission, onClose, onSuccess }: CompletionModalProps) {
  const [actualParticipants, setActualParticipants] = useState(
    submission.actual_participants?.toString() ?? ''
  )
  const [narrative, setNarrative] = useState(submission.outcomes_narrative ?? '')
  const [reportFile, setReportFile] = useState<File | null>(null)

  const hasExistingFile = !!submission.completion_report_file
  const wordCount = narrative.trim() ? narrative.trim().split(/\s+/).length : 0

  const mutation = useMutation({
    mutationFn: () => {
      if (!actualParticipants) throw new Error('Actual participants required')
      if (!narrative.trim()) throw new Error('Outcomes narrative required')
      if (!reportFile && !hasExistingFile) throw new Error('Completion report file required')
      const fd = new FormData()
      fd.append('actual_participants', actualParticipants)
      fd.append('outcomes_narrative', narrative)
      if (reportFile) fd.append('completion_report_file', reportFile)
      return submissionsApi.submitCompletion(submission.id, fd)
    },
    onSuccess: () => {
      toast.success('Completion report submitted!')
      onSuccess()
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.message || err?.response?.data?.detail || 'Failed to submit'
      toast.error(msg)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 overflow-y-auto py-6">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 my-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-ink-800">Submit Completion Report</h2>

        <div>
          <label className="label">Actual Participants *</label>
          <input
            type="number"
            min={1}
            className="input"
            value={actualParticipants}
            onChange={e => setActualParticipants(e.target.value)}
            placeholder="Total number of participants who attended"
          />
          {submission.expected_participants && (
            <p className="text-xs text-ink-400 mt-1">
              Originally planned: {submission.expected_participants} participants
            </p>
          )}
        </div>

        <div>
          <label className="label">Outcomes Narrative *</label>
          <textarea
            className="input min-h-[120px]"
            value={narrative}
            onChange={e => setNarrative(e.target.value)}
            placeholder="Describe what was accomplished, the impact achieved, and lessons learned. Aim for at least 3–5 sentences."
          />
          <p className={cn('text-xs mt-1', wordCount < 30 ? 'text-ink-400' : 'text-emerald-600')}>
            {wordCount} word{wordCount !== 1 ? 's' : ''}
            {wordCount < 30 && ' — aim for at least 30'}
          </p>
        </div>

        <div>
          <label className="label">
            Completion Report Document
            {!hasExistingFile && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {hasExistingFile && !reportFile && (
            <div className="flex items-center gap-2 mb-2 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
              <Download size={14} className="text-emerald-600 flex-shrink-0" />
              <a
                href={submission.completion_report_file!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-700 font-medium hover:underline truncate flex-1"
              >
                Previously uploaded file
              </a>
              <span className="text-xs text-emerald-600 flex-shrink-0">Upload new to replace</span>
            </div>
          )}
          {reportFile ? (
            <div className="flex items-center gap-2 p-2.5 bg-primary-50 rounded-lg border border-primary-200">
              <FileText size={14} className="text-primary-600 flex-shrink-0" />
              <span className="text-sm text-primary-700 truncate flex-1">{reportFile.name}</span>
              <span className="text-xs text-ink-400 flex-shrink-0">
                {(reportFile.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <button type="button" onClick={() => setReportFile(null)} className="text-ink-400 hover:text-ink-700 flex-shrink-0">
                <X size={14} />
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={e => setReportFile(e.target.files?.[0] ?? null)}
              className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          )}
          <p className="text-xs text-ink-400 mt-1">PDF, Word (.doc/.docx) · Max 10 MB</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-primary btn-sm"
          >
            {mutation.isPending ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showCompletionModal, setShowCompletionModal] = useState(false)

  const { data: submission, isLoading, error } = useQuery<Submission>({
    queryKey: ['submission', id],
    queryFn: () => submissionsApi.get(Number(id)),
    enabled: !!id,
  })
  const { data: integrity } = useReviewLogIntegrity(submission?.id)
  const { data: contentIntegrity } = useSubmissionContentIntegrity(submission?.id)

  const markInProgressMutation = useMutation({
    mutationFn: () => submissionsApi.markInProgress(Number(id)),
    onSuccess: () => {
      toast.success('Project marked as in progress!')
      qc.invalidateQueries({ queryKey: ['submission', id] })
      qc.invalidateQueries({ queryKey: ['my-submissions'] })
    },
    onError: () => toast.error('Failed to update status'),
  })

  const submitForReviewMutation = useMutation({
    mutationFn: () => submissionsApi.submitForReview(Number(id)),
    onSuccess: () => {
      toast.success('Submitted for review!')
      qc.invalidateQueries({ queryKey: ['submission', id] })
      qc.invalidateQueries({ queryKey: ['my-submissions'] })
    },
    onError: () => toast.error('Failed to submit'),
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: number) =>
      submissionsApi.deleteAttachment(Number(id), attachmentId),
    onSuccess: () => {
      toast.success('File removed')
      qc.invalidateQueries({ queryKey: ['submission', id] })
    },
    onError: () => toast.error('Failed to remove file'),
  })

  const addAttachmentMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', 'supporting')
      fd.append('label', file.name)
      return submissionsApi.addAttachment(Number(id), fd)
    },
    onSuccess: () => {
      toast.success('File uploaded!')
      qc.invalidateQueries({ queryKey: ['submission', id] })
    },
    onError: () => toast.error('Failed to upload file'),
  })

  const replaceMainFileMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return submissionsApi.update(Number(id), fd)
    },
    onSuccess: () => {
      toast.success('Main proposal replaced!')
      qc.invalidateQueries({ queryKey: ['submission', id] })
    },
    onError: () => toast.error('Failed to replace file'),
  })

  if (isLoading) return <PageSpinner />
  if (error || !submission) {
    return (
      <div className="card p-12 text-center">
        <p className="text-ink-500">Submission not found.</p>
        <button onClick={() => navigate('/submissions')} className="btn-secondary btn-sm mt-4">
          Back to Submissions
        </button>
      </div>
    )
  }

  const timelineIdx = STATUS_TIMELINE_INDEX[submission.status] ?? -1
  const isRejected = submission.status === 'rejected'
  const isEditable = submission.status === 'draft' || submission.status === 'revision_requested'

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/submissions')} className="btn-secondary btn-sm mt-0.5 flex items-center gap-1">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="page-title truncate">{submission.title}</h1>
            <span className={cn('badge flex items-center gap-1', STATUS_COLORS[submission.status])}>
              {STATUS_ICON[submission.status]}
              {submission.status_display}
            </span>
            <IntegrityBadge result={contentIntegrity?.result} intactLabel="Proposal unchanged" />
          </div>
        </div>
      </div>

      {/* ── Revision banner (prominent, full-width, before the timeline) ── */}
      {submission.status === 'revision_requested' && (
        <div className="rounded-2xl bg-orange-50 border-2 border-orange-300 p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <AlertCircle size={20} className="text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-orange-900 text-base leading-snug mb-1">
                Revision Requested
              </p>
              {submission.revision_notes ? (
                <p className="text-sm text-orange-800 leading-relaxed">{submission.revision_notes}</p>
              ) : (
                <p className="text-sm text-orange-700 italic">No specific notes provided. Please review and update your submission.</p>
              )}
            </div>
            <button
              onClick={() => navigate(`/submissions/new?edit=${submission.id}`)}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors"
            >
              <Edit3 size={14} /> Edit Now
            </button>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-4">Project Status</h3>
        <div className="flex items-start gap-0">
          {TIMELINE_STEPS.map((step, idx) => {
            const isReached = !isRejected && idx <= timelineIdx
            const isCurrent = !isRejected && idx === timelineIdx
            const ts = step.timestampKey ? (submission as any)[step.timestampKey] : null
            return (
              <div key={step.key} className="flex items-start flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all',
                      isRejected && idx === 0
                        ? 'border-red-500 bg-red-50 text-red-600'
                        : isReached
                        ? isCurrent
                          ? 'border-primary-600 bg-primary-600 text-white shadow-md shadow-primary-200'
                          : 'border-primary-600 bg-primary-50 text-primary-600'
                        : 'border-gray-200 bg-gray-50 text-gray-300',
                    )}
                  >
                    {step.icon}
                  </div>
                  <p
                    className={cn(
                      'text-[10px] font-medium mt-1.5 text-center leading-tight',
                      isReached ? 'text-primary-700' : 'text-ink-300',
                    )}
                  >
                    {step.label}
                  </p>
                  {ts && (
                    <p className="text-[9px] text-ink-400 text-center">{formatDate(ts)}</p>
                  )}
                </div>
                {idx < TIMELINE_STEPS.length - 1 && (
                  <div
                    className={cn('h-0.5 flex-1 mt-4 transition-all', isReached && !isCurrent ? 'bg-primary-600' : 'bg-gray-200')}
                  />
                )}
              </div>
            )
          })}
        </div>
        {isRejected && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
            <p className="text-sm text-red-700 font-medium">This submission was rejected.</p>
            {submission.admin_notes && (
              <p className="text-sm text-red-600 mt-1">{submission.admin_notes}</p>
            )}
          </div>
        )}
      </div>

      {/* Two-column content */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* ── Left (2/3) ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Admin notes */}
          {submission.admin_notes && submission.status !== 'rejected' && (
            <div className="card p-4 bg-blue-50 border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 mb-1">Admin Notes</p>
              <p className="text-sm text-blue-800">{submission.admin_notes}</p>
            </div>
          )}

          {/* Project details */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-ink-700">Project Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-ink-600">
                <Calendar size={14} className="text-ink-400 flex-shrink-0" />
                <span className="font-medium">Dates:</span>
                <span>{formatDate(submission.start_date)} – {formatDate(submission.end_date)}</span>
              </div>
              <div className="flex items-center gap-2 text-ink-600">
                <MapPin size={14} className="text-ink-400 flex-shrink-0" />
                <span className="font-medium">Location:</span>
                <span>{submission.location || '\u2014'}</span>
              </div>
              {submission.barangay && (
                <div className="flex items-center gap-2 text-ink-600">
                  <MapPin size={14} className="text-ink-400 flex-shrink-0" />
                  <span className="font-medium">Barangay:</span>
                  <span>{submission.barangay}</span>
                </div>
              )}
              {submission.expected_participants !== null && (
                <div className="flex items-center gap-2 text-ink-600">
                  <Users size={14} className="text-ink-400 flex-shrink-0" />
                  <span className="font-medium">Expected:</span>
                  <span>{submission.expected_participants} participants</span>
                </div>
              )}
              {submission.estimated_budget && (
                <div className="flex items-center gap-2 text-ink-600">
                  <DollarSign size={14} className="text-ink-400 flex-shrink-0" />
                  <span className="font-medium">Budget:</span>
                  <span>₱{Number(submission.estimated_budget).toLocaleString()}</span>
                </div>
              )}
              {submission.submitted_by_name && (
                <div className="flex items-center gap-2 text-ink-600">
                  <User size={14} className="text-ink-400 flex-shrink-0" />
                  <span className="font-medium">Submitted by:</span>
                  <span>{submission.submitted_by_name}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {submission.category_display && (
                <span className="badge badge-gray text-xs">{submission.category_display}</span>
              )}
              <span className="badge badge-gray text-xs">
                {submission.submitter_type === 'sk' ? 'SK' : 'Youth Org'}
              </span>
              <span className="badge badge-gray text-xs">Submitted {formatDate(submission.submitted_at)}</span>
            </div>
          </div>

          {/* Description, objectives, beneficiaries */}
          {(submission.description || submission.objectives || submission.target_beneficiaries) && (
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-ink-700">Project Narrative</h3>
              {submission.description && (
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase mb-1">Description</p>
                  <p className="text-sm text-ink-700 whitespace-pre-wrap">{submission.description}</p>
                </div>
              )}
              {submission.objectives && (
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase mb-1">Objectives</p>
                  <p className="text-sm text-ink-700 whitespace-pre-wrap">{submission.objectives}</p>
                </div>
              )}
              {submission.target_beneficiaries && (
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase mb-1">Target Beneficiaries</p>
                  <p className="text-sm text-ink-700 whitespace-pre-wrap">{submission.target_beneficiaries}</p>
                </div>
              )}
            </div>
          )}

          {/* Completion report data */}
          {(submission.actual_participants !== null || submission.outcomes_narrative) && (
            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-ink-700">Completion Report</h3>
              {submission.actual_participants !== null && (
                <div className="flex items-center gap-2 text-sm text-ink-600">
                  <Users size={14} className="text-ink-400" />
                  <span className="font-medium">Actual Participants:</span>
                  <span>{submission.actual_participants}</span>
                </div>
              )}
              {submission.outcomes_narrative && (
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase mb-1">Outcomes</p>
                  <p className="text-sm text-ink-700 whitespace-pre-wrap">{submission.outcomes_narrative}</p>
                </div>
              )}
              {submission.completion_report_file && (
                <a
                  href={submission.completion_report_file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Download size={14} /> Download Completion Report
                </a>
              )}
            </div>
          )}

          {/* Attachments */}
          {(submission.attachments.length > 0 || isEditable) && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-ink-700 mb-3">Attachments</h3>
              <div className="space-y-2">
                {submission.attachments.map(att => (
                  <div key={att.id} className="flex items-center justify-between gap-3 p-2 bg-paper-50 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip size={14} className="text-ink-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-700 truncate">
                          {att.label || att.kind.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] text-ink-400">{att.kind.replace(/_/g, ' ')} · {formatDate(att.uploaded_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <a
                        href={att.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary btn-sm text-xs flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> View
                      </a>
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => deleteAttachmentMutation.mutate(att.id)}
                          disabled={deleteAttachmentMutation.isPending}
                          className="p-1.5 rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove file"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {submission.attachments.length === 0 && isEditable && (
                  <p className="text-sm text-ink-400 italic">No attachments yet.</p>
                )}
              </div>

              {/* Add file when editable */}
              {isEditable && (
                <div className="mt-3 pt-3 border-t border-ink-100">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-ink-300 group-hover:border-primary-400 text-xs font-semibold text-ink-500 group-hover:text-primary-600 transition-colors">
                      {addAttachmentMutation.isPending
                        ? <><Upload size={13} className="animate-pulse" /> Uploading…</>
                        : <><Plus size={13} /> Add file</>
                      }
                    </span>
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      disabled={addAttachmentMutation.isPending}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) {
                          addAttachmentMutation.mutate(f)
                          e.target.value = ''
                        }
                      }}
                    />
                  </label>
                  <p className="text-[10px] text-ink-400 mt-1.5">PDF, Word, Excel, or image files accepted.</p>
                </div>
              )}
            </div>
          )}

          {/* Main proposal file */}
          {(submission.file || isEditable) && (
            <div className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-primary-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-ink-700">
                    {submission.file ? 'Main Proposal' : 'Main Proposal (not uploaded yet)'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {submission.file && (
                    <a
                      href={submission.file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary btn-sm text-xs flex items-center gap-1"
                    >
                      <Download size={12} /> Download
                    </a>
                  )}
                  {isEditable && (
                    <label className="cursor-pointer">
                      <span className="btn-secondary btn-sm text-xs flex items-center gap-1">
                        {replaceMainFileMutation.isPending
                          ? <><Upload size={12} className="animate-pulse" /> Uploading…</>
                          : <><Upload size={12} /> {submission.file ? 'Replace' : 'Upload'}</>
                        }
                      </span>
                      <input
                        type="file"
                        className="sr-only"
                        accept=".pdf"
                        disabled={replaceMainFileMutation.isPending}
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) {
                            replaceMainFileMutation.mutate(f)
                            e.target.value = ''
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Review history */}
          {submission.review_logs.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-ink-700 mb-3">Review History</h3>
              <div className="space-y-3">
                {submission.review_logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-2 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink-700">{log.action_display}</span>
                        {log.actor_name && (
                          <span className="text-xs text-ink-400">by {log.actor_name}</span>
                        )}
                        <span className="text-xs text-ink-400 ml-auto">{formatDateTime(log.created_at)}</span>
                        <IntegrityBadge result={integrity?.results[String(log.id)]} />
                      </div>
                      {log.notes && (
                        <p className="text-xs text-ink-500 mt-0.5">{log.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right (1/3) &mdash; actions ────────────────────────────────── */}
        <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-ink-700">Actions</h3>

            {submission.status === 'draft' && (
              <>
                <p className="text-xs text-ink-500">Your proposal is saved as a draft. Edit it or submit for admin review when ready.</p>
                <button
                  onClick={() => navigate(`/submissions/new?edit=${submission.id}`)}
                  className="btn-secondary btn-sm w-full flex items-center justify-center gap-1"
                >
                  <Edit3 size={14} /> Edit Submission
                </button>
                <button
                  onClick={() => submitForReviewMutation.mutate()}
                  disabled={submitForReviewMutation.isPending}
                  className="btn-primary btn-sm w-full flex items-center justify-center gap-1"
                >
                  <Send size={14} />
                  {submitForReviewMutation.isPending ? 'Submitting…' : 'Submit for Review'}
                </button>
              </>
            )}

            {submission.status === 'pending' && (
              <>
                <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                  <Clock size={16} className="text-yellow-600 flex-shrink-0" />
                  <p className="text-xs text-yellow-700">Your submission is pending admin review. You will be notified of the outcome.</p>
                </div>
              </>
            )}

            {submission.status === 'revision_requested' && (
              <>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                  <p className="text-xs text-orange-700 font-semibold mb-1">Revision Requested</p>
                  <p className="text-xs text-orange-600">Please address the revision notes and resubmit.</p>
                </div>
                <button
                  onClick={() => navigate(`/submissions/new?edit=${submission.id}`)}
                  className="btn-secondary btn-sm w-full flex items-center justify-center gap-1"
                >
                  <Edit3 size={14} /> Edit Submission
                </button>
                <button
                  onClick={() => submitForReviewMutation.mutate()}
                  disabled={submitForReviewMutation.isPending}
                  className="btn-primary btn-sm w-full flex items-center justify-center gap-1"
                >
                  <Send size={14} />
                  {submitForReviewMutation.isPending ? 'Resubmitting…' : 'Resubmit for Review'}
                </button>
              </>
            )}

            {submission.status === 'approved' && (
              <>
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-xs text-green-700 font-semibold mb-1">Approved!</p>
                  <p className="text-xs text-green-600">Your project proposal has been approved. Click below once you start implementing it.</p>
                </div>
                <button
                  onClick={() => markInProgressMutation.mutate()}
                  disabled={markInProgressMutation.isPending}
                  className="btn-primary btn-sm w-full flex items-center justify-center gap-1"
                >
                  <PlayCircle size={14} />
                  {markInProgressMutation.isPending ? 'Updating…' : 'Mark as In Progress'}
                </button>
              </>
            )}

            {submission.status === 'in_progress' && (
              <>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-700 font-semibold mb-1">In Progress</p>
                  <p className="text-xs text-blue-600">Your project is underway! Submit a completion report when done.</p>
                </div>
                <button
                  onClick={() => setShowCompletionModal(true)}
                  className="btn-primary btn-sm w-full flex items-center justify-center gap-1"
                >
                  <Send size={14} /> Submit Completion Report
                </button>
              </>
            )}

            {submission.status === 'completion_submitted' && (
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 text-center space-y-1">
                <Send size={20} className="mx-auto text-purple-500" />
                <p className="text-sm font-semibold text-purple-700">Awaiting Final Review</p>
                <p className="text-xs text-purple-600">Your completion report has been submitted. The admin will review and mark it complete.</p>
              </div>
            )}

            {submission.status === 'completed' && (
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 text-center space-y-1">
                <Trophy size={24} className="mx-auto text-emerald-500" />
                <p className="text-sm font-semibold text-emerald-700">Project Completed!</p>
                <p className="text-xs text-emerald-600">Congratulations! Your project has been successfully completed and recorded.</p>
                {submission.completed_at && (
                  <p className="text-xs text-emerald-500">Completed on {formatDate(submission.completed_at)}</p>
                )}
              </div>
            )}

            {submission.status === 'rejected' && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-100 space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle size={16} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-red-700">Submission Rejected</p>
                </div>
                {submission.admin_notes && (
                  <p className="text-xs text-red-600">{submission.admin_notes}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Completion modal */}
      {showCompletionModal && (
        <CompletionModal
          submission={submission}
          onClose={() => setShowCompletionModal(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['submission', id] })
            qc.invalidateQueries({ queryKey: ['my-submissions'] })
          }}
        />
      )}
    </div>
  )
}
