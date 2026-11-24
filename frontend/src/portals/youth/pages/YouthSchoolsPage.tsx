import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  GraduationCap, Search, MapPin, BookOpen,
  Phone, Mail, Globe, X, ExternalLink,
  ChevronRight, Star, Facebook, BadgeCheck, AlertCircle, Lock,
} from 'lucide-react'
import apiClient from '@/api/client'
import { cn, toArray } from '@/utils'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { QueryError } from '@/components/ui/QueryError'
import { EmptyState } from '@/components/ui/EmptyState'
import { CompareSheet, CompareTray, MAX_COMPARE } from './schools/SchoolCompare'
import { TYPE_LABELS, FIELD_LABELS, PROGRAM_TYPE_LABELS, UNAVAILABLE_NOTE } from './schools/constants'

interface SchoolProgram {
  id: number
  program: {
    id: number; name: string; program_type: string; program_type_display?: string
    field_of_study?: string; field_of_study_display?: string; description?: string
  }
  is_active: boolean
  scholarship_available: boolean
  tuition_per_year?: string
  verification_status?: string
  source_url?: string
}

interface CourseRow {
  id: number
  name: string
  description?: string
  program_type: string
  program_type_display: string
  field_of_study: string
  field_of_study_display: string
  school_id: number
  school_name: string
  school_type: string
  source_url?: string
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
  programs_unavailable?: boolean
  courses_locked?: boolean
  source_url?: string
  is_featured?: boolean
}

const TYPE_CHIPS = [
  { value: '',                   label: 'All' },
  { value: 'state_university',   label: 'State University' },
  { value: 'public',             label: 'Public' },
  { value: 'private',            label: 'Private' },
  { value: 'technical_vocational', label: 'Tech-Voc' },
]

const TYPE_COLORS: Record<string, string> = {
  public:               'bg-emerald-100 text-emerald-800',
  private:              'bg-purple-100 text-purple-800',
  state_university:     'bg-primary-50 text-primary-700',
  technical_vocational: 'bg-amber-100 text-amber-800',
}

// ─── Detail Drawer ──────────────────────────────────────────────────────────

/** What a visitor sees instead of the courses: a clear reason, and the two ways in. */
function CoursesLock({ count, next = '/schools' }: { count?: number; next?: string }) {
  return (
    <div className="rounded-2xl border border-primary-100 bg-primary-50/60 p-5 text-center">
      <span className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white"><Lock size={18} /></span>
      <p className="font-display text-base font-bold text-gray-900">Sign in to see the courses</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">
        {count && count > 0 ? `This school has ${count} verified course${count === 1 ? '' : 's'}. ` : ''}
        The list of courses is for LYDO members. It is free to create an account.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link to={`/login?next=${encodeURIComponent(next)}`} className="btn-primary btn-sm">Sign in</Link>
        <Link to="/register" className="btn-secondary btn-sm">Create account</Link>
      </div>
    </div>
  )
}

function SchoolDetailDrawer({ school, onClose }: { school: School; onClose: () => void }) {
  const signedIn = useAuthStore().isAuthenticated
  const { data: detail, isLoading } = useQuery<School>({
    queryKey: ['school-detail', school.id],
    queryFn: () => apiClient.get(`/schools/${school.id}/`).then(r => r.data),
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
              <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <GraduationCap size={22} className="text-primary-700" />
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
                <a href={`tel:${s.phone}`} className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-primary-700 transition-colors">
                  <Phone size={14} className="text-gray-400 flex-shrink-0" /> {s.phone}
                </a>
              )}
              {s.email && (
                <a href={`mailto:${s.email}`} className="flex items-center gap-2.5 text-sm text-primary-700 hover:underline">
                  <Mail size={14} className="text-gray-400 flex-shrink-0" /> {s.email}
                </a>
              )}
              {s.website && (
                <a href={s.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-primary-700 hover:underline">
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

            {/* Programs, grouped by field of study (verified only). Visitors get a sign-in prompt instead. */}
            {detail && !signedIn && <CoursesLock count={detail.program_count} />}
            {detail && signedIn && (
              detail.programs && detail.programs.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <BookOpen size={14} className="text-primary-700" />
                    Verified Courses
                    <span className="text-xs font-normal text-gray-400">({detail.programs.length})</span>
                  </h3>
                  {Object.entries(
                    detail.programs.reduce<Record<string, SchoolProgram[]>>((acc, sp) => {
                      const k = sp.program.field_of_study ?? 'other'
                      ;(acc[k] ??= []).push(sp)
                      return acc
                    }, {}),
                  ).map(([field, items]) => (
                    <div key={field}>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                        {FIELD_LABELS[field] ?? field} <span className="font-normal text-gray-400">({items.length})</span>
                      </p>
                      <ul className="space-y-1.5">
                        {items.map(sp => (
                          <li key={sp.id} className="rounded-lg border border-gray-200 px-3 py-2">
                            <p className="text-sm font-medium text-gray-900 break-words">{sp.program.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                              <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 font-semibold">
                                {PROGRAM_TYPE_LABELS[sp.program.program_type] ?? sp.program.program_type}
                              </span>
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <BadgeCheck size={11} /> Verified
                              </span>
                              {sp.source_url && (
                                <a href={sp.source_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary-700 hover:underline">
                                  Source <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{UNAVAILABLE_NOTE}</span>
                </div>
              )
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

function SchoolCard({
  school, onClick, compared, canAdd, onToggleCompare, visitor = false,
}: {
  school: School
  onClick: () => void
  compared: boolean
  canAdd: boolean
  onToggleCompare: () => void
  visitor?: boolean
}) {
  return (
    <div className="relative">
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-white rounded-xl border transition-all duration-200 p-4 group',
        school.is_featured
          ? 'border-amber-200 bg-gradient-to-r from-amber-50/50 to-white hover:border-amber-300 hover:shadow-md hover:shadow-amber-50'
          : 'border-gray-200 hover:border-primary-300 hover:shadow-md hover:shadow-primary-100'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {school.logo_url ? (
          <img src={school.logo_url} alt={school.name}
            className="flex-shrink-0 w-10 h-10 rounded-xl object-cover border border-gray-100" />
        ) : (
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center">
            <GraduationCap size={18} className="text-primary-700" />
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
              <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-primary-700 transition-colors line-clamp-2">
                {school.name}
              </h3>
            </div>
            <ChevronRight size={15} className="text-gray-300 group-hover:text-primary-400 flex-shrink-0 mt-0.5 transition-colors" />
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 mt-1">
            {school.municipality && (
              <span className="flex items-center gap-1">
                <MapPin size={10} /> {school.municipality}{school.province ? `, ${school.province}` : ''}
              </span>
            )}
            {school.program_count > 0 ? (
              <span className="flex items-center gap-1 text-primary-700 font-medium">
                <BadgeCheck size={10} /> {school.program_count} verified program{school.program_count !== 1 ? 's' : ''}
              </span>
            ) : visitor ? null : (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <AlertCircle size={10} /> Course list not published yet
              </span>
            )}
          </div>
          {school.address && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-1">{school.address}</p>
          )}
          <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-primary-700">
            {visitor ? <><Lock size={12} /> School details · sign in for courses</> : <><BookOpen size={12} /> View Courses</>}
          </span>
        </div>
      </div>
    </button>
    {!visitor && <button
      type="button"
      onClick={onToggleCompare}
      disabled={!compared && !canAdd}
      aria-pressed={compared}
      title={!compared && !canAdd ? `You can compare up to ${MAX_COMPARE} schools` : undefined}
      className={cn(
        'absolute right-3 bottom-3 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors',
        compared
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-white text-gray-500 border-gray-200 hover:border-primary-300 hover:text-primary-700 disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-500',
      )}
    >
      {compared ? '✓ Comparing' : '+ Compare'}
    </button>}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function YouthSchoolsPage() {
  const signedIn = useAuthStore().isAuthenticated
  const visitor = !signedIn
  const [search, setSearch] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [view, setView] = useState<'schools' | 'courses'>('schools')
  const [field, setField] = useState('')
  const [ptype, setPtype] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [selected, setSelected] = useState<School | null>(null)
  const [compare, setCompare] = useState<School[]>([])
  const [showCompare, setShowCompare] = useState(false)

  const toggleCompare = (school: School) =>
    setCompare(list =>
      list.some(x => x.id === school.id)
        ? list.filter(x => x.id !== school.id)
        : list.length >= MAX_COMPARE ? list : [...list, school],
    )

  const params = new URLSearchParams()
  if (schoolType) params.set('school_type', schoolType)
  if (search) params.set('search', search)
  if (field) params.set('field_of_study', field)
  if (ptype) params.set('program_type', ptype)

  // Backend already filters to is_active=True
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['youth-schools', schoolType, search, field, ptype],
    queryFn: () => apiClient.get(`/schools/?${params.toString()}`).then(r => toArray<School>(r.data)),
  })

  const courseParams = new URLSearchParams()
  if (schoolType) courseParams.set('school_type', schoolType)
  if (search) courseParams.set('search', search)
  if (field) courseParams.set('field_of_study', field)
  if (ptype) courseParams.set('program_type', ptype)
  if (schoolFilter) courseParams.set('school', schoolFilter)
  const coursesQ = useQuery({
    queryKey: ['youth-courses', schoolType, search, field, ptype, schoolFilter],
    enabled: view === 'courses' && signedIn,
    queryFn: () =>
      apiClient.get(`/schools/courses/?${courseParams.toString()}`).then(r => r.data as { count: number; results: CourseRow[] }),
  })

  const { data: allSchools } = useQuery({
    queryKey: ['youth-schools-all'],
    queryFn: () => apiClient.get('/schools/?page_size=200').then(r => toArray<School>(r.data)),
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
          <GraduationCap size={22} className="text-primary-700" /> School Finder
        </h1>
        <p className="page-subtitle">
          {visitor ? 'Every college and school in Lucena City and nearby areas' : 'Compare schools, programs, and admission paths in Lucena City and nearby areas'}
          {!isLoading && schools.length > 0 && (
            <span className="ml-1 text-primary-700 font-medium">· {schools.length} schools</span>
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
                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-700'
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
          placeholder={visitor ? 'Search school name or place…' : 'Search school name, course, program, or field of study…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filters: they are about courses, so visitors do not get them */}
      {signedIn && <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select className="input" value={field} onChange={e => setField(e.target.value)} aria-label="Field of study">
          <option value="">All fields of study</option>
          {Object.entries(FIELD_LABELS).filter(([k]) => k !== 'other').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" value={ptype} onChange={e => setPtype(e.target.value)} aria-label="Program type">
          <option value="">All program types</option>
          {Object.entries(PROGRAM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          className="input"
          value={schoolFilter}
          onChange={e => { setSchoolFilter(e.target.value); if (e.target.value) setView('courses') }}
          aria-label="School"
        >
          <option value="">All schools</option>
          {(allSchools ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>}

      {/* View switch */}
      <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
        {(['schools', 'courses'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn('px-4 py-1.5 transition-colors', view === v ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
          >
            {v === 'schools' ? 'Schools' : <span className="inline-flex items-center gap-1">{visitor && <Lock size={11} />} Courses</span>}
          </button>
        ))}
      </div>

      {/* Course results (visitors get the sign-in prompt) */}
      {view === 'courses' && visitor && <CoursesLock />}
      {view === 'courses' && signedIn && (
        coursesQ.isLoading ? <ListSkeleton /> :
        coursesQ.isError ? <QueryError onRetry={() => coursesQ.refetch()} /> :
        (coursesQ.data?.results.length ?? 0) === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No verified courses found"
            description="Try a different search or filter. Only verified programs are listed."
            className="py-16"
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">{coursesQ.data?.count} verified course{coursesQ.data?.count !== 1 ? 's' : ''}</p>
            {coursesQ.data?.results.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900 break-words">{c.name}</p>
                <p className="text-xs text-gray-500 mt-0.5 break-words">{c.school_name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className={cn('px-2 py-0.5 rounded-full font-semibold', TYPE_COLORS[c.school_type] ?? 'bg-gray-100 text-gray-700')}>
                    {TYPE_LABELS[c.school_type] ?? c.school_type}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 font-semibold">
                    {PROGRAM_TYPE_LABELS[c.program_type] ?? c.program_type}
                  </span>
                  <span className="text-gray-500">{FIELD_LABELS[c.field_of_study] ?? c.field_of_study}</span>
                  {c.source_url && (
                    <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-700 hover:underline">
                      Source <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Results */}
      {view === 'schools' && (isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
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
                {featured.map(s => (
                  <SchoolCard key={s.id} school={s} onClick={() => setSelected(s)} visitor={visitor}
                    compared={compare.some(x => x.id === s.id)} canAdd={compare.length < MAX_COMPARE} onToggleCompare={() => toggleCompare(s)} />
                ))}
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
                <SchoolCard key={s.id} school={s} onClick={() => setSelected(s)} visitor={visitor}
                  compared={compare.some(x => x.id === s.id)} canAdd={compare.length < MAX_COMPARE} onToggleCompare={() => toggleCompare(s)} />
              ))}
            </div>
          </section>

          <p className="text-xs text-center text-gray-400 pt-1">
            {schools.length} school{schools.length !== 1 ? 's' : ''}
            {schoolType || search ? ' matching your search' : ' in Lucena City'}
          </p>
        </div>
      ))}

      {signedIn && <CompareTray
        items={compare}
        onRemove={id => setCompare(list => list.filter(x => x.id !== id))}
        onClear={() => setCompare([])}
        onOpen={() => setShowCompare(true)}
      />}
      {signedIn && showCompare && compare.length >= 2 && (
        <CompareSheet items={compare} onClose={() => setShowCompare(false)} />
      )}

      {/* Detail drawer */}
      {selected && (
        <SchoolDetailDrawer school={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
