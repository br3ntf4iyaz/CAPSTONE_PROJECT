import threading
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from .models import IDVerification
from .serializers import IDVerificationSerializer, IDVerificationSubmitSerializer
from .ai_checker import run_ai_check


def _run_ai_in_background(verification_id: int):
    """Fetch the verification record, run AI, and save results."""
    try:
        from .models import IDVerification  # local import keeps thread safe
        v = IDVerification.objects.get(pk=verification_id)
        v.status = IDVerification.Status.REVIEWING
        v.save(update_fields=["status"])

        result = run_ai_check(v)

        v.ai_verdict      = result["verdict"]
        v.ai_confidence   = result["confidence"]
        v.ai_notes        = result["notes"]
        v.ai_raw_response = result.get("raw", "")

        # Auto-approve/reject based on AI confidence threshold
        HIGH_CONFIDENCE = 0.75
        if result["verdict"] == "approved" and result["confidence"] >= HIGH_CONFIDENCE:
            v.status = IDVerification.Status.APPROVED
        elif result["verdict"] == "rejected":
            v.status = IDVerification.Status.REJECTED
        else:
            # Low-confidence approvals → human review queue (stay as "reviewing")
            v.status = IDVerification.Status.REVIEWING

        v.save(update_fields=[
            "status", "ai_verdict", "ai_confidence",
            "ai_notes", "ai_raw_response",
        ])
    except Exception as exc:
        # AI call failed — mark rejected so the user can re-submit
        try:
            from .models import IDVerification as _IDV
            _IDV.objects.filter(pk=verification_id).update(
                status=_IDV.Status.REJECTED,
                ai_notes="Verification service encountered an error. Please try again.",
                ai_verdict="rejected",
            )
        except Exception:
            pass


class VerificationStatusView(APIView):
    """GET /api/verification/  — current user's verification status."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            v = request.user.id_verification
            return Response(IDVerificationSerializer(v).data)
        except IDVerification.DoesNotExist:
            return Response({"status": "none", "is_verified": False})


class VerificationSubmitView(APIView):
    """
    POST /api/verification/submit/
    Upload an ID image. Triggers AI analysis in a background thread.
    Users can re-submit if their previous attempt was rejected.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Block re-submission if already approved or currently reviewing
        try:
            existing = request.user.id_verification
            if existing.status in (IDVerification.Status.APPROVED,
                                   IDVerification.Status.REVIEWING):
                return Response(
                    {"detail": "Verification already in progress or approved."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Allow re-submission if rejected → update the existing record
            serializer = IDVerificationSubmitSerializer(
                existing, data=request.data, partial=False
            )
        except IDVerification.DoesNotExist:
            serializer = IDVerificationSubmitSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)
        v = serializer.save(
            user=request.user,
            status=IDVerification.Status.PENDING,
            ai_verdict="",
            ai_confidence=None,
            ai_notes="",
            ai_raw_response="",
        )

        # Fire AI check in background so the response is immediate
        thread = threading.Thread(
            target=_run_ai_in_background,
            args=(v.pk,),
            daemon=True,
        )
        thread.start()

        return Response(
            IDVerificationSerializer(v).data,
            status=status.HTTP_201_CREATED,
        )


# ── Admin endpoints ────────────────────────────────────────────────────────────

class AdminVerificationListView(APIView):
    """GET /api/verification/admin/  — list all pending/reviewing submissions."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        qs = IDVerification.objects.select_related("user").order_by("-submitted_at")
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        data = []
        for v in qs:
            row = IDVerificationSerializer(v).data
            row["user_name"]  = v.user.full_name
            row["user_email"] = v.user.email
            row["id_image_url"] = request.build_absolute_uri(v.id_image.url) if v.id_image else None
            data.append(row)
        return Response(data)


class AdminVerificationDetailView(APIView):
    """PATCH /api/verification/admin/<id>/  — manually approve or reject."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def patch(self, request, pk):
        try:
            v = IDVerification.objects.get(pk=pk)
        except IDVerification.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("status")
        if new_status not in (IDVerification.Status.APPROVED, IDVerification.Status.REJECTED):
            return Response(
                {"detail": "status must be 'approved' or 'rejected'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        v.status      = new_status
        v.admin_notes = request.data.get("admin_notes", v.admin_notes)
        v.reviewed_by = request.user
        v.reviewed_at = timezone.now()
        v.save(update_fields=["status", "admin_notes", "reviewed_by", "reviewed_at"])

        # Audit trail
        try:
            from apps.accounts.models import AuditLog
            def _get_ip(req):
                x_fwd = req.META.get("HTTP_X_FORWARDED_FOR")
                return x_fwd.split(",")[0].strip() if x_fwd else req.META.get("REMOTE_ADDR")
            action_key = "verification_approved" if new_status == IDVerification.Status.APPROVED else "verification_rejected"
            AuditLog.objects.create(
                user=request.user,
                action=action_key,
                ip_address=_get_ip(request),
                details={"target_user": v.user.email, "verification_id": v.pk},
            )
        except Exception:
            pass

        row = IDVerificationSerializer(v).data
        row["id_image_url"] = request.build_absolute_uri(v.id_image.url) if v.id_image else None
        return Response(row)


class AdminVerificationBulkView(APIView):
    """POST /api/verification/admin/bulk/  — bulk approve or reject."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        ids = request.data.get("ids", [])
        new_status = request.data.get("status")
        admin_notes = request.data.get("admin_notes", "")

        if not ids or not isinstance(ids, list):
            return Response(
                {"detail": "ids must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_status not in (IDVerification.Status.APPROVED, IDVerification.Status.REJECTED):
            return Response(
                {"detail": "status must be 'approved' or 'rejected'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = IDVerification.objects.filter(
            pk__in=ids,
            status__in=[
                IDVerification.Status.PENDING,
                IDVerification.Status.REVIEWING,
                IDVerification.Status.REJECTED,
            ],
        ).update(
            status=new_status,
            admin_notes=admin_notes,
            reviewed_by_id=request.user.pk,
            reviewed_at=timezone.now(),
        )

        try:
            from apps.accounts.models import AuditLog

            def _get_ip(req):
                x_fwd = req.META.get("HTTP_X_FORWARDED_FOR")
                return x_fwd.split(",")[0].strip() if x_fwd else req.META.get("REMOTE_ADDR")

            action_key = (
                "verification_approved"
                if new_status == IDVerification.Status.APPROVED
                else "verification_rejected"
            )
            AuditLog.objects.create(
                user=request.user,
                action=action_key,
                ip_address=_get_ip(request),
                details={"bulk": True, "count": updated, "ids": list(ids)},
            )
        except Exception:
            pass

        return Response({"updated": updated})
