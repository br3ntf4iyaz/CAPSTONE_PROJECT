import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, Check, Save, Send,
  Paperclip, X, FileText, ClipboardList, CheckCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { submissionsApi, type Submission } from '@/api/submissions'
import { cn } from '@/utils'
import { useAuthStore } from '@/store/authStore'
import { PageSpinner } from '@/components/ui/Spinner'

const CATEGORY_CHOICES = [
  { value: 'social_inclusion', label: 'Social Inclusion and Equity' },
  { value: 'health', label: 'Health' },
  { value: 'active_citizenship', label: 'Active Citizenship' },
  { value: 'peace_building', label: 'Peace Building and Security' },
  { value: 'education', label: 'Education' },
  { value: 'environment', label: 'Environment' },
  { value: 'governance', label: 'Governance' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'global_mobility', label: 'Global Mobility' },
  { value: 'economic', label: 'Economic Environment' },
]

const STEPS = ['Type', 'Details', 'Review & Submit']

interface WizardData {
  submission_type: 'policy' | 'ppa'
  submitter_type: 'sk' | 'youth_org'
  // Shared
  title: string
  // Policy-only
  policy_type: string
  policy_date_passed: string
  description: string
  // PPA-only
  category: string
  abyip_reference_code: string
  expected_result: string
  performance_indicator: string
  objectives: string
  period_of_implementation: string
  estimated_budget: string
  actual_disbursement: string
  male_participants: number
  female_participants: number
  lgbtq_participants: number
  prefer_not_say_participants: number
  // Files
  file: File | null
  thumbnail: File | null
  supporting: File[]
}

type DetailsFormValues = {
  title: string
  policy_type: string
  policy_date_passed: string
  description: string
  category: string
  abyip_reference_code: string
  expected_result: string
  performance_indicator: string
  objectives: string
  period_of_implementation: string
  estimated_budget: string
  actual_disbursement: string
}

// ── Summary card shown at the top of step 2 ──────────────────────────────────

function SubmitSummary({ data, existingAttachments }: {
  data: WizardData
  existingAttachments?: Submission['attachments']
}) {
  const catLabel = CATEGORY_CHOICES.find(c => c.value === data.category)?.label ?? data.category

  if (data.submission_type === 'policy') {
    return (
      <div className="bg-ink-50/60 rounded-xl border border-ink-100 p-4 space-y-3">
        <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Summary</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-ink-400">Title</p>
            <p className="font-medium text-ink-800 leading-snug">{data.title || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Type of Policy</p>
            <p className="font-medium text-ink-800">{data.policy_type || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Date Passed</p>
            <p className="font-medium text-ink-800">{data.policy_date_passed || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Submitted by</p>
            <p className="font-medium text-ink-800">
              {data.submitter_type === 'sk' ? 'SK (Sangguniang Kabataan)' : 'Youth Organization'}
            </p>
          </div>
          {data.description && (
            <div className="col-span-full">
              <p className="text-xs text-ink-400">Brief Description</p>
              <p className="font-medium text-ink-800 leading-snug">{data.description}</p>
            </div>
          )}
        </div>
        {existingAttachments && existingAttachments.length > 0 && (
          <div className="pt-2 border-t border-ink-100">
            <p className="text-xs text-ink-400 mb-1">Already attached</p>
            <div className="flex flex-wrap gap-1.5">
              {existingAttachments.map(a => (
                <span key={a.id} className="inline-flex items-center gap-1 text-[11px] bg-white border border-ink-100 rounded-md px-2 py-0.5 text-ink-600">
                  <Paperclip size={10} /> {a.label || a.kind.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // PPA summary
  return (
    <div className="bg-ink-50/60 rounded-xl border border-ink-100 p-4 space-y-3">
      <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Summary</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-ink-400">Title</p>
          <p className="font-medium text-ink-800 leading-snug">{data.title || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-ink-400">Center of Participation</p>
          <p className="font-medium text-ink-800">{catLabel || '—'}</p>
        </div>
        {data.abyip_reference_code && (
          <div>
            <p className="text-xs text-ink-400">ABYIP Reference Code</p>
            <p className="font-medium text-ink-800">{data.abyip_reference_code}</p>
          </div>
        )}
        {data.period_of_implementation && (
          <div>
            <p className="text-xs text-ink-400">Period of Implementation</p>
            <p className="font-medium text-ink-800">{data.period_of_implementation}</p>
          </div>
        )}
        {data.estimated_budget && (
          <div>
            <p className="text-xs text-ink-400">Budget Alloted</p>
            <p className="font-medium text-ink-800">₱{data.estimated_budget}</p>
          </div>
        )}
        {data.actual_disbursement && (
          <div>
            <p className="text-xs text-ink-400">Actual Disbursement</p>
            <p className="font-medium text-ink-800">₱{data.actual_disbursement}</p>
          </div>
        )}
        {data.expected_result && (
          <div className="col-span-full">
            <p className="text-xs text-ink-400">Expected Result</p>
            <p className="font-medium text-ink-800 leading-snug">{data.expected_result}</p>
          </div>
        )}
        {data.performance_indicator && (
          <div className="col-span-full">
            <p className="text-xs text-ink-400">Performance Indicator</p>
            <p className="font-medium text-ink-800 leading-snug">{data.performance_indicator}</p>
          </div>
        )}
        {data.objectives && (
          <div className="col-span-full">
            <p className="text-xs text-ink-400">Objective Description</p>
            <p className="font-medium text-ink-800 leading-snug">{data.objectives}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-ink-400">Submitted by</p>
          <p className="font-medium text-ink-800">
            {data.submitter_type === 'sk' ? 'SK (Sangguniang Kabataan)' : 'Youth Organization'}
          </p>
        </div>
      </div>
      {(data.male_participants > 0 || data.female_participants > 0 || data.lgbtq_participants > 0 || data.prefer_not_say_participants > 0) && (
        <div className="pt-2 border-t border-ink-100">
          <p className="text-xs text-ink-400 mb-1">Participants</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {data.male_participants > 0 && (
              <span className="text-ink-700">Male: <strong>{data.male_participants}</strong></span>
            )}
            {data.female_participants > 0 && (
              <span className="text-ink-700">Female: <strong>{data.female_participants}</strong></span>
            )}
            {data.lgbtq_participants > 0 && (
              <span className="text-ink-700">LGBT+: <strong>{data.lgbtq_participants}</strong></span>
            )}
            {data.prefer_not_say_participants > 0 && (
              <span className="text-ink-700">Prefer not to say: <strong>{data.prefer_not_say_participants}</strong></span>
            )}
          </div>
        </div>
      )}
      {existingAttachments && existingAttachments.length > 0 && (
        <div className="pt-2 border-t border-ink-100">
          <p className="text-xs text-ink-400 mb-1">Already attached</p>
          <div className="flex flex-wrap gap-1.5">
            {existingAttachments.map(a => (
              <span key={a.id} className="inline-flex items-center gap-1 text-[11px] bg-white border border-ink-100 rounded-md px-2 py-0.5 text-ink-600">
                <Paperclip size={10} /> {a.label || a.kind.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SubmissionWizardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit') ? Number(searchParams.get('edit')) : null

  const auth = useAuthStore()
  const youthType = (auth.user as any)?.youth_type ?? 'sk'
  const defaultSubmitterType: 'sk' | 'youth_org' = youthType === 'youth_org_leader' ? 'youth_org' : 'sk'

  const [step, setStep] = useState(0)
  const [submissionId, setSubmissionId] = useState<number | null>(editId)

  const wizardData = useRef<WizardData>({
    submission_type: 'ppa',
    submitter_type: defaultSubmitterType,
    title: '',
    policy_type: '',
    policy_date_passed: '',
    description: '',
    category: '',
    abyip_reference_code: '',
    expected_result: '',
    performance_indicator: '',
    objectives: '',
    period_of_implementation: '',
    estimated_budget: '',
    actual_disbursement: '',
    male_participants: 0,
    female_participants: 0,
    lgbtq_participants: 0,
    prefer_not_say_participants: 0,
    file: null,
    thumbnail: null,
    supporting: [],
  })

  const [subType, setSubType] = useState<'policy' | 'ppa'>(wizardData.current.submission_type)

  // ── Load existing draft when editing ─────────────────────────────────────

  const { data: existingSubmission, isLoading: loadingExisting } = useQuery<Submission>({
    queryKey: ['submission', editId],
    queryFn: () => submissionsApi.get(editId!),
    enabled: !!editId,
  })

  const detailsForm = useForm<DetailsFormValues>({
    defaultValues: {
      title: wizardData.current.title,
      policy_type: wizardData.current.policy_type,
      policy_date_passed: wizardData.current.policy_date_passed,
      description: wizardData.current.description,
      category: wizardData.current.category,
      abyip_reference_code: wizardData.current.abyip_reference_code,
      expected_result: wizardData.current.expected_result,
      performance_indicator: wizardData.current.performance_indicator,
      objectives: wizardData.current.objectives,
      period_of_implementation: wizardData.current.period_of_implementation,
      estimated_budget: wizardData.current.estimated_budget,
      actual_disbursement: wizardData.current.actual_disbursement,
    },
  })

  // Populate form once the existing submission loads
  useEffect(() => {
    if (!existingSubmission) return
    const s = existingSubmission as any

    wizardData.current.submission_type          = s.submission_type ?? 'ppa'
    wizardData.current.submitter_type           = s.submitter_type ?? defaultSubmitterType
    wizardData.current.title                    = s.title ?? ''
    wizardData.current.policy_type              = s.policy_type ?? ''
    wizardData.current.policy_date_passed       = s.policy_date_passed ?? ''
    wizardData.current.description              = s.description ?? ''
    wizardData.current.category                 = s.category ?? ''
    wizardData.current.abyip_reference_code     = s.abyip_reference_code ?? ''
    wizardData.current.expected_result          = s.expected_result ?? ''
    wizardData.current.performance_indicator    = s.performance_indicator ?? ''
    wizardData.current.objectives               = s.objectives ?? ''
    wizardData.current.period_of_implementation = s.period_of_implementation ?? ''
    wizardData.current.estimated_budget         = s.estimated_budget ?? ''
    wizardData.current.actual_disbursement      = s.actual_disbursement ?? ''
    wizardData.current.male_participants        = s.male_participants ?? 0
    wizardData.current.female_participants      = s.female_participants ?? 0
    wizardData.current.lgbtq_participants       = s.lgbtq_participants ?? 0
    wizardData.current.prefer_not_say_participants = s.prefer_not_say_participants ?? 0

    setSubType(wizardData.current.submission_type)
    setParticipantTotal(
      wizardData.current.male_participants +
      wizardData.current.female_participants +
      wizardData.current.lgbtq_participants +
      wizardData.current.prefer_not_say_participants
    )

    detailsForm.reset({
      title: wizardData.current.title,
      policy_type: wizardData.current.policy_type,
      policy_date_passed: wizardData.current.policy_date_passed,
      description: wizardData.current.description,
      category: wizardData.current.category,
      abyip_reference_code: wizardData.current.abyip_reference_code,
      expected_result: wizardData.current.expected_result,
      performance_indicator: wizardData.current.performance_indicator,
      objectives: wizardData.current.objectives,
      period_of_implementation: wizardData.current.period_of_implementation,
      estimated_budget: wizardData.current.estimated_budget,
      actual_disbursement: wizardData.current.actual_disbursement,
    })
  }, [existingSubmission])

  // ── File state for step 2 ─────────────────────────────────────────────────
  const [mainFile, setMainFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [supportingFiles, setSupportingFiles] = useState<File[]>([])

  // Participant total — kept in state so changes in uncontrolled inputs re-render the display
  const [participantTotal, setParticipantTotal] = useState(
    wizardData.current.male_participants +
    wizardData.current.female_participants +
    wizardData.current.lgbtq_participants +
    wizardData.current.prefer_not_say_participants
  )

  // ── Navigation guard ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function buildFormData(): FormData {
    const d = wizardData.current
    const fd = new FormData()
    fd.append('submission_type', d.submission_type)
    fd.append('submitter_type', d.submitter_type)
    fd.append('title', d.title)
    fd.append('description', d.description)
    fd.append('category', d.category)
    fd.append('policy_type', d.policy_type)
    if (d.policy_date_passed) fd.append('policy_date_passed', d.policy_date_passed)
    fd.append('abyip_reference_code', d.abyip_reference_code)
    fd.append('expected_result', d.expected_result)
    fd.append('performance_indicator', d.performance_indicator)
    fd.append('objectives', d.objectives)
    fd.append('period_of_implementation', d.period_of_implementation)
    if (d.estimated_budget) fd.append('estimated_budget', d.estimated_budget)
    if (d.actual_disbursement) fd.append('actual_disbursement', d.actual_disbursement)
    fd.append('male_participants', String(d.male_participants))
    fd.append('female_participants', String(d.female_participants))
    fd.append('lgbtq_participants', String(d.lgbtq_participants))
    fd.append('prefer_not_say_participants', String(d.prefer_not_say_participants))
    if (mainFile) fd.append('file', mainFile)
    if (thumbnailFile) fd.append('thumbnail', thumbnailFile)
    return fd
  }

  async function uploadSupportingFiles(id: number) {
    for (const file of supportingFiles) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', 'supporting')
      fd.append('label', file.name)
      await submissionsApi.addAttachment(id, fd)
    }
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const fd = buildFormData()
      let sub: Submission
      if (submissionId) {
        sub = await submissionsApi.update(submissionId, fd)
      } else {
        sub = await submissionsApi.create(fd)
        setSubmissionId(sub.id)
      }
      if (supportingFiles.length > 0) {
        await uploadSupportingFiles(sub.id)
      }
      return sub
    },
    onSuccess: (sub) => {
      qc.invalidateQueries({ queryKey: ['my-submissions'] })
      if (sub?.id) qc.invalidateQueries({ queryKey: ['submission', sub.id] })
      toast.success('Draft saved!', { position: 'top-center' })
      navigate('/submissions')
    },
    onError: () => toast.error('Failed to save draft. Please try again.', { position: 'top-center' }),
  })

  const submitForReviewMutation = useMutation({
    mutationFn: async () => {
      const fd = buildFormData()
      let id = submissionId
      if (id) {
        await submissionsApi.update(id, fd)
      } else {
        const created = await submissionsApi.create(fd)
        id = created.id
        setSubmissionId(id)
      }
      if (supportingFiles.length > 0) {
        await uploadSupportingFiles(id!)
      }
      return submissionsApi.submitForReview(id!)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-submissions'] })
      if (submissionId) qc.invalidateQueries({ queryKey: ['submission', submissionId] })
      toast.success('Accomplishment report submitted!', { position: 'top-center' })
      navigate('/submissions')
    },
    onError: () => toast.error('Failed to submit. Please try again.', { position: 'top-center' }),
  })

  // ── Step navigation ───────────────────────────────────────────────────────

  async function handleNext() {
    if (step === 0) {
      // type already set via card click, always valid
      setStep(s => s + 1)
      return
    }
    if (step === 1) {
      const valid = await detailsForm.trigger(
        subType === 'policy'
          ? ['title', 'policy_type', 'policy_date_passed', 'description']
          : ['title', 'category', 'expected_result', 'performance_indicator', 'objectives']
      )
      if (!valid) return
      const data = detailsForm.getValues()
      Object.assign(wizardData.current, data)
    }
    setStep(s => Math.min(s + 1, 2))
  }

  function handleBack() {
    setStep(s => Math.max(s - 1, 0))
  }

  async function handleSaveDraft() {
    if (step === 0) {
      // Title is required by the backend — move the user to the details step first
      toast('Please fill in the details before saving as draft.', { position: 'top-center' })
      setStep(1)
      return
    }
    if (step === 1) {
      const data = detailsForm.getValues()
      if (!data.title.trim()) {
        toast.error('Please enter a title before saving')
        return
      }
      Object.assign(wizardData.current, data)
    }
    saveDraftMutation.mutate()
  }

  // ── Loading state when editing ────────────────────────────────────────────

  if (editId && loadingExisting) return <PageSpinner />

  const isBusy = saveDraftMutation.isPending || submitForReviewMutation.isPending
  const isEditing = !!editId

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">{isEditing ? 'Edit Draft' : 'New Accomplishment Report'}</h1>
        <p className="page-subtitle">
          {isEditing
            ? 'Update your draft and resubmit when ready'
            : 'Report a completed policy or activity across the three steps below'}
        </p>
      </div>

      {/* Step progress bar */}
      <div className="flex items-center gap-0">
        {STEPS.map((name, idx) => (
          <div key={name} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all',
                  idx < step
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : idx === step
                    ? 'bg-white border-primary-600 text-primary-600'
                    : 'bg-white border-gray-200 text-gray-400',
                )}
              >
                {idx < step ? <Check size={14} /> : idx + 1}
              </div>
              <span
                className={cn(
                  'text-[10px] mt-1 font-medium',
                  idx === step ? 'text-primary-700' : 'text-ink-400',
                )}
              >
                {name}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn('h-0.5 flex-1 mb-4 transition-all', idx < step ? 'bg-primary-600' : 'bg-gray-200')}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Step indicator sidebar ─────────────────────────────── */}
        <div className="hidden lg:block w-48 flex-shrink-0">
          <div className="card p-4 space-y-1">
            {STEPS.map((name, idx) => (
              <div
                key={name}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                  idx === step
                    ? 'bg-primary-50 text-primary-700 font-semibold'
                    : idx < step
                    ? 'text-ink-500'
                    : 'text-ink-300',
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                    idx < step
                      ? 'bg-primary-600 text-white'
                      : idx === step
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-400',
                  )}
                >
                  {idx < step ? <Check size={10} /> : idx + 1}
                </div>
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* ── Form area ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="card p-6 space-y-5">

            {/* STEP 0 — Type Selection */}
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-ink-800">Step 1: Submission Type</h2>
                <p className="text-sm text-ink-500">What are you submitting a report for?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Policy card */}
                  <button
                    type="button"
                    onClick={() => { wizardData.current.submission_type = 'policy'; setSubType('policy') }}
                    className={`rounded-xl border-2 p-5 text-left transition-all ${
                      subType === 'policy'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        subType === 'policy' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <FileText size={18} />
                      </div>
                      <span className="font-semibold text-sm text-gray-900">Policy</span>
                      {subType === 'policy' && <CheckCircle size={16} className="ml-auto text-primary-500" />}
                    </div>
                    <p className="text-xs text-gray-500">Report a policy passed by your SK or Youth Organization.</p>
                  </button>

                  {/* PPA card */}
                  <button
                    type="button"
                    onClick={() => { wizardData.current.submission_type = 'ppa'; setSubType('ppa') }}
                    className={`rounded-xl border-2 p-5 text-left transition-all ${
                      subType === 'ppa'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        subType === 'ppa' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <ClipboardList size={18} />
                      </div>
                      <span className="font-semibold text-sm text-gray-900">PPA</span>
                      {subType === 'ppa' && <CheckCircle size={16} className="ml-auto text-primary-500" />}
                    </div>
                    <p className="text-xs text-gray-500">Report a Program, Project, or Activity conducted.</p>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 1 — Policy Details */}
            {step === 1 && subType === 'policy' && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-ink-800">Step 2: Policy Details</h2>

                <div>
                  <label className="label">Title *</label>
                  <input {...detailsForm.register('title', { required: 'Title is required' })} className="input" placeholder="e.g. SK Youth Development Policy 2026" maxLength={300} />
                  {detailsForm.formState.errors.title && <p className="error-msg">{detailsForm.formState.errors.title.message}</p>}
                </div>

                <div>
                  <label className="label">Type of Policy *</label>
                  <input {...detailsForm.register('policy_type', { required: 'Policy type is required' })} className="input" placeholder="e.g. Resolution, Ordinance, Executive Order" />
                  {detailsForm.formState.errors.policy_type && <p className="error-msg">{detailsForm.formState.errors.policy_type.message}</p>}
                </div>

                <div>
                  <label className="label">Date Passed *</label>
                  <input type="date" {...detailsForm.register('policy_date_passed', { required: 'Date is required' })} className="input" />
                  {detailsForm.formState.errors.policy_date_passed && <p className="error-msg">{detailsForm.formState.errors.policy_date_passed.message}</p>}
                </div>

                <div>
                  <label className="label">Brief Description *</label>
                  <textarea {...detailsForm.register('description', { required: 'Description is required' })} className="input min-h-[100px]" placeholder="Summarize the policy and its objectives." />
                  {detailsForm.formState.errors.description && <p className="error-msg">{detailsForm.formState.errors.description.message}</p>}
                </div>

                <div>
                  <label className="label">Submitted by</label>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="px-4 py-2 rounded-lg border-2 border-primary-600 bg-primary-50 text-primary-700 text-sm font-medium">
                      {defaultSubmitterType === 'sk' ? 'SK (Sangguniang Kabataan)' : 'Youth Organization'}
                    </div>
                    <span className="text-xs text-ink-400">Auto-detected from your account</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1 — PPA Details */}
            {step === 1 && subType === 'ppa' && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-ink-800">Step 2: PPA Details</h2>

                <div>
                  <label className="label">Title *</label>
                  <input {...detailsForm.register('title', { required: 'Title is required' })} className="input" placeholder="e.g. Barangay Youth Leadership Summit 2026" maxLength={300} />
                  {detailsForm.formState.errors.title && <p className="error-msg">{detailsForm.formState.errors.title.message}</p>}
                </div>

                <div>
                  <label className="label">Center of Participation *</label>
                  <select {...detailsForm.register('category', { required: 'Center of Participation is required' })} className="input">
                    <option value="">Select…</option>
                    {CATEGORY_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  {detailsForm.formState.errors.category && <p className="error-msg">{detailsForm.formState.errors.category.message}</p>}
                </div>

                <div>
                  <label className="label">ABYIP Reference Code</label>
                  <input {...detailsForm.register('abyip_reference_code')} className="input" placeholder="e.g. ABYIP-2026-001" />
                </div>

                <div>
                  <label className="label">Expected Result *</label>
                  <textarea {...detailsForm.register('expected_result', { required: 'Expected result is required' })} className="input min-h-[80px]" placeholder="What outcomes are expected from this PPA?" />
                  {detailsForm.formState.errors.expected_result && <p className="error-msg">{detailsForm.formState.errors.expected_result.message}</p>}
                </div>

                <div>
                  <label className="label">Performance Indicator *</label>
                  <textarea {...detailsForm.register('performance_indicator', { required: 'Performance indicator is required' })} className="input min-h-[80px]" placeholder="How will success be measured?" />
                  {detailsForm.formState.errors.performance_indicator && <p className="error-msg">{detailsForm.formState.errors.performance_indicator.message}</p>}
                </div>

                <div>
                  <label className="label">Objective Description *</label>
                  <textarea {...detailsForm.register('objectives', { required: 'Objective is required' })} className="input min-h-[80px]" placeholder="Describe the objectives of this PPA." />
                  {detailsForm.formState.errors.objectives && <p className="error-msg">{detailsForm.formState.errors.objectives.message}</p>}
                </div>

                <div>
                  <label className="label">Period of Implementation</label>
                  <input {...detailsForm.register('period_of_implementation')} className="input" placeholder="e.g. January–March 2026 or Q1 2026" />
                </div>

                <div>
                  <label className="label">Budget Alloted (₱)</label>
                  <input type="number" min={0} step="0.01" {...detailsForm.register('estimated_budget')} className="input" placeholder="0.00" />
                </div>

                <div>
                  <label className="label">Actual Disbursement (₱)</label>
                  <input type="number" min={0} step="0.01" {...detailsForm.register('actual_disbursement')} className="input" placeholder="0.00" />
                </div>

                <div>
                  <label className="label">Participants</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-ink-500 mb-1 block">Male</label>
                      <input type="number" min={0} defaultValue={wizardData.current.male_participants}
                        onChange={e => {
                          wizardData.current.male_participants = Number(e.target.value) || 0
                          setParticipantTotal(wizardData.current.male_participants + wizardData.current.female_participants + wizardData.current.lgbtq_participants + wizardData.current.prefer_not_say_participants)
                        }}
                        className="input" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs text-ink-500 mb-1 block">Female</label>
                      <input type="number" min={0} defaultValue={wizardData.current.female_participants}
                        onChange={e => {
                          wizardData.current.female_participants = Number(e.target.value) || 0
                          setParticipantTotal(wizardData.current.male_participants + wizardData.current.female_participants + wizardData.current.lgbtq_participants + wizardData.current.prefer_not_say_participants)
                        }}
                        className="input" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs text-ink-500 mb-1 block">LGBT+</label>
                      <input type="number" min={0} defaultValue={wizardData.current.lgbtq_participants}
                        onChange={e => {
                          wizardData.current.lgbtq_participants = Number(e.target.value) || 0
                          setParticipantTotal(wizardData.current.male_participants + wizardData.current.female_participants + wizardData.current.lgbtq_participants + wizardData.current.prefer_not_say_participants)
                        }}
                        className="input" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs text-ink-500 mb-1 block">Prefer not to say</label>
                      <input type="number" min={0} defaultValue={wizardData.current.prefer_not_say_participants}
                        onChange={e => {
                          wizardData.current.prefer_not_say_participants = Number(e.target.value) || 0
                          setParticipantTotal(wizardData.current.male_participants + wizardData.current.female_participants + wizardData.current.lgbtq_participants + wizardData.current.prefer_not_say_participants)
                        }}
                        className="input" placeholder="0" />
                    </div>
                  </div>
                  <p className="text-xs text-ink-400 mt-2">
                    Total: {participantTotal} participants
                  </p>
                </div>

                <div>
                  <label className="label">Submitted by</label>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="px-4 py-2 rounded-lg border-2 border-primary-600 bg-primary-50 text-primary-700 text-sm font-medium">
                      {defaultSubmitterType === 'sk' ? 'SK (Sangguniang Kabataan)' : 'Youth Organization'}
                    </div>
                    <span className="text-xs text-ink-400">Auto-detected from your account</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 — Review & Submit */}
            {step === 2 && (
              <>
                <h2 className="text-base font-semibold text-ink-800">Step 3: Review &amp; Submit</h2>
                <p className="text-sm text-ink-500">
                  Confirm your details below, then attach your accomplishment report and any supporting files.
                </p>

                <SubmitSummary
                  data={wizardData.current}
                  existingAttachments={existingSubmission?.attachments}
                />

                {/* Main report document */}
                <div>
                  <label className="label">
                    Monitoring Report
                    {!existingSubmission?.file && <span className="text-red-500 ml-0.5">*</span>}
                    {existingSubmission?.file && (
                      <span className="ml-2 text-xs text-ink-400 font-normal">
                        already uploaded — upload a new one to replace it
                      </span>
                    )}
                  </label>
                  {mainFile ? (
                    <div className="flex items-center gap-2 p-3 bg-primary-50 rounded-lg border border-primary-200">
                      <FileText size={16} className="text-primary-600 flex-shrink-0" />
                      <span className="text-sm text-primary-700 truncate flex-1">{mainFile.name}</span>
                      <button type="button" onClick={() => setMainFile(null)} className="text-ink-400 hover:text-ink-700">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={e => setMainFile(e.target.files?.[0] ?? null)}
                      className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                  )}
                  <p className="text-xs text-ink-400 mt-1">PDF only (.pdf, max 10 MB)</p>
                </div>

                {/* Thumbnail / cover photo */}
                <div>
                  <label className="label">Cover Photo (optional)</label>
                  {thumbnailFile ? (
                    <div className="flex items-center gap-2 p-3 bg-paper-50 rounded-lg border border-paper-200">
                      <Paperclip size={16} className="text-ink-400 flex-shrink-0" />
                      <span className="text-sm text-ink-600 truncate flex-1">{thumbnailFile.name}</span>
                      <button type="button" onClick={() => setThumbnailFile(null)} className="text-ink-400 hover:text-ink-700">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setThumbnailFile(e.target.files?.[0] ?? null)}
                      className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-paper-50 file:text-ink-600 hover:file:bg-paper-100"
                    />
                  )}
                </div>

                {/* Supporting documents */}
                <div>
                  <label className="label">Supporting Documents (optional — photos, certificates, etc.)</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) setSupportingFiles(prev => [...prev, f])
                      e.target.value = ''
                    }}
                    className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-paper-50 file:text-ink-600 hover:file:bg-paper-100"
                  />
                  {supportingFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {supportingFiles.map((f, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-paper-50 rounded-lg text-sm">
                          <FileText size={13} className="text-ink-400 flex-shrink-0" />
                          <span className="truncate flex-1 text-ink-600">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => setSupportingFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="text-ink-400 hover:text-red-500"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-xs text-ink-400 bg-paper-50 rounded-lg p-3">
                  You can save as draft now and add attachments later before submitting.
                </div>
              </>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isBusy}
                  className="btn-secondary btn-sm flex items-center gap-1"
                >
                  <ChevronLeft size={15} /> Back
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isBusy}
                className="btn-secondary btn-sm flex items-center gap-1"
              >
                <Save size={14} />
                {saveDraftMutation.isPending ? 'Saving…' : 'Save Draft'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {step < 2 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isBusy}
                  className="btn-primary btn-sm flex items-center gap-1"
                >
                  Next <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!wizardData.current.title.trim()) {
                      toast.error('Title is required')
                      return
                    }
                    if (wizardData.current.submission_type === 'ppa' && !wizardData.current.category) {
                      toast.error('Category is required')
                      return
                    }
                    // Require main file only if no file was previously uploaded
                    if (!mainFile && !existingSubmission?.file) {
                      toast.error('Please attach the Monitoring Report before submitting')
                      return
                    }
                    submitForReviewMutation.mutate()
                  }}
                  disabled={isBusy}
                  className="btn-primary btn-sm flex items-center gap-1"
                >
                  <Send size={14} />
                  {submitForReviewMutation.isPending ? 'Submitting…' : 'Submit Report'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
