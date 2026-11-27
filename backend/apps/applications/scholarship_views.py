import secrets

import bleach
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status as http, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from apps.accounts.models import AuditLog, User
from apps.accounts.permissions import IsAdminRole
from apps.accounts.uploads import private_file_response
from apps.accounts.views import get_client_ip
from apps.notifications.models import Notification
from apps.resources.models import Scholarship

from .documents import DOCUMENT_TYPES
from .models import ScholarshipApplication, ScholarshipApplicationDocument
from .scholarship_logic import application_state, document_requirements
from .scholarship_serializers import (
    ScholarshipApplicationSerializer, ScholarshipReviewSerializer, collect_documents, id_details, parse_form_data,
)

OPEN_STATES = ('open', 'closing_soon')
WITHDRAWABLE = ('submitted', 'under_review', 'for_compliance')
ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


class ScholarshipApplyThrottle(SimpleRateThrottle):
    scope = 'scholarship_apply'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': request.user.pk}


def _new_reference():
    for _ in range(10):
        ref = f"SCH-{timezone.localdate().year}-{''.join(secrets.choice(ALPHABET) for _ in range(6))}"
        if not ScholarshipApplication.objects.filter(reference_number=ref).exists():
            return ref
    raise RuntimeError('Could not generate a reference number.')


def _is_admin(request, view):
    return IsAdminRole().has_permission(request, view)


def _notify(user, title, message):
    Notification.objects.create(user=user, title=title, message=message, notification_type='system', link='/my-applications')


class ScholarshipApplicationViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                                    viewsets.GenericViewSet):
    """Applicants create and follow their own applications. Admins list, review and update every application."""

    serializer_class = ScholarshipApplicationSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def get_queryset(self):
        qs = ScholarshipApplication.objects.select_related('applicant').prefetch_related('documents')
        if not _is_admin(self.request, self):
            qs = qs.filter(applicant=self.request.user)
        p = self.request.query_params
        if p.get('scholarship'):
            qs = qs.filter(scholarship_id=p['scholarship'])
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('q'):
            from django.db.models import Q
            q = p['q'].strip()
            qs = qs.filter(Q(reference_number__icontains=q) | Q(applicant__email__icontains=q) | Q(personal__full_name__icontains=q))
        return qs

    def get_throttles(self):
        return [ScholarshipApplyThrottle()] if self.action in ('create', 'comply') else []

    def get_permissions(self):
        if self.action == 'create':
            from apps.accounts.verification import IsIDVerified
            return [IsAuthenticated(), IsIDVerified()]  # applying needs a verified identity
        return super().get_permissions()

    # ── apply ────────────────────────────────────────────────────────────
    def create(self, request, *args, **kwargs):
        scholarship = Scholarship.objects.filter(pk=request.data.get('scholarship') or 0, is_published=True).first()
        if not scholarship:
            raise ValidationError({'detail': 'That scholarship is no longer available.'})
        if application_state(scholarship) not in OPEN_STATES:
            raise ValidationError({'detail': 'Applications for this scholarship are not open.'})
        existing = ScholarshipApplication.objects.filter(applicant=request.user, scholarship=scholarship).first()
        if existing:
            raise ValidationError({'detail': f'You already applied to this scholarship (reference {existing.reference_number}).'})
        if str(request.data.get('consent_given', '')).lower() not in ('1', 'true', 'on'):
            raise ValidationError({'consent_given': 'Please confirm the declaration and consent.'})

        personal, education, family = parse_form_data(request.data, scholarship)

        reqs = document_requirements(scholarship)
        docs = collect_documents(request.FILES, {r['key'] for r in reqs})
        have = {k for k, _ in docs}
        missing = [r['label'] for r in reqs if r['required'] and r['key'] not in have]
        if missing:
            raise ValidationError({'documents': 'Please upload: ' + '; '.join(missing) + '.'})
        idd = id_details(request.data)
        if 'valid_id' in have and not idd['confirmed']:
            raise ValidationError({'documents': 'Please confirm that the ID you submitted is yours and the copy is accurate.'})

        try:
            with transaction.atomic():
                app = ScholarshipApplication.objects.create(
                    reference_number=_new_reference(), applicant=request.user, scholarship=scholarship,
                    scholarship_title=scholarship.title, personal=personal, education=education, family=family,
                    consent_given=True,
                )
                for key, f in docs:
                    extra = {'id_type': idd['id_type'], 'id_type_other': idd['id_type_other'], 'source': idd['source']} if key == 'valid_id' else {}
                    ScholarshipApplicationDocument.objects.create(
                        application=app, doc_type=key, original_name=(f.name or '')[:255], file=f, **extra)
        except IntegrityError:
            raise ValidationError({'detail': 'You already applied to this scholarship.'})

        AuditLog.objects.create(
            user=request.user, action='scholarship_application_submitted', model_name='ScholarshipApplication',
            object_id=app.pk, ip_address=get_client_ip(request),
            details={'reference': app.reference_number, 'scholarship': scholarship.title})
        _notify(request.user, 'Scholarship application submitted',
                f'Your application for "{scholarship.title}" was received. Reference number: {app.reference_number}.')
        return Response(self.get_serializer(app).data, status=http.HTTP_201_CREATED)

    # ── admin review ─────────────────────────────────────────────────────
    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsAdminRole])
    def review(self, request, pk=None):
        app = self.get_object()
        ser = ScholarshipReviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        new_status = ser.validated_data.get('status', app.status)
        remarks = ser.validated_data.get('admin_remarks', app.admin_remarks)
        if app.status == 'withdrawn':
            raise ValidationError({'detail': 'This application was withdrawn by the applicant.'})
        if new_status in ('for_compliance', 'rejected') and not remarks:
            raise ValidationError({'admin_remarks': 'Please write a remark so the applicant knows what to do or why.'})
        old = app.status
        app.status, app.admin_remarks, app.reviewed_at = new_status, remarks, timezone.now()
        app.save(update_fields=['status', 'admin_remarks', 'reviewed_at', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='scholarship_application_reviewed', model_name='ScholarshipApplication',
            object_id=app.pk, ip_address=get_client_ip(request),
            details={'reference': app.reference_number, 'from': old, 'to': new_status})
        if new_status != old:
            label = app.get_status_display()
            if new_status == 'for_compliance':
                title, msg = 'Additional documents needed', f'"{app.scholarship_title}" needs more from you. {remarks}'
            else:
                title = f'Application {label.lower()}'
                msg = f'Your application for "{app.scholarship_title}" is now {label.lower()}.' + (f' Note: {remarks}' if remarks else '')
            _notify(app.applicant, title, msg)
        return Response(self.get_serializer(app).data)

    # ── applicant actions ────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        app = self.get_object()
        if app.applicant_id != request.user.pk:
            raise ValidationError({'detail': 'Only the applicant can withdraw an application.'})
        if app.status not in WITHDRAWABLE:
            raise ValidationError({'detail': 'This application can no longer be withdrawn.'})
        app.status = 'withdrawn'
        app.save(update_fields=['status', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='scholarship_application_withdrawn', model_name='ScholarshipApplication',
            object_id=app.pk, ip_address=get_client_ip(request), details={'reference': app.reference_number})
        return Response(self.get_serializer(app).data)

    @action(detail=True, methods=['post'])
    def comply(self, request, pk=None):
        """The applicant sends the missing documents or corrections the admin asked for."""
        app = self.get_object()
        if app.applicant_id != request.user.pk or app.status != 'for_compliance':
            raise ValidationError({'detail': 'This application is not waiting for additional documents.'})
        docs = collect_documents(request.FILES, set(DOCUMENT_TYPES))
        message = bleach.clean((request.data.get('message') or '').strip(), tags=[], strip=True)[:1000]
        if not docs and not message:
            raise ValidationError({'detail': 'Please attach a file or write a message.'})
        idd = id_details(request.data)
        if any(k == 'valid_id' for k, _ in docs) and not idd['confirmed']:
            raise ValidationError({'detail': 'Please confirm that the ID you submitted is yours and the copy is accurate.'})
        with transaction.atomic():
            for key, f in docs:
                if key != 'other':  # a new copy replaces the old one, which stays in the history
                    app.documents.filter(doc_type=key, superseded=False).update(superseded=True)
                extra = {'id_type': idd['id_type'], 'id_type_other': idd['id_type_other'], 'source': idd['source']} if key == 'valid_id' else {}
                ScholarshipApplicationDocument.objects.create(
                    application=app, doc_type=key, original_name=(f.name or '')[:255], file=f, **extra)
            app.applicant_message = message
            app.status = 'under_review'
            app.save(update_fields=['applicant_message', 'status', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='scholarship_application_complied', model_name='ScholarshipApplication',
            object_id=app.pk, ip_address=get_client_ip(request),
            details={'reference': app.reference_number, 'files': len(docs)})
        for admin in User.objects.filter(role__in=['lgu_admin', 'super_admin'], is_active=True):
            Notification.objects.create(
                user=admin, title='Scholarship documents received',
                message=f'{app.reference_number} sent the requested documents.', notification_type='system',
                link='/admin/scholarship-applications')
        app = self.get_queryset().get(pk=app.pk)  # reload so the new documents are included
        return Response(self.get_serializer(app).data)

    @action(detail=True, methods=['post'], url_path=r'documents/(?P<doc_id>[0-9]+)/review', permission_classes=[IsAuthenticated, IsAdminRole])
    def review_document(self, request, pk=None, doc_id=None):
        """LYDO decides about ONE document: verified, needs revision or invalid. The applicant only has to replace that document."""
        app = self.get_object()
        doc = get_object_or_404(ScholarshipApplicationDocument, pk=doc_id, application=app)
        decision = str(request.data.get('status', ''))
        note = bleach.clean(str(request.data.get('note', '') or '').strip(), tags=[], strip=True)[:1000]
        if decision not in ('verified', 'needs_revision', 'invalid'):
            raise ValidationError({'detail': 'Choose verified, needs revision or invalid.'})
        if doc.superseded:
            raise ValidationError({'detail': 'This copy was already replaced by a newer one. Review the newer copy.'})
        if decision != 'verified' and len(note) < 5:
            raise ValidationError({'note': 'Write what is wrong, so the applicant knows what to replace.'})
        if decision != 'verified' and app.status not in ('submitted', 'under_review', 'for_compliance'):
            raise ValidationError({'detail': 'This application is already decided or withdrawn.'})
        label = DOCUMENT_TYPES.get(doc.doc_type, doc.doc_type)
        with transaction.atomic():
            doc.review_status, doc.review_note, doc.reviewed_by, doc.reviewed_at = decision, note, request.user, timezone.now()
            doc.save(update_fields=['review_status', 'review_note', 'reviewed_by', 'reviewed_at'])
            if decision != 'verified':
                app.status, app.admin_remarks, app.reviewed_at = 'for_compliance', f'{label}: {note}', timezone.now()
                app.save(update_fields=['status', 'admin_remarks', 'reviewed_at', 'updated_at'])
        AuditLog.objects.create(
            user=request.user, action='scholarship_document_reviewed', model_name='ScholarshipApplicationDocument', object_id=doc.pk,
            ip_address=get_client_ip(request), details={'reference': app.reference_number, 'document': doc.doc_type, 'decision': decision, 'note': note})
        if decision == 'verified':
            _notify(app.applicant, f'{label} verified', f'Your {label.lower()} for "{app.scholarship_title}" was verified.')
        else:
            what = 'needs a new copy' if decision == 'invalid' else 'needs a correction'
            _notify(app.applicant, f'{label} {what}',
                    f'Your {label.lower()} for "{app.scholarship_title}" {what}. {note} Open My Applications to replace it. You do not need to apply again.')
        app = self.get_queryset().get(pk=app.pk)
        return Response(self.get_serializer(app).data)

    @action(detail=True, methods=['get'], url_path=r'documents/(?P<doc_id>[0-9]+)')
    def document(self, request, pk=None, doc_id=None):
        app = self.get_object()  # non-admins only ever see their own applications
        doc = get_object_or_404(ScholarshipApplicationDocument, pk=doc_id, application=app)
        return private_file_response(doc.file)
