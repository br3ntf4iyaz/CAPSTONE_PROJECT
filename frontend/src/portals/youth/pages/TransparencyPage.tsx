import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Eye, FileText, Landmark, ScrollText } from 'lucide-react'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { MONTHS, fmtDate } from '@/components/ComplianceStatus'

interface Item {
  id: number; barangay: string; barangay_id: number; category: string; category_short: string; category_label: string
  title: string; description: string; year: number; period_end_year: number | null; quarter: number | null; month: number | null
  period: string; published_at: string; is_none_declaration: boolean; has_file: boolean; total_amount: string | null
}
interface Payload {
  items: Item[]; barangays: { id: number; name: string }[]; years: number[]; categories: { key: string; short: string; label: string }[]
}
interface OfficeDoc { id: number; requirement: string; title: string; description: string; year: number; period: string; verified_at: string; filename: string }

const base = () => apiClient.defaults.baseURL ?? '/api'
const fileUrl = (id: number, download = false) => `${base()}/compliance/fpdpb/files/${id}/${download ? '?download=1' : ''}`

/** FPDPB: the Full Public Disclosure Policy Board. Verified and published SK documents only. No sign-in needed. */
export default function TransparencyPage() {
  const [f, setF] = useState({ barangay: '', category: '', year: '', quarter: '', month: '' })
  const params = useMemo(() => Object.fromEntries(Object.entries(f).filter(([, v]) => v)), [f])

  const q = useQuery({
    queryKey: ['fpdpb-public', params],
    queryFn: () => apiClient.get('/compliance/fpdpb/public/', { params }).then(r => r.data as Payload),
    retry: 1,
    placeholderData: prev => prev,
  })
  const office = useQuery({
    queryKey: ['fpdpb-office'],
    queryFn: () => apiClient.get('/compliance/disclosure/public/').then(r => r.data as { items: OfficeDoc[] }).catch(() => ({ items: [] as OfficeDoc[] })),
  })

  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }))
  const data = q.data
  const cats = data?.categories ?? []
  const items = data?.items ?? []
  const filtered = Object.keys(params).length > 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8">
        <p className="eyebrow mb-3">FPDPB</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tighter2 text-ink-900 sm:text-4xl">Full Public Disclosure Policy Board</h1>
        <p className="mt-3 max-w-3xl text-ink-600">
          The Sangguniang Kabataan of each barangay discloses its plans, budget and financial documents here. Only documents that the Lucena
          City Youth Development Office has verified and approved for publication appear on this page.
        </p>
      </header>

      <section aria-label="Filters" className="mb-8 grid grid-cols-2 gap-3 rounded-2xl border border-ink-100 bg-white p-4 md:grid-cols-5">
        <label className="text-xs font-semibold text-ink-500">Barangay
          <select className="input mt-1 text-sm" value={f.barangay} onChange={e => set('barangay', e.target.value)}>
            <option value="">All barangays</option>
            {data?.barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></label>
        <label className="text-xs font-semibold text-ink-500">Document
          <select className="input mt-1 text-sm" value={f.category} onChange={e => set('category', e.target.value)}>
            <option value="">All documents</option>
            {cats.map(c => <option key={c.key} value={c.key}>{c.short}</option>)}
          </select></label>
        <label className="text-xs font-semibold text-ink-500">Year
          <select className="input mt-1 text-sm" value={f.year} onChange={e => set('year', e.target.value)}>
            <option value="">All years</option>
            {data?.years.map(y => <option key={y} value={y}>{y}</option>)}
          </select></label>
        <label className="text-xs font-semibold text-ink-500">Quarter
          <select className="input mt-1 text-sm" value={f.quarter} onChange={e => set('quarter', e.target.value)}>
            <option value="">Any quarter</option>
            {[1, 2, 3, 4].map(n => <option key={n} value={n}>Q{n}</option>)}
          </select></label>
        <label className="text-xs font-semibold text-ink-500">Month
          <select className="input mt-1 text-sm" value={f.month} onChange={e => set('month', e.target.value)}>
            <option value="">Any month</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select></label>
        {filtered && <button type="button" className="col-span-2 text-left text-xs font-semibold text-primary-700 hover:underline md:col-span-5" onClick={() => setF({ barangay: '', category: '', year: '', quarter: '', month: '' })}>Clear filters</button>}
      </section>

      {q.isLoading ? <PageSpinner /> : q.isError ? (
        <p className="rounded-2xl border border-ink-100 bg-white p-6 text-sm text-ink-600">The documents could not be loaded right now. Please try again in a moment.</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center">
          <Landmark className="mx-auto mb-2 text-primary-400" size={28} />
          <p className="font-display text-lg font-bold text-ink-900">{filtered ? 'No published documents match these filters.' : 'No documents have been published yet.'}</p>
          <p className="mt-1 text-sm text-ink-600">{filtered ? 'Try different filters.' : 'Documents appear here after they are submitted, verified and approved. Please check back later.'}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {cats.map(c => {
            const rows = items.filter(i => i.category === c.key)
            if (rows.length === 0) return null
            return (
              <section key={c.key} aria-label={c.label}>
                <h2 className="mb-3 font-display text-lg font-bold text-ink-900">{c.label} <span className="ml-1 text-sm font-medium text-ink-400">({rows.length})</span></h2>
                <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white">
                  {rows.map(i => (
                    <li key={i.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                          {i.is_none_declaration ? <ScrollText size={17} /> : <FileText size={17} />}
                        </span>
                        <div className="min-w-0">
                          <p className={cn('font-semibold text-ink-900', i.is_none_declaration && 'tracking-wide')}>{i.title}</p>
                          <p className="text-xs text-ink-500">
                            <strong className="text-ink-700">{i.barangay}</strong> · {i.period}
                            {i.category === 'cbydp' && i.period_end_year ? ` to ${i.period_end_year}` : ''} · Published {fmtDate(i.published_at)}
                          </p>
                          {i.total_amount && <p className="text-xs text-ink-600">Total approved budget: ₱{Number(i.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>}
                          {i.description && <p className="mt-1 text-sm text-ink-600">{i.description}</p>}
                        </div>
                      </div>
                      {i.has_file && !i.is_none_declaration ? (
                        <div className="flex shrink-0 gap-2 self-start sm:self-center">
                          <a href={fileUrl(i.id)} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm"><Eye size={14} /> View</a>
                          <a href={fileUrl(i.id, true)} className="btn-secondary btn-sm"><Download size={14} /> Download</a>
                        </div>
                      ) : i.is_none_declaration ? (
                        <span className="shrink-0 self-start rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 sm:self-center">Declaration: no purchase requests</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {(office.data?.items.length ?? 0) > 0 && !filtered && (
        <section className="mt-12" aria-label="LYDO office documents">
          <h2 className="mb-3 font-display text-lg font-bold text-ink-900">LYDO office documents</h2>
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white">
            {office.data!.items.map(d => (
              <li key={d.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-semibold text-ink-900">{d.title}</p><p className="text-xs text-ink-500">{d.requirement} · {d.period} · Approved {fmtDate(d.verified_at)}</p>
                  {d.description && <p className="mt-1 text-sm text-ink-600">{d.description}</p>}</div>
                <a href={`${base()}/compliance/disclosure/files/${d.id}/`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm shrink-0 self-start sm:self-center"><Download size={14} /> View / download</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
