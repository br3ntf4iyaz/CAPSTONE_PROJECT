import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Award, Lock, ArrowLeft, AlertCircle, RefreshCw, GraduationCap, Landmark, Briefcase, Rocket, Star,
  Flame, Trophy, Crown, Footprints, Medal, Sparkles, Users, Target, BookOpenCheck,
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

// Every category has its own colours. Earned badges glow in them; locked ones show a dark shadow of the same badge.
interface Theme { a: string; b: string; glow: string; soft: string; ink: string }
const THEMES: Record<string, Theme> = {
  course:     { a: '#0ea5e9', b: '#2563eb', glow: '#7dd3fc', soft: '#e0f2fe', ink: '#075985' },
  governance: { a: '#fbbf24', b: '#d97706', glow: '#fde68a', soft: '#fef3c7', ink: '#92400e' },
  internship: { a: '#34d399', b: '#059669', glow: '#a7f3d0', soft: '#d1fae5', ink: '#065f46' },
  project:    { a: '#a78bfa', b: '#7c3aed', glow: '#ddd6fe', soft: '#ede9fe', ink: '#5b21b6' },
  special:    { a: '#fb7185', b: '#e11d48', glow: '#fecdd3', soft: '#ffe4e6', ink: '#9f1239' },
}
const DEFAULT_THEME = THEMES.course
const themeOf = (category: string): Theme => THEMES[category] ?? DEFAULT_THEME

const CATEGORY_ICON: Record<string, React.ElementType> = {
  course: GraduationCap, governance: Landmark, internship: Briefcase, project: Rocket, special: Star,
}

/** A fitting emblem for each badge, found from its name, falling back to its category emblem. */
function emblemFor(badge: Badge): React.ElementType {
  const n = badge.name.toLowerCase()
  if (n.includes('streak')) return Flame
  if (n.includes('leaderboard') || n.includes('top')) return Trophy
  if (n.includes('champion')) return Crown
  if (n.includes('first step')) return Footprints
  if (n.includes('graduate')) return BookOpenCheck
  if (n.includes('builder') || n.includes('community')) return Users
  if (n.includes('leader')) return Target
  if (n.includes('star')) return Star
  if (n.includes('completer')) return Medal
  return CATEGORY_ICON[badge.category] ?? Award
}

const HEX = 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)'

function levelOf(pct: number) {
  if (pct >= 100) return 'Legend'
  if (pct >= 70) return 'Champion'
  if (pct >= 40) return 'Achiever'
  if (pct >= 10) return 'Rising star'
  return 'Newcomer'
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
      <style>{`
        @keyframes badge-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 55%, 100% { transform: translateX(260%) skewX(-20deg); } }
        @keyframes badge-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @media (prefers-reduced-motion: reduce) { .badge-anim { animation: none !important; } }
      `}</style>
      <header className="relative overflow-hidden rounded-3xl text-white p-8 sm:p-10" style={{ background: 'linear-gradient(120deg,#0a2a7a 0%,#1b3fbf 45%,#7c3aed 100%)' }}>
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div aria-hidden className="absolute -top-24 -left-16 w-72 h-72 rounded-full blur-3xl" style={{ background: 'rgba(56,189,248,0.35)' }} />
        <div aria-hidden className="absolute -bottom-24 right-10 w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(251,191,36,0.30)' }} />
        <Trophy aria-hidden size={190} strokeWidth={1.2} className="absolute -right-6 -top-6 text-white/10 rotate-12 hidden sm:block" />
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
          <div>
            <Link to="/learn" className="inline-flex items-center gap-1.5 eyebrow-on-dark mb-4 hover:text-accent-200 transition-colors">
              <ArrowLeft size={12} /> Back to Learn
            </Link>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tighter2 leading-[1.05] mb-3">
              Your badge collection<span style={{ color: '#fbbf24' }}>.</span>
            </h1>
            <p className="text-blue-100 text-lg max-w-xl leading-relaxed">
              Earn badges by completing courses, attending events, and contributing to youth programs across Lucena. Collect them all!
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur"><Sparkles size={13} className="text-amber-300" /> Level: {levelOf(completionPct)}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur"><Medal size={13} className="text-sky-300" /> {earnedCount} of {totalCount} collected</span>
            </div>
          </div>

          {/* Progress ring */}
          <aside className="flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 min-w-[250px]">
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fde047" /><stop offset="1" stopColor="#f97316" /></linearGradient></defs>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="10" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#ringGrad)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(completionPct / 100) * 263.9} 263.9`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display font-extrabold text-2xl tabular-nums leading-none">{completionPct}%</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-100/80">complete</span>
              </div>
            </div>
            <div>
              <p className="eyebrow-on-dark mb-1">Progress</p>
              <p className="font-display font-extrabold text-4xl tabular-nums leading-none" style={{ color: '#fde047' }}>{earnedCount}</p>
              <p className="text-blue-100/80 text-sm">badges earned</p>
            </div>
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
                  ? 'text-white shadow-md shadow-blue-500/30 bg-gradient-to-r from-blue-600 to-violet-600'
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
                    ? 'text-white shadow'
                    : 'bg-paper-50 border border-ink-200 text-ink-600 hover:bg-white',
                )}
                style={category === c ? { background: `linear-gradient(135deg, ${themeOf(c).a}, ${themeOf(c).b})` } : undefined}
              >
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: themeOf(c).b }} />
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
  const t = themeOf(badge.category)
  const Emblem = emblemFor(badge)
  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-white flex flex-col items-center text-center transition-all duration-300',
        isEarned ? 'hover:-translate-y-1.5 hover:shadow-xl' : 'hover:-translate-y-0.5 hover:shadow-md',
      )}
      style={{ borderColor: isEarned ? t.a : '#e5e7eb', boxShadow: isEarned ? `0 8px 24px -10px ${t.b}88` : undefined }}
    >
      {/* coloured top band */}
      <div className="relative w-full pt-7 pb-5 flex justify-center overflow-hidden"
        style={{ background: isEarned ? `linear-gradient(160deg, ${t.soft}, #fff 85%)` : 'linear-gradient(160deg,#f1f5f9,#fff 85%)' }}>
        {isEarned && <div aria-hidden className="absolute left-1/2 top-9 h-24 w-24 -translate-x-1/2 rounded-full blur-2xl" style={{ background: t.glow, opacity: 0.8 }} />}

        {/* the hexagon medal */}
        <div className={cn('relative h-24 w-24', isEarned && 'badge-anim')} style={isEarned ? { animation: 'badge-float 3.2s ease-in-out infinite' } : undefined}>
          <div className="absolute inset-0" style={{ clipPath: HEX, background: isEarned ? `linear-gradient(145deg, ${t.glow}, ${t.a} 40%, ${t.b})` : 'linear-gradient(145deg,#94a3b8,#475569)' }} />
          <div className="absolute inset-[5px]" style={{ clipPath: HEX, background: isEarned ? `linear-gradient(160deg, ${t.b}, ${t.a})` : 'linear-gradient(160deg,#334155,#1e293b)' }} />
          <div className="absolute inset-[9px] border border-white/30" style={{ clipPath: HEX }} />
          <div className="absolute inset-0 flex items-center justify-center">
            {badge.icon ? (
              <img src={badge.icon} alt={badge.name} className={cn('h-11 w-11 object-contain', !isEarned && 'grayscale opacity-60')} />
            ) : (
              <Emblem size={38} strokeWidth={2.2} className={isEarned ? 'text-white drop-shadow' : 'text-slate-500'} />
            )}
          </div>
          {isEarned && (
            <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ clipPath: HEX }}>
              <div className="badge-anim absolute inset-y-0 w-1/3 bg-white/40 blur-[2px]" style={{ animation: 'badge-shine 3.6s ease-in-out infinite' }} />
            </div>
          )}
          {!isEarned && (
            <span className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-white border-2 border-white shadow">
              <Lock size={12} />
            </span>
          )}
        </div>
        {isEarned && <Sparkles aria-hidden size={16} className="absolute right-6 top-5" style={{ color: t.b }} />}
      </div>

      <div className="flex flex-1 flex-col items-center px-5 pb-5 w-full">
        <span className="mb-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={isEarned ? { background: t.soft, color: t.ink } : { background: '#f1f5f9', color: '#64748b' }}>
          {CATEGORY_LABELS[badge.category] ?? badge.category}
        </span>

        <h3 className={cn('font-display font-bold text-base leading-tight mb-1.5', isEarned ? 'text-ink-900' : 'text-ink-700')}>
          {badge.name}
        </h3>

        <p className="text-xs text-ink-600 leading-relaxed line-clamp-3 mb-3">
          {badge.description}
        </p>

        {isEarned ? (
          <p className="mt-auto w-full rounded-lg py-1.5 text-[11px] font-bold uppercase tracking-wider text-white"
            style={{ background: `linear-gradient(90deg, ${t.a}, ${t.b})` }}>
            Earned · {formatDate(earned!.earned_at)}
          </p>
        ) : badge.criteria ? (
          <p className="mt-auto w-full rounded-lg border border-dashed px-2 py-2 text-[11px] leading-relaxed text-ink-600"
            style={{ borderColor: t.a + '99', background: t.soft + '66' }}>
            <span className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wider" style={{ color: t.ink }}>How to earn</span>
            {badge.criteria}
          </p>
        ) : null}
      </div>
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
