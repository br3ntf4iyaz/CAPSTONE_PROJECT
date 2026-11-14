import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, Users, ClipboardCheck, BarChart3,
  CalendarDays, BookOpen, ClipboardList, UserCog, Library,
  Briefcase, Bell, Shield, LogOut, ChevronLeft, ChevronRight, Menu,
  Newspaper, FileText, CheckCheck, X, History, UserCheck, LifeBuoy,
} from 'lucide-react'
import { useAuthStore, authStore } from '@/store/authStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMe } from '@/hooks/useAuth'
import { cn, formatDate } from '@/utils'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { LydoLogo } from '@/components/ui/LydoLogo'

interface AdminNotification {
  id: number
  title: string
  message: string
  is_read: boolean
  created_at: string
  notification_type?: string
  link?: string
}

function AdminNotificationBell() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: notifications = [] } = useQuery<AdminNotification[]>({
    queryKey: ['admin-notifications-bell'],
    queryFn: () => apiClient.get('/notifications/?page_size=20&target=admin')
      .then(r => {
        const d = r.data
        return Array.isArray(d) ? d : (d.results ?? [])
      })
      .catch(() => []),
    refetchInterval: 30000,
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  const markRead = useMutation({
    mutationFn: (id: number) => apiClient.post(`/notifications/${id}/mark_read/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-notifications-bell'] }),
  })

  const markAll = useMutation({
    mutationFn: () => apiClient.post('/notifications/mark_all_read/'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-notifications-bell'] }),
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="sm:relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Admin notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute inset-x-3 top-full mt-2 sm:inset-x-auto sm:right-0 sm:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-800">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)}>
                <X size={15} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                <Bell size={28} className="mx-auto mb-2 opacity-30" />
                No notifications
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.is_read) markRead.mutate(n.id)
                    if (n.link) { setOpen(false); navigate(n.link) }
                  }}
                  className={cn(
                    'px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors',
                    !n.is_read && 'bg-blue-50/50'
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                      n.notification_type === 'project' ? 'bg-primary-100' : 'bg-gray-100'
                    )}>
                      {n.notification_type === 'project'
                        ? <FileText size={13} className="text-primary-600" />
                        : <Bell size={13} className="text-gray-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm leading-snug truncate', !n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{formatDate(n.created_at)}</p>
                    </div>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 px-4 py-2.5">
            <Link
              to="/admin/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
            >
              Manage all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

const NAV_ITEMS = [
  { label: 'Dashboard',        icon: LayoutDashboard, to: '/admin' },
  { label: 'Programs',          icon: FolderOpen,     to: '/admin/programs' },
  { label: 'Project Monitoring', icon: CheckCheck,   to: '/admin/projects' },
  { label: 'Youth Orgs / YORP', icon: Users,          to: '/admin/yorp' },
  { label: 'SK Requirements',  icon: ClipboardCheck,  to: '/admin/sk-tracker' },
  { label: 'Analytics',        icon: BarChart3,       to: '/admin/analytics' },
  { label: 'Reports',          icon: FileText,        to: '/admin/reports' },
  { label: 'Calendar',         icon: CalendarDays,    to: '/admin/calendar' },
  { label: 'Learning & Recognition', icon: BookOpen,   to: '/admin/lms' },
  { label: 'Surveys',          icon: ClipboardList,   to: '/admin/surveys' },
  { label: 'User Management',  icon: UserCog,         to: '/admin/users' },
  { label: 'Library',          icon: Library,         to: '/admin/library' },
  { label: 'Jobs, Scholarships & Schools', icon: Briefcase, to: '/admin/jobs-schools' },
  { label: 'ID Verification',  icon: Shield,          to: '/admin/verification' },
  { label: 'Support Inbox',    icon: LifeBuoy,        to: '/admin/support' },
  { label: 'Notifications',    icon: Bell,            to: '/admin/notifications' },
  { label: 'Featured Posts',   icon: Newspaper,       to: '/admin/featured' },
  { label: 'Youth Participation', icon: UserCheck,     to: '/admin/participation' },
  { label: 'Audit Log',        icon: History,         to: '/admin/audit-log' },
]

export default function AdminLayout() {
  const auth = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const meQuery = useMe()

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  if (!auth.isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  if (!auth.user) {
    if (meQuery.isError) return <Navigate to="/admin/login" replace />
    return <PageSpinner />
  }

  if (auth.user.role !== 'lgu_admin' && auth.user.role !== 'super_admin') {
    return <Navigate to="/admin/login" replace />
  }

  const handleLogout = () => {
    authStore.logout()
    qc.clear()
    navigate('/admin/login')
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Backdrop for the phone drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      {/* Sidebar: slides in over the page on phones, stays a column on large screens */}
      <aside
        aria-label="Admin navigation"
        className={cn(
          'flex flex-col bg-slate-900 text-white flex-shrink-0 transition-transform duration-300',
          'fixed inset-y-0 left-0 z-50 w-64 lg:static lg:z-auto lg:translate-x-0 lg:transition-all',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-16' : 'lg:w-64'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700 min-h-[72px]">
          <LydoLogo size={32} className="rounded-full flex-shrink-0" />
          <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
            <p className="text-sm font-bold text-white leading-tight truncate">LGU Admin Portal</p>
            <p className="text-xs text-slate-400 truncate">Lucena City</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                  isActive
                    ? 'bg-primary-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className={cn('truncate', collapsed && 'lg:hidden')}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="hidden lg:block border-t border-slate-700 p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header className="relative z-30 flex items-center justify-between px-4 sm:px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 lg:hidden"
            >
              <Menu size={22} />
            </button>
            <span className="text-base font-semibold text-gray-800">Admin Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <AdminNotificationBell />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-800">{auth.user.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{auth.user.role.replace('_', ' ')}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
