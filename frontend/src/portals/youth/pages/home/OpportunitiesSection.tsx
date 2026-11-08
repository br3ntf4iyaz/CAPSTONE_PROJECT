import { Link } from 'react-router-dom'
import { Briefcase, School, ArrowRight, Award } from 'lucide-react'

export function OpportunitiesSection() {
  // ── Opportunities Finder (public, no login needed) ────────────
  return (
    <section id="opportunities" className="bg-white border-y border-ink-100 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10">
          <p className="eyebrow mb-3">Opportunities Finder</p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-ink-900 tracking-tighter2 max-w-2xl">
            Jobs, scholarships, and schools — all in one place.
          </h2>
          <p className="text-ink-600 mt-3 max-w-xl">
            Discover what's open to Lucena youth right now — no account needed to browse.
          </p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            {
              icon: Briefcase,
              title: 'Job Opportunities',
              desc: 'Government, NGO, and private sector jobs open to Lucena youth.',
              to: '/jobs',
              color: 'bg-primary-600',
            },
            {
              icon: Award,
              title: 'Scholarships',
              desc: 'City, national, and private scholarship grants — CHED, DOST, TESDA and more.',
              to: '/scholarships',
              color: 'bg-accent-500',
            },
            {
              icon: School,
              title: 'School Finder',
              desc: 'Compare colleges, programs, and admission paths around Lucena.',
              to: '/schools',
              color: 'bg-emerald-600',
            },
          ].map(({ icon: Icon, title, desc, to, color }) => (
            <Link
              key={title}
              to={to}
              className="group flex flex-col bg-paper-50 hover:bg-white border border-ink-100 hover:border-primary-200 hover:shadow-lg rounded-2xl p-6 transition-all duration-300"
            >
              <div className={`inline-flex w-12 h-12 rounded-xl ${color} text-white items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon size={22} />
              </div>
              <h3 className="font-bold text-base text-ink-900 mb-1.5">{title}</h3>
              <p className="text-sm text-ink-600 leading-relaxed flex-1">{desc}</p>
              <span className="mt-4 text-xs font-semibold text-primary-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                Browse now <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
