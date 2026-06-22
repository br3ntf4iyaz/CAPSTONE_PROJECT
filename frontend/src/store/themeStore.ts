import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme') as Theme | null
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
  localStorage.setItem('theme', theme)
}

// Initialize theme immediately (before React mounts) to avoid flash
applyTheme(getStoredTheme())

// Pub/sub store
let _theme: Theme = getStoredTheme()
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
