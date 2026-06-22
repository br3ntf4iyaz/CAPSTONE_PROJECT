import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  GraduationCap, Download, ArrowLeft, AlertCircle, RefreshCw,
  Calendar, Hash, ExternalLink,
} from 'lucide-react'
import apiClient from '@/api/client'
import { formatDate, cn } from '@/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
/**
 * Certificates can come from two backends:
 *   - /api/courses/certificates/      (course completion certificates)
 *   - /api/recognition/certificates/  (broader recognition certificates,
 *      includes manually-issued LYDO certificates with title + issuer)
 *
 * We merge both into a single "UnifiedCertificate" view so users see
 * their entire credential history in one place.
 */
interface CourseCert {
  id: number
  certificate_number: string
  course_title: string
  course_id: number
  issued_at: string
  file_url: string | null
}

interface RecognitionCert {
  id: number
  user: number
  user_name: string
  title: string
  issued_by: string
  issued_at: string
  expiry_date: string | null
  certificate_number: string
  file: string | null
  enrollment: number | null
  created_at: string
}

interface UnifiedCertificate {
  key: string
  source: 'course' | 'recognition'
  title: string
  issuer: string
  issuedAt: string
  certNumber: string
  fileUrl: string | null
  link: string | null
}

const toArray = <T,>(d: any): T[] =>
  Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : []

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function YouthCertificatesPage() {
  const courseCertsQ = useQuery({
    queryKey: ['my-course-certificates'],
    queryFn: () =>
      apiClient.get('/courses/certificates/').then(r => toArray<CourseCert>(r.data)).catch(() => []),
  })

  const recognitionCertsQ = useQuery({
    queryKey: ['my-recognition-certificates'],
    queryFn: () =>
      apiClient.get('/recognition/certificates/').then(r => toArray<RecognitionCert>(r.data)).catch(() => []),
  })

  const isLoading = courseCertsQ.isLoading || recognitionCertsQ.isLoading
  const isError = courseCertsQ.isError && recognitionCertsQ.isError

  const certificates = useMemo<UnifiedCertificate[]>(() => {
    const courseCerts = (courseCertsQ.data ?? []).map<UnifiedCertificate>(c => ({
      key: `course-${c.id}`,
      source: 'course',
      title: c.course_title,
      issuer: 'LYDO Learning Platform',
      issuedAt: c.issued_at,
      certNumber: c.certificate_number,
      fileUrl: c.file_url,
      link: `/lms`, // could deep-link to course detail later
    }))
    const recogCerts = (recognitionCertsQ.data ?? []).map<UnifiedCertificate>(c => ({
      key: `recognition-${c.id}`,
      source: 'recognition',
      title: c.title,
      issuer: c.issued_by,
      issuedAt: c.issued_at,
      certNumber: c.certificate_number,
      fileUrl: c.file,
      link: null,
    }))
    return [...courseCerts, ...recogCerts].sort(
      (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
    )
  }, [courseCertsQ.data, recognitionCertsQ.data])

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
              Your certificates.
            </h1>
            <p className="text-primary-100 text-lg max-w-xl leading-relaxed">
              Official records of completed courses, programs, and recognized accomplishments.
            </p>
          </div>

          <aside className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-5 min-w-[200px]">
            <p className="eyebrow-on-dark mb-2">Total earned</p>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-extrabold text-5xl text-accent-300 tabular-nums leading-none">
                {certificates.length}
              </span>
              <span className="text-primary-100/80 text-sm">credentials</span>
            </div>
          </aside>
        </div>
      </header>

      {/* ── List ────────────────────────────────────────────────────── */}
      {isError ? (
        <div className="bg-white rounded-2xl border border-alert-200 p-6">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-alert-700 mb-2">
            <AlertCircle size={14} /> Couldn't load your certificates.
          </p>
          <button
            type="button"
            onClick={() => { courseCertsQ.refetch(); recognitionCertsQ.refetch() }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 px-3 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors"
          >
            <RefreshCw size={12} /> Try again
          </button>
        </div>
      ) : isLoading ? (
        <SkeletonList />
      ) : certificates.length === 0 ? (
        <div className="bg-white rounded-3xl border border-ink-100 p-10 text-center">
          <GraduationCap size={36} className="text-ink-300 mx-auto mb-3" />
          <p className="font-display font-bold text-lg text-ink-900 mb-1">No certificates yet.</p>
          <p className="text-sm text-ink-600 max-w-md mx-auto">
            Complete a course or program to earn your first official certificate. They'll show up here when ready.
          </p>
          <Link to="/lms" className="btn-primary mt-5 inline-flex">
            Browse courses
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certificates.map(cert => <CertificateCard key={cert.key} cert={cert} />)}
        </div>
      )}
    </div>
  )
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function CertificateCard({ cert }: { cert: UnifiedCertificate }) {
  return (
    <article className="bg-white rounded-2xl border border-ink-100 overflow-hidden hover:border-primary-300 hover:shadow-lg transition-all flex flex-col">
      {/* Decorative ribbon */}
      <div
        className={cn(
          'h-2 w-full',
          cert.source === 'course' ? 'bg-primary-600' : 'bg-accent-400',
        )}
      />
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-4">
          <span
            className={cn(
              'inline-flex items-center justify-center w-12 h-12 rounded-2xl flex-shrink-0',
              cert.source === 'course'
                ? 'bg-primary-50 text-primary-700'
                : 'bg-accent-100 text-accent-800',
            )}
          >
            <GraduationCap size={22} strokeWidth={2.2} />
          </span>
          <span
            className={cn(
              'chip text-[10px] uppercase',
              cert.source === 'course' ? 'bg-primary-50 text-primary-700' : 'bg-accent-100 text-accent-800',
            )}
          >
            {cert.source === 'course' ? 'Course' : 'Recognition'}
          </span>
        </div>

        <h3 className="font-display font-bold text-xl text-ink-900 leading-tight mb-1">
          {cert.title}
        </h3>
        <p className="text-sm text-ink-600 mb-4">Issued by {cert.issuer}</p>

        <dl className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-ink-100">
          <div>
            <dt className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1 inline-flex items-center gap-1">
              <Calendar size={10} /> Issued
            </dt>
            <dd className="text-sm font-semibold text-ink-900">{formatDate(cert.issuedAt)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1 inline-flex items-center gap-1">
              <Hash size={10} /> Number
            </dt>
            <dd className="text-sm font-mono font-semibold text-ink-900 truncate">
              {cert.certNumber}
            </dd>
          </div>
        </dl>

        <div className="flex gap-2 mt-5">
          {cert.fileUrl ? (
            <a
              href={cert.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm flex-1"
            >
              <Download size={14} /> Download
            </a>
          ) : (
            <span className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-ink-100 text-ink-500 text-sm font-semibold cursor-not-allowed">
              File pending
            </span>
          )}
          {cert.link && (
            <Link
              to={cert.link}
              className="btn-secondary text-sm whitespace-nowrap"
            >
              <ExternalLink size={14} /> View course
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}

function SkeletonList() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-ink-100 p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="w-12 h-12 skeleton rounded-2xl" />
            <div className="h-5 w-20 skeleton" />
          </div>
          <div className="h-6 skeleton w-3/4 mb-2" />
          <div className="h-3 skeleton w-1/2 mb-5" />
          <div className="h-12 skeleton" />
        </div>
      ))}
    </div>
  )
}
