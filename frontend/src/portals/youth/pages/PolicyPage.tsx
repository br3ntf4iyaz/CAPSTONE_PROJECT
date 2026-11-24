import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Cookie, Scale, ShieldCheck } from 'lucide-react'
import apiClient from '@/api/client'
import { LydoLogo } from '@/components/ui/LydoLogo'
import { PageSpinner } from '@/components/ui/Spinner'
import { openCookieSettings } from '@/lib/consent'

export type PolicySlug = 'terms' | 'privacy' | 'cookies'
export interface Policy { slug: PolicySlug; title: string; version: number; updated_at: string; needs_review: boolean; content: string }

const META: Record<PolicySlug, { icon: typeof Scale; fallbackTitle: string }> = {
  terms: { icon: Scale, fallbackTitle: 'Terms of Use' },
  privacy: { icon: ShieldCheck, fallbackTitle: 'Privacy Policy' },
  cookies: { icon: Cookie, fallbackTitle: 'Cookie Policy' },
}

/** **bold** and [placeholders for things still to be filled in] */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\])/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold text-ink-900">{p.slice(2, -2)}</strong>
        if (p.startsWith('[') && p.endsWith(']')) return <mark key={i} className="rounded bg-amber-100 px-1 text-amber-900">{p}</mark>
        return <Fragment key={i}>{p}</Fragment>
      })}
    </>
  )
}

/** Renders the simple markup the administrators edit: '## Heading', '- bullet', blank line between paragraphs. */
export function PolicyContent({ content }: { content: string }) {
  const blocks: JSX.Element[] = []
  let bullets: string[] = []
  const flush = (key: string) => {
    if (bullets.length) {
      blocks.push(<ul key={key} className="list-disc space-y-1.5 pl-5">{bullets.map((b, i) => <li key={i}><Inline text={b} /></li>)}</ul>)
      bullets = []
    }
  }
  content.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (line.startsWith('- ')) { bullets.push(line.slice(2)); return }
    flush(`ul${i}`)
    if (line.startsWith('## ')) blocks.push(<h2 key={i} className="mt-7 font-display text-lg font-bold text-ink-900 first:mt-0">{line.slice(3)}</h2>)
    else if (line) blocks.push(<p key={i}><Inline text={line} /></p>)
  })
  flush('end')
  return <div className="space-y-3 text-[15px] leading-relaxed text-ink-700">{blocks}</div>
}

export default function PolicyPage({ slug }: { slug: PolicySlug }) {
  const q = useQuery({
    queryKey: ['policy', slug],
    queryFn: () => apiClient.get(`/policies/${slug}/`).then(r => r.data as Policy),
    retry: 1,
  })
  const meta = META[slug]
  const Icon = meta.icon
  const p = q.data

  return (
    <div className="flex min-h-screen flex-col bg-paper-50">
      <div className="ph-stripe h-1 w-full" />
      <div className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <LydoLogo size={36} />
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-extrabold tracking-tightish text-ink-900">LYDO</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Lucena Youth</span>
            </span>
          </Link>
          <Link to="/" className="text-sm font-semibold text-ink-600 transition-colors hover:text-primary-700">← Back to home</Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-12">
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50"><Icon size={20} className="text-primary-600" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Policies</p>
              <h1 className="font-display text-2xl font-extrabold text-ink-900">{p?.title ?? meta.fallbackTitle}</h1>
            </div>
          </div>

          {q.isLoading ? <PageSpinner /> : q.isError || !p ? (
            <p className="text-sm text-ink-600">This page could not be loaded right now. Please try again in a moment, or contact LYDO at lydo@lucena.gov.ph.</p>
          ) : (
            <>
              <p className="mb-5 text-sm text-ink-500">
                Version {p.version} · Last updated {new Date(p.updated_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              {p.needs_review && (
                <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <p>This is a draft that has not yet been confirmed by LYDO or the City Government of Lucena. Parts in highlighted brackets still need to be completed.</p>
                </div>
              )}
              <PolicyContent content={p.content} />
            </>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-100 pt-5 text-sm">
            <Link to="/terms" className="font-semibold text-primary-700 hover:underline">Terms of Use</Link>
            <Link to="/privacy" className="font-semibold text-primary-700 hover:underline">Privacy Policy</Link>
            <Link to="/cookies" className="font-semibold text-primary-700 hover:underline">Cookie Policy</Link>
            <button type="button" onClick={openCookieSettings} className="font-semibold text-ink-600 hover:underline">Cookie settings</button>
          </div>
        </div>
      </main>
    </div>
  )
}
