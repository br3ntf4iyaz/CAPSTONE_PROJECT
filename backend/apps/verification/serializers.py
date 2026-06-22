from rest_framework import serializers
from .models import IDVerification


class IDVerificationSerializer(serializers.ModelSerializer):
    id_type_display  = serializers.CharField(source="get_id_type_display",  read_only=True)
    status_display   = serializers.CharField(source="get_status_display",   read_only=True)
    is_verified      = serializers.BooleanField(read_only=True)

    class Meta:
        model  = IDVerification
        fields = [
            "id", "id_type", "id_type_display",
            "status", "status_display", "is_verified",
            "ai_confidence", "ai_notes", "ai_verdict",
            "admin_notes",
            "submitted_at", "updated_at",
        ]
        read_only_fields = [
            "status", "ai_confidence", "ai_notes", "ai_verdict",
            "admin_notes", "submitted_at", "updated_at",
        ]


class IDVerificationSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model  = IDVerification
        fields = ["id_type", "id_image"]

    def validate_id_image(self, value):
        if value:
            if value.size > 10 * 1024 * 1024:
                raise serializers.ValidationError("ID image must not exceed 10 MB.")
            allowed = {"image/jpeg", "image/png", "image/webp"}
            if hasattr(value, "content_type") and value.content_type not in allowed:
                raise serializers.ValidationError("Only JPG, PNG, or WEBP images are accepted.")
        return value
