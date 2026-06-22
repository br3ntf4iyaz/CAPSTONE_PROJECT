import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'

// ─── Types ───────────────────────────────────────────────────────────────────

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

const POST_TYPE_LABELS: Record<string, string> = {
  news:            'News',
  update:          'Update',
  youth_info:      'Youth Info',
  local_event:     'Local Event',
  national_event:  'National Event',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewsDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: post, isLoading, isError } = useQuery<FeaturedPost>({
    queryKey: ['featured-post', id],
    queryFn: () =>
      apiClient.get(`/events/featured-posts/${id}/`).then(r => r.data),
    enabled: !!id,
  })

  if (isLoading) return <PageSpinner />

  if (isError || !post) {
    return (
      <div className="min-h-screen bg-paper-50 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-ink-500 text-lg">Post not found.</p>
        <Link to="/" className="btn-secondary">
          <ArrowLeft size={16} /> Back to home
        </Link>
      </div>
    )
  }

  const dateObj = post.date_of_event ? new Date(post.date_of_event) : null
  const formattedDate = dateObj
    ? dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  // Split content into paragraphs on double-newline
  const paragraphs = post.content
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)

  return (
    <div className="min-h-screen bg-paper-50">

      {/* ── Hero image ─────────────────────────────────────────────────────── */}
      {post.thumbnail && (
        <div className="relative w-full bg-primary-900 overflow-hidden" style={{ maxHeight: '480px' }}>
          <img
            src={post.thumbnail}
            alt={post.title}
            className="w-full object-cover object-center"
            style={{ maxHeight: '480px' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>
      )}

      {/* ── Article ────────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-800 mb-8 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>

        {/* Type badge */}
        <div className="mb-4">
          <span className="inline-block text-[11px] font-bold tracking-[0.2em] uppercase text-primary-600 bg-primary-50 border border-primary-200 px-3 py-1 rounded-full">
            {POST_TYPE_LABELS[post.post_type] ?? post.post_type}
          </span>
        </div>

        {/* Title */}
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-ink-900 leading-snug tracking-tight mb-5">
          {post.title}
        </h1>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-ink-500 mb-8 pb-8 border-b border-ink-100">
          {formattedDate && (
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} />
              {formattedDate}
            </span>
          )}
          {post.source && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              {post.source}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="prose prose-ink max-w-none">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-ink-700 text-base leading-relaxed mb-5 last:mb-0">
              {para}
            </p>
          ))}
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-ink-100">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-800 transition-colors"
          >
            <ArrowLeft size={15} />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
