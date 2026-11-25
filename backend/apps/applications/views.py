import bleach
from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, status as http, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import AuditLog
from apps.accounts.views import get_client_ip
from apps.accounts.permissions import IsAdminRole

from .models import OpportunityApplication
from apps.notifications.models import Notification

from .ai_screening import DOCS, LABELS, schedule_screening
from .review_rules import CHECKS, CHECK_NEEDS, REJECT_KEYS, ai_in_progress, approval_blockers, rejection_message
from .serializers import ApplicationReviewSerializer, ApplicationSerializer


class ApplicationViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Youth: create and list their own applications. Admins: list all and review (PATCH status/note)."""
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def get_queryset(self):
        qs = OpportunityApplication.objects.all()
        if not IsAdminRole().has_permission(self.request, self):
            qs = qs.filter(applicant=self.request.user)
        kind = self.request.query_params.get('kind')
        st = self.request.query_params.get('status')
        if kind:
            qs = qs.filter(kind=kind)
        if st:
            qs = qs.filter(status=st)
        return qs

    def _open(self, request, key):
        """Serve one private file. When an administrator opens it, that is recorded (opening is NOT verifying)."""
        from apps.accounts.uploads import private_file_response
        app = self.get_object()  # get_queryset already limits non-admins to their own rows
        f = getattr(app, DOCS[key])
        if f and IsAdminRole().has_permission(request, self) and key not in (app.opened_docs or {}):
            app.opened_docs = {**(app.opened_docs or {}), key: timezone.now().isoformat()}
            app.save(update_fields=['opened_docs'])
            self._log(request, app, 'application_requirement_opened', requirement=key)
        return private_file_response(f)

    def _log(self, request, app, action, **details):
        AuditLog.objects.create(
            user=request.user, action=action, model_name='OpportunityApplication', object_id=app.pk,
            ip_address=get_client_ip(request),
            details={'application_id': app.pk, 'administrator_id': request.user.pk if IsAdminRole().has_permission(request, self) else None,
                     'applicant': app.email, 'title': app.title, 'status': app.status, **details},
        )

    @action(detail=True, methods=['get'], url_path='document')
    def document(self, request, pk=None):
        """The resume: the applicant, or an administrator. Login required."""
        return self._open(request, 'resume')

    @action(detail=True, methods=['get'], url_path='id-document')
    def id_document(self, request, pk=None):
        return self._open(request, 'id_front')

    @action(detail=True, methods=['get'], url_path='id-document-back')
    def id_document_back(self, request, pk=None):
        return self._open(request, 'id_back')

    @action(detail=True, methods=['get'], url_path='selfie')
    def selfie(self, request, pk=None):
        return self._open(request, 'selfie')

    @action(detail=True, methods=['post'], url_path='manual-checks')
    def manual_checks(self, request, pk=None):
        """The boxes the administrator ticks BY HAND. A box cannot be ticked for a file that was never opened."""
        app = self.get_object()
        if app.status != 'under_review':
            return Response({'detail': 'Start the review first.'}, status=http.HTTP_400_BAD_REQUEST)
        incoming = request.data.get('checks')
        if not isinstance(incoming, dict):
            return Response({'detail': 'Send the boxes as {"checks": {...}}.'}, status=http.HTTP_400_BAD_REQUEST)
        checks = dict(app.manual_checks or {})
        for name, value in incoming.items():
            if name not in CHECKS:
                continue
            value = value is True or str(value).lower() == 'true'
            if value:
                unopened = [LABELS[k] for k in CHECK_NEEDS[name] if k not in (app.opened_docs or {})]
                if unopened:
                    return Response({'detail': f'Open the {", ".join(unopened)} first.'}, status=http.HTTP_400_BAD_REQUEST)
                if name == 'ai_findings' and ai_in_progress(app):
                    return Response({'detail': 'The AI screening is still running.'}, status=http.HTTP_400_BAD_REQUEST)
            if checks.get(name, False) != value:
                checks[name] = value
                self._log(request, app, 'application_manual_check', check=name, ticked=value)
        app.manual_checks = checks
        app.save(update_fields=['manual_checks'])
        return Response(self.get_serializer(app).data)

    @action(detail=True, methods=['post'], url_path='rescreen')
    def rescreen(self, request, pk=None):
        """Run the AI screening again (for example after it failed or was unavailable)."""
        app = self.get_object()
        if app.kind != 'job' or app.status not in ('submitted', 'under_review'):
            return Response({'detail': 'Only an application still being reviewed can be screened again.'}, status=http.HTTP_400_BAD_REQUEST)
        if ai_in_progress(app):
            return Response({'detail': 'The AI screening is already running.'}, status=http.HTTP_400_BAD_REQUEST)
        app.ai_status, app.ai_started_at = 'pending', timezone.now()
        app.save(update_fields=['ai_status', 'ai_started_at'])
        self._log(request, app, 'application_ai_requested')
        schedule_screening(app.pk)
        return Response(self.get_serializer(app).data)

    @action(detail=True, methods=['post'], url_path='revoke')
    def revoke(self, request, pk=None):
        """Take back an approval when a credible problem is found later. The earlier approval stays in the history."""
        app = self.get_object()
        if app.status != 'approved':
            return Response({'detail': 'Only an approved application can have its approval revoked.'}, status=http.HTTP_400_BAD_REQUEST)
        if request.data.get('confirm') not in (True, 'true', 'True', '1', 1):
            return Response({'detail': 'Confirm that you want to revoke this approval.'}, status=http.HTTP_400_BAD_REQUEST)
        reason = bleach.clean(str(request.data.get('reason') or ''), tags=[], strip=True).strip()[:1000]
        if len(reason) < 10:
            return Response({'detail': 'Write the reason for the revocation (at least 10 characters). The applicant will read it.'}, status=http.HTTP_400_BAD_REQUEST)
        previous = {'approved_at': app.approved_at.isoformat() if app.approved_at else None, 'approved_by': app.approved_by_id,
                    'approval_note': app.admin_note, 'ai_override_note': app.ai_override_note}
        app.status, app.revoked_at, app.revoked_by, app.revocation_reason = 'revoked', timezone.now(), request.user, reason
        app.admin_note = reason
        app.save(update_fields=['status', 'revoked_at', 'revoked_by', 'revocation_reason', 'admin_note'])
        self._log(request, app, 'application_revoked', **{'from': 'approved', 'to': 'revoked', 'reason': reason, 'previous_approval': previous})
        Notification.objects.create(user=app.applicant, title='Application approval revoked',
                                    message=f'The approval of your application for "{app.title}" was revoked. Reason: {reason}',
                                    notification_type='system', link='/my-applications')
        return Response(self.get_serializer(app).data)

    @action(detail=True, methods=['post'], url_path='resubmit')
    def resubmit(self, request, pk=None):
        """The applicant sends the application again after it was not accepted (for example a wrong or unclear ID)."""
        app = self.get_object()
        if app.applicant_id != request.user.id:
            return Response({'detail': 'You can only resubmit your own application.'}, status=http.HTTP_403_FORBIDDEN)
        if app.kind != 'job' or app.status != 'rejected':
            return Response({'detail': 'Only an application that was not accepted can be sent again.'}, status=http.HTTP_400_BAD_REQUEST)
        ser = ApplicationSerializer(app, data=request.data, context=self.get_serializer_context())
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        # the old files are replaced, so none of them is kept without a purpose
        for name in ('id_document', 'id_document_back', 'selfie') + (('document',) if data.get('document') else ()):
            old = getattr(app, name)
            if old:
                old.delete(save=False)
        note = app.admin_note
        names = {**(app.file_names or {}), **self._file_names(request)}
        with transaction.atomic():
            updated = ser.save(status='submitted', previous_note=note, admin_note='', reviewed_at=None,
                               resubmit_count=app.resubmit_count + 1, file_names=names,
                               ai_status='pending', ai_results={}, ai_started_at=timezone.now(), ai_completed_at=None, ai_attempts=0,
                               opened_docs={}, manual_checks={}, ai_override_note='', rejected_items=[], reviewed_by=None)
            AuditLog.objects.create(
                user=request.user, action='application_resubmitted', model_name='OpportunityApplication', object_id=updated.pk,
                ip_address=get_client_ip(request), details={'applicant': updated.email, 'title': updated.title, 'times': updated.resubmit_count},
            )
            schedule_screening(updated.pk)
        return Response(ApplicationSerializer(updated, context=self.get_serializer_context()).data, status=http.HTTP_200_OK)

    @staticmethod
    def _file_names(request):
        out = {}
        for key, field in DOCS.items():
            f = request.FILES.get(field)
            if f:
                out[key] = f.name[:120]
        return out

    def get_permissions(self):
        if self.action in ('update', 'partial_update', 'manual_checks', 'rescreen', 'revoke'):
            return [IsAuthenticated(), IsAdminRole()]
        if self.action in ('create', 'resubmit'):
            from apps.accounts.verification import IsIDVerified
            return [IsAuthenticated(), IsIDVerified()]  # applying needs a verified identity; reading your own applications does not
        return super().get_permissions()

    def update(self, request, *args, **kwargs):
        """Administrator only. The AI never decides: starting the review, approving and refusing are the administrator's acts."""
        instance = self.get_object()
        old = instance.status
        ser = ApplicationReviewSerializer(instance, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        new = ser.validated_data.get('status', old)
        extra = {}
        if new != old:
            if new == 'under_review':
                if old != 'submitted':
                    return Response({'detail': 'Only a submitted application can be put under review.'}, status=http.HTTP_400_BAD_REQUEST)
            elif new == 'approved':
                if old != 'under_review':
                    return Response({'detail': 'Start the review first. An application cannot be approved straight from Submitted.'}, status=http.HTTP_400_BAD_REQUEST)
                override = bleach.clean(str(request.data.get('ai_override_note') or instance.ai_override_note or ''), tags=[], strip=True)[:1000]
                instance.ai_override_note = override
                blockers = approval_blockers(instance)
                if blockers:
                    return Response({'detail': 'This application cannot be approved yet.', 'blockers': blockers}, status=http.HTTP_400_BAD_REQUEST)
                extra.update(approved_at=timezone.now(), approved_by=request.user, ai_override_note=override)
            elif new == 'rejected':
                # Not Accepted is ALWAYS possible while the application is open: documents need not all be opened first.
                if old not in ('submitted', 'under_review'):
                    return Response({'detail': 'Only an application that is still open can be refused.'}, status=http.HTTP_400_BAD_REQUEST)
                items = request.data.get('rejected_items') or []
                if isinstance(items, str):
                    items = [items]
                items = [i for i in items if i in REJECT_KEYS]
                custom = ser.validated_data.get('admin_note', '') or ''
                if not items and len(custom.strip()) < 5:
                    return Response({'detail': 'Choose which requirement is invalid or missing, or write the reason, so the applicant knows why.'}, status=http.HTTP_400_BAD_REQUEST)
                extra.update(admin_note=rejection_message(items, custom)[:1000], rejected_items=items)
            else:
                return Response({'detail': 'That status change is not allowed here. Use Revoke Approval for an approved application.'}, status=http.HTTP_400_BAD_REQUEST)
        app = ser.save(reviewed_at=timezone.now(), reviewed_by=request.user, **extra)
        if app.status != old:
            action_name = {'under_review': 'application_review_started', 'approved': 'application_approved', 'rejected': 'application_rejected'}[app.status]
            self._log(request, app, action_name, **{'from': old, 'to': app.status, 'note': app.admin_note,
                                                     'manual_checks': app.manual_checks, 'ai_status': app.ai_status,
                                                     'ai_override_note': app.ai_override_note, 'rejected_items': app.rejected_items})
            label = {'under_review': 'under review', 'approved': 'approved', 'rejected': 'not accepted'}[app.status]
            Notification.objects.create(
                user=app.applicant,
                title=f'Application {label}',
                message=f'Your application for "{app.title}" is now {label}.' + (f' {app.admin_note}' if app.admin_note and app.status != 'under_review' else ''),
                notification_type='system',
                link='/my-applications',
            )
        else:
            self._log(request, app, 'application_note_edited', note=app.admin_note)
        return Response(self.get_serializer(app).data, status=http.HTTP_200_OK)

    def perform_create(self, serializer):
        with transaction.atomic():
            app = serializer.save(applicant=self.request.user, file_names=self._file_names(self.request), ai_started_at=timezone.now())
            AuditLog.objects.create(
                user=self.request.user, action='application_submitted', model_name='OpportunityApplication', object_id=app.pk,
                ip_address=get_client_ip(self.request),
                details={'application_id': app.pk, 'title': app.title, 'requirements_uploaded': [k for k in DOCS if getattr(app, DOCS[k])]},
            )
            # the application is saved first; the AI works afterwards in the background
            schedule_screening(app.pk)
