import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Users, FolderOpen, Building2, ClipboardList, CalendarDays,
  Eye, Plus, UserCog, BarChart3, Shield, AlertTriangle,
  CheckCircle2, ArrowRight, ClipboardCheck, History,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import apiClient from '@/api/client'
import { StatCard } from '@/components/ui/StatCard'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDateTime, getStatusColor, toArray } from '@/utils'
import { cn } from '@/utils'

const ROLE_COLORS: Record<string, string> = {
  youth:       '#6366f1',
  lgu_admin:   '#10b981',
  super_admin: '#ef4444',
}

const STATUS_COLORS: Record<string, string> = {
  proposed:     '#6366f1',
  under_review: '#f59e0b',
  approved:     '#10b981',
  active:       '#3b82f6',
  completed:    '#8b5cf6',
  archived:     '#6b7280',
}

interface AdminUser { id: number; role: string; full_name: string; email: string }
interface Program { id: number; title: string; status: string; category: string; submitted_at?: string; submitter_type?: string }
interface Org { id: number; name: string; is_approved?: boolean }
interface Event { id: number; title: string; start_datetime: string; is_published: boolean }
interface Submission { id: number; title: string; submitter_type: string; submitted_at: string; status: string }
interface VerificationRecord { id: number; status: string; user?: { full_name: string; email: string } }
interface SKBarangay { id: number; barangay_name: string; overdue_count: number; submitted_count: number; pending_count: number }

function groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
  return arr.reduce((acc, item) => {
    const k = String(item[key])
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

interface WorkItemProps {
  label: string
  count: number
  description: string
  to: string
  urgency: 'high' | 'medium' | 'low'
  icon: React.ElementType
  onClick: () => void
}

function WorkItem({ label, count, description, urgency, icon: Icon, onClick }: WorkItemProps) {
  const urgencyStyle = {
    high:   { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700 border-red-200',    border: 'border-l-red-500' },
    medium: { dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700 border-amber-200', border: 'border-l-amber-500' },
    low:    { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', border: 'border-l-emerald-500' },
  }[urgency]

  if (count === 0) return null

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-white rounded-xl border border-l-4 p-4 flex items-center gap-4 hover:shadow-md transition-all group',
        urgencyStyle.border
      )}
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', urgencyStyle.badge.split(' ').slice(0,1)[0].replace('text', 'bg').replace('-700','-100'))}>
        <Icon size={18} className={urgencyStyle.badge.split(' ')[1]} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className={cn('inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg text-sm font-bold border', urgencyStyle.badge)}>
          {count}
        </span>
        <ArrowRight size={15} className="text-gray-400 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  )
}

export default function AdminDashPage() {
  const navigate = useNavigate()

  const usersQ = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.get('/auth/admin/users/').then(r => toArray<AdminUser>(r.data)),
  })
  const programsQ = useQuery({
    queryKey: ['admin-programs'],
    queryFn: () => apiClient.get('/programs/').then(r => toArray<Program>(r.data)),
  })
  const orgsQ = useQuery({
    queryKey: ['admin-orgs'],
    queryFn: () => apiClient.get('/youth-orgs/').then(r => toArray<Org>(r.data)),
  })
  const eventsQ = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => apiClient.get('/events/').then(r => toArray<Event>(r.data)),
  })
  const submissionsQ = useQuery({
    queryKey: ['admin-submissions-all'],
    queryFn: () => apiClient.get('/programs/submissions/').then(r => toArray<Submission>(r.data)),
  })
  const verificationsQ = useQuery({
    queryKey: ['admin-verifications-count'],
    queryFn: () =>
      apiClient.get('/verification/admin/').then(r => {
        const d = r.data
        return Array.isArray(d) ? d : (d.results ?? []) as VerificationRecord[]
      }).catch(() => [] as VerificationRecord[]),
  })
  const skQ = useQuery({
    queryKey: ['admin-sk-barangays'],
    queryFn: () =>
      apiClient.get('/sk-requirements/barangays/').then(r => {
        const d = r.data
        return Array.isArray(d) ? d : (d.results ?? []) as SKBarangay[]
      }).catch(() => [] as SKBarangay[]),
  })

  const isLoading = usersQ.isLoading || programsQ.isLoading || orgsQ.isLoading || eventsQ.isLoading
  if (isLoading) return <PageSpinner />

  const users         = usersQ.data ?? []
  const programs      = programsQ.data ?? []
  const orgs          = orgsQ.data ?? []
  const events        = eventsQ.data ?? []
  const allSubs       = submissionsQ.data ?? []
  const verifications = verificationsQ.data ?? []
  const skBarangays   = skQ.data ?? []

  const now = new Date()
  const upcomingEvents  = events.filter(e => new Date(e.start_datetime) > now)
  const activePrograms  = programs.filter(p => p.status === 'active' || p.status === 'approved')
  const pendingSubs     = allSubs.filter(s => s.status === 'pending' || s.status === 'completion_submitted')
  const pendingVerifs   = verifications.filter(v => v.status === 'pending' || v.status === 'reviewing')
  const overdueSkCount  = skBarangays.filter(b => b.overdue_count > 0).length
  const pendingOrgs     = orgs.filter(o => (o as any).is_approved === false).length

  const totalWorkItems = pendingSubs.length + pendingVerifs.length + overdueSkCount + pendingOrgs

  // Table: recent submissions needing review
  const actionableSubs = [...pendingSubs]
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .slice(0, 6)

  // Charts
  const roleGroups = groupBy(users, 'role')
  const roleChartData = Object.entries(roleGroups).map(([role, count]) => ({
    name: role.replace('_', ' '),
    value: count,
    color: ROLE_COLORS[role] ?? '#6b7280',
  }))

  const statusGroups = groupBy(programs, 'status')
  const statusChartData = Object.entries(statusGroups).map(([status, count]) => ({
    name: status.replace('_', ' '),
    count,
    fill: STATUS_COLORS[status] ?? '#6b7280',
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of youth development activities in Lucena City</p>
        </div>
        <button
          onClick={() => navigate('/admin/audit-log')}
          className="btn-secondary btn-sm text-xs flex items-center gap-1.5"
        >
          <History size={14} /> Audit Log
        </button>
      </div>

      {/* ── Work Queue ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title !mb-0 flex items-center gap-2">
            Needs Attention
            {totalWorkItems > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {totalWorkItems > 9 ? '9+' : totalWorkItems}
              </span>
            )}
          </h2>
        </div>

        {totalWorkItems === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-4 text-gray-500">
            <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-700 text-sm">All clear — nothing needs attention right now.</p>
              <p className="text-xs mt-0.5">New submissions, verifications, and SK overdue reports will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <WorkItem
              label="Program submissions pending review"
              count={pendingSubs.length}
              description="Submitted reports waiting for admin action"
              to="/admin/projects"
              urgency="high"
              icon={ClipboardList}
              onClick={() => navigate('/admin/projects')}
            />
            <WorkItem
              label="Identity verifications pending"
              count={pendingVerifs.length}
              description="Youth waiting for ID verification approval"
              to="/admin/verification"
              urgency="high"
              icon={Shield}
              onClick={() => navigate('/admin/verification')}
            />
            <WorkItem
              label="SK councils with overdue reports"
              count={overdueSkCount}
              description="Barangays with at least one overdue requirement"
              to="/admin/sk-tracker"
              urgency="medium"
              icon={AlertTriangle}
              onClick={() => navigate('/admin/sk-tracker')}
            />
            <WorkItem
              label="Youth org registrations pending"
              count={pendingOrgs}
              description="YORP applications awaiting approval"
              to="/admin/yorp"
              urgency="medium"
              icon={Building2}
              onClick={() => navigate('/admin/yorp')}
            />
          </div>
        )}
      </section>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Users"
          value={users.length}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          label="Active Programs"
          value={activePrograms.length}
          icon={FolderOpen}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          onClick={() => navigate('/admin/projects')}
        />
        <StatCard
          label="Youth Organizations"
          value={orgs.length}
          icon={Building2}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          onClick={() => navigate('/admin/yorp')}
        />
        <StatCard
          label="Needs Review"
          value={pendingSubs.length}
          icon={ClipboardList}
          iconBg={pendingSubs.length > 0 ? 'bg-yellow-50' : 'bg-gray-50'}
          iconColor={pendingSubs.length > 0 ? 'text-yellow-600' : 'text-gray-400'}
          onClick={() => navigate('/admin/projects')}
        />
        <StatCard
          label="Upcoming Events"
          value={upcomingEvents.length}
          icon={CalendarDays}
          iconBg="bg-red-50"
          iconColor="text-red-600"
          onClick={() => navigate('/admin/calendar')}
        />
        <StatCard
          label="Pending Verifications"
          value={pendingVerifs.length}
          icon={Shield}
          iconBg={pendingVerifs.length > 0 ? 'bg-amber-50' : 'bg-gray-50'}
          iconColor={pendingVerifs.length > 0 ? 'text-amber-600' : 'text-gray-400'}
          onClick={() => navigate('/admin/verification')}
        />
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="section-title mb-4">Users by Role</h3>
          {roleChartData.length === 0 ? (
            <EmptyState icon={Users} title="No user data" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={roleChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {roleChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="section-title mb-4">Programs by Status</h3>
          {statusChartData.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No program data" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusChartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statusChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Submissions table ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title mb-0 flex items-center gap-2">
            Reports Needing Action
            {pendingSubs.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-white text-[10px] font-bold">
                {pendingSubs.length}
              </span>
            )}
          </h3>
          <button onClick={() => navigate('/admin/projects')} className="btn-secondary btn-sm text-xs">
            View All
          </button>
        </div>
        <div className="table-wrap">
          {actionableSubs.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No pending reports"
              description="All submitted reports have been reviewed."
              className="py-10"
            />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Submitter Type</th>
                  <th>Submitted At</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {actionableSubs.map(sub => (
                  <tr key={sub.id}>
                    <td className="font-medium">{sub.title}</td>
                    <td className="capitalize">{sub.submitter_type?.replace('_', ' ') ?? '—'}</td>
                    <td>{formatDateTime(sub.submitted_at)}</td>
                    <td>
                      <span className={getStatusColor(sub.status)}>{sub.status.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => navigate('/admin/projects')}
                        className="btn-secondary btn-sm text-xs"
                      >
                        <Eye size={13} /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Quick actions ──────────────────────────────────────────────── */}
      <div className="card p-5">
        <h3 className="section-title mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => navigate('/admin/calendar')} className="btn-primary btn-sm">
            <Plus size={15} /> Create Event
          </button>
          <button onClick={() => navigate('/admin/projects')} className="btn-secondary btn-sm">
            <ClipboardList size={15} /> Review Submissions
          </button>
          <button onClick={() => navigate('/admin/users')} className="btn-secondary btn-sm">
            <UserCog size={15} /> Manage Users
          </button>
          <button onClick={() => navigate('/admin/analytics')} className="btn-secondary btn-sm">
            <BarChart3 size={15} /> Analytics
          </button>
          <button onClick={() => navigate('/admin/sk-tracker')} className="btn-secondary btn-sm">
            <ClipboardCheck size={15} /> SK Tracker
          </button>
          <button onClick={() => navigate('/admin/audit-log')} className="btn-secondary btn-sm">
            <History size={15} /> Audit Log
          </button>
        </div>
      </div>
    </div>
  )
}
