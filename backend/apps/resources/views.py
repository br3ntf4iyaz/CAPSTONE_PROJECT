from django.db.models import F
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole

from .models import Resource, Scholarship
from .serializers import ResourceSerializer, ScholarshipSerializer


class ScholarshipViewSet(viewsets.ModelViewSet):
    serializer_class = ScholarshipSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'provider', 'description']
    ordering_fields = ['created_at', 'title']
    ordering = ['-is_featured', 'title']

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and hasattr(user, 'role') and user.role in ('lgu_admin', 'super_admin'):
            qs = Scholarship.objects.all()
        else:
            qs = Scholarship.objects.filter(is_published=True)

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)

        featured = self.request.query_params.get('is_featured')
        if featured in ('true', '1'):
            qs = qs.filter(is_featured=True)

        return qs

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdminRole()]
        return [AllowAny()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ResourceViewSet(viewsets.ModelViewSet):
    """
    list     – published resources; search by title/description, filter by category/resource_type
    retrieve – any authenticated user; no download_count increment here
    create/update/destroy – admin only
    download – action that increments download_count and returns file URL
    """

    serializer_class = ResourceSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description']
    ordering_fields = ['title', 'created_at', 'download_count']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user

        # Admins see all resources; everyone else sees only published
        if user.is_authenticated and hasattr(user, 'role') and user.role in ('lgu_admin', 'super_admin'):
            qs = Resource.objects.all()
        else:
            qs = Resource.objects.filter(is_published=True)

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)

        resource_type = self.request.query_params.get('resource_type')
        if resource_type:
            qs = qs.filter(resource_type=resource_type)

        featured = self.request.query_params.get('featured')
        if featured in ('true', '1'):
            qs = qs.filter(is_featured=True)

        return qs

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdminRole()]
        if self.action == 'download':
            return [IsAuthenticated()]
        return [IsAuthenticatedOrReadOnly()]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, pk=None):
        """Increment download_count and return the file URL (or external_url for links)."""
        resource = self.get_object()

        # Atomically increment download count
        Resource.objects.filter(pk=resource.pk).update(download_count=F('download_count') + 1)
        resource.refresh_from_db(fields=['download_count'])

        file_url = None
        if resource.file:
            file_url = request.build_absolute_uri(resource.file.url)
        elif resource.external_url:
            file_url = resource.external_url

        if not file_url:
            return Response(
                {'detail': 'No file or external URL available for this resource.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                'resource_id': resource.pk,
                'title': resource.title,
                'download_count': resource.download_count,
                'file_url': file_url,
            }
        )
