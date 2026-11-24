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

    def get_permissions(self):
        if self.action in ('update', 'partial_update'):
            return [IsAuthenticated(), IsAdminRole()]
        if self.action == 'create':
            from apps.accounts.verification import IsIDVerified
            return [IsAuthenticated(), IsIDVerified()]  # applying needs a verified identity; reading your own applications does not
        return super().get_permissions()

    def update(self, request, *args, **kwargs):
        # Admin review only; the applicant's own answers are never edited.
        instance = self.get_object()
        old = instance.status
        ser = ApplicationReviewSerializer(instance, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        app = ser.save(reviewed_at=timezone.now())
        AuditLog.objects.create(
            user=request.user,
            action='application_reviewed',
            model_name='OpportunityApplication',
            object_id=app.pk,
            ip_address=get_client_ip(request),
            details={'applicant': app.email, 'title': app.title, 'from': old, 'to': app.status},
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
