from django.db.models import Count, Prefetch, Q
from rest_framework import filters, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsSuperAdmin

from .models import Program, School, SchoolBookmark, SchoolComparison, SchoolProgram
from .serializers import (
    ProgramSerializer,
    SchoolBookmarkSerializer,
    SchoolComparisonSerializer,
    SchoolDetailSerializer,
    SchoolListSerializer,
    SchoolProgramSerializer,
    SchoolWriteSerializer,
)


class SchoolViewSet(viewsets.ModelViewSet):
    """
    list   – public; search by name/program/location, filter by school_type/province/municipality
    retrieve – public; full detail (supports lookup by slug)
    create/update/destroy – super_admin only
    bookmark – toggle bookmark (authenticated)
    compare  – add/remove from personal comparison list (authenticated)
    """

    lookup_field = 'pk'
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        qs = School.objects.filter(is_active=True).prefetch_related(
            'school_programs__program'
        ).annotate(program_count=Count('school_programs', filter=Q(school_programs__is_active=True), distinct=True))

        # Text search across name, program names, municipality, province
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(municipality__icontains=search)
                | Q(province__icontains=search)
                | Q(school_programs__program__name__icontains=search)
            ).distinct()

        # Exact filters
        school_type = self.request.query_params.get('school_type')
        if school_type:
            qs = qs.filter(school_type=school_type)

        province = self.request.query_params.get('province')
        if province:
            qs = qs.filter(province__icontains=province)

        municipality = self.request.query_params.get('municipality')
        if municipality:
            qs = qs.filter(municipality__icontains=municipality)

        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SchoolDetailSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return SchoolWriteSerializer
        return SchoolListSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsSuperAdmin()]
        if self.action in ('bookmark', 'compare'):
            return [IsAuthenticated()]
        return [IsAuthenticatedOrReadOnly()]

    # ------------------------------------------------------------------
    # Actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='bookmark')
    def bookmark(self, request, pk=None):
        """Toggle bookmark for the authenticated user."""
        school = self.get_object()
        bookmark, created = SchoolBookmark.objects.get_or_create(
            user=request.user, school=school
        )
        if not created:
            bookmark.delete()
            return Response({'bookmarked': False, 'message': 'Bookmark removed.'})
        serializer = SchoolBookmarkSerializer(bookmark, context={'request': request})
        return Response(
            {'bookmarked': True, 'bookmark': serializer.data},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='compare')
    def compare(self, request, pk=None):
        """Add or remove a school from the user's comparison list (max 4)."""
        school = self.get_object()
        comparison, _ = SchoolComparison.objects.get_or_create(user=request.user)

        action_type = request.data.get('action', 'add')

        if action_type == 'remove':
            comparison.schools.remove(school)
            serializer = SchoolComparisonSerializer(comparison, context={'request': request})
            return Response({'message': 'School removed from comparison.', 'comparison': serializer.data})

        if comparison.schools.count() >= 4:
            return Response(
                {'detail': 'You can compare at most 4 schools at a time.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comparison.schools.add(school)
        serializer = SchoolComparisonSerializer(comparison, context={'request': request})
        return Response(
            {'message': 'School added to comparison.', 'comparison': serializer.data},
            status=status.HTTP_200_OK,
        )


class ProgramViewSet(viewsets.ModelViewSet):
    """
    list – public
    CRUD – super_admin / LGU admin
    """

    serializer_class = ProgramSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        return Program.objects.all()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsSuperAdmin()]
        return [IsAuthenticatedOrReadOnly()]


class SchoolBookmarkViewSet(viewsets.ReadOnlyModelViewSet):
    """List the authenticated user's own bookmarks."""

    serializer_class = SchoolBookmarkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        annotated_schools = School.objects.annotate(
            program_count=Count('school_programs', filter=Q(school_programs__is_active=True), distinct=True)
        )
        return SchoolBookmark.objects.filter(user=self.request.user).prefetch_related(
            Prefetch('school', queryset=annotated_schools)
        )


class SchoolComparisonView(APIView):
    """
    GET    – return current user's comparison list
    POST   – set comparison list (body: {school_ids: [...]}, max 4)
    DELETE – clear comparison list
    """

    permission_classes = [IsAuthenticated]

    def _get_or_create_comparison(self, user):
        comparison, _ = SchoolComparison.objects.get_or_create(user=user)
        return comparison

    def get(self, request):
        comparison = self._get_or_create_comparison(request.user)
        serializer = SchoolComparisonSerializer(comparison, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        school_ids = request.data.get('school_ids', [])
        if not isinstance(school_ids, list):
            return Response(
                {'detail': 'school_ids must be a list.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(school_ids) > 4:
            return Response(
                {'detail': 'You can compare at most 4 schools at a time.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        schools = School.objects.filter(id__in=school_ids, is_active=True)
        comparison = self._get_or_create_comparison(request.user)
        comparison.schools.set(schools)
        serializer = SchoolComparisonSerializer(comparison, context={'request': request})
        return Response(serializer.data)

    def delete(self, request):
        comparison = self._get_or_create_comparison(request.user)
        comparison.schools.clear()
        return Response({'detail': 'Comparison list cleared.'}, status=status.HTTP_204_NO_CONTENT)


class RecommendSchoolsView(APIView):
    """
    POST {program_name, location}
    Returns schools ranked by program match + location proximity (municipality/province match).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        program_name = request.data.get('program_name', '').strip()
        location = request.data.get('location', '').strip()

        if not program_name:
            return Response(
                {'detail': 'program_name is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Gather candidate schools that offer the requested program
        qs = (
            School.objects.filter(is_active=True)
            .prefetch_related('school_programs__program')
            .annotate(program_count=Count('school_programs', filter=Q(school_programs__is_active=True), distinct=True))
        )

        results = []
        for school in qs:
            score = 0

            # Program match
            program_match = school.school_programs.filter(
                is_active=True,
                program__name__icontains=program_name,
            ).exists()
            if program_match:
                score += 10

            # Location match (municipality > province)
            if location:
                if location.lower() in school.municipality.lower():
                    score += 5
                elif location.lower() in school.province.lower():
                    score += 3

            if score > 0:
                results.append((score, school))

        # Sort by score descending, then alphabetically
        results.sort(key=lambda x: (-x[0], x[1].name))
        ranked_schools = [school for _, school in results]

        serializer = SchoolListSerializer(
            ranked_schools, many=True, context={'request': request}
        )
        return Response(
            {
                'count': len(ranked_schools),
                'program_name': program_name,
                'location': location,
                'results': serializer.data,
            }
        )
