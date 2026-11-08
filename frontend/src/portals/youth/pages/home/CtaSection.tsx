import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export function CtaSection() {
  // ── CTA ────────────────────────────────────────────────────────
  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-20">
      <div className="max-w-7xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 to-primary-800 text-white p-10 sm:p-14">
        <div aria-hidden className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full bg-accent-400/20 blur-2xl pointer-events-none" />
        <div aria-hidden className="absolute -top-12 -left-12 w-56 h-56 rounded-full bg-alert-400/15 blur-2xl pointer-events-none" />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8">
            <p className="eyebrow-on-dark mb-3">Get started</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tighter2 leading-[1.05] mb-4">
              Your seat at the table is ready.
            </h2>
            <p className="text-primary-100 text-lg leading-relaxed max-w-xl">
              Create a free LYDO account and get programs, events, and
              opportunities delivered right to your dashboard.
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-stretch">
            <Link to="/register" className="btn-accent text-base whitespace-nowrap">
              Create free account <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="btn-ghost-on-dark text-base whitespace-nowrap">
              I already have one
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
