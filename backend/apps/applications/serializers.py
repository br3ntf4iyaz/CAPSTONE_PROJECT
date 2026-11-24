import bleach
from rest_framework import serializers

from apps.jobs.models import JobOpportunity
from apps.resources.models import Scholarship

from apps.accounts.uploads import DOC_EXTS, IMAGE_EXTS, check_upload

from .models import OpportunityApplication


class ApplicationSerializer(serializers.ModelSerializer):
    document_url = serializers.SerializerMethodField()
    id_document_url = serializers.SerializerMethodField()

    class Meta:
        model = OpportunityApplication
        fields = [
            'id', 'kind', 'object_id', 'title', 'full_name', 'birthdate', 'contact_number', 'email',
            'address', 'id_type', 'id_number', 'message', 'confirmed_requirements', 'document', 'id_document',
            'document_url', 'id_document_url', 'status', 'submitted_at', 'admin_note', 'reviewed_at',
        ]
        read_only_fields = ['id', 'title', 'status', 'submitted_at', 'document_url', 'id_document_url', 'admin_note', 'reviewed_at']
        extra_kwargs = {'document': {'write_only': True, 'required': False}, 'id_document': {'write_only': True, 'required': False}}

    def _url(self, obj, name, path_name):
        if getattr(obj, name):
            path = f'/api/applications/{obj.pk}/{path_name}/'
            request = self.context.get('request')
            return request.build_absolute_uri(path) if request else path
        return None

    def get_document_url(self, obj):
        return self._url(obj, 'document', 'document')

    def get_id_document_url(self, obj):
        return self._url(obj, 'id_document', 'id-document')

    def to_internal_value(self, data):
        # multipart sends confirmed_requirements as repeated fields
        if hasattr(data, 'getlist'):
            data = data.copy()
            items = data.getlist('confirmed_requirements')
            data.setlist('confirmed_requirements', [])
            ret = super().to_internal_value(data)
            ret['confirmed_requirements'] = items
            return ret
        return super().to_internal_value(data)

    def validate(self, attrs):
        kind, oid = attrs['kind'], attrs['object_id']
        if kind == 'scholarship':
            raise serializers.ValidationError('Please use the scholarship application form.')
        if kind == 'scholarship':
            obj = Scholarship.objects.filter(pk=oid, is_published=True).first()
            title = obj.title if obj else None
        else:
            obj = JobOpportunity.objects.filter(pk=oid, is_active=True).first()
            title = obj.title if obj else None
        if not obj:
            raise serializers.ValidationError('That opportunity is no longer available.')
        attrs['title'] = title
        user = self.context['request'].user
        if OpportunityApplication.objects.filter(applicant=user, kind=kind, object_id=oid).exists():
            raise serializers.ValidationError('You already applied to this opportunity.')
        # A job application must carry a valid government ID (type, number and a photo or scan) and the resume.
        missing = {}
        if not (attrs.get('id_type') or '').strip():
            missing['id_type'] = 'Choose the type of your valid ID.'
        if not (attrs.get('id_number') or '').strip():
            missing['id_number'] = 'Enter the number on your valid ID.'
        if not attrs.get('id_document'):
            missing['id_document'] = 'Upload a clear photo or scan of your valid ID.'
        if not attrs.get('document'):
            missing['document'] = 'Upload your resume.'
        if missing:
            raise serializers.ValidationError(missing)
        check_upload(attrs.get('id_document'), IMAGE_EXTS | {'.pdf'}, 5 * 1024 * 1024, field='id_document')
        check_upload(attrs.get('document'), DOC_EXTS | IMAGE_EXTS, 5 * 1024 * 1024, field='document')
        return attrs


class ApplicationReviewSerializer(serializers.ModelSerializer):
    """Admin-only: change the status of an application and leave a note."""

    class Meta:
        model = OpportunityApplication
        fields = ['status', 'admin_note']

    def validate_admin_note(self, value):
        return bleach.clean(value, tags=[], strip=True)[:1000]
