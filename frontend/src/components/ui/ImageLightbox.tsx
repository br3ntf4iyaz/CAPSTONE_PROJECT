import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/utils'

interface Props {
  src: string
  alt: string
  caption?: string
  subcaption?: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

const MIN = 1
const MAX = 5

/**
 * Full-screen picture viewer: click the picture (or use + / -, the mouse wheel, a double tap or a
 * two-finger pinch) to zoom, drag to move around when zoomed, arrow keys / buttons to see the next
 * picture, Esc or the X to close.
 */
export default function ImageLightbox({ src, alt, caption, subcaption, onClose, onPrev, onNext }: Props) {
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null)
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const moved = useRef(false)

  const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v))

  const zoomTo = useCallback((next: number) => {
    const s = clamp(next)
    setScale(s)
    if (s === 1) setPos({ x: 0, y: 0 })
  }, [])

  const reset = useCallback(() => { setScale(1); setPos({ x: 0, y: 0 }) }, [])

  // a new picture always starts un-zoomed
  useEffect(() => { reset() }, [src, reset])

  // lock the page behind, focus the close button, keyboard
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      else if (e.key === 'ArrowLeft' && onPrev) onPrev()
      else if (e.key === 'ArrowRight' && onNext) onNext()
      else if (e.key === '+' || e.key === '=') zoomTo(scale * 1.4)
      else if (e.key === '-') zoomTo(scale / 1.4)
      else if (e.key === '0') reset()
    }
    window.addEventListener('keydown', onKey, true)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey, true) }
  }, [onClose, onPrev, onNext, scale, zoomTo, reset])

  // mouse wheel zoom (must be non-passive to stop the page from scrolling)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomTo(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [scale, zoomTo])

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = false
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale }
      dragStart.current = null
    } else if (scale > 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
      setDragging(true)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      zoomTo(pinchStart.current.scale * (dist / pinchStart.current.dist))
      moved.current = true
    } else if (dragStart.current) {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true
      setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy })
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) { dragStart.current = null; setDragging(false) }
  }

  // click = zoom in / out; a drag or pinch is not a click
  const onImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (moved.current) { moved.current = false; return }
    zoomTo(scale > 1 ? 1 : 2.5)
  }

  const btn = 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40'

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      // clicks here must not reach the window underneath (React events bubble through portals)
      onClick={e => { e.stopPropagation(); onClose() }}
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm select-none"
    >
      {/* top bar */}
      <div className="flex items-start justify-between gap-3 p-3 sm:p-4 text-white" onClick={e => e.stopPropagation()}>
        <div className="min-w-0">
          {caption && <p className="font-display font-bold text-lg leading-tight break-words">{caption}</p>}
          {subcaption && <p className="text-sm text-white/75">{subcaption}</p>}
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close picture" className={btn}>
          <X size={20} />
        </button>
      </div>

      {/* picture */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {onPrev && (
          <button type="button" aria-label="Previous picture" onClick={e => { e.stopPropagation(); onPrev() }} className={cn(btn, 'absolute left-2 sm:left-4 z-10')}>
            <ChevronLeft size={22} />
          </button>
        )}
        <img
          src={src}
          alt={alt}
          draggable={false}
          onClick={onImageClick}
          onDoubleClick={e => e.stopPropagation()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, touchAction: 'none' }}
          className={cn(
            'max-h-full max-w-full object-contain rounded-xl shadow-2xl',
            dragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in',
            !dragging && 'transition-transform duration-150',
          )}
        />
        {onNext && (
          <button type="button" aria-label="Next picture" onClick={e => { e.stopPropagation(); onNext() }} className={cn(btn, 'absolute right-2 sm:right-4 z-10')}>
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* zoom controls */}
      <div className="flex items-center justify-center gap-2 p-3 sm:p-4" onClick={e => e.stopPropagation()}>
        <button type="button" aria-label="Zoom out" onClick={() => zoomTo(scale / 1.4)} disabled={scale <= MIN} className={btn}><ZoomOut size={18} /></button>
        <span className="min-w-[3.5rem] text-center text-sm font-semibold text-white tabular-nums" aria-live="polite">{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => zoomTo(scale * 1.4)} disabled={scale >= MAX} className={btn}><ZoomIn size={18} /></button>
        <button type="button" aria-label="Reset zoom" onClick={reset} disabled={scale === 1} className={btn}><RotateCcw size={17} /></button>
      </div>
      <p className="pb-3 text-center text-[11px] text-white/60 px-4" onClick={e => e.stopPropagation()}>
        Tap or click the picture to zoom. Drag to move. Pinch or scroll to zoom more.
      </p>
    </div>,
    document.body,
  )
}
