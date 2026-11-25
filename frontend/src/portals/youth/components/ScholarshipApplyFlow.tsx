import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Check, CheckCircle2, Upload, Eye, RefreshCw, Trash2, FileText, AlertCircle, ArrowLeft, ArrowRight, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils'
import { LUCENA_BARANGAYS } from '../pages/YouthRegisterPage'
import { apiErrorMessage } from '../scholarshipApps'
import VerifyGate from './VerifyGate'

export interface ApplyScholarship {
  id: number
  title: string
  provider: string
  requires_gwa: boolean
  is_sample?: boolean
  instructions?: string
  document_requirements: { key: string; label: string; required: boolean; help?: string }[]
}

type Section = Record<string, string>
const STEPS = ['Personal', 'Education', 'Family & Finance', 'Documents', 'Review']
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png']

interface FieldDef {
  key: string
  label: string
  required?: boolean
  type?: 'text' | 'date' | 'number' | 'select' | 'textarea' | 'email' | 'tel'
  options?: string[]
  placeholder?: string
  wide?: boolean
}

const PERSONAL: FieldDef[] = [
  { key: 'full_name', label: 'Complete name', required: true, wide: true },
  { key: 'date_of_birth', label: 'Date of birth', required: true, type: 'date' },
  { key: 'age', label: 'Age', required: true, type: 'number' },
  { key: 'gender', label: 'Gender', required: true, type: 'select', options: ['Male', 'Female', 'Prefer not to say'] },
  { key: 'civil_status', label: 'Civil status', required: true, type: 'select', options: ['Single', 'Married', 'Widowed', 'Separated'] },
  { key: 'nationality', label: 'Nationality', required: true },
  { key: 'email', label: 'Email address', required: true, type: 'email' },
  { key: 'contact_number', label: 'Contact number', required: true, type: 'tel', placeholder: '09XX XXX XXXX' },
  { key: 'address', label: 'Complete residential address', required: true, wide: true },
  { key: 'barangay', label: 'Barangay', required: true, type: 'select', options: LUCENA_BARANGAYS },
]
const EDUCATION = (gwa: boolean): FieldDef[] => [
  { key: 'level', label: 'Current educational level', required: true, type: 'select',
    options: ['Senior High School', 'College', 'Vocational / TESDA', 'Graduate School', 'Other'] },
  { key: 'school_name', label: 'School name', required: true, wide: true },
  { key: 'school_address', label: 'School address', required: true, wide: true },
  { key: 'course', label: 'Course or strand', required: true },
  { key: 'year_level', label: 'Year level', required: true },
  { key: 'student_id', label: 'Student ID number (if applicable)' },
  { key: 'gwa', label: gwa ? 'General Weighted Average (GWA)' : 'GWA (if you have one)', required: gwa, type: 'number', placeholder: 'e.g. 1.75 or 90' },
]
const FAMILY: FieldDef[] = [
  { key: 'father_name', label: "Father's name" },
  { key: 'mother_name', label: "Mother's name" },
  { key: 'guardian_name', label: "Guardian's name (if applicable)" },
  { key: 'parent_occupation', label: 'Parent/guardian occupation', required: true },
  { key: 'monthly_income', label: 'Estimated monthly family income (PHP)', required: true, type: 'number' },
  { key: 'family_members', label: 'Number of family members', required: true, type: 'number' },
  { key: 'other_financial_info', label: 'Other relevant financial information', type: 'textarea', wide: true },
]

function checkSection(defs: FieldDef[], v: Section): Record<string, string> {
  const e: Record<string, string> = {}
  for (const d of defs) {
    const val = (v[d.key] ?? '').trim()
    if (d.required && !val) e[d.key] = `${d.label} is required.`
  }
  if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) e.email = 'Enter a valid email address.'
  if (v.age && !(Number(v.age) >= 10 && Number(v.age) <= 100)) e.age = 'Enter a valid age.'
  if (v.contact_number && !/^[0-9+()\-\s]{7,30}$/.test(v.contact_number)) e.contact_number = 'Enter a valid contact number.'
  if (v.date_of_birth && new Date(v.date_of_birth) >= new Date()) e.date_of_birth = 'Enter a valid date of birth.'
  if (v.monthly_income && Number(v.monthly_income) < 0) e.monthly_income = 'Enter a valid amount.'
  if (v.family_members && Number(v.family_members) < 1) e.family_members = 'Enter a valid number.'
  if (v.gwa && Number.isNaN(Number(v.gwa))) e.gwa = 'Enter a number.'
  return e
}

function FieldInput({ d, value, error, onChange }: { d: FieldDef; value: string; error?: string; onChange: (v: string) => void }) {
  const id = `sch-${d.key}`
  const common = {
    id, value, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-err` : undefined,
    className: cn('input w-full', error && 'border-red-400'),
    placeholder: d.placeholder,
  }
  return (
    <div className={cn(d.wide && 'sm:col-span-2')}>
      <label htmlFor={id} className="block text-xs font-semibold text-ink-700 mb-1">
        {d.label}{d.required && <span className="text-red-500"> *</span>}
      </label>
      {d.type === 'select' ? (
        <select {...common} onChange={e => onChange(e.target.value)}>
          <option value="">Select...</option>
          {d.options!.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : d.type === 'textarea' ? (
        <textarea {...common} rows={3} onChange={e => onChange(e.target.value)} />
      ) : (
        <input {...common} type={d.type ?? 'text'} inputMode={d.type === 'number' ? 'decimal' : undefined}
          max={d.type === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
          step={d.type === 'number' ? 'any' : undefined} onChange={e => onChange(e.target.value)} />
      )}
      {error && <p id={`${id}-err`} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function DocSlot({ label, help, required, files, onAdd, onRemove, onReplace, error }: {
  label: string; help?: string; required: boolean; files: File[]; onAdd: (f: File) => void; onRemove: (i: number) => void; onReplace: (i: number, f: File) => void; error?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const replacing = useRef<number | null>(null)
  const multiple = label.startsWith('Other')
  const pick = (f?: File) => {
    if (!f) return
    if (!ALLOWED.includes(f.type)) return toast.error('Only PDF, JPG or PNG files are allowed.')
    if (f.size > MAX_BYTES) return toast.error('Each file must be under 5 MB.')
    if (replacing.current !== null) onReplace(replacing.current, f)
    else onAdd(f)
    replacing.current = null
  }
  const preview = (f: File) => window.open(URL.createObjectURL(f), '_blank', 'noopener')
  return (
    <div className={cn('rounded-xl border p-3', error ? 'border-red-300 bg-red-50/40' : 'border-ink-100 bg-white')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-800">
          {label} {required ? <span className="text-red-500">*</span> : <span className="text-xs font-normal text-ink-400">(optional)</span>}
        </p>
        {(multiple || files.length === 0) && (
          <button type="button" onClick={() => { replacing.current = null; ref.current?.click() }} className="btn-secondary btn-sm gap-1.5">
            <Upload size={13} /> {files.length ? 'Add another' : 'Upload'}
          </button>
        )}
      </div>
      {help && <p className="mt-1 text-xs leading-relaxed text-ink-500">{help}</p>}
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden"
        aria-label={`Upload ${label}`}
        onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
      {files.map((f, i) => (
        <div key={i} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs">
          <FileText size={14} className="text-primary-600 shrink-0" />
          <span className="min-w-0 flex-1 truncate font-medium text-ink-700">{f.name}</span>
          <span className="text-ink-400">{(f.size / 1024).toFixed(0)} KB</span>
          <button type="button" onClick={() => preview(f)} className="text-primary-700 hover:underline inline-flex items-center gap-1"><Eye size={12} /> Preview</button>
          <button type="button" onClick={() => { replacing.current = i; ref.current?.click() }} className="text-primary-700 hover:underline inline-flex items-center gap-1"><RefreshCw size={12} /> Replace</button>
          <button type="button" onClick={() => onRemove(i)} className="text-red-600 hover:underline inline-flex items-center gap-1"><Trash2 size={12} /> Remove</button>
        </div>
      ))}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default function ScholarshipApplyFlow(props: { scholarship: ApplyScholarship; onClose: () => void }) {
  return <VerifyGate onClose={props.onClose} what="apply for a scholarship"><ScholarshipForm {...props} /></VerifyGate>
}

function ScholarshipForm({ scholarship: s, onClose }: { scholarship: ApplyScholarship; onClose: () => void }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const p = user?.profile
  const [step, setStep] = useState(0)
  const [personal, setPersonal] = useState<Section>({
    full_name: user?.full_name ?? '', email: user?.email ?? '', contact_number: p?.phone ?? '',
    date_of_birth: p?.birthdate ?? '', gender: '', nationality: 'Filipino', civil_status: '',
    address: '', barangay: LUCENA_BARANGAYS.includes(p?.barangay ?? '') ? (p?.barangay ?? '') : '',
    age: p?.birthdate ? String(Math.max(0, Math.floor((Date.now() - new Date(p.birthdate).getTime()) / 31557600000))) : '',
  })
  const [education, setEducation] = useState<Section>({})
  const [family, setFamily] = useState<Section>({})
  const [files, setFiles] = useState<Record<string, File[]>>({})
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [reference, setReference] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const eduDefs = useMemo(() => EDUCATION(s.requires_gwa), [s.requires_gwa])
  const sections = [
    { defs: PERSONAL, v: personal, set: setPersonal },
    { defs: eduDefs, v: education, set: setEducation },
    { defs: FAMILY, v: family, set: setFamily },
  ]

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  useEffect(() => { topRef.current?.scrollIntoView({ block: 'start' }) }, [step, reference])

  const docErrors = () => {
    const e: Record<string, string> = {}
    for (const d of s.document_requirements) if (d.required && !(files[d.key]?.length)) e[d.key] = 'This document is required.'
    return e
  }
  const validateStep = (i: number): boolean => {
    let e: Record<string, string> = {}
    if (i < 3) {
      e = checkSection(sections[i].defs, sections[i].v)
      if (i === 2 && !(family.father_name?.trim() || family.mother_name?.trim() || family.guardian_name?.trim()))
        e.father_name = "Enter at least one of the father's, mother's or guardian's name."
    } else if (i === 3) e = docErrors()
    setErrors(e)
    return Object.keys(e).length === 0
  }
  const next = () => { if (validateStep(step)) setStep(step + 1) }

  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('scholarship', String(s.id))
      fd.append('personal', JSON.stringify(personal))
      fd.append('education', JSON.stringify(education))
      fd.append('family', JSON.stringify(family))
      fd.append('consent_given', 'true')
      for (const [k, list] of Object.entries(files)) list.forEach(f => fd.append(`doc_${k}`, f))
      return apiClient.post('/applications/scholarship/', fd, { headers: { 'Content-Type': undefined as unknown as string } })
    },
    onSuccess: res => {
      setReference(res.data.reference_number)
      qc.invalidateQueries({ queryKey: ['my-scholarship-applications'] })
      qc.invalidateQueries({ queryKey: ['my-applications'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (e: any) => setServerError(apiErrorMessage(e, 'Could not submit your application. Please try again.')),
  })

  const trySubmit = () => {
    setServerError('')
    for (let i = 0; i < 4; i++) {
      if (!validateStep(i)) { setStep(i); toast.error('Please complete the highlighted fields first.'); return }
    }
    if (!consent) { setErrors({ consent: 'Please confirm the declaration and consent.' }); return }
    submit.mutate()
  }

  const setField = (idx: number) => (key: string, val: string) => {
    sections[idx].set(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(({ [key]: _drop, ...rest }) => rest)
  }

  const summaryRows = (defs: FieldDef[], v: Section) =>
    defs.filter(d => (v[d.key] ?? '').trim()).map(d => (
      <div key={d.key} className="flex justify-between gap-4 py-1.5 text-sm border-b border-ink-50 last:border-0">
        <dt className="text-ink-500">{d.label.replace(/ \(.*\)$/, '')}</dt>
        <dd className="text-ink-900 font-medium text-right break-words max-w-[60%]">{v[d.key]}</dd>
      </div>
    ))

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center bg-primary-950/60 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label={`Apply for ${s.title}`}>
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-full sm:max-h-[94vh]">
        {/* Header */}
        <div className="shrink-0 overflow-hidden sm:rounded-t-2xl">
          <div className="relative flex items-start justify-between gap-3 bg-gradient-to-br from-primary-600 to-primary-800 px-5 py-4 text-white">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
            <div className="relative min-w-0">
              <p className="inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-50">Scholarship application</p>
              <h2 className="mt-1.5 text-lg font-extrabold text-white leading-snug break-words">{s.title}</h2>
              <p className="text-xs text-primary-100">{s.provider}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="relative p-1.5 rounded-lg bg-white/15 text-white hover:bg-white/25"><X size={18} /></button>
          </div>
          <div className="ph-stripe h-1 w-full" />
        </div>

        {reference ? (
          <div className="overflow-y-auto px-5 py-8 text-center space-y-4">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 size={30} /></span>
            <p className="text-lg font-bold text-ink-900">Your scholarship application has been successfully submitted!</p>
            <p className="text-sm text-ink-600">Please keep your Application Reference Number for future tracking.</p>
            <p className="inline-block rounded-xl border border-primary-200 bg-primary-50 px-5 py-3 font-mono text-xl font-bold tracking-wider text-primary-800 select-all">{reference}</p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Link to="/my-applications" onClick={onClose} className="btn-primary">View my application status</Link>
              <button onClick={onClose} className="btn-secondary">Back to scholarships</button>
            </div>
          </div>
        ) : (
          <>
            {/* Progress */}
            <ol className="flex items-center gap-1 px-5 py-3 border-b border-primary-100 bg-primary-50/60 overflow-x-auto" aria-label="Application steps">
              {STEPS.map((label, i) => (
                <li key={label} className="flex items-center gap-1 shrink-0" aria-current={i === step ? 'step' : undefined}>
                  <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                    i < step ? 'bg-primary-600 text-white' : i === step ? 'bg-white text-primary-800 ring-2 ring-primary-500' : 'bg-white text-primary-400 border border-primary-200')}>
                    {i < step ? <Check size={13} /> : i + 1}
                  </span>
                  <span className={cn('text-xs font-semibold', i === step ? 'text-primary-900 font-bold' : 'text-primary-400', i !== step && 'hidden sm:inline')}>{label}</span>
                  {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-primary-200" />}
                </li>
              ))}
            </ol>

            <div className="overflow-y-auto px-5 py-5 space-y-4 flex-1">
              <div ref={topRef} />
              {s.is_sample && (
                <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  This scholarship is a sample record for system demonstration, not verified information.
                </p>
              )}

              {step < 3 && (
                <>
                  <h3 className="font-bold text-primary-900 border-l-4 border-primary-500 pl-2">{['Personal information', 'Educational background', 'Family and financial information'][step]}</h3>
                  <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-primary-100 bg-primary-50/40 p-4">
                    {sections[step].defs.map(d => (
                      <FieldInput key={d.key} d={d} value={sections[step].v[d.key] ?? ''} error={errors[d.key]} onChange={v => setField(step)(d.key, v)} />
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h3 className="font-bold text-primary-900 border-l-4 border-primary-500 pl-2">Documentary requirements</h3>
                  <p className="text-xs text-ink-500">Upload PDF, JPG or PNG files, up to 5 MB each. Items marked * are required for this scholarship.</p>
                  {s.document_requirements.length === 0 && (
                    <p className="text-sm text-ink-600 rounded-xl bg-ink-50 p-4">This scholarship does not ask for documents. You can continue.</p>
                  )}
                  <div className="space-y-2.5">
                    {s.document_requirements.map(d => (
                      <DocSlot key={d.key} label={d.label} help={d.help} required={d.required} files={files[d.key] ?? []} error={errors[d.key]}
                        onAdd={f => { setFiles(prev => ({ ...prev, [d.key]: [...(prev[d.key] ?? []), f] })); setErrors(({ [d.key]: _x, ...r }) => r) }}
                        onReplace={(i, f) => setFiles(prev => ({ ...prev, [d.key]: (prev[d.key] ?? []).map((x, j) => (j === i ? f : x)) }))}
                        onRemove={i => setFiles(prev => ({ ...prev, [d.key]: (prev[d.key] ?? []).filter((_, j) => j !== i) }))} />
                    ))}
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <h3 className="font-bold text-primary-900 border-l-4 border-primary-500 pl-2">Review your application</h3>
                  <p className="text-xs text-ink-500">Check everything. Use Edit to fix anything before you submit.</p>
                  {[
                    { title: 'Personal information', idx: 0, rows: summaryRows(PERSONAL, personal) },
                    { title: 'Educational background', idx: 1, rows: summaryRows(eduDefs, education) },
                    { title: 'Family and financial information', idx: 2, rows: summaryRows(FAMILY, family) },
                  ].map(sec => (
                    <section key={sec.title} className="rounded-xl border border-ink-100 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-bold text-ink-800">{sec.title}</h4>
                        <button type="button" onClick={() => setStep(sec.idx)} className="text-xs font-semibold text-primary-700 inline-flex items-center gap-1"><Pencil size={11} /> Edit</button>
                      </div>
                      <dl>{sec.rows}</dl>
                    </section>
                  ))}
                  <section className="rounded-xl border border-ink-100 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-bold text-ink-800">Documents</h4>
                      <button type="button" onClick={() => setStep(3)} className="text-xs font-semibold text-primary-700 inline-flex items-center gap-1"><Pencil size={11} /> Edit</button>
                    </div>
                    {Object.values(files).flat().length === 0 && <p className="text-sm text-ink-500">No documents attached.</p>}
                    <ul className="space-y-1">
                      {s.document_requirements.flatMap(d => (files[d.key] ?? []).map((f, i) => (
                        <li key={d.key + i} className="flex flex-wrap items-center gap-2 text-sm">
                          <FileText size={13} className="text-primary-600" /> <span className="text-ink-500">{d.label}:</span>
                          <span className="font-medium text-ink-800 break-all">{f.name}</span>
                        </li>
                      )))}
                    </ul>
                  </section>

                  <label className={cn('flex items-start gap-2.5 rounded-xl border p-3 text-sm cursor-pointer', errors.consent ? 'border-red-300 bg-red-50/40' : 'border-ink-100')}>
                    <input type="checkbox" className="mt-0.5 h-4 w-4" checked={consent} onChange={e => { setConsent(e.target.checked); setErrors({}) }} />
                    <span className="text-ink-700">
                      I declare that the information I submitted is true and accurate, and I agree to the processing of my personal
                      information for scholarship evaluation.
                    </span>
                  </label>
                  {errors.consent && <p className="text-xs text-red-600">{errors.consent}</p>}
                </>
              )}

              {serverError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{serverError}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 border-t border-primary-100 bg-primary-50/40 px-5 py-3 sm:rounded-b-2xl">
              <button type="button" onClick={() => { setErrors({}); step === 0 ? onClose() : setStep(step - 1) }} className="btn-secondary gap-1.5">
                <ArrowLeft size={14} /> {step === 0 ? 'Cancel' : 'Back'}
              </button>
              {step < 4 ? (
                <button type="button" onClick={next} className="btn-primary gap-1.5 shadow-md shadow-primary-600/20">Next <ArrowRight size={14} /></button>
              ) : (
                <button type="button" onClick={trySubmit} disabled={submit.isPending} className="btn-primary px-6 shadow-md shadow-primary-600/20">
                  {submit.isPending ? 'Submitting...' : 'Submit Application'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
