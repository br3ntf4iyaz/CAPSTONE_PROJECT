from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole

from .models import OrgAccomplishment, OrgRequirement, YouthOrganization, ensure_default_requirements
from .serializers import (
    OrgAccomplishmentSerializer,
    OrgDetailSerializer,
    OrgListSerializer,
    OrgRequirementSerializer,
    OrgSubmissionSerializer,
    validate_pdf,
)


# ---------------------------------------------------------------------------
# YouthOrgViewSet
# ---------------------------------------------------------------------------

class YouthOrgViewSet(viewsets.ModelViewSet):
    """
    list/retrieve: public — filter by classification, sub_classification,
                            registration_category, barangay; search by name.
    create/update/destroy: admin only.
    mark_compliant: admin only.
    """

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'created_at', 'barangay']
    ordering = ['name']

    def get_queryset(self):
        qs = YouthOrganization.objects.prefetch_related('accomplishments', 'requirements')

        # Apply query-param filters
        classification = self.request.query_params.get('classification')
        sub_classification = self.request.query_params.get('sub_classification')
        registration_category = self.request.query_params.get('registration_category')
        barangay = self.request.query_params.get('barangay')

        if classification:
            qs = qs.filter(classification=classification)
        if sub_classification:
            qs = qs.filter(sub_classification=sub_classification)
        if registration_category:
            qs = qs.filter(registration_category=registration_category)
        if barangay:
            qs = qs.filter(barangay__icontains=barangay)

        # Non-admin users only see active orgs
        if not (
            self.request.user.is_authenticated
            and IsAdminRole().has_permission(self.request, self)
        ):
            qs = qs.filter(is_active=True)

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return OrgListSerializer
        if self.action == 'create' and not (
            self.request.user.is_authenticated
            and IsAdminRole().has_permission(self.request, self)
        ):
            return OrgSubmissionSerializer
        return OrgDetailSerializer

    def create(self, request, *args, **kwargs):
        if not IsAdminRole().has_permission(request, self):
            try:
                verified = request.user.id_verification.status == 'approved'
            except Exception:
                verified = False
            if not verified:
                return Response(
                    {'detail': 'Identity verification required to register an organization.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        if not IsAdminRole().has_permission(self.request, self):
            org = serializer.save(
                registration_category='not_registered',
                is_active=False,
                status='pending',
                submitted_by=self.request.user,
            )
            ensure_default_requirements(org)
        else:
            serializer.save(status='approved')

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        if self.action in ('create', 'my_submissions', 'upload_requirement'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    @action(detail=False, methods=['get'], url_path='my-submissions', permission_classes=[IsAuthenticated])
    def my_submissions(self, request):
        qs = YouthOrganization.objects.filter(submitted_by=request.user).order_by('-created_at')
        for org in qs:  # also covers organizations submitted before checklists existed
            ensure_default_requirements(org)
        qs = qs.prefetch_related('requirements')
        serializer = OrgSubmissionSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(
        detail=True,
        methods=['post'],
        url_path=r'requirements/(?P<req_id>[0-9]+)/upload',
        permission_classes=[IsAuthenticated],
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def upload_requirement(self, request, pk=None, req_id=None):
        """The organization's submitter uploads a PDF for one required document."""
        org = get_object_or_404(YouthOrganization, pk=pk, submitted_by=request.user)
        req = get_object_or_404(OrgRequirement, pk=req_id, organization=org)
        if org.status == 'rejected':
            return Response(
                {'detail': 'This application was rejected, so documents can no longer be uploaded.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        file = request.FILES.get('file')
        if not file:
            return Response({'file': ['Please choose a PDF file.']}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_pdf(file)
        except DRFValidationError as exc:
            return Response({'file': exc.detail}, status=status.HTTP_400_BAD_REQUEST)
        req.file = file
        req.is_submitted = True
        req.submitted_at = timezone.now()
        req.save()
        return Response({
            'id': req.id, 'name': req.name, 'is_submitted': True,
            'submitted_at': req.submitted_at, 'notes': req.notes,
        })

    # ------------------------------------------------------------------
    # Custom actions
    # ------------------------------------------------------------------

    @action(
        detail=True,
        methods=['post'],
        url_path='mark_compliant',
        permission_classes=[IsAuthenticated, IsAdminRole],
    )
    def mark_compliant(self, request, pk=None):
        org = self.get_object()
        org.is_compliant = True
        org.save(update_fields=['is_compliant', 'updated_at'])
        serializer = OrgDetailSerializer(org, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# OrgAccomplishmentViewSet
# ---------------------------------------------------------------------------

class OrgAccomplishmentViewSet(viewsets.ModelViewSet):
    """
    Nested under YouthOrganization.
    list/retrieve: public.
    create/update/destroy: admin only.
    """

    serializer_class = OrgAccomplishmentSerializer

    def get_queryset(self):
        org_pk = self.kwargs.get('org_pk')
        qs = OrgAccomplishment.objects.select_related('organization')
        if org_pk:
            qs = qs.filter(organization_id=org_pk)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        org_pk = self.kwargs.get('org_pk')
        serializer.save(organization_id=org_pk)


# ---------------------------------------------------------------------------
# OrgRequirementViewSet
# ---------------------------------------------------------------------------

class OrgRequirementViewSet(viewsets.ModelViewSet):
    """
    Nested under YouthOrganization.
    All actions: admin only.
    Accepts file uploads — PDF only, max 10 MB.
    """

    serializer_class = OrgRequirementSerializer

    def get_queryset(self):
        org_pk = self.kwargs.get('org_pk')
        qs = OrgRequirement.objects.select_related('organization')
        if org_pk:
            qs = qs.filter(organization_id=org_pk)
        return qs

    def get_permissions(self):
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        org_pk = self.kwargs.get('org_pk')
        submitted_at = None
        if serializer.validated_data.get('is_submitted'):
            submitted_at = timezone.now()
        serializer.save(organization_id=org_pk, submitted_at=submitted_at)

    def perform_update(self, serializer):
        instance = self.get_object()
        is_submitted = serializer.validated_data.get('is_submitted', instance.is_submitted)
        submitted_at = instance.submitted_at
        if is_submitted and not instance.is_submitted:
            submitted_at = timezone.now()
        serializer.save(submitted_at=submitted_at)
