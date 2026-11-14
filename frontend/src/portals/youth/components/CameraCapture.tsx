import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, Upload, X } from 'lucide-react'

interface Props {
  /** 'environment' = rear camera (for IDs), 'user' = front camera (for selfie) */
  facing: 'environment' | 'user'
  label: string
  /** Show a card-shaped guide (ID) or an oval (face) */
  guide: 'card' | 'face'
  /** Allow choosing a file instead of the camera (disabled for the live selfie) */
  allowUpload?: boolean
  onCapture: (file: File) => void
  onCancel: () => void
}

export default function CameraCapture({ facing, label, guide, allowUpload = false, onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    stop()
    setError(null)
    setReady(false)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open the camera. Use a modern browser over HTTPS.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setReady(true)
    } catch (e: any) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Camera permission was blocked. Allow camera access in your browser settings and try again.'
          : 'No camera could be started on this device.',
      )
    }
  }, [facing, stop])

  useEffect(() => {
    start()
    return stop
  }, [start, stop])

  const snap = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (facing === 'user') {
      // un-mirror so text/face are saved the right way round
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, 0, 0)
    canvas.toBlob(
      blob => {
        if (!blob) return
        stop()
        onCapture(new File([blob], `${facing === 'user' ? 'selfie' : 'id'}-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9,
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-800">{label}</p>
        <button type="button" onClick={() => { stop(); onCancel() }} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400" aria-label="Close camera">
          <X size={16} />
        </button>
      </div>

      <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3]">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
          style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined}
        />
        {ready && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {guide === 'card' ? (
              <div className="w-[86%] aspect-[1.586] rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            ) : (
              <div className="h-[82%] aspect-[3/4] rounded-[50%] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            )}
          </div>
        )}
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">Starting camera...</div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-white text-sm">
            <p>{error}</p>
            <button type="button" onClick={start} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 font-semibold">
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!ready} onClick={snap} className="btn-primary inline-flex items-center gap-2 disabled:opacity-40">
          <Camera size={16} /> Capture
        </button>
        {allowUpload && (
          <>
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary inline-flex items-center gap-2">
              <Upload size={16} /> Upload a photo instead
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) { stop(); onCapture(f) }
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
