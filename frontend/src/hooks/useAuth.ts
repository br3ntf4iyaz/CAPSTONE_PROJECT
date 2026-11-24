import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { authStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await authApi.me()
      authStore.setUser(data)
      return data
    },
    enabled: authStore.isAuthenticated,
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
}

/** The message to show when signing in fails. A server or network problem must not look like a wrong password. */
export function loginErrorMessage(err: any): string {
  const res = err?.response
  const detail = res?.data?.detail
  if (!res) return 'Cannot reach the server. Check your internet connection and try again.'
  if (typeof detail === 'string' && detail) return detail
  if (res.status >= 500) return 'The server had a problem signing you in. Please try again in a moment. If it keeps happening, contact LYDO.'
  if (res.status === 429) return 'Too many attempts. Please wait a minute and try again.'
  const body = res.data && typeof res.data === 'object'
    ? Object.values(res.data).flat().filter(v => typeof v === 'string').join(' ')
    : ''
  return `Sign in failed (code ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}). Check your email and password and try again.`
}

interface LoginOptions {
  allowedRoles?: string[]
  portalName?: string
  /** Safe post-login redirect path (must start with '/'); falls back to '/dashboard'. */
  redirectTo?: string | null
}

/** Returns the redirect target only if it is a safe relative path. */
function safeRedirect(next: string | null | undefined, fallback: string): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  return fallback
}

export function useLogin(options?: LoginOptions) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      // Step 1: get tokens
      const tokenRes = await authApi.login(email, password)
      const { access, refresh } = tokenRes.data as any

      // Store tokens in memory (and localStorage) so the next request is authenticated.
      // Using storeTokens keeps _access in sync so the interceptor reads this tab's token.
      authStore.storeTokens(access, refresh)

      // Step 2: fetch user profile with the new token
      const meRes = await authApi.me()
      return { user: meRes.data, access, refresh }
    },
    onSuccess: ({ user, access, refresh }) => {
      // Validate that the user's role is allowed for this portal
      if (options?.allowedRoles && !options.allowedRoles.includes(user.role)) {
        authStore.logout()
        const portal = options.portalName ?? 'this portal'
        toast.error(`Access denied. Your account type is not allowed in ${portal}.`)
        return
      }
      authStore.setAuth(user, access, refresh)
      qc.setQueryData(['me'], user)
      toast.success(`Welcome back, ${user.first_name}!`)
      if (!user.onboarding_complete) {
        navigate('/onboarding')
      } else {
        navigate(safeRedirect(options?.redirectTo, '/dashboard'))
      }
    },
    onError: (err: any) => {
      // Clear any partially stored tokens on failure
      authStore.logout()
      const data = err?.response?.data
      // Special handling for unverified email
      if (data?.code === 'email_not_verified') {
        toast.error('Please verify your email first. Check your inbox for the verification link.', { duration: 5000 })
        return
      }
      toast.error(loginErrorMessage(err))
    },
  })
}

export function useRegister() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (payload: {
      email: string
      first_name: string
      last_name: string
      barangay?: string
      role: string
      youth_type?: string
      password: string
      password2: string
      organization?: string
      job_title?: string
      accepted_terms: boolean
    }) => {
      const res = await authApi.register(payload)
      // Register endpoint now returns { detail, email } \u2014 no JWT yet
      return { email: res.data.email }
    },
    onSuccess: ({ email }) => {
      // Redirect to the "check your email" page, passing the email as state
      navigate('/verify-email/pending', { state: { email } })
    },
    onError: (err: any) => {
      // Show the first validation error from the backend
      const data = err?.response?.data
      if (data) {
        const msg = Object.values(data).flat().join(' ')
        toast.error(msg || 'Registration failed. Please check your details.')
      } else {
        toast.error('Cannot connect to server. Is the backend running?')
      }
    },
  })
}

export function useGoogleAuth(redirectTo?: string | null) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ token, accepted = false }: { token: string; accepted?: boolean }) => {
      const res = await authApi.googleAuth(token, accepted)
      const { user, access, refresh, created } = res.data as any
      authStore.storeTokens(access, refresh)
      return { user, access, refresh, created }
    },
    onSuccess: ({ user, access, refresh, created }) => {
      authStore.setAuth(user, access, refresh)
      qc.setQueryData(['me'], user)
      if (created) {
        toast.success(`Welcome to LYDO, ${user.first_name}! Account created via Google.`)
      } else {
        toast.success(`Welcome back, ${user.first_name}!`)
      }
      navigate(safeRedirect(redirectTo, '/dashboard'))
    },
    onError: (err: any) => {
      authStore.logout()
      // A new account needs the person to agree to the policies first: the button asks, so no error toast here
      if (err?.response?.data?.code === 'terms_required') return
      const detail = err?.response?.data?.detail
      toast.error(detail ?? 'Google Sign-In failed. Please try again.')
    },
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      toast.error(detail ?? 'Something went wrong. Please try again.')
    },
  })
}

export function useResetPassword() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: ({ token, password, password2 }: { token: string; password: string; password2: string }) =>
      authApi.resetPassword(token, password, password2),
    onSuccess: () => {
      toast.success('Password reset! You can now sign in with your new password.')
      navigate('/login')
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      toast.error(detail ?? 'Failed to reset password. The link may have expired.')
    },
  })
}

export function useLogout() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  return () => {
    const refresh = authStore.refresh
    if (refresh) authApi.logout(refresh).catch(() => {})
    authStore.logout()
    qc.clear()
    navigate('/login')
  }
}
