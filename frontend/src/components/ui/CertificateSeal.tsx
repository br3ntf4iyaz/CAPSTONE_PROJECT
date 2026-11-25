import { useId } from 'react'

/** A gold rosette with black ribbons: the certificate seal. Accepts the same `size` prop as the line icons. */
export default function CertificateSeal({ size = 32, className }: { size?: number; className?: string; strokeWidth?: number }) {
  const id = useId().replace(/:/g, '')
  // the serrated edge of the rosette: 28 points alternating between two radii
  const points = Array.from({ length: 56 }, (_, i) => {
    const r = i % 2 === 0 ? 28 : 24.5
    const a = (Math.PI * 2 * i) / 56 - Math.PI / 2
    return `${(32 + Math.cos(a) * r).toFixed(2)},${(30 + Math.sin(a) * r).toFixed(2)}`
  }).join(' ')
  return (
    <svg width={size * 1.5} height={size * 1.5} viewBox="0 0 64 64" className={className} role="img" aria-label="Certificate seal" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6d26b" />
          <stop offset="0.5" stopColor="#e0a43a" />
          <stop offset="1" stopColor="#a8661d" />
        </linearGradient>
        <linearGradient id={`r${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a8661d" />
          <stop offset="0.5" stopColor="#f6d26b" />
          <stop offset="1" stopColor="#c98a2b" />
        </linearGradient>
        <radialGradient id={`c${id}`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#2d2d2d" />
          <stop offset="1" stopColor="#0b0b0b" />
        </radialGradient>
      </defs>
      {/* the two ribbons */}
      <path d="M17 44 L11 62 L19.5 57 L24 63 L30 45 Z" fill="#101010" stroke={`url(#g${id})`} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M47 44 L53 62 L44.5 57 L40 63 L34 45 Z" fill="#101010" stroke={`url(#g${id})`} strokeWidth="1.3" strokeLinejoin="round" />
      {/* the serrated rosette */}
      <polygon points={points} fill={`url(#g${id})`} />
      {/* rings and the black centre */}
      <circle cx="32" cy="30" r="20.5" fill="#0b0b0b" />
      <circle cx="32" cy="30" r="19" fill={`url(#r${id})`} />
      <circle cx="32" cy="30" r="14.5" fill="#0b0b0b" />
      <circle cx="32" cy="30" r="13.6" fill={`url(#c${id})`} />
    </svg>
  )
}
