from django.db.models import Count, Prefetch, Q
from rest_framework import filters, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole, IsSuperAdmin

from .models import Program, School, SchoolBookmark, SchoolComparison, SchoolOffering, SchoolProgram
from .serializers import (
    ProgramSerializer,
    AdminSchoolProgramSerializer,
    CourseSearchSerializer,
    OfferingSerializer,
    SchoolBookmarkSerializer,
    SchoolComparisonSerializer,
    SchoolDetailSerializer,
    SchoolListSerializer,
    SchoolProgramSerializer,
    SchoolWriteSerializer,
)


class SchoolPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 200


class SchoolViewSet(viewsets.ModelViewSet):
    """
    list   – public; search by name/program/location, filter by school_type/province/municipality
    retrieve – public; full detail (supports lookup by slug)
    create/update/destroy – super_admin only
    bookmark – toggle bookmark (authenticated)
    compare  – add/remove from personal comparison list (authenticated)
    """

    lookup_field = 'pk'
    pagination_class = SchoolPagination
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        user = self.request.user
        is_admin = user.is_authenticated and getattr(user, 'role', None) in ('lgu_admin', 'super_admin')
        # an administrator can open an archived school to edit or restore it, and list the archived ones
        if is_admin and (self.action != 'list' or self.request.query_params.get('archived') in ('1', 'true')):
            base = School.objects.all() if self.action != 'list' else School.objects.filter(is_active=False)
        else:
            base = School.objects.filter(is_active=True)
        qs = base.prefetch_related(
            'school_programs__program', 'offerings'
        ).annotate(program_count=Count('school_programs', filter=Q(school_programs__is_active=True, school_programs__verification_status='verified'), distinct=True))

        # A visitor can find a school by its name or place, but not by the courses it offers: the courses need an account.
        signed_in = self.request.user.is_authenticated

        # Text search across name, program names (signed in only), municipality, province
        search = self.request.query_params.get('search', '').strip()
        if search:
            cond = (
                Q(name__icontains=search)
                | Q(municipality__icontains=search)
                | Q(address__icontains=search)
                | Q(description__icontains=search)
                | Q(province__icontains=search)
                | Q(barangay__icontains=search)
            )
            # a word like "public", "private" or "TESDA" finds schools by classification
            word = search.lower()
            kinds = {'public': ['public'], 'private': ['private', 'technical_vocational'],
                     'suc': ['state_university'], 'state university': ['state_university']}
            if word in kinds:
                cond = cond | Q(school_type__in=kinds[word])
            if 'tesda' in word:
                cond = cond | Q(tesda_provider=True)
            if 'tech-voc' in word or 'techvoc' in word or 'tvl' in word:
                cond = cond | Q(offers_tvl=True)
            if signed_in:
                cond = (cond
                        | Q(offerings__name__icontains=search, offerings__verification_status='verified')
                        | Q(offerings__code__icontains=search, offerings__verification_status='verified'))
            if signed_in:
                cond = (cond
                        | Q(school_programs__program__name__icontains=search, school_programs__verification_status='verified')
                        | Q(school_programs__program__field_of_study__icontains=search, school_programs__verification_status='verified'))
            qs = qs.filter(cond).distinct()

        # Exact filters
        school_type = self.request.query_params.get('school_type')
        if school_type:
            qs = qs.filter(school_type=school_type)
        # Senior High finder: SUC / Public / Private (a technical-vocational school counts as private)
        sector = self.request.query_params.get('sector')
        if sector in ('suc', 'public', 'private'):
            qs = qs.filter(school_type__in={'suc': ['state_university'], 'public': ['public'], 'private': ['private', 'technical_vocational']}[sector])
        # Tech-Voc (the TVL track of Senior High) and TESDA (training programs) are two separate filters
        if self.request.query_params.get('tvl') in ('1', 'true'):
            qs = qs.filter(offers_tvl=True)
        if self.request.query_params.get('tesda') in ('1', 'true'):
            qs = qs.filter(tesda_provider=True)
        level = self.request.query_params.get('level')  # the level the applicant is in, for the scholarship form
        if level == 'senior_high':
            # a school that explains where its Senior High School is (SLSU Lucena) is listed too, with that note
            qs = qs.filter(Q(offers_senior_high=True) | ~Q(shs_note=''))
        elif level == 'college':
            qs = qs.filter(offers_college=True)
        elif level == 'tesda':
            # the TESDA / TVET list: every TESDA training provider, including the centers that teach nothing else
            qs = qs.filter(Q(tesda_provider=True) | Q(offers_tvet=True))

        field = self.request.query_params.get('field_of_study') if signed_in else None
        if field:
            qs = qs.filter(
                school_programs__program__field_of_study=field,
                school_programs__verification_status='verified',
                school_programs__is_active=True,
            ).distinct()

        ptype = self.request.query_params.get('program_type') if signed_in else None
        if ptype:
            qs = qs.filter(
                school_programs__program__program_type=ptype,
                school_programs__verification_status='verified',
                school_programs__is_active=True,
            ).distinct()

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


    def _log(self, action_name, school, changed=''):
        from apps.accounts.models import AuditLog
        AuditLog.objects.create(user=self.request.user, action=action_name, model_name='School', object_id=school.pk,
                                details={'school': school.name, 'changed': changed})

    def perform_create(self, serializer):
        school = serializer.save()
        self._log('create', school)

    def perform_update(self, serializer):
        before = {f: getattr(serializer.instance, f) for f in serializer.validated_data if f != 'logo'}
        school = serializer.save()
        changed = ', '.join(f for f, v in before.items() if getattr(school, f) != v)
        if changed:
            if school.info_status == 'verified' and 'info_status' in changed:
                from django.utils import timezone
                school.last_verified_at = timezone.now()
                school.save(update_fields=['last_verified_at'])
            self._log('update', school, changed)


class SchoolOfferingViewSet(viewsets.ModelViewSet):
    """The SHS strands and TESDA qualifications of a school, kept by LYDO administrators (verified or pending)."""

    serializer_class = OfferingSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None

    def get_queryset(self):
        qs = SchoolOffering.objects.all()
        school = self.request.query_params.get('school')
        return qs.filter(school_id=school) if school else qs

    def perform_create(self, serializer):
        self._stamp(serializer.save())

    def perform_update(self, serializer):
        self._stamp(serializer.save())

    def _stamp(self, obj):
        from django.utils import timezone
        want = timezone.now() if obj.verification_status == 'verified' else None
        if (obj.verified_at is None) != (want is None):
            obj.verified_at = want
            obj.save(update_fields=['verified_at'])


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
        return [IsAuthenticated()]  # the program catalogue is part of the courses, so it needs an account


class SchoolBookmarkViewSet(viewsets.ReadOnlyModelViewSet):
    """List the authenticated user's own bookmarks."""

    serializer_class = SchoolBookmarkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        annotated_schools = School.objects.annotate(
            program_count=Count('school_programs', filter=Q(school_programs__is_active=True, school_programs__verification_status='verified'), distinct=True)
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
            .annotate(program_count=Count('school_programs', filter=Q(school_programs__is_active=True, school_programs__verification_status='verified'), distinct=True))
        )

        results = []
        for school in qs:
            score = 0

            # Program match
            program_match = school.school_programs.filter(
                is_active=True,
                verification_status='verified',
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


class CourseSearchView(APIView):
    """
    GET /api/schools/courses/  - search over VERIFIED programs. Signed-in users only: visitors may browse the schools,
    but the courses each school offers need an account.
    Query params: search, school_type, school (id), field_of_study, program_type
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            SchoolProgram.objects.filter(is_active=True, verification_status='verified', school__is_active=True)
            .select_related('school', 'program')
            .order_by('school__name', 'program__name')
        )
        p = request.query_params
        search = p.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(program__name__icontains=search)
                | Q(program__description__icontains=search)
                | Q(school__name__icontains=search)
            )
        if p.get('school_type'):
            qs = qs.filter(school__school_type=p['school_type'])
        if p.get('school'):
            qs = qs.filter(school_id=p['school'])
        if p.get('field_of_study'):
            qs = qs.filter(program__field_of_study=p['field_of_study'])
        if p.get('program_type'):
            qs = qs.filter(program__program_type=p['program_type'])
        total = qs.count()
        data = CourseSearchSerializer(qs[:300], many=True, context={'request': request}).data
        return Response({'count': total, 'results': data})


class AdminSchoolProgramViewSet(viewsets.ModelViewSet):
    """Admin management of a school's courses: add, edit, verify, remove."""

    serializer_class = AdminSchoolProgramSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None

    def get_queryset(self):
        qs = SchoolProgram.objects.select_related('school', 'program').order_by('program__field_of_study', 'program__name')
        school = self.request.query_params.get('school')
        if school:
            qs = qs.filter(school_id=school)
        status = self.request.query_params.get('verification_status')
        if status:
            qs = qs.filter(verification_status=status)
        return qs
