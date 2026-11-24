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

    @action(detail=True, methods=['get'], url_path='document')
    def document(self, request, pk=None):
        """The applicant's own file, or any file for an admin. Login required."""
        from apps.accounts.uploads import private_file_response
        app = self.get_object()  # get_queryset already limits non-admins to their own rows
        return private_file_response(app.document)

    @action(detail=True, methods=['get'], url_path='id-document')
    def id_document(self, request, pk=None):
        """The front of the applicant's valid ID: the applicant, or an administrator. Login required."""
        from apps.accounts.uploads import private_file_response
        app = self.get_object()
        return private_file_response(app.id_document)

    @action(detail=True, methods=['get'], url_path='id-document-back')
    def id_document_back(self, request, pk=None):
        from apps.accounts.uploads import private_file_response
        app = self.get_object()
        return private_file_response(app.id_document_back)

    @action(detail=True, methods=['get'], url_path='selfie')
    def selfie(self, request, pk=None):
        from apps.accounts.uploads import private_file_response
        app = self.get_object()
        return private_file_response(app.selfie)

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
        updated = ser.save(status='submitted', previous_note=note, admin_note='', reviewed_at=None,
                           resubmit_count=app.resubmit_count + 1)
        AuditLog.objects.create(
            user=request.user, action='application_resubmitted', model_name='OpportunityApplication', object_id=updated.pk,
            ip_address=get_client_ip(request), details={'applicant': updated.email, 'title': updated.title, 'times': updated.resubmit_count},
        )
        return Response(ApplicationSerializer(updated, context=self.get_serializer_context()).data, status=http.HTTP_200_OK)

    def get_permissions(self):
        if self.action in ('update', 'partial_update'):
            return [IsAuthenticated(), IsAdminRole()]
        if self.action in ('create', 'resubmit'):
            from apps.accounts.verification import IsIDVerified
            return [IsAuthenticated(), IsIDVerified()]  # applying needs a verified identity; reading your own applications does not
        return super().get_permissions()

    def update(self, request, *args, **kwargs):
        # Admin review only; the applicant's own answers are never edited.
        instance = self.get_object()
        old = instance.status
        ser = ApplicationReviewSerializer(instance, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        new = ser.validated_data.get('status', old)
        checked = str(request.data.get('documents_checked', '')).lower() in ('1', 'true', 'yes')
        if new != old and new in ('approved', 'rejected'):
            # A decision is never made blindly: the application must be under review first, the ID and resume must have been
            # checked, and a refusal needs a reason the applicant can read.
            if old != 'under_review':
                return Response({'detail': 'Start the review first. An application cannot be approved or refused straight from Submitted.'}, status=http.HTTP_400_BAD_REQUEST)
            if not checked:
                return Response({'detail': 'Confirm that you checked the ID and the resume before you decide.'}, status=http.HTTP_400_BAD_REQUEST)
            note = ser.validated_data.get('admin_note', instance.admin_note) or ''
            if new == 'rejected' and len(note.strip()) < 5:
                return Response({'detail': 'Write the reason, so the applicant knows why it was not accepted.'}, status=http.HTTP_400_BAD_REQUEST)
        app = ser.save(reviewed_at=timezone.now())
        AuditLog.objects.create(
            user=request.user,
            action='application_reviewed',
            model_name='OpportunityApplication',
            object_id=app.pk,
            ip_address=get_client_ip(request),
            details={'applicant': app.email, 'title': app.title, 'from': old, 'to': app.status, 'documents_checked': checked},
        )
        if app.status != old:
            label = app.get_status_display()
            Notification.objects.create(
                user=app.applicant,
                title=f'Application {label.lower()}',
                message=f'Your application for "{app.title}" is now {label.lower()}.' + (f' Note: {app.admin_note}' if app.admin_note else ''),
                notification_type='system',
                link='/my-applications',
            )
        return Response(self.get_serializer(app).data, status=http.HTTP_200_OK)

    def perform_create(self, serializer):
        serializer.save(applicant=self.request.user)
