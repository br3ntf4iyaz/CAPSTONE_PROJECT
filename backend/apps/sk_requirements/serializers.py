import bleach
from rest_framework import serializers

from .models import SKBarangay, SKFeedback, SKRequirement, SKRequirementTemplate

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
# SKRequirementTemplate
# ---------------------------------------------------------------------------

class SKRequirementTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SKRequirementTemplate
        fields = ['id', 'name', 'description', 'order']


# ---------------------------------------------------------------------------
# SKRequirement
# ---------------------------------------------------------------------------

class SKRequirementSerializer(serializers.ModelSerializer):
    requirement_type_display = serializers.CharField(
        source='get_requirement_type_display', read_only=True
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    reviewed_by_email = serializers.EmailField(
        source='reviewed_by.email', read_only=True, default=None
    )

    class Meta:
        model = SKRequirement
        fields = [
            'id',
            'barangay',
            'requirement_type',
            'requirement_type_display',
            'status',
            'status_display',
            'file',
            'submitted_at',
            'due_date',
            'notes',
            'reviewed_by',
            'reviewed_by_email',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['submitted_at', 'reviewed_at', 'created_at', 'updated_at']

    def validate_file(self, value):
        return validate_pdf(value)

    def validate_notes(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# SKRequirement — Compact (embedded in list response)
# ---------------------------------------------------------------------------

class SKRequirementCompactSerializer(serializers.ModelSerializer):
    key = serializers.CharField(source='requirement_type')
    label = serializers.CharField(source='get_requirement_type_display', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = SKRequirement
        fields = ['id', 'key', 'label', 'status', 'file_url', 'submitted_at']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


# ---------------------------------------------------------------------------
# SKBarangay — List
# ---------------------------------------------------------------------------

class SKBarangayListSerializer(serializers.ModelSerializer):
    # Aliases expected by the admin frontend
    name = serializers.CharField(source='barangay_name')
    chairperson = serializers.CharField(source='sk_chairperson', allow_blank=True)
    requirements = SKRequirementCompactSerializer(many=True, read_only=True)
    total_requirements = serializers.IntegerField(read_only=True)
    requirements_total = serializers.IntegerField(read_only=True, source='total_requirements')
    submitted_count = serializers.IntegerField(read_only=True)
    requirements_submitted = serializers.IntegerField(read_only=True, source='submitted_count')
    pending_count = serializers.IntegerField(read_only=True)
    overdue_count = serializers.IntegerField(read_only=True)
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = SKBarangay
        fields = [
            'id',
            'name',
            'chairperson',
            'barangay_name',
            'sk_chairperson',
            'contact_email',
            'contact_phone',
            'logo_url',
            'is_active',
            'created_at',
            'requirements',
            'requirements_total',
            'requirements_submitted',
            'total_requirements',
            'submitted_count',
            'pending_count',
            'overdue_count',
        ]

    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None


# ---------------------------------------------------------------------------
# SKBarangay — Detail
# ---------------------------------------------------------------------------

class SKBarangayDetailSerializer(serializers.ModelSerializer):
    requirements = SKRequirementSerializer(many=True, read_only=True)
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = SKBarangay
        fields = [
            'id',
            'barangay_name',
            'sk_chairperson',
            'contact_email',
            'contact_phone',
            'description',
            'logo_url',
            'is_active',
            'created_at',
            'requirements',
        ]
        read_only_fields = ['created_at']

    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None

    def validate_description(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# SKFeedback
# ---------------------------------------------------------------------------

class SKFeedbackSerializer(serializers.ModelSerializer):
    submitter_name = serializers.SerializerMethodField()
    barangay_name = serializers.CharField(source='barangay.barangay_name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = SKFeedback
        fields = [
            'id', 'barangay', 'barangay_name', 'category', 'category_display',
            'subject', 'message', 'rating', 'image_url', 'is_anonymous',
            'status', 'status_display', 'submitter_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'barangay', 'submitted_by']

    def get_submitter_name(self, obj):
        if obj.is_anonymous:
            return 'Anonymous'
        if obj.submitted_by:
            return obj.submitted_by.get_full_name() or obj.submitted_by.email
        return 'Unknown'

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None
