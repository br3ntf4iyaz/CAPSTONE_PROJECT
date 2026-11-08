import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { PageSpinner } from '@/components/ui/Spinner'
import type { FeaturedPost } from './types'

export function FeaturedPostsSection({ posts, isLoading }: { posts: FeaturedPost[]; isLoading: boolean }) {
  // ── Featured Posts ────────────────────────────────────────────
  return (
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

        {isLoading ? (
          <PageSpinner />
        ) : posts.length === 0 ? (
          <EmptyBlock>No posts yet &mdash; fresh updates coming soon.</EmptyBlock>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {posts.map((post, i) => {
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
  )
}

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl border border-ink-100 px-6 py-14 text-center">
      <p className="text-ink-500">{children}</p>
    </div>
  )
}
