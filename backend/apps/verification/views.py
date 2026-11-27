from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from .decision import clean_client_checks, clean_ocr, evaluate
from . import flow
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


FILE_FIELDS = ("id_image", "id_back_image", "selfie_image", "residency_doc")


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
    "face_fair": "The face match was fair rather than strong (ID photos are often small and soft).",
    "name_unclear": "The name on the ID only partly matches the account name.",
    "duplicate_id": "This ID number is already used by another account.",
}


def ensure_id_types():
    """Make sure every built-in ID type has a switch the admin can flip."""
    existing = set(IDTypeSetting.objects.values_list("code", flat=True))
    for order, (code, label) in enumerate(IDVerification.IDType.choices):
        if code not in existing:
            IDTypeSetting.objects.create(code=code, label=label, sort_order=order)


def _apply_decision(v, data):
    """Record the on-device face check, run the automatic decision and store the outcome on `v` (not saved)."""
    distance = _record_client_face_check(v, data)
    if distance is not None:
        v.client_checks = {**(v.client_checks or {}), "face_distance": round(distance, 3)}
    decision = evaluate(v, distance, bool(v.ai_face_match))

    v.status = decision["status"]
    v.ai_confidence = decision["confidence"]
    v.decision_flags = decision["flags"]
    v.image_checks = decision["image_checks"]
    v.auto_approved = decision["auto"]
    if decision["auto"]:
        v.reviewed_at = timezone.now()
        v.ai_verdict = "approved"
        v.admin_notes = "Verified automatically: all checks passed."
        if decision["flags"]:
            reasons = "; ".join(FLAG_TEXT.get(f, f) for f in decision["flags"])
            v.ai_notes = (
                "Verified automatically (confidence %d%%). Worth a quick second look: %s"
                % (round(decision["confidence"] * 100), reasons)
            )
        else:
            v.ai_notes = "Automatic verification passed (confidence %d%%)." % round(decision["confidence"] * 100)
    else:
        v.ai_verdict = "needs review"
        reasons = "; ".join(FLAG_TEXT.get(f, f) for f in decision["flags"]) or "Needs a manual check."
        v.ai_notes = "Sent for review (%d%% confidence): %s" % (round(decision["confidence"] * 100), reasons)
    return decision


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
            if existing and existing.status == IDVerification.Status.APPROVED:
                return Response(
                    {"detail": "Your identity is already verified."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if existing and existing.status == IDVerification.Status.SUSPENDED:
                return Response(
                    {"detail": "Your verified status is suspended. Please contact LYDO.", "code": "suspended"},
                    status=status.HTTP_403_FORBIDDEN,
                )
            was = existing.status if existing else ""
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

            replaced = [f.name for f in (existing.id_image, existing.id_back_image, existing.selfie_image, existing.residency_doc) if f] if existing else []
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

            _apply_decision(v, request.data)
            v.save()
            kept = {v.id_image.name, v.id_back_image.name, v.selfie_image.name, v.residency_doc.name if v.residency_doc else ""}
            flow.record(v, "resubmitted" if was in ("revision", "rejected") else "submitted", request.user, was)
            for old_name in replaced:
                if old_name not in kept:
                    v.id_image.storage.delete(old_name)  # do not keep replaced ID photos

        _notify_and_audit(request, v)
        return Response(IDVerificationSerializer(v).data, status=status.HTTP_201_CREATED)


def _notify_and_audit(request, v):
    try:
        from apps.accounts.models import AuditLog
        from apps.accounts.views import get_client_ip
        from apps.notifications.models import Notification

        if v.events.filter(action="resubmitted").exists() and not v.auto_approved:
            flow.notify(v, "resubmitted")
            flow.notify_admins_resubmitted(v)
        elif v.auto_approved:
            AuditLog.objects.create(
                user=request.user, action="verification_auto_approved", model_name="IDVerification", object_id=v.pk,
                ip_address=get_client_ip(request),
                details={"confidence": v.ai_confidence, "flags": v.decision_flags},
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
            row["applicant"] = flow.applicant_info(v.user)
            data.append(row)
        return Response(data)


class AdminVerificationDetailView(APIView):
    """PATCH /api/verification/admin/<id>/  — manually approve or reject.  DELETE — remove a REJECTED record for good."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def delete(self, request, pk):
        try:
            v = IDVerification.objects.select_related("user").get(pk=pk)
        except IDVerification.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if v.status != IDVerification.Status.REJECTED:
            return Response({"detail": "Only a rejected verification can be deleted."}, status=status.HTTP_400_BAD_REQUEST)
        info = {"target_user": v.user.email, "reference": v.reference_number, "id_type": v.id_type, "note": v.admin_notes}
        files = [f for f in (v.id_image, v.id_back_image, v.selfie_image, v.residency_doc) if f]
        with transaction.atomic():
            v.delete()
        for f in files:  # the ID photos go too, they are not kept after the record is gone
            try:
                f.storage.delete(f.name)
            except Exception:
                pass
        try:
            from apps.accounts.models import AuditLog
            from apps.accounts.views import get_client_ip
            AuditLog.objects.create(user=request.user, action="verification_deleted", model_name="IDVerification", object_id=pk,
                                    ip_address=get_client_ip(request), details=info)
        except Exception:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, pk):
        try:
            v = IDVerification.objects.get(pk=pk)
        except IDVerification.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        S = IDVerification.Status
        new_status = request.data.get("status")
        if new_status not in (S.APPROVED, S.REJECTED, S.REVISION, S.SUSPENDED):
            return Response(
                {"detail": "status must be 'approved', 'rejected', 'revision' or 'suspended'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        note = str(request.data.get("admin_notes", "")).strip()
        old = v.status
        revoking = restoring = False
        if old == S.APPROVED:
            # A verified result can only be taken back on purpose, with a written reason (and it is logged).
            if new_status not in (S.REJECTED, S.SUSPENDED):
                return Response({"detail": "This identity is already verified."}, status=status.HTTP_400_BAD_REQUEST)
            if len(note) < 5:
                return Response({"detail": "Write the reason, so the person knows why."}, status=status.HTTP_400_BAD_REQUEST)
            revoking = new_status == S.REJECTED
        elif old == S.SUSPENDED:
            if new_status == S.APPROVED:
                restoring = True
            elif new_status == S.REJECTED and len(note) >= 5:
                pass
            else:
                return Response({"detail": "A suspended account can be restored, or rejected with a reason."}, status=status.HTTP_400_BAD_REQUEST)
        elif new_status in (S.REVISION, S.SUSPENDED, S.REJECTED) and len(note) < 5:
            return Response({"detail": "Write what the person must fix or why, so they can read it."}, status=status.HTTP_400_BAD_REQUEST)
        if new_status == S.SUSPENDED and old != S.APPROVED:
            return Response({"detail": "Only a verified account can be suspended."}, status=status.HTTP_400_BAD_REQUEST)

        v.status      = new_status
        v.admin_notes = note if note else ("" if (restoring or new_status == S.APPROVED) else v.admin_notes)
        v.reviewed_by = request.user
        v.reviewed_at = timezone.now()
        v.save(update_fields=["status", "admin_notes", "reviewed_by", "reviewed_at"])
        event = "restored" if restoring else ("revoked" if revoking else new_status)
        flow.record(v, event, request.user, old, note)
        flow.notify(v, event, note)

        # Audit trail
        try:
            from apps.accounts.models import AuditLog
            def _get_ip(req):
                x_fwd = req.META.get("HTTP_X_FORWARDED_FOR")
                return x_fwd.split(",")[0].strip() if x_fwd else req.META.get("REMOTE_ADDR")
            action_key = {"approved": "verification_approved", "rejected": "verification_rejected",
                          "revision": "verification_revision_requested", "suspended": "verification_suspended"}[new_status]
            if revoking:
                action_key = "verification_revoked"
            if restoring:
                action_key = "verification_restored"
            AuditLog.objects.create(
                user=request.user,
                action=action_key,
                ip_address=_get_ip(request),
                details={"target_user": v.user.email, "verification_id": v.pk, "was_auto": v.auto_approved, "from": old, "note": note},
            )
        except Exception:
            pass

        row = IDVerificationSerializer(v).data
        row.update(_file_urls(request, v))
        row.update(_check_details(v))
        row["applicant"] = flow.applicant_info(v.user)
        return Response(row)


def notify_decision(verification, approved, note=""):
    """Tell the person the result, so they know they can apply (or what to do next). Never blocks the decision."""
    try:
        from apps.notifications.models import Notification
        if approved:
            title, message = "Identity verified", "Your identity was approved. You can now apply for jobs, scholarships and other opportunities."
        else:
            title = "Identity not approved"
            message = "Your identity verification was not approved." + (f" Reason: {note}" if note else "") + " Please verify again with a clear photo of a valid ID."
        Notification.objects.create(user=verification.user, title=title, message=message, notification_type="system", link="/verify-identity")
    except Exception:
        pass


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

        targets = IDVerification.objects.filter(
            pk__in=ids,
            status__in=[
                IDVerification.Status.PENDING,
                IDVerification.Status.REVIEWING,
                IDVerification.Status.REJECTED,
                IDVerification.Status.REVISION,
            ],
        )
        to_notify = list(targets.select_related("user"))
        previous = {r.pk: r.status for r in to_notify}
        updated = targets.update(
            status=new_status,
            admin_notes=admin_notes,
            reviewed_by_id=request.user.pk,
            reviewed_at=timezone.now(),
        )

        for row in to_notify:
            row.refresh_from_db()
            flow.record(row, "approved" if new_status == IDVerification.Status.APPROVED else "rejected", request.user, previous.get(row.pk, ""), admin_notes)
            notify_decision(row, new_status == IDVerification.Status.APPROVED, admin_notes)

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


class MyIdFrontView(APIView):
    """GET /api/verification/mine/id-front/ : the person's OWN ID photo, so the browser can re-check a new selfie."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.accounts.uploads import private_file_response
        from django.http import Http404
        v = IDVerification.objects.filter(user=request.user).first()
        if v is None or not v.id_image:
            raise Http404()
        return private_file_response(v.id_image)


class VerificationRetakeSelfieView(APIView):
    """
    POST /api/verification/retake-selfie/
    Replace only the selfie of a verification that is waiting for review (or was rejected) and run the
    automatic checks again, so the person does not have to wait for an admin or scan the ID again.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [VerificationSubmitThrottle]

    def post(self, request):
        import json
        from rest_framework import serializers as drf

        with transaction.atomic():
            v = IDVerification.objects.select_for_update().filter(user=request.user).first()
            if v is None or not v.id_image or not v.id_back_image:
                return Response({"detail": "Start a verification first."}, status=status.HTTP_400_BAD_REQUEST)
            if v.status == IDVerification.Status.APPROVED:
                return Response({"detail": "Your identity is already verified."}, status=status.HTTP_400_BAD_REQUEST)

            class _S(drf.Serializer):
                selfie_image = drf.ImageField()

            ser = _S(data=request.data)
            ser.is_valid(raise_exception=True)
            selfie = ser.validated_data["selfie_image"]
            if selfie.size > 10 * 1024 * 1024:
                return Response({"detail": "Image must not exceed 10 MB."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                checks = clean_client_checks(json.loads(request.data.get("client_checks") or "{}"))
            except (TypeError, ValueError):
                checks = {}

            old_name = v.selfie_image.name
            v.selfie_image = selfie
            v.client_checks = {**(v.client_checks or {}), "selfie": checks.get("selfie", {})}
            v.admin_notes = ""
            v.reviewed_by = None
            v.reviewed_at = None
            v.save()
            _apply_decision(v, request.data)
            v.save()
            if old_name and old_name != v.selfie_image.name:
                v.selfie_image.storage.delete(old_name)  # do not keep the replaced photo around

        _notify_and_audit(request, v)
        return Response(IDVerificationSerializer(v).data, status=status.HTTP_200_OK)
