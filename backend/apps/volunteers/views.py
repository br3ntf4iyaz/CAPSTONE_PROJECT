from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole

from .models import Team, TeamMember, VolunteerOpportunity, VolunteerSignup
from .serializers import (
    TeamMemberSerializer,
    TeamSerializer,
    VolunteerOpportunitySerializer,
    VolunteerSignupSerializer,
)


# ---------------------------------------------------------------------------
# VolunteerOpportunityViewSet
# ---------------------------------------------------------------------------

class VolunteerOpportunityViewSet(viewsets.ModelViewSet):
    """
    list: authenticated users see active opportunities.
    create/update/destroy: admin only.
    apply: authenticated users.
    """

    serializer_class = VolunteerOpportunitySerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'organization', 'location']
    ordering_fields = ['created_at', 'start_date', 'title']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = VolunteerOpportunity.objects.select_related('posted_by', 'event').annotate(signup_count=Count('signups', distinct=True))
        if IsAdminRole().has_permission(self.request, self):
            return qs
        return qs.filter(is_active=True)

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'apply'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        serializer.save(posted_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='apply', permission_classes=[IsAuthenticated])
    def apply(self, request, pk=None):
        opportunity = self.get_object()
        data = {**request.data, 'opportunity': opportunity.id}
        serializer = VolunteerSignupSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# VolunteerSignupViewSet
# ---------------------------------------------------------------------------

class VolunteerSignupViewSet(viewsets.ModelViewSet):
    """
    Authenticated users see only their own signups.
    Admins see all signups and may update status.
    """

    serializer_class = VolunteerSignupSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['signed_up_at', 'status']
    ordering = ['-signed_up_at']

    def get_queryset(self):
        qs = VolunteerSignup.objects.select_related('user', 'opportunity')
        if IsAdminRole().has_permission(self.request, self):
            return qs
        return qs.filter(user=self.request.user)

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'create'):
            return [IsAuthenticated()]
        if self.action in ('update', 'partial_update'):
            return [IsAuthenticated(), IsAdminRole()]
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ---------------------------------------------------------------------------
# TeamViewSet
# ---------------------------------------------------------------------------

class TeamViewSet(viewsets.ModelViewSet):
    """
    list: authenticated users see active teams.
    create: authenticated users.
    update/destroy: admin only.
    join: authenticated users.
    """

    serializer_class = TeamSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        qs = Team.objects.select_related('created_by', 'opportunity').prefetch_related('members__user').annotate(member_count=Count('members', distinct=True))
        if IsAdminRole().has_permission(self.request, self):
            return qs
        return qs.filter(is_active=True)

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        if self.action in ('create', 'join'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        team = serializer.save(created_by=self.request.user)
        # Creator automatically becomes a member with 'leader' role
        TeamMember.objects.create(team=team, user=self.request.user, role='leader')

    @action(detail=True, methods=['post'], url_path='join', permission_classes=[IsAuthenticated])
    def join(self, request, pk=None):
        team = self.get_object()
        if not team.is_active:
            return Response(
                {'detail': 'This team is no longer active.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if TeamMember.objects.filter(team=team, user=request.user).exists():
            return Response(
                {'detail': 'You are already a member of this team.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        member = TeamMember.objects.create(team=team, user=request.user)
        serializer = TeamMemberSerializer(member)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# TeamMemberViewSet
# ---------------------------------------------------------------------------

class TeamMemberViewSet(viewsets.ModelViewSet):
    """Scoped under a team."""

    serializer_class = TeamMemberSerializer

    def get_queryset(self):
        team_pk = self.kwargs.get('team_pk')
        return TeamMember.objects.filter(team_id=team_pk).select_related('user')

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        team = get_object_or_404(Team, pk=self.kwargs['team_pk'])
        serializer.save(team=team)
