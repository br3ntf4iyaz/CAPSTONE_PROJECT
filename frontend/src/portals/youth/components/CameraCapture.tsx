import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, AlertTriangle, RefreshCw, Upload, X } from 'lucide-react'
import { cn } from '@/utils'
import { loadRealtimeFaceApi } from '@/utils/faceMatch'
import {
  coverMapping, detectCard, exposure, eyeAspectRatio, sharpness, stepBlink, stepTurn, toGray, yawRatio,
  type Rect, type TurnState,
} from '@/utils/imageAnalysis'

export interface CaptureMeta {
  kind: 'face' | 'card'
  /** photo was picked from the gallery instead of the live camera */
  uploaded?: boolean
  /** card: all four borders were found and the ID was framed */
  cardDetected?: boolean
  sharpness?: number
  brightness?: number
  glare?: number
  /** face: the person blinked while framed (basic liveness) */
  liveness?: boolean
  /** face: how much of the frame the face fills (0..1) */
  faceFill?: number
}

interface Props {
  /** 'environment' = rear camera (for IDs), 'user' = front camera (for selfie) */
  facing: 'environment' | 'user'
  label: string
  /** Rectangular card frame (ID) or oval face frame */
  guide: 'card' | 'face'
  /** Allow choosing a file instead of the camera (disabled for the live selfie) */
  allowUpload?: boolean
  onCapture: (file: File, meta: CaptureMeta) => void
  onCancel: () => void
}

type Tone = 'info' | 'warn' | 'good'
interface Hint { text: string; tone: Tone; progress?: number }

const HOLD_MS = 1500          // how long the framing must stay steady before capture is allowed
const FALLBACK_MS = 6000      // after this long without success, allow a manual capture (flagged for review)
const CARD_RATIO = 1.586      // ID-1 card (credit-card size)
const SHARP_MIN = 80          // Laplacian variance of the card at 640 px wide; below this the text is not readable

function computeGuide(kind: 'face' | 'card', cw: number, ch: number): Rect {
  if (kind === 'card') {
    const w = Math.min(0.88 * cw, 0.86 * ch * CARD_RATIO)
    const h = w / CARD_RATIO
    return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }
  }
  let h = 0.84 * ch
  let w = h * 0.75
  if (w > 0.8 * cw) { w = 0.8 * cw; h = w / 0.75 }
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }
}

export default function CameraCapture({ facing, label, guide: kind, allowUpload = false, onCapture, onCancel }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const analysisRef = useRef<HTMLCanvasElement | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [camReady, setCamReady] = useState(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hint, setHint] = useState<Hint>({ text: 'Starting camera...', tone: 'info' })
  const [ready, setReady] = useState(false)
  const [fallback, setFallback] = useState(false)

  // live analysis state (refs: updated many times per second, no re-render needed)
  const goodSince = useRef(0)
  const lastCenter = useRef<{ x: number; y: number } | null>(null)
  const startedAt = useRef(0)
  const lostSince = useRef(0)
  const hiresRef = useRef<HTMLCanvasElement | null>(null)
  const liveRef = useRef(false)
  const blinkRef = useRef({ open: 0, closed: false })
  const turnRef = useRef<TurnState>({ samples: [], base: null })
  const holdDone = useRef(0)
  const [eyes, setEyes] = useState<'open' | 'closed' | null>(null)
  const lastFace = useRef<{ x: number; y: number; w: number; h: number; fill: number } | null>(null)
  const lastCard = useRef<Rect | null>(null)
  const lastSharp = useRef(0)
  const lastExposure = useRef({ mean: 0, glare: 0 })

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    stop()
    setError(null)
    setCamReady(false)
    setReady(false)
    setFallback(false)
    liveRef.current = false
    blinkRef.current = { open: 0, closed: false }
    turnRef.current = { samples: [], base: null }
    holdDone.current = 0
    setEyes(null)
    goodSince.current = 0
    lastCenter.current = null
    startedAt.current = performance.now()
    lostSince.current = performance.now()
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
        // do not wait for play(): some phones only resolve it once the first frame arrives
        videoRef.current.play().catch(() => undefined)
      }
      setCamReady(true)
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

  // Keep the on-screen frame and the analysis frame identical
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const frame = size.w > 0 ? computeGuide(kind, size.w, size.h) : null

  // ── live guidance loop ───────────────────────────────────────────────────
  useEffect(() => {
    if (!camReady || !frame) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const g = frame
    const cw = size.w
    const ch = size.h

    const setSafe = (h: Hint, ok: boolean) => {
      if (cancelled) return
      setHint(prev => (prev.text === h.text && prev.tone === h.tone && prev.progress === h.progress ? prev : h))
      setReady(ok)
    }

    const stable = (cx: number, cy: number, tol: number, now: number) => {
      const prev = lastCenter.current
      lastCenter.current = { x: cx, y: cy }
      if (!prev || Math.hypot(cx - prev.x, cy - prev.y) > tol) goodSince.current = now
      else if (!goodSince.current) goodSince.current = now
      return now - goodSince.current
    }

    const faceTick = async () => {
      const v = videoRef.current
      if (!v || !v.videoWidth) return
      const api = await loadRealtimeFaceApi()
      const res = await api
        .detectAllFaces(v, new api.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.45 }))
        .withFaceLandmarks(true)
      const now = performance.now()
      const { s, ox, oy } = coverMapping(cw, ch, v.videoWidth, v.videoHeight)

      if (res.length === 0) {
        goodSince.current = 0
        holdDone.current = 0
        lastFace.current = null
        return setSafe({ text: 'No face detected. Look at the camera.', tone: 'warn' }, false)
      }
      if (res.length > 1) {
        goodSince.current = 0
        holdDone.current = 0
        lastFace.current = null
        return setSafe({ text: 'Only one face should be visible.', tone: 'warn' }, false)
      }

      // Liveness evidence is collected on EVERY frame with one face, not only at the end of
      // "Hold Still": a natural blink or a slow head turn at any moment counts.
      if (!liveRef.current) {
        const lm = res[0].landmarks
        const ear = (eyeAspectRatio(lm.getLeftEye()) + eyeAspectRatio(lm.getRightEye())) / 2
        const blinked = stepBlink(blinkRef.current, ear)
        const turned = stepTurn(turnRef.current, yawRatio(lm.positions))
        if (blinked || turned) liveRef.current = true
        const closed = ear < blinkRef.current.open * 0.8
        setEyes(prev => (prev === (closed ? 'closed' : 'open') ? prev : closed ? 'closed' : 'open'))
      }

      const b = res[0].detection.box
      const fw = b.width * s
      const fh = b.height * s
      const fx = b.x * s + ox
      const fy = b.y * s + oy
      const cxf = fx + fw / 2
      const cyf = fy + fh / 2
      const fill = fh / g.h
      const dx = (cxf - (g.x + g.w / 2)) / g.w
      const dy = (cyf - (g.y + g.h / 2)) / g.h - 0.04 // the detector box sits a little below the middle of the head

      lastFace.current = { x: b.x, y: b.y, w: b.width, h: b.height, fill }

      if (fill < 0.45) {
        goodSince.current = 0
        holdDone.current = 0
        return setSafe({ text: 'Move Closer', tone: 'warn' }, false)
      }
      if (fill > 0.88) {
        goodSince.current = 0
        holdDone.current = 0
        return setSafe({ text: 'Move Back', tone: 'warn' }, false)
      }
      if (Math.abs(dx) > 0.14 || Math.abs(dy) > 0.15 || fx < g.x - 4 || fx + fw > g.x + g.w + 4) {
        goodSince.current = 0
        holdDone.current = 0
        return setSafe({ text: 'Center Your Face', tone: 'warn' }, false)
      }

      // Hold Still. Once it has been satisfied, small movements (like blinking) no longer reset it.
      if (!holdDone.current) {
        const held = stable(cxf, cyf, 0.05 * g.w, now)
        if (held < HOLD_MS) {
          return setSafe({ text: 'Hold Still', tone: 'info', progress: held / HOLD_MS }, false)
        }
        holdDone.current = now
      }

      if (!liveRef.current) {
        if (now - holdDone.current > FALLBACK_MS) {
          setFallback(true)
          return setSafe({ text: 'Could not confirm you are live. You can still capture; an admin will review it.', tone: 'warn' }, true)
        }
        return setSafe({ text: 'Blink once, or slowly turn your head', tone: 'info' }, false)
      }
      setSafe({ text: 'Face Detected. Ready to capture.', tone: 'good' }, true)
    }

    const cardTick = () => {
      const v = videoRef.current
      if (!v || !v.videoWidth) return
      const now = performance.now()
      const { s, ox, oy } = coverMapping(cw, ch, v.videoWidth, v.videoHeight)
      const aw = 320
      const ah = Math.max(60, Math.round((aw * ch) / cw))
      let cv = analysisRef.current
      if (!cv) { cv = document.createElement('canvas'); analysisRef.current = cv }
      cv.width = aw
      cv.height = ah
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      // exactly the part of the camera image the user sees in the box
      ctx.drawImage(v, -ox / s, -oy / s, cw / s, ch / s, 0, 0, aw, ah)
      const imageData = ctx.getImageData(0, 0, aw, ah)
      const gray = toGray(imageData)
      const f = aw / cw
      const det = detectCard(gray, imageData.data)

      if (!det) {
        goodSince.current = 0
        lastCard.current = null
        if (now - lostSince.current > FALLBACK_MS) {
          setFallback(true)
          return setSafe({ text: 'Could not find the ID edges. Keep the whole ID in the frame, then capture; an admin will review it.', tone: 'warn' }, true)
        }
        return setSafe({ text: 'Place the whole ID inside the frame', tone: 'warn' }, false)
      }

      lostSince.current = now
      const gw = g.w * f
      const gcx = (g.x + g.w / 2) * f
      const gcy = (g.y + g.h / 2) * f
      const dcx = det.x + det.w / 2
      const dcy = det.y + det.h / 2
      const ratio = det.w / gw
      lastCard.current = { x: det.x / f, y: det.y / f, w: det.w / f, h: det.h / f } // container px

      if (ratio < 0.8) { goodSince.current = 0; return setSafe({ text: 'Move Closer', tone: 'warn' }, false) }
      if (ratio > 1.12) { goodSince.current = 0; return setSafe({ text: 'Move Farther', tone: 'warn' }, false) }
      if (Math.abs(dcx - gcx) > 0.09 * gw || Math.abs(dcy - gcy) > 0.12 * gw) {
        goodSince.current = 0
        return setSafe({ text: 'Center Your ID', tone: 'warn' }, false)
      }

      // Blur is judged on a larger copy of just the card: at 320 px wide a soft photo still looks sharp.
      let hi = hiresRef.current
      if (!hi) { hi = document.createElement('canvas'); hiresRef.current = hi }
      const cr = { x: det.x / f, y: det.y / f, w: det.w / f, h: det.h / f }
      hi.width = 640
      hi.height = Math.max(40, Math.round((640 * cr.h) / cr.w))
      const hctx = hi.getContext('2d', { willReadFrequently: true })
      let sharp = sharpness(gray, det)
      if (hctx) {
        hctx.drawImage(v, (cr.x - ox) / s, (cr.y - oy) / s, cr.w / s, cr.h / s, 0, 0, hi.width, hi.height)
        sharp = sharpness(toGray(hctx.getImageData(0, 0, hi.width, hi.height)))
      }
      const ex = exposure(gray, det)
      lastSharp.current = sharp
      lastExposure.current = ex
      if (ex.mean < 60) { goodSince.current = 0; return setSafe({ text: 'Not enough light. Move to a brighter place.', tone: 'warn' }, false) }
      if (ex.mean > 225) { goodSince.current = 0; return setSafe({ text: 'Too bright. Move away from direct light.', tone: 'warn' }, false) }
      if (ex.glare > 0.08) { goodSince.current = 0; return setSafe({ text: 'Reduce glare. Tilt the ID slightly.', tone: 'warn' }, false) }
      if (sharp < SHARP_MIN) { goodSince.current = 0; return setSafe({ text: 'Image is blurry. Hold the ID steady.', tone: 'warn' }, false) }

      const held = stable(dcx, dcy, 0.03 * gw, now)
      if (held < 1000) return setSafe({ text: 'Hold Still', tone: 'info', progress: held / 1000 }, false)
      setSafe({ text: 'ID Detected. Ready to capture.', tone: 'good' }, true)
    }

    const loop = async () => {
      if (cancelled) return
      try {
        if (kind === 'face') await faceTick()
        else cardTick()
      } catch {
        // detector hiccup: keep going, the user can still use the fallback below
        if (!cancelled && performance.now() - startedAt.current > FALLBACK_MS) {
          setFallback(true)
          setSafe({ text: 'Automatic guidance is unavailable. You can capture manually; an admin will review it.', tone: 'warn' }, true)
        }
      }
      if (!cancelled) timer = setTimeout(loop, kind === 'face' ? 0 : 160)
    }
    loop()
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camReady, kind, size.w, size.h])

  // ── capture: always cut the real photo from the real frame, not the whole view ─
  const snap = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth || !frame) return
    const vw = v.videoWidth
    const vh = v.videoHeight
    const { s, ox, oy } = coverMapping(size.w, size.h, vw, vh)
    let crop: Rect
    let outW: number

    if (kind === 'face') {
      const b = lastFace.current
      if (b) {
        // forehead to chin with comfortable margins, portrait 3:4
        let cw = b.w * 1.9
        let chh = (cw * 4) / 3
        if (cw > vw) { cw = vw; chh = (cw * 4) / 3 }
        if (chh > vh) { chh = vh; cw = (chh * 3) / 4 }
        const cx = b.x + b.w / 2
        const cy = b.y + b.h / 2 - 0.08 * chh
        crop = {
          x: Math.min(Math.max(0, cx - cw / 2), vw - cw),
          y: Math.min(Math.max(0, cy - chh / 2), vh - chh),
          w: cw,
          h: chh,
        }
      } else {
        // no face data (manual fallback): cut exactly the oval's bounding box
        crop = { x: (frame.x - ox) / s, y: (frame.y - oy) / s, w: frame.w / s, h: frame.h / s }
      }
      outW = 720
    } else {
      const c0 = lastCard.current ?? frame
      // A border with little contrast against the table can be missed, so never cut tighter than a
      // real ID shape (about 1.586:1) around the detected centre, plus a small safety margin.
      const hNeeded = c0.w / CARD_RATIO
      const aspect = c0.w / c0.h
      const looksRight = aspect > 1.45 && aspect < 1.75
      const c = c0.h < hNeeded * 0.97 ? { x: c0.x, w: c0.w, h: hNeeded, y: c0.y + c0.h / 2 - hNeeded / 2 } : c0
      const padX = c.w * (looksRight ? 0.015 : 0.035)
      const padY = c.h * (looksRight ? 0.025 : 0.06)
      const r = { x: c.x - padX, y: c.y - padY, w: c.w + 2 * padX, h: c.h + 2 * padY }
      crop = { x: (r.x - ox) / s, y: (r.y - oy) / s, w: r.w / s, h: r.h / s }
      outW = 1400
    }

    crop = {
      x: Math.max(0, crop.x),
      y: Math.max(0, crop.y),
      w: Math.min(crop.w, vw - Math.max(0, crop.x)),
      h: Math.min(crop.h, vh - Math.max(0, crop.y)),
    }
    const scale = Math.min(1, outW / crop.w)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(crop.w * scale)
    canvas.height = Math.round(crop.h * scale)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    if (kind === 'card') {
      // gentle auto-brightness / contrast so the text is easier to read
      const m = lastExposure.current.mean || 150
      const bright = Math.min(1.25, Math.max(0.9, 150 / m))
      ctx.filter = `brightness(${bright.toFixed(2)}) contrast(1.06)`
    }
    ctx.drawImage(v, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height)
    ctx.filter = 'none'

    // metrics of what is actually being saved
    const small = document.createElement('canvas')
    small.width = 480
    small.height = Math.max(1, Math.round((480 * canvas.height) / canvas.width))
    const sctx = small.getContext('2d', { willReadFrequently: true })
    let sharp = lastSharp.current
    let bright = lastExposure.current.mean
    let glare = lastExposure.current.glare
    if (sctx) {
      sctx.drawImage(canvas, 0, 0, small.width, small.height)
      const gray = toGray(sctx.getImageData(0, 0, small.width, small.height))
      sharp = sharpness(gray)
      const ex = exposure(gray)
      bright = ex.mean
      glare = ex.glare
    }

    const meta: CaptureMeta = {
      kind,
      sharpness: Math.round(sharp),
      brightness: Math.round(bright),
      glare: Math.round(glare * 1000) / 1000,
      ...(kind === 'card' ? { cardDetected: !fallback && !!lastCard.current } : {}),
      ...(kind === 'face' ? { liveness: liveRef.current, faceFill: Math.round((lastFace.current?.fill ?? 0) * 100) / 100 } : {}),
    }

    canvas.toBlob(
      blob => {
        if (!blob) return
        stop()
        onCapture(new File([blob], `${kind === 'face' ? 'selfie' : 'id'}-${Date.now()}.jpg`, { type: 'image/jpeg' }), meta)
      },
      'image/jpeg',
      0.9,
    )
  }

  const toneCls: Record<Tone, string> = {
    info: 'bg-black/70 text-white',
    warn: 'bg-amber-500/95 text-white',
    good: 'bg-emerald-600/95 text-white',
  }
  const frameColor = hint.tone === 'good' ? 'border-emerald-400' : hint.tone === 'warn' ? 'border-amber-300' : 'border-white/90'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-800">{label}</p>
        <button type="button" onClick={() => { stop(); onCancel() }} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400" aria-label="Close camera">
          <X size={16} />
        </button>
      </div>

      <div
        ref={boxRef}
        className={cn('relative bg-black rounded-2xl overflow-hidden', kind === 'face' ? 'aspect-[3/4] sm:aspect-[4/3]' : 'aspect-[4/3]')}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
          style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined}
        />

        {camReady && frame && (
          <div
            className={cn('absolute pointer-events-none border-2 transition-colors', frameColor, kind === 'face' ? 'rounded-[50%]' : 'rounded-xl')}
            style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
          />
        )}

        {camReady && (
          <div className="absolute inset-x-0 bottom-0 p-2.5" role="status" aria-live="polite">
            <div className={cn('mx-auto w-fit max-w-full rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-2 text-center', toneCls[hint.tone])}>
              {hint.tone === 'good' ? <CheckCircle2 size={16} className="shrink-0" /> : hint.tone === 'warn' ? <AlertTriangle size={16} className="shrink-0" /> : null}
              <span>{hint.text}</span>
            </div>
            {kind === 'face' && holdDone.current > 0 && !liveRef.current && eyes && (
              <p className="mt-1.5 text-center text-xs text-white/90">
                {eyes === 'closed' ? 'Eyes closed. Now open them.' : 'Eyes detected. Blink slowly once.'}
              </p>
            )}
            {hint.progress !== undefined && (
              <div className="mx-auto mt-1.5 h-1.5 w-40 rounded-full bg-white/30 overflow-hidden">
                <div className="h-full bg-white transition-all" style={{ width: `${Math.round(hint.progress * 100)}%` }} />
              </div>
            )}
          </div>
        )}

        {!camReady && !error && (
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
        <button type="button" disabled={!camReady || !ready} onClick={snap} className="btn-primary inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
          <Camera size={16} /> {fallback ? 'Capture anyway' : 'Capture'}
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
                if (f) { stop(); onCapture(f, { kind, uploaded: true }) }
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
