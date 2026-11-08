import { FolderOpen, CalendarDays, BookOpen, MessageSquare, Briefcase, School, ArrowRight } from 'lucide-react'

const FEATURES = [
  { icon: FolderOpen,    title: 'Programs & Activities',  desc: 'Discover community programs and activities happening in your barangay and across Lucena.', to: '/programs' },
  { icon: CalendarDays,  title: 'Events Calendar',        desc: 'Workshops, seminars, town halls, and community events \u2014 all in one place.', to: '/calendar' },
  { icon: BookOpen,      title: 'Resource Library',       desc: 'Templates, laws, and plans every young Lucenahin should have access to.', to: '/resources' },
  { icon: MessageSquare, title: 'AI Assistant',           desc: 'Ask anything about youth rights, programs, and local services \u2014 answered instantly.', to: '/chatbot' },
  { icon: Briefcase,     title: 'Job Opportunities',      desc: 'Career openings and internships suited for young people across the city.', to: '/jobs' },
  { icon: School,        title: 'Schools & Education',    desc: 'Explore schools, courses, and pathways for continuing your education locally.', to: '/schools' },
]

export function FeaturesSection({ gated }: { gated: (dest: string) => () => void }) {
  // ── Features grid ────────────────────────────────────────────
  return (
    <section id="features" className="bg-white border-y border-ink-100 py-20 sm:py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center max-w-2xl mx-auto mb-14">
          <p className="eyebrow mb-3">What's inside</p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-ink-900 tracking-tighter2">
            Everything you need, all in one portal.
          </h2>
          <p className="text-ink-600 text-lg leading-relaxed mt-5">
            From scholarship deadlines to local events, from job posts to youth
            rights &mdash; built for the way young people actually use their phones.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, to }, i) => (
            <button
              key={title}
              onClick={gated(to)}
              className="reveal group bg-paper-50 hover:bg-primary-50 border border-ink-100 hover:border-primary-200 rounded-3xl p-7 transition-all duration-300 text-left hover:-translate-y-0.5 hover:shadow-md"
              style={{ ['--delay' as any]: `${Math.min(i * 60, 300)}ms` }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-600 group-hover:bg-primary-700 text-white mb-5 transition-colors">
                <Icon size={22} strokeWidth={2.2} />
              </div>
              <h3 className="font-display font-bold text-lg text-ink-900 mb-2 leading-tight">{title}</h3>
              <p className="text-sm text-ink-600 leading-relaxed">{desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 group-hover:gap-2 transition-all">
                Explore <ArrowRight size={12} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
