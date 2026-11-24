import { useId } from 'react'

/**
 * The picture shown on a news card when the post has no photo. It is an illustration (never a made-up photo of a real event):
 * one drawing per kind of post, in the platform colours. It fills its parent, so the parent must be `relative` with a fixed height or ratio.
 */
type Palette = { a: string; b: string; glow: string }

const PALETTES: Record<string, Palette> = {
  national_event: { a: '#0b3a9a', b: '#d1263f', glow: '#ffd23f' },
  local_event: { a: '#0b3a9a', b: '#1d6fe0', glow: '#ffd23f' },
  news: { a: '#14325f', b: '#2f6cb5', glow: '#ffcf56' },
  youth_info: { a: '#0d6b4f', b: '#27b585', glow: '#fff0a8' },
  update: { a: '#3b1f8f', b: '#7b57e6', glow: '#7fe3ff' },
  program: { a: '#7a4a05', b: '#e0a21c', glow: '#fff3b8' },
}
const DEFAULT_PALETTE: Palette = PALETTES.local_event

function Art({ type }: { type: string }) {
  const stroke = { stroke: '#fff', strokeWidth: 7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const soft = 'rgba(255,255,255,0.22)'
  switch (type) {
    case 'national_event': // a rising sun with rays and a star
      return (
        <g fill="none">
          <circle cx="320" cy="210" r="62" fill={soft} {...stroke} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (Math.PI * (i + 0.5)) / 12 + Math.PI
            return <line key={i} x1={320 + Math.cos(a) * 86} y1={210 + Math.sin(a) * 86} x2={320 + Math.cos(a) * 120} y2={210 + Math.sin(a) * 120} {...stroke} />
          })}
          <line x1="170" y1="212" x2="470" y2="212" {...stroke} />
          <polygon points="320,170 330,198 360,198 336,215 345,243 320,226 295,243 304,215 280,198 310,198" fill="#fff" stroke="none" transform="translate(0,-4) scale(1) " />
        </g>
      )
    case 'local_event': // three people and a banner
      return (
        <g fill="none">
          {[[250, 250, 30], [320, 232, 36], [390, 250, 30]].map(([x, y, r], i) => (
            <g key={i}>
              <circle cx={x} cy={y - r - 8} r={r * 0.55} fill={soft} {...stroke} />
              <path d={`M${x - r} ${y + 62} v-26 a${r} ${r} 0 0 1 ${r * 2} 0 v26`} fill={soft} {...stroke} />
            </g>
          ))}
          <path d="M200 120 h240 v44 l-20 -12 l-20 12 l-20 -12 l-20 12 l-20 -12 l-20 12 l-20 -12 l-20 12 l-20 -12 l-20 12 z" fill={soft} {...stroke} />
        </g>
      )
    case 'news': // a newspaper
      return (
        <g fill="none">
          <rect x="205" y="110" width="230" height="190" rx="12" fill={soft} {...stroke} />
          <rect x="228" y="136" width="90" height="56" rx="6" {...stroke} />
          <line x1="336" y1="146" x2="412" y2="146" {...stroke} />
          <line x1="336" y1="176" x2="412" y2="176" {...stroke} />
          <line x1="228" y1="220" x2="412" y2="220" {...stroke} />
          <line x1="228" y1="248" x2="412" y2="248" {...stroke} />
          <line x1="228" y1="276" x2="360" y2="276" {...stroke} />
        </g>
      )
    case 'youth_info': // a light bulb: ideas and guidance
      return (
        <g fill="none">
          <path d="M320 104 a72 72 0 0 0 -42 130 c10 8 14 18 14 30 h56 c0 -12 4 -22 14 -30 A72 72 0 0 0 320 104 z" fill={soft} {...stroke} />
          <line x1="296" y1="292" x2="344" y2="292" {...stroke} />
          <line x1="304" y1="316" x2="336" y2="316" {...stroke} />
          <polyline points="296,200 320,176 344,200" {...stroke} />
          <line x1="320" y1="176" x2="320" y2="256" {...stroke} />
        </g>
      )
    case 'update': // a megaphone
      return (
        <g fill="none">
          <path d="M214 196 h52 l130 -66 v178 l-130 -66 h-52 z" fill={soft} {...stroke} />
          <path d="M250 274 l14 54 h38 l-14 -56" {...stroke} />
          <path d="M428 176 q30 34 0 68" {...stroke} />
          <path d="M452 150 q54 60 0 120" {...stroke} />
        </g>
      )
    default: // a program: a calendar with a check
      return (
        <g fill="none">
          <rect x="210" y="124" width="220" height="178" rx="14" fill={soft} {...stroke} />
          <line x1="210" y1="170" x2="430" y2="170" {...stroke} />
          <line x1="262" y1="104" x2="262" y2="140" {...stroke} />
          <line x1="378" y1="104" x2="378" y2="140" {...stroke} />
          <polyline points="272,238 308,270 372,204" {...stroke} />
        </g>
      )
  }
}

export default function NewsCover({ type }: { type?: string }) {
  const id = useId().replace(/:/g, '')
  const p = PALETTES[type ?? ''] ?? DEFAULT_PALETTE
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.a} />
          <stop offset="1" stopColor={p.b} />
        </linearGradient>
        <radialGradient id={`r${id}`} cx="0.82" cy="0.18" r="0.5">
          <stop offset="0" stopColor={p.glow} stopOpacity="0.55" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="640" height="400" fill={`url(#g${id})`} />
      <rect width="640" height="400" fill={`url(#r${id})`} />
      <circle cx="560" cy="70" r="120" fill="rgba(255,255,255,0.06)" />
      <circle cx="70" cy="360" r="140" fill="rgba(255,255,255,0.05)" />
      <g transform="translate(0,-12)"><Art type={type ?? ''} /></g>
    </svg>
  )
}
