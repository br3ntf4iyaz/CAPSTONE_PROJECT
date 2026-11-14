import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { PageSpinner } from '@/components/ui/Spinner'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'
import { authStore } from '@/store/authStore'

// ─── Youth Portal layouts ──────────────────────────────────────────────────────
import YouthLayout from '@/portals/youth/layout/YouthLayout'
import YouthPublicLayout from '@/portals/youth/layout/YouthPublicLayout'

// ─── Youth Portal pages (eager) ───────────────────────────────────────────────
import YouthHomePage from '@/portals/youth/pages/YouthHomePage'
import NewsDetailPage from '@/portals/youth/pages/NewsDetailPage'
import NewsPage from '@/portals/youth/pages/NewsPage'
import ProgramNewsDetailPage from '@/portals/youth/pages/ProgramNewsDetailPage'
import YouthLoginPage from '@/portals/youth/pages/YouthLoginPage'
import YouthRegisterPage from '@/portals/youth/pages/YouthRegisterPage'
import VerifyEmailPendingPage from '@/portals/youth/pages/VerifyEmailPendingPage'
import VerifyEmailPage from '@/portals/youth/pages/VerifyEmailPage'
import ForgotPasswordPage from '@/portals/youth/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/portals/youth/pages/ResetPasswordPage'
import OnboardingPage from '@/portals/youth/pages/OnboardingPage'
import TermsPage from '@/portals/youth/pages/TermsPage'
import PrivacyPage from '@/portals/youth/pages/PrivacyPage'

// ─── Youth Portal pages (lazy) ────────────────────────────────────────────────
const YouthDashboardPage   = lazy(() => import('@/portals/youth/pages/YouthDashboardPage'))
const ProgramsPage         = lazy(() => import('@/portals/youth/pages/ProgramsPage'))
const YouthCalendarPage    = lazy(() => import('@/portals/youth/pages/YouthCalendarPage'))
const YouthLMSPage         = lazy(() => import('@/portals/youth/pages/YouthLMSPage'))
const ChatbotPage          = lazy(() => import('@/portals/youth/pages/ChatbotPage'))
const JobsPage             = lazy(() => import('@/portals/youth/pages/JobsPage'))
const ScholarshipsPage     = lazy(() => import('@/portals/youth/pages/ScholarshipsPage'))
const YouthSchoolsPage     = lazy(() => import('@/portals/youth/pages/YouthSchoolsPage'))
const OrgDirectoryPage     = lazy(() => import('@/portals/youth/pages/OrgDirectoryPage'))
const SKDirectoryPage      = lazy(() => import('@/portals/youth/pages/SKDirectoryPage'))
const YouthSKFeedbackPage  = lazy(() => import('@/portals/youth/pages/YouthSKFeedbackPage'))
const SKFeedbackInboxPage  = lazy(() => import('@/portals/youth/pages/SKFeedbackInboxPage'))
const SKRequirementsPage   = lazy(() => import('@/portals/youth/pages/SKRequirementsPage'))
const LibraryPage          = lazy(() => import('@/portals/youth/pages/LibraryPage'))
const SubmissionsPage      = lazy(() => import('@/portals/youth/pages/SubmissionsPage'))
const SubmissionWizardPage = lazy(() => import('@/portals/youth/pages/SubmissionWizardPage'))
const SubmissionDetailPage = lazy(() => import('@/portals/youth/pages/SubmissionDetailPage'))
const YouthSurveysPage     = lazy(() => import('@/portals/youth/pages/YouthSurveysPage'))
const PollsPage            = lazy(() => import('@/portals/youth/pages/PollsPage'))
const FeedbackPage         = lazy(() => import('@/portals/youth/pages/FeedbackPage'))
const YouthProfilePage     = lazy(() => import('@/portals/youth/pages/YouthProfilePage'))
const VerifyIdentityPage   = lazy(() => import('@/portals/youth/pages/VerifyIdentityPage'))

// ─── Hub pages (Rick's 9-section nav) ─────────────────────────────────────────
const LearnHubPage         = lazy(() => import('@/portals/youth/pages/hubs/LearnHubPage'))
const CommunityHubPage     = lazy(() => import('@/portals/youth/pages/hubs/CommunityHubPage'))
const OpportunitiesHubPage = lazy(() => import('@/portals/youth/pages/hubs/OpportunitiesHubPage'))
const ParticipateHubPage   = lazy(() => import('@/portals/youth/pages/hubs/ParticipateHubPage'))
const NeedHelpHubPage      = lazy(() => import('@/portals/youth/pages/hubs/NeedHelpHubPage'))
const YORPRegistrationPage = lazy(() => import('@/portals/youth/pages/YORPRegistrationPage'))
const PublicSurveyDetailPage    = lazy(() => import('@/portals/youth/pages/PublicSurveyDetailPage'))

// ─── Learn deep pages ─────────────────────────────────────────────────────────
const YouthBadgesPage       = lazy(() => import('@/portals/youth/pages/YouthBadgesPage'))
const YouthCertificatesPage = lazy(() => import('@/portals/youth/pages/YouthCertificatesPage'))
const CoursePage            = lazy(() => import('@/portals/youth/pages/CoursePage'))
const LessonPlayerPage      = lazy(() => import('@/portals/youth/pages/LessonPlayerPage'))
const YouthIDCardPage       = lazy(() => import('@/portals/youth/pages/YouthIDCardPage'))

// ─── Admin Portal ──────────────────────────────────────────────────────────────
import AdminLayout from '@/portals/admin/layout/AdminLayout'
import AdminLoginPage from '@/portals/admin/pages/AdminLoginPage'

const AdminDashPage        = lazy(() => import('@/portals/admin/pages/AdminDashPage'))
const AdminProjectsPage    = lazy(() => import('@/portals/admin/pages/AdminProjectsPage'))
const AdminYORPPage        = lazy(() => import('@/portals/admin/pages/AdminYORPPage'))
const AdminSKTrackerPage   = lazy(() => import('@/portals/admin/pages/AdminSKTrackerPage'))
const AdminAnalyticsPage   = lazy(() => import('@/portals/admin/pages/AdminAnalyticsPage'))
const AdminCalendarPage    = lazy(() => import('@/portals/admin/pages/AdminCalendarPage'))
const AdminLMSPage             = lazy(() => import('@/portals/admin/pages/AdminLMSPage'))
const AdminCourseBuilderPage   = lazy(() => import('@/portals/admin/pages/AdminCourseBuilderPage'))
const AdminSurveysPage     = lazy(() => import('@/portals/admin/pages/AdminSurveysPage'))
const AdminUsersPage       = lazy(() => import('@/portals/admin/pages/AdminUsersPage'))
const AdminLibraryPage     = lazy(() => import('@/portals/admin/pages/AdminLibraryPage'))
const AdminJobsSchoolsPage = lazy(() => import('@/portals/admin/pages/AdminJobsSchoolsPage'))
const AdminNotifPage       = lazy(() => import('@/portals/admin/pages/AdminNotifPage'))
const AdminFeaturedPage    = lazy(() => import('@/portals/admin/pages/AdminFeaturedPage'))
const AdminReportsPage        = lazy(() => import('@/portals/admin/pages/AdminReportsPage'))
const AdminVerificationPage   = lazy(() => import('@/portals/admin/pages/AdminVerificationPage'))
const AdminAuditLogPage       = lazy(() => import('@/portals/admin/pages/AdminAuditLogPage'))
const AdminParticipationPage  = lazy(() => import('@/portals/admin/pages/AdminParticipationPage'))
const AdminProgramsPage       = lazy(() => import('@/portals/admin/pages/AdminProgramsPage'))

// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Wrap every lazy route in BOTH a Suspense (for the chunk load) AND a
 * RouteErrorBoundary (so a single page render error doesn't blank the
 * whole app &mdash; see RouteErrorBoundary.tsx for the rationale).
 */
function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageSpinner />}>{children}</Suspense>
    </RouteErrorBoundary>
  )
}

/** Redirect to dashboard if user is already authenticated (for /login, /register).
 *  MUST match YouthLayout's guard: require BOTH token AND user object.
 *  If we redirect on token-only, and YouthLayout redirects back on missing user,
 *  we get an infinite ping-pong (observed: "Maximum update depth exceeded"
 *  when a stale access token exists but the /me profile fetch has not completed
 *  or has failed). Treat "authenticated" as "has token and has user" everywhere. */
function GuestOnlyRoute({ children }: { children: React.ReactNode }) {
  if (authStore.isAuthenticated && authStore.user) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

/** Only SK officials can manage their council's requirements */
function SKGuard({ children }: { children: React.ReactNode }) {
  const youthType = (authStore.user as any)?.youth_type
  if (youthType === 'sk') return <Wrap>{children}</Wrap>
  return <Navigate to="/dashboard" replace />
}

/** Only SK + Youth Org leaders can access submissions */
function SubmissionsGuard({ children }: { children: React.ReactNode }) {
  const youthType = (authStore.user as any)?.youth_type
  if (youthType === 'sk' || youthType === 'youth_org_leader') {
    return <Wrap>{children}</Wrap>
  }
  return <Navigate to="/dashboard" replace />
}

/** Only Youth Org leaders can access YORP Registration */
function YORPGuard() {
  const youthType = (authStore.user as any)?.youth_type
  if (youthType === 'youth_org_leader') {
    return <Wrap><YORPRegistrationPage /></Wrap>
  }
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <Routes>
      {/* ── Youth Portal &mdash; public pages (no auth) ─────────────────────── */}
      <Route element={<YouthPublicLayout />}>
        <Route path="/"           element={<YouthHomePage />} />
        <Route path="/news/:id"   element={<NewsDetailPage />} />
        {/* /news is the public alias — logged-in users use /news-feed inside the auth layout */}
        <Route path="/news"              element={<NewsPage />} />
        <Route path="/news-feed/:id"     element={<ProgramNewsDetailPage />} />
        {/* Survey detail — publicly viewable, submit requires login */}
        <Route path="/surveys/:id"       element={<Wrap><PublicSurveyDetailPage /></Wrap>} />
      </Route>

      {/* ── Auth pages &mdash; standalone (have their own header) ──────────── */}
      <Route path="/login"                element={<GuestOnlyRoute><YouthLoginPage /></GuestOnlyRoute>} />
      <Route path="/register"             element={<GuestOnlyRoute><YouthRegisterPage /></GuestOnlyRoute>} />
      <Route path="/verify-email/pending" element={<VerifyEmailPendingPage />} />
      <Route path="/verify-email"         element={<VerifyEmailPage />} />
      <Route path="/forgot-password"      element={<ForgotPasswordPage />} />
      <Route path="/reset-password"       element={<ResetPasswordPage />} />
      <Route path="/onboarding"           element={<OnboardingPage />} />
      <Route path="/terms"                element={<TermsPage />} />
      <Route path="/privacy"              element={<PrivacyPage />} />

      {/* ── Youth Portal &mdash; authenticated (all show tab nav) ───────────── */}
      <Route element={<YouthLayout />}>
        <Route path="/dashboard"        element={<Wrap><YouthDashboardPage /></Wrap>} />
        <Route path="/news-feed"        element={<Wrap><NewsPage /></Wrap>} />

        {/* Hub pages (Rick's 9-section nav) */}
        <Route path="/learn"            element={<Wrap><LearnHubPage /></Wrap>} />
        <Route path="/community"        element={<Wrap><CommunityHubPage /></Wrap>} />
        <Route path="/opportunities"    element={<Wrap><OpportunitiesHubPage /></Wrap>} />
        <Route path="/events"           element={<Wrap><YouthCalendarPage /></Wrap>} />
        <Route path="/participate"      element={<Wrap><ParticipateHubPage /></Wrap>} />
        <Route path="/help"             element={<Wrap><NeedHelpHubPage /></Wrap>} />
        {/* These were previously also in the public layout — auth layout wins now */}
        <Route path="/resources"        element={<Wrap><LibraryPage /></Wrap>} />
        <Route path="/programs"         element={<Wrap><ProgramsPage /></Wrap>} />

        {/* Detail destinations linked from hubs */}
        <Route path="/programs"         element={<Wrap><ProgramsPage /></Wrap>} />
        <Route path="/calendar"         element={<Wrap><YouthCalendarPage /></Wrap>} />
        <Route path="/lms"              element={<Wrap><YouthLMSPage /></Wrap>} />
        <Route path="/lms/:courseId"                   element={<Wrap><CoursePage /></Wrap>} />
        <Route path="/lms/:courseId/lesson/:lessonId"  element={<Wrap><LessonPlayerPage /></Wrap>} />
        <Route path="/badges"           element={<Wrap><YouthBadgesPage /></Wrap>} />
        <Route path="/certificates"     element={<Wrap><YouthCertificatesPage /></Wrap>} />
        <Route path="/chatbot"          element={<Wrap><ChatbotPage /></Wrap>} />
        <Route path="/jobs"             element={<Wrap><JobsPage /></Wrap>} />
        <Route path="/scholarships"     element={<Wrap><ScholarshipsPage /></Wrap>} />
        <Route path="/schools"          element={<Wrap><YouthSchoolsPage /></Wrap>} />
        <Route path="/organizations"    element={<Wrap><OrgDirectoryPage /></Wrap>} />
        <Route path="/sk-directory"     element={<Wrap><SKDirectoryPage /></Wrap>} />
        <Route path="/sk-feedback"      element={<Wrap><YouthSKFeedbackPage /></Wrap>} />
        <Route path="/sk-inbox"         element={<Wrap><SKFeedbackInboxPage /></Wrap>} />
        <Route path="/library"          element={<Wrap><LibraryPage /></Wrap>} />
        <Route path="/surveys"          element={<Wrap><YouthSurveysPage /></Wrap>} />
        <Route path="/polls"            element={<Wrap><PollsPage /></Wrap>} />
        <Route path="/feedback"         element={<Wrap><FeedbackPage /></Wrap>} />
        <Route path="/profile"          element={<Wrap><YouthProfilePage /></Wrap>} />
        <Route path="/my-id-card"       element={<Wrap><YouthIDCardPage /></Wrap>} />
        <Route path="/verify-identity"  element={<Wrap><VerifyIdentityPage /></Wrap>} />

        {/* Role-gated */}
        <Route path="/submissions"        element={<SubmissionsGuard><SubmissionsPage /></SubmissionsGuard>} />
        <Route path="/submissions/new"    element={<SubmissionsGuard><SubmissionWizardPage /></SubmissionsGuard>} />
        <Route path="/submissions/:id"    element={<SubmissionsGuard><SubmissionDetailPage /></SubmissionsGuard>} />
        <Route path="/sk-requirements"    element={<SKGuard><SKRequirementsPage /></SKGuard>} />
        <Route path="/yorp-registration"  element={<YORPGuard />} />
      </Route>

      {/* ── Admin Portal &mdash; completely separate ────────────────────────── */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route element={<AdminLayout />}>
        <Route path="/admin"                 element={<Wrap><AdminDashPage /></Wrap>} />
        <Route path="/admin/projects"        element={<Wrap><AdminProjectsPage /></Wrap>} />
        <Route path="/admin/yorp"            element={<Wrap><AdminYORPPage /></Wrap>} />
        <Route path="/admin/sk-tracker"      element={<Wrap><AdminSKTrackerPage /></Wrap>} />
        <Route path="/admin/analytics"       element={<Wrap><AdminAnalyticsPage /></Wrap>} />
        <Route path="/admin/calendar"        element={<Wrap><AdminCalendarPage /></Wrap>} />
        <Route path="/admin/lms"                          element={<Wrap><AdminLMSPage /></Wrap>} />
        <Route path="/admin/lms/courses/:courseId/builder" element={<Wrap><AdminCourseBuilderPage /></Wrap>} />
        <Route path="/admin/surveys"         element={<Wrap><AdminSurveysPage /></Wrap>} />
        <Route path="/admin/users"           element={<Wrap><AdminUsersPage /></Wrap>} />
        <Route path="/admin/library"         element={<Wrap><AdminLibraryPage /></Wrap>} />
        <Route path="/admin/jobs-schools"    element={<Wrap><AdminJobsSchoolsPage /></Wrap>} />
        <Route path="/admin/notifications"   element={<Wrap><AdminNotifPage /></Wrap>} />
        <Route path="/admin/featured"        element={<Wrap><AdminFeaturedPage /></Wrap>} />
        <Route path="/admin/programs"         element={<Wrap><AdminProgramsPage /></Wrap>} />
        <Route path="/admin/reports"         element={<Wrap><AdminReportsPage /></Wrap>} />
        <Route path="/admin/verification"    element={<Wrap><AdminVerificationPage /></Wrap>} />
        <Route path="/admin/audit-log"       element={<Wrap><AdminAuditLogPage /></Wrap>} />
        <Route path="/admin/participation"   element={<Wrap><AdminParticipationPage /></Wrap>} />
      </Route>

      {/* ── Catch-all ─────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
