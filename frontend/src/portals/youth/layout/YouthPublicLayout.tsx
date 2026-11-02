import { useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { Menu, X, LayoutDashboard } from 'lucide-react'
import { LydoLogo } from '@/components/ui/LydoLogo'
import { cn } from '@/utils'
import { useAuthStore } from '@/store/authStore'
import { useMe } from '@/hooks/useAuth'
import FloatingChatbot from '../components/FloatingChatbot'

export default function YouthPublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const auth = useAuthStore()
  // Re-hydrate user on refresh so the auth-aware nav works correctly
  useMe()
  const isLoggedIn = auth.isAuthenticated && !!auth.user

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative font-semibold text-[15px] px-4 min-h-[44px] inline-flex items-center transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
      isActive
        ? 'text-primary-700'
        : 'text-ink-600 hover:text-primary-700 hover:bg-primary-50',
    )

  return (
    <div className="min-h-screen flex flex-col bg-paper-50">
      {/* PH flag accent stripe &mdash; pinned to top */}
      <div className="ph-stripe h-1 w-full" />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-ink-100 sticky top-0 z-50 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">

            {/* Brand */}
            <Link
              to="/"
              className="flex items-center gap-2.5 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded-lg px-1"
            >
              <LydoLogo size={36} />
              <span className="flex flex-col leading-none">
                <span className="font-display font-extrabold text-lg text-ink-900 tracking-tightish">
                  LYDO
                </span>
                <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">
                  Lucena Youth
                </span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/" end className={navItemClass}>Home</NavLink>
              <NavLink to="/community" className={navItemClass}>Community</NavLink>
              <NavLink to="/opportunities" className={navItemClass}>Opportunities</NavLink>
              <NavLink to="/events" className={navItemClass}>Events</NavLink>
              <NavLink to="/resources" className={navItemClass}>Resources</NavLink>
              <NavLink to="/participate" className={navItemClass}>Participate</NavLink>
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <>
                  <span className="hidden sm:block text-sm font-semibold text-ink-600 truncate max-w-[120px]">
                    {auth.user!.first_name}
                  </span>
                  <Link
                    to="/dashboard"
                    className="hidden sm:inline-flex items-center gap-1.5 font-bold text-[14px] px-5 min-h-[44px] bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 shadow-sm"
                  >
                    <LayoutDashboard size={15} /> Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="hidden sm:inline-flex items-center font-semibold text-[15px] px-4 min-h-[44px] text-ink-700 hover:text-primary-700 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="hidden sm:inline-flex items-center font-bold text-[14px] px-5 min-h-[44px] bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 shadow-sm"
                  >
                    Get started
                  </Link>
                </>
              )}

              {/* Mobile hamburger */}
              <button
                className="md:hidden p-2.5 rounded-lg text-ink-700 hover:text-primary-700 hover:bg-primary-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div id="mobile-menu" className="md:hidden border-t border-ink-100 bg-white px-4 py-3 space-y-1">
            <NavLink to="/" end onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn('flex items-center min-h-[44px] px-3 rounded-lg font-semibold', isActive ? 'text-primary-700 bg-primary-50' : 'text-ink-700 hover:text-primary-700 hover:bg-primary-50')}>
              Home
            </NavLink>
            <NavLink to="/community" onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn('flex items-center min-h-[44px] px-3 rounded-lg font-semibold', isActive ? 'text-primary-700 bg-primary-50' : 'text-ink-700 hover:text-primary-700 hover:bg-primary-50')}>
              Community
            </NavLink>
            <NavLink to="/opportunities" onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn('flex items-center min-h-[44px] px-3 rounded-lg font-semibold', isActive ? 'text-primary-700 bg-primary-50' : 'text-ink-700 hover:text-primary-700 hover:bg-primary-50')}>
              Opportunities
            </NavLink>
            <NavLink to="/events" onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn('flex items-center min-h-[44px] px-3 rounded-lg font-semibold', isActive ? 'text-primary-700 bg-primary-50' : 'text-ink-700 hover:text-primary-700 hover:bg-primary-50')}>
              Events
            </NavLink>
            <NavLink to="/resources" onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn('flex items-center min-h-[44px] px-3 rounded-lg font-semibold', isActive ? 'text-primary-700 bg-primary-50' : 'text-ink-700 hover:text-primary-700 hover:bg-primary-50')}>
              Resources
            </NavLink>
            <NavLink to="/participate" onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn('flex items-center min-h-[44px] px-3 rounded-lg font-semibold', isActive ? 'text-primary-700 bg-primary-50' : 'text-ink-700 hover:text-primary-700 hover:bg-primary-50')}>
              Participate
            </NavLink>
            <div className="pt-2 border-t border-ink-100 mt-2">
              {isLoggedIn ? (
                <Link to="/dashboard" onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 min-h-[44px] font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shadow-sm">
                  <LayoutDashboard size={16} /> Go to Dashboard
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/login" onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center min-h-[44px] font-semibold text-primary-700 border border-primary-200 hover:bg-primary-50 rounded-xl transition-colors">
                    Sign in
                  </Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center min-h-[44px] font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shadow-sm">
                    Get started
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      <FloatingChatbot />

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="bg-primary-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <LydoLogo size={36} />
                <span className="font-display font-extrabold text-xl tracking-tightish">LYDO</span>
              </div>
              <p className="text-sm text-primary-100/80 leading-relaxed max-w-xs">
                The Lucena City Youth Development Office portal &mdash; programs,
                events, and opportunities for every young person in the city.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-300 mb-4">
                Explore
              </p>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/" className="text-primary-100 hover:text-white transition-colors">Home</Link></li>
                <li><Link to="/community" className="text-primary-100 hover:text-white transition-colors">Community</Link></li>
                <li><Link to="/opportunities" className="text-primary-100 hover:text-white transition-colors">Opportunities</Link></li>
                <li><Link to="/events" className="text-primary-100 hover:text-white transition-colors">Events</Link></li>
                <li><Link to="/resources" className="text-primary-100 hover:text-white transition-colors">Resources</Link></li>
                <li><Link to="/participate" className="text-primary-100 hover:text-white transition-colors">Participate</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-300 mb-4">
                LYDO Office
              </p>
              <p className="text-sm text-primary-100/80 leading-relaxed">
                City Government of Lucena<br />
                Quezon Province, Philippines
              </p>
              <Link
                to="/login"
                className="mt-4 inline-flex text-sm font-semibold text-accent-300 hover:text-accent-200 transition-colors"
              >
                Staff portal login →
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-6 border-t border-white/10 text-xs text-primary-100/60">
            <p>&copy; 2025 City Government of Lucena · Youth Development Office</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-primary-500" />
              <span className="w-3 h-3 rounded-sm bg-alert-500" />
              <span className="w-3 h-3 rounded-sm bg-accent-400" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
