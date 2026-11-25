import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface LydoLogoProps {
  size?: number
  className?: string
}

function LydoFallback({ size, className }: { size: number; className: string }) {
  const r = Math.round(size / 2)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`flex-shrink-0 ${className}`}
      style={{ borderRadius: '50%' }}
    >
      <circle cx="50" cy="50" r="50" fill="#1d4ed8" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="#fbbf24" strokeWidth="3" />
      <text
        x="50"
        y="44"
        textAnchor="middle"
        fill="white"
        fontSize="22"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
        letterSpacing="1"
      >
        LYDO
      </text>
      <text
        x="50"
        y="63"
        textAnchor="middle"
        fill="#fbbf24"
        fontSize="8"
        fontWeight="600"
        fontFamily="system-ui, sans-serif"
        letterSpacing="0.5"
      >
        LUCENA YOUTH
      </text>
    </svg>
  )
}

export function LydoLogo({ size = 36, className = '' }: LydoLogoProps) {
  const [failed, setFailed] = useState(false)

  if (failed) return <LydoFallback size={size} className={className} />

  return (
    <img
      src="/images/sdcs.jpg"
      alt="LYDO"
      width={size}
      height={size}
      className={`object-contain flex-shrink-0 ${className}`}
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}

/** The logo as a button: clicking it opens a large view of the seal so people can look at it properly. */
export function ViewableLogo({ size = 36, className = '' }: LydoLogoProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View the LYDO logo larger"
        title="View logo"
        className="flex-shrink-0 rounded-lg cursor-zoom-in transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <LydoLogo size={size} className={className} />
      </button>
      {open && createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-primary-950/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="LYDO logo"
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl p-6 text-center"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full text-ink-500 hover:bg-ink-100 text-lg leading-none"
            >
              ×
            </button>
            <LydoLogo size={320} className="mx-auto max-w-full h-auto" />
            <p className="mt-3 font-display font-bold text-lg text-ink-900">Lucena Youth Development Office</p>
            <p className="text-xs text-ink-500">City Government of Lucena</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
