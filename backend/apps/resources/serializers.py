import bleach
from rest_framework import serializers

from .models import Resource, Scholarship

class ScholarshipSerializer(serializers.ModelSerializer):
    application_status = serializers.SerializerMethodField()
    document_requirements = serializers.SerializerMethodField()
    applications_count = serializers.SerializerMethodField()

    class Meta:
        model = Scholarship
        fields = [
            'id', 'title', 'provider', 'provider_type', 'description',
            'coverage', 'amount', 'deadline', 'slots', 'requirements',
            'application_url', 'category', 'is_published', 'is_featured',
            'eligibility', 'instructions', 'required_documents', 'optional_documents', 'requires_gwa',
            'opens_on', 'closes_on', 'accepting_applications', 'is_sample',
            'application_status', 'document_requirements', 'applications_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_application_status(self, obj):
        from apps.applications.scholarship_logic import application_state
        return application_state(obj)

    def get_document_requirements(self, obj):
        from apps.applications.scholarship_logic import document_requirements
        return document_requirements(obj)

    def get_applications_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated and getattr(request.user, 'role', '') in ('lgu_admin', 'super_admin'):
            return obj.applications.count()
        return None

    def _keys(self, value):
        from apps.applications.documents import DOCUMENT_TYPES
        bad = [k for k in value if k not in DOCUMENT_TYPES]
        if bad:
            raise serializers.ValidationError(f'Unknown document type: {", ".join(map(str, bad))}')
        return value

    def validate_required_documents(self, value):
        return self._keys(value)

    def validate_optional_documents(self, value):
        return self._keys(value)

    def validate_eligibility(self, value):
        return [bleach.clean(str(v), tags=[], strip=True)[:300] for v in value if str(v).strip()]

    def validate_instructions(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate(self, attrs):
        o, c = attrs.get('opens_on'), attrs.get('closes_on')
        if o and c and c < o:
            raise serializers.ValidationError({'closes_on': 'The closing date cannot be before the opening date.'})
        return attrs


ALLOWED_FILE_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.mp4', '.zip'}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


class ResourceSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Resource
        fields = [
            'id',
            'title',
            'description',
            'resource_type',
            'category',
            'law_number',
            'year_enacted',
            'tags',
            'file',
            'file_url',
            'external_url',
            'author',
            'source_url',
            'download_url',
            'material_type',
            'source_kind',
            'status_note',
            'verified_on',
            'thumbnail',
            'thumbnail_url',
            'uploaded_by',
            'uploaded_by_name',
            'is_published',
            'is_featured',
            'download_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['download_count', 'created_at', 'updated_at', 'uploaded_by']
        extra_kwargs = {
            'file': {'write_only': True, 'required': False},
            'thumbnail': {'write_only': True, 'required': False},
        }

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.email
        return None

    def validate_title(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_author(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_status_note(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_description(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_file(self, value):
        if value is None:
            return value

        if value.size > MAX_FILE_SIZE_BYTES:
            raise serializers.ValidationError(
                f'File size must not exceed 10 MB. Received: {value.size / (1024*1024):.2f} MB.'
            )

        import os
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in ALLOWED_FILE_EXTENSIONS:
            raise serializers.ValidationError(
                f'Unsupported file type "{ext}". Allowed: {", ".join(sorted(ALLOWED_FILE_EXTENSIONS))}.'
            )
        return value
