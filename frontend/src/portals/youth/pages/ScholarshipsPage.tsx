import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import ScholarshipApplyFlow from '../components/ScholarshipApplyFlow'
import { AppliedNotice, useApplied } from '../components/AppliedStatus'
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
import { prefStorage } from '@/lib/consent'
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
  eligibility?: string[]
  instructions?: string
  requires_gwa?: boolean
  opens_on?: string | null
  closes_on?: string | null
  is_sample?: boolean
  application_status?: 'open' | 'closing_soon' | 'closed' | 'not_yet_open'
  document_requirements?: { key: string; label: string; required: boolean }[]
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

function isClosed(s: Scholarship): boolean {
  return s.application_status === 'closed' || s.application_status === 'not_yet_open' || isDeadlinePassed(s.deadline)
}
function isSoon(s: Scholarship): boolean {
  return s.application_status === 'closing_soon' || isDeadlineSoon(s.deadline)
}
/** Government (national and city) / NGO / Private, used by the boxes at the top. */
function groupOf(s: Scholarship): 'government' | 'ngo' | 'private' {
  if (s.provider_type === 'government' || s.provider_type === 'local_government') return 'government'
  return s.provider_type === 'ngo' ? 'ngo' : 'private'
}
function fmtDate(d?: string | null): string {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
}
const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  open:         { label: 'Open',         cls: 'bg-emerald-100 text-emerald-800' },
  closing_soon: { label: 'Closing Soon', cls: 'bg-amber-100 text-amber-800' },
  closed:       { label: 'Closed',       cls: 'bg-ink-100 text-ink-600' },
  not_yet_open: { label: 'Opens soon',   cls: 'bg-blue-100 text-blue-800' },
}

const LS_KEY = 'lydo_saved_scholarships'

// ── Bookmark helpers ──────────────────────────────────────────────────────────

function loadSaved(): Set<string> {
  try {
    const raw = prefStorage.getItem(LS_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function persistSaved(set: Set<string>) {
  try { prefStorage.setItem(LS_KEY, JSON.stringify([...set])) } catch { /* storage blocked */ }
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
  const passed = isClosed(s)
  const [applying, setApplying] = useState(false)
  const applied = useApplied('scholarship', s.id)

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
            <p className={cn('text-xs mt-0.5', passed ? 'text-red-600' : isSoon(s) ? 'text-amber-600 font-medium' : 'text-blue-700')}>
              {passed ? (s.application_status === 'not_yet_open' ? `Opens ${fmtDate(s.opens_on)}` : 'Applications closed')
                : s.closes_on ? `Apply until ${fmtDate(s.closes_on)}` : s.deadline ? `Deadline: ${s.deadline}` : 'Open for applications'}
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
          {s.is_sample && (
            <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Sample record for system demonstration. The details here are not verified information.
            </p>
          )}
          {(s.eligibility?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <Users size={14} className="text-primary-600" /> Eligibility
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                {s.eligibility!.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {(s.document_requirements?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Required documents</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                {s.document_requirements!.map(d => (
                  <li key={d.key} className="flex items-start gap-2">
                    <span className={cn('mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase', d.required ? 'bg-primary-100 text-primary-700' : 'bg-ink-100 text-ink-500')}>
                      {d.required ? 'Required' : 'Optional'}
                    </span>
                    {d.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.instructions && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">How to apply</h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{s.instructions}</p>
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
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 space-y-2">
          {passed ? (
            <p className="text-sm text-center text-gray-500">Applications for this scholarship are closed.</p>
          ) : applied ? (
            <AppliedNotice kind="scholarship" objectId={s.id} />
          ) : (
            <button onClick={() => setApplying(true)} className="btn-primary w-full">Apply Now</button>
          )}
          {s.application_url && (
            <a href={s.application_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-primary-600 hover:underline">
              Provider website <ExternalLink size={12} />
            </a>
          )}
        </div>
        {applying && (
          <ScholarshipApplyFlow
            scholarship={{ id: s.id, title: s.title, provider: s.provider, requires_gwa: !!s.requires_gwa, is_sample: s.is_sample,
              instructions: s.instructions, document_requirements: s.document_requirements ?? [] }}
            onClose={() => setApplying(false)} />
        )}
      </div>
    </div>
  )
}

// ── Scholarship Card ───────────────────────────────────────────────────────────

function ScholarshipCard({
  s, onClick, onApply, isSaved, onToggleSave,
}: {
  s: Scholarship
  onClick: () => void
  onApply: () => void
  isSaved: boolean
  onToggleSave: (e: React.MouseEvent) => void
}) {
  const passed = isClosed(s)
  const soon   = isSoon(s)
  const applied = useApplied('scholarship', s.id)
  const chip = STATUS_CHIP[s.application_status ?? (passed ? 'closed' : 'open')]

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
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', chip.cls)}>{chip.label}</span>
                  {s.is_sample && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Sample data</span>}
                </div>
                <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-primary-700 transition-colors">
                  {s.title}
                </h3>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 flex-shrink-0 mt-0.5 transition-colors" />
            </div>
            <p className="text-xs text-gray-500 mb-1">{s.provider}</p>
            {s.description && <p className="text-xs text-gray-600 mb-2 line-clamp-2">{s.description}</p>}
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
                  : s.closes_on ? `Apply until ${fmtDate(s.closes_on)}`
                  : soon ? `Closing soon — ${s.deadline}`
                  : s.deadline ? `Due ${s.deadline}`
                  : 'Open for applications'}
              </span>
            </div>
          </div>
        </div>
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-[60px]">
        <button onClick={onClick} className="btn-secondary btn-sm">View Details</button>
        {applied ? (
          <Link to="/my-applications" className="btn-secondary btn-sm text-emerald-700">Applied · Track</Link>
        ) : !passed ? (
          <button onClick={onApply} className="btn-primary btn-sm">Apply Now</button>
        ) : null}
      </div>

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
  const [provider, setProvider]     = useState<'' | 'government' | 'ngo' | 'private'>('')
  const [showSaved, setShowSaved]   = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected]     = useState<Scholarship | null>(null)
  const [applyFor, setApplyFor]     = useState<Scholarship | null>(null)

  const { saved, toggle } = useSavedScholarships()

  const { data: scholarships = [], isLoading, isError, refetch } = useQuery<Scholarship[]>({
    queryKey: ['scholarships'],
    queryFn: () => apiClient.get('/scholarships/').then(r => toArray<Scholarship>(r.data)),
  })

  if (isLoading) return <ListSkeleton />
  if (isError) return <QueryError onRetry={() => refetch()} />

  const closingSoon = scholarships.filter(s => isSoon(s) && !isClosed(s))

  const base = showSaved
    ? scholarships.filter(s => saved.has(String(s.id)))
    : scholarships

  const filtered = base.filter(s => {
    const matchesSearch = !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.provider.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !category || s.category === category
    const matchesProvider = !provider || groupOf(s) === provider
    return matchesSearch && matchesCategory && matchesProvider
  })

  const featuredOpen = filtered.filter(s => s.is_featured && !isClosed(s))
  const open         = filtered.filter(s => !s.is_featured && !isClosed(s))
  const rolling      = open.filter(s => ROLLING_DEADLINES.has(s.deadline))
  const datedOpen    = open.filter(s => !ROLLING_DEADLINES.has(s.deadline))
  const closed       = filtered.filter(s => isClosed(s))

  const hasFilters = !!(category || search || showSaved || provider)

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

      {/* Provider boxes: click one to show only those scholarships, click again to show all */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: 'government', label: 'Government', color: 'text-primary-700', ring: 'border-primary-500 bg-primary-50' },
          { key: 'ngo',        label: 'NGO',        color: 'text-emerald-700', ring: 'border-emerald-500 bg-emerald-50' },
          { key: 'private',    label: 'Private',    color: 'text-purple-700',  ring: 'border-purple-500 bg-purple-50' },
        ] as const).map(stat => (
          <button
            key={stat.key}
            type="button"
            onClick={() => setProvider(provider === stat.key ? '' : stat.key)}
            aria-pressed={provider === stat.key}
            className={cn(
              'rounded-xl border p-4 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              provider === stat.key ? stat.ring : 'bg-white border-gray-200 hover:border-primary-300 hover:shadow-sm',
            )}
          >
            <p className={cn('text-2xl font-bold', stat.color)}>{scholarships.filter(s => groupOf(s) === stat.key && !isClosed(s)).length}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </button>
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
                  onClick={() => { setCategory(''); setSearch(''); setShowSaved(false); setProvider('') }}
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
                    onApply={() => setApplyFor(s)}
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
                    onApply={() => setApplyFor(s)}
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
                    onApply={() => setApplyFor(s)}
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
                    onApply={() => setApplyFor(s)}
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

      {applyFor && (
        <ScholarshipApplyFlow
          scholarship={{ id: applyFor.id, title: applyFor.title, provider: applyFor.provider, requires_gwa: !!applyFor.requires_gwa,
            is_sample: applyFor.is_sample, instructions: applyFor.instructions, document_requirements: applyFor.document_requirements ?? [] }}
          onClose={() => setApplyFor(null)} />
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
