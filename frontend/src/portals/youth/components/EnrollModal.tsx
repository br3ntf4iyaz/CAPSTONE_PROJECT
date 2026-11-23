import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { apiMessage } from '../lms'

/**
 * Asks for the name that will be printed on the certificate BEFORE the enrollment is created.
 * Cancel creates nothing. The name is saved on the enrollment itself, not on the account.
 */
export default function EnrollModal({
  courseId, courseTitle, onClose, onEnrolled,
}: {
  courseId: number
  courseTitle: string
  onClose: () => void
  onEnrolled?: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enroll.isPending) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enroll = useMutation({
    mutationFn: () => apiClient.post('/courses/enrollments/', { course_id: courseId, certificate_name: name }).then(r => r.data),
    onSuccess: () => {
      toast.success(`You are enrolled in ${courseTitle}.`)
      qc.invalidateQueries({ queryKey: ['my-enrollments'] })
      qc.invalidateQueries({ queryKey: ['courses-catalog'] })
      onEnrolled?.()
      onClose()
    },
    onError: (e: any) => setError(apiMessage(e, 'Could not enroll. Please try again.')),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = name.replace(/\s+/g, ' ').trim()
    if (clean.length < 3) { setError('Please enter your complete name.'); return }
    if (!/\p{L}{2,}/u.test(clean)) { setError('The name must contain letters.'); return }
    setName(clean)
    setError('')
    enroll.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => { if (!enroll.isPending) onClose() }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="enroll-title"
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 text-primary-700"><GraduationCap size={22} /></span>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50"><X size={18} /></button>
        </div>
        <h2 id="enroll-title" className="mt-3 text-lg font-bold text-ink-900">Confirm your enrollment</h2>
        <p className="mt-2 text-sm text-ink-600">
          Before enrolling, please enter your complete name as you would like it to appear on your certificate of completion.
        </p>

        <div className="mt-4 rounded-xl bg-ink-50 px-3 py-2.5 text-sm">
          <span className="text-ink-500">Course: </span><span className="font-semibold text-ink-900">{courseTitle}</span>
        </div>

        <label htmlFor="certificate-name" className="mt-4 block text-sm font-semibold text-ink-800">Full Name for Certificate</label>
        <input
          id="certificate-name"
          ref={inputRef}
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          maxLength={150}
          autoComplete="name"
          placeholder="Enter your complete name"
          className="input mt-1 w-full"
          aria-invalid={!!error}
          aria-describedby={error ? 'certificate-name-error' : undefined}
        />
        {error && <p id="certificate-name-error" role="alert" className="mt-1.5 text-xs text-red-600">{error}</p>}
        <p className="mt-1.5 text-xs text-ink-400">You can still correct this name before you finish the course. After the certificate is issued it cannot be changed.</p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={enroll.isPending} className="btn-secondary sm:min-w-[110px]">Cancel</button>
          <button type="submit" disabled={enroll.isPending} className="btn-primary sm:min-w-[160px]">
            {enroll.isPending ? 'Enrolling...' : 'Confirm Enrollment'}
          </button>
        </div>
      </form>
    </div>
  )
}
