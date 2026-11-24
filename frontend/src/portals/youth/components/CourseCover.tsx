import { useId } from 'react'

/**
 * The picture shown on a course card when the administrator has not uploaded a photo.
 * One illustrated cover per course category, with a thin stripe in the audience colour at the bottom
 * (General Youth = blue, Youth Organization Leaders = violet, SK Officials = amber).
 * It fills its parent, so the parent must be `relative` with a fixed aspect ratio.
 */

type Palette = { a: string; b: string; glow: string }

const PALETTES: Record<string, Palette> = {
  leadership: { a: '#0b3a9a', b: '#1d6fe0', glow: '#ffd23f' },
  governance: { a: '#14325f', b: '#2f6cb5', glow: '#ffcf56' },
  life_skills: { a: '#0d6b4f', b: '#27b585', glow: '#fff0a8' },
  tech: { a: '#3b1f8f', b: '#7b57e6', glow: '#7fe3ff' },
  finance: { a: '#7a4a05', b: '#e0a21c', glow: '#fff3b8' },
  communication: { a: '#a32364', b: '#ec5d9a', glow: '#ffe2a8' },
}
const DEFAULT_PALETTE: Palette = { a: '#0b3a9a', b: '#1d6fe0', glow: '#ffd23f' }

const AUDIENCE_STRIPE: Record<string, string> = {
  general_youth: '#38bdf8',
  youth_org_leaders: '#a78bfa',
  sk_officials: '#fbbf24',
}

/** Simple white line-art, drawn on a 640 x 400 canvas, centred around (320, 190). */
function Art({ category }: { category: string }) {
  const stroke = { stroke: '#fff', strokeWidth: 7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const soft = 'rgba(255,255,255,0.22)'
  switch (category) {
    case 'governance':
      return (
        <g fill="none">
          <polygon points="320,92 450,150 190,150" fill={soft} {...stroke} />
          {[225, 285, 345, 405].map(x => <rect key={x} x={x - 16} y={166} width={32} height={110} rx={5} fill={soft} {...stroke} />)}
          <line x1="180" y1="296" x2="460" y2="296" {...stroke} />
          <line x1="160" y1="320" x2="480" y2="320" {...stroke} />
          <circle cx="320" cy="128" r="9" fill="#fff" />
        </g>
      )
    case 'finance':
      return (
        <g fill="none">
          <rect x="200" y="230" width="46" height="70" rx="6" fill={soft} {...stroke} />
          <rect x="268" y="196" width="46" height="104" rx="6" fill={soft} {...stroke} />
          <rect x="336" y="156" width="46" height="144" rx="6" fill={soft} {...stroke} />
          <polyline points="196,206 262,166 330,184 426,106" {...stroke} />
          <polyline points="396,104 428,104 428,136" {...stroke} />
          <ellipse cx="470" cy="278" rx="46" ry="14" fill={soft} {...stroke} />
          <ellipse cx="470" cy="258" rx="46" ry="14" fill={soft} {...stroke} />
          <ellipse cx="470" cy="238" rx="46" ry="14" fill={soft} {...stroke} />
        </g>
      )
    case 'tech':
      return (
        <g fill="none">
          <rect x="190" y="110" width="260" height="170" rx="16" fill={soft} {...stroke} />
          <path d="M150 312 H490 L468 280 H172 Z" fill={soft} {...stroke} />
          <polyline points="262,170 232,196 262,222" {...stroke} />
          <polyline points="378,170 408,196 378,222" {...stroke} />
          <line x1="342" y1="160" x2="300" y2="232" {...stroke} />
          <circle cx="500" cy="120" r="10" fill="#fff" />
          <circle cx="140" cy="170" r="7" fill="#fff" />
        </g>
      )
    case 'communication':
      return (
        <g fill="none">
          <path d="M170 120 h210 a26 26 0 0 1 26 26 v70 a26 26 0 0 1 -26 26 h-120 l-48 40 v-40 h-42 a26 26 0 0 1 -26 -26 v-70 a26 26 0 0 1 26 -26 z" fill={soft} {...stroke} />
          <path d="M400 190 h70 a24 24 0 0 1 24 24 v62 a24 24 0 0 1 -24 24 h-30 v34 l-44 -34 h-60 a24 24 0 0 1 -24 -24 v-8" fill="rgba(255,255,255,0.12)" {...stroke} />
          {[200, 250, 300].map(x => <circle key={x} cx={x} cy={180} r={9} fill="#fff" />)}
        </g>
      )
    case 'life_skills':
      return (
        <g fill="none">
          <path d="M320 300 V190" {...stroke} />
          <path d="M320 220 C 270 220 236 190 232 140 C 290 140 322 172 320 220 Z" fill={soft} {...stroke} />
          <path d="M320 196 C 372 196 408 164 412 110 C 352 110 318 146 320 196 Z" fill={soft} {...stroke} />
          <path d="M214 300 H426" {...stroke} />
          <path d="M240 322 H400" {...stroke} />
          <circle cx="470" cy="130" r="22" fill="none" stroke="#fff" strokeWidth="7" />
        </g>
      )
    case 'leadership':
    default:
      return (
        <g fill="none">
          <polygon points="130,300 260,150 330,230 400,130 520,300" fill={soft} {...stroke} />
          <line x1="400" y1="130" x2="400" y2="70" {...stroke} />
          <polygon points="400,70 462,88 400,108" fill="#fff" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
          <line x1="110" y1="320" x2="540" y2="320" {...stroke} />
        </g>
      )
  }
}

export default function CourseCover({ category, audience, className = '' }: { category: string; audience?: string; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const p = PALETTES[category] ?? DEFAULT_PALETTE
  const stripe = AUDIENCE_STRIPE[audience ?? ''] ?? '#38bdf8'
  return (
    <svg
      viewBox="0 0 640 400"
      preserveAspectRatio="xMidYMid slice"
      className={`absolute inset-0 h-full w-full ${className}`}
      role="img"
      aria-label={`${category.replace('_', ' ')} course cover`}
    >
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.a} />
          <stop offset="1" stopColor={p.b} />
        </linearGradient>
        <radialGradient id={`glow${uid}`} cx="0.82" cy="0.18" r="0.55">
          <stop offset="0" stopColor={p.glow} stopOpacity="0.55" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
        <pattern id={`dots${uid}`} width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" fill="#fff" fillOpacity="0.16" />
        </pattern>
      </defs>
      <rect width="640" height="400" fill={`url(#bg${uid})`} />
      <rect width="640" height="400" fill={`url(#dots${uid})`} />
      <rect width="640" height="400" fill={`url(#glow${uid})`} />
      <circle cx="560" cy="360" r="170" fill="#fff" fillOpacity="0.07" />
      <circle cx="60" cy="40" r="110" fill="#fff" fillOpacity="0.06" />
      <Art category={category} />
      <rect y="392" width="640" height="8" fill={stripe} />
    </svg>
  )
}
