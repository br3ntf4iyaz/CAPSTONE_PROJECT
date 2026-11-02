import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FolderOpen, CalendarDays, BookOpen, MessageSquare,
  Briefcase, School, Clock, ArrowRight, Sparkles, MapPin,
  ChevronLeft, ChevronRight, Users, Pause, Play,
  Award, Bot, Building2, ClipboardList, Send,
  CheckCircle2, Star,
} from 'lucide-react'
import apiClient from '@/api/client'
import { formatDate, cn, toArray } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/authStore'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PublicEvent {
  id: number
  title: string
  description: string
  location: string
  start_datetime: string
  end_datetime: string
  is_featured: boolean
  registration_count: number
}

interface PublicSurvey {
  id: number
  title: string
  description: string
  is_active: boolean
  response_count: number
  questions: { id: number; question: string; question_type: string; order: number }[]
  created_at: string
}

interface FeaturedPost {
  id: number
  title: string
  content: string
  post_type: string
  thumbnail?: string
  source?: string
  date_of_event?: string
  is_published: boolean
  order: number
  created_at: string
}

// ─── Slide types ─────────────────────────────────────────────

/** Shape from the API (/programs/slides/) */
interface ApiSlide {
  id: number
  title: string
  description: string
  organizer: string
  tag_label: string
  tag_color: string
  image_url?: string
  is_active: boolean
  order: number
}

/** Internal shape used by ProgramSlider */
interface Slide {
  id: number
  image: string
  tag: string
  tagColor: string
  title: string
  description: string
  organizer: string
}

/** Static fallback slides (shown when API has no slides yet) */
const FALLBACK_SLIDES: Slide[] = [
  { id: 1, image: '/images/activities/youth-training.jpg', tag: 'LYDO Program', tagColor: 'bg-accent-400 text-white', title: 'Barangay-Level Youth Training & Orientation', description: 'Empowering youth across Lucena City barangays through skills training, rights awareness, and community engagement activities organized by LYDO.', organizer: 'Lucena City Youth Development Office' },
  { id: 2, image: '/images/activities/heritage-tour.jpg', tag: 'SK Activity', tagColor: 'bg-emerald-500 text-white', title: 'Heritage & Cultural Immersion Tour', description: 'SK youth leaders explore Lucena City history and culture through guided museum visits.', organizer: 'Sangguniang Kabataan Federation' },
  { id: 3, image: '/images/activities/palarong-pinoy.jpg', tag: 'Community Event', tagColor: 'bg-amber-500 text-white', title: 'Palarong Pinoy \u2014 Car-Free Sunday', description: 'Celebrating Filipino traditional games every Car-Free Sunday on Quezon Avenue, in partnership with LYDO.', organizer: 'LYDO & City Government of Lucena' },
  { id: 4, image: '/images/activities/lydc-meeting-1.jpg', tag: 'LYDO Assembly', tagColor: 'bg-primary text-white', title: 'LYDC 4th Quarterly Meeting & LYORP General Assembly', description: 'City youth leaders gathered at Lucena City Government Complex for the quarterly LYDC meeting.', organizer: 'Lucena Youth Development Council' },
  { id: 5, image: '/images/activities/lydc-meeting-2.jpg', tag: 'LYDO Assembly', tagColor: 'bg-primary text-white', title: 'LYORP General Assembly cum Logo Making Contest', description: 'Youth organizations across Lucena City converged for the LYORP General Assembly, fostering collaboration and youth governance.', organizer: 'Lucena Youth Development Council' },
]

function apiSlidesToSlides(apiSlides: ApiSlide[]): Slide[] {
  return apiSlides.map(s => ({
    id: s.id,
    image: s.image_url ?? '',
    tag: s.tag_label,
    tagColor: s.tag_color,
    title: s.title,
    description: s.description,
    organizer: s.organizer,
  }))
}

const POST_TYPE_LABELS: Record<string, string> = {
  news: 'News',
  update: 'Update',
  youth_info: 'Youth Info',
  local_event: 'Local Event',
  national_event: 'National Event',
}

const FEATURES = [
  { icon: FolderOpen,    title: 'Programs & Activities',  desc: 'Discover community programs and activities happening in your barangay and across Lucena.', to: '/programs' },
  { icon: CalendarDays,  title: 'Events Calendar',        desc: 'Workshops, seminars, town halls, and community events \u2014 all in one place.', to: '/calendar' },
  { icon: BookOpen,      title: 'Resource Library',       desc: 'Templates, laws, and plans every young Lucenahin should have access to.', to: '/resources' },
  { icon: MessageSquare, title: 'AI Assistant',           desc: 'Ask anything about youth rights, programs, and local services \u2014 answered instantly.', to: '/chatbot' },
  { icon: Briefcase,     title: 'Job Opportunities',      desc: 'Career openings and internships suited for young people across the city.', to: '/jobs' },
  { icon: School,        title: 'Schools & Education',    desc: 'Explore schools, courses, and pathways for continuing your education locally.', to: '/schools' },
]

// ─── Program Slider ───────────────────────────────────────────────────────────

function ProgramSlider({
  slides,
  current,
  setCurrent,
}: {
  slides: Slide[]
  current: number
  setCurrent: (i: number) => void
}) {
  const [paused, setPaused] = useState(false)
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const total = slides.length

  const next = useCallback(() => setCurrent((current + 1) % total), [current, total, setCurrent])
  const prev = useCallback(() => setCurrent((current - 1 + total) % total), [current, total, setCurrent])

  // Auto-advance
  useEffect(() => {
    if (paused) return
    timerRef.current = setInterval(next, 5000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [paused, next])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  const slide = slides[current]

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl shadow-xl"
      style={{ height: 'clamp(340px, 55vw, 620px)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          aria-hidden={i !== current}
          className={cn(
            'absolute inset-0 transition-opacity duration-700',
            i === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
          )}
        >
          {/* Background image or gradient fallback */}
          {!imgErrors[s.id] ? (
            <img
              src={s.image}
              alt={s.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setImgErrors(prev => ({ ...prev, [s.id]: true }))}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900" />
          )}

          {/* Gradient overlay &mdash; bottom heavy so text is readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
        </div>
      ))}

      {/* Text content */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-6 sm:px-10 pb-8 sm:pb-10 max-w-2xl">
        <span className={cn('inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3', slide.tagColor)}>
          {slide.tag}
        </span>
        <h3 className="text-white font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl leading-tight mb-2 drop-shadow-md">
          {slide.title}
        </h3>
        <p className="text-white/80 text-sm sm:text-base leading-relaxed line-clamp-2 sm:line-clamp-3 mb-3 drop-shadow">
          {slide.description}
        </p>
        <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">
          {slide.organizer}
        </p>
      </div>

      {/* Prev / Next buttons */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110"
      >
        <ChevronRight size={20} />
      </button>

      {/* Pause / Play */}
      <button
        onClick={() => setPaused(p => !p)}
        aria-label={paused ? 'Resume slideshow' : 'Pause slideshow'}
        className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 transition-all"
      >
        {paused ? <Play size={13} fill="currentColor" /> : <Pause size={13} />}
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-4 right-6 z-30 flex items-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              'rounded-full transition-all duration-300',
              i === current
                ? 'w-6 h-2 bg-white'
                : 'w-2 h-2 bg-white/50 hover:bg-white/70'
            )}
          />
        ))}
      </div>

      {/* Slide counter */}
      <div className="absolute top-4 left-4 z-30 text-white/70 text-xs font-bold tabular-nums">
        {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>

      {/* Progress bar */}
      {!paused && (
        <div className="absolute bottom-0 left-0 right-0 z-30 h-0.5 bg-white/20">
          <div
            key={current}
            className="h-full bg-white origin-left"
            style={{ animation: 'slideProgress 5s linear forwards' }}
          />
        </div>
      )}

      <style>{`
        @keyframes slideProgress {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function YouthHomePage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  // Gate: if not logged in, redirect to login with intended destination
  const gated = (dest: string) => () => {
    if (isAuthenticated) navigate(dest)
    else navigate(`/login?next=${dest}`)
  }

  const featuredPostsQ = useQuery({
    queryKey: ['public-featured-posts'],
    queryFn: () =>
      apiClient.get('/events/featured-posts/')
        .then(r => toArray<FeaturedPost>(r.data))
        .catch(() => []),
  })

  const publicEventsQ = useQuery({
    queryKey: ['public-events-home'],
    queryFn: () =>
      apiClient.get('/events/?ordering=start_datetime')
        .then(r => toArray<PublicEvent>(r.data).slice(0, 4))
        .catch(() => []),
  })

  const publicSurveysQ = useQuery({
    queryKey: ['public-surveys-home'],
    queryFn: () =>
      apiClient.get('/events/surveys/')
        .then(r => toArray<PublicSurvey>(r.data).filter(s => s.is_active).slice(0, 3))
        .catch(() => []),
  })

  const featuredSlidesQ = useQuery({
    queryKey: ['public-featured-slides'],
    queryFn: () =>
      apiClient.get('/programs/slides/')
        .then(r => toArray<ApiSlide>(r.data))
        .catch(() => []),
  })

  const statsQ = useQuery<{ registered_youth: number; barangay_sk_councils: number; youth_organizations: number; active_jobs: number }>({
    queryKey: ['public-stats'],
    queryFn: () => apiClient.get('/auth/stats/').then(r => r.data).catch(() => null),
    staleTime: 1000 * 60 * 10,
  })

  const slides: Slide[] = featuredSlidesQ.data && featuredSlidesQ.data.length > 0
    ? apiSlidesToSlides(featuredSlidesQ.data)
    : FALLBACK_SLIDES

  const [sliderCurrent, setSliderCurrent] = useState(0)

  const featuredPosts = featuredPostsQ.data ?? []

  // ── Hero background slideshow ──────────────────────────────────────────────
  const HERO_IMAGES = [
    '/images/activities/hero-youth-1.jpg',
    '/images/activities/hero-youth-2.jpg',
  ]
  const [heroIdx, setHeroIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO_IMAGES.length), 8000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-paper-50">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* Hero background slideshow — crossfade + Ken Burns zoom */}
        {HERO_IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
            style={{
              opacity: i === heroIdx ? 1 : 0,
              transition: 'opacity 1.8s ease-in-out',
              animation: i === heroIdx ? 'heroZoom 16s ease-out forwards' : 'none',
              transform: i === heroIdx ? undefined : 'scale(1)',
            }}
          />
        ))}
        {/* Ken Burns keyframe */}
        <style>{`
          @keyframes heroZoom {
            from { transform: scale(1.08); }
            to   { transform: scale(1.0); }
          }
        `}</style>
        {/* Dark gradient overlay — keeps text readable */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/80 via-primary-800/75 to-primary-900/85 pointer-events-none" />
        {/* Decorative dotted grid */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div aria-hidden className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-accent-400/15 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 sm:pt-20 sm:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <div>
              <div
                className="reveal inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-[12px] font-semibold mb-6"
                style={{ ['--delay' as any]: '0ms' }}
              >
                <Sparkles size={14} className="text-accent-300" />
                <span>Lucena City Youth Development Office</span>
              </div>

              <h1
                className="reveal font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-tighter2 mb-6"
                style={{ ['--delay' as any]: '120ms' }}
              >
                Built for{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-accent-300">young Lucenahins</span>
                  <span className="absolute left-0 right-0 bottom-1 h-3 bg-accent-400/30 rounded-sm -z-0" />
                </span>
                <br />
                ready to lead.
              </h1>

              <p
                className="reveal max-w-xl mx-auto text-primary-100 text-lg leading-relaxed mb-10"
                style={{ ['--delay' as any]: '240ms' }}
              >
                Programs, events, scholarships, and opportunities &mdash; curated by the
                LYDO for every barangay and every young person in the city.
              </p>

              <div
                className="reveal flex flex-col sm:flex-row gap-3 justify-center"
                style={{ ['--delay' as any]: '360ms' }}
              >
                {isAuthenticated ? (
                  <Link to="/dashboard" className="btn-accent text-base">
                    Go to my dashboard <ArrowRight size={16} />
                  </Link>
                ) : (
                  <Link to="/register" className="btn-accent text-base">
                    Create your account <ArrowRight size={16} />
                  </Link>
                )}
                <a href="#features" className="btn-ghost-on-dark text-base">
                  Explore the platform
                </a>
              </div>

              {/* Social proof stats strip */}
              <div
                className="reveal flex flex-wrap justify-center gap-6 mt-10 pt-8 border-t border-white/10"
                style={{ ['--delay' as any]: '480ms' }}
              >
                {[
                  { value: statsQ.data?.registered_youth != null ? `${statsQ.data.registered_youth.toLocaleString()}+` : '2,000+', label: 'Registered youth' },
                  { value: statsQ.data?.barangay_sk_councils != null ? `${statsQ.data.barangay_sk_councils}` : '40+',                  label: 'Barangay SK councils' },
                  { value: statsQ.data?.youth_organizations != null ? `${statsQ.data.youth_organizations}+` : '50+',                  label: 'Youth organizations' },
                  { value: statsQ.data?.active_jobs != null ? `${statsQ.data.active_jobs}` : '30+',                           label: 'Open jobs' },
                ].map(({ value, label }) => (
                  <div key={label} className="text-center">
                    <p className="font-display font-extrabold text-2xl text-accent-300 leading-none">{value}</p>
                    <p className="text-xs text-primary-200 mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom curve */}
        <svg className="absolute bottom-0 left-0 right-0 w-full text-paper-50" viewBox="0 0 1440 60" fill="currentColor" preserveAspectRatio="none" aria-hidden>
          <path d="M0,60 L0,30 Q360,0 720,30 T1440,30 L1440,60 Z" />
        </svg>
      </section>

      {/* ── Activities Slider ─────────────────────────────────────────── */}
      <section id="community" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="eyebrow mb-3">Programs &amp; Activities</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-ink-900 tracking-tighter2 max-w-2xl">
              Programs that made moves this season.
            </h2>
          </div>
          <Link to="/programs" className="btn-secondary self-start sm:self-end whitespace-nowrap">
            See all programs <ArrowRight size={16} />
          </Link>
        </header>

        <ProgramSlider slides={slides} current={sliderCurrent} setCurrent={setSliderCurrent} />

        {/* Thumbnail strip — clicking navigates the slider */}
        <div className="mt-4 grid grid-cols-5 gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSliderCurrent(i)}
              aria-label={`Go to slide: ${s.title}`}
              className={cn(
                'relative rounded-xl overflow-hidden aspect-video border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                i === sliderCurrent
                  ? 'border-primary-500 opacity-100 scale-[1.03] shadow-md'
                  : 'border-transparent opacity-55 hover:opacity-80 hover:border-primary-300',
              )}
            >
              <img
                src={s.image}
                alt=""
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-primary-700/50 to-primary-900/50" />
              <span className="absolute bottom-1 left-1 right-1 text-white text-[9px] font-semibold leading-tight line-clamp-1 drop-shadow">
                {s.title}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Featured Posts ──────────────────────────────────────────── */}
      <section className="bg-paper-50 border-y border-ink-100 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <header className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[0.3em] uppercase text-primary-500 mb-3">
              Latest from LYDO
            </p>
            <h2 className="font-display font-extrabold text-xl sm:text-2xl lg:text-3xl text-ink-900 tracking-[0.12em] uppercase">
              Stay informed with the latest happenings at LYDO
            </h2>
          </header>

          {featuredPostsQ.isLoading ? (
            <PageSpinner />
          ) : featuredPosts.length === 0 ? (
            <EmptyBlock>No posts yet &mdash; fresh updates coming soon.</EmptyBlock>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {featuredPosts.map((post, i) => {
                  const dateObj = post.date_of_event ? new Date(post.date_of_event) : null
                  const monthStr = dateObj
                    ? dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase()
                    : null
                  const dayNum = dateObj ? dateObj.getDate() : null

                  return (
                    <Link
                      key={post.id}
                      to={`/news/${post.id}`}
                      className="reveal group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
                      style={{ ['--delay' as any]: `${Math.min(i * 60, 300)}ms` }}
                    >
                      {/* ── Image block ── */}
                      <div
                        className="relative w-full overflow-hidden bg-primary-800 flex-shrink-0"
                        style={{ aspectRatio: '4/3' }}
                      >
                        {post.thumbnail ? (
                          <img
                            src={post.thumbnail}
                            alt={post.title}
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-primary-700 to-primary-900" />
                        )}

                        {/* Bottom scrim so text stays legible */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

                        {/* Date badge — bottom left */}
                        {dateObj && (
                          <div className="absolute bottom-3 left-3 bg-primary-600 text-white text-center px-2.5 py-1.5 leading-none">
                            <span className="block text-[9px] font-extrabold tracking-widest uppercase">
                              {monthStr}
                            </span>
                            <span className="block text-[22px] font-extrabold leading-tight tabular-nums">
                              {dayNum}
                            </span>
                          </div>
                        )}

                        {/* Title overlaid on image */}
                        <h3
                          className="absolute bottom-3 right-3 text-white font-bold text-sm leading-snug line-clamp-2 drop-shadow-md"
                          style={{ left: dateObj ? '4.5rem' : '0.75rem' }}
                        >
                          {post.title}
                        </h3>
                      </div>

                      {/* ── Excerpt ── */}
                      <div className="p-4 flex-1 flex flex-col">
                        <p className="text-[13px] text-ink-600 leading-relaxed line-clamp-4 flex-1">
                          {post.content}
                        </p>
                        {post.source && (
                          <p className="mt-3 pt-3 border-t border-ink-100 text-[11px] font-semibold text-ink-500 truncate flex items-center gap-1.5">
                            <MapPin size={10} /> {post.source}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* Browse all button */}
              <div className="flex justify-center mt-10">
                <Link
                  to="/news"
                  className="inline-flex items-center gap-2 px-10 py-3 rounded-full border-2 border-primary-600 text-primary-600 font-bold text-[11px] tracking-[0.25em] uppercase hover:bg-primary-600 hover:text-white transition-all duration-200"
                >
                  Browse All News
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Features grid ──────────────────────────────────────────── */}
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


      {/* ── Opportunities Finder (public, no login needed) ──────────── */}
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

      {/* ── Upcoming Events ────────────────────────────────────────────── */}
      <section id="events" className="bg-paper-50 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div>
              <p className="eyebrow mb-3">Events Calendar</p>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-ink-900 tracking-tighter2">
                Upcoming events in Lucena City.
              </h2>
              <p className="text-ink-600 mt-2 max-w-lg">
                Browse what's coming up — sign in to register your spot.
              </p>
            </div>
            <button
              onClick={gated('/calendar')}
              className="btn-secondary self-start sm:self-end whitespace-nowrap"
            >
              View full calendar <ArrowRight size={16} />
            </button>
          </header>

          {publicEventsQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-40 rounded-2xl bg-ink-100/50 animate-pulse" />
              ))}
            </div>
          ) : publicEventsQ.data && publicEventsQ.data.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {publicEventsQ.data.map(evt => {
                const dt = new Date(evt.start_datetime)
                const mon = dt.toLocaleString('en-US', { month: 'short' }).toUpperCase()
                const day = dt.getDate()
                return (
                  <div key={evt.id} className="bg-white border border-ink-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                    {/* Date strip */}
                    <div className="bg-primary-600 text-white text-center py-3">
                      <span className="block text-[10px] font-extrabold tracking-widest">{mon}</span>
                      <span className="block text-3xl font-extrabold leading-tight tabular-nums">{day}</span>
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                      <div>
                        <h3 className="font-bold text-sm text-ink-900 leading-snug line-clamp-2 group-hover:text-primary-700 transition-colors">
                          {evt.title}
                        </h3>
                        {evt.location && (
                          <p className="flex items-center gap-1 text-[11px] text-ink-500 mt-1">
                            <MapPin size={10} /> {evt.location}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-[11px] text-ink-400 flex items-center gap-1">
                          <Users size={10} /> {evt.registration_count} joined
                        </span>
                        <button
                          onClick={gated('/calendar')}
                          className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-0.5 transition-colors"
                        >
                          Register <ArrowRight size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-ink-100 p-10 text-center">
              <CalendarDays size={36} className="text-ink-300 mx-auto mb-3" />
              <p className="text-ink-500 text-sm">No upcoming events right now — check back soon.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Resources ─────────────────────────────────────────────────── */}
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

      {/* ── Surveys ────────────────────────────────────────────────────── */}
      <section id="participate" className="bg-white border-y border-ink-100 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div>
              <p className="eyebrow mb-3">Participate</p>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-ink-900 tracking-tighter2">
                Active surveys from LYDO.
              </h2>
              <p className="text-ink-600 mt-2 max-w-lg">
                Read what's being asked — sign in to submit your response.
              </p>
            </div>
            <button
              onClick={gated('/surveys')}
              className="btn-secondary self-start sm:self-end whitespace-nowrap"
            >
              All surveys <ArrowRight size={16} />
            </button>
          </header>

          {publicSurveysQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl bg-ink-100/50 animate-pulse" />)}
            </div>
          ) : publicSurveysQ.data && publicSurveysQ.data.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {publicSurveysQ.data.map(survey => (
                <div key={survey.id} className="bg-paper-50 hover:bg-white border border-ink-100 hover:border-primary-200 hover:shadow-md rounded-2xl p-6 transition-all group flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <ClipboardList size={18} className="text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-ink-900 leading-snug group-hover:text-primary-700 transition-colors">
                        {survey.title}
                      </h3>
                      {survey.description && (
                        <p className="text-xs text-ink-500 mt-1 line-clamp-2">{survey.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Preview first 2 questions */}
                  {survey.questions.length > 0 && (
                    <ol className="space-y-1.5 pl-0">
                      {survey.questions.slice(0, 2).map((q, qi) => (
                        <li key={q.id} className="flex items-start gap-2 text-xs text-ink-600">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-[9px] mt-0.5">
                            {qi + 1}
                          </span>
                          <span className="line-clamp-1">{q.question}</span>
                        </li>
                      ))}
                      {survey.questions.length > 2 && (
                        <li className="text-[11px] text-ink-400 pl-6">
                          +{survey.questions.length - 2} more question{survey.questions.length - 2 !== 1 ? 's' : ''}
                        </li>
                      )}
                    </ol>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-ink-100">
                    <div className="flex items-center gap-3 text-xs text-ink-400">
                      <span>{survey.questions.length} questions</span>
                      <span className="flex items-center gap-1"><Users size={10} /> {survey.response_count}</span>
                    </div>
                    <Link
                      to={`/surveys/${survey.id}`}
                      className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-0.5 transition-colors"
                    >
                      See questions <ArrowRight size={11} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-paper-50 rounded-2xl border border-ink-100 p-10 text-center">
              <ClipboardList size={36} className="text-ink-300 mx-auto mb-3" />
              <p className="text-ink-500 text-sm">No active surveys right now — check back soon.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── AI Chatbot ─────────────────────────────────────────────────── */}
      <section className="bg-paper-50 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Left: copy */}
            <div>
              <p className="eyebrow mb-3">AI Youth Assistant</p>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-ink-900 tracking-tighter2 mb-4">
                Ask anything about<br />youth services in Lucena.
              </h2>
              <p className="text-ink-600 leading-relaxed mb-6">
                Scholarships, SK governance, youth rights, program requirements — our AI assistant knows Lucena City's youth ecosystem and answers instantly.
              </p>
              <button
                onClick={gated('/chatbot')}
                className="btn-primary"
              >
                <Bot size={16} /> Start chatting
              </button>
            </div>

            {/* Right: interactive chat preview */}
            <div className="bg-white rounded-2xl border border-ink-100 shadow-lg overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-primary-600 text-white">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold">LYDO AI Assistant</p>
                  <p className="text-[10px] text-primary-200">Powered by AI · Youth expertise</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-primary-200">Online</span>
                </div>
              </div>

              {/* Chat messages */}
              <div className="p-4 space-y-3 min-h-[200px]">
                {[
                  { from: 'user', text: 'What scholarships are available for college students in Lucena?' },
                  { from: 'ai', text: 'Great question! There are several scholarships available for Lucena City youth, including the City Government Scholarship, CHED UniFAST, and DOST-SEI. Would you like details on requirements for any of these?' },
                  { from: 'user', text: 'What are the SK chairperson requirements?' },
                ].map((msg, i) => (
                  <div key={i} className={cn('flex', msg.from === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed',
                      msg.from === 'user'
                        ? 'bg-primary-600 text-white rounded-br-sm'
                        : 'bg-ink-50 text-ink-800 rounded-bl-sm'
                    )}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {/* Typing indicator */}
                <div className="flex justify-start">
                  <div className="bg-ink-50 px-4 py-3 rounded-xl rounded-bl-sm flex items-center gap-1">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-ink-300 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Input bar — clicking redirects to login */}
              <div className="border-t border-ink-100 p-3">
                <button
                  onClick={gated('/chatbot')}
                  className="w-full flex items-center gap-3 bg-ink-50 hover:bg-primary-50 border border-ink-200 hover:border-primary-300 rounded-xl px-4 py-3 text-left transition-all group"
                >
                  <span className="flex-1 text-sm text-ink-400 group-hover:text-ink-600">
                    Ask about youth programs, scholarships, events…
                  </span>
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">
                    <Send size={14} />
                  </span>
                </button>
                <p className="text-center text-[11px] text-ink-400 mt-2">
                  <button onClick={gated('/chatbot')} className="text-primary-600 font-semibold hover:underline">Sign in</button> or <Link to="/register" className="text-primary-600 font-semibold hover:underline">create a free account</Link> to start chatting
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
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
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl border border-ink-100 px-6 py-14 text-center">
      <p className="text-ink-500">{children}</p>
    </div>
  )
}

