from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from .decision import clean_client_checks, clean_ocr, evaluate
from .models import IDTypeSetting, IDVerification
from .serializers import IDVerificationSerializer, IDVerificationSubmitSerializer
from .throttles import VerificationSubmitThrottle


def _record_client_face_check(v, data):
    """Store the in-browser (face-api) comparison result. Admin still decides."""
    try:
        distance = float(data.get("face_distance"))
        if not (0.0 <= distance <= 2.0):
            raise ValueError
    except (TypeError, ValueError):
        v.ai_notes = "Automatic face check was unavailable on the device. Manual review needed."
        return None
    matched = str(data.get("face_matched", "")).lower() == "true"
    v.ai_confidence = max(0.0, min(1.0, 1 - distance))
    v.ai_face_match = matched
    v.ai_verdict = "match" if matched else "no match"
    v.ai_notes = (
        f"Face check on device: {'match' if matched else 'no clear match'} "
        f"(distance {distance:.2f}, similarity {round(v.ai_confidence * 100)}%)."
    )
    return distance


FILE_FIELDS = ("id_image", "id_back_image", "selfie_image")


def _check_details(v):
    """What the automatic checks measured, for the admin review screen."""
    return {
        "client_checks": v.client_checks,
        "ocr_result": v.ocr_result,
        "image_checks": v.image_checks,
        "flag_texts": [FLAG_TEXT.get(f, f) for f in (v.decision_flags or [])],
        "consent_at": v.consent_at,
    }


def _file_urls(request, v):
    """API addresses (login required) instead of public media links."""
    return {
        f"{name}_url": (request.build_absolute_uri(f"/api/verification/admin/{v.pk}/file/{name}/") if getattr(v, name) else None)
        for name in FILE_FIELDS
    }


class AdminVerificationFileView(APIView):
    """GET /api/verification/admin/<id>/file/<id_image|id_back_image|selfie_image>/  (admins only)"""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request, pk, which):
        from apps.accounts.uploads import private_file_response
        from django.http import Http404
        if which not in FILE_FIELDS:
            raise Http404()
        try:
            v = IDVerification.objects.get(pk=pk)
        except IDVerification.DoesNotExist:
            raise Http404()
        return private_file_response(getattr(v, which))


class VerificationStatusView(APIView):
    """GET /api/verification/  — current user's verification status."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            v = request.user.id_verification
            return Response(IDVerificationSerializer(v).data)
        except IDVerification.DoesNotExist:
            return Response({"status": "none", "is_verified": False})


FLAG_TEXT = {
    "unsupported_id": "The ID type is not currently accepted.",
    "front_unreadable": "The front of the ID is not clear enough.",
    "back_unreadable": "The back of the ID is not clear enough.",
    "selfie_quality": "The selfie is too dark or too small.",
    "no_live_scan": "The ID was not scanned live with the camera.",
    "liveness_failed": "The quick live check (blink or head turn) could not be completed.",
    "face_mismatch": "The selfie does not match the ID photo.",
    "face_uncertain": "The face match is not certain enough.",
    "face_unchecked": "The face comparison could not be completed.",
    "ocr_unavailable": "The ID text could not be read automatically.",
    "name_mismatch": "The name on the ID does not match the account name.",
    "expired_id": "The ID appears to be expired.",
    "unrecognized_id": "The document was not recognised as the selected ID type.",
    "low_confidence": "The overall confidence was below the approval level.",
}


def ensure_id_types():
    """Make sure every built-in ID type has a switch the admin can flip."""
    existing = set(IDTypeSetting.objects.values_list("code", flat=True))
    for order, (code, label) in enumerate(IDVerification.IDType.choices):
        if code not in existing:
            IDTypeSetting.objects.create(code=code, label=label, sort_order=order)


class VerificationSubmitView(APIView):
    """
    POST /api/verification/submit/
    Upload ID front/back + selfie. The server measures the photos, combines them with the
    on-device face match, liveness and ID-text results, and approves automatically only when
    everything is clearly fine. Anything else is sent to a LYDO admin.
    Users can re-submit if their previous attempt was rejected.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [VerificationSubmitThrottle]

    def post(self, request):
        import json

        if str(request.data.get("consent", "")).lower() != "true":
            return Response(
                {"detail": "Please agree to the collection of your ID and face photos before submitting.", "code": "consent_required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ensure_id_types()
        setting = IDTypeSetting.objects.filter(code=request.data.get("id_type")).first()
        if setting is not None and not setting.is_enabled:
            return Response({"detail": "This ID type is not accepted right now. Please choose another ID."},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            existing = IDVerification.objects.select_for_update().filter(user=request.user).first()
            if existing and existing.status in (IDVerification.Status.APPROVED, IDVerification.Status.REVIEWING):
                return Response(
                    {"detail": "Verification already in progress or approved."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if existing:
                serializer = IDVerificationSubmitSerializer(existing, data=request.data, partial=False)
            else:
                serializer = IDVerificationSubmitSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            try:
                checks = json.loads(request.data.get("client_checks") or "{}")
                ocr = json.loads(request.data.get("ocr_result") or "{}")
            except (TypeError, ValueError):
                checks, ocr = {}, {}

            v = serializer.save(
                user=request.user,
                status=IDVerification.Status.REVIEWING,
                ai_verdict="",
                ai_confidence=None,
                ai_notes="",
                ai_raw_response="",
                client_checks=clean_client_checks(checks),
                ocr_result=clean_ocr(ocr),
                decision_flags=[],
                auto_approved=False,
                consent_at=timezone.now(),
                reviewed_by=None,
                reviewed_at=None,
            )

            distance = _record_client_face_check(v, request.data)
            matched = bool(v.ai_face_match)
            decision = evaluate(v, distance, matched)

            v.status = decision["status"]
            v.ai_confidence = decision["confidence"]
            v.decision_flags = decision["flags"]
            v.image_checks = decision["image_checks"]
            v.auto_approved = decision["auto"]
            if decision["auto"]:
                v.reviewed_at = timezone.now()
                v.ai_verdict = "approved"
                v.admin_notes = "Verified automatically: all checks passed."
                if decision.get("live_skipped"):
                    v.ai_notes = (
                        "Verified automatically WITHOUT the blink/head-turn check, because the face, name and ID all matched "
                        "strongly and the photos were clear (confidence %d%%)." % round(decision["confidence"] * 100)
                    )
                else:
                    v.ai_notes = "Automatic verification passed (confidence %d%%)." % round(decision["confidence"] * 100)
            else:
                v.ai_verdict = "needs review"
                reasons = "; ".join(FLAG_TEXT.get(f, f) for f in decision["flags"]) or "Needs a manual check."
                v.ai_notes = "Sent for review (%d%% confidence): %s" % (round(decision["confidence"] * 100), reasons)
            v.save()

        _notify_and_audit(request, v)
        return Response(IDVerificationSerializer(v).data, status=status.HTTP_201_CREATED)


def _notify_and_audit(request, v):
    try:
        from apps.accounts.models import AuditLog
        from apps.accounts.views import get_client_ip
        from apps.notifications.models import Notification

        if v.auto_approved:
            AuditLog.objects.create(
                user=request.user, action="verification_auto_approved", model_name="IDVerification", object_id=v.pk,
                ip_address=get_client_ip(request),
                details={"confidence": v.ai_confidence, "flags": v.decision_flags, "live_check_skipped": "WITHOUT the blink" in (v.ai_notes or "")},
            )
            Notification.objects.create(
                user=request.user, title="Identity verified",
                message="Your identity was verified. Your account now has a Verified badge.",
                notification_type="system", link="/verify-identity",
            )
        else:
            Notification.objects.create(
                user=request.user, title="Verification under review",
                message="Your documents need a quick check by the LYDO team. We will notify you of the result.",
                notification_type="system", link="/verify-identity",
            )
    except Exception:
        pass  # a notification problem must never undo a saved verification


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
            row.update(_file_urls(request, v))
            row.update(_check_details(v))
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

        revoking = False
        if v.status == IDVerification.Status.APPROVED:
            # A verified result can only be taken back on purpose, with a written reason (and it is logged).
            note = str(request.data.get("admin_notes", "")).strip()
            if new_status != IDVerification.Status.REJECTED:
                return Response({"detail": "This identity is already verified."}, status=status.HTTP_400_BAD_REQUEST)
            if len(note) < 5:
                return Response({"detail": "Write the reason for revoking this verification."}, status=status.HTTP_400_BAD_REQUEST)
            revoking = True

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
            if revoking:
                action_key = "verification_revoked"
            AuditLog.objects.create(
                user=request.user,
                action=action_key,
                ip_address=_get_ip(request),
                details={"target_user": v.user.email, "verification_id": v.pk, "was_auto": v.auto_approved},
            )
        except Exception:
            pass

        row = IDVerificationSerializer(v).data
        row.update(_file_urls(request, v))
        row.update(_check_details(v))
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


class IDTypeListView(APIView):
    """GET /api/verification/id-types/ : the IDs that are accepted right now."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ensure_id_types()
        rows = IDTypeSetting.objects.filter(is_enabled=True)
        return Response([{"value": r.code, "label": r.label} for r in rows])


class AdminIDTypeView(APIView):
    """GET /api/verification/admin/id-types/ : every ID type with its on/off switch."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        ensure_id_types()
        return Response([
            {"code": r.code, "label": r.label, "is_enabled": r.is_enabled}
            for r in IDTypeSetting.objects.all()
        ])


class AdminIDTypeDetailView(APIView):
    """PATCH /api/verification/admin/id-types/<code>/ {is_enabled}"""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def patch(self, request, code):
        ensure_id_types()
        row = IDTypeSetting.objects.filter(code=code).first()
        if row is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        value = request.data.get("is_enabled")
        if not isinstance(value, bool):
            return Response({"detail": "is_enabled must be true or false."}, status=status.HTTP_400_BAD_REQUEST)
        if not value and IDTypeSetting.objects.filter(is_enabled=True).exclude(pk=row.pk).count() == 0:
            return Response({"detail": "At least one ID type must stay accepted."}, status=status.HTTP_400_BAD_REQUEST)
        row.is_enabled = value
        row.save(update_fields=["is_enabled"])
        try:
            from apps.accounts.models import AuditLog
            from apps.accounts.views import get_client_ip
            AuditLog.objects.create(
                user=request.user, action="id_type_toggled", model_name="IDTypeSetting", object_id=row.pk,
                ip_address=get_client_ip(request), details={"code": row.code, "is_enabled": value},
            )
        except Exception:
            pass
        return Response({"code": row.code, "label": row.label, "is_enabled": row.is_enabled})
