import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, ZoomIn, ZoomOut, X } from 'lucide-react'
import { cn } from '@/utils'

const FRAME = 288 // the size of the crop window on screen, in pixels
const MIN_ZOOM = 0.6 // below 1 the whole photo can be seen with room around it, so it can be placed anywhere
const MAX_ZOOM = 4

/** Paint the square of the photo around (cx, cy), `span` photo pixels wide, into a size x size canvas. Whatever lies outside the photo stays white. */
function paint(ctx: CanvasRenderingContext2D, img: ImageBitmap | HTMLImageElement, w: number, h: number, cx: number, cy: number, span: number, size: number) {
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, size, size)
  const sx = cx - span / 2, sy = cy - span / 2
  const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(w, sx + span), y1 = Math.min(h, sy + span)
  if (x1 <= x0 || y1 <= y0) return
  const k = size / span
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * k, (y0 - sy) * k, (x1 - x0) * k, (y1 - y0) * k)
}

/**
 * Lets the person choose which part of a photo is kept: drag it, zoom it, or nudge it up, down, left and right.
 * What they see inside the frame is exactly the square picture that is saved.
 */
export default function ImageCropper({ file, title = 'Adjust your photo', round = true, outputSize = 512, onConfirm, onCancel }: {
  file: File
  title?: string
  round?: boolean
  outputSize?: number
  onConfirm: (cropped: File) => void
  onCancel: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState<ImageBitmap | HTMLImageElement | null>(null)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState({ x: 0, y: 0 }) // the point of the photo that sits in the middle of the frame, in photo pixels
  const drag = useRef<{ x: number; y: number } | null>(null)

  // load the photo the way the phone meant it to be seen (rotation included)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
        if (alive) setImg(bmp)
      } catch {
        const url = URL.createObjectURL(file)
        const el = new Image()
        el.onload = () => { if (alive) setImg(el); URL.revokeObjectURL(url) }
        el.onerror = () => { if (alive) setError('This photo could not be opened. Please choose another one.'); URL.revokeObjectURL(url) }
        el.src = url
      }
    }
    load()
    return () => { alive = false }
  }, [file])

  const dims = img ? { w: 'naturalWidth' in img ? img.naturalWidth : img.width, h: 'naturalHeight' in img ? img.naturalHeight : img.height } : null
  // pixels of the photo per pixel of the frame: zoom 1 shows the whole short side
  const scale = dims ? (FRAME / Math.min(dims.w, dims.h)) * zoom : 1

  // the middle of the frame may sit anywhere on the photo, so it can be moved up, down, left and right whatever its shape
  const clamp = useCallback((c: { x: number; y: number }, _sc: number) => {
    if (!dims) return c
    return { x: Math.min(dims.w, Math.max(0, c.x)), y: Math.min(dims.h, Math.max(0, c.y)) }
  }, [dims?.w, dims?.h]) // eslint-disable-line react-hooks/exhaustive-deps

  // start centred
  useEffect(() => { if (dims) setCenter({ x: dims.w / 2, y: dims.h / 2 }) }, [dims?.w, dims?.h]) // eslint-disable-line react-hooks/exhaustive-deps

  const draw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv || !img || !dims) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = FRAME * dpr
    cv.height = FRAME * dpr
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const c = clamp(center, scale)
    paint(ctx, img, dims.w, dims.h, c.x, c.y, FRAME / scale, cv.width)
  }, [img, dims, center, scale, clamp])
  useEffect(draw, [draw])

  const move = (dx: number, dy: number) => setCenter(c => clamp({ x: c.x + dx, y: c.y + dy }, scale))
  const span = FRAME / scale
  const cc = clamp(center, scale)
  const gap = !!dims && (cc.x - span / 2 < -0.5 || cc.x + span / 2 > dims.w + 0.5 || cc.y - span / 2 < -0.5 || cc.y + span / 2 > dims.h + 0.5)
  const nudge = FRAME * 0.08 / scale // a small step, the same on screen at any zoom
  const changeZoom = (z: number) => {
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)))
  }

  const confirm = () => {
    if (!img || !dims) return
    const out = document.createElement('canvas')
    out.width = out.height = outputSize
    const ctx = out.getContext('2d')
    if (!ctx) return
    const c = clamp(center, scale)
    paint(ctx, img, dims.w, dims.h, c.x, c.y, FRAME / scale, outputSize)
    out.toBlob(blob => {
      if (!blob) { setError('Could not save the cropped photo. Please try again.'); return }
      onConfirm(new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  }

  const key = (e: React.KeyboardEvent) => {
    const step = nudge
    if (e.key === 'ArrowLeft') { e.preventDefault(); move(-step, 0) }
    if (e.key === 'ArrowRight') { e.preventDefault(); move(step, 0) }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(0, -step) }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(0, step) }
  }

  const arrow = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 active:bg-ink-100'
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onCancel}>
      <div className="my-auto w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-extrabold text-ink-900">{title}</h3>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-full p-1.5 text-ink-500 hover:bg-ink-100"><X size={16} /></button>
        </div>
        {error ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
        ) : !img ? (
          <p className="py-10 text-center text-sm text-ink-500">Opening the photo…</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-ink-500">Drag the photo in any direction to choose which part is shown. Use the arrows to move it up, down, left or right, and the slider to zoom in or out.</p>
            <div className="mx-auto" style={{ width: FRAME, height: FRAME }}>
              <div
                className="relative touch-none select-none overflow-hidden rounded-xl bg-ink-100 outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                style={{ width: FRAME, height: FRAME, cursor: 'grab' }}
                tabIndex={0}
                role="img"
                aria-label="Photo preview. Use the arrow keys to move it."
                onKeyDown={key}
                onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }}
                onPointerMove={e => {
                  if (!drag.current) return
                  const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y
                  drag.current = { x: e.clientX, y: e.clientY }
                  move(-dx / scale, -dy / scale)
                }}
                onPointerUp={() => { drag.current = null }}
                onPointerCancel={() => { drag.current = null }}
                onWheel={e => changeZoom(zoom - e.deltaY * 0.002)}
              >
                <canvas ref={canvasRef} style={{ width: FRAME, height: FRAME }} className="block" />
                {/* the part that will NOT be shown is dimmed, and the saved shape is outlined */}
                <div
                  className={cn('pointer-events-none absolute inset-0 border-2 border-white/90', round ? 'rounded-full' : 'rounded-xl')}
                  style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
                />
              </div>
            </div>

            {gap && <p className="mt-2 text-center text-xs font-semibold text-amber-700">Part of the frame is empty. Zoom in or move the photo to fill it.</p>}
            <div className="mt-3 flex items-center gap-2">
              <ZoomOut size={16} className="text-ink-500" />
              <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={zoom} onChange={e => changeZoom(Number(e.target.value))} aria-label="Zoom" className="h-2 flex-1 cursor-pointer accent-primary-600" />
              <ZoomIn size={16} className="text-ink-500" />
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5">
              <button type="button" className={arrow} aria-label="Move the photo left" onClick={() => move(-nudge, 0)}><ArrowLeft size={16} /></button>
              <div className="flex flex-col gap-1.5">
                <button type="button" className={arrow} aria-label="Move the photo up" onClick={() => move(0, -nudge)}><ArrowUp size={16} /></button>
                <button type="button" className={arrow} aria-label="Move the photo down" onClick={() => move(0, nudge)}><ArrowDown size={16} /></button>
              </div>
              <button type="button" className={arrow} aria-label="Move the photo right" onClick={() => move(nudge, 0)}><ArrowRight size={16} /></button>
              <button type="button" onClick={() => { setZoom(1); if (dims) setCenter({ x: dims.w / 2, y: dims.h / 2 }) }}
                className="ml-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-xs font-semibold text-ink-700 hover:bg-ink-50">
                <Crosshair size={14} /> Center
              </button>
            </div>
          </>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button type="button" onClick={confirm} disabled={!img || !!error} className="btn-primary flex-1 disabled:opacity-50">Use this photo</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
