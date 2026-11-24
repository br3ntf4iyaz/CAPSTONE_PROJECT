import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Landmark } from 'lucide-react'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'

interface Item {
  id: number
  requirement: string
  title: string
  description: string
  year: number
  quarter: number | null
  period: string
  deadline: string | null
  verified_at: string
  filename: string
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })

/** Public disclosure board: only documents an administrator verified and chose to publish. No sign-in needed. */
export default function TransparencyPage() {
  const [year, setYear] = useState<number | null>(null)
  const q = useQuery({
    queryKey: ['public-disclosure'],
    queryFn: () => apiClient.get('/compliance/disclosure/public/').then(r => r.data as { years: number[]; items: Item[] }),
    retry: 1,
  })
  const years = q.data?.years ?? []
  const active = year ?? years[0] ?? null
  const items = useMemo(() => (q.data?.items ?? []).filter(i => i.year === active), [q.data, active])
  const grouped = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const i of items) m.set(i.period, [...(m.get(i.period) ?? []), i])
    return [...m.entries()]
  }, [items])
  const link = (id: number) => `${apiClient.defaults.baseURL ?? '/api'}/compliance/disclosure/files/${id}/`

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8">
        <p className="eyebrow mb-3">Public disclosure</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tighter2 text-ink-900 sm:text-4xl">Documents the public may read.</h1>
        <p className="mt-3 max-w-2xl text-ink-600">
          These are the full public disclosure documents of the Lucena City Youth Development Office. Only documents that were
          checked and approved by an administrator appear here.
        </p>
      </header>

      {q.isLoading ? <PageSpinner /> : q.isError ? (
        <p className="rounded-2xl border border-ink-100 bg-white p-6 text-sm text-ink-600">The documents could not be loaded right now. Please try again in a moment.</p>
      ) : years.length === 0 ? (
        <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center">
          <Landmark className="mx-auto mb-2 text-primary-400" size={28} />
          <p className="font-display text-lg font-bold text-ink-900">No documents have been published yet.</p>
          <p className="mt-1 text-sm text-ink-600">Documents appear here after they are submitted and approved. Please check back later.</p>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Choose a year">
            {years.map(y => (
              <button key={y} type="button" aria-pressed={active === y} onClick={() => setYear(y)}
                className={cn('rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
                  active === y ? 'border-primary-700 bg-primary-700 text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-primary-300')}>
                {y}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {grouped.map(([period, docs]) => (
              <section key={period} className="rounded-2xl border border-ink-100 bg-white">
                <h2 className="border-b border-ink-100 px-5 py-3 font-display text-base font-bold text-ink-900">{period}</h2>
                <ul className="divide-y divide-ink-100">
                  {docs.map(d => (
                    <li key={d.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><FileText size={17} /></span>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink-900">{d.title}</p>
                          <p className="text-xs text-ink-500">{d.requirement} · Approved {fmt(d.verified_at)}</p>
                          {d.description && <p className="mt-1 text-sm text-ink-600">{d.description}</p>}
                        </div>
                      </div>
                      <a href={link(d.id)} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm shrink-0 self-start sm:self-center">
                        <Download size={14} /> View / download
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
