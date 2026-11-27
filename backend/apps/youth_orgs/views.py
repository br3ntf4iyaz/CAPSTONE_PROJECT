from django.shortcuts import get_object_or_404
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole
from apps.notifications.views import create_notification

from . import membership
from .models import OrgAccomplishment, OrgMembershipApplication, OrgRequirement, YouthOrganization, ensure_default_requirements
from .serializers import (
    OrgAccomplishmentSerializer,
    OrgDetailSerializer,
    OrgListSerializer,
    OrgMembershipApplicationSerializer,
    OrgPublicDetailSerializer,
    OrgPublicListSerializer,
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

        # Everyone who is not an administrator sees only PUBLIC organizations: approved by LYDO and active.
        # Pending, rejected, inactive (private) organizations are never listed, whatever the account.
        if not (
            self.request.user.is_authenticated
            and IsAdminRole().has_permission(self.request, self)
        ):
            qs = qs.filter(is_active=True, status='approved')
        accepting = self.request.query_params.get('accepting')
        if accepting is not None:
            qs = qs.filter(accepting_members=accepting.lower() in ('1', 'true', 'yes'))

        return qs

    def _is_admin(self):
        return self.request.user.is_authenticated and IsAdminRole().has_permission(self.request, self)

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve') and not self._is_admin():
            return OrgPublicListSerializer if self.action == 'list' else OrgPublicDetailSerializer
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
        if self.action in ('create', 'my_submissions', 'upload_requirement', 'apply', 'my_applications', 'applications', 'decide_application'):
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
    # Membership applications (sign-in required)
    # ------------------------------------------------------------------

    def _manages(self, user, org):
        return IsAdminRole().has_permission(self.request, self) or (org.submitted_by_id is not None and org.submitted_by_id == user.id)

    def _audit(self, request, action_name, org, **details):
        from apps.accounts.models import AuditLog
        from apps.accounts.views import get_client_ip
        AuditLog.objects.create(user=request.user, action=action_name, model_name='YouthOrganization', object_id=org.pk,
                                ip_address=get_client_ip(request), details={'organization': org.name, **details})

    @action(detail=True, methods=['post'], url_path='apply', permission_classes=[IsAuthenticated])
    def apply(self, request, pk=None):
        """A signed-in young person asks to join a public organization that is accepting members."""
        org = self.get_object()  # only public organizations can be reached here by non-admins
        user = request.user
        if getattr(user, 'role', '') != 'youth':
            return Response({'detail': 'Only youth accounts can apply for membership.'}, status=status.HTTP_403_FORBIDDEN)
        if org.submitted_by_id == user.id:
            return Response({'detail': 'You already manage this organization.'}, status=status.HTTP_400_BAD_REQUEST)
        if not org.accepting_members:
            return Response({'detail': 'This organization is not accepting new members right now.'}, status=status.HTTP_400_BAD_REQUEST)
        if org.application_mode != 'in_app':
            return Response({
                'detail': 'This organization takes applications on its own. Use its link or contact it directly.',
                'code': 'external_application', 'external_apply_url': org.external_apply_url,
            }, status=status.HTTP_400_BAD_REQUEST)
        existing = OrgMembershipApplication.objects.filter(organization=org, applicant=user).first()
        if existing is not None and existing.status not in ('revision', 'declined'):
            return Response({'detail': 'You already applied to this organization.'}, status=status.HTTP_400_BAD_REQUEST)
        # only a verified account may apply (the 403 carries code verify_first and the person's status, so the app can guide them)
        from apps.accounts.verification import IsIDVerified
        IsIDVerified().has_permission(request, self)
        if str(request.data.get('consent', '')).lower() not in ('true', '1'):
            return Response({'detail': 'Please agree to the privacy notice before you send the application.', 'code': 'consent_required'}, status=status.HTTP_400_BAD_REQUEST)
        message = sanitize(str(request.data.get('message', '')).strip())[:500]
        try:
            snapshot = membership.snapshot_from(user, request.data)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            if existing is not None:
                from_status = existing.status
                existing.message, existing.privacy_consent_at = message, timezone.now()
                existing.snapshot = snapshot
                existing.status, existing.decision_note = 'pending', ''
                existing.save()
                membership.record(existing, 'resubmitted', user, from_status)
                app = existing
            else:
                app = OrgMembershipApplication.objects.create(
                    organization=org, applicant=user, message=message,
                    privacy_consent_at=timezone.now(), snapshot=snapshot,
                )
                membership.record(app, 'submitted', user)
        self._audit(request, 'org_membership_applied', org, application=app.pk, reference=app.reference_number)
        try:  # the applicant is told it was received; the decision follows in another notification
            create_notification(user, 'Membership application sent',
                                f'Your application to join "{org.name}" ({app.reference_number}) was sent. You will be notified when it is reviewed.', 'system', link='/organizations')
        except Exception:
            pass
        text = f'{user.full_name or user.email} applied to join "{org.name}".'
        try:
            if org.submitted_by_id:  # the leader who registered the organization decides
                create_notification(org.submitted_by, 'New membership application', text, 'system', link=f'/organizations?org={org.pk}')
            else:
                # an organization entered by LYDO has no officer account yet, so LYDO looks after its applications
                from django.contrib.auth import get_user_model
                for admin in get_user_model().objects.filter(role__in=['lgu_admin', 'super_admin'], is_active=True):
                    create_notification(admin, 'New membership application', text, 'system', link='/admin/membership')
        except Exception:
            pass
        return Response(OrgMembershipApplicationSerializer(app).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my-applications', permission_classes=[IsAuthenticated])
    def my_applications(self, request):
        qs = OrgMembershipApplication.objects.filter(applicant=request.user).select_related('organization')
        return Response(OrgMembershipApplicationSerializer(qs, many=True, context={'is_admin': True}).data)

    @action(detail=True, methods=['get'], url_path='applications', permission_classes=[IsAuthenticated])
    def applications(self, request, pk=None):
        """Membership applications of THIS organization: only the person who registered it, or LYDO."""
        org = get_object_or_404(YouthOrganization, pk=pk)
        if not self._manages(request.user, org):
            return Response({'detail': 'Only the organization leader or LYDO can see the applications.'}, status=status.HTTP_403_FORBIDDEN)
        qs = org.membership_applications.select_related('applicant', 'organization').prefetch_related('events')
        return Response(OrgMembershipApplicationSerializer(qs, many=True, context={'is_admin': IsAdminRole().has_permission(request, self)}).data)

    @action(detail=True, methods=['post'], url_path='decide-application', permission_classes=[IsAuthenticated])
    def decide_application(self, request, pk=None):
        org = get_object_or_404(YouthOrganization, pk=pk)
        if not self._manages(request.user, org):
            return Response({'detail': 'Only the organization leader or LYDO can decide.'}, status=status.HTTP_403_FORBIDDEN)
        app = get_object_or_404(OrgMembershipApplication, pk=request.data.get('application') or 0, organization=org)
        new = request.data.get('status')
        if new not in membership.ALLOWED_FROM:
            return Response({'detail': 'Choose a valid decision.'}, status=status.HTTP_400_BAD_REQUEST)
        is_lydo = IsAdminRole().has_permission(request, self)
        if new == 'revoked' and not is_lydo:
            return Response({'detail': 'Only LYDO can revoke a membership.'}, status=status.HTTP_403_FORBIDDEN)
        ok, problem = membership.can_decide(app, new)
        if not ok:
            return Response({'detail': problem}, status=status.HTTP_400_BAD_REQUEST)
        note = sanitize(str(request.data.get('note', '')).strip())[:500]
        if new in membership.NEEDS_NOTE and len(note) < 5:
            return Response({'detail': 'Write a short reason, so the applicant knows why.'}, status=status.HTTP_400_BAD_REQUEST)
        if new in ('accepted',):
            from apps.accounts.verification import is_id_verified
            if not is_id_verified(app.applicant):  # the person was suspended or lost the badge while waiting
                return Response({'detail': 'This person is no longer verified, so the application cannot be approved.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            membership.decide(app, new, request.user, note)
        self._audit(request, 'org_membership_decided', org, application=app.pk, decision=new, reference=app.reference_number)
        return Response(OrgMembershipApplicationSerializer(app, context={'is_admin': is_lydo}).data)

    @action(detail=True, methods=['post'], url_path='delete-application', permission_classes=[IsAuthenticated, IsAdminRole])
    def delete_application(self, request, pk=None):
        """LYDO removes a REJECTED application for good (the audit log keeps who did it). The person may apply again."""
        org = get_object_or_404(YouthOrganization, pk=pk)
        app = get_object_or_404(OrgMembershipApplication, pk=request.data.get('application') or 0, organization=org)
        if app.status != 'declined':
            return Response({'detail': 'Only a rejected application can be deleted.'}, status=status.HTTP_400_BAD_REQUEST)
        info = {'reference': app.reference_number, 'applicant': app.applicant.email, 'note': app.decision_note}
        app.delete()
        self._audit(request, 'org_membership_deleted', org, **info)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='membership-applications', permission_classes=[IsAuthenticated, IsAdminRole])
    def all_membership_applications(self, request):
        """LYDO's Organization Membership Verification list: every application, newest first."""
        qs = OrgMembershipApplication.objects.select_related('organization', 'applicant').prefetch_related('events')
        wanted = request.query_params.get('status')
        if wanted:
            qs = qs.filter(status=wanted)
        return Response(OrgMembershipApplicationSerializer(qs, many=True, context={'is_admin': True}).data)

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
        # the public sees the achievements of public organizations only
        if not (self.request.user.is_authenticated and IsAdminRole().has_permission(self.request, self)):
            qs = qs.filter(organization__is_active=True, organization__status='approved')
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
