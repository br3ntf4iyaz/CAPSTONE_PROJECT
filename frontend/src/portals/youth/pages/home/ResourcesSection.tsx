import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/utils'

export function ResourcesSection() {
  // ── Resources ───────────────────────────────────────────────────
  return (
    <section id="resources" className="bg-white border-y border-ink-100 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <p className="eyebrow mb-3">Resource Library</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-ink-900 tracking-tighter2">
              Everything a young Lucenahin should have.
            </h2>
            <p className="text-ink-600 mt-2 max-w-lg">
              Laws, governance guides, templates, and health resources — free to browse.
            </p>
          </div>
          <Link to="/resources" className="btn-secondary self-start sm:self-end whitespace-nowrap">
            Browse library <ArrowRight size={16} />
          </Link>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Laws & Acts',   color: 'bg-primary-50  border-primary-200 text-primary-700',  emoji: '⚖️' },
            { label: 'Governance',    color: 'bg-indigo-50   border-indigo-200  text-indigo-700',   emoji: '🏛️' },
            { label: 'Education',     color: 'bg-emerald-50  border-emerald-200 text-emerald-700',  emoji: '🎓' },
            { label: 'Health',        color: 'bg-rose-50     border-rose-200    text-rose-700',     emoji: '❤️' },
            { label: 'Leadership',    color: 'bg-amber-50    border-amber-200   text-amber-700',    emoji: '🌟' },
            { label: 'Financial',     color: 'bg-teal-50     border-teal-200    text-teal-700',     emoji: '💡' },
          ].map(({ label, color, emoji }) => (
            <Link
              key={label}
              to="/resources"
              className={cn(
                'flex flex-col items-center gap-3 p-5 rounded-2xl border text-center font-semibold text-sm hover:shadow-md hover:-translate-y-0.5 transition-all',
                color,
              )}
            >
              <span className="text-3xl">{emoji}</span>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
