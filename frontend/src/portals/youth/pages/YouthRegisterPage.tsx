import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ArrowRight, Mail, Lock, User, Check, MapPin, AlertCircle } from 'lucide-react'
import { LydoLogo } from '@/components/ui/LydoLogo'
import { useRegister } from '@/hooks/useAuth'
import { cn } from '@/utils'
import { Spinner } from '@/components/ui/Spinner'
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton'

const LUCENA_BARANGAYS = [
  'Barangay 1 (Poblacion)', 'Barangay 2 (Poblacion)', 'Barangay 3 (Poblacion)',
  'Barangay 4 (Poblacion)', 'Barangay 5 (Poblacion)', 'Barangay 6 (Poblacion)',
  'Barangay 7 (Poblacion)', 'Barangay 8 (Poblacion)', 'Barangay 9 (Poblacion)',
  'Barangay 10 (Poblacion)', 'Barangay 11 (Poblacion)',
  'Barra', 'Bocohan', 'Cotta', 'Dalahican', 'Domoit', 'Gulang-Gulang',
  'Ilayang Dupay', 'Ibabang Dupay', 'Ilayang Iyam', 'Ibabang Iyam',
  'Isabang', 'Market View', 'Mayao Crossing', 'Mayao Kanluran',
  'Mayao Parada', 'Mayao Silangan', 'Ransohan', 'Salinas', 'Talao-Talao',
  'Ibabang Talim', 'Ilayang Talim',
]

const schema = z.object({
  first_name:   z.string().min(2, 'First name is required'),
  last_name:    z.string().min(2, 'Last name is required'),
  email:        z.string().email('Enter a valid email address'),
  barangay:     z.string().min(1, 'Please select your barangay'),
  youth_type:   z.enum(['general_youth', 'sk', 'youth_org_leader'], { required_error: 'Select your role' }),
  organization: z.string().max(200).optional(),
  position:     z.string().max(200).optional(),
  password:     z.string().min(8, 'Password must be at least 8 characters'),
  password2:    z.string().min(1, 'Please confirm your password'),
  terms:        z.boolean().refine(v => v === true, 'You must agree to the terms'),
}).superRefine((data, ctx) => {
  if (data.password !== data.password2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Passwords do not match', path: ['password2'] })
  }
  if (data.youth_type === 'youth_org_leader') {
    if (!data.organization?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Organization name is required', path: ['organization'] })
    }
    if (!data.position?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Your position is required', path: ['position'] })
    }
  }
})

type FormData = z.infer<typeof schema>

const YOUTH_TYPES = [
  { value: 'general_youth' as const,    label: 'General youth',     hint: 'Lucena resident, ages 15–30' },
  { value: 'sk' as const,               label: 'SK member',         hint: 'Sangguniang Kabataan official' },
  { value: 'youth_org_leader' as const, label: 'Youth org leader',  hint: 'Recognized organization rep' },
]

function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
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

export default function YouthRegisterPage() {
  const [showPw, setShowPw]   = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const registerMutation = useRegister()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const selectedType = watch('youth_type')
  const passwordValue = watch('password') ?? ''
  const strength = useMemo(() => getPasswordStrength(passwordValue), [passwordValue])

  const onSubmit = (data: FormData) => {
    registerMutation.mutate({
      first_name: data.first_name,
      last_name:  data.last_name,
      email:      data.email,
      barangay:   data.barangay,
      youth_type: data.youth_type,
      role:       'youth',
      password:   data.password,
      password2:  data.password2,
      ...(data.youth_type === 'youth_org_leader' ? {
        organization: data.organization ?? '',
        job_title:    data.position ?? '',
      } : {}),
    })
  }

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
        {/* ── Left: Brand panel (sticky) ────────────────────────────── */}
        <aside className="hidden lg:flex lg:col-span-2 lg:sticky lg:top-0 lg:h-screen relative overflow-hidden bg-gradient-to-br from-primary-700 to-primary-900 text-white p-12 flex-col justify-between">
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <div
            aria-hidden
            className="absolute -top-24 -right-16 w-96 h-96 rounded-full bg-accent-400/20 blur-3xl"
          />

          <div className="relative">
            <p className="eyebrow-on-dark mb-4">New here</p>
            <h1 className="font-display font-extrabold text-5xl xl:text-6xl tracking-tighter2 leading-[1.05] mb-6">
              Join Lucena's youth network.
            </h1>
            <p className="text-primary-100 text-lg leading-relaxed max-w-md mb-10">
              Free for every young Lucenahin. One account connects you to
              programs, scholarships, events, and opportunities citywide.
            </p>
          </div>

          <ul className="relative space-y-3 max-w-sm">
            {[
              'Personalized program recommendations',
              'Event reminders for your barangay',
              'Direct line to LYDO announcements',
              'Track your participation history',
            ].map(item => (
              <li key={item} className="flex items-start gap-3 text-primary-100">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent-400 text-primary-900 mt-0.5">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="text-sm leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Right: Form ───────────────────────────────────────────── */}
        <main className="lg:col-span-3 px-4 sm:px-8 py-12 lg:py-16">
          <div className="w-full max-w-lg mx-auto">
            <div className="mb-10">
              <p className="eyebrow mb-3">Create account</p>
              <h2 className="font-display font-extrabold text-4xl text-ink-900 tracking-tighter2 mb-3">
                Tell us about yourself.
              </h2>
              <p className="text-ink-600 leading-relaxed">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-primary-700 hover:text-primary-800 underline underline-offset-4 decoration-accent-400 decoration-2">
                  Sign in instead
                </Link>
              </p>
            </div>

            {/* ── Google Sign-In ────────────────────────────────────── */}
            <GoogleSignInButton label="Sign up with Google" />

            {/* Divider &mdash; only shown when Google button is available */}
            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-ink-100" />
              <span className="text-xs font-semibold text-ink-400 uppercase tracking-wider">or register with email</span>
              <div className="flex-1 h-px bg-ink-100" />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

              {/* ── Youth Type &mdash; pill cards ──────────────────────── */}
              <fieldset>
                <legend className="label mb-3">I am a</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {YOUTH_TYPES.map(({ value, label, hint }) => {
                    const active = selectedType === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setValue('youth_type', value, { shouldValidate: true })}
                        className={cn(
                          'relative text-left p-4 rounded-2xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
                          active
                            ? 'border-primary-600 bg-primary-50 shadow-sm'
                            : 'border-ink-200 bg-white hover:border-primary-300 hover:bg-primary-50/40',
                        )}
                        aria-pressed={active}
                      >
                        {active && (
                          <span className="absolute top-2.5 right-2.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                        <div className={cn('font-display font-bold text-base leading-tight mb-1', active ? 'text-primary-800' : 'text-ink-900')}>
                          {label}
                        </div>
                        <div className="text-xs text-ink-500 leading-snug">{hint}</div>
                      </button>
                    )
                  })}
                </div>
                {errors.youth_type && <p className="error-msg">{errors.youth_type.message}</p>}
              </fieldset>

              {/* ── Org leader: organization name + position ─────── */}
              {selectedType === 'youth_org_leader' && (
                <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 space-y-4">
                  <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Your organization</p>
                  <div>
                    <label htmlFor="organization" className="label">Organization name</label>
                    <input
                      id="organization"
                      {...register('organization')}
                      className={cn('input', errors.organization && 'input-error')}
                      placeholder="e.g. Kabataan Lucena Youth Club"
                    />
                    {errors.organization && <p className="error-msg">{errors.organization.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="position" className="label">Your position</label>
                    <input
                      id="position"
                      {...register('position')}
                      className={cn('input', errors.position && 'input-error')}
                      placeholder="e.g. President"
                    />
                    {errors.position && <p className="error-msg">{errors.position.message}</p>}
                  </div>
                </div>
              )}

              {/* ── Names ────────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="label">First name</label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                    <input
                      id="first_name"
                      {...register('first_name')}
                      className={cn('input pl-11', errors.first_name && 'input-error')}
                      placeholder="Juan"
                    />
                  </div>
                  {errors.first_name && <p className="error-msg">{errors.first_name.message}</p>}
                </div>
                <div>
                  <label htmlFor="last_name" className="label">Last name</label>
                  <input
                    id="last_name"
                    {...register('last_name')}
                    className={cn('input', errors.last_name && 'input-error')}
                    placeholder="dela Cruz"
                  />
                  {errors.last_name && <p className="error-msg">{errors.last_name.message}</p>}
                </div>
              </div>

              {/* ── Email ────────────────────────────────────────── */}
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
                    placeholder="juan@example.com"
                  />
                </div>
                {errors.email && <p className="error-msg">{errors.email.message}</p>}
              </div>

              {/* ── Barangay ─────────────────────────────────────── */}
              <div>
                <label htmlFor="barangay" className="label">Your Barangay</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                  <select
                    id="barangay"
                    {...register('barangay')}
                    className={cn('input pl-11', errors.barangay && 'input-error')}
                    defaultValue=""
                  >
                    <option value="" disabled>Select your barangay…</option>
                    {LUCENA_BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                {errors.barangay && <p className="error-msg">{errors.barangay.message}</p>}
              </div>

              {/* ── Passwords ────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="password" className="label">Password</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                    <input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      {...register('password')}
                      className={cn('input pl-11 pr-11', errors.password && 'input-error')}
                      placeholder="At least 8 chars"
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
                  {/* Strength bar */}
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
                  <label htmlFor="password2" className="label">Confirm</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                    <input
                      id="password2"
                      type={showPw2 ? 'text' : 'password'}
                      autoComplete="new-password"
                      {...register('password2')}
                      className={cn('input pl-11 pr-11', errors.password2 && 'input-error')}
                      placeholder="Re-enter"
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
              </div>

              {/* ── Terms ────────────────────────────────────────── */}
              <div className="bg-paper-50 border border-ink-100 rounded-2xl p-4">
                <label htmlFor="terms" className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="terms"
                    {...register('terms')}
                    className="mt-0.5 h-4 w-4 rounded border-ink-300 text-primary-600 focus:ring-2 focus:ring-primary-400 focus:ring-offset-1 cursor-pointer accent-primary-600"
                  />
                  <span className="text-sm text-ink-700 leading-relaxed">
                    I agree to the{' '}
                    <Link to="/terms" className="font-semibold text-primary-700 hover:text-primary-800 underline underline-offset-2">terms and conditions</Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="font-semibold text-primary-700 hover:text-primary-800 underline underline-offset-2">privacy policy</Link>.
                  </span>
                </label>
                {errors.terms && <p className="error-msg">{errors.terms.message}</p>}
              </div>

              {registerMutation.isError && (
                <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-700">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {(() => {
                      const d = (registerMutation.error as any)?.response?.data
                      if (!d) return 'Registration failed. Please try again.'
                      if (typeof d === 'string') return d
                      return Object.values(d).flat().join(' ')
                    })()}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={registerMutation.isPending}
                className="btn-primary w-full text-base"
              >
                {registerMutation.isPending ? (
                  <>
                    <Spinner className="w-4 h-4 border-white border-t-transparent" />
                    Creating account…
                  </>
                ) : (
                  <>Create my account <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            <p className="mt-8 text-xs text-ink-500 leading-relaxed text-center">
              By creating an account, you agree to receive notifications from LYDO
              about programs and events relevant to your barangay.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
