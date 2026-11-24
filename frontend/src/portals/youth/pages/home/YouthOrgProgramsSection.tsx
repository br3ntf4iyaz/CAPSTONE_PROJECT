import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Mail, MapPin, Phone, Target, Users, X, Building2, Sparkles } from 'lucide-react'
import apiClient from '@/api/client'
import { cn, toArray } from '@/utils'

interface HomeProgram {
  id: number
  title: string
  category: string
  category_display: string
  status: string
  status_display: string
  organization_name: string | null
  barangay: string
  description: string
  objectives: string
  target_beneficiaries: string
  start_date: string | null
  end_date: string | null
  location: string
  contact_person: string
  contact_email: string
  contact_phone: string
  thumbnail_url: string | null
}

const STATUS_STYLE: Record<string, string> = {
  ongoing: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  upcoming: 'bg-sky-50 text-sky-800 border-sky-200',
  completed: 'bg-ink-50 text-ink-700 border-ink-200',
}

function schedule(p: Pick<HomeProgram, 'start_date' | 'end_date'>): string {
  const f = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
  if (p.start_date && p.end_date && p.start_date !== p.end_date) return `${f(p.start_date)} to ${f(p.end_date)}`
  if (p.start_date) return f(p.start_date)
  if (p.end_date) return `Until ${f(p.end_date)}`
  return 'Schedule to be announced'
}

/** Published youth organization programs, visible to everyone. No sign-in needed. Drafts never reach this list. */
export function YouthOrgProgramsSection() {
  const [category, setCategory] = useState<string | null>(null)
  const [open, setOpen] = useState<HomeProgram | null>(null)

  const q = useQuery({
    queryKey: ['public-org-programs'],
    queryFn: () => apiClient.get('/programs/home/').then(r => toArray<HomeProgram>(r.data)).catch(() => null),
    staleTime: 1000 * 60 * 3,
  })
  const items = q.data ?? []
  const categories = useMemo(() => [...new Map(items.map(p => [p.category, p.category_display])).entries()], [items])
  const shown = category ? items.filter(p => p.category === category) : items

  return (
    <section id="org-programs" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <header className="mb-8">
        <p className="eyebrow mb-3">Youth Organization Programs</p>
        <h2 className="max-w-3xl font-display text-3xl font-extrabold tracking-tighter2 text-ink-900 sm:text-4xl lg:text-5xl">
          Programs open to every young person in Lucena.
        </h2>
        <p className="mt-3 max-w-2xl text-ink-600">Browse what youth organizations are running. No account needed to look.</p>
      </header>

      {categories.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter programs by category">
          {[[null, 'All'] as [string | null, string], ...categories].map(([key, label]) => (
            <button
              key={key ?? 'all'} type="button" aria-pressed={category === key} onClick={() => setCategory(key)}
              className={cn('rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                category === key ? 'border-primary-700 bg-primary-700 text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-primary-300 hover:text-primary-700')}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => <div key={i} className="h-72 animate-pulse rounded-2xl bg-ink-100" />)}
        </div>
      ) : q.data === null ? (
        <p className="rounded-2xl border border-ink-100 bg-white p-6 text-sm text-ink-600">Programs could not be loaded right now. Please try again in a moment.</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center">
          <Sparkles className="mx-auto mb-2 text-primary-400" size={28} />
          <p className="font-display text-lg font-bold text-ink-900">No programs are published yet.</p>
          <p className="mt-1 text-sm text-ink-600">Youth organizations add their programs here once they are approved. Please check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {shown.map(p => (
            <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lg">
              <div className="relative aspect-[16/9] bg-gradient-to-br from-primary-700 to-primary-500">
                {p.thumbnail_url
                  ? <img src={p.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  : <Building2 size={40} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/60" />}
                <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-primary-800">{p.category_display}</span>
                <span className={cn('absolute right-3 top-3 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', STATUS_STYLE[p.status] ?? STATUS_STYLE.completed)}>{p.status_display}</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-lg font-bold leading-snug text-ink-900">{p.title}</h3>
                {p.organization_name && <p className="mt-0.5 text-xs font-semibold text-primary-700">{p.organization_name}</p>}
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-600">{p.description}</p>
                <dl className="mt-3 space-y-1.5 text-xs text-ink-600">
                  <div className="flex items-start gap-2"><CalendarDays size={13} className="mt-0.5 shrink-0 text-ink-400" /><dd>{schedule(p)}</dd></div>
                  {p.location && <div className="flex items-start gap-2"><MapPin size={13} className="mt-0.5 shrink-0 text-ink-400" /><dd>{p.location}</dd></div>}
                  {p.target_beneficiaries && <div className="flex items-start gap-2"><Users size={13} className="mt-0.5 shrink-0 text-ink-400" /><dd className="line-clamp-1">{p.target_beneficiaries}</dd></div>}
                </dl>
                <button type="button" className="btn-secondary btn-sm mt-4 self-start" onClick={() => setOpen(p)}>View details</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpen(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-800">{open.category_display}</span>
                  <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', STATUS_STYLE[open.status] ?? STATUS_STYLE.completed)}>{open.status_display}</span>
                </div>
                <h3 className="font-display text-xl font-extrabold text-ink-900">{open.title}</h3>
                {open.organization_name && <p className="text-sm font-semibold text-primary-700">{open.organization_name}</p>}
              </div>
              <button type="button" aria-label="Close" className="rounded-lg p-1 text-ink-500 hover:bg-ink-100" onClick={() => setOpen(null)}><X size={18} /></button>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-ink-700">
              <div><p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-400">About the program</p><p className="whitespace-pre-line">{open.description}</p></div>
              {open.objectives && <div><p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-400"><Target size={12} /> Objectives</p><p className="whitespace-pre-line">{open.objectives}</p></div>}
              {open.target_beneficiaries && <div><p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-400"><Users size={12} /> Who it is for</p><p className="whitespace-pre-line">{open.target_beneficiaries}</p></div>}
              <div className="grid gap-3 rounded-xl bg-paper-50 p-4 sm:grid-cols-2">
                <div className="flex items-start gap-2"><CalendarDays size={15} className="mt-0.5 text-primary-600" /><div><p className="text-xs font-semibold text-ink-500">Schedule</p><p>{schedule(open)}</p></div></div>
                {(open.location || open.barangay) && <div className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 text-primary-600" /><div><p className="text-xs font-semibold text-ink-500">Where</p><p>{[open.location, open.barangay].filter(Boolean).join(', ')}</p></div></div>}
              </div>
              {(open.contact_person || open.contact_email || open.contact_phone) && (
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-400">Contact</p>
                  <ul className="space-y-1">
                    {open.contact_person && <li>{open.contact_person}</li>}
                    {open.contact_email && <li className="flex items-center gap-2"><Mail size={13} className="text-ink-400" /><a className="text-primary-700 underline" href={`mailto:${open.contact_email}`}>{open.contact_email}</a></li>}
                    {open.contact_phone && <li className="flex items-center gap-2"><Phone size={13} className="text-ink-400" />{open.contact_phone}</li>}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
