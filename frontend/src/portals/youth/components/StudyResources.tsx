import { BookOpen, ExternalLink } from 'lucide-react'

export interface StudyResource { title: string; url: string; source?: string }

/** Reading and study links for a lesson. They open in a new tab. */
export default function StudyResources({ items, heading = 'Study materials' }: { items: StudyResource[]; heading?: string }) {
  if (!items || items.length === 0) return null
  return (
    <section aria-label={heading} className="rounded-2xl border border-primary-100 bg-primary-50/40 p-4">
      <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold text-ink-900"><BookOpen size={16} className="text-primary-600" /> {heading}</h2>
      <ul className="space-y-1.5">
        {items.map(r => (
          <li key={r.url}>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-2 text-sm text-primary-800 hover:text-primary-900">
              <ExternalLink size={14} className="mt-0.5 shrink-0" />
              <span><span className="font-semibold underline-offset-2 group-hover:underline">{r.title}</span>{r.source ? <span className="text-ink-500"> ({r.source})</span> : null}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
