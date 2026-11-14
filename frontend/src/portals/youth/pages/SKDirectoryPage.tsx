import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Search, CheckCircle2, Circle, ChevronDown, ChevronUp, X, Mail, Phone, MapPin, Award, Camera, Star, MessageSquare, ImagePlus } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { skFeedbackApi } from '@/api/skFeedback'
import OrgCalendarWidget from '@/components/ui/OrgCalendarWidget'
import { useAuthStore } from '@/store/authStore'
import { formatDate, cn } from '@/utils'

interface Requirement {
  key: string
  label: string
  status: 'submitted' | 'pending' | 'overdue'
  submitted_at?: string
}

interface SKMember {
  id: number
  name: string
  position: 'kagawad' | 'secretary' | 'treasurer'
  position_display: string
  photo_url: string | null
}

interface SKBarangay {
  members?: SKMember[]
  id: number
  barangay_name: string
  sk_chairperson: string
  contact_email: string
  contact_phone: string
  logo_url: string | null
  submitted_count: number
  pending_count: number
  overdue_count: number
  requirements?: Requirement[]
}

const CATEGORIES = [
  { value: 'concern', label: 'Concern' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'praise', label: 'Praise' },
] as const

function FeedbackModal({ barangayName, onClose }: { barangayName: string; onClose: () => void }) {
  const [category, setCategory] = useState<'concern' | 'suggestion' | 'praise'>('concern')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB.'); return }
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImage(null); setImagePreview(null)
  }

  const mutation = useMutation({
    mutationFn: () => skFeedbackApi.submit({ category, subject, message, rating, is_anonymous: isAnonymous, image }),
    onSuccess: () => {
      toast.success('Feedback submitted. Thank you!')
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to submit feedback.'
      toast.error(msg)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    mutation.mutate()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-ink-100">
          <div>
            <h2 className="font-display font-bold text-lg text-ink-900">Send Feedback</h2>
            <p className="text-sm text-ink-500 mt-0.5">To SK {barangayName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-1.5 uppercase tracking-wide">Category</label>
            <div className="flex gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                    category === c.value
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-primary-300',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-1.5 uppercase tracking-wide">Subject</label>
            <input
              className="input"
              type="text"
              placeholder="Brief subject..."
              value={subject}
              maxLength={200}
              onChange={e => setSubject(e.target.value)}
              required
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-1.5 uppercase tracking-wide">Message</label>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Describe your feedback..."
              value={message}
              maxLength={2000}
              onChange={e => setMessage(e.target.value)}
              required
            />
            <p className="text-xs text-ink-400 mt-1 text-right">{message.length}/2000</p>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-1.5 uppercase tracking-wide">
              Rating <span className="text-ink-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? null : n)}
                  className={cn(
                    'w-9 h-9 rounded-lg text-lg transition-colors',
                    n <= (rating ?? 0)
                      ? 'text-amber-400 bg-amber-50 border border-amber-200'
                      : 'text-ink-300 bg-ink-50 border border-ink-100 hover:border-ink-300',
                  )}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Photo attachment */}
          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-1.5 uppercase tracking-wide">
              Photo <span className="font-normal text-ink-400">(optional)</span>
            </label>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="preview" className="w-full max-h-40 object-cover rounded-xl border border-ink-200" />
                <button type="button" onClick={removeImage} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-ink-300 hover:border-primary-400 text-sm text-ink-500 hover:text-primary-700 transition-colors"
              >
                <ImagePlus size={15} /> Add a photo
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>

          {/* Anonymous */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className={cn(
                'w-10 h-6 rounded-full transition-colors flex-shrink-0',
                isAnonymous ? 'bg-primary-600' : 'bg-ink-200',
              )}
              onClick={() => setIsAnonymous(v => !v)}
            >
              <div className={cn(
                'w-5 h-5 bg-white rounded-full shadow-sm mt-0.5 transition-transform',
                isAnonymous ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5',
              )} />
            </div>
            <span className="text-sm text-ink-700">Submit anonymously</span>
          </label>

          <button
            type="submit"
            disabled={mutation.isPending || !subject.trim() || !message.trim()}
            className="w-full btn-primary"
          >
            {mutation.isPending ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  )
}

function MemberAvatar({ m }: { m: SKMember }) {
  const initials = m.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex flex-col items-center text-center gap-1.5 min-w-0">
      <div className="w-14 h-14 rounded-full overflow-hidden bg-primary-100 text-primary-700 flex items-center justify-center font-bold border-2 border-white shadow-sm">
        {m.photo_url ? <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" /> : initials}
      </div>
      <p className="text-xs font-semibold text-ink-900 leading-tight break-words w-full">{m.name}</p>
      <p className="text-[10px] text-ink-500 leading-tight">{m.position_display}</p>
    </div>
  )
}

function SKProfileModal({ barangay, onClose }: { barangay: SKBarangay; onClose: () => void }) {
  const total = barangay.submitted_count + barangay.pending_count + barangay.overdue_count
  const pct = total > 0 ? Math.round((barangay.submitted_count / total) * 100) : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary-600 to-primary-800 px-6 pt-8 pb-10 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center mb-4 overflow-hidden">
            {barangay.logo_url
              ? <img src={barangay.logo_url} alt={barangay.barangay_name} className="w-full h-full object-cover" />
              : <Award size={34} className="text-white" />
            }
          </div>
          <h2 className="font-display font-extrabold text-2xl leading-tight mb-1">
            {barangay.sk_chairperson || 'SK Chairperson'}
          </h2>
          <p className="text-primary-100 text-base font-semibold">SK Chairperson · {barangay.barangay_name}</p>
        </div>

        {/* Info cards */}
        <div className="-mt-5 mx-4 bg-white rounded-2xl border border-ink-100 shadow-sm p-4 space-y-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-ink-500 font-medium">Barangay</p>
              <p className="font-semibold text-base text-ink-900">{barangay.barangay_name}</p>
            </div>
          </div>

          {barangay.contact_email && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Mail size={16} className="text-primary-600" />
              </div>
              <div>
                <p className="text-xs text-ink-500 font-medium">Email</p>
                <a href={`mailto:${barangay.contact_email}`} className="font-semibold text-sm text-primary-700 hover:underline">
                  {barangay.contact_email}
                </a>
              </div>
            </div>
          )}

          {barangay.contact_phone && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Phone size={16} className="text-primary-600" />
              </div>
              <div>
                <p className="text-xs text-ink-500 font-medium">Phone</p>
                <a href={`tel:${barangay.contact_phone}`} className="font-semibold text-sm text-primary-700 hover:underline">
                  {barangay.contact_phone}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Compliance */}
        <div className="px-4 py-4">
          <p className="text-xs font-semibold text-ink-500 mb-2.5 uppercase tracking-wide">Compliance</p>
          <div className="flex items-center gap-3 mb-2.5">
            <div className="flex-1 h-2.5 bg-ink-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-base font-bold text-ink-900 w-12 text-right">{pct}%</span>
          </div>
          <div className="flex gap-2">
            <span className="badge badge-green text-sm">{barangay.submitted_count} submitted</span>
            <span className="badge badge-gray text-sm">{barangay.pending_count} pending</span>
            {barangay.overdue_count > 0 && <span className="badge badge-red text-sm">{barangay.overdue_count} overdue</span>}
          </div>
        </div>

        {/* Council officials */}
        {(barangay.members?.length ?? 0) > 0 && (
          <div className="px-4 pb-5">
            <p className="text-xs font-semibold text-ink-500 mb-3 uppercase tracking-wide">SK Council</p>
            <div className="flex flex-col items-center mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-600 text-white flex items-center justify-center font-bold border-2 border-white shadow">
                {barangay.logo_url
                  ? <img src={barangay.logo_url} alt={barangay.sk_chairperson} className="w-full h-full object-cover" />
                  : (barangay.sk_chairperson || 'SK').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <p className="text-sm font-bold text-ink-900 mt-1.5 text-center">{barangay.sk_chairperson || 'SK Chairperson'}</p>
              <p className="text-[11px] text-ink-500">SK Chairperson</p>
            </div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-4">
              {(barangay.members ?? []).map(m => <MemberAvatar key={m.id} m={m} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const isSubmitted = (s: string) => s === 'submitted'

const reqIcon = (status: string): React.ReactNode =>
  isSubmitted(status)
    ? <CheckCircle2 size={14} className="text-green-500" />
    : <Circle size={14} className="text-ink-400" />

const reqBadge = (status: string): string =>
  isSubmitted(status) ? 'badge-green' : 'badge-gray'

const reqLabel = (status: string): string =>
  isSubmitted(status) ? 'Submitted' : 'Not Yet Submitted'

function BarangayCard({
  b,
  onViewProfile,
  canEditLogo,
  isOwn,
  onSendFeedback,
}: {
  b: SKBarangay
  onViewProfile: (b: SKBarangay) => void
  canEditLogo: boolean
  isOwn: boolean
  onSendFeedback?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const total = b.submitted_count + b.pending_count + b.overdue_count
  const pct = total > 0 ? Math.round((b.submitted_count / total) * 100) : 0
  const notYet = b.pending_count + b.overdue_count

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('logo', file)
      return apiClient
        .post(`/sk-requirements/barangays/${b.id}/upload_logo/`, fd, {
          headers: { 'Content-Type': undefined },
        })
        .then(r => r.data as { logo_url: string })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sk-barangays-directory'] })
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadLogoMutation.mutate(file)
    e.target.value = ''
  }

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-paper-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-4 min-w-0">
          {/* Logo / icon — bigger so uploaded logos are visible */}
          <div className="relative w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center flex-shrink-0 overflow-hidden group">
            {b.logo_url
              ? <img src={b.logo_url} alt={b.barangay_name} className="w-full h-full object-cover" />
              : <Users size={24} className="text-primary-600" />
            }
            {canEditLogo && (
              <button
                type="button"
                title="Upload barangay logo"
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                className={cn(
                  'absolute inset-0 flex items-center justify-center rounded-2xl transition-opacity',
                  'bg-black/50 opacity-0 group-hover:opacity-100',
                  uploadLogoMutation.isPending && 'opacity-100',
                )}
              >
                {uploadLogoMutation.isPending
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera size={16} className="text-white" />
                }
              </button>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-base text-ink-900">{b.barangay_name}</p>
              {isOwn && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold leading-none flex-shrink-0">
                  <Star size={10} className="fill-current" /> Yours
                </span>
              )}
            </div>
            {b.sk_chairperson && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onViewProfile(b) }}
                className="text-sm text-primary-600 hover:text-primary-800 hover:underline font-medium transition-colors mt-0.5 text-left"
              >
                {b.sk_chairperson}
              </button>
            )}
            {/* Mobile compliance summary */}
            <div className="flex items-center gap-2 mt-1 sm:hidden">
              <div className="flex-1 h-1.5 bg-ink-200 rounded-full overflow-hidden max-w-[80px]">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-semibold text-ink-600">{pct}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Progress bar — desktop */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-2 bg-ink-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold text-ink-700 w-9">{pct}%</span>
          </div>
          <div className="hidden sm:flex gap-1.5">
            <span className="badge badge-green text-xs">{b.submitted_count} done</span>
            <span className="badge badge-gray text-xs">{notYet} left</span>
          </div>
          {expanded ? <ChevronUp size={18} className="text-ink-400" /> : <ChevronDown size={18} className="text-ink-400" />}
        </div>
      </button>

      {/* Hidden file input for logo upload */}
      {canEditLogo && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {uploadLogoMutation.isError && (
        <p className="px-5 pb-2 text-sm text-red-600">
          Upload failed — please try a smaller image.
        </p>
      )}

      {isOwn && onSendFeedback && (
        <div className="px-5 pb-4">
          <button
            type="button"
            onClick={onSendFeedback}
            className="flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-900 bg-primary-50 hover:bg-primary-100 px-4 py-2 rounded-xl transition-colors border border-primary-100"
          >
            <MessageSquare size={15} />
            Send Feedback to Your SK
          </button>
        </div>
      )}

      {expanded && b.requirements && b.requirements.length > 0 && (
        <div className="border-t border-ink-100 px-5 py-4 space-y-2.5">
          {b.requirements.map(req => (
            <div key={req.key} className="flex items-center justify-between gap-3 py-0.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {reqIcon(req.status)}
                <span className="text-sm text-ink-700">{req.label}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {req.submitted_at && <span className="text-xs text-ink-500">{formatDate(req.submitted_at)}</span>}
                <span className={cn('badge text-xs', reqBadge(req.status))}>{reqLabel(req.status)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const TOP_N = 10

export default function SKDirectoryPage() {
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [profileBarangay, setProfileBarangay] = useState<SKBarangay | null>(null)
  const [feedbackBarangay, setFeedbackBarangay] = useState<SKBarangay | null>(null)

  const auth = useAuthStore()
  const userBarangay = auth.user?.profile.barangay?.trim().toLowerCase() ?? ''
  const isSKUser = auth.user?.youth_type === 'sk'
  const isAdmin = auth.user?.role === 'lgu_admin' || auth.user?.role === 'super_admin'
  const canSendFeedback = !!auth.user && !isSKUser && !isAdmin

  const { data: barangays = [], isLoading } = useQuery<SKBarangay[]>({
    queryKey: ['sk-barangays-directory'],
    queryFn: () =>
      apiClient.get('/sk-requirements/barangays/').then(r => {
        const d = r.data
        return Array.isArray(d) ? d : (d.results ?? [])
      }),
  })

  // Sort by compliance % descending, own barangay always first
  const sorted = [...barangays].sort((a, b) => {
    const aIsOwn = a.barangay_name.trim().toLowerCase() === userBarangay
    const bIsOwn = b.barangay_name.trim().toLowerCase() === userBarangay
    if (aIsOwn !== bIsOwn) return aIsOwn ? -1 : 1
    const totalA = a.submitted_count + a.pending_count + a.overdue_count
    const totalB = b.submitted_count + b.pending_count + b.overdue_count
    const pctA = totalA > 0 ? a.submitted_count / totalA : 0
    const pctB = totalB > 0 ? b.submitted_count / totalB : 0
    return pctB - pctA
  })

const isSearching = search.trim().length > 0

  const filtered = isSearching
    ? sorted.filter(b =>
        b.barangay_name.toLowerCase().includes(search.toLowerCase()) ||
        (b.sk_chairperson ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : showAll ? sorted : sorted.slice(0, TOP_N)

  const hiddenCount = sorted.length - TOP_N

  return (
    <div className="space-y-6">
      {profileBarangay && (
        <SKProfileModal barangay={profileBarangay} onClose={() => setProfileBarangay(null)} />
      )}
      {feedbackBarangay && (
        <FeedbackModal barangayName={feedbackBarangay.barangay_name} onClose={() => setFeedbackBarangay(null)} />
      )}

      <div>
        <h1 className="page-title">SK Barangay Directory</h1>
        <p className="page-subtitle">Sangguniang Kabataan councils and their compliance status</p>
      </div>

<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 items-start">
        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p className="text-sm text-blue-700">
          If you are interested in being listed in the SK Directory, please coordinate with <strong>LYDO</strong> for verification and registration.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Barangay list */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              placeholder="Search by barangay or chairperson..."
              value={search}
              onChange={e => { setSearch(e.target.value); setShowAll(false) }}
              className="input pl-9"
            />
          </div>

          <p className="text-xs text-ink-500">
            {isLoading
              ? 'Loading...'
              : isSearching
              ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${search}"`
              : showAll
              ? `All ${sorted.length} barangays — sorted by compliance`
              : `Top ${Math.min(TOP_N, sorted.length)} most compliant barangays`}
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-12 text-center text-ink-500">
              <Users size={36} className="mx-auto mb-3 opacity-30" />
              <p>No barangays found.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {filtered.map(b => {
                  const isOwnCard = !!userBarangay && b.barangay_name.trim().toLowerCase() === userBarangay
                  return (
                    <BarangayCard
                      key={b.id}
                      b={b}
                      onViewProfile={setProfileBarangay}
                      canEditLogo={isAdmin || (isSKUser && isOwnCard)}
                      isOwn={isOwnCard}
                      onSendFeedback={canSendFeedback && isOwnCard ? () => setFeedbackBarangay(b) : undefined}
                    />
                  )
                })}
              </div>

              {/* Show all / collapse toggle — only visible when not searching */}
              {!isSearching && sorted.length > TOP_N && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="w-full py-2.5 text-sm font-semibold text-primary-700 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors border border-primary-100"
                >
                  {showAll
                    ? 'Show top 10 only'
                    : `Show all ${sorted.length} barangays (+${hiddenCount} more)`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Right: Calendar */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <OrgCalendarWidget title="SK Events & Deadlines" />
        </div>
      </div>
    </div>
  )
}
