from rest_framework import mixins, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsAdminRole

from .models import OpportunityApplication
from .serializers import ApplicationSerializer


class ApplicationViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Youth: create and list their own applications. Admins: list all."""
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def get_queryset(self):
        qs = OpportunityApplication.objects.all()
        if not IsAdminRole().has_permission(self.request, self):
            qs = qs.filter(applicant=self.request.user)
        kind = self.request.query_params.get('kind')
        return qs.filter(kind=kind) if kind else qs

    def perform_create(self, serializer):
        serializer.save(applicant=self.request.user)
