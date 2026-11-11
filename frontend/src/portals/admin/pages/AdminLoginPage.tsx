import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/api/auth'
import { authStore } from '@/store/authStore'
import { cn } from '@/utils'
import { Spinner } from '@/components/ui/Spinner'
import { LydoLogo } from '@/components/ui/LydoLogo'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

const ADMIN_ROLES = ['lgu_admin', 'super_admin']

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showPw, setShowPw] = useState(false)
  const [searchParams] = useSearchParams()
  const rawNext = searchParams.get('next')
  // Only allow safe relative paths — reject external URLs and protocol-relative URLs
  const redirectTo = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const login = useMutation({
    mutationFn: async ({ email, password }: FormData) => {
      const tokenRes = await authApi.login(email, password)
      const { access, refresh } = tokenRes.data as any
      authStore.storeTokens(access, refresh)
      const meRes = await authApi.me()
      return { user: meRes.data, access, refresh }
    },
    onSuccess: ({ user, access, refresh }) => {
      if (!ADMIN_ROLES.includes(user.role)) {
        authStore.logout()
        toast.error('Access denied. This portal is for LGU admin personnel only.')
        return
      }
      authStore.setAuth(user, access, refresh)
      qc.setQueryData(['me'], user)
      toast.success(`Welcome, ${user.first_name}!`)
      navigate(redirectTo ?? '/admin')
    },
    onError: (err: any) => {
      authStore.logout()
      const detail = err?.response?.data?.detail
      toast.error(detail ?? 'Invalid email or password.')
    },
  })

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex mb-5">
            <LydoLogo size={72} className="rounded-2xl shadow-lg" />
          </div>
          <h1 className="text-2xl font-bold text-white">LGU Admin Portal</h1>
          <p className="text-slate-400 mt-1.5 text-sm">Authorized Personnel Only</p>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 bg-yellow-900/40 border border-yellow-700/50 rounded-xl px-4 py-3 mb-6">
          <AlertTriangle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-300">
            This portal is for authorized LGU personnel only. Unauthorized access attempts are logged and may be prosecuted.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Lock size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-white">Sign in to Admin Portal</h2>
          </div>

          <form onSubmit={handleSubmit(data => login.mutate(data))} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                {...register('email')}
                className={cn(
                  'w-full px-3 py-2.5 bg-slate-700 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
                  errors.email ? 'border-red-500' : 'border-slate-600'
                )}
                placeholder="admin@lucenacity.gov.ph"
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className={cn(
                    'w-full px-3 py-2.5 bg-slate-700 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors pr-10',
                    errors.password ? 'border-red-500' : 'border-slate-600'
                  )}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={login.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary-700 hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              {login.isPending ? (
                <>
                  <Spinner className="w-4 h-4 border-white border-t-transparent" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Lucena City Youth Development Portal &mdash; Admin System
        </p>
      </div>
    </div>
  )
}
