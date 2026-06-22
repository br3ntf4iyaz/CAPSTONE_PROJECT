from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, status, filters, generics
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole, IsSuperAdmin

from .models import Announcement, Badge, Certificate, LeaderboardEntry, UserBadge
from .serializers import (
    AnnouncementSerializer,
    BadgeSerializer,
    CertificateSerializer,
    LeaderboardEntrySerializer,
    UserBadgeSerializer,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# BadgeViewSet
# ---------------------------------------------------------------------------

class BadgeViewSet(viewsets.ModelViewSet):
    """
    list/retrieve: any authenticated user.
    create/update/destroy: super_admin only.
    """

    serializer_class = BadgeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description', 'category']
    ordering_fields = ['category', 'name', 'created_at']
    ordering = ['category', 'name']

    def get_queryset(self):
        qs = Badge.objects.all()
        if not (self.request.user.is_authenticated and IsSuperAdmin().has_permission(self.request, self)):
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsSuperAdmin()]


# ---------------------------------------------------------------------------
# UserBadgeViewSet
# ---------------------------------------------------------------------------

class UserBadgeViewSet(viewsets.ModelViewSet):
    """
    list: users see own badges; admins see all.
    award (POST /award/): admin awards a badge to a user.
    destroy: super_admin only.
    """

    serializer_class = UserBadgeSerializer

    def get_queryset(self):
        qs = UserBadge.objects.select_related('user', 'badge', 'awarded_by')
        if IsAdminRole().has_permission(self.request, self):
            return qs
        return qs.filter(user=self.request.user)

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        if self.action == 'award':
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsSuperAdmin()]

    @action(detail=False, methods=['post'], url_path='award', permission_classes=[IsAuthenticated, IsAdminRole])
    def award(self, request):
        user_id = request.data.get('user_id')
        badge_id = request.data.get('badge_id')
        if not user_id or not badge_id:
            return Response(
                {'detail': 'Both user_id and badge_id are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            target_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            badge = Badge.objects.get(pk=badge_id, is_active=True)
        except Badge.DoesNotExist:
            return Response(
                {'detail': 'Badge not found or is inactive.'}, status=status.HTTP_404_NOT_FOUND
            )
        if UserBadge.objects.filter(user=target_user, badge=badge).exists():
            return Response(
                {'detail': 'This user already holds this badge.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user_badge = UserBadge.objects.create(
            user=target_user,
            badge=badge,
            awarded_by=request.user,
        )
        serializer = UserBadgeSerializer(user_badge, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# CertificateViewSet
# ---------------------------------------------------------------------------

class CertificateViewSet(viewsets.ModelViewSet):
    """
    list/retrieve: users see own certificates; admins see all.
    create/update/destroy: admin only.
    """

    serializer_class = CertificateSerializer

    def get_queryset(self):
        qs = Certificate.objects.select_related('user', 'enrollment')
        if IsAdminRole().has_permission(self.request, self):
            return qs
        return qs.filter(user=self.request.user)

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]


# ---------------------------------------------------------------------------
# LeaderboardView
# ---------------------------------------------------------------------------

class LeaderboardView(generics.ListAPIView):
    """
    Paginated, ranked leaderboard.
    Query params:
      - category: one of course|governance|project|volunteer
        (defaults to total_score ranking)
    """

    serializer_class = LeaderboardEntrySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = [
        'rank',
        'total_score',
        'course_score',
        'governance_score',
        'project_score',
        'volunteer_score',
    ]
    ordering = ['rank', '-total_score']

    CATEGORY_SCORE_MAP = {
        'course': 'course_score',
        'governance': 'governance_score',
        'project': 'project_score',
        'volunteer': 'volunteer_score',
    }

    def get_queryset(self):
        qs = LeaderboardEntry.objects.select_related('user')
        category = self.request.query_params.get('category')
        if category and category in self.CATEGORY_SCORE_MAP:
            score_field = self.CATEGORY_SCORE_MAP[category]
            qs = qs.order_by(f'-{score_field}', 'rank')
        else:
            qs = qs.order_by('rank', '-total_score')
        return qs


# ---------------------------------------------------------------------------
# AnnouncementViewSet
# ---------------------------------------------------------------------------

class AnnouncementViewSet(viewsets.ModelViewSet):
    """
    list/retrieve: authenticated users see published announcements relevant to their role.
    create/update/destroy: admin only.
    """

    serializer_class = AnnouncementSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'content']
    ordering_fields = ['created_at', 'published_at']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = Announcement.objects.select_related('created_by')
        if IsAdminRole().has_permission(self.request, self):
            return qs
        user = self.request.user
        role = getattr(user, 'role', None)
        # Show published announcements that target the user's role or have no role restrictions.
        # NOTE: JSONField __contains is Postgres-only; on SQLite we filter in Python.
        role_value = role.value if hasattr(role, 'value') else str(role)
        qs = qs.filter(is_published=True)
        from django.db import connection
        if connection.vendor == 'postgresql':
            qs = qs.filter(Q(target_roles__contains=[role_value]) | Q(target_roles=[]))
        else:
            ids = [
                a.pk for a in qs
                if not a.target_roles or role_value in a.target_roles
            ]
            qs = qs.filter(pk__in=ids)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        kwargs = {'created_by': self.request.user}
        if serializer.validated_data.get('is_published') and not serializer.validated_data.get('published_at'):
            kwargs['published_at'] = timezone.now()
        serializer.save(**kwargs)

    def perform_update(self, serializer):
        kwargs = {}
        if (
            serializer.validated_data.get('is_published')
            and not serializer.instance.published_at
        ):
            kwargs['published_at'] = timezone.now()
        serializer.save(**kwargs)
