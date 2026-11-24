import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

/**
 * Catches render-time errors thrown anywhere in a route's subtree.
 *
 * Without this, a single uncaught error in a child component (e.g.
 * `events.filter is not a function` from a malformed API response)
 * blanks the entire app &mdash; the user sees a white page with no way out
 * except a manual reload.
 *
 * With it: the failing route shows a contained, branded error card
 * with a "Try again" reset and a "Go home" escape hatch. Other routes
 * remain fully functional, and the app shell (nav, footer) keeps rendering.
 *
 * Mount one of these per route \u2014 App.tsx wraps every `<Wrap>` in this.
 */

/** A page file that no longer exists on the server: the site was updated while this tab was open. */
export function isStaleBundleError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error ?? '')
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(msg)
}

/** Reload once to pick up the new version. The timestamp stops an endless reload loop if the problem is something else. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem('lydo-stale-reload') || 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem('lydo-stale-reload', String(Date.now()))
  } catch { /* storage blocked: still reload once below */ }
  window.location.reload()
  return true
}

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Forward to console for now; later this is where Sentry would hook in.
    // eslint-disable-next-line no-console
    console.error('[RouteErrorBoundary] Caught render error:', error, info)
    if (isStaleBundleError(error)) reloadForNewVersion()
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    if (isStaleBundleError(this.state.error)) {
      return (
        <div className="max-w-2xl mx-auto py-12">
          <div className="bg-white rounded-3xl border border-primary-100 p-8 sm:p-10 text-center">
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-50 text-primary-700 mb-5">
              <RefreshCw size={26} />
            </span>
            <h1 className="font-display font-extrabold text-2xl text-ink-900 mb-3">The site was just updated.</h1>
            <p className="text-ink-600 leading-relaxed max-w-lg mx-auto mb-6">
              A newer version is available. Reload the page to continue. Your account and progress are safe.
            </p>
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} /> Reload now
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-3xl border border-alert-200 p-8 sm:p-10 text-center">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-alert-50 text-alert-600 mb-5">
            <AlertCircle size={26} />
          </span>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-ink-900 tracking-tighter2 mb-3">
            Something broke on this page.
          </h1>
          <p className="text-ink-600 leading-relaxed max-w-lg mx-auto mb-2">
            We hit an unexpected error rendering this section. The rest of the
            portal still works &mdash; the navigation above will take you anywhere else.
          </p>
          {/* Show the actual message so devs can act on it; truncated for users */}
          <p className="font-mono text-xs text-alert-700 bg-alert-50 border border-alert-100 rounded-xl px-3 py-2 mt-4 mb-6 inline-block max-w-full truncate">
            {this.state.error.message || String(this.state.error)}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={this.handleReset}
              className="btn-primary"
            >
              <RefreshCw size={16} /> Try again
            </button>
            <a href="/" className="btn-secondary">
              <Home size={16} /> Go home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
