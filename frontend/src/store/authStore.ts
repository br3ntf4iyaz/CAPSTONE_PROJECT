import { useState, useEffect } from 'react'
import type { User } from '@/types'

// Lightweight pub/sub store — no external dependency needed.
//
// Tokens are stored in sessionStorage (not localStorage) so that each browser
// tab has its own completely isolated auth session. This prevents cross-tab
// contamination: if admin and youth portals are both open in separate tabs,
// one tab logging in or out cannot affect the other.
//
// sessionStorage persists across page refreshes within the same tab but is
// cleared when the tab closes — correct behaviour for a secure gov app.

let _user: User | null = null
let _access: string | null = sessionStorage.getItem('access')
let _refresh: string | null = sessionStorage.getItem('refresh')

// Remove any tokens left in localStorage from the old auth scheme so they
// cannot pollute new tabs that still read from localStorage on first load.
localStorage.removeItem('access')
localStorage.removeItem('refresh')

let _listeners: Array<() => void> = []

function notify() {
  _listeners.forEach((fn) => fn())
}

export const authStore = {
  get user() { return _user },
  get access() { return _access },
  get refresh() { return _refresh },
  get isAuthenticated() { return !!_access },

  setAuth(user: User, access: string, refresh: string) {
    _user = user
    _access = access
    _refresh = refresh
    sessionStorage.setItem('access', access)
    sessionStorage.setItem('refresh', refresh)
    notify()
  },

  setUser(user: User) {
    _user = user
    notify()
  },

  // Pre-load tokens into memory without notifying (used mid-login before setAuth)
  storeTokens(access: string, refresh: string) {
    _access = access
    _refresh = refresh
    sessionStorage.setItem('access', access)
    sessionStorage.setItem('refresh', refresh)
  },

  // Update tokens after a silent 401 refresh.
  // With ROTATE_REFRESH_TOKENS=True Django issues a NEW refresh token on every
  // /token/refresh/ call and blacklists the old one. We must save both or the
  // next refresh will fail with "token blacklisted" and force a logout.
  refreshTokens(access: string, refresh?: string) {
    _access = access
    sessionStorage.setItem('access', access)
    if (refresh) {
      _refresh = refresh
      sessionStorage.setItem('refresh', refresh)
    }
  },

  logout() {
    _user = null
    _access = null
    _refresh = null
    sessionStorage.removeItem('access')
    sessionStorage.removeItem('refresh')
    notify()
  },

  subscribe(fn: () => void) {
    _listeners.push(fn)
    return () => {
      _listeners = _listeners.filter((l) => l !== fn)
    }
  },
}

export function useAuthStore() {
  const [, rerender] = useState(0)
  useEffect(() => {
    return authStore.subscribe(() => rerender((n) => n + 1))
  }, [])
  return authStore
}
