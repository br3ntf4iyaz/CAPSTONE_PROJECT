from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from apps.accounts.public_stats import PublicStatsView, DashboardStatsView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/stats/public/", PublicStatsView.as_view(), name="public-stats"),
    path("api/stats/dashboard/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/courses/", include("apps.courses.urls")),
    path("api/internships/", include("apps.internships.urls")),
    path("api/events/", include("apps.events.urls")),
    path("api/projects/", include("apps.projects.urls")),
    path("api/volunteers/", include("apps.volunteers.urls")),
    path("api/recognition/", include("apps.recognition.urls")),
    path("api/schools/", include("apps.schools.urls")),
    path("api/resources/", include("apps.resources.urls")),
    path("api/scholarships/", include("apps.resources.scholarship_urls")),
    path("api/compliance/", include("apps.compliance.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/support/", include("apps.support.urls")),
    path("api/youth-orgs/", include("apps.youth_orgs.urls")),
    path("api/sk-requirements/", include("apps.sk_requirements.urls")),
    path("api/jobs/", include("apps.jobs.urls")),
    path("api/programs/", include("apps.programs.urls")),
    path("api/chatbot/", include("apps.chatbot.urls")),
    path("api/verification/", include("apps.verification.urls")),
    path("api/community/", include("apps.community.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
