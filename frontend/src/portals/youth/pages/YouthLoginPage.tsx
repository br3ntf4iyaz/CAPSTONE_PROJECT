import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ArrowRight, Mail, Lock, AlertCircle } from 'lucide-react'
import { LydoLogo } from '@/components/ui/LydoLogo'
import { useLogin } from '@/hooks/useAuth'
import { cn } from '@/utils'
import { Spinner } from '@/components/ui/Spinner'
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

export default function YouthLoginPage() {
  const [showPw, setShowPw] = useState(false)
  const [searchParams] = useSearchParams()
  const rawNext = searchParams.get('next')
  // Only allow safe relative paths — reject external URLs and protocol-relative URLs
  const redirectTo = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null

  const login = useLogin({
    allowedRoles: ['youth', 'lgu_admin', 'super_admin'],
    portalName: 'Youth Portal',
    redirectTo,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  return (
    <div className="min-h-screen flex flex-col bg-paper-50">
      {/* PH stripe */}
      <div className="ph-stripe h-1 w-full" />

      {/* Top brand strip */}
      <div className="bg-white border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <LydoLogo size={36} />
            <span className="flex flex-col leading-none">
              <span className="font-display font-extrabold text-lg text-ink-900 tracking-tightish">LYDO</span>
              <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">Lucena Youth</span>
            </span>
          </Link>
          <Link to="/" className="text-sm font-semibold text-ink-600 hover:text-primary-700 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5">
        {/* ── Left: Brand panel ─────────────────────────────────────── */}
        <aside className="hidden lg:flex lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-primary-700 to-primary-900 text-white p-12 flex-col justify-between">
          {/* Decorative pattern */}
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <div
            aria-hidden
            className="absolute -bottom-24 -left-16 w-96 h-96 rounded-full bg-accent-400/20 blur-3xl"
          />

          <div className="relative">
            <p className="eyebrow-on-dark mb-4">Welcome back</p>
            <h1 className="font-display font-extrabold text-5xl xl:text-6xl tracking-tighter2 leading-[1.05] mb-6">
              Pick up where you left off.
            </h1>
            <p className="text-primary-100 text-lg leading-relaxed max-w-md">
              Your programs, upcoming events, and the latest from LYDO are
              waiting on your dashboard.
            </p>
          </div>

          <div className="relative flex flex-col gap-3 max-w-sm">
            <div className="flex items-center gap-3 text-primary-100/80 text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-accent-400" />
              <span>Programs, events &amp; resources in one place</span>
            </div>
            <div className="flex items-center gap-3 text-primary-100/80 text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-accent-400" />
              <span>Track compliance and earn recognition</span>
            </div>
            <div className="flex items-center gap-3 text-primary-100/80 text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-accent-400" />
              <span>Accessible to all Lucena City youth leaders</span>
            </div>
          </div>
        </aside>

        {/* ── Right: Sign-in form ───────────────────────────────────── */}
        <main className="lg:col-span-3 flex items-center justify-center px-4 sm:px-8 py-12 lg:py-16">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <p className="eyebrow mb-3">Sign in</p>
              <h2 className="font-display font-extrabold text-4xl text-ink-900 tracking-tighter2 mb-3">
                Sign in to your account.
              </h2>
              <p className="text-ink-600 leading-relaxed">
                Don't have one yet?{' '}
                <Link to="/register" className="font-semibold text-primary-700 hover:text-primary-800 underline underline-offset-4 decoration-accent-400 decoration-2">
                  Create a free account
                </Link>
              </p>
            </div>

            {/* ── Google Sign-In ────────────────────────────────────── */}
            <GoogleSignInButton label="Sign in with Google" redirectTo={redirectTo} />

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-ink-100" />
              <span className="text-xs font-semibold text-ink-400 uppercase tracking-wider">or sign in with email</span>
              <div className="flex-1 h-px bg-ink-100" />
            </div>

            <form onSubmit={handleSubmit(data => login.mutate(data))} className="space-y-5">
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

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label htmlFor="password" className="label !mb-0">Password</label>
                  <Link to="/forgot-password" className="text-xs font-semibold text-primary-700 hover:text-primary-800">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...register('password')}
                    className={cn('input pl-11 pr-11', errors.password && 'input-error')}
                    placeholder="••••••••"
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
              </div>

              {login.isError && (
                <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-700">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{(login.error as any)?.response?.data?.detail ?? 'Invalid email or password.'}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={login.isPending}
                className="btn-primary w-full text-base mt-2"
              >
                {login.isPending ? (
                  <>
                    <Spinner className="w-4 h-4 border-white border-t-transparent" />
                    Signing in…
                  </>
                ) : (
                  <>Sign in <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            {/* Help link */}
            <p className="mt-10 text-sm text-ink-500 leading-relaxed">
              Having trouble?{' '}
              <a href="mailto:lydo@lucenacity.gov.ph" className="font-semibold text-primary-700 hover:text-primary-800">
                Contact LYDO →
              </a>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
