import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, ShieldX, Shield, Upload, Camera,
  CheckCircle2, XCircle, Clock, AlertCircle, ChevronRight, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import CameraCapture from '../components/CameraCapture'

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
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [idType, setIdType] = useState('')
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [camera, setCamera] = useState(false)

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
      setStep(5)
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
  if (step === 5) {
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
          Scan the front and back of a valid Philippine government-issued ID with your camera, then take a live selfie so we can match your face to the ID photo.
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
        {(['Select ID', 'ID front', 'ID back', 'Face scan'] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4
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
              {i < 3 && <ChevronRight size={14} className="text-ink-300" />}
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

      {/* ── Steps 2–4: ID front, ID back, live selfie ───────────────── */}
      {step >= 2 && step <= 4 && (() => {
        const slots = {
          2: { key: 'front', title: 'Front of your ID', hint: 'Fit the whole card inside the frame. Name, photo and ID number must be readable.', facing: 'environment' as const, guide: 'card' as const, upload: true },
          3: { key: 'back', title: 'Back of your ID', hint: 'Now flip the card and capture the back side.', facing: 'environment' as const, guide: 'card' as const, upload: true },
          4: { key: 'selfie', title: 'Face verification', hint: 'Look straight at the camera in good light, no mask or sunglasses. We compare your face with the photo on the ID.', facing: 'user' as const, guide: 'face' as const, upload: false },
        }[step as 2 | 3 | 4]
        const current = slots.key === 'front' ? front : slots.key === 'back' ? back : selfie
        const setCurrent = (f: File | null) => (slots.key === 'front' ? setFront(f) : slots.key === 'back' ? setBack(f) : setSelfie(f))
        const idLabel = ID_TYPES.find(t => t.value === idType)?.label
        const allReady = !!(front && back && selfie)
        return (
          <div className="space-y-4">
            <div>
              <h2 className="font-display font-bold text-lg text-ink-900">{slots.title}</h2>
              <p className="text-sm text-ink-500 mt-0.5">{idLabel} · {slots.hint}</p>
            </div>

            {camera ? (
              <CameraCapture
                facing={slots.facing}
                guide={slots.guide}
                allowUpload={slots.upload}
                label={slots.title}
                onCancel={() => setCamera(false)}
                onCapture={f => {
                  if (f.size > 10 * 1024 * 1024) { toast.error('Photo must not exceed 10 MB.'); return }
                  setCurrent(f)
                  setCamera(false)
                }}
              />
            ) : current ? (
              <div className="space-y-3">
                <img src={URL.createObjectURL(current)} alt={slots.title} className="w-full max-h-72 rounded-2xl object-contain bg-ink-50 border border-ink-100" />
                <button type="button" onClick={() => { setCurrent(null); setCamera(true) }} className="text-xs font-semibold text-primary-700 hover:text-primary-800 inline-flex items-center gap-1">
                  <RefreshCw size={12} /> Retake
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCamera(true)}
                className="w-full rounded-2xl border-2 border-dashed border-ink-200 hover:border-primary-400 hover:bg-primary-50/30 p-8 flex flex-col items-center gap-3 transition-colors"
              >
                <Camera size={40} className="text-primary-500" />
                <span className="text-sm font-semibold text-ink-700">{slots.key === 'selfie' ? 'Open camera for face scan' : 'Scan with camera'}</span>
                <span className="text-xs text-ink-400">Camera permission is requested by your browser</span>
              </button>
            )}

            {!camera && (
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep((step - 1) as 1 | 2 | 3)} className="btn-secondary">← Back</button>
                {step < 4 ? (
                  <button type="button" disabled={!current} onClick={() => setStep((step + 1) as 3 | 4)} className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
                    Next →
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!allReady || submitMutation.isPending}
                    onClick={() => {
                      if (!front || !back || !selfie) return
                      const fd = new FormData()
                      fd.append('id_type', idType)
                      fd.append('id_image', front)
                      fd.append('id_back_image', back)
                      fd.append('selfie_image', selfie)
                      submitMutation.mutate(fd)
                    }}
                    className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitMutation.isPending ? (
                      <span className="flex items-center gap-2 justify-center"><Upload size={15} className="animate-bounce" /> Uploading…</span>
                    ) : (
                      <span className="flex items-center gap-2 justify-center"><ShieldCheck size={15} /> Submit for verification</span>
                    )}
                  </button>
                )}
              </div>
            )}

            {submitMutation.isError && (
              <div className="flex items-center gap-2 text-sm text-alert-700 bg-alert-50 border border-alert-200 rounded-xl p-3">
                <AlertCircle size={15} /> Submission failed. Please check your connection and try again.
              </div>
            )}
          </div>
        )
      })()}

      {/* ── How it works ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-ink-100 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-sm text-ink-700">How AI verification works</h3>
        <div className="space-y-2.5">
          {[
            ['Scan', 'Capture the front and back of your government ID with your camera.'],
            ['Face check', 'Take a live selfie; it is compared with the photo on the ID.'],
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
