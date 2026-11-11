import apiClient from './client'
import type { AuthResponse, User } from '@/types'

/** Emails are case-insensitive and phone keyboards capitalise / add spaces, so always send them clean. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/login/', { email: normalizeEmail(email), password }),

  register: (data: {
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
  }) => apiClient.post<{ detail: string; email: string }>('/auth/register/', { ...data, email: normalizeEmail(data.email) }),

  verifyEmail: (token: string) =>
    apiClient.get<AuthResponse & { detail: string }>(`/auth/verify-email/?token=${token}`),

  resendVerification: (email: string) =>
    apiClient.post<{ detail: string }>('/auth/resend-verification/', { email: normalizeEmail(email) }),

  googleAuth: (accessToken: string) =>
    apiClient.post<AuthResponse & { created: boolean }>('/auth/google/', { access_token: accessToken }),

  logout: (refresh: string) =>
    apiClient.post('/auth/logout/', { refresh }),

  me: () => apiClient.get<User>('/auth/me/'),

  updateMe: (data: Partial<User>) =>
    apiClient.patch<User>('/auth/me/', data),

  updateProfile: (data: Record<string, unknown>) =>
    apiClient.patch('/auth/me/profile/', data),

  updateSkills: (skills: string[]) =>
    apiClient.post('/auth/me/skills/', { skills }),

  updateInterests: (interests: string[]) =>
    apiClient.post('/auth/me/interests/', { interests }),

  completeOnboarding: () =>
    apiClient.post('/auth/me/complete-onboarding/'),

  forgotPassword: (email: string) =>
    apiClient.post<{ detail: string }>('/auth/forgot-password/', { email: normalizeEmail(email) }),

  resetPassword: (token: string, password: string, password2: string) =>
    apiClient.post<{ detail: string }>('/auth/reset-password/', { token, password, password2 }),

  changePassword: (data: { old_password: string; new_password: string; new_password2: string }) =>
    apiClient.post('/auth/me/change-password/', data),

  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('avatar', file)
    return apiClient.patch('/auth/me/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
