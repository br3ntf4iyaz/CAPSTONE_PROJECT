"""Public stats endpoint — unauthenticated aggregate counts for the landing page."""
from __future__ import annotations

from django.apps import apps
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


def _safe_count(app_label: str, model_name: str, **filters) -> int:
    try:
        model = apps.get_model(app_label, model_name)
    except LookupError:
        return 0
    try:
        return model.objects.filter(**filters).count()
    except Exception:
        return 0


class PublicStatsView(APIView):
    """GET /api/stats/public/ — counts for the public home page."""

    permission_classes = [AllowAny]

    def get(self, request):
        User = get_user_model()
        now = timezone.now()
        data = {
            "registered_youth": User.objects.filter(is_active=True).count(),
            "active_organizations": _safe_count("youth_orgs", "YouthOrganization", is_active=True)
            or _safe_count("youth_orgs", "YouthOrganization"),
            "programs_completed": _safe_count("programs", "YouthProgram", status="completed"),
            "upcoming_events": _safe_count("events", "Event", start_datetime__gte=now),
        }
        return Response(data)


class DashboardStatsView(APIView):
    """GET /api/stats/dashboard/ — per-user counts for the youth dashboard."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        data = {
            "courses_enrolled": _safe_count("courses", "Enrollment", user=user),
            "events_registered": _safe_count("events", "EventRegistration", user=user),
            "programs_nearby": _safe_count("programs", "YouthProgram", status="active"),
            "submissions_made": _safe_count("programs", "ProgramSubmission", submitted_by=user),
        }
        return Response(data)
