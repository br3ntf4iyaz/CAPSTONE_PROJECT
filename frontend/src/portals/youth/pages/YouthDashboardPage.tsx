import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays, FolderOpen, Bell, Sparkles,
  MapPin, Clock, ArrowRight, AlertCircle, RefreshCw,
  BookOpen, Briefcase, ShieldCheck, ShieldAlert, FileText,
  CheckCircle2, RotateCcw, Edit3, Users, Award,
  Activity, MessageSquare, Trophy, PlayCircle, Heart, Trash2,
  Building2,
} from 'lucide-react'
import apiClient from '@/api/client'
import { communityApi } from '@/api/community'
import type { CommunityPost } from '@/api/community'
import { useMe } from '@/hooks/useAuth'
import { formatDate, cn } from '@/utils'
import { PageSpinner } from '@/components/ui/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Event {
  id: number
  title: string
  event_type: string
  start_datetime: string
  location?: string
  is_registered?: boolean
}

interface Announcement {
  id: number
  title: string
  content: string
  created_at: string
  is_pinned?: boolean
}

interface Submission {
  id: number
  title: string
  status: string
  submitted_at: string
  updated_at: string
}

interface Program {
  id: number
  title: string
  category: string
  status: string
  submitter_type: string
}

const toArray = <T,>(d: any): T[] =>
  Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : []

const SUBMISSION_STATUS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  in_progress:          { label: 'Draft',            color: 'text-gray-500',    icon: Edit3 },
  pending:              { label: 'Under Review',     color: 'text-amber-600',   icon: Clock },
  revision_requested:   { label: 'Revision Needed',  color: 'text-orange-600',  icon: RotateCcw },
  approved:             { label: 'Approved',         color: 'text-blue-600',    icon: CheckCircle2 },
  completion_submitted: { label: 'Awaiting Completion Review', color: 'text-purple-600', icon: CheckCircle2 },
  completed:            { label: 'Completed',        color: 'text-emerald-600', icon: CheckCircle2 },
}

const CATEGORY_LABELS: Record<string, string> = {
  health: 'Health', education: 'Education', environment: 'Environment',
  governance: 'Governance', agriculture: 'Agriculture',
  global_mobility: 'Global Mobility', economic: 'Economic',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function YouthDashboardPage() {
  const { data: user } = useMe()
  const queryClient = useQueryClient()
  const [eventTab, setEventTab] = useState<'all' | 'mine'>('all')

  const { data: verification } = useQuery<{ is_verified: boolean }>({
    queryKey: ['verification-status'],
    queryFn: () => apiClient.get('/verification/').then(r => r.data),
  })

  const { data: profileData } = useQuery<{ completeness_percent: number; missing_fields?: string[] }>({
    queryKey: ['me-profile-completeness'],
    queryFn: () => apiClient.get('/auth/me/profile/').then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })

  // Fetch more events so we have enough to filter by is_registered client-side
  const eventsQ = useQuery({
    queryKey: ['dashboard-events'],
    queryFn: () =>
      apiClient.get('/events/?ordering=start_datetime&page_size=20').then(r => toArray<Event>(r.data)),
  })

  const announcementsQ = useQuery({
    queryKey: ['dashboard-announcements'],
    queryFn: () =>
      apiClient.get('/recognition/announcements/?page_size=3').then(r => toArray<Announcement>(r.data)),
  })

  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () =>
      apiClient.get('/notifications/unread_count/').then(r => ({ unread_count: r.data?.count ?? 0 })).catch(() => ({ unread_count: 0 })),
  })

  const youthType = (user as any)?.youth_type
  const canSubmit = youthType === 'sk' || youthType === 'youth_org_leader'

  const submissionsQ = useQuery({
    queryKey: ['dashboard-submissions'],
    queryFn: () =>
      apiClient.get('/programs/submissions/?page_size=20').then(r => toArray<Submission>(r.data)),
    enabled: canSubmit,
  })

  const activityQ = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () =>
      apiClient.get('/notifications/?page_size=8').then(r => toArray<{
        id: number; title: string; message: string; notification_type: string; created_at: string
      }>(r.data)).catch(() => []),
  })

  const enrollmentsQ = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () =>
      apiClient.get('/courses/enrollments/').then(r => toArray<{
        id: number
        course: { id: number; title: string; thumbnail_url: string | null; duration_hours: number }
        progress_percent: number
        status: string
      }>(r.data)).catch(() => []),
  })

  const myPostsQ = useQuery({
    queryKey: ['community-posts', 'mine'],
    queryFn: () =>
      apiClient.get('/community/posts/', { params: { mine: 'true' } })
        .then(r => {
          const d = r.data as any
          return (Array.isArray(d) ? d : (d.results ?? [])) as CommunityPost[]
        }),
    enabled: !!user,
  })

  const deletePostMutation = useMutation({
    mutationFn: (id: number) => communityApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-posts', 'mine'] }),
  })

  // Open programs for regular youth to browse
  const programsQ = useQuery({
    queryKey: ['dashboard-programs-browse'],
    queryFn: () =>
      apiClient.get('/programs/?status=ongoing&page_size=4').then(r => toArray<Program>(r.data))
        .then(d => d.length ? d : apiClient.get('/programs/?status=upcoming&page_size=4').then(r => toArray<Program>(r.data)))
        .catch(() => [] as Program[]),
    enabled: !canSubmit,
  })

  const isOrgLeader = user?.youth_type === 'youth_org_leader'
  const myOrgQ = useQuery({
    queryKey: ['my-org-submissions'],
    queryFn: () =>
      apiClient.get('/youth-orgs/my-submissions/').then(r => toArray<{ id: number; name: string; status: string }>(r.data)),
    enabled: isOrgLeader && !!user,
    staleTime: 1000 * 60 * 5,
  })

  const pendingOrg = (myOrgQ.data ?? []).find(o => o.status === 'pending')

  const allEvents     = eventsQ.data ?? []
  const announcements = announcementsQ.data ?? []
  const submissions   = submissionsQ.data ?? []
  const browsePgms    = programsQ.data ?? []
  const unreadCount   = notifData?.unread_count ?? 0
  const activityItems = activityQ.data ?? []

  const statusCounts = {
    draft:               submissions.filter(s => s.status === 'in_progress').length,
    pending:             submissions.filter(s => s.status === 'pending').length,
    revision_requested:  submissions.filter(s => s.status === 'revision_requested').length,
    approved:            submissions.filter(s => ['approved', 'completion_submitted', 'completed'].includes(s.status)).length,
  }

  const inProgressCourses = (enrollmentsQ.data ?? [])
    .filter(e => e.status === 'in_progress' || (e.status === 'enrolled' && e.progress_percent > 0))
    .slice(0, 2)

  const isVerified = verification?.is_verified ?? false
  const verificationLoaded = verification !== undefined
  const completeness = profileData?.completeness_percent ?? null

  // Events split by tab
  const upcomingAll  = allEvents.slice(0, 3)
  const myEvents     = allEvents.filter(e => e.is_registered)

  const visibleEvents = eventTab === 'mine' ? myEvents : upcomingAll

  const spotlight = announcements[0]
    ? { kind: 'announcement' as const, ann: announcements[0] }
    : allEvents[0]
      ? { kind: 'event' as const, event: allEvents[0] }
      : { kind: 'default' as const }

  const activeSubmissions = submissions.filter(s =>
    ['in_progress', 'pending', 'revision_requested', 'approved', 'completion_submitted'].includes(s.status)
  )

  return (
    <div className="space-y-8 pb-12">
      {/* ── Greeting card ────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-8 sm:p-10">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div aria-hidden className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-accent-400/20 blur-2xl pointer-events-none" />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-start">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm text-[12px] font-semibold mb-5">
              <Sparkles size={14} className="text-accent-300" />
              <span>Your dashboard</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tighter2 leading-[1.05]">
                Hey, {user?.first_name ?? 'there'}.
              </h1>
              {isVerified && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-sm font-bold backdrop-blur-sm">
                  <ShieldCheck size={14} /> Verified
                </span>
              )}
            </div>
            <p className="text-primary-100 text-lg max-w-xl leading-relaxed">
              Here's what's happening across Lucena's youth programs today.
            </p>
          </div>

          {/* Notification badge */}
          {unreadCount > 0 && (
            <Link
              to="/notifications"
              className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm transition-colors"
            >
              <div className="relative">
                <Bell size={18} className="text-white" />
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-400 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </div>
              <span className="text-sm font-semibold text-white">{unreadCount} unread</span>
            </Link>
          )}
        </div>
      </header>

      {/* ── Verification nudge ───────────────────────────────────────────── */}
      {verificationLoaded && !isVerified && (
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <ShieldAlert size={20} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900 text-sm">Verify your identity to unlock events</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Identity verification is required before you can register for any events.
            </p>
          </div>
          <Link
            to="/verify-identity"
            className="flex-shrink-0 btn-sm text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg px-4 py-2 transition-colors"
          >
            Verify now →
          </Link>
        </div>
      )}

      {/* ── Org leader: pending LYDO recognition banner ─────────────────── */}
      {isOrgLeader && pendingOrg && (
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-blue-50 border border-blue-200">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Building2 size={20} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-blue-900 text-sm">Pending LYDO recognition</p>
            <p className="text-xs text-blue-700 mt-0.5">
              <strong>{pendingOrg.name}</strong> is under review. We'll notify you once it's approved.
            </p>
          </div>
          <Link
            to="/yorp-registration"
            className="flex-shrink-0 text-xs font-semibold text-blue-800 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-lg px-4 py-2 transition-colors"
          >
            View →
          </Link>
        </div>
      )}

      {/* ── Profile completeness strip ───────────────────────────────────── */}
      {completeness !== null && completeness < 100 && (
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-primary-50 border border-primary-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="font-semibold text-primary-900 text-sm">Complete your profile</p>
              <span className="text-xs font-bold text-primary-700">{completeness}%</span>
            </div>
            <div className="h-2 bg-primary-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 rounded-full transition-all"
                style={{ width: `${completeness}%` }}
              />
            </div>
            {profileData?.missing_fields && profileData.missing_fields.length > 0 ? (
              <p className="text-xs text-primary-700 mt-1.5">
                Missing: {profileData.missing_fields.slice(0, 3).join(', ')}
                {profileData.missing_fields.length > 3 ? ` and ${profileData.missing_fields.length - 3} more` : ''}.
              </p>
            ) : (
              <p className="text-xs text-primary-700 mt-1.5">
                A complete profile helps LYDO match you with the right programs and opportunities.
              </p>
            )}
          </div>
          <Link
            to="/profile"
            className="flex-shrink-0 btn-sm text-xs font-semibold text-primary-800 bg-primary-100 hover:bg-primary-200 border border-primary-200 rounded-lg px-4 py-2 transition-colors"
          >
            Update profile →
          </Link>
        </div>
      )}

      {/* ── Spotlight ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="section-title !mb-0">Today's spotlight</h2>
          <span className="eyebrow">Pick of the day</span>
        </div>
        <Spotlight prompt={spotlight} />
      </section>

      {/* ── Continue Learning ────────────────────────────────────────────── */}
      {inProgressCourses.length > 0 && (
        <section className="card p-6">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-teal-50 text-teal-700">
                <BookOpen size={18} />
              </span>
              <h2 className="section-title !mb-0">Continue Learning</h2>
            </div>
            <Link to="/lms" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1">
              All courses <ArrowRight size={12} />
            </Link>
          </header>
          <div className="space-y-3">
            {inProgressCourses.map(enr => (
              <Link
                key={enr.id}
                to={`/lms/${enr.course.id}`}
                className="group flex items-center gap-4 p-3 -mx-3 rounded-xl hover:bg-teal-50/60 transition-colors"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 overflow-hidden">
                  {enr.course.thumbnail_url
                    ? <img src={enr.course.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    : <BookOpen size={20} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 truncate">{enr.course.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 bg-teal-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all"
                        style={{ width: `${enr.progress_percent}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-teal-700 flex-shrink-0">{enr.progress_percent}%</span>
                  </div>
                </div>
                <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-100 px-2.5 py-1 rounded-lg group-hover:bg-teal-600 group-hover:text-white transition-colors">
                  <PlayCircle size={12} /> Resume
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Submissions (SK/org leaders) OR Programs browse (everyone else) ─ */}
      {canSubmit ? (
        <section className="card p-6">
          <header className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-purple-50 text-purple-700">
                <FileText size={18} />
              </span>
              <h2 className="section-title !mb-0">My Submissions</h2>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/submissions/new" className="btn-primary btn-sm text-xs">
                + New
              </Link>
              <Link to="/submissions" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1">
                See all <ArrowRight size={12} />
              </Link>
            </div>
          </header>

          {/* Status count strip */}
          {!submissionsQ.isLoading && submissions.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-paper-50 rounded-xl border border-ink-100">
              {[
                { label: 'Draft',    count: statusCounts.draft,              color: 'text-gray-600',   bg: 'bg-gray-100' },
                { label: 'Review',   count: statusCounts.pending,            color: 'text-amber-700',  bg: 'bg-amber-50' },
                { label: 'Revision', count: statusCounts.revision_requested, color: 'text-orange-700', bg: 'bg-orange-50' },
                { label: 'Approved', count: statusCounts.approved,           color: 'text-blue-700',   bg: 'bg-blue-50' },
              ].map(({ label, count, color, bg }) => (
                <div key={label} className={cn('flex flex-col items-center gap-0.5 py-2 rounded-lg', bg)}>
                  <span className={cn('text-xl font-extrabold font-display leading-none', color)}>{count}</span>
                  <span className={cn('text-[10px] font-semibold uppercase tracking-wider', color)}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {submissionsQ.isLoading ? (
            <PageSpinner />
          ) : activeSubmissions.length === 0 ? (
            <p className="text-sm text-ink-500 italic py-4">No active submissions. Start a new one above.</p>
          ) : (
            <ul className="space-y-2">
              {activeSubmissions.map(sub => {
                const meta = SUBMISSION_STATUS[sub.status] ?? { label: sub.status, color: 'text-gray-500', icon: FileText }
                const Icon = meta.icon
                return (
                  <li key={sub.id}>
                    <Link
                      to={`/submissions/${sub.id}`}
                      className="group flex items-center gap-4 p-3 -mx-3 rounded-xl hover:bg-purple-50/60 transition-colors"
                    >
                      <span className={cn('flex-shrink-0', meta.color)}>
                        <Icon size={16} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-900 truncate">{sub.title}</p>
                        <p className={cn('text-xs font-medium mt-0.5', meta.color)}>{meta.label}</p>
                      </div>
                      <span className="text-xs text-ink-400 flex-shrink-0">
                        {formatDate(sub.updated_at || sub.submitted_at)}
                      </span>
                      <ArrowRight size={14} className="text-ink-300 group-hover:text-primary-600 transition-colors flex-shrink-0" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : (
        browsePgms.length > 0 && (
          <section className="card p-6">
            <header className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-green-50 text-green-700">
                  <FolderOpen size={18} />
                </span>
                <h2 className="section-title !mb-0">Active Programs</h2>
              </div>
              <Link to="/programs" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1">
                See all <ArrowRight size={12} />
              </Link>
            </header>
            <ul className="space-y-2">
              {browsePgms.map(pgm => (
                <li key={pgm.id}>
                  <Link
                    to="/programs"
                    className="group flex items-center gap-4 p-3 -mx-3 rounded-xl hover:bg-green-50/60 transition-colors"
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-700">
                      <FolderOpen size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-900 truncate">{pgm.title}</p>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {CATEGORY_LABELS[pgm.category] ?? pgm.category} · {pgm.submitter_type === 'sk' ? 'SK Program' : 'Youth Org Program'}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0 capitalize">
                      {pgm.status}
                    </span>
                    <ArrowRight size={14} className="text-ink-300 group-hover:text-primary-600 transition-colors flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      )}

      {/* ── Two columns: Events · Announcements ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Events with All / Registered tabs */}
        <section className="card p-6">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary-50 text-primary-700">
                <CalendarDays size={18} />
              </span>
              <h2 className="section-title !mb-0">Events</h2>
            </div>
            <Link to="/events" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1">
              See all <ArrowRight size={12} />
            </Link>
          </header>

          {/* Tab row */}
          <div className="flex gap-1 mb-4 p-1 bg-ink-50 rounded-xl w-fit">
            {(['all', 'mine'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setEventTab(tab)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                  eventTab === tab
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-500 hover:text-ink-700',
                )}
              >
                {tab === 'all' ? 'Upcoming' : `My registrations${myEvents.length > 0 ? ` (${myEvents.length})` : ''}`}
              </button>
            ))}
          </div>

          <FeedState
            isLoading={eventsQ.isLoading}
            isError={eventsQ.isError}
            isEmpty={visibleEvents.length === 0}
            emptyText={eventTab === 'mine' ? "You haven't registered for any upcoming events." : 'No upcoming events scheduled.'}
            onRetry={() => eventsQ.refetch()}
          >
            <ul className="space-y-3">
              {visibleEvents.map(event => (
                <li key={event.id} className="group flex items-start gap-4 p-3 -mx-3 rounded-xl hover:bg-primary-50/60 transition-colors">
                  <div className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-primary-100 text-primary-700 font-display font-bold leading-none">
                    <span className="text-[10px] uppercase tracking-wider mt-0.5">
                      {new Date(event.start_datetime).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-lg">{new Date(event.start_datetime).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="chip-primary text-[10px] mb-1.5">
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                    <p className="text-ink-900 font-semibold leading-snug line-clamp-2 mt-1">{event.title}</p>
                    <p className="text-xs text-ink-500 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} /> {formatDate(event.start_datetime)}
                      </span>
                      {event.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} /> {event.location}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </FeedState>
        </section>

        {/* Announcements */}
        <section className="card p-6">
          <header className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-accent-100 text-accent-800">
                <Bell size={18} />
              </span>
              <h2 className="section-title !mb-0">Announcements</h2>
            </div>
            <Link to="/news" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1">
              See all <ArrowRight size={12} />
            </Link>
          </header>
          <FeedState
            isLoading={announcementsQ.isLoading}
            isError={announcementsQ.isError}
            isEmpty={announcements.length === 0}
            emptyText="No new announcements right now."
            onRetry={() => announcementsQ.refetch()}
          >
            <ul className="space-y-3">
              {announcements.map(ann => (
                <li key={ann.id} className="group p-3 -mx-3 rounded-xl hover:bg-accent-50/40 transition-colors">
                  <div className="flex items-start gap-3">
                    {ann.is_pinned && (
                      <span className="chip-alert flex-shrink-0 mt-0.5 text-[10px]">Pinned</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-ink-900 font-semibold leading-snug line-clamp-2">{ann.title}</p>
                      <p className="text-xs text-ink-600 mt-1.5 line-clamp-2 leading-relaxed">{ann.content}</p>
                      <p className="text-[11px] font-semibold text-ink-400 mt-2 uppercase tracking-wider">
                        {formatDate(ann.created_at)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </FeedState>
        </section>
      </div>

      {/* ── Activity / Notification feed ─────────────────────────────────── */}
      {activityItems.length > 0 && (
        <section className="card p-6">
          <header className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-violet-50 text-violet-700">
                <Activity size={18} />
              </span>
              <h2 className="section-title !mb-0">Notifications</h2>
            </div>
            <Link to="/notifications" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1">
              See all <ArrowRight size={12} />
            </Link>
          </header>

          <div className="relative space-y-0 pl-5 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-ink-100">
            {activityItems.slice(0, 6).map((item) => {
              const type = item.notification_type ?? ''
              const iconEl = type === 'badge'
                ? <Trophy size={13} className="text-amber-500" />
                : type === 'course'
                ? <PlayCircle size={13} className="text-blue-600" />
                : type === 'announcement'
                ? <MessageSquare size={13} className="text-primary-600" />
                : type === 'project'
                ? <FileText size={13} className="text-purple-600" />
                : type === 'event'
                ? <CalendarDays size={13} className="text-emerald-600" />
                : type === 'internship'
                ? <Briefcase size={13} className="text-amber-600" />
                : <Bell size={13} className="text-blue-600" />
              const dotColor = type === 'badge' ? 'bg-amber-400'
                : type === 'course' ? 'bg-blue-400'
                : type === 'announcement' ? 'bg-primary-400'
                : type === 'project' ? 'bg-purple-400'
                : type === 'event' ? 'bg-emerald-400'
                : type === 'internship' ? 'bg-amber-400'
                : 'bg-blue-400'

              return (
                <div key={item.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
                  <div className={cn('absolute -left-5 mt-1 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center flex-shrink-0', dotColor)}>
                    <div className="w-1 h-1 rounded-full bg-white" />
                  </div>
                  <div className="ml-2 flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 leading-snug">{item.title}</p>
                    <p className="text-xs text-ink-500 mt-0.5 line-clamp-1">{item.message}</p>
                    <p className="text-[10px] text-ink-400 mt-1">{formatDate(item.created_at)}</p>
                  </div>
                  <span className="flex-shrink-0 mt-0.5">{iconEl}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── My Posts ─────────────────────────────────────────────────────── */}
      {(myPostsQ.data?.length ?? 0) > 0 && (
        <section className="card p-6">
          <header className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700">
                <MessageSquare size={18} />
              </span>
              <h2 className="section-title !mb-0">My Posts</h2>
            </div>
            <Link to="/community" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1">
              Community feed <ArrowRight size={12} />
            </Link>
          </header>
          <ul className="space-y-3">
            {(myPostsQ.data ?? []).slice(0, 3).map(post => (
              <li key={post.id} className="group flex items-start gap-3 p-3 -mx-3 rounded-xl hover:bg-indigo-50/40 transition-colors">
                {post.images.length > 0 && (
                  <img
                    src={post.images[0].url}
                    alt=""
                    className="flex-shrink-0 w-12 h-12 rounded-xl object-cover border border-ink-100"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-800 line-clamp-2 leading-snug">{post.content}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-xs text-ink-400">
                      <Heart size={11} className={post.is_liked ? 'fill-red-400 text-red-400' : ''} />
                      {post.like_count > 0 ? post.like_count : ''}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-ink-400">
                      <MessageSquare size={11} />
                      {post.comment_count > 0 ? post.comment_count : ''}
                    </span>
                    <span className="text-[11px] text-ink-400">{formatDate(post.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => deletePostMutation.mutate(post.id)}
                  disabled={deletePostMutation.isPending}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-ink-300 hover:text-red-500 transition-all disabled:opacity-30"
                  title="Delete post"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Quick links — 6 hubs ─────────────────────────────────────────── */}
      <section>
        <h2 className="section-title mb-4">Explore</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <QuickLink to="/programs"      icon={FolderOpen}   label="Programs"      />
          <QuickLink to="/events"        icon={CalendarDays} label="Events"        />
          <QuickLink to="/community"     icon={Users}        label="Community"     />
          <QuickLink to="/opportunities" icon={Briefcase}    label="Opportunities" />
          <QuickLink to="/library"       icon={BookOpen}     label="Resources"     />
          <QuickLink to="/badges"        icon={Award}        label="Badges"        />
        </div>
      </section>
    </div>
  )
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function QuickLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="group bg-white border border-ink-100 hover:border-primary-300 hover:bg-primary-50/60 rounded-2xl p-4 flex flex-col items-center gap-2.5 text-center transition-all"
    >
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-50 group-hover:bg-primary-600 text-primary-700 group-hover:text-white transition-colors">
        <Icon size={18} />
      </span>
      <span className="font-semibold text-xs text-ink-800 group-hover:text-primary-700 transition-colors leading-tight">{label}</span>
    </Link>
  )
}

function Spotlight({
  prompt,
}: {
  prompt:
    | { kind: 'announcement'; ann: Announcement }
    | { kind: 'event'; event: Event }
    | { kind: 'default' }
}) {
  if (prompt.kind === 'announcement') {
    return (
      <Link
        to="/news"
        className="group block bg-white rounded-3xl border border-ink-100 hover:border-primary-300 hover:shadow-lg overflow-hidden transition-all"
      >
        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-2 bg-accent-400" />
          <div className="flex-1 p-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="chip-accent">Announcement</span>
              <span className="text-xs font-semibold text-ink-500">{formatDate(prompt.ann.created_at)}</span>
            </div>
            <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-ink-900 leading-tight tracking-tighter2 mb-3">
              {prompt.ann.title}
            </h3>
            <p className="text-ink-600 line-clamp-2 leading-relaxed max-w-2xl">
              {prompt.ann.content}
            </p>
            <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-primary-700 group-hover:gap-2 transition-all">
              Read more <ArrowRight size={14} />
            </span>
          </div>
        </div>
      </Link>
    )
  }

  if (prompt.kind === 'event') {
    return (
      <Link
        to="/events"
        className="group block bg-white rounded-3xl border border-ink-100 hover:border-primary-300 hover:shadow-lg overflow-hidden transition-all"
      >
        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-2 bg-primary-600" />
          <div className="flex-1 p-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="chip-primary">Up next · {prompt.event.event_type.replace(/_/g, ' ')}</span>
            </div>
            <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-ink-900 leading-tight tracking-tighter2 mb-4">
              {prompt.event.title}
            </h3>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-600 mb-4">
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} /> {formatDate(prompt.event.start_datetime)}
              </span>
              {prompt.event.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} /> {prompt.event.location}
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 group-hover:text-primary-800 group-hover:gap-2 transition-all">
              View calendar <ArrowRight size={14} />
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="bg-white rounded-3xl border border-ink-100 p-7">
      <p className="eyebrow mb-2">All caught up</p>
      <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-ink-900 leading-tight tracking-tighter2 mb-3">
        Nothing pressing today.
      </h3>
      <p className="text-ink-600 leading-relaxed max-w-2xl">
        Come back tomorrow, or browse{' '}
        <Link to="/programs" className="font-semibold text-primary-700 hover:text-primary-800 underline underline-offset-4 decoration-accent-400 decoration-2">
          open programs
        </Link>{' '}
        in the meantime.
      </p>
    </div>
  )
}

function FeedState({
  isLoading, isError, isEmpty, emptyText, onRetry, children,
}: {
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
  emptyText: string
  onRetry: () => void
  children: React.ReactNode
}) {
  if (isLoading) return <PageSpinner />
  if (isError) {
    return (
      <div className="py-6 px-1">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-alert-600 mb-2">
          <AlertCircle size={14} /> Couldn't load
        </p>
        <p className="text-sm text-ink-600 mb-3">We couldn't reach this section. Other parts still work.</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 px-3 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors"
        >
          <RefreshCw size={12} /> Try again
        </button>
      </div>
    )
  }
  if (isEmpty) return <p className="text-sm text-ink-500 italic py-4">{emptyText}</p>
  return <>{children}</>
}
