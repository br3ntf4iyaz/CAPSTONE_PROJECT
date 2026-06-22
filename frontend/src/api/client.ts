import axios from 'axios'
import { authStore } from '@/store/authStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token to every request — read from in-memory store to prevent
// cross-tab contamination (another tab logging in as a different user would
// overwrite localStorage but cannot change authStore._access in this tab)
apiClient.interceptors.request.use((config) => {
  const access = authStore.access
  if (access) config.headers.Authorization = `Bearer ${access}`
  return config
})

// Refresh token on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = authStore.refresh
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh })
          authStore.refreshTokens(data.access, data.refresh)
          original.headers.Authorization = `Bearer ${data.access}`
          return apiClient(original)
        } catch {
          authStore.logout()
        }
      } else {
        authStore.logout()
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
