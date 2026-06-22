import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Building2, FileText, ShieldCheck, Sparkles, ArrowRight,
  ArrowLeft, CheckCircle2, ChevronRight, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1
  name: string
  classification: string
  sub_classification: string
  registration_category: string
  barangay: string
  description: string
  // Step 2
  contact_person: string
  contact_email: string
  contact_phone: string
}

const EMPTY: FormData = {
  name: '',
  classification: '',
  sub_classification: '',
  registration_category: '',
  barangay: '',
  description: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
}

const CLASSIFICATIONS = [
  { value: 'school_based', label: 'School-Based' },
  { value: 'community_based', label: 'Community-Based' },
  { value: 'faith_based', label: 'Faith-Based' },
]

const SUB_CLASSIFICATIONS = [
  { value: 'sk_council', label: 'SK Council' },
  { value: 'youth_org', label: 'Youth Organization (15–30)' },
  { value: 'youth_serving', label: 'Youth Serving Organization (Mixed Ages)' },
]

const REGISTRATION_CATEGORIES = [
  { value: 'lydo', label: 'LYDO Registered' },
  { value: 'nyc', label: 'NYC Registered' },
  { value: 'not_registered', label: 'Not yet registered with any agency' },
]

const STEPS = [
  { n: 1, label: 'Organization Info' },
  { n: 2, label: 'Contact Details' },
  { n: 3, label: 'Review & Submit' },
]

// ─── Step indicators ──────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2 flex-1 last:flex-none">
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0',
            current > s.n ? 'bg-green-500 text-white' :
            current === s.n ? 'bg-primary text-white' :
            'bg-gray-100 text-gray-400'
          )}>
            {current > s.n ? <CheckCircle2 size={14} /> : s.n}
          </div>
          <span className={cn(
            'text-xs font-medium hidden sm:block',
            current === s.n ? 'text-primary' : current > s.n ? 'text-green-600' : 'text-gray-400'
          )}>{s.label}</span>
          {i < STEPS.length - 1 && (
            <div className={cn('flex-1 h-px mx-1', current > s.n ? 'bg-green-300' : 'bg-gray-200')} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Form steps ───────────────────────────────────────────────────────────────

function Step1({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Organization Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.name}
          onChange={e => setData({ ...data, name: e.target.value })}
          placeholder="e.g., Lucena Youth Leaders Coalition"
          className="input w-full"
          maxLength={200}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Classification <span className="text-red-500">*</span>
          </label>
          <select
            value={data.classification}
            onChange={e => setData({ ...data, classification: e.target.value })}
            className="input w-full"
          >
            <option value="">Select classification</option>
            {CLASSIFICATIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sub-classification <span className="text-red-500">*</span>
          </label>
          <select
            value={data.sub_classification}
            onChange={e => setData({ ...data, sub_classification: e.target.value })}
            className="input w-full"
          >
            <option value="">Select sub-classification</option>
            {SUB_CLASSIFICATIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Current Registration Status <span className="text-red-500">*</span>
        </label>
        <select
          value={data.registration_category}
          onChange={e => setData({ ...data, registration_category: e.target.value })}
          className="input w-full"
        >
          <option value="">Is your org already registered with any agency?</option>
          {REGISTRATION_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">This helps LYDO track org recognition data across the city.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Barangay <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.barangay}
          onChange={e => setData({ ...data, barangay: e.target.value })}
          placeholder="Barangay your org operates in"
          className="input w-full"
          maxLength={100}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={4}
          value={data.description}
          onChange={e => setData({ ...data, description: e.target.value })}
          placeholder="Briefly describe your organization's mission, activities, and goals…"
          className="input w-full resize-none"
          maxLength={1000}
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{data.description.length}/1000</p>
      </div>
    </div>
  )
}

function Step2({ data, setData }: { data: FormData; setData: (d: FormData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contact Person <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.contact_person}
          onChange={e => setData({ ...data, contact_person: e.target.value })}
          placeholder="Full name of the authorized representative"
          className="input w-full"
          maxLength={200}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={data.contact_email}
          onChange={e => setData({ ...data, contact_email: e.target.value })}
          placeholder="official@email.com"
          className="input w-full"
        />
        <p className="text-xs text-gray-400 mt-1">LYDO will use this email for official correspondence.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
        <input
          type="tel"
          value={data.contact_phone}
          onChange={e => setData({ ...data, contact_phone: e.target.value })}
          placeholder="+63 912 345 6789"
          className="input w-full"
          maxLength={20}
        />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">Required documents upon approval</p>
        <ul className="space-y-1 text-amber-700">
          {['Constitution & By-Laws', 'List of Officers', 'Member Roster (at least 10 members)', 'Recent Activity Report'].map(doc => (
            <li key={doc} className="flex items-start gap-2">
              <ChevronRight size={13} className="mt-0.5 flex-shrink-0" />
              {doc}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs">You will be able to upload these after submission when LYDO contacts you.</p>
      </div>
    </div>
  )
}

function Step3({ data }: { data: FormData }) {
  const classLabel = CLASSIFICATIONS.find(c => c.value === data.classification)?.label ?? data.classification
  const subLabel = SUB_CLASSIFICATIONS.find(c => c.value === data.sub_classification)?.label ?? data.sub_classification
  const regLabel = REGISTRATION_CATEGORIES.find(c => c.value === data.registration_category)?.label ?? data.registration_category

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Please review your application before submitting.</p>

      <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        <ReviewRow label="Organization Name" value={data.name} />
        <ReviewRow label="Classification" value={classLabel} />
        <ReviewRow label="Sub-classification" value={subLabel} />
        <ReviewRow label="Registration Status" value={regLabel} />
        <ReviewRow label="Barangay" value={data.barangay} />
        <ReviewRow label="Description" value={data.description} />
        <ReviewRow label="Contact Person" value={data.contact_person} />
        <ReviewRow label="Email" value={data.contact_email} />
        {data.contact_phone && <ReviewRow label="Phone" value={data.contact_phone} />}
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-primary-900">
        <p className="font-semibold mb-1">What happens next?</p>
        <ol className="space-y-1 text-primary/80 list-decimal list-inside">
          <li>LYDO staff will review your application.</li>
          <li>You'll receive an email at <strong>{data.contact_email}</strong> with the outcome.</li>
          <li>If approved, you'll be asked to upload supporting documents.</li>
          <li>Your organization will be listed in the LYDO directory.</li>
        </ol>
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <span className="text-xs font-medium text-gray-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 flex-1">{value || '\u2014'}</span>
    </div>
  )
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center space-y-5 py-6">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <CheckCircle2 size={40} className="text-green-600" />
      </div>
      <div>
        <h2 className="font-display font-extrabold text-2xl text-ink-900 tracking-tightish mb-2">Application submitted!</h2>
        <p className="text-gray-500 text-sm max-w-sm mx-auto">
          LYDO staff will review your application and contact you via email. Most applications are reviewed within 5–7 business days.
        </p>
      </div>
      <button onClick={onReset} className="btn-secondary">
        Submit another application
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function YORPRegistrationPage() {
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState(1)
  const [data, setData] = useState<FormData>(EMPTY)
  const [submitted, setSubmitted] = useState(false)

  const submit = useMutation({
    mutationFn: () => apiClient.post('/youth-orgs/', data),
    onSuccess: () => setSubmitted(true),
    onError: (err: any) => {
      const msgs = err?.response?.data
      if (msgs && typeof msgs === 'object') {
        const first = Object.values(msgs).flat()[0]
        if (typeof first === 'string') { toast.error(first); return }
      }
      toast.error('Submission failed. Please try again.')
    },
  })

  const step1Valid = !!(data.name && data.classification && data.sub_classification && data.registration_category && data.barangay && data.description)
  const step2Valid = !!(data.contact_person && data.contact_email)

  const canNext = step === 1 ? step1Valid : step === 2 ? step2Valid : true

  const handleReset = () => {
    setShowForm(false)
    setStep(1)
    setData(EMPTY)
    setSubmitted(false)
  }

  return (
    <div className="space-y-8">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-8 sm:p-10">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div aria-hidden className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-accent-400/20 blur-2xl pointer-events-none" />
        <div className="relative max-w-3xl">
          <p className="eyebrow-on-dark mb-3">YORP · Youth Organization Registration Program</p>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tighter2 leading-[1.05] mb-4">
            Get your org officially recognized.
          </h1>
          <p className="text-primary-100 text-lg leading-relaxed">
            YORP is LYDO's recognition program for youth organizations operating in
            Lucena City. Recognized orgs unlock funding, training, and direct
            participation in the city youth development plan.
          </p>
        </div>
      </header>

      {/* ── What you get ─────────────────────────────────────────────── */}
      {!showForm && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Perk icon={Sparkles}    title="Get featured"           text="Recognized orgs appear in the LYDO directory and are visible to all Lucena youth." />
            <Perk icon={ShieldCheck} title="Apply for grants"        text="Only YORP-recognized orgs can apply for the City's youth project grants." />
            <Perk icon={FileText}    title="Submit accomplishments"  text="Officially log your projects and activities into the LYDO record system." />
          </section>

          <section className="bg-white rounded-3xl border border-ink-100 p-7">
            <p className="eyebrow mb-3">How it works</p>
            <h2 className="font-display font-bold text-2xl text-ink-900 tracking-tightish mb-6">
              Four steps from application to recognition.
            </h2>
            <ol className="space-y-4">
              <Step n="01" title="Submit basic info" text="Org name, contact details, mission, year founded, and barangay coverage." />
              <Step n="02" title="Upload requirements" text="Constitution & by-laws, list of officers, member roster, and recent activity report." />
              <Step n="03" title="LYDO review" text="LYDO staff review your application and may request clarifications via email." />
              <Step n="04" title="Recognition decision" text="Approved orgs are added to the directory and notified by email." />
            </ol>
          </section>

          <section className="rounded-3xl bg-accent-50 border border-accent-200 p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent-400 text-primary-900 flex-shrink-0">
                <Building2 size={22} strokeWidth={2.2} />
              </span>
              <div>
                <h3 className="font-display font-bold text-xl text-ink-900 leading-tight">
                  Ready to register your organization?
                </h3>
                <p className="text-sm text-ink-600 mt-1">
                  Fill out the short application form. LYDO will review and contact you within 5–7 business days.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="btn-primary whitespace-nowrap"
            >
              Start application <ArrowRight size={16} />
            </button>
          </section>
        </>
      )}

      {/* ── Application form ─────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white rounded-3xl border border-ink-100 p-6 sm:p-8 max-w-xl">
          {submitted ? (
            <SuccessScreen onReset={handleReset} />
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-bold text-xl text-ink-900">YORP Application</h2>
                <button onClick={handleReset} className="text-gray-400 hover:text-gray-600 transition-colors" title="Close form">
                  <X size={18} />
                </button>
              </div>

              <StepBar current={step} />

              {step === 1 && <Step1 data={data} setData={setData} />}
              {step === 2 && <Step2 data={data} setData={setData} />}
              {step === 3 && <Step3 data={data} />}

              <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => step > 1 ? setStep(s => s - 1) : handleReset()}
                  className="btn-secondary"
                >
                  <ArrowLeft size={14} /> {step === 1 ? 'Cancel' : 'Back'}
                </button>

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => setStep(s => s + 1)}
                    disabled={!canNext}
                    className="btn-primary"
                  >
                    Next <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => submit.mutate()}
                    disabled={submit.isPending}
                    className="btn-primary"
                  >
                    {submit.isPending ? 'Submitting…' : 'Submit Application'}
                    {!submit.isPending && <CheckCircle2 size={14} />}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Perk({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-ink-100 p-5">
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-50 text-primary-700 mb-3">
        <Icon size={18} />
      </span>
      <h3 className="font-display font-bold text-base text-ink-900 mb-1.5">{title}</h3>
      <p className="text-sm text-ink-600 leading-relaxed">{text}</p>
    </div>
  )
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-50 text-primary-700 font-display font-extrabold text-sm tabular-nums">
        {n}
      </span>
      <div className="flex-1 min-w-0 pt-1">
        <p className="font-semibold text-ink-900 leading-tight">{title}</p>
        <p className="text-sm text-ink-600 mt-1 leading-relaxed">{text}</p>
      </div>
    </li>
  )
}
