import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Mail, RefreshCw, ArrowLeft, CheckCircle } from 'lucide-react'
import { LydoLogo } from '@/components/ui/LydoLogo'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import toast from 'react-hot-toast'
import { Spinner } from '@/components/ui/Spinner'

export default function VerifyEmailPendingPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const email: string = (location.state as any)?.email ?? ''
  const [resent, setResent] = useState(false)

  // If someone navigates here directly without an email, redirect to register
  if (!email) {
    navigate('/register', { replace: true })
    return null
  }

  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(email),
    onSuccess: () => {
      setResent(true)
      toast.success('Verification email resent! Check your inbox.')
    },
    onError: () => toast.error('Could not resend email. Please try again shortly.'),
  })

  return (
    <div className="min-h-screen flex flex-col bg-paper-50">
      {/* PH stripe */}
      <div className="ph-stripe h-1 w-full" />

      {/* Top brand strip */}
      <div className="bg-white border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <LydoLogo size={36} />
            <span className="flex flex-col leading-none">
              <span className="font-display font-extrabold text-lg text-ink-900 tracking-tightish">LYDO</span>
              <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">Lucena Youth</span>
            </span>
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">

          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-50 border-4 border-primary-100 mb-6">
            <Mail size={36} className="text-primary-700" />
          </div>

          {/* Heading */}
          <h1 className="font-display font-extrabold text-3xl text-ink-900 tracking-tightish mb-3">
            Check your email
          </h1>
          <p className="text-ink-600 leading-relaxed mb-2">
            We sent a verification link to
          </p>
          <p className="font-semibold text-primary-700 text-lg mb-6 break-all">
            {email}
          </p>
          <p className="text-sm text-ink-500 leading-relaxed mb-8">
            Click the link in the email to activate your account. The link expires in{' '}
            <strong className="text-ink-700">24 hours</strong>.
            Don't forget to check your <strong className="text-ink-700">spam folder</strong>.
          </p>

          {/* Resend button */}
          <div className="space-y-3">
            {resent ? (
              <div className="flex items-center justify-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-medium">
                <CheckCircle size={16} />
                Email resent! Check your inbox again.
              </div>
            ) : (
              <button
                onClick={() => resend.mutate()}
                disabled={resend.isPending}
                className="btn-secondary w-full"
              >
                {resend.isPending ? (
                  <>
                    <Spinner className="w-4 h-4 border-primary-600 border-t-transparent" />
                    Sending…
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Resend verification email
                  </>
                )}
              </button>
            )}

            <Link
              to="/register"
              className="flex items-center justify-center gap-2 text-sm text-ink-500 hover:text-primary-700 transition-colors font-medium py-2"
            >
              <ArrowLeft size={14} />
              Wrong email? Go back and register again
            </Link>
          </div>

          {/* Already verified? */}
          <div className="mt-8 pt-6 border-t border-ink-100">
            <p className="text-sm text-ink-500">
              Already verified?{' '}
              <Link to="/login" className="font-semibold text-primary-700 hover:text-primary-800 underline underline-offset-2">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
