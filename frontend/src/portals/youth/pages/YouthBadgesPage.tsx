import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Award, Lock, ArrowLeft, AlertCircle, RefreshCw,
} from 'lucide-react'
import apiClient from '@/api/client'
import { formatDate, cn } from '@/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Badge {
  id: number
  name: string
  description: string
  icon: string | null
  category: string
  criteria: string
  is_active: boolean
}

interface UserBadge {
  id: number
  badge: Badge
  earned_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  course:     'Courses',
  governance: 'Governance',
  internship: 'Internship',
  project:    'Projects',
  special:    'Special',
}

const toArray = <T,>(d: any): T[] =>
  Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : []

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function YouthBadgesPage() {
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all')
  const [category, setCategory] = useState<string | null>(null)

  const allBadgesQ = useQuery({
    queryKey: ['all-badges'],
    queryFn: () =>
      apiClient.get('/recognition/badges/').then(r => toArray<Badge>(r.data)).catch(() => []),
  })

  const myBadgesQ = useQuery({
    queryKey: ['my-badges'],
    queryFn: () =>
      apiClient.get('/recognition/user-badges/').then(r => toArray<UserBadge>(r.data)).catch(() => []),
  })

  const allBadges = allBadgesQ.data ?? []
  const myBadges = myBadgesQ.data ?? []

  const earnedMap = useMemo(() => {
    const map = new Map<number, UserBadge>()
    myBadges.forEach(ub => map.set(ub.badge.id, ub))
    return map
  }, [myBadges])

  const isLoading = allBadgesQ.isLoading || myBadgesQ.isLoading
  const isError = allBadgesQ.isError && myBadgesQ.isError

  const visibleBadges = allBadges.filter(b => {
    if (category && b.category !== category) return false
    const earned = earnedMap.has(b.id)
    if (filter === 'earned' && !earned) return false
    if (filter === 'locked' && earned) return false
    return true
  })

  const earnedCount = myBadges.length
  const totalCount = allBadges.length
  const completionPct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0

  const categoriesPresent = useMemo(() => {
    const set = new Set(allBadges.map(b => b.category))
    return Array.from(set)
  }, [allBadges])

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
        <div aria-hidden className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-accent-400/20 blur-2xl" />
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
          <div>
            <Link to="/learn" className="inline-flex items-center gap-1.5 eyebrow-on-dark mb-4 hover:text-accent-200 transition-colors">
              <ArrowLeft size={12} /> Back to Learn
            </Link>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tighter2 leading-[1.05] mb-3">
              Your badge collection.
            </h1>
            <p className="text-primary-100 text-lg max-w-xl leading-relaxed">
              Earn badges by completing courses, attending events, and contributing to youth programs across Lucena.
            </p>
          </div>

          {/* Progress card */}
          <aside className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-5 min-w-[240px]">
            <p className="eyebrow-on-dark mb-2">Progress</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="font-display font-extrabold text-4xl text-accent-300 tabular-nums">{earnedCount}</span>
              <span className="text-primary-100/80 text-sm">badges earned</span>
            </div>
            <div className="h-2 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-400 rounded-full transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <p className="text-[11px] font-semibold text-primary-100/70 mt-2 uppercase tracking-wider">{completionPct}% complete</p>
          </aside>
        </div>
      </header>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'earned', 'locked'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-semibold transition-colors capitalize',
                filter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-ink-200 text-ink-700 hover:border-primary-300 hover:text-primary-700',
              )}
            >
              {f === 'all' ? 'All badges' : f === 'earned' ? `Earned (${earnedCount})` : `Locked (${totalCount - earnedCount})`}
            </button>
          ))}
        </div>

        {categoriesPresent.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-ink-100">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                category === null
                  ? 'bg-ink-900 text-white'
                  : 'bg-paper-50 border border-ink-200 text-ink-600 hover:bg-white',
              )}
            >
              All categories
            </button>
            {categoriesPresent.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  category === c
                    ? 'bg-ink-900 text-white'
                    : 'bg-paper-50 border border-ink-200 text-ink-600 hover:bg-white',
                )}
              >
                {CATEGORY_LABELS[c] ?? c}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Badges grid ─────────────────────────────────────────────── */}
      {isError ? (
        <div className="bg-white rounded-2xl border border-alert-200 p-6">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-alert-700 mb-2">
            <AlertCircle size={14} /> Couldn't load badges.
          </p>
          <button
            type="button"
            onClick={() => { allBadgesQ.refetch(); myBadgesQ.refetch() }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 px-3 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors"
          >
            <RefreshCw size={12} /> Try again
          </button>
        </div>
      ) : isLoading ? (
        <SkeletonGrid />
      ) : visibleBadges.length === 0 ? (
        <div className="bg-white rounded-3xl border border-ink-100 p-10 text-center">
          <Award size={36} className="text-ink-300 mx-auto mb-3" />
          <p className="font-display font-bold text-lg text-ink-900 mb-1">
            {filter === 'earned' ? 'No earned badges yet.' : filter === 'locked' ? 'All badges earned!' : 'No badges available.'}
          </p>
          <p className="text-sm text-ink-600">
            {filter === 'earned'
              ? 'Complete courses and join events to start earning.'
              : filter === 'locked'
                ? 'Congrats \u2014 you\'ve earned every available badge.'
                : 'Check back soon for new badges.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleBadges.map(badge => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              earned={earnedMap.get(badge.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function BadgeCard({ badge, earned }: { badge: Badge; earned?: UserBadge }) {
  const isEarned = !!earned
  return (
    <article
      className={cn(
        'bg-white rounded-2xl border p-5 flex flex-col items-center text-center transition-all',
        isEarned
          ? 'border-accent-300 shadow-sm hover:shadow-lg hover:-translate-y-0.5'
          : 'border-ink-100 opacity-70',
      )}
    >
      <div
        className={cn(
          'relative w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-colors',
          isEarned
            ? 'bg-gradient-to-br from-accent-400 to-accent-500 shadow-md'
            : 'bg-ink-100',
        )}
      >
        {badge.icon ? (
          <img src={badge.icon} alt={badge.name} className="w-12 h-12 object-contain" />
        ) : (
          <Award size={32} className={cn(isEarned ? 'text-primary-900' : 'text-ink-400')} />
        )}
        {!isEarned && (
          <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-7 h-7 rounded-full bg-ink-700 text-white border-2 border-white">
            <Lock size={12} />
          </span>
        )}
      </div>

      <span className={cn('chip text-[10px] uppercase mb-2', isEarned ? 'bg-accent-100 text-accent-800' : 'bg-ink-100 text-ink-600')}>
        {CATEGORY_LABELS[badge.category] ?? badge.category}
      </span>

      <h3 className="font-display font-bold text-base text-ink-900 leading-tight mb-1.5">
        {badge.name}
      </h3>

      <p className="text-xs text-ink-600 leading-relaxed line-clamp-3 mb-3">
        {badge.description}
      </p>

      {isEarned ? (
        <p className="text-[11px] font-semibold text-accent-700 uppercase tracking-wider mt-auto pt-2">
          Earned · {formatDate(earned!.earned_at)}
        </p>
      ) : badge.criteria ? (
        <p className="text-[11px] text-ink-500 leading-relaxed mt-auto pt-2 border-t border-ink-100 w-full">
          <span className="font-semibold uppercase tracking-wider text-ink-400 block mb-0.5">How to earn</span>
          {badge.criteria}
        </p>
      ) : null}
    </article>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-ink-100 p-5 flex flex-col items-center">
          <div className="w-20 h-20 skeleton rounded-full mb-4" />
          <div className="h-3 skeleton w-1/2 mb-3" />
          <div className="h-4 skeleton w-3/4 mb-2" />
          <div className="h-3 skeleton w-full" />
        </div>
      ))}
    </div>
  )
}
