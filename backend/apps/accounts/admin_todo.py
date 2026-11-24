"""A short list of things that still need a person at LYDO, shown on the admin dashboard."""
import re

from django.db.models import Exists, OuterRef
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsAdminRole


class AdminTodoView(APIView):
    """GET /api/auth/admin/todo/ - only counts and where to go, never personal data."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        from apps.policies.models import PolicyDocument
        from apps.schools.models import School, SchoolProgram
        from apps.sk_requirements.models import SKBarangay
        from apps.verification.models import IDVerification

        verified_courses = SchoolProgram.objects.filter(school=OuterRef('pk'), verification_status='verified', is_active=True)
        schools = School.objects.filter(is_active=True).annotate(has=Exists(verified_courses)).filter(has=False).count()
        blank = re.compile(r'\[[^\]\n]{1,80}\]')
        policies = sum(1 for p in PolicyDocument.objects.all() if p.needs_review or blank.search(p.content or ''))
        councils = SKBarangay.objects.filter(is_active=True, chairperson_photo='').count() + \
            SKBarangay.objects.filter(is_active=True, chairperson_photo__isnull=True).count()
        ids = IDVerification.objects.filter(status__in=['pending', 'reviewing']).count()

        items = [
            {'key': 'ids', 'count': ids, 'label': 'ID verifications waiting for review', 'to': '/admin/verification'},
            {'key': 'schools', 'count': schools, 'label': 'Schools with no published courses yet', 'to': '/admin/jobs-schools'},
            {'key': 'policies', 'count': policies, 'label': 'Policy pages that still need review or have blanks to fill', 'to': '/admin/policies'},
            {'key': 'councils', 'count': councils, 'label': 'SK councils without a chairperson photo', 'to': '/admin/sk-officials'},
        ]
        return Response({'items': [i for i in items if i['count'] > 0]})
