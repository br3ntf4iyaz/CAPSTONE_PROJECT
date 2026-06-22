import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, FolderOpen, Users, MapPin, Clock, Star } from 'lucide-react'

const CATEGORY_GRADIENT: Record<string, string> = {
  livelihood:   'from-emerald-600 to-emerald-900',
  education:    'from-blue-600 to-blue-900',
  health:       'from-rose-600 to-rose-900',
  environment:  'from-green-600 to-green-900',
  sports:       'from-orange-500 to-orange-900',
  arts:         'from-purple-600 to-purple-900',
  governance:   'from-primary-600 to-primary-900',
  peace:        'from-sky-600 to-sky-900',
  tech:         'from-indigo-600 to-indigo-900',
  other:        'from-slate-600 to-slate-900',
}
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { formatDate, getStatusColor, cn, toArray } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'

interface Program {
  id: number
  title: string
  description: string
  category: string
  status: string
  thumbnail?: string
  participants_count?: number
  is_featured: boolean
  start_date?: string
  end_date?: string
  barangay?: string
  submitter_type?: string
  contact_person?: string
  contact_email?: string
  contact_phone?: string
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'livelihood', label: 'Livelihood' },
  { value: 'education', label: 'Education' },
  { value: 'health', label: 'Health' },
  { value: 'environment', label: 'Environment' },
  { value: 'sports', label: 'Sports' },
  { value: 'arts', label: 'Arts & Culture' },
  { value: 'governance', label: 'Governance' },
  { value: 'peace', label: 'Peace & Order' },
  { value: 'tech', label: 'Technology' },
  { value: 'other', label: 'Other' },
]

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
]

const SUBMITTER_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'sk', label: 'SK (Sangguniang Kabataan)' },
  { value: 'youth_org', label: 'Youth Organization' },
]

function FeaturedProgramCard({ prog }: { prog: Program }) {
  return (
    <div className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
      {/* Image block */}
      <div className="relative w-full overflow-hidden flex-shrink-0" style={{ aspectRatio: '4/3' }}>
        {prog.thumbnail ? (
          <img
            src={prog.thumbnail}
            alt={prog.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br',
            CATEGORY_GRADIENT[prog.category] ?? CATEGORY_GRADIENT.other
          )} />
        )}

        {/* Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Status badge — top right */}
        <span className={cn('absolute top-3 right-3 badge text-[10px]', getStatusColor(prog.status))}>
          {prog.status}
        </span>

        {/* Title overlay */}
        <h3 className="absolute bottom-3 left-3 right-3 text-white font-bold text-sm leading-snug line-clamp-2 drop-shadow-md">
          {prog.title}
        </h3>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Category + type badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className="badge-blue text-[10px] capitalize">{prog.category.replace('_', ' ')}</span>
          {prog.submitter_type && (
            <span className="badge-gray text-[10px]">{prog.submitter_type.toUpperCase()}</span>
          )}
        </div>

        <p className="text-[13px] text-ink-600 leading-relaxed line-clamp-3 flex-1">
          {prog.description}
        </p>

        {/* Meta row */}
        <div className="mt-3 pt-3 border-t border-ink-100 flex flex-wrap gap-3 text-[11px] text-ink-500">
          {prog.participants_count !== undefined && (
            <span className="flex items-center gap-1">
              <Users size={10} /> {prog.participants_count} participants
            </span>
          )}
          {prog.barangay && (
            <span className="flex items-center gap-1">
              <MapPin size={10} /> {prog.barangay}
            </span>
          )}
          {prog.start_date && (
            <span className="flex items-center gap-1">
              <Clock size={10} /> {formatDate(prog.start_date)}
              {prog.end_date && ` – ${formatDate(prog.end_date)}`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProgramsPage() {
  const auth = useAuthStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [barangay, setBarangay] = useState('')
  const [submitterType, setSubmitterType] = useState('')

  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (status) params.set('status', status)
  if (barangay) params.set('barangay', barangay)
  if (submitterType) params.set('submitter_type', submitterType)
  if (search) params.set('search', search)

  const { data, isLoading } = useQuery({
    queryKey: ['programs', category, status, barangay, submitterType, search],
    queryFn: () =>
      apiClient.get(`/programs/?${params.toString()}`)
        .then(r => toArray<Program>(r.data))
        .catch(() => []),
  })

  const programs = data ?? []
  const featured = programs.filter(p => p.is_featured)
  const rest = programs.filter(p => !p.is_featured)

  const hasFilters = !!(category || status || barangay || submitterType || search)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Programs &amp; Projects</h1>
          <p className="page-subtitle">Browse SK and Youth Organization programs across Lucena City</p>
        </div>
        {auth.isAuthenticated && (
          <Link to="/submissions" className="btn-primary">
            <FolderOpen size={16} /> Submit Program
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9"
              placeholder="Search programs..."
            />
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} className="input">
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="input">
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={submitterType} onChange={e => setSubmitterType(e.target.value)} className="input">
            {SUBMITTER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label htmlFor="barangay-filter" className="label mb-0">Barangay:</label>
          <input
            id="barangay-filter"
            value={barangay}
            onChange={e => setBarangay(e.target.value)}
            className="input max-w-xs"
            placeholder="Filter by barangay..."
          />
          {hasFilters && (
            <button
              onClick={() => { setCategory(''); setStatus(''); setBarangay(''); setSubmitterType(''); setSearch('') }}
              className="text-sm text-ink-500 hover:text-red-600 transition-colors ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <PageSpinner />
      ) : programs.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No programs found"
          description="Try adjusting your filters or search term"
        />
      ) : (
        <div className="space-y-10">

          {/* ── Featured programs — news card style ── */}
          {featured.length > 0 && (
            <section>
              <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-primary-500 flex items-center gap-1.5 mb-4">
                <Star size={11} fill="currentColor" /> Featured Programs
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {featured.map(prog => (
                  <FeaturedProgramCard key={prog.id} prog={prog} />
                ))}
              </div>
            </section>
          )}

          {/* ── All other programs ── */}
          {rest.length > 0 && (
            <section>
              {featured.length > 0 && (
                <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-ink-500 mb-4">
                  All Programs
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map(prog => (
                  <div
                    key={prog.id}
                    className="card overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {prog.thumbnail ? (
                      <img src={prog.thumbnail} alt={prog.title} className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-paper-100 flex items-center justify-center">
                        <FolderOpen size={40} className="text-primary-400" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className="badge-blue capitalize">{prog.category.replace('_', ' ')}</span>
                        <span className={cn('badge', getStatusColor(prog.status))}>{prog.status}</span>
                        {prog.submitter_type && (
                          <span className="badge-gray">{prog.submitter_type.toUpperCase()}</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-ink-900 mb-1.5 line-clamp-2">{prog.title}</h3>
                      <p className="text-sm text-ink-500 line-clamp-3 mb-3">{prog.description}</p>
                      {(prog.contact_person || prog.contact_email || prog.contact_phone) && (
                        <div className="mt-4 rounded-lg bg-indigo-50 border border-indigo-100 p-4">
                          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Direct Contact</p>
                          {prog.contact_person && (
                            <p className="text-sm text-gray-700 flex items-center gap-2">
                              <span className="font-medium">Contact Person:</span> {prog.contact_person}
                            </p>
                          )}
                          {prog.contact_email && (
                            <p className="text-sm text-gray-700 flex items-center gap-2 mt-1">
                              <span className="font-medium">Email:</span>
                              <a href={`mailto:${prog.contact_email}`} className="text-indigo-600 hover:underline">{prog.contact_email}</a>
                            </p>
                          )}
                          {prog.contact_phone && (
                            <p className="text-sm text-gray-700 flex items-center gap-2 mt-1">
                              <span className="font-medium">Phone:</span>
                              <a href={`tel:${prog.contact_phone}`} className="text-indigo-600 hover:underline">{prog.contact_phone}</a>
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-ink-500">
                        {prog.participants_count !== undefined && (
                          <span className="flex items-center gap-1">
                            <Users size={12} /> {prog.participants_count} participants
                          </span>
                        )}
                        {prog.barangay && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {prog.barangay}
                          </span>
                        )}
                        {prog.start_date && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {formatDate(prog.start_date)}
                            {prog.end_date && ` – ${formatDate(prog.end_date)}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  )
}
