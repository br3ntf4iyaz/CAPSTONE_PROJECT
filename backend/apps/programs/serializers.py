import bleach
from rest_framework import serializers

from .models import FeaturedSlide, ProgramSubmission, SubmissionAttachment, SubmissionReviewLog, YouthProgram

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
# YouthProgram — List
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# FeaturedSlide
# ---------------------------------------------------------------------------

class FeaturedSlideSerializer(serializers.ModelSerializer):
    tag_label = serializers.ReadOnlyField()
    tag_color = serializers.ReadOnlyField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = FeaturedSlide
        fields = [
            'id', 'title', 'description', 'organizer',
            'tag_type', 'tag_label', 'tag_color',
            'image', 'image_url',
            'order', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'tag_label', 'tag_color', 'image_url', 'created_at', 'updated_at']

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url


class ProgramListSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    submitter_type_display = serializers.CharField(source='get_submitter_type_display', read_only=True)
    total_participants = serializers.IntegerField(read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True, default=None)
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = YouthProgram
        fields = [
            'id',
            'title',
            'category',
            'category_display',
            'status',
            'status_display',
            'submitter_type',
            'submitter_type_display',
            'organization',
            'organization_name',
            'barangay',
            'start_date',
            'end_date',
            'location',
            'is_featured',
            'total_participants',
            'thumbnail_url',
            'contact_person',
            'contact_email',
            'contact_phone',
            'created_at',
        ]

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None


# ---------------------------------------------------------------------------
# YouthProgram — Detail
# ---------------------------------------------------------------------------

class ProgramDetailSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    submitter_type_display = serializers.CharField(source='get_submitter_type_display', read_only=True)
    total_participants = serializers.IntegerField(read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True, default=None)
    submitted_by_email = serializers.EmailField(
        source='submitted_by.email', read_only=True, default=None
    )
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = YouthProgram
        fields = [
            'id',
            'title',
            'category',
            'category_display',
            'status',
            'status_display',
            'submitter_type',
            'submitter_type_display',
            'organization',
            'organization_name',
            'barangay',
            'description',
            'objectives',
            'target_beneficiaries',
            'male_participants',
            'female_participants',
            'total_participants',
            'start_date',
            'end_date',
            'location',
            'submitted_by',
            'submitted_by_email',
            'is_featured',
            'thumbnail',
            'thumbnail_url',
            'contact_person',
            'contact_email',
            'contact_phone',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['submitted_by', 'created_at', 'updated_at']

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None

    def validate_description(self, value):
        return sanitize(value)

    def validate_objectives(self, value):
        return sanitize(value)

    def validate_target_beneficiaries(self, value):
        return sanitize(value)

    def validate(self, attrs):
        start = attrs.get('start_date')
        end = attrs.get('end_date')
        if start and end and end < start:
            raise serializers.ValidationError('end_date must be on or after start_date.')
        return attrs


# ---------------------------------------------------------------------------
# SubmissionAttachment
# ---------------------------------------------------------------------------

class SubmissionAttachmentSerializer(serializers.ModelSerializer):
    submission = serializers.PrimaryKeyRelatedField(
        queryset=ProgramSubmission.objects.all(), write_only=True, required=False
    )
    uploaded_by = serializers.HiddenField(default=serializers.CurrentUserDefault())
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionAttachment
        fields = ['id', 'submission', 'kind', 'file', 'file_url', 'label', 'uploaded_by', 'uploaded_at']
        read_only_fields = ['uploaded_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


# ---------------------------------------------------------------------------
# SubmissionReviewLog
# ---------------------------------------------------------------------------

class SubmissionReviewLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionReviewLog
        fields = ['id', 'action', 'action_display', 'notes', 'actor_name', 'created_at']
        read_only_fields = ['id', 'action', 'action_display', 'notes', 'actor_name', 'created_at']

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.get_full_name() or obj.actor.email
        return None


# ---------------------------------------------------------------------------
# ProgramSubmission — List (compact)
# ---------------------------------------------------------------------------

class SubmissionListSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = ProgramSubmission
        fields = [
            'id',
            'title',
            'category',
            'category_display',
            'submitter_type',
            'status',
            'status_display',
            'submitted_at',
            'updated_at',
            'thumbnail_url',
            'expected_participants',
        ]

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None


# ---------------------------------------------------------------------------
# ProgramSubmission — Detail (full)
# ---------------------------------------------------------------------------

class SubmissionDetailSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    thumbnail_url = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    completion_report_url = serializers.SerializerMethodField()
    review_logs = SubmissionReviewLogSerializer(many=True, read_only=True)
    attachments = SubmissionAttachmentSerializer(many=True, read_only=True)
    submitted_by_email = serializers.SerializerMethodField()
    submitted_by_name = serializers.SerializerMethodField()
    reviewed_by_email = serializers.SerializerMethodField()

    class Meta:
        model = ProgramSubmission
        fields = [
            'id',
            'program',
            'submitter_type',
            'submitted_by',
            'submitted_by_email',
            'submitted_by_name',
            'organization',
            'title',
            'category',
            'category_display',
            'submission_type',
            'policy_type',
            'policy_date_passed',
            'abyip_reference_code',
            'expected_result',
            'performance_indicator',
            'period_of_implementation',
            'actual_disbursement',
            'description',
            'objectives',
            'target_beneficiaries',
            'start_date',
            'end_date',
            'location',
            'barangay',
            'expected_participants',
            'male_participants',
            'female_participants',
            'lgbtq_participants',
            'prefer_not_say_participants',
            'estimated_budget',
            'thumbnail',
            'thumbnail_url',
            'file',
            'submitted_at',
            'updated_at',
            'status',
            'status_display',
            'admin_notes',
            'revision_notes',
            'actual_participants',
            'outcomes_narrative',
            'completion_report_file',
            'completion_report_url',
            'reviewed_by',
            'reviewed_by_email',
            'reviewed_at',
            'approved_at',
            'completed_at',
            'review_logs',
            'attachments',
        ]
        read_only_fields = ['submitted_at', 'updated_at', 'status', 'reviewed_by', 'reviewed_at', 'approved_at', 'completed_at']

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def get_completion_report_url(self, obj):
        request = self.context.get('request')
        if obj.completion_report_file and request:
            return request.build_absolute_uri(obj.completion_report_file.url)
        return None

    def get_submitted_by_email(self, obj):
        return obj.submitted_by.email if obj.submitted_by_id else None

    def get_submitted_by_name(self, obj):
        if obj.submitted_by_id:
            return obj.submitted_by.get_full_name() or obj.submitted_by.email
        return None

    def get_reviewed_by_email(self, obj):
        return obj.reviewed_by.email if obj.reviewed_by_id else None


# ---------------------------------------------------------------------------
# ProgramSubmission — Create/Update (submitter)
# ---------------------------------------------------------------------------

class SubmissionCreateSerializer(serializers.ModelSerializer):
    submitted_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = ProgramSubmission
        fields = [
            'id',
            'title',
            'category',
            'submission_type',
            'policy_type',
            'policy_date_passed',
            'abyip_reference_code',
            'expected_result',
            'performance_indicator',
            'period_of_implementation',
            'actual_disbursement',
            'submitter_type',
            'description',
            'objectives',
            'target_beneficiaries',
            'start_date',
            'end_date',
            'location',
            'barangay',
            'expected_participants',
            'male_participants',
            'female_participants',
            'lgbtq_participants',
            'prefer_not_say_participants',
            'estimated_budget',
            'thumbnail',
            'file',
            'submitted_by',
            'status',
        ]
        read_only_fields = ['status']

    def validate_description(self, value):
        return sanitize(value)

    def validate_objectives(self, value):
        return sanitize(value)

    def validate_target_beneficiaries(self, value):
        return sanitize(value)

    def validate_file(self, value):
        if value:
            return validate_pdf(value)
        return value

    def validate_thumbnail(self, value):
        if value:
            allowed_types = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
            if hasattr(value, 'content_type') and value.content_type not in allowed_types:
                raise serializers.ValidationError('Thumbnail must be a JPG, PNG, WEBP, or GIF image.')
            if value.size > MAX_FILE_SIZE:
                raise serializers.ValidationError('Thumbnail must not exceed 10 MB.')
        return value

    def validate(self, attrs):
        start = attrs.get('start_date')
        end = attrs.get('end_date')
        if start and end and end < start:
            raise serializers.ValidationError('end_date must be on or after start_date.')
        return attrs


# ---------------------------------------------------------------------------
# ProgramSubmission — Review (admin)
# ---------------------------------------------------------------------------

class SubmissionReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgramSubmission
        fields = ['status', 'admin_notes', 'revision_notes']


# ---------------------------------------------------------------------------
# ProgramSubmission — Completion Report
# ---------------------------------------------------------------------------

class CompletionReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgramSubmission
        fields = ['actual_participants', 'outcomes_narrative', 'completion_report_file']

    def validate_completion_report_file(self, value):
        if not value:
            raise serializers.ValidationError('Completion report file is required.')
        if not value.name.lower().endswith('.pdf'):
            raise serializers.ValidationError('Only PDF files are accepted.')
        if value.size > MAX_FILE_SIZE:
            raise serializers.ValidationError('File size must not exceed 10 MB.')
        return value

    def validate_outcomes_narrative(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Outcomes narrative is required.')
        return value

    def validate_actual_participants(self, value):
        if value is None:
            raise serializers.ValidationError('Actual participants count is required.')
        return value


# ---------------------------------------------------------------------------
# Backward-compatibility alias
# ---------------------------------------------------------------------------

# AdminDashPage.tsx and any other code that imports ProgramSubmissionSerializer
# expects the list-style compact representation.
ProgramSubmissionSerializer = SubmissionListSerializer
