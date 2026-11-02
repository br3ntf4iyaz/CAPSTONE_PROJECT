import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BookOpen, Award, ScrollText, Plus, Edit2, Eye, EyeOff,
  Star, X, Trash2, Award as BadgeIcon, User, ImagePlus, LayoutList,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, cn, toArray } from '@/utils'
import type { Course } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Badge {
  id: number
  name: string
  description: string
  category: string
  criteria?: string
  is_active: boolean
  created_at: string
}

interface Certificate {
  id: number
  title: string
  issued_by: string
  issued_at: string
  expiry_date?: string
  certificate_number: string
  user: number
  user_full_name?: string
  enrollment?: number
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ['leadership', 'governance', 'life_skills', 'tech', 'finance', 'communication']
const BADGE_CATEGORIES = ['course', 'governance', 'internship', 'project', 'special']

interface AdminUserOption { id: number; email: string; first_name: string; last_name: string }

const initialCourseForm = {
  title: '', category: 'leadership', description: '', instructor_id: '' as string | number,
  duration_hours: '', is_published: false, is_featured: false,
}

const initialBadgeForm = {
  name: '', description: '', category: 'course', criteria: '', is_active: true,
}

const BADGE_CAT_COLORS: Record<string, string> = {
  course: 'badge-blue',
  governance: 'badge-purple',
  internship: 'badge-yellow',
  project: 'badge-green',
  special: 'badge-gray',
}

type Tab = 'courses' | 'badges' | 'certificates'

export default function AdminLMSPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('courses')

  // ── Course state ──────────────────────────────────────────────────────────
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [editCourse, setEditCourse] = useState<Course | null>(null)
  const [courseForm, setCourseForm] = useState({ ...initialCourseForm })
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const [enrollTarget, setEnrollTarget] = useState<Course | null>(null)

  // ── Badge state ───────────────────────────────────────────────────────────
  const [showBadgeModal, setShowBadgeModal] = useState(false)
  const [editBadge, setEditBadge] = useState<Badge | null>(null)
  const [badgeForm, setBadgeForm] = useState({ ...initialBadgeForm })

  // ─── Courses queries ──────────────────────────────────────────────────────
  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ['admin-courses'],
    queryFn: () => apiClient.get('/courses/admin/courses/').then(r => toArray<Course>(r.data)),
    enabled: activeTab === 'courses',
  })

  const { data: adminUsers = [] } = useQuery<AdminUserOption[]>({
    queryKey: ['admin-users-list'],
    queryFn: () => apiClient.get('/auth/admin/users/').then(r => toArray<AdminUserOption>(r.data)),
    enabled: showCourseModal,
  })

  const buildCourseFormData = (form: typeof courseForm) => {
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('category', form.category)
    fd.append('description', form.description)
    fd.append('duration_hours', form.duration_hours ? String(Number(form.duration_hours)) : '0')
    fd.append('is_published', String(form.is_published))
    fd.append('is_featured', String(form.is_featured))
    if (form.instructor_id) fd.append('instructor_id', String(form.instructor_id))
    if (thumbnailFile) fd.append('thumbnail', thumbnailFile)
    return fd
  }

  const createCourse = useMutation({
    mutationFn: (form: typeof courseForm) =>
      apiClient.post('/courses/admin/courses/', buildCourseFormData(form), {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-courses'] }); toast.success('Course created'); closeCourseModal() },
    onError: () => toast.error('Failed to create course'),
  })

  const updateCourse = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Course> | FormData }) =>
      data instanceof FormData
        ? apiClient.patch(`/courses/admin/courses/${id}/`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
        : apiClient.patch(`/courses/admin/courses/${id}/`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-courses'] }); toast.success('Course updated'); closeCourseModal() },
    onError: () => toast.error('Failed to update course'),
  })

  const openCourseCreate = () => {
    setEditCourse(null)
    setCourseForm({ ...initialCourseForm })
    setThumbnailFile(null)
    setThumbnailPreview(null)
    setShowCourseModal(true)
  }
  const openCourseEdit = (c: Course) => {
    setEditCourse(c)
    const instructorData = c.instructor as unknown as { id: number } | null
    setCourseForm({
      title: c.title, category: c.category, description: c.description,
      instructor_id: instructorData?.id ?? '',
      duration_hours: c.duration_hours?.toString() ?? '',
      is_published: c.is_published, is_featured: c.is_featured,
    })
    setThumbnailFile(null)
    setThumbnailPreview(c.thumbnail_url ?? null)
    setShowCourseModal(true)
  }
  const closeCourseModal = () => {
    setShowCourseModal(false)
    setEditCourse(null)
    setCourseForm({ ...initialCourseForm })
    setThumbnailFile(null)
    setThumbnailPreview(null)
  }

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setThumbnailFile(file)
    setThumbnailPreview(URL.createObjectURL(file))
  }

  const handleCourseSubmit = () => {
    if (!courseForm.title) { toast.error('Title is required'); return }
    if (editCourse) {
      updateCourse.mutate({ id: editCourse.id, data: buildCourseFormData(courseForm) })
    } else {
      createCourse.mutate(courseForm)
    }
  }

  // ─── Badges queries ───────────────────────────────────────────────────────
  const { data: badges = [], isLoading: badgesLoading } = useQuery<Badge[]>({
    queryKey: ['admin-badges'],
    queryFn: () => apiClient.get('/recognition/badges/').then(r => toArray<Badge>(r.data)),
    enabled: activeTab === 'badges',
  })

  const createBadge = useMutation({
    mutationFn: (data: typeof badgeForm) => apiClient.post('/recognition/badges/', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-badges'] }); toast.success('Badge created'); closeBadgeModal() },
    onError: () => toast.error('Failed to create badge'),
  })

  const updateBadge = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof badgeForm }) => apiClient.patch(`/recognition/badges/${id}/`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-badges'] }); toast.success('Badge updated'); closeBadgeModal() },
    onError: () => toast.error('Failed to update badge'),
  })

  const deleteBadge = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/recognition/badges/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-badges'] }); toast.success('Badge deleted') },
    onError: () => toast.error('Failed to delete badge'),
  })

  const openBadgeCreate = () => { setEditBadge(null); setBadgeForm({ ...initialBadgeForm }); setShowBadgeModal(true) }
  const openBadgeEdit = (b: Badge) => {
    setEditBadge(b)
    setBadgeForm({ name: b.name, description: b.description, category: b.category, criteria: b.criteria ?? '', is_active: b.is_active })
    setShowBadgeModal(true)
  }
  const closeBadgeModal = () => { setShowBadgeModal(false); setEditBadge(null); setBadgeForm({ ...initialBadgeForm }) }

  const handleBadgeSubmit = () => {
    if (!badgeForm.name) { toast.error('Badge name is required'); return }
    if (editBadge) updateBadge.mutate({ id: editBadge.id, data: badgeForm })
    else createBadge.mutate(badgeForm)
  }

  // ─── Certificates queries ─────────────────────────────────────────────────
  const { data: certificates = [], isLoading: certsLoading } = useQuery<Certificate[]>({
    queryKey: ['admin-certificates'],
    queryFn: () => apiClient.get('/courses/certificates/').then(r => toArray<Certificate>(r.data)),
    enabled: activeTab === 'certificates',
  })

  const isLoading =
    (activeTab === 'courses' && coursesLoading) ||
    (activeTab === 'badges' && badgesLoading) ||
    (activeTab === 'certificates' && certsLoading)

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'courses', label: 'Courses', icon: BookOpen },
    { key: 'badges', label: 'Badges', icon: Award },
    { key: 'certificates', label: 'Certificates', icon: ScrollText },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Learning &amp; Recognition</h1>
        <p className="page-subtitle">Manage courses, digital badges, and issued certificates</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === key
                ? 'border-primary-700 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon size={14} /> {label}
            {key === 'courses' && courses.length > 0 && (
              <span className="ml-1 text-xs text-gray-400">({courses.length})</span>
            )}
            {key === 'badges' && badges.length > 0 && (
              <span className="ml-1 text-xs text-gray-400">({badges.length})</span>
            )}
            {key === 'certificates' && certificates.length > 0 && (
              <span className="ml-1 text-xs text-gray-400">({certificates.length})</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? <PageSpinner /> : (
        <>
          {/* ── Courses Tab ─────────────────────────────────────────────────── */}
          {activeTab === 'courses' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={openCourseCreate} className="btn-primary btn-sm flex items-center gap-1.5">
                  <Plus size={14} /> Add Course
                </button>
              </div>

              <div className="table-wrap">
                {courses.length === 0 ? (
                  <EmptyState icon={BookOpen} title="No courses yet" description="Add your first course to get started." className="py-12" />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Instructor</th>
                        <th>Duration</th>
                        <th>Enrollments</th>
                        <th>Published</th>
                        <th>Featured</th>
                        <th>Content</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map(c => (
                        <tr key={c.id}>
                          <td className="font-medium">{c.title}</td>
                          <td className="capitalize text-xs">{c.category.replace('_', ' ')}</td>
                          <td className="text-xs text-gray-500">{(c as any).instructor_name ?? (c.instructor as unknown as { full_name?: string } | null)?.full_name ?? '\u2014'}</td>
                          <td className="text-xs">{c.duration_hours ? `${c.duration_hours}h` : '\u2014'}</td>
                          <td>
                            <button
                              onClick={() => setEnrollTarget(enrollTarget?.id === c.id ? null : c)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              {c.enrollment_count}
                            </button>
                          </td>
                          <td>
                            <button
                              onClick={() => updateCourse.mutate({ id: c.id, data: { is_published: !c.is_published } })}
                              className={cn('p-1.5 rounded-lg transition-colors', c.is_published ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200')}
                              title={c.is_published ? 'Unpublish' : 'Publish'}
                            >
                              {c.is_published ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                          </td>
                          <td>
                            <button
                              onClick={() => updateCourse.mutate({ id: c.id, data: { is_featured: !c.is_featured } })}
                              className={cn('p-1.5 rounded-lg transition-colors', c.is_featured ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400')}
                              title={c.is_featured ? 'Unfeature' : 'Feature'}
                            >
                              <Star size={14} fill={c.is_featured ? 'currentColor' : 'none'} />
                            </button>
                          </td>
                          <td>
                            <Link
                              to={`/admin/lms/courses/${c.id}/builder`}
                              className="btn-secondary btn-sm text-xs p-1.5 flex items-center gap-1 w-fit"
                              title="Build course content"
                            >
                              <LayoutList size={13} /> Build
                            </Link>
                          </td>
                          <td>
                            <button onClick={() => openCourseEdit(c)} className="btn-secondary btn-sm text-xs p-1.5">
                              <Edit2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {enrollTarget && (
                <div className="card p-4 border-l-4 border-blue-400">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">Enrollment Stats &mdash; {enrollTarget.title}</h3>
                    <button onClick={() => setEnrollTarget(null)}><X size={16} className="text-gray-400" /></button>
                  </div>
                  <p className="text-sm text-gray-600">Total enrollments: <strong>{enrollTarget.enrollment_count}</strong></p>
                  <p className="text-xs text-gray-400 mt-1">Detailed per-learner stats are available in the Analytics section.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Badges Tab ──────────────────────────────────────────────────── */}
          {activeTab === 'badges' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Define the badges youth can earn across all activities</p>
                <button onClick={openBadgeCreate} className="btn-primary btn-sm flex items-center gap-1.5">
                  <Plus size={14} /> Add Badge
                </button>
              </div>

              <div className="table-wrap">
                {badges.length === 0 ? (
                  <EmptyState icon={BadgeIcon} title="No badges defined" description="Create badges to award to youth for their achievements." className="py-12" />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Badge Name</th>
                        <th>Category</th>
                        <th>Criteria</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {badges.map(b => (
                        <tr key={b.id}>
                          <td>
                            <p className="font-medium text-sm">{b.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{b.description}</p>
                          </td>
                          <td>
                            <span className={cn('badge text-[10px] capitalize', BADGE_CAT_COLORS[b.category] ?? 'badge-gray')}>
                              {b.category}
                            </span>
                          </td>
                          <td className="text-xs text-gray-500 max-w-[200px]">
                            {b.criteria ? (
                              <span title={b.criteria}>{b.criteria.length > 60 ? b.criteria.slice(0, 60) + '…' : b.criteria}</span>
                            ) : (
                              <span className="text-gray-300">No criteria set</span>
                            )}
                          </td>
                          <td>
                            <span className={b.is_active ? 'badge-green' : 'badge-gray'}>
                              {b.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="text-xs text-gray-500">{formatDate(b.created_at)}</td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openBadgeEdit(b)} className="btn-secondary btn-sm text-xs p-1.5" title="Edit"><Edit2 size={13} /></button>
                              <button
                                onClick={() => window.confirm(`Delete badge "${b.name}"?`) && deleteBadge.mutate(b.id)}
                                className="btn-danger btn-sm text-xs p-1.5"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Certificates Tab ─────────────────────────────────────────────── */}
          {activeTab === 'certificates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">All certificates issued to youth through the platform</p>
                <div className="text-xs text-gray-400">Certificates are auto-generated upon course completion</div>
              </div>

              <div className="table-wrap">
                {certificates.length === 0 ? (
                  <EmptyState icon={ScrollText} title="No certificates issued" description="Certificates will appear here when youth complete courses." className="py-12" />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Certificate Title</th>
                        <th>Issued To</th>
                        <th>Issued By</th>
                        <th>Issue Date</th>
                        <th>Expiry</th>
                        <th>Certificate No.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {certificates.map(cert => (
                        <tr key={cert.id}>
                          <td className="font-medium text-sm">{cert.title}</td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <User size={12} className="text-gray-400" />
                              <span className="text-xs">{cert.user_full_name ?? `User #${cert.user}`}</span>
                            </div>
                          </td>
                          <td className="text-xs text-gray-500">{cert.issued_by}</td>
                          <td className="text-xs text-gray-500">{formatDate(cert.issued_at)}</td>
                          <td className="text-xs text-gray-500">
                            {cert.expiry_date ? formatDate(cert.expiry_date) : (
                              <span className="text-green-600 font-medium">No expiry</span>
                            )}
                          </td>
                          <td className="text-xs font-mono text-gray-500">{cert.certificate_number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Course Modal ───────────────────────────────────────────────────────── */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={closeCourseModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">{editCourse ? 'Edit Course' : 'Add New Course'}</h2>
              <button onClick={closeCourseModal} aria-label="Close" className="p-1 rounded hover:bg-gray-100">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Thumbnail */}
              <div>
                <label className="label">Thumbnail</label>
                <div
                  className="relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-primary-400 transition-colors"
                  style={{ height: 140 }}
                  onClick={() => thumbnailInputRef.current?.click()}
                >
                  {thumbnailPreview ? (
                    <>
                      <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <ImagePlus size={22} className="text-white" />
                        <span className="ml-2 text-white text-sm font-medium">Change image</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                      <ImagePlus size={28} />
                      <span className="text-sm">Click to upload a course thumbnail</span>
                      <span className="text-xs">JPG, PNG, WebP — max 10 MB</span>
                    </div>
                  )}
                </div>
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleThumbnailChange}
                />
                {thumbnailPreview && (
                  <button
                    type="button"
                    className="mt-1.5 text-xs text-red-500 hover:text-red-700"
                    onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); if (thumbnailInputRef.current) thumbnailInputRef.current.value = '' }}
                  >
                    Remove thumbnail
                  </button>
                )}
              </div>

              <div>
                <label className="label">Title *</label>
                <input className="input" value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} placeholder="Course title" />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={courseForm.category} onChange={e => setCourseForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-[80px]" value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} placeholder="Course description…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Instructor</label>
                  <select
                    className="input"
                    value={String(courseForm.instructor_id)}
                    onChange={e => setCourseForm(f => ({ ...f, instructor_id: e.target.value }))}
                  >
                    <option value="">— No instructor —</option>
                    {adminUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Duration (hours)</label>
                  <input type="number" className="input" value={courseForm.duration_hours} onChange={e => setCourseForm(f => ({ ...f, duration_hours: e.target.value }))} placeholder="e.g. 8" min={0} />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={courseForm.is_published} onChange={e => setCourseForm(f => ({ ...f, is_published: e.target.checked }))} className="w-4 h-4 accent-primary-700" />
                  <span className="text-sm text-gray-700">Published</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={courseForm.is_featured} onChange={e => setCourseForm(f => ({ ...f, is_featured: e.target.checked }))} className="w-4 h-4 accent-yellow-500" />
                  <span className="text-sm text-gray-700">Featured</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeCourseModal} className="btn-secondary btn-sm">Cancel</button>
              <button onClick={handleCourseSubmit} disabled={createCourse.isPending || updateCourse.isPending} className="btn-primary btn-sm">
                {(createCourse.isPending || updateCourse.isPending) ? 'Saving…' : editCourse ? 'Save Changes' : 'Add Course'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Badge Modal ────────────────────────────────────────────────────────── */}
      {showBadgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={closeBadgeModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">{editBadge ? 'Edit Badge' : 'Create Badge'}</h2>
              <button onClick={closeBadgeModal} aria-label="Close" className="p-1 rounded hover:bg-gray-100">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Badge Name *</label>
                <input className="input" value={badgeForm.name} onChange={e => setBadgeForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Course Completer" />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={badgeForm.category} onChange={e => setBadgeForm(f => ({ ...f, category: e.target.value }))}>
                  {BADGE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-[70px]" value={badgeForm.description} onChange={e => setBadgeForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this badge represent?" />
              </div>
              <div>
                <label className="label">Earning Criteria</label>
                <textarea className="input min-h-[60px]" value={badgeForm.criteria} onChange={e => setBadgeForm(f => ({ ...f, criteria: e.target.value }))} placeholder="How does a youth earn this badge?" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={badgeForm.is_active} onChange={e => setBadgeForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-primary-700" />
                <span className="text-sm text-gray-700">Active (awardable to youth)</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeBadgeModal} className="btn-secondary btn-sm">Cancel</button>
              <button onClick={handleBadgeSubmit} disabled={createBadge.isPending || updateBadge.isPending} className="btn-primary btn-sm">
                {(createBadge.isPending || updateBadge.isPending) ? 'Saving…' : editBadge ? 'Save Changes' : 'Create Badge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
