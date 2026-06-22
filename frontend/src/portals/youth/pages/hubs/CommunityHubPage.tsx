import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Users, Building2, ArrowRight, MapPin, CheckCircle2,
  TrendingUp, Shield, Heart, Pin, ImagePlus, X, MessageSquare,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import apiClient from '@/api/client'
import { communityApi } from '@/api/community'
import type { CommunityPost, CommunityPostImage, CommunityPostPage, CommunityComment } from '@/api/community'
import { useAuthStore } from '@/store/authStore'
import { cn, toArray, timeAgo } from '@/utils'

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
  const [postImages, setPostImages] = useState<File[]>([])
  const [thumbnailUrls, setThumbnailUrls] = useState<string[]>([])
  const [showPostForm, setShowPostForm] = useState(false)
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(null)
  const [barangayOptions, setBarangayOptions] = useState<string[]>([])
  const [openCommentIds, setOpenCommentIds] = useState<Set<number>>(new Set())
  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')

  const toggleComments = (id: number) => {
    setOpenCommentIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const sentinelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Build object URLs for composer thumbnails; revoke on change
  useEffect(() => {
    const urls = postImages.map(f => URL.createObjectURL(f))
    setThumbnailUrls(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [postImages])

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

  // Accumulate known barangays for filter chips (never shrink when filter changes)
  useEffect(() => {
    if (posts.length === 0) return
    setBarangayOptions(prev => {
      const s = new Set([...prev, ...posts.map(p => p.author_barangay).filter(Boolean)])
      return [...s].sort()
    })
  }, [posts])

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      toast.success('Post shared!')
      setShowPostForm(false)
      setPostContent('')
      setPostImages([])
    },
    onError: () => toast.error('Failed to post. Try again.'),
  })

  const deletePostMutation = useMutation({
    mutationFn: (id: number) => communityApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      toast.success('Post deleted.')
    },
    onError: () => toast.error('Could not delete post.'),
  })

  const likeMutation = useMutation({
    mutationFn: (id: number) => communityApi.react(id),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ['community-posts', selectedBarangay] })
      const prev = queryClient.getQueryData(['community-posts', selectedBarangay])
      queryClient.setQueryData(
        ['community-posts', selectedBarangay],
        (old: any) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page: CommunityPostPage) => ({
              ...page,
              results: page.results.map((p: CommunityPost) =>
                p.id === id
                  ? { ...p, is_liked: !p.is_liked, like_count: p.is_liked ? p.like_count - 1 : p.like_count + 1 }
                  : p
              ),
            })),
          }
        }
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(['community-posts', selectedBarangay], ctx.prev)
      }
    },
    onSuccess: (data, id) => {
      queryClient.setQueryData(
        ['community-posts', selectedBarangay],
        (old: any) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page: CommunityPostPage) => ({
              ...page,
              results: page.results.map((p: CommunityPost) =>
                p.id === id
                  ? { ...p, is_liked: data.liked, like_count: data.count }
                  : p
              ),
            })),
          }
        }
      )
    },
  })

  const editPostMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      communityApi.update(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      setEditingPostId(null)
      setEditContent('')
      toast.success('Post updated.')
    },
    onError: () => toast.error('Could not save changes.'),
  })

  const pinMutation = useMutation({
    mutationFn: (id: number) => communityApi.pin(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-posts'] }),
  })

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setPostImages(prev => [...prev, ...files].slice(0, 4))
    e.target.value = ''
  }

  const handleRemoveImage = (idx: number) => {
    setPostImages(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = () => {
    if (!postContent.trim()) return
    const fd = new FormData()
    fd.append('content', postContent)
    postImages.forEach(f => fd.append('images', f))
    createPostMutation.mutate(fd)
  }

  const handleCancel = () => {
    setShowPostForm(false)
    setPostContent('')
    setPostImages([])
  }

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

  const isAdmin =
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
          <HubCard
            title="SK Feedback"
            description="Send feedback, concerns, or suggestions directly to your barangay's Sangguniang Kabataan."
            icon={MessageSquare}
            to="/sk-feedback"
            accent="neutral"
            samples={['Concerns & suggestions', 'Rate your SK', 'Submit anonymously']}
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
            <div className="bg-white rounded-xl border border-ink-200 p-4">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowPostForm(true)}>
                <div className="w-10 h-10 rounded-full bg-primary-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-primary-600 font-semibold">
                  {auth.user?.avatar_url
                    ? <img src={auth.user.avatar_url} alt="" className="w-full h-full object-cover" />
                    : auth.user?.first_name?.[0] ?? '?'}
                </div>
                <div className="flex-1 rounded-full bg-ink-100 px-4 py-2.5 text-sm text-ink-400">
                  Share your organization's accomplishments...
                </div>
              </div>
              {showPostForm && (
                <div className="mt-3">
                  <textarea
                    className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
                    rows={3}
                    placeholder="What has your organization accomplished?"
                    value={postContent}
                    onChange={e => setPostContent(e.target.value.slice(0, 2000))}
                    autoFocus
                  />
                  <p className={cn(
                    'text-right text-[11px] mt-0.5',
                    postContent.length > 1800 ? 'text-alert-600 font-semibold' : 'text-ink-400'
                  )}>
                    {postContent.length} / 2000
                  </p>

                  {/* Photo thumbnails */}
                  {thumbnailUrls.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {thumbnailUrls.map((url, idx) => (
                        <div key={idx} className="relative">
                          <img src={url} alt="" className="w-20 h-20 rounded-lg object-cover" />
                          <button
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink-800 text-white flex items-center justify-center hover:bg-ink-700"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={postImages.length >= 4}
                      className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ImagePlus size={16} />
                      <span>{postImages.length > 0 ? `${postImages.length}/4 photos` : 'Add photos'}</span>
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        className="text-sm text-ink-500 hover:text-ink-700 px-3 py-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={!postContent.trim() || createPostMutation.isPending}
                        className="bg-primary-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        Post
                      </button>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleAddImages}
                  />
                </div>
              )}
            </div>
          )}

          {/* Barangay filter chips */}
          {barangayOptions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedBarangay(null)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                  selectedBarangay === null
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-ink-600 border-ink-300 hover:border-primary-400'
                )}
              >
                All
              </button>
              {barangayOptions.map(b => (
                <button
                  key={b}
                  onClick={() => setSelectedBarangay(b === selectedBarangay ? null : b)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                    selectedBarangay === b
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-ink-600 border-ink-300 hover:border-primary-400'
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {/* Posts list */}
          {posts.map(post => (
            <div
              key={post.id}
              className={cn(
                'bg-white rounded-xl border p-4',
                post.is_pinned ? 'border-amber-300 bg-amber-50/30' : 'border-ink-200'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 overflow-hidden flex-shrink-0">
                  {post.author_avatar
                    ? <img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-primary-600 font-semibold text-sm">{post.author_name[0]}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {post.author_youth_type === 'sk' ? (
                        <Link to="/sk-directory" className="font-semibold text-sm text-ink-900 hover:text-primary-700 transition-colors">
                          {post.author_name}
                        </Link>
                      ) : (
                        <p className="font-semibold text-sm text-ink-900">{post.author_name}</p>
                      )}
                      <p className="text-xs text-ink-500">
                        {post.author_barangay && `${post.author_barangay} · `}
                        {timeAgo(post.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {post.is_pinned && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                          <Pin size={9} /> Pinned
                        </span>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => pinMutation.mutate(post.id)}
                          disabled={pinMutation.isPending}
                          className={cn(
                            'text-xs px-2 py-0.5 rounded border transition-colors',
                            post.is_pinned
                              ? 'text-amber-600 border-amber-300 hover:bg-amber-50'
                              : 'text-ink-400 border-ink-200 hover:text-amber-600 hover:border-amber-300'
                          )}
                        >
                          {post.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                      )}
                      {post.is_own && editingPostId !== post.id && (
                        <button
                          onClick={() => { setEditingPostId(post.id); setEditContent(post.content) }}
                          className="text-xs text-ink-400 hover:text-primary-600 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {(post.is_own || isAdmin) && editingPostId !== post.id && (
                        <button
                          onClick={() => deletePostMutation.mutate(post.id)}
                          className="text-xs text-ink-400 hover:text-red-500 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {editingPostId === post.id ? (
                    <div className="mt-2">
                      <textarea
                        className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500"
                        rows={3}
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => editPostMutation.mutate({ id: post.id, content: editContent })}
                          disabled={!editContent.trim() || editPostMutation.isPending}
                          className="bg-primary-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPostId(null)}
                          className="text-xs text-ink-500 hover:text-ink-800 px-3 py-1.5 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <PostContent content={post.content} />
                  )}

                  <PhotoGrid images={post.images} />

                  {/* Like + Comment buttons */}
                  <div className="mt-3 flex items-center gap-4">
                    <button
                      onClick={() => { if (auth.user) likeMutation.mutate(post.id) }}
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-medium transition-colors',
                        post.is_liked ? 'text-red-500' : 'text-ink-400',
                        auth.user ? 'hover:text-red-400 cursor-pointer' : 'cursor-default'
                      )}
                    >
                      <Heart size={14} className={post.is_liked ? 'fill-red-500' : ''} />
                      {post.like_count > 0 && <span>{post.like_count}</span>}
                    </button>
                    <button
                      onClick={() => toggleComments(post.id)}
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-medium transition-colors',
                        openCommentIds.has(post.id) ? 'text-primary-600' : 'text-ink-400 hover:text-primary-500'
                      )}
                    >
                      <MessageSquare size={14} />
                      {post.comment_count > 0 && <span>{post.comment_count}</span>}
                    </button>
                  </div>

                  <CommentsSection postId={post.id} currentUser={auth.user} showList={openCommentIds.has(post.id)} />
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
            <p className="text-sm text-ink-400 text-center py-8">
              {selectedBarangay
                ? `No posts from ${selectedBarangay} yet.`
                : 'No posts yet. Be the first to share an accomplishment.'}
            </p>
          )}

        </div>
      </section>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PostContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  const LIMIT = 280
  const isLong = content.length > LIMIT || content.split('\n').length > 4
  const shown = expanded || !isLong ? content : content.slice(0, LIMIT)
  return (
    <div className="mt-2">
      <p className="text-sm text-ink-700 whitespace-pre-wrap">
        {shown}{!expanded && isLong && '…'}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-1 text-xs font-semibold text-primary-600 hover:text-primary-800 transition-colors"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

function PhotoGrid({ images }: { images: CommunityPostImage[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  if (!images.length) return null

  const count = images.length
  const extra = count > 4 ? count - 4 : 0

  const tile = (img: CommunityPostImage, i: number, cls?: string) => (
    <div
      key={img.id}
      className={cn('relative overflow-hidden bg-ink-100 cursor-pointer group', cls)}
      onClick={() => setLightboxIdx(i)}
    >
      <img
        src={img.url}
        alt=""
        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
      />
      {i === 3 && extra > 0 && (
        <div className="absolute inset-0 bg-black/55 flex items-center justify-center pointer-events-none">
          <span className="text-white text-2xl font-bold">+{extra}</span>
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className="mt-3 rounded-xl overflow-hidden">
        {count === 1 && (
          <div className="cursor-pointer overflow-hidden group" onClick={() => setLightboxIdx(0)}>
            <img
              src={images[0].url}
              alt=""
              className="w-full max-h-[480px] object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </div>
        )}
        {count === 2 && (
          <div className="grid grid-cols-2 gap-0.5">
            {images.map((img, i) => tile(img, i, 'aspect-square'))}
          </div>
        )}
        {count === 3 && (
          <div className="grid grid-cols-2 gap-0.5" style={{ gridTemplateRows: '180px 180px' }}>
            {tile(images[0], 0, 'row-span-2')}
            {tile(images[1], 1)}
            {tile(images[2], 2)}
          </div>
        )}
        {count >= 4 && (
          <div className="grid grid-cols-2 gap-0.5">
            {images.slice(0, 4).map((img, i) => tile(img, i, 'aspect-square'))}
          </div>
        )}
      </div>

      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? (i - 1 + count) % count : null) }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={22} />
          </button>
          <img
            src={images[lightboxIdx].url}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? (i + 1) % count : null) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={22} />
          </button>
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          {count > 1 && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
              {lightboxIdx + 1} / {count}
            </p>
          )}
        </div>
      )}
    </>
  )
}

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

function CommentsSection({ postId, currentUser, showList }: { postId: number; currentUser: any; showList: boolean }) {
  const queryClient = useQueryClient()
  const [text, setText] = useState('')

  const { data: comments = [], isLoading } = useQuery<CommunityComment[]>({
    queryKey: ['comments', postId],
    queryFn: () => communityApi.listComments(postId),
    enabled: showList,
  })

  const addComment = useMutation({
    mutationFn: (content: string) => communityApi.createComment(postId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      setText('')
    },
    onError: () => toast.error('Could not post comment.'),
  })

  const deleteComment = useMutation({
    mutationFn: (commentId: number) => communityApi.deleteComment(postId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      toast.success('Comment deleted.')
    },
    onError: () => toast.error('Could not delete comment.'),
  })

  if (!currentUser && !showList) return null

  return (
    <div className="mt-3 border-t border-ink-100 pt-3 space-y-2">
      {/* Thread — only loaded and shown when showList is true */}
      {showList && (
        isLoading ? (
          <div className="flex justify-center py-2">
            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {comments.length === 0 && (
              <p className="text-xs text-ink-400 text-center py-1">No comments yet. Be the first!</p>
            )}
            {comments.map(c => (
              <div key={c.id} className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-primary-100 overflow-hidden flex-shrink-0">
                  {c.author_avatar
                    ? <img src={c.author_avatar} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-primary-600 font-semibold text-[10px]">{c.author_name[0]}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-ink-50 rounded-2xl px-3 py-2">
                    <p className="text-xs font-semibold text-ink-800">{c.author_name}</p>
                    <p className="text-xs text-ink-700 mt-0.5 whitespace-pre-wrap">{c.content}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 px-1">
                    <span className="text-[10px] text-ink-400">{timeAgo(c.created_at)}</span>
                    {c.is_own && (
                      <button
                        onClick={() => deleteComment.mutate(c.id)}
                        disabled={deleteComment.isPending}
                        className="text-[10px] text-ink-400 hover:text-red-500 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Input — always visible for logged-in users */}
      {currentUser && (
        <div className="flex gap-2 items-center">
          <div className="w-7 h-7 rounded-full bg-primary-100 flex-shrink-0 flex items-center justify-center text-primary-600 font-semibold text-[10px]">
            {currentUser.first_name?.[0] ?? '?'}
          </div>
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
                e.preventDefault()
                addComment.mutate(text.trim())
              }
            }}
            placeholder="Write a comment… (Enter to post)"
            className="flex-1 rounded-full border border-ink-200 px-3 py-1.5 text-xs focus:outline-none focus:border-primary-400"
          />
          <button
            onClick={() => { if (text.trim()) addComment.mutate(text.trim()) }}
            disabled={!text.trim() || addComment.isPending}
            className="text-xs font-semibold text-primary-600 hover:text-primary-800 disabled:opacity-40 flex-shrink-0"
          >
            Post
          </button>
        </div>
      )}
    </div>
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
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', CLASS_COLORS[org.classification] ?? 'bg-ink-100 text-ink-700')}>
          {CLASS_LABELS[org.classification] ?? org.classification}
        </span>
      </div>
    </Link>
  )
}
