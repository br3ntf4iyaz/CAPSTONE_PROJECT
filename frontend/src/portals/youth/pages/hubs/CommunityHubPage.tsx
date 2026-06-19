import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import {
  Users, Building2, ArrowRight, MapPin, CheckCircle2,
  TrendingUp, Shield,
} from 'lucide-react'
import apiClient from '@/api/client'
import { communityApi } from '@/api/community'
import type { CommunityPost, CommunityPostPage } from '@/api/community'
import { useAuthStore } from '@/store/authStore'
import { cn, toArray } from '@/utils'

interface YouthOrg {
  id: number
  name: string
  classification: string
  barangay: string
  is_compliant: boolean
  logo_url: string | null
}

interface SKBarangay {
  id: number
  barangay_name: string
  submitted_count: number
  pending_count: number
  overdue_count: number
}

const CLASS_COLORS: Record<string, string> = {
  school_based:    'bg-blue-100 text-blue-800',
  community_based: 'bg-green-100 text-green-800',
  faith_based:     'bg-purple-100 text-purple-800',
}
const CLASS_LABELS: Record<string, string> = {
  school_based:    'School-Based',
  community_based: 'Community-Based',
  faith_based:     'Faith-Based',
}

export default function CommunityHubPage() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  const [postContent, setPostContent] = useState('')
  const [postImage, setPostImage] = useState<File | null>(null)
  const [showPostForm, setShowPostForm] = useState(false)
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data: orgs = [] } = useQuery<YouthOrg[]>({
    queryKey: ['community-hub-orgs'],
    queryFn: () => apiClient.get('/youth-orgs/').then(r => toArray<YouthOrg>(r.data)).catch(() => []),
  })

  const { data: barangays = [] } = useQuery<SKBarangay[]>({
    queryKey: ['community-hub-sk'],
    queryFn: () => apiClient.get('/sk-requirements/barangays/').then(r => toArray<SKBarangay>(r.data)).catch(() => []),
  })

  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<CommunityPostPage>({
    queryKey: ['community-posts', selectedBarangay],
    queryFn: ({ pageParam }) =>
      communityApi.list(pageParam as number, selectedBarangay ?? undefined),
    getNextPageParam: (last, pages) => last.next ? pages.length + 1 : undefined,
    initialPageParam: 1,
  })

  const posts = postsData?.pages.flatMap(p => p.results) ?? []

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage() },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const createPostMutation = useMutation({
    mutationFn: (data: FormData | { content: string }) => communityApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-posts'] }),
  })

  const deletePostMutation = useMutation({
    mutationFn: (id: number) => communityApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-posts'] }),
  })

  const visibleOrgs = orgs.filter(o => o.classification !== 'sk_council')
  const featuredOrgs = visibleOrgs.filter(o => o.is_compliant).slice(0, 3)
  const previewOrgs = featuredOrgs.length > 0 ? featuredOrgs : visibleOrgs.slice(0, 3)

  const totalSubmitted = barangays.reduce((s, b) => s + b.submitted_count, 0)
  const totalReqs = barangays.reduce((s, b) => s + b.submitted_count + b.pending_count + b.overdue_count, 0)
  const avgCompliance = totalReqs > 0 ? Math.round((totalSubmitted / totalReqs) * 100) : null

  const canPost =
    auth.user?.is_email_verified ||
    auth.user?.role === 'lgu_admin' ||
    auth.user?.role === 'super_admin'

  return (
    <div className="space-y-10 pb-12">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-8 sm:p-10">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div aria-hidden className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-accent-400/20 blur-2xl pointer-events-none" />
        <div className="relative max-w-2xl">
          <p className="eyebrow-on-dark mb-3">Community</p>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tighter2 leading-[1.05] mb-4">
            Find your people in Lucena.
          </h1>
          <p className="text-primary-100 text-lg leading-relaxed mb-6">
            The Sangguniang Kabataan is your barangay's youth voice. Recognized youth orgs run programs across the city. Discover both, join in, and reach out.
          </p>
          {/* Live stats */}
          <div className="flex flex-wrap gap-4 text-sm">
            {visibleOrgs.length > 0 && (
              <span className="flex items-center gap-1.5 text-white/80">
                <Building2 size={14} className="text-accent-300" />
                <span className="font-bold text-white">{visibleOrgs.length}</span> youth organizations
              </span>
            )}
            {barangays.length > 0 && (
              <span className="flex items-center gap-1.5 text-white/80">
                <Users size={14} className="text-accent-300" />
                <span className="font-bold text-white">{barangays.length}</span> SK barangays
              </span>
            )}
            {avgCompliance !== null && (
              <span className="flex items-center gap-1.5 text-white/80">
                <Shield size={14} className="text-accent-300" />
                <span className="font-bold text-white">{avgCompliance}%</span> avg. SK compliance
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Hub cards ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="section-title mb-5">Explore</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <HubCard
            title="SK Directory"
            description="Find your barangay's Sangguniang Kabataan officials and view their programs, projects, and activities."
            icon={Users}
            to="/sk-directory"
            accent="primary"
            badge={barangays.length > 0 ? `${barangays.length} barangays` : undefined}
            samples={['SK Chairpersons & contacts', 'Compliance status by barangay', 'Events & deadlines calendar']}
          />
          <HubCard
            title="Youth Organizations"
            description="Browse recognized youth organizations across Lucena. See what they do, join, or send an inquiry."
            icon={Building2}
            to="/organizations"
            accent="accent"
            badge={visibleOrgs.length > 0 ? `${visibleOrgs.length} organizations` : undefined}
            samples={['School-, community- & faith-based orgs', 'Activities & accomplishments', 'Register your own organization']}
          />
        </div>
      </section>

      {/* ── Featured orgs preview ────────────────────────────────────────── */}
      {previewOrgs.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <h2 className="section-title !mb-0 flex items-center gap-2">
                <TrendingUp size={16} className="text-primary-700" /> Active Organizations
              </h2>
              <p className="text-xs text-ink-500 mt-1">Tap any card to see details and contact info</p>
            </div>
            <Link to="/organizations" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1 flex-shrink-0">
              All orgs <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {previewOrgs.map(org => <OrgPreviewCard key={org.id} org={org} />)}
          </div>
        </section>
      )}

      {/* ── Top compliant barangays ──────────────────────────────────────── */}
      {barangays.length > 0 && (
        <section>
          <div className="card p-4">
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Top Compliant Barangays</p>
            <div className="space-y-2">
              {[...barangays]
                .map(b => {
                  const total = b.submitted_count + b.pending_count + b.overdue_count
                  return { ...b, pct: total > 0 ? Math.round((b.submitted_count / total) * 100) : 0 }
                })
                .sort((a, b) => b.pct - a.pct)
                .slice(0, 5)
                .map((b, index) => {
                  const BAR_COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#db2777','#0284c7','#16a34a','#ca8a04']
                  const color = BAR_COLORS[index % BAR_COLORS.length]
                  return (
                    <div key={b.id} className="flex items-center gap-3">
                      <span className="text-xs text-ink-700 w-36 truncate font-medium">{b.barangay_name}</span>
                      <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${b.pct}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-xs font-bold text-ink-700 w-9 text-right">{b.pct}%</span>
                    </div>
                  )
                })}
            </div>
          </div>
        </section>
      )}

      {/* ── Community Feed ───────────────────────────────────────────────── */}
      <section>
        <h2 className="section-title mb-5">Community Feed</h2>
        <div className="space-y-4">

          {/* Post creation form */}
          {canPost && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowPostForm(true)}>
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                  {auth.user?.first_name?.[0] ?? '?'}
                </div>
                <div className="flex-1 rounded-full bg-gray-100 px-4 py-2.5 text-sm text-gray-400">
                  Share your organization's accomplishments...
                </div>
              </div>
              {showPostForm && (
                <div className="mt-3">
                  <textarea
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    rows={3}
                    placeholder="What has your organization accomplished?"
                    value={postContent}
                    onChange={e => setPostContent(e.target.value)}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setPostImage(e.target.files?.[0] ?? null)}
                      className="text-xs text-gray-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowPostForm(false); setPostContent(''); setPostImage(null) }}
                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          if (!postContent.trim()) return
                          const fd = new FormData()
                          fd.append('content', postContent)
                          if (postImage) fd.append('image', postImage)
                          createPostMutation.mutate(fd)
                          setShowPostForm(false)
                          setPostContent('')
                          setPostImage(null)
                        }}
                        disabled={!postContent.trim() || createPostMutation.isPending}
                        className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Posts list */}
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 overflow-hidden flex-shrink-0">
                  {post.author_avatar
                    ? <img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-indigo-600 font-semibold text-sm">{post.author_name[0]}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      {post.author_youth_type === 'sk' ? (
                        <Link to="/sk-directory" className="font-semibold text-sm text-gray-900 hover:text-indigo-700 transition-colors">
                          {post.author_name}
                        </Link>
                      ) : (
                        <p className="font-semibold text-sm text-gray-900">{post.author_name}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {post.author_barangay && `${post.author_barangay} · `}
                        {new Date(post.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    {post.is_own && (
                      <button
                        onClick={() => deletePostMutation.mutate(post.id)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{post.content}</p>
                  {post.image_url && (
                    <img src={post.image_url} alt="" className="mt-3 rounded-lg max-h-64 w-full object-cover" />
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {posts.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No posts yet. Be the first to share an accomplishment.</p>
          )}

        </div>
      </section>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function HubCard({
  title, description, icon: Icon, to, accent = 'primary', badge, samples,
}: {
  title: string
  description: string
  icon: React.ElementType
  to: string
  accent?: 'primary' | 'accent' | 'neutral'
  badge?: string
  samples?: string[]
}) {
  const iconCls = {
    primary: 'bg-primary-600 text-white group-hover:bg-primary-700',
    accent:  'bg-accent-400 text-primary-900 group-hover:bg-accent-500',
    neutral: 'bg-ink-100 text-ink-700 group-hover:bg-primary-100 group-hover:text-primary-700',
  }[accent]

  return (
    <Link
      to={to}
      className="group bg-white rounded-3xl border border-ink-100 hover:border-primary-300 hover:shadow-lg hover:-translate-y-0.5 p-6 flex flex-col transition-all"
    >
      <div className="flex items-start justify-between mb-5">
        <span className={cn('inline-flex items-center justify-center w-12 h-12 rounded-2xl transition-colors', iconCls)}>
          <Icon size={22} strokeWidth={2.2} />
        </span>
        {badge && (
          <span className="chip bg-primary-50 text-primary-700 text-[10px] font-bold uppercase tracking-wide border border-primary-200">
            {badge}
          </span>
        )}
      </div>
      <h3 className="font-display font-bold text-xl text-ink-900 leading-tight mb-2">{title}</h3>
      <p className="text-sm text-ink-600 leading-relaxed">{description}</p>
      {samples && (
        <ul className="mt-3 space-y-1.5">
          {samples.map(s => (
            <li key={s} className="flex items-start gap-2 text-xs text-ink-500">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-ink-300 flex-shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 group-hover:text-primary-800 group-hover:gap-2 transition-all">
        Open <ArrowRight size={14} />
      </div>
    </Link>
  )
}

function OrgPreviewCard({ org }: { org: YouthOrg }) {
  return (
    <Link
      to="/organizations"
      className="group bg-white rounded-2xl border border-ink-100 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5 p-4 flex flex-col gap-3 transition-all"
    >
      <div className="flex items-start gap-3">
        {org.logo_url ? (
          <img
            src={org.logo_url}
            alt={org.name}
            className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-ink-100"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={18} className="text-primary-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-ink-900 leading-snug line-clamp-2 group-hover:text-primary-700 transition-colors">
            {org.name}
          </p>
          {org.is_compliant && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <CheckCircle2 size={9} /> Compliant
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        {org.barangay && (
          <p className="text-xs text-ink-500 flex items-center gap-1">
            <MapPin size={10} className="flex-shrink-0" /> {org.barangay}
          </p>
        )}
      </div>
      <div className="mt-auto pt-1 border-t border-ink-50">
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', CLASS_COLORS[org.classification] ?? 'bg-gray-100 text-gray-700')}>
          {CLASS_LABELS[org.classification] ?? org.classification}
        </span>
      </div>
    </Link>
  )
}
