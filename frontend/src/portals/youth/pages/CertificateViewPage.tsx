import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { downloadWithLogin } from '../lms'

interface Cert {
  id: number
  certificate_number: string
  course_title: string
  course_id: number
  holder_name: string
  audience: string
  statement: string
  outcomes: string[]
  modules_summary: string[]
  signatories: { name: string; title: string }[]
  completed_on: string | null
  issued_at: string
}

const fmt = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })

/** A preview of the certificate (the same wording as the PDF) with a button to download the PDF. */
export default function CertificateViewPage() {
  const { certId } = useParams<{ certId: string }>()
  const q = useQuery({
    queryKey: ['certificate', certId],
    queryFn: () => apiClient.get(`/courses/certificates/${certId}/`).then(r => r.data as Cert),
    retry: false,
  })

  if (q.isLoading) return <PageSpinner />
  const c = q.data
  if (q.isError || !c) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <AlertCircle size={40} className="text-alert-400" />
        <p className="font-semibold text-ink-700">This certificate could not be found.</p>
        <Link to="/certificates" className="btn-primary btn-sm">My certificates</Link>
      </div>
    )
  }

  const done = c.completed_on || c.issued_at
  return (
    <div className="space-y-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/certificates" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800"><ArrowLeft size={15} /> My certificates</Link>
        <button
          type="button"
          className="btn-primary gap-1.5"
          onClick={() => downloadWithLogin(`/courses/certificates/${c.id}/pdf/`, `Certificate-${c.certificate_number}.pdf`)
            .catch(() => toast.error('Could not download the certificate. Please try again.'))}
        >
          <Download size={15} /> Download PDF
        </button>
      </div>

      <article className="mx-auto max-w-4xl rounded-lg border-[10px] border-primary-700 bg-white p-2 shadow-xl" aria-label={`Certificate of completion for ${c.holder_name}`}>
        <div className="border border-amber-500 px-5 py-8 text-center sm:px-12 sm:py-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-700 ring-2 ring-amber-400 ring-offset-2">
            <span className="text-base font-extrabold text-white leading-none">LYDO</span>
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-primary-700">Lucena City Youth Development Office</p>
          <p className="text-[11px] text-ink-500">LYDOP | Lucena Youth Leadership Hub</p>

          <h1 className="mt-5 font-display text-2xl font-extrabold tracking-wide text-ink-900 sm:text-4xl">CERTIFICATE OF COMPLETION</h1>
          <p className="mt-4 text-sm text-ink-500">This is to certify that</p>
          <p className="mt-2 break-words border-b border-amber-500 pb-2 font-display text-3xl font-extrabold text-primary-700 sm:text-4xl">{c.holder_name}</p>

          <p className="mt-5 font-display text-xl font-bold text-ink-900 sm:text-2xl">{c.course_title}</p>
          <p className="mt-1 text-xs italic text-ink-500">Course for {c.audience}</p>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink-800">{c.statement}</p>

          {c.modules_summary.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-500">Modules completed</p>
              <p className="mx-auto mt-1 max-w-2xl text-xs text-ink-600">{c.modules_summary.join('  |  ')}</p>
            </div>
          )}

          <p className="mt-6 text-sm text-ink-600">Completed on {fmt(done)}</p>

          {c.signatories.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-10">
              {c.signatories.slice(0, 2).map(s => (
                <div key={s.name} className="min-w-[180px]">
                  <div className="border-t border-ink-700 pt-1">
                    <p className="text-sm font-bold text-ink-900">{s.name}</p>
                    {s.title && <p className="text-xs text-ink-500">{s.title}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-6 font-mono text-xs font-bold text-ink-900">Certificate No. {c.certificate_number}</p>
          <p className="mt-1 text-[10px] text-ink-400">Issued through the LYDOP learning platform of the Lucena City Youth Development Office.</p>
        </div>
      </article>
    </div>
  )
}
