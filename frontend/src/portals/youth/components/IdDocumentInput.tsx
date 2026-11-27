import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, CheckCircle2, FileText, RefreshCw, Trash2, Upload, X, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/utils'
import CameraCapture from './CameraCapture'

export const ID_TYPE_OPTIONS: [string, string][] = [
  ['philsys', 'Philippine National ID / PhilSys ID'], ['passport', 'Passport'], ['drivers_license', "Driver's License"], ['umid', 'UMID'],
  ['postal', 'Postal ID'], ['voters', "Voter's Certification"], ['school_id', 'School ID'], ['other_gov', 'Other Government-Issued ID'],
]

export interface IdDoc {
  file: File | null
  source: 'camera' | 'upload'
  idType: string
  idOther: string
  confirmed: boolean
}
export const EMPTY_ID: IdDoc = { file: null, source: 'upload', idType: '', idOther: '', confirmed: false }

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_BYTES = 5 * 1024 * 1024

/** The same fields for the first application and for a replacement: the backend saves a camera photo and an upload the same way. */
export function appendIdFields(fd: FormData, id: IdDoc) {
  if (!id.file) return
  fd.append('doc_valid_id', id.file)
  fd.append('valid_id_source', id.source)
  fd.append('id_confirmed', id.confirmed ? 'true' : 'false')
  if (id.idType) fd.append('valid_id_type', id.idType)
  if (id.idType === 'other_gov' && id.idOther.trim()) fd.append('valid_id_other', id.idOther.trim())
}

type Mode = 'idle' | 'camera' | 'review'

/**
 * The valid ID of a scholarship application: scan it with the camera (retake until it is clear) or upload a photo or PDF,
 * see it, replace or remove it, and confirm that it is yours. Nothing is sent from here: the form sends it with the application.
 */
export default function IdDocumentInput({ value, onChange, error, required = true, hint }: {
  value: IdDoc; onChange: (v: IdDoc) => void; error?: string; required?: boolean; hint?: string
}) {
  const [mode, setMode] = useState<Mode>('idle')
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null)
  const pick = useRef<HTMLInputElement>(null)
  const isImage = value.file?.type.startsWith('image/')
  const url = useMemo(() => (value.file && isImage ? URL.createObjectURL(value.file) : null), [value.file, isImage])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url) }, [shot])

  const set = (patch: Partial<IdDoc>) => onChange({ ...value, ...patch })
  const choose = (f?: File) => {
    if (!f) return
    if (!ALLOWED.includes(f.type)) return toast.error('Only JPG, PNG or PDF files are allowed.')
    if (f.size > MAX_BYTES) return toast.error('The file must be under 5 MB.')
    onChange({ ...value, file: f, source: 'upload', confirmed: false })
  }
  const closeCamera = () => { setShot(null); setMode('idle') }
  const useShot = () => {
    if (!shot) return
    onChange({ ...value, file: shot.file, source: 'camera', confirmed: false })
    closeCamera()
  }
  const openFull = () => { if (value.file) window.open(URL.createObjectURL(value.file), '_blank', 'noopener') }

  return (
    <div className={cn('rounded-xl border p-3 space-y-3', error ? 'border-red-300 bg-red-50/40' : 'border-ink-100 bg-white')}>
      <div>
        <p className="text-sm font-semibold text-ink-800">
          Valid identification document {required ? <span className="text-red-500">*</span> : <span className="text-xs font-normal text-ink-400">(optional)</span>}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          {hint ?? 'Please submit a clear copy of your valid identification document for scholarship application verification. You may scan your ID using your device camera or upload an existing image.'}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-ink-600">Kind of ID <span className="text-ink-400">(optional)</span></span>
          <select className="input mt-0.5 w-full" value={value.idType} onChange={e => set({ idType: e.target.value })}>
            <option value="">Select...</option>
            {ID_TYPE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {value.idType === 'other_gov' && (
          <label className="block">
            <span className="text-xs font-medium text-ink-600">Name of the ID</span>
            <input className="input mt-0.5 w-full" maxLength={60} value={value.idOther} onChange={e => set({ idOther: e.target.value })} placeholder="e.g. Senior Citizen ID" />
          </label>
        )}
      </div>

      <input ref={pick} type="file" className="hidden" aria-label="Upload ID" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={e => { choose(e.target.files?.[0]); e.target.value = '' }} />

      {!value.file ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setMode('camera')} className="btn-primary btn-sm gap-1.5"><Camera size={14} /> Scan ID using camera</button>
            <button type="button" onClick={() => pick.current?.click()} className="btn-secondary btn-sm gap-1.5"><Upload size={14} /> Upload ID</button>
          </div>
          <p className="text-[11px] text-ink-500">Accepted: JPG, JPEG, PNG or PDF. Maximum size: 5 MB. On a phone, the rear camera opens first.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-start gap-3 rounded-xl bg-ink-50 p-2.5">
            {url ? (
              <button type="button" onClick={openFull} aria-label="Open the ID in a larger view" className="shrink-0">
                <img src={url} alt="Your ID" className="h-20 w-32 rounded-lg border border-ink-200 object-cover bg-white" />
              </button>
            ) : (
              <span className="inline-flex h-20 w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-ink-200 bg-white text-primary-600"><FileText size={26} /><span className="text-[10px] font-semibold">PDF</span></span>
            )}
            <div className="min-w-0 flex-1 space-y-0.5 text-xs">
              <p className="truncate font-semibold text-ink-800">{value.file.name}</p>
              <p className="text-ink-500">
                {value.idType ? (value.idType === 'other_gov' && value.idOther ? value.idOther : ID_TYPE_OPTIONS.find(o => o[0] === value.idType)?.[1]) : 'Kind of ID not chosen'}
                {' · '}{(value.file.size / 1024).toFixed(0)} KB · {value.source === 'camera' ? 'Scanned with the camera' : 'Uploaded'}
              </p>
              <p className="inline-flex items-center gap-1 font-semibold text-emerald-700"><CheckCircle2 size={12} /> Ready to send with your application</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                <button type="button" onClick={openFull} className="font-semibold text-primary-700 hover:underline">Preview</button>
                <button type="button" onClick={() => pick.current?.click()} className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline"><RefreshCw size={11} /> Replace</button>
                <button type="button" onClick={() => setMode('camera')} className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline"><Camera size={11} /> Scan again</button>
                <button type="button" onClick={() => onChange({ ...value, file: null, confirmed: false })} className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline"><Trash2 size={11} /> Remove</button>
              </div>
            </div>
          </div>
          <label className="flex items-start gap-2.5 rounded-lg border border-ink-100 p-2.5 text-xs text-ink-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={value.confirmed} onChange={e => set({ confirmed: e.target.checked })} />
            <span><ShieldCheck size={12} className="mr-1 inline text-primary-600" />I confirm that this identification document is mine and that the copy I submitted is accurate.</span>
          </label>
        </div>
      )}

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

      {mode === 'camera' && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Scan your ID" onClick={closeCamera}>
          <div className="my-auto w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            {!shot ? (
              <>
                <CameraCapture
                  facing="environment" guide="card" label="Place your ID inside the frame"
                  onCancel={closeCamera}
                  onCapture={f => setShot({ file: f, url: URL.createObjectURL(f) })}
                />
                <p className="mt-3 text-xs text-ink-500">Camera blocked or not working? Close this and choose <strong>Upload ID</strong> instead.</p>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink-800">Is the ID clear and readable?</p>
                  <button type="button" onClick={closeCamera} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"><X size={16} /></button>
                </div>
                <img src={shot.url} alt="Captured ID" className="w-full rounded-xl border border-ink-200 bg-ink-50" />
                <p className="text-xs text-ink-500">Check that the name, photo and details can be read. If it is blurry or cut off, retake it.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShot(null)} className="btn-secondary flex-1 gap-1.5"><RefreshCw size={14} /> Retake</button>
                  <button type="button" onClick={useShot} className="btn-primary flex-1 gap-1.5"><CheckCircle2 size={14} /> Use this photo</button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
