import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { LydoLogo } from '@/components/ui/LydoLogo'
import { useResetPassword } from '@/hooks/useAuth'
import { cn } from '@/utils'
import { Spinner } from '@/components/ui/Spinner'

const schema = z.object({
  password:  z.string().min(8, 'Password must be at least 8 characters'),
  password2: z.string().min(1, 'Please confirm your password'),
}).refine(d => d.password === d.password2, {
  message: 'Passwords do not match',
  path: ['password2'],
})
type FormData = z.infer<typeof schema>

function getStrength(pw: string): { level: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!pw) return { level: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const level = Math.min(4, score) as 0 | 1 | 2 | 3 | 4
  const meta: Record<number, { label: string; color: string }> = {
    0: { label: '', color: '' },
    1: { label: 'Weak', color: 'bg-red-500' },
    2: { label: 'Fair', color: 'bg-amber-400' },
    3: { label: 'Good', color: 'bg-yellow-400' },
    4: { label: 'Strong', color: 'bg-emerald-500' },
  }
  return { level, ...meta[level] }
}

export default function ResetPasswordPage() {
  const [showPw, setShowPw]   = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const resetPassword = useResetPassword()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const passwordValue = watch('password') ?? ''
  const strength = useMemo(() => getStrength(passwordValue), [passwordValue])

  const onSubmit = (data: FormData) => {
    if (!token) return
    resetPassword.mutate({ token, password: data.password, password2: data.password2 })
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-50 px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 mb-6">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <h1 className="font-display font-extrabold text-2xl text-ink-900 mb-3">Invalid reset link</h1>
          <p className="text-ink-600 mb-6">This password reset link is missing or invalid. Please request a new one.</p>
          <Link to="/forgot-password" className="btn-primary inline-flex">
            Request new link <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    )
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
          <div className="mb-10">
            <p className="eyebrow mb-3">Set new password</p>
            <h1 className="font-display font-extrabold text-4xl text-ink-900 tracking-tighter2 mb-3">
              Choose a new password.
            </h1>
            <p className="text-ink-600 leading-relaxed">
              Pick something strong — at least 8 characters with a mix of letters, numbers, and symbols.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="password" className="label">New password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('password')}
                  className={cn('input pl-11 pr-11', errors.password && 'input-error')}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-ink-500 hover:text-primary-700 rounded-md transition-colors"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="error-msg">{errors.password.message}</p>}
              {passwordValue.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', strength.level >= i ? strength.color : 'bg-ink-200')} />
                    ))}
                  </div>
                  {strength.label && (
                    <p className="text-xs text-ink-500">Strength: <span className="font-semibold">{strength.label}</span></p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="password2" className="label">Confirm new password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                <input
                  id="password2"
                  type={showPw2 ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('password2')}
                  className={cn('input pl-11 pr-11', errors.password2 && 'input-error')}
                  placeholder="Re-enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw2(!showPw2)}
                  aria-label={showPw2 ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-ink-500 hover:text-primary-700 rounded-md transition-colors"
                >
                  {showPw2 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password2 && <p className="error-msg">{errors.password2.message}</p>}
            </div>

            {resetPassword.isError && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-700">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{(resetPassword.error as any)?.response?.data?.detail ?? 'Failed to reset password. The link may have expired.'}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={resetPassword.isPending}
              className="btn-primary w-full text-base mt-2"
            >
              {resetPassword.isPending ? (
                <>
                  <Spinner className="w-4 h-4 border-white border-t-transparent" />
                  Saving…
                </>
              ) : (
                <>Save new password <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p className="mt-8 text-sm text-ink-500">
            Link expired?{' '}
            <Link to="/forgot-password" className="font-semibold text-primary-700 hover:text-primary-800">
              Request a new one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
