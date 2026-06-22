import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Eye, EyeOff, ImagePlus, X,
  ChevronUp, ChevronDown, ToggleLeft, ToggleRight,
  Newspaper, Images,
} from 'lucide-react'
import apiClient from '@/api/client'
import { formatDate, cn, toArray } from '@/utils'

// ─── Shared types ────────────────────────────────────────────────────────────

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

interface FeaturedSlide {
  id: number
  title: string
  description: string
  organizer: string
  tag_type: string
  tag_label: string
  tag_color: string
  image?: string
  image_url?: string
  order: number
  is_active: boolean
  created_at: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const POST_TYPE_OPTIONS = [
  { value: 'news',           label: 'News' },
  { value: 'update',         label: 'Update' },
  { value: 'youth_info',     label: 'Youth Info' },
  { value: 'local_event',    label: 'Local Event (Past)' },
  { value: 'national_event', label: 'National Event (Past)' },
]

const POST_TYPE_COLORS: Record<string, string> = {
  news: 'badge-blue', update: 'badge-green', youth_info: 'badge-purple',
  local_event: 'badge-yellow', national_event: 'badge-red',
}

const TAG_TYPE_OPTIONS = [
  { value: 'lydo_program',    label: 'LYDO Program' },
  { value: 'sk_activity',     label: 'SK Activity' },
  { value: 'community_event', label: 'Community Event' },
  { value: 'lydo_assembly',   label: 'LYDO Assembly' },
  { value: 'other',           label: 'Other' },
]

const TAG_BADGE_COLORS: Record<string, string> = {
  lydo_program:    'bg-accent-400/10 text-accent-700',
  sk_activity:     'bg-emerald-100 text-emerald-700',
  community_event: 'bg-amber-100 text-amber-700',
  lydo_assembly:   'bg-primary/10 text-primary-700',
  other:           'bg-gray-100 text-gray-600',
}

const POSTS_URL  = '/events/featured-posts/'
const SLIDES_URL = '/programs/slides/'

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Accessible modal \u2014 Escape, focus-trap, scroll-lock, focus restore */
function Modal({
  isOpen, onClose, labelId, children,
}: {
  isOpen: boolean; onClose: () => void; labelId: string; children: React.ReactNode
}) {
  const overlayRef  = useRef<HTMLDivElement>(null)
  const triggerRef  = useRef<Element | null>(null)
  const onCloseRef  = useRef(onClose)
  onCloseRef.current = onClose   // always up-to-date, never stale

  useEffect(() => {
    if (!isOpen) return
    triggerRef.current = document.activeElement
    // Focus the first focusable element only when the modal opens
    overlayRef.current
      ?.querySelector<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')
      ?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current() } }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus()
    }
  }, [isOpen])  // ← only re-run when modal opens/closes, NOT when onClose changes reference

  if (!isOpen) return null
  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby={labelId}
        className="bg-white dark:bg-gray-900 dark:border dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {children}
      </div>
    </div>
  )
}

/** Reusable image-upload widget */
function ImageUploadWidget({
  preview, onFile, onRemove, fileRef,
}: {
  preview: string | null
  onFile: (f: File) => void
  onRemove: () => void
  fileRef: React.RefObject<HTMLInputElement>
}) {
  return (
    <div>
      {preview ? (
        <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800" style={{ aspectRatio: '16/9' }}>
          <img src={preview} alt="Preview" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
          <button
            type="button" onClick={onRemove} aria-label="Remove image"
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
          ><X size={14} /></button>
          <button
            type="button" onClick={() => fileRef.current?.click()}
            className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors"
          ><ImagePlus size={13} /> Replace</button>
        </div>
      ) : (
        <button
          type="button" onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-primary-400 hover:text-primary-600 transition-colors"
        >
          <ImagePlus size={28} />
          <span className="text-sm">Click to upload a photo</span>
          <span className="text-xs">JPG, PNG, WEBP &mdash; max 5 MB</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section A \u2014 Featured Posts (news/updates)
// ─────────────────────────────────────────────────────────────────────────────

interface PostForm {
  title: string; post_type: string; content: string
  source: string; date_of_event: string; order: number; is_published: boolean
}

const EMPTY_POST: PostForm = {
  title: '', post_type: 'news', content: '', source: '', date_of_event: '', order: 0, is_published: false,
}

function FeaturedPostsTab() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editPost, setEditPost] = useState<FeaturedPost | null>(null)
  const [form, setForm] = useState<PostForm>(EMPTY_POST)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [thumbPreview, setThumbPreview] = useState<string | null>(null)
  const [removeThumb, setRemoveThumb] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-featured-posts'],
    queryFn: () => apiClient.get(POSTS_URL).then(r => toArray<FeaturedPost>(r.data)).catch(() => []),
  })
  const posts = data ?? []

  const createM = useMutation({
    mutationFn: (fd: FormData) => apiClient.post(POSTS_URL, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-featured-posts'] }); close_() },
  })
  const updateM = useMutation({
    mutationFn: ({ id, fd }: { id: number; fd: FormData }) =>
      apiClient.patch(`${POSTS_URL}${id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-featured-posts'] }); close_() },
  })
  const deleteM = useMutation({
    mutationFn: (id: number) => apiClient.delete(`${POSTS_URL}${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-featured-posts'] }); setDeleteId(null) },
  })

  const togglePublish = (post: FeaturedPost) =>
    apiClient.patch(`${POSTS_URL}${post.id}/`, { is_published: !post.is_published })
      .then(() => qc.invalidateQueries({ queryKey: ['admin-featured-posts'] }))

  function openCreate() { setEditPost(null); setForm(EMPTY_POST); resetThumb(); setModalOpen(true) }
  function openEdit(p: FeaturedPost) {
    setEditPost(p)
    setForm({ title: p.title, post_type: p.post_type, content: p.content, source: p.source ?? '', date_of_event: p.date_of_event ?? '', order: p.order, is_published: p.is_published })
    resetThumb()
    if (p.thumbnail) setThumbPreview(p.thumbnail)
    setModalOpen(true)
  }
  function close_() { setModalOpen(false); setEditPost(null); setForm(EMPTY_POST); resetThumb() }
  function resetThumb() { setThumbFile(null); setThumbPreview(null); setRemoveThumb(false); if (fileRef.current) fileRef.current.value = '' }
  function handleThumbFile(f: File) { setThumbFile(f); setRemoveThumb(false); const r = new FileReader(); r.onloadend = () => setThumbPreview(r.result as string); r.readAsDataURL(f) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, k === 'is_published' ? (v ? 'true' : 'false') : String(v)))
    if (thumbFile) fd.append('thumbnail', thumbFile)
    if (removeThumb) fd.append('thumbnail', '')
    editPost ? updateM.mutate({ id: editPost.id, fd }) : createM.mutate(fd)
  }

  const setF = <K extends keyof PostForm>(k: K, v: PostForm[K]) => setForm(p => ({ ...p, [k]: v }))
  const saving = createM.isPending || updateM.isPending

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">News, updates, and highlights shown on the home feed</p>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> New Post
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading&hellip;</div>
      ) : posts.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">No featured posts yet. Click &ldquo;New Post&rdquo; to add one.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {['#', 'Image', 'Title', 'Type', 'Source', 'Date', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {posts.map(post => (
                <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{post.order}</td>
                  <td className="px-4 py-3">
                    {post.thumbnail
                      ? <img src={post.thumbnail} alt="" loading="lazy" className="w-12 h-9 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                      : <div className="w-12 h-9 bg-gray-100 dark:bg-gray-800 rounded-lg grid place-items-center"><ImagePlus size={13} className="text-gray-300" /></div>
                    }
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 max-w-[180px] truncate">{post.title}</td>
                  <td className="px-4 py-3">
                    <span className={cn('badge', POST_TYPE_COLORS[post.post_type] ?? 'badge-gray')}>
                      {POST_TYPE_OPTIONS.find(o => o.value === post.post_type)?.label ?? post.post_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[140px] truncate">{post.source || '\u2014'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{post.date_of_event ? formatDate(post.date_of_event) : '\u2014'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePublish(post)}
                      className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                        post.is_published
                          ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400')}
                    >
                      {post.is_published ? <><Eye size={11} /> Published</> : <><EyeOff size={11} /> Draft</>}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(post)} className="p-1 text-gray-400 hover:text-primary-700 dark:hover:text-primary-400 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteId(post.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal isOpen={modalOpen} onClose={close_} labelId="post-modal-title">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="post-modal-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {editPost ? 'Edit Featured Post' : 'New Featured Post'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="p-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
            <input id="p-title" className="input w-full" value={form.title} onChange={e => setF('title', e.target.value)} required placeholder="Post title" />
          </div>
          <div>
            <label htmlFor="p-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
            <select id="p-type" className="input w-full" value={form.post_type} onChange={e => setF('post_type', e.target.value)} required>
              {POST_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="p-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content *</label>
            <textarea id="p-content" className="input w-full min-h-[90px] resize-y" value={form.content} onChange={e => setF('content', e.target.value)} required placeholder="Post content or description" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cover Image <span className="text-gray-400 font-normal">(optional)</span></label>
            <ImageUploadWidget
              preview={thumbPreview}
              onFile={handleThumbFile}
              onRemove={() => { setThumbFile(null); setThumbPreview(null); setRemoveThumb(true); if (fileRef.current) fileRef.current.value = '' }}
              fileRef={fileRef}
            />
          </div>
          <div>
            <label htmlFor="p-source" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source / Organizer</label>
            <input id="p-source" className="input w-full" value={form.source} onChange={e => setF('source', e.target.value)} placeholder="e.g. National Youth Commission" />
          </div>
          <div>
            <label htmlFor="p-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Event / News</label>
            <input id="p-date" type="date" className="input w-full" value={form.date_of_event} onChange={e => setF('date_of_event', e.target.value)} />
          </div>
          <div>
            <label htmlFor="p-order" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order <span className="text-gray-400 font-normal">(lower = first)</span></label>
            <input id="p-order" type="number" className="input w-full" value={form.order} onChange={e => setF('order', Number(e.target.value))} min={0} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-primary-700" checked={form.is_published} onChange={e => setF('is_published', e.target.checked)} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Published (visible on home page)</span>
          </label>
          {(createM.error || updateM.error) && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Failed to save. Please try again.</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={close_} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editPost ? 'Save Changes' : 'Create Post'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={deleteId !== null} onClose={() => setDeleteId(null)} labelId="del-post-title">
        <div className="p-6">
          <h2 id="del-post-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Featured Post</h2>
          <p className="text-sm text-gray-500 mb-6">This cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
            <button onClick={() => deleteId !== null && deleteM.mutate(deleteId)} className="btn-danger" disabled={deleteM.isPending}>
              {deleteM.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section B \u2014 Activity Slides (home-page slider)
// ─────────────────────────────────────────────────────────────────────────────

interface SlideForm {
  title: string; description: string; organizer: string
  tag_type: string; order: number; is_active: boolean
}

const EMPTY_SLIDE: SlideForm = {
  title: '', description: '', organizer: '', tag_type: 'lydo_program', order: 0, is_active: true,
}

function ActivitySlidesTab() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editSlide, setEditSlide] = useState<FeaturedSlide | null>(null)
  const [form, setForm] = useState<SlideForm>(EMPTY_SLIDE)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState<string | null>(null)
  const [removeImg, setRemoveImg] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-featured-slides'],
    queryFn: () => apiClient.get(SLIDES_URL).then(r => toArray<FeaturedSlide>(r.data)).catch(() => []),
  })
  const slides = data ?? []

  const createM = useMutation({
    mutationFn: (fd: FormData) => apiClient.post(SLIDES_URL, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-featured-slides'] }); close_() },
  })
  const updateM = useMutation({
    mutationFn: ({ id, fd }: { id: number; fd: FormData }) =>
      apiClient.patch(`${SLIDES_URL}${id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-featured-slides'] }); close_() },
  })
  const deleteM = useMutation({
    mutationFn: (id: number) => apiClient.delete(`${SLIDES_URL}${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-featured-slides'] }); setDeleteId(null) },
  })
  const moveM = useMutation({
    mutationFn: ({ id, dir }: { id: number; dir: 'move-up' | 'move-down' }) =>
      apiClient.post(`${SLIDES_URL}${id}/${dir}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-featured-slides'] }),
  })
  const toggleActive = (slide: FeaturedSlide) =>
    apiClient.patch(`${SLIDES_URL}${slide.id}/`, { is_active: !slide.is_active })
      .then(() => qc.invalidateQueries({ queryKey: ['admin-featured-slides'] }))

  function openCreate() { setEditSlide(null); setForm(EMPTY_SLIDE); resetImg(); setModalOpen(true) }
  function openEdit(s: FeaturedSlide) {
    setEditSlide(s)
    setForm({ title: s.title, description: s.description, organizer: s.organizer, tag_type: s.tag_type, order: s.order, is_active: s.is_active })
    resetImg()
    if (s.image_url) setImgPreview(s.image_url)
    setModalOpen(true)
  }
  function close_() { setModalOpen(false); setEditSlide(null); setForm(EMPTY_SLIDE); resetImg() }
  function resetImg() { setImgFile(null); setImgPreview(null); setRemoveImg(false); if (fileRef.current) fileRef.current.value = '' }
  function handleImgFile(f: File) { setImgFile(f); setRemoveImg(false); const r = new FileReader(); r.onloadend = () => setImgPreview(r.result as string); r.readAsDataURL(f) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('description', form.description)
    fd.append('organizer', form.organizer)
    fd.append('tag_type', form.tag_type)
    fd.append('order', String(form.order))
    fd.append('is_active', form.is_active ? 'true' : 'false')
    if (imgFile) fd.append('image', imgFile)
    if (removeImg) fd.append('image', '')
    editSlide ? updateM.mutate({ id: editSlide.id, fd }) : createM.mutate(fd)
  }

  const setF = <K extends keyof SlideForm>(k: K, v: SlideForm[K]) => setForm(p => ({ ...p, [k]: v }))
  const saving = createM.isPending || updateM.isPending

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Photos and activity highlights shown in the home-page slider
        </p>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Add Slide
        </button>
      </div>

      {/* Info callout */}
      <div className="mb-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
        <Images size={16} className="mt-0.5 flex-shrink-0" />
        <span>Slides appear in the <strong>Featured Programs</strong> slider on the youth landing page. Use the arrows to reorder them.</span>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading&hellip;</div>
      ) : slides.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">No slides yet. Click &ldquo;Add Slide&rdquo; to create the first one.</div>
      ) : (
        <div className="space-y-3">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className={cn(
                'card flex items-center gap-4 p-4 transition-all',
                !slide.is_active && 'opacity-50'
              )}
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                {slide.image_url
                  ? <img src={slide.image_url} alt={slide.title} className="w-full h-full object-cover" loading="lazy" />
                  : <div className="w-full h-full grid place-items-center"><ImagePlus size={18} className="text-gray-300" /></div>
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', TAG_BADGE_COLORS[slide.tag_type] ?? 'bg-gray-100 text-gray-600')}>
                    {slide.tag_label}
                  </span>
                  {!slide.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Hidden</span>
                  )}
                </div>
                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">{slide.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{slide.organizer}</p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Move up/down */}
                <button
                  onClick={() => moveM.mutate({ id: slide.id, dir: 'move-up' })}
                  disabled={idx === 0 || moveM.isPending}
                  aria-label="Move up"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                ><ChevronUp size={15} /></button>
                <button
                  onClick={() => moveM.mutate({ id: slide.id, dir: 'move-down' })}
                  disabled={idx === slides.length - 1 || moveM.isPending}
                  aria-label="Move down"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                ><ChevronDown size={15} /></button>

                {/* Toggle visible */}
                <button
                  onClick={() => toggleActive(slide)}
                  aria-label={slide.is_active ? 'Hide slide' : 'Show slide'}
                  className={cn('p-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800',
                    slide.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-400')}
                >
                  {slide.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>

                {/* Edit */}
                <button
                  onClick={() => openEdit(slide)}
                  aria-label={`Edit "${slide.title}"`}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-primary-700 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                ><Pencil size={14} /></button>

                {/* Delete */}
                <button
                  onClick={() => setDeleteId(slide.id)}
                  aria-label={`Delete "${slide.title}"`}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                ><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal isOpen={modalOpen} onClose={close_} labelId="slide-modal-title">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="slide-modal-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {editSlide ? 'Edit Activity Slide' : 'New Activity Slide'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="s-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
            <input id="s-title" className="input w-full" value={form.title} onChange={e => setF('title', e.target.value)} required placeholder="e.g. Barangay-Level Youth Training" />
          </div>
          <div>
            <label htmlFor="s-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
            <textarea id="s-desc" className="input w-full min-h-[80px] resize-y" value={form.description} onChange={e => setF('description', e.target.value)} required placeholder="Short description of the activity" />
          </div>
          <div>
            <label htmlFor="s-org" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organizer *</label>
            <input id="s-org" className="input w-full" value={form.organizer} onChange={e => setF('organizer', e.target.value)} required placeholder="e.g. Lucena City Youth Development Office" />
          </div>
          <div>
            <label htmlFor="s-tag" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category Tag *</label>
            <select id="s-tag" className="input w-full" value={form.tag_type} onChange={e => setF('tag_type', e.target.value)} required>
              {TAG_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Photo <span className="text-gray-400 font-normal">(recommended: 1280&times;720 JPG)</span>
            </label>
            <ImageUploadWidget
              preview={imgPreview}
              onFile={handleImgFile}
              onRemove={() => { setImgFile(null); setImgPreview(null); setRemoveImg(true); if (fileRef.current) fileRef.current.value = '' }}
              fileRef={fileRef}
            />
          </div>
          <div>
            <label htmlFor="s-order" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order <span className="text-gray-400 font-normal">(lower = first)</span></label>
            <input id="s-order" type="number" className="input w-full" value={form.order} onChange={e => setF('order', Number(e.target.value))} min={0} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-primary-700" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Visible on home page</span>
          </label>
          {(createM.error || updateM.error) && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Failed to save. Please try again.</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={close_} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editSlide ? 'Save Changes' : 'Add Slide'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={deleteId !== null} onClose={() => setDeleteId(null)} labelId="del-slide-title">
        <div className="p-6">
          <h2 id="del-slide-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Slide</h2>
          <p className="text-sm text-gray-500 mb-6">This will permanently remove the slide from the home-page slider.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
            <button onClick={() => deleteId !== null && deleteM.mutate(deleteId)} className="btn-danger" disabled={deleteM.isPending}>
              {deleteM.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root page \u2014 tabs
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'posts' | 'slides'

export default function AdminFeaturedPage() {
  const [tab, setTab] = useState<Tab>('slides')

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Featured Content</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Manage what appears on the youth portal&apos;s home page
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('slides')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'slides'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          )}
        >
          <Images size={15} /> Activity Slides
        </button>
        <button
          onClick={() => setTab('posts')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'posts'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          )}
        >
          <Newspaper size={15} /> Featured Posts
        </button>
      </div>

      {/* Tab content */}
      {tab === 'slides' ? <ActivitySlidesTab /> : <FeaturedPostsTab />}
    </div>
  )
}
