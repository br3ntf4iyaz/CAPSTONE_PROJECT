import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { LydoLogo } from '@/components/ui/LydoLogo'
import { useForgotPassword } from '@/hooks/useAuth'
import { cn } from '@/utils'
import { Spinner } from '@/components/ui/Spinner'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const forgotPassword = useForgotPassword()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = (data: FormData) => {
    forgotPassword.mutate(data.email, {
      onSuccess: () => {
        setSentEmail(data.email)
        setSubmitted(true)
      },
    })
  }

  return (
    <div className="min-h-screen flex flex-col bg-paper-50">
      <div className="ph-stripe h-1 w-full" />

      <div className="bg-white border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <LydoLogo size={36} />
            <span className="flex flex-col leading-none">
              <span className="font-display font-extrabold text-lg text-ink-900 tracking-tightish">LYDO</span>
              <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">Lucena Youth</span>
            </span>
          </Link>
          <Link to="/login" className="text-sm font-semibold text-ink-600 hover:text-primary-700 transition-colors">
            ← Back to sign in
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {submitted ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 mb-6">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h1 className="font-display font-extrabold text-3xl text-ink-900 tracking-tighter2 mb-3">
                Check your inbox
              </h1>
              <p className="text-ink-600 leading-relaxed mb-2">
                If <strong>{sentEmail}</strong> is registered, we've sent a password reset link to that address.
              </p>
              <p className="text-sm text-ink-500 mb-8">
                The link expires in 1 hour. Check your spam folder if you don't see it.
              </p>
              <Link to="/login" className="btn-primary inline-flex">
                Back to sign in <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-10">
                <p className="eyebrow mb-3">Password reset</p>
                <h1 className="font-display font-extrabold text-4xl text-ink-900 tracking-tighter2 mb-3">
                  Forgot your password?
                </h1>
                <p className="text-ink-600 leading-relaxed">
                  Enter the email address you registered with and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label htmlFor="email" className="label">Email address</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      {...register('email')}
                      className={cn('input pl-11', errors.email && 'input-error')}
                      placeholder="you@example.com"
                    />
                  </div>
                  {errors.email && <p className="error-msg">{errors.email.message}</p>}
                </div>

                {forgotPassword.isError && (
                  <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-700">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{(forgotPassword.error as any)?.response?.data?.detail ?? 'Something went wrong. Please try again.'}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={forgotPassword.isPending}
                  className="btn-primary w-full text-base"
                >
                  {forgotPassword.isPending ? (
                    <>
                      <Spinner className="w-4 h-4 border-white border-t-transparent" />
                      Sending link…
                    </>
                  ) : (
                    <>Send reset link <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              <p className="mt-8 text-sm text-ink-500">
                Remember your password?{' '}
                <Link to="/login" className="font-semibold text-primary-700 hover:text-primary-800">
                  Sign in instead
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
