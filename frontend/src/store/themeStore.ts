import { useState, useEffect } from 'react'
import { CONSENT_EVENT, hasPreferenceConsent, prefStorage } from '@/lib/consent'

type Theme = 'light' | 'dark'

function getStoredTheme(): Theme {
  try {
    const stored = prefStorage.getItem('theme') as Theme | null
    if (stored === 'dark' || stored === 'light') return stored
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  prefStorage.setItem('theme', theme)  // stored in the browser only if the visitor accepted preference cookies
}

// Initialize theme immediately (before React mounts) to avoid flash
applyTheme(getStoredTheme())

// Pub/sub store
let _theme: Theme = getStoredTheme()

// When the visitor accepts preferences later, keep the theme they are already using
if (typeof window !== 'undefined') {
  window.addEventListener(CONSENT_EVENT, () => { if (hasPreferenceConsent()) prefStorage.setItem('theme', _theme) })
}
let _listeners: Array<() => void> = []

function notify() {
  _listeners.forEach((fn) => fn())
}

export const themeStore = {
  get theme() { return _theme },
  get isDark() { return _theme === 'dark' },

  setTheme(theme: Theme) {
    _theme = theme
    applyTheme(theme)
    notify()
  },

  toggle() {
    themeStore.setTheme(_theme === 'dark' ? 'light' : 'dark')
  },

  subscribe(fn: () => void) {
    _listeners.push(fn)
    return () => {
      _listeners = _listeners.filter((l) => l !== fn)
    }
  },
}

export function useTheme() {
  const [, rerender] = useState(0)
  useEffect(() => {
    return themeStore.subscribe(() => rerender((n) => n + 1))
  }, [])
  return themeStore
}
