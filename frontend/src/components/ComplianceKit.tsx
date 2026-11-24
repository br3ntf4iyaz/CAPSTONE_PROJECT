import type { ReactNode } from 'react'
import { cn } from '@/utils'
import type { ComplianceStatus } from './ComplianceStatus'

/** Shared look of the SK Compliance Monitoring System, in the platform's colours: PH blue, sun yellow and flag red. */

export type Tone = 'ink' | 'green' | 'yellow' | 'red' | 'blue' | 'sky' | 'violet' | 'orange' | 'teal'

const TONE: Record<Tone, { bar: string; chip: string; value: string }> = {
  ink: { bar: 'bg-ink-300', chip: 'bg-ink-100 text-ink-600', value: 'text-ink-900' },
  green: { bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-800' },
  yellow: { bar: 'bg-accent-400', chip: 'bg-accent-100 text-accent-700', value: 'text-accent-800' },
  red: { bar: 'bg-alert-500', chip: 'bg-alert-50 text-alert-600', value: 'text-alert-700' },
  blue: { bar: 'bg-primary-600', chip: 'bg-primary-100 text-primary-700', value: 'text-primary-800' },
  sky: { bar: 'bg-sky-400', chip: 'bg-sky-50 text-sky-600', value: 'text-sky-800' },
  violet: { bar: 'bg-violet-500', chip: 'bg-violet-50 text-violet-600', value: 'text-violet-800' },
  orange: { bar: 'bg-orange-500', chip: 'bg-orange-50 text-orange-600', value: 'text-orange-800' },
  teal: { bar: 'bg-teal-600', chip: 'bg-teal-50 text-teal-700', value: 'text-teal-800' },
}

export function KpiCard({ label, value, icon, tone = 'ink', hint }: { label: string; value: number | string; icon: ReactNode; tone?: Tone; hint?: string }) {
  const t = TONE[tone]
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-100 bg-white p-4 pl-5 shadow-sm">
      <span className={cn('absolute inset-y-0 left-0 w-1.5', t.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase leading-tight tracking-wide text-ink-500">{label}</p>
        <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', t.chip)}>{icon}</span>
      </div>
      <p className={cn('mt-2 font-display text-3xl font-extrabold tabular-nums', t.value)}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-500">{hint}</p>}
    </div>
  )
}

/** A ring that fills in the sun-yellow as compliance grows. Meant for the blue banner. */
export function CompletionRing({ percent, size = 92 }: { percent: number; size?: number }) {
  const r = 38
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${pct}% complete`}>
      <svg viewBox="0 0 100 100" className="-rotate-90" width={size} height={size}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#fcd116" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} className="transition-all duration-700" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-xl font-extrabold text-white">{pct}%</span>
    </div>
  )
}

/** The tinted cell of the barangay x document table. */
export const CELL_TINT: Record<ComplianceStatus, string> = {
  not_submitted: 'border-ink-200 bg-paper-50 hover:border-primary-400 hover:bg-primary-50',
  submitted: 'border-sky-200 bg-sky-50 hover:border-sky-400',
  under_verification: 'border-violet-200 bg-violet-50 hover:border-violet-400',
  returned: 'border-orange-200 bg-orange-50 hover:border-orange-400',
  verified: 'border-emerald-200 bg-emerald-50 hover:border-emerald-400',
  published: 'border-primary-300 bg-primary-100/70 hover:border-primary-500',
  overdue: 'border-alert-200 bg-alert-50 hover:border-alert-400',
}

/** A segment of the one long strip a barangay row is made of: solid colour, no border of its own. */
export const SEGMENT_TINT: Record<ComplianceStatus, string> = {
  not_submitted: 'bg-ink-100 hover:bg-ink-200',
  submitted: 'bg-sky-100 hover:bg-sky-200',
  under_verification: 'bg-violet-100 hover:bg-violet-200',
  returned: 'bg-orange-100 hover:bg-orange-200',
  verified: 'bg-emerald-100 hover:bg-emerald-200',
  published: 'bg-primary-100 hover:bg-primary-200',
  overdue: 'bg-alert-100 hover:bg-alert-200',
}

/** One tone for a document that has several periods (quarters or months): the most urgent thing wins. */
export function groupTone(completed: number, overdue: number, total: number): ComplianceStatus {
  if (overdue > 0) return 'overdue'
  if (total > 0 && completed === total) return 'verified'
  if (completed > 0) return 'submitted'
  return 'not_submitted'
}
