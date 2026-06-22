import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MessageSquare, MapPin, CheckCircle2, ImagePlus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { skFeedbackApi } from '@/api/skFeedback'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils'

const CATEGORIES = [
  { value: 'concern',    label: 'Concern' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'praise',     label: 'Praise' },
] as const

export default function YouthSKFeedbackPage() {
  const auth = useAuthStore()
  const userBarangay = (auth.user?.profile?.barangay ?? '').trim()

  const [category, setCategory] = useState<'concern' | 'suggestion' | 'praise'>('concern')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB.'); return }
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImage(null)
    setImagePreview(null)
  }

  const mutation = useMutation({
    mutationFn: () =>
      skFeedbackApi.submit({ category, subject, message, rating, is_anonymous: isAnonymous, image }),
    onSuccess: () => {
      setSubmitted(true)
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

  const reset = () => {
    setSubmitted(false)
    setSubject('')
    setMessage('')
    setRating(null)
    setIsAnonymous(false)
    setCategory('concern')
    removeImage()
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">SK Feedback</h1>
        <p className="page-subtitle">Send feedback directly to your Sangguniang Kabataan</p>
      </div>

      {/* Barangay banner */}
      <div className={cn(
        'flex items-center gap-3 px-5 py-4 rounded-2xl border',
        userBarangay
          ? 'bg-primary-50 border-primary-200'
          : 'bg-amber-50 border-amber-200',
      )}>
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          userBarangay ? 'bg-primary-100' : 'bg-amber-100',
        )}>
          <MapPin size={18} className={userBarangay ? 'text-primary-600' : 'text-amber-600'} />
        </div>
        <div>
          {userBarangay ? (
            <>
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide">Sending to</p>
              <p className="font-bold text-base text-primary-900">SK {userBarangay}</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-amber-800">No barangay on your profile</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Please update your profile to enable feedback submission.
              </p>
            </>
          )}
        </div>
      </div>

      {submitted ? (
        /* Success state */
        <div className="card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-ink-900">Feedback Submitted!</h2>
            <p className="text-sm text-ink-500 mt-1">
              Your feedback has been sent to SK {userBarangay}. Thank you for helping improve your community.
            </p>
          </div>
          <button onClick={reset} className="btn-secondary">
            Submit Another
          </button>
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-2 uppercase tracking-wide">Category</label>
            <div className="flex gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors',
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
            <label className="block text-xs font-semibold text-ink-600 mb-2 uppercase tracking-wide">Subject</label>
            <input
              className="input"
              type="text"
              placeholder="Brief subject line..."
              value={subject}
              maxLength={200}
              onChange={e => setSubject(e.target.value)}
              required
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-2 uppercase tracking-wide">Message</label>
            <textarea
              className="input resize-none"
              rows={5}
              placeholder="Describe your feedback in detail..."
              value={message}
              maxLength={2000}
              onChange={e => setMessage(e.target.value)}
              required
            />
            <p className="text-xs text-ink-400 mt-1 text-right">{message.length} / 2000</p>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-2 uppercase tracking-wide">
              Rating <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? null : n)}
                  className={cn(
                    'w-10 h-10 rounded-xl text-xl transition-colors',
                    n <= (rating ?? 0)
                      ? 'text-amber-400 bg-amber-50 border border-amber-300'
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
            <label className="block text-xs font-semibold text-ink-600 mb-2 uppercase tracking-wide">
              Attach Photo <span className="font-normal text-ink-400">(optional, max 5 MB)</span>
            </label>
            {imagePreview ? (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="attachment preview"
                  className="w-full max-h-56 object-cover rounded-xl border border-ink-200"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                  aria-label="Remove photo"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-ink-300 hover:border-primary-400 text-sm text-ink-500 hover:text-primary-700 transition-colors"
              >
                <ImagePlus size={16} />
                Add a photo
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {/* Anonymous toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={isAnonymous}
              onClick={() => setIsAnonymous(v => !v)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                isAnonymous ? 'bg-primary-600' : 'bg-ink-200',
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform',
                isAnonymous ? 'translate-x-5' : 'translate-x-0.5',
              )} />
            </button>
            <div>
              <p className="text-sm font-medium text-ink-800">Submit anonymously</p>
              <p className="text-xs text-ink-500">Your name won't be shown to SK officers</p>
            </div>
          </label>

          <button
            type="submit"
            disabled={mutation.isPending || !userBarangay || !subject.trim() || !message.trim()}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            <MessageSquare size={16} />
            {mutation.isPending ? 'Submitting…' : 'Submit Feedback'}
          </button>

          {!userBarangay && (
            <p className="text-xs text-center text-amber-600">
              Update your profile with your barangay to enable submissions.
            </p>
          )}
        </form>
      )}
    </div>
  )
}
