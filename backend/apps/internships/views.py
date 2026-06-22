from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole, IsAdminOrLGU

from .models import Internship, InternshipApplication
from .serializers import (
    InternshipApplicationSerializer,
    InternshipDetailSerializer,
    InternshipListSerializer,
)


# ---------------------------------------------------------------------------
# InternshipViewSet
# ---------------------------------------------------------------------------

class InternshipViewSet(viewsets.ModelViewSet):
    """
    GET    /internships/       – list open, active internships (authenticated)
    GET    /internships/{id}/  – detail
    POST   /internships/       – create (LGU Admin / Super Admin)
    PUT    /internships/{id}/  – update (LGU Admin / Super Admin)
    DELETE /internships/{id}/  – soft delete (LGU Admin / Super Admin)
    """
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["status", "mode", "is_featured", "organization"]
    search_fields = ["title", "description", "organization", "location"]
    ordering_fields = ["created_at", "deadline", "slots"]
    ordering = ["-created_at"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsAdminOrLGU()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Internship.objects.prefetch_related(
            "structured_requirements",
            "eligibility_badges",
            "required_courses",
        ).select_related("posted_by")

        is_admin = hasattr(user, "role") and user.role in ("lgu_admin", "super_admin")
        if not is_admin:
            # Regular youth users only see open, active listings
            qs = qs.filter(status="open", is_active=True)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return InternshipListSerializer
        return InternshipDetailSerializer

    def perform_create(self, serializer):
        serializer.save(posted_by=self.request.user)

    def perform_destroy(self, instance):
        # Soft delete
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    @action(
        detail=True,
        methods=["post"],
        url_path="toggle_featured",
        permission_classes=[permissions.IsAuthenticated, IsAdminRole],
    )
    def toggle_featured(self, request, pk=None):
        """POST /internships/{id}/toggle_featured/ — flip is_featured flag."""
        internship = self.get_object()
        internship.is_featured = not internship.is_featured
        internship.save(update_fields=["is_featured"])
        return Response(
            {"is_featured": internship.is_featured},
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# InternshipApplicationViewSet
# ---------------------------------------------------------------------------

class InternshipApplicationViewSet(viewsets.ModelViewSet):
    """
    POST   /applications/              – youth applies (with optional resume upload)
    GET    /applications/              – youth sees own apps; admin sees all
    GET    /applications/{id}/         – detail
    PATCH  /applications/{id}/status/  – admin updates status
    """
    serializer_class = InternshipApplicationSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.OrderingFilter,
    ]
    filterset_fields = ["status", "internship"]
    ordering = ["-submitted_at"]

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy", "update_status"):
            return [permissions.IsAuthenticated(), IsAdminOrLGU()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        is_admin = hasattr(user, "role") and user.role in ("lgu_admin", "super_admin")
        qs = InternshipApplication.objects.select_related(
            "applicant", "internship"
        )
        if is_admin:
            return qs
        return qs.filter(applicant=user)

    def perform_create(self, serializer):
        serializer.save(applicant=self.request.user)

    # Prevent non-admin from updating records
    def update(self, request, *args, **kwargs):
        user = request.user
        is_admin = hasattr(user, "role") and user.role in ("lgu_admin", "super_admin")
        if not is_admin:
            return Response(
                {"detail": "You do not have permission to update applications."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        user = request.user
        is_admin = hasattr(user, "role") and user.role in ("lgu_admin", "super_admin")
        if not is_admin:
            return Response(
                {"detail": "You do not have permission to delete applications."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(
        detail=True,
        methods=["patch"],
        url_path="update_status",
        permission_classes=[permissions.IsAuthenticated, IsAdminOrLGU],
    )
    def update_status(self, request, pk=None):
        """
        PATCH /applications/{id}/update_status/
        Body: { "status": "<new_status>", "notes": "..." (optional) }
        """
        application = self.get_object()
        allowed_statuses = [choice[0] for choice in InternshipApplication.STATUS_CHOICES]
        new_status = request.data.get("status")
        notes = request.data.get("notes", "")

        if not new_status:
            return Response(
                {"detail": "status field is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_status not in allowed_statuses:
            return Response(
                {"detail": f"Invalid status. Allowed: {', '.join(allowed_statuses)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        application.status = new_status
        if notes:
            application.notes = notes
        application.save(update_fields=["status", "notes", "updated_at"])

        serializer = self.get_serializer(application)
        return Response(serializer.data, status=status.HTTP_200_OK)
