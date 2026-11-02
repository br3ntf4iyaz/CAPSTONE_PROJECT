import { useState } from 'react'

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
