import { useEffect, useState } from 'react'
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
import { compareFaces, preloadFaceModels, type FaceMatchResult } from '@/utils/faceMatch'
import { flipHorizontal, shrinkImage } from '@/utils/shrinkImage'
import { readIdFront, type OcrSummary } from '@/utils/idOcr'
import { useAuthStore } from '@/store/authStore'
import type { CaptureMeta } from '../components/CameraCapture'

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
  ai_face_match?: boolean | null
  decision_flags?: string[]
  auto_approved?: boolean
  admin_notes?: string
  submitted_at?: string
}

/** Plain-language reasons shown to the user when a submission needs a human check. */
const FLAG_MESSAGES: Record<string, string> = {
  unsupported_id: 'The selected ID type is not accepted right now.',
  front_unreadable: "We couldn't clearly read the front of your ID.",
  back_unreadable: "We couldn't clearly read the back of your ID.",
  selfie_quality: 'The selfie was too dark or too small.',
  no_live_scan: 'The ID was not scanned live with the camera.',
  liveness_failed: 'The quick live check (blink or head turn) could not be completed, so the LYDO team will take a look.',
  face_mismatch: 'The face in your selfie does not sufficiently match the photo on your ID.',
  face_uncertain: 'The face match was not certain enough to approve automatically.',
  face_unchecked: 'The face comparison could not be completed on your device.',
  ocr_unavailable: 'The text on your ID could not be read automatically.',
  name_mismatch: 'The name on the ID does not match the name on your account.',
  expired_id: 'The submitted ID appears to be expired.',
  unrecognized_id: 'The document was not recognised as the ID type you selected.',
  low_confidence: 'The automatic checks were not confident enough to approve.',
  name_unclear: 'The name on the ID only partly matches the name on your account.',
  duplicate_id: 'This ID number is already used by another account.',
  face_fair: 'The face match was fair rather than strong.',
}

// Used only until the list the LYDO admin controls has been loaded from the server.
const FALLBACK_ID_TYPES = [
  { value: 'national_id',     label: 'PhilSys National ID' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'passport',        label: 'Passport' },
  { value: 'umid',            label: 'UMID' },
  { value: 'voters_id',       label: "Voter's Certification" },
  { value: 'philhealth',      label: 'PhilHealth ID' },
  { value: 'postal',          label: 'Postal ID' },
  { value: 'prc',             label: 'PRC ID' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

/** Say what really went wrong instead of always blaming the connection. */
function submitError(err: unknown): string {
  const e = err as any
  if (!e?.response) return 'We could not reach the server. Please check your connection and try again.'
  const d = e.response.data
  const status = e.response.status
  const detail = (typeof d === 'object' && d && (d.detail ?? (Object.values(d).flat()[0] as string))) || ''
  if (status === 413) return 'The photos are too large to upload. Retake them and try again.'
  if (status >= 500) return 'The server had a problem saving your verification. Please try again in a moment.'
  return String(detail || 'Submission was not accepted. Please retake your photos and try again.')
}

export default function VerifyIdentityPage() {
  const qc = useQueryClient()
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [idType, setIdType] = useState('')
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [metas, setMetas] = useState<{ front?: CaptureMeta; back?: CaptureMeta; selfie?: CaptureMeta }>({})
  const [camera, setCamera] = useState(false)
  const [match, setMatch] = useState<FaceMatchResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [engine, setEngine] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [consent, setConsent] = useState(false)
  const [retake, setRetake] = useState(false)       // only the selfie is being redone
  const [restart, setRestart] = useState(false)      // start over with new ID photos
  const [retakeBusy, setRetakeBusy] = useState(false)
  const [result, setResult] = useState<Verification | null>(null)
  const [ocr, setOcr] = useState<{ status: 'idle' | 'running' | 'done'; progress: number; result: OcrSummary | null }>({ status: 'idle', progress: 0, result: null })
  const me = useAuthStore().user as { first_name?: string; last_name?: string } | null

  const idTypesQ = useQuery<{ value: string; label: string }[]>({
    queryKey: ['verification-id-types'],
    queryFn: () => apiClient.get('/verification/id-types/').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const ID_TYPES = idTypesQ.data && idTypesQ.data.length > 0 ? idTypesQ.data : FALLBACK_ID_TYPES

  // Warm up the face models as soon as the page opens
  useEffect(() => {
    let alive = true
    preloadFaceModels().then(ok => { if (alive) setEngine(ok ? 'ready' : 'unavailable') })
    return () => { alive = false }
  }, [])

  // Free in-browser face comparison: selfie vs the photo on the ID front
  useEffect(() => {
    setMatch(null)
    if (!front || !selfie) return
    let cancelled = false
    setChecking(true)
    // The stored selfie is mirrored like the preview was; match it the natural way round, as on the ID.
    const prepare = metas.selfie?.mirrored ? flipHorizontal(selfie) : Promise.resolve(selfie)
    prepare
      .then(natural => compareFaces(front, natural))
      .then(r => {
        if (!cancelled) { setMatch(r); setChecking(false) }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [front, selfie])

  // Read the text on the ID front (on this device) as soon as it is captured
  useEffect(() => {
    setOcr({ status: 'idle', progress: 0, result: null })
    if (!front || !idType || retake) return
    let cancelled = false
    setOcr({ status: 'running', progress: 0, result: null })
    readIdFront(
      front,
      { firstName: me?.first_name ?? '', lastName: me?.last_name ?? '', idType },
      p => { if (!cancelled) setOcr(o => ({ ...o, progress: p })) },
    ).then(r => { if (!cancelled) setOcr({ status: 'done', progress: 100, result: r }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [front, idType, retake])

  const verificationQ = useQuery<Verification>({
    queryKey: ['verification-status'],
    queryFn: () => apiClient.get('/verification/').then(r => r.data),
  })

  const submitMutation = useMutation({
    mutationFn: ({ fd, onlySelfie }: { fd: FormData; onlySelfie: boolean }) =>
      apiClient.post(onlySelfie ? '/verification/retake-selfie/' : '/verification/submit/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data),
    onSuccess: (data: Verification) => {
      qc.invalidateQueries({ queryKey: ['verification-status'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      setResult(data)
      setRetake(false)
      setRestart(false)
      setStep(5)
    },
  })

  const verification = verificationQ.data

  /** Redo only the selfie: the ID photo that is already saved is used for the face comparison. */
  const startRetake = async () => {
    setRetakeBusy(true)
    try {
      const res = await apiClient.get('/verification/mine/id-front/', { responseType: 'blob' })
      const blob = res.data as Blob
      setFront(new File([blob], 'id-front.jpg', { type: blob.type || 'image/jpeg' }))
      setBack(null)
      setSelfie(null)
      setMetas({})
      setIdType(verification?.id_type ?? '')
      setConsent(true)
      setResult(null)
      setRetake(true)
      setStep(4)
    } catch {
      toast.error('We could not open your saved ID photo. Please scan your ID again.')
      startOver()
    } finally {
      setRetakeBusy(false)
    }
  }

  /** Scan everything again. */
  const startOver = () => {
    setRetake(false)
    setRestart(true)
    setFront(null)
    setBack(null)
    setSelfie(null)
    setMetas({})
    setResult(null)
    setCamera(false)
    setStep(1)
  }

  const FACE_FLAGS = ['face_uncertain', 'face_mismatch', 'face_unchecked', 'liveness_failed', 'selfie_quality']
  const selfieFlagged = (flags?: string[]) => (flags ?? []).some(f => FACE_FLAGS.includes(f))

  const RetakeButtons = ({ flags }: { flags?: string[] }) => (
    <div className="space-y-2 pt-2">
      <p className="text-sm text-ink-600">
        {selfieFlagged(flags)
          ? 'You do not have to wait: take a new selfie in good light and our system will check it again right away.'
          : 'Want to try again? Retaking your photos is checked right away.'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={startRetake} disabled={retakeBusy} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
          <Camera size={16} /> {retakeBusy ? 'Opening...' : 'Retake my selfie'}
        </button>
        <button type="button" onClick={startOver} className="btn-secondary">Scan my ID again</button>
      </div>
    </div>
  )

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
  if ((verification?.status === 'reviewing' || verification?.status === 'pending') && !retake && !restart) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100">
          <Shield size={40} className="text-primary-600 animate-pulse" />
        </div>
        <h1 className="font-display font-extrabold text-3xl text-ink-900">Pending Review</h1>
        <p className="text-ink-600 leading-relaxed">
          Your verification requires additional review. Please wait while the LYDO team evaluates your submission. You will be notified of the result.
        </p>
        {(verification?.decision_flags?.length ?? 0) > 0 && (
          <ul className="mx-auto max-w-sm text-left text-sm text-ink-600 space-y-1 rounded-xl bg-ink-50 border border-ink-100 p-3">
            {verification!.decision_flags!.map(f => (
              <li key={f} className="flex gap-2"><span className="text-amber-500">•</span> {FLAG_MESSAGES[f] ?? f}</li>
            ))}
          </ul>
        )}
        {verification?.ai_face_match != null && (
          <p className={cn('inline-block rounded-lg border px-3 py-1.5 text-sm', verification.ai_face_match ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800')}>
            Face check: {verification.ai_face_match ? 'matches the ID photo' : 'no clear match, an admin will review it manually'}
          </p>
        )}
        <RetakeButtons flags={verification?.decision_flags} />
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
    const approved = result?.status === 'approved'
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className={cn('inline-flex items-center justify-center w-20 h-20 rounded-full', approved ? 'bg-emerald-100' : 'bg-primary-100')}>
          {approved ? <ShieldCheck size={40} className="text-emerald-600" /> : <Clock size={40} className="text-primary-600" />}
        </div>
        <h1 className="font-display font-extrabold text-3xl text-ink-900">
          {approved ? 'Identity Successfully Verified!' : 'Pending Review'}
        </h1>
        <p className="text-ink-600 leading-relaxed">
          {approved
            ? 'Congratulations! Your identity has been successfully verified. Your account now has a Verified Badge.'
            : 'Your verification requires additional review. Please wait while the LYDO team evaluates your submission.'}
        </p>
        {!approved && (result?.decision_flags?.length ?? 0) > 0 && (
          <ul className="mx-auto max-w-sm text-left text-sm text-ink-600 space-y-1 rounded-xl bg-ink-50 border border-ink-100 p-3">
            {result!.decision_flags!.map(f => (
              <li key={f} className="flex gap-2"><span className="text-amber-500">•</span> {FLAG_MESSAGES[f] ?? f}</li>
            ))}
          </ul>
        )}
        {!approved && <RetakeButtons flags={result?.decision_flags} />}
        <button
          type="button"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ['verification-status'] })
            setStep(1)
            setRestart(false)
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
      {retake && (
        <div className="rounded-xl bg-primary-50 border border-primary-100 p-3 text-sm text-primary-800">
          Retake your selfie. We will compare it with the ID photo you already sent, and check it again right away.
        </div>
      )}
      <div className={cn('flex items-center gap-2', retake && 'hidden')}>
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
          <label className="flex items-start gap-3 rounded-xl border border-ink-100 bg-ink-50 p-3 text-sm text-ink-700 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
            <span>
              I agree that LYDO may collect and store photos of my government ID and my face to verify my identity, as described in the{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-700 underline">Privacy Policy</a>.
              The photos are kept in private storage that only authorised LYDO staff can open, and are deleted after the retention period.
            </span>
          </label>
          <button
            type="button"
            disabled={!idType || !consent}
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
        const noFace = match?.ok === false && (match.reason === 'no-id-face' || match.reason === 'no-selfie-face')
        const allReady = !!(front && (retake || back) && selfie) && !checking && !noFace
        return (
          <div className="space-y-4">
            <div>
              <h2 className="font-display font-bold text-lg text-ink-900">{slots.title}</h2>
              <p className="text-sm text-ink-500 mt-0.5">{idLabel} · {slots.hint}</p>
            </div>

            {slots.key === 'selfie' && (
              <div
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm flex items-center gap-2',
                  engine === 'ready' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : engine === 'loading' ? 'bg-ink-50 border-ink-100 text-ink-600'
                  : 'bg-amber-50 border-amber-200 text-amber-800',
                )}
              >
                <Shield size={14} />
                {engine === 'ready' ? 'Face check is ready. Take your selfie and we will compare it with your ID photo.'
                  : engine === 'loading' ? 'Preparing the face check (one-time download)...'
                  : 'Automatic face check could not load. You can still submit; an admin will review it manually.'}
              </div>
            )}

            {camera ? (
              <CameraCapture
                facing={slots.facing}
                guide={slots.guide}
                allowUpload={slots.upload}
                label={slots.title}
                onCancel={() => setCamera(false)}
                onCapture={async (picked, meta) => {
                  const f = meta.uploaded ? await shrinkImage(picked) : picked
                  setMetas(m => ({ ...m, [slots.key]: meta }))
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
                {slots.key === 'front' && (
                  <div
                    className={cn(
                      'rounded-xl border p-3 text-sm',
                      ocr.status === 'running' ? 'bg-ink-50 border-ink-100 text-ink-600'
                      : ocr.result?.ran && ocr.result.expired ? 'bg-alert-50 border-alert-200 text-alert-700'
                      : ocr.result?.ran && (ocr.result.name_score ?? 0) >= 0.75 ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800',
                    )}
                  >
                    {ocr.status === 'running' ? `Reading your ID on this device... ${ocr.progress}%`
                      : !ocr.result?.ran ? "We couldn't clearly read your ID. Retake it so the whole card is sharp and well lit, or continue and an admin will check it."
                      : ocr.result.expired ? 'The submitted ID appears to be expired. Please use a valid identification document.'
                      : (ocr.result.name_score ?? 0) >= 0.75 ? 'ID text read successfully. The name matches your account.'
                      : "We read the ID, but the name does not clearly match your account name. You can continue; an admin will check it."}
                  </div>
                )}
                {slots.key === 'selfie' && (
                  <div
                    className={cn(
                      'rounded-xl border p-3 text-sm',
                      checking || !match ? 'bg-ink-50 border-ink-100 text-ink-600'
                      : match.ok && match.matched ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : match.ok ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : match.reason === 'error' ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-alert-50 border-alert-200 text-alert-700',
                    )}
                  >
                    {checking || !match ? 'Comparing your face with the ID photo...'
                      : match.ok && match.matched ? `Face matches the ID photo (${Math.round((match.similarity ?? 0) * 100)}% similarity).`
                      : match.ok ? 'The face in your selfie does not sufficiently match the photo on your submitted ID. Please retake your selfie in better light, or submit and an admin will review it.'
                      : match.reason === 'no-selfie-face' ? 'No face detected in the selfie. Retake it facing the camera in good light.'
                      : match.reason === 'no-id-face' ? (retake ? 'We could not find a face on your saved ID photo. Please scan your ID again.' : 'No face detected on the ID front. Go back and recapture the front so the photo is clear.')
                      : 'Automatic face check is unavailable. You can still submit; an admin will review it.'}
                  </div>
                )}
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
                <button
                  type="button"
                  onClick={() => {
                    if (retake) { setRetake(false); setSelfie(null); setFront(null); setMetas({}); return }
                    setStep((step - 1) as 1 | 2 | 3)
                  }}
                  className="btn-secondary"
                >
                  {retake ? 'Cancel' : '← Back'}
                </button>
                {step < 4 ? (
                  <button type="button" disabled={!current} onClick={() => setStep((step + 1) as 3 | 4)} className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
                    Next →
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!allReady || submitMutation.isPending || ocr.status === 'running' || !consent}
                    onClick={() => {
                      if (!front || !selfie || (!retake && !back)) return
                      const fd = new FormData()
                      fd.append('selfie_image', selfie)
                      fd.append('client_checks', JSON.stringify(retake ? { selfie: metas.selfie } : metas))
                      if (match?.ok) {
                        fd.append('face_distance', String(match.distance))
                        fd.append('face_matched', match.matched ? 'true' : 'false')
                      }
                      if (!retake && back) {
                        fd.append('id_type', idType)
                        fd.append('id_image', front)
                        fd.append('id_back_image', back)
                        fd.append('consent', 'true')
                        fd.append('ocr_result', JSON.stringify(ocr.result ?? { ran: false }))
                      }
                      submitMutation.mutate({ fd, onlySelfie: retake })
                    }}
                    className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitMutation.isPending ? (
                      <span className="flex items-center gap-2 justify-center"><Upload size={15} className="animate-bounce" /> Uploading…</span>
                    ) : (
                      <span className="flex items-center gap-2 justify-center"><ShieldCheck size={15} /> {ocr.status === 'running' ? 'Reading your ID...' : 'Submit for verification'}</span>
                    )}
                  </button>
                )}
              </div>
            )}

            {submitMutation.isError && (
              <div className="flex items-center gap-2 text-sm text-alert-700 bg-alert-50 border border-alert-200 rounded-xl p-3">
                <AlertCircle size={15} /> {submitError(submitMutation.error)}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── How it works ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-ink-100 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-sm text-ink-700">How verification works</h3>
        <div className="space-y-2.5">
          {[
            ['Scan', 'Capture the front and back of your government ID with your camera. The camera guides you and crops the photo to the card.'],
            ['Face check', 'Take a live selfie and blink once. It is compared with the photo on the ID.'],
            ['Automatic checks', 'Your ID text is read and your face is matched on your own device. LYDO\'s server also checks that the photos are clear.'],
            ['Privacy', 'Your photos are sent only to LYDO (never to a third-party AI) and kept in private storage that only authorised staff can open.'],
            ['Result', 'If every check passes you are verified right away. If anything is unclear, a LYDO admin reviews it. Nobody is rejected automatically.'],
            ['Verified badge', 'Verified users get a badge on their profile and can register for events.'],
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
