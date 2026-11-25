import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, CheckCircle2, Paperclip, Send, Camera, RefreshCw, ShieldCheck, AlertTriangle, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils'
import { compareFaces, preloadFaceModels, type FaceMatchResult } from '@/utils/faceMatch'
import { flipHorizontal } from '@/utils/shrinkImage'
import VerifyGate from './VerifyGate'
import CameraCapture, { type CaptureMeta } from './CameraCapture'

interface Props {
  kind: 'scholarship' | 'job'
  objectId: number
  title: string
  provider?: string
  requirements: string[]
  /** send an application that was not accepted again, with corrected proof */
  resubmit?: boolean
  onClose: () => void
}

interface MineApp {
  id: number; kind: string; object_id: number; status: string
  full_name?: string; birthdate?: string | null; contact_number?: string; email?: string; address?: string
  id_type?: string; id_number?: string; message?: string; admin_note?: string; document_url?: string | null
}

const ID_TYPES = [
  'National ID (PhilSys)', "Driver's License", 'Passport', 'UMID', "Voter's ID",
  'School ID', 'Postal ID', 'Barangay ID', 'Other government ID',
]

type Slot = 'front' | 'back' | 'selfie'
const SLOT_INFO: Record<Slot, { title: string; hint: string; facing: 'environment' | 'user'; guide: 'card' | 'face' }> = {
  front: { title: 'Front of your ID', hint: 'The side with your photo and name.', facing: 'environment', guide: 'card' },
  back: { title: 'Back of your ID', hint: 'The other side, with all four corners visible.', facing: 'environment', guide: 'card' },
  selfie: { title: 'Selfie for the face check', hint: 'Face the camera in good light. It is compared with the photo on the ID.', facing: 'user', guide: 'face' },
}

export function splitRequirements(raw?: string | string[] | null): string[] {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : raw.split(/\r?\n|;/)
  return list.map(r => r.replace(/^[\s\-*•·\d.)]+/, '').trim()).filter(Boolean)
}

export default function ApplyModal(props: Props) {
  return <VerifyGate onClose={props.onClose} what="apply"><ApplyForm {...props} /></VerifyGate>
}

function Preview({ file, label }: { file: File; label: string }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return <img src={url} alt={label} className="h-full w-full object-cover" />
}

function ApplyForm({ kind, objectId, title, provider, requirements, resubmit = false, onClose }: Props) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const p = user?.profile
  const isJob = kind === 'job'
  const [form, setForm] = useState({
    full_name: user?.full_name ?? '',
    birthdate: p?.birthdate ?? '',
    contact_number: p?.phone ?? '',
    email: user?.email ?? '',
    address: [p?.barangay, p?.municipality, p?.province].filter(Boolean).join(', '),
    id_type: ID_TYPES[0],
    id_number: '',
    message: '',
  })
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [file, setFile] = useState<File | null>(null)           // the resume
  const [shots, setShots] = useState<Partial<Record<Slot, File>>>({})
  const [metas, setMetas] = useState<Partial<Record<Slot, CaptureMeta>>>({})
  const [camera, setCamera] = useState<Slot | null>(null)
  const [match, setMatch] = useState<FaceMatchResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [engine, setEngine] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [done, setDone] = useState(false)
  const prefilled = useRef(false)

  const { data: mine = [] } = useQuery<MineApp[]>({
    queryKey: ['my-applications'],
    queryFn: () => apiClient.get('/applications/').then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? [])),
  })
  const existing = mine.find(a => a.kind === kind && a.object_id === objectId)
  const already = !!existing && !(resubmit && (existing.status === 'rejected' || existing.status === 'revoked'))

  // sending it again: start from what the person wrote before, so only the wrong part needs fixing
  useEffect(() => {
    if (!resubmit || !existing || prefilled.current) return
    prefilled.current = true
    setForm(f => ({
      ...f,
      full_name: existing.full_name || f.full_name,
      birthdate: existing.birthdate || f.birthdate,
      contact_number: existing.contact_number || f.contact_number,
      email: existing.email || f.email,
      address: existing.address || f.address,
      id_type: existing.id_type || f.id_type,
      id_number: existing.id_number || f.id_number,
      message: existing.message || '',
    }))
  }, [resubmit, existing])

  // free in-browser face check (nothing leaves the device for this step)
  useEffect(() => {
    if (!isJob) return
    let alive = true
    preloadFaceModels().then(ok => { if (alive) setEngine(ok ? 'ready' : 'unavailable') })
    return () => { alive = false }
  }, [isJob])

  useEffect(() => {
    setMatch(null)
    if (!shots.front || !shots.selfie) return
    let cancelled = false
    setChecking(true)
    const prepare = metas.selfie?.mirrored ? flipHorizontal(shots.selfie) : Promise.resolve(shots.selfie)
    prepare.then(natural => compareFaces(shots.front!, natural)).then(r => {
      if (!cancelled) { setMatch(r); setChecking(false) }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots.front, shots.selfie])

  const faceBlocked = !!match && (!match.ok ? (match.reason === 'no-id-face' || match.reason === 'no-selfie-face') : !match.matched)
  const hasResume = !!file || (resubmit && !!existing?.document_url)
  const allChecked = requirements.every(r => checked.has(r))
  const proofReady = !isJob || (!!shots.front && !!shots.back && !!shots.selfie && !checking && !faceBlocked && hasResume)
  const valid = !!(form.full_name.trim() && form.contact_number.trim() && form.email.trim() && form.address.trim() && form.id_number.trim() && allChecked && proofReady)

  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('kind', kind)
      fd.append('object_id', String(objectId))
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
      Array.from(checked).forEach(r => fd.append('confirmed_requirements', r))
      if (file) fd.append('document', file)
      if (isJob) {
        fd.append('id_document', shots.front!)
        fd.append('id_document_back', shots.back!)
        fd.append('selfie', shots.selfie!)
        fd.append('face_check', JSON.stringify({
          ...(match?.ok ? { distance: match.distance, similarity: match.similarity, matched: match.matched } : {}),
          front: metas.front, back: metas.back, selfie: metas.selfie,
        }))
      }
      const url = resubmit && existing ? `/applications/${existing.id}/resubmit/` : '/applications/'
      return apiClient.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-applications'] })
      setDone(true)
    },
    onError: (err: any) => {
      const d = err?.response?.data
      const msg = d?.non_field_errors?.[0] ?? d?.detail ?? (d && Object.values(d).flat()[0]) ?? 'Could not submit your application.'
      toast.error(String(msg))
    },
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const toggle = (r: string) =>
    setChecked(prev => {
      const n = new Set(prev)
      if (n.has(r)) n.delete(r)
      else n.add(r)
      return n
    })

  const n1 = requirements.length ? 1 : 0
  const slotTile = (slot: Slot, disabled = false) => {
    const info = SLOT_INFO[slot]
    const f = shots[slot]
    return (
      <button type="button" disabled={disabled} onClick={() => setCamera(slot)}
        className={cn('group relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed text-center text-xs transition-colors',
          f ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 bg-gray-50 hover:border-primary-400', disabled && 'opacity-50 cursor-not-allowed')}>
        {f ? (
          <>
            <Preview file={f} label={info.title} />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[11px] font-semibold text-white"><RefreshCw size={11} /> Retake</span>
          </>
        ) : (
          <>
            <Camera size={22} className="mb-1 text-primary-600" />
            <span className="px-2 font-semibold text-gray-800">{info.title}</span>
            <span className="px-2 text-[11px] text-gray-500">Scan with camera</span>
          </>
        )}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={e => { e.stopPropagation(); onClose() }}>
      <div
        className="bg-white w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
              {resubmit ? 'Send again' : 'Apply'} · {isJob ? 'Job' : 'Scholarship'}
            </p>
            <h2 className="font-bold text-gray-900 leading-tight break-words">{title}</h2>
            {provider && <p className="text-xs text-gray-500 mt-0.5">{provider}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 size={48} className="text-green-500 mx-auto" />
            <h3 className="text-lg font-bold text-gray-900">{resubmit ? 'Application sent again' : 'Application submitted'}</h3>
            <p className="text-sm text-gray-600">
              Your application for <b>{title}</b> was received. LYDO staff will check your ID, your face check and your resume before deciding, and you will be notified of the result.
            </p>
            <button onClick={onClose} className="btn-primary">Done</button>
          </div>
        ) : already ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 size={40} className="text-primary-600 mx-auto" />
            <p className="text-sm text-gray-700">You already applied to this {isJob ? 'job' : 'scholarship'}.</p>
            <button onClick={onClose} className="btn-secondary">Close</button>
          </div>
        ) : camera ? (
          <div className="p-5 space-y-3">
            <div>
              <h3 className="font-bold text-gray-900">{SLOT_INFO[camera].title}</h3>
              <p className="text-xs text-gray-500">{SLOT_INFO[camera].hint}</p>
            </div>
            <CameraCapture
              facing={SLOT_INFO[camera].facing}
              guide={SLOT_INFO[camera].guide}
              allowUpload={false}
              label={SLOT_INFO[camera].title}
              onCancel={() => setCamera(null)}
              onCapture={(picked, meta) => {
                setMetas(m => ({ ...m, [camera]: meta }))
                setShots(s => ({ ...s, [camera]: picked }))
                setCamera(null)
              }}
            />
          </div>
        ) : (
          <form className="p-5 space-y-5" onSubmit={e => { e.preventDefault(); if (valid) submit.mutate() }}>
            {resubmit && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-1">
                <p className="flex items-center gap-1.5 font-semibold"><MessageSquare size={14} /> Your last application was not accepted</p>
                {existing?.admin_note
                  ? <p className="whitespace-pre-wrap break-words"><b>Reason from LYDO:</b> {existing.admin_note}</p>
                  : <p>Check your details and your ID photos, then send it again.</p>}
                <p className="text-xs text-amber-800">Fix what is wrong and send it again. Take new photos of your ID (front and back) and a new selfie.</p>
              </div>
            )}

            {requirements.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">1. Requirements: confirm you have each one</h3>
                <ul className="space-y-1.5">
                  {requirements.map(r => (
                    <li key={r}>
                      <label
                        className={cn(
                          'flex items-start gap-2.5 rounded-xl border px-3 py-2 text-sm cursor-pointer',
                          checked.has(r) ? 'border-primary-300 bg-primary-50' : 'border-gray-200',
                        )}
                      >
                        <input type="checkbox" className="mt-0.5" checked={checked.has(r)} onChange={() => toggle(r)} />
                        <span className="text-gray-700">{r}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">{n1 + 1}. Personal identity</h3>
              <input className="input" placeholder="Full name" value={form.full_name} onChange={set('full_name')} required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className="input" type="date" value={form.birthdate} onChange={set('birthdate')} aria-label="Birthdate" />
                <input className="input" placeholder="Contact number" inputMode="tel" value={form.contact_number} onChange={set('contact_number')} required />
              </div>
              <input className="input" type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
              <input className="input" placeholder="Complete address (barangay, city, province)" value={form.address} onChange={set('address')} required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select className="input" value={form.id_type} onChange={set('id_type')} aria-label="Type of valid ID">
                  {ID_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <input className="input" placeholder="ID number" value={form.id_number} onChange={set('id_number')} required />
              </div>
            </section>

            {isJob && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">
                  {n1 + 2}. Scan your valid ID and verify your face <span className="text-red-500">*</span>
                </h3>
                <p className="text-xs text-gray-500">Use the camera. Scan the <b>front</b>, then the <b>back</b> of your ID, then take a live <b>selfie</b>. Photos from the gallery are not accepted.</p>
                <div className="grid grid-cols-3 gap-2">
                  {slotTile('front')}
                  {slotTile('back')}
                  {slotTile('selfie', !shots.front)}
                </div>
                {!shots.front && <p className="text-[11px] text-gray-400">Scan the front of the ID first. The selfie is compared with the photo on it.</p>}

                {shots.front && shots.selfie && (
                  <div className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-sm',
                    checking ? 'border-gray-200 bg-gray-50 text-gray-600'
                      : !match ? 'border-gray-200 bg-gray-50 text-gray-600'
                      : match.ok && match.matched ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : match.ok || match.reason === 'no-id-face' || match.reason === 'no-selfie-face' ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800')}>
                    {checking ? <RefreshCw size={15} className="mt-0.5 animate-spin" />
                      : match?.ok && match.matched ? <ShieldCheck size={15} className="mt-0.5" /> : <AlertTriangle size={15} className="mt-0.5" />}
                    <span>
                      {checking ? 'Comparing your face with the photo on the ID...'
                        : !match ? ''
                        : match.ok && match.matched ? 'Face check passed. Your selfie matches the photo on your ID.'
                        : match.ok ? 'Your face does not match the photo on the ID. Retake the selfie in good light, or scan the ID again.'
                        : match.reason === 'no-id-face' ? 'We could not see a clear face on the front of the ID. Scan it again so the photo is sharp and without glare.'
                        : match.reason === 'no-selfie-face' ? 'We could not see your face in the selfie. Retake it, facing the camera in good light.'
                        : 'The automatic face check could not run. You can still send it; LYDO staff will compare the faces.'}
                    </span>
                  </div>
                )}
                {engine === 'unavailable' && shots.selfie && <p className="text-[11px] text-amber-700">The automatic face check could not load, so LYDO staff will compare the faces by hand.</p>}
              </section>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">
                {n1 + (isJob ? 3 : 2)}. {isJob ? 'Resume' : 'Supporting document'}{' '}
                {isJob && !(resubmit && existing?.document_url) ? <span className="text-red-500">*</span> : null}{' '}
                <span className="font-normal text-gray-400">({isJob ? 'PDF, Word or image, max 5 MB' : 'optional, max 5 MB'})</span>
              </h3>
              {resubmit && existing?.document_url && !file && <p className="text-xs text-gray-500">Your earlier resume is kept unless you upload a new one.</p>}
              <label className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed text-sm cursor-pointer hover:border-primary-400', file ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-gray-300 text-gray-600')}>
                {file ? <CheckCircle2 size={15} /> : <Paperclip size={15} />} <span className="truncate">{file ? file.name : isJob ? (resubmit && existing?.document_url ? 'Upload a new resume (optional)' : 'Upload your resume') : 'Attach PDF or image'}</span>
                <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <textarea className="input resize-none" rows={3} placeholder="Message to the reviewer (optional)" value={form.message} onChange={set('message')} />
            </section>

            {!allChecked && <p className="text-xs text-amber-600">Confirm all requirements to enable Submit.</p>}
            {isJob && (!shots.front || !shots.back || !shots.selfie) && <p className="text-xs text-amber-600">Scan the front and back of your ID and take your selfie to enable Submit.</p>}
            {isJob && !hasResume && <p className="text-xs text-amber-600">Upload your resume to enable Submit.</p>}
            <p className="text-[11px] leading-relaxed text-gray-500">Your ID, selfie and resume are seen only by you and the LYDO staff who review your application.</p>
            <button
              type="submit"
              disabled={!valid || submit.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={15} /> {submit.isPending ? 'Sending...' : resubmit ? 'Send application again' : 'Submit application'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
