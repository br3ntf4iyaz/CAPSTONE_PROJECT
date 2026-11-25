import { Trophy, ShieldCheck, TrendingUp, AlertTriangle, FileX, Sparkles, Award } from 'lucide-react'
import { cn } from '@/utils'

/** One place decides the level from the percentage, so the badge, the bar and the colours can never disagree. */
export type ComplianceLevel = 'full' | 'high' | 'moderate' | 'low' | 'none'

export function complianceLevel(pct: number): ComplianceLevel {
  if (pct >= 100) return 'full'
  if (pct >= 80) return 'high'
  if (pct >= 50) return 'moderate'
  if (pct >= 1) return 'low'
  return 'none'
}

const LEVELS: Record<ComplianceLevel, { label: string; badge: string; bar: string; text: string; Icon: typeof Trophy; hint: string }> = {
  full: {
    label: 'FULLY COMPLIANT',
    badge: 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 text-white ring-2 ring-amber-300/80 shadow-lg shadow-emerald-500/30',
    bar: 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-300',
    text: 'text-emerald-700',
    Icon: Trophy,
    hint: 'Every requirement is submitted.',
  },
  high: {
    label: 'HIGH COMPLIANCE',
    badge: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm',
    bar: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    text: 'text-emerald-700',
    Icon: ShieldCheck,
    hint: 'Nearly all requirements are submitted.',
  },
  moderate: {
    label: 'MODERATE COMPLIANCE',
    badge: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 shadow-sm',
    bar: 'bg-gradient-to-r from-amber-400 to-yellow-500',
    text: 'text-amber-700',
    Icon: TrendingUp,
    hint: 'About half of the requirements are submitted.',
  },
  low: {
    label: 'LOW COMPLIANCE',
    badge: 'bg-gradient-to-r from-orange-500 to-red-400 text-white shadow-sm',
    bar: 'bg-gradient-to-r from-orange-500 to-red-400',
    text: 'text-orange-700',
    Icon: AlertTriangle,
    hint: 'Several requirements are still missing.',
  },
  none: {
    label: 'NO SUBMISSIONS',
    badge: 'bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-sm',
    bar: 'bg-slate-400',
    text: 'text-slate-600',
    Icon: FileX,
    hint: 'No submission has been recorded yet.',
  },
}

const CSS = `
@keyframes lydop-shimmer { 0% { transform: translateX(-120%) skewX(-20deg); } 60%, 100% { transform: translateX(260%) skewX(-20deg); } }
@keyframes lydop-award-in { 0% { opacity: 0; transform: translateY(8px) scale(.96); } 100% { opacity: 1; transform: none; } }
@keyframes lydop-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(252, 211, 77, .0), 0 6px 18px -6px rgba(16, 185, 129, .55); } 50% { box-shadow: 0 0 0 4px rgba(252, 211, 77, .25), 0 6px 22px -4px rgba(16, 185, 129, .7); } }
.lydop-shimmer::after { content: ''; position: absolute; inset: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent); animation: lydop-shimmer 3.6s ease-in-out infinite; }
.lydop-award-in { animation: lydop-award-in .5s ease-out both; }
.lydop-glow { animation: lydop-glow 3.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .lydop-shimmer::after, .lydop-award-in, .lydop-glow { animation: none !important; } }
`

/** The badge for a compliance percentage. Reusable for every barangay. */
export function ComplianceBadge({ pct, className }: { pct: number; className?: string }) {
  const level = complianceLevel(pct)
  const L = LEVELS[level]
  const full = level === 'full'
  return (
    <>
      <style>{CSS}</style>
      <span
        role="status"
        aria-label={`${L.label}, ${pct} percent`}
        className={cn(
          'relative inline-flex items-center gap-2 overflow-hidden rounded-full font-extrabold tracking-wide',
          full ? 'lydop-shimmer lydop-glow px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs',
          L.badge,
          className,
        )}
      >
        {full ? (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-amber-400 text-amber-900 shadow-inner"><L.Icon size={14} /></span>
        ) : (
          <L.Icon size={14} />
        )}
        <span>{full ? '✦ ' : ''}{L.label} · {pct}%</span>
      </span>
    </>
  )
}

/** The progress bar. Same colours and the same percentage as the badge. */
export function ComplianceMeter({ pct }: { pct: number }) {
  const L = LEVELS[complianceLevel(pct)]
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-3 flex-1 overflow-hidden rounded-full bg-ink-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Compliance"
      >
        <div className={cn('h-full rounded-full transition-all duration-700 ease-out', L.bar)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('w-14 text-right text-lg font-extrabold tabular-nums', L.text)}>{pct}%</span>
    </div>
  )
}

/** Extra recognition shown only at 100%. */
export function ExemplaryAward() {
  return (
    <div className="lydop-award-in relative mt-3 flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-300/70 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-3">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-emerald-900 shadow-md ring-2 ring-white">
        <Award size={22} />
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-extrabold tracking-wide text-emerald-800">
          EXEMPLARY COMPLIANCE <Sparkles size={14} className="text-amber-500" />
        </p>
        <p className="text-xs text-emerald-900/80">Full compliance achievement: every requirement of this council has been submitted.</p>
      </div>
    </div>
  )
}

export { LEVELS as COMPLIANCE_LEVELS }

const TILES: Record<ComplianceLevel, { bg: string; ring: string; icon: string }> = {
  full: { bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-md shadow-emerald-500/40', ring: 'ring-2 ring-amber-300', icon: 'text-amber-200' },
  high: { bg: 'bg-gradient-to-br from-emerald-400 to-teal-600', ring: 'ring-2 ring-emerald-300', icon: 'text-white' },
  moderate: { bg: 'bg-gradient-to-br from-amber-300 to-yellow-500', ring: 'ring-2 ring-amber-300', icon: 'text-amber-950' },
  low: { bg: 'bg-gradient-to-br from-orange-400 to-red-400', ring: 'ring-2 ring-orange-300', icon: 'text-white' },
  none: { bg: 'bg-gradient-to-br from-slate-300 to-slate-500', ring: 'ring-2 ring-slate-300', icon: 'text-white' },
}

/** The same percentage everywhere in the directory (rounding can never show 100% or 0% unless it is exactly true). */
export function compliancePercent(submitted: number, total: number): number {
  if (total <= 0 || submitted <= 0) return 0
  if (submitted === total) return 100
  return Math.min(99, Math.max(1, Math.round((submitted / total) * 100)))
}

/** Colours and icon for a barangay's icon tile, matching its compliance level. */
export function complianceTile(pct: number) {
  const level = complianceLevel(pct)
  return { ...TILES[level], Icon: LEVELS[level].Icon, bar: LEVELS[level].bar, text: LEVELS[level].text, level }
}
