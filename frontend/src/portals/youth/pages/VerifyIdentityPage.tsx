import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, ShieldX, Shield, Upload, FileImage,
  CheckCircle2, XCircle, Clock, AlertCircle, ChevronRight, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Verification {
  id?: number
  status: 'none' | 'pending' | 'reviewing' | 'approved' | 'rejected'
  status_display?: string
  is_verified: boolean
  id_type?: string
  id_type_display?: string
  ai_confidence?: number
  ai_notes?: string
  ai_verdict?: string
  admin_notes?: string
  submitted_at?: string
}

const ID_TYPES = [
  { value: 'national_id',     label: 'PhilSys National ID' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'passport',        label: 'Passport' },
  { value: 'umid',            label: 'UMID' },
  { value: 'sss',             label: 'SSS ID' },
  { value: 'voters_id',       label: "Voter's Certification" },
  { value: 'philhealth',      label: 'PhilHealth ID' },
  { value: 'school_id',       label: 'School ID' },
  { value: 'barangay_id',     label: 'Barangay ID' },
  { value: 'postal',          label: 'Postal ID' },
  { value: 'pwd_id',          label: 'PWD ID' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VerifyIdentityPage() {
  const qc = useQueryClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [idType, setIdType] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const verificationQ = useQuery<Verification>({
    queryKey: ['verification-status'],
    queryFn: () => apiClient.get('/verification/').then(r => r.data),
  })

  const submitMutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.post('/verification/submit/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verification-status'] })
      setStep(3)
    },
  })

  const verification = verificationQ.data

  if (verificationQ.isLoading) return <PageSpinner />

  // ── Already verified ────────────────────────────────────────────────────────
  if (verification?.is_verified) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100">
          <ShieldCheck size={40} className="text-emerald-600" />
        </div>
        <h1 className="font-display font-extrabold text-3xl text-ink-900">Identity Verified</h1>
        <p className="text-ink-600">
          Your identity has been confirmed. A verified badge is now displayed on your profile.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
          <CheckCircle2 size={15} /> Verified member
        </div>
      </div>
    )
  }

  // ── Reviewing / pending ─────────────────────────────────────────────────────
  if (verification?.status === 'reviewing' || verification?.status === 'pending') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100">
          <Shield size={40} className="text-primary-600 animate-pulse" />
        </div>
        <h1 className="font-display font-extrabold text-3xl text-ink-900">Under Review</h1>
        <p className="text-ink-600 leading-relaxed">
          Your ID is being reviewed by our AI verification system. This usually takes under a minute.
        </p>
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: ['verification-status'] })}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800 px-4 py-2 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors"
        >
          <RefreshCw size={14} /> Check status
        </button>
      </div>
    )
  }

  // ── Rejected — allow re-submit ──────────────────────────────────────────────
  const wasRejected = verification?.status === 'rejected'

  // ── Submission success screen ───────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100">
          <Clock size={40} className="text-primary-600" />
        </div>
        <h1 className="font-display font-extrabold text-3xl text-ink-900">Submitted!</h1>
        <p className="text-ink-600 leading-relaxed">
          Our AI is analysing your ID now. Refresh in a moment to see the result.
        </p>
        <button
          type="button"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ['verification-status'] })
            setStep(1)
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800 px-4 py-2 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors"
        >
          <RefreshCw size={14} /> Check result
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-600 text-white">
            <ShieldCheck size={24} />
          </span>
          <div>
            <p className="eyebrow">Identity Verification</p>
            <h1 className="font-display font-extrabold text-2xl text-ink-900">Verify your identity</h1>
          </div>
        </div>
        <p className="text-ink-600 leading-relaxed">
          Upload a valid Philippine government-issued ID. Our AI will analyse it instantly —
          no waiting, no human reviewing your photo.
        </p>
      </header>

      {/* ── Rejected notice ─────────────────────────────────────────── */}
      {wasRejected && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-alert-50 border border-alert-200">
          <ShieldX size={18} className="text-alert-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-alert-800 mb-0.5">Previous submission rejected</p>
            <p className="text-sm text-alert-700">
              {verification?.ai_notes || verification?.admin_notes || 'Please try again with a clearer photo.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Step indicators ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {(['Select ID', 'Upload photo', 'Submit'] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3
          const active = step === n
          const done   = step > n
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={cn(
                'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors',
                done   ? 'bg-emerald-500 text-white'
                : active ? 'bg-primary-600 text-white'
                : 'bg-ink-100 text-ink-500',
              )}>
                {done ? <CheckCircle2 size={14} /> : n}
              </div>
              <span className={cn('text-sm font-semibold hidden sm:block', active ? 'text-ink-900' : 'text-ink-400')}>
                {label}
              </span>
              {i < 2 && <ChevronRight size={14} className="text-ink-300" />}
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Choose ID type ───────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-display font-bold text-lg text-ink-900">Which ID are you submitting?</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Type <span className="text-red-500">*</span>
            </label>
            <select
              value={idType}
              onChange={(e) => setIdType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select document type...</option>
              {ID_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!idType}
            onClick={() => setStep(2)}
            className="btn-primary w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Step 2: Upload image ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-display font-bold text-lg text-ink-900">
            Upload your {ID_TYPES.find(t => t.value === idType)?.label}
          </h2>

          {/* Tips */}
          <div className="p-4 rounded-2xl bg-primary-50 border border-primary-100 space-y-1.5">
            {[
              'Lay the ID flat on a dark surface',
              'Make sure all four corners are visible',
              'Ensure name, photo, and ID number are readable',
              'Avoid glare, shadows, and blurry photos',
            ].map(tip => (
              <p key={tip} className="text-xs text-primary-700 flex items-start gap-2">
                <CheckCircle2 size={12} className="flex-shrink-0 mt-0.5" /> {tip}
              </p>
            ))}
          </div>

          {/* Drop zone */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              'w-full rounded-2xl border-2 border-dashed p-8 flex flex-col items-center gap-3 transition-colors',
              preview
                ? 'border-primary-400 bg-primary-50/30'
                : 'border-ink-200 hover:border-primary-400 hover:bg-primary-50/30',
            )}
          >
            {preview ? (
              <img
                src={preview}
                alt="ID preview"
                className="max-h-48 rounded-xl object-contain shadow"
              />
            ) : (
              <>
                <FileImage size={40} className="text-ink-300" />
                <span className="text-sm font-semibold text-ink-600">
                  Click to select a photo
                </span>
                <span className="text-xs text-ink-400">JPG, PNG or WEBP · max 10 MB</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.size > 10 * 1024 * 1024) {
                toast.error('File must not exceed 10 MB.')
                e.target.value = ''
                return
              }
              setFile(f)
              setPreview(URL.createObjectURL(f))
            }}
          />

          {preview && (
            <button
              type="button"
              onClick={() => { setFile(null); setPreview(null) }}
              className="text-xs font-semibold text-alert-600 hover:text-alert-700"
            >
              Remove photo
            </button>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="btn-secondary">
              ← Back
            </button>
            <button
              type="button"
              disabled={!file}
              onClick={() => {
                if (!file) return
                const fd = new FormData()
                fd.append('id_type', idType)
                fd.append('id_image', file)
                submitMutation.mutate(fd)
              }}
              className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? (
                <span className="flex items-center gap-2 justify-center">
                  <Upload size={15} className="animate-bounce" /> Uploading…
                </span>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  <ShieldCheck size={15} /> Submit for verification
                </span>
              )}
            </button>
          </div>

          {submitMutation.isError && (
            <div className="flex items-center gap-2 text-sm text-alert-700 bg-alert-50 border border-alert-200 rounded-xl p-3">
              <AlertCircle size={15} /> Submission failed. Please check your connection and try again.
            </div>
          )}
        </div>
      )}

      {/* ── How it works ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-ink-100 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-sm text-ink-700">How AI verification works</h3>
        <div className="space-y-2.5">
          {[
            ['Upload', 'Submit a clear photo of your government ID.'],
            ['AI Analysis', 'Claude (Anthropic AI) checks authenticity, photo presence, and readability.'],
            ['Instant result', 'High-confidence passes are approved automatically. Edge cases go to admin review.'],
            ['Verified badge', 'Approved users get a verified badge on their profile.'],
          ].map(([title, desc]) => (
            <div key={title} className="flex items-start gap-2.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0 mt-1.5" />
              <p className="text-ink-600">
                <span className="font-semibold text-ink-800">{title}: </span>{desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
