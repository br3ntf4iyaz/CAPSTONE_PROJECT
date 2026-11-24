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

/** Calls that are safe to repeat when the connection or a gateway fails: reads, and signing in. */
function isRepeatable(config: any): boolean {
  const method = String(config?.method ?? 'get').toLowerCase()
  if (['get', 'head', 'options'].includes(method)) return true
  return method === 'post' && /\/auth\/(login|token\/refresh)\/?$/.test(String(config?.url ?? ''))
}

// Refresh token on 401, and repeat safe calls a few times when the network or a gateway (502/503/504) fails
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    const gatewayProblem = !error.response || status === 502 || status === 503 || status === 504
    if (original && gatewayProblem && isRepeatable(original) && (original._tries ?? 0) < 3) {
      original._tries = (original._tries ?? 0) + 1
      await new Promise(r => setTimeout(r, 400 * original._tries))
      return apiClient(original)
    }
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
