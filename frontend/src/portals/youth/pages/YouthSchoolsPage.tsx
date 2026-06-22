import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  GraduationCap, Search, MapPin, BookOpen,
  Phone, Mail, Globe, X, ExternalLink,
  ChevronRight, Star, Facebook,
} from 'lucide-react'
import apiClient from '@/api/client'
import { cn, toArray } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'

interface SchoolProgram {
  id: number
  program: { id: number; name: string; program_type: string }
  is_active: boolean
  scholarship_available: boolean
  tuition_per_year?: string
}

interface School {
  id: number
  name: string
  slug: string
  school_type: string
  description?: string
  address?: string
  municipality?: string
  province?: string
  phone?: string
  email?: string
  website?: string
  facebook_url?: string
  logo_url?: string
  program_count: number
  programs?: SchoolProgram[]
  is_featured?: boolean
}

const TYPE_CHIPS = [
  { value: '',                   label: 'All' },
  { value: 'state_university',   label: 'State University' },
  { value: 'private',            label: 'Private' },
  { value: 'public',             label: 'Public' },
  { value: 'community_college',  label: 'Community College' },
  { value: 'technical_vocational', label: 'Tech-Voc' },
]

const TYPE_COLORS: Record<string, string> = {
  public:               'bg-emerald-100 text-emerald-800',
  private:              'bg-purple-100 text-purple-800',
  state_university:     'bg-primary/10 text-primary',
  community_college:    'bg-blue-100 text-blue-800',
  technical_vocational: 'bg-amber-100 text-amber-800',
}

const TYPE_LABELS: Record<string, string> = {
  public:               'Public',
  private:              'Private',
  state_university:     'State University',
  community_college:    'Community College',
  technical_vocational: 'Tech-Voc',
}

// ─── Detail Drawer ──────────────────────────────────────────────────────────

function SchoolDetailDrawer({ school, onClose }: { school: School; onClose: () => void }) {
  const { data: detail, isLoading } = useQuery<School>({
    queryKey: ['school-detail', school.id],
    queryFn: () => apiClient.get(`/schools/${school.slug}/`).then(r => r.data),
  })

  const s = detail ?? school

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
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Avatar */}
            {s.logo_url ? (
              <img src={s.logo_url} alt={s.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <GraduationCap size={22} className="text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', TYPE_COLORS[s.school_type] ?? 'bg-gray-100 text-gray-700')}>
                  {TYPE_LABELS[s.school_type] ?? s.school_type}
                </span>
                {s.is_featured && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <Star size={9} fill="currentColor" /> Featured
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-gray-900 leading-snug">{s.name}</h2>
              {s.municipality && (
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <MapPin size={11} /> {s.municipality}{s.province ? `, ${s.province}` : ''}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0 transition-colors">
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">Loading details…</div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Description */}
            {s.description && (
              <p className="text-sm text-gray-600 leading-relaxed">{s.description}</p>
            )}

            {/* Contact grid */}
            <div className="space-y-2.5">
              {s.address && (
                <div className="flex items-start gap-2.5 text-sm text-gray-600">
                  <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" /> {s.address}
                </div>
              )}
              {s.phone && (
                <a href={`tel:${s.phone}`} className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-primary transition-colors">
                  <Phone size={14} className="text-gray-400 flex-shrink-0" /> {s.phone}
                </a>
              )}
              {s.email && (
                <a href={`mailto:${s.email}`} className="flex items-center gap-2.5 text-sm text-primary hover:underline">
                  <Mail size={14} className="text-gray-400 flex-shrink-0" /> {s.email}
                </a>
              )}
              {s.website && (
                <a href={s.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-primary hover:underline">
                  <Globe size={14} className="text-gray-400 flex-shrink-0" /> Visit website
                  <ExternalLink size={11} />
                </a>
              )}
              {s.facebook_url && (
                <a href={s.facebook_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-blue-600 hover:underline">
                  <Facebook size={14} className="text-gray-400 flex-shrink-0" /> Facebook page
                  <ExternalLink size={11} />
                </a>
              )}
            </div>

            {/* Programs */}
            {detail?.programs && detail.programs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                  <BookOpen size={14} className="text-primary" />
                  Programs Offered
                  <span className="text-xs font-normal text-gray-400">({detail.programs.length})</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detail.programs.map(sp => (
                    <div
                      key={sp.id}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5',
                        sp.scholarship_available
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-gray-50 border-gray-200 text-gray-700'
                      )}
                    >
                      {sp.program.name}
                      {sp.scholarship_available && (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                          Scholarship
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer CTA */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
          {s.website ? (
            <a href={s.website} target="_blank" rel="noopener noreferrer"
              className="btn-primary w-full flex items-center justify-center gap-2">
              Visit School Website <ExternalLink size={14} />
            </a>
          ) : s.email ? (
            <a href={`mailto:${s.email}`} className="btn-primary w-full flex items-center justify-center gap-2">
              Contact School
            </a>
          ) : (
            <p className="text-sm text-center text-gray-400 py-1">
              Visit {s.name} at {s.address ?? 'their campus'}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── School Card ─────────────────────────────────────────────────────────────

function SchoolCard({ school, onClick }: { school: School; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-white rounded-xl border transition-all duration-200 p-4 group',
        school.is_featured
          ? 'border-amber-200 bg-gradient-to-r from-amber-50/50 to-white hover:border-amber-300 hover:shadow-md hover:shadow-amber-50'
          : 'border-gray-200 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {school.logo_url ? (
          <img src={school.logo_url} alt={school.name}
            className="flex-shrink-0 w-10 h-10 rounded-xl object-cover border border-gray-100" />
        ) : (
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center">
            <GraduationCap size={18} className="text-primary" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                {school.is_featured && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-0.5">
                    <Star size={8} fill="currentColor" /> Featured
                  </span>
                )}
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', TYPE_COLORS[school.school_type] ?? 'bg-gray-100 text-gray-700')}>
                  {TYPE_LABELS[school.school_type] ?? school.school_type}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                {school.name}
              </h3>
            </div>
            <ChevronRight size={15} className="text-gray-300 group-hover:text-primary/50 flex-shrink-0 mt-0.5 transition-colors" />
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 mt-1">
            {school.municipality && (
              <span className="flex items-center gap-1">
                <MapPin size={10} /> {school.municipality}{school.province ? `, ${school.province}` : ''}
              </span>
            )}
            {school.program_count > 0 && (
              <span className="flex items-center gap-1 text-primary font-medium">
                <BookOpen size={10} /> {school.program_count} program{school.program_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function YouthSchoolsPage() {
  const [search, setSearch] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [selected, setSelected] = useState<School | null>(null)

  const params = new URLSearchParams()
  if (schoolType) params.set('school_type', schoolType)
  if (search) params.set('search', search)

  // Backend already filters to is_active=True
  const { data, isLoading } = useQuery({
    queryKey: ['youth-schools', schoolType, search],
    queryFn: () => apiClient.get(`/schools/?${params.toString()}`).then(r => toArray<School>(r.data)),
  })

  const schools = data ?? []
  const featured = schools.filter(s => s.is_featured)
  const rest     = schools.filter(s => !s.is_featured)

  // Counts per type (for chip labels)
  const typeCounts: Record<string, number> = {}
  schools.forEach(s => { typeCounts[s.school_type] = (typeCounts[s.school_type] ?? 0) + 1 })

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <GraduationCap size={22} className="text-primary" /> School Finder
        </h1>
        <p className="page-subtitle">
          Compare schools, programs, and admission paths in Lucena City and nearby areas
          {!isLoading && schools.length > 0 && (
            <span className="ml-1 text-primary font-medium">· {schools.length} schools</span>
          )}
        </p>
      </div>

      {/* Type chips */}
      <div className="flex flex-wrap gap-2">
        {TYPE_CHIPS.map(t => (
          <button
            key={t.value}
            onClick={() => setSchoolType(t.value)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border font-medium transition-all duration-150',
              schoolType === t.value
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40 hover:text-primary'
            )}
          >
            {t.label}
            {t.value && typeCounts[t.value] ? (
              <span className={cn('ml-1.5', schoolType === t.value ? 'opacity-70' : 'opacity-50')}>
                ({typeCounts[t.value]})
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          className="input pl-9 w-full"
          placeholder="Search schools, programs, or location…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <PageSpinner />
      ) : schools.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No schools found"
          description={search || schoolType ? 'Try adjusting your search or filter.' : 'Schools will appear here once added.'}
          className="py-16"
        />
      ) : (
        <div className="space-y-6">
          {/* Featured */}
          {featured.length > 0 && !schoolType && !search && (
            <section className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600 flex items-center gap-1.5">
                <Star size={10} fill="currentColor" /> Featured Schools
              </p>
              <div className="space-y-2">
                {featured.map(s => <SchoolCard key={s.id} school={s} onClick={() => setSelected(s)} />)}
              </div>
            </section>
          )}

          {/* Rest */}
          <section className="space-y-2">
            {featured.length > 0 && !schoolType && !search && (
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">All Schools</p>
            )}
            <div className="space-y-2">
              {(schoolType || search ? schools : rest).map(s => (
                <SchoolCard key={s.id} school={s} onClick={() => setSelected(s)} />
              ))}
            </div>
          </section>

          <p className="text-xs text-center text-gray-400 pt-1">
            {schools.length} school{schools.length !== 1 ? 's' : ''}
            {schoolType || search ? ' matching your search' : ' in Lucena City'}
          </p>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <SchoolDetailDrawer school={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
