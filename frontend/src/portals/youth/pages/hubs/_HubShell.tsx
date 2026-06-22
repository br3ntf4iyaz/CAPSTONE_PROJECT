import { Link } from 'react-router-dom'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/utils'

/**
 * Shared shell + card for the hub pages (Learn, Community, Opportunities,
 * Participate, Need Help). A hub is a landing page that groups several
 * related detail routes &mdash; keeps the nav at 9 items while still letting
 * users discover everything underneath.
 */

export interface HubItem {
  title: string
  description: string
  icon: LucideIcon
  to?: string                 // omit for "coming soon" cards
  badge?: string              // optional eyebrow tag (e.g. "New", "Coming soon")
  external?: boolean
  accent?: 'primary' | 'accent' | 'neutral'
  samples?: string[]          // short preview items shown inside the card
}

interface HubShellProps {
  eyebrow: string
  title: string
  description: string
  items: HubItem[]
  /** Optional rendered above the cards grid (e.g. role banner). */
  banner?: React.ReactNode
}

export default function HubShell({ eyebrow, title, description, items, banner }: HubShellProps) {
  return (
    <div className="space-y-8">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-8 sm:p-10">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div
          aria-hidden
          className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-accent-400/20 blur-2xl pointer-events-none"
        />
        <div className="relative max-w-3xl">
          <p className="eyebrow-on-dark mb-3">{eyebrow}</p>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tighter2 leading-[1.05] mb-4">
            {title}
          </h1>
          <p className="text-primary-100 text-lg leading-relaxed">{description}</p>
        </div>
      </header>

      {banner}

      {/* ── Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map(item => <HubCard key={item.title} {...item} />)}
      </div>
    </div>
  )
}

function HubCard({ title, description, icon: Icon, to, badge, accent = 'primary', samples }: HubItem) {
  const accentClasses = {
    primary: 'bg-primary-600 text-white group-hover:bg-primary-700',
    accent:  'bg-accent-400 text-primary-900 group-hover:bg-accent-500',
    neutral: 'bg-ink-100 text-ink-700 group-hover:bg-primary-100 group-hover:text-primary-700',
  }[accent]

  const isStub = !to

  const inner = (
    <>
      <div className="flex items-start justify-between mb-5">
        <span className={cn('inline-flex items-center justify-center w-12 h-12 rounded-2xl transition-colors', accentClasses)}>
          <Icon size={22} strokeWidth={2.2} />
        </span>
        {badge && (
          <span className={cn(
            'chip text-[10px] uppercase tracking-wider',
            isStub ? 'bg-ink-100 text-ink-600' : 'bg-accent-100 text-accent-800',
          )}>
            {badge}
          </span>
        )}
      </div>
      <h3 className="font-display font-bold text-xl text-ink-900 leading-tight mb-2">{title}</h3>
      <p className="text-sm text-ink-600 leading-relaxed">{description}</p>
      {samples && samples.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {samples.map(s => (
            <li key={s} className="flex items-start gap-2 text-xs text-ink-500">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-ink-300 flex-shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      )}
      <div className={cn(
        'mt-5 inline-flex items-center gap-1 text-sm font-semibold transition-all',
        isStub ? 'text-ink-400' : 'text-primary-700 group-hover:text-primary-800 group-hover:gap-2',
      )}>
        {isStub ? 'Coming soon' : (<>Open <ArrowRight size={14} /></>)}
      </div>
    </>
  )

  const baseCls = 'group bg-white rounded-3xl border p-6 flex flex-col transition-all'
  const interactiveCls = isStub
    ? 'border-ink-100 opacity-70 cursor-not-allowed'
    : 'border-ink-100 hover:border-primary-300 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'

  if (isStub) {
    return <div className={cn(baseCls, interactiveCls)} aria-disabled>{inner}</div>
  }
  return <Link to={to!} className={cn(baseCls, interactiveCls)}>{inner}</Link>
}
