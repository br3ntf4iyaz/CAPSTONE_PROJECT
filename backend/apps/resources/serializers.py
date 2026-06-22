import bleach
from rest_framework import serializers

from .models import Resource, Scholarship

class ScholarshipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scholarship
        fields = [
            'id', 'title', 'provider', 'provider_type', 'description',
            'coverage', 'amount', 'deadline', 'slots', 'requirements',
            'application_url', 'category', 'is_published', 'is_featured',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


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
