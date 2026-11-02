import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import YouthPublicLayout from './YouthPublicLayout'
import { LydoLogo } from '@/components/ui/LydoLogo'
import {
  Home, BookOpen, Users, Briefcase, CalendarDays,
  Library, MessageSquareWarning, User, LogOut, Bell, Menu, X,
  MessageCircle, FileText, Building2, ChevronDown, HandHeart, Newspaper,
  CheckCheck, ShieldCheck, ShieldAlert, ChevronRight, ChevronLeft, CreditCard,
  Mail, Paperclip,
} from 'lucide-react'
import { useAuthStore, authStore } from '@/store/authStore'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useMe } from '@/hooks/useAuth'
import apiClient from '@/api/client'
import { cn } from '@/utils'
import FloatingChatbot from '../components/FloatingChatbot'
import { PageSpinner } from '@/components/ui/Spinner'

// ── Tab Definitions ────────────────────────────────────────────────────────────
interface Tab {
  label: string
  icon: React.ElementType
  to: string
  roles?: string[]      // if set, only these youth_types see this tab
  notFor?: string[]     // exclude these youth_types
}

/**
 * Youth portal navigation &mdash; structure agreed with Rick (LYDO):
 *
 *   Home · Learn · Community · Opportunities · Events ·
 *   Resources · Participate · My Space · Need Help?
 *
 * Role overlays:
 *   - SK members          → + Submissions
 *   - Youth Org leaders   → + YORP Registration, + Submissions
 *   - General youth       → base 9 only
 *
 * Hubs (Learn / Community / Opportunities / Participate / Help) are
 * landing pages that link to the existing detail routes underneath.
 */
const TABS: Tab[] = [
  { label: 'Home',          icon: Home,                  to: '/dashboard' },
  { label: 'News',          icon: Newspaper,             to: '/news-feed' },
  { label: 'Learn',         icon: BookOpen,              to: '/learn' },
  { label: 'Community',     icon: Users,                 to: '/community' },
  { label: 'Opportunities', icon: Briefcase,             to: '/opportunities' },
  { label: 'Events',        icon: CalendarDays,          to: '/calendar' },
  { label: 'Resources',     icon: Library,               to: '/library' },
  { label: 'Participate',   icon: HandHeart,             to: '/participate' },
  { label: 'My Space',      icon: User,                  to: '/profile' },
  { label: 'Verify ID',     icon: ShieldCheck,           to: '/verify-identity' },
  { label: 'Need Help?',    icon: MessageSquareWarning,  to: '/help' },

  // Role overlays &mdash; appended after base nav
  { label: 'YORP Registration', icon: Building2,        to: '/yorp-registration', roles: ['youth_org_leader'] },
  { label: 'Submissions',       icon: FileText,         to: '/submissions',       roles: ['sk', 'youth_org_leader'] },
  { label: 'Feedback Inbox',    icon: MessageCircle,    to: '/sk-inbox',          roles: ['sk'] },
]

function useTabs(youthType?: string) {
  return TABS.filter((tab) => {
    if (tab.roles && !tab.roles.includes(youthType ?? '')) return false
    if (tab.notFor && tab.notFor.includes(youthType ?? '')) return false
    return true
  })
}

// ── Mobile bottom tab bar (top 5 only) ────────────────────────────────────────
function MobileTabBar({ tabs }: { tabs: Tab[] }) {
  const primary = tabs.slice(0, 5)
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-ink-100 flex md:hidden shadow-[0_-1px_2px_rgba(0,0,0,0.04)]">
      {primary.map(({ label, icon: Icon, to }) => (
        <NavLink
          key={to + label}
          to={to}
          end={to === '/dashboard'}
          className={({ isActive }) =>
            cn(
              'flex-1 flex flex-col items-center justify-center py-2 text-[10px] font-semibold transition-colors gap-0.5',
              isActive
                ? 'text-primary-700'
                : 'text-ink-500 hover:text-primary-700',
            )
          }
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

// ── Desktop horizontal tab bar ─────────────────────────────────────────────────
function DesktopTabBar({ tabs }: { tabs: Tab[] }) {
  const navRef = useRef<HTMLElement>(null)
  const [canScrollLeft, setCanScrollLeft]   = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const check = () => {
      setCanScrollLeft(el.scrollLeft > 4)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    el.addEventListener('scroll', check)
    return () => { ro.disconnect(); el.removeEventListener('scroll', check) }
  }, [tabs])

  const scroll = (dir: 'left' | 'right') => {
    navRef.current?.scrollBy({ left: dir === 'right' ? 160 : -160, behavior: 'smooth' })
  }

  const arrowCls = 'flex-shrink-0 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-white border border-ink-200 shadow-sm text-ink-500 hover:text-primary-700 hover:border-primary-300 transition-colors'

  return (
    <div className="hidden md:flex items-center gap-1 min-w-0">
      {canScrollLeft && (
        <button onClick={() => scroll('left')} className={arrowCls} aria-label="Scroll nav left">
          <ChevronLeft size={14} />
        </button>
      )}
      <nav ref={navRef} className="flex items-center gap-0.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
        {tabs.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to + label}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-ink-600 hover:text-primary-700 hover:bg-primary-50',
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      {canScrollRight && (
        <button onClick={() => scroll('right')} className={arrowCls} aria-label="Scroll nav right">
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  )
}

// ── Notification panel ────────────────────────────────────────────────────────
interface Notification {
  id: number
  title: string
  message: string
  notification_type: string
  is_read: boolean
  link: string
  created_at: string
}

const NOTIF_TYPE_ROUTE: Record<string, string> = {
  course:       '/lms',
  badge:        '/badges',
  internship:   '/opportunities',
  event:        '/events',
  project:      '/submissions',
  announcement: '/news-feed',
}

function NotificationPanel() {
  const [open, setOpen]           = useState(false)
  const [activeTab, setActiveTab] = useState<'updates' | 'messages'>('updates')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const qc  = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data, isLoading } = useQuery<{ count: number; results: Notification[] }>({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications/?page_size=50').then(r => r.data),
    enabled: open,
    refetchInterval: open ? 30000 : false,
  })

  const unread = useQuery<number>({
    queryKey: ['notifications-unread-count'],
    queryFn: () =>
      apiClient.get('/notifications/unread_count/').then(r => r.data?.count ?? 0).catch(() => 0),
    refetchInterval: 60000,
  })

  const markRead = useMutation({
    mutationFn: (id: number) => apiClient.post(`/notifications/${id}/mark_read/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })

  const markAll = useMutation({
    mutationFn: () => apiClient.post('/notifications/mark_all_read/'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })

  const all: Notification[]      = data?.results ?? []
  const updates                  = all.filter(n => n.notification_type !== 'announcement')
  const messages                 = all.filter(n => n.notification_type === 'announcement')
  const hasUnread                = all.some(n => !n.is_read)
  const hasUnreadUpdates         = updates.some(n => !n.is_read)
  const unreadMessages           = messages.filter(n => !n.is_read).length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg text-ink-500 hover:text-primary-700 hover:bg-primary-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {(unread.data ?? 0) > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-alert-500 rounded-full" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-ink-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
            <p className="font-semibold text-sm text-ink-900">Notifications</p>
            {hasUnread && (
              <button
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-semibold transition-colors"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-ink-100">
            <button
              onClick={() => setActiveTab('updates')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors',
                activeTab === 'updates'
                  ? 'border-b-2 border-primary-600 text-primary-700'
                  : 'text-ink-500 hover:text-ink-700',
              )}
            >
              <Bell size={12} /> Updates
              {hasUnreadUpdates && <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />}
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors',
                activeTab === 'messages'
                  ? 'border-b-2 border-primary-600 text-primary-700'
                  : 'text-ink-500 hover:text-ink-700',
              )}
            >
              <Mail size={12} /> Messages
              {unreadMessages > 0 && (
                <span className="min-w-[16px] h-4 px-1 bg-primary-600 text-white text-[9px] font-bold rounded-full inline-flex items-center justify-center">
                  {unreadMessages}
                </span>
              )}
            </button>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-ink-50">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-ink-500">Loading…</div>

            ) : activeTab === 'updates' ? (
              /* ── Updates tab ──────────────────────────────────────── */
              updates.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={28} className="mx-auto mb-2 text-ink-300" />
                  <p className="text-sm text-ink-500">No notifications yet</p>
                </div>
              ) : (
                updates.map(n => {
                  const dest = n.link || NOTIF_TYPE_ROUTE[n.notification_type] || null
                  const isExternal = !!dest && (dest.startsWith('http://') || dest.startsWith('https://'))
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        if (!n.is_read) markRead.mutate(n.id)
                        if (dest) {
                          setOpen(false)
                          if (isExternal) {
                            window.open(dest, '_blank', 'noopener noreferrer')
                          } else {
                            navigate(dest)
                          }
                        }
                      }}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-primary-50 transition-colors',
                        !n.is_read && 'bg-primary-50/50',
                        dest && 'cursor-pointer',
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {!n.is_read && (
                          <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-primary-500" />
                        )}
                        <div className={cn('flex-1 min-w-0', n.is_read && 'pl-4.5')}>
                          <p className={cn('text-sm leading-snug', n.is_read ? 'text-ink-600' : 'font-semibold text-ink-900')}>
                            {n.title}
                          </p>
                          <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-ink-400 mt-1">
                            {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })
              )

            ) : (
              /* ── Messages tab (admin announcements) ───────────────── */
              messages.length === 0 ? (
                <div className="p-8 text-center">
                  <Mail size={28} className="mx-auto mb-2 text-ink-300" />
                  <p className="text-sm text-ink-500">No messages yet</p>
                  <p className="text-xs text-ink-400 mt-1">Admin announcements will appear here</p>
                </div>
              ) : (
                messages.map(n => {
                  const isExpanded    = expandedId === n.id
                  const hasAttachment = !!n.link
                  return (
                    <div key={n.id}>
                      <button
                        onClick={() => {
                          if (!n.is_read) markRead.mutate(n.id)
                          setExpandedId(isExpanded ? null : n.id)
                        }}
                        className={cn(
                          'w-full text-left px-4 py-3 hover:bg-primary-50 transition-colors',
                          !n.is_read && 'bg-primary-50/60',
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <Mail size={14} className="text-primary-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold text-primary-600 uppercase tracking-wide">LYDO Admin</p>
                              <p className="text-[10px] text-ink-400 flex-shrink-0">
                                {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <p className={cn('text-sm leading-snug mt-0.5 truncate', !n.is_read ? 'font-semibold text-ink-900' : 'text-ink-700')}>
                              {n.title}
                            </p>
                            {!isExpanded && (
                              <p className="text-xs text-ink-400 mt-0.5 line-clamp-1">{n.message}</p>
                            )}
                            {hasAttachment && !isExpanded && (
                              <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-ink-400">
                                <Paperclip size={10} /> 1 attachment
                              </span>
                            )}
                          </div>
                          {!n.is_read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-primary-500 rounded-full mt-1.5" />
                          )}
                        </div>
                      </button>

                      {/* Expanded message body */}
                      {isExpanded && (
                        <div className="mx-4 mb-3 p-3 bg-paper-50 rounded-xl border border-ink-100">
                          <p className="text-xs text-ink-700 leading-relaxed whitespace-pre-line">{n.message}</p>
                          {hasAttachment && (
                            <a
                              href={n.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800 transition-colors"
                            >
                              <Paperclip size={12} /> View attachment
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── User dropdown ──────────────────────────────────────────────────────────────
function UserMenu({ user }: { user: NonNullable<ReturnType<typeof useAuthStore>['user']> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: verification } = useQuery<{ is_verified: boolean; status?: string }>({
    queryKey: ['verification-status'],
    queryFn: () => apiClient.get('/verification/').then(r => r.data).catch(() => ({ is_verified: false })),
  })

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const handleLogout = () => {
    authStore.logout()
    qc.clear()
    navigate('/login')
  }

  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || 'YU'
  const avatarUrl = (user as any).avatar_url as string | null | undefined

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-paper-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
          {avatarUrl
            ? <img src={avatarUrl} alt={user.first_name} className="w-full h-full object-cover" />
            : initials}
        </div>
        <span className="hidden sm:block text-sm font-semibold text-ink-800 max-w-[100px] truncate">
          {user.first_name}
        </span>
        <ChevronDown size={14} className="text-ink-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-2xl shadow-lg border border-ink-100 z-50 py-1.5 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-100">
            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
              {avatarUrl
                ? <img src={avatarUrl} alt={user.first_name} className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900 truncate">{user.first_name} {user.last_name}</p>
              <p className="text-xs text-ink-500 truncate">{user.email}</p>
            </div>
          </div>
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
          >
            <User size={15} /> My Space
          </Link>
          <Link
            to="/my-id-card"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
          >
            <CreditCard size={15} /> My Digital ID
          </Link>
          <Link
            to="/verify-identity"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-primary-50 transition-colors group"
          >
            <span className="flex items-center gap-2.5 text-ink-700 group-hover:text-primary-700">
              {verification?.is_verified
                ? <ShieldCheck size={15} className="text-emerald-500" />
                : <ShieldAlert size={15} className="text-amber-500" />}
              ID Verification
            </span>
            {verification?.is_verified ? (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Verified</span>
            ) : (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Pending</span>
            )}
          </Link>
          <Link
            to="/help"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
          >
            <MessageSquareWarning size={15} /> Need help?
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-alert-600 hover:bg-alert-50 transition-colors"
          >
            <LogOut size={15} /> Log out
          </button>
        </div>
      )}
    </div>
  )
}

// Pages that are publicly browsable without login. Unauthenticated visitors
// clicking these from the public nav get the public layout; logged-in users
// clicking from the tab bar get the full auth layout (tab bar + notifications).
const DISCOVERY_PATHS = [
  '/community', '/opportunities', '/events',
  '/resources', '/participate',
  '/programs', '/sk-directory', '/sk-feedback', '/sk-inbox',
]

// ── Main Layout ────────────────────────────────────────────────────────────────
export default function YouthLayout() {
  const auth = useAuthStore()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Re-hydrate user from the API after a page refresh (token is in localStorage
  // but _user is in-memory only, so it's null until this fetch completes).
  const meQuery = useMe()

  // No token at all → redirect to login, UNLESS this is a discovery page.
  // Discovery pages are publicly browsable; the public layout's <Outlet /> will
  // render the same child route component so no duplicate route definition needed.
  if (!auth.isAuthenticated) {
    const isDiscovery = DISCOVERY_PATHS.some(
      p => location.pathname === p || location.pathname.startsWith(p + '/')
    )
    if (isDiscovery) return <YouthPublicLayout />
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  // Token exists but user not loaded yet → wait (don't redirect mid-flight).
  if (!auth.user) {
    if (meQuery.isError) return <Navigate to="/login" replace />
    return <PageSpinner />
  }

  const tabs = useTabs((auth.user as any).youth_type)

  return (
    <div className="min-h-screen bg-paper-50 flex flex-col">
      {/* PH flag accent stripe */}
      <div className="ph-stripe h-1 w-full" />

      {/* ── Top Navbar ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-ink-100 backdrop-blur-md bg-white/95">
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-3">

            {/* Brand */}
            <Link to="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded-lg px-1">
              <LydoLogo size={36} />
              <span className="hidden sm:flex flex-col leading-none">
                <span className="font-display font-extrabold text-lg text-ink-900 tracking-tightish">LYDO</span>
                <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">Lucena Youth</span>
              </span>
            </Link>

            {/* Desktop tab bar */}
            <div className="flex-1 overflow-hidden">
              <DesktopTabBar tabs={tabs} />
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <NotificationPanel />

              {auth.user && <UserMenu user={auth.user} />}

              <button
                className="md:hidden p-2 rounded-lg text-ink-500 hover:bg-primary-50 hover:text-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile full-screen menu ────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div id="mobile-menu" className="fixed inset-0 z-[60] bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-ink-100">
            <span className="font-display font-bold text-lg text-ink-900">Navigation</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg text-ink-500 hover:bg-primary-50 hover:text-primary-700"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {tabs.map(({ label, icon: Icon, to }) => (
              <NavLink
                key={to + label}
                to={to}
                end={to === '/dashboard'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-colors',
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-ink-700 hover:bg-primary-50 hover:text-primary-700',
                  )
                }
              >
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-ink-100">
            <Link
              to="/chatbot"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent-50 text-accent-800 font-bold"
            >
              <MessageCircle size={20} /> AI Assistant
            </Link>
          </div>
        </div>
      )}

      {/* ── Page content ──────────────────────────────────────────────── */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-6">
        <Outlet />
      </main>

      {/* ── Mobile bottom tab bar ──────────────────────────────────────── */}
      <MobileTabBar tabs={tabs} />

      {/* ── Floating chatbot ───────────────────────────────────────────── */}
      <FloatingChatbot />
    </div>
  )
}
