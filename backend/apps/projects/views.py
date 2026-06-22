from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole, IsYouth

from .models import (
    Project,
    ProjectComment,
    ProjectMember,
    ProjectResource,
    Task,
    Milestone,
)
from .serializers import (
    MilestoneSerializer,
    ProjectCommentSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectMemberSerializer,
    ProjectResourceSerializer,
    TaskSerializer,
)


# ---------------------------------------------------------------------------
# ProjectViewSet
# ---------------------------------------------------------------------------

class ProjectViewSet(viewsets.ModelViewSet):
    """
    list: public projects visible to all; non-public only to members/admins.
    create: youth or admin users.
    update/destroy: admin only.
    join / leave / submit_proposal: authenticated users.
    """

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'category']
    ordering_fields = ['created_at', 'title', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = Project.objects.filter(is_deleted=False).select_related('created_by').prefetch_related(
            'members', 'tasks', 'milestones'
        ).annotate(member_count=Count('members', distinct=True))
        user = self.request.user
        if user.is_authenticated and IsAdminRole().has_permission(self.request, self):
            return qs
        if user.is_authenticated:
            return qs.filter(is_public=True) | qs.filter(members__user=user)
        return qs.filter(is_public=True)

    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        return ProjectDetailSerializer

    def get_permissions(self):
        if self.action == 'list':
            return [AllowAny()]
        if self.action == 'retrieve':
            return [AllowAny()]
        if self.action == 'create':
            return [IsAuthenticated()]
        if self.action in ('join', 'leave', 'submit_proposal'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    # ------------------------------------------------------------------
    # Custom actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='join', permission_classes=[IsAuthenticated])
    def join(self, request, pk=None):
        project = self.get_object()
        if ProjectMember.objects.filter(project=project, user=request.user).exists():
            return Response(
                {'detail': 'You are already a member of this project.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        member = ProjectMember.objects.create(
            project=project,
            user=request.user,
            role='member',
        )
        serializer = ProjectMemberSerializer(member)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='leave', permission_classes=[IsAuthenticated])
    def leave(self, request, pk=None):
        project = self.get_object()
        membership = ProjectMember.objects.filter(project=project, user=request.user).first()
        if not membership:
            return Response(
                {'detail': 'You are not a member of this project.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        membership.delete()
        return Response({'detail': 'You have left the project.'}, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['post'],
        url_path='submit-proposal',
        permission_classes=[IsAuthenticated],
    )
    def submit_proposal(self, request, pk=None):
        project = self.get_object()
        if project.status != 'proposed':
            return Response(
                {'detail': 'Only projects in proposed status can be submitted for review.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project.status = 'under_review'
        project.save(update_fields=['status', 'updated_at'])
        serializer = ProjectDetailSerializer(project, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# ProjectMemberViewSet
# ---------------------------------------------------------------------------

class ProjectMemberViewSet(viewsets.ModelViewSet):
    """Scoped under a project."""

    serializer_class = ProjectMemberSerializer

    def get_queryset(self):
        project_pk = self.kwargs.get('project_pk')
        return ProjectMember.objects.filter(project_id=project_pk).select_related('user')

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project)


# ---------------------------------------------------------------------------
# TaskViewSet
# ---------------------------------------------------------------------------

class TaskViewSet(viewsets.ModelViewSet):
    """Scoped under a project; filterable by status and assigned_to."""

    serializer_class = TaskSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['due_date', 'priority', 'status', 'created_at']
    ordering = ['priority', 'due_date']

    def get_queryset(self):
        project_pk = self.kwargs.get('project_pk')
        qs = Task.objects.filter(project_id=project_pk).select_related('assigned_to')
        status_filter = self.request.query_params.get('status')
        assigned_filter = self.request.query_params.get('assigned_to')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if assigned_filter:
            qs = qs.filter(assigned_to_id=assigned_filter)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project)


# ---------------------------------------------------------------------------
# MilestoneViewSet
# ---------------------------------------------------------------------------

class MilestoneViewSet(viewsets.ModelViewSet):
    """Scoped under a project."""

    serializer_class = MilestoneSerializer

    def get_queryset(self):
        project_pk = self.kwargs.get('project_pk')
        return Milestone.objects.filter(project_id=project_pk)

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project)


# ---------------------------------------------------------------------------
# ProjectResourceViewSet
# ---------------------------------------------------------------------------

class ProjectResourceViewSet(viewsets.ModelViewSet):
    """Scoped under a project."""

    serializer_class = ProjectResourceSerializer

    def get_queryset(self):
        project_pk = self.kwargs.get('project_pk')
        return ProjectResource.objects.filter(project_id=project_pk).select_related('uploaded_by')

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        if self.action == 'create':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project, uploaded_by=self.request.user)


# ---------------------------------------------------------------------------
# ProjectCommentViewSet
# ---------------------------------------------------------------------------

class ProjectCommentViewSet(viewsets.ModelViewSet):
    """Scoped under a project."""

    serializer_class = ProjectCommentSerializer

    def get_queryset(self):
        project_pk = self.kwargs.get('project_pk')
        # Return only top-level comments; replies are nested inside each comment
        return (
            ProjectComment.objects.filter(project_id=project_pk, parent__isnull=True)
            .select_related('author')
            .prefetch_related('replies__author')
        )

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        if self.action == 'create':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project, author=self.request.user)
