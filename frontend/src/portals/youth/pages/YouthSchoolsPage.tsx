import GradCapIcon from '@/components/ui/GradCapIcon'
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
import { TYPE_LABELS, FIELD_LABELS, PROGRAM_TYPE_LABELS, UNAVAILABLE_NOTE, UNAVAILABLE_NOTE_STRANDS } from './schools/constants'

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
  offers_college?: boolean
  offers_senior_high?: boolean
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
  // Senior High finder
  barangay?: string
  sector?: 'suc' | 'public' | 'private'
  offers_tvl?: boolean
  tesda_provider?: boolean
  shs_note?: string
  info_status?: 'verified' | 'pending' | 'needs_update'
  last_verified_at?: string | null
  strands?: ShsOffering[]
  tesda_programs?: ShsOffering[]
  offers_tvet?: boolean
  _shs?: boolean
  _tesda?: boolean
  _hideTvl?: boolean
}
interface ShsOffering { id: number; name: string; code?: string; note?: string; source_url?: string; source_note?: string }

const SECTOR_LABELS: Record<string, string> = { suc: 'State University / SUC', public: 'Public', private: 'Private' }
const SECTOR_COLORS: Record<string, string> = { suc: 'bg-primary-50 text-primary-700', public: 'bg-emerald-100 text-emerald-800', private: 'bg-purple-100 text-purple-800' }
// the Senior High filters: the classification, and Tech-Voc (the TVL track) with its own Public and Private. TESDA has its own tab.
const SHS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'suc', label: 'State University / SUC' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
]
const SHS_NO_STRANDS = 'Strand information not yet available.'

/** A school that teaches Senior High only has strands, not courses. */
const shsOnly = (s: { offers_college?: boolean; offers_senior_high?: boolean }) => !!s.offers_senior_high && s.offers_college === false

/** The Public / Private / State University badge, the same on every tab. */
function SectorBadge({ s, small }: { s: School; small?: boolean }) {
  const sector = s.sector ?? (s.school_type === 'state_university' ? 'suc' : s.school_type === 'public' ? 'public' : 'private')
  return <span className={cn('font-semibold rounded-full', small ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-0.5', SECTOR_COLORS[sector])}>{SECTOR_LABELS[sector]}</span>
}

/** The badges of a school on the Senior High list: its classification, the level, Tech-Voc / TESDA, and the state of its information. */
function ShsBadges({ s, small }: { s: School; small?: boolean }) {
  const c = small ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-0.5'
  return (
    <>
      <SectorBadge s={s} small={small} />
      {!s.offers_senior_high && <span className={cn('font-semibold rounded-full border bg-gray-50 text-gray-600 border-gray-200', c)}>No Senior High here</span>}
      {s.offers_tvl && !s._hideTvl && <span className={cn('font-semibold rounded-full border bg-amber-50 text-amber-800 border-amber-300', c)}>Tech-Voc (TVL)</span>}
      {s.info_status === 'needs_update' && (
        <span className={cn('rounded-full border border-gray-200 bg-white text-gray-500', c)}>Needs update</span>
      )}
    </>
  )
}

const TYPE_CHIPS = [
  { value: '',                   label: 'All' },
  { value: 'suc',                label: 'State University' },
  { value: 'public',             label: 'Public' },
  { value: 'private',            label: 'Private' },
]

const TYPE_COLORS: Record<string, string> = {
  public:               'bg-emerald-100 text-emerald-800',
  private:              'bg-purple-100 text-purple-800',
  state_university:     'bg-primary-50 text-primary-700',
  technical_vocational: 'bg-amber-100 text-amber-800',
}

// ─── Detail Drawer ──────────────────────────────────────────────────────────

/** What a visitor sees instead of the courses: a clear reason, and the two ways in. */
function CoursesLock({ count, next = '/schools', strand = false, unit: unitName }: { count?: number; next?: string; strand?: boolean; unit?: string }) {
  const unit = unitName ?? (strand ? 'strand' : 'course')
  return (
    <div className="rounded-2xl border border-primary-100 bg-primary-50/60 p-5 text-center">
      <span className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white"><Lock size={18} /></span>
      <p className="font-display text-base font-bold text-gray-900">Sign in to see the {unit}s</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">
        {count && count > 0 ? `This school has ${count} verified ${unit}${count === 1 ? '' : 's'}. ` : ''}
        The list of {unit}s is for LYDO members. It is free to create an account.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link to={`/login?next=${encodeURIComponent(next)}`} className="btn-primary btn-sm">Sign in</Link>
        <Link to="/register" className="btn-secondary btn-sm">Create account</Link>
      </div>
    </div>
  )
}

/** On the Senior High tab a school is shown only as a Senior High School: its college courses belong to the College tab. */
function asSeniorHigh<T extends School>(s: T): T {
  return { ...s, offers_college: false, program_count: 0, programs: [], _shs: true } as T
}

/** On the TESDA / TVET tab a school is shown only for its TESDA training. */
function asTesda<T extends School>(s: T): T {
  return { ...s, offers_college: false, program_count: 0, programs: [], _tesda: true } as T
}

/** The badges of a school on the TESDA / TVET list: its classification, TESDA, and what else it teaches. */
function TesdaBadges({ s, small }: { s: School; small?: boolean }) {
  const c = small ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-0.5'
  return (
    <>
      <SectorBadge s={s} small={small} />
      {s.info_status === 'needs_update' && <span className={cn('rounded-full border border-gray-200 bg-white text-gray-500', c)}>Needs update</span>}
    </>
  )
}

function OfferingList({ title, rows, empty, tesda }: { title: string; rows: ShsOffering[]; empty: string; tesda?: boolean }) {
  return (
    <div>
      <h3 className={cn('text-sm font-bold flex items-center gap-1.5 border-l-4 pl-2', tesda ? 'text-amber-900 border-amber-400' : 'text-primary-900 border-primary-500')}>
        <BookOpen size={14} /> {title} <span className="text-xs font-normal text-gray-400">({rows.length})</span>
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.map(r => (
            <li key={r.id} className={cn('rounded-xl border px-3 py-2', tesda ? 'border-amber-200 bg-amber-50/50' : 'border-primary-100 bg-primary-50/50')}>
              <p className="text-sm font-medium text-gray-900 break-words">{r.name}{r.code ? <span className="ml-1.5 text-xs font-semibold text-gray-500">({r.code})</span> : null}</p>
              {r.note && <p className="text-[11px] text-gray-500">{r.note}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px]">
                <span className="inline-flex items-center gap-1 text-emerald-700"><BadgeCheck size={11} /> Verified</span>
                {r.source_url ? <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-700 hover:underline">Source <ExternalLink size={10} /></a>
                  : r.source_note ? <span className="text-gray-400">{r.source_note}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SchoolDetailDrawer({ school, onClose, mode }: { school: School; onClose: () => void; mode?: 'college' | 'senior_high' | 'tesda' }) {
  const signedIn = useAuthStore().isAuthenticated
  const { data: detail, isLoading } = useQuery<School>({
    queryKey: ['school-detail', school.id],
    queryFn: () => apiClient.get(`/schools/${school.id}/`).then(r => r.data),
  })

  const s = mode === 'senior_high' ? asSeniorHigh(detail ?? school) : mode === 'tesda' ? asTesda(detail ?? school) : (detail ?? school)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-primary-950/60 backdrop-blur-sm px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:rounded-2xl sm:max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10">
        <div className="relative bg-gradient-to-br from-primary-600 to-primary-800 text-white px-6 py-4 flex items-start justify-between gap-4">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
          <div className="relative flex items-start gap-3 flex-1 min-w-0">
            {/* Avatar */}
            {s.logo_url ? (
              <img src={s.logo_url} alt={s.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border-2 border-white/40 bg-white" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-white border-2 border-white/60 shadow-md flex items-center justify-center flex-shrink-0">
                <GradCapIcon size={32} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {s._shs ? <ShsBadges s={s} /> : s._tesda ? <TesdaBadges s={s} /> : <>
                <SectorBadge s={s} /></>}
                {s.is_featured && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <Star size={9} fill="currentColor" /> Featured
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-white leading-snug">{s.name}</h2>
              {s.municipality && (
                <p className="text-xs text-primary-100 mt-0.5 flex items-center gap-1">
                  <MapPin size={11} /> {s.municipality}{s.province ? `, ${s.province}` : ''}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="relative p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white flex-shrink-0 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="ph-stripe h-1 w-full" />
        </div>

        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">Loading details…</div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Description */}
            {s.description && (
              <p className="text-sm text-ink-700 leading-relaxed">{s.description}</p>
            )}

            {/* Contact grid */}
            <div className="space-y-2.5 rounded-2xl border border-primary-100 bg-primary-50/50 p-4">
              {s.address && (
                <div className="flex items-start gap-2.5 text-sm text-gray-600">
                  <MapPin size={14} className="text-primary-500 flex-shrink-0 mt-0.5" /> {s.address}
                </div>
              )}
              {s.phone && (
                <a href={`tel:${s.phone}`} className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-primary-700 transition-colors">
                  <Phone size={14} className="text-primary-500 flex-shrink-0" /> {s.phone}
                </a>
              )}
              {s.email && (
                <a href={`mailto:${s.email}`} className="flex items-center gap-2.5 text-sm text-primary-700 hover:underline">
                  <Mail size={14} className="text-primary-500 flex-shrink-0" /> {s.email}
                </a>
              )}
              {s.website && (
                <a href={s.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-primary-700 hover:underline">
                  <Globe size={14} className="text-primary-500 flex-shrink-0" /> Visit website
                  <ExternalLink size={11} />
                </a>
              )}
              {s.facebook_url && (
                <a href={s.facebook_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-blue-600 hover:underline">
                  <Facebook size={14} className="text-[#1877F2] flex-shrink-0" /> Facebook page
                  <ExternalLink size={11} />
                </a>
              )}
            </div>

            {/* Senior High: strands and TESDA qualifications are kept apart */}
            {s._shs && s.shs_note && (
              <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /><span>{s.shs_note}</span>
              </div>
            )}
            {s._shs && detail && !signedIn && s.offers_senior_high && <CoursesLock strand />}
            {s._shs && detail && signedIn && s.offers_senior_high && (
              <div className="space-y-4">
                <OfferingList title="Senior High School strands" rows={s.strands ?? []} empty={SHS_NO_STRANDS} />
              </div>
            )}
            {s._tesda && detail && !signedIn && <CoursesLock unit="TESDA program" />}
            {s._tesda && detail && signedIn && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-teal-800">TESDA training is separate from Senior High School and College. It gives a National Certificate (NC).</p>
                <OfferingList title="TESDA qualifications" rows={s.tesda_programs ?? []} empty="TESDA qualification information not yet available." tesda />
              </div>
            )}
            {(s._shs || s._tesda) && (
              <div className="space-y-1 text-[11px] text-gray-500">
                {s.info_status === 'verified' && (
                  <p className="inline-flex items-center gap-1 text-emerald-700"><BadgeCheck size={11} /> Verified{s.last_verified_at ? ` · ${new Date(s.last_verified_at).toLocaleDateString()}` : ''}</p>
                )}
                {s.source_url && <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-700 hover:underline">Reference <ExternalLink size={10} /></a>}
                {s.address && <p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + ' ' + s.address)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-700 hover:underline"><MapPin size={10} /> Open in Maps</a></p>}
              </div>
            )}

            {/* Programs, grouped by field of study (verified only). Visitors get a sign-in prompt instead. */}
            {!s._shs && !s._tesda && detail && !signedIn && <CoursesLock count={s.program_count} strand={shsOnly(s)} />}
            {!s._shs && !s._tesda && detail && signedIn && (
              s.programs && s.programs.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-primary-900 flex items-center gap-1.5 border-l-4 border-primary-500 pl-2">
                    <BookOpen size={14} className="text-primary-700" />
                    {shsOnly(s) ? 'Verified Strands' : 'Verified Courses'}
                    <span className="text-xs font-normal text-gray-400">({s.programs.length})</span>
                  </h3>
                  {Object.entries(
                    s.programs.reduce<Record<string, SchoolProgram[]>>((acc, sp) => {
                      const k = sp.program.field_of_study ?? 'other'
                      ;(acc[k] ??= []).push(sp)
                      return acc
                    }, {}),
                  ).map(([field, items]) => (
                    <div key={field}>
                      <p className="text-xs font-bold uppercase tracking-wide text-primary-700 mb-1.5">
                        {FIELD_LABELS[field] ?? field} <span className="font-normal text-gray-400">({items.length})</span>
                      </p>
                      <ul className="space-y-1.5">
                        {items.map(sp => (
                          <li key={sp.id} className="rounded-xl border border-primary-100 bg-primary-50/50 px-3 py-2">
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
                  <span>{shsOnly(s) ? UNAVAILABLE_NOTE_STRANDS : UNAVAILABLE_NOTE}</span>
                </div>
              )
            )}
          </div>
        )}

        {/* Footer CTA */}
        <div className="sticky bottom-0 bg-white border-t border-primary-100 px-6 py-4 shadow-[0_-8px_16px_-12px_rgba(0,48,135,0.25)]">
          {s.website ? (
            <a href={s.website} target="_blank" rel="noopener noreferrer"
              className="btn-primary w-full flex items-center justify-center gap-2 shadow-md shadow-primary-600/20">
              Visit School Website <ExternalLink size={14} />
            </a>
          ) : s.email ? (
            <a href={`mailto:${s.email}`} className="btn-primary w-full flex items-center justify-center gap-2 shadow-md shadow-primary-600/20">
              Contact School
            </a>
          ) : (
            <p className="text-sm text-center font-medium text-primary-800 py-1">
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
        'w-full text-left bg-white rounded-2xl border border-l-4 shadow-sm transition-all duration-200 p-4 group hover:-translate-y-0.5',
        school.is_featured
          ? 'border-primary-100 border-l-accent-400 bg-gradient-to-r from-accent-50/60 to-white hover:border-primary-300 hover:shadow-lg hover:shadow-primary-600/10'
          : 'border-primary-100 border-l-primary-500 hover:border-primary-300 hover:border-l-primary-600 hover:shadow-lg hover:shadow-primary-600/10'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {school.logo_url ? (
          <img src={school.logo_url} alt={school.name}
            className="flex-shrink-0 w-11 h-11 rounded-xl object-cover border-2 border-primary-100 bg-white shadow-sm" />
        ) : (
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-white border-2 border-primary-100 shadow-sm flex items-center justify-center">
            <GradCapIcon size={28} />
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
                {school._shs ? <ShsBadges s={school} small /> : school._tesda ? <TesdaBadges s={school} small /> : <>
                <SectorBadge s={school} small /></>}
              </div>
              <h3 className="font-bold text-primary-900 text-sm leading-snug group-hover:text-primary-700 transition-colors line-clamp-2">
                {school.name}
              </h3>
            </div>
            <ChevronRight size={15} className="text-gray-300 group-hover:text-primary-400 flex-shrink-0 mt-0.5 transition-colors" />
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs mt-1.5">
            {school.municipality && !school.address && (
              <span className="flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-0.5 font-medium text-primary-800">
                <MapPin size={10} className="text-primary-500" /> {school.municipality}{school.province ? `, ${school.province}` : ''}
              </span>
            )}
            {school._shs || school._tesda ? null : school.program_count > 0 ? (
              <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-800">
                <BadgeCheck size={10} /> {school.program_count} verified program{school.program_count !== 1 ? 's' : ''}
              </span>
            ) : visitor ? null : (
              <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-medium text-amber-700">
                <AlertCircle size={10} /> {shsOnly(school) ? 'Strand list not published yet' : 'Course list not published yet'}
              </span>
            )}
          </div>
          {school.address && (
            <p className={cn('text-xs text-ink-600 mt-1.5', school._shs || school._tesda ? 'line-clamp-2' : 'line-clamp-1')}>{school.address}</p>
          )}
          {school._shs && school.shs_note && <p className="mt-1.5 text-[11px] text-sky-800 line-clamp-2">{school.shs_note}</p>}
          {school._tesda && !visitor && (
            <div className="mt-1.5">
              {(school.tesda_programs ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {(school.tesda_programs ?? []).slice(0, 3).map(x => <span key={x.id} className="rounded-full border border-teal-300 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800">{x.name}{x.code ? ` ${x.code}` : ''}</span>)}
                  {(school.tesda_programs ?? []).length > 3 && <span className="text-[10px] text-gray-500 self-center">+{(school.tesda_programs ?? []).length - 3} more</span>}
                </div>
              ) : <p className="text-[11px] text-amber-700">TESDA qualification information not yet available.</p>}
            </div>
          )}
          {school._shs && school.offers_senior_high && !visitor && (
            <div className="mt-1.5 space-y-1">
              {(school.strands ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {(school.strands ?? []).slice(0, 3).map(x => <span key={x.id} className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-800">{x.code || x.name}</span>)}
                  {(school.strands ?? []).length > 3 && <span className="text-[10px] text-gray-500 self-center">+{(school.strands ?? []).length - 3} more</span>}
                </div>
              ) : <p className="text-[11px] text-amber-700">{SHS_NO_STRANDS}</p>}
              {(school.tesda_programs ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(school.tesda_programs ?? []).slice(0, 2).map(x => <span key={x.id} className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{x.name}{x.code ? ` ${x.code}` : ''}</span>)}
                </div>
              )}
            </div>
          )}
          <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-primary-700">
            {school._tesda ? (visitor ? <><Lock size={12} /> School details · sign in for programs</> : <><BookOpen size={12} /> View details</>) : school._shs ? (!school.offers_senior_high ? <><BookOpen size={12} /> View details</> : visitor ? <><Lock size={12} /> School details · sign in for strands</> : <><BookOpen size={12} /> View details</>) : visitor ? <><Lock size={12} /> School details · sign in for {shsOnly(school) ? 'strands' : 'courses'}</> : <><BookOpen size={12} /> {shsOnly(school) ? 'View Strands' : 'View Courses'}</>}
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
          ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-600/20'
          : 'bg-white text-primary-700 border-primary-200 hover:bg-primary-50 hover:border-primary-400 disabled:opacity-40 disabled:hover:bg-white',
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
  const [shsKind, setShsKind] = useState('')   // Senior High: '' | suc | public | private | tvl | tesda
  const [tvKind, setTvKind] = useState('')     // inside Tech-Voc or TESDA: '' | public | private
  const [view, setView] = useState<'schools' | 'courses'>('schools')
  const [level, setLevel] = useState<'college' | 'senior_high' | 'tvl' | 'tesda'>('college') // College and Senior High are listed apart
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
  if (schoolType) params.set('sector', schoolType)
  if (search) params.set('search', search)
  if (field) params.set('field_of_study', field)
  if (ptype) params.set('program_type', ptype)
  params.set('level', level === 'tvl' ? 'senior_high' : level)
  if (level === 'tesda' || level === 'tvl') {
    params.delete('school_type')
    if (level === 'tvl') params.set('tvl', '1')  // Tech-Voc: the TVL track of Senior High
    if (tvKind) params.set('sector', tvKind)
  }
  if (level === 'senior_high') {
    params.delete('school_type')
    if (shsKind) params.set('sector', shsKind)
  }

  // Backend already filters to is_active=True
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['youth-schools', schoolType, search, field, ptype, level, shsKind, tvKind],
    queryFn: () => apiClient.get(`/schools/?${params.toString()}`).then(r => toArray<School>(r.data)),
  })

  const courseParams = new URLSearchParams()
  if (schoolType) courseParams.set('school_type', schoolType === 'suc' ? 'state_university' : schoolType)
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

  // the numbers on the Senior High chips come from the whole Senior High list
  const { data: shsAll } = useQuery({
    queryKey: ['youth-schools-shs-all', signedIn, level],
    queryFn: () => apiClient.get(`/schools/?level=${level === 'tvl' ? 'senior_high&tvl=1' : level}&page_size=200`).then(r => toArray<School>(r.data)),
  })
  const shsCount = (kind: string, sub = '') => (shsAll ?? []).filter(x => {
    const sec = x.sector ?? 'private'
    if (kind === 'sector') return !sub || sec === sub
    if (kind === 'tvl') return !!x.offers_tvl && (!sub || sec === sub)
    if (kind === 'tesda') return !!x.tesda_provider && (!sub || sec === sub)
    return !kind || sec === kind
  }).length

  const schools = (data ?? []).map(x => (level === 'senior_high' ? asSeniorHigh(x) : level === 'tvl' ? { ...asSeniorHigh(x), _hideTvl: true } : level === 'tesda' ? asTesda(x) : x))
  const featured = schools.filter(s => s.is_featured)
  const rest     = schools.filter(s => !s.is_featured)

  // Counts per type (for chip labels)
  const typeCounts: Record<string, number> = {}
  // the College chips count the whole College list, not only what is shown now
  const countBase = level === 'college' ? (shsAll ?? schools) : schools
  countBase.forEach(s => { const k = s.sector ?? (s.school_type === 'state_university' ? 'suc' : s.school_type === 'public' ? 'public' : 'private'); typeCounts[k] = (typeCounts[k] ?? 0) + 1 })

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <GraduationCap size={22} className="text-primary-700" /> School Finder
        </h1>
        <p className="page-subtitle">
          {level === 'senior_high' ? 'Senior High Schools in Lucena City' : level === 'tvl' ? 'Tech-Voc (TVL) Senior High Schools in Lucena City' : level === 'tesda' ? 'TESDA / TVET Schools in Lucena City' : 'College Schools in Lucena City'}
          {!isLoading && schools.length > 0 && (
            <span className="ml-1 text-primary-700 font-medium">· {schools.length} schools</span>
          )}
        </p>
      </div>

      {/* College and Senior High are two separate lists */}
      {view === 'schools' && (
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 text-sm" role="tablist" aria-label="Level">
          {([['college', 'College'], ['senior_high', 'Senior High School'], ['tvl', 'Tech-Voc (TVL)'], ['tesda', 'TESDA / TVET']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={level === k} onClick={() => { setLevel(k); setSchoolType(''); setShsKind(''); setTvKind(''); if (k !== 'college') { setView('schools'); setField(''); setPtype(''); setSchoolFilter('') } }}
              className={cn('rounded-lg px-4 py-1.5 font-semibold transition-colors', level === k ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-primary-700')}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* TESDA / TVET: every training provider, by Public or Private */}
      {level === 'tesda' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {([['', 'All'], ['public', 'Public'], ['private', 'Private']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setTvKind(v)}
                className={cn('text-xs px-3 py-1.5 rounded-full border font-medium transition-all duration-150',
                  tvKind === v ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700')}>
                {l}{shsAll && <span className={cn('ml-1.5', tvKind === v ? 'opacity-70' : 'opacity-50')}>({shsCount('sector', v)})</span>}
              </button>
            ))}
          </div>
          <p className="rounded-xl border border-teal-200 bg-teal-50/60 px-3 py-2 text-[11px] text-teal-900">
            TESDA training gives a National Certificate (NC) in a skill. It is not a Senior High strand. A school here may also have Senior High or College.
          </p>
        </div>
      )}

      {/* Tech-Voc (the TVL track of Senior High): Public or Private */}
      {level === 'tvl' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {([['', 'All'], ['public', 'Public'], ['private', 'Private']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setTvKind(v)}
                className={cn('text-xs px-3 py-1.5 rounded-full border font-medium transition-all duration-150',
                  tvKind === v ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-800')}>
                {l}{shsAll && <span className={cn('ml-1.5', tvKind === v ? 'opacity-70' : 'opacity-50')}>({shsCount('sector', v)})</span>}
              </button>
            ))}
          </div>
          <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900">
            Tech-Voc (TVL) is a track of Senior High School (Grades 11 and 12). You finish Senior High with a skills specialization.
          </p>
        </div>
      )}

      {/* Senior High filters: the classification */}
      {level === 'senior_high' && (
        <div className="flex flex-wrap gap-2">
          {SHS_CHIPS.map(t => (
            <button key={t.value} onClick={() => setShsKind(t.value)}
              className={cn('text-xs px-3 py-1.5 rounded-full border font-medium transition-all duration-150',
                shsKind === t.value ? 'bg-primary-600 text-white border-primary-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-700')}>
              {t.label}
              {shsAll && <span className={cn('ml-1.5', shsKind === t.value ? 'opacity-70' : 'opacity-50')}>({shsCount(t.value)})</span>}
            </button>
          ))}
        </div>
      )}

      {/* Type chips (College) */}
      {level === 'college' && <div className="flex flex-wrap gap-2">
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
            {(t.value ? typeCounts[t.value] : countBase.length) ? (
              <span className={cn('ml-1.5', schoolType === t.value ? 'opacity-70' : 'opacity-50')}>
                ({t.value ? typeCounts[t.value] : countBase.length})
              </span>
            ) : null}
          </button>
        ))}
      </div>}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          className="input pl-9 w-full"
          placeholder={level === 'tesda' ? (visitor ? 'Search school, barangay or street…' : 'Search school, barangay, street or TESDA qualification…') : level === 'senior_high' || level === 'tvl' ? (visitor ? 'Search school, barangay, street or public / private…' : 'Search school, barangay, street, strand or TESDA qualification…') : visitor ? 'Search school name or place…' : 'Search school name, course, program, or field of study…'}
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
      {signedIn && level === 'college' && <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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

      {/* View switch (the courses view is for College) */}
      {level === 'college' && <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
        {(['schools', 'courses'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn('px-4 py-1.5 transition-colors', view === v ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
          >
            {v === 'schools' ? 'Schools' : <span className="inline-flex items-center gap-1">{visitor && <Lock size={11} />} Courses</span>}
          </button>
        ))}
      </div>}

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
        <SchoolDetailDrawer school={selected} onClose={() => setSelected(null)} mode={level === 'tvl' ? 'senior_high' : level} />
      )}
    </div>
  )
}
