import bleach
from rest_framework import serializers

from .models import OrgAccomplishment, OrgRequirement, YouthOrganization

BLEACH_ALLOWED_TAGS = ['b', 'i', 'u', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a']
BLEACH_ALLOWED_ATTRS = {'a': ['href', 'title', 'rel']}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def sanitize(value):
    if isinstance(value, str):
        return bleach.clean(
            value,
            tags=BLEACH_ALLOWED_TAGS,
            attributes=BLEACH_ALLOWED_ATTRS,
            strip=True,
        )
    return value


def validate_pdf(file):
    """Validate that an uploaded file is a PDF and does not exceed 10 MB."""
    if file:
        if not file.name.lower().endswith('.pdf'):
            raise serializers.ValidationError('Only PDF files are accepted.')
        if file.size > MAX_FILE_SIZE:
            raise serializers.ValidationError('File size must not exceed 10 MB.')
    return file


# ---------------------------------------------------------------------------
# OrgAccomplishment
# ---------------------------------------------------------------------------

class OrgAccomplishmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgAccomplishment
        fields = ['id', 'organization', 'title', 'description', 'date_achieved', 'created_at']
        read_only_fields = ['created_at']

    def validate_title(self, value):
        return sanitize(value)

    def validate_description(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# OrgRequirement
# ---------------------------------------------------------------------------

class OrgRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgRequirement
        fields = [
            'id', 'organization', 'name', 'is_submitted',
            'file', 'submitted_at', 'notes',
        ]
        read_only_fields = ['submitted_at']

    def validate_file(self, value):
        return validate_pdf(value)

    def validate_notes(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# YouthOrganization — List
# ---------------------------------------------------------------------------

class OrgListSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    requirements_total = serializers.SerializerMethodField()
    requirements_submitted = serializers.SerializerMethodField()

    def get_requirements_total(self, obj):
        return len(obj.requirements.all())  # prefetched by the viewset

    def get_requirements_submitted(self, obj):
        return sum(1 for r in obj.requirements.all() if r.is_submitted)

    class Meta:
        model = YouthOrganization
        fields = [
            'id',
            'name',
            'classification',
            'sub_classification',
            'registration_category',
            'barangay',
            'description',
            'contact_person',
            'is_compliant',
            'status',
            'created_at',
            'logo_url',
            'requirements_total',
            'requirements_submitted',
        ]

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None


# ---------------------------------------------------------------------------
# YouthOrganization — Detail
# ---------------------------------------------------------------------------

class OrgDetailSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    accomplishments = OrgAccomplishmentSerializer(many=True, read_only=True)
    requirements = OrgRequirementSerializer(many=True, read_only=True)

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None

    class Meta:
        model = YouthOrganization
        fields = [
            'id',
            'name',
            'classification',
            'sub_classification',
            'registration_category',
            'barangay',
            'description',
            'contact_person',
            'contact_email',
            'contact_phone',
            'logo',
            'logo_url',
            'is_active',
            'is_compliant',
            'status',
            'admin_notes',
            'created_at',
            'updated_at',
            'accomplishments',
            'requirements',
        ]
        read_only_fields = ['created_at', 'updated_at', 'is_compliant', 'status', 'admin_notes']


class OrgSubmissionSerializer(serializers.ModelSerializer):
    """Used by verified youth users to submit a new org registration."""

    requirements = serializers.SerializerMethodField()

    class Meta:
        model = YouthOrganization
        fields = [
            'id', 'name', 'classification', 'sub_classification',
            'registration_category', 'barangay', 'description',
            'contact_person', 'contact_email', 'contact_phone',
            'status', 'admin_notes', 'created_at', 'requirements',
        ]
        read_only_fields = ['status', 'admin_notes', 'created_at']

    def get_requirements(self, obj):
        # The owner's checklist: which documents are in and which are still missing.
        return [
            {
                'id': r.id, 'name': r.name, 'is_submitted': r.is_submitted,
                'submitted_at': r.submitted_at, 'notes': r.notes,
            }
            for r in obj.requirements.all()
        ]

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None

    def validate_description(self, value):
        return sanitize(value)
