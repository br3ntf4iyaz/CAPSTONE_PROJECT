import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Award, Search, X, ExternalLink, BookOpen,
  Calendar, DollarSign, Users, ChevronRight, Star, Filter,
  Bookmark, BookmarkCheck, AlertCircle,
} from 'lucide-react'
import { cn, toArray } from '@/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { QueryError } from '@/components/ui/QueryError'
import apiClient from '@/api/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Scholarship {
  id: number
  title: string
  provider: string
  provider_type: string
  coverage: string
  amount: string
  deadline: string
  slots: string
  description: string
  requirements: string[]
  application_url: string
  is_featured: boolean
  category: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: '',                 label: 'All Scholarships' },
  { value: 'tuition',          label: 'Tuition Grants' },
  { value: 'stem',             label: 'STEM / Science' },
  { value: 'vocational',       label: 'Vocational / TESDA' },
  { value: 'youth_leadership', label: 'Youth Leadership' },
  { value: 'board_exam',       label: 'Board Exam Review' },
  { value: 'private',          label: 'Private Sector' },
  { value: 'loan',             label: 'Educational Loans' },
  { value: 'assistance',       label: 'Financial Assistance' },
]

const TYPE_LABELS: Record<string, string> = {
  government:       'Government',
  local_government: 'Local Government',
  private:          'Private',
  ngo:              'NGO',
}

const TYPE_COLORS: Record<string, string> = {
  government:       'bg-primary-100 text-primary-800',
  local_government: 'bg-green-100 text-green-800',
  private:          'bg-purple-100 text-purple-800',
  ngo:              'bg-gray-100 text-gray-700',
}

const ROLLING_DEADLINES = new Set(['Rolling', 'Per semester', 'Per batch', 'Rolling — anytime'])

function isDeadlinePassed(deadline: string): boolean {
  if (!deadline || ROLLING_DEADLINES.has(deadline)) return false
  return new Date(deadline).getTime() < Date.now()
}

function isDeadlineSoon(deadline: string): boolean {
  if (!deadline || ROLLING_DEADLINES.has(deadline)) return false
  const diff = new Date(deadline).getTime() - Date.now()
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
}

const LS_KEY = 'lydo_saved_scholarships'

// ── Bookmark helpers ──────────────────────────────────────────────────────────

function loadSaved(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function persistSaved(set: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...set]))
}

function useSavedScholarships() {
  const [saved, setSaved] = useState<Set<string>>(loadSaved)

  const toggle = useCallback((id: string) => {
    setSaved(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      persistSaved(next)
      return next
    })
  }, [])

  return { saved, toggle }
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function ScholarshipDetailDrawer({
  s, onClose, isSaved, onToggleSave,
}: {
  s: Scholarship
  onClose: () => void
  isSaved: boolean
  onToggleSave: () => void
}) {
  const passed = isDeadlinePassed(s.deadline)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:rounded-2xl sm:max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {s.is_featured && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Star size={9} fill="currentColor" /> Featured
                </span>
              )}
              <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', TYPE_COLORS[s.provider_type] ?? 'bg-gray-100 text-gray-700')}>
                {TYPE_LABELS[s.provider_type] ?? s.provider_type}
              </span>
            </div>
            <h2 className="text-base font-bold text-gray-900 leading-snug">{s.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{s.provider}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onToggleSave}
              title={isSaved ? 'Remove from saved' : 'Save for later'}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                isSaved
                  ? 'text-primary-600 bg-primary-50 hover:bg-primary-100'
                  : 'text-gray-400 hover:text-primary-600 hover:bg-gray-100'
              )}
            >
              {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Meta grid */}
        <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wider mb-1">Coverage</p>
            <p className="text-sm font-semibold text-green-800">{s.coverage}</p>
            <p className="text-xs text-green-700 mt-0.5">{s.amount}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-1">Slots</p>
            <p className="text-sm font-semibold text-blue-800">{s.slots}</p>
            <p className={cn('text-xs mt-0.5', passed ? 'text-red-600' : isDeadlineSoon(s.deadline) ? 'text-amber-600 font-medium' : 'text-blue-700')}>
              {passed ? 'Applications closed' : s.deadline ? `Deadline: ${s.deadline}` : 'Contact provider for deadline'}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {s.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <BookOpen size={14} className="text-primary-600" /> About this scholarship
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">{s.description}</p>
            </div>
          )}
          {s.requirements.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <Users size={14} className="text-primary-600" /> Requirements
              </h3>
              <ul className="space-y-1.5">
                {s.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[9px] font-bold mt-0.5">
                      {i + 1}
                    </span>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
          {s.application_url ? (
            <a
              href={s.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              Apply Now <ExternalLink size={14} />
            </a>
          ) : (
            <p className="text-sm text-center text-gray-500">
              Visit the <span className="font-medium">{s.provider}</span> office or contact LYDO for application forms.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Scholarship Card ───────────────────────────────────────────────────────────

function ScholarshipCard({
  s, onClick, isSaved, onToggleSave,
}: {
  s: Scholarship
  onClick: () => void
  isSaved: boolean
  onToggleSave: (e: React.MouseEvent) => void
}) {
  const passed = isDeadlinePassed(s.deadline)
  const soon   = isDeadlineSoon(s.deadline)

  return (
    <div className={cn(
      'bg-white rounded-xl border transition-all duration-200 p-5 group relative',
      passed
        ? 'border-gray-200 opacity-60'
        : 'border-gray-200 hover:border-primary-300 hover:shadow-md hover:shadow-primary-50',
      s.is_featured && !passed && 'border-amber-200 bg-amber-50/20',
      soon && !passed && 'ring-1 ring-amber-300',
    )}>
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center">
            <Award size={20} className="text-primary-600" />
          </div>
          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  {s.is_featured && !passed && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                      <Star size={8} fill="currentColor" /> Featured
                    </span>
                  )}
                  {soon && !passed && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                      ⚠ Closing Soon
                    </span>
                  )}
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', TYPE_COLORS[s.provider_type] ?? 'bg-gray-100 text-gray-700')}>
                    {TYPE_LABELS[s.provider_type] ?? s.provider_type}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-primary-700 transition-colors">
                  {s.title}
                </h3>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 flex-shrink-0 mt-0.5 transition-colors" />
            </div>
            <p className="text-xs text-gray-500 mb-2">{s.provider}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              <span className="flex items-center gap-1 text-green-700">
                <DollarSign size={10} /> {s.amount}
              </span>
              <span className="flex items-center gap-1">
                <Users size={10} /> {s.slots}
              </span>
              <span className={cn('flex items-center gap-1', passed ? 'text-red-500' : soon ? 'text-amber-600 font-medium' : '')}>
                <Calendar size={10} />
                {passed ? 'Closed'
                  : soon ? `Closing soon — ${s.deadline}`
                  : s.deadline ? `Due ${s.deadline}`
                  : 'Contact provider'}
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Bookmark button */}
      <button
        onClick={onToggleSave}
        title={isSaved ? 'Remove from saved' : 'Save for later'}
        className={cn(
          'absolute top-4 right-4 p-1.5 rounded-lg transition-colors',
          isSaved
            ? 'text-primary-600 bg-primary-50 hover:bg-primary-100'
            : 'text-gray-300 hover:text-primary-600 hover:bg-gray-100'
        )}
      >
        {isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScholarshipsPage() {
  const [search, setSearch]         = useState('')
  const [category, setCategory]     = useState('')
  const [showSaved, setShowSaved]   = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected]     = useState<Scholarship | null>(null)

  const { saved, toggle } = useSavedScholarships()

  const { data: scholarships = [], isLoading, isError, refetch } = useQuery<Scholarship[]>({
    queryKey: ['scholarships'],
    queryFn: () => apiClient.get('/scholarships/').then(r => toArray<Scholarship>(r.data)),
  })

  if (isLoading) return <ListSkeleton />
  if (isError) return <QueryError onRetry={() => refetch()} />

  const closingSoon = scholarships.filter(s => isDeadlineSoon(s.deadline) && !isDeadlinePassed(s.deadline))

  const base = showSaved
    ? scholarships.filter(s => saved.has(String(s.id)))
    : scholarships

  const filtered = base.filter(s => {
    const matchesSearch = !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.provider.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !category || s.category === category
    return matchesSearch && matchesCategory
  })

  const featuredOpen = filtered.filter(s => s.is_featured && !isDeadlinePassed(s.deadline))
  const open         = filtered.filter(s => !s.is_featured && !isDeadlinePassed(s.deadline))
  const rolling      = open.filter(s => ROLLING_DEADLINES.has(s.deadline))
  const datedOpen    = open.filter(s => !ROLLING_DEADLINES.has(s.deadline))
  const closed       = filtered.filter(s => isDeadlinePassed(s.deadline))

  const hasFilters = !!(category || search || showSaved)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Award size={22} className="text-primary-700" /> Scholarships &amp; Grants
        </h1>
        <p className="page-subtitle">City, provincial, and national scholarship programs available to Lucena youth</p>
      </div>

      {/* Closing-soon alert */}
      {closingSoon.length > 0 && !showSaved && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {closingSoon.length} scholarship{closingSoon.length !== 1 ? 's' : ''} closing within 30 days
            </p>
            <p className="text-xs text-amber-700 mt-0.5 line-clamp-1">
              {closingSoon.map(s => s.title).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Stat bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Available',   value: scholarships.filter(s => !isDeadlinePassed(s.deadline)).length, color: 'text-green-700' },
          { label: 'Government',  value: scholarships.filter(s => s.provider_type === 'government' || s.provider_type === 'local_government').length, color: 'text-primary-700' },
          { label: 'Always Open', value: scholarships.filter(s => ROLLING_DEADLINES.has(s.deadline)).length, color: 'text-blue-700' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter chips row */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowSaved(false)}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
            !showSaved ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
          )}
        >
          All
        </button>
        <button
          onClick={() => setShowSaved(v => !v)}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full border font-medium transition-all flex items-center gap-1.5',
            showSaved ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
          )}
        >
          <BookmarkCheck size={11} /> Saved
          {saved.size > 0 && (
            <span className={cn('ml-0.5', showSaved ? 'opacity-70' : 'opacity-50')}>
              ({saved.size})
            </span>
          )}
        </button>
      </div>

      {/* Search + category filter */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="input pl-9 w-full"
              placeholder="Search scholarships, providers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn('btn-secondary btn-sm gap-1.5 flex-shrink-0', showFilters && 'bg-primary-50 text-primary-700 border-primary-300')}
          >
            <Filter size={14} /> Filter
            {category && <span className="w-2 h-2 rounded-full bg-primary-600" />}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-xs font-medium text-gray-600">Category</label>
              <select
                className="input text-sm py-1.5"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {hasFilters && (
              <div className="flex items-end">
                <button
                  onClick={() => { setCategory(''); setSearch(''); setShowSaved(false) }}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 py-1.5"
                >
                  <X size={12} /> Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={showSaved ? BookmarkCheck : Award}
          title={showSaved ? 'No saved scholarships' : 'No scholarships found'}
          description={showSaved ? 'Bookmark scholarships to find them here quickly.' : 'Try adjusting your search or clearing filters.'}
          className="py-16"
        />
      ) : (
        <div className="space-y-6">
          {/* Featured */}
          {featuredOpen.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600 flex items-center gap-1.5">
                <Star size={10} fill="currentColor" /> Featured
              </p>
              <div className="space-y-2">
                {featuredOpen.map(s => (
                  <ScholarshipCard
                    key={s.id} s={s}
                    onClick={() => setSelected(s)}
                    isSaved={saved.has(String(s.id))}
                    onToggleSave={e => { e.stopPropagation(); toggle(String(s.id)) }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Dated open */}
          {datedOpen.length > 0 && (
            <section className="space-y-2">
              {featuredOpen.length > 0 && (
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Open for Applications</p>
              )}
              <div className="space-y-2">
                {datedOpen.map(s => (
                  <ScholarshipCard
                    key={s.id} s={s}
                    onClick={() => setSelected(s)}
                    isSaved={saved.has(String(s.id))}
                    onToggleSave={e => { e.stopPropagation(); toggle(String(s.id)) }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Rolling / always available */}
          {rolling.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Always Available</p>
              <div className="space-y-2">
                {rolling.map(s => (
                  <ScholarshipCard
                    key={s.id} s={s}
                    onClick={() => setSelected(s)}
                    isSaved={saved.has(String(s.id))}
                    onToggleSave={e => { e.stopPropagation(); toggle(String(s.id)) }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Closed */}
          {closed.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold text-gray-400 hover:text-gray-600 select-none list-none flex items-center gap-1.5 py-2">
                <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                {closed.length} scholarship{closed.length !== 1 ? 's' : ''} with passed deadline
              </summary>
              <div className="mt-2 space-y-2 opacity-60">
                {closed.map(s => (
                  <ScholarshipCard
                    key={s.id} s={s}
                    onClick={() => setSelected(s)}
                    isSaved={saved.has(String(s.id))}
                    onToggleSave={e => { e.stopPropagation(); toggle(String(s.id)) }}
                  />
                ))}
              </div>
            </details>
          )}

          <p className="text-xs text-center text-gray-400 pt-2">
            Showing {filtered.length} scholarship{filtered.length !== 1 ? 's' : ''}
            {hasFilters ? ' matching your filters' : ''}
            {' '}—{' '}
            <a href="https://lydo.lucena.gov.ph" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              Contact LYDO for assistance
            </a>
          </p>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <ScholarshipDetailDrawer
          s={selected}
          onClose={() => setSelected(null)}
          isSaved={saved.has(String(selected.id))}
          onToggleSave={() => toggle(String(selected.id))}
        />
      )}
    </div>
  )
}
