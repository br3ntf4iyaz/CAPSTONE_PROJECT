/**
 * Cookie / browser-storage consent.
 *
 *   essential    always on: sign-in (kept in sessionStorage), security, and this very choice.
 *   preferences  only with consent: light/dark theme, the chat assistant's recent conversation, saved scholarships.
 *
 * The platform uses no analytics or advertising storage. Nothing outside "essential" is written to the browser until the
 * visitor accepts it. Without consent, preference data is kept in memory for the current page only.
 */
const KEY = 'lydo-cookie-consent'
export const CONSENT_VERSION = 1
export const CONSENT_EVENT = 'lydo-consent-change'
export const OPEN_SETTINGS_EVENT = 'lydo-open-cookie-settings'

/** Everything preference storage may have written, removed when consent is withdrawn. */
const PREFERENCE_KEYS = ['theme', 'lydo_chatbot_v1', 'lydo_saved_scholarships']

export interface Consent { preferences: boolean; decidedAt: string; version: number }

export function getConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    if (typeof c?.preferences === 'boolean') return c as Consent
  } catch { /* storage blocked or corrupt: treat as undecided */ }
  return null
}

export function hasPreferenceConsent(): boolean {
  return getConsent()?.preferences === true
}

export function saveConsent(preferences: boolean): void {
  const value: Consent = { preferences, decidedAt: new Date().toISOString(), version: CONSENT_VERSION }
  try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* blocked: the choice lasts until the page closes */ }
  if (!preferences) {
    for (const k of PREFERENCE_KEYS) { try { localStorage.removeItem(k) } catch { /* ignore */ } }
    memory.clear()
  }
  window.dispatchEvent(new Event(CONSENT_EVENT))
}

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))
}

const memory = new Map<string, string>()

/** Storage for preference data. Uses localStorage only when the visitor consented, otherwise memory (this page only). */
export const prefStorage = {
  getItem(key: string): string | null {
    if (hasPreferenceConsent()) {
      try { return localStorage.getItem(key) } catch { /* fall through */ }
    }
    return memory.get(key) ?? null
  },
  setItem(key: string, value: string): void {
    if (hasPreferenceConsent()) {
      try { localStorage.setItem(key, value); return } catch { /* fall through to memory */ }
    }
    memory.set(key, value)
  },
  removeItem(key: string): void {
    memory.delete(key)
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  },
}
