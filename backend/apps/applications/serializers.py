import json

import bleach
from rest_framework import serializers

from apps.jobs.models import JobOpportunity
from apps.resources.models import Scholarship

from apps.accounts.uploads import DOC_EXTS, IMAGE_EXTS, check_upload

from .models import OpportunityApplication


class ApplicationSerializer(serializers.ModelSerializer):
    document_url = serializers.SerializerMethodField()
    id_document_url = serializers.SerializerMethodField()
    id_document_back_url = serializers.SerializerMethodField()
    selfie_url = serializers.SerializerMethodField()

    class Meta:
        model = OpportunityApplication
        fields = [
            'id', 'kind', 'object_id', 'title', 'full_name', 'birthdate', 'contact_number', 'email',
            'address', 'id_type', 'id_number', 'message', 'confirmed_requirements', 'document', 'id_document',
            'id_document_back', 'selfie', 'face_check', 'resubmit_count', 'previous_note',
            'document_url', 'id_document_url', 'id_document_back_url', 'selfie_url',
            'status', 'submitted_at', 'admin_note', 'reviewed_at',
        ]
        read_only_fields = ['id', 'title', 'status', 'submitted_at', 'document_url', 'id_document_url', 'id_document_back_url',
                            'selfie_url', 'admin_note', 'reviewed_at', 'resubmit_count', 'previous_note']
        extra_kwargs = {
            'document': {'write_only': True, 'required': False},
            'id_document': {'write_only': True, 'required': False},
            'id_document_back': {'write_only': True, 'required': False},
            'selfie': {'write_only': True, 'required': False},
            'kind': {'required': False}, 'object_id': {'required': False},
        }

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

    def get_id_document_back_url(self, obj):
        return self._url(obj, 'id_document_back', 'id-document-back')

    def get_selfie_url(self, obj):
        return self._url(obj, 'selfie', 'selfie')

    def validate_face_check(self, value):
        """Keep only plain numbers and flags from the device. The reviewer, not this number, decides."""
        if isinstance(value, str):
            try:
                value = json.loads(value or '{}')
            except ValueError:
                value = {}
        if not isinstance(value, dict):
            return {}
        out = {}
        for k in ('distance', 'similarity'):
            v = value.get(k)
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                out[k] = round(float(v), 4)
        if isinstance(value.get('matched'), bool):
            out['matched'] = value['matched']
        for k in ('front', 'back', 'selfie'):
            m = value.get(k)
            if isinstance(m, dict):
                out[k] = {'uploaded': bool(m.get('uploaded')), 'liveness': bool(m.get('liveness')), 'cardDetected': bool(m.get('cardDetected'))}
        return out

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
        resubmitting = self.instance is not None
        kind = attrs.get('kind') or (self.instance.kind if resubmitting else None)
        oid = attrs.get('object_id') or (self.instance.object_id if resubmitting else None)
        if kind is None or oid is None:
            raise serializers.ValidationError('Choose the job you are applying to.')
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
        if not resubmitting and OpportunityApplication.objects.filter(applicant=user, kind=kind, object_id=oid).exists():
            raise serializers.ValidationError('You already applied to this opportunity.')
        # A job application must carry a valid government ID scanned with the camera (front AND back), a live selfie for the
        # face check, and the resume. When sending it again after a refusal, the resume already on file may be kept.
        missing = {}
        if not (attrs.get('id_type') or '').strip():
            missing['id_type'] = 'Choose the type of your valid ID.'
        if not (attrs.get('id_number') or '').strip():
            missing['id_number'] = 'Enter the number on your valid ID.'
        if not attrs.get('id_document'):
            missing['id_document'] = 'Scan the FRONT of your valid ID with the camera.'
        if not attrs.get('id_document_back'):
            missing['id_document_back'] = 'Scan the BACK of your valid ID with the camera.'
        if not attrs.get('selfie'):
            missing['selfie'] = 'Take a live selfie for the face check.'
        if not attrs.get('document') and not (resubmitting and self.instance.document):
            missing['document'] = 'Upload your resume.'
        if missing:
            raise serializers.ValidationError(missing)
        face = attrs.get('face_check') or {}
        if any((face.get(part) or {}).get('uploaded') for part in ('front', 'back', 'selfie')):
            raise serializers.ValidationError({'id_document': 'The ID and the selfie must be taken with the camera, not uploaded from the gallery.'})
        if face.get('matched') is False:
            raise serializers.ValidationError({'selfie': 'Your face does not match the photo on the ID. Retake the selfie or the ID photo.'})
        for field in ('id_document', 'id_document_back', 'selfie'):
            check_upload(attrs.get(field), IMAGE_EXTS, 8 * 1024 * 1024, field=field)
        check_upload(attrs.get('document'), DOC_EXTS | IMAGE_EXTS, 5 * 1024 * 1024, field='document')
        return attrs


class ApplicationReviewSerializer(serializers.ModelSerializer):
    """Admin-only: change the status of an application and leave a note."""

    class Meta:
        model = OpportunityApplication
        fields = ['status', 'admin_note']

    def validate_admin_note(self, value):
        return bleach.clean(value, tags=[], strip=True)[:1000]
