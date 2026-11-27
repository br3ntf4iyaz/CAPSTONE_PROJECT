import { useState, useRef, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Users, Building2, ArrowRight, MapPin, CheckCircle2,
  TrendingUp, Shield, Heart, Pin, ImagePlus, X, MessageSquare,
  ChevronLeft, ChevronRight, Trash2, Trophy, MoreVertical, EyeOff, Eye, CornerDownRight,
} from 'lucide-react'
import { compliancePercent, complianceTile } from '@/components/ui/ComplianceBadge'
import apiClient from '@/api/client'
import { communityApi } from '@/api/community'
import { LikeButton, ReactionSummary, REACTIONS, REACTION_BY_KEY, type ReactionKey } from '../../components/Reactions'
import type { CommunityPost, CommunityPostImage, CommunityPostPage, CommunityComment, CommunityReactor } from '@/api/community'
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

/** Prefer the server's explanation (too long, bad image...) over a generic message. */
function serverMsg(e: any, fallback: string): string {
  const d = e?.response?.data
  if (!d || typeof d === 'string') return fallback
  if (d.detail) return String(d.detail)
  const first = Object.values(d).flat()[0]
  return first ? String(first) : fallback
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
  const [postToDelete, setPostToDelete] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [reactorsPostId, setReactorsPostId] = useState<number | null>(null)

  // A notification opens the feed at  /community?post=ID&comment=ID : show and highlight that post
  const [searchParams, setSearchParams] = useSearchParams()
  const linkedPostId = Number(searchParams.get('post')) || null
  const linkedCommentId = Number(searchParams.get('comment')) || null

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
    refetchInterval: 10000, // new reactions and comments show up without a manual refresh
  })

  const loadedPosts = useMemo(() => postsData?.pages.flatMap(p => p.results) ?? [], [postsData])

  const { data: linkedPost, isError: linkedMissing } = useQuery<CommunityPost>({
    queryKey: ['community-post', linkedPostId],
    queryFn: () => communityApi.get(linkedPostId as number),
    enabled: !!linkedPostId,
    retry: false,
    refetchInterval: 10000,
  })
  // the post a notification points to is always shown, even when it is not in the pages loaded so far
  const posts = useMemo(
    () => (linkedPost && !loadedPosts.some(p => p.id === linkedPost.id) ? [linkedPost, ...loadedPosts] : loadedPosts),
    [linkedPost, loadedPosts],
  )

  useEffect(() => {
    if (linkedPostId && linkedMissing) {
      toast.error('This post is no longer available.')
      setSearchParams({}, { replace: true })
    }
  }, [linkedPostId, linkedMissing, setSearchParams])

  // open the linked post's comments and scroll to the post (or to the comment itself)
  useEffect(() => {
    if (!linkedPost) return
    setOpenCommentIds(prev => (prev.has(linkedPost.id) ? prev : new Set(prev).add(linkedPost.id)))
    const t = window.setTimeout(() => {
      const el = (linkedCommentId && document.getElementById('comment-' + linkedCommentId)) || document.getElementById('post-' + linkedPost.id)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 600)
    return () => window.clearTimeout(t)
  }, [linkedPost?.id, linkedCommentId])

  // Accumulate known barangays for filter chips (never shrink when filter changes)
  useEffect(() => {
    if (posts.length === 0) return
    setBarangayOptions(prev => {
      const next = [...new Set([...prev, ...posts.map(p => p.author_barangay).filter(Boolean)])].sort()
      return next.length === prev.length && next.every((v, i) => v === prev[i]) ? prev : next
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
    onError: (e) => toast.error(serverMsg(e, 'Failed to post. Try again.')),
  })

  const deletePostMutation = useMutation({
    mutationFn: (id: number) => communityApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] })
      toast.success('Post deleted.')
    },
    onError: () => toast.error('Could not delete post.'),
    onSettled: () => setPostToDelete(null),
  })

  const likeMutation = useMutation({
    mutationFn: ({ id, reaction }: { id: number; reaction: ReactionKey }) => communityApi.react(id, reaction),
    onSuccess: (data, { id }) => {
      const patch = (p: CommunityPost): CommunityPost =>
        p.id === id ? { ...p, is_liked: data.liked, my_reaction: data.reaction, like_count: data.count, reaction_summary: data.summary } : p
      queryClient.setQueriesData({ queryKey: ['community-posts'] }, (old: any) => {
        if (!old?.pages) return old
        return { ...old, pages: old.pages.map((page: CommunityPostPage) => ({ ...page, results: page.results.map(patch) })) }
      })
      queryClient.setQueryData(['community-post', id], (old: CommunityPost | undefined) => (old ? patch(old) : old))
      queryClient.invalidateQueries({ queryKey: ['post-reactors', id] })
    },
    onError: (e) => toast.error(serverMsg(e, 'Could not save your reaction.')),
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
    onError: (e) => toast.error(serverMsg(e, 'Could not save changes.')),
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
            image="/images/icons/sk-logo.png"
            to="/sk-directory"
            accent="primary"
            badge={barangays.length > 0 ? `${barangays.length} barangays` : undefined}
            samples={['SK Chairpersons & contacts', 'Compliance status by barangay', 'Events & deadlines calendar']}
          />
          <HubCard
            title="Youth Organizations"
            description="Browse recognized youth organizations across Lucena. See what they do, join, or send an inquiry."
            icon={Building2}
            image="/images/icons/youth-orgs.png"
            imageClass="scale-[1.65]"
            to="/organizations"
            accent="accent"
            badge={visibleOrgs.length > 0 ? `${visibleOrgs.length} organizations` : undefined}
            samples={['School-, community- & faith-based orgs', 'Activities & accomplishments', 'Register your own organization']}
          />
          <HubCard
            title="SK Feedback"
            description="Send feedback, concerns, or suggestions directly to your barangay's Sangguniang Kabataan."
            icon={MessageSquare}
            image="/images/icons/sk-feedback.png"
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
          <div className="bg-white rounded-2xl border border-l-4 border-primary-100 border-l-primary-500 shadow-sm p-5">
            <p className="text-xs font-extrabold text-primary-800 uppercase tracking-wide mb-4 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-accent-400 text-primary-900"><Trophy size={13} /></span>
              Top Compliant Barangays
            </p>
            <div className="space-y-3">
              {[...barangays]
                .map(b => {
                  const total = b.submitted_count + b.pending_count + b.overdue_count
                  return { ...b, pct: compliancePercent(b.submitted_count, total) }
                })
                .sort((a, b) => b.pct - a.pct)
                .slice(0, 5)
                .map((b, index) => {
                  const tile = complianceTile(b.pct)
                  return (
                    <div key={b.id} className="flex items-center gap-3">
                      <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold', index === 0 ? 'bg-accent-400 text-primary-900' : 'bg-primary-50 text-primary-700 border border-primary-200')}>{index + 1}</span>
                      <span className="text-sm text-primary-900 w-36 truncate font-bold">{b.barangay_name}</span>
                      <div className="flex-1 h-2.5 bg-primary-50 border border-primary-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-700', tile.bar)} style={{ width: `${b.pct}%` }} />
                      </div>
                      <span className={cn('text-sm font-extrabold w-11 text-right tabular-nums', tile.text)}>{b.pct}%</span>
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
                <Link to="/profile" title="My Space" aria-label="Open My Space" onClick={e => e.stopPropagation()}
                  className="w-10 h-10 rounded-full bg-primary-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-primary-600 font-semibold hover:ring-2 hover:ring-primary-300 transition">
                  {auth.user?.avatar_url
                    ? <img src={auth.user.avatar_url} alt="" className="w-full h-full object-cover" />
                    : auth.user?.first_name?.[0] ?? '?'}
                </Link>
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
              id={'post-' + post.id}
              className={cn(
                'bg-white rounded-xl border p-4 transition-shadow',
                post.is_pinned ? 'border-amber-300 bg-amber-50/30' : 'border-ink-200',
                post.id === linkedPostId && 'ring-2 ring-primary-400 border-primary-300 shadow-md',
              )}
            >
              <div className="flex items-start gap-3">
                {(() => {
                  const face = post.author_avatar
                    ? <img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-primary-600 font-semibold text-sm">{post.author_name[0]}</div>
                  return post.is_own
                    ? <Link to="/profile" title="My Space" aria-label="Open My Space" className="w-10 h-10 rounded-full bg-primary-100 overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-primary-300 transition">{face}</Link>
                    : <div className="w-10 h-10 rounded-full bg-primary-100 overflow-hidden flex-shrink-0">{face}</div>
                })()}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {post.author_youth_type === 'sk' ? (
                        <Link to="/sk-directory" className="font-semibold text-sm text-ink-900 hover:text-primary-700 transition-colors">
                          {post.author_name}
                        </Link>
                      ) : post.is_own ? (
                        <Link to="/profile" className="font-semibold text-sm text-ink-900 hover:text-primary-700 transition-colors">{post.author_name}</Link>
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
                          onClick={() => setPostToDelete(post.id)}
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

                  {/* Reaction summary (opens the list of people) and comment count */}
                  {(post.like_count > 0 || post.comment_count > 0) && (
                    <div className="mt-3 flex items-center justify-between min-h-[20px]">
                      <ReactionSummary summary={post.reaction_summary ?? []} total={post.like_count} onOpen={() => setReactorsPostId(post.id)} />
                      {post.comment_count > 0 && (
                        <button onClick={() => toggleComments(post.id)} className="text-xs text-ink-500 hover:text-primary-700 hover:underline">
                          {post.comment_count} {post.comment_count === 1 ? 'comment' : 'comments'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Like (hover or long-press for all seven reactions) + Comment */}
                  <div className="mt-2 pt-2 border-t border-ink-100 flex items-center gap-5">
                    <LikeButton
                      value={post.my_reaction}
                      disabled={!auth.user}
                      onPick={reaction => { if (auth.user) likeMutation.mutate({ id: post.id, reaction }) }}
                    />
                    <button
                      onClick={() => toggleComments(post.id)}
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-semibold rounded-lg px-1.5 py-1 transition-colors hover:bg-primary-50',
                        openCommentIds.has(post.id) ? 'text-primary-600' : 'text-ink-500 hover:text-primary-600'
                      )}
                    >
                      <MessageSquare size={15} /> Comment
                    </button>
                  </div>

                  <CommentsSection postId={post.id} currentUser={auth.user} showList={openCommentIds.has(post.id)} highlightCommentId={post.id === linkedPostId ? linkedCommentId : null} />
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

      {reactorsPostId !== null && <ReactorsModal postId={reactorsPostId} onClose={() => setReactorsPostId(null)} />}

      {postToDelete !== null && (
        <ConfirmDeleteDialog
          id="delete-post"
          title="Are you sure you want to delete this post?"
          description="This action cannot be undone. Once deleted, this post will be permanently removed."
          confirmLabel="Delete Post"
          pending={deletePostMutation.isPending}
          onCancel={() => setPostToDelete(null)}
          onConfirm={() => deletePostMutation.mutate(postToDelete)}
        />
      )}

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Centered confirmation for destructive actions. Cancel (also Esc or a click outside) changes nothing. */
function ConfirmDeleteDialog({
  id, title, description, confirmLabel, pending, onCancel, onConfirm,
}: {
  id: string
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pending) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={() => { if (!pending) onCancel() }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <Trash2 size={22} />
        </div>
        <h2 id={`${id}-title`} className="text-center text-base font-bold text-ink-900">{title}</h2>
        <p id={`${id}-desc`} className="mt-2 text-center text-sm text-ink-500">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <button type="button" autoFocus onClick={onCancel} disabled={pending} className="btn-secondary sm:min-w-[110px]">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-60 sm:min-w-[110px]"
          >
            {pending ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

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
  title, description, icon: Icon, image, imageClass, to, accent = 'primary', badge, samples,
}: {
  title: string
  description: string
  icon: React.ElementType
  image?: string  // a picture used in place of the line icon
  imageClass?: string  // to enlarge a picture that has a lot of empty margin
  to: string
  accent?: 'primary' | 'accent' | 'neutral'
  badge?: string
  samples?: string[]
}) {
  const iconCls = {
    primary: 'bg-white text-primary-700 group-hover:bg-primary-50',
    accent:  'bg-accent-400 text-primary-900 group-hover:bg-accent-300',
    neutral: 'bg-white/15 text-white border border-white/30 group-hover:bg-white/25',
  }[accent]

  return (
    <Link
      to={to}
      className="group relative overflow-hidden bg-gradient-to-br from-primary-700 to-primary-900 text-white rounded-3xl shadow-lg shadow-primary-900/20 hover:shadow-xl hover:shadow-primary-900/30 hover:-translate-y-0.5 p-6 flex flex-col transition-all"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-12 h-44 w-44 rounded-full bg-accent-400/20 blur-2xl" />
      <div className="relative flex items-start justify-between mb-5">
        {image ? (
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-md p-1.5 overflow-hidden">
            <img src={image} alt="" className={cn('w-full h-full object-contain', imageClass)} />
          </span>
        ) : (
          <span className={cn('inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-md transition-colors', iconCls)}>
            <Icon size={26} strokeWidth={2.2} />
          </span>
        )}
        {badge && (
          <span className="chip bg-white/15 text-white text-[10px] font-bold uppercase tracking-wide border border-white/30">
            {badge}
          </span>
        )}
      </div>
      <h3 className="relative font-display font-bold text-xl text-white leading-tight mb-2">{title}</h3>
      <p className="relative text-sm text-primary-100 leading-relaxed">{description}</p>
      {samples && (
        <ul className="relative mt-3 space-y-1.5">
          {samples.map(s => (
            <li key={s} className="flex items-start gap-2 text-xs text-primary-100">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-accent-400 flex-shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      )}
      <div className="relative mt-5 inline-flex items-center gap-1 text-sm font-bold text-accent-300 group-hover:text-accent-200 group-hover:gap-2 transition-all">
        Open <ArrowRight size={14} />
      </div>
    </Link>
  )
}

/** Everyone who reacted to one post: photo, name, account type and reaction, with a filter per reaction. */
function ReactorsModal({ postId, onClose }: { postId: number; onClose: () => void }) {
  const [filter, setFilter] = useState<'all' | ReactionKey>('all')
  const { data, isLoading, isError } = useQuery<{ count: number; results: CommunityReactor[] }>({
    queryKey: ['post-reactors', postId],
    queryFn: () => communityApi.reactors(postId),
    refetchInterval: 10000,
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const all = data?.results ?? []
  const counts: Record<string, number> = {}
  all.forEach(r => { counts[r.reaction] = (counts[r.reaction] ?? 0) + 1 })
  const shown = filter === 'all' ? all : all.filter(r => r.reaction === filter)
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-primary-950/60 backdrop-blur-sm p-0 sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="People who reacted"
        onMouseDown={e => e.stopPropagation()}
        className="w-full sm:max-w-sm max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div>
            <h3 className="font-display font-bold text-ink-900">People who reacted</h3>
            <p className="text-xs text-ink-500 mt-0.5">{data?.count ?? 0} {(data?.count ?? 0) === 1 ? 'reaction' : 'reactions'}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full text-ink-500 hover:bg-ink-100"><X size={16} className="mx-auto" /></button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-ink-100 no-scrollbar">
          {([{ key: 'all', emoji: '', label: 'All' }, ...REACTIONS] as { key: 'all' | ReactionKey; emoji: string; label: string }[]).map(t => {
            const n = t.key === 'all' ? all.length : counts[t.key] ?? 0
            if (t.key !== 'all' && n === 0 && filter !== t.key) return null
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                  filter === t.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-primary-700 border-primary-200 hover:bg-primary-50',
                )}
              >
                {t.emoji && <span className="text-sm leading-none">{t.emoji}</span>}{t.label} <span className="opacity-80">{n}</span>
              </button>
            )
          })}
        </div>
        <div className="overflow-y-auto divide-y divide-ink-50">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-ink-500">Loading…</div>
          ) : isError ? (
            <div className="p-6 text-center text-sm text-red-600">Could not load the list. Please try again.</div>
          ) : shown.length === 0 ? (
            <div className="p-6 text-center text-sm text-ink-500">No reactions here yet.</div>
          ) : (
            shown.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className="relative w-10 h-10 flex-shrink-0">
                  <span className="w-10 h-10 rounded-full bg-primary-100 overflow-hidden inline-flex items-center justify-center font-semibold text-primary-700">
                    {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : p.name[0]}
                  </span>
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white ring-2 ring-white flex items-center justify-center text-[12px] leading-none">{REACTION_BY_KEY[p.reaction]?.emoji}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900 truncate">{p.name}</p>
                  <p className="text-xs text-ink-500">{p.account_type}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function CommentsSection({ postId, currentUser, showList, highlightCommentId = null }: { postId: number; currentUser: any; showList: boolean; highlightCommentId?: number | null }) {
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null)
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null)
  const [commentToHide, setCommentToHide] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ id: number; top: number; right: number } | null>(null)

  const { data: comments = [], isLoading } = useQuery<CommunityComment[]>({
    queryKey: ['comments', postId],
    queryFn: () => communityApi.listComments(postId),
    enabled: showList,
    refetchInterval: showList ? 10000 : false,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['comments', postId] })
    queryClient.invalidateQueries({ queryKey: ['community-posts'] })
    queryClient.invalidateQueries({ queryKey: ['community-post', postId] })
  }

  const addComment = useMutation({
    mutationFn: ({ content, parent }: { content: string; parent: number | null }) => communityApi.createComment(postId, content, parent),
    onSuccess: () => { refresh(); setText(''); setReplyTo(null) },
    onError: (e) => toast.error(serverMsg(e, 'Could not post comment.')),
  })

  const deleteComment = useMutation({
    mutationFn: (commentId: number) => communityApi.deleteComment(postId, commentId),
    onSuccess: () => { refresh(); toast.success('Comment deleted successfully.') },
    onError: (e) => toast.error(serverMsg(e, 'Could not delete the comment.')),
    onSettled: () => setCommentToDelete(null),
  })

  const hideComment = useMutation({
    mutationFn: (commentId: number) => communityApi.hideComment(postId, commentId),
    onSuccess: () => { refresh(); toast.success('Comment hidden successfully.') },
    onError: (e) => toast.error(serverMsg(e, 'Could not hide the comment.')),
    onSettled: () => setCommentToHide(null),
  })

  const restoreComment = useMutation({
    mutationFn: (commentId: number) => communityApi.restoreComment(postId, commentId),
    onSuccess: () => { refresh(); toast.success('Comment restored.') },
    onError: (e) => toast.error(serverMsg(e, 'Could not restore the comment.')),
  })

  // top-level comments, each followed by every reply under it (oldest first)
  const byId = new Map(comments.map(c => [c.id, c]))
  const rootOf = (c: CommunityComment): CommunityComment | null => {
    let cur: CommunityComment | undefined = c
    for (let i = 0; i < 50 && cur; i++) {
      if (!cur.parent_id) return cur
      cur = byId.get(cur.parent_id)
    }
    return null // its parent is not visible to this person, so neither is the reply
  }
  const roots = comments.filter(c => !c.parent_id)
  const repliesOf = (root: CommunityComment) => comments.filter(c => c.parent_id && rootOf(c)?.id === root.id)

  if (!currentUser && !showList) return null

  const row = (c: CommunityComment, isReply: boolean) => (
    <div key={c.id} id={'comment-' + c.id} className={cn('group flex gap-2 rounded-xl', isReply && 'ml-9', c.id === highlightCommentId && 'bg-primary-50 ring-1 ring-primary-200 p-1 -m-1')}>
      {(() => {
        const face = c.author_avatar
          ? <img src={c.author_avatar} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-primary-600 font-semibold text-[10px]">{c.author_name[0]}</div>
        return c.is_own
          ? <Link to="/profile" title="My Space" aria-label="Open My Space" className="w-7 h-7 rounded-full bg-primary-100 overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-primary-300 transition">{face}</Link>
          : <div className="w-7 h-7 rounded-full bg-primary-100 overflow-hidden flex-shrink-0">{face}</div>
      })()}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1">
          <div className={cn('rounded-2xl px-3 py-2 min-w-0', c.is_hidden ? 'bg-amber-50 border border-dashed border-amber-300' : 'bg-ink-50')}>
            <p className="text-xs font-semibold text-ink-800 flex flex-wrap items-center gap-1.5">
              {c.is_own ? <Link to="/profile" className="hover:text-primary-700">{c.author_name}</Link> : c.author_name}
              {c.author_account_type && c.author_account_type !== 'General Youth' && (
                <span className="rounded-full bg-primary-100 text-primary-700 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide">{c.author_account_type}</span>
              )}
            </p>
            {c.is_deleted
              ? <p className="text-xs italic text-ink-400 mt-0.5">This comment was deleted.</p>
              : <p className="text-xs text-ink-700 mt-0.5 whitespace-pre-wrap">{c.content}</p>}
            {c.is_hidden && (
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700"><EyeOff size={10} /> {c.hidden_label || 'Hidden by post owner'}</p>
            )}
          </div>
          {(c.can_delete || c.can_hide) && (
            <button
              type="button"
              aria-label="Comment options"
              aria-haspopup="menu"
              onClick={e => {
                if (menu?.id === c.id) { setMenu(null); return }
                const r = e.currentTarget.getBoundingClientRect()
                setMenu({ id: c.id, top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) })
              }}
              className={cn(
                'mt-1 w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-full text-ink-500 hover:bg-primary-100 hover:text-primary-700 transition-all',
                'sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100',
                menu?.id === c.id && 'sm:opacity-100 bg-primary-100 text-primary-700',
              )}
            >
              <MoreVertical size={15} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 px-1">
          <span className="text-[10px] text-ink-400">{timeAgo(c.created_at)}</span>
          {currentUser && !c.is_deleted && !c.is_hidden && (
            <button onClick={() => setReplyTo({ id: c.id, name: c.author_name })} className="text-[10px] font-semibold text-ink-500 hover:text-primary-700">Reply</button>
          )}
          {c.is_hidden && c.can_hide && (
            <button onClick={() => restoreComment.mutate(c.id)} disabled={restoreComment.isPending} className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary-600 hover:text-primary-800 disabled:opacity-50">
              <Eye size={10} /> Restore
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const menuComment = menu ? byId.get(menu.id) : undefined

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
            {roots.length === 0 && (
              <p className="text-xs text-ink-400 text-center py-1">No comments yet. Be the first!</p>
            )}
            {roots.map(root => (
              <div key={root.id} className="space-y-2">
                {row(root, false)}
                {repliesOf(root).map(r => row(r, true))}
              </div>
            ))}
          </div>
        )
      )}

      {/* Options of one comment (rendered on the page body so nothing clips it) */}
      {menu && menuComment && createPortal(
        <div>
          <div className="fixed inset-0 z-[60]" onMouseDown={() => setMenu(null)} />
          <div role="menu" className="fixed z-[61] min-w-[11rem] rounded-xl bg-white border border-ink-100 shadow-xl py-1" style={{ top: menu.top, right: menu.right }}>
            {menuComment.can_hide && !menuComment.is_hidden && (
              <button role="menuitem" onClick={() => { setCommentToHide(menuComment.id); setMenu(null) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-primary-50">
                <EyeOff size={14} /> Hide comment
              </button>
            )}
            {menuComment.can_hide && menuComment.is_hidden && (
              <button role="menuitem" onClick={() => { restoreComment.mutate(menuComment.id); setMenu(null) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-primary-50">
                <Eye size={14} /> Restore comment
              </button>
            )}
            {menuComment.can_delete && (
              <button role="menuitem" onClick={() => { setCommentToDelete(menuComment.id); setMenu(null) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
                <Trash2 size={14} /> Delete comment
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}

      {commentToDelete !== null && (
        <ConfirmDeleteDialog
          id={'delete-comment-' + postId}
          title="Delete comment?"
          description="Are you sure you want to delete this comment? This action cannot be undone."
          confirmLabel="Delete Comment"
          pending={deleteComment.isPending}
          onCancel={() => setCommentToDelete(null)}
          onConfirm={() => deleteComment.mutate(commentToDelete)}
        />
      )}

      {commentToHide !== null && (
        <ConfirmDeleteDialog
          id={'hide-comment-' + postId}
          title="Hide this comment?"
          description="This comment will no longer be visible in the public discussion. Authorized moderators and the post owner may still review it."
          confirmLabel="Hide Comment"
          pending={hideComment.isPending}
          onCancel={() => setCommentToHide(null)}
          onConfirm={() => hideComment.mutate(commentToHide)}
        />
      )}

      {/* Input — always visible for logged-in users */}
      {currentUser && (
        <div>
          {replyTo && (
            <p className="mb-1 ml-9 flex items-center gap-1 text-[11px] text-ink-500">
              <CornerDownRight size={11} /> Replying to <span className="font-semibold text-ink-700">{replyTo.name}</span>
              <button onClick={() => setReplyTo(null)} className="ml-1 text-ink-400 hover:text-red-500" aria-label="Cancel reply"><X size={11} /></button>
            </p>
          )}
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
                  addComment.mutate({ content: text.trim(), parent: replyTo?.id ?? null })
                }
              }}
              placeholder={replyTo ? 'Write a reply… (Enter to post)' : 'Write a comment… (Enter to post)'}
              className="flex-1 rounded-full border border-ink-200 px-3 py-1.5 text-xs focus:outline-none focus:border-primary-400"
            />
            <button
              onClick={() => { if (text.trim()) addComment.mutate({ content: text.trim(), parent: replyTo?.id ?? null }) }}
              disabled={!text.trim() || addComment.isPending}
              className="text-xs font-semibold text-primary-600 hover:text-primary-800 disabled:opacity-40 flex-shrink-0"
            >
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function OrgPreviewCard({ org }: { org: YouthOrg }) {
  return (
    <Link
      to="/organizations"
      className="group bg-white rounded-2xl border border-l-4 border-primary-100 border-l-primary-500 shadow-sm hover:border-primary-300 hover:shadow-lg hover:shadow-primary-600/10 hover:-translate-y-0.5 p-4 flex flex-col gap-3 transition-all"
    >
      <div className="flex items-start gap-3">
        {org.logo_url ? (
          <img
            src={org.logo_url}
            alt={org.name}
            className="w-11 h-11 rounded-xl object-cover flex-shrink-0 border-2 border-primary-100 bg-white shadow-sm"
          />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-md shadow-primary-600/30 flex items-center justify-center flex-shrink-0">
            <Building2 size={20} className="text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-primary-900 leading-snug line-clamp-2 group-hover:text-primary-700 transition-colors">
            {org.name}
          </p>
          {org.is_compliant && (
            <span className="mt-1 inline-flex w-fit items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
              <CheckCircle2 size={9} /> Compliant
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        {org.barangay && (
          <p className="text-xs font-medium text-primary-800 flex items-center gap-1">
            <MapPin size={10} className="flex-shrink-0 text-primary-500" /> {org.barangay}
          </p>
        )}
      </div>
      <div className="mt-auto pt-2 border-t border-primary-100">
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', CLASS_COLORS[org.classification] ?? 'bg-ink-100 text-ink-700')}>
          {CLASS_LABELS[org.classification] ?? org.classification}
        </span>
      </div>
    </Link>
  )
}
