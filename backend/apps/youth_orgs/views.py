from django.shortcuts import get_object_or_404
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole
from apps.notifications.views import create_notification

from .models import OrgAccomplishment, OrgRequirement, YouthOrganization, ensure_default_requirements
from .serializers import (
    OrgAccomplishmentSerializer,
    OrgDetailSerializer,
    OrgListSerializer,
    OrgRequirementSerializer,
    OrgSubmissionSerializer,
    sanitize,
    validate_pdf,
)


# ---------------------------------------------------------------------------
# Decision notifications
# ---------------------------------------------------------------------------

NL = chr(10)


def _notify_decision(org, approved):
    """Tell the submitter (in-app and by email) how their YORP application turned out."""
    if approved:
        title = 'Your organization was approved'
        body = (
            f'Good news! "{org.name}" is now registered in the LYDO youth organization directory.'
        )
    else:
        title = 'Your organization application was not approved'
        body = f'"{org.name}" was not approved at this time.'
    if org.admin_notes:
        body += NL + NL + f'Note from LYDO: {org.admin_notes}'

    if org.submitted_by_id:
        try:
            create_notification(org.submitted_by, title, body, 'system', link='/organizations')
        except Exception:  # never let a notification failure undo the decision
            pass
    recipient = org.contact_email or getattr(org.submitted_by, 'email', '')
    if recipient:
        try:
            send_mail(
                f'[LYDO] {title}', body + NL + NL + '- LYDO Team',
                getattr(settings, 'DEFAULT_FROM_EMAIL', None), [recipient], fail_silently=True,
            )
        except Exception:
            pass


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

    # The registry is small and the admin page needs every organization (incl. pending
    # applications), so return them all instead of the default 20 per page.
    pagination_class = None
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

    def _decide(self, request, approved):
        org = self.get_object()
        notes = sanitize(str(request.data.get('admin_notes', '')).strip())
        if not approved and not notes:
            return Response(
                {'admin_notes': ['Please explain why the application is not approved.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if approved:
            category = request.data.get('registration_category') or 'lydo'
            if category not in dict(YouthOrganization.REG_CHOICES):
                return Response(
                    {'registration_category': ['Invalid registration category.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            org.registration_category = category
        org.status = 'approved' if approved else 'rejected'
        org.is_active = approved
        org.admin_notes = notes
        org.save()  # the ledger signal fingerprints the decision
        _notify_decision(org, approved)
        return Response(OrgDetailSerializer(org, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='approve', permission_classes=[IsAuthenticated, IsAdminRole])
    def approve(self, request, pk=None):
        """POST /youth-orgs/<id>/approve/ {admin_notes?, registration_category?}"""
        return self._decide(request, approved=True)

    @action(detail=True, methods=['post'], url_path='reject', permission_classes=[IsAuthenticated, IsAdminRole])
    def reject(self, request, pk=None):
        """POST /youth-orgs/<id>/reject/ {admin_notes}: the reason is required."""
        return self._decide(request, approved=False)

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
