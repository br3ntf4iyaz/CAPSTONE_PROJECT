import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Search, CheckCircle2, Circle, ChevronDown, ChevronUp, X, Mail, Phone, MapPin, Award, Camera, Star, MessageSquare, ImagePlus, User as UserIcon, ArrowLeft, ZoomIn, Trash2, Facebook, Crown } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { skFeedbackApi } from '@/api/skFeedback'
import OrgCalendarWidget from '@/components/ui/OrgCalendarWidget'
import ImageLightbox from '@/components/ui/ImageLightbox'
import { ComplianceBadge, ComplianceMeter, ExemplaryAward, compliancePercent, complianceTile } from '@/components/ui/ComplianceBadge'
import SKSocialEditor, { type SKSocial } from '@/components/ui/SKSocialEditor'
import SKOfficialProfile from '../components/SKOfficialProfile'
import { RequirementActions, StateBadge, SubmitDocumentModal, useMyChecklist, type MyRequirement } from '../components/RequirementSubmit'
import { shrinkImage } from '@/utils/shrinkImage'
import { useAuthStore } from '@/store/authStore'
import { formatDate, cn } from '@/utils'

interface Requirement {
  key: string
  label: string
  // the honest state: only "verified" means completed; "submitted" is waiting for LYDO
  status: 'not_submitted' | 'draft' | 'submitted' | 'returned' | 'verified' | 'overdue'
  detail?: string
  remarks?: string
  submitted_at?: string
}

interface SKMember {
  id: number
  name: string
  position: 'kagawad' | 'secretary' | 'treasurer'
  position_display: string
  photo_url: string | null
}

interface SKOfficial {
  key: string
  id: number | null
  name: string
  position: 'chairperson' | 'kagawad' | 'secretary' | 'treasurer'
  position_display: string
  photo_url: string | null
  order: number
  social?: SKSocial
}

interface SKBarangay {
  members?: SKMember[]
  officials?: SKOfficial[]
  chairperson_photo_url?: string | null
  group_photo_url?: string | null
  can_edit_officials?: boolean
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

/** One official: square picture (face-first crop), full name, then the position. */
function OfficialCard({
  o, featured = false, light = false, onZoom, canEdit = false, busy = false, onPick, onRemove, onRename, onOpen,
}: {
  light?: boolean   // the Secretary and Treasurer: a full-colour TEAL card, so they read as a different group from the navy kagawads
  onOpen?: () => void
  onRename?: (name: string) => void
  o: SKOfficial
  featured?: boolean
  onZoom?: () => void
  canEdit?: boolean
  busy?: boolean
  onPick?: (file: File) => void
  onRemove?: () => void
}) {
  const [broken, setBroken] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const showPhoto = !!o.photo_url && !broken
  return (
    <article
      className={cn(
        // every card in a grid has the same width and height, whatever the name length
        'relative overflow-hidden flex flex-col items-center text-center rounded-2xl border p-3 sm:p-4 h-full w-full transition-shadow',
        // the council is calm navy; the chairperson is the most colourful card: bright blue, a thick yellow frame,
        // the red-yellow-blue stripe of the system and warm glows
        light
          ? 'border-teal-700 border-b-[5px] border-b-accent-400 bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-md shadow-teal-700/30 hover:shadow-lg hover:shadow-teal-700/40 hover:-translate-y-0.5'
          : featured
          ? 'max-w-[14rem] border-[3px] border-accent-400 ring-4 ring-accent-400/25 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 text-white shadow-2xl shadow-primary-700/40 pt-6 sm:pt-7'
          : 'border-primary-800 bg-gradient-to-br from-primary-700 to-primary-900 text-white shadow-md shadow-primary-800/25 hover:shadow-lg hover:shadow-primary-800/35 hover:-translate-y-0.5',
      )}
    >
      <div className={cn('relative aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center', featured ? 'ring-4 ring-accent-400 shadow-lg shadow-primary-900/30' : 'ring-1 ring-white/40 shadow-lg shadow-black/30')}>
        {showPhoto ? (
          <button
            type="button"
            onClick={onZoom}
            aria-label={`View a larger picture of ${o.name}`}
            className="group relative h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <img
              src={o.photo_url!}
              alt={`${o.name}, ${o.position_display}`}
              loading="lazy"
              onError={() => setBroken(true)}
              className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
            />
            <span className="absolute top-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100 transition-opacity">
              <ZoomIn size={14} />
            </span>
          </button>
        ) : (
          <UserIcon className="text-primary-300" size={featured ? 64 : 52} strokeWidth={1.5} aria-label="No picture yet" />
        )}
        {(o.social?.facebook_profile_url || o.social?.facebook_page_url) && (
          <span className="absolute left-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1877F2] text-white shadow" title="Has a Facebook link" aria-label="Has a Facebook link">
            <Facebook size={14} />
          </span>
        )}
        {/* the name on the picture, over a dark fade, like a trading card */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-2 pb-5 pt-12 text-center">
          <h4 className={cn('font-extrabold leading-tight break-words text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]', featured ? 'text-lg' : 'text-[15px]')}>{o.name}</h4>
        </div>
      </div>
      {featured && (
        // red | yellow | white stripe: visible on the blue, unlike a blue segment
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex h-2.5">
          <span className="flex-1 bg-alert-500" /><span className="flex-1 bg-accent-400" /><span className="flex-1 bg-white" />
        </div>
      )}
      {featured && <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_55%)]" />}
      {!featured && <div aria-hidden className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />}
      <p
        className={cn(
          'relative z-10 -mt-3 mb-0 inline-block whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide shadow-lg shadow-black/30',
          o.position === 'chairperson' ? 'bg-accent-400 text-primary-900' : light ? 'bg-white text-teal-800' : 'bg-white text-primary-800',
        )}
      >
        {o.position === 'chairperson' && <Crown size={12} className="mr-1 inline -mt-0.5" />}{o.position_display}
      </p>
      {onOpen && (
        <button type="button" onClick={onOpen} className={cn('relative mt-3 w-full rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors', featured ? 'border-accent-400/70 text-accent-300 hover:bg-white/10' : light ? 'border-white/60 text-white hover:bg-white hover:text-teal-700' : 'border-white/50 text-white hover:bg-white hover:text-primary-700')}>
          View profile
        </button>
      )}

      {canEdit && (
        <div className="mt-2.5 flex w-full flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50', light ? 'bg-white text-teal-700 hover:bg-teal-50' : 'bg-white text-primary-700 hover:bg-primary-50')}
          >
            <Camera size={12} /> {busy ? 'Saving...' : showPhoto ? 'Change picture' : 'Upload picture'}
          </button>
          {o.photo_url && (
            <button
              type="button"
              onClick={() => { if (window.confirm(`Remove the picture of ${o.name}?`)) onRemove?.() }}
              disabled={busy}
              aria-label={`Remove the picture of ${o.name}`}
              title="Remove the picture"
              className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full border disabled:opacity-50', 'border-white/50 text-white hover:bg-red-500 hover:border-red-500')}
            >
              <Trash2 size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const n = window.prompt('Official name', o.name)?.trim()
              if (n && n !== o.name) onRename?.(n)
            }}
            disabled={busy}
            className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50', 'border-white/50 text-white hover:bg-white/15')}
          >
            Edit name
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) onPick?.(f)
              e.target.value = ''
            }}
          />
        </div>
      )}
    </article>
  )
}

function SKProfileModal({ barangay, onClose }: { barangay: SKBarangay; onClose: () => void }) {
  const total = barangay.submitted_count + barangay.pending_count + barangay.overdue_count
  // same calculation as before, but rounding can no longer show 100% (or 0%) unless it is exactly true
  const pct = compliancePercent(barangay.submitted_count, total)
  const tile = complianceTile(pct)

  // Always the 10 seats of THIS barangay, in order: Chairperson, 7 Kagawads, Secretary, Treasurer
  const officials: SKOfficial[] = barangay.officials ?? [
    {
      key: 'chairperson', id: null, name: barangay.sk_chairperson || 'SK Chairperson', position: 'chairperson',
      position_display: 'SK Chairperson', photo_url: barangay.chairperson_photo_url ?? null, order: 0,
    },
    ...(barangay.members ?? []).map(m => ({ key: `m-${m.id}`, id: m.id, name: m.name, position: m.position, position_display: m.position_display, photo_url: m.photo_url, order: 0 })),
  ]
  const qc = useQueryClient()
  const auth = useAuthStore()
  const canEdit = !!barangay.can_edit_officials
  const isSkOfThisBarangay =
    auth.user?.youth_type === 'sk' &&
    (auth.user?.profile?.barangay ?? '').trim().toLowerCase() === barangay.barangay_name.trim().toLowerCase()
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const picture = useMutation({
    mutationFn: async ({ o, file }: { o: SKOfficial; file: File | null }) => {
      const fd = new FormData()
      if (file) fd.append('photo', await shrinkImage(file, 900, 0.88))
      else fd.append('remove', 'true')
      const headers = { 'Content-Type': undefined as unknown as string }
      if (o.position === 'chairperson') {
        return apiClient.post(`/sk-requirements/barangays/${barangay.id}/chairperson-photo/`, fd, { headers })
      }
      fd.append('member', String(o.id))
      return apiClient.post(`/sk-requirements/barangays/${barangay.id}/member-photo/`, fd, { headers })
    },
    onMutate: ({ o }) => setBusyKey(o.key),
    onSettled: () => setBusyKey(null),
    onSuccess: (res, { o, file }) => {
      toast.success(file ? 'Picture updated' : 'Picture removed')
      // show the new picture at once, then let the list refresh in the background
      const url: string | null = res.data?.photo_url ?? res.data?.chairperson_photo_url ?? null
      qc.setQueryData<SKBarangay[]>(['sk-barangays-directory'], old =>
        old?.map(b => b.id !== barangay.id ? b : {
          ...b,
          chairperson_photo_url: o.position === 'chairperson' ? url : b.chairperson_photo_url,
          officials: b.officials?.map(x => x.key === o.key ? { ...x, photo_url: url } : x),
          members: b.members?.map(m => o.id !== null && m.id === o.id ? { ...m, photo_url: url } : m),
        }),
      )
      qc.invalidateQueries({ queryKey: ['sk-barangays-directory'] })
    },
    onError: (e: any) => {
      const d = e?.response?.data
      toast.error(d?.detail ?? 'Could not save the picture. Use a JPG or PNG under 5 MB.')
    },
  })
  const rename = useMutation({
    mutationFn: ({ o, name }: { o: SKOfficial; name: string }) =>
      apiClient.post(`/sk-requirements/barangays/${barangay.id}/official-name/`, o.id !== null ? { name, member: o.id } : { name }),
    onMutate: ({ o }) => setBusyKey(o.key),
    onSettled: () => setBusyKey(null),
    onSuccess: () => {
      toast.success('Name updated')
      qc.invalidateQueries({ queryKey: ['sk-barangays-directory'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Could not save the name.'),
  })
  const editProps = (o: SKOfficial) => ({
    canEdit,
    onRename: (name: string) => rename.mutate({ o, name }),
    busy: busyKey === o.key,
    onPick: (file: File) => picture.mutate({ o, file }),
    onRemove: () => picture.mutate({ o, file: null }),
    onOpen: () => setProfileKey(o.key),
  })

  const [zoomKey, setZoomKey] = useState<string | null>(null)
  const [groupZoom, setGroupZoom] = useState(false)
  const groupFile = useRef<HTMLInputElement>(null)
  const groupPhoto = useMutation({
    mutationFn: async (file: File | null) => {
      const fd = new FormData()
      if (file) fd.append('photo', await shrinkImage(file, 1600, 0.88))
      else fd.append('remove', 'true')
      return apiClient.post(`/sk-requirements/barangays/${barangay.id}/group-photo/`, fd, { headers: { 'Content-Type': undefined as unknown as string } })
    },
    onSuccess: (_r, file) => { toast.success(file ? 'Group picture updated' : 'Group picture removed'); qc.invalidateQueries({ queryKey: ['sk-barangays-directory'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Could not save the picture. Use a JPG or PNG under 8 MB.'),
  })
  const [profileKey, setProfileKey] = useState<string | null>(null)
  const [editKey, setEditKey] = useState<string | null>(null)
  const profileOf = officials.find(o => o.key === profileKey) ?? null
  const editOf = officials.find(o => o.key === editKey) ?? null
  const withPhotos = officials.filter(o => !!o.photo_url)
  const zoomIndex = withPhotos.findIndex(o => o.key === zoomKey)
  const zoomed = zoomIndex >= 0 ? withPhotos[zoomIndex] : null
  const step = (d: number) => setZoomKey(withPhotos[(zoomIndex + d + withPhotos.length) % withPhotos.length].key)
  const chair = officials.find(o => o.position === 'chairperson')
  const kagawads = officials.filter(o => o.position === 'kagawad')
  const secretary = officials.filter(o => o.position === 'secretary')
  const treasurer = officials.filter(o => o.position === 'treasurer')

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`SK officials of ${barangay.barangay_name}`}
    >
      <div
        className="bg-white sm:rounded-3xl shadow-2xl w-full max-w-4xl h-full sm:h-auto max-h-screen sm:max-h-[94vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary-600 to-primary-800 px-5 sm:px-8 pt-6 pb-10 text-white">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white"
            >
              <ArrowLeft size={16} /> Back to directory
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              {barangay.group_photo_url ? (
                <button
                  type="button"
                  onClick={() => setGroupZoom(true)}
                  aria-label={`View a larger group picture of the ${barangay.barangay_name} SK council`}
                  title="Click to enlarge"
                  className={cn('group relative block h-24 w-32 sm:h-28 sm:w-36 cursor-zoom-in overflow-hidden rounded-2xl bg-white/20', tile.ring)}
                >
                  <img src={barangay.group_photo_url} alt={`${barangay.barangay_name} SK council`} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                  <span className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white"><ZoomIn size={12} /></span>
                </button>
              ) : (
                <div className={cn('w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center overflow-hidden', tile.ring, barangay.logo_url ? 'bg-white/20' : tile.bg)} title={`Compliance ${pct}%`}>
                  {barangay.logo_url
                    ? <img src={barangay.logo_url} alt={`${barangay.barangay_name} logo`} className="w-full h-full object-cover" />
                    : <tile.Icon size={34} className={tile.icon} />
                  }
                </div>
              )}
              {canEdit && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <button type="button" onClick={() => groupFile.current?.click()} disabled={groupPhoto.isPending}
                    className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/30 disabled:opacity-50">
                    <Camera size={11} /> {groupPhoto.isPending ? 'Saving...' : barangay.group_photo_url ? 'Change group picture' : 'Add group picture'}
                  </button>
                  {barangay.group_photo_url && (
                    <button type="button" aria-label="Remove the group picture" title="Remove the group picture" disabled={groupPhoto.isPending}
                      onClick={() => { if (window.confirm('Remove the council group picture?')) groupPhoto.mutate(null) }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 disabled:opacity-50"><Trash2 size={11} /></button>
                  )}
                  <input ref={groupFile} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) groupPhoto.mutate(f); e.target.value = '' }} />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-100">Sangguniang Kabataan</p>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl leading-tight break-words">{barangay.barangay_name}</h2>
              <p className="text-primary-100 text-sm sm:text-base font-medium break-words">SK Chairperson: {barangay.sk_chairperson || 'to be announced'}</p>
            </div>
          </div>
        </div>

        {/* Contact + compliance (unchanged information, laid out side by side on wide screens) */}
        <div className="relative z-10 -mt-5 mx-4 sm:mx-8 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl border border-l-4 border-primary-100 border-l-primary-500 shadow-md shadow-primary-600/10 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0"><MapPin size={16} className="text-primary-600" /></div>
              <div><p className="text-xs text-ink-500 font-medium">Barangay</p><p className="font-semibold text-ink-900">{barangay.barangay_name}</p></div>
            </div>
            {barangay.contact_email && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0"><Mail size={16} className="text-primary-600" /></div>
                <div className="min-w-0">
                  <p className="text-xs text-ink-500 font-medium">Email</p>
                  <a href={`mailto:${barangay.contact_email}`} className="font-semibold text-sm text-primary-700 hover:underline break-all">{barangay.contact_email}</a>
                </div>
              </div>
            )}
            {barangay.contact_phone && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0"><Phone size={16} className="text-primary-600" /></div>
                <div>
                  <p className="text-xs text-ink-500 font-medium">Phone</p>
                  <a href={`tel:${barangay.contact_phone}`} className="font-semibold text-sm text-primary-700 hover:underline">{barangay.contact_phone}</a>
                </div>
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl border border-l-4 border-primary-100 border-l-accent-400 shadow-md shadow-primary-600/10 p-4">
            <p className="text-xs font-extrabold text-primary-800 mb-2.5 uppercase tracking-wide">Compliance</p>
            <div className="mb-3"><ComplianceBadge pct={pct} /></div>
            <div className="mb-2.5"><ComplianceMeter pct={pct} /></div>
            {pct >= 100 && <div className="mb-3"><ExemplaryAward /></div>}
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-green text-sm">{barangay.submitted_count} verified</span>
              <span className="badge badge-gray text-sm">{barangay.pending_count} not yet verified</span>
              {barangay.overdue_count > 0 && <span className="badge badge-red text-sm">{barangay.overdue_count} overdue</span>}
            </div>
          </div>
        </div>

        {/* The council */}
        <section className="mt-6 px-4 sm:px-8 py-6 space-y-7 bg-gradient-to-b from-primary-50/70 to-white border-t border-primary-100" aria-label="SK officials">
          <div>
            <h3 className="font-display font-extrabold text-xl text-primary-900">SK Officials of {barangay.barangay_name}</h3>
            <p className="text-sm text-ink-500">The elected and appointed members of the Sangguniang Kabataan council.</p>
            {canEdit && (
              <p className="mt-2 rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-sm text-primary-800">
                You can change the pictures of your council. Use <strong>Change picture</strong> under each official, anytime.
              </p>
            )}
            {!canEdit && isSkOfThisBarangay && (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                You are signed in as SK of this barangay. To change your council&apos;s pictures, first{' '}
                <a href="/verify-identity" className="font-semibold underline">verify your identity</a>.
              </p>
            )}
          </div>

          {chair && (
            <div className="flex justify-center">
              <OfficialCard o={chair} featured onZoom={() => setZoomKey(chair.key)} {...editProps(chair)} />
            </div>
          )}

          {kagawads.length > 0 && (
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary-700 mb-3 flex items-center gap-2"><span className="h-3 w-1 rounded-full bg-accent-400" />SK Kagawads ({kagawads.length})</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {kagawads.map(o => <OfficialCard key={o.key} o={o} onZoom={() => setZoomKey(o.key)} {...editProps(o)} />)}
              </div>
            </div>
          )}

          {(secretary.length > 0 || treasurer.length > 0) && (
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary-700 mb-3 flex items-center gap-2"><span className="h-3 w-1 rounded-full bg-teal-500" />SK Secretary and Treasurer</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {[...secretary, ...treasurer].map(o => <OfficialCard key={o.key} o={o} light onZoom={() => setZoomKey(o.key)} {...editProps(o)} />)}
              </div>
            </div>
          )}
        </section>
      </div>

      {groupZoom && barangay.group_photo_url && (
        <ImageLightbox
          src={barangay.group_photo_url}
          alt={`${barangay.barangay_name} SK council`}
          caption={`SK Council of ${barangay.barangay_name}`}
          subcaption="Sangguniang Kabataan"
          onClose={() => setGroupZoom(false)}
        />
      )}
      {profileOf && (
        <SKOfficialProfile
          o={profileOf}
          barangayName={barangay.barangay_name}
          canManage={canEdit}
          onManage={() => setEditKey(profileOf.key)}
          onClose={() => setProfileKey(null)}
        />
      )}
      {editOf && (
        <SKSocialEditor
          key={editOf.key}
          barangayId={barangay.id}
          official={editOf}
          onClose={() => setEditKey(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['sk-barangays-directory'] })}
        />
      )}

      {zoomed && (
        <ImageLightbox
          src={zoomed.photo_url!}
          alt={`${zoomed.name}, ${zoomed.position_display}`}
          caption={zoomed.name}
          subcaption={`${zoomed.position_display} · ${barangay.barangay_name}`}
          onClose={() => setZoomKey(null)}
          onPrev={withPhotos.length > 1 ? () => step(-1) : undefined}
          onNext={withPhotos.length > 1 ? () => step(1) : undefined}
        />
      )}
    </div>
  )
}

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
  const [groupZoom, setGroupZoom] = useState(false)
  const [submitting, setSubmitting] = useState<MyRequirement | null>(null)
  const authUser = useAuthStore().user
  // the SK of this barangay manages its documents right here (their own checklist, with the buttons)
  const isMySK = isOwn && authUser?.youth_type === 'sk'
  const mine = useMyChecklist(isMySK && expanded)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const total = b.submitted_count + b.pending_count + b.overdue_count
  const pct = compliancePercent(b.submitted_count, total)
  const tile = complianceTile(pct)
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
    <div className={cn(
      'bg-white rounded-2xl border-2 shadow-lg shadow-primary-900/15 overflow-hidden hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary-900/25 transition-all',
      // the card of YOUR barangay is framed in yellow
      isOwn ? 'border-accent-400 ring-4 ring-accent-400/25' : 'border-primary-700',
    )}>
      <div role="button" tabIndex={0}
        className="relative overflow-hidden w-full cursor-pointer flex items-center justify-between p-4 sm:p-5 text-left bg-gradient-to-br from-primary-600 to-primary-800 text-white hover:from-primary-500 hover:to-primary-700 transition-colors"
        onClick={() => setExpanded(e => !e)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(x => !x) } }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-12 -right-10 h-36 w-36 rounded-full bg-accent-400/20 blur-2xl" />
        <div className="relative flex items-center gap-4 min-w-0">
          {/* Logo / icon — bigger so uploaded logos are visible */}
          {b.group_photo_url ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setGroupZoom(true) }}
              onKeyDown={e => e.stopPropagation()}
              aria-label={`View a larger group picture of the ${b.barangay_name} SK council`}
              title={`Compliance ${pct}% · click to enlarge`}
              className={cn('group relative block h-16 w-20 sm:h-[4.5rem] sm:w-24 flex-shrink-0 cursor-zoom-in overflow-hidden rounded-2xl bg-primary-100', tile.ring)}
            >
              <img src={b.group_photo_url} alt={`${b.barangay_name} SK council`} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
            </button>
          ) : (
          <div className={cn('relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden group', tile.ring, b.logo_url ? 'bg-primary-100' : tile.bg)} title={`Compliance ${pct}%`}>
            {b.logo_url
              ? <img src={b.logo_url} alt={b.barangay_name} className="w-full h-full object-cover" />
              : <tile.Icon size={26} className={tile.icon} />
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
          )}
          {groupZoom && b.group_photo_url && (
            <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
              <ImageLightbox
                src={b.group_photo_url}
                alt={`${b.barangay_name} SK council`}
                caption={`SK Council of ${b.barangay_name}`}
                subcaption="Sangguniang Kabataan"
                onClose={() => setGroupZoom(false)}
              />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-extrabold text-base text-white">{b.barangay_name}</p>
              {isOwn && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-400 text-primary-900 text-xs font-bold leading-none flex-shrink-0 shadow-sm">
                  <Star size={10} className="fill-current" /> Yours
                </span>
              )}
            </div>
            {b.sk_chairperson && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onViewProfile(b) }}
                className="text-sm text-accent-300 hover:text-accent-200 hover:underline font-semibold transition-colors mt-0.5 text-left"
              >
                {b.sk_chairperson}
              </button>
            )}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onViewProfile(b) }}
              className="mt-1 ml-0 inline-flex items-center gap-1 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 rounded-full px-2.5 py-1 transition-colors"
            >
              <Users size={12} /> View SK officials
            </button>
            {/* Mobile compliance summary */}
            <div className="flex items-center gap-2 mt-1 sm:hidden">
              <div className="flex-1 h-1.5 bg-white/25 rounded-full overflow-hidden max-w-[80px]">
                <div className={cn('h-full rounded-full', tile.bar)} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-bold whitespace-nowrap text-white">{pct}%</span>
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-3 flex-shrink-0">
          {/* Progress bar — desktop */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-2 bg-white/25 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', tile.bar)} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-extrabold min-w-[2.75rem] whitespace-nowrap text-white">{pct}%</span>
          </div>
          <div className="hidden sm:flex gap-1.5">
            <span className="badge badge-green text-xs">{b.submitted_count} done</span>
            <span className="badge badge-gray text-xs">{notYet} left</span>
          </div>
          {expanded ? <ChevronUp size={18} className="text-white/80" /> : <ChevronDown size={18} className="text-white/80" />}
        </div>
      </div>

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
        <div className="px-5 py-3 bg-primary-50 border-t border-primary-100">
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
        <div className="border-t border-ink-100 px-5 py-4 space-y-3">
          {b.requirements.map(req => {
            const mineRow = mine.data?.requirements.find(m => m.type === req.key)
            const remarks = req.status === 'returned' ? (mineRow?.remarks || req.remarks) : ''
            return (
              <div key={req.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-sm text-ink-800">{req.label}</span>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {req.detail && <span className="hidden text-xs text-ink-500 sm:inline">{req.detail}</span>}
                    {req.submitted_at && <span className="text-xs text-ink-500">{formatDate(req.submitted_at)}</span>}
                    <StateBadge state={req.status} />
                  </div>
                </div>
                {remarks && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><strong>LYDO remarks:</strong> {remarks}</p>}
                {isMySK && mineRow && <RequirementActions item={mineRow} onSubmit={setSubmitting} />}
              </div>
            )
          })}
          {isOwn && authUser?.youth_type === 'sk' && (
            <p className="pt-1 text-xs text-ink-500">Only documents verified by LYDO count as done. A document you submit waits for LYDO to review it.</p>
          )}
        </div>
      )}
      {submitting && <SubmitDocumentModal item={submitting} onClose={() => setSubmitting(null)} />}
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
        <SKProfileModal barangay={barangays.find(b => b.id === profileBarangay.id) ?? profileBarangay} onClose={() => setProfileBarangay(null)} />
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
