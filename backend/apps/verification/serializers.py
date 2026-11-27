from rest_framework import serializers
from .models import IDVerification, VerificationEvent


class VerificationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = VerificationEvent
        fields = ["id", "action", "from_status", "to_status", "note", "created_at"]


class IDVerificationSerializer(serializers.ModelSerializer):
    id_type_display  = serializers.CharField(source="get_id_type_display",  read_only=True)
    status_display   = serializers.CharField(source="get_status_display",   read_only=True)
    is_verified      = serializers.BooleanField(read_only=True)
    reference_number = serializers.CharField(read_only=True)
    has_residency_doc = serializers.SerializerMethodField()
    history          = VerificationEventSerializer(source="events", many=True, read_only=True)

    def get_has_residency_doc(self, obj):
        return bool(obj.residency_doc)

    class Meta:
        model  = IDVerification
        fields = [
            "id", "id_type", "id_type_display",
            "status", "status_display", "is_verified",
            "ai_confidence", "ai_notes", "ai_verdict", "ai_face_match",
            "decision_flags", "auto_approved",
            "admin_notes", "reference_number", "address", "has_residency_doc", "history",
            "submitted_at", "updated_at",
        ]
        read_only_fields = [
            "status", "ai_confidence", "ai_notes", "ai_verdict",
            "decision_flags", "auto_approved",
            "admin_notes", "submitted_at", "updated_at",
        ]


class IDVerificationSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model  = IDVerification
        fields = ["id_type", "id_image", "id_back_image", "selfie_image", "residency_doc", "address"]
        extra_kwargs = {
            "id_image": {"required": True, "allow_null": False},
            "id_back_image": {"required": True, "allow_null": False},
            "selfie_image": {"required": True, "allow_null": False},
            "residency_doc": {"required": False, "allow_null": True},
            "address": {"required": False, "allow_blank": True},
        }

    @staticmethod
    def _check(value):
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("Image must not exceed 10 MB.")
        allowed = {"image/jpeg", "image/png", "image/webp"}
        if hasattr(value, "content_type") and value.content_type not in allowed:
            raise serializers.ValidationError("Only JPG, PNG, or WEBP images are accepted.")
        return value

    def validate_id_image(self, value):
        return self._check(value)

    def validate_id_back_image(self, value):
        return self._check(value)

    def validate_selfie_image(self, value):
        return self._check(value)

    def validate_residency_doc(self, value):
        if value is None:
            return value
        from apps.accounts.uploads import check_upload
        return check_upload(value, {".jpg", ".jpeg", ".png", ".pdf"}, 10 * 1024 * 1024, "residency_doc")

    def validate_address(self, value):
        from apps.youth_orgs.serializers import sanitize
        return sanitize((value or "").strip())[:255]
