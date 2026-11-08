import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Newspaper, MapPin, Users } from 'lucide-react'
import apiClient from '@/api/client'
import { formatDate, cn, toArray } from '@/utils'
import { ListSkeleton } from '@/components/ui/Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// Same program slides shown in the home page carousel.
// These are the static fallback images used when the DB has no slides yet.
const PROGRAM_SLIDES = [
  {
    id: '1',
    image: '/images/activities/youth-training.jpg',
    tag: 'LYDO Program',
    title: 'Barangay-Level Youth Training & Orientation',
    description: 'Empowering youth across Lucena City barangays through skills training, rights awareness, and community engagement activities organized by LYDO.',
    organizer: 'Lucena City Youth Development Office',
  },
  {
    id: '2',
    image: '/images/activities/heritage-tour.jpg',
    tag: 'SK Activity',
    title: 'Heritage & Cultural Immersion Tour',
    description: 'SK youth leaders explore Lucena City history and culture through guided museum visits.',
    organizer: 'Sangguniang Kabataan Federation',
  },
  {
    id: '3',
    image: '/images/activities/palarong-pinoy.jpg',
    tag: 'Community Event',
    title: 'Palarong Pinoy — Car-Free Sunday',
    description: 'Celebrating Filipino traditional games every Car-Free Sunday on Quezon Avenue, in partnership with LYDO.',
    organizer: 'LYDO & City Government of Lucena',
  },
  {
    id: '4',
    image: '/images/activities/lydc-meeting-1.jpg',
    tag: 'LYDO Assembly',
    title: 'LYDC 4th Quarterly Meeting & LYORP General Assembly',
    description: 'City youth leaders gathered at Lucena City Government Complex for the quarterly LYDC meeting.',
    organizer: 'Lucena Youth Development Council',
  },
  {
    id: '5',
    image: '/images/activities/lydc-meeting-2.jpg',
    tag: 'LYDO Assembly',
    title: 'LYORP General Assembly cum Logo Making Contest',
    description: 'Youth organizations across Lucena City converged for the LYORP General Assembly, fostering collaboration and youth governance.',
    organizer: 'Lucena Youth Development Council',
  },
]

const POST_TYPE_LABELS: Record<string, string> = {
  news:           'News',
  update:         'Update',
  youth_info:     'Youth Info',
  local_event:    'Local Event',
  national_event: 'National Event',
}

// ─── News card ────────────────────────────────────────────────────────────────

function NewsCard({
  image,
  label,
  labelColor,
  title,
  excerpt,
  meta,
  to,
}: {
  image?: string
  label: string
  labelColor?: string
  title: string
  excerpt: string
  meta?: React.ReactNode
  to: string
}) {
  return (
    <Link
      to={to}
      className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      {/* Cover */}
      <div className="relative w-full overflow-hidden flex-shrink-0" style={{ aspectRatio: '4/3' }}>
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-700 to-primary-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <h3 className="absolute bottom-3 left-3 right-3 text-white font-bold text-sm leading-snug line-clamp-2 drop-shadow-md">
          {title}
        </h3>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        <span className={cn('text-[10px] font-bold uppercase tracking-wider mb-2', labelColor ?? 'text-primary-500')}>
          {label}
        </span>
        <p className="text-[13px] text-ink-600 leading-relaxed line-clamp-4 flex-1">
          {excerpt}
        </p>
        {meta && (
          <div className="mt-3 pt-3 border-t border-ink-100 text-[11px] text-ink-500">
            {meta}
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const postsQ = useQuery({
    queryKey: ['news-featured-posts'],
    queryFn: () =>
      apiClient.get('/events/featured-posts/')
        .then(r => toArray<FeaturedPost>(r.data))
        .catch(() => []),
  })

  const posts = postsQ.data ?? []
  const hasContent = posts.length > 0 || PROGRAM_SLIDES.length > 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">

      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Newspaper size={22} className="text-primary-700" /> News &amp; Updates
        </h1>
        <p className="page-subtitle">Latest happenings, announcements, and featured programs from LYDO</p>
      </div>

      {postsQ.isLoading ? (
        <ListSkeleton />
      ) : !hasContent ? (
        <div className="card p-16 text-center text-ink-500">
          <Newspaper size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold mb-1">No news yet</p>
          <p className="text-sm">Fresh updates coming soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          {/* News / featured posts */}
          {posts.map(post => (
            <NewsCard
              key={`post-${post.id}`}
              to={`/news/${post.id}`}
              image={post.thumbnail}
              label={POST_TYPE_LABELS[post.post_type] ?? post.post_type}
              title={post.title}
              excerpt={post.content}
              meta={
                post.source ? (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin size={9} /> {post.source}
                  </span>
                ) : post.date_of_event ? (
                  <span>{formatDate(post.date_of_event)}</span>
                ) : null
              }
            />
          ))}

          {/* Program slides — same photos as home page carousel */}
          {PROGRAM_SLIDES.map(slide => (
            <NewsCard
              key={slide.id}
              to={`/news-feed/${slide.id}`}
              image={slide.image}
              label={slide.tag}
              title={slide.title}
              excerpt={slide.description}
              meta={
                <span className="flex items-center gap-1 truncate">
                  <Users size={9} /> {slide.organizer}
                </span>
              }
            />
          ))}

        </div>
      )}
    </div>
  )
}
