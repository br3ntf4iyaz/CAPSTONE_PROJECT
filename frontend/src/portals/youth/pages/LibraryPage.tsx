import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, Search, ExternalLink, Download, Star, Scale,
  GraduationCap, HeartPulse, ShieldCheck, Landmark, Users,
  ScrollText, FileText, X, Gavel,
} from 'lucide-react'
import apiClient from '@/api/client'
import { cn, formatDate } from '@/utils'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { QueryError } from '@/components/ui/QueryError'

// ── Types ───────────────────────────────────────────────────────────────────

interface Resource {
  id: number
  title: string
  description: string
  resource_type: 'document' | 'video' | 'link' | 'form'
  category: string
  law_number: string
  year_enacted: number | null
  tags: string
  file_url: string | null
  external_url: string
  is_published: boolean
  is_featured: boolean
  download_count: number
  created_at: string
}

// ── Category config ─────────────────────────────────────────────────────────

type CategoryKey = 'all' | 'legal' | 'governance' | 'education' | 'health' | 'financial' | 'leadership' | 'other'

const CATEGORIES: { key: CategoryKey; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { key: 'all',        label: 'All Materials',  icon: <BookOpen size={16} />,     color: 'text-ink-700',       bg: 'bg-ink-100' },
  { key: 'legal',      label: 'Laws & Acts',     icon: <Scale size={16} />,        color: 'text-primary-700',   bg: 'bg-primary-100' },
  { key: 'governance', label: 'Governance',      icon: <Landmark size={16} />,     color: 'text-indigo-700',    bg: 'bg-indigo-100' },
  { key: 'education',  label: 'Education',       icon: <GraduationCap size={16} />, color: 'text-emerald-700',  bg: 'bg-emerald-100' },
  { key: 'health',     label: 'Health',          icon: <HeartPulse size={16} />,   color: 'text-rose-700',      bg: 'bg-rose-100' },
  { key: 'financial',  label: 'Financial',       icon: <ScrollText size={16} />,   color: 'text-amber-700',     bg: 'bg-amber-100' },
  { key: 'leadership', label: 'Leadership',      icon: <Users size={16} />,        color: 'text-violet-700',    bg: 'bg-violet-100' },
  { key: 'other',      label: 'Other',           icon: <FileText size={16} />,     color: 'text-gray-700',      bg: 'bg-gray-100' },
]

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]))

// ── Resource type badge ─────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  document: 'PDF',
  link: 'Link',
  video: 'Video',
  form: 'Form',
}
const TYPE_COLORS: Record<string, string> = {
  document: 'bg-red-50 text-red-600',
  link: 'bg-blue-50 text-blue-600',
  video: 'bg-purple-50 text-purple-600',
  form: 'bg-teal-50 text-teal-600',
}

// ── Resource Card ───────────────────────────────────────────────────────────

function ResourceCard({ resource, featured = false }: { resource: Resource; featured?: boolean }) {
  const qc = useQueryClient()
  const category = CATEGORY_MAP[resource.category as CategoryKey] ?? CATEGORY_MAP['other']
  const tags = resource.tags ? resource.tags.split(',').map(t => t.trim()).filter(Boolean) : []

  const trackDownload = useMutation({
    mutationFn: (id: number) => apiClient.get(`/resources/${id}/download/`).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['library-resources'] })
      if (data.file_url) {
        window.open(data.file_url, '_blank', 'noopener,noreferrer')
      }
    },
  })

  const href = resource.external_url || resource.file_url || '#'
  const isExternal = !!resource.external_url

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isExternal) {
      trackDownload.mutate(resource.id)
      window.open(resource.external_url, '_blank', 'noopener,noreferrer')
    } else if (resource.file_url) {
      trackDownload.mutate(resource.id)
    }
  }

  return (
    <div
      className={cn(
        'card flex flex-col gap-3 p-5 hover:shadow-md transition-all duration-200',
        featured && 'border-l-4 border-l-primary-500 bg-primary-50/30',
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {resource.law_number && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-100 text-primary-800 text-[10px] font-bold tracking-wide">
              <Gavel size={9} />
              {resource.law_number}
            </span>
          )}
          {resource.year_enacted && (
            <span className="text-[10px] text-ink-400 font-medium">{resource.year_enacted}</span>
          )}
          {featured && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              <Star size={8} fill="currentColor" /> Featured
            </span>
          )}
        </div>
        <span className={cn('flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full', TYPE_COLORS[resource.resource_type] ?? TYPE_COLORS.link)}>
          {TYPE_LABELS[resource.resource_type] ?? resource.resource_type.toUpperCase()}
        </span>
      </div>

      {/* Category pill */}
      <div className="flex items-center gap-1.5">
        <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full', category.bg, category.color)}>
          {category.icon}
          {category.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm text-ink-900 leading-snug line-clamp-2">
        {resource.title}
      </h3>

      {/* Description */}
      {resource.description && (
        <p className="text-xs text-ink-500 leading-relaxed line-clamp-3 flex-1">
          {resource.description}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 4).map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-paper-100 text-ink-500 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end mt-auto pt-2 border-t border-ink-50">
        <a
          href={href}
          onClick={handleOpen}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 transition-colors"
        >
          {isExternal ? (
            <><ExternalLink size={12} /> View Resource</>
          ) : (
            <><Download size={12} /> Download</>
          )}
        </a>
      </div>
    </div>
  )
}

// ── Detail Modal ────────────────────────────────────────────────────────────

function ResourceModal({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const qc = useQueryClient()
  const category = CATEGORY_MAP[resource.category as CategoryKey] ?? CATEGORY_MAP['other']
  const tags = resource.tags ? resource.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  const href = resource.external_url || resource.file_url

  const trackDownload = useMutation({
    mutationFn: (id: number) => apiClient.get(`/resources/${id}/download/`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-resources'] }),
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-ink-100 px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
          <div className="flex-1 min-w-0">
            {resource.law_number && (
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-100 text-primary-800 text-xs font-bold">
                  <Gavel size={11} />
                  {resource.law_number}
                </span>
                {resource.year_enacted && (
                  <span className="text-xs text-ink-400">Enacted {resource.year_enacted}</span>
                )}
              </div>
            )}
            <h2 className="font-display font-bold text-lg text-ink-900 leading-snug">
              {resource.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-paper-100 text-ink-400 hover:text-ink-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Category + type */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full', category.bg, category.color)}>
              {category.icon}
              {category.label}
            </span>
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', TYPE_COLORS[resource.resource_type] ?? TYPE_COLORS.link)}>
              {TYPE_LABELS[resource.resource_type] ?? resource.resource_type}
            </span>
            {resource.is_featured && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                <Star size={10} fill="currentColor" /> Featured Resource
              </span>
            )}
          </div>

          {/* Description */}
          {resource.description && (
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">About This Resource</p>
              <p className="text-sm text-ink-700 leading-relaxed">{resource.description}</p>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Topics</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span key={tag} className="text-xs px-2.5 py-1 bg-paper-100 text-ink-600 rounded-lg">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-ink-400 pt-2 border-t border-ink-50">
            <span>Added {formatDate(resource.created_at)}</span>
          </div>

          {/* CTA */}
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackDownload.mutate(resource.id)}
              className="flex items-center justify-center gap-2 w-full btn-primary py-3 text-sm font-semibold rounded-xl"
            >
              {resource.external_url ? (
                <><ExternalLink size={16} /> Open on Official Gazette / Source</>
              ) : (
                <><Download size={16} /> Download File</>
              )}
            </a>
          )}
          {!href && (
            <div className="flex items-center justify-center gap-2 w-full py-3 text-sm text-ink-400 bg-paper-50 rounded-xl">
              <FileText size={16} /> No external link available yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null)

  const { data: resources = [], isLoading, isError, refetch } = useQuery<Resource[]>({
    queryKey: ['library-resources'],
    queryFn: () =>
      apiClient.get('/resources/').then(r => {
        const d = r.data
        return Array.isArray(d) ? d : (d.results ?? [])
      }),
  })

  const filtered = useMemo(() => {
    let list = resources.filter(r => r.is_published)

    if (activeCategory !== 'all') {
      list = list.filter(r => r.category === activeCategory)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        r =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.law_number.toLowerCase().includes(q) ||
          r.tags.toLowerCase().includes(q),
      )
    }

    return list
  }, [resources, activeCategory, search])

  const featured = resources.filter(r => r.is_featured && r.is_published)

  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = {}
    resources.filter(r => r.is_published).forEach(r => {
      counts[r.category] = (counts[r.category] ?? 0) + 1
    })
    return counts
  }, [resources])

  if (isLoading) return <ListSkeleton />
  if (isError) return <QueryError onRetry={() => refetch()} />

  return (
    <div className="space-y-8">
      {/* ── Hero Header ───────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-8 lg:p-10">
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div aria-hidden className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-accent-400/20 blur-3xl" />

        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Scale size={18} className="text-accent-300" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary-200">
              Philippine Youth Resource Library
            </span>
          </div>
          <h1 className="font-display font-extrabold text-3xl lg:text-4xl tracking-tighter2 leading-tight mb-3">
            Laws, Policies & Government Materials
          </h1>
          <p className="text-primary-200 text-base leading-relaxed mb-6">
            A curated collection of Republic Acts, DILG circulars, and official government
            materials covering SK governance, youth rights, education, health, and more.
          </p>

          {/* Search */}
          <div className="relative max-w-lg">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, RA number, keyword…"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white text-ink-900 text-sm placeholder:text-ink-400 border-0 shadow-lg focus:outline-none focus:ring-2 focus:ring-accent-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-ink-400 hover:text-ink-700"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Tagline strip */}
        <div className="relative flex items-center gap-3 mt-6 pt-5 border-t border-primary-600/50">
          <Scale size={14} className="text-accent-300 flex-shrink-0" />
          <p className="text-xs text-primary-200 leading-relaxed">
            Covers Republic Acts, DILG circulars, NYC policies, DepEd orders, DOH regulations,
            and constitutional provisions relevant to the Filipino youth sector.
          </p>
        </div>
      </div>

      {/* ── Category tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => {
          const count = cat.key === 'all'
            ? resources.filter(r => r.is_published).length
            : (countByCategory[cat.key] ?? 0)
          const isActive = activeCategory === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border',
                isActive
                  ? `${cat.bg} ${cat.color} border-transparent shadow-sm`
                  : 'bg-white text-ink-600 border-ink-100 hover:border-ink-200 hover:bg-paper-50',
              )}
            >
              {cat.icon}
              {cat.label}
              <span className={cn('ml-0.5 opacity-70', isActive ? cat.color : 'text-ink-400')}>
                ({count})
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Featured section (show only when "all" + no search) ───────── */}
      {activeCategory === 'all' && !search && featured.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Star size={15} className="text-amber-500" fill="currentColor" />
            <h2 className="font-display font-bold text-base text-ink-900">Featured Resources</h2>
            <span className="text-xs text-ink-400">Essential reading for SK officials and youth leaders</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {featured.map(r => (
              <div key={r.id} onClick={() => setSelectedResource(r)} className="cursor-pointer">
                <ResourceCard resource={r} featured />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── All / filtered results ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-display font-bold text-base text-ink-900">
            {search
              ? `Search results for "${search}"`
              : activeCategory === 'all'
              ? 'All Resources'
              : CATEGORY_MAP[activeCategory]?.label ?? 'Resources'}
          </h2>
          <span className="text-xs text-ink-400">
            {filtered.length} {filtered.length === 1 ? 'resource' : 'resources'}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <BookOpen size={40} className="mx-auto mb-3 text-ink-200" />
            <p className="font-semibold text-ink-600 mb-1">No resources found</p>
            <p className="text-sm text-ink-400">
              {search ? `No results for "${search}" \u2014 try a different keyword.` : 'No resources in this category yet.'}
            </p>
            {(search || activeCategory !== 'all') && (
              <button
                onClick={() => { setSearch(''); setActiveCategory('all') }}
                className="mt-4 btn-secondary btn-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(r => (
              <div key={r.id} onClick={() => setSelectedResource(r)} className="cursor-pointer">
                <ResourceCard resource={r} featured={r.is_featured} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Disclaimer ────────────────────────────────────────────────── */}
      <div className="card p-4 bg-amber-50 border border-amber-100">
        <div className="flex items-start gap-3">
          <ShieldCheck size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800 mb-0.5">Legal Disclaimer</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Resources link to official government sources (Official Gazette, DILG, DOH, etc.).
              For the most current version of any law or regulation, always verify with the
              official government repository. This library is for informational purposes only.
            </p>
          </div>
        </div>
      </div>

      {/* ── Detail modal ─────────────────────────────────────────────── */}
      {selectedResource && (
        <ResourceModal
          resource={selectedResource}
          onClose={() => setSelectedResource(null)}
        />
      )}
    </div>
  )
}
