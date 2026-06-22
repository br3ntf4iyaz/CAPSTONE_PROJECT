import bleach
from django.conf import settings
from rest_framework import serializers

from .models import Internship, InternshipApplication, InternshipRequirement


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ALLOWED_TAGS = [
    "a", "b", "blockquote", "br", "code", "em", "i", "li", "ol", "p",
    "pre", "strong", "u", "ul",
]

_ALLOWED_RESUME_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]


def _sanitize(value: str) -> str:
    if not value:
        return value
    return bleach.clean(value, tags=_ALLOWED_TAGS, strip=True)


def _absolute_url(request, file_field):
    if not file_field:
        return None
    url = file_field.url
    if request is not None:
        return request.build_absolute_uri(url)
    return url


# ---------------------------------------------------------------------------
# InternshipRequirementSerializer
# ---------------------------------------------------------------------------

class InternshipRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = InternshipRequirement
        fields = ["id", "requirement"]
        read_only_fields = ["id"]


# ---------------------------------------------------------------------------
# InternshipListSerializer  (compact, for list views)
# ---------------------------------------------------------------------------

class InternshipListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Internship
        fields = [
            "id",
            "title",
            "organization",
            "location",
            "mode",
            "deadline",
            "status",
            "is_featured",
            "slots",
        ]


# ---------------------------------------------------------------------------
# InternshipDetailSerializer  (full detail + structured requirements)
# ---------------------------------------------------------------------------

class InternshipDetailSerializer(serializers.ModelSerializer):
    structured_requirements = InternshipRequirementSerializer(
        many=True, read_only=True
    )
    posted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Internship
        fields = [
            "id",
            "title",
            "description",
            "organization",
            "location",
            "mode",
            "posted_by_name",
            "slots",
            "requirements",
            "structured_requirements",
            "eligibility_badges",
            "required_courses",
            "deadline",
            "start_date",
            "end_date",
            "status",
            "is_featured",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "posted_by_name",
            "structured_requirements",
            "created_at",
            "updated_at",
        ]

    def get_posted_by_name(self, obj):
        if obj.posted_by:
            return obj.posted_by.full_name
        return None

    def validate_description(self, value):
        return _sanitize(value)

    def validate_requirements(self, value):
        return _sanitize(value)


# ---------------------------------------------------------------------------
# InternshipApplicationSerializer
# ---------------------------------------------------------------------------

class InternshipApplicationSerializer(serializers.ModelSerializer):
    resume_url = serializers.SerializerMethodField()
    # notes field is admin-only; excluded from output for regular users
    notes = serializers.CharField(required=False, allow_blank=True, write_only=False)

    class Meta:
        model = InternshipApplication
        fields = [
            "id",
            "internship",
            "cover_letter",
            "resume",
            "resume_url",
            "status",
            "submitted_at",
            "updated_at",
            "interview_date",
            "notes",
        ]
        read_only_fields = [
            "id",
            "status",
            "submitted_at",
            "updated_at",
            "resume_url",
        ]
        extra_kwargs = {
            "resume": {"write_only": True, "required": False},
        }

    def get_resume_url(self, obj):
        return _absolute_url(self.context.get("request"), obj.resume)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        # Hide admin-only 'notes' field from non-admin users
        if request and hasattr(request.user, "role"):
            if request.user.role not in ("lgu_admin", "super_admin"):
                data.pop("notes", None)
        return data

    def validate_cover_letter(self, value):
        return _sanitize(value)

    def validate_resume(self, value):
        if value:
            max_bytes = 10 * 1024 * 1024  # 10 MB
            if value.size > max_bytes:
                raise serializers.ValidationError("Resume file must not exceed 10 MB.")
            if hasattr(value, "content_type") and value.content_type not in _ALLOWED_RESUME_TYPES:
                raise serializers.ValidationError(
                    "Unsupported file type. Allowed: PDF, DOC, DOCX."
                )
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        internship = attrs.get("internship")
        if internship:
            if internship.status != "open":
                raise serializers.ValidationError(
                    {"internship": "This internship is not currently accepting applications."}
                )
            if not internship.is_active:
                raise serializers.ValidationError(
                    {"internship": "This internship is no longer active."}
                )
        if request and internship:
            if InternshipApplication.objects.filter(
                applicant=request.user,
                internship=internship,
            ).exists():
                raise serializers.ValidationError(
                    {"internship": "You have already applied to this internship."}
                )
        return attrs
