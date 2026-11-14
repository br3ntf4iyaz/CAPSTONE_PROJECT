from rest_framework import serializers

from apps.jobs.models import JobOpportunity
from apps.resources.models import Scholarship

from .models import OpportunityApplication


class ApplicationSerializer(serializers.ModelSerializer):
    document_url = serializers.SerializerMethodField()

    class Meta:
        model = OpportunityApplication
        fields = [
            'id', 'kind', 'object_id', 'title', 'full_name', 'birthdate', 'contact_number', 'email',
            'address', 'id_type', 'id_number', 'message', 'confirmed_requirements', 'document',
            'document_url', 'status', 'submitted_at',
        ]
        read_only_fields = ['id', 'title', 'status', 'submitted_at', 'document_url']
        extra_kwargs = {'document': {'write_only': True, 'required': False}}

    def get_document_url(self, obj):
        if obj.document:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.document.url) if request else obj.document.url
        return None

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
        doc = attrs.get('document')
        if doc is not None and doc.size > 5 * 1024 * 1024:
            raise serializers.ValidationError({'document': 'File must be under 5 MB.'})
        return attrs
