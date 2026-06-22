import { useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2, Sparkles } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { authStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const token = params.get('token') ?? ''
  const called = useRef(false)

  const verify = useMutation({
    mutationFn: () => authApi.verifyEmail(token),
    onSuccess: ({ data }) => {
      // Auto-login: store tokens + user, then redirect to dashboard
      const { user, access, refresh } = data as any
      authStore.setAuth(user, access, refresh)
      qc.setQueryData(['me'], user)
      toast.success(`Welcome, ${user.first_name}! Your email is verified.`, { duration: 4000 })
      navigate('/dashboard', { replace: true })
    },
  })

  // Fire the verification request exactly once when the page mounts
  useEffect(() => {
    if (!token) return
    if (called.current) return
    called.current = true
    verify.mutate()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const isExpired  = (verify.error as any)?.response?.data?.code === 'token_expired'
  const isInvalid  = (verify.error as any)?.response?.data?.code === 'invalid_token'
  const errorMsg   = (verify.error as any)?.response?.data?.detail ?? 'Verification failed. Please try again.'

  return (
    <div className="min-h-screen flex flex-col bg-paper-50">
      {/* PH stripe */}
      <div className="ph-stripe h-1 w-full" />

      {/* Top brand strip */}
      <div className="bg-white border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary-600 text-white">
              <Sparkles size={18} strokeWidth={2.5} />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent-400 border-2 border-white" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display font-extrabold text-lg text-ink-900 tracking-tightish">LYDO</span>
              <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">Lucena Youth</span>
            </span>
          </Link>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="card p-10 text-center">

            {/* ── Loading state ─────────────────────────────── */}
            {verify.isPending && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-50 border-4 border-primary-100 mb-6">
                  <Loader2 size={36} className="text-primary-700 animate-spin" />
                </div>
                <h1 className="font-display font-extrabold text-2xl text-ink-900 mb-2">
                  Verifying your email…
                </h1>
                <p className="text-ink-500 text-sm">Just a moment, please hold on.</p>
              </>
            )}

            {/* ── No token in URL ────────────────────────────── */}
            {!token && !verify.isPending && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 border-4 border-red-100 mb-6">
                  <XCircle size={36} className="text-red-500" />
                </div>
                <h1 className="font-display font-extrabold text-2xl text-ink-900 mb-3">
                  Invalid link
                </h1>
                <p className="text-ink-500 text-sm mb-8">
                  This verification link is missing required information.
                  Please use the link from your email.
                </p>
                <Link to="/register" className="btn-primary w-full">
                  Register again
                </Link>
              </>
            )}

            {/* ── Error state ────────────────────────────────── */}
            {verify.isError && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 border-4 border-red-100 mb-6">
                  <XCircle size={36} className="text-red-500" />
                </div>
                <h1 className="font-display font-extrabold text-2xl text-ink-900 mb-3">
                  {isExpired ? 'Link expired' : isInvalid ? 'Invalid link' : 'Verification failed'}
                </h1>
                <p className="text-ink-500 text-sm mb-8 leading-relaxed">
                  {isExpired
                    ? 'This verification link has expired. Links are only valid for 24 hours. Please request a new one.'
                    : errorMsg}
                </p>
                <div className="space-y-3">
                  {(isExpired || isInvalid) && (
                    <Link
                      to="/verify-email/pending"
                      state={{ email: '' }}
                      className="btn-primary w-full"
                    >
                      Request a new link
                    </Link>
                  )}
                  <Link to="/register" className="btn-secondary w-full">
                    Register again
                  </Link>
                </div>
              </>
            )}

            {/* ── Success is handled via navigate(), but show a brief flash ── */}
            {verify.isSuccess && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 mb-6">
                  <CheckCircle size={36} className="text-emerald-600" />
                </div>
                <h1 className="font-display font-extrabold text-2xl text-ink-900 mb-2">
                  Email verified!
                </h1>
                <p className="text-ink-500 text-sm">Redirecting you to your dashboard…</p>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
