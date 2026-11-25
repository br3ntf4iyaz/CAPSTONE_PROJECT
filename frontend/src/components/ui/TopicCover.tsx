import { useId, useState } from 'react'

/**
 * The picture for a program or news card.
 *
 *  - When the record has a real photo, that photo is shown (object-fit: cover, lazy loaded).
 *  - When it has none, or the photo fails to load, a drawn illustration of the TOPIC is shown instead.
 *    It is always an illustration, labelled "Illustration", never a made-up photo of a real event.
 *
 * The parent must be `relative` with a fixed height or aspect ratio: this fills it.
 */

type Scene =
  | 'sewing' | 'globe' | 'leadership' | 'inclusion' | 'peace' | 'learning' | 'health' | 'nature' | 'farm'
  | 'civic' | 'livelihood' | 'festival' | 'law' | 'news' | 'update' | 'growth' | 'program'

const PALETTES: Record<Scene, [string, string, string]> = {
  sewing: ['#7a1f5c', '#d9488f', '#ffe08a'],
  globe: ['#0b3a9a', '#1fa3d6', '#c8f1ff'],
  leadership: ['#0b3a9a', '#3b6fe0', '#ffd23f'],
  inclusion: ['#5b21b6', '#8b5cf6', '#ffe08a'],
  peace: ['#0f5f73', '#2bb3b1', '#fff3b8'],
  learning: ['#14325f', '#2f6cb5', '#ffcf56'],
  health: ['#a31d3b', '#e8576f', '#ffe0e6'],
  nature: ['#0d6b4f', '#27b585', '#e4ffb8'],
  farm: ['#3f7d20', '#8fc93a', '#fff3b8'],
  civic: ['#0b3a9a', '#d1263f', '#ffd23f'],
  livelihood: ['#8a4b08', '#e09a2b', '#fff3b8'],
  festival: ['#0b3a9a', '#e0457b', '#ffd23f'],
  law: ['#14325f', '#4b5fa8', '#ffd23f'],
  news: ['#14325f', '#2f6cb5', '#ffcf56'],
  update: ['#3b1f8f', '#7b57e6', '#7fe3ff'],
  growth: ['#0d6b4f', '#1fa3d6', '#fff0a8'],
  program: ['#0b3a9a', '#1d6fe0', '#ffd23f'],
}

const KEYWORDS: [RegExp, Scene][] = [
  [/sewing|tailor|garment|dressmak|embroider/i, 'sewing'],
  [/senior|digital|computer|smartphone|cyber|coding|tech|internet/i, 'learning'],
  [/summit|conference|leadership|assembly|congress|convention/i, 'leadership'],
  [/mobility|abroad|international|exchange|global|scholarship overseas|overseas/i, 'globe'],
  [/pwd|disab|inclusion|inclusive|equity|gender|indigenous/i, 'inclusion'],
  [/peace|conflict|dialogue|security|mediation/i, 'peace'],
  [/linggo ng kabataan|celebrat|festival|fiesta|youth month|anniversary/i, 'festival'],
  [/republic act|\bra \d|law|ordinance|reform|policy|legislat|resolution/i, 'law'],
  [/framework|development plan|roadmap|strategy|growth/i, 'growth'],
  [/livelihood|entrepreneur|business|income|skills training|tesda|cash/i, 'livelihood'],
  [/health|medical|wellness|vaccin|mental|nutrition/i, 'health'],
  [/environment|clean|tree|plant|recycl|climate|coastal/i, 'nature'],
  [/agri|farm|crop|garden/i, 'farm'],
  [/election|vote|governance|barangay assembly|civic|citizen/i, 'civic'],
  [/school|education|literacy|learning|tutor|study|reading/i, 'learning'],
]

const CATEGORY_SCENE: Record<string, Scene> = {
  social_inclusion: 'inclusion', health: 'health', active_citizenship: 'civic', peace_building: 'peace', education: 'learning',
  environment: 'nature', governance: 'civic', agriculture: 'farm', global_mobility: 'globe', economic: 'livelihood',
  // categories used by the Programs & Projects page
  livelihood: 'livelihood', sports: 'festival', arts: 'festival', peace: 'peace', tech: 'learning',
  // news kinds
  news: 'news', update: 'update', youth_info: 'learning', local_event: 'festival', national_event: 'civic',
}

/** Pick the drawing from the title first (most specific), then from the category or kind. */
export function sceneFor(title: string, category?: string): Scene {
  for (const [re, scene] of KEYWORDS) if (re.test(title)) return scene
  return CATEGORY_SCENE[category ?? ''] ?? 'program'
}

function Art({ scene }: { scene: Scene }) {
  const st = { stroke: '#fff', strokeWidth: 7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const soft = 'rgba(255,255,255,0.22)'
  const person = (x: number, y: number, r: number, key?: number) => (
    <g key={key}>
      <circle cx={x} cy={y - r - 8} r={r * 0.55} fill={soft} {...st} />
      <path d={`M${x - r} ${y + 62} v-26 a${r} ${r} 0 0 1 ${r * 2} 0 v26`} fill={soft} {...st} />
    </g>
  )
  switch (scene) {
    case 'sewing': // a sewing machine with thread
      return (
        <g fill="none" {...st}>
          <path d="M200 270 h240 M215 270 v-92 a22 22 0 0 1 22 -22 h150 a22 22 0 0 1 22 22 v24 h-30 v68" fill={soft} />
          <line x1="372" y1="202" x2="372" y2="262" />
          <circle cx="252" cy="190" r="16" />
          <path d="M330 156 v-26 h-44" />
          <circle cx="470" cy="234" r="22" fill={soft} />
          <path d="M470 212 c-12 -34 40 -34 28 -70" />
        </g>
      )
    case 'globe': // a globe with a plane path
      return (
        <g fill="none" {...st}>
          <circle cx="300" cy="215" r="82" fill={soft} />
          <ellipse cx="300" cy="215" rx="34" ry="82" />
          <line x1="218" y1="215" x2="382" y2="215" />
          <path d="M232 168 q68 22 136 0 M232 262 q68 -22 136 0" />
          <path d="M360 150 q110 -60 160 -6" strokeDasharray="2 14" />
          <polygon points="520,144 492,134 500,152 486,166" fill="#fff" stroke="none" />
        </g>
      )
    case 'leadership': // a speaker at a podium with an audience
      return (
        <g fill="none" {...st}>
          {person(320, 196, 28)}
          <path d="M268 262 h104 l-10 56 h-84 z" fill={soft} />
          {[[190, 300], [450, 300]].map(([x, y], i) => person(x, y, 22, i))}
          <polygon points="320,116 326,132 344,132 330,142 336,160 320,150 304,160 310,142 296,132 314,132" fill="#fff" stroke="none" />
        </g>
      )
    case 'inclusion': // people and a heart
      return (
        <g fill="none" {...st}>
          {[[236, 262, 24], [404, 262, 24]].map(([x, y, r], i) => person(x, y, r, i))}
          <path d="M320 210 c-30 -34 -76 6 -34 44 l34 30 l34 -30 c42 -38 -4 -78 -34 -44 z" fill="rgba(255,255,255,0.4)" />
          <circle cx="320" cy="146" r="22" />
          <path d="M294 186 h52" />
        </g>
      )
    case 'peace': // a dove and speech bubbles
      return (
        <g fill="none" {...st}>
          <path d="M214 164 h126 a14 14 0 0 1 14 14 v46 a14 14 0 0 1 -14 14 h-70 l-30 24 v-24 h-26 a14 14 0 0 1 -14 -14 v-46 a14 14 0 0 1 14 -14 z" fill={soft} />
          <path d="M370 232 h66 a14 14 0 0 1 14 14 v40 a14 14 0 0 1 -14 14 h-20 v22 l-28 -22 h-18 a14 14 0 0 1 -14 -14 v-40 a14 14 0 0 1 14 -14 z" fill={soft} />
          <path d="M270 136 q26 -34 62 -8 q-4 22 -30 22 q-14 14 -32 -14 z" fill="#fff" stroke="none" />
        </g>
      )
    case 'learning': // a laptop with a graduation cap
      return (
        <g fill="none" {...st}>
          <rect x="226" y="176" width="188" height="118" rx="10" fill={soft} />
          <path d="M200 312 h240" />
          <polygon points="320,100 400,134 320,168 240,134" fill="rgba(255,255,255,0.35)" />
          <path d="M276 152 v28 q44 24 88 0 v-28" />
          <line x1="268" y1="236" x2="372" y2="236" />
          <line x1="268" y1="262" x2="340" y2="262" />
        </g>
      )
    case 'health': // a heart with a cross
      return (
        <g fill="none" {...st}>
          <path d="M320 292 c-110 -80 -90 -168 -22 -168 c22 0 36 12 22 34 c-14 -22 0 -34 22 -34 c68 0 88 88 -22 168 z" fill={soft} />
          <line x1="320" y1="176" x2="320" y2="236" />
          <line x1="290" y1="206" x2="350" y2="206" />
        </g>
      )
    case 'nature': // a tree
      return (
        <g fill="none" {...st}>
          <circle cx="320" cy="170" r="66" fill={soft} />
          <path d="M320 236 v82 M320 276 l-34 -30 M320 262 l34 -28" />
          <path d="M222 322 h196" />
        </g>
      )
    case 'farm': // a sprout
      return (
        <g fill="none" {...st}>
          <path d="M320 320 v-120" />
          <path d="M320 238 c-66 6 -84 -44 -78 -78 c60 -4 84 28 78 78 z" fill={soft} />
          <path d="M320 208 c58 4 84 -36 78 -70 c-56 -2 -82 24 -78 70 z" fill={soft} />
          <path d="M240 322 h160" />
        </g>
      )
    case 'civic': // a ballot box with a check
      return (
        <g fill="none" {...st}>
          <rect x="230" y="206" width="180" height="108" rx="12" fill={soft} />
          <line x1="284" y1="206" x2="356" y2="206" strokeWidth="12" />
          <rect x="272" y="120" width="96" height="84" rx="6" fill="rgba(255,255,255,0.35)" />
          <polyline points="292,164 312,184 348,142" />
        </g>
      )
    case 'livelihood': // coins and a growing bar chart
      return (
        <g fill="none" {...st}>
          <circle cx="248" cy="260" r="40" fill={soft} /><text x="248" y="274" textAnchor="middle" fontSize="40" fontWeight="800" fill="#fff" stroke="none">₱</text>
          <rect x="330" y="248" width="34" height="62" rx="4" fill={soft} />
          <rect x="378" y="206" width="34" height="104" rx="4" fill={soft} />
          <rect x="426" y="156" width="34" height="154" rx="4" fill={soft} />
          <path d="M326 214 l52 -34 l36 14 l46 -50" />
        </g>
      )
    case 'festival': // people celebrating under bunting
      return (
        <g fill="none" {...st}>
          <path d="M180 130 q140 54 280 0" />
          {[216, 268, 320, 372, 424].map((x, i) => <polygon key={i} points={`${x - 16},${150 + Math.sin(i * 1.4) * 4 + (i === 2 ? 14 : i === 1 || i === 3 ? 10 : 0)} ${x + 16},${150 + (i === 2 ? 14 : i === 1 || i === 3 ? 10 : 0)} ${x},${186 + (i === 2 ? 14 : i === 1 || i === 3 ? 10 : 0)}`} fill={soft} />)}
          {[[250, 276, 26], [320, 262, 32], [390, 276, 26]].map(([x, y, r], i) => person(x, y, r, i))}
        </g>
      )
    case 'law': // scales of justice
      return (
        <g fill="none" {...st}>
          <line x1="320" y1="116" x2="320" y2="300" />
          <line x1="226" y1="150" x2="414" y2="150" />
          <path d="M226 150 l-40 78 a46 24 0 0 0 80 0 z M414 150 l-40 78 a46 24 0 0 0 80 0 z" fill={soft} />
          <path d="M268 314 h104" />
        </g>
      )
    case 'growth': // a rising chart with an arrow
      return (
        <g fill="none" {...st}>
          <path d="M214 120 v196 h222" />
          <polyline points="238,282 296,220 342,248 420,160" />
          <polyline points="384,158 422,158 422,196" />
        </g>
      )
    case 'news': // a newspaper
      return (
        <g fill="none" {...st}>
          <rect x="205" y="110" width="230" height="190" rx="12" fill={soft} />
          <rect x="228" y="136" width="90" height="56" rx="6" />
          <line x1="336" y1="146" x2="412" y2="146" /><line x1="336" y1="176" x2="412" y2="176" />
          <line x1="228" y1="220" x2="412" y2="220" /><line x1="228" y1="248" x2="412" y2="248" /><line x1="228" y1="276" x2="360" y2="276" />
        </g>
      )
    case 'update': // a megaphone
      return (
        <g fill="none" {...st}>
          <path d="M214 196 h52 l130 -66 v178 l-130 -66 h-52 z" fill={soft} />
          <path d="M250 274 l14 54 h38 l-14 -56" />
          <path d="M428 176 q30 34 0 68" /><path d="M452 150 q54 60 0 120" />
        </g>
      )
    default: // a calendar with a check
      return (
        <g fill="none" {...st}>
          <rect x="210" y="124" width="220" height="178" rx="14" fill={soft} />
          <line x1="210" y1="170" x2="430" y2="170" /><line x1="262" y1="104" x2="262" y2="140" /><line x1="378" y1="104" x2="378" y2="140" />
          <polyline points="272,238 308,270 372,204" />
        </g>
      )
  }
}

export function IllustratedCover({ scene }: { scene: Scene }) {
  const id = useId().replace(/:/g, '')
  const [a, b, glow] = PALETTES[scene]
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
        <radialGradient id={`r${id}`} cx="0.82" cy="0.18" r="0.5"><stop offset="0" stopColor={glow} stopOpacity="0.55" /><stop offset="1" stopColor={glow} stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="640" height="400" fill={`url(#g${id})`} />
      <rect width="640" height="400" fill={`url(#r${id})`} />
      <circle cx="560" cy="70" r="120" fill="rgba(255,255,255,0.06)" />
      <circle cx="70" cy="360" r="140" fill="rgba(255,255,255,0.05)" />
      <g transform="translate(0,-12)"><Art scene={scene} /></g>
    </svg>
  )
}

/** The real photo when there is one and it loads; otherwise the topic illustration. Lazy loaded, 16:9 safe (fills its parent). */
export default function TopicCover({
  image, title, category, alt = '', showLabel = true, labelClass = 'right-2 bottom-2',
}: { image?: string | null; title: string; category?: string; alt?: string; showLabel?: boolean; labelClass?: string }) {
  const [broken, setBroken] = useState(false)
  if (image && !broken) {
    return <img src={image} alt={alt} loading="lazy" decoding="async" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
  }
  return (
    <>
      <IllustratedCover scene={sceneFor(title, category)} />
      {showLabel && <span className={`absolute ${labelClass} rounded-full bg-black/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/90`}>Illustration</span>}
    </>
  )
}
