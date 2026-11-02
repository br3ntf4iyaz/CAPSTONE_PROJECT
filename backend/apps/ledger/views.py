from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole

from . import payloads, service
from .models import Anchor, LedgerEntry


def _backend_info():
    evm = settings.ANCHOR_BACKEND == 'evm'
    return {'backend': 'evm' if evm else 'ledger',
            'network': settings.ANCHOR_NETWORK_NAME if evm else service.LOCAL_NETWORK}


class ReviewLogIntegrityView(APIView):
    """GET /ledger/review-logs/<submission_id>/ — is each review-history entry still as recorded?"""
    permission_classes = [IsAuthenticated]

    def get(self, request, submission_id):
        from apps.programs.models import ProgramSubmission
        sub = get_object_or_404(ProgramSubmission, pk=submission_id)
        if sub.submitted_by_id != request.user.id and not IsAdminRole().has_permission(request, self):
            return Response({'detail': 'Not found.'}, status=404)
        v = service.Verifier()
        return Response({
            **_backend_info(),
            'results': {
                str(log.pk): v.check(payloads.REVIEW_LOG, log.pk, payloads.review_log(log))
                for log in sub.review_logs.all()
            },
        })


class SKRequirementIntegrityView(APIView):
    """GET /ledger/sk-requirements/ — admin. Re-hashes each submitted file and checks the ledger."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        from apps.sk_requirements.models import SKRequirement
        v = service.Verifier()
        return Response({
            **_backend_info(),
            'results': {
                str(r.pk): v.check(payloads.SK_REQUIREMENT, r.pk, payloads.sk_requirement(r))
                for r in SKRequirement.objects.filter(status='submitted')
            },
        })


class IDVerificationIntegrityView(APIView):
    """GET /ledger/id-verifications/ — admin. Checks every approve/reject decision."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        from apps.verification.models import IDVerification
        v = service.Verifier()
        return Response({
            **_backend_info(),
            'results': {
                str(x.pk): v.check(payloads.ID_DECISION, x.pk, payloads.id_decision(x))
                for x in IDVerification.objects.filter(status__in=payloads.ID_FINAL)
            },
        })


class CertificateIntegrityView(APIView):
    """
    GET /ledger/certificates/ — the signed-in user's own certificates, both kinds. Keys are
    'course-<id>' and 'recognition-<id>', matching the youth certificates page. Admins see all.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.courses.models import Certificate as CourseCert
        from apps.recognition.models import Certificate as RecognitionCert
        everyone = IsAdminRole().has_permission(request, self)
        courses = CourseCert.objects.select_related('enrollment')
        recognitions = RecognitionCert.objects.all()
        if not everyone:
            courses = courses.filter(enrollment__user=request.user)
            recognitions = recognitions.filter(user=request.user)
        v = service.Verifier()
        results = {f'course-{c.pk}': v.check(payloads.COURSE_CERT, c.pk, payloads.course_cert(c)) for c in courses}
        results.update({
            f'recognition-{c.pk}': v.check(payloads.RECOGNITION_CERT, c.pk, payloads.recognition_cert(c))
            for c in recognitions
        })
        return Response({**_backend_info(), 'results': results})


class AuditDaysView(APIView):
    """GET /ledger/audit-days/ — admin. Anchors any finished day not yet anchored, then checks the last 30."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        payloads.anchor_audit_days()
        return Response({**_backend_info(), 'days': payloads.recent_audit_days(30)})


class LedgerStatusView(APIView):
    """GET /ledger/status/ — admin. Overview for the integrity panel."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        by_kind = {}
        for a in Anchor.objects.all():
            k = by_kind.setdefault(a.kind, {'anchored': 0, 'pending': 0, 'failed': 0})
            k[a.status] += 1
        return Response({
            **_backend_info(),
            'by_kind': by_kind,
            'local_chain_intact': service.ledger_is_intact() if LedgerEntry.objects.exists() else True,
        })
