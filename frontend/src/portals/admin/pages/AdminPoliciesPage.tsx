import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Cookie, Eye, History, Scale, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { apiMessage } from '@/portals/youth/lms'
import { PolicyContent, type Policy, type PolicySlug } from '@/portals/youth/pages/PolicyPage'

const TABS: { slug: PolicySlug; label: string; icon: typeof Scale; path: string }[] = [
  { slug: 'terms', label: 'Terms of Use', icon: Scale, path: '/terms' },
  { slug: 'privacy', label: 'Privacy Policy', icon: ShieldCheck, path: '/privacy' },
  { slug: 'cookies', label: 'Cookie Policy', icon: Cookie, path: '/cookies' },
]
interface Revision { version: number; title: string; content: string; created_at: string; edited_by: string }
const when = (iso: string) => new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function AdminPoliciesPage() {
  const [slug, setSlug] = useState<PolicySlug>('terms')
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Policies</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          The Terms of Use, Privacy Policy and Cookie Policy shown to the public. Changes appear on the website right away.
          The starting text is a draft: it must be reviewed by LYDO or the City Government before it is treated as final.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map(t => (
          <button key={t.slug} type="button" role="tab" aria-selected={slug === t.slug} onClick={() => setSlug(t.slug)}
            className={cn('inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors',
              slug === t.slug ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300')}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      <Editor key={slug} slug={slug} path={TABS.find(t => t.slug === slug)!.path} />
    </div>
  )
}

function Editor({ slug, path }: { slug: PolicySlug; path: string }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['policy', slug], queryFn: () => apiClient.get(`/policies/${slug}/`).then(r => r.data as Policy) })
  const revs = useQuery({ queryKey: ['policy-revisions', slug], queryFn: () => apiClient.get(`/policies/${slug}/revisions/`).then(r => r.data as Revision[]) })
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { if (q.data) { setTitle(q.data.title); setContent(q.data.content) } }, [q.data?.version]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.patch(`/policies/${slug}/`, body).then(r => r.data as Policy),
    onSuccess: (_d, body) => {
      qc.invalidateQueries({ queryKey: ['policy', slug] })
      qc.invalidateQueries({ queryKey: ['policy-revisions', slug] })
      toast.success('reviewed' in body && Object.keys(body).length === 1 ? 'Review status updated.' : 'Saved as a new version. It needs review again.')
    },
    onError: e => toast.error(apiMessage(e)),
  })

  if (q.isLoading) return <PageSpinner />
  if (q.isError || !q.data) return <p className="text-sm text-red-600">Could not load this policy.</p>
  const p = q.data
  const dirty = title !== p.title || content !== p.content

  return (
    <div className="space-y-4">
      <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm',
        p.needs_review ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900')}>
        <div className="flex items-start gap-2">
          {p.needs_review ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
          <p>
            Version <strong>{p.version}</strong> · updated {when(p.updated_at)} ·{' '}
            {p.needs_review ? 'Draft: not yet confirmed by LYDO / the City Government. The public page shows a notice.' : 'Confirmed as reviewed.'}
          </p>
        </div>
        <button type="button" disabled={save.isPending || dirty} className="btn-secondary btn-sm"
          title={dirty ? 'Save your changes first' : undefined}
          onClick={() => save.mutate({ reviewed: p.needs_review })}>
          {p.needs_review ? 'Mark as reviewed' : 'Mark as needs review'}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
          <button type="button" className={cn('rounded-md px-3 py-1.5 font-semibold', !preview ? 'bg-primary-700 text-white' : 'text-gray-600')} onClick={() => setPreview(false)}>Edit</button>
          <button type="button" className={cn('rounded-md px-3 py-1.5 font-semibold', preview ? 'bg-primary-700 text-white' : 'text-gray-600')} onClick={() => setPreview(true)}>Preview</button>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setShowHistory(s => !s)}><History size={13} /> Versions ({revs.data?.length ?? 0})</button>
          <Link to={path} target="_blank" className="btn-secondary btn-sm"><Eye size={13} /> Open public page</Link>
        </div>
      </div>

      {preview ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-bold text-gray-900">{title}</h2>
          <PolicyContent content={content} />
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
          <div><label className="label">Page title</label><input className="input" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></div>
          <div>
            <label className="label">Text</label>
            <textarea className="input font-mono text-sm leading-relaxed" rows={22} value={content} onChange={e => setContent(e.target.value)} />
            <p className="mt-1 text-xs text-gray-500">
              Use <code>## Heading</code> for a section title, <code>- item</code> for a bullet, <code>**bold**</code> for emphasis, and a blank line between paragraphs.
              Put anything still to be confirmed in <code>[square brackets]</code>: it is highlighted for the reader.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {dirty && <button type="button" className="btn-secondary btn-sm" onClick={() => { setTitle(p.title); setContent(p.content) }}>Discard changes</button>}
        <button type="button" className="btn-primary" disabled={!dirty || save.isPending || !content.trim() || !title.trim()} onClick={() => save.mutate({ title, content })}>
          {save.isPending ? 'Saving…' : 'Save as new version'}
        </button>
      </div>

      {showHistory && (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <p className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">Earlier versions</p>
          <ul className="divide-y divide-gray-100">
            {(revs.data ?? []).map(r => (
              <li key={r.version} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>Version {r.version} · {when(r.created_at)}{r.edited_by ? ` · ${r.edited_by}` : ' · starting draft'}</span>
                {r.version !== p.version && (
                  <button type="button" className="font-semibold text-primary-700 hover:underline" onClick={() => { setTitle(r.title); setContent(r.content); setPreview(false); toast('Loaded into the editor. Save to publish it as a new version.') }}>
                    Load into editor
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
