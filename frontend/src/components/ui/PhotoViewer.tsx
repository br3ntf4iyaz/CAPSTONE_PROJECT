import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Camera, X } from 'lucide-react'

/** A photo shown large on a dark background. Closes with the X, the Escape key, or a click outside the photo. */
export default function PhotoViewer({ src, alt, onClose, onChange }: { src: string; alt: string; onClose: () => void; onChange?: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[85] flex flex-col items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25">
        <X size={20} />
      </button>
      <img src={src} alt={alt} className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl" onClick={e => e.stopPropagation()} />
      <p className="mt-3 text-sm font-semibold text-white" onClick={e => e.stopPropagation()}>{alt}</p>
      {onChange && (
        <button type="button" onClick={e => { e.stopPropagation(); onChange() }}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow hover:bg-ink-50">
          <Camera size={15} /> Change photo
        </button>
      )}
    </div>,
    document.body,
  )
}
