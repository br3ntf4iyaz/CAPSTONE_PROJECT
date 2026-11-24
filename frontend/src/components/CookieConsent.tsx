import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie, ShieldCheck, X } from 'lucide-react'
import { CONSENT_EVENT, OPEN_SETTINGS_EVENT, getConsent, saveConsent } from '@/lib/consent'

/**
 * First-visit cookie notice with three choices, plus a preferences panel that can be reopened from the footer.
 * Essential storage (sign-in, security, this choice) is always on. Preferences are off until the visitor agrees.
 */
export default function CookieConsent() {
  const [decided, setDecided] = useState<boolean>(() => getConsent() !== null)
  const [panel, setPanel] = useState(false)
  const [prefs, setPrefs] = useState<boolean>(() => getConsent()?.preferences ?? false)

  useEffect(() => {
    const open = () => { setPrefs(getConsent()?.preferences ?? false); setPanel(true) }
    const changed = () => setDecided(getConsent() !== null)
    window.addEventListener(OPEN_SETTINGS_EVENT, open)
    window.addEventListener(CONSENT_EVENT, changed)
    return () => {
      window.removeEventListener(OPEN_SETTINGS_EVENT, open)
      window.removeEventListener(CONSENT_EVENT, changed)
    }
  }, [])

  const choose = (preferences: boolean) => { saveConsent(preferences); setDecided(true); setPanel(false) }

  return (
    <>
      {!decided && !panel && (
        <div role="dialog" aria-label="Cookie notice" className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4">
          <div className="mx-auto max-w-4xl rounded-2xl border border-ink-200 bg-white p-4 shadow-2xl sm:p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Cookie size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold text-ink-900">We use cookies</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">
                  Essential storage keeps you signed in and the site secure, and is always on. With your permission we also remember your
                  preferences, such as light or dark theme and your chat history. Read our{' '}
                  <Link to="/cookies" className="font-semibold text-primary-700 underline underline-offset-2">Cookie Policy</Link> and{' '}
                  <Link to="/privacy" className="font-semibold text-primary-700 underline underline-offset-2">Privacy Policy</Link>.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button type="button" className="btn-primary btn-sm" onClick={() => choose(true)}>Accept All Cookies</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => choose(false)}>Reject Non-Essential Cookies</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => { setPrefs(false); setPanel(true) }}>Manage Preferences</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {panel && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Cookie preferences">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-ink-900">Cookie preferences</h2>
                <p className="mt-1 text-sm text-ink-600">Choose what this site may store in your browser. You can change this at any time from the footer.</p>
              </div>
              <button type="button" aria-label="Close" className="rounded-lg p-1 text-ink-500 hover:bg-ink-100" onClick={() => { setPanel(false) }}><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-ink-100 bg-ink-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-900"><ShieldCheck size={16} className="text-emerald-600" /> Strictly necessary</p>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">Always on</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-600">Keeps you signed in, protects your account and remembers this choice. The site cannot work without it.</p>
              </div>

              <div className="rounded-xl border border-ink-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="pref-toggle" className="text-sm font-semibold text-ink-900">Preferences</label>
                  <button
                    id="pref-toggle" type="button" role="switch" aria-checked={prefs}
                    onClick={() => setPrefs(p => !p)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${prefs ? 'bg-primary-600' : 'bg-ink-300'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${prefs ? 'left-[22px]' : 'left-0.5'}`} />
                    <span className="sr-only">{prefs ? 'On' : 'Off'}</span>
                  </button>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-600">Remembers your light or dark theme, your recent chat with the assistant and the scholarships you saved. Off by default.</p>
              </div>

              <p className="text-xs text-ink-500">This platform does not use analytics or advertising cookies.</p>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary btn-sm" onClick={() => choose(false)}>Reject Non-Essential</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => choose(true)}>Accept All</button>
              <button type="button" className="btn-primary btn-sm" onClick={() => choose(prefs)}>Save my choice</button>
            </div>
            <p className="mt-3 text-center text-xs text-ink-500">
              <Link to="/cookies" onClick={() => setPanel(false)} className="underline underline-offset-2">Read the Cookie Policy</Link>
            </p>
          </div>
        </div>
      )}
    </>
  )
}
