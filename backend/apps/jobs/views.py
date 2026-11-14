from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole

from .models import JobOpportunity, SavedJob
from .serializers import JobDetailSerializer, JobListSerializer


class JobViewSet(viewsets.ModelViewSet):
    """
    list: public — active jobs only; filter by job_type, industry; search by title/location/company.
    retrieve: public.
    create/update/destroy: admin only.
    """

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'company_or_org', 'location']
    ordering_fields = ['title', 'created_at', 'application_deadline', 'is_featured']
    ordering = ['-is_featured', '-created_at']

    def get_queryset(self):
        qs = JobOpportunity.objects.select_related('posted_by')

        is_admin = (
            self.request.user.is_authenticated
            and IsAdminRole().has_permission(self.request, self)
        )

        # Non-admin users only see active jobs
        if not is_admin:
            qs = qs.filter(is_active=True)

        # Filter by query params
        job_type = self.request.query_params.get('job_type')
        industry = self.request.query_params.get('industry')
        location = self.request.query_params.get('location')

        if job_type:
            qs = qs.filter(job_type=job_type)
        if industry:
            qs = qs.filter(industry=industry)
        if location:
            qs = qs.filter(location__icontains=location)

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return JobListSerializer
        return JobDetailSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        if self.action in ('save_toggle', 'saved_jobs'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        serializer.save(posted_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='save-toggle',
            permission_classes=[IsAuthenticated])
    def save_toggle(self, request, pk=None):
        """Toggle bookmark (save/unsave) for the authenticated user."""
        job = self.get_object()
        saved, created = SavedJob.objects.get_or_create(user=request.user, job=job)
        if not created:
            saved.delete()
            return Response({'saved': False, 'message': 'Job removed from saved.'})
        return Response({'saved': True, 'message': 'Job saved.'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='saved',
            permission_classes=[IsAuthenticated])
    def saved_jobs(self, request):
        """List jobs saved by the current user."""
        job_ids = SavedJob.objects.filter(user=request.user).values_list('job_id', flat=True)
        qs = JobOpportunity.objects.filter(id__in=job_ids, is_active=True)
        serializer = JobListSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)
